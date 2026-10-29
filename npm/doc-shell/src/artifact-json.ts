import { sha256 } from "@noble/hashes/sha2.js"

const encoder = new TextEncoder()
const maximumBytes = 8_388_608
const maximumValues = 1_000_000
const invalid = (): never => {
  throw new Error("Invalid DocShell canonical JSON proof")
}
const wellFormed = (value: string) => {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (char.length === 1 && code >= 0xd800 && code <= 0xdfff) return false
  }
  return true
}
const compare = (left: string, right: string) => {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference) return difference
  }
  return a.length - b.length
}
// Jason's default JSON mode uses capital hex digits, without escaping UTF-8 text.
const quote = (value: string) => {
  if (value.length > maximumBytes || !wellFormed(value)) invalid()
  const escapes: Record<string, string> = {
    '"': '\\"',
    "\\": "\\\\",
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
  }
  return `"${value.replace(/[\u0000-\u001f"\\]/g, (char) => escapes[char] ?? `\\u${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`)}"`
}
const descriptors = (value: object) => {
  if (Object.getOwnPropertySymbols(value).length) invalid()
  const fields = Object.getOwnPropertyDescriptors(value)
  if (Object.values(fields).some((field) => !Object.hasOwn(field, "value"))) invalid()
  return fields
}
const encodeNative = (value: unknown) => {
  const parts: string[] = []
  let remaining = maximumBytes
  let count = 0
  const append = (part: string) => {
    remaining -= encoder.encode(part).length
    if (remaining < 0) throw new Error("DocShell canonical JSON exceeds the 8 MiB admission limit")
    parts.push(part)
  }
  const encode = (current: unknown, depth: number): void => {
    if (depth > 256 || (depth === 256 && typeof current === "object" && current !== null))
      throw new Error("DocShell canonical JSON exceeds the admission depth limit")
    if (++count > maximumValues) throw new Error("DocShell canonical JSON exceeds the value limit")
    if (current === null || typeof current === "boolean") append(JSON.stringify(current))
    else if (typeof current === "string") append(quote(current))
    else if (
      typeof current === "number" &&
      Number.isSafeInteger(current) &&
      !Object.is(current, -0)
    )
      append(String(current))
    else if (Array.isArray(current)) {
      const fields = descriptors(current)
      if (Object.keys(fields).length !== current.length + 1 || current.length > maximumValues)
        invalid()
      append("[")
      for (let index = 0; index < current.length; index++) {
        if (index) append(",")
        if (!fields[String(index)]?.enumerable) invalid()
        encode(fields[String(index)]?.value, depth + 1)
      }
      append("]")
    } else if (
      typeof current === "object" &&
      current !== null &&
      [Object.prototype, null].includes(Object.getPrototypeOf(current))
    ) {
      const fields = descriptors(current)
      const keys = Object.keys(fields)
      if (keys.length > maximumValues) invalid()
      keys.sort(compare)
      append("{")
      keys.forEach((key, index) => {
        if (!fields[key]?.enumerable) invalid()
        if (index) append(",")
        encode(key, depth + 1)
        append(":")
        encode(fields[key]?.value, depth + 1)
      })
      append("}")
    } else
      throw new Error(
        "DocShell cannot reproduce the producer's canonical JSON; retain original bytes",
      )
  }
  encode(value, 0)
  return parts.join("")
}

/** Internal lossless tree; numeric lexemes and all subtrees retain their original byte spelling. */
export interface JsonProof {
  readonly source: string
  readonly start: number
  readonly end: number
  readonly value?: unknown
  readonly members?: ReadonlyMap<string, JsonProof>
  readonly items?: readonly JsonProof[]
}
const parse = (source: string): JsonProof => {
  if (
    source.length > maximumBytes ||
    !wellFormed(source) ||
    encoder.encode(source).length > maximumBytes
  )
    return invalid()
  let cursor = 0
  let count = 0
  const number = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y
  const string = (): JsonProof => {
    const start = cursor++
    while (cursor < source.length) {
      const char = source[cursor++]
      if (char === "\\") cursor++
      else if (char === '"') {
        const raw = source.slice(start, cursor)
        let value: unknown
        try {
          value = JSON.parse(raw)
        } catch {
          return invalid()
        }
        if (typeof value !== "string" || quote(value) !== raw) return invalid()
        return { source, start, end: cursor, value }
      }
    }
    return invalid()
  }
  const value = (depth: number): JsonProof => {
    const first = source[cursor]
    if (depth > 256 || (depth === 256 && (first === "[" || first === "{")))
      throw new Error("DocShell canonical JSON exceeds the admission depth limit")
    if (++count > maximumValues) throw new Error("DocShell canonical JSON exceeds the value limit")
    const start = cursor
    if (first === '"') return string()
    if (first === "[") {
      cursor++
      const items: JsonProof[] = []
      if (source[cursor] !== "]") {
        do {
          if (items.length) cursor++
          items.push(value(depth + 1))
        } while (source[cursor] === ",")
      }
      if (source[cursor++] !== "]") return invalid()
      return { source, start, end: cursor, items }
    }
    if (first === "{") {
      cursor++
      const members = new Map<string, JsonProof>()
      let previous: string | undefined
      if (source[cursor] !== "}") {
        do {
          if (members.size) cursor++
          if (source[cursor] !== '"' || ++count > maximumValues) return invalid()
          const key = string().value as string
          if (previous !== undefined && compare(previous, key) >= 0) return invalid()
          previous = key
          if (source[cursor++] !== ":") return invalid()
          members.set(key, value(depth + 1))
        } while (source[cursor] === ",")
      }
      if (source[cursor++] !== "}") return invalid()
      return { source, start, end: cursor, members }
    }
    for (const [literal, decoded] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const) {
      if (source.startsWith(literal, cursor)) {
        cursor += literal.length
        return { source, start, end: cursor, value: decoded }
      }
    }
    number.lastIndex = cursor
    const numeric = number.exec(source)
    if (!numeric) return invalid()
    cursor = number.lastIndex
    return { source, start, end: cursor, value: JSON.parse(numeric[0]) as number }
  }
  const result = value(0)
  if (cursor !== source.length) return invalid()
  return result
}
const same = (value: unknown, proof: JsonProof): boolean => {
  if (proof.items) {
    if (!Array.isArray(value)) return false
    const fields = descriptors(value)
    return (
      value.length === proof.items.length &&
      Object.keys(fields).length === value.length + 1 &&
      proof.items.every(
        (item, index) =>
          fields[String(index)]?.enumerable && same(fields[String(index)]?.value, item),
      )
    )
  }
  if (proof.members) {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return false
    const fields = descriptors(value)
    return (
      Object.keys(fields).length === proof.members.size &&
      [...proof.members].every(
        ([key, child]) => fields[key]?.enumerable && same(fields[key]?.value, child),
      )
    )
  }
  return Object.is(value, proof.value)
}

/** Preserve original canonical bytes for floats/large integers that JSON decoding cannot retain. */
export const jsonProof = (value: unknown, original?: string): JsonProof => {
  const result = parse(original ?? encodeNative(value))
  if (!same(value, result)) return invalid()
  return result
}
export const jsonBytes = (proof: JsonProof): string => proof.source.slice(proof.start, proof.end)
export const jsonField = (proof: JsonProof, key: string): JsonProof =>
  proof.members?.get(key) ?? invalid()
export const jsonItems = (proof: JsonProof): readonly JsonProof[] => proof.items ?? invalid()
export const byteDigest = (bytes: Uint8Array): string =>
  `sha256:${Array.from(sha256(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`
export const jsonDigest = (proof: JsonProof): string => byteDigest(encoder.encode(jsonBytes(proof)))
export const objectDigest = (parts: ReadonlyArray<readonly [string, JsonProof]>): string => {
  if (new Set(parts.map(([key]) => key)).size !== parts.length) return invalid()
  const source = `{${[...parts]
    .sort(([a], [b]) => compare(a, b))
    .map(([key, proof]) => `${quote(key)}:${jsonBytes(proof)}`)
    .join(",")}}`
  if (encoder.encode(source).length > maximumBytes) return invalid()
  return byteDigest(encoder.encode(source))
}
