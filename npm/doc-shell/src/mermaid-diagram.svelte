<script lang="ts">
import { onMount } from "svelte"

interface Props {
  code: string
}
const { code }: Props = $props()
let svg = $state("")
let error = $state("")
onMount(async () => {
  try {
    const mermaid = (await import("mermaid")).default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      layout: "dagre",
      theme: "default",
      look: "classic",
    })
    svg = (await mermaid.render(`doc-shell-${crypto.randomUUID()}`, code)).svg
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason)
  }
})
</script>

<figure class="mermaid" data-testid="mermaid-diagram">
  {#if svg}<div>{@html svg}</div>{:else if error}<pre>{code}</pre><figcaption>{error}</figcaption>{:else}<span>Rendering diagram…</span>{/if}
</figure>

<style>.mermaid { overflow: auto; margin: 1rem 0; padding: 1rem; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); text-align: center; } figcaption { color: var(--doc-muted); }</style>
