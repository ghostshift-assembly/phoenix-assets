defmodule Refpath.Presentation do
  @moduledoc """
  Public boundary for renderer-neutral report definitions and typed result frames.

  This module validates values; it does not authorize query references, execute
  queries, persist reports, or render charts. Those responsibilities remain with
  the owning domain and the negotiated client adapter.
  """

  alias Jason.OrderedObject
  alias Refpath.Presentation.RendererCapabilities
  alias Refpath.Presentation.ReportDefinition
  alias Refpath.Presentation.ReportEnvelope
  alias Refpath.Presentation.ResultFrame
  alias Refpath.Presentation.Validator

  @max_json_bytes 262_144

  @type decode_kind :: :definition | :frame | :envelope

  @doc "Validates and normalizes a portable report definition."
  @spec validate_definition(map() | ReportDefinition.t(), keyword()) ::
          {:ok, ReportDefinition.t()} | {:error, [Validator.error()]}
  def validate_definition(input, opts \\ []), do: Validator.definition(input, opts)

  @doc "Validates and normalizes a portable typed result frame."
  @spec validate_frame(map() | ResultFrame.t(), keyword()) ::
          {:ok, ResultFrame.t()} | {:error, [Validator.error()]}
  def validate_frame(input, opts \\ []), do: Validator.frame(input, opts)

  @doc "Validates a complete portable report transport envelope without renegotiating it."
  @spec validate_envelope(map() | ReportEnvelope.t(), keyword()) ::
          {:ok, ReportEnvelope.t()} | {:error, term()}
  def validate_envelope(input, opts \\ [])

  def validate_envelope(%ReportEnvelope{} = envelope, opts) do
    validate_envelope(Map.from_struct(envelope), opts)
  end

  def validate_envelope(%{} = input, opts) do
    with :ok <- strict_envelope_keys(input),
         {:ok, definition} <- validate_definition(value(input, "definition"), opts),
         results when is_map(results) <- value(input, "results"),
         {:ok, normalized_results} <- bind_results(definition, results, opts),
         warnings when is_list(warnings) <- value(input, "capability_warnings"),
         :ok <- Validator.json_value(warnings, ["capability_warnings"], opts),
         {:ok, generated_at} <- normalize_generated_at(value(input, "generated_at")) do
      {:ok,
       %ReportEnvelope{
         definition: definition,
         results: normalized_results,
         capability_warnings: warnings,
         generated_at: generated_at
       }}
    else
      nil -> {:error, {:invalid_frame, [], :required_envelope_member}}
      false -> {:error, {:invalid_frame, [], :invalid_envelope_member}}
      {:error, _} = error -> error
      _ -> {:error, {:invalid_frame, [], :invalid_envelope}}
    end
  end

  def validate_envelope(_, _), do: {:error, {:invalid_frame, [], :expected_object}}

  @doc """
  Selects table fallbacks for unsupported visualization kinds.

  Negotiation changes presentation intent only. It never mutates result values or
  asks the owner to execute a different query.
  """
  @spec negotiate(ReportDefinition.t() | map(), RendererCapabilities.t()) ::
          {:ok, ReportDefinition.t(), [map()]} | {:error, [Validator.error()]}
  def negotiate(definition, %RendererCapabilities{} = capabilities) do
    with {:ok, validated} <- validate_definition(definition),
         :ok <- validate_capabilities(validated, capabilities) do
      {panels, warnings} =
        Enum.map_reduce(validated.panels, [], &negotiate_panel(&1, &2, capabilities))

      {:ok, %{validated | panels: panels}, Enum.reverse(warnings)}
    end
  end

  @doc """
  Validates a definition and its independently evaluated panel states, then binds
  them into a transport envelope.

  Results are keyed by panel id. Supported states are `ok`, `empty`, `partial`,
  and `error`; `ok` and `partial` require a valid frame.
  """
  @spec bind(ReportDefinition.t() | map(), map(), RendererCapabilities.t(), keyword()) ::
          {:ok, ReportEnvelope.t()} | {:error, [term()]}
  def bind(definition, results, capabilities, opts \\ [])

  def bind(definition, results, %RendererCapabilities{} = capabilities, opts)
      when is_map(results) do
    with {:ok, effective, warnings} <- negotiate(definition, capabilities),
         {:ok, normalized_results} <- bind_results(effective, results, opts) do
      {:ok,
       %ReportEnvelope{
         definition: effective,
         results: normalized_results,
         capability_warnings: warnings,
         generated_at: Keyword.get_lazy(opts, :generated_at, &DateTime.utc_now/0)
       }}
    end
  end

  def bind(_, _, %RendererCapabilities{}, _),
    do: {:error, [{:invalid_frame, ["results"], :expected_object}]}

  @doc "Encodes a presentation value with recursively sorted JSON object keys."
  # The struct literal is deliberate: Protocol.UndefinedError defines no t/0,
  # and Jason.encode/2's error tuple really carries that exception struct —
  # any wider type (Exception.t()) re-trips dialyzer's :underspecs check.
  # credo:disable-for-lines:3 Credo.Check.Warning.SpecWithStruct
  @spec encode(term()) ::
          {:ok, String.t()}
          | {:error, Jason.EncodeError.t() | Jason.DecodeError.t() | %Protocol.UndefinedError{}}
  def encode(value) do
    with {:ok, json} <- Jason.encode(value, maps: :strict),
         {:ok, plain} <- Jason.decode(json) do
      plain
      |> canonicalize()
      |> Jason.encode(maps: :strict)
    end
  end

  @doc "Decodes size-bounded JSON and validates it as the requested value kind."
  @spec decode(binary(), decode_kind(), keyword()) ::
          {:ok, ReportDefinition.t() | ResultFrame.t()} | {:error, term()}
  def decode(json, kind, opts \\ [])

  def decode(json, kind, opts) when is_binary(json) do
    if byte_size(json) > Keyword.get(opts, :max_json_bytes, @max_json_bytes) do
      {:error, {:limit_exceeded, :json_bytes}}
    else
      decode_value(json, kind, opts)
    end
  end

  def decode(_, _, _), do: {:error, :expected_json_binary}

  defp validate_capabilities(definition, capabilities) do
    major =
      definition.schema_version
      |> String.split(".", parts: 2)
      |> hd()
      |> String.to_integer()

    cond do
      major not in capabilities.schema_majors ->
        {:error, [{:invalid_definition, ["schema_version"], :unsupported_schema_version}]}

      length(definition.panels) > capabilities.max_panels ->
        {:error, [{:invalid_definition, ["panels"], {:limit_exceeded, :renderer_max_panels}}]}

      not capabilities.accessible_table ->
        {:error, [{:invalid_definition, [], :accessible_table_required}]}

      :table not in capabilities.visualization_kinds ->
        {:error, [{:invalid_definition, [], :table_fallback_required}]}

      true ->
        :ok
    end
  end

  defp bind_results(definition, results, opts) do
    panel_ids = MapSet.new(definition.panels, & &1.id)
    result_ids = MapSet.new(Map.keys(results), &to_string/1)

    unknown =
      result_ids
      |> MapSet.difference(panel_ids)
      |> MapSet.to_list()

    missing =
      panel_ids
      |> MapSet.difference(result_ids)
      |> MapSet.to_list()

    cond do
      unknown != [] ->
        {:error, [{:invalid_frame, ["results"], {:unknown_panels, Enum.sort(unknown)}}]}

      missing != [] ->
        {:error, [{:invalid_frame, ["results"], {:missing_panels, Enum.sort(missing)}}]}

      true ->
        Enum.reduce_while(definition.panels, {:ok, %{}}, fn panel, {:ok, acc} ->
          reduce_panel_result(panel, results, opts, acc)
        end)
    end
  end

  defp panel_result(panel, result, opts) when is_map(result) do
    state = value(result, "state")

    case normalize_state(state) do
      state when state in [:ok, :partial] ->
        with {:ok, frame} <- validate_frame(value(result, "frame"), opts),
             :ok <- Validator.bind_panel(panel, frame) do
          {:ok, %{"state" => Atom.to_string(state), "frame" => frame}}
        end

      state when state in [:empty, :error] ->
        detail = value(result, "detail")

        case Validator.json_value(detail, ["results", panel.id, "detail"], opts) do
          :ok -> {:ok, %{"state" => Atom.to_string(state), "detail" => detail}}
          {:error, error} -> {:error, [error]}
        end

      _ ->
        {:error, [{:invalid_frame, ["results", panel.id, "state"], :invalid_panel_state}]}
    end
  end

  defp panel_result(panel, _, _),
    do: {:error, [{:invalid_frame, ["results", panel.id], :expected_object}]}

  defp negotiate_panel(panel, warnings, capabilities) do
    if panel.visualization.kind in capabilities.visualization_kinds do
      {panel, warnings}
    else
      warning = %{
        "code" => "unsupported_visualization_kind",
        "panel_id" => panel.id,
        "requested_kind" => Atom.to_string(panel.visualization.kind),
        "effective_kind" => "table"
      }

      visualization = %{panel.visualization | kind: :table, encodings: %{}}
      {%{panel | visualization: visualization}, [warning | warnings]}
    end
  end

  defp decode_value(json, kind, opts) do
    with {:ok, value} <- Jason.decode(json) do
      validate_decoded_value(value, kind, opts)
    end
  end

  defp validate_decoded_value(value, :definition, opts), do: validate_definition(value, opts)
  defp validate_decoded_value(value, :frame, opts), do: validate_frame(value, opts)
  defp validate_decoded_value(value, :envelope, opts), do: validate_envelope(value, opts)
  defp validate_decoded_value(_, _, _), do: {:error, :unsupported_decode_kind}

  defp strict_envelope_keys(input) do
    allowed = ~w(definition results capability_warnings generated_at)

    unknown =
      input
      |> Map.keys()
      |> Enum.map(fn
        key when is_atom(key) -> Atom.to_string(key)
        key when is_binary(key) -> key
        key -> inspect(key)
      end)
      |> Enum.reject(&(&1 in allowed))

    if unknown == [],
      do: :ok,
      else: {:error, {:invalid_frame, [], {:unknown_keys, Enum.sort(unknown)}}}
  end

  defp normalize_generated_at(%DateTime{} = generated_at), do: {:ok, generated_at}

  defp normalize_generated_at(generated_at) when is_binary(generated_at) do
    case DateTime.from_iso8601(generated_at) do
      {:ok, datetime, _} -> {:ok, datetime}
      _ -> {:error, {:invalid_frame, ["generated_at"], :invalid_datetime}}
    end
  end

  defp normalize_generated_at(_),
    do: {:error, {:invalid_frame, ["generated_at"], :invalid_datetime}}

  defp reduce_panel_result(panel, results, opts, acc) do
    result = Map.get(results, panel.id, Map.get(results, existing_atom_key(results, panel.id)))

    case panel_result(panel, result, opts) do
      {:ok, normalized} -> {:cont, {:ok, Map.put(acc, panel.id, normalized)}}
      {:error, _} = error -> {:halt, error}
    end
  end

  defp normalize_state(state) when state in [:ok, :empty, :partial, :error], do: state
  defp normalize_state("ok"), do: :ok
  defp normalize_state("empty"), do: :empty
  defp normalize_state("partial"), do: :partial
  defp normalize_state("error"), do: :error
  defp normalize_state(_), do: nil

  defp value(map, key) do
    Map.get(map, key) ||
      case Enum.find(map, fn {candidate, _} ->
             is_atom(candidate) and Atom.to_string(candidate) == key
           end) do
        {_, found} -> found
        nil -> nil
      end
  end

  defp existing_atom_key(map, key) do
    Enum.find_value(Map.keys(map), fn candidate ->
      if is_atom(candidate) and Atom.to_string(candidate) == key, do: candidate
    end)
  end

  defp canonicalize(value) when is_map(value) do
    values =
      value
      |> Enum.map(fn {key, nested} -> {key, canonicalize(nested)} end)
      |> Enum.sort_by(&elem(&1, 0))

    OrderedObject.new(values)
  end

  defp canonicalize(value) when is_list(value), do: Enum.map(value, &canonicalize/1)
  defp canonicalize(value), do: value
end
