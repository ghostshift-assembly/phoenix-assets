<script lang="ts">
import {
  DEFAULT_REPORTING_MESSAGES,
  type ReportEnvelope,
  type ReportingMessages,
} from "./contract.js"
import PortablePanel from "./portable-panel.svelte"

let {
  envelope,
  locale,
  messages: messageOverrides,
  onDrill,
  onTableView,
}: {
  envelope: ReportEnvelope
  locale?: string
  messages?: Partial<ReportingMessages>
  onDrill?: (
    panelId: string,
    actionId: string,
    selection: Record<string, unknown>,
  ) => void | Promise<void>
  onTableView?: (panelId: string) => void | Promise<void>
} = $props()
const instanceId = $props.id()
const titleId = `pa-report-title-${instanceId}`
const messages = $derived({ ...DEFAULT_REPORTING_MESSAGES, ...messageOverrides })
const columns = $derived(envelope.definition.layout.columns ?? 12)
const orderedPanels = $derived.by(() => {
  const byId = new Map(envelope.definition.panels.map((panel) => [panel.id, panel]))
  const ordered = (envelope.definition.layout.order ?? []).flatMap((id) => {
    const panel = byId.get(id)
    if (panel) byId.delete(id)
    return panel ? [panel] : []
  })
  return [...ordered, ...byId.values()]
})
</script>

<article class="pa-report" aria-labelledby={titleId}>
  <header>
    <h1 id={titleId}>{envelope.definition.title}</h1>
    <p>{envelope.definition.description}</p>
  </header>
  {#if envelope.capability_warnings.length > 0}
    <p class="pa-report-warning" role="status">{messages.accessibleFallback}</p>
  {/if}
  <div class="pa-report-grid" style={`--pa-report-columns: ${columns}`}>
    {#each orderedPanels as panel (panel.id)}
      <div class="pa-report-grid-panel" style={`--pa-report-panel-span: ${envelope.definition.layout.spans?.[panel.id] ?? Math.min(6, columns)}`}>
        <PortablePanel {panel} result={envelope.results[panel.id]!} {locale} {messages} {onDrill} {onTableView} />
      </div>
    {/each}
  </div>
</article>

<style>
  .pa-report { container-type: inline-size; display: grid; gap: 1.5rem; min-width: 0; color: var(--pa-report-foreground, currentColor); }
  header h1, header p { margin: 0; } header p { margin-block-start: 0.375rem; color: var(--pa-report-muted, color-mix(in srgb, currentColor 70%, transparent)); }
  .pa-report-grid { display: grid; grid-template-columns: repeat(var(--pa-report-columns, 12), minmax(0, 1fr)); gap: var(--pa-report-grid-gap, 1rem); }
  .pa-report-grid-panel { min-width: 0; grid-column: span var(--pa-report-panel-span, 6); }
  .pa-report-warning { padding: 0.75rem; border-inline-start: 0.25rem solid var(--pa-report-warning, currentColor); background: var(--pa-report-state-surface, color-mix(in srgb, currentColor 8%, transparent)); }
  @container (max-width: 48rem) { .pa-report-grid-panel { grid-column: 1 / -1; } }
  @media (max-width: 48rem) { .pa-report-grid-panel { grid-column: 1 / -1; } }
</style>
