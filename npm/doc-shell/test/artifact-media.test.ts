import { describe, expect, it } from "vitest"
import { validateArtifactMedia } from "../src/artifact-media.js"
import corpus from "./fixtures/artifact-media-v1.json"

const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
describe("passive artifact media", () => {
  for (const vector of corpus.cases)
    it(vector.id, () => {
      const check = () => validateArtifactMedia(vector.media_type, decode(vector.base64))
      if (vector.accept) expect(check).not.toThrow()
      else expect(check).toThrow("Unsupported or unsafe")
    })
  it("validates byte views at their actual offset without mutating the original asset", () => {
    const vector = corpus.cases.find((item) => item.id === "png")
    if (!vector) throw new Error("Missing frozen PNG")
    const original = decode(vector.base64)
    const backing = new Uint8Array(original.length + 16).fill(255)
    backing.set(original, 7)
    const view = backing.subarray(7, 7 + original.length)
    validateArtifactMedia(vector.media_type, view)
    expect(view).toEqual(original)
    expect(backing[0]).toBe(255)
    expect(backing.at(-1)).toBe(255)
  })
  it("bounds SVG bytes and element count before rendering", () => {
    const prefix = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">'
    const source = `${prefix}${"<g/>".repeat(4095)}</svg>`
    expect(() =>
      validateArtifactMedia("image/svg+xml", new TextEncoder().encode(source)),
    ).not.toThrow()
    expect(() =>
      validateArtifactMedia(
        "image/svg+xml",
        new TextEncoder().encode(`${prefix}${"<g/>".repeat(4096)}</svg>`),
      ),
    ).toThrow()
    const exact = `${prefix}${" ".repeat(1_048_576 - prefix.length - 6)}</svg>`
    expect(() =>
      validateArtifactMedia("image/svg+xml", new TextEncoder().encode(exact)),
    ).not.toThrow()
    expect(() =>
      validateArtifactMedia("image/svg+xml", new TextEncoder().encode(`${exact} `)),
    ).toThrow()
    expect(() => validateArtifactMedia("image/png", new Uint8Array(33_554_433))).toThrow()
  })
})
