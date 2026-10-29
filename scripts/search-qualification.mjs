import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/** Replays producer queries against real JSON and Pagefind browser surfaces. */
export async function qualifySearch(browser, origin, fixture, hostedOrigin) {
  const cases = []
  for (const adapter of ["json", "pagefind"]) {
    const site = JSON.parse(readFileSync(join(fixture, adapter, "site.json"), "utf8"))
    const probes = JSON.parse(readFileSync(join(fixture, adapter, "query-cases.json"), "utf8"))
    for (const renderer of ["heex", "svelte", ...(hostedOrigin ? ["liveview"] : [])]) {
      const context = await browser.newContext()
      const requested = []
      const errors = []
      const allowed = new Set([origin, hostedOrigin].filter(Boolean))
      await context.route("**/*", (route) => {
        assert.ok(allowed.has(new URL(route.request().url()).origin), "external search request")
        requested.push(route.request().url())
        return route.continue()
      })
      const page = await context.newPage()
      page.setDefaultTimeout(15_000)
      page.on("pageerror", (error) => errors.push(error.message))
      try {
        const url =
          renderer === "svelte"
            ? `${origin}/svelte/?search=${adapter}`
            : renderer === "liveview"
              ? `${hostedOrigin}/search/${adapter}`
              : `${origin}/${adapter}/en/guide/`
        await page.goto(url)
        await page.getByRole("heading", { name: "Portable guide", exact: true }).waitFor()
        if (renderer === "liveview") await page.locator(".phx-connected").waitFor()
        assert.equal(
          requested.some((url) => /\.pf_|\.pagefind|pagefind(?:-entry)?\.(?:js|json)/.test(url)),
          false,
          `${renderer}/${adapter}: search loaded before use`,
        )
        await page.getByRole("button", { name: "Search documentation", exact: true }).click()
        const disclosure = page.locator(".doc-search-filters summary")
        if (await disclosure.count()) await disclosure.click()
        const input = page.locator("[data-doc-search-input]")
        for (const probe of probes) {
          await input.fill("")
          for (const select of await page.locator("[data-doc-search-filter]").all()) {
            const name = await select.getAttribute("data-doc-search-filter")
            await select.selectOption(probe.filters[name] ?? "")
          }
          await input.fill(probe.query)
          await page.waitForFunction(
            () =>
              document
                .querySelector("[data-doc-search-results]")
                ?.getAttribute("data-doc-search-state") === "ready",
          )
          const expected = probe.ids
            .map((id) => site.search.find((record) => record.id === id).route)
            .sort()
          const routes = (
            await page
              .locator("[data-doc-search-results] a")
              .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
          ).sort()
          assert.deepEqual(routes, expected, `${renderer}/${adapter}: ${JSON.stringify(probe)}`)
          for (const excerpt of await page.locator(".doc-search-excerpt").allTextContents())
            assert.ok(Array.from(excerpt).length <= 320)
          cases.push(`${renderer}/${adapter}: ${probe.query} ${JSON.stringify(probe.filters)}`)
        }
        await input.fill("introduction")
        await page.locator("[data-doc-search-results] a").first().waitFor()
        await page.keyboard.press("ArrowDown")
        assert.ok(await input.getAttribute("aria-activedescendant"))
        await page.keyboard.press("Escape")
        assert.equal(
          await page
            .locator("[data-doc-search-open]")
            .evaluate((element) => element === document.activeElement),
          true,
        )
        if (renderer === "liveview") {
          for (const revision of [1, 2, 3]) {
            await page.getByRole("button", { name: "Refresh fixture", exact: true }).click()
            await page.locator(`#fixture-hook[data-revision="${revision}"]`).waitFor()
            await page.locator("[data-doc-search-open]").click()
            await page.locator("[data-doc-search-input]").fill("portable")
            await page.locator("[data-doc-search-results] a").first().waitFor()
            assert.equal(await page.locator("[data-doc-search-results]").count(), 1)
            await page.keyboard.press("Escape")
          }
          cases.push(`liveview/${adapter}: three DOM replacements refresh search and restore focus`)
        }
        await page.locator("[data-doc-search-open]").click()
        const finalInput = page.locator("[data-doc-search-input]")
        await finalInput.fill("introduction")
        await page.waitForFunction(
          () =>
            document
              .querySelector("[data-doc-search-results]")
              ?.getAttribute("data-doc-search-state") === "ready",
        )
        await page.locator("[data-doc-search-results] a").first().waitFor()
        await page.keyboard.press("ArrowDown")
        const destination = await page
          .locator('[data-doc-search-results] [aria-selected="true"] a')
          .getAttribute("href")
        await page.keyboard.press("Enter")
        await page.waitForURL(new URL(destination, page.url()).href)
        cases.push(`${renderer}/${adapter}: Enter follows the selected admitted route`)
        assert.deepEqual(errors, [], `${renderer}/${adapter}: browser errors`)
      } finally {
        await context.close()
      }
    }
  }
  return cases
}
