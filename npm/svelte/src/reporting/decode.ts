import {
  CLASSIFICATIONS,
  DEFAULT_REPORTING_LIMITS,
  FIELD_ROLES,
  FIELD_TYPES,
  PANEL_STATES,
  type PanelDefinition,
  type PanelResult,
  type ReportDefinition,
  type ReportEnvelope,
  ReportingContractError,
  type ReportingLimits,
  type ReportLayout,
  type ResultField,
  type ResultFrame,
  VISUALIZATION_KINDS,
  type VisualizationDefinition,
} from "./contract.js"

type Path = Array<string | number>
type JsonObject = Record<string, unknown>

const encoder = new TextEncoder()
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.:-]{0,255}$/
const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/

/** The outcome of {@link safeDecodeReportEnvelope}. */
export type DecodedEnvelope =
  | { state: "ready"; envelope: ReportEnvelope }
  | { state: "invalid"; code: string; path: ReadonlyArray<string | number> }

/**
 * {@link decodeReportEnvelope} as a value rather than an exception.
 *
 * A rejected envelope is an ordinary outcome — the report renders an error card
 * instead of a chart — so every host wrapped the throwing decoder in the same
 * try/catch and pulled the same `code` out of the same error class. This is that
 * wrapper, so the error path is the library's to keep correct rather than
 * something each app re-derives.
 *
 * A non-contract error (a bug in here) still throws: swallowing it would turn a
 * defect into a shrug.
 */
export function safeDecodeReportEnvelope(
  input: string | unknown,
  overrides: Partial<ReportingLimits> = {},
): DecodedEnvelope {
  try {
    return { state: "ready", envelope: decodeReportEnvelope(input, overrides) }
  } catch (error) {
    if (error instanceof ReportingContractError) {
      return { state: "invalid", code: error.code, path: error.path }
    }
    throw error
  }
}

export function decodeReportEnvelope(
  input: string | unknown,
  overrides: Partial<ReportingLimits> = {},
): ReportEnvelope {
  const limits = { ...DEFAULT_REPORTING_LIMITS, ...overrides }
  const value = decodeInput(input, limits)
  const object = expectObject(value, [])
  exactKeys(object, ["definition", "results", "capability_warnings", "generated_at"], [])

  const definition = decodeDefinition(object.definition, ["definition"], limits)
  const rawResults = expectObject(object.results, ["results"])
  const panelIds = new Set(definition.panels.map((panel) => panel.id))
  exactKeys(rawResults, [...panelIds], ["results"])

  const results: Record<string, PanelResult> = {}
  for (const panel of definition.panels) {
    const result = decodePanelResult(rawResults[panel.id], ["results", panel.id], limits)
    results[panel.id] = result
    if (result.state === "ok" || result.state === "partial") validateBindings(panel, result.frame)
  }

  const warnings = jsonRegion(
    expectArray(object.capability_warnings, ["capability_warnings"]),
    ["capability_warnings"],
    limits,
  ).map((warning, index) => expectObject(warning, ["capability_warnings", index]))

  return {
    definition,
    results,
    capability_warnings: warnings,
    generated_at: expectDateTime(object.generated_at, ["generated_at"]),
  }
}

export function decodeResultFrame(
  input: string | unknown,
  overrides: Partial<ReportingLimits> = {},
): ResultFrame {
  const limits = { ...DEFAULT_REPORTING_LIMITS, ...overrides }
  const value = decodeInput(input, limits)
  return decodeFrame(value, [], limits)
}

function decodeInput(input: string | unknown, limits: ReportingLimits): unknown {
  const value = typeof input === "string" ? parseJson(input, limits) : input
  // The producer applies maxDepth to each open JSON region. Fixed envelope,
  // panel and field containers have their own structural depth.
  assertJsonValue(value, [], limits.maxDepth + 8, new WeakSet<object>())
  if (
    typeof input !== "string" &&
    encoder.encode(JSON.stringify(value)).byteLength > limits.maxBytes
  )
    fail("limit_exceeded", [], "Value exceeds maxBytes")
  return value
}

