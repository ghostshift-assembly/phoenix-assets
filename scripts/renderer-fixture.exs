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

spec =
  Path.expand("../npm/doc-shell/test/fixtures/openapi.json", __DIR__)
  |> File.read!()
  |> Jason.decode!()

guide = File.read!(Path.join(destination, "docs/guide/index.html"))

assets =
  Regex.scan(~r/<link rel="stylesheet"[^>]*>|<script type="module" src="[^"]+"><\/script>/, guide)
  |> List.flatten()
  |> Enum.join()

for {filename, enabled} <- [{"api.html", false}, {"api-enabled.html", true}] do
  reference =
    PhoenixAssets.DocShell.ApiReference.api_reference(%{
      spec: spec,
      request_enabled: enabled,
      api_origin: "https://api.example.test",
      __changed__: nil
    })
    |> Phoenix.HTML.Safe.to_iodata()

  File.write!(Path.join(destination, filename), [
    "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>API reference</title>",
    assets,
    "</head><body class=\"doc-shell\" data-pa-doc-shell style=\"padding:1rem;max-width:70rem;margin:auto\"><main><h1>API reference</h1>",
    reference,
    "</main></body></html>"
  ])
end
