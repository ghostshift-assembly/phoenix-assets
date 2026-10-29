import { flushSync, mount, tick, unmount } from "svelte"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ApiReference from "../src/api-reference.svelte"
import DocShell from "../src/doc-shell.svelte"
import Search from "../src/search.svelte"
import Sidebar from "../src/sidebar.svelte"
import SiteShell from "../src/site-shell.svelte"
import type { DocShellPresentation, DocShellSite, SearchEntry } from "../src/types.js"
import presentationV2Fixture from "./fixtures/doc-shell-v2.json"
import apiFixture from "./fixtures/openapi.json"
import projectedSite from "./fixtures/projected-site.json"

const site = projectedSite as DocShellSite
const mounted: Array<ReturnType<typeof mount>> = []
const frames: number[] = []

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

function openSearch(search: (query: string) => SearchEntry[] | Promise<SearchEntry[]>) {
  const element = target()
  const component = mount(Search, { target: element, props: { entries: [], search } })
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
