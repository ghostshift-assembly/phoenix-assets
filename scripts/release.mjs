import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  recordBuildInputs,
  reviewQualification,
  treeMeasurements,
  verifyQualification,
  writeQualification,
} from "./qualification.mjs"

const REPOSITORY = "ghostshift-assembly/phoenix-assets"
const STALE_REPOSITORY = "futhr/phoenix" + "_assets"
const REPOSITORY_URL = `https://github.com/${REPOSITORY}`
const NPM_REPOSITORY_URL = `git+${REPOSITORY_URL}.git`
const RELEASE_SCHEMA = "phoenix-assets/release/v1"
const DOC_SHELL_RELEASE = "2.0.0"
const PACKAGES = [
  { directory: "npm/doc-shell", name: "@phoenix-assets/doc-shell", slug: "doc-shell" },
  { directory: "npm/lint", name: "@phoenix-assets/lint", slug: "lint" },
  { directory: "npm/svelte", name: "@phoenix-assets/svelte", slug: "svelte" },
  { directory: "npm/vite", name: "@phoenix-assets/vite", slug: "vite" },
]

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const CANONICAL_REMOTES = new Set([
  `https://github.com/${REPOSITORY}`,
  `https://github.com/${REPOSITORY}.git`,
  `git@github.com:${REPOSITORY}.git`,
  `ssh://git@github.com/${REPOSITORY}.git`,
])

export function isCanonicalRepositoryRemote(origin) {
  return CANONICAL_REMOTES.has(origin)
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options })
}

function capture(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim()
}

function publishedDependenciesEnv() {
  const env = { ...process.env }
  delete env.DOC_SHELL_CANDIDATE
  return env
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function hash(path, algorithm) {
  return createHash(algorithm).update(readFileSync(path)).digest("hex")
}

function integrity(path) {
  return `sha512-${createHash("sha512").update(readFileSync(path)).digest("base64")}`
}

export function readReleaseVersions(root) {
  const mix = readFileSync(join(root, "mix.exs"), "utf8")
  const mixVersion = mix.match(/@version\s+"([^"]+)"/)?.[1]
  return {
    hex: mixVersion,
    npm: Object.fromEntries(
      PACKAGES.map((pkg) => [
        pkg.name,
        readJson(join(root, pkg.directory, "package.json")).version,
      ]),
    ),
  }
}

