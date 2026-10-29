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

    alias PhoenixAssets.DocShell.{Assets, Ast}

    attr(:page, :any, required: true)
    attr(:context, :any, required: true)
    slot(:brand)
    slot(:footer)
    attr(:nonce, :string, default: nil)

    @doc "Renders one complete documentation shell and page."
    @spec page(map()) :: Phoenix.LiveView.Rendered.t()
    def page(assigns) do
      assigns =
        assigns
        |> assign_new(:nonce, fn -> nil end)
        |> assign(:content, Ast.render(assigns.page.content))
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
        data-doc-enhancement-assets={Jason.encode!(@enhancement_assets)}
        data-doc-theme="system"
        data-content-digest={@page.content_digest}
        data-cohort-digest={@context.cohort_digest}
        lang={@page.locale}
        dir={@direction}
      >
        <script type="importmap" nonce={@nonce}><%= Phoenix.HTML.raw(@import_map) %></script>
        <a class="doc-skip-link" href="#doc-main">Skip to documentation</a>
        <.header context={@context}>
          <:brand :for={brand <- @brand}>{render_slot(brand)}</:brand>
        </.header>
        <button
          type="button"
          class="pa-button doc-mobile-nav"
          data-doc-nav-toggle
          aria-controls="doc-navigation"
          aria-expanded="false"
        >Browse documentation</button>
        <div class="doc-layout">
          <dialog id="doc-navigation" class="doc-sidebar" data-doc-nav open aria-label="Documentation navigation">
            <button type="button" class="pa-button" data-doc-nav-close hidden>Close navigation</button>
            <.navigation items={@context.navigation} current_route={@page.route} />
          </dialog>
          <main id="doc-main" tabindex="-1" data-pagefind-body>
            <.announcement :if={@page.banner} banner={@page.banner} />
            <.breadcrumbs items={@page.breadcrumbs} />
            <header class="doc-page-header">
              <p>{@page.collection_id} · {@page.package_version}</p>
              <h1>{@page.title}</h1>
              <p :if={@page.description}>{@page.description}</p>
              <div class="doc-badges">
                <span :if={@page.status} class="pa-status">{@page.status}</span>
                <span :for={tag <- @page.tags} class="pa-status">{tag}</span>
              </div>
            </header>
            <article>{@content}</article>
            <.reading_flow previous={@page.previous} next={@page.next} />
            <.provenance page={@page} />
            <div :if={@footer != []} class="doc-host-footer">{render_slot(@footer)}</div>
          </main>
          <.table_of_contents headings={@page.headings} />
        </div>
      </div>
      """
    end

    attr(:context, :any, required: true)
    slot(:brand)

    @doc "Renders site identity, search, and reader theme controls."
    @spec header(map()) :: Phoenix.LiveView.Rendered.t()
    def header(assigns) do
      assigns = assign(assigns, :home_path, home_path(assigns.context))

      ~H"""
      <header class="doc-site-header" data-pagefind-ignore>
        <div class="doc-brand">
          <a :if={@brand == []} href={@home_path}>{@context.site_title}</a>
          {render_slot(@brand)}
        </div>
        <.search search={@context.search} />
        <div class="doc-theme-controls" aria-label="Reader theme">
          <button type="button" class="pa-button" data-doc-theme-value="system">System</button>
          <button type="button" class="pa-button" data-doc-theme-value="light">Light</button>
          <button type="button" class="pa-button" data-doc-theme-value="dark">Dark</button>
          <button type="button" class="pa-button" data-doc-theme-value="contrast">High contrast</button>
        </div>
      </header>
      """
    end

    attr(:items, :list, required: true)
    attr(:current_route, :string, required: true)

    @doc "Renders hierarchical documentation navigation."
    @spec navigation(map()) :: Phoenix.LiveView.Rendered.t()
    def navigation(assigns) do
      ~H"""
      <nav aria-label="Documentation"><ul><.navigation_item :for={item <- @items} item={item} current_route={@current_route} /></ul></nav>
      """
    end

    attr(:item, :any, required: true)
    attr(:current_route, :string, required: true)

    @doc "Renders one recursive navigation branch and its current-page state."
    @spec navigation_item(map()) :: Phoenix.LiveView.Rendered.t()
    def navigation_item(assigns) do
      assigns = assign(assigns, :current?, current_branch?(assigns.item, assigns.current_route))

      ~H"""
      <li>
        <a :if={@item.path != ""} href={@item.path} aria-current={@item.path == @current_route && "page"}>{@item.title}</a>
        <details :if={@item.path == ""} class="doc-navigation-group" open={@current?}>
          <summary>{@item.title}</summary>
          <ul><.navigation_item :for={child <- @item.children} item={child} current_route={@current_route} /></ul>
        </details>
        <ul :if={@item.path != "" and @item.children != []}><.navigation_item :for={child <- @item.children} item={child} current_route={@current_route} /></ul>
      </li>
      """
    end

    attr(:search, :map, required: true)
    attr(:presentation, :atom, values: [:dialog, :inline], default: :dialog)
    attr(:trigger, :boolean, default: true)
    attr(:filter_values, :map, default: %{})
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
        <button :if={@trigger} type="button" class="pa-button" data-doc-search-open aria-haspopup={@presentation == :dialog && "dialog"}>Search documentation</button>
        <section :if={@presentation == :inline} class="doc-search-inline" data-doc-search-dialog data-doc-search-presentation="inline" data-doc-search-records={@encoded_records} data-doc-search-contract={@encoded_contract} aria-label="Search documentation"><.search_content {assigns} /></section>
        <dialog :if={@presentation == :dialog} class="doc-search-dialog" data-doc-search-dialog data-doc-search-records={@encoded_records} data-doc-search-contract={@encoded_contract} aria-label="Search documentation"><.search_content {assigns} /></dialog>
        <noscript>
          <details><summary>Browse the page index</summary><ul><li :for={record <- @records}><a href={record.route}>{record.title}</a></li></ul></details>
        </noscript>
      </div>
      """
    end

    defp search_content(assigns) do
      ~H"""
          <header :if={@header == []}><h2>Search documentation</h2><button type="button" class="pa-button" data-doc-search-close>Close</button></header>
          {render_slot(@header)}
          <label for="doc-search-query">Search</label>
          <input id="doc-search-query" class="pa-field" type="search" role="combobox" autocomplete="off" aria-controls="doc-search-results" aria-expanded="true" data-doc-search-input />
          {render_slot(@controls)}
          <details class="doc-search-filters"><summary>Filters</summary><div aria-label="Search filters">
            <label :for={{name, values} <- @filters}>
              {filter_label(name)}
              <select class="pa-select" data-doc-search-filter={name}>
                <option value="">All</option><option :for={value <- values} value={value}>{value}</option>
              </select>
            </label>
          </div></details>
          <p role="status" data-doc-search-status></p>
          <ul id="doc-search-results" role="listbox" data-doc-search-results></ul>
      """
    end

    attr(:items, :list, required: true)

    @doc "Renders the page breadcrumb trail."
    @spec breadcrumbs(map()) :: Phoenix.LiveView.Rendered.t()
    def breadcrumbs(assigns) do
      ~H"""
      <nav aria-label="Breadcrumbs"><ol class="doc-breadcrumbs"><li :for={item <- @items}><a href={item.path}>{item.title}</a></li></ol></nav>
      """
    end

    attr(:headings, :list, required: true)

    @doc "Renders the projected heading tree without recalculating identifiers."
    @spec table_of_contents(map()) :: Phoenix.LiveView.Rendered.t()
    def table_of_contents(assigns) do
      ~H"""
      <aside class="doc-toc"><details open><summary>On this page</summary><nav aria-label="On this page"><ol><li :for={heading <- @headings} data-level={heading.level}><a href={"##{heading.id}"}>{heading.title}</a></li></ol></nav></details></aside>
      """
    end

    attr(:previous, :any, default: nil)
    attr(:next, :any, default: nil)

    @doc "Renders previous and next reading links."
    @spec reading_flow(map()) :: Phoenix.LiveView.Rendered.t()
    def reading_flow(assigns) do
      ~H"""
      <nav :if={@previous || @next} aria-label="Continue reading" class="doc-reading-flow"><a :if={@previous} rel="prev" href={@previous.path}>← {@previous.title}</a><a :if={@next} rel="next" href={@next.path}>{@next.title} →</a></nav>
      """
    end

    attr(:page, :any, required: true)

    @doc "Renders last-updated, source, and edit provenance."
    @spec provenance(map()) :: Phoenix.LiveView.Rendered.t()
    def provenance(assigns) do
      ~H"""
      <footer class="doc-provenance">
        <span :if={@page.last_modified}>Updated {@page.last_modified}</span>
        <a :if={@page.source_url} href={@page.source_url}>View source</a>
        <a :if={@page.edit_url} href={@page.edit_url}>Edit this page</a>
      </footer>
      """
    end

    attr(:banner, :map, required: true)

    @doc "Renders an announcement with a visible textual label."
    @spec announcement(map()) :: Phoenix.LiveView.Rendered.t()
    def announcement(assigns) do
      label = Map.get(assigns.banner, "label") || Map.get(assigns.banner, :label) || "Notice"
      assigns = assign(assigns, :label, label)

      ~H"""
      <aside class="pa-callout" role="note"><strong>{@label}</strong></aside>
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
            navigation: assigns.site.navigation,
            search: %{
              "contract" => Map.get(assigns.site.metadata, "search_contract", %{}),
              "records" => assigns.site.search
            }
          }

      assigns =
        assigns |> assign(:home_path, site_home_path(assigns.site)) |> assign(:context, context)

      ~H"""
      <div class="doc-shell pa-doc-shell" data-pa-doc-shell>
        <a class="doc-skip-link" href="#doc-main">Skip to documentation</a>
        <.header context={@context} />
        <button type="button" class="pa-button doc-mobile-nav" data-doc-nav-toggle aria-controls="doc-navigation" aria-expanded="false">Browse documentation</button>
        <div class="doc-layout">
          <dialog id="doc-navigation" class="doc-sidebar" data-doc-nav open aria-label="Documentation navigation">
            <button type="button" class="pa-button" data-doc-nav-close hidden>Close navigation</button>
            <.navigation items={@site.navigation} current_route="" />
          </dialog>
          <main id="doc-main" tabindex="-1">
            <h1>Page not found</h1>
            <p>The requested documentation page is not part of this site generation.</p>
            <a href={@home_path}>Documentation home</a>
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
      item.path == route or Enum.any?(item.children, &current_branch?(&1, route))
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
