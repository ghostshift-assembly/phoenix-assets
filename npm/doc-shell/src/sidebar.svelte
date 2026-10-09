<script lang="ts">
import RecursiveSidebar from "./sidebar.svelte"
import type { NavigationItem } from "./types.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  items: NavigationItem[]
  currentPath?: string
  navigate?: (path: string) => void
}
const { items, currentPath = "", navigate }: Props = $props()
</script>
<nav aria-label="Documentation"><ul>{#each items as item (item.id)}{const link = $derived(safeLinkTarget(item.path))}<li>{#if link}<a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined} aria-current={item.path === currentPath ? "page" : undefined} onclick={(event) => { if (navigate && link.navigable) { event.preventDefault(); navigate(item.path) } }}>{item.title}</a>{:else}<span data-unsafe-link>{item.title}</span>{/if}{#if item.children?.length}<RecursiveSidebar items={item.children} {currentPath} {navigate} />{/if}</li>{/each}</ul></nav>
<style>ul { list-style: none; margin: 0; padding: 0; } li :global(nav) { padding-left: .75rem; } a { display: block; padding: .35rem .5rem; border-radius: var(--doc-radius); color: inherit; text-decoration: none; } a:hover, a[aria-current="page"] { background: var(--doc-surface); color: var(--doc-accent); }</style>
