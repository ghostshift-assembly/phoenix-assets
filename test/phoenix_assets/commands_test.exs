defmodule PhoenixAssets.CommandsTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias PhoenixAssets.{Commands, Config, Context}

  defmodule Declarations do
    @moduledoc false
    use PhoenixAssets.Commands.Definitions

    command(:publish_article,
      route: "/api/articles/:id/publish",
      method: :post,
      params: [id: :string],
      body: [note: :string, pinned: :boolean],
      result: "ArticleRow",
      errors: [:already_published, :article_not_found]
    )

    command(:archive_article,
      route: "/api/articles/:id",
      method: :delete,
      params: [id: :integer]
    )

    command(:import_articles,
      route: "/api/articles/import",
      body: "ImportPayload",
      result: "ImportReceipt"
    )

    command(:sync_article,
      route: "/api/articles/:id/sync",
      method: :patch,
      body: [source: "ArticleSource", force: :boolean],
      result: [article: "ArticleRow", warnings: :list],
      errors: [:sync_failed]
    )
  end

  defmodule EmptyDeclarations do
    @moduledoc false
    use PhoenixAssets.Commands.Definitions
  end

  defmodule WireKeyDeclarations do
    @moduledoc false
    use PhoenixAssets.Commands.Definitions

    command(:wire_keys,
      route: "/api/wire-keys",
      body: [
        {:"display-name", :string},
        {:"space key", :string},
        {:class, :string},
        {:café, :string},
        {:"quote\"slash\\", :string}
      ],
      result: [{:"result-value", :integer}]
    )
  end

  defmodule Stub do
    @moduledoc false
    def init(opts), do: opts
    def call(conn, _), do: conn
  end

  defmodule Router do
    @moduledoc false
    use Phoenix.Router

    post("/api/articles/:id/publish", PhoenixAssets.CommandsTest.Stub, :publish)
    get("/api/articles/:id", PhoenixAssets.CommandsTest.Stub, :show)
  end

  defp ctx, do: Context.new(Config.load!(otp_app: :my_app), env: :test)

  defp render(module \\ Declarations) do
    {:ok, state} = Commands.init([commands: module], ctx())
    [file] = Commands.generated_files(ctx(), state)
    assert file.kind == :commands
    IO.iodata_to_binary(file.contents)
  end

  test "imports the command runtime and only the types that must resolve" do
    out = render()

    assert out =~ ~s|import { runCommand } from "@phoenix-assets/svelte/core"|

    assert out =~
             ~s|import type { CommandOptions, CommandResult } from "@phoenix-assets/svelte/core"|

    # ArticleRow/ImportPayload/ImportReceipt come from $phoenix/types; an inline
    # body renders its own interface and must not be imported.
    assert out =~
             ~s|import type { ArticleRow, ArticleSource, ImportPayload, ImportReceipt } | <>
               ~s|from "$phoenix/types"|

    refute out =~ "PublishArticleBody } from"
  end

  test "renders an interface for an inline body with the field names sent on the wire" do
    out = render()

    assert out =~ "export interface PublishArticleBody {\n  note: string\n  pinned: boolean\n}"
  end

  test "quotes non-identifier wire keys without rewriting their JSON names" do
    out = render(WireKeyDeclarations)

    assert out =~ ~s|  "display-name": string|
    assert out =~ ~s|  "space key": string|
    assert out =~ "  class: string"
    assert out =~ ~s|  "café": string|
    assert out =~ ~S|  "quote\"slash\\": string|
    assert out =~ ~s|  "result-value": number|
  end

  test "generated interfaces with escaped wire keys compile with TypeScript" do
    case System.find_executable("pnpm") do
      nil ->
        :ok

      pnpm ->
        root = Path.join(System.tmp_dir!(), "pa_commands_#{System.unique_integer([:positive])}")
        File.mkdir_p!(root)
        on_exit(fn -> File.rm_rf!(root) end)
        File.write!(Path.join(root, "commands.ts"), render(WireKeyDeclarations))

        File.write!(
          Path.join(root, "runtime.d.ts"),
          ~S"""
          declare module "@phoenix-assets/svelte/core" {
            export interface CommandOptions { signal?: AbortSignal }
            export type CommandResult<TData, TError extends string> =
              | { ok: true; data: TData }
              | { ok: false; error: TError | "unknown_error"; status: number }
            export function runCommand<TData, TError extends string>(
              request: unknown,
              errors: readonly TError[],
            ): Promise<CommandResult<TData, TError>>
          }
          """
        )

        {output, status} =
          System.cmd(
            pnpm,
            [
              "exec",
              "tsc",
              "--noEmit",
              "--strict",
              "--target",
              "ES2022",
              "--module",
              "ESNext",
              "--moduleResolution",
              "Bundler",
              Path.join(root, "commands.ts"),
              Path.join(root, "runtime.d.ts")
            ],
            stderr_to_stdout: true
          )

        assert status == 0, output
    end
  end

  test "renders the declared error codes as a union and a runtime list" do
    out = render()

    assert out =~
             "export type PublishArticleError = " <>
               ~s("already_published" | "article_not_found")

    assert out =~
             "const PUBLISH_ARTICLE_ERRORS: readonly PublishArticleError[] = " <>
               ~s(["already_published", "article_not_found"])
  end

  test "a command with no declared codes still has an unusable failure arm" do
    out = render()

    assert out =~ "export type ArchiveArticleError = never"
    assert out =~ "const ARCHIVE_ARTICLE_ERRORS: readonly ArchiveArticleError[] = []"
  end

  test "generates a typed function per command, carrying method and route" do
    out = render()

    assert out =~
             "  publishArticle: (params: { id: string }, body: PublishArticleBody, " <>
               "options?: CommandOptions): Promise<CommandResult<ArticleRow, PublishArticleError>>"

    assert out =~ ~s|runCommand({ path: "/api/articles/:id/publish", method: "POST", params, body|
    assert out =~ ~s|method: "DELETE"|
  end

  test "types path params from the declaration and defaults the rest" do
    out = render()

    assert out =~ "archiveArticle: (params: { id: number }, options?: CommandOptions)"
  end

  test "a command with no body or params takes options only" do
    out = render()

    assert out =~ "importArticles: (body: ImportPayload, options?: CommandOptions)"
  end

  test "a command without a result resolves to null data" do
    out = render()

    assert out =~ "Promise<CommandResult<null, ArchiveArticleError>>"
  end

  test "output is deterministic and sorted by command name" do
    first = render()
    assert first == render()

    names = Regex.scan(~r/^  (\w+): \(/m, first) |> Enum.map(&List.last/1)
    assert names == Enum.sort(names)
  end

  test "renders a wrapper interface when the endpoint nests its payload" do
    out = render()

    assert out =~
             "export interface SyncArticleData {\n  article: ArticleRow\n  warnings: unknown[]\n}"

    assert out =~ "Promise<CommandResult<SyncArticleData, SyncArticleError>>"
  end

  test "imports the types named inside inline body and result shapes" do
    out = render()

    assert out =~ "ArticleSource"

    assert out =~
             "export interface SyncArticleBody {\n  source: ArticleSource\n  force: boolean\n}"
  end

  test "a nil commands module contributes no files, entries, or checks" do
    assert Commands.generated_files(ctx(), %{module: nil}) == []
    assert Commands.graph_entries(ctx(), %{module: nil}) == []
    assert Commands.doctor_checks(ctx(), %{module: nil}) == []
  end

  test "an empty commands module omits the type import line" do
    {:ok, state} = Commands.init([commands: EmptyDeclarations], ctx())
    [file] = Commands.generated_files(ctx(), state)
    out = IO.iodata_to_binary(file.contents)

    refute out =~ "$phoenix/types"
    assert out =~ "export const commands = {\n} as const"
  end

  test "graph entries carry route, method and declared errors" do
    {:ok, state} = Commands.init([commands: Declarations], ctx())
    entries = Commands.graph_entries(ctx(), state)

    publish = Enum.find(entries, &(&1.key == "publish_article"))
    assert publish.kind == :command
    assert publish.data["method"] == "POST"
    assert publish.data["route"] == "/api/articles/:id/publish"
    assert publish.data["errors"] == ["already_published", "article_not_found"]
  end

  test "doctor checks confirm the route, and reject a verb or route mismatch" do
    router_ctx = Context.new(Config.load!(otp_app: :my_app, router: Router), env: :test)
    {:ok, state} = Commands.init([commands: Declarations], router_ctx)

    results = router_ctx |> Commands.doctor_checks(state) |> Enum.map(& &1.run.(router_ctx))
    messages = Enum.map(results, & &1.message)

    assert Enum.any?(messages, &(&1 =~ "publish_article -> POST /api/articles/:id/publish"))
    assert Enum.any?(messages, &(&1 =~ "exists but not for DELETE"))
    assert Enum.any?(messages, &(&1 =~ "is not in the router"))
  end

  test "doctor check warns when no router is configured to validate against" do
    {:ok, state} = Commands.init([commands: Declarations], ctx())
    [result | _] = ctx() |> Commands.doctor_checks(state) |> Enum.map(& &1.run.(ctx()))

    assert result.status == :warn
    assert result.message =~ "no router configured"
  end
end
