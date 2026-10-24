defmodule PhoenixAssets.Enums do
  @moduledoc """
  Integration plugin that emits every `Ash.Type.Enum` as localized options.

  `PhoenixAssets.Types` renders an enum as a TypeScript string-literal union,
  which types a value but cannot label one. A select box needs the label too, and
  in the reader's locale — so three platforms independently wrote the same Mix
  task to discover enum modules by behaviour and dump `{value, label,
  description}` per locale.

  This is that task, once. Enum modules are found by behaviour, so there is no
  registry to keep in step:

      config :phoenix_assets, :stack,
        enums: [gettext_backend: MyAppWeb.Gettext]

  Emits `enums.json` beside the TypeScript contracts:

      {"<locale>": {"<enum_group>": [{"value": _, "label": _, "description": _}]}}

  Labels come from the enum's own `display_name/1` and `description/1` when it
  defines them, read once per locale so a Gettext-backed implementation resolves
  in each. An enum that defines neither still emits its values, humanized.

  Set `only:` to an explicit public allowlist (or `[]` to emit nothing).
  Discovery cannot decide which enum metadata a host may publish. Modules with
  the same final name share a JSON group; generation refuses that collision
  rather than silently replacing one module's values. Select an unambiguous
  allowlist or rename the conflicting enum modules.

  A host can also discover enums owned by reusable dependency applications:

      config :phoenix_assets, :stack,
        enums: [
          gettext_backend: MyAppWeb.Gettext,
          apps: [:my_shared_domain]
        ]

  The host application is always included; `apps:` only adds to it.
  """

  use PhoenixAssets.Plugin

  alias PhoenixAssets.Doctor.Check
  alias PhoenixAssets.{GeneratedFile, Graph}

  unless Code.ensure_loaded?(Gettext) do
    @compile {:no_warn_undefined, Gettext}
  end

  @output "enums.json"

  @impl PhoenixAssets.Plugin
  def init(opts, ctx) do
    stack = ctx.config.stack[:enums] || []

    state =
      opts
      |> Keyword.merge(stack)
      |> Map.new()
      |> Map.put_new(:gettext_backend, ctx.config.stack[:gettext_backend])
      |> Map.put(:otp_app, ctx.config.otp_app)

    {:ok, state}
  end

  @impl PhoenixAssets.Plugin
  def generated_files(ctx, state) do
    case modules(state) do
      [] ->
        []

      modules ->
        [
          GeneratedFile.new(
            path: Path.join(ctx.generated_dir, @output),
            contents: render(modules, locales(ctx, state), state),
            plugin: :enums,
            kind: :enums
          )
        ]
    end
  end

  @impl PhoenixAssets.Plugin
  def graph_entries(_, state) do
    Enum.map(modules(state), fn module ->
      Graph.Entry.new(kind: :enum, key: group_name(module), data: %{})
    end)
  end

  @impl PhoenixAssets.Plugin
  def doctor_checks(_, state) do
    [
      Check.new(
        id: :enum_modules,
        group: :enums,
        run: fn _ ->
          case modules(state) do
            [] -> Check.ok("no Ash.Type.Enum modules found; nothing to emit")
            found -> Check.ok("#{length(found)} enum module(s) discovered")
          end
        end
      )
    ]
  end

  # Discovery reads the application's module list, so an enum added anywhere is
  # picked up without a registry to forget to update.
  defp modules(state) do
    modules = state |> discover_modules() |> Enum.uniq() |> Enum.sort_by(&group_name/1)

    case modules
         |> Enum.group_by(&group_name/1)
         |> Enum.sort()
         |> Enum.find(fn {_, found} -> length(found) > 1 end) do
      nil ->
        modules

      {group, found} ->
        raise ArgumentError,
              "phoenix_assets: enum group #{inspect(group)} collides between " <>
                Enum.map_join(found, ", ", &inspect/1) <>
                "; set enums: [only: [...]] to an unambiguous public allowlist"
    end
  end

  defp discover_modules(%{only: only}) when is_list(only), do: only

  defp discover_modules(%{otp_app: otp_app} = state) do
    [otp_app | Map.get(state, :apps, [])]
    |> Enum.uniq()
    |> Enum.flat_map(&application_modules/1)
    |> Enum.uniq()
    |> Enum.filter(&enum_module?/1)
  end

  defp application_modules(otp_app) do
    case :application.get_key(otp_app, :modules) do
      {:ok, modules} -> modules
      :undefined -> []
    end
  end

  defp enum_module?(module) do
    Code.ensure_loaded?(module) and
      function_exported?(module, :values, 0) and
      ash_type_enum?(module)
  end

  defp ash_type_enum?(module) do
    if Code.ensure_loaded?(Ash.Type.Enum) do
      module.module_info(:attributes)
      |> Keyword.get_values(:behaviour)
      |> List.flatten()
      |> Enum.member?(Ash.Type.Enum)
    else
      false
    end
  rescue
    # A module without `module_info/1` is not an Ash enum either way.
    _ -> false
  end

  defp locales(ctx, state) do
    case Map.get(state, :locales) do
      nil -> ctx.config.stack[:locales] || scan_locales(state)
      list -> list
    end
    |> Enum.map(&to_string/1)
    |> Enum.uniq()
    |> Enum.sort()
  end

  # Falls back to whatever the Gettext backend knows, then to a single default,
  # so an app with no localization still gets a usable file.
  defp scan_locales(%{gettext_backend: backend}) when is_atom(backend) and backend != nil do
    if Code.ensure_loaded?(backend) and function_exported?(backend, :__gettext__, 1) do
      Gettext.known_locales(backend)
    else
      ["en"]
    end
  end

  defp scan_locales(_), do: ["en"]

  defp render(modules, locales, state) do
    locales
    |> Map.new(fn locale ->
      put_locale(state, locale)
      {locale, Map.new(modules, &{group_name(&1), options(&1)})}
    end)
    |> PhoenixAssets.CanonicalJSON.encode!()
  end

  defp put_locale(%{gettext_backend: backend}, locale)
       when is_atom(backend) and backend != nil do
    # `put_locale/2` answers with the previously-set locale, which we discard.
    _ = if Code.ensure_loaded?(backend), do: Gettext.put_locale(backend, locale)

    :ok
  end

  defp put_locale(_, _), do: :ok

  defp options(module), do: Enum.map(module.values(), &option(module, &1))

  defp option(module, value) do
    %{
      "value" => to_string(value),
      "label" => label(module, value),
      "description" => description(module, value)
    }
  end

  defp label(module, value) do
    if function_exported?(module, :display_name, 1),
      do: to_string(module.display_name(value)),
      else: humanize(value)
  end

  defp description(module, value) do
    cond do
      function_exported?(module, :localized_description, 1) ->
        to_string(module.localized_description(value))

      function_exported?(module, :description, 1) ->
        to_string(module.description(value))

      true ->
        ""
    end
  end

  # `:string.titlecase/1` only raises the first letter of the whole string, so
  # `:not_started` would label as "Not started". A select box wants every word.
  defp humanize(value) do
    value
    |> to_string()
    |> String.split("_", trim: true)
    |> Enum.map_join(" ", &(&1 |> :string.titlecase() |> to_string()))
  end

  defp group_name(module) do
    module |> Module.split() |> List.last() |> Macro.underscore()
  end
end
