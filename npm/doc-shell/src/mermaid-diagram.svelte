<script lang="ts">
import { inheritLabels } from "./labels.js"
import { renderMermaid } from "./mermaid.js"

interface Props {
  anchorId?: string
  sourceId?: string
  code: string
}
const { code, anchorId, sourceId }: Props = $props()
let svg = $state("")
let error = $state("")
$effect(() => {
  const source = code
  let active = true
  svg = ""
  error = ""
  void renderMermaid(source)
    .then((result) => {
      if (active) svg = result
    })
    .catch((reason) => {
      if (active) error = reason instanceof Error ? reason.message : String(reason)
    })
  return () => {
    active = false
  }
})
const label = inheritLabels()
</script>

<figure id={anchorId} class="mermaid" data-testid="mermaid-diagram">
  <span id={sourceId}></span>{#if svg}<div>{@html svg}</div><details><summary>{label("diagram_source", "Diagram source")}</summary><pre><code>{code}</code></pre></details>{:else}<pre><code>{code}</code></pre><figcaption>{error ? label("diagram_unavailable", "Diagram unavailable; source retained") : label("diagram_source", "Diagram source")}</figcaption>{/if}
</figure>

<style>.mermaid { overflow: auto; margin: 1rem 0; padding: 1rem; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); text-align: center; } .mermaid :global(svg) { background: white; border-radius: .25rem; } figcaption { color: var(--doc-muted); }</style>
