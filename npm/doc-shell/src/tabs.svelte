<script lang="ts">
import { stringAttribute } from "./ast.js"
import AstRenderer from "./ast-renderer.svelte"
import { mountTabs } from "./browser/controllers.js"
import { inheritLabels } from "./labels.js"
import type { DocAstNode } from "./types.js"

const {
  nodes,
  title,
  legacyHeadingIds = true,
}: { nodes: DocAstNode[]; title?: string; legacyHeadingIds?: boolean } = $props()
const id = $props.id()
let root = $state<HTMLElement>()
$effect(() => {
  nodes
  if (!root) return
  const controller = mountTabs(root)
  controller.refresh()
  return () => controller.destroy()
})
const label = (node: DocAstNode, index: number) =>
  typeof node !== "string" && stringAttribute(node, "title")
    ? stringAttribute(node, "title")
    : `${textLabel("tab", "Tab")} ${index + 1}`
const textLabel = inheritLabels()
</script>
<section bind:this={root} class="doc-tabs">
  <div role="tablist" aria-label={title ?? textLabel("documentation_tabs", "Documentation tabs")}>{#each nodes as node, index (index)}<button class="pa-button" type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={index === 0} tabindex={index === 0 ? 0 : -1}>{label(node, index)}</button>{/each}</div>
  {#each nodes as node, index (index)}<div role="tabpanel" tabindex="0" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`}><h3>{label(node, index)}</h3><AstRenderer nodes={[node]} {legacyHeadingIds} /></div>{/each}
</section>
<style>[role="tablist"] { display: flex; flex-wrap: wrap; gap: .25rem; } [role="tabpanel"] { padding: .75rem; border: 1px solid var(--doc-border); }</style>
