import { createHighlighterCore, type HighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

/**
 * Grammars this shell can highlight, keyed by the fence language and its
 * aliases. Loading them explicitly — rather than importing the `shiki` bundle,
 * which reaches every one of its 300-odd grammars — is what keeps the published
 * package small enough for a host to ship without code-splitting it by hand.
 *
 * The set covers a Phoenix + SvelteKit codebase and the file formats its docs
 * quote. A fence in any other language falls back to plain text, which is what
 * an unknown language already did.
 */
const grammars = {
  bash: () => import("@shikijs/langs/bash"),
  css: () => import("@shikijs/langs/css"),
  diff: () => import("@shikijs/langs/diff"),
  elixir: () => import("@shikijs/langs/elixir"),
  erlang: () => import("@shikijs/langs/erlang"),
  html: () => import("@shikijs/langs/html"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  markdown: () => import("@shikijs/langs/markdown"),
  sql: () => import("@shikijs/langs/sql"),
  svelte: () => import("@shikijs/langs/svelte"),
  typescript: () => import("@shikijs/langs/typescript"),
  yaml: () => import("@shikijs/langs/yaml"),
} as const

const aliases: Record<string, keyof typeof grammars> = {
  ex: "elixir",
  exs: "elixir",
  js: "javascript",
  md: "markdown",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  yml: "yaml",
}

/** The fence languages `highlight` will render, including aliases. */
export const supportedLanguages: readonly string[] = [
  ...Object.keys(grammars),
  ...Object.keys(aliases),
].sort()

/** Resolves a fence language to a loadable grammar, or `null` if we skip it. */
export function resolveLanguage(language: string): keyof typeof grammars | null {
  const name = language.toLowerCase()
  if (Object.hasOwn(grammars, name)) return name as keyof typeof grammars
  return Object.hasOwn(aliases, name) ? (aliases[name] ?? null) : null
}

// One highlighter per module, created on first use and shared by every
// CodeBlock. Building one per component would re-parse the grammars for each
// fence on the page.
let pending: Promise<HighlighterCore> | null = null

function highlighter(): Promise<HighlighterCore> {
  pending ??= createHighlighterCore({
    themes: [import("@shikijs/themes/github-light"), import("@shikijs/themes/github-dark")],
    langs: [],
    // The JavaScript engine keeps the package WASM-free, so hosts can bundle it
    // without an asset loader and `check:offline` stays trivially satisfied.
    engine: createJavaScriptRegexEngine(),
  })
  return pending
}

/**
 * Highlights `code` as `language`, or returns `null` when we have no grammar
 * for it so the caller can render the plain source instead.
 *
 * Emits both themes as `--shiki-light` / `--shiki-dark` custom properties
 * rather than baked-in colours, leaving the light/dark choice to the host's
 * `color-scheme`.
 */
export async function highlight(code: string, language: string): Promise<string | null> {
  const lang = resolveLanguage(language)
  if (!lang) return null

  const shiki = await highlighter()
  if (!shiki.getLoadedLanguages().includes(lang)) await shiki.loadLanguage(grammars[lang])
  return shiki.codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  })
}
