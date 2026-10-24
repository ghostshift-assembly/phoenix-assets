import { afterEach, describe, expect, it, vi } from "vitest"
import {
  admitPagefindContract,
  admitRequest,
  applyTheme,
  createContractPagefindSearch,
  createPagefindSearch,
  mountBrowserCore,
  mountBrowserCoreOnReady,
  mountEnhancements,
  mountNavigation,
  mountRequests,
  mountSearch,
  mountTheme,
  PhoenixAssetsDocShell,
  querySearchRecords,
  readTheme,
} from "../src/browser/index.js"
import { readResponseText } from "../src/browser/request.js"
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
  it("rebinds replaced search markup and records after a LiveView patch", () => {
    const root = fixture()
    const controller = mountSearch(root)
    const previous = root.querySelector("dialog")
    if (!previous) throw new Error("missing search")
    const replacement = previous.cloneNode(true) as HTMLDialogElement
    const record = records[0]
    if (!record) throw new Error("missing record")
    replacement.dataset.docSearchRecords = encodedRecords([
      { ...record, title: "Replacement guide" },
    ])
    previous.replaceWith(replacement)
    controller.refresh()
    root.querySelector<HTMLButtonElement>("[data-doc-search-open]")?.click()
    const input = replacement.querySelector<HTMLInputElement>("input")
    if (!input) throw new Error("missing query")
    input.value = "static"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(replacement.hasAttribute("open")).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(replacement.querySelector("ul")?.textContent).toContain("Replacement guide")
    controller.destroy()
  })

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
    expect(excerpt?.textContent?.length).toBeLessThanOrEqual(320)
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
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const scrollY = vi.spyOn(window, "scrollY", "get").mockReturnValue(270)
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
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 270 })

    scrollY.mockReturnValue(480)
    trigger.click()
    input.value = "missing"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(surface.querySelector("[role=status]")?.textContent).toBe("No results")
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(surface.hasAttribute("open")).toBe(false)
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 480 })
    controller.destroy()
  })

  it("disposes modal navigation across close, resize and DOM replacement", async () => {
    const media = Object.assign(new EventTarget(), { matches: true })
    vi.spyOn(window, "matchMedia").mockReturnValue(media as MediaQueryList)
    const root = fixture()
    root.querySelector("[data-doc-nav]")?.replaceWith(
      Object.assign(document.createElement("dialog"), {
        id: "navigation",
        innerHTML: '<button data-doc-nav-close hidden>Close</button><a href="#chapter">Chapter</a>',
      }),
    )
    const dialog = root.querySelector<HTMLDialogElement>("#navigation")
    const trigger = root.querySelector<HTMLButtonElement>("[data-doc-nav-toggle]")
    if (!dialog || !trigger) throw new Error("navigation fixture is absent")
    dialog.dataset.docNav = ""
    dialog.open = true
    const controller = mountNavigation(root)
    expect(dialog.open).toBe(false)
    trigger.click()
    expect(dialog.open).toBe(true)
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }))
    await vi.waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"))
    expect(document.activeElement).toBe(trigger)
    trigger.click()
    dialog.querySelector<HTMLButtonElement>("[data-doc-nav-close]")?.click()
    await vi.waitFor(() => expect(dialog.open).toBe(false))
    media.matches = false
    media.dispatchEvent(new Event("change"))
    expect(dialog.open).toBe(true)
    expect(dialog.hasAttribute("aria-modal")).toBe(false)
    expect(dialog.querySelector<HTMLElement>("[data-doc-nav-close]")?.hidden).toBe(true)
    media.matches = true
    media.dispatchEvent(new Event("change"))
    trigger.click()
    const replacement = dialog.cloneNode(true) as HTMLDialogElement
    dialog.replaceWith(replacement)
    controller.refresh()
    expect(dialog.open).toBe(false)
    trigger.click()
    controller.destroy()
    expect(replacement.open).toBe(true)
    expect(replacement.hasAttribute("aria-modal")).toBe(false)
    expect(replacement.dataset.docNavState).toBeUndefined()
    media.matches = false
    media.dispatchEvent(new Event("change"))
    expect(replacement.open).toBe(true)
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

