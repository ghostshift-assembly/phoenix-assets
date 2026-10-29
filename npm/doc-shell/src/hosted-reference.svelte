<script lang="ts">
import ApiReference from "./api-reference.svelte"
import AstRenderer from "./ast-renderer.svelte"
import { admitHostedPair } from "./hosted-pair.js"
import type { DocShellPresentation, OpenApiDocument, PublicationBinding } from "./types.js"

const {
  presentation,
  openapi,
  expected,
  currentId,
  baseUrl = "",
  allowedOrigins = [],
}: {
  presentation: DocShellPresentation
  openapi: OpenApiDocument
  expected: PublicationBinding
  currentId: string
  baseUrl?: string
  allowedOrigins?: readonly string[]
} = $props()
const admitted = $derived.by(() => {
  const pair = admitHostedPair(presentation, openapi, expected)
  const content = pair.presentation.content[currentId]
  if (!Array.isArray(content)) throw new Error("DocShell hosted document unavailable")
  return { pair, content }
})
</script>

<section class="doc-shell" data-doc-publication={admitted.pair.publication.publication_id} lang={admitted.pair.publication.locale} dir={/^(ar|fa|he|ur)(?:[-_]|$)/i.test(admitted.pair.publication.locale) ? "rtl" : "ltr"}>
  <article><AstRenderer nodes={admitted.content} legacyHeadingIds={false} /></article>
  <ApiReference spec={admitted.pair.openapi} {baseUrl} {allowedOrigins} />
</section>
