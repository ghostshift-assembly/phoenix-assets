defmodule Refpath.Presentation.RendererCapabilities do
  @moduledoc "Bounded feature declaration used for deterministic report fallback."

  @derive Jason.Encoder
  defstruct schema_majors: [1],
            visualization_kinds: [:table, :number],
            max_panels: 32,
            max_rows: 10_000,
            max_series: 64,
            interaction_kinds: [],
            color: true,
            narrow_screen: false,
            accessible_table: true

  @type t :: %__MODULE__{
          schema_majors: [pos_integer()],
          visualization_kinds: [atom()],
          max_panels: pos_integer(),
          max_rows: pos_integer(),
          max_series: pos_integer(),
          interaction_kinds: [atom()],
          color: boolean(),
          narrow_screen: boolean(),
          accessible_table: boolean()
        }
end
