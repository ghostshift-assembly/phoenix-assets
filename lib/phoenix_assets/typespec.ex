defmodule PhoenixAssets.Typespec do
  @moduledoc """
  Integration plugin that generates TypeScript from Elixir typespecs.

  `PhoenixAssets.Types` covers Ash resources. This covers everything else a
  backend already describes in a `@type` — a streaming protocol, a job status
  union, an event payload — so a host stops hand-writing the TypeScript twin of
  a type it has already declared.

  Declare each contract under the `:stack` config:

      config :phoenix_assets, :stack,
        typespecs: [
          [
            source: MyApp.Stream.Part,
            output: "stream-part.ts",
            root: :t,
            root_name: "StreamPart",
            discriminator_name: "StreamPartKind"
          ]
        ]

  `source` and `output` are required; `output` is relative to the generated
  directory. The remaining keys are `PhoenixAssets.Generators.Typespec` options:
  `types` (declaration order, defaulting to every type sorted), `root`,
  `root_name`, `discriminator_name`, `field_names`, and `trailer`. Set
  `field_names: :preserve` for JSON DTOs whose keys must remain unchanged;
  the default `:camel` retains the existing generated naming convention.

  ## Why a plugin

  `Generators.Typespec` can write a file on its own, and a host calling it from
  a Mix task gets none of what the rest of the pipeline provides: the write is
  not content-gated, so every run touches the file and triggers an HMR reload;
  `mix phoenix_assets.gen --check` cannot see it, so the CI drift gate silently
  skips it; and the output is absent from the asset graph. Going through the
  plugin puts typespec contracts on the same footing as every other one.
  """

  use PhoenixAssets.Plugin

  alias PhoenixAssets.Doctor.Check
  alias PhoenixAssets.{GeneratedFile, Graph}
  alias PhoenixAssets.Generators.Typespec, as: Renderer

  @renderer_options [:types, :root, :root_name, :discriminator_name, :field_names, :trailer]

  @impl PhoenixAssets.Plugin
  def init(opts, ctx) do
    declared = opts[:typespecs] || ctx.config.stack[:typespecs] || []
    {:ok, %{typespecs: Enum.map(declared, &normalize!/1)}}
  end

  @impl PhoenixAssets.Plugin
  def generated_files(ctx, %{typespecs: declared}) do
    Enum.map(declared, fn {source, output, opts} ->
      GeneratedFile.new(
        path: Path.join(ctx.generated_dir, output),
        contents: render!(source, opts),
        plugin: :typespec,
        kind: :typespec
      )
    end)
  end

  @impl PhoenixAssets.Plugin
  def graph_entries(_, %{typespecs: declared}) do
    Enum.map(declared, fn {source, output, _} ->
      Graph.Entry.new(kind: :typespec, key: output, data: %{"source" => inspect(source)})
    end)
  end

  @impl PhoenixAssets.Plugin
  def doctor_checks(_, %{typespecs: []}), do: []

  def doctor_checks(_, %{typespecs: declared}) do
    # One check over every declaration rather than one per source: a check id is
    # an atom, and deriving atoms from host config would mint them at runtime.
    [
      Check.new(
        id: :typespec_sources,
        group: :typespec,
        run: fn _ -> check_sources(declared) end
      )
    ]
  end

  defp check_sources(declared) do
    case Enum.flat_map(declared, &source_problem/1) do
      [] ->
        Check.ok("#{length(declared)} typespec contract(s) resolve")

      problems ->
        Check.error(
          Enum.join(problems, "; "),
          "each `source:` must be a compiled module that declares at least one `@type`"
        )
    end
  end

  defp source_problem({source, output, _}) do
    cond do
      not Code.ensure_loaded?(source) -> ["#{output}: #{inspect(source)} is not loaded"]
      not declares_types?(source) -> ["#{output}: #{inspect(source)} declares no types"]
      true -> []
    end
  end

  # `fetch_types/1` answers `:error` only when the module carries no debug info
  # at all. A module that simply has no `@type` answers `{:ok, []}`, which would
  # otherwise render a header and nothing else -- a generated file that looks
  # fine and contains no contract.
  defp declares_types?(source) do
    match?({:ok, [_ | _]}, Code.Typespec.fetch_types(source))
  end

  # Raising here rather than at generation time means a typo in the config is a
  # boot-time error with the offending entry in the message, not a mystery
  # missing file after a successful-looking `mix phoenix_assets.gen`.
  defp normalize!(entry) when is_list(entry) do
    source = entry[:source] || raise_missing(:source, entry)
    output = entry[:output] || raise_missing(:output, entry)

    unless is_atom(source) do
      raise ArgumentError,
            "phoenix_assets typespec: `source:` must be a module, got: #{inspect(source)}"
    end

    {source, output, Keyword.take(entry, @renderer_options)}
  end

  defp normalize!(other) do
    raise ArgumentError,
          "phoenix_assets typespec: each entry must be a keyword list, got: #{inspect(other)}"
  end

  @spec raise_missing(atom(), keyword()) :: no_return()
  defp raise_missing(key, entry) do
    raise ArgumentError,
          "phoenix_assets typespec: missing `#{key}:` in #{inspect(entry)}"
  end

  defp render!(source, opts) do
    with true <- declares_types?(source),
         {:ok, rendered} <- Renderer.render(source, opts) do
      rendered
    else
      _ ->
        raise ArgumentError,
              "phoenix_assets typespec: #{inspect(source)} has no typespecs to render. " <>
                "It must be compiled with debug info and declare at least one `@type`."
    end
  end
end
