import { mountCopy, mountNavigation, mountRequests, mountSearch, mountTabs } from "./controllers.js"
import { mountTheme } from "./theme.js"
import type { BrowserController } from "./types.js"

export { isAllowedTryItOrigin, resolveTryItTarget, safeLinkTarget } from "../url.js"
export {
  copyText,
  mountCopy,
  mountNavigation,
  mountRequests,
  mountSearch,
  mountTabs,
} from "./controllers.js"
export { type AdmittedRequest, admitRequest, type RequestPolicy } from "./request.js"
export {
  admitPagefindContract,
  createContractPagefindSearch,
  createPagefindSearch,
  loadPagefindModule,
  type PagefindApi,
  type PagefindContract,
  type PagefindModuleLoader,
  type PagefindResult,
  querySearchRecords,
} from "./search.js"
export { applyTheme, mountTheme, readTheme } from "./theme.js"
export type * from "./types.js"

export const mountBrowserCore = (root: HTMLElement): BrowserController => {
  const controllers = [
    mountTheme(root),
    mountNavigation(root),
    mountSearch(root),
    mountCopy(root),
    mountTabs(root),
    mountRequests(root),
  ]
  return {
    refresh: () => controllers.forEach((controller) => controller.refresh()),
    destroy: () => controllers.splice(0).forEach((controller) => controller.destroy()),
  }
}

export const mountBrowserCoreOnReady = (root: HTMLElement = document.documentElement) => {
  let controller: BrowserController | undefined
  const mount = () => {
    controller ??= mountBrowserCore(root)
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount, { once: true })
  else mount()
  return {
    refresh: () => controller?.refresh(),
    destroy: () => {
      document.removeEventListener("DOMContentLoaded", mount)
      controller?.destroy()
      controller = undefined
    },
  }
}

export const PhoenixAssetsDocShell = {
  mounted(this: { el: HTMLElement; paDocShell?: BrowserController }) {
    this.paDocShell = mountBrowserCore(this.el)
  },
  updated(this: { paDocShell?: BrowserController }) {
    this.paDocShell?.refresh()
  },
  destroyed(this: { paDocShell?: BrowserController }) {
    this.paDocShell?.destroy()
    this.paDocShell = undefined
  },
}
