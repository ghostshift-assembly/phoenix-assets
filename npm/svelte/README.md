# @phoenix-assets/svelte

The Svelte 5 runtime for [`phoenix_assets`](https://github.com/futhr/phoenix-assets).
Elixir generates the types and route strings. This package supplies the runtime
used by that output: shape and command clients, locale resolution, event
modifiers, and the portable report renderer.

## Install

```bash
pnpm add -D @phoenix-assets/svelte
```

Peers: `svelte` (`^5.7.0`) and `@electric-sql/client` (`^1.5.27`). The
`@tanstack/electric-db-collection` (`^0.5.5`) and `@tanstack/svelte-db` (`^0.5.4`)
peers are optional and only needed for the `/collection` subpath. This frontend
is qualified with the PostgreSQL 18.6 / Electric 1.8.1 stack; the host owns its
server deployment and Phoenix.Sync dependency.

## Exports

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
callers to the same JSON-only byte and nesting limits. `layerchart` is an
exact internal dependency of this subpath. Pass the contract across the wire,
not renderer options, and supply semantic CSS tokens and domain chrome around
the shared components.

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
