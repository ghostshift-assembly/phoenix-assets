# Development instrumentation and source correspondence

Status: **planned**. Owner: the existing Phoenix Assets Elixir and npm packages.
The host application owns identity, authorization, deployment policy, source-edit
admission and business outcomes. This specification adds no application authority,
agent engine, product layout or separate package.

## Existing foundation and scope

The asset graph, Vite plugin, Svelte preset, generated `$phoenix/*` contracts,
dev-process supervision and generated-file HMR are reusable. The graph describes
assets/routes, not exact rendered-element correspondence. The current Tidewave
tools configuration is not a bounded runtime observation gateway. Existing
[import isolation](PHA.02-runtime-import-isolation.md) does not prove production
exclusion of instrumentation that has not been implemented.

The first candidate profile is Phoenix with the existing SvelteKit/Vite stack.
Qualification must pin Elixir/OTP, Phoenix, Svelte/SvelteKit, compiler, Vite, Node,
package manager, package versions, operating system and browser. Other frameworks
and versions are unsupported until a named adapter passes the same obligations.
No particular host, sync backend, design provider or agent installation is required.

## Inputs and authority

**DEV-1 — Explicit development activation.** The host supplies development mode,
workspace identity and revision, build identity, runtime boot identity, source-root
allowlist and a callback that validates current observation authority. Missing or
untrusted inputs disable inspection. Build flags, DOM attributes, query strings,
`postMessage`, a public site ID and the generated graph cannot grant access.
Production/staging processes refuse the development endpoint even if an environment
flag is misconfigured. A disposable preview must be explicitly classified by its
host as an eligible development target; a public deployment label is insufficient.

The library emits generic correspondence values and forwards bounded host-approved
observations. It cannot edit files, run arbitrary evaluation, restart the host,
read credentials or authorize browser actions. The host authenticates each request
and binds origin, target, operation, expiry and budgets before resolving any map.
Local transport requires an exact loopback authority, port and Host/Origin policy,
short-lived scoped credentials and anti-rebinding/CSRF checks. Pages cannot obtain
credentials for the runtime gateway. Hosts without this boundary cannot enable it.

## Correspondence lifecycle

**DEV-2 — Reproducible build mapping.** A development transform emits static template/source identifiers; a development
runtime binds each rendered element and component instance to a distinct opaque
handle. Their private manifest binds workspace/root,
worktree, revision and dirty-content digest, build, compiler/config/lock digests,
module and source-range identity. Values must distinguish repeated component
instances, slots and generated markup. Source paths are root-relative; traversal,
symlink escape and accidental disclosure of absolute local paths are rejected.
A source range is a location hint, not permission to write that file.

The host combines this manifest with the browser's current document/frame and
runtime boot. The manifest does not assert that a browser is attached to that
build. Unmapped, external, ambiguous, virtualized or dynamically generated nodes
return an explicit unavailable/ambiguous result. Never guess a file from text,
CSS selector similarity or a matching pathname.

**DEV-3 — Invalidation.** Vite module changes, HMR completion/failure, full reload,
compiler/config/dependency changes and process restart invalidate affected maps.
SPA navigation, hydration, component unmount/remount, keyed reorder/recycling
and document/frame replacement also invalidate affected runtime handles, even
when the URL and build are unchanged. Canvas, closed-shadow, foreign-frame and
other uninstrumented nodes return unavailable when exact mapping is absent.
The previous identity remains identifiable for evidence but cannot authorize a
current edit. A manifest cannot become current until the host observes the matching
build and rendered instance. Concurrent builds and out-of-order HMR messages cannot
promote an old map. If exact invalidation cannot be established, invalidate the
whole target. Regeneration must remain deterministic and the unchanged-input path
must not emit spurious reloads.

The library reports bounded source/route/log correlation only when the host can
prove propagation. It preserves missing links and observed timestamps; it does not
invent request, trace or business-event identity. Logs require host minimization
before collection and output, bounded size/time/cursor, and current authorization.
Revocation terminates streams and denies later reads, including retained buffers.

