import assert from "node:assert/strict"

/** Check rendered text and keyboard focus against the colors Chromium paints. */
export async function assertShellContrast(page, label) {
  const result = await page
    .locator("[data-pa-doc-shell]")
    .last()
    .evaluate((root) => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const context = canvas.getContext("2d", { willReadFrequently: true })
      const rgba = (color) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
        return [r / 255, g / 255, b / 255, a / 255]
      }
      const over = (front, back) =>
        [0, 1, 2].map((index) => front[index] * front[3] + back[index] * (1 - front[3]))
      const background = (element) => {
        const layers = []
        for (let node = element; node; node = node.parentElement)
          layers.push(rgba(getComputedStyle(node).backgroundColor))
        return layers.reverse().reduce((back, front) => over(front, back), [1, 1, 1])
      }
      const luminance = (color) =>
        color
          .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      const ratio = (a, b) => {
        const x = luminance(a),
          y = luminance(b)
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const failures = []
      let checked = 0
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const element = node.parentElement
        if (
          !node.textContent.trim() ||
          !element ||
          element.closest("script, style, svg, button:disabled, input:disabled, select:disabled")
        )
          continue
        const style = getComputedStyle(element)
        if (!element.getClientRects().length || style.visibility !== "visible") continue
        const back = background(element)
        const contrast = ratio(over(rgba(style.color), back), back)
        const large =
          parseFloat(style.fontSize) >= 24 ||
          (parseFloat(style.fontSize) >= 18.666 && parseInt(style.fontWeight, 10) >= 700)
        checked++
        if (contrast + 0.01 < (large ? 3 : 4.5))
          failures.push({
            text: node.textContent.trim().slice(0, 60),
            contrast: Number(contrast.toFixed(2)),
            foreground: style.color,
            background: back,
          })
      }
      return { checked, failures }
    })
  assert.ok(result.checked > 0, `${label}: no rendered text checked`)
  assert.deepEqual(result.failures, [], `${label}: rendered text contrast`)
  const control = page.locator("[data-pa-doc-shell] button:visible").first()
  if (await control.count()) {
    await control.focus()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Shift+Tab")
    const focus = await control.evaluate((element) => {
      const style = getComputedStyle(element)
      const luminance = (color) =>
        color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((channel) => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      const foreground = luminance(style.outlineColor)
      const background = luminance(
        getComputedStyle(element.closest("[data-pa-doc-shell]")).backgroundColor,
      )
      return {
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        contrast:
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      }
    })
    assert.ok(
      focus.width >= 2 && focus.style !== "none" && focus.contrast >= 3,
      `${label}: visible keyboard focus`,
    )
    await control.evaluate((element) => element.blur())
  }
}
