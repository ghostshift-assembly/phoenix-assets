import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import {
  type ArtifactAssets,
  type ArtifactReceipt,
  admitArtifactPage,
  artifactCapabilities,
} from "../src/artifacts.js"
import type { DocAstNode } from "../src/types.js"
import corpus from "./fixtures/artifact-conformance-v1.json"

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
// This independent encoder is used only for mutations of the corpus's ASCII/integer values.
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (typeof value === "object" && value !== null)
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`
  return JSON.stringify(value)
}
const digest = (value: unknown) =>
  `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`
const rawDigest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`
const fixture = (index = 0) => {
  const value = corpus.cases[index]
  if (!value) throw new Error("Missing fixture")
  return clone(value)
}
const assets = (value: ReturnType<typeof fixture>): ArtifactAssets =>
  Object.fromEntries(
    value.assets.map((asset) => [
      asset.path,
      { media_type: asset.media_type, base64: asset.base64 },
    ]),
  )
const admit = (value: ReturnType<typeof fixture>, registry = assets(value)) =>
  admitArtifactPage(value.content as DocAstNode[], value.receipt as ArtifactReceipt, registry)
const restamp = (value: ReturnType<typeof fixture>) => {
  const node = value.content[0]
  if (!node) throw new Error("Missing block")
  const block = node.meta.artifact
  const fallback = Object.fromEntries(
    [
      "profile",
      "profile_digest",
      "artifact_ref",
      "manifest_digest",
      "bindings",
      "caption",
      "description",
      "locale",
    ].map((key) => [key, (block as Record<string, unknown>)[key]]),
  )
  block.fallback_digest = digest({ ...fallback, block_id: node.attrs.id, fallback: node.content })
  const selection = value.receipt.blocks[0]
  if (selection) selection.fallback_digest = block.fallback_digest
  value.receipt.page_digest = digest(value.content)
  value.receipt.constraints_digest = digest(value.receipt.constraints)
  return value
}

