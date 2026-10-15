defmodule PhoenixAssets.Presets.SvelteHttp do
  @moduledoc """
  SvelteKit with HTTP commands and Phoenix topics, without an Electric plugin.

  Select this preset through the host's `:preset` configuration. Generated
  commands import the isolated `@phoenix-assets/svelte/core` subpath; socket
  helpers remain under `/socket`. Hosts retain all routing and authorization.

  ## Example

      iex> plugins = PhoenixAssets.Presets.SvelteHttp.plugins()
      iex> Enum.any?(plugins, fn {module, _} -> module == PhoenixAssets.Electric end)
      false
  """

  use PhoenixAssets.Preset

  integration(PhoenixAssets.SvelteKit)
  integration(PhoenixAssets.Tailwind)
  integration(PhoenixAssets.Storybook)
  integration(PhoenixAssets.Commands)
  integration(PhoenixAssets.Session)
  integration(PhoenixAssets.PubSub)
  integration(PhoenixAssets.Localize)
  integration(PhoenixAssets.Enums)
  integration(PhoenixAssets.Types)
  integration(PhoenixAssets.Typespec)
end
