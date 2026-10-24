defmodule PhoenixAssets.EnumsTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias PhoenixAssets.{Config, Context, Enums}

  defmodule QuotaLevel do
    @moduledoc false
    use Ash.Type.Enum, values: [:ok, :warned, :blocked]

    def display_name(:ok), do: "OK"
    def display_name(:warned), do: "Warned"
    def display_name(:blocked), do: "Blocked"

    def description(:ok), do: "Within quota."
    def description(:warned), do: "At or above 80% of quota."
    def description(:blocked), do: "At quota."
  end

  defmodule BareLevel do
    @moduledoc false
    use Ash.Type.Enum, values: [:not_started, :in_progress]
  end

  defmodule Other.BareLevel do
    @moduledoc false
    use Ash.Type.Enum, values: [:different]
  end

  test "refuses ambiguous groups before silently replacing published values" do
    context = ctx()
    {:ok, state} = Enums.init([only: [BareLevel, Other.BareLevel]], context)

    assert_raise ArgumentError, ~r/enum group "bare_level" collides.*only:/, fn ->
      Enums.generated_files(context, state)
    end
  end

  defp ctx(stack \\ []) do
    tmp = Path.join(System.tmp_dir!(), "enum_#{System.unique_integer([:positive])}")
    File.mkdir_p!(tmp)
    on_exit(fn -> File.rm_rf!(tmp) end)

    config = Config.load!(otp_app: :my_app, asset_root: tmp, stack: stack)
    Context.new(config, env: :test, plugins: [{Enums, []}])
  end

  defp decode(file), do: file.contents |> IO.iodata_to_binary() |> JSON.decode!()

  test "emits value, label, and description per enum, keyed by locale" do
    context = ctx()
    {:ok, state} = Enums.init([only: [QuotaLevel], locales: ["en"]], context)

    assert [file] = Enums.generated_files(context, state)
    assert file.kind == :enums
    assert Path.basename(file.path) == "enums.json"

    assert %{"en" => %{"quota_level" => options}} = decode(file)

    assert options == [
             %{"value" => "ok", "label" => "OK", "description" => "Within quota."},
             %{
               "value" => "warned",
               "label" => "Warned",
               "description" => "At or above 80% of quota."
             },
             %{"value" => "blocked", "label" => "Blocked", "description" => "At quota."}
           ]
  end

  # An enum that defines no display_name still has to render in a select box.
  test "humanizes values for an enum that declares no labels" do
    context = ctx()
    {:ok, state} = Enums.init([only: [BareLevel], locales: ["en"]], context)

    assert %{"en" => %{"bare_level" => options}} =
             decode(hd(Enums.generated_files(context, state)))

    assert Enum.map(options, & &1["label"]) == ["Not Started", "In Progress"]
    assert Enum.map(options, & &1["description"]) == ["", ""]
  end

  test "emits one block per configured locale" do
    context = ctx()
    {:ok, state} = Enums.init([only: [QuotaLevel], locales: ["en", "sv"]], context)

    assert %{"en" => _, "sv" => _} = decode(hd(Enums.generated_files(context, state)))
  end

  test "reads its configuration from the :stack" do
    context = ctx(enums: [only: [QuotaLevel], locales: ["en"]])
    {:ok, state} = Enums.init([], context)

    assert [_] = Enums.generated_files(context, state)
  end

  test "discovers enums from configured dependency applications" do
    app = :phoenix_assets_enum_fixture

    assert :ok =
             :application.load(
               {:application, app,
                [
                  description: ~c"phoenix_assets enum fixture",
                  vsn: ~c"1",
                  modules: [QuotaLevel]
                ]}
             )

    on_exit(fn -> :application.unload(app) end)

    context = ctx(enums: [apps: [app], locales: ["en"]])
    {:ok, state} = Enums.init([], context)

    assert %{"en" => %{"quota_level" => _}} =
             decode(hd(Enums.generated_files(context, state)))
  end

  test "generates nothing when no enum modules are found" do
    context = ctx()
    {:ok, state} = Enums.init([only: []], context)

    assert Enums.generated_files(context, state) == []
    assert Enums.graph_entries(context, state) == []
  end

  test "contributes one graph entry per enum" do
    context = ctx()
    {:ok, state} = Enums.init([only: [QuotaLevel, BareLevel]], context)

    assert Enum.map(Enums.graph_entries(context, state), & &1.key) == [
             "bare_level",
             "quota_level"
           ]
  end

  # Byte-identical output for identical input is what makes the no-write fast
  # path and the --check drift gate meaningful.
  test "renders deterministically" do
    context = ctx()
    {:ok, state} = Enums.init([only: [QuotaLevel, BareLevel], locales: ["sv", "en"]], context)

    first = hd(Enums.generated_files(context, state)).contents
    second = hd(Enums.generated_files(context, state)).contents

    assert IO.iodata_to_binary(first) == IO.iodata_to_binary(second)
  end

  test "the doctor reports how many enums were discovered" do
    context = ctx()
    {:ok, state} = Enums.init([only: [QuotaLevel]], context)

    assert [check] = Enums.doctor_checks(context, state)
    assert check.run.(context).status == :ok
  end
end
