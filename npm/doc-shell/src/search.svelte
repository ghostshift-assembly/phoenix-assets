<script lang="ts">
import { mountSearch } from "./browser/controllers.js"
import { type PagefindContract, querySearchRecords } from "./browser/search.js"
import type { SearchRecord } from "./browser/types.js"
import type { SearchEntry, SiteSearchEntry } from "./types.js"

interface Props {
  id?: string
  entries: Array<SearchEntry | SiteSearchEntry>
  navigate?: (path: string) => void
  search?: (
    query: string,
    entries: Array<SearchEntry | SiteSearchEntry>,
  ) => Array<SearchEntry | SiteSearchEntry> | Promise<Array<SearchEntry | SiteSearchEntry>>
  presentation?: "dialog" | "inline"
  contract?: PagefindContract
  label?: string
  labels?: Record<string, string>
}
const uid = $props.id()
const {
  id = uid,
  entries,
  navigate,
  search,
  presentation = "dialog",
  contract,
  label = "Search documentation",
  labels = {},
}: Props = $props()
let root = $state<HTMLElement>()
const facets = $derived(
  (["locale", "collection", "version", "audience", "kind", "tag", "status"] as const)
    .map((name) => ({
      name,
      values: [
        ...new Set(
          entries
            .map(toRecord)
            .flatMap((record) =>
              name === "tag"
                ? record.tags
                : Array.isArray(record[name])
                  ? record[name]
                  : [record[name]],
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    }))
    .filter((facet) => facet.values.length > 0),
)
$effect(() => {
  if (!root) return
  const currentEntries = entries
  const currentSearch = search
  const controller = mountSearch(root, undefined, {
    records: () => currentEntries.map(toRecord),
    contract: () => contract,
    search: currentSearch
      ? async (query, filters) =>
          (await currentSearch(query, currentEntries))
            .map(toRecord)
            .filter((record) => querySearchRecords([record], "", filters).length > 0)
      : undefined,
    navigate,
  })
  controller.refresh()
  return () => controller.destroy()
})
const shortcut = (event: KeyboardEvent) => {
  if (
    !event.defaultPrevented &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault()
    root?.querySelector<HTMLButtonElement>("[data-doc-search-open]")?.click()
  }
}
function toRecord(entry: SearchEntry | SiteSearchEntry): SearchRecord {
  if ("page_id" in entry) return entry
  return {
    id: entry.id,
    page_id: entry.id,
    route: entry.path,
    title: entry.title,
    text: entry.content,
    locale: entry.locale ?? "",
    audience: entry.audience,
    kind: entry.kind ?? "document",
    collection: "",
    version: "",
    tags: [],
  }
}
</script>
<svelte:window onkeydown={shortcut} />
<div bind:this={root} class="doc-search">
  <button type="button" class="pa-button" data-doc-search-open>{label}</button>
  <svelte:element this={presentation === "dialog" ? "dialog" : "section"}
    class="doc-search-panel" class:doc-search-inline={presentation === "inline"}
    data-doc-search-dialog data-doc-search-owned data-doc-search-presentation={presentation}
    data-doc-search-error-label={labels.search_error}
    data-doc-search-empty-label={labels.search_empty}
    data-doc-search-result-label={labels.search_result}
    data-doc-search-results-label={labels.search_results}
    data-doc-search-loading-label={labels.search_loading}
    aria-label={label}>
    <label for={`${id}-query`}>{label}</label>
    <input id={`${id}-query`} data-doc-search-input role="combobox" aria-controls={`${id}-results`} aria-expanded="true" placeholder={`${label}…`} />
    {#each facets as facet (facet.name)}
      <label>{labels[`filter_${facet.name}`] ?? facet.name}<select data-doc-search-filter={facet.name}><option value="">{labels.filter_all ?? "All"}</option>{#each facet.values as value (value)}<option {value}>{value}</option>{/each}</select></label>
    {/each}
    <p role="status" aria-live="polite" data-doc-search-status></p>
    <ul id={`${id}-results`} role="listbox" data-doc-search-results></ul>
    <button type="button" class="pa-button" data-doc-search-close>{labels.close ?? "Close"}</button>
  </svelte:element>
</div>
<style>
  .doc-search-panel:not([open]) { display: none; }
  .doc-search-panel { width: min(36rem, 90vw); max-height: 80dvh; overflow: auto; padding: 1rem; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); background: var(--doc-background); color: var(--doc-foreground); }
  .doc-search-panel::backdrop { background: rgb(0 0 0 / .35); }
  .doc-search-inline { width: 100%; }
  input, select { width: 100%; padding: .55rem .75rem; border: 1px solid var(--doc-border); background: var(--doc-background); color: inherit; font: inherit; }
  ul { list-style: none; padding: 0; }
  ul :global(a) { display: block; padding: .5rem; color: inherit; }
  ul :global(small) { display: block; }
</style>
