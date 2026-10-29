import { describe, expect, it } from "vitest"
import {
  admittedAttributes,
  directiveNames,
  extractText,
  extractToc,
  flattenOperations,
  groupOperations,
  headingId,
  isDirective,
  preCodeInfo,
  projectedHeadingId,
  safeMediaTarget,
  schemaFrom,
  supportsOpenApi,
  typeLabel,
} from "../src/index.js"

describe("DocShell contract helpers", () => {
  it("extracts stable headings and code fences", () => {
    const heading = { tag: "h2", content: ["Hello ", { tag: "em", content: "World" }] }
    expect(extractText(heading.content)).toBe("Hello World")
    expect(headingId(heading.content)).toBe("hello-world")
    expect(extractToc([heading])).toEqual([{ id: "hello-world", level: 2, text: "Hello World" }])
    expect(
      preCodeInfo({
        tag: "pre",
        content: [{ tag: "code", attrs: { class: "language-elixir" }, content: "ok" }],
      }),
    ).toEqual({ code: "ok", language: "elixir" })
    expect(preCodeInfo({ tag: "pre", content: "plain" })).toBeUndefined()
    expect(preCodeInfo({ tag: "pre", content: ["plain"] })).toBeUndefined()
    expect(extractText()).toBe("")
    expect(
      extractToc(["text", { tag: "div", content: [{ tag: "h3", content: "Nested" }] }]),
    ).toEqual([{ id: "nested", level: 3, text: "Nested" }])
  })

  it("uses only projected safe IDs, attributes, and local media", () => {
    const node = {
      tag: "h2",
      attrs: { id: "projected:start", title: "Start", onclick: "alert(1)" },
      content: ["Start"],
    }
    expect(projectedHeadingId(node)).toBe("projected:start")
    expect(admittedAttributes(node)).toEqual({ id: "projected:start", title: "Start" })
    expect(projectedHeadingId({ ...node, attrs: { id: "bad id" } })).toBeUndefined()
    expect(safeMediaTarget("/images/guide.png")).toBe("/images/guide.png")
    expect(safeMediaTarget("//tracker.example.test/pixel")).toBeUndefined()
    expect(safeMediaTarget("/images\\pixel")).toBeUndefined()
    expect(safeMediaTarget(undefined)).toBeUndefined()
  })

  it("publishes the complete directive registry", () => {
    expect(directiveNames).toHaveLength(18)
    expect(isDirective("callout")).toBe(true)
    expect(isDirective("script")).toBe(false)
  })

  it("flattens and groups OpenAPI operations", () => {
    const operations = flattenOperations({
      paths: { "/users": { get: { operationId: "users", tags: ["Accounts"] } } },
    })
    const operation = operations[0]
    if (!operation) throw new Error("expected operation")
    expect(operations[0]).toMatchObject({ id: "users", method: "GET", path: "/users" })
    expect(groupOperations(operations)).toEqual({ Accounts: operations })
    expect(flattenOperations({})).toEqual([])
    expect(groupOperations([{ ...operation, tags: [] }])).toEqual({
      default: [{ ...operation, tags: [] }],
    })
  })

  it("admits OpenAPI 3.0, 3.1, and 3.2 only", () => {
    expect(supportsOpenApi(undefined)).toBe(true)
    expect(supportsOpenApi("3.0.4")).toBe(true)
    expect(supportsOpenApi("3.1.1")).toBe(true)
    expect(supportsOpenApi("3.2.0")).toBe(true)
    expect(supportsOpenApi("3.3.0")).toBe(false)
    expect(supportsOpenApi("2.0")).toBe(false)
  })

  it("labels recursive schema variants", () => {
    expect(typeLabel({ type: "array", items: { type: "string" } })).toBe("string[]")
    expect(typeLabel({ oneOf: [{ type: "string" }] })).toBe("oneOf")
    expect(typeLabel({ type: "number", nullable: true })).toBe("number?")
    expect(typeLabel({ anyOf: [] })).toBe("anyOf")
    expect(typeLabel({ allOf: [] })).toBe("allOf")
    expect(typeLabel({})).toBe("object")
  })

  // OpenAPI 3.1 drops `nullable` for a JSON Schema type array. AshOaskit emits
  // both dialects, and reading only the 3.0 shape mislabelled every nullable
  // field in a 3.1 spec -- and made the array branch unreachable.
  it("labels OpenAPI 3.1 type arrays as well as 3.0 nullable", () => {
    expect(typeLabel({ type: ["string", "null"] })).toBe("string?")
    expect(typeLabel({ type: ["array", "null"], items: { type: ["string"] } })).toBe("string[]?")
    expect(typeLabel({ type: ["array"], items: { type: "number" } })).toBe("number[]")
    expect(typeLabel({ type: ["string", "number"] })).toBe("string | number")
    expect(typeLabel({ type: ["null"] })).toBe("object?")
    expect(schemaFrom({ "application/json": { schema: { type: "string" } } })).toEqual({
      type: "string",
    })
    expect(schemaFrom({ "application/vnd.api+json": { schema: { type: "number" } } })).toEqual({
      type: "number",
    })
    expect(schemaFrom()).toBeUndefined()
  })
})

it("groups prototype-like OpenAPI tags and preserves declaration order", () => {
  const entries = flattenOperations({
    paths: {
      "/a": { get: { tags: ["__proto__"], operationId: "a" } },
      "/b": { get: { tags: ["constructor"], operationId: "b" } },
      "/c": { get: { tags: ["__proto__"], operationId: "c" } },
    },
  })
  const groups = groupOperations(entries)
  expect(Object.keys(groups)).toEqual(["__proto__", "constructor"])
  expect(groups.__proto__?.map((entry) => entry.id)).toEqual(["a", "c"])
  expect(groups.constructor).toEqual([entries[1]])
})
