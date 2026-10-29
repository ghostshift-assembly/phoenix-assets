import { createHash } from "node:crypto"
import { flushSync, mount, unmount } from "svelte"
import { afterEach, describe, expect, it, vi } from "vitest"
import ArtifactDocument from "../src/artifact-document.svelte"
import ArtifactPreview from "../src/artifact-preview.svelte"
import type { ArtifactAssets, ArtifactBlock, ArtifactReceipt } from "../src/artifacts.js"
import AstRenderer from "../src/ast-renderer.svelte"
import SiteShell from "../src/site-shell.svelte"
import type { DocAstNode, DocShellSite } from "../src/types.js"
import corpus from "./fixtures/artifact-conformance-v1.json"
import siteFixture from "./fixtures/projected-site.json"

const { highlight } = vi.hoisted(() => ({ highlight: vi.fn(async () => null) }))
vi.mock("../src/highlighter", () => ({ highlight }))
const mounted: Array<ReturnType<typeof mount>> = []
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component)
  document.body.replaceChildren()
  highlight.mockClear()
})
const target = () => {
  const root = document.createElement("div")
  document.body.append(root)
  return root
}
const fixtureProps = (index: number) => {
  const input = corpus.cases[index]
  if (!input) throw new Error("Missing corpus entry")
  return {
    input,
    props: {
      nodes: input.content as DocAstNode[],
      receipt: input.receipt as ArtifactReceipt,
      assets: Object.fromEntries(
        input.assets.map((asset) => [
          asset.path,
          { media_type: asset.media_type, base64: asset.base64 },
        ]),
      ) as ArtifactAssets,
      canonicalContent: input.canonical_content,
    },
  }
}
describe("verified artifact views", () => {
  for (const [index, entry] of corpus.cases.entries())
    it(`renders ${entry.id} still bytes and every fallback observation`, () => {
      const { input, props } = fixtureProps(index)
      const root = target()
      mounted.push(mount(ArtifactDocument, { target: root, props }))
      flushSync()
      const figure = root.querySelector("figure[data-doc-artifact]")
      expect(figure?.id).toBe(input.id)
      expect(figure?.getAttribute("lang")).toBe(input.observations.locale)
      expect(figure?.getAttribute("data-artifact-ref")).toBe(input.receipt.blocks[0]?.artifact_ref)
      expect(figure?.getAttribute("data-variant-id")).toBe(input.observations.variant_id)
      expect(figure?.getAttribute("data-artifact-state")).toBe(input.observations.state)
      expect(figure?.querySelector("figcaption")?.textContent).toBe(input.observations.caption)
      expect(figure?.querySelector("img")?.getAttribute("src")).toBe(
        `data:image/svg+xml;base64,${input.assets[0]?.base64}`,
      )
      expect(figure?.querySelector("img")?.alt).toBe(input.observations.description)
      for (const anchor of input.observations.anchors)
        expect(root.querySelector(`#${anchor}`)).not.toBeNull()
      for (const text of input.observations.text)
        expect(figure?.querySelector("[data-artifact-fallback]")?.textContent).toContain(text)
      expect(root.querySelector("script, iframe, object, embed, button")).toBeNull()
      expect(highlight).not.toHaveBeenCalled()
    })
  it("keeps projected anchors on enhanced wrappers outside the artifact fallback", () => {
    const node = (tag: string, id: string, content: DocAstNode[]): DocAstNode => ({
      tag,
      attrs: { id },
      content,
      meta: {},
    })
    const nodes = [
      node("pre", "pre", [node("code", "code", ["Source"])]),
      node("mermaid", "diagram", ["graph TD; A-->B"]),
      node("tabs", "panels", ["Panel"]),
      node("steps", "steps", [node("step", "step", ["Step"])]),
      node("accordion", "accordion", ["Body"]),
      node("callout", "callout", ["Body"]),
      node("unknown", "unknown", ["Text"]),
    ]
    const root = target()
    mounted.push(mount(AstRenderer, { target: root, props: { nodes } }))
    flushSync()
    for (const id of [
      "pre",
      "code",
      "diagram",
      "panels",
      "steps",
      "step",
      "accordion",
      "callout",
      "unknown",
    ])
      expect(root.querySelectorAll(`[id="${id}"]`).length).toBe(1)
  })
  it("retains code fallback without starting an enhancement even when other runtimes are available", () => {
    const { props } = fixtureProps(0)
    const nodes = JSON.parse(JSON.stringify(props.nodes)) as DocAstNode[]
    const receipt = JSON.parse(JSON.stringify(props.receipt)) as ArtifactReceipt
    const node = nodes[0]
    if (!node || typeof node === "string" || !Array.isArray(node.content))
      throw new Error("Missing node")
    const block = node.meta?.artifact as ArtifactBlock
    node.content.push({
      tag: "pre",
      attrs: {},
      content: [{ tag: "code", attrs: {}, content: ["Static code source"], meta: {} }],
      meta: {},
    })
    // All fields in this synthetic mutation are ASCII strings and integers.
    const encode = (value: unknown): string =>
      Array.isArray(value)
        ? `[${value.map(encode).join(",")}]`
        : typeof value === "object" && value !== null
          ? `{${Object.entries(value)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([key, child]) => `${JSON.stringify(key)}:${encode(child)}`)
              .join(",")}}`
          : JSON.stringify(value)
    const hash = (value: unknown) =>
      `sha256:${createHash("sha256").update(encode(value)).digest("hex")}`
    const fields = Object.fromEntries(
      [
        "profile",
        "profile_digest",
        "artifact_ref",
        "manifest_digest",
        "bindings",
        "caption",
        "description",
        "locale",
      ].map((key) => [key, (block as unknown as Record<string, unknown>)[key]]),
    )
    block.fallback_digest = hash({ ...fields, block_id: node.attrs?.id, fallback: node.content })
    const selection = receipt.blocks[0]
    if (!selection) throw new Error("Missing selection")
    selection.fallback_digest = block.fallback_digest
    receipt.page_digest = hash(nodes)
    receipt.constraints.available_runtime = ["browser_js"]
    receipt.constraints.forbidden_runtime = []
    receipt.constraints_digest = hash(receipt.constraints)
    const root = target()
    mounted.push(
      mount(ArtifactDocument, {
        target: root,
        props: { ...props, nodes, receipt, canonicalContent: encode(nodes) },
      }),
    )
    flushSync()
    expect(root.querySelector("[data-artifact-fallback] pre code")?.textContent).toBe(
      "Static code source",
    )
    expect(root.querySelector("button")).toBeNull()
    expect(highlight).not.toHaveBeenCalled()
  })
  it.each(["present", "missing"])("keeps passive site controls honest on a %s page", (state) => {
    const { props } = fixtureProps(0)
    const site = JSON.parse(JSON.stringify(siteFixture)) as DocShellSite
    const pageId = Object.keys(site.pages)[0]
    const page = pageId ? site.pages[pageId] : undefined
    if (!page || !pageId) throw new Error("Missing site page")
    page.content = props.nodes
    page.content_digest = props.receipt.page_digest
    page.metadata = { artifact_presentation: props.receipt }
    page.headings = []
    page.requirements = []
    const root = target()
    mounted.push(
      mount(SiteShell, {
        target: root,
        props: {
          site,
          pageId: state === "present" ? pageId : "missing",
          artifactAssets: props.assets,
          canonicalContent: props.canonicalContent,
        },
      }),
    )
    flushSync()
    expect(root.querySelector("button, dialog, script")).toBeNull()
    if (state === "present") expect(root.querySelector("figure[data-doc-artifact]")).not.toBeNull()
    else expect(root.querySelector("h1")?.textContent).toBe("Page not found")
    expect(root.querySelector("aside[data-doc-passive] a[href]")).not.toBeNull()
    expect(root.querySelector("[data-doc-search-disabled]")?.textContent).toContain(
      "navigation links",
    )
    expect(root.querySelector("button, dialog, script")).toBeNull()
  })
  it("refuses raw typed blocks and stale receipts before a selected image appears", () => {
    const { props } = fixtureProps(0)
    const raw = target()
    expect(() => mount(AstRenderer, { target: raw, props: { nodes: props.nodes } })).toThrow(
      "receipt required",
    )
    expect(raw.querySelector("figure, img")).toBeNull()
    const stale = target()
    expect(() =>
      mount(ArtifactDocument, {
        target: stale,
        props: { ...props, receipt: { ...props.receipt, page_digest: `sha256:${"0".repeat(64)}` } },
      }),
    ).toThrow("page or constraints digest")
    expect(stale.querySelector("figure, img")).toBeNull()
  })
  it.each(["light", "dark", "monochrome", "enlarged"] as const)(
    "uses the identical receipt and source in %s diagnostic mode",
    (mode) => {
      const { input, props } = fixtureProps(0)
      const root = target()
      mounted.push(mount(ArtifactPreview, { target: root, props: { ...props, mode } }))
      flushSync()
      const preview = root.querySelector("[data-artifact-preview]")
      expect(preview?.getAttribute("data-artifact-preview")).toBe(mode)
      expect(preview?.getAttribute("data-artifact-page-digest")).toBe(input.receipt.page_digest)
      expect(root.querySelector("figure")?.getAttribute("data-variant-id")).toBe(
        input.observations.variant_id,
      )
      expect(root.textContent).toContain(input.receipt.blocks[0]?.manifest_digest)
      expect(root.textContent).toContain(input.observations.limitations[0])
      expect(root.querySelectorAll(`a[href="#${input.observations.anchors[1]}"]`)).toHaveLength(1)
      expect(root.querySelector("button, input, form")).toBeNull()
    },
  )
})
