export interface PhoenixAssetsOptions {
  /** "app" (default), "storybook", or "test". Only "app" enables the dev HMR
   *  bridge and the build-time graph emitter; other modes keep just the virtual
   *  modules and PO loader active. */
  mode?: "app" | "storybook" | "test"
  /** Directory relative to the Vite root (default "src/lib/generated"); match Elixir's generated_dir. */
  generatedDir?: string
  /** Gettext directory whose .po files the PO loader transforms. */
  gettextDir?: string
  /** Output path for the build-time asset graph (only when emitGraph is true). */
  graphOut?: string
  /** Emit graph.json from the Vite bundle at build time. Off by default; the
   *  canonical graph is built by `mix phoenix_assets.graph`. */
  emitGraph?: boolean
  /** Enable the dev HMR bridge (default: only when Vite is serving). */
  devClient?: boolean
  /** Virtual-module prefix (default "$phoenix"). */
  virtualPrefix?: string
}

export interface ResolvedOptions {
  mode: "app" | "storybook" | "test"
  root: string
  generatedDir: string
  gettextDir: string
  graphOut: string
  emitGraph: boolean
  devClient: boolean
  virtualPrefix: string
}
