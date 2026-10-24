<script lang="ts">
import {
  admittedAttributes,
  extractText,
  headingId,
  preCodeInfo,
  projectedHeadingId,
  safeMediaTarget,
} from "./ast.js"
import RecursiveAstRenderer from "./ast-renderer.svelte"
import CodeBlock from "./code-block.svelte"
import Directive from "./directive.svelte"
import { isDirective } from "./directives.js"
import MermaidDiagram from "./mermaid-diagram.svelte"
import Tabs from "./tabs.svelte"
import type { DocAstNode } from "./types.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  nodes: DocAstNode[] | string | null
  legacyHeadingIds?: boolean
}
const { nodes, legacyHeadingIds = true }: Props = $props()
const list = $derived(!nodes ? [] : typeof nodes === "string" ? [nodes] : nodes)
</script>

{#each list as node, index (index)}
  {#if typeof node === "string"}{node}
  {:else if node.tag === "tabs" || node.tag === "code-group"}
    <Tabs nodes={Array.isArray(node.content) ? node.content : []} title={node.attrs?.title} {legacyHeadingIds} />
  {:else if node.tag === "steps"}
    <ol class="doc-steps">{#each Array.isArray(node.content) ? node.content : [] as step, stepIndex (stepIndex)}<li>{#if typeof step !== "string" && step.tag === "step"}{#if step.attrs?.title}<h3>{step.attrs.title}</h3>{/if}<RecursiveAstRenderer nodes={step.content ?? null} {legacyHeadingIds} />{:else}<RecursiveAstRenderer nodes={[step]} {legacyHeadingIds} />{/if}</li>{/each}</ol>
  {:else if node.tag === "step"}<li>{#if node.attrs?.title}<h3>{node.attrs.title}</h3>{/if}<RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></li>
  {:else if node.tag === "mermaid"}<MermaidDiagram code={extractText(node.content)} />
  {:else if isDirective(node.tag)}
    <Directive name={node.tag} title={node.attrs?.title}>{#snippet children()}<RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} />{/snippet}</Directive>
  {:else if node.tag === "pre"}
    {const info = $derived(preCodeInfo(node))}
    {#if info?.language === "mermaid"}<MermaidDiagram code={info.code} />{:else if info}<CodeBlock code={info.code} language={info.language} />{:else}<pre><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></pre>{/if}
  {:else if /^h[1-6]$/.test(node.tag)}
    <svelte:element this={node.tag as "h1"} id={projectedHeadingId(node) ?? (legacyHeadingIds ? headingId(node.content) : undefined)}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></svelte:element>
  {:else if ["p", "ul", "ol", "li", "blockquote", "strong", "em", "table", "thead", "tbody", "tr", "th", "td", "code", "b", "i", "tfoot", "figure", "figcaption", "details", "summary", "dl", "dt", "dd", "kbd", "mark", "sub", "sup", "del", "s"].includes(node.tag)}
    <svelte:element this={node.tag as "p"} {...admittedAttributes(node)}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></svelte:element>
  {:else if node.tag === "a"}
    {const link = $derived(safeLinkTarget(node.attrs?.href))}
    {#if link}<a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></a>{:else}<span data-unsafe-link><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></span>{/if}
  {:else if node.tag === "img"}
    {const src = $derived(safeMediaTarget(node.attrs?.src))}
    {#if src}<img {src} alt={node.attrs?.alt ?? ""} title={node.attrs?.title} loading="lazy" />{:else}<span data-unsafe-media>{node.attrs?.alt ?? "Image"}</span>{/if}
  {:else if node.tag === "br"}<br />{:else if node.tag === "hr"}<hr />
  {:else}<div data-unknown-tag={node.tag}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></div>{/if}
{/each}

<style>
  :global(.doc-shell p) { line-height: 1.7; }
  :global(.doc-shell a) { color: var(--doc-accent); }
  :global(.doc-shell table) { width: 100%; border-collapse: collapse; }
  :global(.doc-shell th), :global(.doc-shell td) { border: 1px solid var(--doc-border); padding: .45rem; text-align: left; }
</style>
