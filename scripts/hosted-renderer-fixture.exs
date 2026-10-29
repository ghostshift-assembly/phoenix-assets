unless Code.ensure_loaded?(PhoenixAssets.DocShellConformanceFixture),
  do: Code.require_file("../test/support/doc_shell_conformance_fixture.ex", __DIR__)

unless Code.ensure_loaded?(PhoenixAssets.DocShellSearchFixture),
  do: Code.require_file("../test/support/doc_shell_search_fixture.ex", __DIR__)

[output, client, ready] = System.argv()
Application.put_env(:consumer, :fixture_output, output)
Application.put_env(:consumer, :fixture_client, client)

defmodule Consumer.FixtureLive do
  @moduledoc false
  use Phoenix.LiveView, layout: false
  alias PhoenixAssets.DocShell.Components
  alias DocShell.Presentation.Renderer.Context

  @impl true
  def mount(params, _, socket) do
    {site, id, fixture} =
      case params do
        %{"adapter" => adapter} when adapter in ["json", "pagefind"] ->
          {PhoenixAssets.DocShellSearchFixture.site!("/#{adapter}/"), "guides:english",
           "browser-search/#{adapter}"}

        _ ->
          {PhoenixAssets.DocShellConformanceFixture.site!(), params["page"] || "renderer:home",
           "browser-conformance"}
      end

    contexts =
      File.read!(
        Path.join([Application.fetch_env!(:consumer, :fixture_output), fixture, "contexts.json"])
      )
      |> Jason.decode!()

    raw = Map.fetch!(contexts, id)

    context = %Context{
      site_title: raw["site_title"],
      cohort_digest: raw["cohort_digest"],
      base_path: raw["base_path"],
      current_route: raw["current_route"],
      locale: raw["locale"],
      navigation: site.navigation,
      search: %{"contract" => raw["search"]["contract"], "records" => site.search},
      assets: raw["assets"],
      canonical_origin: raw["canonical_origin"]
    }

    {:ok, assign(socket, page: Map.fetch!(site.pages, id), context: context, revision: 0)}
  end

  @impl true
  def handle_event("refresh", _, socket), do: {:noreply, update(socket, :revision, &(&1 + 1))}

  @impl true
  def render(assigns) do
    ~H"""
    <div id="fixture-hook" phx-hook="PhoenixAssetsDocShell" data-revision={@revision}>
      <button type="button" phx-click="refresh">Refresh fixture</button>
      <div id={"fixture-generation-#{@revision}"}>
        <Components.page page={@page} context={@context} />
      </div>
    </div>
    """
  end
end

defmodule Consumer.FixtureLayout do
  @moduledoc false
  use Phoenix.Component

  def root(assigns) do
    output = Application.fetch_env!(:consumer, :fixture_output)
    client = Application.fetch_env!(:consumer, :fixture_client)
    [css] = Path.wildcard(Path.join([output, "browser-conformance/conformance/assets/*.css"]))
    [entry] = Path.wildcard(Path.join(client, "assets/live-*.js"))

    assigns =
      assign(assigns,
        css: "/conformance/assets/" <> Path.basename(css),
        entry: "/client/assets/" <> Path.basename(entry)
      )

    ~H"""
    <!doctype html>
    <html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="csrf-token" content={Plug.CSRFProtection.get_csrf_token()} /><title>Hosted renderer qualification</title><link rel="stylesheet" href={@css} /><script type="module" src={@entry}></script></head><body style="margin:0">{@inner_content}</body></html>
    """
  end
end

defmodule Consumer.FixtureRouter do
  @moduledoc false
  use Phoenix.Router
  import Phoenix.LiveView.Router

  pipeline :browser do
    plug(:fetch_query_params)
    plug(:fetch_session)
    plug(:protect_from_forgery)
    plug(:put_root_layout, html: {Consumer.FixtureLayout, :root})
  end

  scope "/" do
    pipe_through(:browser)
    live("/conformance", Consumer.FixtureLive)
    live("/search/:adapter", Consumer.FixtureLive)
  end
end

defmodule Consumer.FixtureEndpoint do
  @moduledoc false
  use Phoenix.Endpoint, otp_app: :consumer
  @session [store: :cookie, key: "_renderer_fixture", signing_salt: "fixture-only"]
  socket("/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session]])
  plug(Plug.Static, at: "/phoenix", from: {:phoenix, "priv/static"})
  plug(Plug.Static, at: "/live", from: {:phoenix_live_view, "priv/static"})
  plug(Plug.Static, at: "/client", from: Application.compile_env!(:consumer, :fixture_client))

  for adapter <- ~w(json pagefind) do
    plug(Plug.Static,
      at: "/#{adapter}",
      from:
        Path.join([
          Application.compile_env!(:consumer, :fixture_output),
          "browser-search",
          adapter,
          adapter
        ])
    )
  end

  plug(Plug.Static,
    at: "/conformance",
    from:
      Path.join(
        Application.compile_env!(:consumer, :fixture_output),
        "browser-conformance/conformance"
      )
  )

  plug(Plug.Session, @session)
  plug(Consumer.FixtureRouter)
end

Application.put_env(:consumer, Consumer.FixtureEndpoint,
  adapter: Bandit.PhoenixAdapter,
  server: true,
  http: [ip: {127, 0, 0, 1}, port: 0],
  url: [host: "localhost"],
  secret_key_base: String.duplicate("fixture-only", 8),
  live_view: [signing_salt: "fixture-only"],
  pubsub_server: Consumer.FixturePubSub,
  check_origin: false
)

{:ok, _} = Application.ensure_all_started(:bandit)

{:ok, _} =
  Supervisor.start_link(
    [{Phoenix.PubSub, name: Consumer.FixturePubSub}, Consumer.FixtureEndpoint],
    strategy: :one_for_one
  )

{:ok, {_, port}} = Consumer.FixtureEndpoint.server_info(:http)
File.write!(ready, Jason.encode!(%{origin: "http://127.0.0.1:#{port}"}))
Process.sleep(:infinity)
