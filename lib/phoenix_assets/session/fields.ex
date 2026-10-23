defmodule PhoenixAssets.Session.Fields do
  @moduledoc """
  DSL for declaring the authenticated context both sides of the app must agree on.

  Who is asking — the user, their organization, their role, whatever staff or
  entitlement flags authorize the surface — is a contract like any other, and
  it is the one most often re-derived by hand at each call site until the copies
  disagree. A host module `use`s this and declares the projection once:

      defmodule MyApp.Assets.Session do
        use PhoenixAssets.Session.Fields

        route "/api/session"

        field :user_id, :string
        field :organization_id, :string
        field :role, :string, values: ["owner", "admin", "member", "viewer"]
        field :platform_admin, :boolean
        field :impersonated_by, :string, optional: true
      end

  The generated `session.ts` carries the interface and the route, so the
  frontend reads one declared shape instead of an ad-hoc JSON blob, and changes to the
  declaration can expose stale callers after regeneration. The interface does not
  validate runtime JSON or establish session authority. Hosts reject malformed,
  missing or nullable fields under their endpoint contract and retire stale scope.

  Field names are emitted verbatim, matching the JSON the endpoint actually
  returns. Types: `:string`, `:integer`, `:float`, `:boolean`, `:map`, `:list`
  and `:any`. `values:` narrows a `:string` to a literal union; `optional: true`
  marks a field that may be absent.

  > #### `use PhoenixAssets.Session.Fields` {: .info}
  >
  > Using this module imports `field/2,3` and `route/1`, and defines
  > `__phoenix_assets_session__/0` returning `{route, fields}`.

  """

  @field_types [:string, :integer, :float, :boolean, :map, :list, :any]

  @field_schema NimbleOptions.new!(
                  optional: [type: :boolean, default: false],
                  values: [type: {:list, :string}, doc: "narrows a `:string` to a literal union"]
                )

  @doc false
  defmacro __using__(_) do
    quote do
      import PhoenixAssets.Session.Fields, only: [field: 2, field: 3, route: 1]
      Module.register_attribute(__MODULE__, :phoenix_assets_session_fields, accumulate: true)
      Module.register_attribute(__MODULE__, :phoenix_assets_session_route, accumulate: false)
      @before_compile PhoenixAssets.Session.Fields
    end
  end

  @doc "Declares the endpoint serving the session projection."
  defmacro route(path) do
    quote do
      @phoenix_assets_session_route unquote(path)
    end
  end

  @doc "Declares a session field: a name, a type, and optional `values:`/`optional:`."
  defmacro field(name, type, opts \\ []) do
    quote do
      @phoenix_assets_session_fields {unquote(name), unquote(type), unquote(opts)}
    end
  end

  @doc false
  defmacro __before_compile__(env) do
    fields =
      env.module
      |> Module.get_attribute(:phoenix_assets_session_fields)
      |> List.wrap()
      |> Enum.reverse()
      |> Enum.map(fn {name, type, opts} -> {name, type, validate!(env, name, type, opts)} end)

    ensure_unique_names!(env, fields)
    route = Module.get_attribute(env.module, :phoenix_assets_session_route)

    if fields == [] do
      compile_error!(env, :session, "declare at least one field")
    end

    quote do
      @doc "Returns the declared session projection as `{route, fields}`."
      def __phoenix_assets_session__, do: unquote(Macro.escape({route, fields}))
    end
  end

  @doc "The field types a session projection may declare."
  @spec types() :: [atom()]
  def types, do: @field_types

  defp ensure_unique_names!(env, fields) do
    names = Enum.map(fields, fn {name, _, _} -> name end)

    case names -- Enum.uniq(names) do
      [] -> :ok
      [dup | _] -> compile_error!(env, dup, "declared more than once")
    end
  end

  defp validate!(env, name, type, opts) do
    unless type in @field_types do
      compile_error!(
        env,
        name,
        "unsupported type #{inspect(type)} (expected one of #{inspect(@field_types)})"
      )
    end

    opts =
      case NimbleOptions.validate(opts, @field_schema) do
        {:ok, validated} -> validated
        {:error, error} -> compile_error!(env, name, Exception.message(error))
      end

    if opts[:values] && type != :string do
      compile_error!(env, name, "values: is only valid for a :string field")
    end

    opts
  end

  @spec compile_error!(Macro.Env.t(), term(), String.t()) :: no_return()
  defp compile_error!(env, name, message),
    do: PhoenixAssets.DSL.compile_error!(env, "session field", name, message)
end
