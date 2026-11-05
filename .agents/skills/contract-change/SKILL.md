---
name: contract-change
description: "Implement or review declaration DSLs, plugins/presets, generated contracts, Vite virtual modules or Svelte runtime helpers, including scoped security reviews of field exposure, credentials, shape configuration and rendering. Exclude host product UI/policy and prose-only changes."
user-invocable: false
---

# Change a generated or runtime contract

Trace the affected declaration from `Config`/`Context` through plugin resolution
and [Engine](../../../lib/phoenix_assets/engine.ex). Initialization occurs once
per operation in resolved order. Follow the owning plugin into
[Generated](../../../lib/phoenix_assets/generated.ex), its `GeneratedFile`,
actual TypeScript and the consuming
[Vite virtual module](../../../npm/vite/src/virtual-modules.ts) or runtime helper.
A generated stub/typecheck is not proof that the intended source was generated.

For each changed invariant, name the public trigger, source owner, emitted bytes,
consumer and expected acceptance/refusal. Do not repair a generator by editing
its output. Identical inputs must retain stable ordering/bytes, no-op writes and
`--check` drift behavior. Verify changed output independently rather than using
the same serializer to construct the expected string.

Select the affected boundary:

- Types/routes/shapes/topics/commands/session: preserve actual wire shape,
  parameters and exclusion of private/sensitive fields. Typed values do not
  grant host authorization.
- Optional integrations: guard both compile-time module definition and runtime
  entrypoint as reached. HTTP-only consumers must not acquire Electric/TanStack
  or optional Ash/DocShell requirements merely to import a core helper.
- Dev lifecycle: follow `DevSupervisor`/`DevProcess` ownership, restart, child
  exit, deadline/cancellation and process cleanup; supervision cannot stand in
  for resource/lifetime assertions.
- DocShell/reporting: upstream contracts own semantics; this repository owns
  projection/rendering. Host identity/theme and product task/layout policy stay
  in the host.

Use [kitchen-sink integration](../../../test/phoenix_assets/integration/kitchen_sink_test.exs),
[virtual-module tests](../../../npm/vite/test/virtual-modules.test.ts) and affected
[collection runtime tests](../../../npm/svelte/test/shape-collection.test.ts)
where reached. Retain valid plus malformed/stale/missing-module or cleanup cases
for the actual mechanism. A behavioral regression fails at its assertion, not
at dependency startup. Review against plausible private-field leakage, stale
output, duplicate initialization or peer-coupling mutants.

Return the owning change and actual source/runtime/package proof selected by
[package-proof](../package-proof/SKILL.md). A generic name or passing boundary
word scan does not establish a host-specific API belongs in this substrate.


## Scoped security assessment

For a security audit, map source declarations to emitted fields, browser token/
shape configuration and the consuming virtual module or renderer. Generated
metadata cannot establish host authorization. Record revision/working-tree scope,
checked producer/consumer paths and untested host/backend behavior.

Establish each claim against the strongest current control and owning contract.
Confirmed findings need a complete reachable boundary trace and evidence for
the stated consequence. Keep decisive unobserved facts as `needs_validation`,
with the exact missing check and no severity; reject disproved claims.
Distinguish source inspection, inspected tests, executed local tests and live
evidence. Group duplicate root causes and recheck previous findings against
current source and conditions.

Use the existing validation owner for authorized dummy-data regressions.
Executing untrusted code or hostile native/availability checks requires verified
OS isolation, no external networking, a sanitized environment and resource/time
limits. If unavailable, leave that execution unverified and continue source
review. A review grants no live/provider operations or agent-permission changes.
Independent verification is conditional on authorized, available delegation;
otherwise state the single-reviewer limit. Return findings in chat unless the
requested deliverable and repository contract permit a report.

Audit-method background: [Cloudflare's source-first workflow](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit).
