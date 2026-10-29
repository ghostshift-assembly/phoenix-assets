# @phoenix-assets/svelte

The Svelte 5 runtime for [`phoenix_assets`](https://github.com/ghostshift-assembly/phoenix-assets).
Elixir generates the types and route strings. This package supplies the runtime
used by that output: shape and command clients, locale resolution, event
modifiers, and the portable report renderer.

## Install

```bash
pnpm add -D @phoenix-assets/svelte
```

Peer: `svelte` (`^5.57.2`). `@electric-sql/client` (`^1.5.27`) is optional and
required only for Electric entrypoints. The
`@tanstack/electric-db-collection` (`^0.6.3`) and `@tanstack/svelte-db` (`^0.5.12`)
peers are optional and only needed for the `/collection` subpath. Collection
tests exercise these clients with a controlled transport. Hosts qualify their
PostgreSQL, Electric and Phoenix.Sync deployment separately.

## Exports

### `@phoenix-assets/svelte/core`

This entrypoint and optional Electric peer metadata were introduced in 2.0.0.

HTTP commands, their shared auth configuration, locale resolution, event
modifiers and topic matching without Electric or TanStack imports:

```ts
import { runCommand, resolveLocale } from "@phoenix-assets/svelte/core"
```

Generated command clients use this subpath. The existing root barrel retains
its Electric exports and needs the Electric peer when imported. `/socket`
requires the optional Phoenix peer; it does not require Electric.

Generated commands accept a per-call `transport` for hosts with an existing
request boundary. It returns `{ ok, status, payload }`; the host retains its
response wrapper, runtime codecs, credentials, tenant headers, cancellation and
idempotency identity. The runtime narrows declared error codes. `unknown_error`
does not prove that an effect failed; reconcile before consequential retry.

`@phoenix-assets/svelte/socket` also exports `createSocket(config)`. It creates
an independent, unconnected Phoenix socket. The caller owns connection, teardown
and credential lifetime. Use it for distinct tenant, portal or capability scopes;
the existing configured singleton remains available for hosts with one scope.

### `@phoenix-assets/svelte`

```ts
import { createShapeStore, runCommand, resolveLocale } from "@phoenix-assets/svelte"
```

- `createShapeStore`: a reactive store over an Electric shape stream.
- `configureShapeAuth` / `createShapeFetch` / `authHeaders` / `createShapeUrl`: point the shape
  clients at your app's token key. The generated `$phoenix/electric` client uses
  these, so configuring auth once covers every shape.
- `runCommand`: what the generated `$phoenix/commands` client calls. Resolves to
  `{ ok: true, data }` or `{ ok: false, error, status }`; it never rejects and
  never throws. A call site must handle failure before reading the payload.
  Both a network failure and an error code this build does not know degrade to
  `UNKNOWN_COMMAND_ERROR`.
- `matchEvent`: exhaustive matching over a generated PubSub event union.
- `resolveLocale`: picks a locale from the generated list.
- Event modifiers: `debounce`, `throttle`, `once`, `stopPropagation`,
  `preventDefault`, `self`. Svelte 5 dropped `on:click|preventDefault`; these are
  the composable replacement.

### `@phoenix-assets/svelte/collection`

`createShapeCollection` is a TanStack DB collection backed by an Electric shape.
Kept out of the main barrel so the optional `@tanstack/*` peers stay optional.

### `@phoenix-assets/svelte/reporting`

`decodeReportEnvelope` and `PortableReport` for the renderer-neutral
portable-report contract, plus `DataTable` and the accessible table twins every
visualization renders alongside its chart.

```svelte
<script lang="ts">
  import { decodeReportEnvelope, PortableReport } from "@phoenix-assets/svelte/reporting"

  let { payload } = $props()
  const envelope = decodeReportEnvelope(payload)
</script>

<PortableReport {envelope} />
```

The decoder rejects unknown and renderer-specific
configuration, validates every field reference, and holds string and object
callers to the same JSON-only byte and nesting limits. Reporting hosts must
explicitly install the optional peer `layerchart@2.9.1`. HTTP-only hosts need
neither LayerChart nor its chart dependencies. Pass the contract across the wire,
not renderer options, and supply semantic CSS tokens and domain chrome around
the shared components.

This is a breaking installation change from 1.x to 2.x. Before
upgrading a reporting host, add `layerchart@2.9.1` to its dependencies and rebuild
against the exact candidate tarball. Missing peers fail module resolution;
incompatible peers fail a strict peer install. Restore the prior package and
lockfile together to roll back. Keep host data and unrelated dependencies.

The reporting entrypoints accept data at different trust boundaries:

| | |
|---|---|
| `decodeReportEnvelope` / `safeDecodeReportEnvelope` | Wire boundary for untrusted input. Every field is validated and unknown keys are rejected. Use it for server data. |
| `PortablePanel` | Renders a trusted `PanelDefinition` value without runtime validation. |

`safeDecodeReportEnvelope` returns `{ state: "ready", envelope }` or
`{ state: "invalid", code, path }` instead of throwing, which is what you want
behind an error card. A non-contract failure still throws.

Use `composePanel` for a chart assembled locally from an existing frame. It adds
the governed defaults, including an accessible table derived from the
encodings. Its output is intentionally not wire-valid. A panel that crosses a
process or network boundary must be issued by the owning domain.

Overriding `messages` is a `Partial`, so a key added in a later release falls
back to English rather than breaking your build. Assert against
`REPORTING_MESSAGE_KEYS` in your own test if you would rather find out at build
time.

Generated Electric factories, shape stores, and collections use `shapeParser` to
match Ash integer fields to JavaScript numbers. PostgreSQL `int8` values outside
`Number.MIN_SAFE_INTEGER` through `Number.MAX_SAFE_INTEGER` fail decoding; they
are never rounded. Decimal columns remain strings, and Electric handles arrays
and nulls. A host that needs full 64-bit integer values should define a matching
`bigint` row contract and use the Electric client with its default parser.
