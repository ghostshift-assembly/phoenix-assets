import { describe, expect, it } from "vitest"
import { admitPresentation, presentationLabel } from "../src/presentation.js"

describe("upstream inert presentation settings", () => {
  it("preserves defaults and valid data without introducing route or translation policy", () => {
    expect(admitPresentation(undefined)).toEqual({})
    expect(admitPresentation({})).toEqual({})
    const settings = {
      brand: { label: "Example", href: "/docs/", logo: { asset: "brand/logo.svg", alt: "" } },
      footer: { text: "Docs", links: [{ label: "Support", href: "https://example.invalid/help" }] },
      labels: { search: "Sök 😀" },
      locales: [{ id: "sv", label: "Svenska", href: "/sv/", current: true }],
      releases: [{ id: "v1", label: "Version 1", href: "/v1/" }],
      metadata: { description: "Docs", image: "/preview.png", robots: ["noindex", "nofollow"] },
      robots: { allow: ["/docs/"], disallow: ["/drafts/"] },
    }
    expect(admitPresentation(settings)).toBe(settings)
    expect(presentationLabel(settings, "search", "Search")).toBe("Sök 😀")
    expect(presentationLabel(settings, "missing", "Default")).toBe("Default")
    expect(
      admitPresentation({ footer: {}, metadata: {}, robots: {}, locales: [], labels: {} }),
    ).toBeTruthy()
  })

  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "//other.invalid",
    "relative",
    "https://user:pass@example.invalid",
    "/a\nb",
    "/a\\b",
    "http://[",
    "\ud800",
  ])("refuses unsafe destination %s", (href) => {
    expect(() => admitPresentation({ brand: { label: "Brand", href } })).toThrow("Invalid DocShell")
  })

  it("rejects malformed structures, ambiguous selectors and finite limit violations", () => {
    const choice = { id: "en", label: "English", href: "/", current: true }
    for (const value of [
      null,
      new Date(),
      { labels: new Date() },
      [],
      false,
      { unknown: true },
      { brand: {} },
      { footer: { html: "<script>" } },
      { footer: { links: [null] } },
      { labels: { search: () => "no" } },
      { labels: [] },
      { labels: { search: "x".repeat(4097) } },
      { labels: Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`key${i}`, "label"])) },
      { locales: [choice, choice] },
      { releases: [choice, { ...choice, id: "other" }] },
      { locales: [{ ...choice, current: "yes" }] },
      { locales: null },
      { metadata: { robots: ["index", "noindex"] } },
      { metadata: { robots: ["follow", "nofollow"] } },
      { metadata: { robots: ["index", "index"] } },
      { metadata: { robots: ["invented"] } },
      { robots: { disallow: ["https://example.invalid/"] } },
      { robots: { allow: ["/docs/?query"] } },
      { footer: { links: Array.from({ length: 65 }, () => ({ label: "Docs", href: "/" })) } },
      { brand: { label: "Brand", href: "/", logo: { asset: "../logo.svg", alt: "Logo" } } },
      { brand: { label: "Brand", href: "/", logo: { asset: "/logo.svg", alt: "Logo" } } },
    ])
      expect(() => admitPresentation(value)).toThrow("Invalid DocShell")
  })
})
