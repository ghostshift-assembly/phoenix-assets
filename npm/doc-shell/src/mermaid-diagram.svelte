<script lang="ts">
interface Props {
  code: string
}
const { code }: Props = $props()
let svg = $state("")
let error = $state("")
$effect(() => {
  const source = code
  let active = true
  svg = ""
  error = ""
  void import("mermaid")
    .then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        layout: "dagre",
        theme: "default",
        look: "classic",
      })
      return mermaid.render(`doc-shell-${crypto.randomUUID()}`, source)
    })
    .then((result) => {
      if (active) svg = result.svg
    })
    .catch((reason) => {
      if (active) error = reason instanceof Error ? reason.message : String(reason)
    })
  return () => {
    active = false
  }
})
</script>

<figure class="mermaid" data-testid="mermaid-diagram">
  {#if svg}<div>{@html svg}</div><details><summary>Diagram source</summary><pre><code>{code}</code></pre></details>{:else}<pre><code>{code}</code></pre>{#if error}<figcaption>{error}</figcaption>{/if}{/if}
</figure>

<style>.mermaid { overflow: auto; margin: 1rem 0; padding: 1rem; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); text-align: center; } figcaption { color: var(--doc-muted); }</style>
