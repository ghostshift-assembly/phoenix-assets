if Code.ensure_loaded?(DocShell.Ast) and Code.ensure_loaded?(Phoenix.HTML) do
  defmodule PhoenixAssets.DocShell.Ast do
    @moduledoc """
    Renders validated DocShell AST through a closed HTML and URL policy.

    Text is always escaped. Unknown elements keep their visible children and are
    labelled with `data-doc-shell-unknown`; they never become arbitrary HTML.
    Heading identifiers are accepted only from the projected AST and are not
    recalculated by the renderer.
    """

    @elements ~w(p span ul ol li blockquote strong em b i table thead tbody tfoot tr th td code
                 figure figcaption details summary dl dt dd kbd mark sub sup del s)
    @void_elements ~w(br hr)
    @directives ~w(accordion badge callout card card-grid code-group frame response-fields
                   snippet step steps tabs tree update file-tree link-card openapi-operation
                   openapi-schema)
    @attributes ~w(id title class colspan rowspan scope start)
    @id ~r/\A[\p{L}\p{N}][\p{L}\p{N}_.:-]*\z/u

    @typedoc "A Phoenix HTML-safe value produced from DocShell AST."
    @type safe :: {:safe, iodata()}

    @doc "Renders valid AST as escaped HTML-safe iodata with optional host control labels."
    @spec render([DocShell.Ast.ast_node()], map(), keyword()) :: safe()
    def render(nodes, labels \\ %{}, options \\ [])
        when is_list(nodes) and is_map(labels) and is_list(options) do
      environment = %{
        labels: labels,
        artifact_page: Keyword.get(options, :artifact_page),
        passive?: Keyword.get(options, :passive, false)
      }

      {:safe, render_children(mark_positions(nodes, [], environment))}
    end

    @doc "Renders one AST node through the closed element policy."
    @spec render_node(DocShell.Ast.ast_node()) :: iodata()
    def render_node(node),
      do:
        render_marked(
          hd(mark_positions([node], [], %{labels: %{}, artifact_page: nil, passive?: false}))
        )

    @doc "Checks a dynamic link through the renderer URL policy without emitting HTML."
    @spec link_target(term()) :: {:ok, String.t(), boolean()} | :error
    def link_target(value), do: safe_link(value)

    defp render_marked(text) when is_binary(text), do: escape(text)

    defp render_marked(%{
           "tag" => "artifact",
           "meta" => %{"artifact" => _},
           "attrs" => attrs,
           "content" => content
         }) do
      case attrs["__doc_shell_artifact_page"] do
        %PhoenixAssets.DocShell.Artifacts.Page{views: views} ->
          case views[attrs["id"]] do
            nil -> raise ArgumentError, "DocShell artifact receipt required before rendering"
            view -> render_artifact(view, attrs, content)
          end

        _ ->
          raise ArgumentError, "DocShell artifact receipt required before rendering"
      end
    end

    defp render_marked(%{"tag" => tag, "attrs" => attrs, "content" => content})
         when is_binary(tag) and is_map(attrs) and is_list(content) do
      render_tag(tag, attrs, content)
    end

    defp render_marked(_), do: escape("[invalid documentation node]")

    defp render_tag(tag, attrs, content) when tag in @directives,
      do: render_directive(tag, attrs, content)

    defp render_tag("pre", attrs, content), do: render_pre(attrs, content)
    defp render_tag("a", attrs, content), do: render_link(attrs, content)
    defp render_tag("img", attrs, _), do: render_image(attrs)
    defp render_tag("mermaid", attrs, content), do: render_mermaid(attrs, content)

    defp render_tag(tag, attrs, content) when tag in @elements,
      do: element(tag, admitted_attributes(attrs), render_children(content))

    defp render_tag(tag, attrs, _) when tag in @void_elements,
      do: ["<", tag, attributes(admitted_attributes(attrs)), ">"]

    defp render_tag(tag, attrs, content) do
      if Regex.match?(~r/\Ah[1-6]\z/, tag),
        do: render_heading(tag, attrs, content),
        else: unknown(tag, attrs, content)
    end

    defp render_children(content), do: Enum.map(content, &render_marked/1)

    defp mark_positions(nodes, prefix, environment) do
      nodes
      |> Enum.with_index()
      |> Enum.map(fn
        {%{"attrs" => attrs, "content" => content} = node, index}
        when is_map(attrs) and is_list(content) ->
          position = prefix ++ [index]

          node
          |> Map.put(
            "attrs",
            attrs
            |> Map.put("__doc_shell_position", Enum.join(position, "-"))
            |> Map.put("__doc_shell_labels", environment.labels)
            |> Map.put("__doc_shell_artifact_page", environment.artifact_page)
            |> Map.put("__doc_shell_passive", environment.passive?)
          )
          |> Map.put(
            "content",
            mark_positions(content, position, child_environment(node, environment))
          )

        {node, _} ->
          node
      end)
    end

    defp child_environment(%{"tag" => "artifact", "meta" => %{"artifact" => _}}, environment),
      do: %{environment | passive?: true}

    defp child_environment(_, environment), do: environment

    defp render_artifact(view, attrs, content) do
      block = view.block
      selection = view.selection
      variant = selection["variant"]

      image =
        if view.source,
          do: [
            "<div class=\"artifact-media\"><img",
            attributes([
              {"src", view.source},
              {"alt", block["description"]},
              {"loading", "lazy"},
              {"decoding", "async"}
            ]),
            "></div>"
          ],
          else: []

      unavailable =
        if selection["status"] == "unavailable",
          do:
            element(
              "p",
              [{"class", "artifact-status"}, {"role", "note"}],
              escape(
                label(
                  attrs,
                  "artifact_unavailable",
                  "Artifact presentation unavailable; complete fallback retained."
                )
              )
            ),
          else: []

      element(
        "figure",
        compact([
          {"id", selection["block_id"]},
          {"class", "doc-artifact"},
          {"data-doc-artifact", ""},
          {"data-artifact-ref", block["artifact_ref"]},
          {"data-artifact-profile", block["profile"]},
          {"data-profile-digest", block["profile_digest"]},
          {"data-manifest-digest", block["manifest_digest"]},
          {"data-fallback-digest", block["fallback_digest"]},
          {"data-artifact-status", selection["status"]},
          {"data-artifact-state", if(variant, do: variant["state"], else: "unavailable")},
          {"data-variant-id", variant && variant["id"]},
          {"data-presentation-id", selection["presentation_id"]},
          {"lang", block["locale"]},
          {"dir",
           if(Regex.match?(~r/\A(ar|fa|he|ur)(?:[-_]|\z)/i, block["locale"]),
             do: "rtl",
             else: "ltr"
           )}
        ]),
        [
          element("figcaption", [], escape(block["caption"])),
          element("p", [{"class", "artifact-description"}], escape(block["description"])),
          image,
          unavailable,
          element(
            "div",
            [{"class", "artifact-fallback"}, {"data-artifact-fallback", ""}],
            render_children(content)
          )
        ]
      )
    end

    defp render_heading(tag, attrs, content) do
      id =
        case attrs["id"] do
          value when is_binary(value) -> if Regex.match?(@id, value), do: value
          _ -> nil
        end

      element(tag, compact([{"id", id}]), render_children(content))
    end

    defp render_link(attrs, content) do
      case safe_link(attrs["href"]) do
        {:ok, href, external?} ->
          link_attrs =
            [{"href", href}, {"title", string(attrs["title"])}] ++
              if(external?, do: [{"target", "_blank"}, {"rel", "noopener noreferrer"}], else: []) ++
              id_attributes(attrs)

          element("a", compact(link_attrs), render_children(content))

        :error ->
          element(
            "span",
            [{"data-unsafe-link", ""}] ++ id_attributes(attrs),
            render_children(content)
          )
      end
    end

    defp render_image(attrs) do
      case safe_media(attrs["src"]) do
        {:ok, src} ->
          [
            "<img",
            attributes(
              compact(
                [
                  {"src", src},
                  {"alt", string(attrs["alt"]) || ""},
                  {"title", string(attrs["title"])},
                  {"loading", "lazy"}
                ] ++ id_attributes(attrs)
              )
            ),
            ">"
          ]

        :error ->
          element(
            "span",
            [{"data-unsafe-media", ""}] ++ id_attributes(attrs),
            escape(string(attrs["alt"]) || "Image")
          )
      end
    end

    defp render_pre(attrs, [%{"tag" => "code", "attrs" => code_attrs, "content" => content}]) do
      source = text_content(content)

      language =
        (string(code_attrs["class"]) || "language-text") |> String.replace_prefix("language-", "")

      cond do
        attrs["__doc_shell_passive"] ->
          element(
            "pre",
            admitted_attributes(attrs),
            render_children([%{"tag" => "code", "attrs" => code_attrs, "content" => content}])
          )

        language == "mermaid" ->
          render_mermaid(attrs, content, code_attrs)

        true ->
          render_code(attrs, source, language, code_attrs)
      end
    end

    defp render_pre(attrs, content),
      do: element("pre", admitted_attributes(attrs), render_children(content))

    defp render_code(attrs, source, language, code_attrs) do
      id =
        valid_id(code_attrs["id"], nil) ||
          "doc-code-#{attrs["__doc_shell_position"]}-" <>
            (:crypto.hash(:sha256, source) |> Base.encode16(case: :lower) |> binary_part(0, 12))

      [
        "<div",
        attributes(id_attributes(attrs)),
        " class=\"doc-code\" data-doc-code data-language=\"",
        escape_attribute(language),
        "\"><button type=\"button\" class=\"pa-button\" data-pa-variant=\"secondary\" data-doc-copy=\"",
        id,
        "\" aria-label=\"",
        escape_attribute(label(attrs, "copy_code", "Copy code")),
        "\">",
        escape(label(attrs, "copy", "Copy")),
        "</button><button type=\"button\" class=\"pa-button\" data-doc-enhance=\"highlight\" hidden>",
        escape(label(attrs, "highlight_code", "Highlight code")),
        "</button><pre><code id=\"",
        id,
        "\">",
        escape(source),
        "</code></pre></div>"
      ]
    end

    defp render_mermaid(attrs, content, code_attrs \\ %{}) do
      source = text_content(content)

      if attrs["__doc_shell_passive"],
        do:
          element(
            "figure",
            [{"class", "doc-mermaid"}] ++ id_attributes(attrs),
            element("pre", [], element("code", id_attributes(code_attrs), escape(source)))
          ),
        else: enhanced_mermaid(attrs, source, code_attrs)
    end

    defp enhanced_mermaid(attrs, source, code_attrs) do
      [
        "<figure",
        attributes(id_attributes(attrs)),
        " class=\"doc-mermaid\" data-doc-mermaid><button type=\"button\" class=\"pa-button\" data-doc-enhance=\"mermaid\" hidden>",
        escape(label(attrs, "render_diagram", "Render diagram")),
        "</button><pre><code",
        attributes(id_attributes(code_attrs)),
        ">",
        escape(source),
        "</code></pre><figcaption>",
        escape(label(attrs, "diagram_source", "Diagram source")),
        "</figcaption></figure>"
      ]
    end

    defp render_directive(tag, attrs, content) when tag in ["tabs", "code-group"],
      do: render_tabs(attrs, content)

    defp render_directive("steps", attrs, content),
      do:
        element("ol", [{"class", "doc-steps"}] ++ id_attributes(attrs), render_children(content))

    defp render_directive("step", attrs, content) do
      title =
        if is_binary(attrs["title"]), do: element("h3", [], escape(attrs["title"])), else: []

      element("li", [{"class", "doc-step"}] ++ id_attributes(attrs), [
        title,
        render_children(content)
      ])
    end

    defp render_directive("accordion", attrs, content) do
      [
        "<details",
        attributes(id_attributes(attrs)),
        " class=\"doc-directive doc-accordion\"><summary>",
        escape(string(attrs["title"]) || label(attrs, "details", "Details")),
        "</summary>",
        render_children(content),
        "</details>"
      ]
    end

    defp render_directive("link-card", attrs, content) do
      label = string(attrs["title"]) || label(attrs, "directive_link_card", "Link card")

      element("section", [{"class", "doc-directive doc-link-card"}] ++ id_attributes(attrs), [
        element("strong", [], render_link(Map.delete(attrs, "id"), [label])),
        element("div", [], render_children(content))
      ])
    end

    defp render_directive(tag, attrs, content) do
      label =
        string(attrs["title"]) ||
          label(attrs, "directive_" <> String.replace(tag, "-", "_"), humanize(tag))

      [
        "<section",
        attributes(id_attributes(attrs)),
        " class=\"doc-directive doc-",
        escape_attribute(tag),
        "\" data-doc-directive=\"",
        escape_attribute(tag),
        "\"><strong>",
        escape(label),
        "</strong><div>",
        render_children(content),
        "</div></section>"
      ]
    end

    defp render_tabs(%{"__doc_shell_passive" => true} = attrs, content),
      do:
        element(
          "section",
          [{"class", "doc-tabs"}, {"data-doc-passive", ""}] ++ id_attributes(attrs),
          render_children(content)
        )

    defp render_tabs(attrs, content) do
      tabs = Enum.with_index(content)

      group =
        (attrs["id"] |> string() |> valid_id("doc-tabs")) <> "-" <> attrs["__doc_shell_position"]

      buttons =
        Enum.map(tabs, fn {node, index} ->
          label = tab_label(node, index, attrs)
          tab_id = "#{group}-tab-#{index}"
          panel_id = "#{group}-panel-#{index}"

          [
            "<button type=\"button\" class=\"pa-button\" role=\"tab\" id=\"",
            tab_id,
            "\" aria-controls=\"",
            panel_id,
            "\" aria-selected=\"",
            if(index == 0, do: "true", else: "false"),
            "\" tabindex=\"",
            if(index == 0, do: "0", else: "-1"),
            "\">",
            escape(label),
            "</button>"
          ]
        end)

      panels =
        Enum.map(tabs, fn {node, index} ->
          label = tab_label(node, index, attrs)

          [
            "<div role=\"tabpanel\" tabindex=\"0\" id=\"#{group}-panel-#{index}\" aria-labelledby=\"#{group}-tab-#{index}\"><h3>",
            escape(label),
            "</h3>",
            render_marked(node),
            "</div>"
          ]
        end)

      [
        "<section",
        attributes(id_attributes(attrs)),
        " class=\"pa-tabs doc-tabs\"><div role=\"tablist\" aria-label=\"",
        escape_attribute(
          string(attrs["title"]) || label(attrs, "documentation_tabs", "Documentation tabs")
        ),
        "\">",
        buttons,
        "</div>",
        panels,
        "</section>"
      ]
    end

    defp tab_label(%{"attrs" => %{"title" => title}}, _, _) when is_binary(title), do: title
    defp tab_label(_, index, attrs), do: "#{label(attrs, "tab", "Tab")} #{index + 1}"

    defp label(attrs, key, fallback) do
      value = Map.get(attrs, "__doc_shell_labels", %{})[key]
      if is_binary(value), do: value, else: fallback
    end

    defp id_attributes(attrs),
      do: Enum.filter(admitted_attributes(attrs), fn {key, _} -> key == "id" end)

    defp unknown(tag, attrs, content) do
      [
        "<div data-doc-shell-unknown=\"",
        escape_attribute(tag),
        "\"",
        attributes(id_attributes(attrs)),
        ">",
        render_children(content),
        "</div>"
      ]
    end

    defp element(tag, attrs, body),
      do: ["<", tag, attributes(attrs), ">", body, "</", tag, ">"]

    defp admitted_attributes(attrs) do
      attrs
      |> Enum.filter(fn {name, value} -> name in @attributes and is_binary(value) end)
      |> Enum.reject(fn {name, value} -> name == "id" and not Regex.match?(@id, value) end)
      |> Enum.sort()
    end

    defp attributes([]), do: []
    defp attributes(attrs), do: attrs |> Phoenix.HTML.attributes_escape() |> safe_iodata()
    defp escape(value), do: value |> Phoenix.HTML.html_escape() |> safe_iodata()

    defp escape_attribute(value) do
      {:safe, encoded} = Phoenix.HTML.html_escape(value)
      encoded
    end

    defp safe_iodata({:safe, value}), do: value

    defp safe_link(value) when is_binary(value) do
      value = String.trim(value)
      policy_value = decode_for_policy(value)
      uri = URI.parse(policy_value)

      cond do
        value == "" or String.contains?(value, ["\\", <<0>>]) -> :error
        String.starts_with?(policy_value, ["//", "\\\\"]) -> :error
        uri.scheme in [nil, "mailto"] -> {:ok, value, false}
        uri.scheme in ["http", "https"] and is_binary(uri.host) -> {:ok, value, true}
        true -> :error
      end
    end

    defp safe_link(_), do: :error

    defp safe_media("/" <> _ = value) do
      if String.starts_with?(value, "//") or String.contains?(value, ["\\", <<0>>]),
        do: :error,
        else: {:ok, value}
    end

    defp safe_media(_), do: :error

    defp decode_for_policy(value) do
      value
      |> decode_uri_twice()
      |> then(&Regex.replace(~r/&#x([0-9a-f]+);?/i, &1, fn _, hex -> codepoint(hex, 16) end))
      |> then(&Regex.replace(~r/&#([0-9]+);?/, &1, fn _, decimal -> codepoint(decimal, 10) end))
      |> String.replace(~r/&colon;/i, ":")
      |> String.replace(~r/[\x00-\x20\x7f-\x9f]/u, "")
    end

    defp decode_uri_twice(value) do
      Enum.reduce(1..2, value, fn _, current ->
        decoded = URI.decode(current)
        if decoded == current, do: current, else: decoded
      end)
    rescue
      ArgumentError -> value
    end

    defp codepoint(value, base) do
      case Integer.parse(value, base) do
        {integer, ""} when integer <= 0x10FFFF -> <<integer::utf8>>
        _ -> ""
      end
    rescue
      ArgumentError -> ""
    end

    defp text_content(content) when is_list(content) do
      Enum.map_join(content, fn
        value when is_binary(value) -> value
        %{"content" => nested} when is_list(nested) -> text_content(nested)
        _ -> ""
      end)
    end

    defp string(value) when is_binary(value), do: value
    defp string(_), do: nil
    defp compact(values), do: Enum.reject(values, fn {_, value} -> is_nil(value) end)

    defp valid_id(value, fallback) when is_binary(value) do
      if Regex.match?(@id, value), do: value, else: fallback
    end

    defp valid_id(_, fallback), do: fallback
    defp humanize(value), do: value |> String.replace("-", " ") |> String.capitalize()
  end
end
