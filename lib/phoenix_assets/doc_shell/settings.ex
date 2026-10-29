if Code.ensure_loaded?(DocShell.Presentation.Site) do
  defmodule PhoenixAssets.DocShell.Settings do
    @moduledoc """
    Admits upstream-owned inert settings at the HEEx renderer boundary.

    Older DocShell releases still render their empty/default context. Nonempty
    settings require the upstream settings validator; this adapter does not
    invent a second portable contract. Hosts supply identity, labels and exact
    destinations, while component slots remain local to the host renderer.
    """

    @upstream DocShell.Presentation.Settings

    unless Code.ensure_loaded?(@upstream) do
      @compile {:no_warn_undefined, [{DocShell.Presentation.Settings, :validate, 1}]}
    end

    @doc "Returns validated context settings or raises before rendering invalid data."
    @spec get(map()) :: map()
    def get(context) do
      settings = Map.get(context, :presentation, %{})

      case validate(settings) do
        :ok ->
          settings

        {:error, reason} ->
          raise ArgumentError, "DocShell settings admission failed: #{inspect(reason)}"
      end
    end

    @doc "Resolves one translated control label with its renderer default."
    @spec label(map(), String.t(), String.t()) :: String.t()
    def label(settings, key, fallback), do: get_in(settings, ["labels", key]) || fallback

    @doc "Resolves a local logical brand asset without rendering an unsafe URL."
    @spec logo_url(map(), map()) :: String.t() | nil
    def logo_url(settings, context) do
      asset = get_in(settings, ["brand", "logo", "asset"])
      url = Map.get(Map.get(context, :assets, %{}), asset)
      if safe_asset_url?(url), do: url
    end

    defp validate(settings) when settings == %{}, do: :ok

    defp validate(settings) do
      upstream = @upstream

      if Code.ensure_loaded?(upstream),
        do: upstream.validate(settings),
        else: {:error, :doc_shell_settings_unavailable}
    end

    defp safe_asset_url?(url) when is_binary(url) do
      not String.contains?(url, ["\\", <<0>>]) and safe_uri?(URI.new(url))
    end

    defp safe_asset_url?(_), do: false

    defp safe_uri?({:ok, %URI{scheme: nil, host: nil, path: path}}),
      do: is_binary(path) and path != ""

    defp safe_uri?({:ok, %URI{scheme: scheme, host: host, userinfo: nil}}),
      do: scheme in ["http", "https"] and is_binary(host)

    defp safe_uri?(_), do: false
  end
end
