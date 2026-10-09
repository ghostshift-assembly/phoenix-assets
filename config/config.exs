import Config

# Ash 3.33 requires an explicit string-length policy. This config belongs to
# this repository; consuming applications choose their own policy.
config :ash, default_string_length_count: :codepoints

# Silence phoenix_sync's startup warnings during this package's own test/dev
# runs. Consumers configure phoenix_sync in their own application.
config :phoenix_sync,
  env: config_env(),
  mode: :disabled

# git_ops drives release management from the git root (which is the package
# root). It reads @version from mix.exs, bumps it, writes CHANGELOG.md, and tags
# `vX.Y.Z`. Guarded to :dev.
#
# Release with `mix git_ops.release` from the repository root (use `--initial`
# for the first release). Conventional commits drive the bump; mark breaking
# changes with the `!` suffix (`feat!:`), NOT a `BREAKING CHANGE:` footer (which
# git_ops mis-parses). In CI, fetch full history (`fetch-depth: 0`) first.
if config_env() == :dev do
  config :git_ops,
    mix_project: Mix.Project.get!(),
    changelog_file: "CHANGELOG.md",
    repository_url: "https://github.com/ghostshift-assembly/phoenix-assets",
    version_tag_prefix: "v",
    manage_mix_version?: true,
    manage_readme_version: false,
    managed_files: [
      {"npm/doc-shell/package.json", :json},
      {"npm/lint/package.json", :json},
      {"npm/svelte/package.json", :json},
      {"npm/vite/package.json", :json}
    ],
    types: [
      tidbit: [hidden?: true],
      important: [header: "Important Changes"],
      # Keep routine commit types out of the changelog so releases read as a
      # curated list of features, fixes, and breaking changes.
      chore: [hidden?: true],
      test: [hidden?: true],
      ci: [hidden?: true],
      build: [hidden?: true],
      style: [hidden?: true]
    ]
end
