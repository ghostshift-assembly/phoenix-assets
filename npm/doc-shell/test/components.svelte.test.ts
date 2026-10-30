import { createRawSnippet, flushSync, mount, tick, unmount } from "svelte"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ApiReference from "../src/api-reference.svelte"
import { jsonDigest, jsonProof } from "../src/artifact-json.js"
import DocShell from "../src/doc-shell.svelte"
import HostedReference from "../src/hosted-reference.svelte"
import Search from "../src/search.svelte"
import Sidebar from "../src/sidebar.svelte"
import SiteShell from "../src/site-shell.svelte"
import type {
  DocShellPresentation,
  DocShellSite,
  PublicationBinding,
  SearchEntry,
} from "../src/types.js"
import presentationV2Fixture from "./fixtures/doc-shell-v2.json"
import hostedFixture from "./fixtures/hosted-pair-v1.json"
import apiFixture from "./fixtures/openapi.json"
import projectedSite from "./fixtures/projected-site.json"

const site = projectedSite as DocShellSite
const mounted: Array<ReturnType<typeof mount>> = []
const frames: number[] = []

describe("hosted publication consumption", () => {
  it("renders matching narrative and OpenAPI from the upstream fixture", () => {
    const element = target()
    const expected = hostedFixture.binding as PublicationBinding
    mounted.push(
      mount(HostedReference, {
        target: element,
        props: {
          expected,
          currentId: "intro",
          presentation: {
            ...hostedFixture.presentation,
            schema_version: "doc-shell/v2",
            publication: expected,
          },
          openapi: { ...hostedFixture.openapi, "x-doc-shell-publication": expected },
        },
      }),
    )
    flushSync()
    expect(
      element.querySelector("[data-doc-publication]")?.getAttribute("data-doc-publication"),
    ).toBe("snapshot-1")
    expect(element.querySelector("article")?.textContent).toBe("Public documentation")
    expect(element.querySelector(".api-reference")?.textContent).toContain("Public API")
  })

  it("refuses a cross-surface API before either input reaches the DOM", () => {
    const element = target()
    const expected = hostedFixture.binding as PublicationBinding
    expect(() =>
      mount(HostedReference, {
        target: element,
        props: {
          expected,
          currentId: "intro",
          presentation: {
            ...hostedFixture.presentation,
            schema_version: "doc-shell/v2",
            publication: expected,
          },
          openapi: {
            ...hostedFixture.openapi,
            info: { title: "Private API" },
            "x-doc-shell-publication": { ...expected, disclosure_surface: "internal" },
          },
        },
      }),
    ).toThrow("openapi.disclosure_surface")
    expect(element.textContent).toBe("")
    expect(element.querySelector("article")).toBeNull()
  })
})

function target(): HTMLDivElement {
  const element = document.createElement("div")
  document.body.append(element)
  return element
}

beforeEach(() => {
  localStorage.clear()
  const request = window.requestAnimationFrame.bind(window)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const frame = request(callback)
    frames.push(frame)
    return frame
  })
})

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component)
  for (const frame of frames.splice(0)) window.cancelAnimationFrame(frame)
  document.body.replaceChildren()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function assertControls(root: HTMLElement): void {
  const dark = root.querySelector<HTMLButtonElement>('[data-doc-theme-value="dark"]')
  expect(dark).not.toBeNull()
  dark?.click()
  expect(root.dataset.docTheme).toBe("dark")

  const toggle = root.querySelector<HTMLButtonElement>("[data-doc-nav-toggle]")
  toggle?.click()
  expect(toggle?.getAttribute("aria-expanded")).toBe("true")
  expect(root.querySelector<HTMLElement>("[data-doc-nav]")?.dataset.docNavState).toBe("open")
}

