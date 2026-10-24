import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { safeDecodeReportEnvelope } from "../src/reporting/decode.js"

const root = `${import.meta.dirname}/fixtures/upstream-reporting`
const bytes = readFileSync(`${root}/qualified/cases.json`)
const proof = JSON.parse(readFileSync(`${root}/qualified/proof.json`, "utf8"))
const cases = JSON.parse(bytes.toString()) as Array<{
  name: string
  accept: boolean
  value: unknown
}>
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

describe("executed public producer to renderer join", () => {
  it("binds cases to the actual producer source/profile and qualification script", () => {
    expect(digest(bytes)).toBe(proof.cases_sha256)
    expect(digest(readFileSync(`${root}/profile.json`))).toBe(proof.profile_sha256)
    expect(
      digest(readFileSync(`${import.meta.dirname}/../../../scripts/qualify-producer.exs`)),
    ).toBe(proof.script_sha256)
  })

  for (const fixture of cases) {
    it(`preserves the producer verdict for ${fixture.name}`, () => {
      const result = safeDecodeReportEnvelope(fixture.value)
      expect(
        result.state === "ready",
        JSON.stringify(result.state === "invalid" ? result : null),
      ).toBe(fixture.accept)
    })
  }
})
