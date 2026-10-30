if Code.ensure_loaded?(DocShell.Presentation.Site) and Code.ensure_loaded?(Phoenix.Component) do
  defmodule PhoenixAssets.DocShell.Components do
    @moduledoc """
    HEEx components for the complete `doc-shell-site/v1` reading experience.

    Components accept validated DocShell presentation structs. Host identity can
    be supplied through the documented brand and footer slots; document content
    always passes through `PhoenixAssets.DocShell.Ast`.
    """

    use Phoenix.Component

    @search_browser_contract_keys ~w(schema_version algorithm path indexes filters version)

    alias DocShell.Presentation.Renderer
    alias PhoenixAssets.DocShell.{Artifacts, Assets, Ast, Settings, StaticRenderer}

    attr(:page, :any, required: true)
    attr(:context, :any, required: true)
    slot(:brand)
    slot(:footer)
    attr(:nonce, :string, default: nil)

    @doc "Renders one complete documentation shell and page."
    @spec page(map()) :: Phoenix.LiveView.Rendered.t()
    def page(assigns) do
      :ok = Settings.admit_page(assigns.page)

      case Renderer.admit(
             assigns.page,
             StaticRenderer.capabilities(),
             :hosted
           ) do
        :ok ->
          :ok

        {:error, reason} ->
          raise ArgumentError, "DocShell page admission failed: #{inspect(reason)}"
      end

      artifact_page =
        case Artifacts.admit(
               assigns.page.content,
               Map.get(assigns.page.metadata, "artifact_presentation"),
               Map.get(assigns.context, :artifact_assets, %{}),
               Map.get(assigns.context, :assets, %{})
             ) do
          {:ok, page} ->
            page

          {:error, reason} ->
            raise ArgumentError, "DocShell artifact admission failed: #{inspect(reason)}"
        end

      assigns =
        assigns
        |> assign(:passive?, artifact_page.passive?)
        |> assign(:shell_ids, shell_ids(assigns.page.content))
        |> assign_new(:nonce, fn -> nil end)
        |> assign(:settings, Settings.get(assigns.context))
        |> assign(
          :content,
          Ast.render(assigns.page.content, Settings.get(assigns.context)["labels"] || %{},
            artifact_page: artifact_page,
            passive: artifact_page.passive?
          )
        )
        |> assign(:direction, direction(assigns.page.locale))
        |> assign(:enhancement_assets, Map.get(assigns.context, :assets, %{}))
        |> assign(
          :import_map,
          Assets.import_map(Map.get(assigns.context, :assets, %{}))
          |> Jason.encode!(escape: :html_safe)
        )

      ~H"""
      <div
        class="doc-shell pa-doc-shell"
        data-pa-doc-shell
        data-doc-labels={Jason.encode!(@settings["labels"] || %{})}
        data-doc-enhancement-assets={Jason.encode!(@enhancement_assets)}
        data-doc-theme="system"
        data-content-digest={@page.content_digest}
        data-cohort-digest={@context.cohort_digest}
        lang={@page.locale}
        dir={@direction}
      >
        <script :if={!@passive?} type="importmap" nonce={@nonce}><%= Phoenix.HTML.raw(@import_map) %></script>
        <a class="doc-skip-link" href={"#" <> @shell_ids.main}>{Settings.label(@settings, "skip", "Skip to documentation")}</a>
        <.header context={@context} passive?={@passive?} search_id={@shell_ids.search}>
          <:brand :for={brand <- @brand}>{render_slot(brand)}</:brand>
        </.header>
        <button
          :if={!@passive?}
          type="button"
          class="pa-button doc-mobile-nav"
          data-doc-nav-toggle
          aria-controls={@shell_ids.navigation}
          aria-expanded="false"
        >{Settings.label(@settings, "browse", "Browse documentation")}</button>
        <div class="doc-layout">
          <aside :if={@passive?} id={@shell_ids.navigation} class="doc-sidebar" aria-label={Settings.label(@settings, "navigation", "Documentation navigation")}>
            <.navigation items={@context.navigation} current_route={@page.route} settings={@settings} presentation_metadata? />
          </aside>
          <dialog :if={!@passive?} id={@shell_ids.navigation} class="doc-sidebar" data-doc-nav open aria-label={Settings.label(@settings, "navigation", "Documentation navigation")}>
            <button type="button" class="pa-button" data-doc-nav-close hidden>{Settings.label(@settings, "close_navigation", "Close navigation")}</button>
            <.navigation items={@context.navigation} current_route={@page.route} settings={@settings} presentation_metadata? />
          </dialog>
          <main id={@shell_ids.main} tabindex="-1" data-pagefind-body data-doc-template={@page.template}>
            <.announcement :if={@page.banner} banner={@page.banner} />
            <.breadcrumbs items={@page.breadcrumbs} settings={@settings} />
            <header class="doc-page-header">
              <p>{@page.collection_id} · {@page.package_version}</p>
              <h1>{@page.title}</h1>
              <p :if={@page.description}>{@page.description}</p>
              <div class="doc-badges">
                <span :if={@page.status} class="pa-status">{@page.status}</span>
                <span :for={tag <- @page.tags} class="pa-status">{tag}</span>
              </div>
            </header>
            <.hero :if={@page.hero} hero={@page.hero} context={@context} settings={@settings} />
            <article>{@content}</article>
            <.reading_flow previous={@page.previous} next={@page.next} settings={@settings} />
            <.provenance page={@page} settings={@settings} />
            <.site_footer settings={@settings}><:content :if={@footer != []}>{render_slot(@footer)}</:content></.site_footer>
          </main>
          <.table_of_contents headings={@page.headings} settings={@settings} />
        </div>
      </div>
      """
    end

    attr(:nodes, :list, required: true)
    attr(:receipt, :map, default: nil)
    attr(:assets, :map, default: %{})
    attr(:urls, :map, default: %{})
    attr(:labels, :map, default: %{})

    @doc "Renders a receipt-verified artifact document and its complete passive fallback."
    @spec artifact_document(map()) :: Phoenix.LiveView.Rendered.t()
    def artifact_document(assigns) do
      page = artifact_page!(assigns)

      assigns =
        assign(
          assigns,
          :content,
          Ast.render(assigns.nodes, assigns.labels, artifact_page: page, passive: page.passive?)
        )

      ~H"""
      <article class="doc-shell doc-artifact-document" data-artifact-page-digest={@receipt && @receipt["page_digest"]}>{@content}</article>
      """
    end

    attr(:nodes, :list, required: true)
    attr(:receipt, :map, required: true)
    attr(:assets, :map, default: %{})
    attr(:urls, :map, default: %{})
    attr(:labels, :map, default: %{})
    attr(:mode, :string, default: "light", values: ~w(light dark monochrome enlarged))

    @doc "Shows the same verified document with read-only receipt and producer diagnostics."
    @spec artifact_preview(map()) :: Phoenix.LiveView.Rendered.t()
    def artifact_preview(assigns) do
      if assigns.mode not in ~w(light dark monochrome enlarged),
        do: raise(ArgumentError, "invalid artifact preview mode")

      page = artifact_page!(assigns)

      assigns =
        assigns
        |> assign(:views, Enum.sort_by(Map.values(page.views), & &1.selection["block_id"]))
        |> assign(
          :content,
          Ast.render(assigns.nodes, assigns.labels, artifact_page: page, passive: page.passive?)
        )
        |> assign(:constraints_json, Jason.encode!(page.receipt["constraints"]))

      ~H"""
      <section class="doc-artifact-preview doc-shell" data-artifact-preview={@mode} data-artifact-page-digest={@receipt["page_digest"]} data-descriptor-set-digest={@receipt["descriptor_set_digest"]} data-artifact-constraints-digest={@receipt["constraints_digest"]}>
        <header><h2>{@labels["artifact_preview"] || "Artifact preview"}</h2><p>{@labels["artifact_preview_scope"] || "Diagnostic view of the supplied document and selection. Producer meaning and target observations remain separate."}</p></header>
        <div class="preview-document">{@content}</div>
        <section class="preview-diagnostics" aria-label={@labels["artifact_diagnostics"] || "Artifact diagnostics"}>
          <details :for={view <- @views} open><summary>{view.block["caption"]} · {view.selection["status"]}</summary>
            <dl>
              <dt>{@labels["artifact_block_id"] || "Block ID"}</dt><dd><code>{view.selection["block_id"]}</code></dd>
              <dt>{@labels["artifact_ref"] || "Artifact reference"}</dt><dd><code>{view.block["artifact_ref"]}</code></dd>
              <dt>{@labels["artifact_profile"] || "Profile"}</dt><dd><code>{view.block["profile"]}</code><br /><code>{view.block["profile_digest"]}</code></dd>
              <dt>{@labels["artifact_manifest"] || "Manifest digest"}</dt><dd><code>{view.block["manifest_digest"]}</code></dd>
              <dt>{@labels["artifact_fallback_digest"] || "Fallback digest"}</dt><dd><code>{view.block["fallback_digest"]}</code></dd>
              <dt>{@labels["artifact_presentation"] || "Selected presentation"}</dt><dd>{view.selection["presentation_id"] || @labels["artifact_no_selection"] || "No admitted presentation"}</dd>
              <dt>{@labels["artifact_variant"] || "Variant and state"}</dt><dd>{view.selection["variant"] && view.selection["variant"]["id"] || "—"} · {view.selection["variant"] && view.selection["variant"]["state"] || "unavailable"}</dd>
              <dt>{@labels["artifact_runtime"] || "Selected runtime requirements"}</dt><dd>{artifact_runtime(view.selection["variant"], @labels)}</dd>
            </dl>
            <h3>{@labels["artifact_anchors"] || "Semantic anchors"}</h3><ul><li :for={binding <- view.block["bindings"]}><a href={"#" <> binding["anchor"]}>{binding["anchor"]}</a> · <code>{binding["subject_ref"]}</code> · {binding["subject_kind"]} · {binding["subject_id"]}</li></ul>
            <details><summary>{@labels["artifact_constraints"] || "Presentation constraints"}</summary><pre><code>{@constraints_json}</code></pre></details>
            <details :if={view.selection["checked_projection"]}><summary>{@labels["artifact_producer_projection"] || "Checked producer projection and supplied limitations"}</summary><pre><code>{Jason.encode!(view.selection["checked_projection"])}</code></pre></details>
          </details>
        </section>
      </section>
      """
    end

    defp artifact_page!(assigns) do
      case Artifacts.admit(assigns.nodes, assigns.receipt, assigns.assets, assigns.urls) do
        {:ok, page} ->
          page

        {:error, reason} ->
          raise ArgumentError, "DocShell artifact admission failed: #{inspect(reason)}"
      end
    end

    defp artifact_runtime(%{"runtime" => [_ | _] = runtime}, _), do: Enum.join(runtime, ", ")
    defp artifact_runtime(_, labels), do: labels["artifact_runtime_none"] || "None"

    attr(:context, :any, required: true)
    attr(:passive?, :boolean, default: false)
    attr(:search_id, :string, default: "doc-search")
    slot(:brand)

    @doc "Renders site identity, search, and reader theme controls."
    @spec header(map()) :: Phoenix.LiveView.Rendered.t()
    def header(assigns) do
      settings = Settings.get(assigns.context)

      assigns =
        assigns
        |> assign(:home_path, home_path(assigns.context))
        |> assign(:settings, settings)
        |> assign(:logo_url, Settings.logo_url(settings, assigns.context))

      ~H"""
      <header class="doc-site-header" data-pagefind-ignore>
        <div class="doc-brand">
          <a :if={@brand == []} href={get_in(@settings, ["brand", "href"]) || @home_path}><img :if={@logo_url} src={@logo_url} alt={get_in(@settings, ["brand", "logo", "alt"])} />{get_in(@settings, ["brand", "label"]) || @context.site_title}</a>
          {render_slot(@brand)}
        </div>
        <p :if={@passive?}>{Settings.label(@settings, "search_requires_js", "Search requires JavaScript; use navigation links.")}</p>
        <.search :if={!@passive?} id={@search_id} search={@context.search} label={Settings.label(@settings, "search", search_label(Map.get(@context, :locale)))} labels={Map.get(@settings, "labels", %{})} />
        <.destinations choices={Map.get(@settings, "locales", [])} label={Settings.label(@settings, "language", "Language")} locale? current_id={Map.get(@context, :locale)} />
        <.destinations choices={Map.get(@settings, "releases", [])} label={Settings.label(@settings, "release", "Version")} />
        <div :if={!@passive?} class="doc-theme-controls" aria-label={Settings.label(@settings, "reader_preferences", "Reader preferences")}>
          <button type="button" class="pa-button" data-doc-theme-value="system">{Settings.label(@settings, "theme_system", "System")}</button>
          <button type="button" class="pa-button" data-doc-theme-value="light">{Settings.label(@settings, "theme_light", "Light")}</button>
          <button type="button" class="pa-button" data-doc-theme-value="dark">{Settings.label(@settings, "theme_dark", "Dark")}</button>
          <button type="button" class="pa-button" data-doc-theme-value="contrast">{Settings.label(@settings, "theme_contrast", "High contrast")}</button>
        </div>
      </header>
      """
    end

    attr(:choices, :list, required: true)
    attr(:label, :string, required: true)
    attr(:locale?, :boolean, default: false)
    attr(:current_id, :string, default: nil)

    @doc "Renders exact host-supplied locale or release destinations as ordinary links."
    @spec destinations(map()) :: Phoenix.LiveView.Rendered.t()
    def destinations(assigns) do
      assigns =
        assign(
          assigns,
          :use_current_id?,
          Enum.any?(assigns.choices, &(&1["id"] == assigns.current_id))
        )

      ~H"""
      <nav :if={@choices != []} class="doc-site-selector" aria-label={@label}><ul><li :for={choice <- @choices}><a href={choice["href"]} aria-current={(if @use_current_id?, do: choice["id"] == @current_id, else: choice["current"]) && "true"} hreflang={@locale? && choice["id"]}>{choice["label"]}</a></li></ul></nav>
      """
    end

    attr(:settings, :map, required: true)
    slot(:content)

    @doc "Renders inert footer data or a host's local footer slot."
    @spec site_footer(map()) :: Phoenix.LiveView.Rendered.t()
    def site_footer(assigns) do
      ~H"""
      <footer :if={@content != [] || @settings["footer"]} class="doc-host-footer" aria-label={Settings.label(@settings, "footer", "Site footer")}>
        <%= if @content != [] do %>
          {render_slot(@content)}
        <% else %>
          <p :if={get_in(@settings, ["footer", "text"])}>{get_in(@settings, ["footer", "text"])}</p>
          <a :for={link <- get_in(@settings, ["footer", "links"]) || []} href={link["href"]}>{link["label"]}</a>
        <% end %>
      </footer>
      """
    end

    attr(:items, :list, required: true)
    attr(:current_route, :string, required: true)

    attr(:settings, :map, default: %{})

    attr(:presentation_metadata?, :boolean, default: false)

    @doc "Renders hierarchical documentation navigation."
    @spec navigation(map()) :: Phoenix.LiveView.Rendered.t()
    def navigation(assigns) do
      assigns =
        assigns
        |> assign_new(:settings, fn -> %{} end)
        |> assign_new(:presentation_metadata?, fn -> false end)

      ~H"""
      <nav aria-label={Settings.label(@settings, "documentation", "Documentation")}><ul><.navigation_item :for={item <- @items} item={item} current_route={@current_route} presentation_metadata?={@presentation_metadata?} /></ul></nav>
      """
    end

    attr(:item, :any, required: true)
    attr(:current_route, :string, required: true)

    attr(:presentation_metadata?, :boolean, default: false)

    @doc "Renders one recursive navigation branch and its current-page state."
    @spec navigation_item(map()) :: Phoenix.LiveView.Rendered.t()
    def navigation_item(assigns) do
      assigns = assign_new(assigns, :presentation_metadata?, fn -> false end)
      meta = Map.get(assigns.item, :meta, %{})
      badge = if assigns.presentation_metadata? and is_binary(meta["badge"]), do: meta["badge"]

      open? =
        current_branch?(assigns.item, assigns.current_route) or
          (assigns.presentation_metadata? and meta["collapsed"] == false)

      assigns =
        assigns
        |> assign(:badge, badge)
        |> assign(:current?, open?)
        |> assign(:link, Ast.link_target(assigns.item.path))

      ~H"""
      <li>
        <a :if={@item.path != "" && @link != :error} href={elem(@link, 1)} target={elem(@link, 2) && "_blank"} rel={elem(@link, 2) && "noopener noreferrer"} aria-current={@item.path == @current_route && "page"}>{@item.title}<span :if={@badge} class="pa-status"> {@badge}</span></a>
        <span :if={@item.path != "" && @link == :error} data-unsafe-link>{@item.title}<span :if={@badge} class="pa-status"> {@badge}</span></span>
        <details :if={@item.path == ""} class="doc-navigation-group" open={@current?}>
          <summary>{@item.title}<span :if={@badge} class="pa-status"> {@badge}</span></summary>
          <ul><.navigation_item :for={child <- @item.children} item={child} current_route={@current_route} presentation_metadata?={@presentation_metadata?} /></ul>
        </details>
        <ul :if={@item.path != "" and @item.children != []}><.navigation_item :for={child <- @item.children} item={child} current_route={@current_route} presentation_metadata?={@presentation_metadata?} /></ul>
      </li>
      """
    end

    attr(:search, :map, required: true)
    attr(:id, :string, default: "doc-search")
    attr(:presentation, :atom, values: [:dialog, :inline], default: :dialog)
    attr(:trigger, :boolean, default: true)
    attr(:filter_values, :map, default: %{})
    attr(:label, :string, default: "Search documentation")
    attr(:labels, :map, default: %{})
    slot(:header)
    slot(:controls)

    @doc """
    Renders local search as a modal dialog or an inline section.

    Inline search leaves surrounding navigation available. A host can omit the
    trigger and supply its own `data-doc-search-open` control within the same
    browser-core root. The header and controls slots customize chrome without
    replacing the query, filters or results. `filter_values` supplies admitted
    facet values when records are omitted for a static search adapter; known
    facets accept at most 256 distinct UTF-8 strings of 256 bytes each.
    """
    @spec search(map()) :: Phoenix.LiveView.Rendered.t()
    def search(assigns) do
      records = Map.get(assigns.search, "records", [])
      encoded = records |> Jason.encode!() |> Base.url_encode64()
      contract = Map.get(assigns.search, "contract")

      encoded_contract =
        if is_map(contract) do
          contract
          |> Map.take(@search_browser_contract_keys)
          |> Jason.encode!()
          |> Base.url_encode64()
        end

      assigns =
        assigns
        |> assign(:records, records)
        |> assign(:encoded_records, encoded)
        |> assign(:encoded_contract, encoded_contract)
        |> assign(:filters, search_filters(records, assigns.filter_values))

      ~H"""
      <div class="doc-search" data-pagefind-ignore>
        <button :if={@trigger} type="button" class="pa-button" data-doc-search-open aria-haspopup={@presentation == :dialog && "dialog"}>{@label}</button>
        <section :if={@presentation == :inline} class="doc-search-inline" data-doc-search-dialog data-doc-search-presentation="inline" data-doc-search-records={@encoded_records} data-doc-search-contract={@encoded_contract}
        data-doc-search-error-label={@labels["search_error"]} data-doc-search-empty-label={@labels["search_empty"]}
        data-doc-search-result-label={@labels["search_result"]} data-doc-search-results-label={@labels["search_results"]}
        data-doc-search-loading-label={@labels["search_loading"]} aria-label={@label}><.search_content {assigns} /></section>
        <dialog :if={@presentation == :dialog} class="doc-search-dialog" data-doc-search-dialog data-doc-search-records={@encoded_records} data-doc-search-contract={@encoded_contract}
        data-doc-search-error-label={@labels["search_error"]} data-doc-search-empty-label={@labels["search_empty"]}
        data-doc-search-result-label={@labels["search_result"]} data-doc-search-results-label={@labels["search_results"]}
        data-doc-search-loading-label={@labels["search_loading"]} aria-label={@label}><.search_content {assigns} /></dialog>
        <noscript>
          <details><summary>{@labels["browse_index"] || "Browse the page index"}</summary><ul><li :for={record <- @records}><a href={record.route}>{record.title}</a></li></ul></details>
        </noscript>
      </div>
      """
    end

    defp search_content(assigns) do
      ~H"""
          <header :if={@header == []}><h2>{@label}</h2><button type="button" class="pa-button" data-doc-search-close>{@labels["close"] || "Close"}</button></header>
          {render_slot(@header)}
          <label for={@id <> "-query"}>{@label}</label>
          <input id={@id <> "-query"} class="pa-field" type="search" role="combobox" autocomplete="off" aria-controls={@id <> "-results"} aria-expanded="true" data-doc-search-input />
          {render_slot(@controls)}
          <details class="doc-search-filters"><summary>{@labels["filters"] || "Filters"}</summary><div aria-label={@labels["search_filters"] || "Search filters"}>
            <label :for={{name, values} <- @filters}>
              {@labels["filter_" <> name] || filter_label(name)}
              <select class="pa-select" data-doc-search-filter={name}>
                <option value="">{@labels["filter_all"] || "All"}</option><option :for={value <- values} value={value}>{value}</option>
              </select>
            </label>
          </div></details>
          <p role="status" data-doc-search-status></p>
          <ul id={@id <> "-results"} role="listbox" data-doc-search-results></ul>
      """
    end

    attr(:items, :list, required: true)

    attr(:settings, :map, default: %{})

    @doc "Renders the page breadcrumb trail."
    @spec breadcrumbs(map()) :: Phoenix.LiveView.Rendered.t()
    def breadcrumbs(assigns) do
      assigns = assign_new(assigns, :settings, fn -> %{} end)

      ~H"""
      <nav aria-label={Settings.label(@settings, "breadcrumbs", "Breadcrumbs")}><ol class="doc-breadcrumbs"><li :for={item <- @items}><a href={item.path}>{item.title}</a></li></ol></nav>
      """
    end

    attr(:headings, :list, required: true)

    attr(:settings, :map, default: %{})

    @doc "Renders the projected heading tree without recalculating identifiers."
    @spec table_of_contents(map()) :: Phoenix.LiveView.Rendered.t()
    def table_of_contents(assigns) do
      assigns = assign_new(assigns, :settings, fn -> %{} end)

      ~H"""
      <aside class="doc-toc"><details open><summary>{Settings.label(@settings, "on_this_page", "On this page")}</summary><nav aria-label={Settings.label(@settings, "on_this_page", "On this page")}><ol><li :for={heading <- @headings} data-level={heading.level}><a href={"##{heading.id}"}>{heading.title}</a></li></ol></nav></details></aside>
      """
    end

    attr(:previous, :any, default: nil)
    attr(:next, :any, default: nil)

    attr(:settings, :map, default: %{})

    @doc "Renders previous and next reading links."
    @spec reading_flow(map()) :: Phoenix.LiveView.Rendered.t()
    def reading_flow(assigns) do
      assigns = assign_new(assigns, :settings, fn -> %{} end)

      ~H"""
      <nav :if={@previous || @next} aria-label={Settings.label(@settings, "continue_reading", "Continue reading")} class="doc-reading-flow"><a :if={@previous} rel="prev" href={@previous.path}>← {@previous.title}</a><a :if={@next} rel="next" href={@next.path}>{@next.title} →</a></nav>
      """
    end

    attr(:page, :any, required: true)

    attr(:settings, :map, default: %{})

    @doc "Renders last-updated, source, and edit provenance."
    @spec provenance(map()) :: Phoenix.LiveView.Rendered.t()
    def provenance(assigns) do
      assigns = assign_new(assigns, :settings, fn -> %{} end)

      ~H"""
      <div class="doc-provenance" role="contentinfo" aria-label={Settings.label(@settings, "provenance", "Page provenance")}>
        <span :if={@page.last_modified}>{Settings.label(@settings, "updated", "Updated")} {@page.last_modified}</span>
        <a :if={@page.source_url} href={@page.source_url}>{Settings.label(@settings, "view_source", "View source")}</a>
        <a :if={@page.edit_url} href={@page.edit_url}>{Settings.label(@settings, "edit_page", "Edit this page")}</a>
      </div>
      """
    end

    attr(:banner, :map, required: true)

    @doc "Renders an announcement with a visible textual label."
    @spec announcement(map()) :: Phoenix.LiveView.Rendered.t()
    def announcement(assigns) do
      :ok = Settings.admit_page(%{banner: assigns.banner})

      ~H"""
      <aside class="pa-callout doc-announcement" role="note">
        <a :if={@banner["href"]} href={@banner["href"]}><strong :if={@banner["label"]}>{@banner["label"]}</strong><p :if={@banner["text"]}>{@banner["text"]}</p></a>
        <div :if={!@banner["href"]}><strong :if={@banner["label"]}>{@banner["label"]}</strong><p :if={@banner["text"]}>{@banner["text"]}</p></div>
      </aside>
      """
    end

    attr(:hero, :map, required: true)
    attr(:context, :any, required: true)
    attr(:settings, :map, default: %{})

    @doc "Renders validated hero text, local image and ordinary action links."
    @spec hero(map()) :: Phoenix.LiveView.Rendered.t()
    def hero(assigns) do
      :ok = Settings.admit_page(%{hero: assigns.hero})
      image = Map.get(assigns.hero, "image")
      image_settings = if image, do: %{"brand" => %{"logo" => image}}, else: %{}
      assigns = assign(assigns, :image_url, Settings.logo_url(image_settings, assigns.context))

      ~H"""
      <section class="doc-hero">
        <p :if={@hero["tagline"]} class="doc-hero-tagline">{@hero["tagline"]}</p>
        <h2>{@hero["title"]}</h2><p :if={@hero["description"]}>{@hero["description"]}</p>
        <img :if={@image_url} src={@image_url} alt={get_in(@hero, ["image", "alt"])} />
        <span :if={@hero["image"] && !@image_url} data-doc-media-unavailable>{get_in(@hero, ["image", "alt"])}</span>
        <nav :if={Map.get(@hero, "actions", []) != []} aria-label={Settings.label(@settings, "page_actions", "Page actions")}><ul><li :for={action <- Map.get(@hero, "actions", [])}><a class="pa-button" href={action["href"]}>{action["label"]}</a></li></ul></nav>
      </section>
      """
    end

    attr(:code, :string, required: true)
    attr(:language, :string, default: "text")
    attr(:id, :string, required: true)

    @doc "Renders semantic code with a progressive copy control."
    @spec code_block(map()) :: Phoenix.LiveView.Rendered.t()
    def code_block(assigns) do
      ~H"""
      <div class="doc-code" data-doc-code data-language={@language}><button type="button" class="pa-button" data-doc-copy={@id} aria-label="Copy code">Copy</button><pre><code id={@id}>{@code}</code></pre></div>
      """
    end

    attr(:items, :list, required: true)

    @doc "Renders backlinks as ordinary, crawlable links."
    @spec backlinks(map()) :: Phoenix.LiveView.Rendered.t()
    def backlinks(assigns) do
      ~H"""
      <nav aria-label="Pages linking here"><h2>Referenced by</h2><ul><li :for={item <- @items}><a href={item.path}>{item.title}</a></li></ul></nav>
      """
    end

    attr(:site, :any, required: true)
    attr(:context, :any, default: nil)

    @doc "Renders an explicit not-found page with navigation and search."
    @spec not_found(map()) :: Phoenix.LiveView.Rendered.t()
    def not_found(assigns) do
      context =
        assigns.context ||
          %{
            site_title: assigns.site.title,
            presentation: Map.get(assigns.site, :presentation, %{}),
            locale: assigns.site.default_locale,
            navigation: assigns.site.navigation,
            search: %{
              "contract" => Map.get(assigns.site.metadata, "search_contract", %{}),
              "records" => assigns.site.search
            }
          }

      assigns =
        assigns
        |> assign(:passive?, Artifacts.passive_site?(assigns.site))
        |> assign(:home_path, site_home_path(assigns.site))
        |> assign(:context, context)
        |> assign(:settings, Settings.get(context))

      ~H"""
      <div class="doc-shell pa-doc-shell" data-pa-doc-shell>
        <a class="doc-skip-link" href="#doc-main">{Settings.label(@settings, "skip", "Skip to documentation")}</a>
        <.header context={@context} passive?={@passive?} />
        <button :if={!@passive?} type="button" class="pa-button doc-mobile-nav" data-doc-nav-toggle aria-controls="doc-navigation" aria-expanded="false">{Settings.label(@settings, "browse", "Browse documentation")}</button>
        <div class="doc-layout">
          <aside :if={@passive?} id="doc-navigation" class="doc-sidebar" aria-label={Settings.label(@settings, "navigation", "Documentation navigation")}>
            <.navigation items={@site.navigation} current_route="" settings={@settings} presentation_metadata? />
          </aside>
          <dialog :if={!@passive?} id="doc-navigation" class="doc-sidebar" data-doc-nav open aria-label={Settings.label(@settings, "navigation", "Documentation navigation")}>
            <button type="button" class="pa-button" data-doc-nav-close hidden>{Settings.label(@settings, "close_navigation", "Close navigation")}</button>
            <.navigation items={@site.navigation} current_route="" settings={@settings} presentation_metadata? />
          </dialog>
          <main id="doc-main" tabindex="-1">
            <h1>{Settings.label(@settings, "not_found", "Page not found")}</h1>
            <p>{Settings.label(@settings, "not_found_description", "The requested documentation page is not part of this site generation.")}</p>
            <a href={@home_path}>{Settings.label(@settings, "home", "Documentation home")}</a>
            <.site_footer settings={@settings} />
          </main>
        </div>
      </div>
      """
    end

    defp direction(locale) when is_binary(locale) do
      if Regex.match?(~r/\A(?:ar|fa|he|ur)(?:[-_]|\z)/i, locale), do: "rtl", else: "ltr"
    end

    defp direction(_), do: "ltr"

    defp current_branch?(item, route) do
      (item.path != "" and item.path == route) or
        Enum.any?(item.children, &current_branch?(&1, route))
    end

    defp shell_ids(nodes) do
      occupied = nodes |> source_ids() |> MapSet.new()

      search_ids =
        Enum.reduce(occupied, occupied, fn id, acc ->
          MapSet.put(acc, Regex.replace(~r/-results-result-\d+\z/, id, ""))
        end)

      %{
        main: available_id("doc-main", occupied, [""]),
        navigation: available_id("doc-navigation", occupied, [""]),
        search: available_id("doc-search", search_ids, ["", "-query", "-results"])
      }
    end

    defp source_ids(nodes) when is_list(nodes), do: Enum.flat_map(nodes, &source_ids/1)

    defp source_ids(%{"attrs" => attrs, "content" => content}) when is_map(attrs) do
      ids = if is_binary(attrs["id"]), do: [attrs["id"]], else: []
      ids ++ source_ids(content)
    end

    defp source_ids(_), do: []

    defp available_id(base, occupied, suffixes, attempt \\ 0) do
      candidate = if attempt == 0, do: base, else: "#{base}-#{attempt}"

      if Enum.any?(suffixes, &MapSet.member?(occupied, candidate <> &1)),
        do: available_id(base, occupied, suffixes, attempt + 1),
        else: candidate
    end

    defp search_filters(records, explicit) do
      for field <- ~w(collection kind locale audience version tag status),
          values = Map.get_lazy(explicit, field, fn -> search_filter_values(records, field) end),
          values = bounded_filter_values(values),
          values != [],
          do: {field, values}
    end

    defp bounded_filter_values(values) when is_list(values) do
      values
      |> Enum.filter(&(is_binary(&1) and byte_size(&1) in 1..256 and String.valid?(&1)))
      |> Enum.uniq()
      |> Enum.sort()
      |> Enum.take(256)
    end

    defp bounded_filter_values(_), do: []

    defp search_filter_values(records, field) do
      key = if field == "tag", do: :tags, else: String.to_existing_atom(field)

      records
      |> Enum.flat_map(&List.wrap(Map.get(&1, key)))
      |> Enum.filter(&(is_binary(&1) and &1 != ""))
      |> Enum.uniq()
      |> Enum.sort()
    end

    defp filter_label("collection"), do: "Package"
    defp filter_label(value), do: String.capitalize(value)

    defp search_label(locale) when is_binary(locale) do
      if Regex.match?(~r/\Aar(?:[-_]|\z)/i, locale),
        do: "بحث في الوثائق",
        else: "Search documentation"
    end

    defp search_label(_), do: "Search documentation"

    defp home_path(context) do
      Enum.find_value(context.navigation, "/", &navigation_home_path/1)
    end

    defp navigation_home_path(%{path: path}) when is_binary(path) and path != "", do: path

    defp navigation_home_path(%{children: children}),
      do: Enum.find_value(children, &navigation_home_path/1)

    defp site_home_path(site) do
      if Map.has_key?(site.routes, site.base_path) do
        site.base_path
      else
        site.routes |> Map.keys() |> Enum.sort() |> List.first() || "/"
      end
    end
  end
end
