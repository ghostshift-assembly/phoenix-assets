<script lang="ts">
import { inheritLabels } from "./labels.js"
import type { Backlink } from "./types.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  items: Backlink[]
}
const { items }: Props = $props()
const label = inheritLabels()
</script>
{#if items.length}<section><h2>{label("referenced_by", "Referenced by")}</h2><ul>{#each items as item (item.id)}{const link = $derived(safeLinkTarget(item.path))}<li>{#if link}<a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined}>{item.title}</a>{:else}<span data-unsafe-link>{item.title}</span>{/if}</li>{/each}</ul></section>{/if}
<style>section { margin-top: 2rem; border-top: 1px solid var(--doc-border); } h2 { font-size: 1rem; } a { color: var(--doc-accent); }</style>
