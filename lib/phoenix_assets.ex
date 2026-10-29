defmodule PhoenixAssets do
  @moduledoc """
  Runtime and generated contracts for Phoenix applications built with Vite.

  `phoenix_assets` supervises Vite and Storybook in development, generates typed
  frontend contracts from Phoenix and Ash, links routes, pages, stories, sync
  shapes, PubSub topics, and locales in an asset graph, and validates the
  production manifest. It does not bundle assets itself or require LiveView as
  the application's UI layer.

  This module provides the runtime API. Related modules include:

    * `PhoenixAssets.Config` -- normalized, validated configuration.
    * `PhoenixAssets.Preset` / `PhoenixAssets.Plugin` -- the integration engine.
    * `PhoenixAssets.Generated` -- the contract generators (routes, types, ...).
    * `PhoenixAssets.Manifest` / `PhoenixAssets.ManifestServer` -- Vite manifest.
    * `PhoenixAssets.Graph` -- the asset graph.
    * `PhoenixAssets.DevSupervisor` -- supervised dev processes.
    * `PhoenixAssets.Doctor` -- configuration and production validation.

  ## Platform support

  Development supervision requires a POSIX platform (macOS, Linux, or WSL2),
  because it relies on MuonTrap. Linux cgroups can stop the full process tree;
  macOS stops the immediate child. Production manifest serving and contract
  generation are platform-independent.
  """

  require Logger

  alias PhoenixAssets.{Config, Context, DevSupervisor, Graph, Manifest, ManifestServer}

  @doc """
  The supervised children a host application adds to its own tree.

  Always includes `PhoenixAssets.ManifestServer`; in development also includes
  `PhoenixAssets.DevSupervisor` (Vite, Storybook, the generated-file watcher).
  Add them in your `Application.start/2`:

      children = [
        # ... your children ...
      ] ++ PhoenixAssets.child_specs()

  Options:

    * `:config` -- a `PhoenixAssets.Config` (defaults to `PhoenixAssets.Config.load!/1`).
    * `:ctx` -- a prebuilt `PhoenixAssets.Context` (defaults to one derived from
      the config and the configured preset).
  """
  @spec child_specs() :: [Supervisor.child_spec() | {module(), term()}]
  @spec child_specs(keyword()) :: [Supervisor.child_spec() | {module(), term()}]
  def child_specs(opts \\ []) do
    config = opts[:config] || Config.load!()
    base = [{ManifestServer, path: Context.manifest_path(Context.new(config))}]

    if dev?() do
      ctx = opts[:ctx] || Context.new(config, env: :dev, plugins: Config.preset_plugins(config))
      base ++ [{DevSupervisor, ctx: ctx}]
    else
      base
    end
  end

  @doc """
  Whether development features (supervised Vite/Storybook, the status plug, the
  generated-file watcher) are active.

  Defaults to `false` so production never spawns dev processes. Enable with:

      config :phoenix_assets, :dev, enabled: true
  """
  @spec dev?() :: boolean()
  def dev? do
    :phoenix_assets
    |> Application.get_env(:dev, [])
    |> Keyword.get(:enabled, false)
  end

  @doc "The installed version of `phoenix_assets`."
  @spec version() :: String.t()
  def version do
    case Application.spec(:phoenix_assets, :vsn) do
      nil -> "0.0.0"
      vsn -> List.to_string(vsn)
    end
  end

  @doc """
  Resolves an entry to its production assets, or `:dev` in development.

  In production returns `%{file:, css:, imports:, integrity:}` from the Vite
  manifest (`integrity` is a possibly-empty `href => hash` map, populated only
  when the manifest carries SRI metadata). When
  `config :phoenix_assets, :build, asset_url: "https://cdn.example.com"` is
  set, every href (including the integrity keys) is prefixed with it. In
  development returns `:dev` so callers emit dev-server URLs. Raises if a
  manifest is expected but unavailable.
  """
  @spec entry!(String.t()) ::
          %{
            file: String.t(),
            css: [String.t()],
            imports: [String.t()],
            integrity: %{String.t() => String.t()}
          }
          | :dev
  def entry!(key) do
    case ManifestServer.manifest() do
      :dev ->
        :dev

      {:error, reason} ->
        raise "phoenix_assets: Vite manifest unavailable (#{inspect(reason)}). Run `mix assets.build`."

      manifest ->
        manifest |> Manifest.resolve!(key) |> apply_asset_url()
    end
  end

  @doc """
  Returns the served path for an asset key.

  In production resolves to the hashed file from the manifest (prefixed with
  the configured `:asset_url`, if any). In development returns the key as a
  root-relative path (the Vite dev server serves it). Raises if a manifest is
  expected but unavailable.
  """
  @spec asset_path(String.t()) :: String.t()
  def asset_path(key) do
    case ManifestServer.manifest() do
      :dev ->
        "/" <> String.trim_leading(key, "/")

      {:error, reason} ->
        raise "phoenix_assets: Vite manifest unavailable (#{inspect(reason)}). Run `mix assets.build`."

      manifest ->
        prefix_asset_url(Manifest.file(manifest, key))
    end
  end

  @doc """
  Builds a Vite dev-server URL for `path`.

  Prefers the hot file the Vite plugin writes (`.phoenix-assets/hot` under the
  asset root, carrying the server's actual resolved URL -- scheme, host, and
  port included, so HTTPS dev servers work); falls back to the configured
  `dev: [vite: [host:, port:]]`.
  """
  @spec vite_dev_url(String.t()) :: String.t()
  def vite_dev_url(path) do
    base = hot_url() || configured_dev_url()
    base <> "/" <> String.trim_leading(path, "/")
  end

  defp hot_url do
    root = Application.get_env(:phoenix_assets, :asset_root, "assets")

    # A missing hot file is the normal production/pre-boot case (silent). A file
    # that exists but is malformed means the dev server wrote something unexpected
    # -- log it (dev-only path) rather than silently masking the misconfiguration.
    case File.read(Path.join(root, ".phoenix-assets/hot")) do
      {:ok, contents} ->
        url = String.trim(contents)

        if String.starts_with?(url, ["http://", "https://"]) do
          String.trim_trailing(url, "/")
        else
          Logger.debug(
            "phoenix_assets: ignoring malformed .phoenix-assets/hot " <>
              "(#{inspect(url)}); using the configured dev URL"
          )

          nil
        end

      {:error, _} ->
        nil
    end
  end

  defp configured_dev_url do
    vite = Application.get_env(:phoenix_assets, :dev, [])[:vite] || []
    host = Keyword.get(vite, :host, "127.0.0.1")
    port = Keyword.get(vite, :port, 5173)
    "http://#{host}:#{port}"
  end

  defp apply_asset_url(resolved) do
    case asset_url() do
      nil ->
        resolved

      base ->
        %{
          file: join_asset_url(base, resolved.file),
          css: Enum.map(resolved.css, &join_asset_url(base, &1)),
          imports: Enum.map(resolved.imports, &join_asset_url(base, &1)),
          integrity:
            Map.new(resolved.integrity, fn {href, hash} -> {join_asset_url(base, href), hash} end)
        }
    end
  end

  defp prefix_asset_url(href) do
    case asset_url() do
      nil -> href
      base -> join_asset_url(base, href)
    end
  end

  # Absolute hrefs (a manifest entry served from its own origin) already carry a
  # scheme; prefixing the CDN base would produce "https://cdn...https://...".
  defp join_asset_url(_, "http://" <> _ = href), do: href
  defp join_asset_url(_, "https://" <> _ = href), do: href
  defp join_asset_url(base, href), do: base <> href

  defp asset_url do
    case Application.get_env(:phoenix_assets, :build, [])[:asset_url] do
      nil -> nil
      base -> String.trim_trailing(base, "/")
    end
  end

  @doc """
  Loads the asset graph (`graph.json`), or an empty map if none has been built.

  For hot paths, prefer a module built with `PhoenixAssets.Graph.Compiled`.
  """
  @spec graph() :: map()
  def graph do
    case Graph.load(Context.new(Config.load!())) do
      {:ok, graph} -> graph
      _ -> %{}
    end
  end

  @doc "Fetches a page from the asset graph by name, raising if absent."
  @spec page!(String.t()) :: map()
  def page!(name), do: fetch_graph!("pages", name)

  @doc "Fetches a route from the asset graph by name, raising if absent."
  @spec route!(String.t()) :: map()
  def route!(name), do: fetch_graph!("routes", name)

  defp fetch_graph!(section, name) do
    case get_in(graph(), [section, name]) do
      nil -> raise KeyError, key: name, term: "asset graph #{section}"
      value -> value
    end
  end
end
