# Releasing Phoenix Assets

One `vX.Y.Z` tag identifies the Hex package and all four npm packages. The
release builds five artifacts once, tests those tarballs, and publishes the
verified bytes.
The release manifest binds every checksum to the source commit and version.
Its contract remains `phoenix-assets/release/v1`.

## Retained consumer qualification

`release.mjs qualify` tests the five built archives in fresh consumers and writes
`phoenix-assets/qualification/v1` evidence beside the unchanged release manifest.
`qualification.json` names the content-addressed receipt by SHA-256. It binds
tracked source, locks, peers, public producer fixtures, toolchain, archives,
consumer locks, emitted output and browser screenshots. The toolchain records
both the calling Node and the Node used by pnpm scripts; `devEngines.runtime`
pins pnpm execution to Node 24.21.0. Changing any bound input
invalidates reuse even when package versions stay fixed.

The HTTP consumer installs Svelte and `/core` without Electric, TanStack, Phoenix
or LayerChart. The full consumer installs the explicitly selected optional peers,
checks exports and builds reporting, collection and DocShell entrypoints. Hex
consumers compile without optional dependencies and with DocShell 0.4, 0.5 and 1.0.
The DocShell 1.0 consumer exports a static site without starting an endpoint.
Chromium checks both installed renderers and a connected LiveView consumer,
including JSON/Pagefind locale indexes and filters, repeated DOM replacements,
local optional enhancements, responsive themes, search focus, RTL, reduced motion
and JavaScript-disabled content. Five projected pages cover home, directives,
module reference, long code/tables and Arabic content; standalone fixtures cover
OpenAPI and 404 behavior. DocShell's public conformance validator compares the
observed hosted/static semantics. The
receipt names the exact cases; it does not establish every possible host profile.

Reporting uses the retained public `refpath/refpath` producer revision recorded
in `npm/svelte/test/fixtures/upstream-reporting/profile.json`. Qualification runs
its actual validator and encoder, verifies the source and recipe digests, and
replays the generated boundary cases through the extracted browser decoder.
The ordinary test suite also replays the retained corpus offline.

Screenshot generation leaves review pending. Inspect the retained images, then
record review with `review-qualification --expected-sha <receipt-sha> --reviewer
<identity>`. This creates a new receipt without replacing the original evidence.
Production publication requires reviewed evidence; a dry run may retain pending
review. A command cannot accept a regenerated visual baseline automatically.

