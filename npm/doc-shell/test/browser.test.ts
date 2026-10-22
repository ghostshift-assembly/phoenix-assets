import { afterEach, describe, expect, it, vi } from "vitest"
import {
  admitPagefindContract,
  admitRequest,
  applyTheme,
  createContractPagefindSearch,
  createPagefindSearch,
  mountBrowserCore,
  mountBrowserCoreOnReady,
  mountSearch,
  PhoenixAssetsDocShell,
  querySearchRecords,
  readTheme,
} from "../src/browser/index.js"
import type { SearchRecord } from "../src/browser/types.js"

const records: SearchRecord[] = [
  {
    id: "guide:intro",
    page_id: "guide",
    route: "/docs/guide/#intro",
    title: "Portable guide",
    section: "Introduction",
    text: "Build static documentation",
    locale: "en",
    audience: "public",
    kind: "guide",
    collection: "phoenix-assets",
    version: "1.1.1",
    tags: ["renderer"],
    status: "stable",
  },
  {
    id: "api:list",
    page_id: "api",
    route: "/docs/api/",
    title: "API reference",
    text: "List resources",
    locale: "sv",
    audience: ["public", "operator"],
    kind: "openapi",
    collection: "example-api",
    version: "2.0.0",
    tags: ["http"],
  },
]

const encodedRecords = (value: SearchRecord[] = records) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_")
}

const encodedContract = (contract: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(contract))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_")
}

const fixture = () => {
  const root = document.createElement("div")
  root.innerHTML = `
    <button data-doc-theme-value="dark">Dark</button>
    <button data-doc-nav-toggle aria-controls="navigation" aria-expanded="false">Browse</button>
    <aside id="navigation" data-doc-nav>Navigation</aside>
    <button data-doc-search-open>Search</button>
    <dialog data-doc-search-dialog data-doc-search-records="${encodedRecords()}">
      <button data-doc-search-close>Close</button>
      <input data-doc-search-input>
      <select data-doc-search-filter="locale"><option value=""></option><option value="en">en</option></select>
      <p role="status" data-doc-search-status></p>
      <ul data-doc-search-results></ul>
    </dialog>
    <div data-doc-code><button data-doc-copy="code">Copy</button><code id="code">mix test</code></div>
    <div role="tablist" aria-label="Examples">
      <button role="tab" aria-selected="true" aria-controls="one">One</button>
      <button role="tab" aria-selected="false" aria-controls="two">Two</button>
    </div>
    <section id="one" role="tabpanel">First</section><section id="two" role="tabpanel">Second</section>
  `
  document.body.append(root)
  return root
}

afterEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("deterministic browser search", () => {
  it("matches DocShell weighting, stable ordering, and public filters", () => {
    expect(querySearchRecords(records, "guide").map((record) => record.id)).toEqual(["guide:intro"])
    expect(querySearchRecords(records, "", { audience: "operator" })).toEqual([records[1]])
    expect(querySearchRecords(records, "", { tag: "renderer", locale: "en" })).toEqual([records[0]])
    expect(querySearchRecords(records, "resources", {}, 1)).toEqual([records[1]])
  })

  it("does not load Pagefind until the first query and forwards filters", async () => {
    const data = vi.fn().mockResolvedValue({ url: "/docs/guide/", meta: {}, excerpt: "guide" })
    const search = vi.fn().mockResolvedValue({ results: [{ data }] })
    const load = vi.fn().mockResolvedValue({ search })
    const pagefind = createPagefindSearch(load)

    expect(load).not.toHaveBeenCalled()
    await expect(pagefind("guide", { collection: "phoenix-assets" })).resolves.toHaveLength(1)
    expect(load).toHaveBeenCalledOnce()
    expect(search).toHaveBeenCalledWith("guide", {
      filters: { collection: "phoenix-assets" },
    })
    await pagefind("api")
    expect(load).toHaveBeenCalledOnce()
  })

  it("admits only an exact same-origin Pagefind contract", async () => {
    const contract = {
      schema_version: "doc-shell-search-query/v1",
      algorithm: "pagefind/v1",
      path: "/docs/pagefind/pagefind.js",
    }
    expect(admitPagefindContract(contract, "https://docs.example.test")).toEqual(contract)
    expect(
      admitPagefindContract({ ...contract, path: "https://other.example/pagefind.js" }),
    ).toBeUndefined()
    expect(
      admitPagefindContract({ ...contract, path: "//other.example/pagefind.js" }),
    ).toBeUndefined()
    expect(admitPagefindContract({ ...contract, path: "/docs/../pagefind.js" })).toBeUndefined()
    expect(admitPagefindContract({ ...contract, algorithm: "remote/v1" })).toBeUndefined()

    const load = vi.fn().mockResolvedValue({ search: "not-a-function" })
    const search = createContractPagefindSearch(contract, load, "https://docs.example.test")
    await expect(search?.("guide")).rejects.toThrow("Invalid Pagefind browser module")
  })

  it("loads the admitted Pagefind module from the controller only after a query", async () => {
    const root = fixture()
    const dialog = root.querySelector<HTMLDialogElement>("[data-doc-search-dialog]")
    if (!dialog) throw new Error("missing search dialog")
    dialog.dataset.docSearchContract = encodedContract({
      schema_version: "doc-shell-search-query/v1",
      algorithm: "pagefind/v1",
      path: "/docs/pagefind/pagefind.js",
    })
    const data = vi.fn().mockResolvedValue({
      id: "guide:intro",
      url: "/generated/",
      meta: {
        title: "Pagefind guide",
        route: "/docs/guide/",
        section: "Introduction",
        collection: "phoenix-assets",
        version: "1.1.1",
      },
      excerpt: "Portable guide",
    })
    const search = vi.fn().mockResolvedValue({ results: [{ data }] })
    const load = vi.fn().mockResolvedValue({ search })
    const controller = mountSearch(root, load)

    expect(load).not.toHaveBeenCalled()
    const input = root.querySelector<HTMLInputElement>("[data-doc-search-input]")
    if (input) {
      input.value = "portable"
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    await vi.waitFor(() =>
      expect(root.querySelector("[data-doc-search-results]")?.textContent).toContain(
        "Pagefind guide",
      ),
    )
    expect(load).toHaveBeenCalledWith("/docs/pagefind/pagefind.js")
    expect(search).toHaveBeenCalledWith("portable", { filters: {} })
    expect(root.querySelector("[data-doc-search-results] a")?.getAttribute("href")).toBe(
      "/docs/guide/",
    )
    controller.destroy()
  })
})

describe("browser controller lifecycle", () => {
  it("bounds result excerpts and admits only inert mark highlighting", () => {
    const root = fixture()
    const surface = root.querySelector<HTMLElement>("[data-doc-search-dialog]")
    if (!surface) throw new Error("missing search")
    const record = records[0]
    if (!record) throw new Error("missing fixture record")
    surface.dataset.docSearchRecords = encodedRecords([
      {
        ...record,
        text:
          '<mark>static</mark> <img src="https://example.test/x" onerror="alert(1)"> ' +
          "x".repeat(500),
      },
    ])
    const controller = mountSearch(root)
    const input = root.querySelector<HTMLInputElement>("[data-doc-search-input]")
    if (!input) throw new Error("missing input")
    input.value = "portable"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    const excerpt = root.querySelector(".doc-search-excerpt")
    expect(excerpt?.querySelector("mark")?.textContent).toBe("static")
    expect(excerpt?.querySelector("img, script")).toBeNull()
    expect(excerpt?.textContent).toContain('<img src="https://example.test/x"')
    expect(excerpt?.textContent?.length).toBeLessThanOrEqual(321)
    expect(excerpt?.textContent).toMatch(/…$/)
    controller.destroy()
  })

  it("keeps inline navigation usable and scopes result keys to the query", () => {
    const root = fixture()
    const modal = root.querySelector("dialog")
    if (!modal) throw new Error("missing search")
    const surface = document.createElement("section")
    surface.dataset.docSearchPresentation = "inline"
    for (const attribute of modal.attributes) surface.setAttribute(attribute.name, attribute.value)
    surface.append(...modal.childNodes)
    modal.replaceWith(surface)
    const showModal = vi.fn()
    const close = vi.fn()
    Object.assign(surface, { showModal, close })
    const controller = mountSearch(root)
    const trigger = root.querySelector<HTMLButtonElement>("[data-doc-search-open]")
    const input = surface.querySelector<HTMLInputElement>("[data-doc-search-input]")
    if (!input || !trigger) throw new Error("missing controls")

    trigger.click()
    expect(surface.hasAttribute("open")).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(showModal).not.toHaveBeenCalled()
    input.value = "portable"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(surface.querySelector("[role=status]")?.textContent).toBe("1 result")

    const link = surface.querySelector<HTMLAnchorElement>("[data-doc-search-results] a")
    const click = vi.fn((event: Event) => event.preventDefault())
    link?.addEventListener("click", click)
    const outsideKey = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
    trigger.dispatchEvent(outsideKey)
    expect(outsideKey.defaultPrevented).toBe(false)
    expect(click).not.toHaveBeenCalled()
    const outsideArrow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    trigger.dispatchEvent(outsideArrow)
    expect(outsideArrow.defaultPrevented).toBe(false)

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    expect(click).toHaveBeenCalledOnce()
    expect(surface.hasAttribute("open")).toBe(false)
    expect(document.activeElement).toBe(trigger)
    expect(close).not.toHaveBeenCalled()

    trigger.click()
    input.value = "missing"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(surface.querySelector("[role=status]")?.textContent).toBe("No results")
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(surface.hasAttribute("open")).toBe(false)
    controller.destroy()
  })

  it("mounts search, navigation, copy, tabs, and theme below one explicit root", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    const root = fixture()
    const controller = mountBrowserCore(root)

    root.querySelector<HTMLButtonElement>("[data-doc-theme-value]")?.click()
    expect(root.dataset.docTheme).toBe("dark")
    expect(localStorage.getItem("phoenix-assets:doc-shell:theme")).toBe("dark")

    const nav = root.querySelector<HTMLElement>("[data-doc-nav]")
    expect(nav?.dataset.docNavState).toBe("closed")
    root.querySelector<HTMLButtonElement>("[data-doc-nav-toggle]")?.click()
    expect(nav?.dataset.docNavState).toBe("open")

    root.querySelector<HTMLButtonElement>("[data-doc-copy]")?.click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("mix test"))

    const tabs = root.querySelectorAll<HTMLElement>('[role="tab"]')
    tabs[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }))
    tabs[1]?.click()
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true")
    expect(root.querySelector<HTMLElement>("#one")?.hidden).toBe(true)

    root.querySelector<HTMLButtonElement>("[data-doc-search-open]")?.click()
    const dialog = root.querySelector<HTMLDialogElement>("dialog")
    const input = root.querySelector<HTMLInputElement>("[data-doc-search-input]")
    expect(dialog?.hasAttribute("open")).toBe(true)
    if (input) {
      input.value = "portable"
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    expect(root.querySelector("[data-doc-search-results]")?.textContent).toContain("Portable guide")
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(dialog?.hasAttribute("open")).toBe(false)

    controller.destroy()
    root.querySelector<HTMLButtonElement>("[data-doc-theme-value]")?.click()
    expect(root.dataset.docTheme).toBe("dark")
  })

  it("covers rejected records, closed navigation, fallback dialogs, filters, and keyboard paths", () => {
    const root = fixture()
    const missing = document.createElement("button")
    missing.dataset.docNavToggle = ""
    missing.setAttribute("aria-controls", "missing")
    root.append(missing)

    const dialog = root.querySelector<HTMLDialogElement>("dialog")
    const input = root.querySelector<HTMLInputElement>("[data-doc-search-input]")
    const select = root.querySelector<HTMLSelectElement>("[data-doc-search-filter]")
    if (dialog) {
      Object.defineProperty(dialog, "showModal", { configurable: true, value: undefined })
      Object.defineProperty(dialog, "close", { configurable: true, value: undefined })
    }
    const controller = mountBrowserCore(root)
    const toggle = root.querySelector<HTMLButtonElement>("[data-doc-nav-toggle]")
    toggle?.click()
    toggle?.click()
    expect(root.querySelector<HTMLElement>("[data-doc-nav]")?.dataset.docNavState).toBe("closed")
    missing.click()

    root.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "k", bubbles: true }))
    expect(dialog?.hasAttribute("open")).toBe(true)
    if (input) {
      input.value = "portable"
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }))
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))

    if (select) {
      select.value = "en"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    }
    root.querySelector<HTMLButtonElement>("[data-doc-search-close]")?.click()
    expect(dialog?.hasAttribute("open")).toBe(false)

    const tabs = root.querySelectorAll<HTMLElement>('[role="tab"]')
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "End", "x"]) {
      tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
    }

    const orphan = document.createElement("button")
    orphan.setAttribute("role", "tab")
    root.append(orphan)
    orphan.click()
    orphan.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }))

    controller.destroy()
  })

  it("contains malformed search state and ignores incomplete controls", () => {
    const empty = document.createElement("div")
    empty.innerHTML = `
      <button data-doc-nav-toggle>Missing controls</button>
      <button data-doc-copy>Missing code</button>
      <dialog data-doc-search-dialog data-doc-search-records="not-json">
        <input data-doc-search-input><ul data-doc-search-results></ul>
      </dialog>
      <div role="tablist"></div>
    `
    document.body.append(empty)
    const controller = mountBrowserCore(empty)
    empty.querySelector<HTMLButtonElement>("[data-doc-nav-toggle]")?.click()
    empty.querySelector<HTMLButtonElement>("[data-doc-copy]")?.click()
    const input = empty.querySelector<HTMLInputElement>("[data-doc-search-input]")
    if (input) {
      input.value = "nothing"
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    expect(empty.querySelector("[data-doc-search-results]")?.children).toHaveLength(0)
    controller.destroy()

    const objectPayload = document.createElement("div")
    objectPayload.innerHTML = `<dialog data-doc-search-dialog data-doc-search-records="${btoa("{}")}"></dialog>`
    const noInput = mountBrowserCore(objectPayload)
    noInput.refresh()
    noInput.destroy()
  })

  it("provides idempotent DOM-ready and LiveView hook teardown", () => {
    const root = fixture()
    const ready = mountBrowserCoreOnReady(root)
    ready.refresh()
    ready.destroy()
    ready.destroy()

    const hook = {
      el: root,
      paDocShell: undefined as ReturnType<typeof mountBrowserCore> | undefined,
    }
    PhoenixAssetsDocShell.mounted.call(hook)
    const mounted = hook.paDocShell
    PhoenixAssetsDocShell.updated.call(hook)
    expect(hook.paDocShell).toBe(mounted)
    PhoenixAssetsDocShell.destroyed.call(hook)
    PhoenixAssetsDocShell.destroyed.call(hook)
    expect(hook.paDocShell).toBeUndefined()
  })
})

describe("theme and request policy", () => {
  it("defaults invalid stored values to system", () => {
    const storage = { getItem: () => "sepia" }
    expect(readTheme(storage)).toBe("system")
    const root = document.createElement("div")
    applyTheme(root, "light")
    expect(root.dataset.paTheme).toBe("light")
  })

  it("admits exact origins and never enables cross-origin credentials", () => {
    expect(
      admitRequest("/v1/things", {
        apiOrigin: "https://api.example.test",
        allowedOrigins: ["https://api.example.test"],
        currentHref: "https://docs.example.test/reference",
      }),
    ).toEqual({
      url: "https://api.example.test/v1/things",
      crossOrigin: true,
      confirmation: "Send this request to https://api.example.test",
      credentials: "same-origin",
    })
    expect(() =>
      admitRequest("/v1/things", {
        apiOrigin: "https://evil.example.test",
        allowedOrigins: ["https://api.example.test"],
      }),
    ).toThrow(/allowlisted/)

    expect(
      admitRequest("/v1/things", {
        apiOrigin: "/api",
        currentHref: "https://docs.example.test/reference",
      }),
    ).toMatchObject({ crossOrigin: false, confirmation: undefined, credentials: "same-origin" })
  })
})
