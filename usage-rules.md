# phoenix_assets usage rules

`phoenix_assets` connects Phoenix to a SvelteKit frontend built with Vite,
Tailwind v4, Storybook, ElectricSQL, Phoenix PubSub, localization, and generated
Ash TypeScript types. It supervises the development processes, generates the
frontend contracts, records them in an asset graph, and validates the production
manifest.

## The golden path

- Select and record the integrations the host needs. The full default stack uses
  `PhoenixAssets.Presets.Svelte`. Configure the app and name your declaration
  modules:

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
  ```

- Add the children to the application supervision tree:

  ```elixir
  children = [...] ++ PhoenixAssets.child_specs()
  ```

  In production this starts only the manifest server; in dev (when
  `config :phoenix_assets, :dev, enabled: true`) it also supervises Vite,
  Storybook, and the generated-file watcher according to the selected config.
  Record supervised versus on-demand processes, generated modules, imports and
  required peers under PHA.02 PROF-1. A newer package does not authorize a new
  inspector, runtime endpoint or collector to start in the host.

- Configure the generated-contract alias with SvelteKit, matching
  `generated_dir`. SvelteKit 3 reads Vite plugin options, which recent 2.x
  versions also support:

  ```ts
  // assets/vite.config.ts
  sveltekit({ alias: { $phoenix: "src/lib/generated" } })
  ```

  Legacy 2.x hosts may retain `kit.alias` in `svelte.config.js`. Run both the
  production build and separate type check when migrating configuration.

## Tuning the stack without a preset

Use configuration to tune an existing integration. Write a preset only when the
set or order of integrations changes.

```elixir
# Storybook off the supervised dev tree (run it on demand from assets/)
config :phoenix_assets, :dev, storybook: [enabled: false]   # or: [port: 6007]

# Pin your market locales instead of scanning priv/gettext
config :phoenix_assets, :stack,
  locales: ["sv", "en", "no", "da"],
  default_locale: "sv",
  gettext_backend: MyAppWeb.Gettext
```

Run `pnpm exec storybook dev -p 6006` from `assets/` for on-demand Storybook.

## Declaration modules (the backend contract)

Each declaration module is a small DSL for metadata. Ash queries, policies,
tenancy, and other server behavior stay in the host application. Generated types
track these declarations; they do not inspect controllers. Follow the endpoint
qualification requirements in [PHA.02](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/docs/specs/PHA.02-runtime-import-isolation.md).
Removing a field from an actual response while retaining its declaration can leave
typechecking green. Hosts test real responses, stable errors and current scope.

```elixir
defmodule MyApp.Assets.ElectricShapes do
  use PhoenixAssets.Electric.Shapes
  shape :portfolios, route: "/shapes/portfolios", type: "PortfolioRow"
  # Route placeholders become required, typed keys on the generated factory;
  # `params:` is optional documentation, validated at compile time to match.
  shape :user_portfolios, route: "/shapes/users/:user_id/portfolios",
        type: "PortfolioRow", params: [:user_id]
end

defmodule MyApp.Assets.Commands do
  use PhoenixAssets.Commands.Definitions
  # Commands describe bounded HTTP operations, including queries. The host
  # chooses request/response or streaming semantics. Stable declared error
  # codes give the generated client a discriminated result.
  command :publish_portfolio,
    route: "/api/portfolios/:id/publish",
    method: :post,
    params: [id: :string],
    body: [note: :string],
    result: "PortfolioRow",
    errors: [:already_published, :portfolio_not_found]
end

defmodule MyApp.Assets.Session do
  use PhoenixAssets.Session.Fields
  # Who is asking, declared once, so neither side re-derives it by hand.
  route "/api/session"
  field :user_id, :string
  field :organization_id, :string
  field :role, :string, values: ["owner", "admin", "member"]
  field :platform_admin, :boolean
end

defmodule MyApp.Assets.PubSubTopics do
  use PhoenixAssets.PubSub.Topics
  topic :portfolio, pattern: "portfolio:{id}",
        events: [updated: "PortfolioRow", deleted: %{id: :string}]
end

defmodule MyApp.Assets.Types do
  use PhoenixAssets.Types.Schema
  type "PortfolioRow", resource: MyApp.Portfolio, only: :public