describe("optional local enhancements", () => {
  it("loads only on use and preserves the original source", async () => {
    const root = fixture()
    const container = root.querySelector<HTMLElement>("[data-doc-code]")
    if (!container) throw new Error("missing code")
    container.innerHTML =
      '<button data-doc-enhance="highlight" hidden>Highlight</button><pre><code>const safe = "&lt;unsafe&gt;"</code></pre>'
    container.dataset.docEnhancementAssets = JSON.stringify({
      "doc-shell-highlight.js": "/assets/highlight-qualified.js",
    })
    const enhance = vi
      .fn()
      .mockResolvedValue('<pre class="shiki"><code>safe highlighted</code></pre>')
    const load = vi.fn().mockResolvedValue({ enhance })
    const controller = mountEnhancements(root, load)
    expect(load).not.toHaveBeenCalled()
    const button = container.querySelector<HTMLButtonElement>("button")
    expect(button?.hidden).toBe(false)
    button?.click()
    await vi.waitFor(() => expect(container.dataset.docEnhancementState).toBe("enhanced"))
    expect(enhance).toHaveBeenCalledExactlyOnceWith('const safe = "<unsafe>"', "text")
    expect(container.querySelector("details code")?.textContent).toContain("<unsafe>")
    expect(container.querySelector("unsafe")).toBeNull()
    controller.destroy()
  })

  it("refuses remote modules and retains the plain source on failed enhancement", async () => {
    const root = fixture()
    root.insertAdjacentHTML(
      "beforeend",
      '<figure data-doc-mermaid data-doc-enhancement-assets><button data-doc-enhance="mermaid" hidden>Render</button><pre>graph LR; A--&gt;B</pre></figure>',
    )
    const container = root.querySelector<HTMLElement>("figure")
    const button = container?.querySelector<HTMLButtonElement>("button")
    if (!container || !button) throw new Error("missing diagram")
    container.dataset.docEnhancementAssets = JSON.stringify({
      "doc-shell-mermaid.js": "https://external.invalid/renderer.js",
    })
    const load = vi.fn().mockRejectedValue(new Error("unavailable"))
    const controller = mountEnhancements(root, load)
    expect(button.hidden).toBe(true)
    button.click()
    expect(load).not.toHaveBeenCalled()
    container.dataset.docEnhancementAssets = JSON.stringify({
      "doc-shell-mermaid.js": "/assets/diagram-qualified.js",
    })
    controller.refresh()
    button.click()
    await vi.waitFor(() => expect(button.textContent).toContain("source retained"))
    expect(container.querySelector("pre")?.textContent).toBe("graph LR; A-->B")
    controller.destroy()
  })
})