export function collectReleaseErrors(
  root,
  { allowUntagged = false, checkGit = true, tag, requireClean = Boolean(tag) } = {},
) {
  const errors = []
  const versions = readReleaseVersions(root)
  const expected = versions.hex

  if (!expected || !SEMVER.test(expected))
    errors.push(`invalid Mix version: ${expected ?? "missing"}`)
  for (const [name, version] of Object.entries(versions.npm)) {
    if (version !== expected)
      errors.push(`${name} version ${version} does not match Mix ${expected}`)
  }

  if (tag && tag !== `v${expected}`) errors.push(`tag ${tag} does not match release v${expected}`)
  if (!tag && !allowUntagged) errors.push("a production release requires --tag v<version>")

  for (const pkg of PACKAGES) {
    const manifest = readJson(join(root, pkg.directory, "package.json"))
    if (manifest.homepage !== REPOSITORY_URL) {
      errors.push(`${pkg.name} homepage must be ${REPOSITORY_URL}`)
    }
    if (manifest.repository?.url !== NPM_REPOSITORY_URL) {
      errors.push(`${pkg.name} repository URL must be ${NPM_REPOSITORY_URL}`)
    }
    if (manifest.repository?.directory !== pkg.directory) {
      errors.push(`${pkg.name} repository directory must be ${pkg.directory}`)
    }
    if (manifest.publishConfig?.access !== "public") {
      errors.push(`${pkg.name} publishConfig.access must be public`)
    }
  }

  for (const path of ["mix.exs", "config/config.exs", "README.md", "CHANGELOG.md"]) {
    const contents = readFileSync(join(root, path), "utf8")
    if (contents.includes(STALE_REPOSITORY)) {
      errors.push(`${path} still references ${STALE_REPOSITORY}`)
    }
  }

  if (checkGit) {
    const origin = capture("git", ["remote", "get-url", "origin"], { cwd: root })
    if (!isCanonicalRepositoryRemote(origin)) {
      errors.push(`origin is not ${REPOSITORY}: ${origin}`)
    }

    if (tag) {
      const head = capture("git", ["rev-parse", "HEAD"], { cwd: root })
      const tagged = capture("git", ["rev-list", "-n", "1", tag], { cwd: root })
      if (head !== tagged) errors.push(`${tag} points to ${tagged}, not checked-out ${head}`)

      if (requireClean) {
        const dirty = capture("git", ["status", "--porcelain"], { cwd: root })
        if (dirty) errors.push("tagged releases must build from a clean worktree")
      }
    }

    const staleLinks = spawnSync("git", ["grep", "-n", STALE_REPOSITORY], {
      cwd: root,
      encoding: "utf8",
    })
    if (staleLinks.status === 0) errors.push(`stale repository links:\n${staleLinks.stdout.trim()}`)
    if (staleLinks.status !== 0 && staleLinks.status !== 1) {
      errors.push(`git grep failed: ${staleLinks.stderr.trim()}`)
    }

    for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
      const contents = readFileSync(join(root, workflow), "utf8")
      const mutable = [...contents.matchAll(/uses:\s+[^\s]+@([^\s#]+)/g)]
        .map((match) => match[1])
        .filter((reference) => !/^[a-f\d]{40}$/.test(reference))
      if (mutable.length > 0)
        errors.push(`${workflow} has mutable action refs: ${mutable.join(", ")}`)
    }
  }

  return errors
}

export function validateRelease(root, options = {}) {
  const errors = collectReleaseErrors(root, options)
  if (errors.length > 0) throw new Error(`release validation failed:\n- ${errors.join("\n- ")}`)
  return readReleaseVersions(root).hex
}

function artifactPaths(output, version) {
  return {
    hex: join(output, `phoenix_assets-${version}.tar`),
    npm: Object.fromEntries(
      PACKAGES.map((pkg) => [pkg.name, join(output, `phoenix-assets-${pkg.slug}-${version}.tgz`)]),
    ),
  }
}

function writeManifest(root, output, version, paths, sourceDirty) {
  const sourceSha = capture("git", ["rev-parse", "HEAD"], { cwd: root })
  const artifacts = [
    {
      ecosystem: "hex",
      name: "phoenix_assets",
      file: basename(paths.hex),
      sha256: hash(paths.hex, "sha256"),
    },
    ...PACKAGES.map((pkg) => ({
      ecosystem: "npm",
      name: pkg.name,
      file: basename(paths.npm[pkg.name]),
      sha256: hash(paths.npm[pkg.name], "sha256"),
      integrity: integrity(paths.npm[pkg.name]),
    })),
  ]
  const manifest = {
    schema_version: RELEASE_SCHEMA,
    version,
    source_repository: REPOSITORY_URL,
    source_sha: sourceSha,
    source_dirty: sourceDirty,
    artifacts,
  }
  const manifestPath = join(output, "release-manifest.json")
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const checksumPaths = [...artifacts.map(({ file }) => join(output, file)), manifestPath]
  const checksums = checksumPaths
    .map((path) => `${hash(path, "sha256")}  ${basename(path)}`)
    .sort()
    .join("\n")
  writeFileSync(join(output, "SHA256SUMS"), `${checksums}\n`)
}

function buildArtifacts(root, output, options) {
  const version = validateRelease(root, options)
  const sourceDirty = Boolean(capture("git", ["status", "--porcelain"], { cwd: root }))
  mkdirSync(output, { recursive: true })
  const existing = readdirSync(output)
  if (existing.length > 0) throw new Error(`artifact directory must be empty: ${output}`)

  run("pnpm", ["-r", "build"], { cwd: root })
  run("pnpm", ["-r", "run", "check:publish"], { cwd: root })

  const paths = artifactPaths(output, version)
  run("mix", ["hex.build", "--output", paths.hex], {
    cwd: root,
    env: publishedDependenciesEnv(),
  })
  for (const pkg of PACKAGES) {
    run("pnpm", ["--dir", pkg.directory, "pack", "--out", paths.npm[pkg.name]], { cwd: root })
  }

  writeManifest(root, output, version, paths, sourceDirty)
  verifyArtifacts(root, output, options)
  recordBuildInputs(root, output)
}

export function verifyArtifacts(root, output, options = {}) {
  const version = validateRelease(root, { ...options, requireClean: false })
  const manifest = readJson(join(output, "release-manifest.json"))
  if (manifest.schema_version !== RELEASE_SCHEMA) throw new Error("unknown release manifest schema")
  if (manifest.version !== version)
    throw new Error("artifact manifest version does not match source")
  if (manifest.source_repository !== REPOSITORY_URL)
    throw new Error("artifact manifest repository does not match source")
  if (typeof manifest.source_dirty !== "boolean")
    throw new Error("artifact manifest must declare source_dirty")

  const currentSha = capture("git", ["rev-parse", "HEAD"], { cwd: root })
  if (manifest.source_sha !== currentSha)
    throw new Error("artifacts were built from another commit")
  if (options.tag && manifest.source_dirty)
    throw new Error("tagged artifacts came from a dirty tree")

  const expectedFiles = new Map([
    [`phoenix_assets-${version}.tar`, { ecosystem: "hex", name: "phoenix_assets" }],
    ...PACKAGES.map((pkg) => [
      `phoenix-assets-${pkg.slug}-${version}.tgz`,
      { ecosystem: "npm", name: pkg.name },
    ]),
  ])
  const expectedChecksums = new Set([...expectedFiles.keys(), "release-manifest.json"])
  for (const artifact of manifest.artifacts) {
    const expected = expectedFiles.get(artifact.file)
    if (!expected) throw new Error(`unexpected artifact ${artifact.file}`)
    if (artifact.name !== expected.name || artifact.ecosystem !== expected.ecosystem)
      throw new Error(`artifact identity mismatch for ${artifact.file}`)
    expectedFiles.delete(artifact.file)
    const path = join(output, artifact.file)
    if (!existsSync(path)) throw new Error(`missing artifact ${artifact.file}`)
    if (hash(path, "sha256") !== artifact.sha256) {
      throw new Error(`checksum mismatch for ${artifact.file}`)
    }
    if (artifact.ecosystem === "npm" && integrity(path) !== artifact.integrity) {
      throw new Error(`npm integrity mismatch for ${artifact.file}`)
    }
  }
  if (expectedFiles.size > 0)
    throw new Error(`manifest is missing ${[...expectedFiles.keys()].join(", ")}`)

  const checksumLines = readFileSync(join(output, "SHA256SUMS"), "utf8").trim().split("\n")
  for (const line of checksumLines) {
    const match = line.match(/^([a-f\d]{64})  (.+)$/)
    if (!match) throw new Error(`invalid SHA256SUMS line: ${line}`)
    const [, expectedHash, file] = match
    if (!expectedChecksums.delete(file))
      throw new Error(`unexpected or duplicate SHA256SUMS file: ${file}`)
    if (hash(join(output, file), "sha256") !== expectedHash) {
      throw new Error(`SHA256SUMS mismatch for ${file}`)
    }
  }
  if (expectedChecksums.size > 0)
    throw new Error(`SHA256SUMS is missing ${[...expectedChecksums].join(", ")}`)
  return manifest
}

async function smokeNpmArtifacts(sourceRoot, output, manifest, hostedConsumer) {
  const root = mkdtempSync(join(tmpdir(), "phoenix-assets-npm-smoke-"))
  let complete = false
  try {
    const dependencies = Object.fromEntries(
      manifest.artifacts
        .filter(({ ecosystem }) => ecosystem === "npm")
        .map(({ name, file }) => [name, `file:${join(output, file)}`]),
    )
    for (const pkg of PACKAGES) {
      Object.assign(
        dependencies,
        readJson(join(sourceRoot, pkg.directory, "package.json")).peerDependencies,
      )
    }
    const workspace = readFileSync(join(sourceRoot, "pnpm-workspace.yaml"), "utf8")
    const sveltePluginVersion = workspace.match(/"@sveltejs\/vite-plugin-svelte":\s*([^\s]+)/)?.[1]
    if (!sveltePluginVersion) throw new Error("Svelte Vite plugin catalog version is missing")
    dependencies["@sveltejs/vite-plugin-svelte"] = sveltePluginVersion
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({ name: "phoenix-assets-release-smoke", private: true, type: "module", dependencies }, null, 2)}\n`,
    )
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: root,
    })

    mkdirSync(join(root, "src"))
    writeFileSync(join(root, "src", "app.css"), '@import "tailwindcss";\n')
    writeFileSync(join(root, "src", "smoke.svelte"), '<p class="p-4">Lint smoke</p>\n')
    run(join(root, "node_modules/.bin/phoenix-assets-lint-svelte"), ["src/smoke.svelte"], {
      cwd: root,
    })
    run(join(root, "node_modules/.bin/phoenix-assets-lint-tailwind"), ["src/smoke.svelte"], {
      cwd: root,
    })

    writeFileSync(
      join(root, "smoke.mjs"),
      `
const imports = [
  "@phoenix-assets/vite",
  "@phoenix-assets/svelte",
  "@phoenix-assets/svelte/socket",
]
const resolutions = [
  "@phoenix-assets/lint/lint-svelte.js",
  "@phoenix-assets/lint/lint-tailwind.js",
  "@phoenix-assets/svelte/collection",
  "@phoenix-assets/svelte/reporting",
  "@phoenix-assets/doc-shell",
  "@phoenix-assets/doc-shell/theme.css",
  "@phoenix-assets/lint/biome.base.json",
]
for (const specifier of [...imports, ...resolutions]) import.meta.resolve(specifier)
for (const specifier of imports) await import(specifier)
`,
    )
    writeFileSync(
      join(root, "consumer.js"),
      `
export { PortableReport } from "@phoenix-assets/svelte/reporting"
export { createShapeCollection } from "@phoenix-assets/svelte/collection"
export { DocShell } from "@phoenix-assets/doc-shell"
import "@phoenix-assets/doc-shell/theme.css"
`,
    )
    writeFileSync(
      join(root, "vite.config.mjs"),
      `
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"
export default defineConfig({
  plugins: [svelte()],
  build: { lib: { entry: "consumer.js", formats: ["es"] } },
})
`,
    )
    run("node", ["smoke.mjs"], { cwd: root })
    run(join(root, "node_modules/.bin/vite"), ["build"], { cwd: root })
    copyFileSync(join(root, "package-lock.json"), join(output, "consumer-full-package-lock.json"))
    cpSync(join(root, "dist"), join(output, "consumer-full-dist"), { recursive: true })
    const { qualifyBrowser } = await import("./browser-qualification.mjs")
    const browser = await qualifyBrowser(sourceRoot, root, output, hostedConsumer)
    cpSync(join(root, "browser-dist"), join(output, "consumer-browser-dist"), { recursive: true })
    const peer = join(root, "node_modules/layerchart")
    renameSync(peer, `${peer}.unselected`)
    try {
      const missing = spawnSync(join(root, "node_modules/.bin/vite"), ["build"], {
        cwd: root,
        encoding: "utf8",
      })
      if (missing.status === 0 || !/layerchart/i.test(`${missing.stdout}\n${missing.stderr}`))
        throw new Error("missing reporting peer did not fail module resolution")
    } finally {
      renameSync(`${peer}.unselected`, peer)
    }
    complete = true
    return {
      browser,
      installed: treeMeasurements(join(root, "node_modules")),
      emitted: treeMeasurements(join(root, "dist")),
      closure: JSON.parse(capture("npm", ["ls", "--all", "--json"], { cwd: root })),
      cases: [
        "all selected exports",
        "reporting, collection and DocShell browser build",
        "missing LayerChart fails the selected reporting build",
      ],
    }
  } finally {
    if (complete) rmSync(root, { force: true, recursive: true })
    else console.error(`Failed npm consumer retained for inspection: ${root}`)
  }
}

function smokeCoreArtifact(sourceRoot, archive) {
  const root = mkdtempSync(join(tmpdir(), "phoenix-assets-http-smoke-"))
  try {
    const runtime = readJson(join(sourceRoot, "npm/svelte/package.json"))
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          private: true,
          type: "module",
          dependencies: {
            "@phoenix-assets/svelte": `file:${archive}`,
            svelte: runtime.peerDependencies.svelte,
          },
        },
        null,
        2,
      )}\n`,
    )
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--omit=optional"], {
      cwd: root,
    })
    writeFileSync(
      join(root, "consumer.mjs"),
      `
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { runCommand, configureShapeAuth, resolveLocale, matchEvent } from "@phoenix-assets/svelte/core"
for (const name of ["layerchart", "@electric-sql/client", "@tanstack/electric-db-collection", "@tanstack/svelte-db", "phoenix"]) {
  assert.equal(existsSync("node_modules/" + name), false, name + " unexpectedly installed")
}
configureShapeAuth({ readToken: () => "synthetic", headers: () => ({ "X-Scope": "one" }) })
const success = await runCommand({ path: "/records/:id", params: { id: "one" }, method: "POST", body: { value: 1 },
  fetch: async (url, init) => {
    assert.equal(url, "/records/one")
    assert.equal(init.headers.get("Authorization"), "Bearer synthetic")
    assert.equal(init.headers.get("X-Scope"), "one")
    assert.equal(init.body, JSON.stringify({ value: 1 }))
    return new Response(JSON.stringify({ saved: true }), { status: 200 })
  }
}, ["denied"])
assert.deepEqual(success, { ok: true, data: { saved: true } })
const denied = await runCommand({ path: "/records", method: "POST",
  fetch: async () => new Response(JSON.stringify({ error: "denied" }), { status: 403 })
}, ["denied"])
assert.deepEqual(denied, { ok: false, error: "denied", status: 403 })
assert.deepEqual(await runCommand({ path: "/records", method: "POST", fetch: async () => { throw new Error("lost") } }),
  { ok: false, error: "unknown_error", status: 0 })
assert.equal(resolveLocale("sv-SE", ["en", "sv"], "en"), "sv")
let matched = false
matchEvent({ type: "changed", payload: 1 }, { changed: () => { matched = true } })
assert.equal(matched, true)
console.log("Packed HTTP runtime verified without Electric, TanStack or Phoenix peers.")
`,
    )
    run("node", ["consumer.mjs"], { cwd: root })
    copyFileSync(
      join(root, "package-lock.json"),
      join(dirname(archive), "consumer-http-package-lock.json"),
    )
    const installed = treeMeasurements(join(root, "node_modules"))
    const closure = JSON.parse(
      capture("npm", ["ls", "--all", "--json", "--omit=optional"], { cwd: root }),
    )
    writeFileSync(
      join(root, "consumer.js"),
      'export { runCommand, resolveLocale } from "@phoenix-assets/svelte/core"\n',
    )
    writeFileSync(
      join(root, "vite.config.mjs"),
      'export default { build: { lib: { entry: "consumer.js", formats: ["es"] } } }\n',
    )
    run(join(sourceRoot, "npm/vite/node_modules/.bin/vite"), ["build"], { cwd: root })
    cpSync(join(root, "dist"), join(dirname(archive), "consumer-http-dist"), { recursive: true })
    return {
      installed,
      closure,
      emitted: treeMeasurements(join(root, "dist")),
      cases: [
        "success",
        "denied",
        "transport loss without replay",
        "auth and scope headers",
        "locale and event helpers",
        "no LayerChart, Electric, TanStack or Phoenix installation",
      ],
    }
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
}

