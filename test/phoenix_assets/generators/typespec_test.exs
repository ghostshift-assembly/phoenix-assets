defmodule PhoenixAssets.Generators.TypespecTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias PhoenixAssets.Generators.{TS, Typespec}
  alias PhoenixAssets.Test.TypespecFixture

  test "renders a configured discriminated typespec union through shared TS helpers" do
    assert {:ok, output} =
             Typespec.render(TypespecFixture,
               root_name: "Event",
               discriminator_name: "EventMode",
               types: [:created, :removed]
             )

    assert output =~ TS.header()
    assert output =~ "export type EventMode = \"created\" | \"removed\""
    assert output =~ "export type Event =\n  | Created\n  | Removed"
    assert output =~ "userId: number"
    assert output =~ "labels: string[]"
    assert output =~ ~s(reason: string | null)
  end

  test "writes the rendered artifact" do
    output = Path.join(System.tmp_dir!(), "phoenix-assets-typespec-#{System.unique_integer()}.ts")
    on_exit(fn -> File.rm(output) end)

    assert :ok = Typespec.write(TypespecFixture, output, root_name: "Event")
    assert File.read!(output) =~ "export type Event"
  end

  test "preserves JSON field names in root and referenced DTOs when selected" do
    assert {:ok, output} = Typespec.render(TypespecFixture, field_names: :preserve)
    assert output =~ "user_id: number"
    refute output =~ "userId:"
    assert {:ok, root} = Typespec.render(TypespecFixture, root: :created, field_names: :preserve)
    assert root =~ "user_id: number"

    assert_raise ArgumentError, ~r/field_names/, fn ->
      Typespec.render(TypespecFixture, field_names: :invalid)
    end
  end

  test "renders opaque types, optional map fields, booleans, and arrays of unions" do
    assert {:ok, output} = Typespec.render(TypespecFixture.EdgeCases, [])
    assert output =~ "export type OpaqueId = string"
    assert output =~ "label?: string"
    assert output =~ "enabled: true"
    assert output =~ "disabled: false"
    assert output =~ "values: Array<string | null>"
    assert output =~ "nested: { note?: string }"
    refute output =~ ~s([key: "label"])
  end

  test "a missing configured root reports the source and missing type" do
    assert_raise ArgumentError, ~r/typespec root :absent is not declared/, fn ->
      Typespec.render(TypespecFixture, root: :absent)
    end
  end
end
