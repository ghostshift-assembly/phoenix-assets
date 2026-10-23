import type { BrowserController, ThemePreference } from "./types.js"

const storageKey = "phoenix-assets:doc-shell:theme"
const allowed = new Set<ThemePreference>(["system", "light", "dark", "contrast"])

export const readTheme = (storage?: Pick<Storage, "getItem">): ThemePreference => {
  try {
    const value = (storage ?? localStorage).getItem(storageKey) as ThemePreference | null
    return value && allowed.has(value) ? value : "system"
  } catch {
    return "system"
  }
}

export const applyTheme = (root: HTMLElement, preference: ThemePreference) => {
  root.dataset.paTheme = preference === "system" ? "" : preference
  root.dataset.docTheme = preference
}

export const mountTheme = (
  root: HTMLElement,
  storage?: Pick<Storage, "getItem" | "setItem">,
): BrowserController => {
  const controller = new AbortController()
  const refresh = () => applyTheme(root, readTheme(storage))
  root.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLElement>("[data-doc-theme-value]")
      const value = button?.dataset.docThemeValue as ThemePreference | undefined
      if (!value || !allowed.has(value)) return
      try {
        ;(storage ?? localStorage).setItem(storageKey, value)
      } catch {
        // A blocked preference store must not disable the current reader theme.
      }
      applyTheme(root, value)
    },
    { signal: controller.signal },
  )
  refresh()
  return { refresh, destroy: () => controller.abort() }
}
