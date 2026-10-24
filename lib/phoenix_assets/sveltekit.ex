defmodule PhoenixAssets.SvelteKit do
  @moduledoc """
  Integration plugin for SvelteKit (with Vite) under `phoenix_assets`.

  Contributes the supervised Vite dev process, the core endpoint-route and env
  contracts, and asset-graph page entries discovered from the SvelteKit routes
  directory. Page-route *authority* stays with SvelteKit -- this plugin only
  records which `+page.svelte` files exist so the graph can link them to Phoenix
  routes, shapes, and topics.

  """

  use PhoenixAssets.Plugin

  alias PhoenixAssets.{Context, DevProcess, Graph}
  alias PhoenixAssets.Doctor.Check
  alias PhoenixAssets.Generators.{Env, Routes}

  @default_vite_port 5173

  @impl PhoenixAssets.Plugin
  def init(opts, _), do: {:ok, Map.new(opts)}

  @impl PhoenixAssets.Plugin
  def generated_files(ctx, _) do
    [Routes.generate(ctx), Env.generate(ctx)] |> Enum.reject(&is_nil/1)
  end

  @impl PhoenixAssets.Plugin
  def dev_processes(ctx, state) do
    vite = vite_opts(ctx, state)

    if Keyword.get(vite, :enabled, true) do
      [
        DevProcess.new(
          id: :vite,
          command: Keyword.get(vite, :command, default_vite_command(ctx, vite)),
          cd: ctx.asset_root,
          port: Keyword.get(vite, :port, @default_vite_port)
        )
      ]
    else
      []
    end
  end

  # Exec the Vite binary directly (see `Context.bin_path/2` for why a
  # package-manager wrapper would orphan the dev server). The command is built
  # from the same configured host/port that `PhoenixAssets.vite_dev_url/1`
  # reads, so the URLs the components emit always match the running server.
  defp default_vite_command(ctx, vite) do
    host = Keyword.get(vite, :host, "127.0.0.1")
    port = Keyword.get(vite, :port, @default_vite_port)
    [Context.bin_path(ctx, "vite"), "--host", host, "--port", to_string(port), "--strictPort"]
  end

  @impl PhoenixAssets.Plugin
  def graph_entries(%Context{} = ctx, _) do
    routes_dir = Path.join([ctx.asset_root, "src", "routes"])

    if File.dir?(routes_dir) do
      routes_dir
      |> Path.join("**/+page.svelte")
      |> Path.wildcard()
      |> Enum.map(&page_entry(ctx, routes_dir, &1))
    else
      []
    end
  end

  @impl PhoenixAssets.Plugin
  def doctor_checks(_, _) do
    [
      Check.new(
        id: :svelte_config,
        group: :sveltekit,
        run: &svelte_config_check/1
      ),
      Check.new(
        id: :package_json,
        group: :sveltekit,
        run: &file_check(&1, "package.json", "package.json")
      ),
      Check.new(id: :vite_binary, group: :sveltekit, run: &vite_binary_check/1)
    ]
  end

  # Host config (`config :phoenix_assets, :dev, vite: [...]`) overrides preset
  # `integration/2` opts, mirroring how the Storybook plugin reads its state.
  defp vite_opts(ctx, state),
    do: Keyword.merge(Map.to_list(state), ctx.config.dev[:vite] || [])

  defp page_entry(ctx, routes_dir, file) do
    relative = Path.relative_to(file, routes_dir)
    route = relative |> Path.dirname() |> sveltekit_route()

    Graph.Entry.new(
      kind: :page,
      key: page_key(route),
      data: %{"route" => route},
      source: Path.relative_to(file, ctx.asset_root)
    )
  end

  defp sveltekit_route("."), do: "/"

  defp sveltekit_route(dir) do
    segments =
      dir
      |> String.split("/")
      |> Enum.reject(&route_group?/1)
      |> Enum.map(&segment_to_route/1)

    "/" <> Enum.join(segments, "/")
  end

  defp route_group?(segment),
    do: String.starts_with?(segment, "(") and String.ends_with?(segment, ")")

  # SvelteKit param segments: `[id]` (required), `[[id]]` (optional), and
  # `[...id]` (rest), each with an optional `=matcher` constraint that has no
  # Phoenix path equivalent and is dropped. A rest param becomes a `*glob`;
  # required and optional both become `:id` (the graph records existence, not
  # optionality). https://svelte.dev/docs/kit/advanced-routing
  defp segment_to_route("[[" <> rest), do: ":" <> param_name(rest)
  defp segment_to_route("[..." <> rest), do: "*" <> param_name(rest)
  defp segment_to_route("[" <> rest), do: ":" <> param_name(rest)
  defp segment_to_route(segment), do: segment

  defp param_name(rest),
    do: rest |> String.trim_trailing("]") |> String.split("=", parts: 2) |> hd()

  defp page_key("/"), do: "Index"

  # Param segments contribute to the key (`/users/:id` -> `UsersById`) so a
  # param route can never collide with -- and silently displace -- its static
  # sibling (`/users` -> `Users`) in the graph's key-indexed page map.
  defp page_key(route) do
    route
    |> String.split("/")
    |> Enum.reject(&(&1 == ""))
    |> Enum.map_join("", &segment_key/1)
    |> case do
      "" -> "Index"
      key -> key
    end
  end

  defp segment_key(":" <> param), do: "By" <> Macro.camelize(param)
  defp segment_key("*" <> param), do: "By" <> Macro.camelize(param)
  defp segment_key(segment), do: Macro.camelize(segment)

  # SvelteKit 3 reads plugin options from Vite; legacy 2.x hosts may retain
  # svelte.config.js. Compilation and the host type check validate the contents.
  defp svelte_config_check(ctx) do
    files =
      ~w(vite.config.ts vite.config.js vite.config.mts vite.config.mjs vite.config.cts vite.config.cjs svelte.config.js)

    case Enum.find(files, &File.regular?(Path.join(ctx.asset_root, &1))) do
      nil -> Check.warn("SvelteKit configuration missing under #{ctx.asset_root}")
      file -> Check.ok("SvelteKit configuration present at #{file}")
    end
  end

  defp file_check(ctx, file, label) do
    path = Path.join(ctx.asset_root, file)

    if File.exists?(path) do
      Check.ok("#{label} present")
    else
      Check.warn("#{label} missing at #{path}")
    end
  end

  # Validates the exact binary the dev supervisor execs (`Context.bin_path/2`),
  # so "doctor says ok" and "vite actually starts" cannot diverge.
  defp vite_binary_check(ctx) do
    path = Context.bin_path(ctx, "vite")

    if File.exists?(path) do
      Check.ok("vite binary present")
    else
      Check.warn(
        "vite binary missing at #{path}",
        "run #{ctx.package_manager} install in #{ctx.asset_root}"
      )
    end
  end
end
