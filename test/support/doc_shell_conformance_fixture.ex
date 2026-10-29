defmodule PhoenixAssets.DocShellConformanceFixture do
  @moduledoc false

  alias DocShell.Generate.Collection
  alias DocShell.Presentation.{Conformance, SiteProjector}

  defmodule Source do
    @moduledoc false
    @behaviour DocShell.Presentation.SiteSource

    @impl true
    def project(_, _) do
      pages =
        for name <- ~w(home guide module long rtl) do
          %{
            "id" => "renderer:#{name}",
            "route" => if(name == "home", do: "/", else: "/#{name}/"),
            "locale" => if(name == "rtl", do: "ar", else: "en"),
            "template" => if(name == "home", do: "splash", else: "document"),
            "banner" => %{"label" => "Conformance release"},
            "last_modified" => "2026-10-29",
            "tags" => ["renderer"]
          }
        end

      {:ok,
       %{
         "title" => "Renderer conformance",
         "base_path" => "/conformance/",
         "default_locale" => "en",
         "locales" => ["en", "ar"],
         "pages" => pages,
         "navigation" => [
           %{
             "id" => "reading",
             "title" => "Reading",
             "children" => Enum.map(pages, &Map.take(&1, ["id"]))
           }
         ]
       }}
    end
  end

  def site! do
    {:ok, corpus} = Conformance.fixture()

    {:ok, descriptor} =
      Collection.new(%{
        id: "renderer",
        title: "Renderer",
        version: "1.0.0",
        revision: String.duplicate("a", 40),
        tree_digest: "sha256:" <> String.duplicate("b", 64),
        artifact_dir: "/tmp/phoenix-assets-renderer-fixture",
        source_url: "https://source.example.test/renderer",
        edit_base_url: "https://source.example.test/renderer/edit/revision",
        status: "stable"
      })

    documents = [
      document("home", "Documentation home", [
        node("p", ["Read the same admitted documentation in every renderer."]),
        node("a", ["Start reading"], %{"href" => "/conformance/guide/"})
      ]),
      document("guide", "Directive guide", directives(corpus["directives"])),
      document("module", "Example.Module", [
        node("h2", ["Functions"]),
        node("h3", ["run/1"]),
        node("p", ["Runs the declared operation."]),
        code("elixir", "@spec run(map()) :: :ok\ndef run(input), do: :ok")
      ]),
      document("long", "Long code and tables", [
        node("h2", ["Unbroken source"]),
        code("text", String.duplicate("long_source_", 80)),
        node("table", [
          node("thead", [node("tr", [node("th", ["Field"]), node("th", ["Value"])])]),
          node(
            "tbody",
            Enum.map(1..12, fn index ->
              node("tr", [
                node("td", ["Field #{index}"]),
                node("td", [String.duplicate("unbroken_value_", 30)])
              ])
            end)
          )
        ])
      ]),
      document("rtl", "دليل القراءة", [
        node("h2", ["المقدمة"]),
        node("p", ["وثائق قابلة للقراءة بدون جافاسكريبت."]),
        node("a", ["Documentation home"], %{"href" => "/conformance/"})
      ])
    ]

    collection = %{
      descriptor: descriptor,
      generation_id: "renderer-generation",
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
        generation_id: "renderer-site-generation"
      )

    site
  end

  defp directives(names) do
    [node("h2", ["Content directives"])] ++
      Enum.map(names, fn
        "mermaid" ->
          node("mermaid", ["flowchart LR; A[Read]-->B[Understand]"])

        "steps" ->
          node("steps", [node("step", ["Install dependencies."], %{"title" => "Install"})])

        "tabs" ->
          node("tabs", [
            node("p", ["First panel content"], %{"title" => "First"}),
            node("p", ["Second panel content"], %{"title" => "Second"})
          ])

        "link-card" ->
          node("link-card", ["Follow an ordinary link."], %{
            "href" => "/conformance/module/",
            "title" => "Module reference"
          })

        name ->
          node(name, ["Visible #{name} content."])
      end)
  end

  defp document(id, title, content),
    do: %{
      "id" => "renderer:#{id}",
      "collection_id" => "renderer",
      "document_id" => id,
      "kind" => if(id == "module", do: "module", else: "guide"),
      "title" => title,
      "ast" => content,
      "meta" => %{"source_path" => "#{id}.md"}
    }

  defp code(language, source),
    do: node("pre", [node("code", [source], %{"class" => "language-#{language}"})])

  defp node(tag, content, attrs \\ %{}),
    do: %{"tag" => tag, "attrs" => attrs, "content" => content, "meta" => %{}}
end
