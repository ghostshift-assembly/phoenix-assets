<script lang="ts">
import { readResponseText } from "./browser/request.js"
import JsonView from "./json-view.svelte"
import { inheritLabels } from "./labels.js"
import type { OperationEntry } from "./types.js"
import { isAllowedTryItOrigin, resolveTryItTarget } from "./url.js"

interface Props {
  entry: OperationEntry
  baseUrl?: string
  allowedOrigins?: readonly string[]
  request?: typeof fetch
}
const { entry, baseUrl = "", allowedOrigins = [], request = fetch }: Props = $props()
let open = $state(false)
let operationPath = $state("")
$effect(() => {
  operationPath = entry.path
})
let token = $state("")
let body = $state("")
let loading = $state(false)
let status = $state<number>()
let response = $state<unknown>()
let confirmedOrigin = $state<string>()
let tokenOrigin = $state<string>()
let generation = 0
let pending: AbortController | undefined
const hasBody = $derived(!["GET", "HEAD"].includes(entry.method))
const resolution = $derived.by(() => {
  try {
    return { target: resolveTryItTarget(baseUrl, operationPath) } as const
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) } as const
  }
})
const originAllowed = $derived(
  resolution.target
    ? !resolution.target.crossOrigin ||
        isAllowedTryItOrigin(resolution.target.origin, allowedOrigins)
    : false,
)
const originConfirmed = $derived(
  resolution.target
    ? !resolution.target.crossOrigin || confirmedOrigin === resolution.target.origin
    : false,
)
$effect(() => {
  const origin = resolution.target?.origin
  if (origin !== tokenOrigin) {
    token = ""
    confirmedOrigin = undefined
    tokenOrigin = origin
  }
})
$effect(() => {
  const identity = `${entry.method}:${entry.path}:${resolution.target?.url}:${open}`
  void identity
  generation += 1
  pending?.abort()
  pending = undefined
  loading = false
  status = undefined
  response = undefined
  return () => {
    generation += 1
    pending?.abort()
  }
})
const send = async () => {
  const target = resolution.target
  if (loading || !target || !originAllowed || !originConfirmed) return

  const current = generation
  const abort = new AbortController()
  pending = abort
  loading = true
  status = undefined
  response = undefined
  try {
    const headers: Record<string, string> = { "content-type": "application/json" }
    if (token) headers.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`
    const result = await request(target.url, {
      method: entry.method,
      redirect: "error",
      signal: abort.signal,
      headers,
      body: hasBody && body ? body : undefined,
      credentials: "same-origin",
    })
    const text = await readResponseText(result)
    if (current !== generation || abort.signal.aborted) return
    status = result.status
    try {
      response = JSON.parse(text)
    } catch {
      response = text
    }
  } catch (error) {
    if (current === generation)
      response = `${label("response_unknown", "Response unavailable; the operation outcome may be unknown.")} ${error instanceof Error ? error.message : String(error)}`
  } finally {
    if (current === generation) loading = false
  }
}
const label = inheritLabels()
</script>
{#if !baseUrl.trim()}<p>{label("request_unavailable", "Request execution unavailable.")}</p>{:else}<noscript>{label("request_requires_js", "Request execution requires JavaScript.")}</noscript>
<section><button type="button" onclick={() => (open = !open)} aria-expanded={open}>{open ? label("hide", "Hide") : label("try_it", "Try it")}</button>{#if open}<div class="form">{#if resolution.error}<p role="alert">{resolution.error}</p>{:else if resolution.target?.crossOrigin}{#if originAllowed}<label class="origin-confirm"><input type="checkbox" checked={confirmedOrigin === resolution.target.origin} onchange={(event) => (confirmedOrigin = event.currentTarget.checked ? resolution.target?.origin : undefined)} /> {label("confirm_request", "Send this request to")} {resolution.target.origin}</label>{:else}<p role="alert">{label("request_origin_blocked", "Requests to this destination are blocked by the host.")} {resolution.target.origin}</p>{/if}{/if}<label>{label("operation_path", "Operation path")} <input bind:value={operationPath} spellcheck="false" /></label><label>{label("bearer_token", "Bearer token")} <input bind:value={token} type="password" autocomplete="off" spellcheck="false" /></label>{#if hasBody}<label>{label("json_body", "JSON body")} <textarea bind:value={body}></textarea></label>{/if}<button type="button" onclick={send} disabled={loading || !resolution.target || !originAllowed || !originConfirmed}>{loading ? label("sending", "Sending…") : label("send_request", "Send request")}</button>{#if status !== undefined}<strong>{label("status", "Status")} {status}</strong>{/if}{#if response !== undefined}<JsonView value={response} />{/if}</div>{/if}</section>
{/if}
<style>section { margin-top: 1rem; } .form, label { display: grid; gap: .5rem; } .form { margin-top: .75rem; } input, textarea, button { border: 1px solid var(--doc-border); border-radius: var(--doc-radius); padding: .5rem; background: var(--doc-background); color: inherit; } textarea { min-height: 8rem; font-family: ui-monospace, monospace; }</style>
