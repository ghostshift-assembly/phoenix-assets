import { flushSync, mount, unmount } from "svelte"
import { afterEach, describe, expect, it, vi } from "vitest"
import AstRenderer from "../src/ast-renderer.svelte"
import TryIt from "../src/try-it.svelte"
import type { OperationEntry } from "../src/types.js"
import { isAllowedTryItOrigin, resolveTryItTarget, safeLinkTarget } from "../src/url.js"

const mounted: Array<ReturnType<typeof mount>> = []

function target(): HTMLDivElement {
  const element = document.createElement("div")
  document.body.append(element)
  return element
}

function operation(path = "/api/users"): OperationEntry {
  return { id: "users", method: "GET", path, tags: [], operation: {} }
}

function openTryIt(element: HTMLElement): void {
  element.querySelector<HTMLButtonElement>("button")?.click()
  flushSync()
}

afterEach(() => {
  for (const component of mounted.splice(0)) unmount(component)
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

it.each([1, false, null, ["text"], { nested: "value" }])(
  "safely ignores non-text JSON attributes: %j",
  (value) => {
    const element = target()
    mounted.push(
      mount(AstRenderer, {
        target: element,
        props: {
          nodes: [
            {
              tag: "pre",
              attrs: {},
              content: [
                { tag: "code", attrs: { class: value }, content: ["source stays readable"] },
              ],
            },
            { tag: "a", attrs: { href: value }, content: ["Link text"] },
            { tag: "img", attrs: { src: value, alt: value }, content: [] },
            { tag: "h2", attrs: { id: value }, content: ["A heading"] },
            {
              tag: "tabs",
              attrs: { title: value },
              content: [{ tag: "p", attrs: { title: value }, content: ["Tab body"] }],
            },
          ],
        },
      }),
    )
    flushSync()
    expect(element.querySelector("code")?.textContent).toBe("source stays readable")
    expect(element.querySelector("[data-unsafe-link]")?.textContent).toBe("Link text")
    expect(element.querySelector("img")).toBeNull()
    expect(element.querySelector("h2")?.id).toBe("a-heading")
    expect(element.querySelector('[role="tab"]')?.textContent).toBe("Tab 1")
    expect(element.querySelector("[role=tablist]")?.getAttribute("aria-label")).toBe(
      "Documentation tabs",
    )
  },
)

describe("dynamic link policy", () => {
  it("accepts relative, HTTP(S), and mailto links with external metadata", () => {
    expect(safeLinkTarget("/docs/start", "https://docs.example.test/current")).toEqual({
      href: "/docs/start",
      external: false,
      navigable: true,
    })
    expect(safeLinkTarget("mailto:team@example.test")?.navigable).toBe(false)
    expect(
      safeLinkTarget("https://elsewhere.example.test/guide", "https://docs.example.test/current"),
    ).toEqual({
      href: "https://elsewhere.example.test/guide",
      external: true,
      navigable: false,
    })
  })

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java%73cript:alert(1)",
    "java&#x73;cript&#58;alert(1)",
    "javascript&COLON;alert(1)",
    "javascript&#x110000;:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,boom",
    "vbscript:msgbox(1)",
    "//attacker.example.test/path",
    "\\\\attacker.example.test\\path",
  ])("rejects unsafe link target %s", (href) => {
    expect(safeLinkTarget(href)).toBeUndefined()
  })

  it("renders rejected links without an href and isolates external openers", () => {
    const element = target()
    const component = mount(AstRenderer, {
      target: element,
      props: {
        nodes: [
          { tag: "a", attrs: { href: "javascript:alert(1)" }, content: "unsafe" },
          {
            tag: "a",
            attrs: { href: "https://elsewhere.example.test/guide" },
            content: "external",
          },
        ],
      },
    })
    mounted.push(component)

    expect(element.querySelector("[data-unsafe-link]")?.textContent).toBe("unsafe")
    const link = element.querySelector("a")
    expect(link?.target).toBe("_blank")
    expect(link?.rel).toBe("noopener noreferrer")
  })
})

