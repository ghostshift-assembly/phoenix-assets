import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createServer } from "vite"
import { expect, it, vi } from "vitest"
import { poLoaderPlugin } from "../src/po-loader"

it("reloads an imported catalog outside the Vite root after an edit", async () => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "po-loader-watch-")))
  const root = path.join(directory, "assets")
  const catalog = path.join(directory, "messages.po")
  await mkdir(root)
  await writeFile(path.join(root, "main.js"), 'export { messages } from "../messages.po"')
  await writeFile(catalog, 'msgid "hello"\nmsgstr "original"\n')

  const server = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: [poLoaderPlugin()],
    server: { port: 0, hmr: false, fs: { allow: [directory] } },
  })

  try {
    await server.listen()
    await server.transformRequest("/main.js")
    const url = `/@fs/${catalog}`
    expect((await server.transformRequest(url))?.code).toContain("original")

    await vi.waitFor(() => {
      expect(server.watcher.getWatched()[directory]).toContain("messages.po")
    })

    await writeFile(catalog, 'msgid "hello"\nmsgstr "updated"\n')
    await vi.waitFor(async () => {
      const result = await server.transformRequest(url)
      expect(result?.code).toContain("updated")
      expect(result?.code).not.toContain("original")
    })
  } finally {
    await server.close()
    await rm(directory, { recursive: true, force: true })
  }
})