describe("producer-admitted artifact receipts", () => {
  it("pins the exact upstream synthetic corpus", () => {
    const bytes = readFileSync(`${import.meta.dirname}/fixtures/artifact-conformance-v1.json`)
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "2d812d1849126f20d6aaea583037e94c11e9c83d1f4a011410b01ac104c05e37",
    )
  })
  for (const [index, source] of corpus.cases.entries())
    it(`consumes ${source.id} without a producer import, fetch or new selection`, () => {
      const input = fixture(index)
      const request = vi.spyOn(globalThis, "fetch")
      const result = admitArtifactPage(
        input.content as DocAstNode[],
        input.receipt as ArtifactReceipt,
        assets(input),
        { canonicalContent: input.canonical_content },
      )
      const view = result.blocks.get(input.id)
      expect(result.passive).toBe(true)
      expect(view?.selection).toEqual(input.receipt.blocks[0])
      expect(view?.block.caption).toBe(input.observations.caption)
      expect(view?.source).toBe(`data:image/svg+xml;base64,${input.assets[0]?.base64}`)
      expect(view?.projectionJson).toContain(input.observations.limitations[0])
      expect(request).not.toHaveBeenCalled()
      request.mockRestore()
    })
  it("ignores inert object insertion order while binding the same subjects", () => {
    const input = fixture()
    const binding = input.receipt.blocks[0]?.bindings[0]
    if (!binding || !input.receipt.blocks[0]) throw new Error("Missing binding")
    input.receipt.blocks[0].bindings = [
      {
        subject_id: binding.subject_id,
        subject_kind: binding.subject_kind,
        subject_ref: binding.subject_ref,
        anchor: binding.anchor,
      },
    ]
    expect(() => admit(input)).not.toThrow()
  })
  it("refuses typed content with no receipt and leaves ordinary legacy AST alone", () => {
    expect(() => admitArtifactPage(fixture().content as DocAstNode[])).toThrow("receipt required")
    for (const tag of ["artifact", "unknown", "section"])
      expect(() =>
        admitArtifactPage([
          { tag, attrs: {}, meta: {}, content: fixture().content },
        ] as DocAstNode[]),
      ).toThrow("receipt required")
    expect(
      admitArtifactPage(["ordinary", { tag: "unknown", content: ["legacy"] }]).blocks.size,
    ).toBe(0)
  })
  it.each(["page_digest", "constraints_digest", "descriptor_set_digest", "schema_version"])(
    "refuses stale or malformed receipt %s",
    (field) => {
      const input = fixture()
      ;(input.receipt as Record<string, unknown>)[field] = "wrong"
      expect(() => admit(input)).toThrow()
    },
  )
  it.each([
    "block_id",
    "profile",
    "profile_digest",
    "artifact_ref",
    "manifest_digest",
    "fallback_digest",
  ])("refuses selection identity drift in %s", (field) => {
    const input = fixture()
    const selection = input.receipt.blocks[0]
    if (!selection) throw new Error("Missing selection")
    ;(selection as Record<string, unknown>)[field] = "wrong"
    expect(() => admit(input)).toThrow("selection identity")
  })
  it("refuses closed-record fields, unsupported versions, incomplete and duplicated receipts", () => {
    for (const mutate of [
      (input: ReturnType<typeof fixture>) => Object.assign(input.receipt, { unexpected: true }),
      (input: ReturnType<typeof fixture>) =>
        Object.assign(input.content[0]?.meta.artifact ?? {}, { unexpected: true }),
      (input: ReturnType<typeof fixture>) =>
        Object.assign(input.receipt.blocks[0] ?? {}, { unexpected: true }),
      (input: ReturnType<typeof fixture>) => {
        input.receipt.blocks = []
      },
      (input: ReturnType<typeof fixture>) => {
        const first = input.receipt.blocks[0]
        if (first) input.receipt.blocks.push(clone(first))
      },
      (input: ReturnType<typeof fixture>) => {
        input.receipt.capabilities.schema_version = "future/v99"
      },
    ]) {
      const input = fixture()
      mutate(input)
      restamp(input)
      expect(() => admit(input)).toThrow()
    }
  })
  it("binds original fallback wording and textual anchors before any media is consumed", () => {
    const input = fixture()
    const node = input.content[0]
    if (!node) throw new Error("Missing block")
    node.content[1] = { tag: "p", attrs: {}, content: ["lost warning"], meta: {} }
    input.receipt.page_digest = digest(input.content)
    expect(() => admit(input)).toThrow("fallback digest")
    const ghost = fixture()
    const current = ghost.content[0]
    if (!current) throw new Error("Missing block")
    current.content[0] = { tag: "span", attrs: {}, content: [], meta: {} }
    ghost.content.unshift({
      tag: "p",
      attrs: { id: ["sample"] },
      content: ["Ghost"],
      meta: {},
    } as never)
    // Recompute both content and fallback bindings while leaving no actual textual target.
    const artifact = ghost.content[1]
    if (!artifact) throw new Error("Missing artifact")
    const block = artifact.meta.artifact
    block.fallback_digest = digest({
      ...Object.fromEntries(
        [
          "profile",
          "profile_digest",
          "artifact_ref",
          "manifest_digest",
          "bindings",
          "caption",
          "description",
          "locale",
        ].map((key) => [key, (block as Record<string, unknown>)[key]]),
      ),
      block_id: artifact.attrs.id,
      fallback: artifact.content,
    })
    if (ghost.receipt.blocks[0]) ghost.receipt.blocks[0].fallback_digest = block.fallback_digest
    ghost.receipt.page_digest = digest(ghost.content)
    expect(() => admit(ghost)).toThrow("missing document anchor")
  })
  it("refuses fallback scripts, event attributes, hidden void text and duplicate anchors", () => {
    for (const mutate of [
      (node: ReturnType<typeof fixture>["content"][number]) => {
        const child = node.content[1]
        if (child) child.tag = "script"
      },
      (node: ReturnType<typeof fixture>["content"][number]) => {
        const child = node.content[1]
        if (child) child.attrs = { onclick: "bad()" } as never
      },
      (node: ReturnType<typeof fixture>["content"][number]) => {
        const child = node.content[1]
        if (child) child.tag = "br"
      },
      (node: ReturnType<typeof fixture>["content"][number]) => {
        const child = node.content[0]
        if (child) node.content.push(clone(child))
      },
    ]) {
      const input = fixture()
      const node = input.content[0]
      if (!node) throw new Error("Missing block")
      mutate(node)
      expect(() => admit(restamp(input))).toThrow()
    }
  })
  it("validates checked producer subject identity without interpreting profile extensions", () => {
    for (const field of ["profile", "artifact_ref", "manifest_digest", "subjects"]) {
      const input = fixture()
      const projection = input.receipt.blocks[0]?.checked_projection
      if (!projection) throw new Error("Missing projection")
      ;(projection as Record<string, unknown>)[field] = field === "subjects" ? [] : "wrong"
      expect(() => admit(input)).toThrow()
    }
  })
  it("preserves raw float spelling in producer projection diagnostics", () => {
    const input = fixture()
    const projection = input.receipt.blocks[0]?.checked_projection
    if (!projection) throw new Error("Missing projection")
    Object.assign(projection, { uninterpreted: 1 })
    const canonicalReceipt = stable(input.receipt).replace(
      '"uninterpreted":1',
      '"uninterpreted":1.0',
    )
    const result = admitArtifactPage(
      input.content as DocAstNode[],
      input.receipt as ArtifactReceipt,
      assets(input),
      { canonicalReceipt },
    )
    expect(result.blocks.get(input.id)?.projectionJson).toContain('"uninterpreted":1.0')
  })
  it("keeps unknown optional fallback explicit and refuses fabricated essential success", () => {
    const input = fixture()
    const node = input.content[0]
    const selection = input.receipt.blocks[0]
    if (!node || !selection) throw new Error("Missing block")
    node.meta.artifact.essential = false
    node.meta.artifact.variants = []
    Object.assign(selection, { status: "unavailable", variant: null })
    delete (selection as Partial<typeof selection>).presentation_id
    delete (selection as Partial<typeof selection>).checked_projection
    input.receipt.descriptor_set_digest = digest({})
    restamp(input)
    const result = admit(input)
    expect(result.blocks.get(input.id)?.source).toBeUndefined()
    expect(result.blocks.get(input.id)?.selection.status).toBe("unavailable")
    node.meta.artifact.essential = true
    restamp(input)
    expect(() => admit(input)).toThrow("invalid unavailable")
  })
  it.each(["state", "runtime"])(
    "never renegotiates a selected unsupported %s into a fallback",
    (field) => {
      const input = fixture()
      const node = input.content[0]
      const selection = input.receipt.blocks[0]
      const feature = input.receipt.capabilities.features[0]
      const value = node?.meta.artifact.variants[0]
      if (!node || !selection || !feature || !value) throw new Error("Missing variant")
      if (field === "state") {
        node.meta.artifact.acceptable_states.push("enhanced")
        value.state = "enhanced"
        selection.variant.state = "enhanced"
        feature.state = "enhanced"
      } else {
        value.runtime = ["browser_js"] as never
        selection.variant.runtime = ["browser_js"] as never
        feature.runtime = ["browser_js"] as never
        input.receipt.constraints.available_runtime = ["browser_js"] as never
        input.receipt.constraints.forbidden_runtime = []
      }
      restamp(input)
      expect(() => admit(input)).toThrow("unsupported renderer state")
    },
  )
  it("refuses unavailable or forbidden runtime and static live transport", () => {
    const input = fixture()
    const feature = input.receipt.capabilities.features[0]
    if (!feature) throw new Error("Missing feature")
    feature.runtime = ["browser_js"] as never
    expect(() => admit(input)).toThrow("selected feature identity")
    input.receipt.constraints.output_mode = "hosted"
    restamp(input)
    expect(() => admit(input)).toThrow()
  })
  it("verifies original asset bytes, MIME, lengths, logical paths and case collisions", () => {
    const input = fixture()
    const registry = assets(input)
    const first = input.assets[0]
    if (!first) throw new Error("Missing asset")
    expect(() => admit(input, {})).toThrow("selected asset required")
    expect(() =>
      admit(input, {
        ...registry,
        [first.path]: { ...registry[first.path], media_type: "text/html" },
      } as ArtifactAssets),
    ).toThrow("selected asset required")
    expect(() =>
      admit(input, { [first.path]: { media_type: first.media_type, base64: btoa("changed") } }),
    ).toThrow("selected asset integrity")
    expect(() =>
      admit(input, {
        ...registry,
        [first.path.toUpperCase()]: registry[first.path],
      } as ArtifactAssets),
    ).toThrow("collision")
    expect(() =>
      admit(input, { ...registry, "../escape.svg": registry[first.path] } as ArtifactAssets),
    ).toThrow()
  })
  it("refuses unsafe SVG even when its byte digest and receipt agree", () => {
    const input = fixture()
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>bad()</script></svg>'
    const node = input.content[0]
    const selection = input.receipt.blocks[0]
    const value = node?.meta.artifact.variants[0]
    if (!node || !selection || !value) throw new Error("Missing variant")
    value.blob_digest = rawDigest(source)
    value.byte_length = source.length
    selection.variant.blob_digest = value.blob_digest
    selection.variant.byte_length = value.byte_length
    restamp(input)
    expect(() =>
      admit(input, { [value.asset]: { media_type: value.media_type, base64: btoa(source) } }),
    ).toThrow("unsafe DocShell artifact media")
  })
  it.each(["A", "A===", "AB==", "AA\n=", "%%=="])(
    "refuses invalid or noncanonical selected base64 %s",
    (encoded) => {
      const input = fixture()
      const first = input.assets[0]
      if (!first) throw new Error("Missing asset")
      expect(() =>
        admit(input, { [first.path]: { media_type: first.media_type, base64: encoded } }),
      ).toThrow()
    },
  )
  it("declares per-profile passive capabilities deterministically without registration", () => {
    const profiles = corpus.cases.map((input) => ({
      profile: input.descriptor.profile,
      profile_digest: input.receipt.blocks[0]?.profile_digest ?? "",
      schema_digest: input.descriptor.input_schema_digest,
    }))
    const first = artifactCapabilities(profiles)
    expect(first).toEqual(artifactCapabilities([...profiles].reverse()))
    expect(first.features).toHaveLength(2)
    expect(
      first.features.every(
        (feature) =>
          feature.state === "fallback" &&
          feature.runtime.length === 0 &&
          feature.media_types.join(",") === "image/svg+xml,image/png",
      ),
    ).toBe(true)
    expect(artifactCapabilities(profiles, "hosted").output_modes).toEqual(["hosted"])
    expect(() => artifactCapabilities([profiles[0], profiles[0]] as never)).toThrow(
      "duplicate profile",
    )
    expect(() =>
      artifactCapabilities([{ profile: "x", profile_digest: "wrong", schema_digest: "wrong" }]),
    ).toThrow()
  })
})