function parseJson(input: string, limits: ReportingLimits): unknown {
  if (encoder.encode(input).byteLength > limits.maxBytes)
    fail("limit_exceeded", [], "JSON exceeds maxBytes")
  try {
    return JSON.parse(input)
  } catch {
    return fail("invalid_json", [], "Input is not valid JSON")
  }
}

function decodeDefinition(value: unknown, path: Path, limits: ReportingLimits): ReportDefinition {
  const object = expectObject(value, path)
  exactKeys(
    object,
    [
      "schema_version",
      "id",
      "title",
      "description",
      "panels",
      "layout",
      "parameters",
      "provenance",
    ],
    path,
    ["id", "parameters"],
  )
  const schemaVersion = expectString(object.schema_version, [...path, "schema_version"], 16)
  if (!/^1\.\d+$/.test(schemaVersion))
    fail(
      "unsupported_schema_version",
      [...path, "schema_version"],
      "Only schema major 1 is supported",
    )

  const rawPanels = expectArray(object.panels, [...path, "panels"])
  if (rawPanels.length > limits.maxPanels)
    fail("limit_exceeded", [...path, "panels"], "Too many panels")
  const panels = rawPanels.map((panel, index) => decodePanel(panel, [...path, "panels", index]))
  unique(
    panels.map((panel) => panel.id),
    [...path, "panels"],
    "panel id",
  )

  return {
    schema_version: schemaVersion,
    id:
      object.id === undefined || object.id === null
        ? null
        : expectString(object.id, [...path, "id"], 256),
    title: expectString(object.title, [...path, "title"], 512),
    description: expectString(object.description, [...path, "description"], 4_096),
    panels,
    layout: decodeLayout(
      jsonRegion(object.layout, [...path, "layout"], limits),
      [...path, "layout"],
      panels,
    ),
    parameters:
      object.parameters === undefined
        ? []
        : jsonRegion(
            expectArray(object.parameters, [...path, "parameters"]),
            [...path, "parameters"],
            limits,
          ),
    provenance: jsonRegion(
      expectObject(object.provenance, [...path, "provenance"]),
      [...path, "provenance"],
      limits,
    ),
  }
}

function decodeLayout(value: unknown, path: Path, panels: PanelDefinition[]): ReportLayout {
  const object = expectObject(value, path)
  exactKeys(object, ["columns", "order", "spans"], path, ["columns", "order", "spans"])
  const panelIds = new Set(panels.map((panel) => panel.id))
  const columns =
    object.columns === undefined
      ? undefined
      : expectInteger(object.columns, [...path, "columns"], 1, 12)
  const order =
    object.order === undefined
      ? undefined
      : expectArray(object.order, [...path, "order"]).map((id, index) =>
          expectIdentifier(id, [...path, "order", index]),
        )
  if (order !== undefined) {
    unique(order, [...path, "order"], "panel id")
    for (const [index, id] of order.entries())
      if (!panelIds.has(id))
        fail("unknown_panel", [...path, "order", index], "Layout references an unknown panel")
  }
  const rawSpans =
    object.spans === undefined ? undefined : expectObject(object.spans, [...path, "spans"])
  const spans =
    rawSpans === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(rawSpans).map(([id, span]) => {
            if (!panelIds.has(id))
              fail("unknown_panel", [...path, "spans", id], "Layout references an unknown panel")
            return [id, expectInteger(span, [...path, "spans", id], 1, columns ?? 12)]
          }),
        )
  return {
    ...(columns === undefined ? {} : { columns }),
    ...(order === undefined ? {} : { order }),
    ...(spans === undefined ? {} : { spans }),
  }
}

