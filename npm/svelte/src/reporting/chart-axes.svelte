<script module lang="ts">
export const chartPadding = { top: 8, right: 8, bottom: 24, left: 32 }
</script>

<script lang="ts">
import { Axis, Html } from "layerchart/html"
</script>

<Html class="pa-report-chart-axes" zIndex={1} pointerEvents={false}>
  <Axis placement="left" tickOcclusion={{ padding: 6 }} />
  <Axis placement="bottom" tickOcclusion />
</Html>

<style>
  :global(.pa-report-chart-axes .lc-axis-tick-label) {
    background-color: var(--pa-report-surface, Canvas);
    color: var(--pa-report-foreground, CanvasText);
    font-weight: 400;
    padding: 2px;
    text-box: normal;
    /* LayerChart sets pre-wrap inline. Keep the label inside one painted box. */
    white-space: nowrap !important;
  }
</style>
