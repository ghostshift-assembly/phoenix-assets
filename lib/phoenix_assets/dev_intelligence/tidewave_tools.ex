defmodule PhoenixAssets.DevIntelligence.TidewaveTools do
  @moduledoc """
  Runtime introspection helpers for the asset pipeline, reachable from Tidewave.

  Surfaces the dev-process state, recent logs, restart control, and a doctor run
  as plain functions. Nothing here registers an MCP tool -- Tidewave reaches them
  through its generic eval, the same way a developer would from `iex`. This is
  the dev-intelligence integration the stack ships. Application runtime
  inspection, browser pairing and source-edit workflows remain host/provider
  responsibilities; a shared build-only extension needs PHA.03 admission evidence.

  ## Opting in

  The surface can restart OS processes and shell out to the doctor, so it is off
  until the host asks for it:

      config :phoenix_assets, :dev_intelligence, tidewave: true

  Every function returns `{:error, :disabled}` while it is off. Put the setting
  in `config/dev.exs`, next to `config :phoenix_assets, :dev, enabled: true`.
  """

  alias PhoenixAssets.{Config, Context, DevServer, Doctor}

  @infra_children [PhoenixAssets.DevServer, PhoenixAssets.Generated.Watcher]

  @typedoc "Returned by every function here when `:tidewave` is not enabled."
  @type disabled :: {:error, :disabled}

  @doc """
  Whether the host has opted into this surface.

  Reads `config :phoenix_assets, :dev_intelligence, tidewave: true`.
  """
  @spec enabled?() :: boolean()
  def enabled? do
    :phoenix_assets
    |> Application.get_env(:dev_intelligence, [])
    |> Keyword.get(:tidewave, false)
    |> Kernel.==(true)
  end

  @doc """
  A snapshot of each supervised dev process's status, keyed by process id.

  Enumerates whatever the dev supervisor actually runs (so custom presets and
  disabled processes are reflected), excluding the supervisor's own
  infrastructure children. Empty when the dev supervisor is not running.
  """
  @spec status() :: %{atom() => :running | :restarting | :down | :unknown} | disabled()
  def status do
    if enabled?() do
      Map.new(daemon_ids(), fn id -> {id, DevServer.status(id)} end)
    else
      {:error, :disabled}
    end
  end

  defp daemon_ids do
    PhoenixAssets.DevSupervisor
    |> Supervisor.which_children()
    |> Enum.map(fn {id, _, _, _} -> id end)
    |> Enum.reject(&(&1 in @infra_children))
  catch
    :exit, _ -> []
  end

  @doc "Recent output lines for a dev process (`:vite` or `:storybook`)."
  @spec logs(atom(), keyword()) :: [String.t()] | disabled()
  def logs(id, opts \\ []) do
    if enabled?(), do: DevServer.logs(id, opts), else: {:error, :disabled}
  end

  @doc "Restarts a supervised dev process."
  @spec restart(atom()) :: {:ok, pid()} | {:error, term()}
  def restart(id) do
    if enabled?(), do: DevServer.restart(id), else: {:error, :disabled}
  end

  @doc "Runs the asset-pipeline doctor against the configured preset."
  @spec doctor(keyword()) ::
          {Doctor.Check.status(), [{Doctor.Check.t(), Doctor.Check.result()}]} | disabled()
  def doctor(opts \\ []) do
    if enabled?() do
      config = Config.load!()
      ctx = Context.new(config, plugins: Config.preset_plugins(config), env: :dev)
      Doctor.run(ctx, opts)
    else
      {:error, :disabled}
    end
  end
end
