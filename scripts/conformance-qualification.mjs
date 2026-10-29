import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Normalize actual document output, retaining admitted text, routes and names. */
async function surface(page) {
  return page.locator("[data-content-digest]").evaluate((root) => {
    const text = (element) => {
      const copy = element.cloneNode(true)
      for (const control of copy.querySelectorAll("button, script, [hidden]")) control.remove()
      const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
      const parts = []
      while (walker.nextNode()) {
        const value = walker.currentNode.textContent.replace(/\s+/g, " ").trim()
        if (value) parts.push(value)
      }
      return parts.join(" ")
    }
    const main = root.querySelector("main")
    return {
      content_digest: root.dataset.contentDigest,
      cohort_digest: root.dataset.cohortDigest,
      locale: root.lang,
      direction: root.dir,
      visible_text: text(main),
      headings: [...main.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => [
        node.tagName,
        node.id,
        text(node),
      ]),
      links: [...main.querySelectorAll("a[href]")].map((node) => [
        node.getAttribute("href"),
        text(node),
      ]),
      navigation: [...root.querySelectorAll('[aria-label="Documentation"] a')].map((node) => [
        node.getAttribute("href"),
        text(node),
        node.getAttribute("aria-current"),
      ]),
      contents: [...root.querySelectorAll('[aria-label="On this page"] a')].map((node) => [
        node.getAttribute("href"),
        text(node),
      ]),
      accessible_names: [...main.querySelectorAll("[aria-label]")].map((node) =>
        node.getAttribute("aria-label"),
      ),
      landmarks: [...root.querySelectorAll("nav,main,aside,[role=contentinfo]")].map(
        (node) => `${node.tagName}:${node.getAttribute("aria-label") ?? ""}`,
      ),
    }
  })
}

export async function qualifyConformance(browser, origin, output, hostedOrigin) {
  const site = JSON.parse(readFileSync(join(output, "browser-conformance/site.json"), "utf8"))
  const corpus = JSON.parse(readFileSync(join(output, "browser-conformance/corpus.json"), "utf8"))
  const cases = []
  const admissions = JSON.parse(
    readFileSync(join(output, "browser-conformance/admission-cases.json"), "utf8"),
  )
  const admissionPage = await browser.newPage()
  try {
    await admissionPage.goto(`${origin}/svelte/?corpus=renderer%3Ahome`)
    await admissionPage.waitForFunction(() => typeof window.admitDocPage === "function")
    for (const fixture of admissions) {
      const accepted = await admissionPage.evaluate((page) => {
        try {
          window.admitDocPage(page)
          return true
        } catch {
          return false
        }
      }, fixture.page)
      assert.equal(accepted, fixture.accept, fixture.name)
      cases.push(`extracted DocShell admission: ${fixture.name}`)
    }
  } finally {
    await admissionPage.close()
  }
  const surfaces = {}
  const offline = await browser.newContext({ javaScriptEnabled: false })
  try {
    for (const [id, source] of Object.entries(site.pages)) {
      surfaces[id] = {}
      for (const renderer of ["heex", "svelte", ...(hostedOrigin ? ["liveview"] : [])]) {
        const page = await offline.newPage()
        page.setDefaultTimeout(15_000)
        const url =
          renderer === "svelte"
            ? `${origin}/conformance-ssr/${encodeURIComponent(id)}.html`
            : renderer === "liveview"
              ? `${hostedOrigin}/conformance?page=${encodeURIComponent(id)}`
              : origin + source.route
        await page.goto(url)
        for (const role of corpus.landmarks)
          assert.ok(await page.getByRole(role).count(), `${id}/${renderer}: missing ${role}`)
        const locale = corpus.locales.find((locale) => locale.locale === source.locale)
        if (locale)
          assert.equal(
            await page.getByRole("button", { name: locale.label, exact: true }).count(),
            1,
          )
        const observed = await surface(page)
        assert.equal(observed.content_digest, source.content_digest)
        assert.equal(observed.cohort_digest, site.cohort_digest)
        surfaces[id][renderer] = observed
        if (renderer !== "heex")
          assert.deepEqual(observed, surfaces[id].heex, `${id}/${renderer}: fallback semantics`)
        cases.push(
          `${renderer}/${id}: JavaScript-disabled text, headings, links, navigation, names, locale and digests`,
        )
        await page.close()
      }
    }
  } finally {
    await offline.close()
  }
  const screenshots = join(output, "browser-screenshots")
  for (const renderer of ["heex", "svelte", ...(hostedOrigin ? ["liveview"] : [])]) {
    const context = await browser.newContext({ reducedMotion: "reduce" })
    const page = await context.newPage()
    page.setDefaultTimeout(15_000)
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    try {
      for (const [id, source] of Object.entries(site.pages)) {
        const url =
          renderer === "svelte"
            ? `${origin}/svelte/?corpus=${encodeURIComponent(id)}`
            : renderer === "liveview"
              ? `${hostedOrigin}/conformance?page=${encodeURIComponent(id)}`
              : origin + source.route
        await page.goto(url)
        await page.getByRole("heading", { name: source.title, exact: true }).waitFor()
        if (renderer === "liveview") await page.locator(".phx-connected").waitFor()
        for (const width of [320, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 })
          for (const theme of ["light", "dark"]) {
            await page
              .getByRole("button", { name: theme === "light" ? "Light" : "Dark", exact: true })
              .click()
            assert.ok(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
              `${renderer}/${id}/${width}: overflow`,
            )
            await page.evaluate(() => scrollTo(0, 0))
            await page.screenshot({
              fullPage: true,
              path: join(
                screenshots,
                `${renderer}-corpus-${id.split(":")[1]}-${width}-${theme}.png`,
              ),
            })
          }
        }
        if (id === "renderer:guide") {
          await page.getByRole("tab", { name: "First", exact: true }).focus()
          await page.keyboard.press("ArrowRight")
          assert.equal(
            await page
              .getByRole("tab", { name: "Second", exact: true })
              .getAttribute("aria-selected"),
            "true",
          )
          await page.keyboard.press("Home")
          assert.equal(
            await page
              .getByRole("tab", { name: "First", exact: true })
              .getAttribute("aria-selected"),
            "true",
          )
          await page.keyboard.press("End")
          assert.ok(await page.getByRole("tabpanel", { name: "Second", exact: true }).isVisible())
        }
        cases.push(
          `${renderer}/${id}: 320/768/1280 light/dark, reduced motion, keyboard tabs and reflow`,
        )
      }
      assert.deepEqual(errors, [], `${renderer}: corpus browser errors`)
    } finally {
      await context.close()
    }
  }
  writeFileSync(join(output, "renderer-surfaces.json"), `${JSON.stringify(surfaces, null, 2)}\n`)
  return cases
}
