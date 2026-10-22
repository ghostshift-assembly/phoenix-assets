# Development build facts and instrumentation isolation

Status: **planned; reusable-extension admission required**. Owner: the existing
Phoenix Assets build integrations. This contract covers optional compiler/build
facts, build invalidation notifications and artifact isolation. It does not add
an inspector application, runtime gateway, browser client or package.

## Existing foundation and scope

The asset graph, Vite plugin, Svelte preset, generated `$phoenix/*` contracts,
dev-process supervision and generated-file HMR already support the asset toolchain.
The graph describes assets/routes; it does not identify a rendered component
instance or establish a source-edit precondition. Asset-process status/log/restart
helpers remain about the asset processes managed here. They are not an application
runtime observation service.

**DEV-1 — Admission and reuse.** A host first uses its selected compiler's source
maps/location metadata and Vite lifecycle hooks. A new shared build-fact extension
requires a fixture showing the missing build fact, why host configuration or existing
upstream tooling cannot supply it, and a second independent consumer of the same
build-only seam. Two wrappers over the same inspection implementation do not
establish that need. Without this evidence, keep the experiment in the existing host or
adapter. A custom transform is conditional, not an implementation prerequisite.

The candidate profile is the existing Phoenix/SvelteKit/Vite stack. A qualification
row pins Elixir/OTP, Phoenix, Svelte/SvelteKit/compiler, Vite, Node, package manager,
package versions and operating system. Browser compatibility belongs to the
consumer using these facts. Other compiler/framework profiles are unavailable
until their fixtures pass. No host agent, sync backend or design provider is a
library prerequisite.

## Inputs, outputs and authority

**DEV-2 — Build evidence only.** An admitted extension receives explicit compiler
inputs, a canonical allowed source root and build configuration. It produces
bounded, versioned private build facts: input-content digests, compiler/config/
lock digests, build generation, module identity and supported source ranges or
static template identifiers. Paths are root-relative. Reject traversal, symlink
escape, absolute-path leakage and source outside the selected root. Emit no source
contents or credentials. Unsupported/generated/ambiguous locations are explicit;
never guess a file from text, CSS or a pathname match.

The source owner separately establishes Git/worktree identity and the admitted
dirty baseline. The runtime/browser owners establish boot, document/frame and
component-instance identity. Those values are not inferred or certified by the
asset library. Static locations are hints, not writable-target or access grants.
No tenant, principal, pairing token, authorization callback, operation journal,
log stream or application-state registry belongs in this build interface.

The host installs the optional integration through trusted build configuration.
Page messages, DOM attributes and environment/query flags cannot turn on a private
fact service. This contract introduces no network route or listener. Private facts
are consumed through the selected build/host integration; the host owns any later
authenticated disclosure. Public development asset serving must not accidentally
expose the private correspondence artifact.

## Build lifecycle and failure

**DEV-3 — Generation lifecycle.** Produce deterministic bytes for identical inputs.
Do not write or trigger HMR on unchanged generation. Publish a complete generation
atomically; failed compilation never makes partial facts current. Module changes,
HMR completion/failure, full reload, compiler/config/lock changes and build-process
restart invalidate the affected build facts. Notify consumers with the exact
producer generation; delayed/out-of-order completion cannot replace a newer one.
If a partial invalidation cannot be established, invalidate the complete generation.
A disconnected consumer must reload the current generation before using facts.

Missing/incompatible facts and failed compilation return unavailable information;
they do not imply application failure. The host decides whether a runtime instance
has adopted the build. Hydration, navigation, keyed recycling, unmount/remount,
browser replacement and backend restart are consumer lifecycle obligations, not
a second asset-library state machine.

**DEV-4 — Output isolation.** Keep private development facts and optional development
transforms out of production executable chunks, preloads, workers, service workers,
copied static directories and production application archives. Published Hex/npm
build-tool packages may contain the transform implementation; they must not ship
a host's private generated correspondence. Inspect output bytes, not only
environment branches or tree-shaking configuration. Retain the existing non-public
canonical asset graph for production asset lookup without private correspondence.
Ordinary compiler source-map publication remains the host's explicit build policy;
private instrumentation artifacts cannot be made public through that setting.
Private error-reporting maps retain their host custody/access rules.

