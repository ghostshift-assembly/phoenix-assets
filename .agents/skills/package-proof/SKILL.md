---
name: package-proof
description: "Select Elixir/npm/runtime and optional-consumer evidence before PhoenixAssets handoff or release claims. Distinguish checkout, extracted package, qualified producer and host proof; guidance-only work uses source checks."
user-invocable: false
---

# Verify the affected library consumer

Read [.check.exs](../../../.check.exs), package scripts and
[release controls](../../../RELEASING.md) before running the gate. `mix check`
includes frozen pnpm install, browser asset generation, coverage, exports and
consumer smoke. Even `hex.build` has a DocShell browser-assets alias in this
checkout. These are not source-only guidance checks.

Select the affected owner tests and actual consumer boundary:

| Change | Existing evidence |
| --- | --- |
| Plugin/DSL/generation | Owner ExUnit and [kitchen sink](../../../test/phoenix_assets/integration/kitchen_sink_test.exs); deterministic emitted TS, private-field exclusion and no-op drift |
| Vite/Svelte helpers | Affected workspace Vitest/type/exports checks; browser-condition collection/auth cases for Electric/TanStack |
| Optional package/API | [Package tests](../../../test/phoenix_assets/package_test.exs), `node scripts/release.mjs smoke-hex` for built Hex without optional deps |
| HTTP-only npm surface | `node scripts/release.mjs smoke-core`; core/socket imports must not require sync peers |
| Sync/producer revision | [Phoenix.Sync fixture](../../../test/phoenix_assets/integration/phoenix_sync_test.exs), qualified peers/candidate producer and actual backend evidence where claimed |
| DocShell | Exact producer artifact/site contract plus renderer/offline/security and packaged browser assets |

An isolated checkout compile, extracted Hex/npm consumer, real host/backend,
published registry and deployment are distinct proof. Preserve the
[CI](../../../.github/workflows/ci.yml) floor/current/PR/full lanes: PR excludes
some expensive checks and cannot stand in for the complete release gate.
Application code still requires the full gate in AGENTS.

Guidance-only edits parse YAML, check names/implicit selection, actual references
and tracking/ignore/discovery, then review routing/semantic ownership. Do not
install, compile or smoke packages solely for instructions. Inspect free disk
and output destinations before an authorized build/archive lane; clean only
its disposable outputs, preserving caches, candidate sources and retained proof.

Bind results to source/deps, optional mode, runtime/peers, producer candidate,
fixture, artifact and command. Reuse unchanged scoped evidence; rerun changed
inputs. Inspect failed/skipped components and state unavailable proof directly.
A word-scan pass, green PR or planned command does not establish library genericity,
optional-consumer compatibility or release readiness.
