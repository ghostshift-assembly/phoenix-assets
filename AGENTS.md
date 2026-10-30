# AGENTS.md

This is the canonical repository contract for coding agents working on
`phoenix_assets`. For using the library in a host app, see
[`usage-rules.md`](usage-rules.md).

## Skills and discovery

The AI selects and reads matching `.agents/skills/*/SKILL.md` files from their
descriptions when the task, changed mechanism, or delivery stage calls for them.
Users do not need to invoke skills or choose slash commands. Keep implicit
invocation enabled. Clients without native discovery must read this contract,
inspect skill descriptions, and load matching skills themselves.

Canonical skills are tracked in `.agents/skills/`. Claude project discovery uses
ignored individual directory symlinks in `.claude/skills/` pointing to those
skills, with matching directory names. When using Claude, create missing links
and repair repository-owned links. Preserve unrelated local entries and client
settings; remove obsolete repository-owned aliases.

Use [contract-change](.agents/skills/contract-change/SKILL.md) for source DSL,
generator, virtual-module and runtime changes;
[diagnose](.agents/skills/diagnose/SKILL.md) for observed failures; and
[package-proof](.agents/skills/package-proof/SKILL.md) for delivery evidence.
The writing skill retains claim/terminology review. Host application layout,
authorization and product state remain outside these workflows' implementation
ownership.

## Working agreements

- Never push branches, tags, commits, or other Git refs to a remote through a
  CLI, API, or browser. Keep commits local; the user performs every push.
- Never change repository visibility on a hosting provider. Visibility changes
  are manual, user-only actions. If a task depends on one, report the blocker
  and continue work that does not need it.
- Preserve unrelated changes and existing local client settings. Keep client
  configuration local; `.claude/` is entirely ignored.
- Keep repository instructions in this contract and its linked owning guidance;
  do not create client-specific instruction copies.

## What this repo is

The repository contains one Elixir Hex package (`:phoenix_assets`, at the root)
and four npm packages in a pnpm workspace (`npm/vite`, `npm/svelte`,
`npm/doc-shell`, `npm/lint`). The
Elixir side contains the plugin/preset engine, generators, dev supervision,
and HEEx documentation renderers. The npm side contains the Vite plugin, Svelte
runtime helpers, documentation shell, and shared frontend lint tooling. Elixir
modules live under the `PhoenixAssets.*` namespace.

## Writing

Use the [technical-writing skill](.agents/skills/technical-writing/SKILL.md) when
drafting or changing technical prose or preparing a delivery summary.
Preserve code, identifiers, commands, version numbers, dependency constraints,
source revisions, measured results, checksums, and contract language. Describe
compatibility, security, performance, publication, and operational use only as
far as the named contract or observed evidence supports.

## Setup

```bash
mix deps.get
pnpm install
```

The dev toolchain is pinned in `.tool-versions` (Erlang/OTP 29, Elixir 1.20,
Node 24); pnpm for the frontend. The package requires Elixir `~> 1.20`.
Release qualification runs compile + ExUnit on Elixir 1.20/OTP 28 and the full
gate on 1.20/OTP 29, as described in [`RELEASING.md`](RELEASING.md). Ordinary
PRs run one current-runtime lane; manual or full-matrix CI runs both OTP legs.
Check the workflow for the exact lane.

## Quality gate

```bash
mix check
```

`mix check` is the quality gate for the whole repository and must stay green.
It runs: `compile --warnings-as-errors`, `format --check-formatted`,
`credo --strict`, `doctor` (doc coverage), `docs --warnings-as-errors`,
`mix deps.audit`, `mix hex.audit`, `dialyzer`, ExUnit with coverage
(`mix coveralls.lcov`, ≥85%), and the frontend checks: Biome (strict),
`tsc --noEmit`, Vitest with coverage (≥80%), knip (dead-code detection),
`check:exports` (publint + arethetypeswrong), and the scope gate
(`scripts/check-boundary.mjs`, see below). It also requires the npm production
security audit, release checks, and a minimal consumer of the built Hex tarball
with no optional dependencies. It also checks DocShell source for direct network
asset references. It therefore requires Node + pnpm on
PATH. Config lives in `.check.exs`, `.doctor.exs`, `coveralls.json`, `.credo.exs`,
`biome.json`, `knip.json`.

Useful narrower commands: `mix test`, `MIX_ENV=test mix coveralls.html`,
`mix doctor`, `mix format`, `pnpm -r test`, `pnpm lint`, `pnpm -r typecheck`.

## Structure

```
lib/phoenix_assets/        engine (Plugin/Preset/Resolver/Engine), Config/Context,
                           generators, Graph, Manifest, Doctor, Dev*, DocShell,
                           stack plugins and their declaration DSLs, Presets.Svelte
lib/mix/tasks/             phoenix_assets.install/.gen/.doctor/.clean/.graph, plus
                           eight gen.<contract> delegates that forward to gen --only
test/                      ExUnit; test/support holds Ash fixtures; the headline
                           test is test/phoenix_assets/integration/kitchen_sink_test.exs
npm/vite, npm/svelte       TypeScript packages (Biome + Vitest)
npm/doc-shell              Svelte documentation UI for doc-shell/v2, legacy v1,
                           and doc-shell-site/v1 contracts
npm/lint                   shared Biome base config + Tailwind v4 linter for host apps
```

## What may live here

`phoenix_assets` is a generic asset substrate. It may know about Phoenix, Vite,
Svelte, Tailwind, Electric, Ash, and DocShell. It may not know about any product
built on it. A feature belongs here only if it would make sense to someone who
has never seen the apps that consume it.