function smokeHexArtifact(sourceRoot, output, manifest, docShellVersion, resources) {
  const artifact = manifest.artifacts.find(({ ecosystem }) => ecosystem === "hex")
  if (!artifact) throw new Error("Hex artifact is missing")
  const root = mkdtempSync(join(tmpdir(), "phoenix-assets-hex-smoke-"))
  const outer = join(root, "outer")
  const source = join(root, "source")
  const consumer = join(root, "consumer")
  let evidence
  mkdirSync(outer)
  mkdirSync(source)
  mkdirSync(join(consumer, "lib"), { recursive: true })

  try {
    run("tar", ["-xf", join(output, artifact.file), "-C", outer])
    run("elixir", [
      "-e",
      `
      [path] = System.argv()
      {:ok, metadata} = :file.consult(String.to_charlist(path))
      requirements = :proplists.get_value("requirements", metadata, [])
      for requirement <- requirements do
        name = :proplists.get_value("name", requirement)
        if name in ["phoenix_sync", "electric"],
          do: raise("asset package must not constrain the host sync backend: #{name}")
      end
      doc_shell = Enum.find(requirements, &(:proplists.get_value("name", &1) == "doc_shell"))
      true = :proplists.get_value("optional", doc_shell)
      requirement = :proplists.get_value("requirement", doc_shell)
      true = Version.match?("${DOC_SHELL_RELEASE}", requirement)
      false = Version.match?("1.0.0", requirement)
      false = Version.match?("3.0.0", requirement)
      `,
      join(outer, "metadata.config"),
    ])
    run("tar", ["-xzf", join(outer, "contents.tar.gz"), "-C", source])
    copyFileSync(join(sourceRoot, ".tool-versions"), join(consumer, ".tool-versions"))
    writeFileSync(
      join(consumer, "mix.exs"),
      `
defmodule Consumer.MixProject do
  use Mix.Project
  def project, do: [app: :consumer, version: "0.0.0", deps: [{:phoenix_assets, path: ${JSON.stringify(source)}}${docShellVersion ? `, {:doc_shell, "== ${docShellVersion}"}, {:phoenix_live_view, "~> 1.1"}` : ""}${docShellVersion === DOC_SHELL_RELEASE && resources ? ', {:bandit, "~> 1.14.1"}' : ""}]]
end
`,
    )
    writeFileSync(join(consumer, ".formatter.exs"), "[import_deps: [:phoenix_assets]]\n")
    writeFileSync(
      join(consumer, "lib/consumer.ex"),
      `defmodule Consumer do
  @moduledoc false
  use PhoenixAssets.Electric.Shapes

  shape :item, route: "/shapes/items", type: "Item"
end

defmodule Consumer.Commands do
  @moduledoc false
  use PhoenixAssets.Commands.Definitions

  command :save_item, route: "/items/:id", params: [id: :string], body: [name: :string]
end
`,
    )
    const consumerEnv = { ...publishedDependenciesEnv(), MIX_ENV: "prod" }
    for (const variable of ["MIX_BUILD_PATH", "MIX_BUILD_ROOT", "MIX_DEPS_PATH", "MIX_LOCKFILE"]) {
      delete consumerEnv[variable]
    }
    const consumerOptions = { cwd: consumer, env: consumerEnv }
    run("mix", ["deps.get"], consumerOptions)
    run("mix", ["compile", "--warnings-as-errors"], consumerOptions)
    run("mix", ["format", "--check-formatted", "lib/consumer.ex"], consumerOptions)
    run(
      "mix",
      [
        "run",
        "-e",
        `
      for app <- ${docShellVersion ? "[:ash, :igniter, :gettext, :phoenix_sync, :tidewave, :ash_typescript]" : "[:ash, :igniter, :phoenix_live_view, :doc_shell, :gettext, :phoenix_sync, :tidewave, :ash_typescript]"} do
        if Application.spec(app), do: raise("unexpected optional dependency: #{app}")
      end
      Code.compiler_options(ignore_module_conflict: true)
      files = Path.wildcard(Path.join([Mix.Project.deps_paths()[:phoenix_assets], "lib", "**/*.ex"]))
      case Kernel.ParallelCompiler.compile(files, return_diagnostics: true) do
        {:ok, _, []} -> :ok
        {:ok, _, %{compile_warnings: [], runtime_warnings: []}} -> :ok
        result -> raise("package compilation produced diagnostics: #{inspect(result)}")
      end
      unless Code.ensure_loaded?(PhoenixAssets), do: raise("runtime module missing")
      ${
        docShellVersion
          ? `
      true = Code.ensure_loaded?(PhoenixAssets.DocShell.Ast)
      true = Code.ensure_loaded?(DocShell.Presentation.Site)
      for module <- [PhoenixAssets.DocShell.Components, PhoenixAssets.DocShell.ApiReference,
                     PhoenixAssets.DocShell.StaticRenderer, PhoenixAssets.DocShell.Assets,
                     PhoenixAssets.DocShell.Pagefind] do
        true = Code.ensure_loaded?(module)
      end
      `
          : ""
      }
      [_] = Consumer.__phoenix_assets_shapes__()
      config = PhoenixAssets.Config.load!(otp_app: :consumer,
        preset: PhoenixAssets.Presets.SvelteHttp, stack: [commands: Consumer.Commands])
      ctx = PhoenixAssets.Context.new(config, plugins: PhoenixAssets.Config.preset_plugins(config))
      {:ok, initialized} = PhoenixAssets.Engine.init_plugins(ctx)
      false = Enum.any?(initialized, fn {module, _, _} -> module == PhoenixAssets.Electric end)
      files = PhoenixAssets.Engine.collect(ctx, initialized, :generated_files)
      [commands] = Enum.filter(files, &(&1.kind == :commands))
      true = IO.iodata_to_binary(commands.contents) =~ ~s|from "@phoenix-assets/svelte/core"|
      false = Enum.any?(files, &(&1.kind == :electric))
      File.write!("generated-digests.json", JSON.encode!(Map.new(files, fn file ->
        {Path.basename(file.path), :crypto.hash(:sha256, IO.iodata_to_binary(file.contents)) |> Base.encode16(case: :lower)}
      end)))
      try do
        PhoenixAssets.Types.Walker.render([])
        raise "unguarded Ash walker"
      rescue
        error in ArgumentError ->
          unless Exception.message(error) =~ "optional :ash", do: reraise(error, __STACKTRACE__)
      end
    `,
      ],
      consumerOptions,
    )
    if (docShellVersion === DOC_SHELL_RELEASE) {
      run(
        "mix",
        [
          "run",
          "--no-start",
          join(sourceRoot, "scripts/renderer-fixture.exs"),
          join(output, "browser-static"),
        ],
        consumerOptions,
      )
      run(
        "mix",
        [
          "run",
          "--no-start",
          join(sourceRoot, "scripts/search-fixture.exs"),
          join(output, "browser-search"),
        ],
        consumerOptions,
      )
      run(
        "mix",
        [
          "run",
          "--no-start",
          join(sourceRoot, "scripts/conformance-fixture.exs"),
          join(output, "browser-conformance"),
        ],
        consumerOptions,
      )
    }
    evidence = {
      doc_shell: docShellVersion ?? null,
      lock_sha256: hash(join(consumer, "mix.lock"), "sha256"),
      config_sha256: hash(join(consumer, "mix.exs"), "sha256"),
      generated: readJson(join(consumer, "generated-digests.json")),
      result: "passed",
    }
    if (docShellVersion === DOC_SHELL_RELEASE && resources)
      resources.push({ root, consumer, env: consumerEnv })
  } finally {
    if (!resources?.some((resource) => resource.root === root))
      rmSync(root, { force: true, recursive: true })
  }
  if (!docShellVersion) {
    return [
      evidence,
      ...[DOC_SHELL_RELEASE].flatMap((version) =>
        smokeHexArtifact(sourceRoot, output, manifest, version, resources),
      ),
    ]
  }
  return [evidence]
}

