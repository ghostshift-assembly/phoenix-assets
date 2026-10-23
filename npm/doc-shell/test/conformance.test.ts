import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { DocAstElement, NavigationItem, SearchEntry } from "../src/types.js"
import { presentationFixture } from "./fixtures/doc-shell-v1.js"
import presentationV2Fixture from "./fixtures/doc-shell-v2.json"
import { graphProjectorFixture } from "./fixtures/graph-projector.js"

/**
 * The `doc-shell/v1` contract is declared twice — as Elixir types in the
 * `doc_shell` Hex package, and as the interfaces in `src/types.ts` that this
 * renderer consumes. Nothing connected the two, so they drifted: the producers
 * emit keys the renderer never declared, and one `doc_shell` commit bent the
 * *producer* to match the TypeScript, inverting which side is authoritative.
 *
 * It also has two producers that do not emit the same keys, which nothing
 * recorded anywhere. Both are held against the types here, so the contract is
 * the intersection-plus-optionals it actually is rather than whichever producer
 * someone last looked at.
 */

// The fixtures' `satisfies` catches a key a producer emits and we never
// declared. These lists catch the opposite drift — a key we declare as required
// that a producer does not send — which type-checking alone cannot see.
const required = {
  navigation: ["id", "title", "path"] satisfies (keyof NavigationItem)[],
  search: ["id", "title", "content", "path", "audience", "locale"] satisfies (keyof SearchEntry)[],
  ast: ["tag"] satisfies (keyof DocAstElement)[],
}

const optional = {
  navigation: ["children", "kind", "meta"] satisfies (keyof NavigationItem)[],
  search: ["kind", "tokens"] satisfies (keyof SearchEntry)[],
  ast: ["attrs", "content", "meta"] satisfies (keyof DocAstElement)[],
}

const keysIn = (values: object[]) => [...new Set(values.flatMap((value) => Object.keys(value)))]

const astElements = (content: Record<string, unknown[]>): DocAstElement[] =>
  Object.values(content)
    .flat()
    .filter((node): node is DocAstElement => typeof node === "object" && node !== null)

const producers = [
  {
    name: "doc_shell 0.5 StaticGenerator",
    presentation: presentationFixture,
    version: "doc-shell/v1",
  },
  { name: "host GraphProjector", presentation: graphProjectorFixture, version: "doc-shell/v1" },
  {
    name: "doc_shell 1.0 StaticGenerator",
    presentation: presentationV2Fixture,
    version: "doc-shell/v2",
  },
]

// Public producer fixture at futhr/doc_shell@493e7e9399e72095a8efa684b32da9aa08443df8.
// Preserve its bytes; v2 keeps member references in navigation and member bodies upstream.
it("retains the exact DocShell 1.0 producer fixture", () => {
  const bytes = readFileSync(`${import.meta.dirname}/fixtures/doc-shell-v2.json`)
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "cc36b884d7b978a57b24c50bd1cd08e19835b3cfd72acffb8855fb148c98c17a",
  )
  const members = presentationV2Fixture.navigation[1]?.meta.members
  expect(members).toEqual([
    { id: "function:run/1", title: "run/1", anchor: "run/1", kind: "function" },
    { id: "type:t/0", title: "t/0", anchor: "t:t/0", kind: "type" },
  ])
})

describe.each(producers)("$name emits its declared contract", ({ presentation, version }) => {
  it("is a versioned presentation with entries to check", () => {
    expect(presentation.schema_version).toBe(version)
    expect(presentation.navigation.length).toBeGreaterThan(0)
    expect(presentation.search.length).toBeGreaterThan(0)
  })

  it("sends every required navigation key, and nothing undeclared", () => {
    const keys = keysIn(presentation.navigation)

    expect(keys).toEqual(expect.arrayContaining(required.navigation))
    for (const key of keys) {
      expect([...required.navigation, ...optional.navigation]).toContain(key)
    }
  })

  it("sends every required search key, and nothing undeclared", () => {
    const keys = keysIn(presentation.search)

    expect(keys).toEqual(expect.arrayContaining(required.search))
    for (const key of keys) {
      expect([...required.search, ...optional.search]).toContain(key)
    }
  })

  it("sends every required AST key, and nothing undeclared", () => {
    const elements = astElements(presentation.content)
    const keys = keysIn(elements)

    expect(elements.length).toBeGreaterThan(0)
    expect(keys).toEqual(expect.arrayContaining(required.ast))
    for (const key of keys) {
      expect([...required.ast, ...optional.ast]).toContain(key)
    }
  })
})

describe("where the producers differ", () => {
  it("keeps kind, meta, and tokens optional — only StaticGenerator sends them", () => {
    expect(presentationFixture.search[0]).toHaveProperty("tokens")
    expect(presentationFixture.navigation[0]).toHaveProperty("kind")
    expect(graphProjectorFixture.search[0]).not.toHaveProperty("tokens")
    expect(graphProjectorFixture.navigation[0]).not.toHaveProperty("kind")
  })

  // Both producers always send the keys; StaticGenerator sends null when the
  // entry has no facet, so `audience?: string` would reject its every entry.
  it("types audience and locale as nullable rather than optional", () => {
    expect(presentationFixture.search[0]?.audience).toBeNull()
    expect(graphProjectorFixture.search[0]?.audience).toBe("developer")
  })
})
