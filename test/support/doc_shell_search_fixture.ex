defmodule PhoenixAssets.DocShellSearchFixture do
  @moduledoc false

  alias DocShell.Generate.Collection
  alias DocShell.Presentation.SiteProjector

  defmodule Source do
    @moduledoc false
    @behaviour DocShell.Presentation.SiteSource

    @impl true
    def project(_, options) do
      pages = [
        %{"id" => "guides:english", "route" => "/en/guide/", "locale" => "en"},
        %{"id" => "guides:swedish", "route" => "/sv/guide/", "locale" => "sv"},
        %{"id" => "reference:api", "route" => "/en/api/", "locale" => "en"},
        %{"id" => "reference:private", "route" => "/private/", "status" => "private"}
      ]

      {:ok,
       %{
         "title" => "Search conformance",
         "base_path" => Keyword.get(options, :base_path, "/docs/"),
         "default_locale" => "en",
         "locales" => ["en", "sv"],
         "pages" => pages,
         "navigation" => Enum.take(pages, 3) |> Enum.map(&Map.take(&1, ["id"]))
       }}
    end
  end

  def site!(base_path \\ "/docs/") do
    guides = [
      document("guides", "english", "guide", "Portable guide", "Introduction", "public"),
      document("guides", "swedish", "guide", "Portabel guide", "Introduktion", "public")
    ]

    reference = [
      document("reference", "api", "openapi", "Portable API", "Operations", ["public", "operator"]),
      document("reference", "private", "guide", "Private sentinel", "Secret sentinel", "operator")
    ]

    {:ok, site} =
      SiteProjector.project(
        collections: [
          collection("guides", "1.0.0", guides),
          collection("reference", "2.0.0", reference)
        ],
        source: Source,
        source_options: [base_path: base_path],
        profile: "public",
        generation_id: "search-conformance-generation"
      )

    site
  end

  defp document(collection, id, kind, title, heading, audience) do
    %{
      "id" => "#{collection}:#{id}",
      "collection_id" => collection,
      "document_id" => id,
      "kind" => kind,
      "title" => title,
      "ast" => [node("h2", heading), node("p", "#{title} content for #{heading}.")],
      "meta" => %{"audience" => audience, "tags" => [kind], "status" => "stable"}
    }
  end

  defp collection(id, version, documents) do
    {:ok, descriptor} =
      Collection.new(%{
        id: id,
        title: id,
        version: version,
        revision: String.duplicate("a", 40),
        tree_digest: "sha256:" <> String.duplicate("b", 64),
        artifact_dir: "/tmp/phoenix-assets-search-fixture/#{id}",
        source_url: "https://source.example.test/#{id}",
        edit_base_url: "https://source.example.test/#{id}/edit/revision",
        status: "stable"
      })

    %{
      descriptor: descriptor,
      generation_id: "#{id}-generation",
      content_digest: Collection.digest(documents),
      artifacts: %{},
      sources: [],
      documents: documents
    }
  end

  defp node(tag, text), do: %{"tag" => tag, "attrs" => %{}, "content" => [text], "meta" => %{}}
end
