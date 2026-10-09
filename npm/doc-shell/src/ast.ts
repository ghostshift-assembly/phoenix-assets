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
  return id && SAFE_ID.test(id) ? id : undefined
}

export const admittedAttributes = (node: DocAstElement): Record<string, string> =>
  Object.fromEntries(
    Object.entries(node.attrs ?? {}).filter(
      ([name, value]) =>
        ATTRIBUTES.has(name) && typeof value === "string" && (name !== "id" || SAFE_ID.test(value)),
    ),
  )

export const safeMediaTarget = (value: string | undefined): string | undefined => {
  const src = value?.trim()
  return src?.startsWith("/") && !src.startsWith("//") && !src.includes("\\") ? src : undefined
}

export const preCodeInfo = (
  node: DocAstElement,
): { code: string; language: string } | undefined => {
  if (!Array.isArray(node.content)) return undefined
  const code = node.content.find(
    (child): child is DocAstElement => typeof child !== "string" && child.tag === "code",
  )
  if (!code) return undefined
  return {
    code: typeof code.content === "string" ? code.content : extractText(code.content),
    language:
      code.attrs?.class?.replace(/^language-/, "") ??
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
