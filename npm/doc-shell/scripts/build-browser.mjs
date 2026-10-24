import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"

const root = fileURLToPath(new URL("..", import.meta.url))
const output = fileURLToPath(new URL("../../../priv/doc_shell", import.meta.url))

await build({
  root,
  configFile: false,
  publicDir: false,
  plugins: [
    {
      name: "doc-shell-bundled-notices",
      writeBundle(_, bundle) {
        const packages = new Set()
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== "chunk") continue
          for (const id of Object.keys(chunk.modules)) {
            if (!id.includes("/node_modules/") || id.startsWith("\0")) continue
            let directory = dirname(id.split("?")[0])
            while (directory.includes("/node_modules/")) {
              if (
                existsSync(join(directory, "package.json")) &&
                JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).name
              ) {
                packages.add(directory)
                break
              }
              directory = dirname(directory)
            }
          }
        }
        const notices = [...packages].sort().map((directory) => {
          const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"))
          const files = readdirSync(directory).filter((name) =>
            /^(?:licen[sc]e|copying|notice)(?:\.|$)/i.test(name),
          )
          return `${manifest.name}@${manifest.version} (${manifest.license ?? "see package"})\n${files.map((file) => readFileSync(join(directory, file), "utf8")).join("\n")}\n`
        })
        writeFileSync(join(output, "BUNDLED-NOTICES.txt"), notices.join("\n---\n\n"))
      },
    },
  ],
  build: {
    emptyOutDir: true,
    // The separately requested ELK module is measured against the 2 MiB asset budget.
    chunkSizeWarningLimit: 2048,
    minify: "esbuild",
    outDir: output,
    sourcemap: false,
    target: "es2022",
    modulePreload: false,
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: Object.fromEntries(
        ["browser", "highlight", "mermaid"].map((kind) => [
          `doc-shell-${kind}`,
          fileURLToPath(
            new URL(
              `../src/browser/${kind === "browser" ? "entry" : `${kind}-entry`}.ts`,
              import.meta.url,
            ),
          ),
        ]),
      ),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "doc-shell-[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.names?.some((name) => name.endsWith(".css"))
            ? "doc-shell.css"
            : "[name]-[hash][extname]",
      },
    },
  },
})
