import { safeLinkTarget } from "../url.js"
import {
  createContractPagefindSearch,
  type PagefindModuleLoader,
  type PagefindResult,
  querySearchRecords,
} from "./search.js"
import type { BrowserController, SearchFilters, SearchRecord } from "./types.js"

const scoped = (root: HTMLElement, selector: string) => [
  ...root.querySelectorAll<HTMLElement>(selector),
]

export const mountNavigation = (root: HTMLElement): BrowserController => {
  const controller = new AbortController()
  const refresh = () =>
    scoped(root, "[data-doc-nav-toggle]").forEach((trigger) => {
      const target = trigger.getAttribute("aria-controls")
      const navigation = target ? root.querySelector<HTMLElement>(`#${CSS.escape(target)}`) : null
      if (navigation && !navigation.dataset.docNavState) navigation.dataset.docNavState = "closed"
    })
  root.addEventListener(
    "click",
    (event) => {
      const trigger = (event.target as Element).closest<HTMLElement>("[data-doc-nav-toggle]")
      if (!trigger) return
      const target = trigger.getAttribute("aria-controls")
      const navigation = target
        ? root.querySelector<HTMLElement>(`#${CSS.escape(target)}`)
        : undefined
      if (!navigation) return
      const open = trigger.getAttribute("aria-expanded") !== "true"
      trigger.setAttribute("aria-expanded", String(open))
      navigation.dataset.docNavState = open ? "open" : "closed"
    },
    { signal: controller.signal },
  )
  refresh()
  return { refresh, destroy: () => controller.abort() }
}

const decodeRecords = (element: HTMLElement): SearchRecord[] => {
  const encoded = element.dataset.docSearchRecords
  if (!encoded) return []
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (value) =>
      value.charCodeAt(0),
    )
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return Array.isArray(value) ? (value as SearchRecord[]) : []
  } catch {
    return []
  }
}

const decodeContract = (element: HTMLElement): unknown => {
  const encoded = element.dataset.docSearchContract
  if (!encoded) return undefined
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (value) =>
      value.charCodeAt(0),
    )
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}

const pagefindRecord = (result: PagefindResult): SearchRecord => {
  const id = result.id ?? result.meta.record_id ?? result.url
  return {
    id,
    page_id: result.meta.page_id ?? id,
    route: result.url,
    title: result.meta.title ?? result.meta.record_id ?? result.url,
    section: result.meta.section,
    text: result.excerpt,
    locale: result.meta.locale ?? "",
    audience: result.meta.audience,
    kind: result.meta.kind ?? "",
    collection: result.meta.collection ?? "",
    version: result.meta.version ?? "",
    tags: [],
    status: result.meta.status,
  }
}

const searchExcerpt = (value: string): HTMLElement => {
  const excerpt = document.createElement("p")
  excerpt.className = "doc-search-excerpt"
  let parent: HTMLElement = excerpt
  let remaining = 320
  for (const part of value.slice(0, 2048).split(/(<\/?mark>)/i)) {
    if (part.toLowerCase() === "<mark>") {
      parent = document.createElement("mark")
      excerpt.append(parent)
    } else if (part.toLowerCase() === "</mark>") {
      parent = excerpt
    } else {
      const characters = Array.from(part)
      const shown = characters.slice(0, remaining)
      parent.append(document.createTextNode(shown.join("")))
      remaining -= shown.length
      if (characters.length > shown.length) parent.append("…")
      if (remaining === 0) break
    }
  }
  return excerpt
}

