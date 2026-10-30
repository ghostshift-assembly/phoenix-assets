# DocShell renderer implementation plan

The renderer code implements [PHA.01](../specs/PHA.01-doc-shell-renderers.md).
Completion requires automated regressions, both owning full gates, independent
browser observations and fresh extracted-package consumers. Human verification
and consumer producer/native application validation are not library gates.

| Package | Status | Requires | Deliverable | Acceptance |
| --- | --- | --- | --- | --- |
| PHA-P01 | implemented; automated evidence below | DSH-P03/P06 | Import the upstream conformance corpus and add a renderer capability manifest | PHA-V01/V03; schema and fixture drift fail CI |
| PHA-P02 | implemented; automated evidence below | PHA-P01 | Split URL, search, theme, navigation, copy, tabs and enhancement lifecycle into `@phoenix-assets/doc-shell/browser` | PHA-V02; Svelte renderer remains green |
| PHA-P03 | implemented; automated evidence below | PHA-P01/P02 | Add optional DocShell dependency and `PhoenixAssets.DocShell.Ast` | PHA-V01/V07/V08; no-optional compile remains green |
| PHA-P04 | implemented; automated evidence below | PHA-P03 | Add HEEx shell, navigation, breadcrumbs, table of contents, provenance and reading-flow components | PHA-V03–V07 |
| PHA-P05 | implemented; automated evidence below | PHA-P03/P04 | Add directive, code, Mermaid fallback and browser enhancement components | PHA-V03/V05–V08 |
| PHA-P06 | implemented; automated evidence below | PHA-P03–P05 | Add OpenAPI reference and disabled-by-default request panel | PHA-V03/V07/V08 |
| PHA-P07 | implemented; automated evidence below | PHA-P02–P06; DSH-P07 | Implement `PhoenixAssets.DocShell.StaticRenderer` and packaged hashed assets | PHA-V04/V11/V12 |
| PHA-P08 | implemented; automated evidence below | PHA-P02–P07 | Add shared JSON/Pagefind search integration and LiveView refresh hook | PHA-V05/V09; pinned Pagefind build and lazy chunk evidence |
| PHA-P09 | implemented; automated evidence below | PHA-P04–P08 | Complete responsive, theme, locale, direction and accessibility behavior | PHA-V05/V06/V10 |
| PHA-P10 | implemented; automated evidence below | PHA-P01–P09 | Qualify both renderers, archives and fresh consumers across supported runtimes | PHA-V01–V13 and `mix check` |
| PHA-P11 | implemented; automated evidence below | DSH-P15; PHA-P04/P09 | Adopt inert presentation settings and finish locale/release selectors, brand/footer seams and control labels | Native links, host-provided destinations, current selection, default compatibility, invalid inputs and keyboard/no-JavaScript cases |
| PHA-P12 | implemented; automated evidence below | DSH-P16; PHA-P11 | Render navigation badge/collapse metadata, splash/hero/banner content and required SEO metadata | Same admitted values in Svelte/HEEx/static output; description/canonical/Open Graph/robots, RTL and safe links; no product layout policy |
| PHA-P13 | implemented; automated evidence below | DSH-P10; PHA-P06 | Consume the host-admitted presentation/OpenAPI pair before API rendering | Matching pairs render; stale, missing, mixed-generation and cross-surface bindings refuse; host authentication/authorization remain outside |
| PHA-P14 | implemented; automated evidence below | DSH-P11–P13; PHA-P05/P07 | Render verified artifact selections and a local diagnostic preview | Exact receipts/assets, captions, descriptions, anchors, limitations and fallback; safe selected media; no geometry, producer discovery or review approval |
| PHA-P15 | implemented; automated evidence below | PHA-P11–P14 | Complete browser and accessibility evidence for the expanded contract | Keyboard/focus, contrast/themes, RTL, zoom/reflow, print, offline/file/root/subpath and failed-enhancement cases; consumer deployments stay separately owned |
| PHA-P16 | implemented; automated evidence below | DSH-P08/P17; PHA-P10–P15 | Qualify the coordinated packages and record cross-repository conformance | Both owning full gates/runtime cohorts, optional consumers, reviewed screenshots, exact upstream/downstream revisions and package digests; no stale receipt reuse |
| --- | --- | --- |

