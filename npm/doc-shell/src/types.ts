// The `doc-shell/v1` and `doc-shell/v2` presentation contracts. Producers
// do not agree on every key: `doc_shell`'s StaticGenerator emits `kind`,
// `meta`, and `tokens`; a host's GraphProjector emits none of the three. A field
// only one producer sends is therefore optional here — that is the contract, not
// an oversight. Keys both producers always send stay required, even when the
// value is null.
//
// `test/conformance.test.ts` holds both producers' real output against these
// types. Move one side without the other and it fails.

export type DocAstNode = string | DocAstElement

export interface DocAstElement {
  tag: string
  /** Upstream permits JSON values; renderers admit supported string attributes only. */
  attrs?: Record<string, unknown>
  content?: DocAstNode[] | string
  /** Parser metadata (source line, and so on). Opaque to the renderer. */
  meta?: Record<string, unknown>
}

export interface NavigationItem {
  id: string
  title: string
  path: string
  children?: NavigationItem[]
  /** Entry class, e.g. `"module"` or `"guide"`. StaticGenerator only. */
  kind?: string | null
  /** Producer-defined extras. StaticGenerator only; opaque to the renderer. */
  meta?: Record<string, unknown>
}

export interface SearchEntry {
  id: string
  title: string
  content: string
  path: string
  /** Null when the producer does not scope entries by audience. */
  audience: string | null
  /** Null when the producer does not scope entries by locale. */
  locale: string | null
  /** Entry class, mirroring `NavigationItem.kind`. StaticGenerator only. */
  kind?: string | null
  /**
   * Pre-split content tokens. StaticGenerator only. The deterministic browser
   * search does not require them, but consumers may reuse them when present.
   */
  tokens?: string[]
}

export interface Backlink {
  id: string
  title: string
  path: string
}

export interface DocShellPresentation {
  schema_version: "doc-shell/v1" | "doc-shell/v2"
  navigation: NavigationItem[]
  search: SearchEntry[]
  content: Record<string, DocAstNode[]>
  backlinks?: Record<string, Backlink[]>
  publication?: PublicationBinding
}

/** Immutable host declaration owned by DocShell.Presentation.HostedPair. */
export interface PublicationBinding {
  schema_version: "doc-shell-publication/v1"
  publication_id: string
  source_view: string
  graph_position: string
  locale: string
  release: string
  disclosure_surface: string
}

export type PresentationSource = () => DocShellPresentation | Promise<DocShellPresentation>

export interface DocShellTheme {
  accent?: string
  background?: string
  border?: string
  foreground?: string
  muted?: string
  radius?: string
}

export interface JsonSchema {
  /**
   * OpenAPI 3.0 writes a single type plus `nullable`; 3.1 writes a JSON Schema
   * type array, `["string", "null"]`. AshOaskit emits both dialects, so both
   * shapes reach `typeLabel`.
   */
  type?: string | string[]
  format?: string
  description?: string
  enum?: unknown[]
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: string[]
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  allOf?: JsonSchema[]
  nullable?: boolean
  example?: unknown
}

export interface Operation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: Array<{ name: string; in: string; required?: boolean; description?: string }>
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> }
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { schema?: JsonSchema }> }
  >
}

export interface OpenApiDocument {
  openapi?: string
  "x-doc-shell-publication"?: PublicationBinding
  info?: { title?: string; version?: string; description?: string }
  paths?: Record<
    string,
    Partial<Record<"get" | "post" | "put" | "patch" | "delete" | "options" | "head", Operation>>
  >
}

export interface OperationEntry {
  id: string
  method: string
  path: string
  tags: string[]
  operation: Operation
}

export interface SiteLink {
  title: string
  path: string
}

export interface SiteHeading {
  id: string
  title: string
  level: number
}

export interface CapabilityRequirement {
  feature_id: string
  acceptable_states: Array<"fallback" | "enhanced" | "connected">
  "essential?": boolean
  fallback_digest?: string | null
}

export interface SiteSearchEntry {
  id: string
  page_id: string
  route: string
  title: string
  section?: string | null
  text: string
  locale: string
  audience?: string | string[] | null
  kind: string
  collection: string
  version: string
  tags: string[]
  status?: string | null
}

export interface SitePage {
  id: string
  collection_id: string
  document_id: string
  kind: string
  route: string
  title: string
  description?: string | null
  locale: string
  audience?: string | string[] | null
  template: "document" | "splash"
  content: DocAstNode[]
  content_digest: string
  canonical_url?: string | null
  source_url?: string | null
  edit_url?: string | null
  source_revision: string
  source_path?: string | null
  package_version: string
  last_modified?: string | null
  status?: string | null
  breadcrumbs: SiteLink[]
  headings: SiteHeading[]
  previous?: SiteLink | null
  next?: SiteLink | null
  tags: string[]
  metadata: Record<string, unknown>
  "navigation?": boolean
  "search?": boolean
  banner?: Record<string, unknown> | null
  hero?: Record<string, unknown> | null
  requirements: CapabilityRequirement[]
}

export interface DocShellSite {
  schema_version: "doc-shell-site/v1"
  generation_id: string
  cohort_digest: string
  profile: string
  title: string
  base_path: string
  default_locale: string
  locales: string[]
  pages: Record<string, SitePage>
  routes: Record<string, string>
  navigation: NavigationItem[]
  search: SiteSearchEntry[]
  redirects: Record<string, string>
  metadata: Record<string, unknown>
  presentation?: PresentationSettings
}

/** Inert host data owned by DocShell.Presentation.Settings upstream. */
export interface PresentationSettings {
  brand?: { label: string; href: string; logo?: { asset: string; alt: string } }
  footer?: { text?: string; links?: Array<{ label: string; href: string }> }
  labels?: Record<string, string>
  locales?: PresentationDestination[]
  releases?: PresentationDestination[]
  metadata?: { description?: string; image?: string; robots?: string[] }
  robots?: { allow?: string[]; disallow?: string[] }
}

export interface PresentationDestination {
  id: string
  label: string
  href: string
  current?: boolean
}
