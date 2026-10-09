<script lang="ts">
import RecursiveJsonView from "./json-view.svelte"

interface Props {
  value: unknown
  name?: string
  depth?: number
}
const { value, name, depth = 0 }: Props = $props()
let open = $state(true)
$effect(() => {
  if (depth >= 1) open = false
})
const entries = $derived(value !== null && typeof value === "object" ? Object.entries(value) : [])
const preview = $derived(Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`)
</script>
{#if depth >= 12}<pre><code>{JSON.stringify(value, null, 2)}</code></pre>{:else if entries.length}
  <div class="json-row"><button type="button" onclick={() => (open = !open)} aria-expanded={open}>{open ? "▾" : "▸"} {name ? `${name}: ` : ""}{preview}</button>{#if open}<div class="children">{#each entries as [key, child] (key)}<RecursiveJsonView value={child} name={key} depth={depth + 1} />{/each}</div>{/if}</div>
{:else}<div class="json-leaf">{#if name}<span class="key">{name}:</span>{/if} <code>{JSON.stringify(value)}</code></div>{/if}
<style>.json-row, .json-leaf { font-family: ui-monospace, monospace; font-size: .8rem; line-height: 1.6; } button { border: 0; background: none; color: inherit; cursor: pointer; } .children { border-left: 1px solid var(--doc-border); padding-left: 1rem; } .key { color: var(--doc-accent); }</style>
