unless Code.ensure_loaded?(PhoenixAssets.QualificationRenderer) do
  defmodule PhoenixAssets.QualificationRenderer do
    @moduledoc false
    @behaviour DocShell.Presentation.Renderer
    alias PhoenixAssets.DocShell.StaticRenderer

    @impl true
    def render_page(page, context) do
      Process.put({__MODULE__, page.id}, context)
      StaticRenderer.render_page(page, context)
    end

    @impl true
    defdelegate render_not_found(site, context), to: StaticRenderer
    @impl true
    defdelegate assets(site, options), to: StaticRenderer
    @impl true
    defdelegate capabilities(), to: StaticRenderer

    def contexts(site),
      do: Map.new(site.pages, fn {id, _} -> {id, Process.get({__MODULE__, id})} end)
  end
end
