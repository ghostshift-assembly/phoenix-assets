defmodule PhoenixAssets.Commands do
  @moduledoc """
  Integration plugin that generates a typed HTTP client from declarations.

  Reads the commands declared in the module passed as `commands:` (see
  `PhoenixAssets.Commands.Definitions`) and emits `commands.ts` -- one function
  per command, built on `runCommand/2` from `@phoenix-assets/svelte/core`.

  Declarations describe bounded HTTP operations, including POST read queries.
  The generated result and error unions project those declarations. They do not
  validate endpoint payloads or enforce actor/tenant authority. Hosts verify real
  success wrappers, required fields and error branches through their runtime codecs.
  An `unknown_error` response requires host reconciliation before consequential retry.

  Also contributes graph entries and a doctor check per command that the route
  exists in the router *with the declared method*, which catches a verb
  mismatch a path-only check would miss.

  """

  use PhoenixAssets.Plugin

  alias PhoenixAssets.Doctor.Check
  alias PhoenixAssets.GeneratedFile
  alias PhoenixAssets.Generators.TS
  alias PhoenixAssets.Graph

  @body_types %{
    string: "string",
    integer: "number",
    float: "number",
    boolean: "boolean",
    map: "Record<string, unknown>",
    list: "unknown[]",
    any: "unknown"
  }

  @param_types %{string: "string", integer: "number"}

  @impl PhoenixAssets.Plugin
  def init(opts, ctx), do: {:ok, %{module: opts[:commands] || ctx.config.stack[:commands]}}

  @impl PhoenixAssets.Plugin
  def generated_files(_, %{module: nil}), do: []

  def generated_files(ctx, %{module: module}) do
    [
      GeneratedFile.new(
        path: Path.join(ctx.generated_dir, "commands.ts"),
        contents: render(commands(module)),
        plugin: :commands,
        kind: :commands
      )
    ]
  end

  @impl PhoenixAssets.Plugin
  def graph_entries(_, %{module: nil}), do: []

  def graph_entries(_, %{module: module}) do
    Enum.map(commands(module), fn {name, opts} ->
      Graph.Entry.new(
        kind: :command,
        key: to_string(name),
        data: %{
          "route" => opts[:route],
          "method" => opts[:method] |> to_string() |> String.upcase(),
          "errors" => Enum.map(opts[:errors], &to_string/1)
        }
      )
    end)
  end

  @impl PhoenixAssets.Plugin
  def doctor_checks(_, %{module: nil}), do: []

  def doctor_checks(_, %{module: module}) do
    # Command names are a bounded compile-time set of existing atoms, so each
    # check is identified by the command it validates.
    Enum.map(commands(module), fn {name, opts} ->
      Check.new(id: name, group: :commands, run: &route_check(&1, name, opts))
    end)
  end

  defp commands(module), do: module.__phoenix_assets_commands__()

  defp render(commands) do
    sorted = Enum.sort_by(commands, fn {name, _} -> to_string(name) end)

    [
      TS.header(),
      ~s|\nimport { runCommand } from "@phoenix-assets/svelte/core"\n|,
      ~s|import type { CommandOptions, CommandResult } from "@phoenix-assets/svelte/core"\n|,
      TS.type_import(referenced_types(sorted)),
      Enum.map(sorted, &render_declarations/1),
      "\nexport const commands = {\n",
      Enum.map(sorted, &render_command/1),
      "} as const\n"
    ]
    |> IO.iodata_to_binary()
  end

  # Only names that must resolve in `$phoenix/types`: an inline body renders its
  # own interface here, so it is not imported.
  defp referenced_types(commands) do
    commands
    |> Enum.flat_map(&command_type_names/1)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp command_type_names({_, opts}) do
    [opts[:body], opts[:result]]
    |> Enum.flat_map(&type_names/1)
    |> Enum.map(&TS.type_name/1)
  end

  # A named type must resolve in `$phoenix/types`; an inline shape renders its
  # own interface here, but the types of its fields still have to be imported.
  defp type_names(nil), do: []
  defp type_names(value) when is_binary(value) or is_atom(value), do: [value]

  defp type_names(fields) when is_list(fields) do
    fields
    |> Enum.map(fn {_, type} -> type end)
    |> Enum.filter(&is_binary/1)
  end

  defp render_declarations({name, opts}) do
    prefix = TS.pascalize(name)

    [
      render_interface(prefix, "Body", opts[:body]),
      render_interface(prefix, "Data", opts[:result]),
      "\nexport type #{prefix}Error = #{error_union(opts[:errors])}\n",
      "\nconst #{constant_name(name)}: readonly #{prefix}Error[] = #{error_list(opts[:errors])}\n"
    ]
  end

  defp render_interface(prefix, suffix, fields) when is_list(fields) do
    rendered =
      Enum.map_join(fields, "", fn {field, type} ->
        "  #{TS.object_key(field)}: #{field_type(type)}\n"
      end)

    "\nexport interface #{prefix}#{suffix} {\n#{rendered}}\n"
  end

  defp render_interface(_, _, _), do: []

  defp field_type(type) when is_binary(type), do: TS.type_name(type)
  defp field_type(type), do: @body_types[type]

  # A command with no declared codes still has a failure arm: `never` keeps the
  # union honest -- every failure is `unknown_error` and the caller still has to
  # handle it.
  defp error_union([]), do: "never"
  defp error_union(errors), do: Enum.map_join(errors, " | ", &JSON.encode!(to_string(&1)))

  defp error_list([]), do: "[]"
  defp error_list(errors), do: "[#{Enum.map_join(errors, ", ", &JSON.encode!(to_string(&1)))}]"

  defp constant_name(name) do
    name |> to_string() |> String.upcase() |> Kernel.<>("_ERRORS")
  end

  defp render_command({name, opts}) do
    prefix = TS.pascalize(name)
    fname = name |> TS.camelize() |> TS.object_key()
    method = opts[:method] |> to_string() |> String.upcase()
    result = result_type(prefix, opts[:result])

    args = command_args(prefix, opts)

    "  #{fname}: (#{Enum.map_join(args, ", ", & &1.signature)}): " <>
      "Promise<CommandResult<#{result}, #{prefix}Error>> =>\n" <>
      "    runCommand({ path: #{JSON.encode!(opts[:route])}, method: #{JSON.encode!(method)}" <>
      Enum.map_join(args, "", & &1.request) <>
      ", ...options }, #{constant_name(name)}),\n"
  end

  defp result_type(_, nil), do: "null"
  defp result_type(prefix, result) when is_list(result), do: "#{prefix}Data"
  defp result_type(_, result), do: TS.type_name(result)

  defp command_args(prefix, opts) do
    params_arg(opts) ++ body_arg(prefix, opts) ++ [options_arg()]
  end

  defp params_arg(opts) do
    case TS.path_params(opts[:route]) do
      [] ->
        []

      placeholders ->
        typed =
          Enum.map_join(placeholders, "; ", &"#{TS.object_key(&1)}: #{param_type(opts, &1)}")

        [%{signature: "params: { #{typed} }", request: ", params"}]
    end
  end

  defp param_type(opts, placeholder) do
    declared =
      opts |> Keyword.get(:params, []) |> Enum.find(&(to_string(elem(&1, 0)) == placeholder))

    case declared do
      {_, type} -> @param_types[type]
      nil -> "string | number"
    end
  end

  defp body_arg(prefix, opts) do
    case opts[:body] do
      nil -> []
      body when is_list(body) -> [%{signature: "body: #{prefix}Body", request: ", body"}]
      body -> [%{signature: "body: #{TS.type_name(body)}", request: ", body"}]
    end
  end

  defp options_arg, do: %{signature: "options?: CommandOptions", request: ""}

  defp route_check(%{router: nil}, name, opts) do
    Check.warn(
      "cannot validate route for command #{name}: no router configured (#{opts[:route]})"
    )
  end

  defp route_check(%{router: router}, name, opts) do
    route = opts[:route]
    method = opts[:method]
    routes = Phoenix.Router.routes(router)

    cond do
      Enum.any?(routes, &(&1.path == route and &1.verb == method)) ->
        Check.ok("command #{name} -> #{String.upcase(to_string(method))} #{route}")

      Enum.any?(routes, &(&1.path == route)) ->
        Check.error(
          "command #{name} route #{route} exists but not for #{String.upcase(to_string(method))}",
          "align the declared method with the router"
        )

      true ->
        Check.error("command #{name} route #{route} is not in the router", "add the route")
    end
  end
end
