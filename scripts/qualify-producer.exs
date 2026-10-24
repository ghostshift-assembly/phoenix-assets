defmodule PhoenixAssets.Qualification.Producer do
  @moduledoc "Executes the immutable public producer against retained and generated neutral fixtures."

  @directory Path.expand("../npm/svelte/test/fixtures/upstream-reporting", __DIR__)
  @files ~w(result_field result_frame visualization_definition panel_definition report_definition report_envelope renderer_capabilities validator presentation)

  def run(destination) do
    profile_path = Path.join(@directory, "profile.json")
    profile = profile_path |> File.read!() |> Jason.decode!()

    for {file, expected} <- profile["sources"] do
      true = expected == digest!(Path.join(@directory, file))
    end

    :code.purge(Jason.Encoder)
    :code.delete(Jason.Encoder)

    {:module, Jason.Encoder} =
      :code.load_abs(
        Path.join([List.to_string(:code.lib_dir(:jason)), "ebin", "Elixir.Jason.Encoder"])
        |> String.to_charlist()
      )

    for file <- @files, do: Code.compile_file(Path.join(@directory, file <> ".ex"))
    baseline = @directory |> Path.join("envelope.json") |> File.read!() |> Jason.decode!()
    corpus = @directory |> Path.join("cases.json") |> File.read!() |> Jason.decode!()

    cases =
      Enum.map(corpus, fn fixture ->
        value = put_path(baseline, fixture["path"], fixture["value"])
        accepted = match?({:ok, _}, Refpath.Presentation.validate_envelope(value))
        true = accepted == fixture["accept"]
        %{"name" => fixture["name"], "accept" => accepted, "value" => value}
      end)

    {:ok, envelope} = Refpath.Presentation.validate_envelope(baseline)
    {:ok, encoded} = Refpath.Presentation.encode(envelope)
    {:ok, _} = Refpath.Presentation.decode(encoded, :envelope)

    caps =
      struct!(Refpath.Presentation.RendererCapabilities,
        visualization_kinds: Enum.map(profile["grammar"]["kinds"], &String.to_existing_atom/1)
      )

    {:ok, rebound} =
      Refpath.Presentation.bind(envelope.definition, envelope.results, caps,
        generated_at: envelope.generated_at
      )

    {:ok, rebound_json} = Refpath.Presentation.encode(rebound)
    true = Jason.decode!(rebound_json)["results"] == baseline["results"]

    kinds =
      Enum.map(profile["grammar"]["kinds"], fn kind ->
        definition = baseline["definition"]
        panel = hd(definition["panels"])

        visualization =
          panel["visualization"]
          |> Map.put("kind", kind)
          |> Map.put("encodings", Map.new(profile["required_encodings"][kind], &{&1, &1}))
          |> Map.put("formats", %{})
          |> Map.put("sort", [])

        panel =
          panel
          |> Map.put("visualization", visualization)
          |> Map.put("table_columns", ["x", "y", "value", "label"])

        definition =
          definition
          |> Map.put("panels", [panel])
          |> Map.put("layout", %{"columns" => 1, "order" => [panel["id"]]})

        fields =
          for name <- ~w(x y value label),
              do: %{
                "name" => name,
                "label" => name,
                "type" => if(name == "label", do: "string", else: "float"),
                "role" => if(name in ["x", "label"], do: "dimension", else: "measure"),
                "unit" => nil,
                "nullable" => false,
                "classification" => "public"
              }

        frame = %{
          "fields" => fields,
          "rows" => [[1.0, 2.0, 3.0, "A"]],
          "provenance" => %{},
          "freshness" => %{},
          "classification" => %{"highest" => "public", "redactions" => []},
          "page" => %{}
        }

        {:ok, bound} =
          Refpath.Presentation.bind(
            definition,
            %{panel["id"] => %{state: :ok, frame: frame}},
            caps,
            generated_at: envelope.generated_at
          )

        {:ok, json} = Refpath.Presentation.encode(bound)
        %{"name" => "kind-" <> kind, "accept" => true, "value" => Jason.decode!(json)}
      end)

    File.mkdir_p!(destination)

    fields =
      profile["grammar"]["types"]
      |> Enum.map(fn type ->
        hd(hd(kinds)["value"]["results"]["volume"]["frame"]["fields"])
        |> Map.merge(%{
          "name" => type,
          "label" => type,
          "type" => type,
          "nullable" => true,
          "role" => "measure"
        })
      end)

    values = Enum.map(profile["grammar"]["types"], &sample/1)
    scalars = with_frame(baseline, frame(fields, [values, Enum.map(values, fn _ -> nil end)]))
    scalar_case = verify!("scalar-values-and-null", scalars, true)
    limits = profile["limits"]
    integer = hd(fields) |> Map.merge(%{"type" => "integer", "name" => "value"})

    field_cases =
      for offset <- [0, 1] do
        count = limits["max_fields"] + offset
        list = for index <- 1..count, do: Map.put(integer, "name", "field_#{index}")

        verify!(
          "max-fields-#{if offset == 0, do: "exact", else: "over"}",
          with_frame(baseline, frame(list, [Enum.map(list, fn _ -> 1 end)])),
          offset == 0
        )
      end

    row_cases =
      for offset <- [0, 1] do
        rows = List.duplicate([1], limits["max_rows"] + offset)

        verify!(
          "max-rows-#{if offset == 0, do: "exact", else: "over"}",
          with_frame(baseline, frame([integer], rows)),
          offset == 0
        )
      end

    cell_cases =
      for offset <- [0, 1] do
        field = Map.put(integer, "type", "string")
        rows = [[String.duplicate("a", limits["max_cell_bytes"] + offset)]]

        verify!(
          "max-cell-bytes-#{if offset == 0, do: "exact", else: "over"}",
          with_frame(baseline, frame([field], rows)),
          offset == 0
        )
      end

    panel_cases =
      for offset <- [0, 1] do
        panel = hd(baseline["definition"]["panels"])

        panels =
          for index <- 1..(limits["max_panels"] + offset),
              do: Map.put(panel, "id", "panel_#{index}")

        definition =
          baseline["definition"]
          |> Map.put("panels", panels)
          |> Map.put("layout", %{"columns" => 2, "order" => Enum.map(panels, & &1["id"])})

        accepted = match?({:ok, _}, Refpath.Presentation.validate_definition(definition))
        true = accepted == (offset == 0)
        results = Map.new(panels, &{&1["id"], baseline["results"]["volume"]})

        value =
          baseline
          |> Map.put("definition", definition)
          |> Map.put("results", results)
          |> Map.put("capability_warnings", [])

        verify!("max-panels-#{if offset == 0, do: "exact", else: "over"}", value, offset == 0)
      end

    depth_cases =
      for offset <- [0, 1] do
        nested =
          Enum.reduce(1..(limits["max_depth"] + offset), nil, fn _, inner ->
            %{"next" => inner}
          end)

        value = put_in(baseline, ["definition", "provenance"], nested)
        verify!("max-depth-#{if offset == 0, do: "exact", else: "over"}", value, offset == 0)
      end

    bytes_cases =
      for offset <- [0, 1] do
        value = put_in(baseline, ["definition", "provenance"], %{"padding" => ""})
        padding = limits["max_bytes"] + offset - byte_size(Jason.encode!(value))

        json =
          value
          |> put_in(["definition", "provenance", "padding"], String.duplicate("a", padding))
          |> Jason.encode!()

        true = byte_size(json) == limits["max_bytes"] + offset
        verify!("max-bytes-#{if offset == 0, do: "exact", else: "over"}", json, offset == 0)
      end

    all =
      cases ++
        kinds ++
        [scalar_case] ++
        field_cases ++ row_cases ++ cell_cases ++ panel_cases ++ depth_cases ++ bytes_cases

    path = Path.join(destination, "producer-cases.json")
    {:ok, cases_json} = Refpath.Presentation.encode(all)
    File.write!(path, cases_json)

    proof = %{
      "repository" => profile["repository"],
      "revision" => profile["revision"],
      "profile_sha256" => digest!(profile_path),
      "script_sha256" => digest!(__ENV__.file),
      "cases_sha256" => digest!(path),
      "cases" => Enum.map(all, &Map.take(&1, ["name", "accept"])),
      "boundary" => "actual public validator, binder, encoder and decoder; no query execution"
    }

    File.write!(Path.join(destination, "producer-qualification.json"), Jason.encode!(proof))
  end

  defp verify!(name, value, expected) do
    result =
      if is_binary(value),
        do: Refpath.Presentation.decode(value, :envelope),
        else: Refpath.Presentation.validate_envelope(value)

    accepted = match?({:ok, _}, result)
    unless accepted == expected, do: raise("producer case #{name}: #{inspect(result)}")
    %{"name" => name, "accept" => accepted, "value" => value}
  end

  defp frame(fields, rows),
    do: %{
      "fields" => fields,
      "rows" => rows,
      "provenance" => %{},
      "freshness" => %{},
      "classification" => %{"highest" => "public", "redactions" => []},
      "page" => %{}
    }

  defp with_frame(baseline, frame) do
    panel = hd(baseline["definition"]["panels"])

    visualization =
      panel["visualization"]
      |> Map.put("kind", "table")
      |> Map.put("encodings", %{})
      |> Map.put("formats", %{})
      |> Map.put("sort", [])

    panel =
      panel
      |> Map.put("visualization", visualization)
      |> Map.put("table_columns", Enum.map(frame["fields"], & &1["name"]))

    definition =
      baseline["definition"]
      |> Map.put("panels", [panel])
      |> Map.put("layout", %{"columns" => 1, "order" => [panel["id"]]})

    baseline
    |> Map.put("definition", definition)
    |> Map.put("results", %{panel["id"] => %{"state" => "ok", "frame" => frame}})
    |> Map.put("capability_warnings", [])
  end

  defp sample("boolean"), do: true
  defp sample("integer"), do: 42
  defp sample("float"), do: 0.25
  defp sample("decimal"), do: "0.10000000000000000001"
  defp sample("string"), do: "Text"
  defp sample("date"), do: "2026-10-24"
  defp sample("time"), do: "12:00:00"
  defp sample("datetime"), do: "2026-10-24T12:00:00Z"
  defp sample("duration"), do: 1000

  defp put_path(value, [key], replacement) when is_map(value),
    do: Map.put(value, key, replacement)

  defp put_path(value, [key | rest], replacement) when is_map(value),
    do: Map.update!(value, key, &put_path(&1, rest, replacement))

  defp put_path(value, [key | rest], replacement) when is_list(value),
    do: List.update_at(value, key, &put_path(&1, rest, replacement))

  defp put_path(_, [], replacement), do: replacement
  defp digest!(path), do: :crypto.hash(:sha256, File.read!(path)) |> Base.encode16(case: :lower)
end

System.argv() |> List.last() |> PhoenixAssets.Qualification.Producer.run()
