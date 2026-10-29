unless Code.ensure_loaded?(PhoenixAssets.DocShellSearchFixture) do
  Code.require_file("../test/support/doc_shell_search_fixture.ex", __DIR__)
end

Code.require_file("fixture-renderer.exs", __DIR__)

alias DocShell.Presentation.{SearchAdapter, StaticExporter}
alias PhoenixAssets.DocShell.Pagefind

destination = System.argv() |> List.last() |> Path.expand()
executable = Path.expand("../npm/doc-shell/node_modules/.bin/pagefind", __DIR__)

for {name, adapter, options} <- [
      {"json", SearchAdapter.JSON, []},
      {"pagefind", Pagefind, [executable: executable]}
    ] do
  site = PhoenixAssets.DocShellSearchFixture.site!("/#{name}/")
  output = Path.join(destination, name)

  {:ok, manifest} =
    StaticExporter.export(
      site: site,
      renderer: PhoenixAssets.QualificationRenderer,
      destination: output,
      search_adapter: adapter,
      search_options: options
    )

  File.write!(Path.join(output, "site.json"), Jason.encode!(site))
  File.write!(Path.join(output, "search-contract.json"), Jason.encode!(manifest["search"]))

  File.write!(
    Path.join(output, "contexts.json"),
    Jason.encode!(PhoenixAssets.QualificationRenderer.contexts(site))
  )

  probes = [
    {"portable", %{}},
    {"introduction", %{}},
    {"portabel", %{}},
    {"portabel", %{"locale" => "sv"}},
    {"portable", %{"locale" => "en"}},
    {"portable", %{"collection" => "reference"}},
    {"portable", %{"kind" => "openapi"}},
    {"portable", %{"version" => "2.0.0"}},
    {"portable", %{"tag" => "openapi"}},
    {"portable", %{"audience" => "operator"}},
    {"portable", %{"status" => "stable"}},
    {"secret", %{}}
  ]

  cases =
    Enum.map(probes, fn {query, filters} ->
      {:ok, expected} = SearchAdapter.JSON.query(site.search, query, filters)
      %{query: query, filters: filters, ids: expected |> Enum.map(& &1.id) |> Enum.sort()}
    end)

  File.write!(Path.join(output, "query-cases.json"), Jason.encode!(cases))
end