describe("rendered heading targets", () => {
  it("opens the current route's navigation group without empty links or nested landmarks", () => {
    const element = target()
    mounted.push(
      mount(Sidebar, {
        target: element,
        props: {
          items: [
            {
              id: "group",
              title: "Reading",
              path: "",
              children: [{ id: "guide", title: "Guide", path: "/guide/", children: [] }],
            },
          ],
          currentPath: "/guide/",
        },
      }),
    )
    flushSync()
    expect(element.querySelector("details")?.open).toBe(true)
    expect(element.querySelector("summary")?.textContent).toBe("Reading")
    expect(element.querySelectorAll('nav[aria-label="Documentation"]')).toHaveLength(1)
    expect(element.querySelector('a[href=""]')).toBeNull()
    expect(element.querySelector('[aria-current="page"]')?.textContent).toBe("Guide")
  })

  it("keeps every API operation and its ordinary anchor readable without selecting a panel", () => {
    const element = target()
    mounted.push(mount(ApiReference, { target: element, props: { spec: apiFixture } }))
    flushSync()

    expect(
      [...element.querySelectorAll(".operations h3")].map((heading) => heading.textContent),
    ).toEqual(["Health check", "List things", "Create thing"])
    expect(element.querySelectorAll(".operations article")).toHaveLength(3)
    expect(element.querySelectorAll("main")).toHaveLength(0)
    for (const link of element.querySelectorAll<HTMLAnchorElement>(
      'nav[aria-label="API operations"] a',
    )) {
      const id = link.getAttribute("href")?.slice(1)
      expect(element.querySelector<HTMLElement>(`[id="${id}"]`)?.hidden).not.toBe(true)
      expect(element.querySelector(`[id="${id}"]`)).not.toBeNull()
    }
    expect(element.textContent).toContain("Read the admitted collection without changing it.")
    expect([...element.querySelectorAll("summary")].map((node) => node.textContent)).toContain(
      "Complete admitted OpenAPI JSON",
    )
    expect(element.textContent).toContain("queryThings")
  })

  it("renders the public DocShell 1.0 presentation without expanding member references", () => {
    const element = target()
    const presentation = {
      ...presentationV2Fixture,
      schema_version: "doc-shell/v2",
    } satisfies DocShellPresentation
    mounted.push(
      mount(DocShell, {
        target: element,
        props: { presentation, currentId: "Example", currentPath: "/docs/module/Example" },
      }),
    )
    flushSync()

    expect(
      element.querySelector("[data-schema-version]")?.getAttribute("data-schema-version"),
    ).toBe("doc-shell/v2")
    expect(element.querySelector("main")?.textContent).toContain("unbreakable")
    expect(element.querySelector('a[href="/docs/module/Example"]')).not.toBeNull()
  })

  it("keeps legacy DocShell table-of-contents links attached to rendered headings", () => {
    const element = target()
    mounted.push(
      mount(DocShell, {
        target: element,
        props: {
          currentId: "guide",
          currentPath: "/guide",
          presentation: {
            schema_version: "doc-shell/v1",
            navigation: [],
            search: [],
            content: { guide: [{ tag: "h2", content: ["Hello World"] }] },
          },
        },
      }),
    )
    flushSync()

    const link = element.querySelector<HTMLAnchorElement>('.toc a[href="#hello-world"]')
    expect(link).not.toBeNull()
    expect(element.querySelector("main h2")?.id).toBe(link?.hash.slice(1))
  })

  it("renders every upstream-projected heading, TOC target and search route without recomputation", () => {
    const element = target()
    mounted.push(mount(SiteShell, { target: element, props: { site, pageId: "anchors:guide" } }))
    flushSync()

    const page = site.pages["anchors:guide"]
    expect(page).toBeDefined()
    expect([...element.querySelectorAll("article h2")].map((heading) => heading.id)).toEqual(
      page?.headings.map((heading) => heading.id),
    )
    for (const heading of page?.headings ?? []) {
      const link = element.querySelector<HTMLAnchorElement>(`.toc a[href="#${heading.id}"]`)
      expect(link).not.toBeNull()
      expect(element.querySelector(`[id="${heading.id}"]`)).not.toBeNull()
      expect(site.search.some((entry) => entry.route.endsWith(`#${heading.id}`))).toBe(true)
    }
  })
})

