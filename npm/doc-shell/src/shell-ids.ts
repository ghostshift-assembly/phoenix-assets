import type { DocAstNode } from "./types.js"

/** Preserve authored anchors while assigning deterministic IDs to shell controls. */
export const shellIds = (nodes: readonly DocAstNode[]) => {
  const occupied = new Set<string>()
  const pending = [...nodes]
  let count = 0
  while (pending.length) {
    if (++count > 1_000_000) throw new Error("DocShell shell AST value limit")
    const node = pending.pop()
    if (!node || typeof node === "string") continue
    if (typeof node.attrs?.id === "string") occupied.add(node.attrs.id)
    if (Array.isArray(node.content)) {
      if (count + pending.length + node.content.length > 1_000_000)
        throw new Error("DocShell shell AST value limit")
      for (const child of node.content) pending.push(child)
    }
  }
  const available = (base: string, suffixes = [""]) => {
    let attempt = 0
    while (
      suffixes.some((suffix) => occupied.has(`${base}${attempt ? `-${attempt}` : ""}${suffix}`))
    )
      attempt++
    return `${base}${attempt ? `-${attempt}` : ""}`
  }
  return {
    main: available("doc-main"),
    navigation: available("doc-navigation"),
    search: available("doc-search", ["-query", "-results"]),
  }
}
