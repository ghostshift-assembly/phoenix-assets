[
  ## `mix check` is the single quality gate for the whole repo -- Elixir and
  ## frontend. It requires Node + pnpm on PATH for the frontend tools below.
  parallel: true,
  tools: [
    ## --- Elixir ---
    {:compiler,
     command: "mix compile --warnings-as-errors --force",
     env: %{"ERL_COMPILER_OPTIONS" => "nowarn_deprecated_catch"}},
    {:formatter, command: "mix format --check-formatted"},
    {:credo, command: "mix credo --strict"},
    {:doctor, command: "mix doctor"},
    {:ex_doc, command: "mix docs --warnings-as-errors"},
    {:mix_audit, command: "mix deps.audit"},
    {:hex_audit, command: "mix hex.audit"},
    {:dialyzer, true},

    ## ExUnit with coverage: enforces minimum_coverage (coveralls.json) and
    ## writes cover/lcov.info for Codecov. Replaces the plain :ex_unit tool.
    {:ex_unit, false},
    {:coveralls,
     command: "mix coveralls.lcov",
     env: %{"ERL_COMPILER_OPTIONS" => "nowarn_deprecated_catch", "MIX_ENV" => "test"}},

    ## --- Frontend (pnpm): install, then lint / typecheck / test+coverage,
    ## dead-code detection (knip), and package-export correctness (publint + attw) ---
    {:pnpm_install, command: "pnpm install --frozen-lockfile"},
    {:npm_audit, command: "pnpm audit --prod", deps: [:pnpm_install]},
    {:biome, command: "pnpm lint", deps: [:pnpm_install]},
    {:typecheck, command: "pnpm typecheck", deps: [:pnpm_install]},
    {:vitest, command: "pnpm test", deps: [:pnpm_install]},
    {:knip, command: "pnpm knip", deps: [:pnpm_install]},
    {:check_exports, command: "pnpm check:exports", deps: [:pnpm_install]},
    {:release_tests, command: "pnpm test:release", deps: [:pnpm_install]},
    {:hex_consumer, command: "node scripts/release.mjs smoke-hex"},
    {:http_consumer,
     command: "node scripts/release.mjs smoke-core", deps: [:pnpm_install, :check_exports]},
    {:release_contract, command: "pnpm check:release", deps: [:pnpm_install]},
    {:svelte_filenames, command: "pnpm check:svelte-filenames"},
    {:doc_shell_offline,
     command: "pnpm --filter @phoenix-assets/doc-shell check:offline", deps: [:pnpm_install]},

    ## Scope gate: no consuming platform's name or vocabulary in lib/ or npm/.
    ## Needs no install -- plain Node, like the doc-shell offline guard.
    {:boundary, command: "node scripts/check-boundary.mjs"},

    ## --- Deliberately off ---
    {:sobelow, false},
    {:unused_deps, false},
    {:npm_test, false},
    {:gettext, false}
  ]
]
