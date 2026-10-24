defmodule PhoenixAssets.DoctorTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias PhoenixAssets.{Config, Context, Doctor}
  alias PhoenixAssets.Doctor.Check

  defmodule CrashPlugin do
    @moduledoc false
    use PhoenixAssets.Plugin

    def doctor_checks(_, _) do
      [Check.new(id: :boom, run: fn _ -> raise "kaboom" end)]
    end
  end

  defmodule StalePlugin do
    @moduledoc false
    use PhoenixAssets.Plugin

    def generated_files(_, _) do
      [
        PhoenixAssets.GeneratedFile.new(
          path: "phoenix/never_written.ts",
          contents: "export const x = 1\n",
          plugin: :probe,
          kind: :probe
        )
      ]
    end
  end

  defmodule FailPlugin do
    @moduledoc false
    use PhoenixAssets.Plugin

    def init(_, _), do: {:error, :boom}
  end

  defp ctx(plugins \\ [], opts \\ []) do
    tmp = Path.join(System.tmp_dir!(), "doc_#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(tmp, "node_modules/.bin"))
    on_exit(fn -> File.rm_rf!(tmp) end)
    config = Config.load!([otp_app: :my_app, asset_root: tmp, static_root: tmp] ++ opts)
    Context.new(config, env: :test, plugins: plugins)
  end

  # SSR requires a Vite manifest; SPA production checks its own index.html.
  defp ssr_ctx, do: ctx([], serve_mode: :ssr)

  defp result_for(results, id) do
    Enum.find_value(results, fn {check, r} -> if check.id == id, do: r end)
  end

  test "passes in a non-production setup with a present asset root" do
    {status, _} = Doctor.run(ctx())
    assert status == :ok
  end

  test "errors in production when the manifest is missing" do
    {status, results} = Doctor.run(ssr_ctx(), production: true)

    assert status == :error

    assert Enum.any?(results, fn {check, r} ->
             check.id == :manifest_present and r.status == :error
           end)
  end

  test "production-only checks are skipped in non-production runs" do
    {_, results} = Doctor.run(ctx())
    refute Enum.any?(results, fn {check, _} -> check.id == :manifest_present end)
  end

  test "a crashing check is captured as an error, not propagated" do
    {status, results} = Doctor.run(ctx([{CrashPlugin, []}]))

    assert status == :error
    assert Enum.any?(results, fn {check, r} -> check.id == :boom and r.status == :error end)
  end

  test "errors when the asset root is missing" do
    config = Config.load!(otp_app: :my_app, asset_root: "/no/such/dir-#{System.unique_integer()}")
    {status, results} = Doctor.run(Context.new(config, env: :test))

    assert status == :error
    assert result_for(results, :asset_root).status == :error
  end

  test "passes the manifest check in production when the manifest is present" do
    context = ssr_ctx()
    path = Context.manifest_path(context)
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, ~s({"src/app.ts":{"file":"assets/app.js"}}))

    {_, results} = Doctor.run(context, production: true)
    assert result_for(results, :manifest_present).status == :ok
  end

  test "fails the manifest check when the file is not a JSON object" do
    context = ssr_ctx()
    path = Context.manifest_path(context)
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, "[]")

    {status, results} = Doctor.run(context, production: true)
    assert status == :error
    assert result_for(results, :manifest_present).status == :error
  end

  test "the default :spa serve_mode needs no server-rendered manifest" do
    context = ctx()
    {_, missing} = Doctor.run(context, production: true)
    assert result_for(missing, :manifest_present).status == :error
    path = Path.join(context.static_root, "index.html")
    File.write!(path, "")
    {_, empty} = Doctor.run(context, production: true)
    assert result_for(empty, :manifest_present).status == :error
    File.write!(path, "<!doctype html><main>SPA</main>")
    {_, results} = Doctor.run(context, production: true)
    assert result_for(results, :manifest_present).status == :ok
  end

  test "errors in production when generated contracts are stale" do
    {_, results} = Doctor.run(ctx([{StalePlugin, []}]), production: true)
    assert result_for(results, :generated_fresh).status == :error
  end

  test "skips plugin checks when a plugin fails to initialise" do
    {_, results} = Doctor.run(ctx([{FailPlugin, []}]))
    ids = Enum.map(results, fn {check, _} -> check.id end)

    assert :asset_root in ids
    refute :boom in ids
  end

  test "errors in production when a plugin fails to initialise (graph would be incomplete)" do
    {_, results} = Doctor.run(ctx([{FailPlugin, []}]), production: true)
    assert result_for(results, :graph_complete).status == :error
  end

  test "passes the graph_complete check when all plugins initialise" do
    {_, results} = Doctor.run(ctx(), production: true)
    assert result_for(results, :graph_complete).status == :ok
  end

  test "errors when node_modules is missing, with an install hint" do
    tmp = Path.join(System.tmp_dir!(), "nm_#{System.unique_integer([:positive])}")
    File.mkdir_p!(tmp)
    on_exit(fn -> File.rm_rf!(tmp) end)

    config = Config.load!(otp_app: :my_app, asset_root: tmp)
    {status, results} = Doctor.run(Context.new(config, env: :test))

    assert status == :error
    assert result_for(results, :node_modules).status == :error
    assert result_for(results, :node_modules).hint =~ "pnpm install"
  end

  defp budget_ctx(max_kb) do
    context = ctx()
    manifest_path = Context.manifest_path(context)
    File.mkdir_p!(Path.dirname(manifest_path))

    File.write!(
      manifest_path,
      JSON.encode!(%{"src/app.ts" => %{"file" => "assets/app.js", "isEntry" => true}})
    )

    app_js = Path.join(context.static_root, "assets/app.js")
    File.mkdir_p!(Path.dirname(app_js))
    File.write!(app_js, String.duplicate("x", 2048))

    config =
      Config.load!(
        otp_app: :my_app,
        asset_root: context.asset_root,
        static_root: context.static_root,
        build: [
          vite_manifest: manifest_path,
          budgets: [{"src/app.ts", max_kb}]
        ]
      )

    Context.new(config, env: :test)
  end

  test "a bundle within its budget passes; one over it errors" do
    {_, results} = Doctor.run(budget_ctx(4), production: true)
    assert result_for(results, :bundle_budget).status == :ok

    {status, results} = Doctor.run(budget_ctx(1), production: true)
    assert status == :error
    assert result_for(results, :bundle_budget).status == :error
    assert result_for(results, :bundle_budget).message =~ "over its 1 KiB budget"
  end

  test "warns about publicly served source maps unless explicitly allowed" do
    context = ctx()
    File.mkdir_p!(Path.join(context.static_root, "assets"))
    File.write!(Path.join(context.static_root, "assets/app.js.map"), "{}")
    manifest_path = Context.manifest_path(context)
    File.mkdir_p!(Path.dirname(manifest_path))
    File.write!(manifest_path, "{}")

    {_, results} = Doctor.run(context, production: true)
    assert result_for(results, :source_maps).status == :warn

    allowed =
      Config.load!(
        otp_app: :my_app,
        asset_root: context.asset_root,
        static_root: context.static_root,
        build: [allow_source_maps: true]
      )

    {_, results} = Doctor.run(Context.new(allowed, env: :test), production: true)
    assert result_for(results, :source_maps).status == :ok
  end

  test "plugin failures fail ordinary diagnostics and never claim fresh contracts" do
    context = ctx([{FailPlugin, []}])
    assert {:error, results} = Doctor.run(context)
    assert result_for(results, :plugin_init).message =~ "FailPlugin"
    assert {:error, results} = Doctor.run(context, production: true)
    assert result_for(results, :generated_fresh).status == :error
  end

  test "source map remediation requires removing files from served output" do
    context = ctx()
    File.write!(Path.join(context.static_root, "app.js.map"), "{}")
    {_, results} = Doctor.run(context, production: true)
    assert result_for(results, :source_maps).hint =~ "remove them from the served output"
  end
end
