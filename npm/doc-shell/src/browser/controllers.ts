import { safeLinkTarget } from "../url.js"
import { admitRequest } from "./request.js"
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
  const parts = value.slice(0, 2048).split(/(<\/?mark>)/i)
  const length = parts
    .filter((part) => !/^<\/?mark>$/i.test(part))
    .reduce((size, part) => size + Array.from(part).length, 0)
  const truncated = value.length > 2048 || length > 320
  let remaining = truncated ? 319 : 320
  for (const part of parts) {
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
      if (remaining === 0) break
    }
  }
  if (truncated) parent.append("…")
  return excerpt
}

export const mountSearch = (
  root: HTMLElement,
  loadPagefind?: PagefindModuleLoader,
  options?: {
    records: () => SearchRecord[]
    contract?: () => unknown
    search?: (query: string, filters: SearchFilters) => SearchRecord[] | Promise<SearchRecord[]>
    navigate?: (path: string) => void
  },
): BrowserController => {
  const controller = new AbortController()
  let trigger: HTMLElement | undefined
  let selected = 0
  let results: SearchRecord[] = []
  let generation = 0
  let returnScroll: { left: number; top: number } | undefined

  const selector = options
    ? "[data-doc-search-dialog]"
    : "[data-doc-search-dialog]:not([data-doc-search-owned])"
  let dialog = root.querySelector<HTMLDialogElement>(selector)
  let inline = dialog?.dataset.docSearchPresentation === "inline"
  let input = dialog?.querySelector<HTMLInputElement>("[data-doc-search-input]")
  let list = dialog?.querySelector<HTMLElement>("[data-doc-search-results]")
  let status = dialog?.querySelector<HTMLElement>("[data-doc-search-status]")
  let records = options?.records() ?? (dialog ? decodeRecords(dialog) : [])
  let pagefind = dialog
    ? createContractPagefindSearch(options?.contract?.() ?? decodeContract(dialog), loadPagefind)
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
    const resultId = (index: number) => `${list?.id || "doc-search"}-result-${index}`
    list.replaceChildren(
      ...results.map((record, index) => {
        const item = document.createElement("li")
        item.id = resultId(index)
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
    input.setAttribute("aria-activedescendant", results[selected] ? resultId(selected) : "")
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

    if (!pagefind && !options?.search) {
      results = querySearchRecords(records, query, filters(), 20)
      list.dataset.docSearchState = "ready"
      list.removeAttribute("aria-busy")
      paint()
      return
    }

    list.dataset.docSearchState = "loading"
    list.setAttribute("aria-busy", "true")
    if (status) status.textContent = "Searching…"
    const pending = options?.search
      ? Promise.resolve().then(() => options.search?.(query, filters()) ?? [])
      : pagefind?.(query, filters()).then((found) => found.map(pagefindRecord))
    void pending
      ?.then((found) => {
        if (generation !== current || controller.signal.aborted || !list) return
        results = found.slice(0, 20)
        list.dataset.docSearchState = "ready"
        list.removeAttribute("aria-busy")
        paint()
      })
      .catch(() => {
        if (generation !== current || controller.signal.aborted || !list) return
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
      if (!dialog) return
      const target = event.target as Element
      const openButton = target.closest<HTMLElement>("[data-doc-search-open]")
      if (openButton) open(openButton)
      if (target.closest("[data-doc-search-close]")) close()
      const result = target.closest<HTMLAnchorElement>("[data-doc-search-results] a")
      if (result) {
        const link = safeLinkTarget(result.getAttribute("href") ?? undefined)
        if (options?.navigate && link?.navigable) {
          event.preventDefault()
          options.navigate(link.href)
        }
        close()
      }
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
      if (!dialog) return
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

  const refresh = () => {
    const previous = dialog
    dialog = root.querySelector<HTMLDialogElement>(selector)
    inline = dialog?.dataset.docSearchPresentation === "inline"
    input = dialog?.querySelector<HTMLInputElement>("[data-doc-search-input]")
    list = dialog?.querySelector<HTMLElement>("[data-doc-search-results]")
    status = dialog?.querySelector<HTMLElement>("[data-doc-search-status]")
    records = options?.records() ?? (dialog ? decodeRecords(dialog) : [])
    pagefind = dialog
      ? createContractPagefindSearch(options?.contract?.() ?? decodeContract(dialog), loadPagefind)
      : undefined
    if (previous !== dialog) {
      selected = 0
      returnScroll = undefined
      if (!trigger?.isConnected) trigger = undefined
    }
    render()
  }
  return { refresh, destroy: () => controller.abort() }
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

/** Explicitly enabled request forms; responses and credentials remain local. */
export const mountRequests = (
  root: HTMLElement,
  request: typeof fetch = fetch,
): BrowserController => {
  const controller = new AbortController()
  const pending = new Map<HTMLFormElement, AbortController>()
  root.addEventListener(
    "submit",
    (event) => {
      const form = (event.target as Element).closest<HTMLFormElement>("[data-doc-api-request]")
      if (!form) return
      event.preventDefault()
      if (pending.has(form)) return
      const status = form.querySelector<HTMLElement>("[data-doc-api-status]")
      const output = form.querySelector<HTMLElement>("[data-doc-api-response]")
      const value = (name: string) =>
        form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? ""
      try {
        const origin = form.dataset.apiOrigin ?? ""
        const target = admitRequest(value("path"), { apiOrigin: origin, allowedOrigins: [origin] })
        const method = form.dataset.operationMethod?.toUpperCase() ?? ""
        if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(method))
          throw new Error("Unsupported request method")
        if (!form.querySelector<HTMLInputElement>('[name="confirm"]')?.checked)
          throw new Error("Confirm the displayed request destination")
        const token = value("token")
        const headers = new Headers()
        if (token)
          headers.set("authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`)
        const body = !["GET", "HEAD"].includes(method) ? value("body") : undefined
        if (body) headers.set("content-type", "application/json")
        const abort = new AbortController()
        pending.set(form, abort)
        if (status) status.textContent = "Sending…"
        if (output) output.textContent = ""
        void request(target.url, {
          method,
          headers,
          body: body || undefined,
          credentials: target.credentials,
          signal: abort.signal,
        })
          .then(async (response) => ({ status: response.status, text: await response.text() }))
          .then((response) => {
            if (abort.signal.aborted || !form.isConnected) return
            if (status) status.textContent = `HTTP ${response.status}`
            if (output) output.textContent = response.text.slice(0, 65536)
          })
          .catch(() => {
            if (!abort.signal.aborted && status)
              status.textContent =
                "Response unavailable. The operation outcome may be unknown; check its owner before retrying."
          })
          .finally(() => pending.delete(form))
      } catch (error) {
        if (status)
          status.textContent = error instanceof Error ? error.message : "Request unavailable"
      }
    },
    { signal: controller.signal },
  )
  const refresh = () => {
    for (const [form, abort] of pending)
      if (!form.isConnected) {
        abort.abort()
        pending.delete(form)
      }
  }
  return {
    refresh,
    destroy: () => {
      controller.abort()
      for (const abort of pending.values()) abort.abort()
      pending.clear()
    },
  }
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
