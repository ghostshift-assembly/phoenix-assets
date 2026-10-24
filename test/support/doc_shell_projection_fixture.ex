defmodule PhoenixAssets.DocShellProjectionFixture do
  @moduledoc false

  alias DocShell.Generate.Collection
  alias DocShell.Presentation.SiteProjector

  defmodule Source do
    @moduledoc false
    @behaviour DocShell.Presentation.SiteSource

    @impl true
    def project(_, _) do
      {:ok,
       %{
         "title" => "Projected anchor fixture",
         "base_path" => "/docs/",
         "default_locale" => "en",
         "locales" => ["en"],
         "pages" => [%{"id" => "anchors:guide", "route" => "/guide/"}],
         "navigation" => [%{"id" => "anchors:guide"}]
       }}
    end
  end

  def site!(extra_content \\ []) do
    {:ok, descriptor} =
      Collection.new(%{
        id: "anchors",
        title: "Anchors",
        version: "1.0.0",
        revision: String.duplicate("a", 40),
        tree_digest: "sha256:" <> String.duplicate("b", 64),
        artifact_dir: "/tmp/phoenix-assets-anchor-fixture",
        source_url: "https://source.example.test/anchors",
        edit_base_url: "https://source.example.test/anchors/edit/revision",
        status: "stable"
      })

    documents = [
      %{
        "id" => "anchors:guide",
        "collection_id" => "anchors",
        "document_id" => "guide",
        "kind" => "guide",
        "title" => "Projected anchors",
        "ast" =>
          [
            heading("2026 Setup"),
            heading("中文"),
            heading("中文"),
            heading("Supplied anchor", %{"id" => "章節.2026"})
          ] ++ extra_content,
        "meta" => %{}
      }
    ]

    collection = %{
      descriptor: descriptor,
      generation_id: "anchor-generation",
      content_digest: Collection.digest(documents),
      artifacts: %{},
      sources: [],
      documents: documents
    }

    {:ok, site} =
      SiteProjector.project(
        collections: [collection],
        source: Source,
        profile: "public",
        generation_id: "anchor-site-generation",
        canonical_origin: "https://docs.example.test"
      )

    site
  end

  defp heading(title, attrs \\ %{}) do
    %{"tag" => "h2", "attrs" => attrs, "content" => [title], "meta" => %{}}
  end
end