function decodePanel(value: unknown, path: Path): PanelDefinition {
  const object = expectObject(value, path)
  exactKeys(
    object,
    ["id", "title", "description", "query_ref", "visualization", "table_columns", "empty_message"],
    path,
  )
  return {
    id: expectIdentifier(object.id, [...path, "id"]),
    title: expectString(object.title, [...path, "title"], 512),
    description: expectString(object.description, [...path, "description"], 4_096),
    query_ref: expectString(object.query_ref, [...path, "query_ref"], 1_024),
    visualization: decodeVisualization(object.visualization, [...path, "visualization"]),
    table_columns: expectArray(object.table_columns, [...path, "table_columns"]).map(
      (field, index) => expectIdentifier(field, [...path, "table_columns", index]),
    ),
    empty_message: expectString(object.empty_message, [...path, "empty_message"], 1_024),
  }
}

function decodeVisualization(value: unknown, path: Path): VisualizationDefinition {
  const object = expectObject(value, path)
  exactKeys(
    object,
    [
      "kind",
      "encodings",
      "formats",
      "sort",
      "stack",
      "annotations",
      "interaction",
      "summary_template",
    ],
    path,
    ["formats", "sort", "stack", "annotations", "interaction"],
  )
  const rawEncodings = expectObject(object.encodings, [...path, "encodings"])
  exactKeys(
    rawEncodings,
    ["x", "y", "series", "value", "label", "color_group", "size"],
    [...path, "encodings"],
    ["x", "y", "series", "value", "label", "color_group", "size"],
  )
  const encodings: VisualizationDefinition["encodings"] = {}
  for (const [channel, field] of Object.entries(rawEncodings))
    encodings[channel as keyof typeof encodings] = expectIdentifier(field, [
      ...path,
      "encodings",
      channel,
    ])

  const kind = expectEnum(object.kind, VISUALIZATION_KINDS, [...path, "kind"])
  const requiredChannels = requiredEncodings(kind)
  const missingChannels = requiredChannels.filter((channel) => encodings[channel] === undefined)
  if (missingChannels.length > 0)
    fail(
      "missing_encodings",
      [...path, "encodings"],
      `Missing encodings: ${missingChannels.join(", ")}`,
    )

  const sort =
    object.sort === undefined
      ? []
      : expectArray(object.sort, [...path, "sort"]).map((entry, index) => {
          const item = expectObject(entry, [...path, "sort", index])
          exactKeys(item, ["field", "direction"], [...path, "sort", index])
          return {
            field: expectIdentifier(item.field, [...path, "sort", index, "field"]),
            direction: expectEnum(item.direction, ["asc", "desc"] as const, [
              ...path,
              "sort",
              index,
              "direction",
            ]),
          }
        })

  const annotations =
    object.annotations === undefined
      ? []
      : expectArray(object.annotations, [...path, "annotations"]).map((entry, index) => {
          const item = expectObject(entry, [...path, "annotations", index])
          exactKeys(item, ["text", "field"], [...path, "annotations", index], ["field"])
          return {
            text: expectString(item.text, [...path, "annotations", index, "text"], 1_024),
            ...(item.field === undefined
              ? {}
              : { field: expectIdentifier(item.field, [...path, "annotations", index, "field"]) }),
          }
        })

  const interaction =
    object.interaction === undefined
      ? {}
      : expectObject(object.interaction, [...path, "interaction"])
  exactKeys(
    interaction,
    ["selection", "drill_action_id"],
    [...path, "interaction"],
    ["selection", "drill_action_id"],
  )

  return {
    kind,
    encodings,
    formats:
      object.formats === undefined ? {} : expectStringMap(object.formats, [...path, "formats"]),
    sort,
    stack:
      object.stack === undefined
        ? "none"
        : expectEnum(object.stack, ["none", "normal", "normalized"] as const, [...path, "stack"]),
    annotations,
    interaction: {
      ...(interaction.selection === undefined
        ? {}
        : {
            selection: expectEnum(interaction.selection, ["none", "point", "interval"] as const, [
              ...path,
              "interaction",
              "selection",
            ]),
          }),
      ...(interaction.drill_action_id === undefined
        ? {}
        : {
            drill_action_id: expectIdentifier(interaction.drill_action_id, [
              ...path,
              "interaction",
              "drill_action_id",
            ]),
          }),
    },
    summary_template: expectString(object.summary_template, [...path, "summary_template"], 2_048),
  }
}