describe("theme and request policy", () => {
  it("applies document-level static controls to the nested renderer roots", () => {
    const root = fixture()
    root.insertAdjacentHTML(
      "beforeend",
      '<section data-pa-doc-shell data-doc-theme="system"></section>',
    )
    const controller = mountTheme(root)
    root.querySelector<HTMLButtonElement>("[data-doc-theme-value]")?.click()
    expect(root.querySelector<HTMLElement>("[data-pa-doc-shell]")?.dataset.docTheme).toBe("dark")
    controller.destroy()
  })
  it("keeps theme controls usable when preference storage is blocked", () => {
    const root = fixture()
    const storage = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    }
    const controller = mountTheme(root, storage)
    expect(root.dataset.docTheme).toBe("system")
    root.querySelector<HTMLButtonElement>("[data-doc-theme-value]")?.click()
    expect(root.dataset.docTheme).toBe("dark")
    controller.destroy()
  })

  it("requires confirmation, confines requests to the selected origin and renders inert responses", async () => {
    const root = fixture()
    root.insertAdjacentHTML(
      "beforeend",
      `<form data-doc-api-request data-api-origin="https://api.example.test" data-operation-method="post"><input name="path" value="/records"><input name="token" value="synthetic"><textarea name="body">{}</textarea><input type="checkbox" name="confirm"><p data-doc-api-status></p><pre data-doc-api-response></pre></form>`,
    )
    const request = vi
      .fn()
      .mockResolvedValue(new Response('<img src=x onerror="alert(1)">', { status: 201 }))
    const controller = mountRequests(root, request)
    const form = root.querySelector<HTMLFormElement>("form")
    if (!form) throw new Error("missing form")
    const submit = () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    submit()
    expect(request).not.toHaveBeenCalled()
    const confirm = form.querySelector<HTMLInputElement>('[name="confirm"]')
    if (confirm) confirm.checked = true
    submit()
    submit()
    await vi.waitFor(() =>
      expect(root.querySelector("[data-doc-api-status]")?.textContent).toBe("HTTP 201"),
    )
    expect(request).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith(
      "https://api.example.test/records",
      expect.objectContaining({ method: "POST", credentials: "same-origin", body: "{}" }),
    )
    expect(root.querySelector("[data-doc-api-response] img")).toBeNull()
    const path = form.querySelector<HTMLInputElement>('[name="path"]')
    if (path) path.value = "//evil.example.test/"
    submit()
    expect(request).toHaveBeenCalledOnce()
    controller.destroy()
  })

  it("enables inert request controls only while mounted and retires credentials when their destination changes", () => {
    const root = fixture()
    root.insertAdjacentHTML(
      "beforeend",
      '<form method="dialog" data-doc-api-request data-api-origin="https://api.example.test" data-operation-method="POST"><fieldset disabled data-doc-api-controls><input name="token"><input type="checkbox" name="confirm"></fieldset></form>',
    )
    const form = root.querySelector<HTMLFormElement>("form")
    const controls = root.querySelector<HTMLFieldSetElement>("fieldset")
    const token = root.querySelector<HTMLInputElement>('[name="token"]')
    const confirmation = root.querySelector<HTMLInputElement>('[name="confirm"]')
    if (!form || !controls || !token || !confirmation) throw new Error("missing request fixture")
    expect(controls.disabled).toBe(true)
    const controller = mountRequests(root)
    expect(controls.disabled).toBe(false)
    token.value = "synthetic"
    confirmation.checked = true
    form.dataset.apiOrigin = "https://other.example.test"
    controller.refresh()
    expect(token.value).toBe("")
    expect(confirmation.checked).toBe(false)
    token.value = "synthetic"
    controller.destroy()
    controller.refresh()
    expect(controls.disabled).toBe(true)
    expect(token.value).toBe("")
  })

  it("retires pending request responses on refresh or destruction without replay", async () => {
    const root = fixture()
    root.insertAdjacentHTML(
      "beforeend",
      `<form data-doc-api-request data-api-origin="https://api.example.test" data-operation-method="get"><input name="path" value="/records"><input type="checkbox" name="confirm" checked><p data-doc-api-status></p></form>`,
    )
    const request = vi.fn().mockImplementation(async (_url, options) => {
      await new Promise((_, reject) =>
        options.signal.addEventListener("abort", () => reject(new Error("aborted"))),
      )
      return new Response()
    })
    const controller = mountRequests(root, request)
    const form = root.querySelector("form")
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    const signal = request.mock.calls[0]?.[1].signal as AbortSignal
    form?.remove()
    controller.refresh()
    expect(signal.aborted).toBe(true)
    controller.destroy()
    expect(request).toHaveBeenCalledOnce()
  })

  it("does not let a retired request release the replacement request's pending guard", async () => {
    const root = fixture()
    root.insertAdjacentHTML(
      "beforeend",
      '<form data-doc-api-request data-api-origin="https://api.example.test" data-operation-method="GET"><input name="path" value="/records"><input name="token"><input type="checkbox" name="confirm" checked><p data-doc-api-status></p></form>',
    )
    const responses: Array<(response: Response) => void> = []
    const request = vi
      .fn()
      .mockImplementation(() => new Promise<Response>((resolve) => responses.push(resolve)))
    const controller = mountRequests(root, request)
    const form = root.querySelector<HTMLFormElement>("form")
    if (!form) throw new Error("missing form")
    const submit = () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    submit()
    form.dataset.apiOrigin = "https://other.example.test"
    controller.refresh()
    const confirmation = form.querySelector<HTMLInputElement>('[name="confirm"]')
    if (confirmation) confirmation.checked = true
    submit()
    const retired = new Response("retired")
    responses[0]?.(retired)
    // Settle the controlled response's promise chain before the duplicate submit.
    await new Promise((resolve) => setTimeout(resolve, 0))
    submit()
    expect(request).toHaveBeenCalledTimes(2)
    expect(root.querySelector("[data-doc-api-status]")?.textContent).toBe("Sending…")
    controller.destroy()
    expect(request.mock.calls[1]?.[1].signal.aborted).toBe(true)
    responses[1]?.(new Response("disposed"))
  })

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

describe("bounded response bodies", () => {
  it("cancels a response after the byte limit", async () => {
    const cancel = vi.fn()
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("abcdefghij"))
        },
        cancel,
      }),
    )
    expect(await readResponseText(response, 4)).toBe("abcd…")
    expect(cancel).toHaveBeenCalledOnce()
  })
})
