import type { PresentationSettings } from "./types.js"

const bytes = new TextEncoder()
const keys = ["brand", "footer", "labels", "locales", "releases", "metadata", "robots"]
const tokens = new Set([
  "index",
  "noindex",
  "follow",
  "nofollow",
  "noarchive",
  "nosnippet",
  "noimageindex",
])
type ObjectValue = Record<string, unknown>
const record = (value: unknown): value is ObjectValue =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const object = (value: unknown, allowed: string[]): value is ObjectValue =>
  record(value) && Object.keys(value).every((key) => allowed.includes(key))
const text = (value: unknown, empty = false): value is string =>
  typeof value === "string" &&
  (empty || value.length > 0) &&
  !/[\uD800-\uDFFF]/u.test(value) &&
  bytes.encode(value).length <= 4096
const optional = (value: ObjectValue, key: string, check: (value: unknown) => boolean) =>
  !Object.hasOwn(value, key) || check(value[key])
const list = (value: unknown, check: (value: unknown) => boolean): value is unknown[] =>
  Array.isArray(value) && value.length <= 64 && value.every(check)
const url = (value: unknown): value is string => {
  if (!text(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return false
  if (value.startsWith("/")) return !value.startsWith("//")
  try {
    const parsed = new URL(value)
    return (
      /^https?:\/\//.test(value) &&
      ["http:", "https:"].includes(parsed.protocol) &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    )
  } catch {
    return false
  }
}
const link = (value: unknown) =>
  object(value, ["label", "href"]) && text(value.label) && url(value.href)
const logo = (value: unknown) =>
  object(value, ["asset", "alt"]) &&
  text(value.asset) &&
  text(value.alt, true) &&
  !value.asset.startsWith("/") &&
  !value.asset.includes("..") &&
  !/[:\\?#\u0000]/.test(value.asset)
const destinations = (value: unknown) => {
  if (
    !list(
      value,
      (entry) =>
        object(entry, ["id", "label", "href", "current"]) &&
        text(entry.id) &&
        text(entry.label) &&
        url(entry.href) &&
        optional(entry, "current", (current) => typeof current === "boolean"),
    )
  )
    return false
  const entries = value as ObjectValue[]
  return (
    new Set(entries.map((entry) => entry.id)).size === entries.length &&
    entries.filter((entry) => entry.current).length <= 1
  )
}
const robotTokens = (value: unknown) =>
  list(value, (token) => typeof token === "string" && tokens.has(token)) &&
  new Set(value).size === value.length &&
  !(value.includes("index") && value.includes("noindex")) &&
  !(value.includes("follow") && value.includes("nofollow"))
const valid = (key: string, value: unknown): boolean => {
  switch (key) {
    case "brand":
      return (
        object(value, ["label", "href", "logo"]) &&
        text(value.label) &&
        url(value.href) &&
        optional(value, "logo", logo)
      )
    case "footer":
      return (
        object(value, ["text", "links"]) &&
        optional(value, "text", (entry) => text(entry, true)) &&
        optional(value, "links", (entry) => list(entry, link))
      )
    case "labels":
      return (
        record(value) &&
        Object.keys(value).length <= 128 &&
        Object.entries(value).every(([name, label]) => text(name) && text(label))
      )
    case "locales":
    case "releases":
      return destinations(value)
    case "metadata":
      return (
        object(value, ["description", "image", "robots"]) &&
        optional(value, "description", (entry) => text(entry, true)) &&
        optional(value, "image", url) &&
        optional(value, "robots", robotTokens)
      )
    case "robots":
      return (
        object(value, ["allow", "disallow"]) &&
        Object.values(value).every((paths) =>
          list(paths, (path) => url(path) && path.startsWith("/") && !/[?#]/.test(path)),
        )
      )
    default:
      return false
  }
}

/** Admit the upstream inert settings contract before rendering an external site. */
export function admitPresentation(value: unknown): PresentationSettings {
  if (value === undefined) return {}
  if (!object(value, keys) || !Object.entries(value).every(([key, entry]) => valid(key, entry))) {
    throw new Error("Invalid DocShell presentation settings")
  }
  return value as PresentationSettings
}

/** Resolve host-authored control text while preserving each renderer's default. */
export const presentationLabel = (
  settings: PresentationSettings,
  key: string,
  fallback: string,
): string => settings.labels?.[key] ?? fallback
