defmodule PhoenixAssets.DocShellTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias DocShell.Json.Canonical

  alias DocShell.Presentation.{
    Conformance,
    Heading,
    Link,
    NavigationItem,
    Page,
    Renderer,
    Site,
    SiteSearchEntry,
    StaticExporter
  }

  alias Phoenix.HTML
  alias PhoenixAssets.DocShell.{ApiReference, Assets, Ast, Components, Pagefind, StaticRenderer}

  import Phoenix.LiveViewTest, only: [render_component: 2]

  test "repeated code and tab groups have deterministic unique identifiers and SSR panels" do
    code = node("pre", [node("code", ["same source"], %{"class" => "language-elixir"})])

    tabs =
      node("tabs", [
        node("p", ["first"], %{"title" => "One"}),
        node("p", ["second"], %{"title" => "Two"})
      ])

    nodes = [code, code, tabs, tabs]
    html = nodes |> Ast.render() |> HTML.safe_to_string()
    ids = Regex.scan(~r/ id="([^"]+)"/, html, capture: :all_but_first) |> List.flatten()
    assert length(ids) == length(Enum.uniq(ids))
    assert html == nodes |> Ast.render() |> HTML.safe_to_string()
    assert length(Regex.scan(~r/role="tabpanel"/, html)) == 4
    refute html =~ ~r/role="tabpanel"[^>]* hidden/
  end

  test "inline search composes with host chrome and bounded facets without an embedded corpus" do
    html =
      render_component(&Components.search/1,
        search: %{"records" => []},
        presentation: :inline,
        trigger: false,
        filter_values: %{
          "kind" => ["guide", "api", "guide", "", String.duplicate("a", 257), <<255>>],
          "locale" => Enum.map(1..300, &Integer.to_string/1),
          "status" => :invalid,
          "unknown" => ["ignored"]
        }
      )

    assert html =~ ~s(<section class="doc-search-inline")
    assert html =~ ~s(data-doc-search-presentation="inline")
    assert html =~ ~s(data-doc-search-filter="kind")
    assert html =~ ~s(<option value="api">api</option><option value="guide">guide</option>)
    assert html =~ ~s(data-doc-search-status)
    assert length(Regex.scan(~r/<option value="[^"]+">/, html)) == 258
    refute html =~ "data-doc-search-open"
    refute html =~ "<dialog"
    refute html =~ ~s(data-doc-search-filter="unknown")
    refute html =~ ~s(data-doc-search-filter="status")

    default = render_component(&Components.search/1, search: %{"records" => []})
    assert default =~ ~s(<dialog class="doc-search-dialog")
    assert default =~ ~s(aria-haspopup="dialog")
  end

  test "AST renderer escapes text, admits closed links, and visibly degrades unsafe input" do
    nodes = [
      node("h2", ["Safe <heading>"], %{"id" => "safe-heading", "onclick" => "bad()"}),
      node("a", ["Open"], %{"href" => "https://example.test/docs"}),
      node("a", ["Rejected"], %{"href" => "java%73cript:alert(1)"}),
      node("script", ["alert('<unsafe>')"]),
      node("img", [], %{"src" => "https://tracker.test/a.png", "alt" => "Remote"})
    ]

    html = nodes |> Ast.render() |> HTML.safe_to_string()

    assert html =~ ~s(id="safe-heading")
    refute html =~ "onclick"
    assert html =~ "Safe &lt;heading&gt;"
    assert html =~ ~s(rel="noopener noreferrer")
    assert html =~ "data-unsafe-link"
    assert html =~ ~s(data-doc-shell-unknown="script")
    assert html =~ "alert(&#39;&lt;unsafe&gt;&#39;)"
    assert html =~ "data-unsafe-media"
    refute html =~ "<script"
  end

  test "static renderer declares normalized fallback and enhancement capabilities" do
    capabilities = StaticRenderer.capabilities()

    assert :ok = Renderer.Capabilities.validate(capabilities)
    assert capabilities.output_modes == [:hosted, :static]
    assert capabilities.features["doc-shell/mermaid/v1"].states == [:fallback, :enhanced]
    refute :connected in capabilities.features["doc-shell/search/v1"].states
    assert :ok = Assets.validate()
    assert Assets.budgets().browser.gzip == 16_384
    assert Enum.all?(Assets.all(), &(byte_size(&1.bytes) > 0))
  end

  test "route-less navigation groups are semantic collapsible branches, never empty links" do
    leaf = %NavigationItem{id: "guide", title: "Guide", path: "/docs/guide/"}
    group = %NavigationItem{id: "section", title: "Section", path: "", children: [leaf]}

    html =
      Components.navigation(%{
        items: [group],
        current_route: leaf.path,
        __changed__: nil
      })
      |> HTML.Safe.to_iodata()
      |> IO.iodata_to_binary()

    assert html =~ ~s(<details class="doc-navigation-group" open>)
    assert html =~ "<summary>Section</summary>"
    assert html =~ ~s(href="/docs/guide/")
    refute html =~ ~s(href="")
  end

  test "consumes DocShell's shared conformance and unsafe-input corpus" do
    assert {:ok, fixture} = Conformance.fixture()
    supported = StaticRenderer.capabilities().features |> Map.keys() |> MapSet.new()

    assert MapSet.subset?(supported, MapSet.new(fixture["features"]))
    assert fixture["focus_order"] == ["skip-link", "primary-navigation", "search", "main-content"]

    for url <- fixture["unsafe_inputs"]["urls"] do
      html = [node("a", ["Rejected"], %{"href" => url})] |> Ast.render() |> HTML.safe_to_string()
      assert html =~ "data-unsafe-link"
    end
  end

  test "static exporter renders the HEEx shell with local hashed assets and no runtime" do
    site = site_fixture()
    destination = temporary_path("static")

    on_exit(fn -> File.rm_rf(destination) end)

    assert {:ok, manifest} =
             StaticExporter.export(
               site: site,
               renderer: StaticRenderer,
               destination: destination,
               canonical_origin: "https://docs.example.test"
             )

    page = File.read!(Path.join(destination, "docs/guide/index.html"))
    assert page =~ "<!doctype html>"
    [_, import_map] = Regex.run(~r/<script type="importmap"[^>]*>(.*?)<\/script>/s, page)
    assert %{"imports" => imports} = Jason.decode!(import_map)
    assert map_size(imports) > 2

    assert Enum.all?(imports, fn {logical, hashed} ->
             String.starts_with?(logical, "/docs/assets/") and
               String.starts_with?(hashed, "/docs/assets/") and logical != hashed
           end)

    assert page =~ "data-content-digest=\"#{site.pages["guide"].content_digest}\""
    assert page =~ "data-cohort-digest=\"#{site.cohort_digest}\""
    assert page =~ "data-pa-doc-shell"
    assert page =~ "Skip to documentation"
    assert page =~ "Search documentation"
    assert page =~ "data-doc-search-contract="
    assert page =~ ~s(data-doc-search-filter="audience")
    assert page =~ ~s(data-doc-search-filter="tag")
    not_found = File.read!(Path.join(destination, "404.html"))
    assert not_found =~ "Search documentation"
    assert not_found =~ ~s(<nav aria-label="Documentation")
    assert page =~ "Diagram source"
    assert page =~ ~s(rel="canonical" href="https://docs.example.test/docs/guide/")
    assert page =~ ~r|/assets/doc-shell-[0-9a-f]{16}\.css|
    assert page =~ ~r|/assets/doc-shell-browser-[0-9a-f]{16}\.js|
    refute page =~ "http://localhost"

    assert manifest["renderer"] == %{
             "id" => "phoenix-assets-heex",
             "version" => PhoenixAssets.version()
           }
  end

  test "OpenAPI renderer admits supported dialects, bounds recursion, and gates requests" do
    spec = %{
      "openapi" => "3.2.0",
      "info" => %{"title" => "Example"},
      "paths" => %{
        "/things" => %{
          "get" => %{
            "operationId" => "listThings",
            "summary" => "List things",
            "responses" => %{"200" => deep_schema(20)}
          }
        }
      }
    }

    assert {:ok, "3.2.0", _, [operation], nil} = ApiReference.normalize(spec)
    assert operation.id == "operation-listThings"

    assert {:error, {:invalid_api_origin, _}} =
             ApiReference.normalize(spec, true, "https://user@example.test/path")

    html =
      %{
        spec: spec,
        request_enabled: true,
        api_origin: "https://api.example.test",
        __changed__: nil
      }
      |> ApiReference.api_reference()
      |> HTML.Safe.to_iodata()
      |> IO.iodata_to_binary()

    assert html =~ "OpenAPI 3.2.0"
    assert html =~ "Destination: https://api.example.test"
    assert html =~ "Complete admitted operation JSON"
  end

  @tag timeout: 60_000
  test "Pagefind adapter runs the pinned native builder and records every output digest" do
    executable = Path.expand("../../npm/doc-shell/node_modules/.bin/pagefind", __DIR__)

    assert {:ok, output} =
             Pagefind.build(site_fixture().search, executable: executable, timeout: 45_000)

    assert output.contract["version"] == "1.5.2"
    assert output.contract["algorithm"] == "pagefind/v1"
    assert Enum.any?(output.assets, &(&1.path == output.contract["path"]))

    assert Map.new(output.assets, &{&1.path, binary_digest(&1.bytes)}) ==
             output.contract["digests"]

    assert Enum.any?(output.assets, &String.starts_with?(&1.path, "pagefind/wasm."))
  end

  defp site_fixture do
    content = [
      node("p", ["Portable documentation content."]),
      node("h2", ["Introduction"], %{"id" => "introduction"}),
      node("pre", [node("code", ["IO.puts(\"hello\")"], %{"class" => "language-elixir"})]),
      node("mermaid", ["graph TD; A-->B"])
    ]

    page = %Page{
      id: "guide",
      collection_id: "phoenix-assets",
      document_id: "guide",
      kind: "guide",
      route: "/docs/guide/",
      title: "Portable guide",
      description: "A renderer conformance fixture.",
      locale: "en",
      audience: "public",
      template: :document,
      content: content,
      content_digest: digest!(content),
      canonical_url: nil,
      source_url: "https://example.test/source",
      edit_url: "https://example.test/edit",
      source_revision: "abc123",
      source_path: "guides/portable.md",
      package_version: "1.1.1",
      last_modified: "2026-09-20",
      status: "stable",
      breadcrumbs: [%Link{title: "Docs", path: "/docs/guide/"}],
      headings: [%Heading{id: "introduction", title: "Introduction", level: 2}],
      previous: nil,
      next: nil,
      tags: ["renderer"],
      metadata: %{},
      banner: %{"label" => "Stable"},
      hero: nil,
      requirements: []
    }

    navigation = [%NavigationItem{id: "guide", title: page.title, path: page.route}]

    search = [
      %SiteSearchEntry{
        id: "guide:introduction",
        page_id: page.id,
        route: page.route <> "#introduction",
        title: page.title,
        section: "Introduction",
        text: "Portable documentation content.",
        locale: "en",
        audience: "public",
        kind: "guide",
        collection: "phoenix-assets",
        version: "1.1.1",
        status: "stable",
        tags: ["renderer"]
      }
    ]

    %Site{
      schema_version: Site.schema_version(),
      generation_id: "generation-1",
      cohort_digest: digest!(%{"generation" => 1}),
      profile: "public",
      title: "Phoenix Assets",
      base_path: "/docs",
      default_locale: "en",
      locales: ["en"],
      pages: %{page.id => page},
      routes: %{page.route => page.id},
      navigation: navigation,
      search: search,
      redirects: %{},
      metadata: %{}
    }
  end

  defp node(tag, content, attrs \\ %{}) do
    %{"tag" => tag, "attrs" => attrs, "content" => content, "meta" => %{}}
  end

  defp deep_schema(0), do: %{"type" => "string", "x-unknown" => true}
  defp deep_schema(depth), do: %{"properties" => %{"child" => deep_schema(depth - 1)}}

  defp digest!(value) do
    {:ok, digest} = Canonical.digest(value)
    digest
  end

  defp binary_digest(value),
    do: "sha256:" <> Base.encode16(:crypto.hash(:sha256, value), case: :lower)

  defp temporary_path(name) do
    token = System.unique_integer([:positive, :monotonic])
    Path.join(System.tmp_dir!(), "phoenix-assets-#{name}-#{token}")
  end
end
