import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import {
  collectReleaseErrors,
  isCanonicalRepositoryRemote,
  validateRelease,
  verifyArtifacts,
} from "./release.mjs"

const packages = ["doc-shell", "lint", "svelte", "vite"]

function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "phoenix-assets-release-test-"))
  mkdirSync(join(root, "config"))
  mkdirSync(join(root, "npm"))
  writeFileSync(join(root, "mix.exs"), `@version "${options.mixVersion ?? "1.2.3"}"\n`)
  writeFileSync(
    join(root, "config/config.exs"),
    'repository_url: "https://github.com/ghostshift-assembly/phoenix-assets"\n',
  )
  writeFileSync(join(root, "README.md"), "https://github.com/ghostshift-assembly/phoenix-assets\n")
  writeFileSync(join(root, "CHANGELOG.md"), "https://github.com/futhr/phoenix-assets\n")

  for (const name of packages) {
    const directory = `npm/${name}`
    mkdirSync(join(root, directory))
    writeFileSync(
      join(root, directory, "package.json"),
      `${JSON.stringify(
        {
          name: `@phoenix-assets/${name}`,
          version: options.npmVersions?.[name] ?? "1.2.3",
          homepage: "https://github.com/ghostshift-assembly/phoenix-assets",
          repository: {
            type: "git",
            url: "git+https://github.com/ghostshift-assembly/phoenix-assets.git",
            directory,
          },
          publishConfig: { access: "public" },
        },
        null,
        2,
      )}\n`,
    )
  }
  return root
}

