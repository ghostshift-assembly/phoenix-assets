<script lang="ts">
import type { Snippet } from "svelte"
import { admitPage } from "./admission.js"
import AstRenderer from "./ast-renderer.svelte"
import { mountBrowserCore } from "./browser/index.js"
import type { PagefindContract } from "./browser/search.js"
import { searchLabel } from "./browser/search.js"
import { admitPresentation, presentationLabel } from "./presentation.js"
import Search from "./search.svelte"
import Sidebar from "./sidebar.svelte"
import type { DocShellSite } from "./types.js"
import { safeLinkTarget } from "./url.js"

let {
  site,
  pageId,
  navigate,
  searchContract,
  brand,
  footer,
  assetUrls = {},
}: {
  site: DocShellSite
  pageId: string
  navigate?: (path: string) => void
  searchContract?: PagefindContract
  brand?: Snippet<[DocShellSite]>
  footer?: Snippet<[DocShellSite]>
  assetUrls?: Record<string, string>
} = $props()
const settings = $derived(admitPresentation(site.presentation))
const label = (key: string, fallback: string) => presentationLabel(settings, key, fallback)
const brandLogo = $derived.by(() => {
  const target = safeLinkTarget(assetUrls[settings.brand?.logo?.asset ?? ""])
  return target?.href.startsWith("mailto:") ? undefined : target?.href
})
const page = $derived.by(() => {
  const current = site.pages[pageId]
  if (current) admitPage(current)
  return current
})
const description = $derived(page?.description ?? settings.metadata?.description)
const homePath = $derived(
  site.routes[site.base_path] ? site.base_path : (Object.keys(site.routes).sort()[0] ?? "/"),
)
let shellRoot = $state<HTMLElement>()

$effect(() => {
  const root = shellRoot
  if (!root) return
  const controller = mountBrowserCore(root)
  return () => controller.destroy()
})
</script>

