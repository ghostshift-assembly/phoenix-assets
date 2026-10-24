defmodule Refpath.Presentation.VisualizationDefinition do
  @moduledoc "Closed, renderer-neutral visualization intent for a result frame."

  @derive Jason.Encoder
  @enforce_keys [:kind, :encodings, :summary_template]
  defstruct [
    :kind,
    :encodings,
    :summary_template,
    formats: %{},
    sort: [],
    stack: "none",
    annotations: [],
    interaction: %{}
  ]

  @type kind ::
          :number | :table | :line | :area | :bar | :scatter | :heatmap | :gauge | :sparkline

  @type t :: %__MODULE__{
          kind: kind(),
          encodings: %{optional(String.t()) => String.t()},
          formats: map(),
          sort: [map()],
          stack: :none | :normal | :normalized,
          annotations: [map()],
          interaction: map(),
          summary_template: String.t()
        }
end
