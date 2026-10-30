defmodule PhoenixAssets.DocShellArtifactsTest do
  @moduledoc false
  use ExUnit.Case, async: true
  alias PhoenixAssets.DocShell.{Artifacts, Ast, Components}

  @cases "npm/doc-shell/test/fixtures/artifact-conformance-v1.json"
         |> File.read!()
         |> Jason.decode!()
         |> Map.fetch!("cases")
  @current Code.ensure_loaded?(DocShell.Presentation.ArtifactBlock) and
             function_exported?(DocShell.Presentation.ArtifactBlock, :verify_receipt, 2)

  test "ordinary legacy AST needs no artifact integration and typed blocks require a receipt" do
    assert {:ok, %Artifacts.Page{views: %{}, passive?: false}} =
             Artifacts.admit(["ordinary"], nil)

    assert {:error, :artifact_receipt_required} = Artifacts.admit(hd(@cases)["content"], nil)
    assert {:error, :invalid_artifact_inputs} = Artifacts.admit(nil, false)
    refute Artifacts.passive?(nil)

    refute Artifacts.passive?(%{
             "constraints" => %{"available_runtime" => ["browser_js"], "forbidden_runtime" => []}
           })

    assert Artifacts.passive?(%{
             "constraints" => %{
               "available_runtime" => ["browser_js"],
               "forbidden_runtime" => ["browser_js"]
             }
           })
  end

  test "an untyped artifact wrapper cannot hide a nested block that requires a receipt" do
    for tag <- ["artifact", "unknown", "section"] do
      wrapper = %{"tag" => tag, "attrs" => %{}, "meta" => %{}, "content" => hd(@cases)["content"]}
      assert {:error, :artifact_receipt_required} = Artifacts.admit([wrapper], nil)
    end
  end

  test "HEEx formatting preserves both frozen profiles, complete fallback and anchors" do
    for input <- @cases do
      page = formatting_view(input)

      html =
        input["content"]
        |> Ast.render(%{}, artifact_page: page, passive: true)
        |> Phoenix.HTML.safe_to_string()

      assert html =~ ~s(<figure id="#{input["id"]}")
      assert html =~ ~s(data-profile-digest="#{hd(input["receipt"]["blocks"])["profile_digest"]}")
      assert html =~ ~s(data-variant-id="still")
      assert html =~ ~s(lang="#{input["observations"]["locale"]}")
      assert html =~ input["observations"]["caption"]
      assert html =~ input["observations"]["description"]
      for text <- input["observations"]["text"], do: assert(html =~ text)
      for anchor <- input["observations"]["anchors"], do: assert(html =~ ~s(id="#{anchor}"))
      assert html =~ "data:image/svg+xml;base64,"
      refute html =~ "<button"
      refute html =~ "<script"
    end

    assert_raise ArgumentError, ~r/artifact receipt required/, fn ->
      Ast.render(hd(@cases)["content"])
    end
  end

  test "passive code, diagrams and tabs retain text and source IDs without enhancement controls" do
    node = fn tag, id, children ->
      %{"tag" => tag, "attrs" => %{"id" => id}, "content" => children, "meta" => %{}}
    end

    nodes = [
      node.("pre", "source", [node.("code", "code", ["Source text"])]),
      node.("mermaid", "diagram", ["A-->B"]),
      node.("tabs", "panels", ["First panel", "Second panel"])
    ]

    html =
      nodes
      |> Ast.render(%{}, passive: true)
      |> Phoenix.HTML.safe_to_string()

    for text <- ["Source text", "A--&gt;B", "First panel", "Second panel"],
        do: assert(html =~ text)

    for id <- ~w(source code diagram panels), do: assert(html =~ ~s(id="#{id}"))
    refute html =~ "<button"
    refute html =~ "data-doc-enhance"
  end

  test "enhanced wrappers preserve projected anchors outside artifact fallbacks" do
    node = fn tag, id, children ->
      %{"tag" => tag, "attrs" => %{"id" => id}, "content" => children, "meta" => %{}}
    end

    nodes = [
      node.("pre", "pre", [node.("code", "code", ["Source"])]),
      node.("mermaid", "diagram", ["A-->B"]),
      node.("tabs", "panels", ["Panel"]),
      node.("steps", "steps", [node.("step", "step", ["Step"])]),
      node.("accordion", "accordion", ["Body"]),
      node.("callout", "callout", ["Body"]),
      node.("link-card", "link-card", ["Card"])
    ]

    html = nodes |> Ast.render() |> Phoenix.HTML.safe_to_string()

    for id <- ~w(pre code diagram panels steps step accordion callout link-card),
        do: assert(length(Regex.scan(~r/id="#{id}"/, html)) == 1)
  end

  test "ordinary artifact document entry point remains compatible without optional receipt support" do
    import Phoenix.LiveViewTest, only: [render_component: 2]

    html =
      render_component(&Components.artifact_document/1,
        nodes: ["Ordinary text"]
      )

    assert html =~ "Ordinary text"
    assert html =~ "doc-artifact-document"

    assert_raise ArgumentError, ~r/artifact admission failed/, fn ->
      render_component(&Components.artifact_document/1,
        nodes: hd(@cases)["content"]
      )
    end
  end

  test "the installed producer verifies the frozen receipt corpus" do
    for input <- @cases do
      assert {:ok, %Artifacts.Page{receipt: receipt}} =
               Artifacts.admit(input["content"], input["receipt"], assets(input))

      assert receipt == input["receipt"]
    end
  end

  if @current do
    test "both source-owned profiles produce verified passive local views without callbacks" do
      for input <- @cases do
        assert {:ok, %Artifacts.Page{} = page} =
                 Artifacts.admit(input["content"], input["receipt"], assets(input))

        view = page.views[input["id"]]
        assert page.passive?
        assert view.selection == hd(input["receipt"]["blocks"])
        assert view.source == "data:image/svg+xml;base64," <> hd(input["assets"])["base64"]
        assert view.block["caption"] == input["observations"]["caption"]
      end
    end

    test "verified receipts reach the full HEEx and static page paths before any output" do
      import Phoenix.LiveViewTest, only: [render_component: 2]
      alias PhoenixAssets.DocShell.StaticRenderer

      for input <- @cases do
        {site, page, context} = site_page_context(input)
        html = render_component(&Components.page/1, page: page, context: context)
        assert html =~ input["observations"]["caption"]
        assert html =~ "Search requires JavaScript"
        assert html =~ "<aside"
        refute html =~ "<script"
        refute html =~ "<button"
        refute html =~ "<dialog"
        assert {:ok, document} = StaticRenderer.render_page(page, context)
        document = IO.iodata_to_binary(document)
        assert document =~ html
        refute document =~ "<script"
        assert {:ok, own} = StaticRenderer.assets(site, [])
        assert Enum.all?(own, &String.starts_with?(&1.media_type, "text/css"))
        assert {:ok, not_found} = StaticRenderer.render_not_found(site, context)
        refute IO.iodata_to_binary(not_found) =~ "<script"
        refute IO.iodata_to_binary(not_found) =~ "<button"

        stale =
          put_in(
            page.metadata["artifact_presentation"]["page_digest"],
            "sha256:" <> String.duplicate("0", 64)
          )

        assert_raise ArgumentError, ~r/artifact admission failed/, fn ->
          render_component(&Components.page/1, page: stale, context: context)
        end
      end
    end

    test "actual static exports retain selected bytes and fallback in root/subpath web/file readers" do
      alias DocShell.Presentation.{Asset, NavigationItem, StaticExporter}
      alias PhoenixAssets.DocShell.StaticRenderer

      for input <- @cases, base <- ["/", "/review/"], reader <- ["web", "file"] do
        {site, original, _} = site_page_context(input)
        route = String.trim_trailing(base, "/") <> "/guide/"

        page = %{
          original
          | route: route,
            headings: [],
            breadcrumbs: [],
            previous: nil,
            next: nil,
            content_digest: input["receipt"]["page_digest"],
            metadata: %{}
        }

        site = %{
          site
          | base_path: base,
            pages: %{page.id => page},
            routes: %{route => page.id},
            navigation: [%NavigationItem{id: page.id, title: page.title, path: route}],
            search: [],
            redirects: %{}
        }

        binding = %{
          "profile" => input["descriptor"]["profile"],
          "profile_digest" => hd(input["receipt"]["blocks"])["profile_digest"],
          "schema_digest" => input["descriptor"]["input_schema_digest"]
        }

        assert {:ok, caps} = Artifacts.capabilities([binding])
        first = hd(input["assets"])

        asset = %Asset{
          path: first["path"],
          media_type: first["media_type"],
          bytes: Base.decode64!(first["base64"])
        }

        options = [
          profiles: [PhoenixAssets.FrozenArtifactChart, PhoenixAssets.FrozenArtifactDrawing],
          manifests: %{
            hd(input["receipt"]["blocks"])["manifest_digest"] => input["original_manifest"]
          },
          projections: %{
            hd(input["receipt"]["blocks"])["manifest_digest"] => input["checked_projection"]
          },
          assets: [asset],
          capabilities: caps,
          constraints: Map.put(input["constraints"], "reader_mode", reader)
        ]

        destination =
          Path.join(
            System.tmp_dir!(),
            "phoenix-artifact-export-#{System.unique_integer([:positive])}"
          )

        on_exit(fn -> File.rm_rf!(destination) end)

        args = [
          site: site,
          renderer: StaticRenderer,
          destination: destination,
          artifact_options: options
        ]

        assert {:ok, _} = StaticExporter.export(args)
        html_path = Path.join(destination, String.trim_leading(route, "/") <> "index.html")
        html = File.read!(html_path)
        assert html =~ input["observations"]["caption"]
        for text <- input["observations"]["text"], do: assert(html =~ text)
        for anchor <- input["observations"]["anchors"], do: assert(html =~ ~s(id="#{anchor}"))
        refute html =~ "<script"
        refute html =~ "<button"
        refute html =~ "<dialog"
        [_, src] = Regex.run(~r/<img[^>]+src="([^"]+)"/, html)

        image_path =
          if reader == "file",
            do: Path.expand(src, Path.dirname(html_path)),
            else: Path.join(destination, String.trim_leading(src, "/"))

        assert File.read!(image_path) == asset.bytes
        before = File.read!(Path.join(destination, "site-manifest.json"))

        assert {:error, _} =
                 StaticExporter.export(
                   Keyword.put(
                     args,
                     :artifact_options,
                     Keyword.put(options, :assets, [%{asset | bytes: "changed"}])
                   )
                 )

        assert File.read!(Path.join(destination, "site-manifest.json")) == before
        extra = %Asset{path: "unexpected.js", media_type: "text/javascript", bytes: "export {}"}

        assert {:error, _} =
                 StaticExporter.export(Keyword.put(args, :asset_options, assets: [extra]))

        assert File.read!(Path.join(destination, "site-manifest.json")) == before
        assert File.read!(html_path) == html
      end
    end

    test "all diagnostic modes use the same verified receipt, bytes, anchors and fallback" do
      import Phoenix.LiveViewTest, only: [render_component: 2]

      for input <- @cases do
        args = [nodes: input["content"], receipt: input["receipt"], assets: assets(input)]
        document = render_component(&Components.artifact_document/1, args)
        assert document =~ input["observations"]["caption"]

        for mode <- ~w(light dark monochrome enlarged) do
          html = render_component(&Components.artifact_preview/1, args ++ [mode: mode])
          assert html =~ ~s(data-artifact-preview="#{mode}")
          assert html =~ input["receipt"]["page_digest"]
          assert html =~ input["receipt"]["constraints_digest"]
          for text <- input["observations"]["text"], do: assert(html =~ text)

          for binding <- hd(input["receipt"]["blocks"])["bindings"],
              do: assert(html =~ ~s(href="##{binding["anchor"]}"))

          refute html =~ "<button"
          refute html =~ "<form"
          refute html =~ "<script"
        end
      end
    end

    test "stale receipt identity and original asset tampering refuse" do
      input = hd(@cases)
      changed = Map.put(input["receipt"], "page_digest", "sha256:" <> String.duplicate("0", 64))
      assert {:error, _} = Artifacts.admit(input["content"], changed, assets(input))
      assert {:error, _} = Artifacts.admit(input["content"], input["receipt"], %{})
      first = hd(input["assets"])

      for encoded <- [Base.encode64("changed"), "AB==", "A===", "A", "%%=="] do
        changed_assets = %{
          first["path"] => %{"media_type" => first["media_type"], "base64" => encoded}
        }

        assert {:error, _} = Artifacts.admit(input["content"], input["receipt"], changed_assets)
      end
    end

    test "selected URL maps are local inert handoffs and malformed registries refuse" do
      input = hd(@cases)
      name = hd(input["assets"])["path"]

      assert {:ok, page} =
               Artifacts.admit(input["content"], input["receipt"], assets(input), %{
                 name => "/review/assets/selected.svg"
               })

      assert page.views[input["id"]].source == "/review/assets/selected.svg"

      for url <- [
            "//outside.invalid/x",
            "https://outside.invalid/x",
            "javascript:bad()",
            "/x?destination=outside",
            "/x#fragment",
            "/x\\escape"
          ] do
        assert {:error, _} =
                 Artifacts.admit(input["content"], input["receipt"], assets(input), %{name => url})
      end

      for registry <- [
            %{"../escape.svg" => %{}},
            %{name => %{"base64" => "", "media_type" => ""}},
            %{name => %{base64: "", media_type: "image/png"}},
            Map.put(assets(input), String.upcase(name), assets(input)[name])
          ] do
        assert {:error, _} = Artifacts.admit(input["content"], input["receipt"], registry)
      end
    end

    test "capabilities state only the actual passive format subset and remain deterministic" do
      bindings =
        Enum.map(@cases, fn input ->
          %{
            "profile" => input["descriptor"]["profile"],
            "profile_digest" => hd(input["receipt"]["blocks"])["profile_digest"],
            "schema_digest" => input["descriptor"]["input_schema_digest"]
          }
        end)

      assert {:ok, capabilities} = Artifacts.capabilities(bindings)
      assert {:ok, ^capabilities} = Artifacts.capabilities(Enum.reverse(bindings))
      assert capabilities["output_modes"] == ["static"]

      assert Enum.all?(
               capabilities["features"],
               &(&1["runtime"] == [] and &1["state"] == "fallback" and
                   &1["media_types"] == ["image/svg+xml", "image/png"])
             )

      assert {:ok, %{"output_modes" => ["hosted"]}} = Artifacts.capabilities(bindings, :hosted)
      assert {:error, _} = Artifacts.capabilities([hd(bindings), hd(bindings)])
      assert {:error, _} = Artifacts.capabilities([%{}])
      assert {:error, _} = Artifacts.capabilities([], :native)
    end
  else
    test "older producer packages explicitly refuse the new receipt capability" do
      input = hd(@cases)

      assert {:error, :doc_shell_artifact_verifier_unavailable} =
               Artifacts.admit(input["content"], input["receipt"], assets(input))

      assert {:error, :doc_shell_artifact_verifier_unavailable} = Artifacts.capabilities([])
    end
  end

  # Pure HTML formatting fixture; actual admission is exercised separately against the candidate producer.
  defp formatting_view(input) do
    node = hd(input["content"])
    selection = hd(input["receipt"]["blocks"])

    view = %{
      node: node,
      block: node["meta"]["artifact"],
      selection: selection,
      source: "data:image/svg+xml;base64," <> hd(input["assets"])["base64"]
    }

    %Artifacts.Page{views: %{input["id"] => view}, receipt: input["receipt"], passive?: true}
  end

  if @current do
    defp site_page_context(input) do
      site = PhoenixAssets.DocShellConformanceFixture.site!()
      {_, original} = Enum.at(site.pages, 0)

      page = %{
        original
        | content: input["content"],
          requirements: [],
          metadata: %{"artifact_presentation" => input["receipt"]}
      }

      site = %{site | pages: %{page.id => page}}

      context = %DocShell.Presentation.Renderer.Context{
        site_title: site.title,
        cohort_digest: site.cohort_digest,
        base_path: site.base_path,
        current_route: page.route,
        locale: page.locale,
        navigation: site.navigation,
        search: %{"records" => []},
        assets: %{
          "doc-shell.css" => "/assets/renderer.css",
          "doc-shell-browser.js" => "/assets/renderer.js"
        }
      }

      {site, page, Map.put(context, :artifact_assets, assets(input))}
    end
  end

  defp assets(input),
    do: Map.new(input["assets"], &{&1["path"], Map.take(&1, ~w(media_type base64))})
end
