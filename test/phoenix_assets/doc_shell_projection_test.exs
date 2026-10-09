defmodule PhoenixAssets.DocShellProjectionTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias DocShell.Presentation.StaticExporter
  alias PhoenixAssets.DocShell.StaticRenderer
  alias PhoenixAssets.DocShellProjectionFixture

  test "public site projection preserves every heading target in static HTML" do
    site = DocShellProjectionFixture.site!()
    page = site.pages["anchors:guide"]
    ids = Enum.map(page.headings, & &1.id)

    assert ids == ["2026-setup", "中文", "中文-2", "章節.2026"]

    destination =
      Path.join(System.tmp_dir!(), "phoenix-assets-anchors-#{System.unique_integer([:positive])}")

    on_exit(fn -> File.rm_rf!(destination) end)

    assert {:ok, _} =
             StaticExporter.export(
               site: site,
               renderer: StaticRenderer,
               destination: destination,
               canonical_origin: "https://docs.example.test"
             )

    html = File.read!(Path.join(destination, "docs/guide/index.html"))

    for id <- ids do
      assert html =~ ~s(<h2 id="#{id}">)
      assert html =~ ~s(href="##{id}")
      assert Enum.any?(site.search, &String.ends_with?(&1.route, "##{id}"))
    end
  end

  test "mounted Svelte fixture contains the exact public site projection" do
    path = Path.expand("../../npm/doc-shell/test/fixtures/projected-site.json", __DIR__)
    projected = DocShellProjectionFixture.site!() |> Jason.encode!() |> Jason.decode!()
    assert Jason.decode!(File.read!(path)) == projected
  end
end
