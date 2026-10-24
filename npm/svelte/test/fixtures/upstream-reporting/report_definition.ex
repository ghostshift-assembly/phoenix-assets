defmodule Refpath.Presentation.ReportDefinition do
  @moduledoc """
  Renderer-neutral report configuration validated by `Refpath.Presentation`.

  Query references remain opaque to this value object. The domain that owns a
  query is responsible for authorization and execution.
  """

  alias Refpath.Presentation.PanelDefinition

  @derive Jason.Encoder
  @enforce_keys [:schema_version, :title, :description, :panels, :layout, :provenance]
  defstruct [
    :id,
    :schema_version,
    :title,
    :description,
    :layout,
    :provenance,
    panels: [],
    parameters: []
  ]

  @type t :: %__MODULE__{
          id: String.t() | nil,
          schema_version: String.t(),
          title: String.t(),
          description: String.t(),
          panels: [PanelDefinition.t()],
          layout: map(),
          parameters: [map()],
          provenance: map()
        }
end
