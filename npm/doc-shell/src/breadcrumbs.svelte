<script lang="ts">
import { inheritLabels } from "./labels.js"
import type { NavigationItem } from "./types.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  items: NavigationItem[]
}
const { items }: Props = $props()
const label = inheritLabels()
</script>
<nav aria-label={label("breadcrumbs", "Breadcrumb")}><ol>{#each items as item, index (item.id)}{const link = $derived(safeLinkTarget(item.path))}<li>{#if link}<a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined}>{item.title}</a>{:else}<span data-unsafe-link>{item.title}</span>{/if}{#if index < items.length - 1}<span aria-hidden="true">/</span>{/if}</li>{/each}</ol></nav>
<style>ol { display: flex; gap: .5rem; list-style: none; padding: 0; color: var(--doc-muted); font-size: .875rem; } li { display: flex; gap: .5rem; } a { color: inherit; }</style>
