import { describe, expect, it } from "vitest"
import manifest from "../package.json" with { type: "json" }
import { docShellAssetBudgets, rendererCapabilities } from "../src/capabilities.js"
import type { DocShellSite } from "../src/types.js"

const fixture = {
  schema_version: "doc-shell-site/v1",
  generation_id: "generation-1",
  cohort_digest: `sha256:${"a".repeat(64)}`,
  profile: "public",
  title: "Example documentation",
  base_path: "/docs",
  default_locale: "en",
  locales: ["en"],
  pages: {
    guide: {
      id: "guide",
      collection_id: "example",
      document_id: "guide",
      kind: "guide",
      route: "/docs/guide/",
      title: "Guide",
      locale: "en",
      template: "document",
      content: [{ tag: "h2", attrs: { id: "start" }, content: ["Start"] }],
      content_digest: `sha256:${"b".repeat(64)}`,
      source_revision: "abc123",
      package_version: "1.0.0",
      breadcrumbs: [{ title: "Docs", path: "/docs/guide/" }],
      headings: [{ id: "start", title: "Start", level: 2 }],
      tags: [],
      metadata: {},
      "navigation?": true,
      "search?": true,
      requirements: [
        {
          feature_id: "doc-shell/html/v1",
          acceptable_states: ["fallback"],
          "essential?": true,
        },
      ],
    },
  },
  routes: { "/docs/guide/": "guide" },
  navigation: [{ id: "guide", title: "Guide", path: "/docs/guide/", children: [] }],
  search: [
    {
      id: "guide:start",
      page_id: "guide",
      route: "/docs/guide/#start",
      title: "Guide",
      text: "Start",
      locale: "en",
      kind: "guide",
      collection: "example",
      version: "1.0.0",
      tags: [],
    },
  ],
  redirects: {},
  metadata: {},
} satisfies DocShellSite

describe("doc-shell-site/v1 consumer contract", () => {
  it("keeps Elixir predicate field names exactly as serialized", () => {
    expect(fixture.pages.guide["navigation?"]).toBe(true)
    expect(fixture.pages.guide.requirements[0]?.["essential?"]).toBe(true)
    expect(Object.keys(fixture.pages.guide)).not.toContain("navigation")
  })

  it("declares bounded local renderer capabilities and assets", () => {
    expect(rendererCapabilities.renderer_version).toBe(manifest.version)
    expect(rendererCapabilities.schema_version).toBe("doc-shell-renderer-capabilities/v1")
    expect(rendererCapabilities.output_modes).toContain("static")
    expect(rendererCapabilities.features["doc-shell/mermaid/v1"].states).toContain("fallback")
    expect(docShellAssetBudgets.browser.raw).toBeLessThanOrEqual(49_152)
    expect(docShellAssetBudgets.mermaid.raw).toBeLessThanOrEqual(2_097_152)
  })
})