Task-first application composition remains host-owned. This package does not
define product task archetypes, compact/medium/expanded thresholds, card or
dashboard policy, application state envelopes, or rules for which evidence,
authority and recovery controls remain visible. Generated contracts and generic
runtime helpers may carry typed values needed by a host, but they do not choose
the host's layout or semantic continuity policy. Storybook examples for product
tasks belong in the host repository.

UI is limited to the existing generic reporting and DocShell renderers:

- `@phoenix-assets/svelte/reporting` decodes a generic versioned envelope into
  charts. Domain semantics and theming come from the host. Business concepts
  do not belong in this renderer. The contract is owned upstream; changes land
  there first, and this package follows.
- `npm/doc-shell` and `PhoenixAssets.DocShell.*` render upstream-owned DocShell
  artifact and site contracts. Hosts supply identity and theme. Read the
  renderer specification and plan below when changing this surface.

`node scripts/check-boundary.mjs` checks configured platform names in `lib/`,
`npm/*/src`, and `npm/lint`, plus configured business terms in `reporting/`.
It runs as part of `mix check`. A passing text check does not establish that a
feature is generic. Review the API and ownership: would another host want the
same capability, or is the existing seam too narrow for hosts to implement it?

Two recurring failure modes need review:

- Absorbing a feature. A host's product code arrives with a generic name.
  The gate catches the obvious version; the subtle version is a config key or a
  contract field that only one host will ever set.
- Refusing to generalise. Repeated host workarounds can reveal a missing library
  seam. Assess that gap instead of requiring each host to rebuild the same
  Electric shape store, auth headers, or enum generation.

## Conventions

- Strict gates. Warnings are errors; Credo runs with `--strict`; unused variables must
  be a bare `_` (not `_foo`); dynamic atom creation is forbidden. Biome runs strict
  with `noUnusedImports/Variables/FunctionParameters` as errors.
- Default preset. `Config.preset_plugins/1` resolves `PhoenixAssets.Presets.Svelte`
  when `:preset` is unset. Stack plugins read host declaration modules from
  `config :phoenix_assets, :stack, ...`.
- Optional dependencies. Keep `ash`, `ash_typescript`, `gettext`, `tidewave`,
  `phoenix_live_view`, `igniter`, and `doc_shell` optional. `ash_typescript` and
  `tidewave` are version pins with no direct calls into those dependencies.
  Gate module definitions with `Code.ensure_loaded?/1` when they depend on
  optional behaviours or macros (`components.ex`, `phoenix_assets.install.ex`,
  and the DocShell modules). Gate optional generation and backend calls at the
  call site (`types.ex`, `walker.ex`, `localize.ex`).
- Sync qualification. Phoenix.Sync is a dev/test dependency at an immutable
  qualified revision. It must not appear in the published Hex requirements.
  Hosts select their backend; embedded hosts also own their Electric dependency.
  Electric/TanStack entrypoints require their qualified peer floors. Keep those
  peers optional so HTTP/Channels-only consumers can use `/core` and `/socket`
  without installing a sync client.
- Optional dependency isolation. `types.ex` gates Ash generation and
  `walker.ex` guards its public entry points. Narrow compiler annotations cover
  references to optional modules only when those modules are absent. The
  `hex_consumer` check compiles the packaged library without any optional
  dependencies and verifies that this produces no Elixir compiler warnings.
- Coverage floors: Elixir 85% (`coveralls.json`; thin `gen.*` delegates
  skipped), frontend 80%. The collection regression uses the actual TanStack
  and Electric packages under the browser conditions in the Svelte test runner,
  with a controlled fetch transport; the collection helper is included in coverage.
- Documentation coverage. `mix doctor` requires 100% moduledoc coverage; keep `@moduledoc`
  on every module and `@moduledoc false` on tests/fixtures.
- Determinism. Generators must emit byte-identical output for identical input
  (no timestamps, stable ordering). The no-write fast path and `--check` drift gate
  depend on it.
- Releases. Follow [`RELEASING.md`](RELEASING.md) for commit conventions,
  qualification, and the coordinated Hex/npm release process.
- Package layout. There is no `core/` or `stack/` split. Both
  layers share the `PhoenixAssets.*` namespace in `lib/`.

## Definition of done

For DocShell renderer work, read the
[specification](docs/specs/PHA.01-doc-shell-renderers.md) and follow the
[plan](docs/plans/doc-shell-renderers.md) in dependency order. The DocShell
artifact and site contracts remain upstream-owned.

The plan links the shared completion checklist in `doc_shell`. New portable
presentation settings, hosted publication pairing and artifact profiles land
upstream before renderer adoption here. Phoenix Assets owns visual controls,
slots/snippets, scoped CSS and diagnostic previews. Consumers/producers retain
source selection, route/brand/translation content, authorization, product task
state, native readers and geometry/semantic algorithms. Library completion
requires the specified automated contract, regression, browser and extracted
package checks across both repositories. Human verification and qualification
of a consumer's producer/native application are not library completion gates.

Code changes require `mix check` green end-to-end (Elixir, frontend, and both
coverage floors), and any new public module needs a `@moduledoc`.

For guidance-only changes, validate the affected metadata, references, Git
tracking and ignore boundaries, and discovery links using existing tools. Do
not install dependencies or run unrelated application suites for those changes.
Do not compile or build browser/package assets solely for instructions. Inspect
free disk, script effects and output paths before authorized archive/build proof;
clean only disposable outputs created by that run, preserving shared caches,
candidate producers and retained artifacts. Required failed/unavailable release
or optional-consumer evidence stays unverified.

Report actual review and executed checks separately from configured gates,
declarations, and planned work. State checks that were not run and material
limitations; a command in documentation is not a passing result.
