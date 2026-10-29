<script lang="ts">
import RecursiveSidebar from "./sidebar.svelte"
import type { NavigationItem } from "./types.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  items: NavigationItem[]
  currentPath?: string
  navigate?: (path: string) => void
  nested?: boolean
}
const { items, currentPath = "", navigate, nested = false }: Props = $props()
const currentBranch = (item: NavigationItem): boolean =>
  item.path === currentPath || (item.children?.some(currentBranch) ?? false)
</script>
{#snippet branches()}<ul>{#each items as item (item.id)}{const link = $derived(safeLinkTarget(item.path))}<li>{#if item.path === ""}<details open={currentBranch(item)}><summary>{item.title}</summary><RecursiveSidebar items={item.children ?? []} {currentPath} {navigate} nested /></details>{:else}{#if link}<a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined} aria-current={item.path === currentPath ? "page" : undefined} onclick={(event) => { if (navigate && link.navigable) { event.preventDefault(); navigate(item.path) } }}>{item.title}</a>{:else}<span data-unsafe-link>{item.title}</span>{/if}{#if item.children?.length}<RecursiveSidebar items={item.children} {currentPath} {navigate} nested />{/if}{/if}</li>{/each}</ul>{/snippet}
{#if nested}{@render branches()}{:else}<nav aria-label="Documentation">{@render branches()}</nav>{/if}
<style>ul { list-style: none; margin: 0; padding: 0; } li :global(nav) { padding-left: .75rem; } a { display: block; padding: .35rem .5rem; border-radius: var(--doc-radius); color: inherit; text-decoration: none; } a:hover, a[aria-current="page"] { background: var(--doc-surface); color: var(--doc-accent); }</style>
