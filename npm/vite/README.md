# @phoenix-assets/vite

The Vite package for [`phoenix_assets`](https://github.com/ghostshift-assembly/phoenix-assets).
It exposes Elixir-generated contracts as `$phoenix/*` virtual modules, reloads
regenerated contracts through HMR, loads gettext `.po` files, and emits the
asset graph that Phoenix validates.

## Install

```bash
pnpm add -D @phoenix-assets/vite
```

`vite` is a peer (`^8.0.0`).

## Use

```ts
// vite.config.ts
import { phoenixAssets } from "@phoenix-assets/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [phoenixAssets()],
})
```

Generated modules are then available through the `$phoenix` alias:

```ts
import { routes } from "$phoenix/routes"
import { shapes } from "$phoenix/electric"
import type { Article } from "$phoenix/types"
```

The virtual modules resolve to the output of `mix phoenix_assets.gen`.
`mix phoenix_assets.gen --check` detects stale checked-in output.

Imported gettext `.po` catalogs are watched for edits, including files outside
the Vite project root. Editing a catalog invalidates its generated message
module without restarting the development server.

## Exports

| Export | What it is |
|---|---|
| `phoenixAssets` (also the default) | the plugin; `PhoenixAssetsOptions` types its options |
| `poLoader` | standalone gettext `.po` loader, if you want it without the rest |
| `createPhoenixViteConfig` | builds the Vite config Storybook shares with the app |

## Notes

Options use the same default paths as the Elixir package. Two options commonly
need attention:

- `generatedDir` must agree with `config :phoenix_assets, generated_dir:`. Move
  one without the other and the virtual modules resolve to nothing.
- `mode` defaults to `"app"`, the only mode with the dev HMR bridge and
  the build-time graph emitter. Storybook gets `"storybook"` (via
  `createPhoenixViteConfig`) and test runners `"test"`; both keep the virtual
  modules and the PO loader and drop the rest.
