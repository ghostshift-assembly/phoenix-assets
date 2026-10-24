defmodule Refpath.Presentation.ResultFrame do
  @moduledoc "A bounded typed schema, ordered rows, and their execution evidence."

  alias Refpath.Presentation.ResultField

  @derive Jason.Encoder
  @enforce_keys [:fields, :rows, :provenance, :freshness, :classification, :page]
  defstruct fields: [], rows: [], provenance: %{}, freshness: %{}, classification: %{}, page: %{}

  @type t :: %__MODULE__{
          fields: [ResultField.t()],
          rows: [[term()]],
          provenance: map(),
          freshness: map(),
          classification: map(),
          page: map()
        }
end
