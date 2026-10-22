# Runtime imports and consumer qualification

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

The HTTP profile/import implementation is an additive unreleased source change.
The additional installation, declaration, profile and producer-qualification gates
below are planned. Historical checks below do not close them. Publication and
host adoption require the exact-artifact evidence in [RELEASING](../../RELEASING.md);
a source manifest with the same version as a registry package proves neither.

## Ownership, inputs and authority

This specification owns the asset library's entrypoint, optional-integration and
consumer qualification boundary. Inputs are host declaration modules, selected
preset/configuration, package/lock/toolchain identities and any upstream renderer
contract. [Usage rules](../../usage-rules.md) own host configuration and declaration
obligations; [RELEASING](../../RELEASING.md) owns artifact qualification, publication
and recovery. PHA.01 owns DocShell rendering and PHA.03 owns conditional development
build facts. The library does not acquire host policy, application state, endpoint
payload authority, durable business effects or collector responsibilities.

## Declaration and endpoint evidence

Generation projects declarations; doctor checks configured route/method wiring.
Removing a field or error from a declaration and regenerating may expose stale
callers at compile time. A controller can still change independently while both
generation and doctor pass. Neither check validates real success/error/session
JSON or proves the current caller's authority. Commands are declared bounded HTTP
operations, including read queries; the name and HTTP verb do not imply mutation.
The host selects transport according to the source operation's state semantics.

Use the existing declaration identity, route/method, path/body fields, response
wrapper, stable codes and session fields as the contract input. Hosts verify real
endpoint responses against those declarations and their existing domain codecs,
including required, optional and nullable fields. The library must not invent a
second query engine or universal DTO/policy schema. Unsupported declaration shapes
need an explicit host-owned check; a type assertion cannot fill that evidence gap.

Transport loss or an unknown code retains the existing `unknown_error` result.
That result is not proof an effect failed. Hosts retain the original business
operation identity and reconcile unknown outcomes before any permitted retry.
Missing/malformed responses cannot become trusted domain data or fresh session
context merely through a generated TypeScript cast. Reacquire current scope for
read retries; use host authorization and existing cancellation/retirement rules.

- **GEN-1:** hold declarations fixed and change a real endpoint success wrapper,
  required field/type or stable error/status branch. Host contract qualification
  fails although generation/doctor can remain green. Library tests separately
  prove declaration drift and route/method mismatch detection.
- **GEN-2:** exercise missing authentication, revoked/foreign scope, malformed
  response, absent/null session fields and response arrival after caller change.
  Host tests refuse or retire invalid data under the owning endpoint contract.
- **GEN-3:** run a bounded POST read through an extracted generated client without
  sync. Assert no business effect. Lose a mutating response after the host commits
  the operation; the host reconciles that original identity without blind replay.

These endpoint checks are host obligations. Library fixtures qualify generic
transport only; they cannot certify each application's controllers.

## Installation and entrypoint profiles

Installed graph, runtime imports, activated processes/routes and emitted browser
bytes are distinct measurements. Current `@phoenix-assets/svelte` source retains
LayerChart 2.8.0 as a regular dependency. `/core` avoids reporting imports but does
not avoid that installation. `/reporting` re-exports components: its runtime decoder
import is not a chart-free entrypoint. No new package or decoder subpath is required.

The planned repair is an optional LayerChart peer within the existing package,
with the same version as a development dependency for its own tests. Start
qualification at the existing exact 2.8.0; widen only with compatibility evidence.
First record the baseline installation graph/size and emitted bundle separately.
A reporting host explicitly installs the qualified peer; a core-only host must
not resolve it through this package. Do not substitute `optionalDependencies`,
which still attempts installation. Preserve export paths and behavior. This changes
existing reporting consumers' installation obligations and requires a breaking
release/migration under RELEASING, not a silent republish or an automatic host bump.
Until that release is qualified, published cohorts retain their actual dependencies.

A missing or incompatible selected peer must fail the consumer install/build check
with its package and supported version requirement. Do not claim a runtime table
fallback when the reporting module itself cannot load. Capability fallback applies
to valid data only after the selected renderer loads. Removal first removes host
imports, generated uses and selected activation; uninstall only exclusively owned
prerequisites and preserve host data, unrelated peers and lockfile changes.

| Selected profile | Required behavior and prerequisite |
|---|---|
| Asset-only | Host-selected asset generation/serving; no app renderer, sync or runtime-inspection service requirement |
| HTTP | Qualified `SvelteHttp` plus `/core`; host HTTP endpoint and selected framework peers; no Electric/TanStack/Phoenix socket peer requirement |
| Channels | `/socket` adds its qualified Phoenix peer and host-owned channel endpoint; it does not select Electric |
| Sync | Root/Electric/collection entrypoints require their selected peers and separately qualified host backend; no implicit backend installation |
| Reporting | `/reporting` requires its qualified Svelte/LayerChart closure and upstream contract proof; no query or collector service |
| DocShell | Separate DocShell package/profile under PHA.01; no dependency from `/core` to this renderer |

- **ISO-1:** compare fresh installation graphs and byte counts before/after the
  proposed peer change with the declared npm/pnpm versions. Extract the candidate
  package; omit unselected optional peers and prove LayerChart, Electric, TanStack
  and Phoenix are absent from the HTTP consumer graph. Typecheck/import `/core`,
  then run success, denied and transport-loss cases. Check emitted chunks separately.
