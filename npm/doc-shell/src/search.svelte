<script lang="ts">
import { querySearchRecords } from "./browser/search.js"
import type { SearchRecord } from "./browser/types.js"
import type { SearchEntry, SiteSearchEntry } from "./types.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  entries: Array<SearchEntry | SiteSearchEntry>
  navigate?: (path: string) => void
  search?: (
    query: string,
    entries: Array<SearchEntry | SiteSearchEntry>,
  ) => Array<SearchEntry | SiteSearchEntry> | Promise<Array<SearchEntry | SiteSearchEntry>>
}
const { entries, navigate, search }: Props = $props()
let open = $state(false)
let query = $state("")
let external = $state<Array<SearchEntry | SiteSearchEntry>>([])
let selected = $state(0)
let trigger = $state<HTMLSpanElement>()
let input = $state<HTMLInputElement>()
const records = $derived(entries.map(toRecord))
const results = $derived(
  search
    ? external.map(toRecord)
    : query.length >= 2
      ? querySearchRecords(records, query, {}, 10)
      : [],
)
$effect(() => {
  const runSearch = search
  const currentQuery = query
  const currentEntries = entries
  external = []
  if (!runSearch || currentQuery.length < 2) return

  let active = true
  void Promise.resolve()
    .then(() => runSearch(currentQuery, currentEntries))
    .then(
      (value) => {
        if (active) external = value
      },
      () => {
        if (active) external = []
      },
    )
  return () => {
    active = false
  }
})
const close = () => {
  open = false
  requestAnimationFrame(() => trigger?.querySelector<HTMLElement>("button")?.focus())
}
const show = () => {
  open = true
  selected = 0
  requestAnimationFrame(() => input?.focus())
}
const onKey = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault()
    show()
  }
}
const onDialogKey = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.preventDefault()
    close()
  } else if (event.key === "ArrowDown") {
    event.preventDefault()
    selected = Math.min(results.length - 1, selected + 1)
  } else if (event.key === "ArrowUp") {
    event.preventDefault()
    selected = Math.max(0, selected - 1)
  } else if (event.key === "Enter") {
    const item = results[selected]
    if (item) follow(item.route)
  }
}
const follow = (path: string) => {
  const link = safeLinkTarget(path)
  if (!link) return
  if (navigate && link.navigable) navigate(path)
  else location.assign(link.href)
  close()
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
<svelte:window onkeydown={onKey} />
<span bind:this={trigger}><button type="button" class="pa-button" onclick={show}>Search documentation</button></span>
{#if open}<div class="overlay" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) close() }}><dialog open aria-label="Search documentation" onkeydown={onDialogKey}><input bind:this={input} bind:value={query} role="combobox" aria-controls="doc-search-results" aria-expanded="true" aria-activedescendant={results[selected] ? `doc-search-${selected}` : undefined} placeholder="Search documentation…" /><ul id="doc-search-results" role="listbox">{#each results as item, index (item.id)}{const link = $derived(safeLinkTarget(item.route))}<li id={`doc-search-${index}`} role="option" aria-selected={index === selected}>{#if link}<a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined} onclick={(event) => { if (navigate && link.navigable) { event.preventDefault(); navigate(item.route) } close() }}><strong>{item.title}</strong>{#if item.section}<span>{item.section}</span>{/if}<small>{[item.collection, item.version].filter(Boolean).join(" · ")}</small></a>{:else}<span data-unsafe-link>{item.title}</span>{/if}</li>{/each}</ul><button type="button" class="pa-button" onclick={close}>Close</button></dialog></div>{/if}
<style>input { width: 100%; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); padding: .55rem .75rem; background: var(--doc-background); color: inherit; } .overlay { position: fixed; inset: 0; z-index: 10; display: grid; place-items: start center; padding-top: 12vh; background: rgb(0 0 0 / .35); } dialog { position: static; width: min(36rem, 90vw); margin: 0; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); background: var(--doc-background); color: inherit; } ul { list-style: none; padding: 0; } a { display: block; padding: .5rem; color: inherit; }</style>
