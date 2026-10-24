defmodule Refpath.Presentation.PanelDefinition do
  @moduledoc "A single query-backed panel in a portable report definition."

  alias Refpath.Presentation.VisualizationDefinition

  @derive Jason.Encoder
  @enforce_keys [
    :id,
    :title,
    :description,
    :query_ref,
    :visualization,
    :table_columns,
    :empty_message
  ]
  defstruct [
    :id,
    :title,
    :description,
    :query_ref,
    :visualization,
    table_columns: [],
    empty_message: ""
  ]

  @type t :: %__MODULE__{
          id: String.t(),
          title: String.t(),
          description: String.t(),
          query_ref: String.t(),
          visualization: VisualizationDefinition.t(),
          table_columns: [String.t()],
          empty_message: String.t()
        }
end