end
```

Types already declared as Elixir typespecs need no additional DSL. Point at the
module directly:

```elixir
config :phoenix_assets, :stack,
  typespecs: [
    [source: MyApp.Stream.Part, output: "stream-part.ts", root_name: "StreamPart"]
  ]
```

## Generated contracts

`mix phoenix_assets.gen` writes typed TypeScript into `assets/src/lib/generated/` by default:
`routes.ts` (endpoint helpers for `/shapes/*` and `/api/*`; page routes remain
owned by SvelteKit), `env.ts`, `electric.ts`, `commands.ts`,
`session.ts`, `pubsub.ts`, `locales.ts`, `types.ts`. The frontend imports them through `$phoenix/*` virtual
modules (`$phoenix/routes`, `$phoenix/electric`, …) provided by the Vite plugin.
The locale contract is `$phoenix/locales`; `$phoenix/localize` remains an alias
for older hosts.

Rules to rely on:

- Generation is deterministic and content-gated; byte-identical output is not
  rewritten. `mix phoenix_assets.gen --check` fails on drift. Add it to
  `assets.deploy` as a CI gate.
- A command result is a value. `runCommand` resolves to
  `{ ok: true, data }` or `{ ok: false, error, status }`; a network failure and
  an error code this build does not know both degrade to `"unknown_error"`
  rather than escaping as an untyped string or a rejected promise. The success
  type is a declaration, not runtime DTO validation. Hosts apply their existing
  domain codecs. A lost mutating response remains an unknown outcome; retain the
  original domain operation identity and reconcile before any permitted retry.
- Sensitive and non-public Ash fields are excluded by default from generated
  row types. `only: :all` includes private fields and `expose:` can explicitly
  include private or sensitive fields; review these overrides before publishing.
  A doctor check warns when an exposed field is also field-policy-gated.
- Run `mix phoenix_assets.doctor` (add `--production` in CI) to validate config,
  routes, manifest presence, and freshness.

## Sync backend ownership

The host selects Phoenix.Sync and Electric. Phoenix Assets has no production
Hex requirement on either package. For PostgreSQL 18.6, use the qualified
Phoenix.Sync revision documented in the README and Electric 1.8.1 (with the
host's explicit override when embedding). Preserve sandbox transaction isolation
in tests. Current source declares `@electric-sql/client` ^1.5.27,
`@tanstack/electric-db-collection` ^0.6.3 and `@tanstack/svelte-db` ^0.5.12.
Earlier 0.5.x collection qualification does not prove this source cohort or a
consumer upgrade; use the exact artifact/peer closure and evidence in RELEASING. TanStack remains optional outside the
`/collection` entry point. Artifact and schema contracts retain their versions.

## Frontend packages

- `@phoenix-assets/vite`: the Vite plugin (`phoenixAssets`), `$phoenix/*` virtual
  modules, HMR bridge, PO loader, graph emitter. Add it to `vite.config.js`.
- `@phoenix-assets/svelte`: typed runtime helpers including `createShapeStore`,
  `createShapeFetch`/`createShapeUrl` (used by the generated `$phoenix/electric`
  client), `runCommand` (used by the generated `$phoenix/commands` client), the
  event modifiers (`debounce`, `throttle`, `once`, `stopPropagation`,
  `preventDefault`, `self`), `matchEvent`, `resolveLocale`, and `configureShapeAuth` to point the
  shape clients at your app's token key. `createShapeCollection` (TanStack DB)
  lives behind the `@phoenix-assets/svelte/collection` subpath so the main
  barrel stays free of the optional `@tanstack/*` peers.
  HTTP/Channels-only hosts can select the 2.x
  `PhoenixAssets.Presets.SvelteHttp` and the
  `/core` runtime entrypoint for commands, locales and event helpers. Electric
  is an optional peer at installation and remains required by the legacy root
  barrel and Electric entrypoints. `/socket` needs only the Phoenix peer.
- `@phoenix-assets/svelte/reporting`: strict portable-report decoding, the
  closed LayerChart-backed compiler/components, evidence states, and accessible
  table twins. Pass only the renderer-neutral contract. Product code supplies
  semantic CSS tokens and domain chrome; it does not import LayerChart directly
  or persist renderer option bags. Current source declares `layerchart@2.9.1`
  as an optional peer; reporting consumers install it explicitly. The workspace
  retains that exact version for its own tests. `/core` does not select reporting;
  the extracted HTTP consumer qualifies its installed and emitted closure under
  RELEASING. This source declaration does not change an already installed host.
  `/reporting` re-exports components, including when used to import its runtime decoder.
- `@phoenix-assets/doc-shell`: Svelte documentation UI for `doc-shell/v2`,
  legacy `doc-shell/v1`, and `doc-shell-site/v1`. `SiteShell` consumes a
  projected site and page ID; `/browser` exposes the Svelte-free controllers.
  The optional `PhoenixAssets.DocShell.*` modules render HEEx and static sites
  with DocShell 0.5 or 1.0 plus LiveView. Theme the renderers through the
  `--doc-*` custom properties; hosts supply routes, identity and authorization.

## Host-owned application composition

Phoenix Assets supplies generated types, commands, session context, runtime
helpers and development tooling. The host still owns its product design system
and task composition. Define task briefs, inspect/compare/act/monitor/compose
surfaces, content-container profiles, state continuity, disclosure rules,
card/dashboard use and accessibility evidence in the host repository. Keep
required risk, evidence, authority, error and recovery state in the host's
semantic view model; a generated contract does not decide where or whether the
host renders it.

Do not add a Phoenix Assets preset, config key, generated field or Svelte helper
whose only purpose is to enforce one application's breakpoints or page shell.
A reusable transport or typed-state gap must pass PHA.02 PLACE-1: an intrinsic
framework or existing-renderer need, differing real consumers, upstream semantic
owner, bounded authority/lifecycle, optional footprint and release cost. Reuse alone
is insufficient. Product Storybook fixtures and boundary screenshots stay with
the product that owns the task.

`@phoenix-assets/doc-shell` is an editorial documentation renderer, not the
host application's authenticated work shell. Its reading, navigation, search
and provenance behavior follows the upstream DocShell contract. Mounting it in
an application does not import DocShell layout or authorization semantics into
product routes.

The [coordinated renderer tracker](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/docs/plans/doc-shell-renderers.md#coordinated-completion)
separates implemented APIs from the remaining DocShell work. Inert settings
supply selector links, brand/footer data, shell/search and nested control labels,
and SEO metadata.
Hosted publication components consume the host-admitted upstream pair; page
renderers consume validated navigation, hero/banner and SEO data. Artifact
components consume producer-admitted receipts and verified original passive
SVG/PNG bytes, retain complete fallback and expose a read-only diagnostic preview.
The native artifact path requires the current upstream receipt API and refuses
when it is unavailable. The tracker records fresh local archive/browser results
and the outstanding external producer, native-application and human checks.
Keep host routing, authorization, product task state,
native readers and producer algorithms at their owners when filling a gap.

## Linting and formatting in host applications

Use Biome for the frontend. Phoenix Assets uses the same linter rather than
ESLint and Prettier. The shared config and Tailwind linter ship in
`@phoenix-assets/lint`:

```bash
pnpm add -D @phoenix-assets/lint @biomejs/biome tailwindcss svelte
```

- Biome: add `{ "extends": ["@phoenix-assets/lint/biome.base.json"] }` to `biome.json`,
  then layer your app-specific excludes/overrides on top. The base sets
  Svelte-aware rules (a `**/*.svelte` override disabling `useConst`,
  `useImportType`, `noUnusedVariables`, and `noUnusedImports` because Biome
  reports false positives on those rules in Svelte files).
- Tailwind v4: add a `lint:tw` script that runs the compiled
  `phoenix-assets-lint-tailwind` binary the package ships (or invoke it ad hoc with
  `pnpm exec phoenix-assets-lint-tailwind`). It flags arbitrary values with a
  standard equivalent (`w-[180px]` becomes `w-45`). CSS imports resolve exact and
  trailing-wildcard `kit.alias` entries plus SvelteKit's implicit `$lib` alias
  (including a custom `kit.files.lib`). Bare packages resolve from the importing
  stylesheet and host project, including under pnpm's strict dependency layout.
- Svelte structure: `phoenix-assets-lint-svelte` parses the selected
  components. It accepts standard module+instance script composition by default.
  A host may opt into `--single-script` and use repeated `--allow <glob>` values
  when that narrower convention is part of the host's own architecture.

Wire the applicable commands into CI.

## Custom presets

A preset changes which integrations run and in what order, either by adding an
integration the stack does not ship or dropping one entirely. Write a module with
`use PhoenixAssets.Preset`, list `integration/2` calls, and set it as
`config :phoenix_assets, preset: MyApp.Assets.Stack`. Start by copying
`PhoenixAssets.Presets.Svelte`. Ordering is resolved at compile time (a cycle or
missing hard dependency is a compile error).

If the default list needs only an option change, use configuration as described
in "Tuning the stack without a preset".

## Boundaries

- Omit `:preset` when using the standard stack.
  Turning Storybook off or pinning a locale list is config, not a preset.
- Keep page routes in SvelteKit and let the generators own contract types.
  Import generated types from `$phoenix/*`.
- Do not put secrets in `config :phoenix_assets, :env, expose: [...]`. Only listed
  keys are emitted, but treat the allow-list as public.

## Upgrading the audited dependency baseline

Ash 3.33 requires an explicit string-length policy in the host application's
configuration. Set this before compiling dependencies:

```elixir
config :ash, default_string_length_count: :codepoints
```

Coordinate the Hex and selected npm companion update, then regenerate contracts.
Before claiming a feature, bind the declared constraints, lock/override resolution,
extracted artifact and selected profile to its actual qualification under
[RELEASING](RELEASING.md). A fleet release rule, sibling source version or registry
entry does not establish the version running in this host. Missing selected
capabilities remain unavailable until that host's qualified adoption.
Generated Electric clients use `createShapeFetch` to refresh credentials on each
request. Configure process-wide auth only with application-wide defaults; SSR
request-specific tokens belong in per-request configuration.

Generated file paths must stay below `asset_root` and cannot traverse symlinks
inside it. The configured root itself may be a symlink. Failed generation now
raises from `Generated.stale?/1`; use `Generated.generate(ctx, check: true)` to
handle tagged errors explicitly.

For checkout DocShell settings, supply the upstream `presentation` object on the
site or renderer context. `SiteShell` accepts local `brand`/`footer` snippets and
`assetUrls`; HEEx keeps its slots. Hosts supply exact locale/release destinations,
translations, brand content and robots policy. Nonempty HEEx settings require
the unreleased upstream settings validator; older supported producers keep
empty/default behavior. New controls still need fresh browser/package qualification.

For paired hosted reference content, use Svelte `HostedReference` or HEEx
`ApiReference.hosted_reference/1` with the expected host-admitted publication.
Svelte also exports `admitHostedPair` for custom composition. Validate graph and
OpenAPI source contracts before passing inputs to the browser; the browser
compares bindings and basic wire fields, while HEEx delegates to upstream
`HostedPair.validate/3`. Missing or mismatched publication fields refuse before
rendering. Older DocShell producers lack this new API and must not be presented
as supporting it. Source authentication and authorization stay in the host.

Projected DocShell sites consume the upstream hero/banner and page SEO shapes.
Provide local image bytes through static `asset_options: [assets: [...]]` or a
Svelte `assetUrls` map. The exporter checks paths, digests, links and publication;
renderers preserve image alt text when an image cannot be resolved. Badge and
collapse metadata apply to projected site navigation; legacy graph sidebars keep
metadata opaque unless explicitly enabled. Current locale markers match a known
page/context locale; host-provided destinations remain exact. New nonempty page
decorations and reserved SEO require the matching upstream validator for HEEx.

Preserve original canonical page-content bytes when a browser reader must verify
fallbacks containing floats, negative zero or large integers. Extract
`{:ok, canonical_content}` from `DocShell.Json.Canonical.encode(page.content)`.
Pass `canonical_content` as Svelte `SiteShell`'s `canonicalContent` prop or
`admitPage(page, canonicalContent)`. The bounded reader
checks decoded content and retains original numeric spelling for the hash;
ordinary `JSON.stringify` changes that spelling and some control escapes.
Keep source validation and authenticity in the host; a digest comparison grants
no access and does not replace producer admission.