describe("SiteShell browser controller ownership", () => {
  it("keeps shell controls distinct from authored anchors, including suffix collisions", () => {
    const element = target()
    const page = site.pages["anchors:guide"]
    if (!page) throw new Error("guide fixture missing")
    const anchors = [
      "doc-main",
      "doc-main-1",
      "doc-navigation",
      "doc-search-query",
      "doc-search-results",
      "doc-search-1-query",
    ]
    const content = anchors.map((id) => ({ tag: "span", attrs: { id }, content: [id], meta: {} }))
    const decorated = {
      ...site,
      pages: {
        ...site.pages,
        [page.id]: {
          ...page,
          content,
          content_digest: jsonDigest(jsonProof(content)),
          requirements: [],
        },
      },
    }
    mounted.push(mount(SiteShell, { target: element, props: { site: decorated, pageId: page.id } }))
    flushSync()
    const ids = [...element.querySelectorAll("[id]")].map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const anchor of anchors)
      expect(element.querySelector(`article span[id="${anchor}"]`)?.textContent).toBe(anchor)
    expect(element.querySelector(".skip-link")?.getAttribute("href")).toBe("#doc-main-2")
    expect(element.querySelector("main")?.id).toBe("doc-main-2")
    expect(element.querySelector("[data-doc-nav-toggle]")?.getAttribute("aria-controls")).toBe(
      element.querySelector("[data-doc-nav]")?.id,
    )
    expect(element.querySelector("[data-doc-nav]")?.id).toBe("doc-navigation-1")
    const query = element.querySelector<HTMLInputElement>("[data-doc-search-input]")
    expect(query?.id).toBe("doc-search-2-query")
    expect(element.querySelector(`label[for="${query?.id}"]`)).not.toBeNull()
    expect(query?.getAttribute("aria-controls")).toBe(
      element.querySelector("[data-doc-search-results]")?.id,
    )
  })
  it("renders splash hero, full banner, navigation metadata and page SEO without requiring controls", () => {
    const element = target()
    const page = site.pages["anchors:guide"]
    if (!page) throw new Error("guide fixture missing")
    const decorated: DocShellSite = {
      ...site,
      presentation: { metadata: { description: "Site default", robots: ["index"] } },
      navigation: [
        {
          id: "section",
          title: "Guides",
          path: "",
          meta: { collapsed: false, badge: "Preview" },
          children: [{ id: page.id, title: "Guide", path: page.route, meta: { badge: "New" } }],
        },
      ],
      pages: {
        ...site.pages,
        [page.id]: {
          ...page,
          template: "splash",
          banner: { label: "Preview", text: "Read the stable release", href: "/stable/" },
          hero: {
            title: "Start here",
            tagline: "Portable documentation",
            description: "Choose a guide",
            actions: [{ label: "Read guide", href: "/guide/" }],
            image: { asset: "hero.svg", alt: "Documentation overview" },
          },
          metadata: { seo: { description: "Page SEO", robots: ["noindex"] } },
        },
      },
    }
    mounted.push(
      mount(SiteShell, {
        target: element,
        props: { site: decorated, pageId: page.id, assetUrls: { "hero.svg": "/local-hero.svg" } },
      }),
    )
    flushSync()
    expect(element.querySelector("main")?.getAttribute("data-doc-template")).toBe("splash")
    expect(element.querySelector(".doc-hero h2")?.textContent).toBe("Start here")
    expect(element.querySelector(".doc-hero img")?.getAttribute("alt")).toBe(
      "Documentation overview",
    )
    expect(element.querySelector(".doc-hero a")?.getAttribute("href")).toBe("/guide/")
    expect(element.querySelector(".doc-announcement a")?.textContent).toContain(
      "Read the stable release",
    )
    expect(element.querySelector(".doc-announcement a")?.getAttribute("href")).toBe("/stable/")
    expect(element.querySelector(".sidebar details")?.hasAttribute("open")).toBe(true)
    expect(element.querySelector(".sidebar summary .pa-status")?.textContent?.trim()).toBe(
      "Preview",
    )
    expect(element.querySelector(".sidebar a .pa-status")?.textContent?.trim()).toBe("New")
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "Page SEO",
    )
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex",
    )
  })

  it("leaves legacy sidebar metadata opaque unless the site profile enables it", () => {
    const element = target()
    mounted.push(
      mount(Sidebar, {
        target: element,
        props: {
          items: [
            {
              id: "group",
              title: "Group",
              path: "",
              meta: { collapsed: false, badge: "Opaque" },
              children: [],
            },
          ],
        },
      }),
    )
    flushSync()
    expect(element.querySelector("details")?.hasAttribute("open")).toBe(false)
    expect(element.textContent).not.toContain("Opaque")
  })

  it("renders host settings as ordinary links, translated controls and a semantic footer", () => {
    const element = target()
    const customized: DocShellSite = {
      ...site,
      presentation: {
        brand: {
          label: "Example brand",
          href: "/brand/",
          logo: { asset: "logo.svg", alt: "Example logo" },
        },
        labels: {
          search: "Sök dokumentation",
          theme_dark: "Mörkt",
          language: "Språk",
          release: "Utgåva",
        },
        locales: [{ id: "sv", label: "Svenska", href: "/sv/", current: true }],
        releases: [{ id: "v2", label: "Version 2", href: "/v2/" }],
        footer: { text: "Example footer", links: [{ label: "Support", href: "/support/" }] },
      },
    }
    mounted.push(
      mount(SiteShell, {
        target: element,
        props: {
          site: customized,
          pageId: "anchors:guide",
          assetUrls: { "logo.svg": "/local-logo.svg" },
        },
      }),
    )
    flushSync()
    expect(element.querySelector("a.brand")?.getAttribute("href")).toBe("/brand/")
    expect(element.querySelector("a.brand img")?.getAttribute("alt")).toBe("Example logo")
    expect(element.querySelector('nav[aria-label="Språk"] a')?.getAttribute("href")).toBe("/sv/")
    expect(element.querySelector('nav[aria-label="Språk"] a')?.getAttribute("aria-current")).toBe(
      "true",
    )
    expect(element.querySelector('nav[aria-label="Utgåva"] a')?.getAttribute("href")).toBe("/v2/")
    expect(element.querySelector("[data-doc-search-open]")?.textContent).toBe("Sök dokumentation")
    expect(element.querySelector('[data-doc-theme-value="dark"]')?.textContent).toBe("Mörkt")
    expect(element.querySelector("footer")?.textContent).toContain("Example footer")
    expect(element.querySelector("footer a")?.getAttribute("href")).toBe("/support/")
  })

  it("keeps settings in the not-found shell", () => {
    const element = target()
    mounted.push(
      mount(SiteShell, {
        target: element,
        props: {
          site: {
            ...site,
            presentation: {
              labels: { not_found: "Sidan saknas", home: "Dokumentation" },
              footer: { text: "Footer" },
            },
          },
          pageId: "missing",
        },
      }),
    )
    flushSync()
    expect(element.querySelector("main h1")?.textContent).toBe("Sidan saknas")
    expect(element.querySelector("main a")?.textContent).toBe("Dokumentation")
    expect(element.querySelector("footer")?.textContent).toBe("Footer")
  })

  it("marks the page's locale when it is among the host's exact destinations", () => {
    const element = target()
    const page = site.pages["anchors:guide"]
    if (!page) throw new Error("guide fixture missing")
    const localized: DocShellSite = {
      ...site,
      locales: ["en", "sv"],
      pages: { ...site.pages, [page.id]: { ...page, locale: "sv" } },
      presentation: {
        locales: [
          { id: "en", label: "English", href: "/en/", current: true },
          { id: "sv", label: "Svenska", href: "/sv/" },
        ],
      },
    }
    mounted.push(mount(SiteShell, { target: element, props: { site: localized, pageId: page.id } }))
    flushSync()
    const choice = element.querySelector('nav[aria-label="Language"] [aria-current="true"]')
    expect(choice?.getAttribute("href")).toBe("/sv/")
  })

  it("allows local brand and footer snippets to replace the inert defaults", () => {
    const element = target()
    const brand = createRawSnippet<[DocShellSite]>(() => ({
      render: () => "<strong data-host-brand>Host brand</strong>",
    }))
    const footer = createRawSnippet<[DocShellSite]>(() => ({
      render: () => "<span data-host-footer>Host footer</span>",
    }))
    mounted.push(
      mount(SiteShell, {
        target: element,
        props: {
          site: {
            ...site,
            presentation: {
              brand: { label: "Default brand", href: "/" },
              footer: { text: "Default footer" },
            },
          },
          pageId: "anchors:guide",
          brand,
          footer,
        },
      }),
    )
    flushSync()
    expect(element.querySelector("[data-host-brand]")?.textContent).toBe("Host brand")
    expect(element.querySelector("footer [data-host-footer]")?.textContent).toBe("Host footer")
    expect(element.textContent).not.toContain("Default brand")
    expect(element.textContent).not.toContain("Default footer")
  })

  it("emits escaped page and site SEO metadata", () => {
    const element = target()
    mounted.push(
      mount(SiteShell, {
        target: element,
        props: {
          site: {
            ...site,
            presentation: {
              metadata: {
                description: 'Example <description> "quoted"',
                image: "/social.png",
                robots: ["noindex", "nofollow"],
              },
            },
          },
          pageId: "missing",
        },
      }),
    )
    flushSync()
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      'Example <description> "quoted"',
    )
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "/social.png",
    )
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, nofollow",
    )
    expect(document.head.querySelector("description")).toBeNull()
  })

  it.each(["ar-SA", "FA-ir", "he-IL", "ur-PK"])("preserves RTL direction for %s", (locale) => {
    const element = target()
    const page = site.pages["anchors:guide"]
    if (!page) throw new Error("guide fixture is absent")
    const localized = { ...site, pages: { ...site.pages, [page.id]: { ...page, locale } } }
    mounted.push(mount(SiteShell, { target: element, props: { site: localized, pageId: page.id } }))
    flushSync()
    expect(element.querySelector("[data-pa-doc-shell]")?.getAttribute("dir")).toBe("rtl")
  })

  it("mounts controllers when a missing page becomes available", () => {
    const element = target()
    const props = $state({ site, pageId: "missing" })
    mounted.push(mount(SiteShell, { target: element, props }))
    flushSync()
    expect(element.textContent).toContain("Page not found")
    expect(
      Array.from(element.querySelectorAll("a"))
        .find((link) => link.textContent === "Documentation home")
        ?.getAttribute("href"),
    ).toBe("/docs/guide/")

    props.pageId = "anchors:guide"
    flushSync()
    expect(element.querySelector("a.brand")?.getAttribute("href")).toBe("/docs/guide/")
    const root = element.querySelector<HTMLElement>(".pa-doc-shell")
    expect(root).not.toBeNull()
    if (root) assertControls(root)
  })

  it("releases the old root and mounts exactly one controller set on its replacement", async () => {
    const element = target()
    const props = $state({ site, pageId: "anchors:guide" })
    const component = mount(SiteShell, { target: element, props })
    mounted.push(component)
    flushSync()
    const oldRoot = element.querySelector<HTMLElement>(".pa-doc-shell")
    expect(oldRoot).not.toBeNull()
    if (oldRoot) assertControls(oldRoot)

    props.pageId = "missing"
    flushSync()
    localStorage.clear()
    oldRoot?.querySelector<HTMLButtonElement>('[data-doc-theme-value="light"]')?.click()
    expect(localStorage.getItem("phoenix-assets:doc-shell:theme")).toBeNull()

    props.pageId = "anchors:guide"
    flushSync()
    const root = element.querySelector<HTMLElement>(".pa-doc-shell")
    expect(root).not.toBe(oldRoot)
    if (root) assertControls(root)

    mounted.splice(mounted.indexOf(component), 1)
    await unmount(component)
    localStorage.clear()
    root?.querySelector<HTMLButtonElement>('[data-doc-theme-value="light"]')?.click()
    expect(localStorage.getItem("phoenix-assets:doc-shell:theme")).toBeNull()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

function result(id: string): SearchEntry {
  return { id, title: id, path: `/docs/${id}/`, content: id, audience: null, locale: null }
}

function openSearch(
  search: (query: string) => SearchEntry[] | Promise<SearchEntry[]>,
  labels: Record<string, string> = {},
) {
  const element = target()
  const component = mount(Search, { target: element, props: { entries: [], search, labels } })
  mounted.push(component)
  flushSync()
  element.querySelector<HTMLButtonElement>("button")?.click()
  flushSync()
  const input = element.querySelector<HTMLInputElement>("input")
  expect(input).not.toBeNull()
  const query = (value: string) => {
    if (input) {
      input.value = value
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    flushSync()
  }
  return { element, component, query }
}

async function settle(): Promise<void> {
  await tick()
  await tick()
  flushSync()
}

describe("custom search lifecycle", () => {
  it("uses translated loading, failure and result status templates", async () => {
    const pending = deferred<SearchEntry[]>()
    const { element, query } = openSearch(
      (value) =>
        value === "pending"
          ? pending.promise
          : value === "empty"
            ? []
            : value === "one"
              ? [result("one")]
              : [result("one"), result("two")],
      {
        search_loading: "Söker",
        search_error: "Försök igen",
        search_empty: "Inga resultat",
        search_result: "{count} träff",
        search_results: "{count} träffar",
        close: "Stäng",
      },
    )
    const status = () => element.querySelector("[data-doc-search-status]")?.textContent
    query("pending")
    await settle()
    expect(status()).toBe("Söker")
    pending.reject(new Error("offline"))
    await settle()
    expect(status()).toBe("Försök igen")
    query("empty")
    await settle()
    expect(status()).toBe("Inga resultat")
    query("one")
    await settle()
    expect(status()).toBe("1 träff")
    query("two")
    await settle()
    expect(status()).toBe("2 träffar")
    expect(element.querySelector("[data-doc-search-close]")?.textContent).toBe("Stäng")
  })

  it("keeps newer results when an older query resolves later", async () => {
    const old = deferred<SearchEntry[]>()
    const current = deferred<SearchEntry[]>()
    const search = vi.fn((query: string) => (query === "old" ? old.promise : current.promise))
    const { element, query } = openSearch(search)
    query("old")
    await settle()
    query("current")
    await settle()
    expect(search.mock.calls.map(([value]) => value)).toEqual(["old", "current"])

    current.resolve([result("current")])
    await settle()
    expect(element.querySelector("[role=listbox] a")?.firstChild?.textContent).toBe("current")
    old.resolve([result("old")])
    await settle()
    expect(element.querySelector("[role=listbox] a")?.firstChild?.textContent).toBe("current")
  })

  it("clears results below the minimum query length and ignores pending old work", async () => {
    const pending = deferred<SearchEntry[]>()
    const { element, query } = openSearch((value) =>
      value === "pending" ? pending.promise : [result("visible")],
    )
    query("visible")
    await settle()
    expect(element.querySelectorAll("[role=option]")).toHaveLength(1)
    query("pending")
    query("x")
    expect(element.querySelectorAll("[role=option]")).toHaveLength(0)
    pending.resolve([result("late")])
    await settle()
    expect(element.querySelectorAll("[role=option]")).toHaveLength(0)
  })

  it("handles a failed callback without leaving old results and can recover", async () => {
    const search = vi.fn((value: string) =>
      value === "failed" ? Promise.reject(new Error("search unavailable")) : [result(value)],
    )
    const { element, query } = openSearch(search)
    query("visible")
    await settle()
    expect(element.querySelectorAll("[role=option]")).toHaveLength(1)
    query("failed")
    await settle()
    expect(element.querySelectorAll("[role=option]")).toHaveLength(0)
    query("recovered")
    await settle()
    expect(element.querySelector("[role=listbox] a")?.firstChild?.textContent).toBe("recovered")
  })

  it("disposes a pending callback when unmounted", async () => {
    const pending = deferred<SearchEntry[]>()
    const { element, component, query } = openSearch(() => pending.promise)
    query("pending")
    mounted.splice(mounted.indexOf(component), 1)
    await unmount(component)
    pending.reject(new Error("disposed search"))
    await settle()
    expect(element.children).toHaveLength(0)
  })
})
