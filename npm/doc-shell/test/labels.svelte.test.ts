import { flushSync, mount, unmount } from "svelte"
import { afterEach, describe, expect, it, vi } from "vitest"
import ApiReference from "../src/api-reference.svelte"
import AstRenderer from "../src/ast-renderer.svelte"
import { mountCopy, mountRequests } from "../src/browser/controllers.js"
import { mountEnhancements } from "../src/browser/enhancements.js"
import { browserLabel } from "../src/browser/labels.js"
import type { DocAstNode } from "../src/types.js"
import api from "./fixtures/openapi.json"

vi.mock("../src/highlighter", () => ({ highlight: async () => null }))
vi.mock("../src/mermaid.js", () => ({
  renderMermaid: async () => {
    throw new Error("fixture")
  },
}))

const mounted: Array<ReturnType<typeof mount>> = []
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component)
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
const target = () => {
  const element = document.createElement("div")
  document.body.append(element)
  return element
}
const element = (tag: string, content: DocAstNode[] = []): DocAstNode => ({
  tag,
  attrs: {},
  content,
  meta: {},
})

describe("host control labels", () => {
  it("inherits labels through recursive AST controls and preserves source wording", async () => {
    const root = target()
    mounted.push(
      mount(AstRenderer, {
        target: root,
        props: {
          labels: {
            copy: "Kopiera",
            copy_code: "Kopiera kod",
            copied: "Kopierat",
            details: "Detaljer",
            documentation_tabs: "Exempel",
            tab: "Flik",
            diagram_unavailable: "Diagrammet saknas; källan finns kvar",
          },
          nodes: [
            element("blockquote", [
              element("pre", [element("code", ["source language stays unchanged"])]),
              element("accordion", ["source title stays unchanged"]),
              element("tabs", [element("p", ["first source"]), element("p", ["second source"])]),
              element("mermaid", ["graph TD; A-->B"]),
            ]),
          ],
        },
      }),
    )
    flushSync()
    expect(root.querySelector('button[aria-label="Kopiera kod"]')?.textContent).toBe("Kopiera")
    expect(root.querySelector("summary")?.textContent).toBe("Detaljer")
    expect(root.querySelector('[role="tablist"]')?.getAttribute("aria-label")).toBe("Exempel")
    expect(root.querySelector('[role="tab"]')?.textContent).toBe("Flik 1")
    expect(root.textContent).toContain("source language stays unchanged")
    await vi.waitFor(() =>
      expect(root.querySelector("figcaption")?.textContent).toBe(
        "Diagrammet saknas; källan finns kvar",
      ),
    )
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    root.querySelector<HTMLButtonElement>('button[aria-label="Kopiera kod"]')?.click()
    await vi.waitFor(() =>
      expect(root.querySelector('button[aria-label="Kopierat"]')?.textContent).toBe("Kopierat"),
    )
  })

  it("keeps simultaneous catalogues isolated and translates nested API controls", () => {
    const roots = [target(), target()]
    for (const [index, root] of roots.entries())
      mounted.push(
        mount(ApiReference, {
          target: root,
          props: {
            spec: api,
            baseUrl: "/api",
            labels: {
              api_operations: `Operations ${index}`,
              try_it: `Try ${index}`,
              parameters: `Parameters ${index}`,
              openapi_json: `JSON ${index}`,
              schema_json: `Schema ${index}`,
            },
          },
        }),
      )
    flushSync()
    roots.forEach((root, index) => {
      expect(root.querySelector("nav")?.getAttribute("aria-label")).toBe(`Operations ${index}`)
      expect(root.textContent).toContain(`Try ${index}`)
      expect(root.textContent).toContain(`JSON ${index}`)
      expect(root.textContent).toContain(`Schema ${index}`)
      expect(root.textContent).not.toContain(`Try ${1 - index}`)
    })
  })

  it("browser lifecycle reads current nearest labels for copy outcomes", async () => {
    const root = target()
    root.innerHTML =
      '<div data-doc-labels><button data-doc-copy="code">Copy</button><code id="code">source</code></div>'
    const scope = root.firstElementChild as HTMLElement
    scope.dataset.docLabels = JSON.stringify({ copied: "Kopierat" })
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    const controller = mountCopy(root)
    const button = root.querySelector<HTMLButtonElement>("button")
    if (!button) throw new Error("Missing copy control")
    button.click()
    await vi.waitFor(() => expect(button.getAttribute("aria-label")).toBe("Kopierat"))
    scope.dataset.docLabels = JSON.stringify({ copy_unavailable: "Markera källan" })
    write.mockRejectedValue(new Error("denied"))
    button.click()
    await vi.waitFor(() => expect(button.getAttribute("aria-label")).toBe("Markera källan"))
    controller.destroy()
  })

  it("translates enhancement outcomes and request status without changing their admission", async () => {
    const root = target()
    root.dataset.docLabels = JSON.stringify({
      plain_source: "Källan finns kvar",
      enhancement_unavailable: "Ingen förbättring",
      source: "Källa",
      enhancement_limit: "För stor källa",
      sending: "Skickar",
      response_unknown: "Utfallet är okänt",
    })
    root.dataset.docEnhancementAssets = JSON.stringify({
      "doc-shell-highlight.js": "/assets/highlight.js",
    })
    root.innerHTML =
      '<div data-doc-code><button data-doc-enhance="highlight">Highlight</button><pre>source</pre></div><form data-doc-api-request data-api-origin="https://api.example.test" data-operation-method="GET"><input name="path" value="/items"><input type="checkbox" name="confirm" checked><p data-doc-api-status></p></form>'
    const button = root.querySelector<HTMLButtonElement>("button")
    const form = root.querySelector<HTMLFormElement>("form")
    if (!button || !form) throw new Error("Missing controls")
    const load = vi.fn().mockResolvedValue({ enhance: async () => null })
    const enhancement = mountEnhancements(root, load)
    button.click()
    await vi.waitFor(() => expect(button.textContent).toBe("Källan finns kvar"))
    load.mockRejectedValue(new Error("missing module"))
    button.click()
    await vi.waitFor(() => expect(button.textContent).toBe("Ingen förbättring"))
    load.mockResolvedValue({ enhance: async () => "<pre>highlighted</pre>" })
    button.click()
    await vi.waitFor(() => expect(root.querySelector("summary")?.textContent).toBe("Källa"))
    enhancement.destroy()
    let rejectRequest: ((reason: Error) => void) | undefined
    const request = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const requests = mountRequests(root, request)
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    expect(root.querySelector("[data-doc-api-status]")?.textContent).toBe("Skickar")
    expect(request).toHaveBeenCalledOnce()
    rejectRequest?.(new Error("offline"))
    await vi.waitFor(() =>
      expect(root.querySelector("[data-doc-api-status]")?.textContent).toBe("Utfallet är okänt"),
    )
    requests.destroy()
  })

  it("malformed or oversized browser labels keep bounded defaults", () => {
    const root = target()
    const child = document.createElement("span")
    root.append(child)
    expect(browserLabel(child, "copy", "Copy")).toBe("Copy")
    for (const encoded of [
      "{",
      "null",
      "[]",
      JSON.stringify({ copy: 1 }),
      JSON.stringify({ copy: "x".repeat(4097) }),
      "x".repeat(1_048_577),
    ]) {
      root.dataset.docLabels = encoded
      expect(browserLabel(child, "copy", "Copy")).toBe("Copy")
    }
  })
})
