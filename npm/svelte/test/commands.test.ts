import { afterEach, describe, expect, it, vi } from "vitest"
import { runCommand } from "../src/commands/run"
import { configureShapeAuth, resetShapeAuth } from "../src/electric/url"

const ERRORS = ["edit_rejected", "not_found"] as const

function respond(
  status: number,
  body: unknown,
  init: { json?: () => Promise<unknown> } = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: init.json ?? (async () => body),
  } as unknown as Response
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  resetShapeAuth()
})

describe("runCommand", () => {
  it("uses the host transport once without bypassing its wrapper or scope", async () => {
    const signal = new AbortController().signal
    const transport = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        payload: { data: { count: 2 }, meta: { cursor: "next" } },
      })
    const result = await runCommand({
      path: "/api/search",
      method: "POST",
      body: { query: "bounded" },
      headers: { "Idempotency-Key": "original" },
      signal,
      transport,
    })
    expect(result).toEqual({ ok: true, data: { data: { count: 2 }, meta: { cursor: "next" } } })
    expect(transport).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        path: "/api/search",
        signal,
        headers: { "Idempotency-Key": "original" },
      }),
    )
  })

  it("narrows host errors and leaves lost outcomes unknown without replay", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, payload: { error: "not_found" } })
      .mockRejectedValueOnce(new Error("response lost after commit"))
    const request = { path: "/api/pages", method: "POST" as const, transport }
    expect(await runCommand(request, ERRORS)).toEqual({
      ok: false,
      status: 403,
      error: "not_found",
    })
    expect(await runCommand(request, ERRORS)).toEqual({
      ok: false,
      status: 0,
      error: "unknown_error",
    })
    expect(transport).toHaveBeenCalledTimes(2)
  })
  it("returns the parsed payload on success", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, { id: "page-1" }))

    expect(
      await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS),
    ).toEqual({ ok: true, data: { id: "page-1" } })
  })

  it("substitutes path params and serialises the body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, {}))

    await runCommand(
      {
        path: "/api/pages/:id/layout",
        method: "PUT",
        params: { id: "a b" },
        body: { layout_ir: { root: {} } },
        fetch: fetchFn,
      },
      ERRORS,
    )

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe("/api/pages/a%20b/layout")
    expect(init.method).toBe("PUT")
    expect(init.body).toBe(JSON.stringify({ layout_ir: { root: {} } }))
    expect(new Headers(init.headers).get("content-type")).toBe("application/json")
  })

  it("omits the body entirely when none is given", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, {}))

    await runCommand({ path: "/api/ping", method: "POST", fetch: fetchFn }, ERRORS)

    expect(fetchFn.mock.calls[0][1]).not.toHaveProperty("body")
  })

  it("passes a declared error code through with its own name", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(422, { error: "edit_rejected" }))

    expect(
      await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS),
    ).toEqual({ ok: false, error: "edit_rejected", status: 422 })
  })

  it("degrades an undeclared code to unknown_error rather than leaking it", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(422, { error: "brand_new_code" }))

    expect(
      await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS),
    ).toEqual({ ok: false, error: "unknown_error", status: 422 })
  })

  it("treats a bodiless or unparseable failure as unknown_error", async () => {
    const unparseable = respond(500, null, {
      json: async () => {
        throw new Error("not json")
      },
    })
    const fetchFn = vi.fn().mockResolvedValue(unparseable)

    expect(
      await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS),
    ).toEqual({ ok: false, error: "unknown_error", status: 500 })
  })

  it("never rejects when the request itself fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("offline"))

    expect(
      await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS),
    ).toEqual({ ok: false, error: "unknown_error", status: 0 })
  })

  it.each([
    [
      "token reader",
      {
        readToken: () => {
          throw new Error("token source failed")
        },
      },
    ],
    [
      "header callback",
      {
        headers: () => {
          throw new Error("header source failed")
        },
      },
    ],
  ])("normalizes a throwing %s", async (_name, auth) => {
    configureShapeAuth(auth)
    const fetchFn = vi.fn()

    await expect(
      runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS),
    ).resolves.toEqual({ ok: false, error: "unknown_error", status: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("normalizes a missing path parameter before fetch", async () => {
    const fetchFn = vi.fn()

    await expect(
      runCommand({ path: "/api/pages/:id", method: "POST", fetch: fetchFn }, ERRORS),
    ).resolves.toEqual({ ok: false, error: "unknown_error", status: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("normalizes circular request bodies before fetch", async () => {
    const body: { self?: unknown } = {}
    body.self = body
    const fetchFn = vi.fn()

    await expect(
      runCommand({ path: "/api/pages", method: "POST", body, fetch: fetchFn }, ERRORS),
    ).resolves.toEqual({ ok: false, error: "unknown_error", status: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("normalizes malformed response objects", async () => {
    const fetchFn = vi.fn().mockResolvedValue(null)

    await expect(
      runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS),
    ).resolves.toEqual({ ok: false, error: "unknown_error", status: 0 })
  })

  it("normalizes abort rejection", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"))
    const controller = new AbortController()
    controller.abort()

    await expect(
      runCommand(
        {
          path: "/api/pages",
          method: "POST",
          fetch: fetchFn,
          signal: controller.signal,
        },
        ERRORS,
      ),
    ).resolves.toEqual({ ok: false, error: "unknown_error", status: 0 })
  })

  it("returns null data for a 204 without reading the body", async () => {
    const json = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue(respond(204, null, { json }))

    expect(
      await runCommand({ path: "/api/pages/1", method: "DELETE", fetch: fetchFn }, ERRORS),
    ).toEqual({ ok: true, data: null })
    expect(json).not.toHaveBeenCalled()
  })

  it("sends the auth header when a token is present", async () => {
    localStorage.setItem("auth_token", "t-1")
    const fetchFn = vi.fn().mockResolvedValue(respond(200, {}))

    await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn }, ERRORS)

    expect(new Headers(fetchFn.mock.calls[0][1].headers).get("authorization")).toBe("Bearer t-1")
  })

  it("lets caller headers win over the defaults", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, {}))

    await runCommand(
      {
        path: "/api/pages",
        method: "POST",
        fetch: fetchFn,
        headers: { "Content-Type": "application/vnd.api+json" },
      },
      ERRORS,
    )

    expect(new Headers(fetchFn.mock.calls[0][1].headers).get("content-type")).toBe(
      "application/vnd.api+json",
    )
  })

  it("forwards an abort signal", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, {}))
    const controller = new AbortController()

    await runCommand(
      { path: "/api/pages", method: "POST", fetch: fetchFn, signal: controller.signal },
      ERRORS,
    )

    expect(fetchFn.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it("treats every failure as unknown when no codes are declared", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(403, { error: "forbidden" }))

    expect(await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn })).toEqual({
      ok: false,
      error: "unknown_error",
      status: 403,
    })
  })
})

it("rejects malformed success JSON while preserving the HTTP status", async () => {
  const fetchFn = vi.fn().mockResolvedValue(
    respond(200, null, {
      json: async () => {
        throw new SyntaxError("invalid JSON")
      },
    }),
  )
  expect(await runCommand({ path: "/api/pages", method: "POST", fetch: fetchFn })).toEqual({
    ok: false,
    error: "unknown_error",
    status: 200,
  })
})

it("overrides authorization and content type regardless of header casing", async () => {
  localStorage.setItem("auth_token", "old")
  const fetchFn = vi.fn().mockResolvedValue(respond(200, {}))
  await runCommand({
    path: "/api/pages",
    method: "POST",
    fetch: fetchFn,
    headers: { authorization: "Bearer new", "content-type": "application/custom+json" },
  })
  const headers = new Headers(fetchFn.mock.calls[0][1].headers)
  expect(headers.get("authorization")).toBe("Bearer new")
  expect(headers.get("content-type")).toBe("application/custom+json")
})