function decodePanelResult(value: unknown, path: Path, limits: ReportingLimits): PanelResult {
  const object = expectObject(value, path)
  const state = expectEnum(object.state, PANEL_STATES, [...path, "state"])
  if (state === "ok" || state === "partial") {
    exactKeys(object, ["state", "frame"], path)
    return { state, frame: decodeFrame(object.frame, [...path, "frame"], limits) }
  }
  exactKeys(object, ["state", "detail"], path, ["detail"])
  return {
    state,
    ...(object.detail === undefined
      ? {}
      : { detail: jsonRegion(object.detail, [...path, "detail"], limits) }),
  }
}

function decodeFrame(value: unknown, path: Path, limits: ReportingLimits): ResultFrame {
  const object = expectObject(value, path)
  exactKeys(object, ["fields", "rows", "provenance", "freshness", "classification", "page"], path)
  const rawFields = expectArray(object.fields, [...path, "fields"])
  if (rawFields.length > limits.maxFields)
    fail("limit_exceeded", [...path, "fields"], "Too many fields")
  const fields = rawFields.map((field, index) => decodeField(field, [...path, "fields", index]))
  unique(
    fields.map((field) => field.name),
    [...path, "fields"],
    "field name",
  )
  const rows = expectArray(object.rows, [...path, "rows"])
  if (rows.length > limits.maxRows) fail("limit_exceeded", [...path, "rows"], "Too many rows")
  const decodedRows = rows.map((row, rowIndex) =>
    decodeRow(row, fields, [...path, "rows", rowIndex], limits),
  )
  return {
    fields,
    rows: decodedRows,
    provenance: jsonRegion(
      expectObject(object.provenance, [...path, "provenance"]),
      [...path, "provenance"],
      limits,
    ),
    freshness: jsonRegion(
      expectObject(object.freshness, [...path, "freshness"]),
      [...path, "freshness"],
      limits,
    ),
    classification: jsonRegion(
      expectObject(object.classification, [...path, "classification"]),
      [...path, "classification"],
      limits,
    ),
    page: jsonRegion(expectObject(object.page, [...path, "page"]), [...path, "page"], limits),
  }
}

function decodeField(value: unknown, path: Path): ResultField {
  const object = expectObject(value, path)
  exactKeys(object, ["name", "label", "type", "role", "unit", "nullable", "classification"], path, [
    "unit",
  ])
  return {
    name: expectIdentifier(object.name, [...path, "name"]),
    label: expectString(object.label, [...path, "label"], 512),
    type: expectEnum(object.type, FIELD_TYPES, [...path, "type"]),
    role: expectEnum(object.role, FIELD_ROLES, [...path, "role"]),
    unit:
      object.unit === undefined || object.unit === null
        ? null
        : expectString(object.unit, [...path, "unit"], 128),
    nullable: expectBoolean(object.nullable, [...path, "nullable"]),
    classification: expectEnum(object.classification, CLASSIFICATIONS, [...path, "classification"]),
  }
}

function decodeRow(
  value: unknown,
  fields: ResultField[],
  path: Path,
  limits: ReportingLimits,
): unknown[] {
  const row = expectArray(value, path)
  if (row.length !== fields.length)
    fail("row_width_mismatch", path, "Row width differs from field schema")
  return row.map((cell, index) => {
    const field = fields[index]
    if (!field) return fail("row_width_mismatch", path, "Row width differs from field schema")
    return validateCell(cell, field, [...path, index], limits)
  })
}

