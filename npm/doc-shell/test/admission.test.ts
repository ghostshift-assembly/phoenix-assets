import { describe, expect, it } from "vitest"
import { admitPage } from "../src/admission.js"
import type { SitePage } from "../src/types.js"
import cases from "./fixtures/capability-cases.json"

describe("upstream DocShell capability admission", () => {
  for (const fixture of cases)
    it(fixture.name, () => {
      const render = () => admitPage(fixture.page as unknown as SitePage)
      if (fixture.accept) expect(render).not.toThrow()
      else expect(render).toThrow()
    })

  it("refuses malformed requirement lists and noncanonical fallback data", () => {
    const page = cases[0]?.page as unknown as SitePage
    expect(() => admitPage({ ...page, requirements: undefined as never })).toThrow(
      "Invalid DocShell page requirements",
    )
    const cyclic: unknown[] = []
    cyclic.push(cyclic)
    expect(() => admitPage({ ...page, content: cyclic as never })).toThrow("depth limit")
    expect(() => admitPage({ ...page, content: [Number.NaN] as never })).toThrow("canonical JSON")
  })
})
