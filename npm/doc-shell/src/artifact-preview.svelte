<script lang="ts">
import { provideArtifacts } from "./artifact-context.js"
import { type ArtifactAssets, type ArtifactReceipt, admitArtifactPage } from "./artifacts.js"
import AstRenderer from "./ast-renderer.svelte"
import { inheritLabels } from "./labels.js"
import type { DocAstNode } from "./types.js"

const {
  nodes,
  receipt,
  assets = {},
  canonicalContent,
  canonicalReceipt,
  labels,
  mode = "light",
}: {
  nodes: DocAstNode[]
  receipt: ArtifactReceipt
  assets?: ArtifactAssets
  canonicalContent?: string
  canonicalReceipt?: string
  labels?: Record<string, string>
  mode?: "light" | "dark" | "monochrome" | "enlarged"
} = $props()
const label = inheritLabels(() => labels)
const admitted = $derived(
  admitArtifactPage(nodes, receipt, assets, { canonicalContent, canonicalReceipt }),
)
provideArtifacts(() => admitted)
</script>

<section class="doc-artifact-preview doc-shell" data-artifact-preview={mode} data-artifact-page-digest={receipt.page_digest} data-descriptor-set-digest={receipt.descriptor_set_digest} data-artifact-constraints-digest={receipt.constraints_digest}>
  <header><h2>{label("artifact_preview", "Artifact preview")}</h2><p>{label("artifact_preview_scope", "Diagnostic view of the supplied document and selection. Producer meaning and target observations remain separate.")}</p></header>
  <div class="preview-document"><AstRenderer {nodes} legacyHeadingIds={false} /></div>
  <section class="preview-diagnostics" aria-label={label("artifact_diagnostics", "Artifact diagnostics")}>
    {#each [...admitted.blocks.values()] as view (view.id)}
      <details open><summary>{view.block.caption} · {view.selection.status}</summary>
        <dl>
          <dt>{label("artifact_block_id", "Block ID")}</dt><dd><code>{view.id}</code></dd>
          <dt>{label("artifact_ref", "Artifact reference")}</dt><dd><code>{view.block.artifact_ref}</code></dd>
          <dt>{label("artifact_profile", "Profile")}</dt><dd><code>{view.block.profile}</code><br /><code>{view.block.profile_digest}</code></dd>
          <dt>{label("artifact_manifest", "Manifest digest")}</dt><dd><code>{view.block.manifest_digest}</code></dd>
          <dt>{label("artifact_fallback_digest", "Fallback digest")}</dt><dd><code>{view.block.fallback_digest}</code></dd>
          <dt>{label("artifact_presentation", "Selected presentation")}</dt><dd>{view.selection.presentation_id ?? label("artifact_no_selection", "No admitted presentation")}</dd>
          <dt>{label("artifact_variant", "Variant and state")}</dt><dd>{view.selection.variant?.id ?? "—"} · {view.selection.variant?.state ?? "unavailable"}</dd>
          <dt>{label("artifact_runtime", "Selected runtime requirements")}</dt><dd>{view.selection.variant?.runtime.join(", ") || label("artifact_runtime_none", "None")}</dd>
        </dl>
        <h3>{label("artifact_anchors", "Semantic anchors")}</h3><ul>{#each view.block.bindings as binding (binding.anchor)}<li><a href={`#${binding.anchor}`}>{binding.anchor}</a> · <code>{binding.subject_ref}</code> · {binding.subject_kind} · {binding.subject_id}</li>{/each}</ul>
        <details><summary>{label("artifact_constraints", "Presentation constraints")}</summary><pre><code>{admitted.constraintsJson}</code></pre></details>
        {#if view.projectionJson}<details><summary>{label("artifact_producer_projection", "Checked producer projection and supplied limitations")}</summary><pre><code>{view.projectionJson}</code></pre></details>{/if}
      </details>
    {/each}
  </section>
</section>

<style>
  .doc-artifact-preview { padding: 1rem; background: var(--doc-background, #fff); color: var(--doc-foreground, #172033); border: 1px solid var(--doc-border, #cbd5e1); }
  [data-artifact-preview="dark"] { --doc-background: #111827; --doc-foreground: #f1f5f9; --doc-muted: #cbd5e1; --doc-border: #64748b; --doc-accent: #93c5fd; }
  [data-artifact-preview="monochrome"] .preview-document { filter: grayscale(1); }
  [data-artifact-preview="enlarged"] .preview-document { zoom: 1.5; }
  .preview-diagnostics { margin-block-start: 1.5rem; }
  dl { display: grid; grid-template-columns: minmax(8rem, 1fr) minmax(0, 3fr); gap: .5rem 1rem; }
  dd { margin: 0; overflow-wrap: anywhere; }
  pre { overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
  @media (max-width: 40rem) { dl { grid-template-columns: minmax(0, 1fr); } }
</style>
