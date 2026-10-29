<script lang="ts">
import type { Snippet } from "svelte"
import { artifactContext, provideArtifacts } from "./artifact-context.js"
import type { ArtifactView } from "./artifacts.js"
import { inheritLabels } from "./labels.js"

const { view, children }: { view: ArtifactView; children?: Snippet } = $props()
const label = inheritLabels()
const parent = artifactContext()
const empty = { blocks: new Map(), passive: true }
provideArtifacts(() => ({ ...(parent() ?? empty), passive: true }))
</script>

<figure id={view.id} class="doc-artifact" data-doc-artifact data-artifact-ref={view.block.artifact_ref} data-artifact-profile={view.block.profile} data-profile-digest={view.block.profile_digest} data-manifest-digest={view.block.manifest_digest} data-fallback-digest={view.block.fallback_digest} data-artifact-status={view.selection.status} data-artifact-state={view.selection.variant?.state ?? "unavailable"} data-variant-id={view.selection.variant?.id} data-presentation-id={view.selection.presentation_id} lang={view.block.locale} dir={/^(ar|fa|he|ur)(?:[-_]|$)/i.test(view.block.locale) ? "rtl" : "ltr"}>
  <figcaption>{view.block.caption}</figcaption>
  <p class="artifact-description">{view.block.description}</p>
  {#if view.source}<div class="artifact-media"><img src={view.source} alt={view.block.description} loading="lazy" decoding="async" /></div>{/if}
  {#if view.selection.status === "unavailable"}<p class="artifact-status" role="note">{label("artifact_unavailable", "Artifact presentation unavailable; complete fallback retained.")}</p>{/if}
  <div class="artifact-fallback" data-artifact-fallback>{#if children}{@render children()}{/if}</div>
</figure>

<style>
  .doc-artifact { margin: 1.5rem 0; padding: 1rem; border: 1px solid var(--doc-border); border-radius: var(--doc-radius); break-inside: avoid; }
  figcaption { font-weight: 700; }
  .artifact-description { color: var(--doc-muted); }
  .artifact-media { overflow: auto; background: white; color: black; border: 1px solid var(--doc-border); padding: .5rem; }
  img { display: block; max-inline-size: 100%; block-size: auto; margin-inline: auto; }
  .artifact-fallback { margin-block-start: 1rem; overflow-wrap: anywhere; }
  .artifact-status { border-inline-start: .25rem solid var(--doc-accent); padding-inline-start: .75rem; }
</style>
