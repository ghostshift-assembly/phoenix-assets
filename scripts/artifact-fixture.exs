# Run in the selected installed Hex consumer, without starting an application.
Code.require_file("../test/support/doc_shell_artifact_fixture.ex", __DIR__)

alias DocShell.Json.Canonical
alias DocShell.Presentation.{ArtifactBlock, Asset, NavigationItem, Page, Site, StaticExporter}
alias PhoenixAssets.DocShell.{Artifacts, Components, StaticRenderer}

source_fixture =
  Path.expand("../npm/doc-shell/test/fixtures/artifact-conformance-v1.json", __DIR__)

producer_fixture = Application.app_dir(:doc_shell, "priv/contracts/artifact-conformance-v1.json")
true = File.read!(source_fixture) == File.read!(producer_fixture)

true =
  Code.ensure_loaded?(ArtifactBlock) and function_exported?(ArtifactBlock, :verify_receipt, 2)

inputs = producer_fixture |> File.read!() |> Jason.decode!() |> Map.fetch!("cases")
destination = System.argv() |> List.last() |> Path.expand()
File.mkdir_p!(destination)

{:ok, caps} =
  Artifacts.capabilities(
    Enum.map(inputs, fn input ->
      %{
        "profile" => input["descriptor"]["profile"],
        "profile_digest" => hd(input["receipt"]["blocks"])["profile_digest"],
        "schema_digest" => input["descriptor"]["input_schema_digest"]
      }
    end)
  )

fixtures =
  for {base, name} <- [{"/", "root"}, {"/review/", "subpath"}], reader <- ["web", "file"] do
    pages =
      Map.new(inputs, fn input ->
        page = %Page{
          id: input["id"],
          collection_id: "examples",
          document_id: input["id"],
          kind: "guide",
          route: String.trim_trailing(base, "/") <> "/" <> input["id"] <> "/",
          title: input["observations"]["caption"],
          description: input["observations"]["description"],
          locale: input["observations"]["locale"],
          audience: "public",
          template: :document,
          content: input["content"],
          content_digest: input["receipt"]["page_digest"],
          package_version: "1.0.0"
        }

        {page.id, page}
      end)

    site = %Site{
      schema_version: Site.schema_version(),
      generation_id: "artifact-qualification",
      cohort_digest: "sha256:" <> String.duplicate("a", 64),
      profile: "public",
      title: "Artifact examples",
      base_path: base,
      default_locale: "en",
      locales: Enum.uniq(Enum.map(inputs, & &1["observations"]["locale"])),
      pages: pages,
      routes: Map.new(pages, fn {id, page} -> {page.route, id} end),
      navigation:
        Enum.map(Enum.sort(pages), fn {id, page} ->
          %NavigationItem{id: id, title: page.title, path: page.route}
        end),
      search: [],
      redirects: %{},
      metadata: %{}
    }

    assets =
      Enum.flat_map(inputs, fn input ->
        Enum.map(input["assets"], fn asset ->
          %Asset{
            path: asset["path"],
            media_type: asset["media_type"],
            bytes: Base.decode64!(asset["base64"])
          }
        end)
      end)

    options = [
      profiles: [PhoenixAssets.FrozenArtifactChart, PhoenixAssets.FrozenArtifactDrawing],
      manifests:
        Map.new(
          inputs,
          &{hd(&1["receipt"]["blocks"])["manifest_digest"], &1["original_manifest"]}
        ),
      projections:
        Map.new(
          inputs,
          &{hd(&1["receipt"]["blocks"])["manifest_digest"], &1["checked_projection"]}
        ),
      assets: assets,
      capabilities: caps,
      constraints: Map.put(hd(inputs)["constraints"], "reader_mode", reader)
    ]

    folder = "native-#{name}-#{reader}"
    output = Path.join(destination, folder)

    {:ok, _} =
      StaticExporter.export(
        site: site,
        renderer: StaticRenderer,
        destination: output,
        artifact_options: options
      )

    binding = output |> Path.join("presentation-manifest.json") |> File.read!() |> Jason.decode!()

    registry =
      Map.new(
        assets,
        &{&1.path, %{"media_type" => &1.media_type, "base64" => Base.encode64(&1.bytes)}}
      )

    for input <- inputs do
      page = pages[input["id"]]
      receipt = binding["pages"][page.id]
      {:ok, ^receipt} = ArtifactBlock.verify_receipt(page.content, receipt)
      relative = String.trim_leading(page.route, "/")
      html_path = Path.join([output, relative, "index.html"])
      html = File.read!(html_path)
      [head, _] = String.split(html, "</head>", parts: 2)

      previews =
        Map.new(~w(light dark monochrome enlarged), fn mode ->
          rendered =
            Components.artifact_preview(%{
              nodes: page.content,
              receipt: receipt,
              assets: registry,
              urls: %{},
              labels: %{},
              mode: mode,
              __changed__: nil
            })
            |> Phoenix.HTML.Safe.to_iodata()

          filename = "preview-#{mode}.html"

          File.write!(Path.join(Path.dirname(html_path), filename), [
            head,
            "</head><body><main>",
            rendered,
            "</main></body></html>"
          ])

          {mode, Path.join([folder, relative, filename])}
        end)

      {:ok, canonical_content} = Canonical.encode(page.content)
      {:ok, canonical_receipt} = Canonical.encode(receipt)

      %{
        "id" => "#{name}-#{reader}-#{page.id}",
        "native_document" => Path.join([folder, relative, "index.html"]),
        "native_previews" => previews,
        "observations" => input["observations"],
        "props" => %{
          "nodes" => page.content,
          "receipt" => receipt,
          "assets" => registry,
          "canonicalContent" => canonical_content,
          "canonicalReceipt" => canonical_receipt
        }
      }
    end
  end

File.write!(
  Path.join(destination, "artifact-fixtures.json"),
  Jason.encode!(List.flatten(fixtures))
)
