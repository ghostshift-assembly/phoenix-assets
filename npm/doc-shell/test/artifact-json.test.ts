import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { admitPage } from "../src/admission.js"
import {
  byteDigest,
  jsonBytes,
  jsonDigest,
  jsonField,
  jsonItems,
  jsonProof,
  objectDigest,
} from "../src/artifact-json.js"
import type { SitePage } from "../src/types.js"
import vectors from "./fixtures/canonical-json-v1.json"
import cases from "./fixtures/capability-cases.json"

const hash = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`
describe("original canonical JSON proofs", () => {
  it("retains the exact upstream corpus from doc_shell@6870369", () => {
    const bytes = readFileSync(`${import.meta.dirname}/fixtures/canonical-json-v1.json`)
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "518036dca115b22ac603b786c0d77c40a40855d474ffbaa220dc579fb7567950",
    )
    for (const vector of vectors) {
      const proof = jsonProof(vector.value, vector.canonical)
      expect(jsonBytes(proof)).toBe(vector.canonical)
      expect(jsonDigest(proof)).toBe(vector.digest)
    }
  })
  it("uses Jason's capital control hex without changing literal backslashes or Unicode", () => {
    const vector = vectors.at(-1)
    if (!vector) throw new Error("Missing control vector")
    expect(jsonDigest(jsonProof(vector.value))).toBe(vector.digest)
    expect(jsonBytes(jsonProof({ "😀": 2, "\ue000": 1 }))).toBe('{"\ue000":1,"😀":2}')
  })
  it.each(["1.0", "-0.0", "1.0e-20", "9007199254740993", `1${"0".repeat(400)}`])(
    "retains numeric spelling %s",
    (number) => {
      const source = `{"number":${number}}`
      const proof = jsonProof(JSON.parse(source), source)
      const child = jsonField(proof, "number")
      expect(jsonBytes(child)).toBe(number)
      expect(jsonDigest(proof)).toBe(hash(source))
      expect(objectDigest([["copy", child]])).toBe(hash(`{"copy":${number}}`))
    },
  )
  it("checks arrays, raw byte hashes and sorted subtree composition", () => {
    const proof = jsonProof([true, null, "text", { nested: false }])
    expect(jsonItems(proof)).toHaveLength(4)
    expect(byteDigest(new TextEncoder().encode("bytes"))).toBe(hash("bytes"))
    expect(
      objectDigest([
        ["z", jsonProof(2)],
        ["a", jsonProof(1)],
      ]),
    ).toBe(hash('{"a":1,"z":2}'))
    expect(() => jsonField(proof, "missing")).toThrow()
    expect(() => jsonItems(jsonProof({}))).toThrow()
    expect(() =>
      objectDigest([
        ["same", proof],
        ["same", proof],
      ]),
    ).toThrow()
  })
  it("refuses changed values, ambiguous native numbers and executable object accessors", () => {
    for (const value of [
      1.5,
      -0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      9007199254740992,
      undefined,
      new Date(),
      new Map(),
      () => null,
    ])
      expect(() => jsonProof(value)).toThrow()
    expect(() => jsonProof({ number: 2 }, '{"number":1.0}')).toThrow()
    expect(() => jsonProof([], "{}")).toThrow()
    expect(() => jsonProof({}, "[]")).toThrow()
    expect(() => jsonProof([1], "[2]")).toThrow()
    expect(() => jsonProof({ hidden: 1 }, "{}")).toThrow()
    expect(() => jsonProof(Array(1))).toThrow()
    const accessor = vi.fn(() => 1)
    const value = Object.defineProperty({}, "secret", { enumerable: true, get: accessor })
    expect(() => jsonProof(value)).toThrow()
    expect(() => jsonProof(value, '{"secret":1}')).toThrow()
    expect(accessor).not.toHaveBeenCalled()
    expect(() => jsonProof({ [Symbol("hidden")]: true })).toThrow()
    expect(() => jsonProof(Object.defineProperty({}, "hidden", { value: 1 }))).toThrow()
  })
  it.each([
    '{"a":1,"a":2}',
    '{"z":1,"a":2}',
    '{"a": 1}',
    "true false",
    "[1,]",
    '{"a":}',
    '"\\ud800"',
    '"\\u001b"',
    '"unterminated',
    "01",
    "1.",
    "1e",
    "{a:1}",
  ])("refuses malformed/noncanonical source %s", (source) => {
    expect(() => jsonProof(null, source)).toThrow()
  })
  it("bounds depth and original bytes before reading the complete value", () => {
    const depth = (count: number) => `${"[".repeat(count)}0${"]".repeat(count)}`
    expect(jsonDigest(jsonProof(JSON.parse(depth(256)), depth(256)))).toBe(hash(depth(256)))
    expect(() => jsonProof([], depth(257))).toThrow("depth limit")
    expect(() => jsonProof([], `${"[".repeat(257)}${"]".repeat(257)}`)).toThrow("depth limit")
    expect(() => jsonProof([], "x".repeat(8_388_609))).toThrow()
    expect(() => jsonProof("x".repeat(8_388_609))).toThrow()
    const cycle: unknown[] = []
    cycle.push(cycle)
    expect(() => jsonProof(cycle)).toThrow("depth limit")
  })
  it("stops at the finite JSON value ceiling before comparing a flat input", () => {
    const source = `[${"0,".repeat(999999)}0]`
    expect(() => jsonProof([], source)).toThrow("value limit")
  })
  it("matches the prototype key as inert data", () => {
    const value: unknown = JSON.parse('{"__proto__":{"value":1}}')
    expect(jsonBytes(jsonProof(value))).toBe('{"__proto__":{"value":1}}')
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
  })
  it("uses retained content bytes for legacy fallback hashes with float metadata", () => {
    const base = cases.find((fixture) => fixture.name === "unknown-optional-with-proof")?.page
    if (!base) throw new Error("Missing legacy fallback vector")
    const canonicalContent =
      '[{"attrs":{},"content":["Visible fallback"],"meta":{"number":1.0},"tag":"p"}]'
    const fallback_digest = hash(`{"content":${canonicalContent},"feature":"example/feature/v1"}`)
    const page = {
      ...base,
      content: JSON.parse(canonicalContent),
      content_digest: hash(canonicalContent),
      requirements: [{ ...base.requirements[0], fallback_digest }],
    } as SitePage
    expect(() => admitPage(page)).toThrow("fallback digest mismatch")
    expect(() => admitPage(page, canonicalContent)).not.toThrow()
    expect(() => admitPage({ ...page, content: [] }, canonicalContent)).toThrow(
      "canonical JSON proof",
    )
  })
  it("refuses newline-suffixed declaration fields", () => {
    const base = cases[0]?.page as unknown as SitePage
    const requirement = base.requirements[0]
    if (!requirement) throw new Error("Missing requirement")
    for (const changed of [
      { ...requirement, feature_id: `${requirement.feature_id}\n` },
      { ...requirement, fallback_digest: `sha256:${"0".repeat(64)}\n` },
    ])
      expect(() => admitPage({ ...base, requirements: [changed] })).toThrow(
        "Invalid DocShell capability requirement",
      )
  })
  it("admits a v1 fallback whose metadata contains capital-escaped controls", () => {
    const base = cases.find((fixture) => fixture.name === "unknown-optional-with-proof")?.page
    if (!base) throw new Error("Missing legacy fallback vector")
    const content = [
      {
        tag: "p",
        attrs: {},
        content: ["Visible fallback"],
        meta: { control: "\u001b", literal: "\\u001b" },
      },
    ]
    const proof = jsonProof(content)
    const fallback_digest = objectDigest([
      ["content", proof],
      ["feature", jsonProof("example/feature/v1")],
    ])
    const page = {
      ...base,
      content,
      content_digest: jsonDigest(proof),
      requirements: [{ ...base.requirements[0], fallback_digest }],
    } as SitePage
    expect(() => admitPage(page)).not.toThrow()
  })
})
