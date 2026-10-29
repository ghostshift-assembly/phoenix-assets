import { spawn } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"

/** Keep the extracted Hex consumer alive only for connected browser assertions. */
export async function startHosted(sourceRoot, consumer, output, client) {
  const ready = join(consumer.root, "hosted-ready.json")
  rmSync(ready, { force: true })
  const child = spawn(
    "mix",
    ["run", join(sourceRoot, "scripts/hosted-renderer-fixture.exs"), output, client, ready],
    {
      cwd: consumer.consumer,
      env: consumer.env,
      stdio: "inherit",
      detached: process.platform !== "win32",
    },
  )
  let exited = false
  const exit = new Promise((done) =>
    child.once("exit", () => {
      exited = true
      done()
    }),
  )
  const stop = async () => {
    if (exited) return
    const kill = (signal) =>
      process.platform === "win32" ? child.kill(signal) : process.kill(-child.pid, signal)
    kill("SIGTERM")
    await Promise.race([exit, new Promise((done) => setTimeout(done, 5000))])
    if (!exited) {
      kill("SIGKILL")
      await exit
    }
  }
  try {
    const deadline = Date.now() + 30_000
    while (!existsSync(ready)) {
      if (exited || Date.now() > deadline) throw new Error("Hosted renderer failed to start")
      await new Promise((done) => setTimeout(done, 100))
    }
    return { origin: JSON.parse(readFileSync(ready, "utf8")).origin, stop }
  } catch (error) {
    await stop()
    throw error
  }
}