export const mountSearch = (
  root: HTMLElement,
  loadPagefind?: PagefindModuleLoader,
): BrowserController => {
  const controller = new AbortController()
  let trigger: HTMLElement | undefined
  let selected = 0
  let results: SearchRecord[] = []
  let generation = 0
  let returnScroll: { left: number; top: number } | undefined

  const dialog = root.querySelector<HTMLDialogElement>("[data-doc-search-dialog]")
  const inline = dialog?.dataset.docSearchPresentation === "inline"
  const input = dialog?.querySelector<HTMLInputElement>("[data-doc-search-input]")
  const list = dialog?.querySelector<HTMLElement>("[data-doc-search-results]")
  const status = dialog?.querySelector<HTMLElement>("[data-doc-search-status]")
  const records = dialog ? decodeRecords(dialog) : []
  const pagefind = dialog
    ? createContractPagefindSearch(decodeContract(dialog), loadPagefind)
    : undefined

  const filters = (): SearchFilters =>
    Object.fromEntries(
      scoped(dialog ?? root, "[data-doc-search-filter]")
        .map((element) => [element.dataset.docSearchFilter, (element as HTMLSelectElement).value])
        .filter((entry): entry is [keyof SearchFilters, string] => Boolean(entry[0] && entry[1])),
    )

  const paint = () => {
    if (!input || !list) return
    selected = Math.min(selected, Math.max(0, results.length - 1))
    list.replaceChildren(
      ...results.map((record, index) => {
        const item = document.createElement("li")
        item.id = `doc-search-result-${index}`
        item.setAttribute("role", "option")
        item.setAttribute("aria-selected", String(index === selected))
        const target = safeLinkTarget(record.route)
        const link = document.createElement(target ? "a" : "span")
        if (target && link instanceof HTMLAnchorElement) {
          link.href = target.href
          if (target.external) {
            link.target = "_blank"
            link.rel = "noopener noreferrer"
          }
        }
        const context = [record.section, record.collection, record.version]
          .filter(Boolean)
          .join(" · ")
        link.append(document.createTextNode(record.title))
        if (context) {
          const detail = document.createElement("small")
          detail.textContent = context
          link.append(detail)
        }
        if (typeof record.text === "string" && record.text.trim()) {
          link.append(searchExcerpt(record.text))
        }
        item.append(link)
        return item
      }),
    )
    input.setAttribute(
      "aria-activedescendant",
      results[selected] ? `doc-search-result-${selected}` : "",
    )
    if (status) {
      status.textContent =
        list.dataset.docSearchState === "error"
          ? "Search unavailable. Try again."
          : list.dataset.docSearchState === "ready"
            ? results.length === 0
              ? "No results"
              : `${results.length} ${results.length === 1 ? "result" : "results"}`
            : ""
    }
  }

  const render = () => {
    if (!input || !list) return
    const query = input.value.trim()
    const current = ++generation

    if (query.length < 2) {
      results = []
      list.dataset.docSearchState = "idle"
      list.removeAttribute("aria-busy")
      paint()
      return
    }

    if (!pagefind) {
      results = querySearchRecords(records, query, filters(), 20)
      list.dataset.docSearchState = "ready"
      list.removeAttribute("aria-busy")
      paint()
      return
    }

    list.dataset.docSearchState = "loading"
    list.setAttribute("aria-busy", "true")
    if (status) status.textContent = "Searching…"
    void pagefind(query, filters())
      .then((found) => {
        if (generation !== current || controller.signal.aborted) return
        results = found.slice(0, 20).map(pagefindRecord)
        list.dataset.docSearchState = "ready"
        list.removeAttribute("aria-busy")
        paint()
      })
      .catch(() => {
        if (generation !== current || controller.signal.aborted) return
        results = []
        list.dataset.docSearchState = "error"
        list.removeAttribute("aria-busy")
        paint()
      })
  }

  const open = (button?: HTMLElement) => {
    if (!dialog || !input) return
    trigger = button ?? trigger
    if (inline && !dialog.hasAttribute("open")) {
      returnScroll = { left: window.scrollX, top: window.scrollY }
    }
    if (!inline && typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal()
    } else dialog.setAttribute("open", "")
    input.focus()
  }
  const close = () => {
    if (!dialog) return
    if (!inline && typeof dialog.close === "function") dialog.close()
    else dialog.removeAttribute("open")
    trigger?.focus({ preventScroll: Boolean(returnScroll) })
    if (returnScroll) {
      window.scrollTo(returnScroll)
      returnScroll = undefined
    }
  }

  root.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element
      const openButton = target.closest<HTMLElement>("[data-doc-search-open]")
      if (openButton) open(openButton)
      if (target.closest("[data-doc-search-close]")) close()
      if (target.closest("[data-doc-search-results] a")) close()
    },
    { signal: controller.signal },
  )
  root.addEventListener(
    "input",
    (event) => {
      if ((event.target as Element).matches("[data-doc-search-input], [data-doc-search-filter]"))
        render()
    },
    { signal: controller.signal },
  )
  root.addEventListener(
    "change",
    (event) => {
      if ((event.target as Element).matches("[data-doc-search-filter]")) render()
    },
    { signal: controller.signal },
  )
  root.addEventListener(
    "keydown",
    (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        open(root.querySelector<HTMLElement>("[data-doc-search-open]") ?? undefined)
        return
      }
      if (!dialog?.hasAttribute("open")) return
      if (event.key === "Escape") {
        event.preventDefault()
        close()
        return
      }
      if (inline && event.target !== input) return
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const offset = event.key === "ArrowDown" ? 1 : -1
        selected = Math.max(0, Math.min(results.length - 1, selected + offset))
        paint()
      } else if (event.key === "Enter" && results[selected]) {
        event.preventDefault()
        const link = list?.children[selected]?.querySelector<HTMLAnchorElement>("a")
        link?.click()
      }
    },
    { signal: controller.signal },
  )

  return { refresh: render, destroy: () => controller.abort() }
}