## Independent development and production outputs

**DEV-4 — Build separation.** Inspection transforms, private correspondence
manifests, overlays, dev endpoint clients and pairing material are development
outputs. Production must omit them from executable chunks, preloads, workers,
service workers, copied static directories and published application archives.
Source maps, including hidden maps, must not enter public assets. An explicitly
admitted private error-reporting map artifact has separate host custody/access
controls. The existing non-public canonical asset graph remains available for
production runtime lookup; it must not contain development source correspondence. The production doctor and
release smoke must inspect actual output bytes and the served route inventory;
tree-shaking assertions and environment branches alone are insufficient.

A separately selected production measurement producer may be included by the host.
It imports no development runtime or optional inspector peers and receives only
its closed event schema and host ingestion configuration. The library supplies
build integration, not an analytics collector, privacy policy or durable receipt.
Development tools remain absent when production measurement is enabled. Neither
output requires the other. The runtime import rules in PHA.02 remain in force.

## Failure, installation and removal

**DEV-5 — Closed failure.** Unsupported compiler profile, absent manifest, invalid
scope, stale mapping, expired grant and failed host authority yield explicit
unavailable/refused results. A timeout is not proof of application failure or of a
successful source edit. Disablement closes subscriptions, invalidates mapping
handles and removes injected development UI without altering application content.
Existing source files, user Git changes and retained host evidence are preserved.

Installation uses the existing Hex/npm packages and declared optional integrations.
[The release contract](../../RELEASING.md) owns artifact identity, registry trust,
coordinated versions and interrupted publication. Qualification records the exact
consumer cohort; an installed library or Git checkout does not establish published
availability. Update compatibility covers manifest schema and host callbacks;
unsupported combinations disable inspection with an actionable prerequisite.
Previous evidence stays readable under its original schema. No automatic downgrade
may restore revoked authority. Revocation/removal of instrumentation is independent
of removal of a production measurement producer.

## Executable acceptance

Each test retains exact build/toolchain/package and fixture identities and inspects
returned values, effects, artifacts and host access logs. These are future gates.

| ID | Fixture and required assertion |
|---|---|
| DEV-A1 | Build a real SvelteKit fixture with shared, repeated, slotted and generated components; exact resolvable instances map to their compiled source and ambiguous instances refuse. Traversal/symlink/foreign-worktree claims disclose no source. |
| DEV-A2 | Race two builds, hydration, SPA navigation, keyed reorder, conditional remount, HMR, failed compilation and restart; old document/boot/build mappings remain stale and zero edits occur through this library. Unchanged generation causes zero extra HMR. |
| DEV-A3 | Forge page messages, Origin/Host, target, expired/revoked grants and a production-mode flag; no private manifest/log/runtime data is returned. Revoke while streaming and inspect buffers/logs for disclosure. |
| DEV-A4 | Produce production artifacts with measurement off and on. Extract archives and inspect all chunks, maps, workers, static assets and served routes for forbidden development code, source paths and credentials. Both builds import/run without inspection dependencies. |
| DEV-A5 | Extract the shipped packages in a fresh host, enable/disable/update/remove the integration, reject an incompatible manifest, and preserve user source plus independent measurement. Test the documented prerequisite failure without optional peers. |
| DEV-A6 | Join an authorized host observation to a real build and request; absent correlation stays absent. Exercise byte/time limits, denied reads, restart and revocation without unbounded buffers or raw log leaks. |

## Delivery status

- [x] Assign the generic instrumentation owner and host authority boundary.
- [ ] Implement development transforms, manifests, host callbacks and invalidation.
- [ ] Implement production artifact exclusion and extracted-consumer gates.
- [ ] Qualify exact framework/platform cohorts and real host adoption.
- [ ] Publish qualified artifacts through the existing release process.

Specification review establishes none of the unchecked states.