<svelte:head>
  <title>{page?.title ?? label("not_found", "Page not found")} · {site.title}</title>
  {#if description}<meta name="description" content={description} /><meta property="og:description" content={description} />{/if}
  <meta property="og:title" content={page?.title ?? label("not_found", "Page not found")} />
  <meta property="og:site_name" content={site.title} />
  <meta property="og:locale" content={page?.locale ?? site.default_locale} />
  {#if page?.canonical_url}<link rel="canonical" href={page.canonical_url} /><meta property="og:url" content={page.canonical_url} />{/if}
  {#if settings.metadata?.image}<meta property="og:image" content={settings.metadata.image} />{/if}
  {#if settings.metadata?.robots?.length}<meta name="robots" content={settings.metadata.robots.join(", ")} />{/if}
</svelte:head>
{#key Boolean(page)}
<div
  bind:this={shellRoot}
  class="doc-shell pa-doc-shell"
  data-pa-doc-shell
  data-doc-theme="system"
  data-schema-version={site.schema_version}
  data-cohort-digest={site.cohort_digest}
  data-content-digest={page?.content_digest}
  dir={/^(ar|fa|he|ur)(?:[-_]|$)/i.test(page?.locale ?? site.default_locale) ? "rtl" : "ltr"}
  lang={page?.locale ?? site.default_locale}
>
  <a class="skip-link" href="#doc-main">{label("skip", "Skip to documentation")}</a>
  <header class="site-header">
    {#if brand}{@render brand(site)}{:else}<a href={settings.brand?.href ?? homePath} class="brand">{#if brandLogo && settings.brand?.logo}<img src={brandLogo} alt={settings.brand.logo.alt} />{/if}{settings.brand?.label ?? site.title}</a>{/if}
    <Search entries={site.search} {navigate} contract={searchContract} label={label("search", searchLabel(page?.locale ?? site.default_locale))} labels={settings.labels} />
    {#each [["locales", "language", "Language"], ["releases", "release", "Version"]] as [key, name, fallback]}
      {#if (key === "locales" ? settings.locales : settings.releases)?.length}<nav class="site-selector" aria-label={label(name ?? "", fallback ?? "")}><ul>{#each (key === "locales" ? settings.locales : settings.releases) ?? [] as choice (choice.id)}<li><a href={choice.href} aria-current={choice.current ? "true" : undefined} hreflang={key === "locales" ? choice.id : undefined}>{choice.label}</a></li>{/each}</ul></nav>{/if}
    {/each}
    <div class="header-actions" aria-label={label("reader_preferences", "Reader preferences")}>
      {#each [["system", "System"], ["light", "Light"], ["dark", "Dark"], ["contrast", "High contrast"]] as [value, fallback]}
        <button type="button" class="pa-button" data-pa-variant="secondary" data-doc-theme-value={value}>{label(`theme_${value}`, fallback ?? "")}</button>
      {/each}
    </div>
  </header>
  <button type="button" class="pa-button mobile-nav" data-doc-nav-toggle aria-controls="doc-navigation" aria-expanded="false">{label("browse", "Browse documentation")}</button>
  <div class="site-layout">
    <dialog id="doc-navigation" class="sidebar" data-doc-nav open aria-label={label("navigation", "Documentation navigation")}><button type="button" class="pa-button" data-doc-nav-close hidden>{label("close_navigation", "Close navigation")}</button><Sidebar items={site.navigation} currentPath={page?.route ?? ""} {navigate} label={label("documentation", "Documentation")} /></dialog>
    <main id="doc-main" tabindex="-1" data-pagefind-body>
      {#if page}
        {#if page.banner}<aside class="pa-callout" role="note"><strong>{String(page.banner["label"] ?? "Notice")}</strong></aside>{/if}
        <nav aria-label={label("breadcrumbs", "Breadcrumbs")}><ol class="breadcrumbs">{#each page.breadcrumbs as item}<li><a href={item.path}>{item.title}</a></li>{/each}</ol></nav>
        <header class="page-header">
          <p>{page.collection_id} · {page.package_version}</p><h1>{page.title}</h1>
          {#if page.description}<p>{page.description}</p>{/if}
          <div class="badges">{#if page.status}<span class="pa-status">{page.status}</span>{/if}{#each page.tags as tag}<span class="pa-status">{tag}</span>{/each}</div>
        </header>
        <article><AstRenderer nodes={page.content} legacyHeadingIds={false} /></article>
        {#if page.previous || page.next}<nav aria-label={label("continue_reading", "Continue reading")} class="reading-flow">
          {#if page.previous}<a rel="prev" href={page.previous.path}>← {page.previous.title}</a>{/if}
          {#if page.next}<a rel="next" href={page.next.path}>{page.next.title} →</a>{/if}
        </nav>{/if}
        <div class="provenance" role="contentinfo" aria-label={label("provenance", "Page provenance")}>
          {#if page.last_modified}<span>{label("updated", "Updated")} {page.last_modified}</span>{/if}
          {#if page.source_url}<a href={page.source_url}>{label("view_source", "View source")}</a>{/if}
          {#if page.edit_url}<a href={page.edit_url}>{label("edit_page", "Edit this page")}</a>{/if}
        </div>
      {:else}
        <h1>{label("not_found", "Page not found")}</h1><p>{label("not_found_description", "The requested documentation page is not part of this site generation.")}</p>
        <a href={homePath} class="pa-button" onclick={(event) => { if (navigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(homePath) } }}>{label("home", "Documentation home")}</a>
      {/if}
    </main>
    {#if page}<aside class="toc"><details open><summary>{label("on_this_page", "On this page")}</summary><nav aria-label={label("on_this_page", "On this page")}><ol>{#each page.headings as heading}<li data-level={heading.level}><a href={`#${heading.id}`}>{heading.title}</a></li>{/each}</ol></nav></details></aside>{/if}
  </div>
  {#if footer || settings.footer}<footer class="site-footer" aria-label={label("footer", "Site footer")}>{#if footer}{@render footer(site)}{:else}{#if settings.footer?.text}<p>{settings.footer.text}</p>{/if}{#each settings.footer?.links ?? [] as link}<a href={link.href}>{link.label}</a>{/each}{/if}</footer>{/if}
</div>
{/key}

<style>
  .pa-doc-shell { min-height: 100dvh; background: var(--pa-semantic-color-canvas); color: var(--pa-semantic-color-text); }
  .skip-link { position: fixed; z-index: 100; inset-block-start: .5rem; inset-inline-start: .5rem; padding: .6rem; background: var(--pa-semantic-color-accent); color: var(--pa-semantic-color-accent-text); transform: translateY(-150%); }
  .skip-link:focus { transform: none; }
  .site-header { position: sticky; z-index: 20; inset-block-start: 0; display: flex; align-items: center; gap: 1rem; min-height: 4rem; padding: .6rem 1rem; border-block-end: 1px solid var(--pa-semantic-color-border); background: var(--pa-semantic-color-canvas); }
  .brand img { max-height: 2rem; max-width: 8rem; vertical-align: middle; margin-inline-end: .5rem; }
  .site-selector ul, .site-footer { display: flex; flex-wrap: wrap; gap: .5rem 1rem; padding: 1rem; list-style: none; }
  .site-footer { justify-content: center; }
  .brand { margin-inline-end: auto; color: inherit; font-weight: 750; text-decoration: none; }
  .header-actions, .badges, .provenance, .reading-flow { display: flex; flex-wrap: wrap; gap: .5rem 1rem; }
  .site-layout { display: grid; grid-template-columns: minmax(13rem, 18rem) minmax(0, 46rem) minmax(10rem, 14rem); justify-content: center; gap: clamp(1rem, 4vw, 3rem); padding: 1.25rem; }
  .sidebar, .toc { position: sticky; inset-block-start: 5.25rem; align-self: start; max-height: calc(100vh - 6rem); overflow: auto; }
  main { min-width: 0; }
  .page-header { margin-block-end: 2rem; }
  .page-header h1 { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.08; }
  article { overflow-wrap: anywhere; }
  .breadcrumbs { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0; list-style: none; }
  .reading-flow { justify-content: space-between; margin-block: 3rem 1.5rem; padding-block: 1rem; border-block: 1px solid var(--pa-semantic-color-border); }
  .provenance { color: var(--pa-semantic-color-muted); }
  .toc ol { padding-inline-start: 1.25rem; }
  .toc li[data-level="3"] { margin-inline-start: .75rem; }
  .mobile-nav { display: none; margin: 1rem; }
  @media (max-width: 70rem) { .site-layout { grid-template-columns: minmax(12rem, 17rem) minmax(0, 46rem); } .toc { position: static; grid-column: 2; grid-row: 1; max-height: none; } main { grid-column: 2; } }
  @media (max-width: 48rem) { .site-header { flex-wrap: wrap; position: static; } .header-actions { width: 100%; } .mobile-nav { display: inline-flex; } .site-layout { display: flex; flex-direction: column; padding: 1rem; } main { order: 2; } .sidebar { position: static; max-height: none; margin-block-end: 1rem; } :global([data-doc-nav][data-doc-nav-state="closed"]) { display: none; } .toc { order: 1; margin-block-end: 1.5rem; } }
  @media (max-width: 20rem) { .site-header, .site-layout { padding-inline: .5rem; } .header-actions > * { flex: 1; } }
</style>
