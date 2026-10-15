defmodule PhoenixAssets.Presets.SvelteHttpTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias PhoenixAssets.{Config, Context, Generated}

  doctest PhoenixAssets.Presets.SvelteHttp

  defmodule Commands do
    @moduledoc false
    use PhoenixAssets.Commands.Definitions

    command(:save_item, route: "/items/:id", params: [id: :string], body: [name: :string])
  end

  defmodule Session do
    @moduledoc false
    use PhoenixAssets.Session.Fields

    route("/session")
    field(:user_id, :string)
  end

  defmodule Topics do
    @moduledoc false
    use PhoenixAssets.PubSub.Topics

    topic(:item, pattern: "item:{id}", events: [changed: %{name: :string}])
  end

  test "the configured HTTP preset retains commands and topics without sync generation" do
    config =
      PhoenixAssets.Config.load!(
        otp_app: :phoenix_assets,
        preset: PhoenixAssets.Presets.SvelteHttp
      )

    plugins = PhoenixAssets.Config.preset_plugins(config)
    modules = Enum.map(plugins, &elem(&1, 0))
    assert PhoenixAssets.Commands in modules
    assert PhoenixAssets.PubSub in modules
    refute PhoenixAssets.Electric in modules
    assert hd(modules) == PhoenixAssets.SvelteKit
  end

  test "the complete HTTP preset generates commands, sessions and topics without sync output" do
    root = Path.join(System.tmp_dir!(), "pa_http_#{System.unique_integer([:positive])}")
    on_exit(fn -> File.rm_rf!(root) end)

    config =
      Config.load!(
        otp_app: :phoenix_assets,
        preset: PhoenixAssets.Presets.SvelteHttp,
        asset_root: root,
        stack: [commands: Commands, session: Session, topics: Topics]
      )

    ctx = Context.new(config, env: :test, plugins: Config.preset_plugins(config))
    assert {:ok, %{written: written}} = Generated.generate(ctx)
    generated = Path.join(root, config.generated_dir)

    for name <- ~w(commands.ts session.ts pubsub.ts) do
      assert File.exists?(Path.join(generated, name))
    end

    commands = File.read!(Path.join(generated, "commands.ts"))
    assert commands =~ ~s|from "@phoenix-assets/svelte/core"|
    assert commands =~ "/items/:id"
    assert File.read!(Path.join(generated, "session.ts")) =~ "user_id: string"
    assert File.read!(Path.join(generated, "pubsub.ts")) =~ "item:changed"
    refute Enum.any?(written, &String.ends_with?(&1, "electric.ts"))
    refute File.exists?(Path.join(generated, "electric.ts"))

    assert {:ok, %{written: [], unchanged: unchanged}} = Generated.generate(ctx)
    assert Enum.sort(unchanged) == Enum.sort(written)
    assert :ok = Generated.generate(ctx, check: true)
  end
end
