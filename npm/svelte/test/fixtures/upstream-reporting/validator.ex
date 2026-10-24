defmodule Refpath.Presentation.Validator do
  @moduledoc """
  Strict structural, type, limit, and cross-reference validation for portable
  presentation values.

  The validator never creates atoms from external input and rejects unknown keys
  at every contract boundary.
  """

  alias Refpath.Presentation.PanelDefinition
  alias Refpath.Presentation.ReportDefinition
  alias Refpath.Presentation.ResultField
  alias Refpath.Presentation.ResultFrame
  alias Refpath.Presentation.VisualizationDefinition

  @default_limits %{
    max_panels: 32,
    max_fields: 64,
    max_rows: 10_000,
    max_cell_bytes: 8_192,
    max_depth: 64
  }
  @definition_keys ~w(schema_version id title description panels layout parameters provenance)
  @panel_keys ~w(id title description query_ref visualization table_columns empty_message)
  @visualization_keys ~w(kind encodings formats sort stack annotations interaction summary_template)
  @field_keys ~w(name label type role unit nullable classification)
  @frame_keys ~w(fields rows provenance freshness classification page)
  @encoding_keys ~w(x y series value label color_group size)
  @required_encodings %{
    area: ~w(x y),
    bar: ~w(x y),
    gauge: ~w(value),
    heatmap: ~w(x y value),
    line: ~w(x y),
    number: ~w(value),
    scatter: ~w(x y),
    sparkline: ~w(x y),
    table: []
  }
  @kinds ~w(number table line area bar scatter heatmap gauge sparkline)
  @types ~w(boolean integer float decimal string date time datetime duration)
  @roles ~w(dimension measure time identifier)
  @classifications ~w(public internal confidential restricted)
  @stacks ~w(none normal normalized)
  @enum_atoms %{
    "area" => :area,
    "asc" => :asc,
    "bar" => :bar,
    "boolean" => :boolean,
    "confidential" => :confidential,
    "date" => :date,
    "datetime" => :datetime,
    "decimal" => :decimal,
    "desc" => :desc,
    "dimension" => :dimension,
    "duration" => :duration,
    "float" => :float,
    "gauge" => :gauge,
    "heatmap" => :heatmap,
    "identifier" => :identifier,
    "integer" => :integer,
    "internal" => :internal,
    "interval" => :interval,
    "line" => :line,
    "measure" => :measure,
    "none" => :none,
    "normal" => :normal,
    "normalized" => :normalized,
    "number" => :number,
    "point" => :point,
    "public" => :public,
    "restricted" => :restricted,
    "scatter" => :scatter,
    "sparkline" => :sparkline,
    "string" => :string,
    "table" => :table,
    "time" => :time
  }

  @type path :: [String.t() | non_neg_integer()]
  @type error :: {:invalid_definition | :invalid_frame, path(), term()}

  @doc "Validate and normalize a closed portable report definition."
  @spec definition(map() | ReportDefinition.t(), keyword()) ::
          {:ok, ReportDefinition.t()} | {:error, [error()]}
  def definition(%ReportDefinition{} = definition, opts) do
    map = Map.from_struct(definition)
    definition(stringify_structs(map), opts)
  end

  def definition(%{} = input, opts) do
    limits = limits(opts)

    with :ok <- strict_keys(input, @definition_keys, [], :invalid_definition),
         {:ok, schema_version} <-
           required_string(input, "schema_version", [], 16, :invalid_definition),
         :ok <- supported_version(schema_version),
         {:ok, title} <- required_string(input, "title", [], 512, :invalid_definition),
         {:ok, description} <-
           required_string(input, "description", [], 4_096, :invalid_definition),
         {:ok, raw_panels} <- required_list(input, "panels", [], :invalid_definition),
         :ok <-
           within(raw_panels, limits.max_panels, ["panels"], :max_panels, :invalid_definition),
         {:ok, panels} <- map_valid(raw_panels, &panel/2, ["panels"]),
         :ok <- unique(Enum.map(panels, & &1.id), ["panels"], :panel_id, :invalid_definition),
         {:ok, layout} <- required_map(input, "layout", [], :invalid_definition),
         :ok <- validate_json_value(layout, ["layout"], :invalid_definition, limits.max_depth),
         {:ok, parameters} <- optional_list(input, "parameters", [], :invalid_definition),
         :ok <-
           validate_json_value(parameters, ["parameters"], :invalid_definition, limits.max_depth),
         {:ok, provenance} <- required_map(input, "provenance", [], :invalid_definition),
         :ok <-
           validate_json_value(provenance, ["provenance"], :invalid_definition, limits.max_depth),
         {:ok, id} <- optional_string(input, "id", [], 256, :invalid_definition) do
      {:ok,
       %ReportDefinition{
         id: id,
         schema_version: schema_version,
         title: title,
         description: description,
         panels: panels,
         layout: layout,
         parameters: parameters,
         provenance: provenance
       }}
    else
      {:error, errors} when is_list(errors) -> {:error, errors}
      {:error, error} -> {:error, [error]}
    end
  end

  def definition(_, _), do: {:error, [{:invalid_definition, [], :expected_object}]}

  @doc "Validate and normalize a bounded typed result frame."
  @spec frame(map() | ResultFrame.t(), keyword()) ::
          {:ok, ResultFrame.t()} | {:error, [error()]}
  def frame(%ResultFrame{} = frame, opts) do
    map = Map.from_struct(frame)
    frame(stringify_structs(map), opts)
  end

  def frame(%{} = input, opts) do
    limits = limits(opts)

    with :ok <- strict_keys(input, @frame_keys, [], :invalid_frame),
         {:ok, raw_fields} <- required_list(input, "fields", [], :invalid_frame),
         :ok <- within(raw_fields, limits.max_fields, ["fields"], :max_fields, :invalid_frame),
         {:ok, fields} <- map_valid(raw_fields, &field/2, ["fields"]),
         :ok <- unique(Enum.map(fields, & &1.name), ["fields"], :field_name, :invalid_frame),
         {:ok, rows} <- required_list(input, "rows", [], :invalid_frame),
         :ok <- within(rows, limits.max_rows, ["rows"], :max_rows, :invalid_frame),
         :ok <- validate_rows(rows, fields, limits),
         {:ok, provenance} <- required_map(input, "provenance", [], :invalid_frame),
         :ok <- validate_json_value(provenance, ["provenance"], :invalid_frame, limits.max_depth),
         {:ok, freshness} <- required_map(input, "freshness", [], :invalid_frame),
         :ok <- validate_json_value(freshness, ["freshness"], :invalid_frame, limits.max_depth),
         {:ok, classification} <- required_map(input, "classification", [], :invalid_frame),
         :ok <-
           validate_json_value(
             classification,
             ["classification"],
             :invalid_frame,
             limits.max_depth
           ),
         {:ok, page} <- required_map(input, "page", [], :invalid_frame),
         :ok <- validate_json_value(page, ["page"], :invalid_frame, limits.max_depth) do
      {:ok,
       %ResultFrame{
         fields: fields,
         rows: rows,
         provenance: provenance,
         freshness: freshness,
         classification: classification,
         page: page
       }}
    else
      {:error, errors} when is_list(errors) -> {:error, errors}
      {:error, error} -> {:error, [error]}
    end
  end

  def frame(_, _), do: {:error, [{:invalid_frame, [], :expected_object}]}

  @doc "Cross-validates a panel's visualization and table fields against a frame."
  @spec bind_panel(PanelDefinition.t(), ResultFrame.t()) :: :ok | {:error, [error()]}
  def bind_panel(%PanelDefinition{} = panel, %ResultFrame{} = frame) do
    fields = MapSet.new(frame.fields, & &1.name)

    references =
      Enum.concat([
        Map.values(panel.visualization.encodings),
        Map.keys(panel.visualization.formats),
        panel.table_columns,
        Enum.map(panel.visualization.sort, &map_get(&1, "field")),
        Enum.map(panel.visualization.annotations, &map_get(&1, "field"))
      ])

    errors =
      references
      |> Enum.reject(&(is_nil(&1) or MapSet.member?(fields, &1)))
      |> Enum.uniq()
      |> Enum.map(&{:invalid_definition, ["panels", panel.id], {:unknown_field, &1}})

    role_errors = encoding_role_errors(panel, frame.fields)
    type_errors = encoding_type_errors(panel, frame.fields)

    violations = Enum.concat([errors, role_errors, type_errors])
    if violations == [], do: :ok, else: {:error, violations}
  end

  @doc false
  @spec json_value(term(), path(), keyword()) :: :ok | {:error, error()}
  def json_value(value, path, opts \\ []) do
    validate_json_value(value, path, :invalid_frame, limits(opts).max_depth)
  end

  defp panel(input, path) do
    with true <- is_map(input) || {:error, {:invalid_definition, path, :expected_object}},
         :ok <- strict_keys(input, @panel_keys, path, :invalid_definition),
         {:ok, id} <- required_string(input, "id", path, 256, :invalid_definition),
         {:ok, title} <- required_string(input, "title", path, 512, :invalid_definition),
         {:ok, description} <-
           required_string(input, "description", path, 4_096, :invalid_definition),
         {:ok, query_ref} <- required_string(input, "query_ref", path, 1_024, :invalid_definition),
         {:ok, raw_visualization} <-
           required_map(input, "visualization", path, :invalid_definition),
         {:ok, visualization} <- visualization(raw_visualization, at(path, "visualization")),
         {:ok, table_columns} <- string_list(input, "table_columns", path, :invalid_definition),
         {:ok, empty_message} <-
           required_string(input, "empty_message", path, 1_024, :invalid_definition) do
      {:ok,
       %PanelDefinition{
         id: id,
         title: title,
         description: description,
         query_ref: query_ref,
         visualization: visualization,
         table_columns: table_columns,
         empty_message: empty_message
       }}
    else
      {:error, _} = error -> error
    end
  end

  defp visualization(input, path) do
    with :ok <- strict_keys(input, @visualization_keys, path, :invalid_definition),
         {:ok, kind} <- enum(input, "kind", @kinds, path, :invalid_definition),
         {:ok, encodings} <- required_map(input, "encodings", path, :invalid_definition),
         :ok <- strict_keys(encodings, @encoding_keys, at(path, "encodings"), :invalid_definition),
         :ok <- string_map(encodings, at(path, "encodings"), :invalid_definition),
         :ok <- required_encodings(kind, encodings, at(path, "encodings")),
         {:ok, formats} <- optional_map(input, "formats", path, :invalid_definition),
         :ok <- string_map(formats, at(path, "formats"), :invalid_definition),
         {:ok, sort} <- optional_list(input, "sort", path, :invalid_definition),
         :ok <- validate_sort(sort, at(path, "sort")),
         {:ok, stack} <-
           optional_enum(input, "stack", @stacks, "none", {path, :invalid_definition}),
         {:ok, annotations} <- optional_list(input, "annotations", path, :invalid_definition),
         :ok <- validate_annotations(annotations, at(path, "annotations")),
         {:ok, interaction} <- optional_map(input, "interaction", path, :invalid_definition),
         :ok <- validate_interaction(interaction, at(path, "interaction")),
         {:ok, summary} <-
           required_string(input, "summary_template", path, 2_048, :invalid_definition) do
      {:ok,
       %VisualizationDefinition{
         kind: kind,
         encodings: stringify_keys(encodings),
         formats: stringify_keys(formats),
         sort: Enum.map(sort, &stringify_keys/1),
         stack: stack,
         annotations: Enum.map(annotations, &stringify_keys/1),
         interaction: stringify_keys(interaction),
         summary_template: summary
       }}
    end
  end

  defp field(input, path) do
    with true <- is_map(input) || {:error, {:invalid_frame, path, :expected_object}},
         :ok <- strict_keys(input, @field_keys, path, :invalid_frame),
         {:ok, name} <- required_string(input, "name", path, 256, :invalid_frame),
         {:ok, label} <- required_string(input, "label", path, 512, :invalid_frame),
         {:ok, type} <- enum(input, "type", @types, path, :invalid_frame),
         {:ok, role} <- enum(input, "role", @roles, path, :invalid_frame),
         {:ok, unit} <- optional_string(input, "unit", path, 128, :invalid_frame),
         {:ok, nullable} <- required_boolean(input, "nullable", path, :invalid_frame),
         {:ok, classification} <-
           enum(input, "classification", @classifications, path, :invalid_frame) do
      {:ok,
       %ResultField{
         name: name,
         label: label,
         type: type,
         role: role,
         unit: unit,
         nullable: nullable,
         classification: classification
       }}
    else
      {:error, _} = error -> error
    end
  end

  defp validate_rows(rows, fields, limits) do
    rows
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {row, row_index}, :ok ->
      path = ["rows", row_index]

      result =
        cond do
          not is_list(row) ->
            {:error, {:invalid_frame, path, :expected_array}}

          length(row) != length(fields) ->
            {:error, {:invalid_frame, path, :row_width_mismatch}}

          true ->
            validate_cells(row, fields, path, limits)
        end

      case result do
        :ok -> {:cont, :ok}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp validate_cells(row, fields, path, limits) do
    row
    |> Enum.zip(fields)
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {{value, field}, index}, :ok ->
      if valid_cell?(value, field, limits) do
        {:cont, :ok}
      else
        {:halt, {:error, {:invalid_frame, at(path, index), {:invalid_cell, field.type}}}}
      end
    end)
  end

  defp valid_cell?(nil, %{nullable: nullable}, _), do: nullable
  defp valid_cell?(value, %{type: :boolean}, _), do: is_boolean(value)
  defp valid_cell?(value, %{type: :integer}, _), do: is_integer(value)
  defp valid_cell?(value, %{type: :float}, _), do: is_float(value) or is_integer(value)
  defp valid_cell?(value, %{type: :decimal}, limits), do: bounded_decimal?(value, limits)
  defp valid_cell?(value, %{type: :string}, limits), do: bounded_string?(value, limits)

  defp valid_cell?(value, %{type: :date}, limits),
    do: bounded_string?(value, limits) and valid_date?(value)

  defp valid_cell?(value, %{type: :time}, limits),
    do: bounded_string?(value, limits) and valid_time?(value)

  defp valid_cell?(value, %{type: :datetime}, limits),
    do: bounded_string?(value, limits) and valid_datetime?(value)

  defp valid_cell?(value, %{type: :duration}, _), do: is_integer(value)

  defp bounded_decimal?(value, limits) do
    bounded_string?(value, limits) and Regex.match?(~r/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, value)
  end

  defp bounded_string?(value, limits),
    do: is_binary(value) and byte_size(value) <= limits.max_cell_bytes and String.valid?(value)

  defp valid_date?(value), do: match?({:ok, _}, Date.from_iso8601(value))

  defp valid_time?(value) do
    case Time.from_iso8601(value) do
      {:ok, _} -> true
      _ -> false
    end
  end

  defp valid_datetime?(value), do: match?({:ok, _, _}, DateTime.from_iso8601(value))

  defp encoding_role_errors(panel, fields) do
    by_name = Map.new(fields, &{&1.name, &1})

    panel.visualization.encodings
    |> Enum.flat_map(fn {channel, name} ->
      case Map.get(by_name, name) do
        %{role: :identifier} when channel in ["x", "y", "value", "size"] ->
          [
            {:invalid_definition, ["panels", panel.id, "visualization", "encodings", channel],
             :identifier_on_quantitative_channel}
          ]

        _ ->
          []
      end
    end)
  end

  defp encoding_type_errors(panel, fields) do
    by_name = Map.new(fields, &{&1.name, &1})
    channels = quantitative_channels(panel.visualization.kind, panel.visualization.encodings)

    Enum.flat_map(channels, fn {channel, name} ->
      case Map.get(by_name, name) do
        %{type: type} when type in [:integer, :float, :decimal, :duration] ->
          []

        nil ->
          []

        _ ->
          [
            {:invalid_definition, ["panels", panel.id, "visualization", "encodings", channel],
             :non_quantitative_field}
          ]
      end
    end)
  end

  defp quantitative_channels(kind, encodings) when kind in [:number, :gauge, :heatmap],
    do: select_channels(encodings, ~w(value size))

  defp quantitative_channels(kind, encodings)
       when kind in [:line, :area, :bar, :scatter, :sparkline],
       do: select_channels(encodings, ~w(y size))

  defp quantitative_channels(_, encodings), do: select_channels(encodings, ~w(size))

  defp select_channels(encodings, channels),
    do: Enum.filter(encodings, fn {channel, _} -> channel in channels end)

  defp required_encodings(kind, encodings, path) do
    present =
      encodings
      |> Map.keys()
      |> Enum.map(&key_string/1)
      |> MapSet.new()

    missing =
      @required_encodings
      |> Map.fetch!(kind)
      |> Enum.reject(&MapSet.member?(present, &1))

    case missing do
      [] -> :ok
      _ -> {:error, {:invalid_definition, path, {:missing_encodings, missing}}}
    end
  end

  defp validate_sort(sort, path) do
    sort
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {entry, index}, :ok ->
      entry_path = at(path, index)

      with true <- is_map(entry) || {:error, {:invalid_definition, entry_path, :expected_object}},
           :ok <- strict_keys(entry, ~w(field direction), entry_path, :invalid_definition),
           {:ok, _} <- required_string(entry, "field", entry_path, 256, :invalid_definition),
           {:ok, _} <- enum(entry, "direction", ~w(asc desc), entry_path, :invalid_definition) do
        {:cont, :ok}
      else
        {:error, error} -> {:halt, {:error, error}}
      end
    end)
  end

  defp validate_annotations(annotations, path) do
    annotations
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {entry, index}, :ok ->
      entry_path = at(path, index)

      with true <- is_map(entry) || {:error, {:invalid_definition, entry_path, :expected_object}},
           :ok <- strict_keys(entry, ~w(text field), entry_path, :invalid_definition),
           {:ok, _} <- required_string(entry, "text", entry_path, 1_024, :invalid_definition),
           {:ok, _} <- optional_string(entry, "field", entry_path, 256, :invalid_definition) do
        {:cont, :ok}
      else
        {:error, error} -> {:halt, {:error, error}}
      end
    end)
  end

  defp validate_interaction(interaction, path) do
    with :ok <- strict_keys(interaction, ~w(selection drill_action_id), path, :invalid_definition),
         {:ok, _} <-
           optional_enum(
             interaction,
             "selection",
             ~w(none point interval),
             "none",
             {path, :invalid_definition}
           ),
         {:ok, _} <-
           optional_string(interaction, "drill_action_id", path, 256, :invalid_definition) do
      :ok
    end
  end

  defp supported_version("1." <> minor) do
    if Regex.match?(~r/^\d+$/, minor),
      do: :ok,
      else: {:error, {:invalid_definition, ["schema_version"], :invalid_version}}
  end

  defp supported_version(_),
    do: {:error, {:invalid_definition, ["schema_version"], :unsupported_schema_version}}

  defp strict_keys(map, allowed, path, type) do
    unknown =
      map
      |> Map.keys()
      |> Enum.map(&key_string/1)
      |> Enum.reject(&(&1 in allowed))

    if unknown == [], do: :ok, else: {:error, {type, path, {:unknown_keys, Enum.sort(unknown)}}}
  end

  defp string_map(map, path, type) do
    case Enum.find(map, fn {key, value} ->
           not valid_identifier?(key_string(key)) or
             not bounded_string?(value, %{max_cell_bytes: 64})
         end) do
      nil -> :ok
      {key, _} -> {:error, {type, at(path, key_string(key)), :expected_string}}
    end
  end

  defp valid_identifier?(value),
    do: is_binary(value) and Regex.match?(~r/^[A-Za-z_][A-Za-z0-9_.:-]{0,255}$/, value)

  defp validate_json_value(_, path, type, depth) when depth < 0,
    do: {:error, {type, path, {:limit_exceeded, :max_depth}}}

  defp validate_json_value(value, _, _, _)
       when is_nil(value) or is_boolean(value) or is_integer(value) or is_float(value),
       do: :ok

  defp validate_json_value(value, path, type, _) when is_binary(value) do
    if String.valid?(value), do: :ok, else: {:error, {type, path, :invalid_json_value}}
  end

  defp validate_json_value(value, path, type, depth) when is_list(value) do
    value
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {item, index}, :ok ->
      case validate_json_value(item, at(path, index), type, depth - 1) do
        :ok -> {:cont, :ok}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp validate_json_value(value, path, type, depth)
       when is_map(value) and not is_struct(value) do
    Enum.reduce_while(value, :ok, fn {key, item}, :ok ->
      validate_json_entry(key, item, path, type, depth)
    end)
  end

  defp validate_json_value(_, path, type, _),
    do: {:error, {type, path, :invalid_json_value}}

  defp validate_json_entry(key, item, path, type, depth)
       when is_binary(key) or is_atom(key) do
    if String.valid?(key_string(key)) do
      case validate_json_value(item, at(path, key_string(key)), type, depth - 1) do
        :ok -> {:cont, :ok}
        {:error, _} = error -> {:halt, error}
      end
    else
      {:halt, {:error, {type, path, :invalid_json_key}}}
    end
  end

  defp validate_json_entry(_, _, path, type, _),
    do: {:halt, {:error, {type, path, :invalid_json_key}}}

  defp unique(values, path, label, type) do
    case values -- Enum.uniq(values) do
      [] -> :ok
      [duplicate | _] -> {:error, {type, path, {:duplicate, label, duplicate}}}
    end
  end

  defp within(list, max, path, label, type) do
    if length(list) <= max, do: :ok, else: {:error, {type, path, {:limit_exceeded, label, max}}}
  end

  defp map_valid(values, fun, path) do
    result =
      values
      |> Enum.with_index()
      |> Enum.reduce_while({:ok, []}, fn {value, index}, {:ok, acc} ->
        case fun.(value, at(path, index)) do
          {:ok, parsed} -> {:cont, {:ok, [parsed | acc]}}
          {:error, error} -> {:halt, {:error, error}}
        end
      end)

    case result do
      {:ok, parsed} -> {:ok, Enum.reverse(parsed)}
      {:error, _} = error -> error
    end
  end

  defp required_string(map, key, path, max, type) do
    case map_get(map, key) do
      value when is_binary(value) and byte_size(value) > 0 and byte_size(value) <= max ->
        if String.valid?(value),
          do: {:ok, value},
          else: {:error, {type, at(path, key), :invalid_string}}

      nil ->
        {:error, {type, at(path, key), :required}}

      _ ->
        {:error, {type, at(path, key), :invalid_string}}
    end
  end

  defp optional_string(map, key, path, max, type) do
    case map_get(map, key) do
      nil ->
        {:ok, nil}

      value when is_binary(value) and byte_size(value) > 0 and byte_size(value) <= max ->
        if String.valid?(value),
          do: {:ok, value},
          else: {:error, {type, at(path, key), :invalid_string}}

      _ ->
        {:error, {type, at(path, key), :invalid_string}}
    end
  end

  defp required_boolean(map, key, path, type) do
    case map_fetch(map, key) do
      {:ok, value} when is_boolean(value) -> {:ok, value}
      :error -> {:error, {type, at(path, key), :required}}
      _ -> {:error, {type, at(path, key), :expected_boolean}}
    end
  end

  defp required_list(map, key, path, type) do
    case map_get(map, key) do
      value when is_list(value) -> {:ok, value}
      nil -> {:error, {type, at(path, key), :required}}
      _ -> {:error, {type, at(path, key), :expected_array}}
    end
  end

  defp optional_list(map, key, path, type) do
    case map_get(map, key) do
      nil -> {:ok, []}
      value when is_list(value) -> {:ok, value}
      _ -> {:error, {type, at(path, key), :expected_array}}
    end
  end

  defp required_map(map, key, path, type) do
    case map_get(map, key) do
      value when is_map(value) -> {:ok, value}
      nil -> {:error, {type, at(path, key), :required}}
      _ -> {:error, {type, at(path, key), :expected_object}}
    end
  end

  defp optional_map(map, key, path, type) do
    case map_get(map, key) do
      nil -> {:ok, %{}}
      value when is_map(value) -> {:ok, value}
      _ -> {:error, {type, at(path, key), :expected_object}}
    end
  end

  defp string_list(map, key, path, type) do
    with {:ok, values} <- required_list(map, key, path, type) do
      if Enum.all?(values, &is_binary/1),
        do: {:ok, values},
        else: {:error, {type, at(path, key), :expected_string_array}}
    end
  end

  defp enum(map, key, allowed, path, type) do
    case map_get(map, key) do
      nil -> {:error, {type, at(path, key), :required}}
      value when is_atom(value) -> enum_value(Atom.to_string(value), allowed, at(path, key), type)
      value when is_binary(value) -> enum_value(value, allowed, at(path, key), type)
      _ -> {:error, {type, at(path, key), {:invalid_enum, allowed}}}
    end
  end

  defp optional_enum(map, key, allowed, default, {path, type}) do
    case map_get(map, key) do
      nil -> enum_value(default, allowed, at(path, key), type)
      value when is_atom(value) -> enum_value(Atom.to_string(value), allowed, at(path, key), type)
      value when is_binary(value) -> enum_value(value, allowed, at(path, key), type)
      _ -> {:error, {type, at(path, key), {:invalid_enum, allowed}}}
    end
  end

  defp enum_value(value, allowed, path, type) do
    case Enum.find(allowed, &(&1 == value)) do
      nil -> {:error, {type, path, {:invalid_enum, allowed}}}
      known -> {:ok, Map.fetch!(@enum_atoms, known)}
    end
  end

  defp limits(opts), do: Map.merge(@default_limits, Map.new(Keyword.get(opts, :limits, [])))

  defp map_get(map, key) do
    case Map.fetch(map, key) do
      {:ok, value} -> value
      :error -> atom_key_value(map, key)
    end
  end

  defp map_fetch(map, key) do
    case Map.fetch(map, key) do
      :error -> atom_key_fetch(map, key)
      found -> found
    end
  end

  defp atom_key_fetch(map, key) do
    case Enum.find(map, fn {candidate, _} ->
           is_atom(candidate) and Atom.to_string(candidate) == key
         end) do
      {_, value} -> {:ok, value}
      nil -> :error
    end
  end

  defp atom_key_value(map, key) do
    case Enum.find(map, fn {candidate, _} ->
           is_atom(candidate) and Atom.to_string(candidate) == key
         end) do
      {_, value} -> value
      nil -> nil
    end
  end

  defp key_string(key) when is_atom(key), do: Atom.to_string(key)
  defp key_string(key) when is_binary(key), do: key
  defp key_string(key), do: inspect(key)

  defp stringify_keys(map), do: Map.new(map, fn {key, value} -> {key_string(key), value} end)

  defp stringify_structs(value) when is_struct(value) do
    map = Map.from_struct(value)
    stringify_structs(map)
  end

  defp stringify_structs(value) when is_map(value) do
    Map.new(value, fn {key, nested} -> {key_string(key), stringify_structs(nested)} end)
  end

  defp stringify_structs(value) when is_list(value), do: Enum.map(value, &stringify_structs/1)
  defp stringify_structs(value) when is_nil(value) or is_boolean(value), do: value
  defp stringify_structs(value) when is_atom(value), do: Atom.to_string(value)
  defp stringify_structs(value), do: value

  defp at(path, segment), do: List.insert_at(path, -1, segment)
end