async function smokeArtifacts(root, output, options) {
  const manifest = verifyArtifacts(root, output, options)
  run(
    "mix",
    ["run", "--no-start", join(root, "scripts/qualify-producer.exs"), join(output, "producer")],
    { cwd: root, env: { ...publishedDependenciesEnv(), MIX_ENV: "test" } },
  )
  const producer = readJson(join(output, "producer/producer-qualification.json"))
  const retained = readJson(
    join(root, "npm/svelte/test/fixtures/upstream-reporting/qualified/proof.json"),
  )
  for (const key of ["revision", "profile_sha256", "script_sha256", "cases_sha256"])
    if (producer[key] !== retained[key]) throw new Error(`stale producer qualification: ${key}`)
  const resources = []
  try {
    const hex = smokeHexArtifact(root, output, manifest, undefined, resources)
    const full = await smokeNpmArtifacts(root, output, manifest, resources[0])
    const runtime = manifest.artifacts.find(({ name }) => name === "@phoenix-assets/svelte")
    if (!runtime) throw new Error("Svelte runtime artifact is missing")
    const http = smokeCoreArtifact(root, join(output, runtime.file))
    const prior = qualifyPriorCohort(root, output, manifest)
    return { full, http, hex, producer, prior }
  } finally {
    for (const resource of resources) rmSync(resource.root, { force: true, recursive: true })
  }
}

