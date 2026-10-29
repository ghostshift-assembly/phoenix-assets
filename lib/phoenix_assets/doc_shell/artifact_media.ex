defmodule PhoenixAssets.DocShell.ArtifactMedia do
  @moduledoc """
  Checks the passive SVG/PNG subset displayed by the DocShell artifact renderer.

  SVG uses a closed XML subset: basic shapes/text, bounded numeric attributes,
  solid colors and transforms. It rejects DTDs, entities other than the five XML
  text escapes, processing instructions, executable/event/CSS attributes,
  foreign content, external references and nested SVG viewports. PNG checks
  signature, bounded dimensions, supported headers, chunk closure and CRCs;
  animation and unsupported ancillary chunks refuse. Neither check interprets
  producer geometry, proves semantic coverage or decodes pixels.

  Bounds are fixed for this renderer: 1 MiB SVG, 32 MiB PNG, 4096 elements/chunks,
  64 SVG levels, 32 attributes per element and image dimensions at most 4096.
  Unsupported images fail explicitly rather than silently becoming another
  selected presentation. The complete textual fallback is a separate contract.
  """

  @tags ~w(svg g title desc rect circle ellipse line path polyline polygon text tspan)
  @numeric ~w(x y x1 y1 x2 y2 cx cy r rx ry width height stroke-width stroke-miterlimit
               opacity fill-opacity stroke-opacity font-size letter-spacing)
  @number "[-+]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][-+]?[0-9]+)?"
  @scalar Regex.compile!("\\A" <> @number <> "(?:px)?\\z")
  @plain_number Regex.compile!("\\A" <> @number <> "\\z")
  @numbers Regex.compile!(@number)
  @token ~r/<[^<>]*>|[^<>]+/u
  @attribute ~r/\A[ \t\r\n]+([A-Za-z][A-Za-z0-9-]*)[ \t\r\n]*=[ \t\r\n]*(?:"([^"]*)"|'([^']*)')/u
  @png_chunks ~w(IHDR PLTE IDAT IEND tRNS sRGB gAMA cHRM pHYs bKGD sBIT)
  @transform ~r/\b(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/

  @doc "Checks original media bytes without retrieval, mutation or pixel decoding."
  @spec validate(String.t(), binary()) :: :ok | {:error, :unsupported_artifact_media}
  def validate(media_type, bytes) do
    if valid?(media_type, bytes), do: :ok, else: {:error, :unsupported_artifact_media}
  end

  defp valid?("image/svg+xml", bytes) when is_binary(bytes) and byte_size(bytes) <= 1_048_576,
    do: svg?(bytes)

  defp valid?("image/png", bytes)
       when is_binary(bytes) and byte_size(bytes) in 57..33_554_432,
       do: png?(bytes)

  defp valid?(_, _), do: false

  defp svg?(bytes) do
    source =
      case bytes do
        <<239, 187, 191, rest::binary>> -> rest
        other -> other
      end

    String.valid?(source) and
      not Regex.match?(~r/[\x00-\x08\x0b\x0c\x0e-\x1f\x{fffe}\x{ffff}]/u, source) and
      svg_tokens?(source, 0, {[], false, 0})
  end

  defp svg_tokens?(source, cursor, {stack, seen, _}) when byte_size(source) == cursor,
    do: stack == [] and seen

  defp svg_tokens?(source, cursor, state) do
    case Regex.run(@token, source, return: :index, offset: cursor) do
      [{^cursor, length}] ->
        token = binary_part(source, cursor, length)

        case svg_token(token, state) do
          {:ok, state} -> svg_tokens?(source, cursor + length, state)
          :error -> false
        end

      _ ->
        false
    end
  end

  defp svg_token("<" <> _ = token, {stack, seen, count} = state) do
    case Regex.run(~r/\A<\/([A-Za-z]+)[ \t\r\n]*>\z/, token) do
      [_, tag] ->
        case stack do
          [^tag | rest] -> {:ok, {rest, seen, count}}
          _ -> :error
        end

      nil ->
        svg_open(token, state)
    end
  end

  defp svg_token(token, {stack, _, _} = state) do
    if (stack != [] or blank?(token)) and
         token |> String.replace(~r/&(amp|lt|gt|quot|apos);/, "") |> String.contains?("&") ==
           false,
       do: {:ok, state},
       else: :error
  end

  defp svg_open(token, {stack, seen, count}) do
    with [_, tag, source, close] <- Regex.run(~r/\A<([A-Za-z]+)([\s\S]*?)(\/?)>\z/, token),
         true <- tag in @tags and count < 4096,
         root = stack == [],
         true <- not (root and (seen or tag != "svg")) and not (not root and tag == "svg"),
         {:ok, attrs} <- attributes(source, root, %{}),
         true <- not root or valid_viewport?(attrs),
         stack = if(close == "", do: [tag | stack], else: stack),
         true <- length(stack) <= 64 do
      {:ok, {stack, seen or root, count + 1}}
    else
      _ -> :error
    end
  end

  defp valid_viewport?(attrs),
    do:
      attrs["xmlns"] == "http://www.w3.org/2000/svg" and dimension?(attrs["width"]) and
        dimension?(attrs["height"])

  defp attributes(source, root, result) do
    case Regex.run(@attribute, source) do
      [whole, name | values] ->
        value = Enum.find(values, "", &(&1 != ""))

        if map_size(result) < 32 and not Map.has_key?(result, name) and
             attribute?(name, value, root),
           do:
             attributes(
               binary_part(source, byte_size(whole), byte_size(source) - byte_size(whole)),
               root,
               Map.put(result, name, value)
             ),
           else: :error

      _ ->
        if blank?(source), do: {:ok, result}, else: :error
    end
  end

  defp attribute?(name, value, root),
    do:
      byte_size(value) <= 65_536 and not Regex.match?(~r/[<&]|[^\x20-\x7e]/, value) and
        allowed_attribute?(name, value, root)

  defp allowed_attribute?("xmlns", value, root),
    do: root and value == "http://www.w3.org/2000/svg"

  defp allowed_attribute?(name, value, _) when name in ["id", "aria-labelledby"],
    do: Regex.match?(~r/\A[a-zA-Z][a-zA-Z0-9_. -]{0,255}\z/, value)

  defp allowed_attribute?(name, value, _) when name in @numeric,
    do: Regex.match?(@scalar, value) and bounded_number?(String.trim_trailing(value, "px"))

  defp allowed_attribute?("viewBox", value, _) do
    case number_list(value) do
      [_, _, width, height] -> number(width) > 0 and number(height) > 0
      _ -> false
    end
  end

  defp allowed_attribute?(name, value, _) when name in ["fill", "stroke"],
    do:
      Regex.match?(
        ~r/\A(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]{1,32})\z/,
        value
      )

  defp allowed_attribute?("d", value, _),
    do:
      value != "" and Regex.match?(~r/\A[AaCcHhLlMmQqSsTtVvZz0-9eE+.,\s-]+\z/, value) and
        Enum.all?(Regex.scan(@numbers, value), fn [n] -> bounded_number?(n) end)

  defp allowed_attribute?(name, value, _) when name in ["points", "stroke-dasharray"],
    do: value == "none" or number_list(value) != nil

  defp allowed_attribute?("transform", value, _), do: transform?(value)
  defp allowed_attribute?("stroke-linecap", value, _), do: value in ~w(butt round square)
  defp allowed_attribute?("stroke-linejoin", value, _), do: value in ~w(miter round bevel)
  defp allowed_attribute?("text-anchor", value, _), do: value in ~w(start middle end)

  defp allowed_attribute?("font-family", value, _),
    do: Regex.match?(~r/\A[A-Za-z0-9 ,_-]{1,256}\z/, value)

  defp allowed_attribute?("font-weight", value, _),
    do: Regex.match?(~r/\A([1-9]00|normal|bold|bolder|lighter)\z/, value)

  defp allowed_attribute?("font-style", value, _), do: value in ~w(normal italic oblique)
  defp allowed_attribute?("role", value, _), do: value in ~w(img presentation)
  defp allowed_attribute?(_, _, _), do: false

  defp dimension?(value) when is_binary(value) do
    numeric = String.trim_trailing(value, "px")

    Regex.match?(@scalar, value) and bounded_number?(numeric) and number(numeric) > 0 and
      number(numeric) <= 4096
  end

  defp dimension?(_), do: false

  defp number_list(value) do
    values = value |> String.trim() |> String.split(~r/[\s,]+/)
    if length(values) <= 32_768 and Enum.all?(values, &bounded_number?/1), do: values
  end

  defp bounded_number?(value), do: Regex.match?(@plain_number, value) and is_number(number(value))

  defp number(value) do
    normalized =
      value
      |> String.replace(~r/\A([+-]?)\./, "\\g{1}0.")
      |> String.replace(~r/\.(?=e|E|\z)/, ".0")

    case Float.parse(normalized) do
      {number, ""} when abs(number) <= 1_000_000 -> number
      _ -> nil
    end
  end

  defp transform?(value) do
    matches = Regex.scan(@transform, value)

    lengths = %{
      "matrix" => [6],
      "translate" => [1, 2],
      "scale" => [1, 2],
      "rotate" => [1, 3],
      "skewX" => [1],
      "skewY" => [1]
    }

    matches != [] and length(matches) <= 64 and
      Regex.replace(@transform, value, "") |> String.trim() == "" and
      Enum.all?(matches, fn [_, name, args] ->
        values = number_list(args)
        is_list(values) and length(values) in lengths[name]
      end)
  end

  defp blank?(text), do: Regex.match?(~r/\A[ \t\r\n]*\z/, text)

  defp png?(<<137, 80, 78, 71, 13, 10, 26, 10, chunks::binary>>),
    do: png_chunks?(chunks, 0, false)

  defp png?(_), do: false

  defp png_chunks?(<<length::32, type::binary-4, rest::binary>>, count, data)
       when byte_size(rest) >= length + 4 and count < 4096 do
    <<payload::binary-size(^length), crc::32, tail::binary>> = rest

    type in @png_chunks and :erlang.crc32(type <> payload) == crc and
      png_header?(type, payload, count) and
      png_next?(type, payload, tail, count + 1, data or (type == "IDAT" and length > 0))
  end

  defp png_chunks?(_, _, _), do: false

  defp png_next?("IEND", payload, tail, _, data), do: payload == "" and tail == "" and data
  defp png_next?(_, _, tail, count, data), do: png_chunks?(tail, count, data)

  defp png_header?("IHDR", <<width::32, height::32, depth, color, 0, 0, interlace>>, 0) do
    depths = %{0 => [1, 2, 4, 8, 16], 2 => [8, 16], 3 => [1, 2, 4, 8], 4 => [8, 16], 6 => [8, 16]}

    width in 1..4096 and height in 1..4096 and interlace in [0, 1] and
      depth in Map.get(depths, color, [])
  end

  defp png_header?("IHDR", _, _), do: false
  defp png_header?(_, _, 0), do: false
  defp png_header?(_, _, _), do: true
end
