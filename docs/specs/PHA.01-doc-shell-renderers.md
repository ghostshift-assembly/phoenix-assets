# PHA.01: DocShell renderers for Svelte and LiveView

Specification version: 0.3.2. Contract: accepted. Implementation status:
implemented for the fixed conformance cohort, with the source gaps listed below;
release qualification is artifact-specific.
The [renderer completion tracker](../plans/doc-shell-renderers.md#coordinated-completion)
and its linked upstream checklist assign the remaining work in dependency order.
New shared presentation, publication-pair and artifact contracts land in
DocShell before their renderer implementation; planned rows are not current APIs.

## Purpose

Phoenix Assets provides framework renderers for DocShell's renderer-neutral
artifacts. `@phoenix-assets/doc-shell` is the Svelte renderer. The optional
Elixir integration supplies the equivalent Phoenix function components and a
static HTML renderer for controller, LiveView, and generated-site use.

DocShell owns `doc-shell/v2`, legacy `doc-shell/v1` presentations,
`doc-shell-site/v1`, content projection, route validation, search records, and
renderer conformance fixtures. Phoenix Assets
owns HTML, CSS, browser behavior, Svelte components, HEEx components, and the
adapter code that consumes those contracts. Hosts own routes, authorization,
branding, documentation taxonomy, source selection, and deployment.

The renderers include only the controls and scoped CSS needed to present the
upstream documentation contract. Product design systems, application shells,
domain components and host themes remain host-owned. A renderer exposes slots
and semantic custom properties; it does not become a general component
library.

DocShell is an editorial reading surface. Search, navigation, reading progress
and source provenance do not define an authenticated product task, application
state envelope or authority model. A host that mounts documentation beside an
application keeps the routes, chrome, authorization and adaptive task
composition separate. Phoenix Assets does not add product archetypes,
application container thresholds, card/dashboard policy or workflow state to
the DocShell contract.

The optional upstream presentation settings carry host-supplied inert identity, labels and links.
Hosts choose the brand, locale/release destinations and disclosure policy;
the library must not infer them from application names, sessions or repository
layout. Framework slots/snippets, CSS and visual previews remain renderer-owned.
The native reader, artifact producer and host retain their implementation and
qualification duties under the upstream checklist.

## Hosted publication pair consumption

Svelte `HostedReference` and HEEx `ApiReference.hosted_reference/1` consume an
already host-admitted narrative/OpenAPI pair plus the expected publication view.
Both bindings must match every upstream `doc-shell-publication/v1` field before
narrative or operations render. Missing, mixed, stale and cross-surface bindings
refuse. The components render one selected document and its API reference; host
routing, surrounding chrome, source admission and authorization remain outside.

Svelte's `admitHostedPair` checks bindings, required top-level presentation fields
and declared OpenAPI version. Source data must already satisfy the upstream
presentation/OpenAPI contracts. HEEx invokes upstream `HostedPair.validate/3`
before calling either renderer and refuses when the installed producer lacks it.
The shared fixture is copied byte-for-byte from `doc_shell@72b46cd` and pinned by
SHA-256. Tests cover matching output and refusal before DOM/component output.
These source checks await fresh package/browser qualification.

## Package boundary

The existing npm package remains:

```text
@phoenix-assets/doc-shell
```

The LiveView renderer belongs to the `phoenix_assets` Hex package under
`PhoenixAssets.DocShell`. HEEx/static rendering requires compatible `doc_shell`,
`phoenix_html`, and `phoenix_live_view` packages. Each adapter is conditionally
compiled against the modules it uses: the AST adapter needs DocShell AST and
Phoenix HTML; the asset and Pagefind adapters need their DocShell presentation
modules. A consumer that omits optional dependencies must compile without
warnings and must not resolve frontend-only dependencies.

The asset substrate also accepts DocShell 0.4 for hosts using its extraction
contract. Site presentation adapters compile only when their required 0.5
presentation modules exist; accepting 0.4 does not advertise those newer APIs.
Packaged compatibility consumers must compile with 0.4 plus LiveView and with
the site presentation adapters on DocShell 0.5 and 1.0. The npm renderer accepts
its v2 presentation shape while keeping member-reference metadata opaque. This
does not add support for optional portable artifact profiles.

No host application name, route, brand, source taxonomy, or authorization rule
may appear under `lib/phoenix_assets/doc_shell/` or `npm/doc-shell/src/`.

## Shared browser core

The npm package exposes a framework-independent browser subpath:

```text
@phoenix-assets/doc-shell/browser
```

It contains:

- safe internal/external URL classification;
- search index loading, ranking, filters, and keyboard state;
- system/light/dark theme selection and persistence;
- mobile navigation and collapsible-group state;
- code-copy controls;
- optional syntax highlighting and Mermaid enhancement;
- tab and disclosure behavior; and
- API request construction and confirmation policy.

The browser subpath must not import Svelte. The Svelte renderer and the
LiveView asset entry both call the same functions. Each function accepts an
explicit root element and can be mounted, refreshed, and destroyed without
global event duplication.

Browser-core controllers remain the default for small progressive
enhancements. Search, navigation, article content, provenance and ordinary
links must not depend on an enhancer mounting successfully. A host may wrap a
renderer subtree in its own client-component boundary, but that protocol and
component registry are outside Phoenix Assets.

Both renderers return DSH.01's normalized capability value. The static renderer
declares fallback or enhanced support for `doc-shell/html/v1`, search, theme,
navigation, copy, tabs, highlighting and Mermaid as implemented. It never
declares `:connected`. A host owns any connected interaction and authorization
gate. Unknown essential feature IDs fail before HTML is emitted; optional
features require their recorded fallback digest.

Direct Svelte and HEEx page rendering also performs this admission. Svelte
reproduces fallback hashes for bounded canonical JSON containing strings,
booleans, nulls and safe integers, with Jason's uppercase control escapes.
When JavaScript decoding loses a numeric representation, callers preserve the
original canonical content and pass `canonicalContent` to `SiteShell` or
`admitPage(page, canonicalContent)`. The proof reader retains numeric lexemes and subtrees, checks
decoded content equality and hashes the original spelling. Source numbers are
not normalized. Proofs have an 8 MiB UTF-8 byte limit, 256 container levels and
one million values, reject duplicate/unordered keys and executable accessors,
and do not establish source authenticity. Unverifiable bytes still refuse.

Phoenix Assets also provides an optional Pagefind search adapter and browser
binding. It pins the Pagefind build package, runs it only during asset/site
generation, and records its version and output digests. Pagefind is implemented
in Rust and produces static browser assets; it adds no Python interpreter,
search server, account, or production process. The deterministic JSON adapter
from DocShell remains available for hosts that do not select Pagefind.

Static HTML initializes the browser core on `DOMContentLoaded`. The LiveView
adapter wraps the same initializer in one namespaced hook so DOM patches call
refresh and teardown. Article text, navigation, code source, diagram source,
and API descriptions remain available when JavaScript is absent.

## LiveView component contract

The optional integration exposes these public modules:

```text
PhoenixAssets.DocShell.Components
PhoenixAssets.DocShell.Ast
PhoenixAssets.DocShell.ApiReference
PhoenixAssets.DocShell.StaticRenderer
PhoenixAssets.DocShell.Assets
PhoenixAssets.DocShell.Pagefind
```

`PhoenixAssets.DocShell.Components` provides documented function components
for:

- complete documentation page and shell;
- header, brand slot and theme controls;
- desktop sidebar, mobile navigation, groups, badges and current-page state;
- search button, dialog or inline section, filters and results;
- breadcrumbs, page title, version/status context and announcement banner;
- table of contents and anchored headings;
- previous/next links, last-updated, source and edit links;
- code block and copy control; and
- backlinks.

`PhoenixAssets.DocShell.Ast` renders callouts, cards, link cards, card grids,
badges, file trees, steps, tabs and diagram fallbacks from admitted content.
`PhoenixAssets.DocShell.ApiReference` provides function components for OpenAPI
tags, operations, parameters, request/response examples, recursive schemas and
the optional request panel. These are separate APIs from `Components`.

Public components declare `attr` and `slot` contracts and have typespecs and
module documentation. They accept `DocShell.Presentation.Site`, `Page`, and
related structs rather than unvalidated maps. Host chrome enters through named
slots and semantic token overrides.

Components use the renderer's scoped DocShell classes and semantic custom
properties. Hosts may override those properties or supply brand and footer
slots without replacing admitted document content with an HTML string. The
Svelte and HEEx renderers keep equivalent visible semantics without depending
on a Phoenix Assets-wide design system.

The shell uses scoped CSS custom properties. It does not require Tailwind,
DaisyUI, an icon package, web fonts, a reset stylesheet, or a CDN. Default
icons are local, labelled where interactive, and hidden from assistive
technology where decorative.

## Static renderer

`PhoenixAssets.DocShell.StaticRenderer` implements
`DocShell.Presentation.Renderer`. It invokes the same function components used
inside a LiveView and converts their HTML-safe result to iodata. Its layout
adds the document type, language and direction, metadata, canonical link,
hashed local assets, and an optional base path.

The static renderer does not start an endpoint, supervision tree, PubSub,
LiveView socket, or asset development server. It does not read application
sessions. Its current renderer context supplies title, canonical origin,
navigation, search, locale, route, digests and asset URLs as inert values.
Brand/footer slots are available when calling the hosted HEEx page component;
the static adapter currently supplies empty slots.

LiveView and static output may differ in framework transport attributes. They
must have the same visible content, landmarks, accessible names, heading tree,
routes, navigation order, source links, and page/cohort digests.

## Interaction and layout

The default presentation includes:

- a first-focus skip link;
- a compact header with site identity, search, source link, locale/version and
  theme controls as available;
- a hierarchical left sidebar on wide screens and equivalent modal navigation
  on small screens;
- one readable article column;
- a sticky table of contents on wide screens and an inline disclosure on small
  screens;
- previous/next reading links and page provenance below the article; and
- an explicit 404 page with navigation and search.

At viewport widths where three columns do not fit, the table of contents moves
inline before the sidebar becomes a modal. Content must reflow at 400% zoom and
320 CSS pixels without hiding essential controls. Sidebar width may be user
adjustable, but keyboard resizing and a bounded persisted value are required.

System theme is the default until a reader chooses light or dark. The choice is
applied before first paint when the host permits a local bootstrap script; the
site remains readable if its CSP disallows that optimization. Themes meet WCAG
2.2 AA contrast for text, focus indicators, controls, links, code, and status
badges.

## Search

Both renderers consume the same DocShell search adapter output. The default
dialog opens from a labelled button and the platform shortcut, traps focus,
closes on Escape, supports arrow-key selection and Enter navigation, and
restores focus to its trigger. Results show page, section, collection and
version context. Locale, package, document kind, version, tag and status
filters remain available when present.

The HEEx search component also accepts `presentation: :inline`. It uses a
non-modal section within the host's content layout, leaving surrounding links
and controls available. Escape closes it and returns focus to the opening
control; result arrows and Enter apply only while the query input has focus.
Hosts may omit the default trigger and provide a labelled
`data-doc-search-open` control within the same browser-core root. Header and
controls slots accept host chrome while retaining the shared query, filter and
result behavior. The default remains a modal dialog.

When a static adapter omits embedded records, the host may pass admitted
`filter_values` separately. Only the seven supported facet names are rendered;
each accepts at most 256 unique, sorted, non-empty UTF-8 strings of at most
256 bytes. Invalid values are omitted. Loading, empty, result-count and failed
queries have a live status message in both presentations.

Result excerpts are bounded to 320 displayed characters. The browser renders
their text safely and recognizes only inert `mark` highlighting; index text
cannot create images, scripts or other HTML elements.

The default search path is fully static and sends no query or telemetry to a
service. A host may supply another `DocShell.Presentation.SearchAdapter`, but
the renderer interface and accessibility behavior stay the same.

The Pagefind binding supports section results, locale indexes, and filters for
collection/package, kind, version, tag and status. It lazy-loads index chunks
after search opens. Search HTML and filter metadata come from admitted DocShell
page records; renderer-only chrome and hidden/private content are marked out of
the index.

## Content rendering

`PhoenixAssets.DocShell.Ast` walks only valid DocShell AST. It escapes text,
allows a closed HTML element and attribute set, validates links and media URLs,
and renders unknown directives as visible child content. Heading IDs come from
the projected page; the renderer does not recalculate them.

Code blocks render semantic `<pre><code>` source before enhancement. Copy works
with keyboard and pointer input and reports success without moving focus.
Unsupported languages stay plain text. Mermaid source remains visible in a
fallback block when parsing or browser execution fails.

Inline spans retain safe textual anchor IDs in both renderers. A pre element
with mixed children stays plain and preserves every child; the single-code-child
enhancement path cannot discard a sibling warning. The artifact fallback owner
upstream rejects child content under the void `br` element.

Tabs use tablist/tab/tabpanel semantics, arrow-key navigation, Home/End, and a
readable stacked fallback without JavaScript. Steps retain ordered-list
semantics. Callout kind is expressed in its text label and not only color.

## OpenAPI boundary

API reference rendering accepts OpenAPI 3.0, 3.1 and 3.2 documents already
admitted by DocShell. Schema recursion and references are bounded. Unknown
dialect features remain visible as JSON instead of disappearing.

Request execution is disabled unless the host supplies an exact API origin and
enables it. Paths cannot replace that origin. Cross-origin requests require an
exact allowlist entry and an on-screen destination confirmation. Browser
credentials remain same-origin unless the host explicitly supplies another
credential adapter. Static public documentation must work with the request
panel disabled.

## Visual and functional parity

The Svelte and LiveView renderers consume the same conformance corpus. Parity
means the same user capability and document semantics, not matching component
source or HTML bytes.

The acceptance baseline includes the useful behavior associated with mature
documentation sites:

- clear typography and stable reading measure;
- responsive sidebar/header/table-of-contents composition;
- search available from every page;
- light, dark and system themes;
- localized navigation and right-to-left direction;
- edit/source and last-updated context;
- page status/version badges and release selection;
- heading anchors and reading-flow navigation;
- code highlighting and copy;
- diagrams, content callouts and structured learning components;
- static SEO and machine-readable documentation; and
- no essential feature gated on a hosted service.

## Requirement catalogue

| ID | Requirement |
| --- | --- |
| PHA-S01 | Keep the DocShell contracts upstream and keep Svelte/LiveView rendering in Phoenix Assets. |
| PHA-S02 | Extract a Svelte-free browser core, including optional Pagefind binding, used by both renderers. |
| PHA-S03 | Provide conditionally compiled HEEx components for the complete `doc-shell-site/v1` page contract. |
| PHA-S04 | Implement a no-start static renderer with the same HEEx components used by LiveView. |
| PHA-S05 | Preserve useful HTML, navigation, code and diagram fallbacks without JavaScript. |
| PHA-S06 | Provide equivalent search, themes, responsive navigation, content directives and OpenAPI behavior in Svelte and LiveView. |
| PHA-S07 | Meet the specified keyboard, landmark, focus, reflow, contrast, motion, locale and direction behavior. |
| PHA-S08 | Ship local, content-hashed browser and CSS assets with explicit bundle budgets and no CDN dependency. |
| PHA-S09 | Consume DocShell's shared conformance fixtures and report renderer identity and supported capabilities. |
| PHA-S10 | Keep the Hex package usable without DocShell or LiveView and the browser subpath usable without Svelte. |
| PHA-S11 | Keep renderer CSS scoped and host-overridable without absorbing an application design system, task-composition policy, application state envelope or client-component registry. |

## Executable vectors

| ID | Evidence |
| --- | --- |
| PHA-V01 | The Hex package compiles with no optional dependencies; installing DocShell 0.5 or 1.0 plus LiveView exposes every adapter module. DocShell 0.4 plus LiveView exposes the AST adapter while site presentation adapters remain absent. |
| PHA-V02 | Importing `@phoenix-assets/doc-shell/browser` resolves no Svelte module and passes DOM lifecycle tests. |
| PHA-V03 | Svelte and LiveView render every DocShell conformance page with equal visible text, headings, links, navigation and accessible names. |
| PHA-V04 | Static and LiveView HEEx output share page/cohort digests and normalized document semantics. |
| PHA-V05 | Keyboard tests cover skip link, search trigger/dialog/results, mobile menu, sidebar groups, tabs, disclosures, copy, theme and locale controls. |
| PHA-V06 | Browser tests cover 320/768/1280 CSS pixel layouts, 400% zoom, reduced motion, light/dark/system themes and left-to-right/right-to-left pages. |
| PHA-V07 | JavaScript-disabled tests retain article, navigation, table of contents, code, diagram source, API reference and all ordinary links. |
| PHA-V08 | Unsafe AST/URL/OpenAPI fixtures are escaped, refused, or visibly degraded according to the closed policy in both renderers. |
| PHA-V09 | JSON and Pagefind search behavior and filters match the fixed corpus in hosted LiveView, static HEEx and Svelte builds; Pagefind loads no index chunk before search use. |
| PHA-V10 | Visual snapshots cover home, guide, module reference, OpenAPI, search, mobile navigation, long code/table and 404 pages in both themes. |
| PHA-V11 | Production assets contain no remote URL, source map, undeclared file, Svelte import in the browser subpath, or file above its declared budget. |
| PHA-V12 | A fresh static-site consumer renders and opens the generated output without an endpoint, WebSocket, Node runtime, or network access. |
| PHA-V13 | DocShell assets contain only renderer-scoped editorial styles and behavior, with no product archetype, application profile threshold or workflow-state contract; a host override cannot remove article, navigation, search fallback, provenance or ordinary links. |

## Evidence boundary

Unit and component tests prove renderer source behavior. Playwright tests prove
the tested browser and viewport cohort. Automated accessibility checks support
review but do not claim WCAG certification. Registry publication and adoption
by a host remain separate evidence.

The projected Svelte and HEEx site shells consume the upstream inert
`presentation` settings for locale/release links, brand/footer data, shell/search
labels and SEO metadata. Svelte exposes local `brand` and `footer` snippets and
an `assetUrls` map; HEEx retains local slots. Static export obtains settings
through renderer context. Nonempty HEEx settings require the upstream validator;
older DocShell releases keep their default rendering. Targeted candidate tests
exercise these additions, while package/browser qualification remains pending.
Nested code/diagram, tabs, directive and API/request controls now inherit host
labels. Standalone Svelte AST/API/hosted/legacy shells accept a `labels` map;
HEEx `Ast.render/2` accepts that map and API components accept `settings`.
Browser copy/enhancement/request statuses read the nearest inert label scope.
The [package documentation](../../npm/doc-shell/README.md) lists control keys.
Source wording remains unchanged. Unit/component tests cover inheritance,
escaping, catalogue isolation and status changes; expanded target qualification
remains open under PHA-P15/P16.
PHA-P12 now consumes validated hero/banner content, splash presentation,
reserved per-page SEO and badge/collapse metadata. Static local image bytes use
the existing asset handoff; absent hero images retain alt text. Projected sites
opt into navigation metadata, while legacy sidebars leave it opaque by default.
Locale markers match the active locale when that ID is among the supplied
choices, without deriving destinations. Expanded target qualification remains open.

Browser qualification tests a 400%-zoom-equivalent viewport rather than changing
browser zoom itself. It checks selected text contrast and keyboard behavior;
it does not establish contrast for every control/state or a complete WCAG 2.2 AA
assessment. PHA-V05/V06 and the broader customization requirements remain open
at that scope, even when the fixed-corpus receipt passes.

### Passive artifact media subset

The renderer now exposes matching pure SVG/PNG media checks in Elixir and
TypeScript. The [package documentation](../../npm/doc-shell/README.md#artifact-media-checks-in-the-current-checkout)
fixes their supported elements, attributes and resource limits. The check retains
original bytes, permits no retrieval or executable content, and leaves geometry,
meaning and pixel decoding to the producer/reader. A shared synthetic corpus
checks valid media and refusal vectors in both implementations. Receipt-backed
views and diagnostic previews remain open under PHA-P14; these checks alone do
not advertise artifact profile support or establish target qualification.