export const mountCopy = (root: HTMLElement): BrowserController => {
  const controller = new AbortController()
  root.addEventListener(
    "click",
    async (event) => {
      const trigger = (event.target as Element).closest<HTMLElement>("[data-doc-copy]")
      if (!trigger) return
      const target = trigger.dataset.docCopy
      const code = target
        ? root.querySelector<HTMLElement>(`#${CSS.escape(target)}`)
        : trigger.closest("[data-doc-code]")?.querySelector("code")
      if (!code) return
      await navigator.clipboard?.writeText(code.textContent ?? "")
      trigger.dataset.docCopyState = "copied"
      trigger.setAttribute("aria-label", "Copied")
    },
    { signal: controller.signal },
  )
  return { refresh: () => undefined, destroy: () => controller.abort() }
}

export const copyText = async (
  text: string,
  clipboard: Pick<Clipboard, "writeText"> = navigator.clipboard,
) => {
  await clipboard.writeText(text)
}

export const mountTabs = (root: HTMLElement): BrowserController => {
  const controller = new AbortController()
  const select = (tab: HTMLElement) => {
    const tablist = tab.closest('[role="tablist"]')
    if (!tablist) return
    for (const item of tablist.querySelectorAll<HTMLElement>('[role="tab"]')) {
      const selected = item === tab
      item.setAttribute("aria-selected", String(selected))
      item.tabIndex = selected ? 0 : -1
      const panel = item.getAttribute("aria-controls")
      if (panel) {
        const element = root.querySelector<HTMLElement>(`#${CSS.escape(panel)}`)
        if (element) element.hidden = !selected
      }
    }
  }
  root.addEventListener(
    "click",
    (event) => {
      const tab = (event.target as Element).closest<HTMLElement>('[role="tab"]')
      if (tab) select(tab)
    },
    { signal: controller.signal },
  )
  root.addEventListener(
    "keydown",
    (event) => {
      const tab = (event.target as Element).closest<HTMLElement>('[role="tab"]')
      if (!tab) return
      const tabs = [
        ...(tab
          .closest('[role="tablist"]')
          ?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])') ?? []),
      ]
      const current = tabs.indexOf(tab)
      let index = current
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        index = (current + 1) % tabs.length
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        index = (current - 1 + tabs.length) % tabs.length
      else if (event.key === "Home") index = 0
      else if (event.key === "End") index = tabs.length - 1
      else return
      event.preventDefault()
      const next = tabs[index]
      if (next) {
        select(next)
        next.focus()
      }
    },
    { signal: controller.signal },
  )
  return {
    refresh: () =>
      scoped(root, '[role="tablist"]').forEach((list) => {
        const selected =
          list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ??
          list.querySelector<HTMLElement>('[role="tab"]')
        if (selected) select(selected)
      }),
    destroy: () => controller.abort(),
  }
}
