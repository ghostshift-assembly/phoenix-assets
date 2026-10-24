Code.require_file("../test/support/doc_shell_projection_fixture.ex", __DIR__)

destination = System.argv() |> List.last() |> Path.expand()

node = fn tag, content, attrs ->
  %{"tag" => tag, "attrs" => attrs, "content" => content, "meta" => %{}}
end

site =
  PhoenixAssets.DocShellProjectionFixture.site!([
    node.("pre", [node.("code", ["IO.puts(\"hello\")"], %{"class" => "language-elixir"})], %{}),
    node.("mermaid", ["flowchart LR; A[Start]-->B[Done]"], %{})
  ])

{:ok, _} =
  DocShell.Presentation.StaticExporter.export(
    site: site,
    renderer: PhoenixAssets.DocShell.StaticRenderer,
    destination: destination,
    canonical_origin: "https://docs.example.test"
  )

File.write!(Path.join(destination, "site.json"), Jason.encode!(site))
