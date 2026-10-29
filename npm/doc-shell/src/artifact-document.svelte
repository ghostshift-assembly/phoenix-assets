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
}: {
  nodes: DocAstNode[]
  receipt?: ArtifactReceipt | null
  assets?: ArtifactAssets
  canonicalContent?: string
  canonicalReceipt?: string
  labels?: Record<string, string>
} = $props()
inheritLabels(() => labels)
const admitted = $derived(
  admitArtifactPage(nodes, receipt, assets, { canonicalContent, canonicalReceipt }),
)
provideArtifacts(() => admitted)
</script>

<div class="doc-artifact-document" data-artifact-page-digest={admitted.receipt?.page_digest} data-artifact-constraints-digest={admitted.receipt?.constraints_digest}>
  <AstRenderer {nodes} legacyHeadingIds={false} />
</div>
