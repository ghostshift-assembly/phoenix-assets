defmodule Refpath.Presentation.ResultField do
  @moduledoc "Typed field metadata for ordered portable result rows."

  @derive Jason.Encoder
  @enforce_keys [:name, :label, :type, :role, :nullable, :classification]
  defstruct [:name, :label, :type, :role, :unit, :nullable, :classification]

  @type value_type ::
          :boolean
          | :integer
          | :float
          | :decimal
          | :string
          | :date
          | :time
          | :datetime
          | :duration
  @type role :: :dimension | :measure | :time | :identifier
  @type classification :: :public | :internal | :confidential | :restricted

  @type t :: %__MODULE__{
          name: String.t(),
          label: String.t(),
          type: value_type(),
          role: role(),
          unit: String.t() | nil,
          nullable: boolean(),
          classification: classification()
        }
end
