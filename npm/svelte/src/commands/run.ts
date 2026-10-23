import { authHeaders, createShapeUrl } from "../electric/url.js"

/** Methods for bounded operations, including POST read queries. */
export type CommandMethod = "POST" | "PUT" | "PATCH" | "DELETE"

/** Per-call overrides a generated command accepts. */
export interface CommandOptions {
  /** Host transport retaining its response wrapper, scope and runtime codecs. */
  transport?: (request: CommandRequest) => Promise<CommandTransportResponse>
  /** Replaces the global fetch (tests, SvelteKit `load`, instrumentation). */
  fetch?: typeof fetch
  /** Extra request headers, merged after the defaults. */
  headers?: Record<string, string>
  /** Abort signal for cancellation. */
  signal?: AbortSignal
}

/** A host transport's response, before declared error-code narrowing. */
export interface CommandTransportResponse {
  ok: boolean
  status: number
  payload: unknown
}

export interface CommandRequest extends CommandOptions {
  path: string
  method: CommandMethod
  params?: Record<string, string | number>
  body?: unknown
}

/**
 * The observed response of a command, without domain payload validation.
 *
 * A failure is a value, not an exception: every call site has to handle both
 * arms to compile. `error` is one of the command's declared codes, or
 * `"unknown_error"` when the server answered with a code this build does not
 * know — so an unrecognised code degrades to a handled failure instead of
 * escaping as an untyped string. `unknown_error` does not establish that an
 * effect failed. Reconcile the original operation before any consequential retry.
 */
export type CommandResult<TData, TError extends string> =
  | { ok: true; data: TData }
  | { ok: false; error: TError | "unknown_error"; status: number }

/** The error code every command can return regardless of its declaration. */
export const UNKNOWN_COMMAND_ERROR = "unknown_error" as const

/**
 * Executes one generated command and normalises the outcome.
 *
 * Never throws and never rejects: a network failure, an unparseable body and an
 * undeclared error code all resolve to the failure arm. `knownErrors` is the
 * command's declared code list, and only a code in that list is passed through
 * with its own name.
 */
export async function runCommand<TData, TError extends string>(
  request: CommandRequest,
  knownErrors: readonly TError[] = [],
): Promise<CommandResult<TData, TError>> {
  let status = 0
  try {
    if (request.transport) {
      const response = await request.transport(request)
      return response.ok
        ? { ok: true, data: response.payload as TData }
        : { ok: false, error: errorCode(response.payload, knownErrors), status: response.status }
    }
    const { path, method, params = {}, body, headers = {}, signal } = request
    const fetchFn = request.fetch ?? fetch
    const requestHeaders = new Headers({ "Content-Type": "application/json" })
    for (const source of [authHeaders(), headers])
      for (const [name, value] of Object.entries(source ?? {})) requestHeaders.set(name, value)

    const response = await fetchFn(createShapeUrl(path, params), {
      method,
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    })
    status = response.status
    const payload = await readJson(response)

    if (response.ok) return { ok: true, data: payload as TData }

    return {
      ok: false,
      error: errorCode(payload, knownErrors),
      status: response.status,
    }
  } catch {
    return { ok: false, error: UNKNOWN_COMMAND_ERROR, status }
  }
}

/** Reads a JSON body, tolerating an empty one (204, or a bodiless error). */
async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return null
  return response.json()
}

/** Narrows the server's `error` field to a declared code, or `unknown_error`. */
function errorCode<TError extends string>(
  payload: unknown,
  knownErrors: readonly TError[],
): TError | typeof UNKNOWN_COMMAND_ERROR {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return UNKNOWN_COMMAND_ERROR
  }

  const code = (payload as { error: unknown }).error

  return typeof code === "string" && (knownErrors as readonly string[]).includes(code)
    ? (code as TError)
    : UNKNOWN_COMMAND_ERROR
}
