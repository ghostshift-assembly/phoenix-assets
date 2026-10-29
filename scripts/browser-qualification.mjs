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
import { qualifyConformance } from "./conformance-qualification.mjs"
import { startHosted } from "./hosted-qualification.mjs"
import { qualifySearch } from "./search-qualification.mjs"

/** Exercises the installed renderer and public producer corpus in Chromium. */
export async function qualifyBrowser(sourceRoot, root, output, hostedConsumer) {
  const fixture = join(output, "browser-static")
  const searchFixture = join(output, "browser-search")
  const conformanceFixture = join(output, "browser-conformance")
  assert.ok(existsSync(join(fixture, "site.json")), "extracted Hex renderer fixture is missing")
  copyFileSync(join(fixture, "site.json"), join(root, "site.json"))
  copyFileSync(join(conformanceFixture, "site.json"), join(root, "corpus-site.json"))
  copyFileSync(join(conformanceFixture, "admission-cases.json"), join(root, "admission-cases.json"))
  writeFileSync(
    join(root, "search-fixtures.json"),
    JSON.stringify(
      Object.fromEntries(
        ["json", "pagefind"].map((adapter) => [
          adapter,
          {
            site: JSON.parse(readFileSync(join(searchFixture, adapter, "site.json"), "utf8")),
            contract: JSON.parse(
              readFileSync(join(searchFixture, adapter, "search-contract.json"), "utf8"),
            ),
          },
        ]),
      ),
    ),
  )
  copyFileSync(join(sourceRoot, "npm/doc-shell/test/fixtures/openapi.json"), join(root, "api.json"))
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
import { SiteShell, ApiReference, admitPage } from "@phoenix-assets/doc-shell"
import { PortableReport, decodeReportEnvelope, safeDecodeReportEnvelope } from "@phoenix-assets/svelte/reporting"
import "@phoenix-assets/doc-shell/theme.css"
import site from "./site.json"
import searchFixtures from "./search-fixtures.json"
import corpusSite from "./corpus-site.json"
import api from "./api.json"
import envelope from "./envelope.json"
import samples from "./qualified-envelopes.json"
window.decodeProducerCase = safeDecodeReportEnvelope
window.admitDocPage = admitPage
const pageId = new URLSearchParams(window.location.search).get("page") ?? "anchors:guide"
const apiPage = new URLSearchParams(window.location.search).has("api")
const searchFixture = searchFixtures[new URLSearchParams(window.location.search).get("search")]
const corpusPage = new URLSearchParams(window.location.search).get("corpus")
</script>
{#if apiPage}<div class="doc-shell" data-pa-doc-shell style="min-height:100dvh;padding:1rem"><main style="max-width:70rem;margin:auto"><h1>API reference</h1><ApiReference spec={api} /></main></div>{:else}
<SiteShell site={corpusPage ? corpusSite : searchFixture?.site ?? site} pageId={corpusPage ?? (searchFixture ? "guides:english" : pageId)} searchContract={searchFixture?.contract.algorithm === "pagefind/v1" ? searchFixture.contract : undefined} />
{#if !corpusPage && !searchFixture && pageId === "anchors:guide"}
<section class="doc-shell" aria-label="Portable reporting"><PortableReport envelope={decodeReportEnvelope(envelope)} /></section>
{#each samples as sample}<section class="doc-shell" aria-label={sample.name}><PortableReport envelope={decodeReportEnvelope(sample.value)} /></section>{/each}
{/if}
{/if}
`,
  )
  writeFileSync(
    join(root, "index.html"),
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><script type="module" src="/fixture.js"></script></body></html>',
  )
  writeFileSync(
    join(root, "fixture.js"),
    'import { mount } from "svelte"; import Fixture from "./fixture.svelte"; mount(Fixture, { target: document.body });\n',
  )
  writeFileSync(
    join(root, "vite.config.mjs"),
    'import { svelte } from "@sveltejs/vite-plugin-svelte"; export default { plugins: [svelte()], build: { outDir: "browser-dist", rollupOptions: { input: { index: "index.html", live: "live-client.js" }, external: ["/phoenix/phoenix.mjs", "/live/phoenix_live_view.esm.js"] } } };\n',
  )
  writeFileSync(
    join(root, "live-client.js"),
    'import { Socket } from "/phoenix/phoenix.mjs"; import { LiveSocket } from "/live/phoenix_live_view.esm.js"; import { PhoenixAssetsDocShell } from "@phoenix-assets/doc-shell/browser"; const socket = new LiveSocket("/live", Socket, { hooks: { PhoenixAssetsDocShell }, params: { _csrf_token: document.querySelector("meta[name=csrf-token]").content } }); socket.connect(); window.fixtureSocket = socket;',
  )
  execFileSync(join(root, "node_modules/.bin/vite"), ["build"], { cwd: root, stdio: "inherit" })
  const application = join(root, "browser-dist")
  writeFileSync(
    join(root, "ssrfixture.svelte"),
    '<script>import { SiteShell, ApiReference } from "@phoenix-assets/doc-shell"; import site from "./site.json"; import corpusSite from "./corpus-site.json"; import spec from "./api.json"; let { pageId = "anchors:guide", api = false, corpus = false, siteOverride = null } = $props();</script>{#if api}<div class="doc-shell" data-pa-doc-shell style="min-height:100dvh;padding:1rem"><main style="max-width:70rem;margin:auto"><h1>API reference</h1><ApiReference {spec} /></main></div>{:else}<SiteShell site={siteOverride ?? (corpus ? corpusSite : site)} {pageId} />{/if}',
  )
  // Context helpers and the server renderer must share the installed Svelte peer.
  writeFileSync(
    join(root, "ssr.config.mjs"),
    'import { svelte } from "@sveltejs/vite-plugin-svelte"; export default { plugins: [svelte()], ssr: { noExternal: ["@phoenix-assets/doc-shell"] }, build: { ssr: "ssrfixture.svelte", outDir: "ssr-dist", rollupOptions: { external: (id) => id === "svelte" || id.startsWith("svelte/") } } };',
  )
  execFileSync(join(root, "node_modules/.bin/vite"), ["build", "--config", "ssr.config.mjs"], {
    cwd: root,
    stdio: "inherit",
  })
  const css = readdirSync(join(application, "assets")).filter((file) => file.endsWith(".css"))
  writeFileSync(
    join(root, "render-ssr.mjs"),
    `import { render } from "svelte/server"; import Fixture from "./ssr-dist/ssrfixture.js"; import { writeFileSync } from "node:fs"; const html = (result) => '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + ${JSON.stringify(css.map((file) => `<link rel="stylesheet" href="/assets/${file}">`).join(""))} + result.head + '</head><body style="margin:0">' + result.body + '</body></html>'; writeFileSync("browser-dist/ssr.html", html(render(Fixture))); writeFileSync("browser-dist/ssr404.html", html(render(Fixture, { props: { pageId: "missing" } }))); writeFileSync("browser-dist/api-ssr.html", html(render(Fixture, { props: { api: true } })));`,
  )
  execFileSync("node", ["render-ssr.mjs"], { cwd: root, stdio: "inherit" })
  writeFileSync(
    join(root, "render-corpus.mjs"),
    `import { render } from "svelte/server"; import Fixture from "./ssr-dist/ssrfixture.js"; import site from "./corpus-site.json" with { type: "json" }; import { mkdirSync, writeFileSync } from "node:fs"; mkdirSync("browser-dist/conformance-ssr", { recursive: true }); for (const pageId of Object.keys(site.pages)) { const result = render(Fixture, { props: { pageId, corpus: true } }); writeFileSync("browser-dist/conformance-ssr/" + pageId + ".html", '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + ${JSON.stringify(css.map((file) => `<link rel="stylesheet" href="/assets/${file}">`).join(""))} + '</head><body style="margin:0">' + result.body + '</body></html>'); }`,
  )
  execFileSync("node", ["render-corpus.mjs"], { cwd: root, stdio: "inherit" })
  writeFileSync(
    join(root, "check-admission.mjs"),
    `import assert from "node:assert/strict"; import { render } from "svelte/server"; import Fixture from "./ssr-dist/ssrfixture.js"; import site from "./corpus-site.json" with { type: "json" }; import cases from "./admission-cases.json" with { type: "json" }; import { writeFileSync } from "node:fs"; const results = cases.map((fixture) => { let accepted = true; try { render(Fixture, { props: { pageId: "candidate", siteOverride: { ...site, pages: { candidate: fixture.page } } } }).body; } catch { accepted = false; } assert.equal(accepted, fixture.accept, fixture.name); return { name: fixture.name, accepted }; }); writeFileSync("browser-dist/ssr-admission-results.json", JSON.stringify(results));`,
  )
  execFileSync("node", ["check-admission.mjs"], { cwd: root, stdio: "inherit" })
  const screenshots = join(output, "browser-screenshots")
  mkdirSync(screenshots, { recursive: true })
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname)
    const adapter = ["json", "pagefind"].find((adapter) => path.startsWith(`/${adapter}/`))
    const base = path.startsWith("/conformance-ssr/")
      ? application
      : path.startsWith("/conformance/")
        ? conformanceFixture
        : adapter
          ? join(searchFixture, adapter)
          : path.startsWith("/svelte/")
            ? application
            : fixture
    let file = resolve(base, `.${path.startsWith("/svelte/") ? path.slice(7) : path}`)
    if (path.startsWith("/svelte/assets/")) file = resolve(application, `.${path.slice(7)}`)
    // Vite's own hashed assets use /assets; static exporter names do not collide.
    if (path.startsWith("/assets/") && existsSync(resolve(application, `.${path}`)))
      file = resolve(application, `.${path}`)
    if (path === "/svelte-ssr/") file = join(application, "ssr.html")
    if (path === "/svelte-ssr-404/") file = join(application, "ssr404.html")
    if (path === "/svelte-api-ssr/") file = join(application, "api-ssr.html")
    const allowed = [application, fixture, searchFixture, conformanceFixture].some(
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
  let hosted
  const cases = []
  try {
    browser = await chromium.launch({ headless: true })
    if (hostedConsumer) hosted = await startHosted(sourceRoot, hostedConsumer, output, application)
    cases.push(...(await qualifySearch(browser, origin, searchFixture, hosted?.origin)))
    cases.push(...(await qualifyConformance(browser, origin, output, hosted?.origin)))
    if (hostedConsumer) {
      execFileSync(
        "mix",
        [
          "run",
          "--no-start",
          join(sourceRoot, "scripts/compare-surfaces.exs"),
          join(output, "renderer-surfaces.json"),
        ],
        { cwd: hostedConsumer.consumer, env: hostedConsumer.env, stdio: "inherit" },
      )
      cases.push("DocShell public semantic-surface validation and hosted/static comparison")
    }
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
      const navigation = page.getByRole("dialog", { name: "Documentation navigation", exact: true })
      await navigation.waitFor()
      assert.equal(await navigation.evaluate((element) => element.matches(":modal")), true)
      const focusBefore = await navigation.evaluate((element) => ({
        inside: element.contains(document.activeElement),
        tag: document.activeElement?.tagName,
        close: document.activeElement?.hasAttribute("data-doc-nav-close"),
      }))
      await page.keyboard.press("Shift+Tab")
      const focusAfter = await navigation.evaluate((element) => ({
        inside: element.contains(document.activeElement),
        tag: document.activeElement?.tagName,
      }))
      assert.equal(
        focusAfter.inside,
        true,
        `${renderer}: navigation focus ${JSON.stringify({ focusBefore, focusAfter })}`,
      )
      await page.keyboard.press("Escape")
      assert.equal(
        await page
          .getByRole("button", { name: "Browse documentation", exact: true })
          .evaluate((element) => element === document.activeElement),
        true,
      )
      for (const theme of ["light", "dark"]) {
        await page
          .getByRole("button", { name: theme === "light" ? "Light" : "Dark", exact: true })
          .click()
        await page.getByRole("button", { name: "Browse documentation", exact: true }).click()
        await page.screenshot({
          path: join(screenshots, `${renderer}-mobile-navigation-${theme}.png`),
        })
        await page.keyboard.press("Escape")
      }
      await page.getByRole("button", { name: "Browse documentation", exact: true }).click()
      await page.keyboard.press("Control+k")
      assert.equal(
        await page.locator("dialog[data-doc-nav]").evaluate((element) => element.matches(":modal")),
        false,
      )
      const input = page.locator("[data-doc-search-input]")
      await input.waitFor()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Shift+Tab")
      assert.equal(
        await page
          .locator("[data-doc-search-dialog]")
          .evaluate((element) => element.contains(document.activeElement)),
        true,
        `${renderer}: search focus left its modal`,
      )
      await input.focus()
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
      for (const theme of ["light", "dark"]) {
        await page
          .getByRole("button", { name: theme === "light" ? "Light" : "Dark", exact: true })
          .click()
        await page.getByRole("button", { name: "Search documentation", exact: true }).click()
        await input.fill("setup")
        await page.locator("[data-doc-search-results] a").first().waitFor()
        await page.screenshot({ path: join(screenshots, `${renderer}-search-${theme}.png`) })
        await page.keyboard.press("Escape")
      }
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
        `${renderer}: headings, local assets, 320/768/1280, light/dark/contrast, reduced motion, 400% zoom-equivalent viewport, native modal navigation, shortcut handoff, search focus, RTL`,
      )
      await page.goto(origin + (renderer === "heex" ? "/404.html" : "/svelte/?page=missing"))
      await page.getByRole("heading", { name: "Page not found", exact: true }).waitFor()
      assert.equal(
        await page
          .getByRole("link", { name: "Documentation home", exact: true })
          .getAttribute("href"),
        "/docs/guide/",
      )
      assert.equal(
        await page.getByRole("button", { name: "Search documentation", exact: true }).count(),
        1,
      )
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        for (const theme of ["light", "dark"]) {
          await page
            .getByRole("button", { name: theme === "light" ? "Light" : "Dark", exact: true })
            .click()
          assert.ok(
            await page
              .locator("[data-pa-doc-shell]")
              .first()
              .evaluate((element) => element.getBoundingClientRect().height >= innerHeight),
            `${renderer}: short-page canvas does not fill the viewport`,
          )
          await page.screenshot({
            path: join(screenshots, `${renderer}-404-${width}-${theme}.png`),
          })
        }
      }
      assert.deepEqual(errors, [], `${renderer} 404 browser errors`)
      cases.push(`${renderer}: 404 keeps admitted home, navigation, search and theme controls`)
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
    for (const path of ["/svelte-ssr-404/", "/404.html"]) {
      const missing = await offline.newPage()
      await missing.goto(origin + path)
      const home = missing.getByRole("link", { name: "Documentation home", exact: true })
      assert.equal(await home.getAttribute("href"), "/docs/guide/")
      await home.click()
      await missing.getByRole("heading", { name: "Projected anchors", exact: true }).waitFor()
      cases.push(`${path}: JavaScript-disabled 404 follows an admitted documentation route`)
      await missing.close()
    }
    for (const path of ["/api.html", "/svelte-api-ssr/"]) {
      const page = await offline.newPage()
      await page.goto(origin + path)
      for (const name of ["Health check", "List things", "Create thing"])
        assert.ok(await page.getByRole("heading", { name, exact: true }).isVisible())
      assert.equal(
        await page.getByRole("navigation", { name: "API operations" }).getByRole("link").count(),
        3,
      )
      await page.getByText("Complete admitted OpenAPI JSON", { exact: true }).click()
      assert.ok(await page.getByText(/queryThings/).isVisible())
      cases.push(
        `${path}: JavaScript-disabled API descriptions, operation links and unknown-field JSON`,
      )
      await page.close()
    }
    const native = await offline.newPage()
    await native.goto(`${origin}/api-enabled.html`)
    assert.equal(await native.getByLabel("Bearer token").count(), 3)
    assert.ok(await native.getByLabel("Bearer token").first().isDisabled())
    await native.evaluate(() => {
      const form = document.querySelector("form")
      form.querySelector('[name="token"]').value = "SYNTHETIC_NATIVE_SECRET"
      form.querySelector("fieldset").disabled = false
      form.submit()
    })
    await native.waitForLoadState("networkidle")
    assert.equal(native.url(), `${origin}/api-enabled.html`)
    cases.push(
      "heex: native API submission is inert without JavaScript and cannot place tokens in a URL",
    )
    await native.close()
    await offline.close()

    for (const renderer of ["heex", "svelte"]) {
      const context = await browser.newContext({ reducedMotion: "reduce" })
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
      const path = renderer === "heex" ? "/api.html" : "/svelte/?api=1"
      await page.goto(origin + path)
      for (const name of ["Health check", "List things", "Create thing"])
        await page.getByRole("heading", { name, exact: true }).waitFor()
      const links = page.getByRole("navigation", { name: "API operations" }).getByRole("link")
      assert.deepEqual(
        (await links.allTextContents()).map((text) => text.replace(/\s+/g, " ").trim()),
        ["HEAD /health", "GET /things", "POST /things"],
      )
      for (const link of await links.all()) {
        const href = await link.getAttribute("href")
        assert.ok(await page.evaluate((id) => Boolean(document.getElementById(id)), href.slice(1)))
      }
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        for (const theme of ["light", "dark"]) {
          await page.evaluate((theme) => {
            localStorage.setItem("phoenix-assets:doc-shell:theme", theme)
            for (const root of document.querySelectorAll("[data-pa-doc-shell]")) {
              root.dataset.docTheme = theme
              root.dataset.paTheme = theme
            }
            scrollTo(0, 0)
          }, theme)
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            `${renderer} API overflows at ${width}/${theme}`,
          )
          await page.screenshot({
            path: join(screenshots, `${renderer}-api-${width}-${theme}.png`),
            fullPage: true,
          })
        }
      }
      cases.push(
        `${renderer}: all API operations have visible descriptions, unique native anchors and responsive themes`,
      )
      assert.deepEqual(errors, [])
      assert.deepEqual(external, [])
      await context.close()
    }
    const requests = await browser.newPage()
    await requests.goto(`${origin}/api-enabled.html`)
    await requests.locator("[data-doc-api-controls]").first().waitFor()
    await requests.waitForFunction(
      () => !document.querySelector("[data-doc-api-controls]").disabled,
    )
    cases.push("heex: packaged browser controller enables admitted API controls")
    await requests.close()
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
    await hosted?.stop()
    await new Promise((done) => server.close(done))
  }
}
