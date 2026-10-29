defmodule PhoenixAssets.MixProject do
  @moduledoc false

  use Mix.Project

  @version "2.0.1"
  @source_url "https://github.com/ghostshift-assembly/phoenix-assets"

  def project do
    [
      app: :phoenix_assets,
      name: "PhoenixAssets",
      description: description(),
      source_url: @source_url,
      version: @version,
      elixir: "~> 1.18",
      elixirc_paths: elixirc_paths(Mix.env()),
      aliases: aliases(),
      start_permanent: Mix.env() == :prod,
      test_coverage: [tool: ExCoveralls],
      deps: deps(),
      dialyzer: dialyzer(),
      package: package(),
      docs: docs()
    ]
  end

  def description do
    "A supervised, type-safe SvelteKit frontend, first-class inside Phoenix."
  end

  def cli do
    [
      preferred_envs: [
        coveralls: :test,
        "coveralls.detail": :test,
        "coveralls.html": :test,
        "coveralls.json": :test,
        "coveralls.lcov": :test,
        "coveralls.cobertura": :test
      ]
    ]
  end

  def application do
    [extra_applications: [:logger]]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:phoenix, "~> 1.8"},
      {:plug, "~> 1.14"},
      {:telemetry, "~> 1.1"},
      {:file_system, "~> 1.0"},
      # MuonTrap 2 replaces cgroup v1 with cgroup v2. We use only the stable
      # daemon API, so follow its library guidance and remain compatible with
      # both maintained majors while allowing new locks to select v2.
      {:muontrap, ">= 1.8.0 and < 3.0.0"},
      {:nimble_options, "~> 1.1"},
      {:phoenix_live_view, "~> 1.1", optional: true},
      doc_shell_dependency(),
      {:ash, "~> 3.37 and >= 3.37.2", optional: true},
      # Ash TypeScript remains an optional generator integration. The host owns
      # its sync backend; qualification must not impose a production backend pin.
      {:ash_typescript, "~> 0.17", optional: true},
      {:phoenix_sync,
       github: "futhr/phoenix_sync",
       ref: "330f0602009b7b8aca7e3140b492b5408ee276ec",
       only: [:dev, :test]},
      {:gettext, "~> 1.0", optional: true},
      {:tidewave, "~> 0.9.2", optional: true},
      {:igniter, "~> 0.6", optional: true},
      {:git_ops, "~> 2.6", only: [:dev], runtime: false},
      {:ex_check, "~> 0.17", only: [:dev], runtime: false},
      {:ex_doc, "~> 0.40", only: :dev, runtime: false},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false},
      {:mix_audit, "~> 2.1", only: [:dev, :test], runtime: false},
      {:excoveralls, "~> 0.18", only: :test, runtime: false},
      {:simple_sat, "~> 0.1", only: :test},
      {:bandit, "~> 1.14.1", only: :test},
      # The install-task test drives igniter's Phoenix generator, which is only
      # compiled when phx_new resolves as a dependency -- a globally installed
      # archive does not satisfy it.
      {:phx_new, "~> 1.7", only: :test, runtime: false},
      {:doctor, "~> 0.22", only: :dev, runtime: false}
    ]
  end

  defp doc_shell_dependency do
    case System.get_env("DOC_SHELL_CANDIDATE") do
      path when is_binary(path) and path != "" ->
        {:doc_shell, path: Path.expand(path), optional: true, override: true}

      _ ->
        {:doc_shell, "~> 0.4.0 or ~> 0.5 or ~> 1.0", optional: true}
    end
  end

  defp dialyzer do
    [
      flags: [:error_handling, :extra_return, :missing_return, :unmatched_returns, :unknown],
      plt_add_apps: [:mix],
      # Kept outside `_build` so the two PLTs can be cached on different keys.
      # The core PLT depends only on the Erlang/Elixir pair, so a lockfile bump
      # must not discard it -- inside `_build` it shares the mix.lock cache key
      # and every dependency update pays a full core rebuild.
      plt_core_path: "priv/plts/core",
      plt_local_path: "priv/plts/local"
    ]
  end

  defp package do
    [
      maintainers: ["Tobias Bohwalli <hi@futhr.io>"],
      licenses: ["MIT"],
      links: %{"GitHub" => @source_url},
      files:
        ~w(lib priv/doc_shell .formatter.exs mix.exs README.md RELEASING.md CHANGELOG.md LICENSE usage-rules.md)
    ]
  end

  defp aliases do
    ["hex.build": [&build_doc_shell_assets/1, "hex.build"]]
  end

  defp build_doc_shell_assets(_) do
    if File.regular?(Path.join(__DIR__, "npm/doc-shell/scripts/build-browser.mjs")) do
      {_, status} =
        System.cmd("pnpm", ["--filter", "@phoenix-assets/doc-shell", "build:browser"],
          cd: __DIR__,
          into: IO.stream(:stdio, :line)
        )

      if status != 0, do: Mix.raise("DocShell browser asset build failed")
    end
  end

  defp docs do
    [
      main: "readme",
      source_url: @source_url,
      source_ref: "v#{@version}",
      formatters: ["html"],
      extras: [
        "README.md": [title: "Overview"],
        "RELEASING.md": [title: "Releasing"],
        "usage-rules.md": [title: "Usage rules"],
        "CHANGELOG.md": [title: "Changelog"]
      ],
      groups_for_extras: [
        Reference: ["usage-rules.md", "RELEASING.md", "CHANGELOG.md"]
      ],
      nest_modules_by_prefix: [
        PhoenixAssets.Commands,
        PhoenixAssets.Generators,
        PhoenixAssets.Graph,
        PhoenixAssets.Doctor,
        PhoenixAssets.Plugin,
        PhoenixAssets.Presets,
        PhoenixAssets.Session,
        PhoenixAssets.DevIntelligence
      ],
      skip_undefined_reference_warnings_on: ["CHANGELOG.md"],
      groups_for_modules: [
        "Runtime & configuration": [
          PhoenixAssets,
          PhoenixAssets.Config,
          PhoenixAssets.Context
        ],
        "Plugin engine": [
          PhoenixAssets.Plugin,
          PhoenixAssets.Plugin.Resolver,
          PhoenixAssets.Preset,
          PhoenixAssets.Engine
        ],
        Presets: [
          PhoenixAssets.Presets.Svelte,
          PhoenixAssets.Presets.SvelteHttp
        ],
        "Stack plugins": [
          PhoenixAssets.SvelteKit,
          PhoenixAssets.Tailwind,
          PhoenixAssets.Storybook,
          PhoenixAssets.Electric,
          PhoenixAssets.Commands,
          PhoenixAssets.Session,
          PhoenixAssets.PubSub,
          PhoenixAssets.Localize,
          PhoenixAssets.Types,
          PhoenixAssets.Typespec
        ],
        "Declarations (DSL)": [
          PhoenixAssets.Electric.Shapes,
          PhoenixAssets.Commands.Definitions,
          PhoenixAssets.Session.Fields,
          PhoenixAssets.PubSub.Topics,
          PhoenixAssets.Types.Schema
        ],
        "Generated contracts": [
          PhoenixAssets.Generated,
          PhoenixAssets.Generators.Routes,
          PhoenixAssets.Generators.Env,
          PhoenixAssets.Generators.TS,
          PhoenixAssets.Generators.Typespec,
          PhoenixAssets.Types.Walker
        ],
        "Asset graph": [
          PhoenixAssets.Graph,
          PhoenixAssets.Graph.Builder,
          PhoenixAssets.Graph.Compiled
        ],
        "Manifest & HTTP": [
          PhoenixAssets.Manifest,
          PhoenixAssets.ManifestServer,
          PhoenixAssets.Components,
          PhoenixAssets.Plug,
          PhoenixAssets.EarlyHints
        ],
        "Dev tooling": [
          PhoenixAssets.DevSupervisor,
          PhoenixAssets.DevServer,
          PhoenixAssets.Generated.Watcher,
          PhoenixAssets.DevIntelligence.TidewaveTools
        ],
        Diagnostics: [
          PhoenixAssets.Doctor,
          PhoenixAssets.Doctor.Check
        ],
        Telemetry: [
          PhoenixAssets.Telemetry
        ],
        Internal: [
          PhoenixAssets.MixHelpers,
          PhoenixAssets.CanonicalJSON,
          PhoenixAssets.DevProcess,
          PhoenixAssets.GeneratedFile,
          PhoenixAssets.Graph.Entry
        ]
      ]
    ]
  end
end
