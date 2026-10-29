import type { ResolvedConfig } from "vite"
import { describe, expect, it } from "vitest"
import { resolveOptions } from "../src/options"

function cfg(root: string, command: "serve" | "build"): ResolvedConfig {
  return { root, command } as unknown as ResolvedConfig
}

describe("resolveOptions", () => {
  it("applies defaults for app mode on a dev server", () => {
    const o = resolveOptions({}, cfg("/app", "serve"))

    expect(o.mode).toBe("app")
    expect(o.root).toBe("/app")
    expect(o.generatedDir).toBe("src/lib/generated")
    expect(o.gettextDir).toBe("../priv/gettext")
    expect(o.graphOut).toBe("../priv/phoenix_assets/graph.json")
    expect(o.emitGraph).toBe(false)
    expect(o.devClient).toBe(true)
    expect(o.virtualPrefix).toBe("$phoenix")
  })

  it("honours explicit overrides", () => {
    const o = resolveOptions(
      {
        mode: "storybook",
        generatedDir: "gen",
        gettextDir: "gt",
        graphOut: "g.json",
        emitGraph: true,
        devClient: false,
        virtualPrefix: "$x",
      },
      cfg("/r", "build"),
    )

    expect(o.mode).toBe("storybook")
    expect(o.generatedDir).toBe("gen")
    expect(o.gettextDir).toBe("gt")
    expect(o.graphOut).toBe("g.json")
    expect(o.emitGraph).toBe(true)
    expect(o.devClient).toBe(false)
    expect(o.virtualPrefix).toBe("$x")
  })

  it("defaults devClient from the Vite command", () => {
    expect(resolveOptions({}, cfg("/r", "build")).devClient).toBe(false)
    expect(resolveOptions({}, cfg("/r", "serve")).devClient).toBe(true)
  })
})
