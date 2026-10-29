<script lang="ts">
import { inheritLabels } from "./labels.js"

interface Props {
  locales: string[]
  value: string
  onchange?: (value: string) => void
}
const { locales, value, onchange }: Props = $props()
const label = inheritLabels()
</script>
<label>{label("locale", "Locale")} <select {value} onchange={(event) => onchange?.(event.currentTarget.value)}>{#each locales as locale}<option value={locale}>{locale}</option>{/each}</select></label>
<style>label { display: flex; gap: .5rem; align-items: center; font-size: .875rem; } select { border: 1px solid var(--doc-border); border-radius: var(--doc-radius); padding: .35rem; color: inherit; background: var(--doc-background); }</style>
