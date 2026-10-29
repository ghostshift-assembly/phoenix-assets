<script lang="ts">
import type { Snippet } from "svelte"
import type { DirectiveName } from "./directives.js"
import { inheritLabels } from "./labels.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  name: DirectiveName
  title?: string
  href?: string
  children?: Snippet
}
const { name, title, href, children }: Props = $props()
const textLabel = inheritLabels()
const label = $derived(
  title ??
    textLabel(
      `directive_${name.replaceAll("-", "_")}`,
      name.replaceAll("-", " ").replace(/^./, (value) => value.toUpperCase()),
    ),
)
const link = $derived(name === "link-card" ? safeLinkTarget(href) : undefined)
</script>

<section class:badge={name === "badge"} class="directive directive-{name}" data-directive={name}>
  {#if name === "accordion"}
    <details><summary>{title ?? textLabel("details", "Details")}</summary>{#if children}<div class="directive-content">{@render children()}</div>{/if}</details>
  {:else}
    <strong>{#if link}<a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined}>{label}</a>{:else}{label}{/if}</strong>
    {#if children}<div class="directive-content">{@render children()}</div>{/if}
  {/if}
</section>

<style>
  .directive { border: 1px solid var(--doc-border); border-radius: var(--doc-radius); margin: 1rem 0; padding: .875rem; }
  .directive-callout, .directive-update { border-left: .25rem solid var(--doc-accent); background: var(--doc-surface); }
  .directive-card-grid, .directive-steps, .directive-tabs { display: grid; gap: .75rem; }
  .badge { display: inline-block; margin: .2rem; padding: .15rem .5rem; font-size: .75rem; }
  summary { min-height: 2.75rem; width: 100%; border: 0; background: none; color: inherit; text-align: left; font-weight: 600; cursor: pointer; }
  .directive-content { margin-top: .5rem; }
</style>