describe("try-it origin policy", () => {
  it.each([undefined, "", "   "])(
    "keeps request execution unavailable for an empty API base (%s)",
    (baseUrl) => {
      const request = vi.fn()
      const element = target()
      mounted.push(
        mount(TryIt, { target: element, props: { entry: operation(), baseUrl, request } }),
      )
      flushSync()
      expect(element.textContent).toContain("Request execution unavailable.")
      expect(element.querySelector("button")).toBeNull()
      expect(request).not.toHaveBeenCalled()
    },
  )

  it("resolves same-origin paths and rejects origin-changing operation paths", () => {
    expect(resolveTryItTarget("/v1", "/users", "https://docs.example.test/reference")).toEqual({
      url: "https://docs.example.test/v1/users",
      origin: "https://docs.example.test",
      crossOrigin: false,
    })

    for (const path of ["https://attacker.example.test/steal", "//attacker.example.test/steal"]) {
      expect(() => resolveTryItTarget("", path)).toThrow(/root-relative/)
    }
    expect(() => resolveTryItTarget("//attacker.example.test", "/steal")).toThrow(/scheme-relative/)
  })

  it("matches explicitly allowed origins exactly", () => {
    expect(isAllowedTryItOrigin("https://api.example.test", ["https://api.example.test/v1"])).toBe(
      true,
    )
    expect(isAllowedTryItOrigin("https://evil.example.test", ["https://api.example.test"])).toBe(
      false,
    )
  })

  it("sends same-origin requests without cross-origin credentials", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    const element = target()
    const component = mount(TryIt, {
      target: element,
      props: { entry: operation(), baseUrl: "/", request },
    })
    mounted.push(component)
    openTryIt(element)

    const token = element.querySelector<HTMLInputElement>('input[type="password"]')
    expect(token).not.toBeNull()
    if (token) {
      token.value = "secret"
      token.dispatchEvent(new Event("input", { bubbles: true }))
    }
    element.querySelectorAll<HTMLButtonElement>("button")[1]?.click()

    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    const [url, init] = request.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).origin).toBe(window.location.origin)
    expect(new URL(url).pathname).toBe("/api/users")
    expect(init.credentials).toBe("same-origin")
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret")
  })

  it("retains a body for an explicitly enabled DELETE operation", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    const element = target()
    mounted.push(
      mount(TryIt, {
        target: element,
        props: {
          entry: { ...operation(), method: "DELETE" },
          baseUrl: "/",
          request,
        },
      }),
    )
    openTryIt(element)
    const body = element.querySelector<HTMLTextAreaElement>("textarea")
    if (!body) throw new Error("missing DELETE body input")
    body.value = '{"reason":"example"}'
    body.dispatchEvent(new Event("input", { bubbles: true }))
    flushSync()
    element.querySelector<HTMLButtonElement>(".form > button")?.click()
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: "DELETE",
      body: '{"reason":"example"}',
    })
  })

  it("blocks absolute operation paths and unapproved cross-origin bases", () => {
    const request = vi.fn()

    for (const props of [
      { entry: operation("https://attacker.example.test/steal"), baseUrl: "/" },
      { entry: operation(), baseUrl: "https://api.example.test" },
    ]) {
      const element = target()
      const component = mount(TryIt, { target: element, props: { ...props, request } })
      mounted.push(component)
      openTryIt(element)

      expect(element.querySelector<HTMLButtonElement>(".form > button")?.disabled).toBe(true)
      expect(element.querySelector('[role="alert"]')).not.toBeNull()
    }

    expect(request).not.toHaveBeenCalled()
  })

  it("requires visible confirmation for an allowed cross-origin base", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    const element = target()
    const component = mount(TryIt, {
      target: element,
      props: {
        entry: operation(),
        baseUrl: "https://api.example.test/v1",
        allowedOrigins: ["https://api.example.test"],
        request,
      },
    })
    mounted.push(component)
    openTryIt(element)

    const send = element.querySelector<HTMLButtonElement>(".form > button")
    expect(send?.disabled).toBe(true)
    expect(element.textContent).toContain("Send this request to https://api.example.test")

    element.querySelector<HTMLInputElement>('.origin-confirm input[type="checkbox"]')?.click()
    flushSync()
    expect(send?.disabled).toBe(false)
    send?.click()

    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    const [url, init] = request.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.example.test/v1/api/users")
    expect(init.credentials).toBe("same-origin")
    expect(init.headers).not.toHaveProperty("authorization")
  })
})
