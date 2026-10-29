import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createServer } from "vite"
import { expect, it, vi } from "vitest"
import { phoenixAssets } from "../src/plugin"

it("boots with missing contracts and loads them after the first generation", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pa-generated-boot-")))
  await writeFile(
    path.join(root, "main.js"),
    'export { routes } from "$phoenix/routes"; export { sessionRoute } from "$phoenix/session"',
  )
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: phoenixAssets(),
    server: { port: 0, hmr: false },
  })

  try {
    await server.listen()
    const initial = await server.ssrLoadModule("/main.js")
    expect(initial.routes).toEqual({})
    expect(initial.sessionRoute).toBeNull()
    const send = vi.spyOn(server.ws, "send")
    const generated = path.join(root, "src/lib/generated")
    await mkdir(generated, { recursive: true })
    await writeFile(
      path.join(generated, "routes.ts"),
      'export const routes = { health: () => "/api/health" } as const\n',
    )
    await writeFile(
      path.join(generated, "session.ts"),
      'export const sessionRoute = "/api/session"\n',
    )
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledWith({ type: "full-reload" })
    })
    await vi.waitFor(async () => {
      const updated = await server.ssrLoadModule("/main.js")
      expect(updated.routes.health()).toBe("/api/health")
      expect(updated.sessionRoute).toBe("/api/session")
    })
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  { directory: "src/lib/generated", options: {} },
  { directory: "contracts", options: { generatedDir: "contracts" } },
])("loads and reloads generated contracts from $directory", async ({ directory, options }) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pa-generated-watch-")))
  const generated = path.join(root, directory)
  await mkdir(generated, { recursive: true })
  await writeFile(path.join(root, "main.js"), 'export { routes } from "$phoenix/routes"')
  const contract = path.join(generated, "routes.ts")
  await writeFile(contract, 'export const routes = { health: () => "/api/health" } as const\n')
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: phoenixAssets(options),
    server: { port: 0, hmr: false },
  })

  try {
    await server.listen()
    const initial = await server.ssrLoadModule("/main.js")
    expect(initial.routes.health()).toBe("/api/health")
    await vi.waitFor(() => {
      expect(server.watcher.getWatched()[generated]).toContain("routes.ts")
    })
    const send = vi.spyOn(server.ws, "send")
    await writeFile(contract, 'export const routes = { health: () => "/api/ready" } as const\n')
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledWith({ type: "full-reload" })
    })
    const updated = await server.ssrLoadModule("/main.js")
    expect(updated.routes.health()).toBe("/api/ready")
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
