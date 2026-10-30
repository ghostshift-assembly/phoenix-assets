defmodule PhoenixAssets.DocShell.Artifacts do
  @moduledoc """
  Verifies producer-admitted artifact receipts and local passive media for HEEx.

  The current DocShell receipt verifier owns portable identity and runtime checks.
  This module adds the renderer's SVG/PNG format and byte checks without calling
  producers, reading files or retrieving URLs. Unknown optional content retains
  its verified textual fallback; an unsupported selected state refuses instead
  of choosing another presentation. Original producer admission and source
  authenticity remain host prerequisites.

  Selected assets are JSON records with `media_type` and canonical `base64`, keyed
  by logical name. Hosted callers can use the default inline data URLs. Static
  export supplies its checked root-relative URL map for the same bytes. Older
  DocShell versions explicitly refuse this capability while ordinary pages keep
  their existing rendering path.
  """

  alias PhoenixAssets.DocShell.ArtifactMedia
  @validator DocShell.Presentation.ArtifactBlock

  defmodule Page do
    @moduledoc "A receipt-verified local rendering view; it is not producer or access authority."
    @enforce_keys [:views, :passive?]
    defstruct @enforce_keys ++ [:receipt]

    @type t :: %__MODULE__{
            views: %{String.t() => map()},
            passive?: boolean(),
            receipt: map() | nil
          }
  end

  @doc "Verifies existing receipt/bytes and returns one local immutable rendering view."
  @spec admit(list(), map() | nil, map(), map()) :: {:ok, Page.t()} | {:error, term()}
  def admit(content, receipt, assets \\ %{}, urls \\ %{})

  def admit(content, nil, _, _) when is_list(content) do
    if typed?(content),
      do: {:error, :artifact_receipt_required},
      else: {:ok, %Page{views: %{}, passive?: false}}
  end

  def admit(content, receipt, assets, urls)
      when is_list(content) and is_map(receipt) and is_map(assets) and is_map(urls) do
    with :ok <- available(),
         {:ok, _} <- verify_receipt(@validator, content, receipt),
         :ok <- registry(assets),
         {:ok, views} <- views(content, receipt, assets, urls) do
      {:ok, %Page{views: views, receipt: receipt, passive?: passive?(receipt)}}
    end
  end

  def admit(_, _, _, _), do: {:error, :invalid_artifact_inputs}

  @doc "Returns whether the supplied receipt excludes browser enhancement work."
  @spec passive?(map() | nil) :: boolean()
  def passive?(%{"constraints" => constraints}) when is_map(constraints) do
    "browser_js" not in Map.get(constraints, "available_runtime", []) or
      "browser_js" in Map.get(constraints, "forbidden_runtime", [])
  end

  def passive?(_), do: false

  @doc "Returns whether any page in an admitted site excludes browser enhancement work."
  @spec passive_site?(map()) :: boolean()
  def passive_site?(%{pages: pages}) when is_map(pages),
    do:
      Enum.any?(pages, fn {_, page} ->
        passive?(get_in(page.metadata, ["artifact_presentation"]))
      end)

  def passive_site?(_), do: false

  @doc "Declares the passive fallback/media subset for explicit profile bindings."
  @spec capabilities([map()], :static | :hosted) :: {:ok, map()} | {:error, term()}
  def capabilities(profiles, mode \\ :static)

  def capabilities(profiles, mode) when is_list(profiles) and mode in [:static, :hosted] do
    with :ok <- available(),
         true <- length(profiles) <= 128 and Enum.all?(profiles, &profile?/1),
         true <- unique?(profiles, & &1["profile"]) and unique?(profiles, & &1["profile_digest"]) do
      features =
        profiles
        |> Enum.sort_by(& &1["profile"])
        |> Enum.map(fn profile ->
          %{
            "id" => "still/" <> String.replace_prefix(profile["profile_digest"], "sha256:", ""),
            "profile" => profile["profile"],
            "profile_digest" => profile["profile_digest"],
            "schema_digest" => profile["schema_digest"],
            "output_mode" => Atom.to_string(mode),
            "state" => "fallback",
            "media_types" => ["image/svg+xml", "image/png"],
            "runtime" => []
          }
        end)

      {:ok,
       %{
         "schema_version" => "doc-shell-renderer-capabilities/v2",
         "renderer_id" => "phoenix-assets-heex",
         "renderer_version" => PhoenixAssets.version(),
         "output_modes" => [Atom.to_string(mode)],
         "features" => features
       }}
    else
      false -> {:error, :invalid_artifact_profile_bindings}
      {:error, _} = error -> error
    end
  end

  def capabilities(_, _), do: {:error, :invalid_artifact_profile_bindings}

  # Dispatch only after the optional API check; old packages have no such function.
  defp verify_receipt(validator, content, receipt), do: validator.verify_receipt(content, receipt)

  defp available do
    if Code.ensure_loaded?(@validator) and function_exported?(@validator, :verify_receipt, 2),
      do: :ok,
      else: {:error, :doc_shell_artifact_verifier_unavailable}
  end

  defp profile?(value) when is_map(value) do
    Enum.sort(Map.keys(value)) == ~w(profile profile_digest schema_digest) and
      text?(value["profile"], 2048) and digest?(value["profile_digest"]) and
      digest?(value["schema_digest"])
  end

  defp profile?(_), do: false
  defp typed?(nodes) when is_list(nodes), do: Enum.any?(nodes, &typed?/1)

  defp typed?(%{"tag" => "artifact", "meta" => %{"artifact" => _}}), do: true

  defp typed?(%{"content" => content}), do: typed?(content)
  defp typed?(_), do: false

  defp blocks(nodes) when is_list(nodes), do: Enum.flat_map(nodes, &blocks/1)
  defp blocks(%{"tag" => "artifact"} = node), do: [node]
  defp blocks(%{"content" => children}), do: blocks(children)
  defp blocks(_), do: []

  defp views(content, receipt, assets, urls) do
    content
    |> blocks()
    |> Enum.zip(receipt["blocks"])
    |> Enum.reduce_while({:ok, %{}, %{}}, fn {node, selection}, {:ok, views, cache} ->
      case selected_asset(selection, assets, urls, cache) do
        {:ok, source, cache} ->
          view = %{
            node: node,
            block: node["meta"]["artifact"],
            selection: selection,
            source: source
          }

          {:cont, {:ok, Map.put(views, selection["block_id"], view), cache}}

        {:error, _} = error ->
          {:halt, error}
      end
    end)
    |> then(fn
      {:ok, views, _} -> {:ok, views}
      error -> error
    end)
  end

  defp selected_asset(%{"variant" => nil}, _, _, cache), do: {:ok, nil, cache}

  defp selected_asset(%{"variant" => variant}, assets, urls, cache) do
    if variant["state"] == "fallback" and variant["runtime"] == [],
      do: verified_asset(variant, assets, urls, cache),
      else: {:error, :unsupported_artifact_renderer_state}
  end

  defp verified_asset(variant, assets, urls, cache) do
    name = variant["asset"]

    case cache[name] do
      nil ->
        with %{"media_type" => media, "base64" => encoded} <- Map.get(assets, name),
             true <- media == variant["media_type"],
             {:ok, bytes} <- Base.decode64(encoded),
             true <- Base.encode64(bytes) == encoded,
             true <-
               byte_size(bytes) == variant["byte_length"] and
                 sha256(bytes) == variant["blob_digest"],
             :ok <- ArtifactMedia.validate(media, bytes),
             {:ok, source} <- source(name, media, encoded, urls) do
          {:ok, source, Map.put(cache, name, {variant, source})}
        else
          _ -> {:error, :invalid_selected_artifact_asset}
        end

      {previous, source} ->
        keys = ~w(media_type blob_digest byte_length)

        if Map.take(previous, keys) == Map.take(variant, keys),
          do: {:ok, source, cache},
          else: {:error, :invalid_selected_artifact_asset}
    end
  end

  defp source(name, media, encoded, urls) do
    case Map.fetch(urls, name) do
      :error ->
        {:ok, "data:#{media};base64,#{encoded}"}

      {:ok, url} ->
        if local_url?(url), do: {:ok, url}, else: {:error, :invalid_artifact_asset_url}
    end
  end

  defp local_url?(url) when is_binary(url) do
    String.starts_with?(url, "/") and not String.starts_with?(url, "//") and
      not Regex.match?(~r/[\x00-\x20\\]/, url) and
      match?({:ok, %URI{scheme: nil, host: nil, query: nil, fragment: nil}}, URI.new(url))
  end

  defp local_url?(_), do: false

  defp registry(assets) do
    names = Map.keys(assets)

    if length(names) <= 4096 and Enum.all?(names, &path?/1) and
         unique?(names, &String.downcase/1),
       do: registry_bytes(Map.values(assets), 0),
       else: {:error, :invalid_artifact_assets}
  end

  defp registry_bytes([], _), do: :ok

  defp registry_bytes([value | rest], total) when is_map(value) do
    with true <- Enum.sort(Map.keys(value)) == ~w(base64 media_type),
         %{"media_type" => media, "base64" => encoded} when is_binary(encoded) <- value,
         true <-
           text?(media, 4096) and byte_size(encoded) <= 44_739_244 and
             rem(byte_size(encoded), 4) == 0,
         padding = padding(encoded),
         bytes = total + div(byte_size(encoded), 4) * 3 - padding,
         true <- bytes <= 268_435_456 do
      registry_bytes(rest, bytes)
    else
      _ -> {:error, :invalid_artifact_assets}
    end
  end

  defp registry_bytes(_, _), do: {:error, :invalid_artifact_assets}

  defp padding(encoded) do
    cond do
      String.ends_with?(encoded, "==") -> 2
      String.ends_with?(encoded, "=") -> 1
      true -> 0
    end
  end

  defp path?(value) when is_binary(value),
    do:
      byte_size(value) <= 512 and
        Regex.match?(~r/\A[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\z/, value) and
        Enum.all?(String.split(value, "/"), &(&1 not in [".", ".."]))

  defp path?(_), do: false

  defp text?(value, maximum),
    do: is_binary(value) and value != "" and byte_size(value) <= maximum and String.valid?(value)

  defp digest?(value), do: is_binary(value) and Regex.match?(~r/\Asha256:[0-9a-f]{64}\z/, value)
  defp unique?(values, key), do: length(values) == length(Enum.uniq_by(values, key))
  defp sha256(bytes), do: "sha256:" <> Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)
end