function validateCell(
  value: unknown,
  field: ResultField,
  path: Path,
  limits: ReportingLimits,
): unknown {
  if (value === null) {
    if (field.nullable) return null
    return fail("invalid_cell", path, "Null is not allowed")
  }
  if (typeof value === "string" && encoder.encode(value).byteLength > limits.maxCellBytes)
    fail("limit_exceeded", path, "String cell is too large")
  const valid =
    field.type === "boolean"
      ? typeof value === "boolean"
      : field.type === "integer" || field.type === "duration"
        ? Number.isSafeInteger(value)
        : field.type === "float"
          ? typeof value === "number" && Number.isFinite(value)
          : field.type === "decimal"
            ? typeof value === "string" && DECIMAL.test(value)
            : field.type === "date"
              ? typeof value === "string" && isRfc3339Date(value)
              : field.type === "time"
                ? typeof value === "string" && isRfc3339Time(value)
                : field.type === "datetime"
                  ? typeof value === "string" && isRfc3339DateTime(value)
                  : typeof value === "string"
  if (!valid) fail("invalid_cell", path, `Value does not match ${field.type}`)
  return value
}

function validateBindings(panel: PanelDefinition, frame: ResultFrame): void {
  const fields = new Map(frame.fields.map((field) => [field.name, field]))
  const references = [
    ...Object.values(panel.visualization.encodings),
    ...Object.keys(panel.visualization.formats),
    ...panel.table_columns,
    ...panel.visualization.sort.map((sort) => sort.field),
    ...panel.visualization.annotations.map((annotation) => annotation.field),
  ]
  for (const reference of references)
    if (reference !== undefined && !fields.has(reference))
      fail("unknown_field", ["definition", "panels", panel.id], `Unknown field ${reference}`)
  for (const channel of ["x", "y", "value", "size"] as const) {
    const fieldName = panel.visualization.encodings[channel]
    if (fieldName && fields.get(fieldName)?.role === "identifier")
      fail(
        "invalid_encoding",
        ["definition", "panels", panel.id, "visualization", "encodings", channel],
        "Identifier cannot use a quantitative channel",
      )
  }
  for (const channel of quantitativeChannels(panel)) {
    const fieldName = panel.visualization.encodings[channel]
    const field = fieldName === undefined ? undefined : fields.get(fieldName)
    if (field && !["integer", "float", "decimal", "duration"].includes(field.type))
      fail(
        "invalid_encoding",
        ["definition", "panels", panel.id, "visualization", "encodings", channel],
        "Quantitative channel requires a numeric or duration field",
      )
  }
}

function quantitativeChannels(panel: PanelDefinition): Array<"y" | "value" | "size"> {
  const kind = panel.visualization.kind
  if (kind === "number" || kind === "gauge" || kind === "heatmap") return ["value", "size"]
  if (["line", "area", "bar", "scatter", "sparkline"].includes(kind)) return ["y", "size"]
  return ["size"]
}

function requiredEncodings(kind: VisualizationDefinition["kind"]): Array<"x" | "y" | "value"> {
  if (kind === "number" || kind === "gauge") return ["value"]
  if (kind === "table") return []
  if (kind === "heatmap") return ["x", "y", "value"]
  return ["x", "y"]
}

function expectStringMap(value: unknown, path: Path): Record<string, string> {
  const object = expectObject(value, path)
  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => {
      if (!IDENTIFIER.test(key)) fail("invalid_identifier", [...path, key], "Invalid field name")
      return [key, expectString(item, [...path, key], 64)]
    }),
  )
}

function expectObject(value: unknown, path: Path): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return fail("expected_object", path, "Expected an object")
  return value as JsonObject
}

function expectArray(value: unknown, path: Path): unknown[] {
  if (!Array.isArray(value)) return fail("expected_array", path, "Expected an array")
  return value
}

