import type { DocAstElement, DocAstNode } from "./types.js"

export const extractText = (content?: DocAstNode[] | string): string =>
  !content
    ? ""
    : typeof content === "string"
      ? content
      : content
          .map((node) => (typeof node === "string" ? node : extractText(node.content)))
          .join("")

export const headingId = (content?: DocAstNode[] | string): string =>
  extractText(content)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const SAFE_ID = /^[\p{L}\p{N}][\p{L}\p{N}_.:-]*(?![\s\S])/u
const ATTRIBUTES = new Set(["id", "title", "class", "colspan", "rowspan", "scope", "start"])

export const projectedHeadingId = (node: DocAstElement): string | undefined => {
  const id = node.attrs?.id
  return typeof id === "string" && SAFE_ID.test(id) ? id : undefined
}

/** Read a textual attribute without coercing arbitrary producer JSON into UI. */
export const stringAttribute = (node: DocAstElement, name: string): string | undefined => {
  const value = node.attrs?.[name]
  return typeof value === "string" ? value : undefined
}

export const admittedAttributes = (node: DocAstElement): Record<string, string> =>
  Object.fromEntries(
    Object.entries(node.attrs ?? {}).filter(
      (entry): entry is [string, string] =>
        ATTRIBUTES.has(entry[0]) &&
        typeof entry[1] === "string" &&
        (entry[0] !== "id" || SAFE_ID.test(entry[1])),
    ),
  )

export const safeMediaTarget = (value: unknown): string | undefined => {
  const src = typeof value === "string" ? value.trim() : undefined
  return src?.startsWith("/") &&
    !src.startsWith("//") &&
    !src.includes("\\") &&
    !src.includes("\u0000")
    ? src
    : undefined
}

export const preCodeInfo = (
  node: DocAstElement,
): { code: string; language: string; sourceId?: string } | undefined => {
  if (!Array.isArray(node.content) || node.content.length !== 1) return undefined
  const code = node.content[0]
  if (!code || typeof code !== "object" || code.tag !== "code") return undefined
  return {
    ...(projectedHeadingId(code) ? { sourceId: projectedHeadingId(code) } : {}),
    code: typeof code.content === "string" ? code.content : extractText(code.content),
    language:
      stringAttribute(code, "class")?.replace(/^language-/, "") ??
      (node.attrs?.class === "mermaid" ? "mermaid" : "text"),
  }
}

export const extractToc = (
  nodes: DocAstNode[],
): Array<{ id: string; level: number; text: string }> => {
  const result: Array<{ id: string; level: number; text: string }> = []
  const visit = (items: DocAstNode[]) => {
    for (const item of items) {
      if (typeof item === "string") continue
      if (/^h[2-6]$/.test(item.tag))
        result.push({
          id: projectedHeadingId(item) ?? headingId(item.content),
          level: Number(item.tag[1]),
          text: extractText(item.content),
        })
      if (Array.isArray(item.content)) visit(item.content)
    }
  }
  visit(nodes)
  return result
}
