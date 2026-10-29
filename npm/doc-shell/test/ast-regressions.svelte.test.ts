import { flushSync, mount, unmount } from "svelte"
import { afterEach, describe, expect, it, vi } from "vitest"
import AstRenderer from "../src/ast-renderer.svelte"
import type { DocAstNode } from "../src/types.js"

vi.mock("../src/highlighter", () => ({ highlight: async () => null }))
const mounted: Array<ReturnType<typeof mount>> = []
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component)
  document.body.replaceChildren()
})
const render = (nodes: DocAstNode[]) => {
  const root = document.createElement("div")
  document.body.append(root)
  mounted.push(mount(AstRenderer, { target: root, props: { nodes } }))
  flushSync()
  return root
}
describe("complete AST text and anchor preservation", () => {
  it("retains a safe inline span anchor and ignores non-text IDs", () => {
    const root = render([
      { tag: "span", attrs: { id: "subject" }, content: ["Subject"], meta: {} },
      { tag: "span", attrs: { id: ["ghost"] }, content: ["Inert"], meta: {} },
    ])
    expect(root.querySelector("span#subject")?.textContent).toBe("Subject")
    expect(root.querySelector("#ghost")).toBeNull()
    expect(root.textContent).toBe("SubjectInert")
  })
  it("keeps every sibling when a pre element contains code plus other content", () => {
    const code = { tag: "code", attrs: {}, content: ["source"], meta: {} }
    const node = {
      tag: "pre",
      attrs: {},
      content: [code, { tag: "strong", attrs: {}, content: ["Required warning"], meta: {} }],
      meta: {},
    }
    const root = render([node])
    expect(root.querySelector("pre")?.textContent).toBe("sourceRequired warning")
    expect(root.querySelector("pre strong")?.textContent).toBe("Required warning")
  })
})
