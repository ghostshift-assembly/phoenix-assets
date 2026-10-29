if Code.ensure_loaded?(DocShell.Presentation.Site) and Code.ensure_loaded?(Phoenix.Component) do
  defmodule PhoenixAssets.DocShell.ApiReference do
    @moduledoc """
    Bounded HEEx rendering for admitted OpenAPI 3.0, 3.1, and 3.2 documents.

    Request controls are absent by default. A host must enable them and provide
    an exact HTTP(S) API origin; the operation path can never replace that origin.
    Unknown schema fields remain inspectable as escaped JSON.
    """

    use Phoenix.Component

    alias PhoenixAssets.DocShell.Ast

    @methods ~w(get post put patch delete options head)
    @max_depth 12
    @pair_validator DocShell.Presentation.HostedPair

    unless Code.ensure_loaded?(@pair_validator) do
      @compile {:no_warn_undefined, [{DocShell.Presentation.HostedPair, :validate, 3}]}
    end

    attr(:presentation, :map, required: true)
    attr(:spec, :map, required: true)
    attr(:expected, :map, required: true)
    attr(:current_id, :string, required: true)
    attr(:request_enabled, :boolean, default: false)
    attr(:api_origin, :string, default: nil)

    @doc "Admits a hosted narrative/API pair against the expected publication before rendering either input."
    @spec hosted_reference(map()) :: Phoenix.LiveView.Rendered.t()
    def hosted_reference(assigns) do
      with {:ok, pair} <- admit_pair(assigns.presentation, assigns.spec, assigns.expected),
           {:ok, content} <- Map.fetch(pair.presentation.content, assigns.current_id) do
        assigns =
          assigns
          |> assign(:publication, pair.publication)
          |> assign(
            :direction,
            if(Regex.match?(~r/\A(?:ar|fa|he|ur)(?:[-_]|\z)/i, pair.publication["locale"]),
              do: "rtl",
              else: "ltr"
            )
          )
          |> assign(:content, Ast.render(content))
          |> assign(:spec, pair.openapi)

        ~H"""
        <section class="doc-shell" data-doc-publication={@publication["publication_id"]} lang={@publication["locale"]} dir={@direction}>
          <article>{@content}</article>
          <.api_reference spec={@spec} request_enabled={@request_enabled} api_origin={@api_origin} />
        </section>
        """
      else
        reason -> raise ArgumentError, "DocShell hosted pair admission failed: #{inspect(reason)}"
      end
    end

    defp admit_pair(presentation, spec, expected) do
      validator = @pair_validator

      if Code.ensure_loaded?(validator),
        do: validator.validate(presentation, spec, expected),
        else: {:error, :doc_shell_hosted_pair_unavailable}
    end

    attr(:spec, :map, required: true)
    attr(:request_enabled, :boolean, default: false)
    attr(:api_origin, :string, default: nil)

    @doc "Renders an admitted OpenAPI document as tagged operations and bounded schemas."
    @spec api_reference(map()) :: Phoenix.LiveView.Rendered.t()
    def api_reference(assigns) do
      case normalize(assigns.spec, assigns.request_enabled, assigns.api_origin) do
        {:ok, version, info, operations, origin} ->
          assigns =
            assigns
            |> assign(:version, version)
            |> assign(:info, info)
            |> assign(:operations, operations)
            |> assign(
              :groups,
              operations |> Enum.group_by(& &1.tag) |> Enum.sort_by(&elem(&1, 0))
            )
            |> assign(:origin, origin)

          ~H"""
          <section class="doc-api-reference">
            <header><p>OpenAPI {@version}</p><h2>{Map.get(@info, "title", "API reference")}</h2><small :if={@info["version"]}>v{@info["version"]}</small><p :if={@info["description"]}>{@info["description"]}</p></header>
            <nav aria-label="API operations"><section :for={{tag, operations} <- @groups}><h3>{tag}</h3><ul><li :for={operation <- operations}><a href={"##{operation.id}"}><strong>{operation.method}</strong> {operation.path}</a></li></ul></section></nav>
            <.operation :for={operation <- @operations} operation={operation} origin={@origin} request_enabled={@request_enabled} />
            <details><summary>Complete admitted OpenAPI JSON</summary><pre><code>{Jason.encode!(@spec, pretty: true)}</code></pre></details>
          </section>
          """

        {:error, reason} ->
          assigns = assign(assigns, :reason, inspect(reason))

          ~H"""
          <section class="pa-state" data-pa-state="error" role="alert"><h2>API reference unavailable</h2><p>{@reason}</p><details><summary>Complete admitted OpenAPI JSON</summary><pre><code>{Jason.encode!(@spec, pretty: true)}</code></pre></details></section>
          """
      end
    end

    attr(:operation, :map, required: true)
    attr(:origin, :string, default: nil)
    attr(:request_enabled, :boolean, default: false)

    @doc "Renders one operation, its parameters, payloads, and optional request boundary."
    @spec operation(map()) :: Phoenix.LiveView.Rendered.t()
    def operation(assigns) do
      ~H"""
      <article id={@operation.id} class="doc-api-operation">
        <header><strong>{@operation.method}</strong> <code>{@operation.path}</code><h3>{@operation.summary}</h3><p :if={@operation.description}>{@operation.description}</p></header>
        <section :if={@operation.parameters != []}><h4>Parameters</h4><table><thead><tr><th>Name</th><th>Location</th><th>Required</th><th>Description</th></tr></thead><tbody><tr :for={parameter <- @operation.parameters}><th scope="row">{parameter["name"]}</th><td>{parameter["in"]}</td><td>{if parameter["required"], do: "Required", else: "Optional"}</td><td>{parameter["description"]}</td></tr></tbody></table></section>
        <.schema_section title="Request body" value={@operation.request_body} />
        <.schema_section title="Responses" value={@operation.responses} />
        <form :if={@request_enabled && @origin} method="dialog" class="doc-api-request" data-doc-api-request data-api-origin={@origin} data-operation-method={@operation.method}>
          <fieldset disabled data-doc-api-controls>
          <legend>Send request</legend><p>Destination: {@origin}</p>
          <label>Operation path<input class="pa-field" name="path" value={@operation.path} required /></label>
          <label>Bearer token<input class="pa-field" name="token" type="password" autocomplete="off" /></label>
          <label :if={@operation.method not in ["GET", "HEAD"]}>Request body<textarea class="pa-field" name="body"></textarea></label>
          <label><input type="checkbox" name="confirm" required />Send this request to {@origin}</label>
          <button type="submit" class="pa-button" data-pa-variant="primary">Send request</button>
          <p role="status" data-doc-api-status></p><pre data-doc-api-response></pre>
          </fieldset>
          <noscript>Request execution requires JavaScript.</noscript>
        </form>
        <details><summary>Complete admitted operation JSON</summary><pre><code>{Jason.encode!(@operation.raw, pretty: true)}</code></pre></details>
      </article>
      """
    end

    attr(:title, :string, required: true)
    attr(:value, :any, default: nil)

    @doc "Renders recursive OpenAPI data with a strict depth ceiling."
    @spec schema_section(map()) :: Phoenix.LiveView.Rendered.t()
    def schema_section(assigns) do
      assigns = assign(assigns, :tree, schema_tree(assigns.value, 0))

      ~H"""
      <section :if={@value}><h4>{@title}</h4><.schema_node node={@tree} /></section>
      """
    end

    attr(:node, :any, required: true)

    @doc false
    @spec schema_node(map()) :: Phoenix.LiveView.Rendered.t()
    def schema_node(%{node: {:object, pairs}} = assigns) do
      assigns = assign(assigns, :pairs, pairs)

      ~H"""
      <dl class="doc-api-schema"><div :for={{key, value} <- @pairs}><dt>{key}</dt><dd><.schema_node node={value} /></dd></div></dl>
      """
    end

    def schema_node(%{node: {:array, values}} = assigns) do
      assigns = assign(assigns, :values, values)

      ~H"""
      <ol><li :for={value <- @values}><.schema_node node={value} /></li></ol>
      """
    end

    def schema_node(%{node: {:limit, json}} = assigns) do
      assigns = assign(assigns, :json, json)

      ~H"""
      <pre><code>{@json}</code></pre>
      """
    end

    def schema_node(%{node: {:value, value}} = assigns) do
      assigns = assign(assigns, :value, inspect(value))

      ~H"""
      <code>{@value}</code>
      """
    end

    @doc "Validates and flattens a supported OpenAPI document."
    @spec normalize(map(), boolean(), String.t() | nil) ::
            {:ok, String.t(), map(), [map()], String.t() | nil} | {:error, term()}
    def normalize(spec, request_enabled \\ false, api_origin \\ nil)

    def normalize(spec, request_enabled, api_origin) when is_map(spec) do
      with {:ok, version} <- version(spec["openapi"]),
           {:ok, origin} <- request_origin(request_enabled, api_origin),
           paths when is_map(paths) <- Map.get(spec, "paths", %{}) do
        {:ok, version, Map.get(spec, "info", %{}), operations(paths), origin}
      else
        {:error, _} = error -> error
        value -> {:error, {:invalid_openapi_paths, value}}
      end
    end

    def normalize(_, _, _), do: {:error, :invalid_openapi_document}

    defp version(version) when is_binary(version) do
      if Regex.match?(~r/\A3\.[012](?:\.|\z)/, version),
        do: {:ok, version},
        else: {:error, {:unsupported_openapi_version, version}}
    end

    defp version(value), do: {:error, {:unsupported_openapi_version, value}}

    defp request_origin(false, _), do: {:ok, nil}

    defp request_origin(true, origin) when is_binary(origin) do
      case URI.parse(origin) do
        %URI{scheme: scheme, host: host, path: path, query: nil, fragment: nil, userinfo: nil}
        when scheme in ["http", "https"] and is_binary(host) and path in [nil, "", "/"] ->
          {:ok, String.trim_trailing(origin, "/")}

        _ ->
          {:error, {:invalid_api_origin, origin}}
      end
    end

    defp request_origin(true, origin), do: {:error, {:invalid_api_origin, origin}}

    defp operations(paths) do
      paths
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.flat_map(fn {path, item} ->
        for method <- @methods,
            operation = is_map(item) && item[method],
            is_map(operation) do
          %{
            id: operation_id(operation, method, path),
            method: String.upcase(method),
            path: path,
            summary:
              operation["summary"] || operation["operationId"] ||
                "#{String.upcase(method)} #{path}",
            description: operation["description"],
            tag: operation["tags"] |> list() |> Enum.find(&is_binary/1) || "default",
            parameters: list(operation["parameters"]),
            request_body: operation["requestBody"],
            responses: operation["responses"],
            raw: operation
          }
        end
      end)
      |> Enum.with_index()
      |> Enum.map(fn {operation, index} ->
        %{operation | id: "operation-#{index}-#{operation.id}"}
      end)
    end

    defp operation_id(operation, method, path) do
      value = operation["operationId"] || "#{method}-#{path}"
      String.replace(value, ~r/[^A-Za-z0-9_.:-]+/, "-")
    end

    defp schema_tree(value, depth) when depth >= @max_depth,
      do: {:limit, Jason.encode!(value, pretty: true)}

    defp schema_tree(value, depth) when is_map(value) do
      {:object,
       value
       |> Enum.sort_by(&elem(&1, 0))
       |> Enum.map(fn {key, item} -> {key, schema_tree(item, depth + 1)} end)}
    end

    defp schema_tree(value, depth) when is_list(value),
      do: {:array, Enum.map(value, &schema_tree(&1, depth + 1))}

    defp schema_tree(value, _), do: {:value, value}
    defp list(value) when is_list(value), do: value
    defp list(_), do: []
  end
end
