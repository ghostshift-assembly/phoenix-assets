<script lang="ts">
import { extractToc } from "./ast.js"
import AstRenderer from "./ast-renderer.svelte"
import AudienceSwitcher from "./audience-switcher.svelte"
import Backlinks from "./backlinks.svelte"
import Breadcrumbs from "./breadcrumbs.svelte"
import { inheritLabels } from "./labels.js"
import LocaleSwitcher from "./locale-switcher.svelte"
import Search from "./search.svelte"
import Sidebar from "./sidebar.svelte"
import TableOfContents from "./table-of-contents.svelte"
import type { DocShellPresentation, DocShellTheme, NavigationItem } from "./types.js"

interface Props {
  presentation: DocShellPresentation
  currentId: string
  currentPath: string
  breadcrumbs?: NavigationItem[]
  audiences?: string[]
  audience?: string
  locales?: string[]
  locale?: string
  theme?: DocShellTheme
  navigate?: (path: string) => void
  onaudience?: (value: string) => void
  onlocale?: (value: string) => void
  labels?: Record<string, string>
}
const {
  presentation,
  currentId,
  currentPath,
  breadcrumbs = [],
  audiences = [],
  audience = "developer",
  locales = [],
  locale = "en",
  theme = {},
  navigate,
  onaudience,
  onlocale,
  labels,
}: Props = $props()
const label = inheritLabels(() => labels)
const nodes = $derived(presentation.content[currentId] ?? [])
const toc = $derived(extractToc(nodes))
const styles = $derived(
  Object.entries(theme)
    .map(([name, value]) => `--doc-${name.replaceAll("_", "-")}:${value}`)
    .join(";"),
)
</script>
<div class="doc-shell" style={styles} data-schema-version={presentation.schema_version}><header><Search entries={presentation.search} {navigate} {labels} label={label("search", "Search documentation")} />{#if audiences.length}<AudienceSwitcher {audiences} value={audience} onchange={onaudience} />{/if}{#if locales.length}<LocaleSwitcher {locales} value={locale} onchange={onlocale} />{/if}</header>{#if breadcrumbs.length}<Breadcrumbs items={breadcrumbs} />{/if}<div class="layout"><aside><Sidebar items={presentation.navigation} {currentPath} {navigate} label={label("documentation", "Documentation")} /></aside><main><AstRenderer {nodes} /><Backlinks items={presentation.backlinks?.[currentId] ?? []} /></main><aside class="toc"><TableOfContents items={toc} /></aside></div></div>
<style>.doc-shell { min-height: 100%; padding: 1rem; } header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; } .layout { display: grid; grid-template-columns: minmax(12rem, 17rem) minmax(0, 1fr) minmax(10rem, 14rem); gap: 2rem; } aside { min-width: 0; } @media (max-width: 60rem) { .layout { grid-template-columns: 1fr; } .layout > aside { display: none; } }</style>
