# Releasing Phoenix Assets

One `vX.Y.Z` tag identifies the Hex package and all four npm packages. The
release builds five artifacts once, tests those tarballs, and publishes the
verified bytes.
The release manifest binds every checksum to the source commit and version.
Its contract remains `phoenix-assets/release/v1`.

## Consumer qualification evidence — planned extension

The existing release manifest and verification process own these gates. Keep
`phoenix-assets/release/v1` stable; attach a versioned qualification sidecar by
content digest to the retained release evidence, rather than silently adding
unrecognized wire fields. No second registry, lifecycle or report-envelope field
is introduced. These additional gates are specified; current scripts do not yet
collect all of this evidence.

For each selected profile record declared package constraints/overrides, exact
lock and resolved source/integrity, toolchain/configuration/generation digests,
extracted tarball identity, actual entrypoint/import graph, installed dependency
closure and measured installed/emitted bytes. Record selected processes/routes
separately. A dormant installed tool is not an activated integration. Use PHA.02
GEN/ISO/PROF/RPT acceptance and PHA.01/PHA.03 for the respective render/build duties.

Reporting qualification also records upstream contract/schema and fixture-format
versions, immutable public producer repository/revision or publication identity,
per-file fixture/generated-grammar digests, advertised capabilities/limits, exact
renderer package/version/tarball digest, toolchain/profile and case results. The
producer owns that corpus and its semantic verification. Retaining verified public
bytes supports offline tests; never substitute a private checkout or a locally
copied enum list. A checksum identifies bytes; publisher trust still follows this
release process and the consuming channel's trust policy.

Keep declared, source-implemented, locally tested, extracted-artifact qualified,
published and operating claims separate. Each host records its selected Hex/npm
companions and any upstream contract versions. One coordinated tag does not prove
all hosts upgraded, use all packages, or run the same tuple. Running claims need
host observations of loaded backend/build and served frontend artifacts. Library
release checks cannot establish them. Known older qualified cohorts remain valid
within their supported contracts; new source-only features remain unavailable there.

- **REL-1:** change a lock, override, peer, generated contract or tarball while
  holding display versions fixed. Reject reuse of the prior qualification. Record
  the mismatched subject and retain evidence; requalify the exact selected bytes.
- **REL-2:** advance the selected upstream producer profile without changing local
  copied constants. Detect the stale join; run PHA.02 RPT-1/2 on the extracted
  renderer and record each verdict. Compatible new producer data can qualify the
  same renderer bytes; skipped cases and known validation gaps do not count as passes.
- **REL-3:** qualify fresh narrow and reporting consumers separately under PHA.02
  ISO/PROF. The optional LayerChart peer changes existing installation obligations:
  use the breaking-release process, an explicit host migration and rollback proof.
  Do not republish existing versions or change a host's lock implicitly. Until
  these pass, retain the current published dependency behavior and state the gap.
- **REL-4:** inspect both published build-tool packages and production application
  archives. If PHA.03's reusable-gap gate admits a build extension, published
  build-tool packages retain that implementation. No extension is mandatory merely
  to qualify a release. Neither artifact contains host-generated private
  correspondence, credentials or pairing material. Production app outputs exclude dev injection/routes/modules
  under PHA.03. Ordinary source maps remain subject to the host's publication
  policy. An `enabled: false` flag alone is not artifact inspection.

Missing or mismatched qualification blocks the affected support/publication claim.
An interrupted publisher reuses the original artifact identity under Recovery
below. A host restores an older exact package/lock cohort only if current contract
and trust policy still permit it; no component is silently replaced under an
accepted digest. A missing selected peer is a build prerequisite failure, not a
successful runtime table fallback. Public measurement and unrelated qualified
asset profiles do not acquire a reporting or browser-development prerequisite.

## Local qualification

Use the pinned toolchain and run the complete local gate before releasing:

```bash
mise exec -- mix deps.get
mise exec -- pnpm install --frozen-lockfile
mise exec -- mix check --no-retry
```

