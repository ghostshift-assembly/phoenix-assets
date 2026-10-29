import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { admitHostedPair } from "../src/hosted-pair.js"
import { supportsOpenApi } from "../src/openapi.js"
import type { DocShellPresentation, OpenApiDocument, PublicationBinding } from "../src/types.js"
import fixture from "./fixtures/hosted-pair-v1.json"

const expected = fixture.binding as PublicationBinding
const presentation: DocShellPresentation = {
  ...fixture.presentation,
  schema_version: "doc-shell/v2",
  publication: expected,
}
const openapi: OpenApiDocument = { ...fixture.openapi, "x-doc-shell-publication": expected }

describe("upstream hosted publication pair", () => {
  it("retains the exact upstream fixture from doc_shell@72b46cd", () => {
    const bytes = readFileSync(`${import.meta.dirname}/fixtures/hosted-pair-v1.json`)
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "398e2712d5d734afd69eb4d030867d272426efb2b1ee984f9daf3a13d650b066",
    )
    expect(admitHostedPair(presentation, openapi, expected)).toEqual({
      publication: expected,
      presentation,
      openapi,
    })
  })

  it.each(fixture.mismatch_fields)("refuses mixed and stale %s declarations", (field) => {
    const changed = { ...expected, [field]: "other" }
    expect(() =>
      admitHostedPair({ ...presentation, publication: changed }, openapi, expected),
    ).toThrow(`presentation.${field}`)
    expect(() =>
      admitHostedPair(presentation, { ...openapi, "x-doc-shell-publication": changed }, expected),
    ).toThrow(`openapi.${field}`)
    expect(() =>
      admitHostedPair(
        { ...presentation, publication: changed },
        { ...openapi, "x-doc-shell-publication": changed },
        expected,
      ),
    ).toThrow("publication mismatch")
  })

  it("rejects missing, oversized, future and invalid bindings without exposing private values", () => {
    for (const value of [
      undefined,
      null,
      {},
      [],
      { ...expected, extra: true },
      { ...expected, schema_version: "future" },
      { ...expected, locale: "" },
      { ...expected, release: "x".repeat(4097) },
      { ...expected, source_view: "\ud800" },
    ]) {
      expect(() => admitHostedPair(presentation, openapi, value as PublicationBinding)).toThrow(
        "binding: expected",
      )
      expect(() =>
        admitHostedPair(
          { ...presentation, publication: value as PublicationBinding },
          openapi,
          expected,
        ),
      ).toThrow("binding: presentation")
      expect(() =>
        admitHostedPair(
          presentation,
          { ...openapi, "x-doc-shell-publication": value as PublicationBinding },
          expected,
        ),
      ).toThrow("binding: openapi")
    }
    expect(() =>
      admitHostedPair({ ...presentation, schema_version: "doc-shell/v1" }, openapi, expected),
    ).toThrow("hosted presentation")
    expect(() =>
      admitHostedPair(
        { ...presentation, content: null } as unknown as DocShellPresentation,
        openapi,
        expected,
      ),
    ).toThrow("hosted presentation")
    expect(() =>
      admitHostedPair(presentation, { ...openapi, openapi: undefined }, expected),
    ).toThrow("hosted OpenAPI")
  })

  it("uses the producer's declared version syntax while preserving unversioned standalone inputs", () => {
    for (const version of ["3.0.3", "3.1.0", "3.2.0", "3.1.1-rc.1+build.2"])
      expect(supportsOpenApi(version)).toBe(true)
    expect(supportsOpenApi(undefined)).toBe(true)
    for (const version of ["3.1", "3.1.bad", "3.1.00", "3.1.0-01", "3.1.0\n", "4.0.0", "3.3.0"]) {
      expect(supportsOpenApi(version)).toBe(false)
      expect(() =>
        admitHostedPair(presentation, { ...openapi, openapi: version }, expected),
      ).toThrow("hosted OpenAPI")
    }
  })
})
