# @phoenix-assets/doc-shell

Svelte documentation UI for renderer-neutral `doc-shell/v2`, legacy
`doc-shell/v1`, and projected `doc-shell-site/v1` sites. The producer can be the
`doc_shell` Hex package, a host projector, or a build step that writes JSON. Each produces a
`DocShellPresentation`.

DocShell 1.0 keeps module member references in navigation metadata; full member
documentation belongs to its module artifacts. The renderer treats this metadata
as opaque and does not reconstruct member bodies from those references.

```svelte
<script lang="ts">
  import { DocShell, type DocShellPresentation } from "@phoenix-assets/doc-shell"
  import "@phoenix-assets/doc-shell/theme.css"

  let { presentation }: { presentation: DocShellPresentation } = $props()
</script>

<DocShell {presentation} currentId="intro" currentPath="/docs/intro" />
```

For a projected site, use `SiteShell` with a `DocShellSite` and `pageId`.
It preserves the producer's routes, headings, navigation and page digests.
`@phoenix-assets/doc-shell/browser` exports the Svelte-free controllers used by
the optional HEEx/static integration in `phoenix_assets`; see
[PHA.01](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/docs/specs/PHA.01-doc-shell-renderers.md)
for that integration's dependencies and conformance scope.

The [coordinated tracker](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/docs/plans/doc-shell-renderers.md#coordinated-completion)
records implemented settings, page metadata, publication-pair and artifact
rendering, with automated contract, regression, browser and package checks.
Shared contracts land in DocShell first; this package owns rendering and visual
preview. Hosts supply brand content, labels and routes, and retain authorization
and product state. Native readers and producer algorithms are separate owners.

`SiteShell` consumes the optional upstream `site.presentation` object through
`admitPresentation`. It renders brand/footer data and locale/release destinations
as ordinary links, and supplies title, description, canonical, Open Graph and
robots metadata. Hosts may replace the brand/footer with Svelte `brand` and
`footer` snippets (each receives the site). `assetUrls` maps logical brand-logo
asset names to URLs supplied by the host. These are checkout additions awaiting
release; the matching DocShell settings API is also awaiting release.

The HEEx/static renderer reads the same data from `context.presentation` and
retains its local brand/footer slots. Nonempty settings require a DocShell
version containing `DocShell.Presentation.Settings`; older producers retain
empty/default rendering and refuse unsupported new settings.

Host-authored `labels` override `search`, `skip`, `browse`, `close_navigation`,
`documentation`, `navigation`, `language`, `release`, `reader_preferences`,
`theme_system`, `theme_light`, `theme_dark`, `theme_contrast`, `breadcrumbs`,
`continue_reading`, `on_this_page`, `provenance`, `updated`, `view_source`,
`edit_page`, `footer`, `not_found`, `not_found_description`, and `home`.
Search additionally recognizes `close`, `filter_all`, `filter_<facet>`,
`search_loading`, `search_error`, `search_empty`, `search_result`, and
`search_results`; result templates replace `{count}` with the observed count.
Missing labels preserve defaults. Nested AST/API controls inherit the catalogue;
standalone `AstRenderer`, `ApiReference`, `HostedReference` and legacy `DocShell`
also accept a `labels` prop. HEEx `Ast.render/2` accepts the label map and API
components accept the same `settings` map as the shell. Source titles, prose,
schema names and API payloads retain their authored wording.

Additional control keys are `copy`, `copy_code`, `copied`, `copy_unavailable`,
`highlight_code`, `render_diagram`, `diagram_source`, `diagram_unavailable`,
`enhancement_limit`, `plain_source`, `enhancement_unavailable`, `source`,
`documentation_tabs`, `tab`, `details`, and `directive_<name>` (replace directive
hyphens with underscores). API controls recognize `api_operations`,
`api_unavailable`, `unsupported_openapi`, `openapi_json`, `operation_json`,
`parameters`, `name`, `location`, `required`, `optional`, `field`, `type`,
`description`, `schema_json`, `request_body`, `responses`, `request_unavailable`,
`request_requires_js`, `hide`, `try_it`, `confirm_request`,
`request_origin_blocked`, `operation_path`, `bearer_token`, `json_body`,
`sending`, `send_request`, `status`, `destination`, `response_unknown`, and
`request_error`. Legacy shell helpers also use `audience`, `locale` and
`referenced_by`. These override control text; they do not authorize requests.

Projected sites also render the upstream banner/hero records and
`metadata["seo"]` overrides. A hero preserves plain text, ordinary action links
and logical image/alt data. `assetUrls` resolves images in Svelte; static export
accepts `asset_options: [assets: [%DocShell.Presentation.Asset{...}]]` and delegates
path, digest and publication checks to DocShell. Missing hero images retain their
alt text. A splash template changes documentation presentation while retaining
the page title and content.

Navigation badges and group collapse defaults are enabled for the projected
site profile. Legacy `Sidebar` metadata remains opaque unless its
`presentationMetadata` prop is enabled explicitly. The current branch stays
open, and empty group paths never count as the selected route. Locale selectors
mark the current page/context locale when a destination ID matches; otherwise
they retain the host's explicit current marker. Exact destinations remain host-owned.
The `page_actions` label names hero action navigation.

For embedded hosted API documentation, use `HostedReference` with
`presentation`, `openapi`, `expected` and `currentId`. It compares the publication
bindings before rendering either narrative or API content; it supplies no host
chrome or authorization policy. `admitHostedPair` provides that binding check for
custom composition. Inputs must already satisfy the upstream graph/OpenAPI source
contracts; the browser check covers bindings, required top-level presentation
fields and the declared OpenAPI version, rather than full source/schema validation.

`expected` is the host's admitted request view. Both the presentation's
`publication` and OpenAPI's `x-doc-shell-publication` must equal it across every
`doc-shell-publication/v1` field. Two matching but stale inputs still refuse when
the expected view differs. The check grants no access and cannot authenticate a
host's source declarations. HEEx exposes the corresponding
`PhoenixAssets.DocShell.ApiReference.hosted_reference/1` component, which delegates
to upstream `HostedPair.validate/3`; older producers refuse this new capability.
These are checkout APIs awaiting coordinated release.

The package contains no app aliases. `DocShell` accepts a `DocShellTheme` through
its `theme` prop; both shells use the `--doc-*` CSS custom properties. Search
matches the supplied records with the built-in deterministic matcher. The
exported `Search` component accepts a replacement `search` callback. Navigation
uses the host's `navigate` callback when supplied.

Inline `span` elements retain admitted textual IDs, including artifact subject
anchors. Mixed `<pre>` content keeps every child; code enhancement applies only
to the exact single-code-child form so sibling warnings remain visible.

DocShell AST attribute maps may contain arbitrary JSON values. Both renderers
use only supported string attributes; other values remain inert and are ignored
by the HTML/URL policy. A non-text code-fence class falls back to plain text
without hiding the source or crashing the page.

The recursive AST renderer handles content directives plus Shiki and
Mermaid code fences. `ApiReference` renders tag-grouped OpenAPI operations,
recursive schemas and examples. Every operation has an ordinary link and stays
readable without JavaScript. The complete document JSON retains unknown fields.
Request execution is unavailable until the host supplies `baseUrl`; use `/`
to select the current origin explicitly. Dynamic links reject executable and
unknown URL schemes. Try-it paths
cannot replace the configured API origin; a cross-origin `baseUrl` also needs an
exact `allowedOrigins` entry and an on-screen confirmation before sending.
Browser cookies remain same-origin-only. `pnpm check:offline` checks package
source for direct network asset references.

Mermaid 12 requires Node 22.12 or newer and browsers supporting ES2024
(Safari 17.4 or newer). The renderer explicitly keeps the Dagre layout,
default theme, and classic look used before the upgrade. Diagram configuration directives, front matter and remote resources are refused. Failed rendering keeps the diagram source visible.
Both renderers retain plain source if enhancement fails. The workspace resolves KaTeX 0.19, including its settings security fixes.

Shiki grammars are loaded explicitly rather than through its full bundle. See
`supportedLanguages` for the set, which covers a Phoenix + SvelteKit codebase and
the formats its docs quote. Anything else renders as plain text. Highlighting
emits both themes as `--shiki-light` / `--shiki-dark` custom properties, so the
page's `color-scheme` picks a side and a dark host needs no extra class.


The 2.x package requires Svelte `^5.57.2`. Upgrade the host's Svelte
compiler and runtime together before installing its exact candidate archive.
The browser subpath remains independent of Svelte. HEEx static output ships local
optional highlighting and Mermaid chunks, loaded by the enhancement controls;
its import map follows the exporter's content-hashed URLs. Hosts with a script
nonce pass it to `PhoenixAssets.DocShell.Components.page/1`.

Try-it requests require confirmation, refuse redirects, keep tokens in component
memory, abort when their operation or component retires, and display at most
65,536 response bytes. A lost mutation response remains an unknown outcome and
is never retried automatically.

`SiteShell` and the HEEx page component enforce the page's capability requirements
before rendering. Unknown essential features fail. Unsupported optional features
require the producer's matching fallback digest. `admitPage(page, canonicalContent?)`
exposes the same Svelte preflight for callers. Without original bytes, it handles
bounded canonical JSON with strings, booleans, nulls and safe integers, including
Jason's uppercase control escapes. To retain float, negative-zero or large-integer
spelling, extract `{:ok, canonical_content}` from
`DocShell.Json.Canonical.encode(page.content)` and pass that binary as
`canonicalContent`; `SiteShell` accepts the same optional prop.
The bounded proof reader checks the decoded content and retains raw numeric
subtrees for hashing. It refuses malformed, changed or unverifiable bytes;
it does not normalize source numbers or grant source authenticity.

The Pagefind adapter builds separate locale indexes. Search loads them only when
a query needs them, preserves section routes and applies the same seven facets as
the JSON adapter. The search component also accepts a host-supplied `label`.

### Verified artifact documents and diagnostic previews

`ArtifactDocument` accepts `nodes`, an upstream producer-admitted `receipt` and
an `assets` record keyed by logical path. Each asset contains `media_type` and
canonical `base64` of its original bytes. `ArtifactPreview` accepts the same
inputs plus `mode`: `light`, `dark`, `monochrome` or `enlarged`. Import the package's
`theme.css` for the shared shell and preview styles.

Both use `admitArtifactPage(nodes, receipt, assets, options?)` before rendering.
This verifies page/constraint/fallback identity, selected variant membership,
runtime declarations, semantic anchor membership, original asset length/digest
and the passive SVG/PNG policy below. It renders only selected `fallback` variants
with no runtime requirements; unsupported selected states refuse without choosing
another presentation. Unknown optional profiles retain their complete admitted
fallback and an unavailable status. Caption, description, locale, source anchors
and fallback text remain visible beside the selected image. Media is inline;
these components fetch no assets and invoke no producer callbacks.

Preserve the original canonical content and receipt as `canonicalContent` and
`canonicalReceipt` when their JSON contains numeric representations that
JavaScript cannot reproduce. The same options belong to `admitArtifactPage`.
Source authenticity, original producer admission and the descriptor-set binding
remain host prerequisites. The renderer does not re-establish producer meaning.

The preview adds read-only identities, selected capability/state/runtime,
constraints, anchor links and the supplied checked producer projection, including
its limitations. It uses the same verified document and selection in every mode;
it neither computes comparison images nor records approval. Producer/native/human
qualification remains separate from this diagnostic view.

`artifactCapabilities(profileBindings, mode?)` describes only this passive subset
for explicit `{profile, profile_digest, schema_digest}` records; `mode` defaults
to `static`. It performs no profile discovery. `SiteShell` consumes receipts from
`page.metadata.artifact_presentation` and takes the same `artifactAssets` and
canonical proof props. When browser JavaScript is unavailable or forbidden, it
uses native navigation, omits enhancement-only controls and explains unavailable
search. Artifact fallback content always avoids JavaScript enhancements.

HEEx offers `PhoenixAssets.DocShell.Artifacts.admit/4` and `capabilities/2`, plus
`Components.artifact_document/1` and `artifact_preview/1` with equivalent inputs.
Its page/static paths also consume receipt metadata and context `artifact_assets`.
They require the upstream `ArtifactBlock.verify_receipt/2` API implemented in the
sibling producer; older installed versions explicitly refuse portable artifacts
while continuing to render ordinary documents. Static export passes its checked
local URL map; standalone HEEx uses inline media by default. Custom hosts remain
responsible for serving the checked bytes at any supplied local URLs.

These source paths use the two exact synthetic producer profiles from the
upstream conformance corpus. Fresh coordinated archives pass the automated
Svelte/HEEx browser, print and offline/file tasks recorded in the tracker.
Producer algorithms and native applications remain consumer-owned; the
checkout additions are unreleased.

### Artifact media checks in the current checkout

`validateArtifactMedia(mediaType, bytes)` checks the renderer's passive media
subset and throws on refusal. HEEx uses
`PhoenixAssets.DocShell.ArtifactMedia.validate/2`, returning `:ok` or a tagged
error. Artifact views use these checks after verifying the supplied receipt and
original selected asset bytes.

SVG permits `svg`, `g`, `title`, `desc`, basic shape elements, `text` and `tspan`,
with closed numeric/color/font/transform attributes. It requires a bounded
viewport and refuses DTDs, processing instructions, foreign content, scripts,
styles, events, entities beyond the five XML text escapes, external references
and nested viewports. Producers can supply a PNG alternative for SVG features
outside this subset. PNG checks its header, dimensions, chunk closure and CRCs;
animated PNG and unsupported ancillary chunks refuse. Neither helper decodes
pixels or validates producer geometry or semantic coverage.

The fixed limits are 1 MiB SVG, 32 MiB PNG, 4096 SVG elements or PNG chunks,
64 SVG levels, 32 attributes per element, 64 transforms per attribute, 65,536
ASCII bytes per attribute, numeric magnitudes at most 1,000,000 and image
dimensions at most 4096. UTF-8 text remains available in SVG text nodes.
Both implementations consume the same synthetic media/refusal vectors; browser
paint and native/human qualification remain separate evidence.
