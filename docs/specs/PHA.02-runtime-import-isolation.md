# Runtime import isolation

The asset substrate supports HTTP and Phoenix Channels without an Electric
client or sync backend. Existing Electric entrypoints remain compatible.

- `PhoenixAssets.Presets.SvelteHttp` selects SvelteKit, Tailwind, Storybook,
  commands, sessions, PubSub, localization and type generators without the
  Electric integration. The existing default preset remains the full stack.
- `@phoenix-assets/svelte/core` exports commands, their shared auth helpers,
  locale resolution, event modifiers and topic matching without importing the
  Electric SDK, TanStack, Phoenix sockets or reporting components. Generated
  commands use this entrypoint.
- The Electric peer is optional at installation, but required by the existing
  root barrel and Electric/collection functions. `/socket` independently needs
  the Phoenix peer; TanStack remains confined to `/collection`.
- No helper grants host actor/tenant authority or validates a domain DTO merely
  because a TypeScript declaration exists. Hosts own authentication, runtime
  payload admission, command outcomes and unknown-effect reconciliation.
- Package exports must retain types and executable files. A normal extracted
  npm consumer with optional peers omitted must import `/core` and run an HTTP
  command without Electric or TanStack being installed. Successful and denied
  responses, auth-header propagation and failure normalization remain covered.
- The full package and renderer consumers still exercise the existing optional
  integrations. A non-Electric profile cannot weaken their version floors or
  replace backend qualification.

This contract is an additive unreleased library change. Publication and actual
host adoption require their separate release/consumer evidence.

## Local implementation evidence (2026-10-15)

The complete `mix check --no-retry --no-parallel` passes on Elixir 1.20.4 /
OTP 29.0.4, Node 24.0.0 and pnpm 12.11.2: 414 backend checks (18 doctests,
396 tests), 89.9% backend line coverage, 290 frontend tests and 15 release-script
tests. Compilation, format, strict Credo, Dialyzer, Doctor, ExDoc, dependency
audits, Biome, typecheck, knip, exports, release, boundary and offline checks
pass. Doctor reports 100% docs, moduledocs and specs. Optional absent-package
checks for ex_knigge, knigge and usage_rules remain skipped.

The complete HTTP preset generates commands, session and topic files without
sync output; regeneration writes nothing and the drift check passes. The
extracted npm runtime imports and runs success, denial and transport-loss cases
with auth headers while Electric, TanStack and Phoenix peers are absent.
Extracted Hex consumers compile without optional dependencies and with DocShell
0.4 plus LiveView. Both initialize the HTTP preset and generate commands using
`/core`. The 0.4 consumer exposes the AST adapter while all five 0.5 presentation
adapters remain absent. Existing renderer tests exercise the 0.5 integration;
the broader renderer specification retains its partial implementation status.

The temporary user-authorized exception remains limited to test-only Bandit
1.12.5 and `EEF-CVE-2026-105659`. Hex still lists 1.12.5 as the latest stable
release, and the [upstream advisory](https://github.com/mtrudel/bandit/security/advisories/GHSA-69m6-wcv4-rwcf)
lists no patched release as of 2026-10-15. `mix hex.audit` remains active and
reports this ID under `Ignored advisories`; all other advisory and retirement
findings remain active. Remove the exception when a patched release clears the
finding. The exception does not fix Bandit or qualify its production use.

The same 414 backend checks and warnings-as-errors compilation also pass on
Elixir 1.18.4 / OTP 27.3.4.15 using the locked registry dependencies and the
qualified Phoenix.Sync revision.

An untagged local build of all five artifacts also passes the complete
`release.mjs smoke` consumer path, including installed npm package imports,
reporting/collection/DocShell bundling, the isolated HTTP runtime and both Hex
consumers. These archives represent the unreleased source tree; registry
publication and actual host adoption require separate evidence.