The DocShell site renderer supports DocShell 0.5 and 1.0. The extraction-only
integration also accepts 0.4. Packaged consumers check all three versions and a
consumer without optional dependencies. While preparing an upstream candidate,
set `DOC_SHELL_CANDIDATE` to its checkout for dependency installation and
qualification. Artifact builds remove that override and retain the public Hex
requirement. Use separate build directories when switching between the registry
dependency and a candidate checkout.

Before tagging, resolve the published dependencies with `mix deps.get` and commit
the resulting lockfile. The hosted release uses `mix deps.get --check-locked` so
dependency installation cannot change the tagged source tree.

Also run warnings-as-errors compilation and ExUnit on Elixir 1.18 / OTP 27,
and the complete gate on Elixir 1.20 / OTP 29. Keep each toolchain's build and
PLT caches separate. The full gate includes both coverage floors, dependency
audits, docs, Dialyzer, package exports and a consumer of the built Hex tarball.
The Hex metadata must not constrain `phoenix_sync` or `electric`; each host
owns its backend. Development tests qualify the immutable Phoenix.Sync fork,
and the frontend tests use the actual Electric and TanStack packages.

Iteration and release qualification run locally. Ordinary pull requests and
main pushes run one current-runtime lane. Manual or full-matrix CI runs both
runtime legs. Dialyzer and exact-artifact checks remain full local/release gates.
Tag pushes do not start CI.
No paid GitHub feature or repository visibility change is required.

## Prepare the shared release

[Conventional Commits](https://www.conventionalcommits.org) drive the shared
version (`feat:`, `fix:`, `docs:`, `chore:`). Mark breaking changes with `!`
(`feat!:`); do not use a `BREAKING CHANGE:` footer because `git_ops` mis-parses it.
From the Git root, `mix git_ops.release` updates `mix.exs`, all four npm manifests,
the changelog and the tag. Never change a schema version merely to release the
packages.

Build from the clean tagged commit, after local qualification:

```bash
mise exec -- mix git_ops.release
mise exec -- node scripts/release.mjs check --tag vX.Y.Z --network
mise exec -- node scripts/release.mjs build --tag vX.Y.Z --artifact-dir dist/release
mise exec -- node scripts/release.mjs smoke --tag vX.Y.Z --artifact-dir dist/release
mise exec -- node scripts/release.mjs publish --tag vX.Y.Z --artifact-dir dist/release --dry-run
```

Use the actual tag in place of `vX.Y.Z`. Untagged preparation can use
`--allow-untagged`; production publication requires the exact tag and a clean
worktree. Review the five artifacts, `release-manifest.json` and `SHA256SUMS`.
Retain this directory so interrupted publication can reuse the same bytes.

## Publish the locally verified bytes

Use an authorized npm publishing login/token and a dedicated Hex API key with
`api:write`. Keep credentials in the local credential store or process
environment; never commit them. npm must grant write access to the
`@phoenix-assets` packages. Complete any registry-required authentication.

```bash
mise exec -- node scripts/release.mjs verify --tag vX.Y.Z --artifact-dir dist/release
mise exec -- node scripts/release.mjs publish --tag vX.Y.Z --artifact-dir dist/release
mise exec -- mix hex.publish docs --yes
```

Maintainers then push `main` and the release tag manually. Agents never push Git
refs.

The publisher checks every registry before its first write. Existing
versions with identical checksums are skipped; different bytes abort the run.
Publish only the artifacts that passed the exact-tarball smokes. Store the tag,
manifest and checksums with the release record.

## Recovery and optional hosted release

Registry publication is not atomic across npm and Hex. After a transport
failure, rerun the same local `publish` command with the retained artifact
directory. Do not rebuild artifacts, move the tag or bump a version to recover
an interrupted upload. Defective published bytes require a new release.

The manually dispatched Release workflow uses the same identity checks and
artifact smokes. It is reserved for releases rather than normal iteration. Its
`release` environment holds `HEX_API_KEY` and, when
needed, `NPM_TOKEN`. npm trusted publishing may instead use that workflow's
OIDC identity. Protected branch/tag settings and release reviewers are
maintainer-managed controls. Artifact checksums and source identity are
required; GitHub's paid private-repository attestation feature is not.

The manual Recover Hex workflow can resume an artifact from a prior hosted
release run. Local releases recover directly from their retained directory.
