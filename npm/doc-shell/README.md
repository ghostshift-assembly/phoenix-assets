# @phoenix-assets/doc-shell

Svelte documentation UI for renderer-neutral `doc-shell/v2` and legacy
`doc-shell/v1` presentations. The producer can be the `doc_shell` Hex package,
a host projector, or a build step that writes JSON. Each produces a
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

The package contains no app aliases. Customize its neutral defaults using the
`DocShellTheme` prop or the documented `--doc-*` CSS custom properties. Search
matches the supplied records with the built-in deterministic matcher. The
exported `Search` component accepts a replacement `search` callback. Navigation
uses the host's `navigate` callback when supplied.

The recursive AST renderer handles all fourteen directives plus Shiki and
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


The next coordinated release requires Svelte `^5.57.2`. Upgrade the host's Svelte
compiler and runtime together before installing its exact candidate archive.
The browser subpath remains independent of Svelte. HEEx static output ships local
optional highlighting and Mermaid chunks, loaded by the enhancement controls;
its import map follows the exporter's content-hashed URLs. Hosts with a script
nonce pass it to `PhoenixAssets.DocShell.Components.page/1`.

Try-it requests require confirmation, refuse redirects, keep tokens in component
memory, abort when their operation or component retires, and display at most
65,536 response bytes. A lost mutation response remains an unknown outcome and
is never retried automatically.
