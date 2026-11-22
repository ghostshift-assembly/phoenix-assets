<script lang="ts">
import { DEFAULT_REPORTING_MESSAGES, type ReportingMessages, type ResultFrame } from "./contract.js"
import { formatCell } from "./format.js"

let {
  frame,
  columns,
  caption,
  locale,
  messages: messageOverrides,
  onRowAction,
}: {
  frame: ResultFrame
  columns?: string[]
  caption: string
  locale?: string
  messages?: Partial<ReportingMessages>
  onRowAction?: (row: unknown[]) => void | Promise<void>
} = $props()
const messages = $derived({ ...DEFAULT_REPORTING_MESSAGES, ...messageOverrides })
const pageSize = 200
let page = $state(0)
const pageCount = $derived(Math.max(1, Math.ceil(frame.rows.length / pageSize)))
const visibleRows = $derived(frame.rows.slice(page * pageSize, (page + 1) * pageSize))

$effect(() => {
  if (page >= pageCount) page = pageCount - 1
})

const fieldIndexes = $derived(
  (columns?.length ? columns : frame.fields.map((field) => field.name))
    .map((name) => ({
      field: frame.fields.find((field) => field.name === name),
      index: frame.fields.findIndex((field) => field.name === name),
    }))
    .filter(
      (entry): entry is { field: ResultFrame["fields"][number]; index: number } =>
        entry.field !== undefined && entry.index >= 0,
    ),
)
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard scrolling for an overflow region) -->
<div class="pa-report-table-wrap" role="region" aria-label={messages.tableRegion(caption)} tabindex="0">
  <table class="pa-report-table">
    <caption>{caption}</caption>
    <thead>
      <tr>
        {#each fieldIndexes as { field }}
          <th scope="col">{field.label}{field.unit && field.unit !== "count" ? ` (${field.unit})` : ""}</th>
        {/each}
        {#if onRowAction}<th scope="col">{messages.drillRow}</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each visibleRows as row}
        <tr>
          {#each fieldIndexes as { field, index }}
            <td>{formatCell(row[index], field, locale)}</td>
          {/each}
          {#if onRowAction}
            <td><button type="button" onclick={() => onRowAction(row)}>{messages.drillRow}</button></td>
          {/if}
        </tr>
      {:else}
        <tr><td colspan={fieldIndexes.length || 1}>{messages.noRows}</td></tr>
      {/each}
    </tbody>
  </table>
  {#if pageCount > 1}
    <nav class="pa-report-pagination" aria-label={`${caption} table pages`}>
      <button type="button" disabled={page === 0} onclick={() => page--}>{messages.previousPage}</button>
      <span aria-live="polite">{messages.pageStatus(page + 1, pageCount)}</span>
      <button type="button" disabled={page === pageCount - 1} onclick={() => page++}>{messages.nextPage}</button>
    </nav>
  {/if}
</div>

<style>
  .pa-report-table-wrap { max-inline-size: 100%; overflow: auto; overflow-wrap: anywhere; }
  .pa-report-table { width: 100%; border-collapse: collapse; color: var(--pa-report-foreground, currentColor); font: inherit; }
  caption { padding: 0.5rem; text-align: start; font-weight: 600; }
  th, td { padding: 0.5rem 0.75rem; border-block-end: 1px solid var(--pa-report-border, color-mix(in srgb, currentColor 20%, transparent)); text-align: start; }
  th { font-weight: 600; }
  button { min-height: 2.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--pa-report-border, currentColor); border-radius: 0.5rem; background: var(--pa-report-control, transparent); color: inherit; font: inherit; }
  button:focus-visible { outline: 2px solid var(--pa-report-focus, currentColor); outline-offset: 2px; }
  button:disabled { opacity: 0.5; }
  .pa-report-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.75rem; padding: 0.75rem; }
  .pa-report-table-wrap:focus-visible { outline: 2px solid var(--pa-report-focus, currentColor); outline-offset: 2px; }
</style>
