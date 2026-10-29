defmodule PhoenixAssets.DocShellConformanceTest do
  @moduledoc false
  use ExUnit.Case, async: true

  import Phoenix.LiveViewTest, only: [render_component: 2]
  alias DocShell.Presentation.Renderer.Context
  alias PhoenixAssets.DocShell.{Ast, Components, StaticRenderer}
  alias PhoenixAssets.DocShellConformanceFixture

  test "every projected conformance page shares its HEEx body and source digests with static output" do
    site = DocShellConformanceFixture.site!()
    assert map_size(site.pages) == 5

    for {_, page} <- site.pages do
      context = %Context{
        site_title: site.title,
        cohort_digest: site.cohort_digest,
        base_path: site.base_path,
        current_route: page.route,
        locale: page.locale,
        navigation: site.navigation,
        search: %{"records" => site.search},
        assets: %{
          "doc-shell.css" => "/assets/renderer.css",
          "doc-shell-browser.js" => "/assets/renderer.js"
        }
      }

      body = render_component(&Components.page/1, page: page, context: context)
      assert {:ok, document} = StaticRenderer.render_page(page, context)
      document = IO.iodata_to_binary(document)
      assert document =~ body
      assert document =~ page.content_digest
      assert document =~ site.cohort_digest
      for heading <- page.headings, do: assert(document =~ ~s(id="#{heading.id}"))
    end
  end

  test "link cards retain ordinary admitted links and refuse executable destinations" do
    node = fn href ->
      %{
        "tag" => "link-card",
        "attrs" => %{"href" => href, "title" => "Read the guide"},
        "content" => ["Visible explanation"],
        "meta" => %{}
      }
    end

    admitted = [node.("/docs/guide/")] |> Ast.render() |> Phoenix.HTML.safe_to_string()
    refused = [node.("javascript:alert(1)")] |> Ast.render() |> Phoenix.HTML.safe_to_string()
    assert admitted =~ ~s(href="/docs/guide/")
    assert admitted =~ "Read the guide"
    assert refused =~ "Visible explanation"
    assert refused =~ "data-unsafe-link"
    refute refused =~ "javascript:"
  end
end
