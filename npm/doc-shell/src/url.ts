/** A dynamic link after it has passed the doc-shell URL policy. */
export interface SafeLinkTarget {
  href: string
  /** External web links open in a new browsing context with opener isolation. */
  external: boolean
  /** Host-side navigation callbacks are only used for same-origin web paths. */
  navigable: boolean
}

/** A resolved destination for the OpenAPI try-it panel. */
export interface TryItTarget {
  url: string
  origin: string
  crossOrigin: boolean
}

const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f-\u009f]/g
const SCHEME = /^([a-z][a-z\d+.-]*):/i
const NUMERIC_ENTITY = /&#(?:x([\da-f]+)|(\d+));?/gi

function browserHref(): string {
  return typeof window === "undefined" ? "http://localhost/" : window.location.href
}

function decodeForPolicy(value: string): string {
  let decoded = value

  // Browsers do not currently decode every one of these spellings in an href,
  // but normalising them here prevents a later renderer or sanitizer change
  // from turning a previously accepted value into an executable scheme.
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }

  return decoded
    .replace(NUMERIC_ENTITY, (_match, hex: string | undefined, decimal: string | undefined) => {
      const codePoint = Number.parseInt(hex ?? decimal ?? "0", hex ? 16 : 10)
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ""
    })
    .replace(/&colon;/gi, ":")
    .replace(CONTROL_OR_SPACE, "")
}

function hasSchemeRelativePrefix(value: string): boolean {
  return value.startsWith("//") || value.startsWith("\\\\")
}

/**
 * Accepts relative links plus deliberate HTTP(S) and mailto destinations.
 * Unknown and executable schemes, encoded scheme spellings, backslashes, and
 * scheme-relative URLs are rejected rather than rendered into an `href`.
 */
export function safeLinkTarget(
  value: unknown,
  currentHref = browserHref(),
): SafeLinkTarget | undefined {
  const href = typeof value === "string" ? value.trim() : undefined
  if (!href || href.includes("\\")) return undefined

  const policyValue = decodeForPolicy(href)
  if (hasSchemeRelativePrefix(policyValue)) return undefined

  const match = policyValue.match(SCHEME)
  if (!match) return { href, external: false, navigable: true }

  const scheme = match[1]?.toLowerCase()
  if (scheme === "mailto") return { href, external: false, navigable: false }
  if (scheme !== "http" && scheme !== "https") return undefined

  try {
    const destination = new URL(href)
    const external = destination.origin !== new URL(currentHref).origin
    return { href: destination.href, external, navigable: !external }
  } catch {
    return undefined
  }
}

/**
 * Resolves a try-it request without allowing an operation path to replace the
 * configured API origin. OpenAPI path keys are root-relative by contract.
 */
export function resolveTryItTarget(
  baseUrl: string,
  operationPath: string,
  currentHref = browserHref(),
): TryItTarget {
  const path = operationPath.trim()
  if (!path.startsWith("/") || hasSchemeRelativePrefix(path) || path.includes("\\")) {
    throw new Error("Try-it operation paths must be root-relative URLs")
  }

  const configuredBase = baseUrl.trim()
  if (hasSchemeRelativePrefix(decodeForPolicy(configuredBase))) {
    throw new Error("Try-it base URLs cannot be scheme-relative")
  }

  const page = new URL(currentHref)
  const base = new URL(configuredBase || "/", page)
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("Try-it base URLs must use HTTP(S) without embedded credentials")
  }

  const prefix = base.pathname === "/" ? "" : base.pathname.replace(/\/$/, "")
  const destination = new URL(`${prefix}${path}`, base.origin)

  return {
    url: destination.href,
    origin: destination.origin,
    crossOrigin: destination.origin !== page.origin,
  }
}

/** True only when an origin is exactly present in the explicit allowlist. */
export function isAllowedTryItOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  return allowedOrigins.some((candidate) => {
    try {
      const parsed = new URL(candidate)
      return ["http:", "https:"].includes(parsed.protocol) && parsed.origin === origin
    } catch {
      return false
    }
  })
}
