<script lang="ts">
import AstRenderer from "./ast-renderer.svelte"
import { mountBrowserCore } from "./browser/index.js"
import type { PagefindContract } from "./browser/search.js"
import Search from "./search.svelte"
import Sidebar from "./sidebar.svelte"
import type { DocShellSite } from "./types.js"

let {
  site,
  pageId,
  navigate,
  searchContract,
}: {
  site: DocShellSite
  pageId: string
  navigate?: (path: string) => void
  searchContract?: PagefindContract
} = $props()
const page = $derived(site.pages[pageId])
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

{#if page}
  <div
    bind:this={shellRoot}
    class="doc-shell pa-doc-shell"
    data-pa-doc-shell
    data-doc-theme="system"
    data-schema-version={site.schema_version}
    data-cohort-digest={site.cohort_digest}
    dir={/^(ar|fa|he|ur)(?:[-_]|$)/i.test(page.locale) ? "rtl" : "ltr"}
    lang={page.locale}
  >
    <a class="skip-link" href="#doc-main">Skip to documentation</a>
    <header class="site-header">
      <a href={homePath} class="brand">{site.title}</a>
      <Search entries={site.search} {navigate} contract={searchContract} />
      <div class="header-actions" aria-label="Reader preferences">
        <button type="button" class="pa-button" data-pa-variant="secondary" data-doc-theme-value="system">System</button>
        <button type="button" class="pa-button" data-pa-variant="secondary" data-doc-theme-value="light">Light</button>
        <button type="button" class="pa-button" data-pa-variant="secondary" data-doc-theme-value="dark">Dark</button>
        <button type="button" class="pa-button" data-pa-variant="secondary" data-doc-theme-value="contrast">High contrast</button>
      </div>
    </header>
    <button type="button" class="pa-button mobile-nav" data-doc-nav-toggle aria-controls="doc-navigation" aria-expanded="false">Browse documentation</button>
    <div class="site-layout">
      <dialog id="doc-navigation" class="sidebar" data-doc-nav open aria-label="Documentation navigation"><button type="button" class="pa-button" data-doc-nav-close hidden>Close navigation</button><Sidebar items={site.navigation} currentPath={page.route} {navigate} /></dialog>
      <main id="doc-main" tabindex="-1">
        {#if page.banner}<aside class="pa-callout" role="note"><strong>{String(page.banner["label"] ?? "Notice")}</strong></aside>{/if}
        <nav aria-label="Breadcrumbs"><ol class="breadcrumbs">{#each page.breadcrumbs as item}<li><a href={item.path}>{item.title}</a></li>{/each}</ol></nav>
        <header class="page-header">
          <p>{page.collection_id} · {page.package_version}</p>
          <h1>{page.title}</h1>
          {#if page.description}<p>{page.description}</p>{/if}
          <div class="badges">{#if page.status}<span class="pa-status">{page.status}</span>{/if}{#each page.tags as tag}<span class="pa-status">{tag}</span>{/each}</div>
        </header>
        <article><AstRenderer nodes={page.content} legacyHeadingIds={false} /></article>
        {#if page.previous || page.next}<nav aria-label="Continue reading" class="reading-flow">
          {#if page.previous}<a rel="prev" href={page.previous.path}>← {page.previous.title}</a>{/if}
          {#if page.next}<a rel="next" href={page.next.path}>{page.next.title} →</a>{/if}
        </nav>{/if}
        <footer class="provenance">
          {#if page.last_modified}<span>Updated {page.last_modified}</span>{/if}
          {#if page.source_url}<a href={page.source_url}>View source</a>{/if}
          {#if page.edit_url}<a href={page.edit_url}>Edit this page</a>{/if}
        </footer>
      </main>
      <aside class="toc">
        <details open><summary>On this page</summary><nav aria-label="On this page"><ol>{#each page.headings as heading}<li data-level={heading.level}><a href={`#${heading.id}`}>{heading.title}</a></li>{/each}</ol></nav></details>
      </aside>
    </div>
  </div>
{:else}
  <section bind:this={shellRoot} data-pa-doc-shell class="doc-shell pa-doc-shell">
    <a class="skip-link" href="#doc-main">Skip to documentation</a>
    <header class="site-header">
      <a href={homePath} class="brand">{site.title}</a>
      <Search entries={site.search} {navigate} contract={searchContract} />
      <div class="header-actions" aria-label="Reader preferences">
        <button type="button" class="pa-button" data-doc-theme-value="system">System</button>
        <button type="button" class="pa-button" data-doc-theme-value="light">Light</button>
        <button type="button" class="pa-button" data-doc-theme-value="dark">Dark</button>
        <button type="button" class="pa-button" data-doc-theme-value="contrast">High contrast</button>
      </div>
    </header>
    <button type="button" class="pa-button mobile-nav" data-doc-nav-toggle aria-controls="doc-navigation" aria-expanded="false">Browse documentation</button>
    <div class="site-layout">
      <dialog id="doc-navigation" class="sidebar" data-doc-nav open aria-label="Documentation navigation"><button type="button" class="pa-button" data-doc-nav-close hidden>Close navigation</button><Sidebar items={site.navigation} currentPath="" {navigate} /></dialog>
      <main id="doc-main" tabindex="-1">
        <h1>Page not found</h1><p>The requested documentation page is not part of this site generation.</p>
        <a href={homePath} class="pa-button" onclick={(event) => { if (navigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(homePath) } }}>Documentation home</a>
      </main>
    </div>
  </section>
{/if}

<style>
  .pa-doc-shell { min-height: 100dvh; background: var(--pa-semantic-color-canvas); color: var(--pa-semantic-color-text); }
  .skip-link { position: fixed; z-index: 100; inset-block-start: .5rem; inset-inline-start: .5rem; padding: .6rem; background: var(--pa-semantic-color-accent); color: var(--pa-semantic-color-accent-text); transform: translateY(-150%); }
  .skip-link:focus { transform: none; }
  .site-header { position: sticky; z-index: 20; inset-block-start: 0; display: flex; align-items: center; gap: 1rem; min-height: 4rem; padding: .6rem 1rem; border-block-end: 1px solid var(--pa-semantic-color-border); background: var(--pa-semantic-color-canvas); }
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
  @media (max-width: 48rem) { .site-header { flex-wrap: wrap; position: static; } .header-actions { width: 100%; } .mobile-nav { display: inline-flex; } .site-layout { display: block; padding: 1rem; } .sidebar { position: static; max-height: none; margin-block-end: 1rem; } :global([data-doc-nav][data-doc-nav-state="closed"]) { display: none; } .toc { margin-block-end: 1.5rem; } }
  @media (max-width: 20rem) { .site-header, .site-layout { padding-inline: .5rem; } .header-actions > * { flex: 1; } }
</style>
