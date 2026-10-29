import { describe, expect, it } from "vitest"
import {
  admitNavigationPresentation,
  admitPagePresentation,
  pageMetadata,
} from "../src/page-presentation.js"
import type { SitePage } from "../src/types.js"
import fixture from "./fixtures/projected-site.json"

const page = fixture.pages["anchors:guide"] as SitePage

describe("upstream page presentation records", () => {
  it("admits complete records and preserves explicit SEO precedence", () => {
    const decorated: SitePage = {
      ...page,
      banner: { label: "Preview", text: "Current release", href: "/stable/" },
      hero: {
        title: "Start here",
        tagline: "Documentation",
        description: "Read more",
        actions: [{ label: "Read", href: "/guide/" }],
        image: { asset: "hero.svg", alt: "Overview" },
      },
      metadata: { seo: { description: "Page SEO", image: "/page.png", robots: ["noindex"] } },
    }
    expect(() => admitPagePresentation(decorated)).not.toThrow()
    expect(
      pageMetadata(decorated, { metadata: { description: "Site", image: "/site.png" } }),
    ).toEqual({ description: "Page SEO", image: "/page.png", robots: ["noindex"] })
    expect(
      pageMetadata(
        { ...page, description: "Page", metadata: {} },
        { metadata: { description: "Site" } },
      ).description,
    ).toBe("Page")
    expect(pageMetadata(undefined, { metadata: { description: "Site" } }).description).toBe("Site")
    expect(pageMetadata(undefined, {})).toEqual({ description: undefined })
    expect(() =>
      admitPagePresentation({ ...page, hero: { title: "Title" }, banner: { text: "Text" } }),
    ).not.toThrow()
  })

  it("rejects malformed and executable decoration fields before rendering", () => {
    for (const value of [
      { banner: {} },
      { banner: { label: 1 } },
      { banner: { text: "" } },
      { banner: { label: "Notice", href: "javascript:bad" } },
      { hero: {} },
      { hero: { title: "Title", component: "Host" } },
      { hero: { title: "Title", tagline: false } },
      { hero: { title: "Title", description: "x".repeat(4097) } },
      { hero: { title: "Title", actions: [{ label: "Read", href: "//other.invalid" }] } },
      { hero: { title: "Title", image: { asset: "../hero.svg", alt: "Hero" } } },
      { metadata: { seo: { robots: ["index", "noindex"] } } },
    ])
      expect(() => admitPagePresentation({ ...page, ...value } as SitePage)).toThrow("DocShell")
  })

  it("validates reserved navigation metadata while preserving opaque host fields", () => {
    expect(() =>
      admitNavigationPresentation([
        {
          id: "group",
          title: "Group",
          path: "",
          meta: { badge: "Preview", collapsed: false, host: [1, false] },
          children: [{ id: "leaf", title: "Leaf", path: "/guide/", meta: { badge: "New" } }],
        },
      ]),
    ).not.toThrow()
    for (const meta of [
      { badge: 1 },
      { badge: "" },
      { badge: "x".repeat(257) },
      { collapsed: "yes" },
      { collapsed: null },
    ]) {
      expect(() =>
        admitNavigationPresentation([{ id: "group", title: "Group", path: "", meta }]),
      ).toThrow("navigation presentation")
    }
    expect(() =>
      admitNavigationPresentation([
        { id: "leaf", title: "Leaf", path: "/guide/", meta: { collapsed: true } },
      ]),
    ).toThrow("navigation presentation")
  })
})
