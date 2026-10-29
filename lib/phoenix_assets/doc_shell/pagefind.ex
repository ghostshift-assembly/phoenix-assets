if Code.ensure_loaded?(DocShell.Presentation.SearchAdapter) do
  defmodule PhoenixAssets.DocShell.Pagefind do
    @moduledoc """
    Optional build-time Pagefind search adapter.

    Pagefind is invoked only while generating a site. The adapter turns admitted
    DocShell records into finite local HTML, runs the pinned native Pagefind
    builder, and returns every generated browser asset with version and SHA-256
    evidence in the search contract. It adds no served process or account.
    """

    @behaviour DocShell.Presentation.SearchAdapter

    alias DocShell.Presentation.{Asset, SearchAdapter, SiteSearchEntry}
    alias Phoenix.HTML

    @version "1.5.2"
    @allowed_options [:executable, :path, :timeout]
    @filters ~w(collection kind locale audience version tag status)

    @impl true
    def build(records, options \\ []) do
      with :ok <- validate_options(options),
           :ok <- validate_records(records),
           {:ok, executable} <- executable(options[:executable]),
           :ok <- validate_version(executable),
           {:ok, prefix} <- prefix(options[:path] || "pagefind"),
           {:ok, assets, indexes} <-
             build_indexes(records, executable, prefix, options[:timeout] || 30_000) do
        entry = Enum.find(assets, &String.ends_with?(&1.path, "/pagefind.js"))

        if entry do
          {:ok,
           %SearchAdapter.Output{
             assets: assets,
             contract: %{
               "schema_version" => "doc-shell-search-query/v1",
               "algorithm" => "pagefind/v1",
               "builder" => "pagefind",
               "version" => @version,
               "path" => entry.path,
               "indexes" => indexes,
               "filters" => @filters,
               "digests" => Map.new(assets, &{&1.path, digest(&1.bytes)})
             }
           }}
        else
          {:error, :missing_pagefind_browser_entry}
        end
      end
    end

    @doc "Returns the exact qualified Pagefind builder release."
    @spec version() :: String.t()
    def version, do: @version

    defp validate_options(options) do
      if Keyword.keyword?(options) and Keyword.keys(options) -- @allowed_options == [] and
           valid_timeout?(options[:timeout]),
         do: :ok,
         else: {:error, {:invalid_pagefind_options, options}}
    end

    defp valid_timeout?(nil), do: true
    defp valid_timeout?(value), do: is_integer(value) and value in 1_000..120_000

    defp validate_records(records) when is_list(records) do
      if Enum.all?(records, &valid_record?/1), do: :ok, else: {:error, :invalid_search_records}
    end

    defp validate_records(_), do: {:error, :invalid_search_records}

    defp valid_record?(%SiteSearchEntry{} = record) do
      Enum.all?(
        [record.id, record.page_id, record.route, record.title, record.text, record.locale],
        &(is_binary(&1) and String.valid?(&1))
      ) and String.starts_with?(record.route, "/") and is_list(record.tags)
    end

    defp valid_record?(_), do: false

    defp executable(nil) do
      case System.find_executable("pagefind") do
        nil -> {:error, :pagefind_executable_not_found}
        value -> {:ok, value}
      end
    end

    defp executable(value) when is_binary(value) do
      if Path.type(value) == :absolute and File.regular?(value),
        do: {:ok, value},
        else: {:error, {:invalid_pagefind_executable, value}}
    end

    defp executable(value), do: {:error, {:invalid_pagefind_executable, value}}

    defp validate_version(executable) do
      case System.cmd(executable, ["--version"], stderr_to_stdout: true) do
        {"pagefind " <> version, 0} ->
          if String.trim(version) == @version,
            do: :ok,
            else: {:error, {:pagefind_version_mismatch, String.trim(version), @version}}

        {output, status} ->
          {:error, {:pagefind_version_failed, status, String.trim(output)}}
      end
    end

    defp prefix(value) when is_binary(value) do
      if value != "" and Path.type(value) == :relative and
           not String.contains?(value, ["\\", <<0>>]) and ".." not in Path.split(value),
         do: {:ok, String.trim_trailing(value, "/")},
         else: {:error, {:invalid_pagefind_path, value}}
    end

    defp prefix(value), do: {:error, {:invalid_pagefind_path, value}}

    defp build_indexes(records, executable, prefix, timeout) do
      records
      |> Enum.group_by(& &1.locale)
      |> Enum.sort()
      |> Enum.reduce_while({:ok, [], %{}}, fn {locale, localized}, {:ok, assets, indexes} ->
        directory = Path.join(prefix, digest(locale) |> String.replace_prefix("sha256:", ""))

        case run(localized, executable, directory, timeout) do
          {:ok, generated} ->
            path = "../" <> Path.basename(directory) <> "/pagefind.js"
            {:cont, {:ok, assets ++ generated, Map.put(indexes, locale, path)}}

          {:error, _} = error ->
            {:halt, error}
        end
      end)
    end

    defp run(records, executable, prefix, timeout) do
      token = Integer.to_string(System.unique_integer([:positive, :monotonic]), 36)
      root = Path.join(System.tmp_dir!(), "phoenix-assets-pagefind-#{token}")
      source = Path.join(root, "source")
      output = Path.join(root, "output")

      with :ok <- File.mkdir(root),
           :ok <- File.mkdir(source),
           :ok <- File.mkdir(output) do
        try do
          records |> Enum.sort_by(&{&1.route, &1.id}) |> Enum.each(&write_record(source, &1))

          task =
            Task.async(fn ->
              System.cmd(
                executable,
                ["--site", source, "--output-path", output, "--quiet"],
                stderr_to_stdout: true
              )
            end)

          case Task.yield(task, timeout) || Task.shutdown(task, :brutal_kill) do
            {:ok, {_, 0}} -> collect_assets(output, prefix)
            {:ok, {message, status}} -> {:error, {:pagefind_failed, status, String.trim(message)}}
            nil -> {:error, {:pagefind_timeout, timeout}}
          end
        after
          File.rm_rf(root)
        end
      end
    end

    defp write_record(source, record) do
      filename = digest(record.id) |> String.replace_prefix("sha256:", "")
      filters = filters(record)

      html = [
        "<!doctype html><html lang=\"",
        escape(record.locale),
        "\"><head>",
        metadata(record),
        filters,
        "</head><body><main data-pagefind-body><h1>",
        escape(record.title),
        "</h1>",
        section(record.section),
        "<p>",
        escape(record.text),
        "</p></main></body></html>"
      ]

      File.write!(Path.join(source, filename <> ".html"), html)
    end

    defp metadata(record) do
      values = %{
        "record_id" => record.id,
        "page_id" => record.page_id,
        "route" => record.route,
        "section" => record.section || "",
        "collection" => record.collection,
        "version" => record.version,
        "locale" => record.locale,
        "kind" => record.kind,
        "status" => record.status || ""
      }

      Enum.map(values, fn {name, value} ->
        ["<meta data-pagefind-meta=\"", name, "[content]\" content=\"", escape(value), "\">"]
      end)
    end

    defp filters(record) do
      %{
        "collection" => [record.collection],
        "kind" => [record.kind],
        "locale" => [record.locale],
        "audience" => List.wrap(record.audience),
        "version" => [record.version],
        "tag" => record.tags,
        "status" => List.wrap(record.status)
      }
      |> Enum.sort()
      |> Enum.flat_map(fn {name, values} ->
        for value <- values, is_binary(value) and value != "" do
          ["<meta data-pagefind-filter=\"", name, "[content]\" content=\"", escape(value), "\">"]
        end
      end)
    end

    defp section(nil), do: []
    defp section(value), do: ["<h2>", escape(value), "</h2>"]

    defp collect_assets(output, prefix) do
      assets =
        output
        |> Path.join("**/*")
        |> Path.wildcard(match_dot: true)
        |> Enum.filter(&File.regular?/1)
        |> Enum.sort()
        |> Enum.map(fn path ->
          relative = Path.relative_to(path, output)

          %Asset{
            path: Path.join(prefix, relative),
            media_type: media_type(path),
            bytes: File.read!(path)
          }
        end)

      {:ok, assets}
    end

    defp media_type(path) do
      case Path.extname(path) do
        ".js" -> "text/javascript; charset=utf-8"
        ".css" -> "text/css; charset=utf-8"
        ".json" -> "application/json"
        ".wasm" -> "application/wasm"
        _ -> "application/octet-stream"
      end
    end

    defp digest(value) do
      "sha256:" <> Base.encode16(:crypto.hash(:sha256, value), case: :lower)
    end

    defp escape(value) do
      value
      |> HTML.html_escape()
      |> HTML.Safe.to_iodata()
    end
  end
end