function qualifyPriorCohort(sourceRoot, output, manifest) {
  const root = mkdtempSync(join(tmpdir(), "phoenix-assets-rollback-"))
  const runtime = readJson(join(sourceRoot, "npm/svelte/package.json"))
  const archive = manifest.artifacts.find(({ name }) => name === "@phoenix-assets/svelte")
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: {
          "@phoenix-assets/svelte": `file:${join(output, archive.file)}`,
          svelte: runtime.peerDependencies.svelte,
          layerchart: "2.9.0",
        },
      }),
    )
    const conflict = spawnSync(
      "npm",
      [
        "install",
        "--strict-peer-deps",
        "--package-lock-only",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ],
      { cwd: root, encoding: "utf8" },
    )
    if (conflict.status === 0 || !/ERESOLVE/.test(conflict.stderr))
      throw new Error("conflicting reporting peer was not rejected")
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: {
          "@phoenix-assets/svelte": "1.2.1",
          svelte: runtime.peerDependencies.svelte,
        },
      }),
    )
    rmSync(join(root, "package-lock.json"), { force: true })
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: root })
    const installed = treeMeasurements(join(root, "node_modules"))
    const closure = JSON.parse(capture("npm", ["ls", "--all", "--json"], { cwd: root }))
    copyFileSync(join(root, "package-lock.json"), join(output, "consumer-prior-package-lock.json"))
    writeFileSync(
      join(root, "consumer.js"),
      'export { runCommand, resolveLocale } from "@phoenix-assets/svelte"\n',
    )
    writeFileSync(
      join(root, "vite.config.mjs"),
      'export default { build: { lib: { entry: "consumer.js", formats: ["es"] } } }\n',
    )
    run(join(sourceRoot, "npm/vite/node_modules/.bin/vite"), ["build"], { cwd: root })
    cpSync(join(root, "dist"), join(output, "consumer-prior-dist"), { recursive: true })
    const emitted = treeMeasurements(join(root, "dist"))
    // Reinstall the original exact lock and exercise its own public entrypoint.
    rmSync(join(root, "node_modules"), { recursive: true, force: true })
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: root })
    run(
      "node",
      [
        "--input-type=module",
        "-e",
        'import assert from "node:assert/strict"; import { runCommand } from "@phoenix-assets/svelte"; assert.equal(typeof runCommand, "function")',
      ],
      { cwd: root },
    )
    return {
      version: "1.2.1",
      installed,
      emitted,
      closure,
      cases: [
        "conflicting LayerChart 2.9.0 rejected by strict peer installation",
        "prior published package and exact lock restored with npm ci",
        "restored public HTTP helper imports",
      ],
    }
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
}

