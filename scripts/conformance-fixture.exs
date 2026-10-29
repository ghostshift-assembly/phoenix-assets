unless Code.ensure_loaded?(PhoenixAssets.DocShellConformanceFixture) do
  Code.require_file("../test/support/doc_shell_conformance_fixture.ex", __DIR__)
end

Code.require_file("fixture-renderer.exs", __DIR__)

destination = System.argv() |> List.last() |> Path.expand()
site = PhoenixAssets.DocShellConformanceFixture.site!()

{:ok, _} =
  DocShell.Presentation.StaticExporter.export(
    site: site,
    renderer: PhoenixAssets.QualificationRenderer,
    destination: destination
  )

File.write!(Path.join(destination, "site.json"), Jason.encode!(site))

File.write!(
  Path.join(destination, "contexts.json"),
  Jason.encode!(PhoenixAssets.QualificationRenderer.contexts(site))
)

{:ok, corpus} = DocShell.Presentation.Conformance.fixture()
File.write!(Path.join(destination, "corpus.json"), Jason.encode!(corpus))

File.write!(
  Path.join(destination, "admission-cases.json"),
  Jason.encode!(PhoenixAssets.DocShellConformanceFixture.admission_cases())
)
