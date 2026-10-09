<script lang="ts">
import JsonView from "./json-view.svelte"
import { typeLabel } from "./openapi.js"
import RecursiveSchemaTable from "./schema-table.svelte"
import type { JsonSchema } from "./types.js"

interface Props {
  schema: JsonSchema
  depth?: number
}
const { schema, depth = 0 }: Props = $props()
const properties = $derived(Object.entries(schema.properties ?? {}))
const required = $derived(new Set(schema.required ?? []))
const combinations = $derived(schema.oneOf ?? schema.anyOf ?? schema.allOf ?? [])
</script>
{#if depth >= 12}<pre><code>{JSON.stringify(schema, null, 2)}</code></pre>{:else if properties.length}<table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody>{#each properties as [name, property] (name)}<tr><td><code>{name}</code>{required.has(name) ? "*" : ""}</td><td>{typeLabel(property)}</td><td>{property.description ?? ""}{#if property.enum}<div>{property.enum.join(" · ")}</div>{/if}{#if property.example !== undefined}<JsonView value={property.example} />{/if}{#if property.properties}<RecursiveSchemaTable schema={property} depth={depth + 1} />{:else if property.items?.properties}<RecursiveSchemaTable schema={property.items} depth={depth + 1} />{/if}</td></tr>{/each}</tbody></table>{:else if combinations.length}{#each combinations as item}<RecursiveSchemaTable schema={item} depth={depth + 1} />{/each}{:else}<p>{typeLabel(schema)}</p>{#if schema.example !== undefined}<JsonView value={schema.example} />{/if}{/if}
<details><summary>Schema JSON</summary><JsonView value={schema} /></details>
<style>table { width: 100%; border-collapse: collapse; font-size: .875rem; } th, td { padding: .45rem; border-bottom: 1px solid var(--doc-border); text-align: left; vertical-align: top; }</style>
