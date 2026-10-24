if Code.ensure_loaded?(Igniter.Mix.Task) do
  defmodule Mix.Tasks.PhoenixAssets.Install do
    @moduledoc """
    Installs and configures `phoenix_assets` in a Phoenix application.

        mix igniter.install phoenix_assets
        mix phoenix_assets.install

    Configures `:phoenix_assets` (otp_app, endpoint, router) from the project's
    Phoenix conventions, enables the development runtime, and scaffolds the
    frontend entry files (`assets/vite.config.ts`, `assets/src/app.css`).

    The runtime is added to a host supervision tree by appending
    `PhoenixAssets.child_specs/0` -- a list, not a single child -- so that step,
    the npm install, and your stack contracts are printed as next steps rather
    than patched blindly into your `application.ex`.
    """
    @shortdoc "Install and configure phoenix_assets"

    use Igniter.Mix.Task

    alias Igniter.Libs.Phoenix
    alias Igniter.Project.{Application, Config}

    @impl true
    def info(_, _) do
      %Igniter.Mix.Task.Info{group: :phoenix_assets, example: "mix phoenix_assets.install"}
    end

    @impl true
    def igniter(igniter) do
      app = Application.app_name(igniter)
      web = inspect(Phoenix.web_module(igniter))

      igniter
      |> Config.configure("config.exs", :phoenix_assets, [:otp_app], app)
      |> Config.configure(
        "config.exs",
        :phoenix_assets,
        [:endpoint],
        module_code(web, "Endpoint")
      )
      |> Config.configure("config.exs", :phoenix_assets, [:router], module_code(web, "Router"))
      |> Config.configure("dev.exs", :phoenix_assets, [:dev, :enabled], true)
      |> Igniter.create_new_file("assets/vite.config.ts", vite_config(), on_exists: :skip)
      |> Igniter.create_new_file("assets/src/app.css", app_css(), on_exists: :skip)
      |> Igniter.add_notice(notice())
    end

    # Build the module name from source text (e.g. "MyAppWeb" <> "Endpoint") and
    # parse it to an alias AST, so configure/5 renders `MyAppWeb.Endpoint` rather
    # than a quoted atom -- and we never create a module atom that may not be
    # loaded yet at install time.
    defp module_code(web, suffix), do: {:code, Sourceror.parse_string!(web <> "." <> suffix)}

    defp vite_config do
      """
      import tailwindcss from "@tailwindcss/vite"
      import { sveltekit } from "@sveltejs/kit/vite"
      import { phoenixAssets } from "@phoenix-assets/vite"
      import { defineConfig } from "vite"

      export default defineConfig({
        plugins: [tailwindcss(), sveltekit({ alias: { $phoenix: "src/lib/generated" } }), phoenixAssets()],
      })
      """
    end

    defp app_css, do: ~s(@import "tailwindcss";\n)

    defp notice do
      """
      phoenix_assets is configured. Remaining steps:

        1. Append the runtime to your supervision tree in
           lib/<your_app>/application.ex:

               children = [
                 # ...existing children...
               ] ++ PhoenixAssets.child_specs()

        2. Install the frontend packages from assets/:

               cd assets && pnpm add -D @phoenix-assets/vite \\
                 @phoenix-assets/svelte @phoenix-assets/lint

        3. Keep the generated-contract alias in your SvelteKit configuration.
           SvelteKit 3 reads Vite plugin options (also supported by recent 2.x):

               sveltekit({ alias: { $phoenix: "src/lib/generated" } })

           Legacy 2.x hosts may retain kit.alias in assets/svelte.config.js.
           Match generated_dir so both the build and type check resolve it.

        4. Declare your stack and generate the typed contracts:

               config :phoenix_assets, :stack, shapes: ..., commands: ..., session: ..., topics: ..., types: ...
               mix phoenix_assets.gen

        5. Validate before shipping:  mix phoenix_assets.doctor --production
      """
    end
  end
else
  defmodule Mix.Tasks.PhoenixAssets.Install do
    @moduledoc """
    Installs `phoenix_assets`. Requires the optional `igniter` dependency.

    Run `mix igniter.install phoenix_assets`, or add
    `{:igniter, "~> 0.6", only: [:dev]}` to your deps and re-run
    `mix phoenix_assets.install`.
    """
    @shortdoc "Install and configure phoenix_assets (requires igniter)"

    use Mix.Task

    @impl Mix.Task
    def run(_) do
      Mix.raise("""
      The phoenix_assets installer requires igniter.

      Run it with:

          mix igniter.install phoenix_assets

      or add {:igniter, "~> 0.6", only: [:dev]} to your deps and re-run
      mix phoenix_assets.install.
      """)
    end
  end
end
