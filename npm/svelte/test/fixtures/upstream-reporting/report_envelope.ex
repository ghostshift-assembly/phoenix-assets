defmodule Refpath.Presentation.ReportEnvelope do
  @moduledoc "A validated report definition bound to independently typed panel states."

  alias Refpath.Presentation.ReportDefinition

  @derive Jason.Encoder
  @enforce_keys [:definition, :results, :capability_warnings, :generated_at]
  defstruct [:definition, :results, :generated_at, capability_warnings: []]

  @type t :: %__MODULE__{
          definition: ReportDefinition.t(),
          results: %{required(String.t()) => map()},
          capability_warnings: [map()],
          generated_at: DateTime.t()
        }
end
