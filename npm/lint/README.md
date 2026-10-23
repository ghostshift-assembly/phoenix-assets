# @phoenix-assets/lint

Shared frontend lint tooling for `phoenix_assets` hosts using Svelte 5 and
Tailwind v4. The package includes a Biome base config, a Svelte structure
linter, and a Tailwind v4 arbitrary-value linter. Biome owns syntax and style;
the focused linters enforce project structure and design-system rules that
Biome cannot infer.

## Install

```bash
pnpm add -D @phoenix-assets/lint @biomejs/biome tailwindcss svelte
```

`@biomejs/biome` (>=2.6.2), `tailwindcss`, and `svelte` are peer dependencies.

## Biome config

```jsonc
// biome.json
{ "extends": ["@phoenix-assets/lint/biome.base.json"] }
```

Layer your app-specific `files.includes` excludes and `overrides` on top (e.g.
barrel-file exemptions, your Tailwind entry CSS).

The base is deliberately laxer than the config `phoenix_assets` runs on itself:
unused imports and variables are warnings rather than errors, and the noisier
`suspicious` rules are off. A shared config that fails a host immediately is
unlikely to be adopted. Raise these rules in the host's `biome.json` once its
code is clean. The base is stricter about the `performance` rules
(`noBarrelFile`, `noReExportAll`, `noAccumulatingSpread`) are errors, because
those cost host apps bundle size in a way they cannot see from a diff.

A `**/*.svelte` override disables `useConst`, `useImportType`,
`noUnusedVariables`, and `noUnusedImports` because Biome reports false positives in
Svelte files.

## Tailwind v4 linter

The package ships a compiled `phoenix-assets-lint-tailwind` binary. Node cannot
strip types for files under `node_modules`, so the linter is published as
JavaScript; see the [Node type-stripping docs](https://nodejs.org/api/typescript.html).

```jsonc
// package.json
{
  "scripts": {
    "lint:tw": "phoenix-assets-lint-tailwind"
  }
}
```

Or invoke it ad hoc with `pnpm exec phoenix-assets-lint-tailwind` /
`npx phoenix-assets-lint-tailwind`.

Run it from the frontend root. It reads `src/app.css` and scans
`src/**/*.svelte` plus `src/**/*.variants.ts` by default; pass paths to override.
It exits non-zero on findings. CSS imports may use exact or trailing-wildcard
aliases from the host `svelte.config.js`. The resolver also supports SvelteKit's
implicit `$lib` alias and respects `kit.files.lib`; virtual aliases such as
`$app` and `$env` are intentionally outside a filesystem stylesheet resolver.
Bare package imports resolve from the importing stylesheet and host project, so
pnpm's strict dependency layout does not require packages to be dependencies of
the linter itself.
It uses Tailwind's `__unstable__loadDesignSystem` API, so keep it aligned with
your `tailwindcss` version.

## Svelte structure linter

`phoenix-assets-lint-svelte` parses every selected component with the Svelte
compiler. Module and instance script blocks may coexist: that is a standard
Svelte composition pattern. Hosts with a stricter local convention can opt in
to `--single-script` and add repeated `--allow <glob>` exceptions. Keeping the
policy explicit prevents a host convention from being mistaken for a Svelte
invariant.

```jsonc
{
  "scripts": {
    "lint:svelte": "phoenix-assets-lint-svelte",
    "lint:svelte:strict": "phoenix-assets-lint-svelte --single-script --allow 'src/**/*.stories.svelte'"
  }
}
```
