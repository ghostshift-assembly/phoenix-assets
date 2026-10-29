import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { createServer as createHttpServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, extname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { chromium } from "@playwright/test"

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
const modes = ["document", "site", "missing", "light", "dark", "monochrome", "enlarged"]

/** Observe actual no-JavaScript HTML from independent Svelte SSR and HEEx readers. */
export async function qualifyArtifactReaders(output, packageDirectory, peerDirectory) {
  const fixtures = JSON.parse(readFileSync(join(output, "artifact-fixtures.json"), "utf8"))
  const library = resolve(packageDirectory)
  const peers = resolve(peerDirectory)
  const requirePeer = createRequire(join(peers, "package.json"))
  const { createServer } = await import(pathToFileURL(requirePeer.resolve("vite")))
  const { svelte } = await import(
    pathToFileURL(requirePeer.resolve("@sveltejs/vite-plugin-svelte"))
  )
  const scratch = mkdtempSync(join(tmpdir(), "phoenix-artifact-ssr-"))
  const entry = join(scratch, "reader.mjs")
  symlinkSync(join(peers, "node_modules"), join(scratch, "node_modules"), "dir")
  writeFileSync(
    entry,
    `import { render } from "svelte/server"
import { ArtifactDocument, ArtifactPreview, SiteShell } from "@phoenix-assets/doc-shell"
export const document = (fixture, mode) => {
  const props = fixture.props
  if (mode === "site" || mode === "missing") return render(SiteShell, { props: {
    site: fixture.site, pageId: mode === "missing" ? "missing" : fixture.pageId,
    artifactAssets: props.assets, canonicalContent: props.canonicalContent, canonicalReceipt: props.canonicalReceipt,
    assetUrls: Object.fromEntries(Object.keys(props.assets).map((name) => [name, "../assets/" + name]))
  } })
  return render(mode === "document" ? ArtifactDocument : ArtifactPreview,
    { props: mode === "document" ? props : { ...props, mode } })
}
`,
  )
  const renderer = await createServer({
    root: scratch,
    configFile: false,
    publicDir: false,
    logLevel: "error",
    plugins: [svelte({ emitCss: false })],
    resolve: { alias: { "@phoenix-assets/doc-shell": join(library, "index.js") } },
    server: { middlewareMode: true },
    appType: "custom",
    ssr: { noExternal: ["@phoenix-assets/doc-shell"] },
  })
  try {
    const module = await renderer.ssrLoadModule(entry)
    mkdirSync(join(output, "svelte/assets"), { recursive: true })
    writeFileSync(join(output, "svelte/assets/theme.css"), readFileSync(join(library, "theme.css")))
    for (const fixture of fixtures) {
      fixture.svelte = {}
      const folder = join(output, "svelte", fixture.id)
      mkdirSync(folder, { recursive: true })
      for (const [name, asset] of Object.entries(fixture.props.assets)) {
        const assetPath = resolve(output, "svelte/assets", name)
        assert.ok(assetPath.startsWith(`${resolve(output, "svelte/assets")}${sep}`))
        mkdirSync(dirname(assetPath), { recursive: true })
        writeFileSync(assetPath, Buffer.from(asset.base64, "base64"))
      }
      for (const mode of modes) {
        const filename = `${mode}.html`
        const result = module.document(fixture, mode)
        assert.ok(!/<script\b/i.test(result.body), "SSR artifact output contains a script")
        writeFileSync(
          join(folder, filename),
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${result.head || "<title>Artifact reader</title>"}<link rel="stylesheet" href="../assets/theme.css"></head><body>${mode === "site" || mode === "missing" ? result.body : `<main>${result.body}</main>`}</body></html>`,
        )
        fixture.svelte[mode] = relative(output, join(folder, filename))
      }
    }
  } finally {
    await renderer.close()
    rmSync(scratch, { recursive: true, force: true })
  }
  const server = createHttpServer((request, response) => {
    try {
      let path = resolve(
        output,
        `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`,
      )
      if (!path.startsWith(`${resolve(output)}${sep}`)) throw new Error("outside fixture root")
      if (!existsSync(path)) {
        const pathname = new URL(request.url, "http://localhost").pathname
        const mount = pathname.startsWith("/review/") ? "native-subpath-web" : "native-root-web"
        path = resolve(
          output,
          mount,
          `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`,
        )
        if (!path.startsWith(`${resolve(output, mount)}${sep}`)) throw new Error("outside mount")
      }
      const mime = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      }[extname(path)]
      if (!mime) throw new Error("unsupported fixture resource")
      const bytes = readFileSync(path)
      response.writeHead(200, { "content-type": mime })
      response.end(bytes)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  const origin = `http://127.0.0.1:${server.address().port}`
  let browser
  const cases = []
  const screenshots = {}
  mkdirSync(join(output, "artifact-screenshots"), { recursive: true })
  try {
    browser = await chromium.launch({ headless: true })
    for (const transport of ["http", "file"]) {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 1280, height: 900 },
        offline: transport === "file",
      })
      const outside = []
      await context.route("**/*", async (route) => {
        const url = route.request().url()
        if (
          url.startsWith(`${origin}/`) ||
          url.startsWith(pathToFileURL(`${resolve(output)}${sep}`).href) ||
          url.startsWith("data:")
        )
          await route.continue()
        else {
          outside.push(url)
          await route.abort()
        }
      })
      try {
        for (const fixture of fixtures) {
          // A file reader needs the exporter-declared file mode. HTTP checks both modes.
          if (transport === "file" && !fixture.id.includes("-file-")) continue
          for (const mode of modes) {
            // SiteShell is an HTTP/hosted component; the HEEx exporter owns file URL rewriting.
            if (transport === "file" && (mode === "site" || mode === "missing")) continue
            const surfaces = {}
            for (const reader of ["heex", "svelte"]) {
              const path =
                reader === "svelte"
                  ? fixture.svelte[mode]
                  : mode === "document" || mode === "site"
                    ? fixture.native_document
                    : mode === "missing"
                      ? fixture.native_missing
                      : fixture.native_previews[mode]
              const page = await context.newPage()
              try {
                const url =
                  transport === "file"
                    ? pathToFileURL(join(output, path)).href
                    : `${origin}/${path}`
                await page.goto(url)
                if (mode === "site" || mode === "missing") {
                  assert.equal(
                    await page
                      .locator(reader === "svelte" ? ".site-layout" : ".doc-layout")
                      .evaluate((root) => getComputedStyle(root).display),
                    "grid",
                    "SSR component CSS is missing",
                  )
                  assert.ok(await page.getByText("New", { exact: true }).isVisible())
                  for (const text of [
                    "Contract docs",
                    "Portable documentation fixture",
                    "Search unavailable in passive mode; use page links.",
                  ])
                    assert.ok(
                      (await page.locator("body").innerText()).includes(text),
                      `${path}: ${text}`,
                    )
                  assert.ok(
                    await page
                      .getByRole("navigation", { name: "Reader language", exact: true })
                      .isVisible(),
                  )
                  assert.ok(
                    await page
                      .getByRole("navigation", { name: "Reader version", exact: true })
                      .isVisible(),
                  )
                  assert.equal(
                    await page
                      .getByRole("link", { name: "English", exact: true })
                      .getAttribute("aria-current"),
                    "true",
                  )
                  assert.equal(
                    await page
                      .getByRole("link", { name: "Stable", exact: true })
                      .getAttribute("aria-current"),
                    "true",
                  )
                  assert.equal(
                    await page.locator('meta[name="description"]').getAttribute("content"),
                    mode === "site" ? "Page search description" : "Shared site description",
                  )
                  assert.equal(
                    await page.locator('meta[name="robots"]').getAttribute("content"),
                    mode === "site" ? "noindex" : "nofollow",
                  )
                  if (mode === "site") {
                    assert.equal(
                      await page.locator('link[rel="canonical"]').getAttribute("href"),
                      `https://docs.example.test${fixture.site.pages[fixture.pageId].route}`,
                    )
                    assert.ok(
                      (await page.locator("body").innerText()).includes(
                        "Read the admitted generation",
                      ),
                    )
                    if (fixture.pageId === "chart") {
                      assert.ok((await page.locator("body").innerText()).includes("Start reading"))
                      await page.getByAltText("Chart thumbnail").evaluate((image) => image.decode())
                    }
                  }
                }
                if (mode === "site" || mode === "missing") {
                  const navigation = page.locator("aside details").first()
                  assert.equal(await navigation.count(), 1)
                  const before = await navigation.getAttribute("open")
                  const summary = navigation.locator(":scope > summary")
                  await summary.focus()
                  await summary.press("Space")
                  assert.notEqual(await navigation.getAttribute("open"), before)
                  await summary.press("Space")
                  assert.equal(await navigation.getAttribute("open"), before)
                  const destination = page.getByRole("link", { name: "English", exact: true })
                  await destination.focus()
                  await destination.press("Enter")
                  await page.waitForLoadState()
                  assert.equal(
                    await page.locator("figure[data-doc-artifact] figcaption").innerText(),
                    "Sample mass",
                  )
                  await page.goto(url)
                  const swedish = page.getByRole("link", { name: "Svenska", exact: true })
                  await swedish.focus()
                  await swedish.press("Enter")
                  await page.waitForLoadState()
                  assert.equal(await page.locator("h1").innerText(), "Dokumentation")
                  assert.equal(
                    await page.locator("[data-pa-doc-shell][lang]").getAttribute("lang"),
                    "sv",
                  )
                  await page.goto(url)
                  if (
                    fixture.id.startsWith("root-web-") &&
                    (mode === "site" || fixture.pageId === "chart")
                  ) {
                    const filename = `${fixture.id}-${reader}-${mode}.png`
                    const image = await page.screenshot({
                      path: join(output, "artifact-screenshots", filename),
                      fullPage: true,
                    })
                    screenshots[filename] = digest(image)
                  }
                }
                if (mode === "missing") {
                  assert.equal(await page.locator("h1").innerText(), "Document unavailable")
                  assert.equal(
                    await page.locator("script,button,dialog,iframe,object,embed").count(),
                    0,
                  )
                  surfaces[reader] = { title: await page.locator("h1").innerText() }
                  cases.push(
                    `${transport}:${fixture.id}:${reader}:passive-404,settings,selectors,SEO`,
                  )
                  continue
                }
                const figure = page.locator("figure[data-doc-artifact]")
                await figure.waitFor()
                const observation = await figure.evaluate(async (root) => {
                  const image = root.querySelector("img")
                  await image.decode()
                  const fallback = root.querySelector("[data-artifact-fallback]")
                  return {
                    id: root.id,
                    caption: root.querySelector("figcaption").textContent,
                    description: root.querySelector(".artifact-description").textContent,
                    locale: root.lang,
                    artifact: root.dataset.artifactRef,
                    profile: root.dataset.profileDigest,
                    manifest: root.dataset.manifestDigest,
                    fallback_digest: root.dataset.fallbackDigest,
                    variant: root.dataset.variantId,
                    state: root.dataset.artifactState,
                    fallback: fallback.textContent.replace(/\s+/g, " ").trim(),
                    anchors: [root.id, ...fallback.querySelectorAll("[id]")].map((node) =>
                      typeof node === "string" ? node : node.id,
                    ),
                    image: {
                      width: image.naturalWidth,
                      height: image.naturalHeight,
                      alt: image.alt,
                    },
                  }
                })
                const selection = fixture.props.receipt.blocks[0]
                assert.equal(observation.id, selection.block_id)
                assert.equal(observation.artifact, selection.artifact_ref)
                assert.equal(observation.profile, selection.profile_digest)
                assert.equal(observation.manifest, selection.manifest_digest)
                assert.equal(observation.fallback_digest, selection.fallback_digest)
                assert.equal(observation.caption, fixture.observations.caption)
                assert.equal(observation.description, fixture.observations.description)
                assert.equal(observation.locale, fixture.observations.locale)
                assert.equal(observation.variant, fixture.observations.variant_id)
                assert.equal(observation.state, fixture.observations.state)
                assert.equal(observation.image.alt, fixture.observations.description)
                assert.ok(observation.image.width > 0 && observation.image.height > 0)
                for (const text of fixture.observations.text)
                  assert.ok(observation.fallback.includes(text), text)
                for (const anchor of fixture.observations.anchors)
                  assert.ok(observation.anchors.includes(anchor), anchor)
                assert.equal(
                  await page.locator("script,button,dialog,iframe,object,embed").count(),
                  0,
                )
                if (mode !== "document" && mode !== "site") {
                  const disclosure = page.locator(".preview-diagnostics > details").first()
                  const summary = disclosure.locator(":scope > summary")
                  await summary.focus()
                  await summary.press("Space")
                  assert.equal(await disclosure.getAttribute("open"), null)
                  await summary.press("Space")
                  assert.notEqual(await disclosure.getAttribute("open"), null)
                  const anchor = page.locator(".preview-diagnostics a").first()
                  await anchor.focus()
                  await anchor.press("Enter")
                  assert.equal(
                    new URL(page.url()).hash,
                    `#${fixture.props.receipt.blocks[0].bindings[0].anchor}`,
                  )
                }
                for (const width of [1280, 360]) {
                  await page.setViewportSize({ width, height: 900 })
                  assert.ok(
                    await page.evaluate(
                      () => document.documentElement.scrollWidth <= innerWidth + 1,
                    ),
                    `${path} overflows at ${width}`,
                  )
                }
                await page.emulateMedia({ media: "print" })
                assert.ok(await figure.isVisible(), "print hides the artifact")
                assert.ok(
                  await figure.locator("[data-artifact-fallback]").isVisible(),
                  "print hides fallback",
                )
                await page.emulateMedia({ media: "screen" })
                await page.setViewportSize({ width: 1280, height: 900 })
                if (transport === "file" && fixture.id.startsWith("root-")) {
                  const filename = `${fixture.id}-${reader}-${mode}.png`
                  const image = await page.screenshot({
                    path: join(output, "artifact-screenshots", filename),
                    fullPage: true,
                  })
                  screenshots[filename] = digest(image)
                }
                surfaces[reader] = observation
                cases.push(
                  `${transport}:${fixture.id}:${reader}:${mode}:no-js,paint,anchors,keyboard,reflow,print`,
                )
              } finally {
                await page.close()
              }
            }
            assert.deepEqual(
              surfaces.svelte,
              surfaces.heex,
              `${fixture.id}:${mode} semantic parity`,
            )
          }
        }
        assert.deepEqual(outside, [], "reader attempted external network access")
      } finally {
        await context.close()
      }
    }
    const report = {
      schema_version: "phoenix-assets-artifact-reader-proof/v1",
      browser: browser.version(),
      fixture_sha256: digest(readFileSync(join(output, "artifact-fixtures.json"))),
      package_entry_sha256: digest(readFileSync(join(library, "index.js"))),
      stylesheet_sha256: digest(readFileSync(join(library, "theme.css"))),
      cases,
      screenshots,
      screenshot_review: { status: "pending" },
      limitations: [
        "Synthetic producer fixtures; no external producer meaning or geometry qualification",
        "No native application or human assistive-task observations",
        "Dependency/archive identity belongs to the calling cohort receipt",
      ],
    }
    writeFileSync(
      join(output, "artifact-reader-proof.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    )
    return report
  } finally {
    await browser?.close()
    await new Promise((done) => server.close(done))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [
    output,
    packageDirectory = join(sourceRoot, "npm/doc-shell/dist"),
    peerDirectory = join(sourceRoot, "npm/doc-shell"),
  ] = process.argv.slice(2)
  assert.ok(
    output,
    "usage: node scripts/artifact-qualification.mjs <fixture-directory> [package-dist] [peer-root]",
  )
  const result = await qualifyArtifactReaders(resolve(output), packageDirectory, peerDirectory)
  process.stdout.write(
    `Artifact readers: ${result.cases.length} cases; ${Object.keys(result.screenshots).length} screenshots pending review\n`,
  )
}
