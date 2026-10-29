import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [svelte()],
  resolve: { conditions: ["browser"] },
  test: {
    environment: "happy-dom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      include: [
        "src/{admission,artifact-media,ast,capabilities,directives,highlighter,hosted-pair,labels,openapi,page-presentation,presentation,url}.ts",
        "src/browser/*.ts",
      ],
      exclude: ["src/browser/entry.ts"],
    },
  },
})
