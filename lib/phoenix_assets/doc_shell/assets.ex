if Code.ensure_loaded?(DocShell.Presentation.Asset) do
  defmodule PhoenixAssets.DocShell.Assets do
    @moduledoc """
    Local DocShell browser assets for hosted and static renderers.

    The base entry has no Svelte import. Optional highlighting and diagram modules
    load on explicit use; the exporter content-hashes every declared local chunk.
    """

    alias DocShell.Presentation.Asset

    @directory Path.expand("../../../priv/doc_shell", __DIR__)
    @paths @directory
           |> Path.join("*")
           |> Path.wildcard()
           |> Enum.filter(&(Path.extname(&1) in [".css", ".js"]))
    for path <- @paths, do: @external_resource(path)
    @embedded Enum.map(@paths, &{Path.basename(&1), File.read!(&1)})
    @budgets %{
      css: %{raw: 49_152, gzip: 12_288},
      browser: %{raw: 49_152, gzip: 16_384},
      highlight: %{raw: 196_608, gzip: 65_536},
      mermaid: %{raw: 2_097_152, gzip: 655_360}
    }

    @doc "Returns all local entries and chunks at logical paths for content hashing."
    @spec all() :: [Asset.t()]
    def all do
      Enum.map(@embedded, fn {name, bytes} ->
        media = if Path.extname(name) == ".css", do: "text/css", else: "text/javascript"
        %Asset{path: name, media_type: media <> "; charset=utf-8", bytes: bytes}
      end)
    end

    @doc "Returns per-file raw and gzip budgets for the base and optional modules."
    @spec budgets() :: %{atom() => %{raw: pos_integer(), gzip: pos_integer()}}
    def budgets, do: @budgets

    @doc "Builds a native import map from logical chunks to exporter-hashed URLs."
    @spec import_map(%{String.t() => String.t()}) :: map()
    def import_map(assets) do
      javascript = Enum.filter(assets, fn {name, _} -> String.ends_with?(name, ".js") end)

      directories =
        javascript
        |> Enum.map(fn {_, url} ->
          url |> String.split("/") |> Enum.drop(-1) |> Enum.join("/")
        end)
        |> Enum.uniq()

      %{
        "imports" =>
          Map.new(
            for directory <- directories,
                {name, url} <- javascript,
                do: {directory <> "/" <> name, url}
          )
      }
    end

    @doc "Validates size, local imports, source-map absence and Svelte isolation."
    @spec validate() :: :ok | {:error, term()}
    def validate do
      Enum.reduce_while(@embedded, :ok, fn {name, bytes}, :ok ->
        category = category(name)
        budget = Map.fetch!(@budgets, category)

        cond do
          byte_size(bytes) > budget.raw or byte_size(:zlib.gzip(bytes)) > budget.gzip ->
            {:halt,
             {:error,
              {:asset_budget, name, %{raw: byte_size(bytes), gzip: byte_size(:zlib.gzip(bytes))},
               budget}}}

          Regex.match?(~r/(?:from\s*|import\s*\()\s*["']svelte/, bytes) ->
            {:halt, {:error, {:svelte_browser_import, name}}}

          Regex.match?(~r/^[\t ]*\/\/[#@]\s*sourceMappingURL=/m, bytes) ->
            {:halt, {:error, {:source_map, name}}}

          Regex.match?(
            ~r/(?:from\s*|import\s*\(|url\(|@import\s*)\s*["']?(?:https?:)?\/\//,
            bytes
          ) ->
            {:halt, {:error, {:remote_runtime_asset, name}}}

          true ->
            {:cont, :ok}
        end
      end)
    end

    defp category("doc-shell.css"), do: :css
    defp category("doc-shell-browser.js"), do: :browser
    defp category("doc-shell-highlight.js"), do: :highlight
    defp category(_), do: :mermaid
  end
end
