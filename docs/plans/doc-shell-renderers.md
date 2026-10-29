# DocShell renderer implementation plan

This tracker implements
[PHA.01](../specs/PHA.01-doc-shell-renderers.md) against DocShell's
`doc-shell-site/v1` contract. Source implementation and exact-archive release
qualification are recorded separately.

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
| PHA-P10 | qualification workflow implemented; exact receipt required | PHA-P01–P09 | Qualify both renderers, archives and fresh consumers across supported runtimes | PHA-V01–V13 and `mix check` |

## Qualification scope

The source includes the browser lifecycle, HEEx/static adapters, shared search,
Pagefind adapter, native modal mobile navigation, tabs/contents disclosures,
bounded request execution and local
optional syntax/diagram assets. Unit tests cover the upstream corpus, unsafe
inputs, stale DOM work, deterministic IDs, capability admission and optional
dependency isolation. Producer-generated capability cases include accepted
fallback hashes, stale/missing proofs, unsupported essential features and invalid
requirements.

The browser qualification includes five projected pages: home, directive guide,
module reference, long code/tables and Arabic content. It compares JavaScript-disabled
text, headings, ordinary links, navigation, accessible names, landmarks and
page/cohort digests across static HEEx, Svelte SSR and hosted LiveView. DocShell's
public semantic-surface validator checks the observed output. The upstream
conformance vocabulary drives the directive and locale fixtures. Standalone
OpenAPI and 404 fixtures retain their native-link and inert-request checks.

JSON and real Pagefind searches replay the producer's fixed query/filter cases
in static HEEx, Svelte and connected LiveView. They cover section targets, all
seven facets, English/Swedish indexes, private-content exclusion, lazy loading,
focus restoration and three successive LiveView subtree replacements. Screenshots
cover the page inventory, search and mobile navigation at the recorded viewports
and themes. This describes the workflow's assertions; each candidate's receipt
records which assertions actually passed.

PHA-P10 closes only for the exact receipt that passes the release process,
including separate review of retained screenshots. Source status alone is not
release qualification. Host routes, branding, translation catalogues, backend
authorization and deployment remain outside this fixture cohort.

## Executed source checks (2026-10-29)

`mix check --no-retry --no-parallel` passes on Elixir 1.20.4 / OTP 29.0.4,
Node 24.21.0 and pnpm 12.15.0: 425 backend checks (18 doctests, 407 tests),
92.1% backend line coverage, 371 frontend tests and 17 release-script tests.
All configured required checks pass, including both Hex audits, the production
npm audit, package exports, optional-free Hex and HTTP consumers, and the
DocShell offline/story checks. Optional absent-package tools remain skipped.

Warnings-as-errors library compilation and the same 425 backend checks also pass
on Elixir 1.18.4 / OTP 27.3.4.15 with separate dev/test build directories.
The clean dependency compile emits Mint's optional `CAStore.file_path/0` warning;
this is not a warning-free claim for every dependency. Archive receipts and
screenshot review remain separate from these source results.

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
