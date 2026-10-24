defmodule PhoenixAssets.Doctor do
  @moduledoc """
  Runs configuration and production-readiness diagnostics.

  Collects the built-in core checks plus every plugin's `doctor_checks/2`, runs
  each against the context, and aggregates an overall status. A check tagged
  `production?: true` only runs under `run/2` with `production: true` (the CI/build
  path), where it can enforce things that are meaningless in development -- a
  present manifest, no stale generated contracts.

  A check that raises is captured and reported as an error rather than crashing
  the run.

  """

  alias PhoenixAssets.{Context, Engine, Generated, Manifest, Telemetry}
  alias PhoenixAssets.Doctor.Check

  @type result :: {Check.t(), Check.result()}

  @doc """
  Runs the diagnostics, returning `{status, results}`.

  `status` is `:ok` unless any check returned `:error`. With `production: true`,
  production-only checks are included.
  """
  @spec run(Context.t(), keyword()) :: {Check.status(), [result()]}
  def run(%Context{} = ctx, opts \\ []) do
    production? = Keyword.get(opts, :production, false)

    results =
      (builtin_checks(ctx) ++ plugin_checks(ctx))
      |> Enum.filter(&include?(&1, production?))
      |> Enum.map(fn check -> {check, safe_run(check, ctx)} end)

    status = if Enum.any?(results, fn {_, r} -> r.status == :error end), do: :error, else: :ok
    Telemetry.execute([:doctor, :run], %{checks: length(results)}, %{status: status})
    {status, results}
  end

  defp include?(%Check{production?: true}, production?), do: production?
  defp include?(_, _), do: true

  # A diagnostic must never take the doctor down with it: exceptions, exits,
  # and throws all surface as an error *result* for that one check.
  defp safe_run(%Check{run: run, id: id}, ctx) do
    run.(ctx)
  rescue
    exception -> Check.error("check #{id} crashed: #{Exception.message(exception)}")
  catch
    kind, reason -> Check.error("check #{id} crashed: #{inspect(kind)} #{inspect(reason)}")
  end

  defp plugin_checks(ctx) do
    case Engine.init_plugins(ctx) do
      {:ok, initialized} ->
        Engine.collect(ctx, initialized, :doctor_checks)

      {:error, {module, reason}} ->
        [
          Check.new(
            id: :plugin_init,
            group: :plugins,
            run: fn _ ->
              Check.error("plugin #{inspect(module)} failed to initialise: #{inspect(reason)}")
            end
          )
        ]
    end
  end

  defp builtin_checks(ctx) do
    [
      Check.new(id: :asset_root, group: :paths, run: &asset_root_check/1),
      Check.new(id: :package_manager, group: :tooling, run: &package_manager_check/1),
      Check.new(id: :node_modules, group: :tooling, run: &node_modules_check/1),
      Check.new(
        id: :generated_fresh,
        group: :generated,
        production?: true,
        run: &generated_check/1
      ),
      Check.new(id: :manifest_present, group: :build, production?: true, run: &manifest_check/1),
      Check.new(id: :source_maps, group: :build, production?: true, run: &source_maps_check/1),
      Check.new(
        id: :graph_complete,
        group: :generated,
        production?: true,
        run: &graph_complete_check/1
      )
    ] ++ budget_checks(ctx)
  end

  # One production check per configured bundle budget:
  #
  #     config :phoenix_assets, :build,
  #       budgets: [{"src/app.ts", 300}]   # entry key => max KiB (entry + imports + css)
  #
  # Every check keeps the stable `:bundle_budget` id -- the entry keys are
  # host-supplied strings, so minting a per-entry atom would be an unbounded
  # atom source. The entry is carried in each result message instead (including
  # the crash path in `budget_check/3`), which is what distinguishes lines.
  defp budget_checks(ctx) do
    ctx.config.build
    |> Keyword.get(:budgets, [])
    |> Enum.map(fn {entry, max_kb} ->
      Check.new(
        id: :bundle_budget,
        group: :build,
        production?: true,
        run: &budget_check(&1, entry, max_kb)
      )
    end)
  end

  defp asset_root_check(ctx) do
    if File.dir?(ctx.asset_root) do
      Check.ok("asset root #{ctx.asset_root} exists")
    else
      Check.error("asset root #{ctx.asset_root} is missing", "create it or set :asset_root")
    end
  end

  defp package_manager_check(ctx) do
    manager = to_string(ctx.package_manager)

    if System.find_executable(manager) do
      Check.ok("#{manager} is available")
    else
      Check.warn("#{manager} was not found on PATH", "install #{manager}")
    end
  end

  defp generated_check(ctx) do
    case Generated.generate(ctx, check: true) do
      :ok ->
        Check.ok("generated contracts are up to date")

      {:error, {:stale, _}} ->
        Check.error("generated contracts are stale", "run mix phoenix_assets.gen")

      {:error, reason} ->
        Check.error("generated contracts could not be checked: #{inspect(reason)}")
    end
  end

  # A plugin whose init/2 fails makes the graph builder degrade to an empty graph
  # (logged, plus a [:graph, :degraded] telemetry event, but otherwise invisible).
  # This turns that into a red production check. Checking init_plugins/1 directly
  # avoids false-positiving on an app that legitimately has an empty graph.
  defp graph_complete_check(ctx) do
    case Engine.init_plugins(ctx) do
      {:ok, _} ->
        Check.ok("all plugins initialise; the asset graph can be built")

      {:error, {module, reason}} ->
        Check.error(
          "plugin #{inspect(module)} failed to initialise — the asset graph would be " <>
            "incomplete (#{inspect(reason)})",
          "fix the plugin's configuration, then run mix phoenix_assets.gen"
        )
    end
  end

  defp manifest_check(%Context{config: %{serve_mode: :spa}} = ctx) do
    path = Path.join(ctx.static_root, "index.html")

    case File.read(path) do
      {:ok, bytes} when byte_size(bytes) > 0 ->
        Check.ok("SPA index.html is present; no server-rendered Vite manifest required")

      _ ->
        Check.error("SPA index.html missing or empty at #{path}", "run the production SPA build")
    end
  end

  defp manifest_check(ctx) do
    path = Context.manifest_path(ctx)

    case Manifest.load(path) do
      {:ok, _} ->
        Check.ok("Vite manifest is present and valid")

      {:error, :enoent} ->
        Check.error("Vite manifest missing at #{path}", "run the production asset build")

      {:error, reason} ->
        Check.error(
          "Vite manifest at #{path} is invalid (#{inspect(reason)})",
          "rebuild the production assets"
        )
    end
  end

  defp node_modules_check(ctx) do
    path = Path.join(ctx.asset_root, "node_modules")

    if File.dir?(path) do
      Check.ok("node_modules is present")
    else
      Check.error(
        "node_modules missing at #{path}",
        "run #{ctx.package_manager} install in #{ctx.asset_root}"
      )
    end
  end

  # Source maps under the served static root expose original sources publicly.
  # Hosts that serve them deliberately opt out with
  # `config :phoenix_assets, :build, allow_source_maps: true`; the recommended
  # production setup uploads maps to the error tracker and removes them from
  # the served output. Vite's `hidden` only removes the sourceMappingURL comment.
  defp source_maps_check(ctx) do
    cond do
      Keyword.get(ctx.config.build, :allow_source_maps, false) ->
        Check.ok("source maps are explicitly allowed in the static root")

      [] == Path.wildcard(Path.join(ctx.static_root, "**/*.map")) ->
        Check.ok("no source maps in the served static root")

      true ->
        Check.warn(
          "source maps found under #{ctx.static_root} and will be publicly served",
          "upload source maps to your error tracker and remove them from the served output, or set " <>
            "build: [allow_source_maps: true] to silence"
        )
    end
  end

  defp budget_check(ctx, entry, max_kb) do
    with {:ok, manifest} <- Manifest.load(Context.manifest_path(ctx)),
         {:ok, total} <- entry_weight(ctx, manifest, entry) do
      kb = div(total + 1023, 1024)

      if total <= max_kb * 1024 do
        Check.ok("bundle #{entry} is #{kb} KiB (budget #{max_kb} KiB)")
      else
        Check.error(
          "bundle #{entry} is #{kb} KiB, over its #{max_kb} KiB budget",
          "split the entry or raise the budget in :build, :budgets"
        )
      end
    else
      _ ->
        Check.warn(
          "bundle budget for #{entry} could not be evaluated",
          "build the assets so the manifest and files exist"
        )
    end
  rescue
    exception ->
      Check.error("bundle budget for #{entry} crashed: #{Exception.message(exception)}")
  catch
    kind, reason ->
      Check.error("bundle budget for #{entry} crashed: #{inspect(kind)} #{inspect(reason)}")
  end

  defp entry_weight(ctx, manifest, entry) do
    hrefs =
      [Manifest.file(manifest, entry) | Manifest.imports(manifest, entry)] ++
        Manifest.css(manifest, entry)

    hrefs
    |> Enum.map(&Path.join(ctx.static_root, String.trim_leading(&1, "/")))
    |> Enum.reduce_while({:ok, 0}, fn path, {:ok, acc} ->
      case File.stat(path) do
        {:ok, %{size: size}} -> {:cont, {:ok, acc + size}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  rescue
    # Manifest.file/2 raises KeyError for an unknown entry key.
    e in KeyError -> {:error, e}
  end
end