The library builds ordinary host-selected production inputs. It does not define a
measurement SDK, event schema, ingestion configuration, collector or consent policy.
An independent production feature must build and run with this development
integration absent. A consumer with a measurement profile tests both selections;
measurement is not a dependency of these generic library fixtures. The existing
[import-isolation contract](PHA.02-runtime-import-isolation.md) still applies.

**DEV-5 — Compatibility and removal.** Pin the build-fact schema and supported
producer/consumer cohort. Unsupported versions disable the optional fact output
with an actionable prerequisite; they must not guess compatibility or silently
fall back to old facts. Disabling/removing the integration closes its build
subscriptions and stops producing its private artifacts, while preserving host
source, user Git changes, ordinary asset serving and unrelated production inputs.
Host evidence retention and runtime/client teardown remain their owners' duties.

Use the existing Hex/npm release channels under the
[release contract](../../RELEASING.md). Local source and specification changes do
not establish registry availability. No dependency bump, publication or broad
fleet migration is authorized by this specification.

## Consumer responsibilities and dependencies

Consumers combine these build facts with their own authoritative records. They
are not runtime dependencies of Phoenix Assets:

| Responsibility | Consumer role and boundary |
|---|---|
| Browser/context/tab/document/frame and rendered selection | Browser provider/client retains exact observation identity and selection teardown; build output cannot identify the selected live target |
| Component-instance metadata and loaded build | Application framework adapter proves which generation and instance are running; static source locations cannot substitute for that proof |
| Source/worktree/dirty baseline and concurrent edits | Source-workspace owner admits writable correspondence and enforces revision preconditions independently of build facts |
| Runtime gateway, application logs, budgets, expiry and revocation | Host/runtime provider owns authenticated observation and data custody; no endpoint or remote admission enters this library |
| Inspector UI and scoped local transport | Client/application host owns injection, authority, pairing, teardown and protection from page-forged requests |
| Production measurement and business outcomes | Independently selected producer and durable host own event/schema/receipt semantics; the asset build consumes ordinary production inputs |

Each consumer owns its accepted state and failure/recovery semantics. A complete
library generation does not close any consumer's authority or runtime acceptance
gate. Phoenix Assets remains usable without those consumers.

## Executable acceptance

All rows are future qualification gates. Record actual inputs, output artifacts,
versions and failures; source inspection is not an executed pass.

| ID | Fixture and required assertion |
|---|---|
| DEV-A1 | Compare native compiler/Vite output with the unmet requirement. Demonstrate the same missing build fact in two independent consumers before adding a shared transform; otherwise use existing tooling/host code. Build shared/repeated/slotted/generated templates and distinguish static locations from runtime instances. |
| DEV-A2 | Race two builds, HMR completion/failure, changed compiler/config/lock inputs and process restart; publish no partial/stale generation. A disconnected consumer reloads. Unchanged input produces identical bytes and zero extra HMR. |
| DEV-A3 | Feed traversal, symlink, foreign-root, oversized and malformed metadata; disclose no outside source, absolute paths or credentials. Inspect the integration for zero new runtime/auth routes or page-activated private output. |
| DEV-A4 | Extract production outputs and inspect all chunks, maps, preloads, workers, static directories and archives for private development artifacts in the application runtime. Separately verify build-tool packages contain no host-generated private facts. Exercise a host-selected ordinary production feature with this integration off/on and the existing public/private source-map policies. The private artifact stays excluded in every case. |
| DEV-A5 | Extract the exact packages in a fresh host; enable/disable/update/remove only the optional build integration, reject incompatible facts and test missing optional prerequisites. Preserve host source and ordinary asset output. |
| DEV-A6 | With two real consumers, prove complete generation delivery, bounded fact size/work and disposal of subscriptions. Record consumer-owned runtime/source/authority results separately; library success must not be reported as a joined inspection pass. |

## Delivery status

- [x] Bound the candidate to build facts and artifact isolation.
- [ ] Establish a reusable gap beyond native compiler/Vite facilities (DEV-A1).
- [ ] Implement only the admitted missing build seam and lifecycle fixtures.
- [ ] Qualify extracted packages, production isolation and real consumers.
- [ ] Publish qualified artifacts through the existing release process.

Existing graph/HMR functionality does not close these unchecked gates.
