import manifest from "../package.json" with { type: "json" }

export const rendererCapabilities = {
  schema_version: "doc-shell-renderer-capabilities/v1",
  renderer_id: "phoenix-assets-svelte",
  renderer_version: manifest.version,
  output_modes: ["hosted", "static"],
  features: {
    "doc-shell/html/v1": { states: ["fallback", "enhanced"], runtime: [] },
    "doc-shell/search/v1": { states: ["fallback", "enhanced"], runtime: ["browser_js"] },
    "doc-shell/theme/v1": { states: ["fallback", "enhanced"], runtime: ["browser_js"] },
    "doc-shell/navigation/v1": { states: ["fallback", "enhanced"], runtime: ["browser_js"] },
    "doc-shell/copy/v1": { states: ["fallback", "enhanced"], runtime: ["browser_js"] },
    "doc-shell/tabs/v1": { states: ["fallback", "enhanced"], runtime: ["browser_js"] },
    "doc-shell/highlight/v1": { states: ["fallback", "enhanced"], runtime: ["browser_js"] },
    "doc-shell/mermaid/v1": { states: ["fallback", "enhanced"], runtime: ["browser_js"] },
  },
} as const

export const docShellAssetBudgets = {
  browser: { raw: 49_152, gzip: 16_384 },
  css: { raw: 49_152, gzip: 12_288 },
  search: { raw: 65_536, gzip: 20_480 },
  highlight: { raw: 196_608, gzip: 65_536 },
  mermaid: { raw: 2_097_152, gzip: 655_360 },
  request: { raw: 32_768, gzip: 12_288 },
} as const
