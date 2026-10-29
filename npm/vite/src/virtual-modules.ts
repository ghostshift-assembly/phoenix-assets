import fs from "node:fs"
import path from "node:path"
import { type Plugin, transformWithOxc } from "vite"
import { GENERATED, RESOLVED_PREFIX } from "./generated"
import { resolveOptions } from "./options"
import type { PhoenixAssetsOptions, ResolvedOptions } from "./types"

/**
 * Resolves the `$phoenix/*` virtual modules to the on-disk TypeScript generated
 * by Elixir, by re-exporting the real files (so editors and `svelte-check` see a
 * single typed source of truth). Returns typed stubs when a file is missing.
 */
export function virtualModulesPlugin(opts: PhoenixAssetsOptions): Plugin {
  let options: ResolvedOptions

  return {
    name: "phoenix-assets:virtual-modules",
    enforce: "pre",
    configResolved(config) {
      options = resolveOptions(opts, config)
    },
    resolveId(id) {
      const prefix = `${options.virtualPrefix}/`
      if (!id.startsWith(prefix)) return null
      const name = id.slice(prefix.length)
      return Object.hasOwn(GENERATED, name) ? RESOLVED_PREFIX + name : null
    },
    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null
      const name = id.slice(RESOLVED_PREFIX.length)
      if (!Object.hasOwn(GENERATED, name)) return null
      const entry = GENERATED[name as keyof typeof GENERATED]
      if (!entry) return null

      const file = path.resolve(options.root, options.generatedDir, entry.file)
      this.addWatchFile(file)

      if (!fs.existsSync(file)) {
        this.warn(
          `${options.virtualPrefix}/${name} has not been generated yet — run \`mix phoenix_assets.gen\``,
        )
        return transformWithOxc(entry.stub, file)
      }

      return `export * from ${JSON.stringify(file)}\n`
    },
  }
}
