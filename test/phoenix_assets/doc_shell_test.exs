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

  alias PhoenixAssets.DocShell.{
    ApiReference,
    Assets,
    Ast,
    Components,
    Pagefind,
    Settings,
    StaticRenderer
  }

  import Phoenix.LiveViewTest, only: [render_component: 2]

  test "navigation uses the closed URL policy and leaves legacy presentation metadata opaque" do
    for path <- [
          "javascript:alert(1)",
          "java%73cript:alert(1)",
          "data:text/html,bad",
          "//other.invalid"
        ] do
      item = %NavigationItem{id: "unsafe", title: "Visible fallback", path: path}
      html = render_component(&Components.navigation/1, items: [item], current_route: "")
      assert html =~ "data-unsafe-link"
      assert html =~ "Visible fallback"
      refute html =~ "href="
    end

    group = %NavigationItem{
      id: "group",
      title: "Group",
      path: "",
      meta: %{"collapsed" => false, "badge" => "Preview"},
      children: [
        %NavigationItem{id: "leaf", title: "Leaf", path: "/guide/", meta: %{"badge" => "New"}}
      ]
    }

    legacy = render_component(&Components.navigation/1, items: [group], current_route: "")
    refute legacy =~ "Preview"
    refute legacy =~ ~s(class="doc-navigation-group" open)

    projected =
      render_component(&Components.navigation/1,
        items: [group],
        current_route: "",
        presentation_metadata?: true
      )

    assert projected =~ "Preview"
    assert projected =~ "New"
    assert projected =~ ~s(class="doc-navigation-group" open)

    choices = [
      %{"id" => "en", "label" => "English", "href" => "/en/", "current" => true},
      %{"id" => "sv", "label" => "Svenska", "href" => "/sv/"}
    ]

    html =
      render_component(&Components.destinations/1,
        choices: choices,
        label: "Language",
        current_id: "sv",
        locale?: true
      )

    assert html =~ ~s(href="/sv/" aria-current="true")
    refute html =~ ~s(href="/en/" aria-current="true")
  end

  test "complete page decorations and supplied local assets reach static output with page SEO precedence" do
    site = site_fixture()
    page = site.pages["guide"]

    hero = %{
      "title" => "Start here",
      "tagline" => "Documentation",
      "description" => "Choose a guide",
      "actions" => [%{"label" => "Read guide", "href" => page.route}],
      "image" => %{"asset" => "hero.svg", "alt" => "Documentation overview"}
    }

    if Code.ensure_loaded?(DocShell.Presentation.PageDecorations) do
      page = %{
        page
        | template: :splash,
          hero: hero,
          banner: %{"label" => "Preview", "text" => "Read this release", "href" => page.route},
          metadata: %{"seo" => %{"description" => "Page SEO", "robots" => ["noindex"]}}
      }

      site =
        Map.put(%{site | pages: %{page.id => page}}, :presentation, %{
          "metadata" => %{"description" => "Site default", "robots" => ["index"]}
        })

      bytes =
        ~s(<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><title>Overview</title></svg>)

      asset = %DocShell.Presentation.Asset{
        path: "hero.svg",
        media_type: "image/svg+xml",
        bytes: bytes
      }

      destination = temporary_path("page-decorations")
      on_exit(fn -> File.rm_rf(destination) end)

      assert {:ok, _} =
               StaticExporter.export(
                 site: site,
                 renderer: StaticRenderer,
                 destination: destination,
                 asset_options: [assets: [asset]]
               )

      html = destination |> Path.join("docs/guide/index.html") |> File.read!()
      assert html =~ ~s(data-doc-template="splash")
      assert html =~ "Start here"
      assert html =~ "Read this release"
      assert html =~ "Read guide"
      assert html =~ ~s(alt="Documentation overview")
      assert html =~ ~s(name="description" content="Page SEO")
      assert html =~ ~s(name="robots" content="noindex")
      [_, image] = Regex.run(~r/<img[^>]+src="([^"]+)"/, html)
      assert File.read!(Path.join(destination, String.trim_leading(image, "/"))) == bytes

      assert {:error, _} =
               StaticExporter.export(
                 site: site,
                 renderer: StaticRenderer,
                 destination: destination,
                 asset_options: [assets: [%{asset | path: "../unsafe.svg"}]]
               )

      assert File.read!(Path.join(destination, "docs/guide/index.html")) == html
    else
      assert_raise ArgumentError, ~r/decoration API unavailable/, fn ->
        Settings.admit_page(%{hero: hero})
      end
    end

    for options <- [[unknown: true], [assets: :invalid], [assets: [:invalid]]] do
      assert {:error, {:invalid_doc_shell_asset_options, ^options}} =
               StaticRenderer.assets(site, options)
    end
  end

  test "hosted API pair admission happens before rendering narrative or operations" do
    fixture =
      Path.expand("../../npm/doc-shell/test/fixtures/hosted-pair-v1.json", __DIR__)
      |> File.read!()
      |> Jason.decode!()

    expected = fixture["binding"]

    presentation = %{
      schema_version: "doc-shell/v2",
      navigation: [],
      search: [],
      content: fixture["presentation"]["content"],
      publication: expected
    }

    spec = Map.put(fixture["openapi"], "x-doc-shell-publication", expected)
    args = [presentation: presentation, spec: spec, expected: expected, current_id: "intro"]

    if Code.ensure_loaded?(DocShell.Presentation.HostedPair) do
      html = render_component(&ApiReference.hosted_reference/1, args)
      assert html =~ "Public documentation"
      assert html =~ "Public API"
      assert html =~ ~s(data-doc-publication="snapshot-1")
      refute html =~ "data-doc-api-request"

      for field <- fixture["mismatch_fields"] do
        changed = put_in(spec, ["x-doc-shell-publication", field], "other")

        assert_raise ArgumentError, ~r/publication_mismatch/, fn ->
          render_component(&ApiReference.hosted_reference/1, Keyword.put(args, :spec, changed))
        end
      end

      stale = Map.put(expected, "publication_id", "older")

      stale_args =
        args
        |> Keyword.put(:presentation, %{presentation | publication: stale})
        |> Keyword.put(:spec, Map.put(spec, "x-doc-shell-publication", stale))

      assert_raise ArgumentError, ~r/publication_mismatch/, fn ->
        render_component(&ApiReference.hosted_reference/1, stale_args)
      end

      assert_raise ArgumentError, ~r/hosted pair admission failed/, fn ->
        render_component(
          &ApiReference.hosted_reference/1,
          Keyword.put(args, :current_id, "missing")
        )
      end
    else
      assert_raise ArgumentError, ~r/doc_shell_hosted_pair_unavailable/, fn ->
        render_component(&ApiReference.hosted_reference/1, args)
      end
    end
  end

  test "settings remain optional on older producers and reject malformed values before rendering" do
    assert Settings.get(%{}) == %{}
    assert Settings.label(%{}, "search", "Search") == "Search"

    assert_raise ArgumentError, ~r/DocShell settings admission failed/, fn ->
      Settings.get(%{presentation: %{"unknown" => true}})
    end

    settings = %{"brand" => %{"logo" => %{"asset" => "logo.svg"}}}

    assert Settings.logo_url(settings, %{assets: %{"logo.svg" => "/assets/logo.svg"}}) ==
             "/assets/logo.svg"

    assert Settings.logo_url(settings, %{assets: %{"logo.svg" => "https://example.test/logo.svg"}}) ==
             "https://example.test/logo.svg"

    assert Settings.logo_url(settings, %{}) == nil

    for url <- [
          "javascript:alert(1)",
          "data:image/svg+xml,bad",
          "//other.invalid/logo.svg",
          "/a\\b",
          "http://["
        ] do
      assert Settings.logo_url(settings, %{assets: %{"logo.svg" => url}}) == nil
    end
  end

  test "shell controls cannot capture authored document anchors" do
    site = site_fixture()
    page = site.pages["guide"]

    ids =
      ~w(doc-main doc-main-1 doc-navigation doc-search-query doc-search-results doc-search-1-query)

    content = page.content ++ Enum.map(ids, &node("span", [&1], %{"id" => &1}))
    page = %{page | content: content, content_digest: digest!(content)}

    context = %DocShell.Presentation.Renderer.Context{
      site_title: site.title,
      cohort_digest: site.cohort_digest,
      base_path: site.base_path,
      current_route: page.route,
      locale: page.locale,
      navigation: site.navigation,
      search: %{"records" => site.search},
      assets: %{}
    }

    html = render_component(&Components.page/1, page: page, context: context)

    rendered_ids =
      Regex.scan(~r/(?<![\w-])id="([^"]+)"/, html, capture: :all_but_first) |> List.flatten()

    assert length(rendered_ids) == length(Enum.uniq(rendered_ids))
    for id <- ids, do: assert(html =~ ~s(<span id="#{id}">#{id}</span>))
    assert html =~ ~s(href="#doc-main-2")
    assert html =~ ~s(<main id="doc-main-2")
    assert html =~ ~s(aria-controls="doc-navigation-1")
    assert html =~ ~s(id="doc-navigation-1")
    assert html =~ ~s(for="doc-search-2-query")
    assert html =~ ~s(id="doc-search-2-query")
    assert html =~ ~s(aria-controls="doc-search-2-results")
    assert html =~ ~s(id="doc-search-2-results")
  end

  test "current producer settings reach static pages, not-found output and document metadata" do
    settings = %{
      "brand" => %{"label" => "Example brand", "href" => "/docs/guide/"},
      "labels" => %{
        "search" => "Sök dokumentation",
        "theme_dark" => "Mörkt",
        "language" => "Språk",
        "not_found" => "Sidan saknas"
      },
      "locales" => [
        %{"id" => "sv", "label" => "Svenska", "href" => "/docs/guide/", "current" => true}
      ],
      "releases" => [
        %{"id" => "v1", "label" => "Version 1", "href" => "https://example.test/v1/"}
      ],
      "footer" => %{
        "text" => "Example footer",
        "links" => [%{"label" => "Support", "href" => "https://example.test/support"}]
      },
      "metadata" => %{
        "description" => "Site description",
        "image" => "https://example.test/social.png",
        "robots" => ["noindex", "nofollow"]
      }
    }

    if Code.ensure_loaded?(DocShell.Presentation.Settings) do
      site = Map.put(site_fixture(), :presentation, settings)
      destination = temporary_path("settings")
      on_exit(fn -> File.rm_rf(destination) end)

      assert {:ok, _} =
               StaticExporter.export(
                 site: site,
                 renderer: StaticRenderer,
                 destination: destination
               )

      html = destination |> Path.join("docs/guide/index.html") |> File.read!()
      assert html =~ "Example brand"
      assert html =~ "Sök dokumentation"
      assert html =~ "Mörkt"
      assert html =~ ~s(aria-label="Språk")
      assert html =~ ~s(hreflang="sv")
      assert html =~ ~s(aria-current="true")
      assert html =~ "Example footer"
      assert html =~ ~s(<footer)
      assert html =~ ~s(name="description" content="A renderer conformance fixture.")
      assert html =~ ~s(property="og:image" content="https://example.test/social.png")
      assert html =~ ~s(name="robots" content="noindex, nofollow")
      missing = destination |> Path.join("404.html") |> File.read!()
      assert missing =~ "Sidan saknas"
      assert missing =~ "Example footer"
      assert missing =~ ~s(name="description" content="Site description")
    else
      assert_raise ArgumentError, ~r/doc_shell_settings_unavailable/, fn ->
        Settings.get(%{presentation: settings})
      end
    end
  end

  test "Mermaid code fences and step titles preserve their reader semantics" do
    html =
      [
        node("pre", [node("code", ["graph LR; A-->B"], %{"class" => "language-mermaid"})]),
        node("steps", [node("step", ["Instructions"], %{"title" => "Install"})])
      ]
      |> Ast.render()
      |> HTML.safe_to_string()

    assert html =~ "data-doc-mermaid"
    assert html =~ "<h3>Install</h3>"
    refute html =~ "data-doc-enhance=\"highlight\""
  end

  test "nested AST controls inherit escaped host labels while source text stays unchanged" do
    nodes = [
      node("blockquote", [
        node("pre", [node("code", ["source wording"], %{"class" => "language-elixir"})]),
        node("mermaid", ["graph TD; A-->B"]),
        node("accordion", ["explanation"]),
        node("tabs", [node("p", ["first"]), node("p", ["second"])])
      ])
    ]

    labels = %{
      "copy" => "Kopiera",
      "copy_code" => "Kopiera kod",
      "highlight_code" => "Markera kod",
      "render_diagram" => "Visa diagram",
      "diagram_source" => "Diagramkälla",
      "details" => "Detaljer",
      "documentation_tabs" => "Exempel",
      "tab" => "Flik"
    }

    html = nodes |> Ast.render(labels) |> HTML.safe_to_string()
    assert html =~ ~s(aria-label="Kopiera kod">Kopiera</button>)
    assert html =~ "Markera kod"
    assert html =~ "Visa diagram"
    assert html =~ "Diagramkälla"
    assert html =~ "<summary>Detaljer</summary>"
    assert html =~ ~s(aria-label="Exempel")
    assert html =~ "Flik 1"
    assert html =~ "source wording"
    refute html =~ "__doc_shell_labels"
    escaped = nodes |> Ast.render(%{"copy" => "<script>bad()</script>"}) |> HTML.safe_to_string()
    assert escaped =~ "&lt;script&gt;bad()&lt;/script&gt;"
    refute escaped =~ "<script>bad()"
  end

  test "API controls carry host labels into forms and browser status scope" do
    spec = %{
      "openapi" => "3.1.0",
      "info" => %{"title" => "Source API"},
      "paths" => %{
        "/items" => %{
          "post" => %{
            "summary" => "Source summary",
            "parameters" => [
              %{
                "name" => "id",
                "in" => "query",
                "required" => true,
                "description" => "Source parameter"
              }
            ],
            "responses" => %{"200" => %{"description" => "Success"}}
          }
        }
      }
    }

    settings = %{
      "labels" => %{
        "api_operations" => "API-metoder",
        "parameters" => "Parametrar",
        "send_request" => "Skicka",
        "operation_path" => "Sökväg",
        "bearer_token" => "Åtkomsttoken",
        "request_requires_js" => "Kräver JavaScript",
        "sending" => "Skickar",
        "openapi_json" => "Hela JSON"
      }
    }

    html =
      render_component(&ApiReference.api_reference/1,
        spec: spec,
        request_enabled: true,
        api_origin: "https://api.example.test",
        settings: settings
      )

    assert html =~ ~s(aria-label="API-metoder")
    assert html =~ "Parametrar"
    assert html =~ "<legend>Skicka</legend>"
    assert html =~ "Sökväg"
    assert html =~ "Åtkomsttoken"
    assert html =~ "Kräver JavaScript"
    assert html =~ "Hela JSON"
    assert html =~ "data-doc-labels="
    assert html =~ "Skickar"
    assert html =~ "Source summary"
  end

  test "inline anchors and mixed pre content retain every semantic child" do
    nodes = [
      node("span", ["Subject"], %{"id" => "subject"}),
      node("span", ["Inert"], %{"id" => ["ghost"]}),
      node("pre", [node("code", ["source"]), node("strong", ["Required warning"])])
    ]

    html = nodes |> Ast.render() |> HTML.safe_to_string()
    assert html =~ ~s(<span id="subject">Subject</span>)
    refute html =~ ~s(id="ghost")
    assert html =~ "<pre><code>source</code><strong>Required warning</strong></pre>"
  end

  test "upstream-valid JSON attribute values cannot crash code fences or become HTML attributes" do
    for value <- [1, false, nil, ["text"], %{"nested" => "value"}] do
      nodes = [
        node("pre", [node("code", ["source stays readable"], %{"class" => value})]),
        node("a", ["Link text"], %{"href" => value}),
        node("img", [], %{"src" => value, "alt" => value}),
        node("h2", ["A heading"], %{"id" => value})
      ]

      assert DocShell.Ast.valid?(nodes)
      html = nodes |> Ast.render() |> HTML.safe_to_string()
      assert html =~ "source stays readable"
      assert html =~ ~s(data-language="text")
      assert html =~ "data-unsafe-link"
      assert html =~ "data-unsafe-media"
      refute html =~ "<img"
      refute html =~ ~s(<h2 id=)
    end
  end

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

    header =
      Components.header(%{
        context: %{navigation: [group], site_title: "Docs", search: %{"records" => []}},
        brand: [],
        __changed__: nil
      })
      |> HTML.Safe.to_iodata()
      |> IO.iodata_to_binary()

    assert header =~ ~s(href="/docs/guide/")
    refute header =~ ~s(href="")
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

  test "regional RTL locales agree between the HTML document and HEEx shell" do
    site = site_fixture()
    page = Map.fetch!(site.pages, "guide")
    site = %{site | locales: ["en", "ur-PK"], pages: %{page.id => %{page | locale: "ur-PK"}}}
    destination = temporary_path("rtl")
    on_exit(fn -> File.rm_rf(destination) end)

    assert {:ok, _} =
             StaticExporter.export(
               site: site,
               renderer: StaticRenderer,
               destination: destination,
               canonical_origin: "https://docs.example.test"
             )

    html = destination |> Path.join("docs/guide/index.html") |> File.read!()
    assert html =~ ~s(<html lang="ur-PK" dir="rtl">)
    assert html =~ ~r/<div\b(?=[^>]*\bdir="rtl")(?=[^>]*\blang="ur-PK")[^>]*>/
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
    assert operation.id == "operation-0-listThings"

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

  test "OpenAPI output retains every operation, unknown fields and method-specific body controls" do
    spec =
      Path.expand("../../npm/doc-shell/test/fixtures/openapi.json", __DIR__)
      |> File.read!()
      |> Jason.decode!()

    render = fn enabled ->
      %{
        spec: spec,
        request_enabled: enabled,
        api_origin: "https://api.example.test",
        __changed__: nil
      }
      |> ApiReference.api_reference()
      |> HTML.Safe.to_iodata()
      |> IO.iodata_to_binary()
    end

    fallback = render.(false)
    for title <- ["Health check", "List things", "Create thing"], do: assert(fallback =~ title)
    assert fallback =~ "Read the admitted collection without changing it."
    assert fallback =~ "queryThings"
    assert fallback =~ "Complete admitted OpenAPI JSON"
    refute fallback =~ "data-doc-api-request"

    enabled = render.(true)
    assert length(Regex.scan(~r/method="dialog"/, enabled)) == 3
    assert length(Regex.scan(~r/<fieldset disabled data-doc-api-controls>/, enabled)) == 3

    forms =
      Regex.scan(~r/data-operation-method="([A-Z]+)"[^>]*>(.*?)<\/form>/s, enabled,
        capture: :all_but_first
      )

    assert length(forms) == 3

    for [method, form] <- forms do
      if method in ["GET", "HEAD"],
        do: refute(form =~ ~s(name="body")),
        else: assert(form =~ ~s(name="body"))
    end

    assert {:error, {:unsupported_openapi_version, "3.0invalid"}} =
             ApiReference.normalize(%{"openapi" => "3.0invalid"})
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

    assert Enum.any?(output.assets, &String.contains?(&1.path, "/wasm."))
    assert Map.keys(output.contract["indexes"]) == ["en"]
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
