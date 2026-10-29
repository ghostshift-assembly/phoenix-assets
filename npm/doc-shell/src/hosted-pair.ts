import { supportsOpenApi } from "./openapi.js"
import type { DocShellPresentation, OpenApiDocument, PublicationBinding } from "./types.js"

const fields = [
  "publication_id",
  "source_view",
  "graph_position",
  "locale",
  "release",
  "disclosure_surface",
] as const
const keys = ["schema_version", ...fields]
const encoder = new TextEncoder()
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !/[\uD800-\uDFFF]/u.test(value)

function binding(value: unknown, side: string): asserts value is PublicationBinding {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    value.schema_version !== "doc-shell-publication/v1" ||
    !fields.every((key) => text(value[key]) && encoder.encode(value[key] as string).length <= 4096)
  ) {
    throw new Error(`Invalid DocShell publication binding: ${side}`)
  }
}

function compare(value: PublicationBinding, expected: PublicationBinding, side: string) {
  const field = fields.find((key) => value[key] !== expected[key])
  if (field) throw new Error(`DocShell publication mismatch: ${side}.${field}`)
}

/**
 * Compare host-admitted v2 wire inputs with the expected request publication.
 * The host validates graph/OpenAPI data upstream, authenticates the request and
 * maintains immutable bindings. This check grants no authority and fetches nothing.
 */
export function admitHostedPair(
  presentation: DocShellPresentation,
  openapi: OpenApiDocument,
  expected: PublicationBinding,
): {
  publication: PublicationBinding
  presentation: DocShellPresentation
  openapi: OpenApiDocument
} {
  binding(expected, "expected")
  binding(presentation?.publication, "presentation")
  binding(openapi?.["x-doc-shell-publication"], "openapi")
  compare(presentation.publication, expected, "presentation")
  compare(openapi["x-doc-shell-publication"], expected, "openapi")
  if (
    presentation.schema_version !== "doc-shell/v2" ||
    !Array.isArray(presentation.navigation) ||
    !Array.isArray(presentation.search) ||
    !record(presentation.content)
  ) {
    throw new Error("Invalid DocShell hosted presentation")
  }
  if (typeof openapi.openapi !== "string" || !supportsOpenApi(openapi.openapi)) {
    throw new Error("Invalid DocShell hosted OpenAPI version")
  }
  return { publication: expected, presentation, openapi }
}
