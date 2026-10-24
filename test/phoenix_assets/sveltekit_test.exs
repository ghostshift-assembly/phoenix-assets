defmodule PhoenixAssets.SvelteKitTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias PhoenixAssets.{Config, Context, SvelteKit}

  defp ctx, do: Context.new(Config.load!(otp_app: :my_app), env: :test)

  test "doctor accepts Vite plugin configuration and the legacy SvelteKit 2 file" do
    directory =
      Path.join(System.tmp_dir!(), "sveltekit-config-#{System.unique_integer([:positive])}")

    File.mkdir_p!(directory)
    on_exit(fn -> File.rm_rf!(directory) end)
    context = Context.new(Config.load!(otp_app: :my_app, asset_root: directory), env: :test)
    check = Enum.find(SvelteKit.doctor_checks(context, %{}), &(&1.id == :svelte_config))
    assert check.run.(context).status == :warn

    for file <- ["vite.config.ts", "vite.config.js", "svelte.config.js"] do
      path = Path.join(directory, file)
      File.write!(path, "export default {}")
      assert check.run.(context).status == :ok
      File.rm!(path)
    end
  end

  test "contributes a supervised vite dev process" do
    {:ok, state} = SvelteKit.init([], ctx())
    assert [%{id: :vite}] = SvelteKit.dev_processes(ctx(), state)
  end

  test "the default vite command carries the configured host and port" do
    config = Config.load!(otp_app: :my_app, dev: [vite: [host: "0.0.0.0", port: 5180]])
    context = Context.new(config, env: :test)

    {:ok, state} = SvelteKit.init([], context)
    [%{port: 5180, command: command}] = SvelteKit.dev_processes(context, state)

    assert hd(command) =~ "node_modules/.bin/vite"
    assert ["--host", "0.0.0.0", "--port", "5180", "--strictPort"] = tl(command)
  end

  test "generates the env contract" do
    {:ok, state} = SvelteKit.init([], ctx())
    kinds = ctx() |> SvelteKit.generated_files(state) |> Enum.map(& &1.kind)
    assert :env in kinds
  end

  test "param segments contribute to the page key" do
    tmp = Path.join(System.tmp_dir!(), "sk_#{System.unique_integer([:positive])}")
    page = Path.join([tmp, "src", "routes", "[slug]", "+page.svelte"])
    File.mkdir_p!(Path.dirname(page))
    File.write!(page, "")
    on_exit(fn -> File.rm_rf!(tmp) end)

    context = Context.new(Config.load!(otp_app: :my_app, asset_root: tmp), env: :test)
    {:ok, state} = SvelteKit.init([], context)

    assert [entry] = SvelteKit.graph_entries(context, state)
    assert entry.key == "BySlug"
    assert entry.data == %{"route" => "/:slug"}
  end

  # SvelteKit advanced-routing segments map onto the graph's Phoenix-style
  # routes/keys: rest -> `*glob`, optional -> `:param` (optionality is not
  # recorded), and a matcher constraint (`=integer`) is dropped.
  defp graph_entry_for(route_dir) do
    tmp = Path.join(System.tmp_dir!(), "sk_#{System.unique_integer([:positive])}")
    page = Path.join([tmp, "src", "routes", route_dir, "+page.svelte"])
    File.mkdir_p!(Path.dirname(page))
    File.write!(page, "")
    on_exit(fn -> File.rm_rf!(tmp) end)

    context = Context.new(Config.load!(otp_app: :my_app, asset_root: tmp), env: :test)
    {:ok, state} = SvelteKit.init([], context)
    [entry] = SvelteKit.graph_entries(context, state)
    entry
  end

  test "a rest param ([...slug]) becomes a glob route and a By-key" do
    entry = graph_entry_for("blog/[...slug]")
    assert entry.data == %{"route" => "/blog/*slug"}
    assert entry.key == "BlogBySlug"
  end

  test "an optional param ([[lang]]) becomes a required-style route and a By-key" do
    entry = graph_entry_for("[[lang]]/about")
    assert entry.data == %{"route" => "/:lang/about"}
    assert entry.key == "ByLangAbout"
  end

  test "a matcher constraint ([id=integer]) is dropped from the route and key" do
    entry = graph_entry_for("items/[id=integer]")
    assert entry.data == %{"route" => "/items/:id"}
    assert entry.key == "ItemsById"
  end

  test "a param route and its static sibling get distinct page keys" do
    tmp = Path.join(System.tmp_dir!(), "sk_#{System.unique_integer([:positive])}")

    for dir <- ["users", "users/[id]"] do
      page = Path.join([tmp, "src", "routes", dir, "+page.svelte"])
      File.mkdir_p!(Path.dirname(page))
      File.write!(page, "")
    end

    on_exit(fn -> File.rm_rf!(tmp) end)

    context = Context.new(Config.load!(otp_app: :my_app, asset_root: tmp), env: :test)
    {:ok, state} = SvelteKit.init([], context)
    keys = context |> SvelteKit.graph_entries(state) |> Enum.map(& &1.key) |> Enum.sort()

    assert keys == ["Users", "UsersById"]
  end
end
