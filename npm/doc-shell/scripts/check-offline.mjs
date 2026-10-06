import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { hasNetworkAssetReference } from "./network-assets.mjs"

const files = []
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else files.push(path)
  }
}
await walk(fileURLToPath(new URL("../src", import.meta.url)))
for (const file of files) {
  const source = await readFile(file, "utf8")
  if (hasNetworkAssetReference(source)) throw new Error(`Network asset reference in ${file}`)
}
