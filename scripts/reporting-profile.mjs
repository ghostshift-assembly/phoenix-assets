import { createHash } from "node:crypto"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const directory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../npm/svelte/test/fixtures/upstream-reporting",
)

export const reportingProfile = () => {
  const source = readFileSync(join(directory, "validator.ex"), "utf8")
  const presentation = readFileSync(join(directory, "presentation.ex"), "utf8")
  const grammar = Object.fromEntries(
    [...source.matchAll(/@(\w+)\s+~w\(([^)]+)\)/g)].map(([, name, words]) => [
      name,
      words.trim().split(/\s+/),
    ]),
  )
  const limits = Object.fromEntries(
    [...source.match(/@default_limits\s+%\{([^}]+)\}/s)[1].matchAll(/(\w+):\s*([\d_]+)/g)].map(
      ([, name, value]) => [name, Number(value.replaceAll("_", ""))],
    ),
  )
  limits.max_bytes = Number(presentation.match(/@max_json_bytes\s+([\d_]+)/)[1].replaceAll("_", ""))
  const encodings = Object.fromEntries(
    [
      ...source
        .match(/@required_encodings\s+%\{([^}]+)\}/s)[1]
        .matchAll(/(\w+):\s*(?:~w\(([^)]+)\)|(\[\]))/g),
    ].map(([, kind, values]) => [kind, values?.trim().split(/\s+/) ?? []]),
  )
  return {
    required_encodings: encodings,
    schema_version: "phoenix-assets/producer-source-profile/v1",
    repository: "https://github.com/refpath/refpath",
    revision: "dd5c55e1f6a436fc845756e955d6302f78bba50d",
    verification:
      "Public producer source and corpus snapshot; source-derived grammar. Producer execution is recorded separately by qualification.",
    sources: Object.fromEntries(
      readdirSync(directory)
        .filter((file) => file.endsWith(".ex") || ["envelope.json", "cases.json"].includes(file))
        .sort()
        .map((file) => [
          file,
          createHash("sha256")
            .update(readFileSync(join(directory, file)))
            .digest("hex"),
        ]),
    ),
    grammar,
    limits,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const bytes = `${JSON.stringify(reportingProfile(), null, 2)}\n`
  const path = join(directory, "profile.json")
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== bytes)
      throw new Error("Stale reporting producer source/profile join")
  } else writeFileSync(path, bytes)
}
