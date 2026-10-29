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
records remaining selector/customization, page metadata, publication-pair and
portable-artifact work. These planned options are not current component props.
Shared contracts land in DocShell first; this package owns rendering and visual
preview. Hosts supply brand content, labels and routes, and retain authorization
and product state. Native readers and producer algorithms are separate owners.

The package contains no app aliases. `DocShell` accepts a `DocShellTheme` through
its `theme` prop; both shells use the `--doc-*` CSS custom properties. Search
matches the supplied records with the built-in deterministic matcher. The
exported `Search` component accepts a replacement `search` callback. Navigation
uses the host's `navigate` callback when supplied.

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
require the producer's matching fallback digest. `admitPage(page)` exposes the
same Svelte preflight for callers. Its fallback verifier handles bounded canonical
JSON with strings, booleans, nulls and safe integers; metadata requiring another
numeric encoding must be normalized upstream. It refuses a digest it cannot
reproduce rather than dropping required content.

The Pagefind adapter builds separate locale indexes. Search loads them only when
a query needs them, preserves section routes and applies the same seven facets as
the JSON adapter. The search component also accepts a host-supplied `label`.
