<script lang="ts">
import { inheritLabels } from "./labels.js"
import { flattenOperations, groupOperations, supportsOpenApi } from "./openapi.js"
import OperationCard from "./operation-card.svelte"
import TryIt from "./try-it.svelte"
import type { OpenApiDocument } from "./types.js"

interface Props {
  spec: OpenApiDocument
  baseUrl?: string
  allowedOrigins?: readonly string[]
  labels?: Record<string, string>
}
const { spec, baseUrl = "", allowedOrigins = [], labels }: Props = $props()
const label = inheritLabels(() => labels)
const operations = $derived(flattenOperations(spec))
const groups = $derived(groupOperations(operations))
const anchors = $derived(
  new Map(
    operations.map((entry, index) => [
      entry.id,
      `operation-${index}-${entry.id.replace(/[^A-Za-z0-9_.:-]+/g, "-")}`,
    ]),
  ),
)
const supported = $derived(supportsOpenApi(spec.openapi))
</script>
{#if supported}<section class="api-reference"><header>{#if spec.openapi}<p>OpenAPI {spec.openapi}</p>{/if}{#if spec.info}<h2>{spec.info.title}</h2><small>v{spec.info.version}</small>{#if spec.info.description}<p>{spec.info.description}</p>{/if}{/if}</header><nav aria-label={label("api_operations", "API operations")}>{#each Object.entries(groups).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0) as [tag, entries] (tag)}<h3>{tag}</h3>{#each entries ?? [] as entry (entry.id)}<a href={`#${anchors.get(entry.id)}`}><strong>{entry.method}</strong> {entry.path}</a>{/each}{/each}</nav><div class="operations">{#each operations as entry (entry.id)}<section id={anchors.get(entry.id)}><OperationCard {entry} /><TryIt {entry} {baseUrl} {allowedOrigins} /></section>{/each}</div></section>{:else}<section role="alert"><h2>{label("api_unavailable", "API reference unavailable")}</h2><p>{label("unsupported_openapi", "Unsupported OpenAPI version")} {spec.openapi}</p></section>{/if}
<details><summary>{label("openapi_json", "Complete admitted OpenAPI JSON")}</summary><pre><code>{JSON.stringify(spec, null, 2)}</code></pre></details>
<style>.api-reference { display: grid; grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr); gap: 1.5rem; } header { grid-column: 1 / -1; } nav a { display: block; padding: .4rem; color: inherit; text-decoration: none; overflow-wrap: anywhere; } nav a:hover { background: var(--doc-surface); } .operations { display: grid; min-width: 0; gap: 1.5rem; } @media (max-width: 50rem) { .api-reference { grid-template-columns: minmax(0, 1fr); } }</style>