function withFixture(options, callback) {
  const root = fixture(options)
  try {
    callback(root)
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
}

test("accepts one version and its exact tag across all five artifacts", () => {
  withFixture({}, (root) => {
    assert.equal(validateRelease(root, { checkGit: false, tag: "v1.2.3" }), "1.2.3")
  })
})

test("rejects npm version drift", () => {
  withFixture({ npmVersions: { svelte: "1.2.4" } }, (root) => {
    assert.ok(
      collectReleaseErrors(root, { checkGit: false, tag: "v1.2.3" }).some((error) =>
        error.includes("@phoenix-assets/svelte version 1.2.4 does not match Mix 1.2.3"),
      ),
    )
  })
})

test("rejects tag mismatch and untagged production releases", () => {
  withFixture({}, (root) => {
    assert.ok(
      collectReleaseErrors(root, { checkGit: false, tag: "v1.2.4" }).some((error) =>
        error.includes("tag v1.2.4 does not match release v1.2.3"),
      ),
    )
    assert.ok(
      collectReleaseErrors(root, { checkGit: false }).some((error) =>
        error.includes("production release requires"),
      ),
    )
    assert.equal(collectReleaseErrors(root, { allowUntagged: true, checkGit: false }).length, 0)
  })
})

test("rejects noncanonical repository metadata", () => {
  withFixture({}, (root) => {
    const manifestPath = join(root, "npm/vite/package.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    manifest.repository.url = `git+https://github.com/futhr/phoenix${"_assets"}.git`
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`)

    assert.ok(
      collectReleaseErrors(root, { checkGit: false, tag: "v1.2.3" }).some((error) =>
        error.includes("repository URL"),
      ),
    )
  })
})

test("rejects former repository owner metadata", () => {
  withFixture({}, (root) => {
    const manifestPath = join(root, "npm/vite/package.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    manifest.homepage = "https://github.com/futhr/phoenix-assets"
    manifest.repository.url = "git+https://github.com/futhr/phoenix-assets.git"
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`)

    const errors = collectReleaseErrors(root, { checkGit: false, tag: "v1.2.3" })
    assert.ok(
      errors.includes(
        "@phoenix-assets/vite homepage must be https://github.com/ghostshift-assembly/phoenix-assets",
      ),
    )
    assert.ok(
      errors.includes(
        "@phoenix-assets/vite repository URL must be git+https://github.com/ghostshift-assembly/phoenix-assets.git",
      ),
    )
  })
})

test("accepts canonical GitHub checkout remotes and rejects lookalikes", () => {
  for (const remote of [
    "https://github.com/ghostshift-assembly/phoenix-assets",
    "https://github.com/ghostshift-assembly/phoenix-assets.git",
    "git@github.com:ghostshift-assembly/phoenix-assets.git",
    "ssh://git@github.com/ghostshift-assembly/phoenix-assets.git",
  ]) {
    assert.equal(isCanonicalRepositoryRemote(remote), true)
  }

  for (const remote of [
    "https://github.com/ghostshift-assembly/phoenix-assets-fork.git",
    "https://github.com/attacker/ghostshift-assembly/phoenix-assets.git",
    "git@github.example:ghostshift-assembly/phoenix-assets.git",
    "https://github.com/futhr/phoenix-assets",
    "https://github.com/futhr/phoenix-assets.git",
    "git@github.com:futhr/phoenix-assets.git",
    "ssh://git@github.com/futhr/phoenix-assets.git",
  ]) {
    assert.equal(isCanonicalRepositoryRemote(remote), false)
  }
})

function withArtifacts(callback) {
  withFixture({}, (root) => {
    execFileSync("git", ["init", "-q", root])
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.test",
        "commit",
        "--allow-empty",
        "--no-gpg-sign",
        "-qm",
        "fixture",
      ],
      { cwd: root },
    )
    const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
    const output = join(root, "artifacts")
    mkdirSync(output)
    const definitions = [
      { ecosystem: "hex", name: "phoenix_assets", file: "phoenix_assets-1.2.3.tar" },
      ...packages.map((name) => ({
        ecosystem: "npm",
        name: `@phoenix-assets/${name}`,
        file: `phoenix-assets-${name}-1.2.3.tgz`,
      })),
    ]
    const artifacts = definitions.map((artifact) => {
      const bytes = Buffer.from(artifact.name)
      writeFileSync(join(output, artifact.file), bytes)
      return {
        ...artifact,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        ...(artifact.ecosystem === "npm"
          ? { integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` }
          : {}),
      }
    })
    const manifest = {
      schema_version: "phoenix-assets/release/v1",
      version: "1.2.3",
      source_sha: sourceSha,
      source_repository: "https://github.com/ghostshift-assembly/phoenix-assets",
      source_dirty: false,
      artifacts,
    }
    const save = () => {
      writeFileSync(join(output, "release-manifest.json"), JSON.stringify(manifest))
      const lines = [...artifacts.map(({ file }) => file), "release-manifest.json"].map(
        (file) =>
          `${createHash("sha256")
            .update(readFileSync(join(output, file)))
            .digest("hex")}  ${file}`,
      )
      writeFileSync(join(output, "SHA256SUMS"), `${lines.join("\n")}\n`)
    }
    save()
    const verify = () => verifyArtifacts(root, output, { checkGit: false, allowUntagged: true })
    callback({ manifest, output, save, verify })
  })
}

test("verifies all five artifacts and the complete checksum manifest", () => {
  withArtifacts(({ verify }) => assert.equal(verify().artifacts.length, 5))
})

for (const field of ["name", "ecosystem"]) {
  test(`rejects a changed artifact ${field} even when its bytes match`, () => {
    withArtifacts(({ manifest, save, verify }) => {
      manifest.artifacts[0][field] = "unexpected"
      save()
      assert.throws(verify, /artifact identity mismatch/)
    })
  })
}

test("rejects a changed source repository", () => {
  withArtifacts(({ manifest, save, verify }) => {
    manifest.source_repository = "https://example.test/other"
    save()
    assert.throws(verify, /repository does not match/)
  })
})

test("rejects the former source repository", () => {
  withArtifacts(({ manifest, save, verify }) => {
    manifest.source_repository = "https://github.com/futhr/phoenix-assets"
    save()
    assert.throws(verify, /repository does not match/)
  })
})

for (const mode of ["missing", "duplicate", "escape"]) {
  test(`rejects ${mode} entries in SHA256SUMS`, () => {
    withArtifacts(({ output, verify }) => {
      const path = join(output, "SHA256SUMS")
      const lines = readFileSync(path, "utf8").trim().split("\n")
      if (mode === "missing") lines.pop()
      if (mode === "duplicate") lines.push(lines[0])
      if (mode === "escape") lines.push(`${"0".repeat(64)}  ../mix.exs`)
      writeFileSync(path, `${lines.join("\n")}\n`)
      assert.throws(verify, /SHA256SUMS/)
    })
  })
}

test("rejects artifact byte tampering", () => {
  withArtifacts(({ output, verify }) => {
    writeFileSync(join(output, "phoenix_assets-1.2.3.tar"), "changed")
    assert.throws(verify, /checksum mismatch/)
  })
})
