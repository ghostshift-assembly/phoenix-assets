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
| PHA-P04 | fixed corpus implemented; customization gaps below | PHA-P03 | Add HEEx shell, navigation, breadcrumbs, table of contents, provenance and reading-flow components | PHA-V03–V07 |
| PHA-P05 | source implemented; qualification below | PHA-P03/P04 | Add directive, code, Mermaid fallback and browser enhancement components | PHA-V03/V05–V08 |
| PHA-P06 | source implemented; qualification below | PHA-P03–P05 | Add OpenAPI reference and disabled-by-default request panel | PHA-V03/V07/V08 |
| PHA-P07 | source implemented; qualification below | PHA-P02–P06; DSH-P07 | Implement `PhoenixAssets.DocShell.StaticRenderer` and packaged hashed assets | PHA-V04/V11/V12 |
| PHA-P08 | source implemented; qualification below | PHA-P02–P07 | Add shared JSON/Pagefind search integration and LiveView refresh hook | PHA-V05/V09; pinned Pagefind build and lazy chunk evidence |
| PHA-P09 | fixed corpus implemented; selectors and broader accessibility evidence open | PHA-P04–P08 | Complete responsive, theme, locale, direction and accessibility behavior | PHA-V05/V06/V10 |
| PHA-P10 | qualification workflow implemented; exact receipt required | PHA-P01–P09 | Qualify both renderers, archives and fresh consumers across supported runtimes | PHA-V01–V13 and `mix check` |
| PHA-P11 | settings, links, seams and shell/search labels implemented; enhancement labels and qualification pending | DSH-P15; PHA-P04/P09 | Adopt inert presentation settings and finish locale/release selectors, brand/footer seams and control labels | Native links, host-provided destinations, current selection, default compatibility, invalid inputs and keyboard/no-JavaScript cases |
| PHA-P12 | source gaps identified; implementation planned | DSH-P16; PHA-P11 | Render navigation badge/collapse metadata, splash/hero/banner content and required SEO metadata | Same admitted values in Svelte/HEEx/static output; description/canonical/Open Graph/robots, RTL and safe links; no product layout policy |
| PHA-P13 | planned; upstream pairing first | DSH-P10; PHA-P06 | Consume the host-admitted presentation/OpenAPI pair before API rendering | Matching pairs render; stale, missing, mixed-generation and cross-surface bindings refuse; host authentication/authorization remain outside |
| PHA-P14 | planned; no artifact profile support claimed | DSH-P11–P13; PHA-P05/P07 | Render verified artifact selections and a local diagnostic preview | Exact receipts/assets, captions, descriptions, anchors, limitations and fallback; safe selected media; no geometry, producer discovery or review approval |
| PHA-P15 | partial fixed-corpus evidence; extensions planned | PHA-P11–P14 | Complete browser and accessibility evidence for the expanded contract | Keyboard/focus, contrast/themes, RTL, zoom/reflow, print, offline/file/root/subpath and failed-enhancement cases; human/native results recorded separately |
| PHA-P16 | planned; new archive receipts required | DSH-P08/P17; PHA-P10–P15 | Qualify the coordinated packages and record cross-repository conformance | Both owning full gates/runtime cohorts, optional consumers, reviewed screenshots, exact upstream/downstream revisions and package digests; no stale receipt reuse |

## Coordinated completion

