import type { BrowserController } from "./types.js"

type Enhancement = { enhance: (source: string, language: string) => Promise<string | null> }
type ModuleLoader = (path: string) => Promise<unknown>

const modulePath = (button: HTMLElement): string | undefined => {
  try {
    const encoded = button.closest<HTMLElement>("[data-doc-enhancement-assets]")?.dataset
      .docEnhancementAssets
    const assets: unknown = JSON.parse(encoded ?? "null")
    if (typeof assets !== "object" || assets === null) return
    const kind = button.dataset.docEnhance
    if (kind !== "highlight" && kind !== "mermaid") return
    const path = (assets as Record<string, unknown>)[`doc-shell-${kind}.js`]
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return
    const url = new URL(path, location.href)
    if (url.origin === location.origin && !url.search && !url.hash) return url.href
  } catch {
    return undefined
  }
}

/** Optional local modules load on explicit use; plain source survives every failure. */
export const mountEnhancements = (
  root: HTMLElement,
  load: ModuleLoader = (path) => import(/* @vite-ignore */ path),
): BrowserController => {
  const controller = new AbortController()
  let generation = 0
  const refresh = () => {
    generation += 1
    for (const button of root.querySelectorAll<HTMLElement>("[data-doc-enhance]"))
      button.hidden = !modulePath(button)
  }
  root.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-doc-enhance]")
      const container = button?.closest<HTMLElement>("[data-doc-code], [data-doc-mermaid]")
      const source = container?.querySelector("pre")
      const path = button ? modulePath(button) : undefined
      if (!button || !container || !source || !path || button.disabled) return
      const value = source.textContent ?? ""
      if (value.length > 262144) {
        button.textContent = "Source exceeds the enhancement limit"
        return
      }
      const current = generation
      button.disabled = true
      void load(path)
        .then((module) => {
          if (
            typeof module !== "object" ||
            module === null ||
            typeof (module as Enhancement).enhance !== "function"
          )
            throw new Error("Invalid enhancement module")
          return (module as Enhancement).enhance(value, container.dataset.language ?? "text")
        })
        .then((html) => {
          if (
            controller.signal.aborted ||
            generation !== current ||
            !container.isConnected ||
            source.textContent !== value
          )
            return
          if (!html) {
            button.textContent = "Plain source retained"
            return
          }
          const output = document.createElement("div")
          output.className = "doc-enhanced-output"
          // Only the locally packaged Shiki/Mermaid renderer supplies this HTML.
          output.innerHTML = html
          const details = document.createElement("details")
          const summary = document.createElement("summary")
          summary.textContent = "Source"
          source.replaceWith(output)
          details.append(summary, source)
          container.append(details)
          button.hidden = true
          container.dataset.docEnhancementState = "enhanced"
        })
        .catch(() => {
          if (!controller.signal.aborted && button.isConnected)
            button.textContent = "Enhancement unavailable; source retained"
        })
        .finally(() => {
          button.disabled = false
        })
    },
    { signal: controller.signal },
  )
  refresh()
  return {
    refresh,
    destroy: () => {
      generation += 1
      controller.abort()
    },
  }
}
