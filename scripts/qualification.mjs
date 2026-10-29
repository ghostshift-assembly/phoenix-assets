import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
const fileDigest = (path) => digest(readFileSync(path))

export const treeMeasurements = (root) => {
  let files = 0
  let bytes = 0
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      const stat = lstatSync(path)
      if (stat.isDirectory()) visit(path)
      else if (stat.isFile()) {
        files += 1
        bytes += stat.size
      }
    }
  }
  visit(root)
  return { files, bytes }
}

const retainedEvidence = (output) => {
  const files = {}
  const visit = (path, relative) => {
    if (!existsSync(path)) return
    if (lstatSync(path).isDirectory())
      for (const name of readdirSync(path).sort())
        visit(join(path, name), relative ? `${relative}/${name}` : name)
    else files[relative] = fileDigest(path)
  }
  for (const name of [
    "build-inputs.json",
    "consumer-full-package-lock.json",
    "consumer-http-package-lock.json",
    "consumer-prior-package-lock.json",
    "consumer-prior-dist",
    "consumer-full-dist",
    "consumer-http-dist",
    "consumer-browser-dist",
    "producer",
    "browser-static",
    "browser-search",
    "browser-screenshots",
  ])
    visit(join(output, name), name)
  return files
}

const qualificationSubjects = (root, output) => {
  const paths = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
  return {
    source: Object.fromEntries(
      paths
        .filter((path) => existsSync(join(root, path)))
        .map((path) => [path, fileDigest(join(root, path))]),
    ),
    artifacts: Object.fromEntries(
      JSON.parse(readFileSync(join(output, "release-manifest.json"), "utf8")).artifacts.map(
        ({ file }) => [file, fileDigest(join(output, file))],
      ),
    ),
    manifest: fileDigest(join(output, "release-manifest.json")),
    evidence: retainedEvidence(output),
  }
}

const toolchain = () =>
  Object.fromEntries([
    ["node", process.version],
    ["pnpm_node", execFileSync("pnpm", ["exec", "node", "--version"], { encoding: "utf8" }).trim()],
    [
      "elixir",
      execFileSync(
        "elixir",
        [
          "-e",
          'IO.write(System.version() <> "/OTP " <> System.otp_release() <> "/ERTS " <> to_string(:erlang.system_info(:version)))',
        ],
        { encoding: "utf8" },
      ).trim(),
    ],
    ...["pnpm", "npm"].map((command) => [
      command,
      execFileSync(command, ["--version"], { encoding: "utf8" }).trim(),
    ]),
  ])

export const recordBuildInputs = (root, output) => {
  writeFileSync(
    join(output, "build-inputs.json"),
    `${JSON.stringify({ source: qualificationSubjects(root, output).source, toolchain: toolchain() }, null, 2)}\n`,
  )
}

export const writeQualification = (root, output, consumers) => {
  const built = JSON.parse(readFileSync(join(output, "build-inputs.json"), "utf8"))
  if (JSON.stringify(built.source) !== JSON.stringify(qualificationSubjects(root, output).source))
    throw new Error("source changed after artifact build")
  if (JSON.stringify(built.toolchain) !== JSON.stringify(toolchain()))
    throw new Error("toolchain changed after artifact build")
  const evidence = {
    schema_version: "phoenix-assets/qualification/v1",
    subjects: qualificationSubjects(root, output),
    toolchain: toolchain(),
    consumers,
  }
  const bytes = `${JSON.stringify(evidence, null, 2)}\n`
  const sha256 = digest(bytes)
  const file = `qualification-${sha256}.json`
  writeFileSync(join(output, file), bytes)
  writeFileSync(
    join(output, "qualification.json"),
    `${JSON.stringify({ file, sha256 }, null, 2)}\n`,
  )
  return evidence
}

export const verifyQualification = (root, output, { requireReviewed = false } = {}) => {
  const pointer = JSON.parse(readFileSync(join(output, "qualification.json"), "utf8"))
  if (
    basename(pointer.file) !== pointer.file ||
    pointer.file !== `qualification-${pointer.sha256}.json`
  )
    throw new Error("invalid qualification identity")
  const path = join(output, pointer.file)
  if (fileDigest(path) !== pointer.sha256) throw new Error("qualification checksum mismatch")
  const evidence = JSON.parse(readFileSync(path, "utf8"))
  if (evidence.schema_version !== "phoenix-assets/qualification/v1")
    throw new Error("unknown qualification schema")
  if (JSON.stringify(evidence.toolchain) !== JSON.stringify(toolchain()))
    throw new Error("stale qualification: toolchain")
  const current = qualificationSubjects(root, output)
  for (const section of ["source", "artifacts", "evidence"]) {
    const names = new Set([
      ...Object.keys(current[section]),
      ...Object.keys(evidence.subjects[section]),
    ])
    for (const name of names)
      if (current[section][name] !== evidence.subjects[section][name])
        throw new Error(`stale qualification: ${section}/${name}`)
  }
  if (current.manifest !== evidence.subjects.manifest)
    throw new Error("stale qualification: release manifest")
  if (!evidence.consumers?.http || !evidence.consumers?.full || !evidence.consumers?.hex)
    throw new Error("qualification is missing required consumers")
  if (requireReviewed && evidence.consumers.full.browser?.screenshot_review?.status !== "reviewed")
    throw new Error("qualification requires review of the retained screenshots")
  return evidence
}

export const reviewQualification = (root, output, expectedSha, reviewer) => {
  const pointer = JSON.parse(readFileSync(join(output, "qualification.json"), "utf8"))
  if (!/^[a-f0-9]{64}$/.test(expectedSha ?? "") || expectedSha !== pointer.sha256)
    throw new Error("review must name the exact qualification SHA-256")
  if (!reviewer?.trim()) throw new Error("reviewer is required")
  const evidence = verifyQualification(root, output)
  const browser = evidence.consumers.full.browser
  if (!browser || !Object.keys(browser.screenshots ?? {}).length)
    throw new Error("no retained screenshot evidence to review")
  for (const [file, sha] of Object.entries(browser.screenshots)) {
    if (basename(file) !== file || fileDigest(join(output, "browser-screenshots", file)) !== sha)
      throw new Error(`screenshot mismatch: ${file}`)
  }
  browser.screenshot_review = { status: "reviewed", reviewer }
  const bytes = `${JSON.stringify(evidence, null, 2)}\n`
  const sha256 = digest(bytes)
  const file = `qualification-${sha256}.json`
  writeFileSync(join(output, file), bytes)
  writeFileSync(
    join(output, "qualification.json"),
    `${JSON.stringify({ file, sha256 }, null, 2)}\n`,
  )
  return evidence
}
