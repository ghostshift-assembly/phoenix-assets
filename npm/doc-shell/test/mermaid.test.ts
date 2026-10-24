import { describe, expect, it } from "vitest"
import { admitMermaidSource, renderMermaid } from "../src/mermaid.js"

describe("local diagram resource policy", () => {
  it.each([
    'flowchart LR; A@{ img: "https://tracker.invalid/pixel" }',
    'flowchart LR; A@{ icon: "remote:logo" }',
    'flowchart LR; A[<img src="https://tracker.invalid/pixel">]',
    '%%{init: {securityLevel: "loose"}}%%\nflowchart LR; A-->B',
    '---\nconfig:\n  themeCSS: "@import url(remote)"\n---\nflowchart LR; A-->B',
  ])("refuses resource or configuration extensions before loading Mermaid", async (source) => {
    await expect(renderMermaid(source)).rejects.toThrow(/local resource policy/)
  })

  it("admits ordinary diagram text and bounds enhancement work", () => {
    expect(() => admitMermaidSource("flowchart LR; A[Start]-->B[Done]")).not.toThrow()
    expect(() => admitMermaidSource("a".repeat(50001))).toThrow(/local resource policy/)
  })
})
