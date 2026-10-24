# DocShell renderer implementation plan

This tracker implements
[PHA.01](../specs/PHA.01-doc-shell-renderers.md) after the corresponding
`doc-shell-site/v1` package is available from DocShell.

| Package | Status | Requires | Deliverable | Acceptance |
| --- | --- | --- | --- | --- |
| PHA-P01 | source implemented; qualification below | DSH-P03/P06 | Import the upstream conformance corpus and add a renderer capability manifest | PHA-V01/V03; schema and fixture drift fail CI |
| PHA-P02 | source implemented; qualification below | PHA-P01 | Split URL, search, theme, navigation, copy, tabs and enhancement lifecycle into `@phoenix-assets/doc-shell/browser` | PHA-V02; Svelte renderer remains green |
| PHA-P03 | source implemented; qualification below | PHA-P01/P02 | Add optional DocShell dependency and `PhoenixAssets.DocShell.Ast` | PHA-V01/V07/V08; no-optional compile remains green |
| PHA-P04 | source implemented; qualification below | PHA-P03 | Add HEEx shell, navigation, breadcrumbs, table of contents, provenance and reading-flow components | PHA-V03–V07 |
| PHA-P05 | source implemented; qualification below | PHA-P03/P04 | Add directive, code, Mermaid fallback and browser enhancement components | PHA-V03/V05–V08 |
| PHA-P06 | source implemented; qualification below | PHA-P03–P05 | Add OpenAPI reference and disabled-by-default request panel | PHA-V03/V07/V08 |
| PHA-P07 | source implemented; qualification below | PHA-P02–P06; DSH-P07 | Implement `PhoenixAssets.DocShell.StaticRenderer` and packaged hashed assets | PHA-V04/V11/V12 |
| PHA-P08 | source implemented; qualification below | PHA-P02–P07 | Add shared JSON/Pagefind search integration and LiveView refresh hook | PHA-V05/V09; pinned Pagefind build and lazy chunk evidence |
| PHA-P09 | source implemented; qualification below | PHA-P04–P08 | Complete responsive, theme, locale, direction and accessibility behavior | PHA-V05/V06/V10 |
| PHA-P10 | source implemented; qualification below | PHA-P01–P09 | Qualify both renderers, archives and fresh consumers across supported runtimes | PHA-V01–V13 and `mix check` |

## Qualification scope

The source includes the browser lifecycle, HEEx/static adapters, shared search,
Pagefind adapter, native tabs/disclosures, bounded request execution and local
optional syntax/diagram assets. Unit tests cover the upstream corpus, unsafe
inputs, stale DOM work, deterministic IDs and optional-dependency isolation.
The exact-archive qualification records the executed browser cases and retained
screenshots. PHA-P10 closes only for the exact receipt that passes the release
process; source status alone is not release qualification. PHA-V03/V09/V10 still
require their full conformance-page, hosted Pagefind and visual inventories for a
claim covering all those surfaces. The current guide fixture does not establish
that broader claim.

The optional ELK chunk emitted by Mermaid 12 measures approximately 1.47 MiB raw
and 460 KiB gzip with the selected dependency graph. Its explicit per-file budget
is 2 MiB raw / 640 KiB gzip; highlighting is 192 KiB / 64 KiB. These optional
chunks load on use in the HEEx output. The base browser and CSS budgets remain
48 KiB / 16 KiB and 48 KiB / 12 KiB respectively. `Assets.validate/0` checks each
packaged file and local module references. Bundled third-party notices are
retained with the Hex assets.

## Build order rules

- Changes to shared site or fixture shapes land in DocShell first.
- Browser-core extraction keeps the existing Svelte API operational while the
  LiveView adapter is built.
- Each HEEx component lands with its DocShell fixture, Svelte comparison, and
  JavaScript-disabled assertion.
- Static rendering uses the component implementation already accepted for
  LiveView; it does not introduce another template tree.
- Visual snapshots are reviewed inputs. A test command cannot regenerate and
  accept new baselines in one step.
- Generated npm and Hex release artifacts remain outside source status checks
  and are validated from fresh package archives.

## Bundle budgets

The implementation records compressed and uncompressed sizes for the base CSS,
browser core, search, syntax languages, Mermaid, and OpenAPI request panel.
Search, highlighting, Mermaid and request execution load on first use. A normal
article must not load Mermaid or request-panel code. Budget changes require a
measured fixture and an explicit review in the same change.
