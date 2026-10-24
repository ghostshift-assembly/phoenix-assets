import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:http"
import { extname, join, resolve, sep } from "node:path"
import { chromium } from "@playwright/test"

/** Exercises the installed renderer and public producer corpus in Chromium. */
export async function qualifyBrowser(sourceRoot, root, output) {
  const fixture = join(output, "browser-static")
  assert.ok(existsSync(join(fixture, "site.json")), "extracted Hex renderer fixture is missing")
  copyFileSync(join(fixture, "site.json"), join(root, "site.json"))
  const producer = join(sourceRoot, "npm/svelte/test/fixtures/upstream-reporting")
  copyFileSync(join(producer, "envelope.json"), join(root, "envelope.json"))
  const generated = JSON.parse(readFileSync(join(output, "producer/producer-cases.json"), "utf8"))
  const samples = generated.filter(
    (fixture) => fixture.name.startsWith("kind-") || fixture.name === "scalar-values-and-null",
  )
  writeFileSync(join(root, "qualified-envelopes.json"), JSON.stringify(samples))
  writeFileSync(
    join(root, "fixture.svelte"),
    `<script>
import { SiteShell } from "@phoenix-assets/doc-shell"
import { PortableReport, decodeReportEnvelope, safeDecodeReportEnvelope } from "@phoenix-assets/svelte/reporting"
import "@phoenix-assets/doc-shell/theme.css"
import site from "./site.json"
import envelope from "./envelope.json"
import samples from "./qualified-envelopes.json"
window.decodeProducerCase = safeDecodeReportEnvelope
</script>
<SiteShell {site} pageId="anchors:guide" />
<section class="doc-shell" aria-label="Portable reporting"><PortableReport envelope={decodeReportEnvelope(envelope)} /></section>
{#each samples as sample}<section class="doc-shell" aria-label={sample.name}><PortableReport envelope={decodeReportEnvelope(sample.value)} /></section>{/each}
`,
  )
  writeFileSync(
    join(root, "index.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><script type="module" src="/fixture.js"></script></body></html>',
  )
  writeFileSync(
    join(root, "fixture.js"),
    'import { mount } from "svelte"; import Fixture from "./fixture.svelte"; mount(Fixture, { target: document.body });\n',
  )
  writeFileSync(
    join(root, "vite.config.mjs"),
    'import { svelte } from "@sveltejs/vite-plugin-svelte"; export default { plugins: [svelte()], build: { outDir: "browser-dist" } };\n',
  )
  execFileSync(join(root, "node_modules/.bin/vite"), ["build"], { cwd: root, stdio: "inherit" })
  const application = join(root, "browser-dist")
  writeFileSync(
    join(root, "ssrfixture.svelte"),
    '<script>import { SiteShell } from "@phoenix-assets/doc-shell"; import site from "./site.json"; let { pageId = "anchors:guide" } = $props();</script><SiteShell {site} {pageId} />',
  )
  writeFileSync(
    join(root, "ssr.config.mjs"),
    'import { svelte } from "@sveltejs/vite-plugin-svelte"; export default { plugins: [svelte()], ssr: { noExternal: ["@phoenix-assets/doc-shell"] }, build: { ssr: "ssrfixture.svelte", outDir: "ssr-dist" } };',
  )
  execFileSync(join(root, "node_modules/.bin/vite"), ["build", "--config", "ssr.config.mjs"], {
    cwd: root,
    stdio: "inherit",
  })
  const css = readdirSync(join(application, "assets")).filter((file) => file.endsWith(".css"))
  writeFileSync(
    join(root, "render-ssr.mjs"),
    `import { render } from "svelte/server"; import Fixture from "./ssr-dist/ssrfixture.js"; import { writeFileSync } from "node:fs"; const result = render(Fixture); writeFileSync("browser-dist/ssr.html", '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' + ${JSON.stringify(css.map((file) => `<link rel="stylesheet" href="/assets/${file}">`).join(""))} + result.head + '</head><body style="margin:0">' + result.body + '</body></html>'); const missing = render(Fixture, { props: { pageId: "missing" } }); writeFileSync("browser-dist/ssr404.html", '<!doctype html><html><body>' + missing.body + '</body></html>');`,
  )
  execFileSync("node", ["render-ssr.mjs"], { cwd: root, stdio: "inherit" })
  const screenshots = join(output, "browser-screenshots")
  mkdirSync(screenshots, { recursive: true })
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname)
    const base = path.startsWith("/svelte/") ? application : fixture
    let file = resolve(base, `.${path.startsWith("/svelte/") ? path.slice(7) : path}`)
    if (path.startsWith("/svelte/assets/")) file = resolve(application, `.${path.slice(7)}`)
    // Vite's own hashed assets use /assets; static exporter names do not collide.
    if (path.startsWith("/assets/") && existsSync(resolve(application, `.${path}`)))
      file = resolve(application, `.${path}`)
    if (path === "/svelte-ssr/") file = join(application, "ssr.html")
    if (path === "/svelte-ssr-404/") file = join(application, "ssr404.html")
    const allowed = [application, fixture].some(
      (directory) => file === directory || file.startsWith(directory + sep),
    )
    if (!allowed || !existsSync(file)) {
      response.writeHead(404).end()
      return
    }
    if (statSync(file).isDirectory()) file = join(file, "index.html")
    if (!existsSync(file)) {
      response.writeHead(404).end()
      return
    }
    response.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
      }[extname(file)] ?? "application/octet-stream",
    )
    response.end(readFileSync(file))
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  const origin = `http://127.0.0.1:${server.address().port}`
  let browser
  const cases = []
  try {
    browser = await chromium.launch({ headless: true })
    for (const renderer of ["heex", "svelte"]) {
      const path = renderer === "heex" ? "/docs/guide/" : "/svelte/"
      const context = await browser.newContext({
        reducedMotion: "reduce",
        locale: "en-US",
        timezoneId: "UTC",
      })
      const external = []
      await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin !== origin) {
          external.push(route.request().url())
          return route.abort()
        }
        return route.continue()
      })
      const page = await context.newPage()
      const errors = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto(origin + path)
      await page.getByRole("heading", { name: "Projected anchors", exact: true }).waitFor()
      assert.deepEqual(await page.locator("[data-pa-doc-shell] article h2").allTextContents(), [
        "2026 Setup",
        "中文",
        "中文",
        "Supplied anchor",
      ])
      if (renderer === "heex") {
        await page.getByRole("button", { name: "Highlight code", exact: true }).click()
        await page.locator("[data-doc-code] .shiki").waitFor()
        await page.getByRole("button", { name: "Render diagram", exact: true }).click()
        await page.locator("[data-doc-mermaid] svg").waitFor()
      } else {
        await page.locator(".code-block .shiki").waitFor()
        await page.locator("[data-testid=mermaid-diagram] svg").waitFor()
      }
      cases.push(`${renderer}: packaged lazy highlighting and Mermaid, retained source`)
      for (const width of [320, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        for (const theme of ["light", "dark", "contrast"]) {
          await page
            .getByRole("button", {
              name:
                theme === "contrast" ? "High contrast" : theme[0].toUpperCase() + theme.slice(1),
              exact: true,
            })
            .click()
          assert.equal(
            await page.locator("[data-pa-doc-shell]").last().getAttribute("data-doc-theme"),
            theme,
          )
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
            `${renderer} overflows at ${width}/${theme}`,
          )
          await page.evaluate(() => scrollTo(0, 0))
          await page.screenshot({ path: join(screenshots, `${renderer}-${width}-${theme}.png`) })
        }
      }
      await page.setViewportSize({ width: 320, height: 900 })
      await page.getByRole("button", { name: "Browse documentation", exact: true }).click()
      assert.equal(
        await page
          .getByRole("button", { name: "Browse documentation", exact: true })
          .getAttribute("aria-expanded"),
        "true",
      )
      await page.getByRole("button", { name: "Search documentation", exact: true }).click()
      const input = page.locator("[data-doc-search-input]")
      await input.fill("setup")
      await page.locator("[data-doc-search-results] a").first().waitFor()
      assert.equal(await input.evaluate((element) => element === document.activeElement), true)
      await page.keyboard.press("Escape")
      assert.equal(
        await page
          .getByRole("button", { name: "Search documentation", exact: true })
          .evaluate((element) => element === document.activeElement),
        true,
      )
      await page
        .locator("[data-pa-doc-shell]")
        .last()
        .evaluate((element) => {
          element.dir = "rtl"
        })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.setViewportSize({ width: 320, height: 225 })
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${renderer} overflows in the 400% zoom-equivalent viewport`,
      )
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.emulateMedia({ colorScheme: "dark" })
      await page.getByRole("button", { name: "System", exact: true }).click()
      assert.equal(
        await page
          .locator("[data-pa-doc-shell]")
          .last()
          .evaluate((element) => getComputedStyle(element).backgroundColor),
        "rgb(16, 24, 39)",
      )
      assert.deepEqual(external, [], `${renderer} requested an external asset`)
      assert.deepEqual(errors, [], `${renderer} browser errors`)
      cases.push(
        `${renderer}: headings, local assets, 320/768/1280, light/dark/contrast, reduced motion, 400% zoom-equivalent viewport, mobile navigation, native search focus, RTL`,
      )
      await context.close()
    }
    const offline = await browser.newContext({ javaScriptEnabled: false })
    for (const path of ["/docs/guide/", "/svelte-ssr/"]) {
      const page = await offline.newPage()
      await page.goto(origin + path)
      assert.equal(
        await page.getByRole("heading", { name: "Projected anchors", exact: true }).count(),
        1,
      )
      assert.ok(
        await page.getByRole("navigation", { name: "Documentation", exact: true }).isVisible(),
      )
      cases.push(`${path}: JavaScript-disabled article, navigation, TOC and ordinary links`)
      await page.close()
    }
    const missing = await offline.newPage()
    await missing.goto(`${origin}/svelte-ssr-404/`)
    const home = missing.getByRole("link", { name: "Documentation home", exact: true })
    assert.equal(await home.getAttribute("href"), "/docs/guide/")
    await home.click()
    await missing.getByRole("heading", { name: "Projected anchors", exact: true }).waitFor()
    cases.push("svelte: JavaScript-disabled 404 follows an admitted documentation route")
    await missing.close()
    await offline.close()
    const page2 = await browser.newPage()
    await page2.goto(`${origin}/svelte/`)
    await page2.waitForFunction(() => typeof window.decodeProducerCase === "function")
    const fixtures = generated
    for (const fixture of fixtures) {
      const accepted = await page2.evaluate((fixture) => {
        const value = fixture.value
        return window.decodeProducerCase(value).state === "ready"
      }, fixture)
      assert.equal(accepted, fixture.accept, fixture.name)
      cases.push(`extracted reporting decoder: ${fixture.name}`)
    }
    for (const sample of samples) {
      const region = page2.getByRole("region", { name: sample.name, exact: true })
      const toggle = region.getByRole("button", { name: "View as table", exact: true })
      if (await toggle.count()) await toggle.click()
      assert.ok(
        (await region.getByRole("table").count()) > 0,
        `${sample.name} has no table alternative`,
      )
    }
    assert.ok(
      (await page2.getByRole("table").count()) > 0,
      "reporting table alternatives are missing",
    )
    await page2.close()
    return {
      browser: browser.version(),
      cases,
      screenshot_directory: "browser-screenshots",
      screenshot_review: { status: "pending" },
      screenshots: Object.fromEntries(
        readdirSync(screenshots).map((file) => [
          file,
          createHash("sha256")
            .update(readFileSync(join(screenshots, file)))
            .digest("hex"),
        ]),
      ),
    }
  } finally {
    await browser?.close()
    await new Promise((done) => server.close(done))
  }
}