function expectString(value: unknown, path: Path, maxBytes: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    encoder.encode(value).byteLength > maxBytes
  )
    return fail("invalid_string", path, "Expected a bounded non-empty string")
  return value
}

function expectIdentifier(value: unknown, path: Path): string {
  const identifier = expectString(value, path, 256)
  if (!IDENTIFIER.test(identifier))
    fail("invalid_identifier", path, "Expected a portable identifier")
  return identifier
}

function expectBoolean(value: unknown, path: Path): boolean {
  if (typeof value !== "boolean") return fail("expected_boolean", path, "Expected a boolean")
  return value
}

function expectInteger(value: unknown, path: Path, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < minimum || value > maximum)
    return fail("invalid_integer", path, `Expected an integer from ${minimum} to ${maximum}`)
  return value
}

function expectDateTime(value: unknown, path: Path): string {
  const dateTime = expectString(value, path, 64)
  if (!isRfc3339DateTime(dateTime)) fail("invalid_datetime", path, "Expected an RFC 3339 datetime")
  return dateTime
}

function jsonRegion<T>(value: T, path: Path, limits: ReportingLimits): T {
  assertJsonValue(value, path, limits.maxDepth, new WeakSet<object>())
  return value
}

function assertJsonValue(
  value: unknown,
  path: Path,
  depth: number,
  ancestors: WeakSet<object>,
): void {
  if (depth < 0) fail("limit_exceeded", path, "Value exceeds maxDepth")
  if (value === null || typeof value === "string" || typeof value === "boolean") return
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("invalid_json_value", path, "Number must be finite")
    return
  }
  if (typeof value !== "object")
    fail("invalid_json_value", path, "Value is not representable as JSON")
  if (ancestors.has(value)) fail("invalid_json_value", path, "Cyclic values are not allowed")
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
    fail("invalid_json_value", path, "Only plain JSON objects are allowed")
  ancestors.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, [...path, index], depth - 1, ancestors))
  } else {
    Object.entries(value).forEach(([key, item]) =>
      assertJsonValue(item, [...path, key], depth - 1, ancestors),
    )
  }
  ancestors.delete(value)
}

function isRfc3339Date(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

function isRfc3339Time(value: string): boolean {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value)
  return (
    match !== null && Number(match[1]) <= 23 && Number(match[2]) <= 59 && Number(match[3]) <= 59
  )
}

function isRfc3339DateTime(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match || !isRfc3339Date(match[1] ?? "") || !isRfc3339Time(match[2] ?? "")) return false
  if (match[3] !== "Z") {
    const offset = /^[+-](\d{2}):(\d{2})$/.exec(match[3] ?? "")
    if (!offset || Number(offset[1]) > 23 || Number(offset[2]) > 59) return false
  }
  return !Number.isNaN(Date.parse(value))
}

function expectEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: Path,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value))
    return fail("invalid_enum", path, `Expected one of ${allowed.join(", ")}`)
  return value as T[number]
}

function exactKeys(
  object: JsonObject,
  allowed: string[],
  path: Path,
  optional: string[] = [],
): void {
  const unknown = Object.keys(object)
    .filter((key) => !allowed.includes(key))
    .sort()
  if (unknown.length > 0) fail("unknown_keys", path, `Unknown keys: ${unknown.join(", ")}`)
  const required = allowed.filter((key) => !optional.includes(key))
  const missing = required.filter((key) => !Object.hasOwn(object, key)).sort()
  if (missing.length > 0) fail("missing_keys", path, `Missing keys: ${missing.join(", ")}`)
}

function unique(values: string[], path: Path, label: string): void {
  if (new Set(values).size !== values.length) fail("duplicate", path, `Duplicate ${label}`)
}

function fail(code: string, path: Path, message: string): never {
  throw new ReportingContractError(code, path, message)
}
