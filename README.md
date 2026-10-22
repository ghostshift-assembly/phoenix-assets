# Phoenix Assets

> A supervised SvelteKit toolchain and typed frontend contracts for Phoenix.

[![Hex.pm](https://img.shields.io/hexpm/v/phoenix_assets.svg)](https://hex.pm/packages/phoenix_assets)
[![Docs](https://img.shields.io/badge/docs-hexdocs-blue.svg)](https://hexdocs.pm/phoenix_assets)
[![CI](https://github.com/ghostshift-assembly/phoenix-assets/actions/workflows/ci.yml/badge.svg)](https://github.com/ghostshift-assembly/phoenix-assets/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/ghostshift-assembly/phoenix-assets.svg)](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/LICENSE)

Phoenix applications with a JavaScript frontend have two build systems and one
shared contract. Without a clear owner, route types get copied by hand,
Storybook drifts from Vite, and frontend process failures disappear outside the
BEAM.

`phoenix_assets` gives that boundary one owner. It supervises Vite and Storybook
under OTP, generates TypeScript from Phoenix and Ash metadata, and records the
result in an asset graph that can be checked before deployment. The default
`PhoenixAssets.Presets.Svelte` covers Vite, SvelteKit, Tailwind v4, Storybook,
ElectricSQL, PubSub, localization, commands, sessions, and Ash types.

The library has a narrow opinion: Phoenix owns application behavior and
authorization; the frontend consumes generated contracts. It does not move Ash
queries or policies into JavaScript, and it does not own the application's sync
backend.

## What it provides

- Routes, Ash resources, Electric shapes, commands, session data, PubSub topics,
  and gettext locales generate into `$phoenix/*` TypeScript modules.
  `mix phoenix_assets.gen --check` catches stale checked-in output.
- Shape contracts describe reads. Command contracts describe request bodies,
  success values, and endpoint error codes. The session contract carries the
  authenticated context expected by the frontend.
- Routes, pages, stories, shapes, commands, topics, and locales share one
  validated graph. Applications can read it from `graph.json` or an embedded
  module.
- Vite and Storybook run as OTP children. MuonTrap stops the OS process when the
  BEAM exits; Linux cgroups stop the process tree, while macOS stops the immediate
  child. Their status, logs, and restart behavior remain visible to the host.
- Generators produce identical bytes for identical inputs. If nothing changed,
  regeneration writes nothing and triggers no HMR.
- `mix phoenix_assets.doctor --production` checks the manifest, package manager,
  generated contracts, and integration requirements.
- Long-running work emits `:telemetry` spans below `[:phoenix_assets, ...]`,
  including `:generated`, `:manifest`, `:dev_server`, and `:doctor`.

## How it fits together

`PhoenixAssets.child_specs/0` always adds the manifest server. In development it
also adds a supervisor for Vite, Storybook, and the generated-file watcher.
Storybook reads the same Vite configuration as the application.

Tailwind v4 runs inside Vite through the official `@tailwindcss/vite` plugin.
The host owns `src/app.css` and its `@theme`; no JavaScript config is required. The
integration wires the plugin into the Vite config and contributes a doctor check
for the CSS entry. `@phoenix-assets/lint` flags arbitrary values such as
`w-[180px]` when the host design system provides a named equivalent such as
`w-45`. Its Svelte CLI accepts the standard module and instance script
composition. A host can opt into a single-script policy with glob exceptions.

The frontend imports generated contracts through `$phoenix/*` virtual modules.
When Elixir regenerates a contract, the Vite plugin invalidates the affected
modules and reloads them through HMR.

## Packages

One Elixir package ships the runtime, the (internal) plugin engine, and the
built-in Svelte stack. Four npm packages provide the Vite plugin, the Svelte
runtime helpers, the documentation shell, and shared frontend lint tooling.

| Package | Path | What it is |
|---------|------|------------|
| `phoenix_assets` | `lib/` | Runtime, contract generators, dev supervision, manifest, graph, doctor, and the built-in SvelteKit, Tailwind, Storybook, ElectricSQL, command, session, PubSub, localization, Ash type, and typespec integrations. |
| `@phoenix-assets/vite` | `npm/vite/` | Vite plugin, `$phoenix/*` virtual modules, dev/HMR bridge, graph emitter. |
| `@phoenix-assets/svelte` | `npm/svelte/` | Typed Electric / PubSub / localization helpers plus the closed portable-report decoder, accessible tables, and shared LayerChart 2 components. |
| `@phoenix-assets/doc-shell` | `npm/doc-shell/` | Renderer-neutral Svelte documentation UI for the `doc-shell/v1` artifact contract. |
| `@phoenix-assets/lint` | `npm/lint/` | Shared Biome base config, Svelte parser/policy linter, and Tailwind v4 arbitrary-value linter for host apps. |

## Requirements

- Elixir 1.18+ and Phoenix 1.8+.
- Development supervision uses MuonTrap and requires macOS, Linux, or WSL2.
  Linux cgroups stop the whole process tree; macOS stops the immediate child.
  Production
  manifest serving and contract generation are platform-independent.

## Usage

The Elixir package is published on Hex. Its four frontend packages are
published on npm and run in the author's Phoenix applications.

The full Svelte stack is the default, so no preset module is required.

### Install

```elixir
# mix.exs
{:phoenix_assets, "~> 1.1.0"}
```

```bash
cd assets && pnpm add -D --save-exact @phoenix-assets/vite@1.1.0 @phoenix-assets/svelte@1.1.0 @phoenix-assets/lint@1.1.0
```

### PostgreSQL 18 and Electric

The frontend is qualified with `@electric-sql/client` 1.5.28,
`@tanstack/electric-db-collection` 0.5.5 and `@tanstack/svelte-db` 0.5.4.
Install the TanStack peers when using the `/collection` entry point.

Your application owns the sync backend. For the qualified PostgreSQL 18.6 /
Electric 1.8.1 embedded stack, declare these host dependencies:

```elixir
{:phoenix_sync,
 github: "futhr/phoenix_sync",
 ref: "330f0602009b7b8aca7e3140b492b5408ee276ec"},
{:electric, "~> 1.8.1", override: true}
```

HTTP-only hosts can omit the Electric dependency and connect to the qualified
external server. The Phoenix Assets Hex package does not constrain either
backend dependency. Keep Phoenix.Sync's sandbox adapter in tests that use
embedded sync, and configure PostgreSQL logical replication for the server.

### Configure & supervise

```elixir
# config/config.exs
config :phoenix_assets,
  otp_app: :my_app,
  endpoint: MyAppWeb.Endpoint,
  router: MyAppWeb.Router

config :phoenix_assets, :stack,
  shapes: MyApp.Assets.ElectricShapes,
  commands: MyApp.Assets.Commands,
  session: MyApp.Assets.Session,
  topics: MyApp.Assets.PubSubTopics,
  types: MyApp.Assets.Types

# config/dev.exs: supervise Vite, Storybook, and the generated-file watcher
config :phoenix_assets, :dev, enabled: true
```

Add the runtime to your supervision tree. `child_specs/0` always returns the
manifest server and adds the dev supervisor in development:

```elixir
children = [...] ++ PhoenixAssets.child_specs()
```

`:otp_app` is the only required option; the full reference is `PhoenixAssets.Config`.
Sub-configs: `:dev`, `:build` (`vite_manifest`, `asset_graph`, `asset_url`,
`budgets`, `allow_source_maps`), `:env` (`expose:`), `:dev_intelligence`
(`tidewave:`), and `:stack`. `serve_mode` defaults to `:spa`, an adapter-static
SvelteKit build that serves its own `index.html`. Set `:ssr` to render HTML from
the Vite manifest through `PhoenixAssets.Components`.

The HTTP profile below is an unreleased source addition; published 1.2.1 does
not include its preset, runtime entrypoint or DocShell 0.4 compatibility.
HTTP/Channels-only applications can select the maintained non-Electric preset:

```elixir
config :phoenix_assets, preset: PhoenixAssets.Presets.SvelteHttp, serve_mode: :spa
```

Use `@phoenix-assets/svelte/core` for commands/locales/events and `/socket` for
Phoenix sockets. Electric and TanStack peers are optional; the legacy root
runtime barrel still imports Electric helpers. DocShell 0.4 remains compatible
with the asset substrate; its optional site renderer requires DocShell 0.5's
presentation modules. Neither profile changes host authorization.

Tuning an integration uses configuration:

```elixir
config :phoenix_assets, :dev, storybook: [enabled: false]   # run it via `mix storybook`
config :phoenix_assets, :stack, locales: ["sv", "en"], default_locale: "sv"
```

Point `svelte-check` at the generated contracts. It does not run through Vite,
so it needs the alias that the plugin resolves at build time:

```js
// assets/svelte.config.js
kit: { alias: { $phoenix: "src/lib/generated" } }
```

### Declare & generate contracts

Declare the metadata the frontend needs. Ash queries, policies, tenancy, and
other application behavior stay in the host:

```elixir
defmodule MyApp.Assets.ElectricShapes do
  use PhoenixAssets.Electric.Shapes
  shape :articles, route: "/shapes/articles", type: "Article"
end

defmodule MyApp.Assets.PubSubTopics do
  use PhoenixAssets.PubSub.Topics
  topic :room, pattern: "room:{id}", events: [message: "Message"]
end

defmodule MyApp.Assets.Types do
  use PhoenixAssets.Types.Schema
  type "Article", resource: MyApp.Blog.Article, only: :public
end
```

```bash
mix phoenix_assets.gen          # write assets/src/generated/*
mix phoenix_assets.gen --check  # CI drift gate; fails when the checked-in output is stale
```

Import the typed output through `$phoenix/*` virtual modules. Sensitive and
non-public Ash fields are excluded from generated types unless the host exposes
them explicitly. Page routes remain owned by SvelteKit:

```ts
import { routes } from "$phoenix/routes"
import type { Article } from "$phoenix/types"
import { shapes } from "$phoenix/electric"
```

Portable report consumers import only the shared reporting boundary. It accepts
the bounded renderer-neutral contract, rejects unknown or renderer-specific
configuration, validates kind-specific channels and every field reference, and
always preserves a semantic table representation. String and object callers are
held to the same finite, acyclic JSON-only byte and nesting limits:

```svelte
<script lang="ts">
  import { decodeReportEnvelope, PortableReport } from "@phoenix-assets/svelte/reporting"

  let { payload } = $props()
  const envelope = decodeReportEnvelope(payload)
</script>

<PortableReport {envelope} />
```

`layerchart` is an exact internal dependency of this subpath. Host applications
pass the portable report contract across storage or network boundaries, not
LayerChart options. Hosts supply semantic CSS tokens, localized chrome, and
domain evidence around the shared components.

### Render assets

```heex
<PhoenixAssets.Components.vite_assets entry="src/app.ts" nonce={@csp_nonce} />
<PhoenixAssets.Components.svelte_page name="Dashboard" props={%{user: @user}} />
```

In development these point at the Vite dev server. In production they emit the
hashed file with its stylesheet links, module preloads, and Subresource Integrity
from the manifest. `Components.speculation_rules/1` emits a Speculation
Rules prefetch block for the page routes in the asset graph. Set
`config :phoenix_assets, :build, asset_url:` for a CDN, or add
`plug PhoenixAssets.EarlyHints, entry: "src/app.ts"` for HTTP 103 Early Hints.

### Ship

Wire the drift gate and the production doctor into your deploy alias:

```elixir
# mix.exs
"assets.deploy": ["phoenix_assets.gen --check", "phoenix_assets.doctor --production", ...]
```

`doctor --production` validates the manifest, contract freshness, bundle budgets,
source-map leakage, and that every plugin initialises. Every long-running
operation emits `:telemetry` under `[:phoenix_assets, ...]`; see
`PhoenixAssets.Telemetry`.

### A different stack

Write a module with `use PhoenixAssets.Preset`, list your `integration/2` calls,
and set it as `:preset` (copy `PhoenixAssets.Presets.Svelte` as a starting point).
Add an integration the stack doesn't ship by writing a `use PhoenixAssets.Plugin`
module.

---

## Specifications

- [DocShell renderers](docs/specs/PHA.01-doc-shell-renderers.md)
- [Runtime import isolation](docs/specs/PHA.02-runtime-import-isolation.md)
- [Development instrumentation](docs/specs/PHA.03-development-instrumentation.md)
  specifies planned source correspondence and production exclusion; implementation,
  package publication and host qualification remain pending.

## Contributing

See [CONTRIBUTING.md](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/CONTRIBUTING.md)
for setup, conventions, and quality gates.
The coordinated Hex/npm release process is documented in [RELEASING.md](RELEASING.md).

## Fleet library lockstep

Changes to `phoenix_assets`, `ash_oaskit`, or `doc_shell` are validated across
all consuming fleet platforms. A version bump moves consumers together, and any
consumer `override:` pin is updated in the same change.

## License

Phoenix Assets is released under the MIT License. See [LICENSE](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/LICENSE) for details.
