defmodule PhoenixAssets.Tailwind do
  @moduledoc """
  Integration plugin for Tailwind CSS (via `@tailwindcss/vite`).

  Tailwind v4 runs inside Vite through its official plugin, so this integration
  has no dev process of its own; it records the Tailwind Vite patch in the asset
  graph and contributes a doctor check that the CSS entry exists. The installer
  scaffolds the Vite plugin import; existing hosts configure that import themselves.

  """

  use PhoenixAssets.Plugin

  alias PhoenixAssets.Doctor.Check

  @default_entry "src/app.css"

  @impl PhoenixAssets.Plugin
  def init(opts, _), do: {:ok, Map.new(opts)}

  @impl PhoenixAssets.Plugin
  def vite_config(_, state) do
    %{"tailwind" => %{"plugin" => "@tailwindcss/vite", "entry" => entry(state)}}
  end

  @impl PhoenixAssets.Plugin
  def doctor_checks(_, state) do
    [Check.new(id: :tailwind_entry, group: :tailwind, run: &entry_check(&1, entry(state)))]
  end

  defp entry(state), do: Map.get(state, :entry, @default_entry)

  defp entry_check(ctx, entry) do
    path = Path.join(ctx.asset_root, entry)

    if File.exists?(path) do
      Check.ok("Tailwind entry #{entry} present")
    else
      Check.warn("Tailwind entry missing at #{path}", "create #{entry} or set :entry")
    end
  end
end
