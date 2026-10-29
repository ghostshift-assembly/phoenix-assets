import { admitPresentation } from "./presentation.js"
import type { NavigationItem, PresentationSettings, SitePage } from "./types.js"

const encoder = new TextEncoder()
const object = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).every((key) => keys.includes(key))
const text = (value: unknown, max = 4096): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  !/[\uD800-\uDFFF]/u.test(value) &&
  encoder.encode(value).length <= max
const optional = (
  value: Record<string, unknown>,
  key: string,
  predicate: (value: unknown) => boolean,
) => !Object.hasOwn(value, key) || predicate(value[key])
const settings = (value: unknown): boolean => {
  try {
    admitPresentation(value)
    return true
  } catch {
    return false
  }
}
const banner = (value: unknown) =>
  object(value, ["label", "text", "href"]) &&
  (Object.hasOwn(value, "label") || Object.hasOwn(value, "text")) &&
  optional(value, "label", text) &&
  optional(value, "text", text) &&
  optional(value, "href", (href) =>
    settings({ footer: { links: [{ label: "destination", href }] } }),
  )
const hero = (value: unknown) =>
  object(value, ["title", "tagline", "description", "actions", "image"]) &&
  text(value.title) &&
  optional(value, "tagline", text) &&
  optional(value, "description", text) &&
  optional(value, "actions", (actions) => settings({ footer: { links: actions } })) &&
  optional(value, "image", (image) =>
    settings({ brand: { label: "image", href: "/", logo: image } }),
  )

/** Enforce upstream hero/banner and reserved SEO shapes before page rendering. */
export function admitPagePresentation(page: SitePage): void {
  if ((page.banner != null && !banner(page.banner)) || (page.hero != null && !hero(page.hero))) {
    throw new Error("Invalid DocShell page decoration")
  }
  if (Object.hasOwn(page.metadata, "seo")) admitPresentation({ metadata: page.metadata.seo })
}

/** Resolve explicit page SEO overrides, then page description, then site defaults. */
export function pageMetadata(
  page: SitePage | undefined,
  site: PresentationSettings,
): NonNullable<PresentationSettings["metadata"]> {
  const local =
    page && Object.hasOwn(page.metadata, "seo")
      ? admitPresentation({ metadata: page.metadata.seo }).metadata
      : undefined
  return {
    ...site.metadata,
    ...local,
    description: local?.description ?? page?.description ?? site.metadata?.description,
  }
}

/** Validate only upstream-reserved navigation presentation fields; host metadata stays opaque. */
export function admitNavigationPresentation(items: NavigationItem[]): void {
  for (const item of items) {
    const meta = item.meta ?? {}
    if (
      (Object.hasOwn(meta, "badge") && !text(meta.badge, 256)) ||
      (Object.hasOwn(meta, "collapsed") &&
        (item.path !== "" || typeof meta.collapsed !== "boolean"))
    ) {
      throw new Error("Invalid DocShell navigation presentation")
    }
    if (item.children) admitNavigationPresentation(item.children)
  }
}
