# Contributing

This repository contains one Elixir package and four npm packages
(`npm/vite`, `npm/svelte`, `npm/doc-shell`, `npm/lint`) in a pnpm workspace.

## Setup

```bash
mix deps.get
pnpm install
```

The dev toolchain is pinned in `.tool-versions` (Erlang/OTP 29, Elixir 1.20,
Node 24); you'll also need pnpm. The Elixir requirement for *consumers* is the
`mix.exs` floor, `~> 1.18`.

## The quality gate

One command runs the Elixir and frontend gates. Run it for code changes before
merging:

```bash
mix check
```

It runs compile (warnings as errors), formatter, `credo --strict`, `doctor`
(documentation coverage), `mix_audit`, `dialyzer`, ExUnit with coverage (≥85%),
and the frontend checks: Biome (strict lint and format), `tsc`, Vitest with coverage (≥80%),
knip, and the package-export checks. Because it drives the frontend tools,
`mix check` needs Node and pnpm on `PATH`. To fix formatting first, run
`mix format` and `pnpm format`.

Coverage reports for local inspection: `MIX_ENV=test mix coveralls.html` (Elixir)
and `pnpm -r test` (frontend lcov under `npm/*/coverage/`).

## Conventions

Follow [`AGENTS.md`](AGENTS.md) for module documentation, deterministic
generation, optional dependency isolation, code conventions, and package scope.

## Commits & releases

Follow [`RELEASING.md`](RELEASING.md) for commit conventions and the coordinated
Hex/npm workflow, credentials, dry run, and partial-failure recovery. Agents keep
commits local; maintainers perform Git pushes manually.

## Pull requests

1. Branch from `main`.
2. Make the change and validate it as described in `AGENTS.md`.
3. Open a PR that explains why the change is needed and references any issue
   (`Closes #123`).
4. Ordinary PR CI runs the current-runtime lane on Elixir 1.20/OTP 29, omitting
   Dialyzer, the Hex consumer, and package-export checks. Manual or full-matrix
   CI adds the compile-and-test floor leg (1.18/OTP 27) and the complete gate.
   Run the full local gate before merging code changes.
