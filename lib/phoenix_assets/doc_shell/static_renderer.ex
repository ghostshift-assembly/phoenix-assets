if Code.ensure_loaded?(DocShell.Presentation.Renderer) and Code.ensure_loaded?(Phoenix.Component) do
  defmodule PhoenixAssets.DocShell.StaticRenderer do
    @moduledoc """
    No-start static DocShell renderer backed by the same HEEx components as LiveView.

    It starts no endpoint, socket, PubSub, supervision tree, or asset server.
    DocShell's exporter supplies local content-hashed asset paths in the inert
    renderer context.
    """

    @behaviour DocShell.Presentation.Renderer

    alias DocShell.Presentation.{Page, Renderer, Site}
    alias DocShell.Presentation.Renderer.{Capabilities, Capability, Context}
    alias Phoenix.HTML
    alias PhoenixAssets.DocShell.{Assets, Components}

    @impl true
    def render_page(%Page{} = page, %Context{} = context) do
      with :ok <- Renderer.admit(page, capabilities(), :static) do
        body =
          Components.page(%{
            page: page,
            context: context,
            brand: [],
            footer: [],
            __changed__: nil
          })

        {:ok, document(page.title, page.locale, page.canonical_url, context, body)}
      end
    end

    @impl true
    def render_not_found(%Site{} = site, %Context{} = context) do
      body = Components.not_found(%{site: site, context: context, __changed__: nil})
      {:ok, document("Page not found", context.locale, nil, context, body)}
    end

    @impl true
    def assets(%Site{}, options) when is_list(options) do
      if Keyword.keyword?(options) and options == [] do
        with :ok <- Assets.validate(), do: {:ok, Assets.all()}
      else
        {:error, {:invalid_doc_shell_asset_options, options}}
      end
    end

    @impl true
    def capabilities do
      enhanced = %Capability{states: [:fallback, :enhanced], runtime: [:browser_js]}

      %Capabilities{
        schema_version: Capabilities.schema_version(),
        renderer_id: "phoenix-assets-heex",
        renderer_version: PhoenixAssets.version(),
        output_modes: [:hosted, :static],
        features: %{
          "doc-shell/html/v1" => %Capability{states: [:fallback, :enhanced], runtime: []},
          "doc-shell/search/v1" => enhanced,
          "doc-shell/theme/v1" => enhanced,
          "doc-shell/navigation/v1" => enhanced,
          "doc-shell/copy/v1" => enhanced,
          "doc-shell/tabs/v1" => enhanced,
          "doc-shell/highlight/v1" => enhanced,
          "doc-shell/mermaid/v1" => enhanced
        }
      }
    end

    defp document(title, locale, canonical_url, context, body) do
      direction =
        if Regex.match?(~r/\A(?:ar|fa|he|ur)(?:[-_]|\z)/i, locale), do: "rtl", else: "ltr"

      css = Map.fetch!(context.assets, "doc-shell.css")
      browser = Map.fetch!(context.assets, "doc-shell-browser.js")
      canonical = canonical_url || canonical(context.canonical_origin, context.current_route)

      [
        "<!doctype html><html lang=\"",
        escape_attribute(locale),
        "\" dir=\"",
        direction,
        "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>",
        escape(title),
        " · ",
        escape(context.site_title),
        "</title>",
        canonical_link(canonical),
        "<link rel=\"stylesheet\" href=\"",
        escape_attribute(css),
        "\"><script type=\"module\" src=\"",
        escape_attribute(browser),
        "\"></script></head><body class=\"doc-shell\" data-pa-doc-shell>",
        HTML.Safe.to_iodata(body),
        "</body></html>"
      ]
    end

    defp canonical(nil, _), do: nil
    defp canonical(origin, route), do: String.trim_trailing(origin, "/") <> route
    defp canonical_link(nil), do: []

    defp canonical_link(url),
      do: ["<link rel=\"canonical\" href=\"", escape_attribute(url), "\">"]

    defp escape(value), do: value |> HTML.html_escape() |> HTML.Safe.to_iodata()

    defp escape_attribute(value) do
      {:safe, escaped} = HTML.html_escape(value)
      escaped
    end
  end
end
