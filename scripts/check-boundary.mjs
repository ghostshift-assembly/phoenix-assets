// Scope gate. `phoenix_assets` is a generic asset substrate: it may know about
// Phoenix, Vite, Svelte, and Ash, and nothing about the products built on it.
// The rule is easy to state and easy to erode one helpful commit at a time, so
// it is a test rather than a paragraph. See AGENTS.md, "What may live here".
//
// Run: node scripts/check-boundary.mjs   (wired into `mix check`)
import { readdir, readFile } from "node:fs/promises"
import { extname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

// Directories a host name has no business appearing in. Docs, config, and the
// fleet-lockstep notes are deliberately excluded -- naming a consumer in prose
// is fine, depending on one in code is not.
const roots = ["lib", "npm/doc-shell/src", "npm/lint", "npm/svelte/src", "npm/vite/src"]
const extensions = new Set([".ex", ".exs", ".ts", ".svelte", ".js", ".mjs", ".css"])

// Consuming platforms. If a new one joins the fleet, add it here.
const platforms = ["apace", "bytly", "diggymon", "orbit", "orvane", "refpath", "rivure", "votera"]

// Business vocabulary. The reporting subpath is a bounded upstream-contract renderer
// whose guarantee is that it decodes a generic envelope -- the moment it
// can name a domain concept, it has stopped being renderer-neutral.
const domainTerms = [
  "invoice",
  "subscription",
  "wallet",
  "ledger",
  "checkout",
  "tenant",
  "landlord",
  "campaign",
  "crm",
]

// `\b` is not enough: domain vocabulary reaches code as `invoiceTotal` and
// `tenantId`, where the boundary after the term is a capital. Match a term that
// is not merely a fragment of a longer lowercase word, allowing a plural.
//
// The boundary classes must stay case-explicit, so no /i flag -- with it,
// `(?![a-z])` also rejects the capital in `invoiceTotal` and the check silently
// passes everything camelCase. Each term carries its own leading-case class.
const anyCase = (word) => `[${word[0]}${word[0].toUpperCase()}]${word.slice(1)}`
const pattern = (words) => new RegExp(`(?<![A-Za-z])(${words.map(anyCase).join("|")})s?(?![a-z])`)
const platformPattern = pattern(platforms)
const domainPattern = pattern(domainTerms)

const files = []
const walk = async (directory) => {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return // an optional package that is not present in this checkout
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "coverage", ".svelte-kit"].includes(entry.name)) continue
      await walk(path)
    } else if (extensions.has(extname(entry.name))) {
      files.push(path)
    }
  }
}
await Promise.all(roots.map((directory) => walk(join(root, directory))))

const violations = []
for (const file of files) {
  const source = await readFile(file, "utf8")
  const isReporting = file.includes("/reporting/")
  source.split("\n").forEach((line, index) => {
    const platform = line.match(platformPattern)
    if (platform) violations.push([file, index + 1, `platform name "${platform[1]}"`])

    // Domain vocabulary is only load-bearing inside the renderer, where
    // neutrality is the contract. Elsewhere it is usually an English word.
    const domain = isReporting && line.match(domainPattern)
    if (domain) violations.push([file, index + 1, `domain term "${domain[1]}" in reporting/`])
  })
}

if (violations.length > 0) {
  for (const [file, line, what] of violations) {
    console.error(`${relative(root, file)}:${line}: ${what}`)
  }
  console.error(
    `\n${violations.length} boundary violation(s). phoenix_assets is a generic substrate:` +
      " a consuming platform's name or vocabulary belongs in that platform, not here." +
      " See AGENTS.md.",
  )
  process.exit(1)
}

console.log(`boundary: ${files.length} files clean`)
