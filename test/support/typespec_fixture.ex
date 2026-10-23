defmodule PhoenixAssets.Test.TypespecFixture do
  @moduledoc false

  @type created :: %{type: :created, user_id: non_neg_integer(), labels: [String.t()]}
  @type removed :: %{type: :removed, reason: String.t() | nil}
  @type t :: created() | removed()
end

defmodule PhoenixAssets.Test.TypespecFixture.Untyped do
  @moduledoc false
  # Deliberately declares no `@type`, so the "nothing to render" path has
  # something honest to fail against.

  @doc false
  def noop, do: :ok
end

defmodule PhoenixAssets.Test.TypespecFixture.EdgeCases do
  @moduledoc false
  @opaque opaque_id :: String.t()
  @type item :: %{
          optional(:label) => String.t(),
          required(:enabled) => true,
          required(:disabled) => false,
          required(:values) => [String.t() | nil],
          required(:nested) => %{optional(:note) => String.t()}
        }
  @type t :: item() | opaque_id()
end