The [shared completion checklist](https://github.com/futhr/doc_shell/blob/main/docs/plans/documentation-sites.md#coordinated-completion)
records the twelve-step dependency order across both repositories. DSH-P10 and
DSH-P15/P16 own new shared data/validation; DSH-P11–P14 own portable-artifact
contracts and qualification inputs. Phoenix Assets owns the Svelte/HEEx/browser
implementations and visual preview. The row statuses distinguish implemented source from remaining work and release qualification.

Implement shared shapes upstream first, add behavior/refusal fixtures, then
consume those exact shapes here. Preserve existing DocShell 0.4 extraction and
0.5/1.0 renderer compatibility at their supported scope; a new selected
capability must declare its actual prerequisite rather than appearing to work
against an older upstream package. Preserve the existing Vite path/stub fixes
and their regressions while completing the DocShell work.

The artifact producer owns semantics, geometry and comparison images. Native
readers and their lifecycle belong to the native consumer. Phoenix Assets
provides neither of those implementations nor an approval workflow. Human
assistive tasks and native target checks remain external qualification items.
PHA.03 remains conditional on its own admission evidence.

### Consumer boundary review (2026-10-29)

Static review covered configuration/generated contracts, command/auth/socket
seams, reporting, DocShell and the supervised dev tools, plus DocShell's
projection/profile/export/web boundaries. No consumer-specific runtime feature
to move out was identified in those paths. The text boundary gate complements
this review; it cannot establish semantic ownership by itself.
The upstream review replaced a consumer name in a changelog API example/test
locator with `graph://release-notes/example`; no runtime platform branch was found.

Reporting `columns`/`order`/`spans` and its responsive table/chart layout belong
to the existing upstream report renderer, not an application dashboard policy.
DocShell CSS and controls are scoped to editorial rendering. Token/header,
socket and profile callbacks carry host-selected values; they do not choose
tenant scope, authorize operations or define product state. Example field
names and retained producer fixtures are not runtime dependencies on consumers.

The coordinated work must not introduce consumer task archetypes, application
breakpoint profiles, business vocabulary, runtime inspection, repository
discovery, deployment policy or producer algorithms. Host route/identity/label
inputs stay inert; HEEx slots and Svelte snippets stay in their renderers.

AshOaskit 0.4.5 is the released OpenAPI adapter baseline already selected in
DocShell's lockfile, recorded in its shared checklist. Phoenix Assets has no
direct AshOaskit dependency; qualify the admitted OpenAPI output without
copying Ash schema generation or forcing the adapter onto other consumers.

### Tracker and boundary checks (2026-10-29)

The coordinated docs pass verified 41 tracked Markdown/Livebook files, 99
local/repository reference paths and 29 anchors across both checkouts. The
twelve shared steps and DSH-P01–P17/PHA-P01–P16 definitions resolve without
duplicate tracker IDs. The existing boundary gate passes for 182 files; the
upstream consumer-name check passes for 72 production files. Canonical skill
links still resolve and remain ignored. Production syntax comparisons for
this pass's comment/doc edits show no executable changes; dependency manifests
and locks are unchanged.

This pass did not rerun application suites, notebooks, browsers, benchmarks or
archive/native/human qualification. The earlier Vite fixes and their tests
remain in the worktree; their recorded results below retain their prior scope.

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

The site shells do not yet provide locale/release selectors. Hosted HEEx exposes
brand/footer slots, but the static adapter supplies empty slots and Svelte
`SiteShell` has no equivalent slots. The fixed corpus does not exercise those
missing surfaces. Its zoom check uses an equivalent viewport; selected contrast
and keyboard assertions do not close a complete accessibility assessment.
These gaps remain open under PHA.01 instead of being inferred from a passing receipt.
Navigation badges/collapse defaults, splash/hero rendering, full banner and SEO
metadata, hosted publication pairing and portable-artifact rendering also need
the implementation and evidence assigned in PHA-P11–P16.

## Prior executed source checks (2026-10-29)

These results predate the coordinated tracker/ownership update. That update
uses source/reference/tracking checks only; it does not requalify archives,
the full runtime matrix or future features.

`mix check --no-retry --no-parallel` passes on Elixir 1.20.4 / OTP 29.0.4,
Node 24.21.0 and pnpm 12.15.0: 425 backend checks (18 doctests, 407 tests),
92.1% backend line coverage, 374 frontend tests and 17 release-script tests.
All configured required checks pass, including both Hex audits, the production
npm audit, package exports, optional-free Hex and HTTP consumers, and the
DocShell offline/story checks. Optional absent-package tools remain skipped.

The source audit added real Vite regressions for the default generated directory,
first generation after a stub import, and updates with default/custom paths.
The path and first-boot tests failed before their fixes. DocShell admission now
participates in its coverage gate: 141 DocShell tests pass with 93.93% package
line coverage and 98.27% admission line coverage.

Earlier on the same date, warnings-as-errors library compilation and the 425
backend checks passed on Elixir 1.18.4 / OTP 27.3.4.15 with separate dev/test build
directories. That floor leg was not rerun for the Vite fixes and prose audit.
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

`Assets.budgets/0` declares per-file raw/gzip limits for CSS, browser core,
highlighting and Mermaid chunks. Search and request controllers ship in the
base browser core; Pagefind indexes, syntax highlighting and Mermaid assets
load on use. Request controls remain inert until explicitly enabled and mounted.
Budget changes require a measured fixture and an explicit review in the same change.

### Coordinated settings evidence

Upstream `doc_shell` at `72b46cd` provides settings validation, context propagation
and hosted pair admission. Its full `mix check` passed on Elixir 1.20.4/OTP 29.0.4:
403 checks (16 doctests, 32 properties, 355 tests), 95.4% line coverage, Dialyzer,
documentation coverage and no-optional compilation. This is checkout evidence.

Downstream settings adoption passes 17 targeted HEEx checks against that sibling
candidate. The full `mix check --no-retry --no-parallel` also passes with the locked
producer: 427 backend checks (18 doctests, 409 tests), 92.0% line coverage, and 390
frontend tests (37 Vite, 157 DocShell, 186 Svelte, 10 lint). DocShell frontend line
coverage is 94.2%; the settings validator has 98.18%. Exports, audits, release tests,
HTTP-only and extracted Hex consumers, including supported older DocShell releases,
passed. A narrow absent-module annotation prevents compiler warnings when an older
producer lacks the new settings API; nonempty unsupported settings still refuse.
Fresh coordinated archive receipts and browser screenshots remain pending; the
previous retained qualification receipt does not cover these edits.

### JSON attribute regression

The upstream AST accepts JSON attribute values. Svelte's old declaration assumed
strings, and both code-fence renderers called string functions on arbitrary
class values. The regression uses numeric, boolean, null, array and object
attributes accepted by `DocShell.Ast.valid?/1`. Before the fix, all five Svelte
cases fail at `class.replace`, and HEEx fails at `String.replace_prefix/3`.
Supported string attributes still render; other values are ignored, unsafe
links/media retain visible fallbacks and code remains plain readable text.

After this correction, the full current-runtime `mix check --no-retry --no-parallel`
passes: 428 backend checks (18 doctests, 410 tests), 92.1% line coverage and
395 frontend tests (including 162 DocShell tests). Exports, audits and extracted
consumer checks passed again. This source evidence does not replace the pending
coordinated archive/browser receipt.
