import { describe, expect, it } from "vitest"
import { virtualModulesPlugin } from "../src/virtual-modules"

type Hook = (...args: unknown[]) => unknown

function hook(value: unknown): Hook {
  return (typeof value === "function" ? value : (value as { handler: Hook }).handler) as Hook
}

function setup() {
  const plugin = virtualModulesPlugin({ generatedDir: "src/generated" })
  hook(plugin.configResolved).call({}, { root: "/tmp/app", command: "serve" })
  return plugin
}

describe("virtual modules", () => {
  it("resolves $phoenix/* ids to the internal namespace", () => {
    const resolveId = hook(setup().resolveId)

    expect(resolveId.call({}, "$phoenix/routes")).toBe("\0phoenix-assets:routes")
    expect(resolveId.call({}, "$phoenix/types")).toBe("\0phoenix-assets:types")
    expect(resolveId.call({}, "$phoenix/localize")).toBe("\0phoenix-assets:localize")
    expect(resolveId.call({}, "$phoenix/locales")).toBe("\0phoenix-assets:locales")
    expect(resolveId.call({}, "$phoenix/toString")).toBeNull()
    expect(resolveId.call({}, "react")).toBeNull()
  })

  it("transpiles the typed stub and warns when the generated file is missing", async () => {
    const load = hook(setup().load)
    const warnings: string[] = []
    const ctx = { addWatchFile: () => undefined, warn: (message: string) => warnings.push(message) }

    const output = (await load.call(ctx, "\0phoenix-assets:routes")) as { code: string }

    expect(output.code).toContain("export const routes")
    expect(output.code).not.toContain("export type")
    expect(warnings).toHaveLength(1)
  })

  it("ignores ids outside the resolved namespace", async () => {
    expect(await hook(setup().load).call({}, "some-other-module")).toBeNull()
  })
})

it.each(["commands", "session"])("resolves and supplies a first-boot stub for %s", async (name) => {
  const plugin = setup()
  const resolved = hook(plugin.resolveId).call({}, `$phoenix/${name}`)
  expect(resolved).toBe(`\0phoenix-assets:${name}`)
  const output = (await hook(plugin.load).call(
    { addWatchFile: () => {}, warn: () => {} },
    resolved,
  )) as {
    code: string
  }
  expect(output.code).toContain(
    name === "session" ? "export const sessionFields" : "export const commands",
  )
})

it("does not load inherited registry entries", async () => {
  expect(await hook(setup().load).call({}, "\0phoenix-assets:constructor")).toBeNull()
})
