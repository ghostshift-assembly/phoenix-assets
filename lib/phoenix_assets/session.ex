defmodule PhoenixAssets.Session do
  @moduledoc """
  Integration plugin that generates the authenticated-context contract.

  Reads the projection declared in the module passed as `session:` (see
  `PhoenixAssets.Session.Fields`) and emits `session.ts` -- the `Session`
  interface and the route that serves it.

  This projects the host declaration; it does not validate live session JSON or
  grant authority. Hosts own current actor/tenant admission, runtime field checks
  and retirement when the caller's session changes.

  Contributes a graph entry and a doctor check that the declared route exists in
  the router.

  """

  use PhoenixAssets.Plugin

  alias PhoenixAssets.Doctor.Check
  alias PhoenixAssets.GeneratedFile
  alias PhoenixAssets.Generators.TS
  alias PhoenixAssets.Graph

  @types %{
    string: "string",
    integer: "number",
    float: "number",
    boolean: "boolean",
    map: "Record<string, unknown>",
    list: "unknown[]",
    any: "unknown"
  }

  @impl PhoenixAssets.Plugin
  def init(opts, ctx), do: {:ok, %{module: opts[:session] || ctx.config.stack[:session]}}

  @impl PhoenixAssets.Plugin
  def generated_files(_, %{module: nil}), do: []

  def generated_files(ctx, %{module: module}) do
    {route, fields} = module.__phoenix_assets_session__()

    [
      GeneratedFile.new(
        path: Path.join(ctx.generated_dir, "session.ts"),
        contents: render(route, fields),
        plugin: :session,
        kind: :session
      )
    ]
  end

  @impl PhoenixAssets.Plugin
  def graph_entries(_, %{module: nil}), do: []

  def graph_entries(_, %{module: module}) do
    {route, fields} = module.__phoenix_assets_session__()

    [
      Graph.Entry.new(
        kind: :session,
        key: "session",
        data: %{"route" => route, "fields" => Enum.map(fields, fn {name, _, _} -> name end)}
      )
    ]
  end

  @impl PhoenixAssets.Plugin
  def doctor_checks(_, %{module: nil}), do: []

  def doctor_checks(_, %{module: module}) do
    {route, _} = module.__phoenix_assets_session__()

    [Check.new(id: :session_route, group: :session, run: &route_check(&1, route))]
  end

  defp render(route, fields) do
    [
      TS.header(),
      "\nexport interface Session {\n",
      Enum.map(fields, &render_field/1),
      "}\n",
      route_export(route),
      "\n/** The declared session field names, in declaration order. */\n",
      "export const sessionFields = [",
      Enum.map_join(fields, ", ", fn {name, _, _} -> JSON.encode!(to_string(name)) end),
      "] as const\n"
    ]
    |> IO.iodata_to_binary()
  end

  defp render_field({name, type, opts}) do
    optional = if opts[:optional], do: "?", else: ""

    "  #{name}#{optional}: #{field_type(type, opts)}\n"
  end

  defp field_type(:string, opts) do
    case opts[:values] do
      nil -> @types[:string]
      values -> Enum.map_join(values, " | ", &JSON.encode!/1)
    end
  end

  defp field_type(type, _), do: @types[type]

  defp route_export(nil), do: []

  defp route_export(route) do
    "\n/** The endpoint serving the session projection. */\n" <>
      "export const sessionRoute = #{JSON.encode!(route)}\n"
  end

  defp route_check(_, nil) do
    Check.warn("no session route declared; the frontend cannot fetch the projection")
  end

  defp route_check(%{router: nil}, route) do
    Check.warn("cannot validate session route: no router configured (#{route})")
  end

  defp route_check(%{router: router}, route) do
    if Enum.any?(Phoenix.Router.routes(router), &(&1.path == route)) do
      Check.ok("session route -> #{route}")
    else
      Check.error("session route #{route} is not in the router", "add the session route")
    end
  end
end
