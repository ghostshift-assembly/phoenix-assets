const svgTags = new Set(
  "svg g title desc rect circle ellipse line path polyline polygon text tspan".split(" "),
)
const numericAttributes = new Set(
  "x y x1 y1 x2 y2 cx cy r rx ry width height stroke-width stroke-miterlimit opacity fill-opacity stroke-opacity font-size letter-spacing".split(
    " ",
  ),
)
const numberSource = "[-+]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][-+]?[0-9]+)?"
const scalar = new RegExp(`^${numberSource}(?:px)?$`)
const numbers = new RegExp(numberSource, "g")
const plainNumber = new RegExp(`^${numberSource}$`)
const validNumber = (text: string) => plainNumber.test(text) && Math.abs(Number(text)) <= 1_000_000
const numberList = (text: string) => {
  const values = text.trim().split(/[\s,]+/)
  return values.length <= 32768 && values.every(validNumber) ? values : undefined
}
const dimension = (text: string | undefined) => {
  if (!text || !scalar.test(text)) return false
  const value = Number(text.replace(/px$/, ""))
  return value > 0 && value <= 4096
}
const transform = (value: string) => {
  const expression = /\b(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/g
  let end = 0
  let count = 0
  for (const match of value.matchAll(expression)) {
    if (value.slice(end, match.index).trim() || ++count > 64) return false
    const args = numberList(match[2] ?? "")
    const lengths: Record<string, number[]> = {
      matrix: [6],
      translate: [1, 2],
      scale: [1, 2],
      rotate: [1, 3],
      skewX: [1],
      skewY: [1],
    }
    if (!args || !lengths[match[1] ?? ""]?.includes(args.length)) return false
    end = match.index + match[0].length
  }
  return count > 0 && !value.slice(end).trim()
}
const attribute = (name: string, value: string, root: boolean) => {
  if (value.length > 65536 || /[<&]|[^\x20-\x7e]/.test(value)) return false
  if (name === "xmlns") return root && value === "http://www.w3.org/2000/svg"
  if (name === "id" || name === "aria-labelledby")
    return /^[a-zA-Z][a-zA-Z0-9_. -]{0,255}$/.test(value)
  if (numericAttributes.has(name))
    return scalar.test(value) && Math.abs(Number(value.replace(/px$/, ""))) <= 1_000_000
  if (name === "viewBox") {
    const values = numberList(value)
    return values?.length === 4 && Number(values[2]) > 0 && Number(values[3]) > 0
  }
  if (name === "fill" || name === "stroke")
    return /^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]{1,32})$/.test(value)
  if (name === "d")
    return (
      !!value &&
      /^[AaCcHhLlMmQqSsTtVvZz0-9eE+.,\s-]+$/.test(value) &&
      [...value.matchAll(numbers)].every((match) => validNumber(match[0]))
    )
  if (name === "points" || name === "stroke-dasharray")
    return value === "none" || !!numberList(value)
  if (name === "transform") return transform(value)
  if (name === "stroke-linecap") return ["butt", "round", "square"].includes(value)
  if (name === "stroke-linejoin") return ["miter", "round", "bevel"].includes(value)
  if (name === "text-anchor") return ["start", "middle", "end"].includes(value)
  if (name === "font-family") return /^[A-Za-z0-9 ,_-]{1,256}$/.test(value)
  if (name === "font-weight") return /^(?:[1-9]00|normal|bold|bolder|lighter)$/.test(value)
  if (name === "font-style") return ["normal", "italic", "oblique"].includes(value)
  if (name === "role") return ["img", "presentation"].includes(value)
  return false
}
const attributes = (source: string, root: boolean): Map<string, string> | undefined => {
  const pattern = /[ \t\r\n]+([A-Za-z][A-Za-z0-9-]*)[ \t\r\n]*=[ \t\r\n]*(?:"([^"]*)"|'([^']*)')/gy
  const result = new Map<string, string>()
  let cursor = 0
  while (cursor < source.length) {
    pattern.lastIndex = cursor
    const match = pattern.exec(source)
    if (!match) return /^[ \t\r\n]*$/.test(source.slice(cursor)) ? result : undefined
    const name = match[1] ?? ""
    const value = match[2] ?? match[3] ?? ""
    if (result.has(name) || result.size >= 32 || !attribute(name, value, root)) return
    result.set(name, value)
    cursor = pattern.lastIndex
  }
  return result
}
const svg = (bytes: Uint8Array): boolean => {
  if (bytes.length > 1_048_576) return false
  let source: string
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return false
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(source)) return false
  const stack: string[] = []
  let seenRoot = false
  let cursor = 0
  let elements = 0
  for (const match of source.matchAll(/<[^<>]*>|[^<>]+/g)) {
    if (match.index !== cursor) return false
    const token = match[0]
    cursor += token.length
    if (!token.startsWith("<")) {
      if (!stack.length && !/^[ \t\r\n]*$/.test(token)) return false
      if (token.replace(/&(?:amp|lt|gt|quot|apos);/g, "").includes("&")) return false
      continue
    }
    const closing = /^<\/([A-Za-z]+)[ \t\r\n]*>$/.exec(token)
    if (closing) {
      if (stack.pop() !== closing[1]) return false
      continue
    }
    const opening = /^<([A-Za-z]+)([\s\S]*?)(\/?)>$/.exec(token)
    const tag = opening?.[1]
    if (!opening || !tag || !svgTags.has(tag) || ++elements > 4096) return false
    const root = !stack.length
    if ((root && (seenRoot || tag !== "svg")) || (!root && tag === "svg")) return false
    const attrs = attributes(opening[2] ?? "", root)
    if (!attrs) return false
    if (root) {
      if (
        attrs.get("xmlns") !== "http://www.w3.org/2000/svg" ||
        !dimension(attrs.get("width")) ||
        !dimension(attrs.get("height"))
      )
        return false
      seenRoot = true
    }
    if (!opening[3]) stack.push(tag)
    if (stack.length > 64) return false
  }
  return seenRoot && cursor === source.length && stack.length === 0
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
const crc = (bytes: Uint8Array, start: number, end: number) => {
  let value = 0xffffffff
  for (let index = start; index < end; index++)
    value = (crcTable[(value ^ (bytes[index] ?? 0)) & 255] ?? 0) ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
const png = (bytes: Uint8Array): boolean => {
  if (
    bytes.length < 57 ||
    bytes.length > 33_554_432 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  )
    return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const allowed = new Set([
    "IHDR",
    "PLTE",
    "IDAT",
    "IEND",
    "tRNS",
    "sRGB",
    "gAMA",
    "cHRM",
    "pHYs",
    "bKGD",
    "sBIT",
  ])
  let offset = 8
  let count = 0
  let data = false
  while (offset + 12 <= bytes.length && ++count <= 4096) {
    const length = view.getUint32(offset)
    const end = offset + 8 + length
    if (end + 4 > bytes.length) return false
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (!allowed.has(type) || view.getUint32(end) !== crc(bytes, offset + 4, end)) return false
    if (count === 1) {
      const depths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      }
      if (
        type !== "IHDR" ||
        length !== 13 ||
        !depths[bytes[offset + 17] ?? -1]?.includes(bytes[offset + 16] ?? -1)
      )
        return false
      if (
        ![view.getUint32(offset + 8), view.getUint32(offset + 12)].every(
          (value) => value > 0 && value <= 4096,
        ) ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        ![0, 1].includes(bytes[offset + 20] ?? -1)
      )
        return false
    } else if (type === "IHDR") return false
    if (type === "IDAT" && length > 0) data = true
    if (type === "IEND") return length === 0 && data && end + 4 === bytes.length
    offset = end + 4
  }
  return false
}

/** Validate the renderer's passive SVG/PNG subset; producer semantics and pixel decode remain separate. */
export const validateArtifactMedia = (mediaType: string, bytes: Uint8Array): void => {
  if (!(mediaType === "image/svg+xml" ? svg(bytes) : mediaType === "image/png" && png(bytes)))
    throw new Error("Unsupported or unsafe DocShell artifact media")
}
