<script lang="ts">
import { copyText } from "./browser/controllers.js"
import { highlight } from "./highlighter"

interface Props {
  code: string
  language?: string
}
const { code, language = "text" }: Props = $props()
let html = $state("")
let copyState = $state("Copy")
$effect(() => {
  // Two edits in quick succession can settle out of order; the flag drops
  // whichever result the component has already moved past.
  let current = true
  copyState = "Copy"
  void highlight(code, language)
    .then((value) => {
      if (current) html = value ?? ""
    })
    .catch(() => {
      if (current) html = ""
    })
  return () => {
    current = false
  }
})
</script>

<div class="code-block" data-language={language}>
  <button type="button" onclick={() => void copyText(code).then(() => { copyState = "Copied" }, () => { copyState = "Copy unavailable; select source" })}>{copyState}</button>
  {#if html}<div class="highlighted">{@html html}</div>{:else}<pre><code>{code}</code></pre>{/if}
</div>

<style>
  .code-block { position: relative; margin: 1rem 0; overflow: auto; border-radius: var(--doc-radius); background: var(--doc-surface); color: var(--doc-foreground); }
  button { position: absolute; z-index: 1; top: .5rem; right: .5rem; border: 1px solid var(--doc-border); border-radius: .25rem; background: var(--doc-background); color: inherit; cursor: pointer; }
  pre, :global(.shiki) { margin: 0; padding: 1rem; overflow: auto; }
  /* Shiki emits both themes as custom properties; the host's color-scheme
     picks a side, so a dark host needs no extra class or media query. */
  .code-block :global(.shiki),
  .code-block :global(.shiki span) {
    color: light-dark(var(--shiki-light), var(--shiki-dark));
    background-color: light-dark(var(--shiki-light-bg), var(--shiki-dark-bg));
  }
</style>