function npmRegistryState(name, version, path) {
  const result = spawnSync("npm", ["view", `${name}@${version}`, "dist.integrity", "--json"], {
    encoding: "utf8",
  })
  if (result.status === 0) {
    const published = JSON.parse(result.stdout)
    const local = integrity(path)
    if (published !== local) throw new Error(`${name}@${version} exists with different bytes`)
    return "identical"
  }
  const output = `${result.stdout}\n${result.stderr}`
  if (/E404|404 Not Found/.test(output)) return "missing"
  throw new Error(`npm preflight failed for ${name}@${version}: ${output.trim()}`)
}

async function hexRegistryState(version, path) {
  const response = await fetch(`https://repo.hex.pm/tarballs/phoenix_assets-${version}.tar`)
  if (response.status === 404) return "missing"
  if (!response.ok) throw new Error(`Hex preflight failed with HTTP ${response.status}`)
  const published = createHash("sha256")
    .update(Buffer.from(await response.arrayBuffer()))
    .digest("hex")
  if (published !== hash(path, "sha256")) {
    throw new Error(`phoenix_assets ${version} exists with different bytes`)
  }
  return "identical"
}

async function publishArtifacts(root, output, options) {
  if (!options.dryRun)
    validateRelease(root, { ...options, allowUntagged: false, requireClean: true })
  const manifest = verifyArtifacts(root, output, options)
  verifyQualification(root, output, { requireReviewed: !options.dryRun })
  const npmArtifacts = manifest.artifacts.filter(({ ecosystem }) => ecosystem === "npm")
  const hexArtifact = manifest.artifacts.find(({ ecosystem }) => ecosystem === "hex")
  if (!hexArtifact) throw new Error("Hex artifact is missing")

  // Complete every registry read before the first write. A rerun skips bytes
  // already published from this manifest and rejects any conflicting version.
  const npmStates = new Map(
    npmArtifacts.map((artifact) => [
      artifact.name,
      npmRegistryState(artifact.name, manifest.version, join(output, artifact.file)),
    ]),
  )
  const hexState = await hexRegistryState(manifest.version, join(output, hexArtifact.file))

  for (const artifact of npmArtifacts) {
    if (npmStates.get(artifact.name) === "identical") {
      console.log(`already published with identical bytes: ${artifact.name}@${manifest.version}`)
      continue
    }
    const args = ["publish", join(output, artifact.file), "--access", "public"]
    if (options.dryRun) args.push("--dry-run")
    run("npm", args, { cwd: root })
  }

  if (hexState === "identical") {
    console.log(`already published with identical bytes: phoenix_assets ${manifest.version}`)
  } else if (options.dryRun) {
    console.log(`dry run: validated ${hexArtifact.file}; Hex registry was not mutated`)
  } else {
    run("elixir", [join(root, "scripts/publish-hex.exs"), join(output, hexArtifact.file)], {
      cwd: root,
    })
  }
}

