defmodule PhoenixAssets.Plugin do
  @moduledoc """
  The behaviour every `phoenix_assets` integration implements.

  A plugin contributes *declarations* -- generated files, Vite config patches,
  dev processes, graph entries, doctor checks -- computed from a
  `PhoenixAssets.Context` and its own initialised state. Plugins never mutate
  files or global state directly; the core engine collects their declarations and
  acts on them. This keeps the plugin layer pure and the system deterministic.

  ## Defining a plugin

      defmodule MyApp.Assets.Storybook do
        use PhoenixAssets.Plugin

        depends_on PhoenixAssets.SvelteKit
        after_plugin PhoenixAssets.Tailwind

        @impl true
        def dev_processes(ctx, _state) do
          command = [PhoenixAssets.Context.bin_path(ctx, "storybook"), "dev", "-p", "6006"]
          [PhoenixAssets.DevProcess.new(id: :storybook, command: command, cd: ctx.asset_root)]
        end
      end

  Every callback has a no-op default injected by `use PhoenixAssets.Plugin`, so a
  plugin implements only the callbacks it cares about. `depends_on/1` declares a
  hard ordering edge (the dependency must be present and ordered first);
  `after_plugin/1` declares a soft edge (honoured only if that plugin is present).

  > #### `use PhoenixAssets.Plugin` {: .info}
  >
  > Using this module sets the `PhoenixAssets.Plugin` behaviour, imports
  > `depends_on/1` and `after_plugin/1`, and supplies no-op implementations for
  > callbacks the plugin does not define.

  ## Callbacks

  `c:init/2` runs once to build per-plugin state; the collection callbacks
  (`c:generated_files/2`, `c:vite_config/2`, `c:dev_processes/2`,
  `c:graph_entries/2`, `c:doctor_checks/2`) each answer "what does this plugin
  contribute?" for one kind of declaration. `PhoenixAssets.Engine` initialises
  plugins and fans each callback out across them in resolved order.

  ## See also

    * `PhoenixAssets.Preset` -- composes plugins into an ordered graph.
    * `PhoenixAssets.Plugin.Resolver` -- the topological resolver.
  """

  alias PhoenixAssets.{Context, DevProcess, Doctor, GeneratedFile, Graph}

  @typedoc "Opaque per-plugin state returned by `c:init/2` and passed to other callbacks."
  @type state :: term()

  @doc "A short, unique name for the plugin (defaults to the underscored last module segment)."
  @callback name() :: atom()

  @doc "Initialises plugin state from its options and the context."
  @callback init(opts :: keyword(), ctx :: Context.t()) :: {:ok, state()} | {:error, term()}

  @doc "Returns the generated contract files this plugin contributes."
  @callback generated_files(ctx :: Context.t(), state()) :: [GeneratedFile.t()]

  @doc """
  Returns a Vite config patch, deep-merged (in plugin order, later plugin wins)
  into the asset graph's `"vite"` section.
  """
  @callback vite_config(ctx :: Context.t(), state()) :: map()

  @doc "Returns external dev processes this plugin needs supervised."
  @callback dev_processes(ctx :: Context.t(), state()) :: [DevProcess.t()]

  @doc "Returns asset-graph entries this plugin contributes."
  @callback graph_entries(ctx :: Context.t(), state()) :: [Graph.Entry.t()]

  @doc "Returns doctor checks this plugin contributes."
  @callback doctor_checks(ctx :: Context.t(), state()) :: [Doctor.Check.t()]

  @optional_callbacks name: 0,
                      generated_files: 2,
                      vite_config: 2,
                      dev_processes: 2,
                      graph_entries: 2,
                      doctor_checks: 2

  @doc false
  defmacro __using__(_) do
    quote do
      @behaviour PhoenixAssets.Plugin

      import PhoenixAssets.Plugin, only: [depends_on: 1, after_plugin: 1]

      Module.register_attribute(__MODULE__, :phoenix_assets_deps, accumulate: true)
      Module.register_attribute(__MODULE__, :phoenix_assets_after, accumulate: true)

      @before_compile PhoenixAssets.Plugin
    end
  end

  @doc "Declares a hard dependency: `module` must be present and ordered before this plugin."
  defmacro depends_on(module) do
    quote do: @phoenix_assets_deps(unquote(module))
  end

  @doc "Declares a soft ordering: if `module` is present it is ordered before this plugin."
  defmacro after_plugin(module) do
    quote do: @phoenix_assets_after(unquote(module))
  end

  @doc false
  defmacro __before_compile__(env) do
    deps =
      env.module |> Module.get_attribute(:phoenix_assets_deps) |> List.wrap() |> Enum.reverse()

    afters =
      env.module |> Module.get_attribute(:phoenix_assets_after) |> List.wrap() |> Enum.reverse()

    defaults = default_callback_defs(env.module)

    quote do
      @doc false
      def __phoenix_assets_plugin__ do
        %{module: __MODULE__, depends_on: unquote(deps), after: unquote(afters)}
      end

      unquote_splicing(defaults)
    end
  end

  @doc false
  @spec default_name(module()) :: atom()
  def default_name(module) do
    name = module |> Module.split() |> List.last() |> Macro.underscore()
    # Safe: derived from a compiled module name (a bounded, compile-time set).
    # credo:disable-for-next-line Credo.Check.Warning.UnsafeToAtom
    String.to_atom(name)
  end

  defp default_callback_defs(module) do
    [
      {{:name, 0}, quote(do: def(name, do: PhoenixAssets.Plugin.default_name(__MODULE__)))},
      {{:init, 2}, quote(do: def(init(_, _), do: {:ok, %{}}))},
      {{:generated_files, 2}, quote(do: def(generated_files(_, _), do: []))},
      {{:vite_config, 2}, quote(do: def(vite_config(_, _), do: %{}))},
      {{:dev_processes, 2}, quote(do: def(dev_processes(_, _), do: []))},
      {{:graph_entries, 2}, quote(do: def(graph_entries(_, _), do: []))},
      {{:doctor_checks, 2}, quote(do: def(doctor_checks(_, _), do: []))}
    ]
    |> Enum.reject(fn {sig, _} -> Module.defines?(module, sig, :def) end)
    |> Enum.map(fn {_, ast} -> ast end)
  end
end