## Coordinated completion

The [upstream checklist](https://github.com/futhr/doc_shell/blob/main/docs/plans/documentation-sites.md#coordinated-completion)
owns shared contracts, projection and export. Phoenix Assets owns Svelte/HEEx
rendering, browser controls, scoped CSS and diagnostic previews. Hosts retain
source selection, identity/labels, routing, authorization, product state and
producer/native implementations. No consumer-specific runtime feature to move
out was found in the reviewed library paths; the boundary text gate supplements
that API ownership review.

## Requirement evidence map

This maps each PHA.01 requirement to its owning implementation and executable
proof. Source tests and extracted-package executions are distinct. Fresh
archive receipts retain their own exact source/producer/peer identities.

| Requirement | Owner and executable proof | Qualification boundary |
| --- | --- | --- |
| PHA-S01 | Upstream presentation/profile contracts; frozen canonical, hosted-pair and artifact corpora checked by `conformance.test.ts`, `hosted-pair.test.ts`, `artifacts.test.ts` and native counterpart suites | Producer meaning and host authority remain outside |
| PHA-S02 | `src/browser/*`; `browser.test.ts`, lifecycle and request tests; `Assets.validate/0` and export checks | Extracted browser import/bundle proof belongs to the release lane |
| PHA-S03 | Conditional `DocShell.Components`, `Ast`, `ApiReference`, `Settings`; `doc_shell_test.exs` and candidate integration suites | New upstream APIs explicitly refuse on older producers |
| PHA-S04 | `StaticRenderer` and the same `Components.page/1`; `doc_shell_conformance_test.exs`, exporter tests and `mix run --no-start` fixtures | Hosted endpoint proof is separate from no-start output |
| PHA-S05 | Closed AST/fallback paths and passive receipt context; `components.svelte.test.ts` and `ast-regressions.svelte.test.ts`, artifact DOM/native tests and no-JavaScript browser lanes | Native applications stay consumer-owned |
| PHA-S06 | Shared browser controllers, JSON/Pagefind, directives and OpenAPI adapters; browser/search/conformance qualification scripts | Expanded host settings are also checked by the artifact/site reader lane |
| PHA-S07 | Semantic shell, native links/disclosures, focus and responsive/theme CSS; browser/conformance keyboard, contrast, reflow and RTL cases | Automated keyboard, focus, reflow and contrast checks; host deployment stays consumer-owned |
| PHA-S08 | `Assets` and `build-browser.mjs`; local-import, no-map, size/gzip, content-hash and offline checks | Archived assets must be measured again for each cut |
| PHA-S09 | Upstream `Conformance` corpus and capability fixtures; source/native tests plus `conformance-qualification.mjs` | Independent extracted/hosted reader observations are archive-specific |
| PHA-S10 | Module guards, runtime API guards and browser subpath; `package_test.exs`, `smoke-hex`, exports and fresh consumer checks | Optional-free and selected-producer modes are distinct |
| PHA-S11 | Scoped editorial CSS, host slots/snippets, inert settings and generic artifact preview | Ownership review plus boundary gate; no product task/state/layout or producer algorithm was added |
| PHA-V01 | `scripts/release.mjs smoke-hex`: optional-free and released DocShell 2.0.0 consumers; receipt verification tests | Published compatibility does not imply new receipt support |
| PHA-V02 | Browser entry/import checks, shared controller tests and packaged `Assets.validate/0` | No Svelte dependency is introduced through the browser entry |
| PHA-V03 | `doc_shell_conformance_test.exs`, upstream frozen cohort and extracted Svelte/static/hosted surface comparisons | The expanded settings/artifact observations extend the baseline corpus |
| PHA-V04 | Shared HEEx page body, source digest assertions, hosted fixture and surface validator | Byte-identical framework HTML is not required |
| PHA-V05 | Browser/search/conformance keyboard tests; passive reader disclosure, selector and anchor tasks | Automated interaction does not replace a deployment accessibility assessment |
| PHA-V06 | Browser/conformance 320/768/1280 layouts, reduced motion, themes, RTL and zoom-equivalent reflow; passive preview modes | 400%-equivalent reflow is exercised in Chromium |
| PHA-V07 | JavaScript-disabled SSR/HEEx cases, API fallback and offline file artifact reader | Svelte SiteShell is hosted HTTP HTML; the HEEx exporter owns file URL rewriting |
| PHA-V08 | AST/URL/OpenAPI refusal suites, original canonical proofs, stale pair/receipt cases and shared SVG/PNG vectors | Media structure checks do not qualify producer geometry or PNG pixels |
| PHA-V09 | `search-qualification.mjs`, lazy Pagefind requests and equivalent JSON/Pagefind filter tasks in all three surfaces | Archive/producer/locale identities must match the receipt |
| PHA-V10 | Baseline browser screenshots plus artifact/site/preview screenshots and explicit visual inspection | New or changed image bytes need review; old archive receipts cannot be reused |
| PHA-V11 | `Assets.validate/0`, offline guard, package export checks and bundle budgets in the full gate | Fresh archive bytes are the release subject |
| PHA-V12 | No-start Hex static fixture, local server/file readers and JavaScript-disabled network checks | No endpoint/socket/Node runtime is needed to read the static files |
| PHA-V13 | Ownership review, scoped CSS, customization and boundary checks | Host-owned arbitrary CSS and product policy remain outside this renderer |


## Executed automated evidence

- DocShell full gate: 441 checks (16 doctests, 35 properties, 390 tests), 95.6%
  line coverage; compiler, optional-free compile, strict lint, docs/spec coverage,
  audits and Dialyzer pass on Elixir 1.20.4/OTP 29.0.4.
- Phoenix Assets full gate: 507 backend checks at 87.6% coverage. The full gate
  against the current sibling passes 514 checks at 92.5%. Both pass 557 frontend
  tests (324 DocShell), all 25 required checks, frontend coverage floors,
  17 release-script tests and packaged optional consumers.
- New regressions first failed on undeclared profile media/subject acceptance,
  a hidden nested receipt requirement, shell/search/code/tab ID collisions and
  dark-theme skip-link contrast. Chromium reproduces duplicate IDs and the 1.8:1
  skip-link ratio against the earlier archives; corrected owners pass.
- Earlier coordinated archives passed 166 baseline and 152 expanded reader cases,
  with 158 reviewed screenshots. Fresh evidence for the current source belongs
  to its own archive receipt; old receipts are not relabelled.
- Five checkout notebooks executed 64 cells; six benchmark reports identify their
  source/runtime cohort. These records do not claim fresh Livebook installation
  of unreleased APIs or a performance guarantee.

## Package and CI evidence

`phoenix-assets/dist/release/spec-completion/qualification.json` and
`doc-shell-cohort/coordinated-proof.json` in that directory are local lookup
paths for the current archived cohort. Verify those content-addressed receipts
against their source revisions, locks, package hashes and browser output.
Generated release artifacts remain ignored by Git. Registry publication is verified against the exact release archives.

The maintainer's pushed revisions passed
[Phoenix Assets 41008416945](https://github.com/ghostshift-assembly/phoenix-assets/actions/runs/41008416945)
(`fc6e8f2`) and [DocShell 41008380235](https://github.com/futhr/doc_shell/actions/runs/41008380235)
(`64e92b1`), including DocShell's Elixir 1.20/OTP 28 and 29 lanes. That Phoenix
Assets run used the older candidate pin. CI now resolves the published DocShell
2.0 dependency from its lock, runs the full gate on main pushes and verifies
receipt support without a candidate-only test condition. New local commits need another maintainer push for CI.
Codecov uploads reported `Repository not found`; the workflow tolerates that
optional service failure. Coverage floors are enforced by the passing local gates.

## Ownership and history

AshOaskit 0.4.5 remains the released adapter baseline in DocShell's development/
test lock; core users do not acquire it. Phoenix Assets has no direct dependency
on the adapter. PHA.03 admits no shared extension without its separate build-only
reuse evidence; it is not a source implementation prerequisite.

Earlier measurements, exact archive/fixture hashes and intermediate failures
remain in the [prior committed record](https://github.com/ghostshift-assembly/phoenix-assets/blob/fc6e8f2/docs/plans/doc-shell-renderers.md)
and retained archive receipts. The current table and automated evidence above
define this tracker; historical pending prose does not override them.
