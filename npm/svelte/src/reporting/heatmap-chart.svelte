<script lang="ts">
import { Chart, Rect } from "layerchart/svg"
import ChartAxes, { chartPadding } from "./chart-axes.svelte"
import type { ChartDatum, CompiledPanel } from "./compile.js"

let { compiled }: { compiled: CompiledPanel } = $props()
const values = $derived.by(() => {
  const valueField = compiled.value
  if (valueField === undefined) return []
  return compiled.data
    .map((datum) => datum[valueField])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
})
const minimum = $derived(values.length === 0 ? 0 : Math.min(...values))
const maximum = $derived(values.length === 0 ? 0 : Math.max(...values))

function heatColor(datum: ChartDatum): string {
  const raw = compiled.value === undefined ? undefined : datum[compiled.value]
  const ratio =
    typeof raw !== "number" || !Number.isFinite(raw)
      ? 0
      : maximum === minimum
        ? 0.5
        : Math.max(0, Math.min(1, (raw - minimum) / (maximum - minimum)))
  const high = Math.round(ratio * 100)
  return `color-mix(in srgb, var(--pa-report-heat-low, #eff6ff) ${100 - high}%, var(--pa-report-heat-high, #1d4ed8) ${high}%)`
}
</script>

{#if compiled.x && compiled.y && compiled.value}
  <div class="pa-report-heatmap" data-report-chart="heatmap">
    <Chart
      data={compiled.data}
      x={compiled.x}
      y={compiled.y}
      bandPadding={0.04}
      grid={false}
      rule={false}
      pointerEvents={false}
      padding={chartPadding}
      motion="none"
    >
      {#snippet axis()}{/snippet}
      {#snippet aboveContext()}
        <ChartAxes />
      {/snippet}
      {#snippet marks({ context })}
        <Rect
          data={compiled.data}
          x={compiled.x}
          y={compiled.y}
          width={typeof context.xScale.bandwidth === "function" ? context.xScale.bandwidth() : 0}
          height={typeof context.yScale.bandwidth === "function" ? context.yScale.bandwidth() : 0}
          fill={heatColor}
          insets={{ all: 1 }}
          stroke="var(--pa-report-surface, #fff)"
          strokeWidth={1}
        />
      {/snippet}
    </Chart>
  </div>
{/if}

<style>
  .pa-report-heatmap {
    width: 100%;
    height: 18rem;
    min-width: 0;
  }
</style>
