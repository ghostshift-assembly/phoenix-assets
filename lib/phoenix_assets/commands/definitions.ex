defmodule PhoenixAssets.Commands.Definitions do
  @moduledoc """
  DSL for declaring bounded HTTP operations for generated TypeScript clients.

  A command may mutate state or perform a bounded POST read. A host module
  `use`s this and declares each operation with the endpoint that serves it, the
  request body it accepts, the payload it returns, and — the part that makes the
  contract worth having — the exact error codes it can answer with:

      defmodule MyApp.Assets.Commands do
        use PhoenixAssets.Commands.Definitions

        command :publish_article,
          route: "/api/articles/:id/publish",
          method: :post,
          params: [id: :string],
          body: [note: :string],
          result: "ArticleRow",
          errors: [:already_published, :article_not_found]
      end

  The generated client returns a discriminated result. Removing a declared code
  can expose stale callers after regeneration. Controllers can change independently:
  generation does not validate endpoint JSON, grant authority or prove a mutation
  failed after transport loss. Hosts retain runtime codecs and reconcile unknown
  outcomes using the original operation identity before any consequential retry.

  Options per `command/2`:

    * `:route` (required) -- the Phoenix route, `:placeholders` allowed.
    * `:method` -- `:post` (default), `:put`, `:patch` or `:delete`.
    * `:params` -- keyword list of `{placeholder, :string | :integer}`; must
      match the route's placeholders exactly. Untyped placeholders default to
      `string | number`.
    * `:body` -- a TypeScript type name, or a keyword list of
      `{field, type}` rendered as an interface. A field type is a scalar
      (`:string`, `:map`, ...) or another TypeScript type name. Field names are
      emitted as exact JSON keys and quoted when TypeScript requires it.
    * `:result` -- the TypeScript type of the success payload, or a keyword
      list of `{key, type}` when the endpoint wraps it (`result: [job:
      "VideoRenderJobRow"]` describes `{"job": {...}}`). Omit for a command
      that returns nothing meaningful.
    * `:errors` -- the error codes the endpoint answers with. Any other code
      the server returns degrades to `"unknown_error"` at runtime.

  Declarations are validated at compile time: a missing `:route`, an unknown
  option, a glob segment, a `:params` list that does not match the route, an
  unsupported body field type or a duplicate name is a compile error.

  > #### `use PhoenixAssets.Commands.Definitions` {: .info}
  >
  > Using this module imports `command/2` and defines
  > `__phoenix_assets_commands__/0` with the validated declarations.

  """

  alias PhoenixAssets.Generators.TS

  @methods [:post, :put, :patch, :delete]
  @param_types [:string, :integer]
  @body_types [:string, :integer, :float, :boolean, :map, :list, :any]

  @command_schema NimbleOptions.new!(
                    route: [
                      type: :string,
                      required: true,
                      doc: "the Phoenix route serving the command (`:placeholders` allowed)"
                    ],
                    method: [type: {:in, @methods}, default: :post],
                    params: [type: :keyword_list, doc: "typed route placeholders"],
                    body: [
                      type: {:or, [:string, :atom, :keyword_list]},
                      doc: "a TypeScript type name, or inline `{field, type}` pairs"
                    ],
                    result: [
                      type: {:or, [:string, :atom, :keyword_list]},
                      doc: "the TypeScript type of the success payload, or `{key, type}` pairs"
                    ],
                    errors: [type: {:list, :atom}, default: []]
                  )

  @doc false
  defmacro __using__(_) do
    quote do
      import PhoenixAssets.Commands.Definitions, only: [command: 2]
      Module.register_attribute(__MODULE__, :phoenix_assets_commands, accumulate: true)
      @before_compile PhoenixAssets.Commands.Definitions
    end
  end

  @doc "Declares a command: `route:`, `method:`, `params:`, `body:`, `result:`, `errors:`."
  defmacro command(name, opts) do
    quote do
      @phoenix_assets_commands {unquote(name), unquote(opts)}
    end
  end

  @doc false
  defmacro __before_compile__(env) do
    commands =
      env.module
      |> Module.get_attribute(:phoenix_assets_commands)
      |> List.wrap()
      |> Enum.reverse()
      |> Enum.map(fn {name, opts} -> {name, validate!(env, name, opts)} end)

    ensure_unique_names!(env, commands)

    quote do
      @doc "Returns the declared commands as `{name, opts}` pairs."
      def __phoenix_assets_commands__, do: unquote(Macro.escape(commands))
    end
  end

  @doc "The HTTP methods a command may declare."
  @spec methods() :: [atom()]
  def methods, do: @methods

  defp ensure_unique_names!(env, commands) do
    duplicate =
      commands
      |> Enum.group_by(fn {name, _} -> TS.camelize(name) end)
      |> Enum.sort()
      |> Enum.find(fn {_, declarations} -> length(declarations) > 1 end)

    case duplicate do
      nil ->
        :ok

      {_, [{name, _} | _]} ->
        compile_error!(env, name, "declared more than once after TypeScript name normalization")
    end
  end

  defp validate!(env, name, opts) do
    opts =
      case NimbleOptions.validate(opts, @command_schema) do
        {:ok, validated} -> validated
        {:error, error} -> compile_error!(env, name, Exception.message(error))
      end

    route = opts[:route]

    if route |> String.split("/") |> Enum.any?(&String.starts_with?(&1, "*")) do
      compile_error!(env, name, "glob segments (#{route}) are not supported in command routes")
    end

    validate_params!(env, name, route, opts[:params])
    validate_body!(env, name, opts[:body])
    validate_result!(env, name, opts[:result])

    opts
  rescue
    error in ArgumentError -> compile_error!(env, name, Exception.message(error))
  end

  defp validate_result!(_, _, nil), do: :ok

  defp validate_result!(env, name, result) when is_list(result) do
    if result == [] do
      compile_error!(env, name, "result must declare at least one key, or name a type")
    end

    validate_fields!(env, name, "result", result)
  end

  defp validate_result!(env, name, result) do
    _ = TS.type_name(result)
    :ok
  rescue
    error in ArgumentError -> compile_error!(env, name, Exception.message(error))
  end

  defp validate_params!(_, _, _, nil), do: :ok

  defp validate_params!(env, name, route, params) do
    placeholders = route |> TS.path_params() |> Enum.sort()
    declared = params |> Keyword.keys() |> Enum.map(&to_string/1) |> Enum.sort()

    if declared != placeholders do
      compile_error!(
        env,
        name,
        "params #{inspect(declared)} do not match the route's placeholders " <>
          "#{inspect(placeholders)} (#{route})"
      )
    end

    Enum.each(params, fn {field, type} ->
      unless type in @param_types do
        compile_error!(
          env,
          name,
          "param #{inspect(field)} has unsupported type #{inspect(type)} " <>
            "(expected one of #{inspect(@param_types)})"
        )
      end
    end)
  end

  defp validate_body!(_, _, nil), do: :ok

  defp validate_body!(env, name, body) when is_binary(body) or is_atom(body) do
    _ = TS.type_name(body)
    :ok
  rescue
    error in ArgumentError -> compile_error!(env, name, Exception.message(error))
  end

  defp validate_body!(env, name, body) when is_list(body) do
    if body == [] do
      compile_error!(env, name, "body must declare at least one field, or name a type")
    end

    validate_fields!(env, name, "body", body)
  end

  defp validate_fields!(env, name, kind, fields) do
    ensure_unique_field_names!(env, name, kind, fields)
    Enum.each(fields, fn {field, type} -> validate_field_type!(env, name, kind, field, type) end)
  end

  defp ensure_unique_field_names!(env, name, kind, fields) do
    result =
      Enum.reduce_while(fields, %{}, fn {field, _}, seen ->
        normalized = field |> to_string() |> String.normalize(:nfc)

        case seen do
          %{^normalized => previous} ->
            {:halt, {:duplicate, previous, field, normalized}}

          _ ->
            {:cont, Map.put(seen, normalized, field)}
        end
      end)

    case result do
      {:duplicate, previous, field, normalized} ->
        compile_error!(
          env,
          name,
          "#{kind} fields #{inspect(previous)} and #{inspect(field)} normalize to " <>
            "duplicate JSON key #{inspect(normalized)}"
        )

      _ ->
        :ok
    end
  end

  # A field is either a scalar this generator knows how to render, or -- written
  # as a string -- the name of a type the generated module imports from
  # `$phoenix/types`. An unknown atom is a typo, not a type name.
  defp validate_field_type!(_, _, _, _, type) when type in @body_types, do: :ok

  defp validate_field_type!(env, name, kind, field, type) when is_binary(type) do
    _ = TS.type_name(type)
    :ok
  rescue
    ArgumentError -> unsupported_field_type!(env, name, kind, field, type)
  end

  defp validate_field_type!(env, name, kind, field, type),
    do: unsupported_field_type!(env, name, kind, field, type)

  @spec unsupported_field_type!(Macro.Env.t(), term(), String.t(), term(), term()) :: no_return()
  defp unsupported_field_type!(env, name, kind, field, type) do
    compile_error!(
      env,
      name,
      "#{kind} field #{inspect(field)} has unsupported type #{inspect(type)} " <>
        "(expected one of #{inspect(@body_types)}, or a TypeScript type name as a string)"
    )
  end

  @spec compile_error!(Macro.Env.t(), term(), String.t()) :: no_return()
  defp compile_error!(env, name, message),
    do: PhoenixAssets.DSL.compile_error!(env, "command", name, message)
end
