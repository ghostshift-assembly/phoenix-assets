import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { reportingProfile } from "../../../scripts/reporting-profile.mjs"
import {
  CLASSIFICATIONS,
  DEFAULT_REPORTING_LIMITS,
  FIELD_ROLES,
  FIELD_TYPES,
  VISUALIZATION_KINDS,
} from "../src/reporting/contract.js"
import { safeDecodeReportEnvelope } from "../src/reporting/decode.js"
import cases from "./fixtures/upstream-reporting/cases.json"
import envelope from "./fixtures/upstream-reporting/envelope.json"
import profile from "./fixtures/upstream-reporting/profile.json"

describe("immutable public producer source and corpus", () => {
  it("checks every snapshot digest before comparing the grammar", () => {
    expect(reportingProfile()).toEqual(profile)
    for (const [file, expected] of Object.entries(profile.sources)) {
      const bytes = readFileSync(`${import.meta.dirname}/fixtures/upstream-reporting/${file}`)
      expect(createHash("sha256").update(bytes).digest("hex"), file).toBe(expected)
    }
    expect([...VISUALIZATION_KINDS].sort()).toEqual([...profile.grammar.kinds].sort())
    expect([...FIELD_TYPES].sort()).toEqual([...profile.grammar.types].sort())
    expect([...FIELD_ROLES].sort()).toEqual([...profile.grammar.roles].sort())
    expect([...CLASSIFICATIONS].sort()).toEqual([...profile.grammar.classifications].sort())
    const limits = profile.limits
    expect(DEFAULT_REPORTING_LIMITS).toMatchObject({
      maxBytes: limits.max_bytes,
      maxPanels: limits.max_panels,
      maxFields: limits.max_fields,
      maxRows: limits.max_rows,
      maxCellBytes: limits.max_cell_bytes,
      maxDepth: limits.max_depth,
    })
  })

  for (const fixture of cases) {
    it(`decodes the public producer case: ${fixture.name}`, () => {
      const value = structuredClone(envelope)
      let target: Record<string | number, unknown> = value
      for (const key of fixture.path.slice(0, -1))
        target = target[key] as Record<string | number, unknown>
      const key = fixture.path.at(-1)
      if (key === undefined) throw new Error("Empty producer case path")
      target[key] = fixture.value
      expect(safeDecodeReportEnvelope(value).state === "ready").toBe(fixture.accept)
    })
  }
})
