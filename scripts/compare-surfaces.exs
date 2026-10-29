unless Code.ensure_loaded?(PhoenixAssets.DocShellConformanceFixture),
  do: Code.require_file("../test/support/doc_shell_conformance_fixture.ex", __DIR__)

alias DocShell.Presentation.Conformance
site = PhoenixAssets.DocShellConformanceFixture.site!()
observed = System.argv() |> List.last() |> File.read!() |> Jason.decode!()

surfaces =
  Map.new([{"liveview", :hosted}, {"heex", :static}, {"svelte", :static}], fn {renderer, mode} ->
    pages =
      Map.new(observed, fn {id, renderers} ->
        page = Map.fetch!(renderers, renderer)
        links = page["links"]

        {id,
         %{
           "route" => Map.fetch!(site.pages, id).route,
           "content_digest" => page["content_digest"],
           "visible_text" => page["visible_text"],
           "headings" => Enum.map(page["headings"], &Jason.encode!/1),
           "links" => Enum.map(links ++ page["navigation"] ++ page["contents"], &Jason.encode!/1),
           "landmarks" => page["landmarks"],
           "accessible_names" => page["accessible_names"],
           "actions" =>
             links
             |> Enum.with_index()
             |> Enum.map(fn {[_, label], index} ->
               %{
                 "id" => "link-#{index}",
                 "label" => label,
                 "live_only" => false,
                 "availability" => "available"
               }
             end)
         }}
      end)

    {:ok, surface} = Conformance.surface(site, mode, pages)
    {renderer, surface}
  end)

for renderer <- ["heex", "svelte"],
    do: :ok = Conformance.compare(surfaces["liveview"], surfaces[renderer])

IO.puts("DocShell Conformance.surface/3 and compare/2 accept all five renderer pages.")
