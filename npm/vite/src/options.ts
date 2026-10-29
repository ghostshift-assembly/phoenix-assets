import type { ResolvedConfig } from "vite"
import type { PhoenixAssetsOptions, ResolvedOptions } from "./types"

export function resolveOptions(
  opts: PhoenixAssetsOptions,
  config: ResolvedConfig,
): ResolvedOptions {
  const mode = opts.mode ?? "app"

  return {
    mode,
    root: config.root,
    generatedDir: opts.generatedDir ?? "src/lib/generated",
    gettextDir: opts.gettextDir ?? "../priv/gettext",
    graphOut: opts.graphOut ?? "../priv/phoenix_assets/graph.json",
    emitGraph: opts.emitGraph ?? false,
    devClient: opts.devClient ?? (mode === "app" && config.command === "serve"),
    virtualPrefix: opts.virtualPrefix ?? "$phoenix",
  }
}
