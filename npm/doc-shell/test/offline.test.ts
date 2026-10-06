import { describe, expect, it } from "vitest"
import { hasNetworkAssetReference } from "../scripts/network-assets.mjs"

describe("offline source check", () => {
  it.each([
    'const source_url = "https://example.test/source"',
    'const base = "http://localhost/"',
    '<a href="https://example.test/docs">Documentation</a>',
    'import mermaid from "mermaid"',
    '<link rel="stylesheet" href="/assets/docs.css">',
    "fetch(request.url)",
  ])("allows navigation, host requests, and local assets: %s", (source) => {
    expect(hasNetworkAssetReference(source)).toBe(false)
  })

  it.each([
    'import "https://cdn.example.test/module.js"',
    'export { highlighter } from "https://cdn.example.test/module.js"',
    'import(\n  "https://cdn.example.test/module.js"\n)',
    'fetch("https://cdn.example.test/theme.json")',
    'new Worker("https://cdn.example.test/worker.js")',
    '<script src="https://cdn.example.test/module.js"></script>',
    '<link href="//cdn.example.test/style.css" rel="stylesheet">',
    "<img src=https://cdn.example.test/image.png>",
    'background: url("https://cdn.example.test/font.woff2")',
    '@import "https://cdn.example.test/style.css";',
  ])("rejects direct network asset references: %s", (source) => {
    expect(hasNetworkAssetReference(source)).toBe(true)
  })
})
