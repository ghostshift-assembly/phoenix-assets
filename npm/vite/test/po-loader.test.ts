import { fileURLToPath } from "node:url"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parsePo, poLoaderPlugin } from "../src/po-loader"

const fixture = fileURLToPath(new URL("./fixtures/messages.po", import.meta.url))

describe("parsePo", () => {
  it("parses msgid/msgstr pairs, skipping the header and empty translations", () => {
    const po = [
      'msgid ""',
      'msgstr ""',
      "",
      'msgid "hello"',
      'msgstr "Hello"',
      "",
      'msgid "empty"',
      'msgstr ""',
    ].join("\n")

    const messages = parsePo(po)

    expect(messages.hello).toBe("Hello")
    expect(messages.empty).toBeUndefined()
    expect(messages[""]).toBeUndefined()
  })

  it("joins multi-line message strings", () => {
    const po = ['msgid "k"', 'msgstr ""', '"line1 "', '"line2"'].join("\n")
    expect(parsePo(po).k).toBe("line1 line2")
  })

  it("unescapes quotes and newlines", () => {
    const po = ['msgid "q"', 'msgstr "a \\"b\\" c\\nd"'].join("\n")
    expect(parsePo(po).q).toBe('a "b" c\nd')
  })

  it("unescapes tabs", () => {
    const po = ['msgid "t"', 'msgstr "a\\tb"'].join("\n")
    expect(parsePo(po).t).toBe("a\tb")
  })

  it("decodes an escaped backslash (\\\\n) to a literal backslash + n, not a newline", () => {
    // Source bytes: msgstr "a\\nb"  (backslash, backslash, n)
    const po = ['msgid "k"', 'msgstr "a\\\\nb"'].join("\n")
    // The leading `\\` collapses to one backslash; the `n` stays a literal `n`.
    expect(parsePo(po).k).toBe("a\\nb")
    expect(parsePo(po).k).not.toContain("\n")
  })

  it("decodes a real \\n escape to a newline", () => {
    // Source bytes: msgstr "a\nb"  (backslash, n)
    const po = ['msgid "k"', 'msgstr "a\\nb"'].join("\n")
    expect(parsePo(po).k).toBe("a\nb")
  })

  it("skips a #, fuzzy entry but keeps the following reviewed one", () => {
    const po = ["#, fuzzy", 'msgid "fz"', 'msgstr "Fuzzy"', "", 'msgid "ok"', 'msgstr "Okay"'].join(
      "\n",
    )

    const messages = parsePo(po)

    expect(messages.fz).toBeUndefined()
    // `fuzzy` must not leak onto the next entry.
    expect(messages.ok).toBe("Okay")
  })

  it("captures msgstr[0] for a plural entry and ignores later plural forms", () => {
    const po = [
      'msgid "cat"',
      'msgid_plural "cats"',
      'msgstr[0] "Katze"',
      'msgstr[1] "Katzen"',
    ].join("\n")

    expect(parsePo(po).cat).toBe("Katze")
  })
})

describe("poLoaderPlugin", () => {
  const plugin = poLoaderPlugin()
  const addWatchFile = vi.fn()
  const loadHook = plugin.load as unknown as (
    this: { addWatchFile: (file: string) => void },
    id: string,
  ) => { code: string; map: null } | null
  const load = (id: string) => loadHook.call({ addWatchFile }, id)

  beforeEach(() => {
    addWatchFile.mockClear()
  })

  it("loads a PO file as an ES module before Vite parses it", () => {
    expect(load(`${fixture}?import`)).toEqual({
      code: `export const messages = JSON.parse(${JSON.stringify(JSON.stringify({ hello: "Hello" }))})`,
      map: null,
    })
    expect(addWatchFile).toHaveBeenCalledExactlyOnceWith(fixture)
  })

  it("ignores non-PO modules", () => {
    expect(load(`${fixture}.ts`)).toBeNull()
    expect(addWatchFile).not.toHaveBeenCalled()
  })
})

it("does not append plural-id or context continuations to the message id or translation", () => {
  const po = [
    'msgid "cat"',
    'msgid_plural ""',
    '"cats"',
    'msgstr[0] "Katze"',
    'msgstr[1] "Katzen"',
    'msgctxt ""',
    '"context"',
    'msgid "dog"',
    'msgstr "Hund"',
  ].join("\n")
  expect(parsePo(po)).toEqual({ cat: "Katze", dog: "Hund" })
})

it("preserves prototype-like catalog keys as own properties", () => {
  const messages = parsePo(
    'msgid "__proto__"\nmsgstr "Prototype"\n\nmsgid "constructor"\nmsgstr "Constructor"',
  )
  expect(Object.hasOwn(messages, "__proto__")).toBe(true)
  expect(messages.__proto__).toBe("Prototype")
  expect(messages.constructor).toBe("Constructor")
})
