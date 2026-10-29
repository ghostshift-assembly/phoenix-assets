<script lang="ts">
import { artifactContext } from "./artifact-context.js"
import ArtifactView from "./artifact-view.svelte"
import {
  admittedAttributes,
  extractText,
  headingId,
  preCodeInfo,
  projectedHeadingId,
  safeMediaTarget,
  stringAttribute,
} from "./ast.js"
import RecursiveAstRenderer from "./ast-renderer.svelte"
import CodeBlock from "./code-block.svelte"
import Directive from "./directive.svelte"
import { isDirective } from "./directives.js"
import { inheritLabels } from "./labels.js"
import MermaidDiagram from "./mermaid-diagram.svelte"
import Tabs from "./tabs.svelte"
import type { DocAstNode } from "./types.js"
import { safeLinkTarget } from "./url.js"

interface Props {
  nodes: DocAstNode[] | string | null
  legacyHeadingIds?: boolean
  labels?: Record<string, string>
}
const { nodes, legacyHeadingIds = true, labels }: Props = $props()
inheritLabels(() => labels)
const artifacts = artifactContext()
const passive = $derived(artifacts()?.passive ?? false)
const requireArtifact = (node: Exclude<DocAstNode, string>) => {
  const view = artifacts()?.blocks.get(stringAttribute(node, "id") ?? "")
  if (!view) throw new Error("DocShell artifact receipt required before rendering")
  return view
}
const list = $derived(!nodes ? [] : typeof nodes === "string" ? [nodes] : nodes)
</script>

{#each list as node, index (index)}
  {#if typeof node === "string"}{node}
  {:else if node.tag === "artifact" && node.meta && Object.hasOwn(node.meta, "artifact")}
    <ArtifactView view={requireArtifact(node)}>{#snippet children()}<RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} />{/snippet}</ArtifactView>
  {:else if passive && (node.tag === "tabs" || node.tag === "code-group")}
    <section id={projectedHeadingId(node)} class="doc-tabs" data-doc-passive>{#each Array.isArray(node.content) ? node.content : [] as panel, panelIndex (panelIndex)}{#if typeof panel !== "string" && stringAttribute(panel, "title")}<h3>{stringAttribute(panel, "title")}</h3>{/if}<RecursiveAstRenderer nodes={[panel]} {legacyHeadingIds} />{/each}</section>
  {:else if node.tag === "tabs" || node.tag === "code-group"}
    <Tabs anchorId={projectedHeadingId(node)} nodes={Array.isArray(node.content) ? node.content : []} title={stringAttribute(node, "title")} {legacyHeadingIds} />
  {:else if node.tag === "steps"}
    <ol id={projectedHeadingId(node)} class="doc-steps">{#each Array.isArray(node.content) ? node.content : [] as step, stepIndex (stepIndex)}<li id={typeof step !== "string" && step.tag === "step" ? projectedHeadingId(step) : undefined}>{#if typeof step !== "string" && step.tag === "step"}{#if stringAttribute(step, "title")}<h3>{stringAttribute(step, "title")}</h3>{/if}<RecursiveAstRenderer nodes={step.content ?? null} {legacyHeadingIds} />{:else}<RecursiveAstRenderer nodes={[step]} {legacyHeadingIds} />{/if}</li>{/each}</ol>
  {:else if node.tag === "step"}<li id={projectedHeadingId(node)}>{#if stringAttribute(node, "title")}<h3>{stringAttribute(node, "title")}</h3>{/if}<RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></li>
  {:else if node.tag === "mermaid"}{#if passive}<figure id={projectedHeadingId(node)} class="doc-mermaid" data-doc-passive><pre><code>{extractText(node.content)}</code></pre></figure>{:else}<MermaidDiagram anchorId={projectedHeadingId(node)} code={extractText(node.content)} />{/if}
  {:else if isDirective(node.tag)}
    <Directive anchorId={projectedHeadingId(node)} name={node.tag} title={stringAttribute(node, "title")} href={stringAttribute(node, "href")}>{#snippet children()}<RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} />{/snippet}</Directive>
  {:else if node.tag === "pre"}
    {const info = $derived(preCodeInfo(node))}
    {#if passive}<pre {...admittedAttributes(node)}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></pre>{:else if info?.language === "mermaid"}<MermaidDiagram anchorId={projectedHeadingId(node)} sourceId={info.sourceId} code={info.code} />{:else if info}<CodeBlock anchorId={projectedHeadingId(node)} sourceId={info.sourceId} code={info.code} language={info.language} />{:else}<pre {...admittedAttributes(node)}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></pre>{/if}
  {:else if /^h[1-6]$/.test(node.tag)}
    <svelte:element this={node.tag as "h1"} id={projectedHeadingId(node) ?? (legacyHeadingIds ? headingId(node.content) : undefined)}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></svelte:element>
  {:else if ["p", "span", "ul", "ol", "li", "blockquote", "strong", "em", "table", "thead", "tbody", "tr", "th", "td", "code", "b", "i", "tfoot", "figure", "figcaption", "details", "summary", "dl", "dt", "dd", "kbd", "mark", "sub", "sup", "del", "s"].includes(node.tag)}
    <svelte:element this={node.tag as "p"} {...admittedAttributes(node)}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></svelte:element>
  {:else if node.tag === "a"}
    {const link = $derived(safeLinkTarget(node.attrs?.href))}
    {#if link}<a id={projectedHeadingId(node)} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></a>{:else}<span id={projectedHeadingId(node)} data-unsafe-link><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></span>{/if}
  {:else if node.tag === "img"}
    {const src = $derived(safeMediaTarget(node.attrs?.src))}
    {#if src}<img id={projectedHeadingId(node)} {src} alt={stringAttribute(node, "alt") ?? ""} title={stringAttribute(node, "title")} loading="lazy" />{:else}<span id={projectedHeadingId(node)} data-unsafe-media>{stringAttribute(node, "alt") ?? "Image"}</span>{/if}
  {:else if node.tag === "br"}<br id={projectedHeadingId(node)} />{:else if node.tag === "hr"}<hr id={projectedHeadingId(node)} />
  {:else}<div id={projectedHeadingId(node)} data-unknown-tag={node.tag}><RecursiveAstRenderer nodes={node.content ?? null} {legacyHeadingIds} /></div>{/if}
{/each}

<style>
  :global(.doc-shell p) { line-height: 1.7; }
  :global(.doc-shell a) { color: var(--doc-accent); }
  :global(.doc-shell table) { width: 100%; border-collapse: collapse; }
  :global(.doc-shell th), :global(.doc-shell td) { border: 1px solid var(--doc-border); padding: .45rem; text-align: left; }
</style>
