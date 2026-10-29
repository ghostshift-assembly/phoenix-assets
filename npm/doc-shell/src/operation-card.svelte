<script lang="ts">
import JsonView from "./json-view.svelte"
import { inheritLabels } from "./labels.js"
import { schemaFrom } from "./openapi.js"
import SchemaTable from "./schema-table.svelte"
import type { OperationEntry } from "./types.js"

interface Props {
  entry: OperationEntry
}
const { entry }: Props = $props()
const responses = $derived(Object.entries(entry.operation.responses ?? {}))
const request = $derived(schemaFrom(entry.operation.requestBody?.content))
const label = inheritLabels()
</script>
<article><header><strong>{entry.method}</strong> <code>{entry.path}</code></header><h3>{entry.operation.summary ?? entry.operation.operationId ?? `${entry.method} ${entry.path}`}</h3>{#if entry.operation.description}<p>{entry.operation.description}</p>{/if}{#if entry.operation.parameters?.length}<h4>{label("parameters", "Parameters")}</h4><ul>{#each entry.operation.parameters as parameter (parameter.name + parameter.in)}<li><code>{parameter.name}</code> — {parameter.in}{parameter.required ? ` (${label("required", "required")})` : ""} {parameter.description ?? ""}</li>{/each}</ul>{/if}{#if request}<h4>{label("request_body", "Request body")}</h4><SchemaTable schema={request} />{/if}{#if responses.length}<h4>{label("responses", "Responses")}</h4>{#each responses as [status, response] (status)}{const schema = $derived(schemaFrom(response.content))}<section><strong>{status}</strong> {response.description ?? ""}{#if schema}<SchemaTable {schema} />{/if}</section>{/each}{/if}<details><summary>{label("operation_json", "Complete admitted operation JSON")}</summary><JsonView value={entry.operation} /></details></article>
<style>article { border: 1px solid var(--doc-border); border-radius: var(--doc-radius); padding: 1rem; } header { display: flex; gap: .5rem; } header strong { color: var(--doc-accent); }</style>
