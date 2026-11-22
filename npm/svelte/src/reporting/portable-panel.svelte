<script lang="ts">
import { AreaChart, BarChart, LineChart, ScatterChart } from "layerchart/svg"
import ChartAxes, { chartPadding } from "./chart-axes.svelte"
import { type ChartDatum, compilePanel } from "./compile.js"
import {
  DEFAULT_REPORTING_MESSAGES,
  type PanelDefinition,
  type PanelResult,
  type ReportingMessages,
} from "./contract.js"
import DataTable from "./data-table.svelte"
import { formatCell } from "./format.js"
import HeatmapChart from "./heatmap-chart.svelte"

let {
  panel,
  result,
  locale,
  messages: messageOverrides,
  onDrill,
  onTableView,
}: {
  panel: PanelDefinition
  result: PanelResult
  locale?: string
  messages?: Partial<ReportingMessages>
  onDrill?: (
    panelId: string,
    actionId: string,
    selection: Record<string, unknown>,
  ) => void | Promise<void>
  onTableView?: (panelId: string) => void | Promise<void>
} = $props()
let tableVisible = $state(false)
const messages = $derived({ ...DEFAULT_REPORTING_MESSAGES, ...messageOverrides })
const frame = $derived(
  result.state === "ok" || result.state === "partial" ? result.frame : undefined,
)
const compiled = $derived(frame ? compilePanel(panel, frame) : undefined)
const instanceId = $props.id()
const titleId = `pa-report-panel-title-${instanceId}`
const summaryId = `pa-report-summary-${instanceId}`
const tableId = `pa-report-table-${instanceId}`
const palette = [
  "var(--pa-report-series-1, currentColor)",
  "var(--pa-report-series-2, currentColor)",
  "var(--pa-report-series-3, currentColor)",
  "var(--pa-report-series-4, currentColor)",
  "var(--pa-report-series-5, currentColor)",
  "var(--pa-report-series-6, currentColor)",
]
const series = $derived.by(() => {
  const seriesField = compiled?.series
  const valueField = compiled?.y
  if (!seriesField || !valueField) return undefined
  return compiled.seriesValues.map((key, index) => ({
    key,
    label: key,
    color: palette[index % palette.length],
    value: (datum: ChartDatum) => (datum[seriesField] === key ? datum[valueField] : null),
  }))
})
const scalarField = $derived(compiled?.value ? compiled.fields.get(compiled.value) : undefined)
const scalarValue = $derived(compiled?.value ? compiled.data.at(-1)?.[compiled.value] : undefined)
const hasPrimaryVisualization = $derived.by(() => {
  if (!compiled) return false
  if (compiled.kind === "number") return scalarField !== undefined && scalarValue !== undefined
  if (compiled.kind === "gauge") return scalarField !== undefined && typeof scalarValue === "number"

  if (["line", "sparkline", "area", "bar", "scatter"].includes(compiled.kind)) {
    return compiled.chartable && compiled.x !== undefined && compiled.y !== undefined
  }

  if (compiled.kind === "heatmap") {
    return (
      compiled.chartable &&
      compiled.x !== undefined &&
      compiled.y !== undefined &&
      compiled.value !== undefined
    )
  }

  return false
})
const drillActionId = $derived(panel.visualization.interaction.drill_action_id)
const drill = (row: unknown[]) => {
  if (!drillActionId || !frame || !onDrill) return
  const selection = Object.fromEntries(frame.fields.map((field, index) => [field.name, row[index]]))
  return onDrill(panel.id, drillActionId, selection)
}
const toggleTable = () => {
  tableVisible = !tableVisible
  if (tableVisible) return onTableView?.(panel.id)
}
</script>