- **ISO-2:** install the exact reporting peer in a separate extracted consumer;
  compile/render all advertised kinds and accessible table twins. Omit or conflict
  the peer and require an actionable build refusal, including a runtime decoder
  import through `/reporting`. Prove existing root/socket/collection/DocShell
  selected profiles still work with their own prerequisites.
- **ISO-3:** migrate a prior reporting consumer explicitly and then restore its
  still-supported prior package/lock closure. No source import rewrite, private
  host state deletion, silent transitive substitution or in-place artifact change.

## Selected integrations and extension admission

Preserve the full Svelte default and current Storybook opt-out semantics. Each host
records its selected preset/configuration, generated modules, imports, prerequisites
and supervised/on-demand processes. Default Electric selection without a shape
module emits no shape contract and does not require a backend. Disabled supervision
does not mean installed build tools disappear. An upstream package/preset addition
must not silently activate inspection, a runtime gateway or production collection.

**PROF-1:** exercise the selected profiles above; assert actual generated outputs,
imports and running dev children/routes. Disabling Storybook removes its supervised
child while retaining on-demand use. Missing optional declarations produce no
output; missing prerequisites for a selected integration fail explicitly. Production
runs no dev daemon. Update/restart/removal must not reactivate an opted-out feature.

**PLACE-1:** before adding a shared API, identify an intrinsic asset/framework gap
or a gap in one of the existing upstream-contract renderers. Record differing real
consumers, the upstream semantic owner, authority/effect boundary, inputs, lifecycle,
failure/removal, installation/activation footprint and qualification/release cost.
Try the existing upstream or host seam first. Shared use or a clean vocabulary scan
alone does not justify promotion. Product workflows, query/approval state, source
mutation authority and measurement remain at their owners; no general feature
platform or host policy registry is added here.

## Reporting producer qualification

The existing reporting adapter follows its upstream public contract. Its planned
qualification must consume identified producer fixtures and a generated
closed-grammar/limits profile, with
exact public revision and per-file digests, rather than qualifying against a second
local transcription of enum constants. The producer generates or verifies those
inputs through its actual public validator/binder/encoder. Extend the existing
producer corpus instead of introducing another report wire contract. Keep immutable
public snapshots available to offline adapter tests; no private sibling checkout or
producer runtime import is required. RELEASING binds them to extracted renderer bytes.

**RPT-1:** exercise actual producer envelopes/cases through the extracted decoder,
compiler and components: all advertised kinds, mixed success/empty/partial/error,
boolean/null/decimal values, exact/one-over limits, forbidden members, unsupported
major, keyboard/table alternatives, multiple instances and no renderer fetches.
The upstream producer may negotiate a valid unsupported kind to a value-preserving
table before rendering under its contract; this adds no negotiation authority to
the Svelte adapter. Invalid grammar, unsupported major or missing integrity never becomes
empty, zero or a table success.

**RPT-2:** advance only the selected producer vocabulary, limits or fixture bytes.
Qualification must detect the stale recorded producer/renderer join even if local
copied constants still pass. Tampered/missing inputs or wrong renderer bytes block
that support claim. A previously qualified older cohort remains distinct. Compatible
producer changes can qualify unchanged renderer bytes; a version string alone is
insufficient. Known producer gaps remain declared gaps, not implied passes.

## Planned implementation and acceptance

- [ ] GEN-1–3: correct generator/module promise wording and generic transport
  fixtures; each host supplies its actual endpoint/declaration qualification.
- [ ] ISO-1–3: measure, implement and qualify the optional reporting peer and
  explicit breaking installation migration in the existing package.
- [ ] PROF-1/PLACE-1: profile evidence and extension admission at existing owners.
- [ ] RPT-1–2 and RELEASING REL-1–4: immutable producer-to-renderer qualification
  and exact consumer/release evidence. Publication and operation remain separate.


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

That qualification used a temporary user-authorized exception for test-only
Bandit 1.12.5 and `EEF-CVE-2026-105659`. The dependency update below removes it.

The same 414 backend checks and warnings-as-errors compilation also pass on
Elixir 1.18.4 / OTP 27.3.4.15 using the locked registry dependencies and the
qualified Phoenix.Sync revision.

An untagged local build of all five artifacts also passes the complete
`release.mjs smoke` consumer path, including installed npm package imports,
reporting/collection/DocShell bundling, the isolated HTTP runtime and both Hex
consumers. These archives represent the unreleased source tree; registry
publication and actual host adoption require separate evidence.

## Dependency update (2026-10-19)

The test-only HTTP fixture now requires Bandit `~> 1.13.1` and locks 1.13.1 with
Thousand Island 1.6.0. The
[upstream changelog](https://github.com/mtrudel/bandit/blob/1.13.1/CHANGELOG.md)
records fixes for `EEF-CVE-2026-105659` and `EEF-CVE-2026-105660` in 1.13.0;
1.13.1 reverts a stale-connection check that broke Phoenix error rendering.
The advisory exception is removed. Both dependency audits remain active.

`mix check --no-retry --no-parallel` passes on Elixir 1.20.4 / OTP 29.0.4,
Node 24.21.0 and pnpm 12.11.2: all 23 configured checks pass, including both
dependency audits, Dialyzer and the extracted Hex and HTTP consumers. The run
passes 414 backend checks with 89.9% line coverage, 290 frontend tests and 15
release-script tests. Optional absent-package checks remain skipped.