The [coordinated DocShell tracker](https://github.com/ghostshift-assembly/phoenix-assets/blob/main/docs/plans/doc-shell-renderers.md#coordinated-completion)
also requires the selected upstream/downstream revisions and archives to be
qualified together as new contracts land. Extend the existing consumers for
those requirements before claiming them. Preserve prior receipts at their
original scope; do not relabel them as proof for new source or schemas. Native
reader and human assistive-task evidence comes from the owning consumer/target,
separately from browser screenshots and the two libraries' gates.

Upgrades from 1.x to 2.x include breaking installation changes: reporting
hosts must explicitly select `layerchart@2.9.1`, and Svelte consumers must select
Svelte `^5.57.2`. Rebuild with those exact peers and retain the prior package and
lock together for rollback. The shared lint package now uses Biome 2.6.2; migrate
host configuration with Biome's migration command before adopting that package.
HTTP-only hosts do not acquire a reporting or sync dependency.
Svelte request panels now require an explicit `baseUrl`; `/` selects the current
origin. API operations remain readable before browser enhancement. Enabled HEEx
request forms keep native submission inert and controls disabled until the
packaged controller mounts.

Installed dependency counts/bytes and emitted browser bytes are separate
measurements in the receipt. Installed tools do not prove activated services.
No local receipt proves publication, a running deployment or backend sync
compatibility. Hosts retain authority over runtime codecs, actor/tenant scope,
credentials, mutation reconciliation and production artifact policy.

## Local qualification

Use the pinned toolchain and run the complete local gate before releasing:

```bash
mise exec -- mix deps.get
mise exec -- pnpm install --frozen-lockfile
mise exec -- mix check --no-retry
```

DocShell browser bundles in `priv/doc_shell/` are generated and ignored by Git.
The gate builds them before renderer tests. `mix hex.build` rebuilds them from
the workspace before packaging; the Hex archive includes the bundles and their
license notices. Published Hex consumers use those packaged files without Node
or pnpm. For direct renderer development, run `pnpm build:doc-shell-assets` after
changing browser source.

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

Also run warnings-as-errors compilation and ExUnit on Elixir 1.20 / OTP 28,
and the complete gate on Elixir 1.20 / OTP 29. Keep each toolchain's build and
PLT caches separate. Run `pnpm build:doc-shell-assets` before the OTP 28 renderer
tests; those generated assets are absent from a clean checkout.
Use an absolute `MIX_BUILD_ROOT` for the OTP compatibility leg so Rebar resolves dependency
headers correctly and dev/test retain separate compilations:

```bash
MIX_BUILD_ROOT="$PWD/_build/otp-28-runtime" mise exec erlang@28.5.0.7 elixir@1.20.4-otp-28 -- mix compile --warnings-as-errors
MIX_BUILD_ROOT="$PWD/_build/otp-28-runtime" mise exec erlang@28.5.0.7 elixir@1.20.4-otp-28 -- mix test
```

The full gate includes both coverage floors, dependency
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
mise exec -- node scripts/release.mjs qualify --tag vX.Y.Z --artifact-dir dist/release
mise exec -- node scripts/release.mjs publish --tag vX.Y.Z --artifact-dir dist/release --dry-run
```

Use the actual tag in place of `vX.Y.Z`. Untagged preparation can use
`--allow-untagged`; production publication requires the exact tag and a clean
worktree. Review the five artifacts, `release-manifest.json`, `SHA256SUMS` and retained
qualification evidence. Install Chromium with `pnpm exec playwright install chromium`
before local browser qualification.
Retain this directory so interrupted publication can reuse the same bytes.

## Publish the locally verified bytes

Use an authorized npm publishing login/token and a dedicated Hex API key with
`api:write`. Keep credentials in the local credential store or process
environment; never commit them. npm must grant write access to the
`@phoenix-assets` packages. Complete any registry-required authentication.

```bash
mise exec -- node scripts/release.mjs verify-qualification --tag vX.Y.Z --artifact-dir dist/release
# After inspecting browser-screenshots/, use the SHA-256 from qualification.json:
mise exec -- node scripts/release.mjs review-qualification --tag vX.Y.Z --artifact-dir dist/release --expected-sha <receipt-sha> --reviewer <identity>
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

The manually dispatched Release workflow first builds and retains a dry-run
artifact with its receipt and screenshots. After review, a publication dispatch
names that exact run ID, artifact ID and reviewed qualification SHA-256. It
downloads and verifies those bytes without rebuilding them. It is reserved for releases rather than normal iteration. Its
`release` environment holds `HEX_API_KEY` and, when
needed, `NPM_TOKEN`. npm trusted publishing may instead use that workflow's
OIDC identity. Protected branch/tag settings and release reviewers are
maintainer-managed controls. Artifact checksums and source identity are
required; GitHub's paid private-repository attestation feature is not.

The manual Recover Hex workflow can resume an artifact from a prior hosted
release run. Local releases recover directly from their retained directory.


The passive artifact reader lane requires a producer exporting
`ArtifactBlock.verify_receipt/2`. Run `scripts/artifact-fixture.exs` with `mix run
--no-start` inside the selected Hex consumer, passing a disposable output path.
It compares the installed producer's packaged synthetic corpus with the frozen
renderer input and writes exact receipts/canonical witnesses. Then run:

```sh
mise exec -- pnpm qualify:artifacts /absolute/path/to/output /absolute/path/to/installed/doc-shell/dist /absolute/path/to/npm-consumer
```

The last argument supplies the selected Vite/Svelte compiler peers. The runner
uses the specified renderer package, creates a disposable SSR workspace, observes
Svelte and HEEx without JavaScript, and retains its report and screenshots in the
output directory. Inspect the images separately. Bind this scoped evidence to
its actual Hex/npm archives, locks and runtimes; a checkout invocation is not
an extracted-consumer or external producer/native/human qualification.