<!-- An empty axis snippet keeps LayerChart's baseline rule enabled. -->
{#snippet svgAxis()}{/snippet}
{#snippet abovePlot()}
  <ChartAxes />
{/snippet}

<section class="pa-report-panel" aria-labelledby={titleId} aria-describedby={summaryId}>
  <header>
    <div>
      <h2 id={titleId}>{panel.title}</h2>
      <p>{panel.description}</p>
    </div>
    {#if (result.state === "ok" || result.state === "partial") && hasPrimaryVisualization}
      <button type="button" aria-controls={tableId} aria-expanded={tableVisible} onclick={toggleTable}>
        {tableVisible ? messages.hideTable : messages.viewTable}
      </button>
    {/if}
  </header>

  <p id={summaryId} class="pa-report-summary">{panel.visualization.summary_template}</p>

  {#if result.state === "empty"}
    <p class="pa-report-state" role="status">{panel.empty_message}</p>
  {:else if result.state === "error"}
    <p class="pa-report-state pa-report-error" role="alert">{messages.panelUnavailable}</p>
  {:else if compiled && frame}
    {#if result.state === "partial"}
      <p class="pa-report-state pa-report-warning" role="status">{messages.partialResult}</p>
    {/if}

    {#if compiled.kind === "number" && scalarField && scalarValue !== undefined}
      <p class="pa-report-number">{formatCell(scalarValue, scalarField, locale)}</p>
    {:else if compiled.kind === "gauge" && scalarField && typeof scalarValue === "number"}
      <div class="pa-report-gauge">
        <span>{formatCell(scalarValue, scalarField, locale)}</span>
        <progress value={Math.max(0, Math.min(100, scalarValue))} max="100">{scalarValue}%</progress>
      </div>
    {:else if compiled.chartable && compiled.x && compiled.y && (compiled.kind === "line" || compiled.kind === "sparkline")}
      <div class:pa-report-sparkline={compiled.kind === "sparkline"} class="pa-report-chart" aria-hidden="true">
        <LineChart data={compiled.data} x={compiled.x} y={compiled.y} {series} axis={svgAxis} aboveContext={abovePlot} padding={chartPadding} motion="none" />
      </div>
    {:else if compiled.chartable && compiled.x && compiled.y && compiled.kind === "area"}
      <div class="pa-report-chart" aria-hidden="true"><AreaChart data={compiled.data} x={compiled.x} y={compiled.y} {series} axis={svgAxis} aboveContext={abovePlot} padding={chartPadding} motion="none" /></div>
    {:else if compiled.chartable && compiled.x && compiled.y && compiled.kind === "bar"}
      <div class="pa-report-chart" aria-hidden="true"><BarChart data={compiled.data} x={compiled.x} y={compiled.y} {series} axis={svgAxis} aboveContext={abovePlot} padding={chartPadding} seriesLayout={panel.visualization.stack === "normalized" ? "stackExpand" : panel.visualization.stack === "normal" ? "stack" : compiled.series ? "group" : "overlap"} motion="none" /></div>
    {:else if compiled.chartable && compiled.x && compiled.y && compiled.kind === "scatter"}
      <div class="pa-report-chart" aria-hidden="true"><ScatterChart data={compiled.data} x={compiled.x} y={compiled.y} {series} axis={svgAxis} aboveContext={abovePlot} padding={chartPadding} motion="none" /></div>
    {:else if compiled.chartable && compiled.x && compiled.y && compiled.value && compiled.kind === "heatmap"}
      <div class="pa-report-chart" aria-hidden="true"><HeatmapChart {compiled} /></div>
    {:else if compiled.kind === "table"}
      <div id={tableId}><DataTable {frame} columns={panel.table_columns} caption={panel.title} {locale} {messages} onRowAction={drillActionId && onDrill ? drill : undefined} /></div>
    {:else}
      <p class="pa-report-state" role="status">{messages.chartUnavailable}</p>
      <div id={tableId}><DataTable {frame} columns={panel.table_columns} caption={panel.title} {locale} {messages} onRowAction={drillActionId && onDrill ? drill : undefined} /></div>
    {/if}

    {#if hasPrimaryVisualization}
      <div id={tableId} hidden={!tableVisible}><DataTable {frame} columns={panel.table_columns} caption={panel.title} {locale} {messages} onRowAction={drillActionId && onDrill ? drill : undefined} /></div>
    {/if}

    <footer>
      <span>{messages.stateLabel}: {result.state}</span>
      {#if typeof frame.freshness.watermark === "string"}<span>{messages.watermarkLabel}: {frame.freshness.watermark}</span>{/if}
      {#if frame.page.truncated === true}<strong>{messages.truncatedLabel}</strong>{/if}
    </footer>
  {/if}
</section>

<style>
  .pa-report-panel { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; min-width: 0; overflow-wrap: anywhere; padding: var(--pa-report-panel-padding, 1rem); border: 1px solid var(--pa-report-border, color-mix(in srgb, currentColor 20%, transparent)); border-radius: var(--pa-report-radius, 0.75rem); background: var(--pa-report-surface, transparent); color: var(--pa-report-foreground, currentColor); }
  header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
  h2, p { margin: 0; } h2 { font-size: 1rem; } header p { margin-block-start: 0.25rem; color: var(--pa-report-muted, color-mix(in srgb, currentColor 70%, transparent)); }
  .pa-report-summary { color: var(--pa-report-muted, color-mix(in srgb, currentColor 70%, transparent)); }
  button { min-height: 2.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--pa-report-border, currentColor); border-radius: 0.5rem; background: var(--pa-report-control, transparent); color: inherit; font: inherit; }
  button:focus-visible { outline: 2px solid var(--pa-report-focus, currentColor); outline-offset: 2px; }
  .pa-report-chart { min-height: 18rem; } .pa-report-sparkline { min-height: 5rem; }
  .pa-report-number { font-size: clamp(2rem, 8vw, 4rem); font-variant-numeric: tabular-nums; }
  .pa-report-gauge { display: grid; gap: 0.5rem; font-size: 1.5rem; font-variant-numeric: tabular-nums; } progress { width: 100%; accent-color: var(--pa-report-series-1, currentColor); }
  .pa-report-state { padding: 0.75rem; background: var(--pa-report-state-surface, color-mix(in srgb, currentColor 8%, transparent)); border-radius: 0.5rem; }
  .pa-report-warning { border-inline-start: 0.25rem solid var(--pa-report-warning, currentColor); } .pa-report-error { border-inline-start: 0.25rem solid var(--pa-report-error, currentColor); }
  footer { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.875rem; color: var(--pa-report-muted, color-mix(in srgb, currentColor 70%, transparent)); }
  @media (max-width: 30rem) { header { display: grid; } .pa-report-chart { min-height: 14rem; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; } }
</style>