function parseArgs(argv) {
  const [command, ...args] = argv
  const value = (flag) => {
    const index = args.indexOf(flag)
    return index === -1 ? undefined : args[index + 1]
  }
  return {
    allowUntagged: args.includes("--allow-untagged"),
    artifactDir: value("--artifact-dir"),
    command,
    dryRun: args.includes("--dry-run"),
    network: args.includes("--network"),
    tag: value("--tag"),
    expectedSha: value("--expected-sha"),
    reviewer: value("--reviewer"),
  }
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const options = parseArgs(process.argv.slice(2))
  const releaseOptions = { allowUntagged: options.allowUntagged, tag: options.tag }
  const output = resolve(root, options.artifactDir ?? "dist/release")

  switch (options.command) {
    case "check":
      validateRelease(root, releaseOptions)
      if (options.network) run("git", ["ls-remote", "--exit-code", "origin", "HEAD"], { cwd: root })
      break
    case "build":
      buildArtifacts(root, output, releaseOptions)
      break
    case "verify":
      verifyArtifacts(root, output, releaseOptions)
      break
    case "smoke":
      await smokeArtifacts(root, output, releaseOptions)
      break
    case "qualify":
      writeQualification(root, output, await smokeArtifacts(root, output, releaseOptions))
      verifyQualification(root, output)
      break
    case "review-qualification":
      verifyArtifacts(root, output, releaseOptions)
      reviewQualification(root, output, options.expectedSha, options.reviewer)
      break
    case "verify-qualification":
      verifyArtifacts(root, output, releaseOptions)
      verifyQualification(root, output)
      break
    case "smoke-hex": {
      const temporary = mkdtempSync(join(tmpdir(), "phoenix-assets-hex-check-"))
      try {
        const file = "phoenix_assets.tar"
        run("mix", ["hex.build", "--output", join(temporary, file)], {
          cwd: root,
          env: publishedDependenciesEnv(),
        })
        smokeHexArtifact(root, temporary, { artifacts: [{ ecosystem: "hex", file }] })
      } finally {
        rmSync(temporary, { force: true, recursive: true })
      }
      break
    }
    case "smoke-core": {
      const temporary = mkdtempSync(join(tmpdir(), "phoenix-assets-core-check-"))
      try {
        run("pnpm", ["--filter", "@phoenix-assets/svelte", "build"], { cwd: root })
        run("pnpm", ["pack", "--pack-destination", temporary], { cwd: join(root, "npm/svelte") })
        const archives = readdirSync(temporary).filter((name) => name.endsWith(".tgz"))
        if (archives.length !== 1) throw new Error("Expected exactly one runtime archive")
        smokeCoreArtifact(root, join(temporary, archives[0]))
      } finally {
        rmSync(temporary, { force: true, recursive: true })
      }
      break
    }
    case "publish":
      await publishArtifacts(root, output, { ...releaseOptions, dryRun: options.dryRun })
      break
    default:
      throw new Error(
        "usage: release.mjs <check|build|verify|qualify|review-qualification|verify-qualification|smoke|smoke-hex|smoke-core|publish> [options]",
      )
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
