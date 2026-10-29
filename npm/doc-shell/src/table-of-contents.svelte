<script lang="ts">
import { inheritLabels } from "./labels.js"

interface Props {
  items: Array<{ id: string; level: number; text: string }>
}
const { items }: Props = $props()
const label = inheritLabels()
</script>
<nav aria-label={label("on_this_page", "On this page")}><strong>{label("on_this_page", "On this page")}</strong><ul>{#each items as item (item.id)}<li style:padding-left={`${Math.max(0, item.level - 2) * .75}rem`}><a href={`#${item.id}`}>{item.text}</a></li>{/each}</ul></nav>
<style>ul { list-style: none; padding: 0; } li { margin: .4rem 0; } a { color: var(--doc-muted); text-decoration: none; font-size: .875rem; }</style>
