import { afterEach, describe, expect, it, vi } from "vitest"

const connect = vi.fn()
const disconnect = vi.fn()
const isConnected = vi.fn(() => true)
const construct = vi.fn()

vi.mock("phoenix", () => ({
  Socket: class {
    constructor(path: string, options: Record<string, unknown>) {
      construct(path, options)
    }
    connect = connect
    disconnect = disconnect
    isConnected = isConnected
  },
}))

const { configureSocket, createSocket, disconnectSocket, getSocket, isSocketConnected } =
  await import("../src/socket.js")

afterEach(() => {
  disconnectSocket()
  vi.clearAllMocks()
})

describe("the shared socket", () => {
  it("keeps caller-owned scopes independent and unconnected", () => {
    const tenant = createSocket({ path: "/socket", options: { authToken: "tenant-ticket" } })
    const portal = createSocket({ path: "/portal-socket", options: { authToken: "portal-ticket" } })
    expect(tenant).not.toBe(portal)
    expect(connect).not.toHaveBeenCalled()
    expect(construct).toHaveBeenNthCalledWith(
      1,
      "/socket",
      expect.objectContaining({ authToken: "tenant-ticket" }),
    )
    expect(construct).toHaveBeenNthCalledWith(
      2,
      "/portal-socket",
      expect.objectContaining({ authToken: "portal-ticket" }),
    )
    expect(isSocketConnected()).toBe(false)
  })
  // A socket pointed at a guessed default would fail later, further from the
  // cause; every host wrote this singleton and none of them had this guard.
  it("refuses to connect before it is configured", () => {
    expect(() => getSocket()).toThrow(/configureSocket/)
  })

  it("connects once and hands back the same socket", () => {
    configureSocket({ path: "/socket" })

    expect(getSocket()).toBe(getSocket())
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it("passes the params thunk through, so a rotated token is re-read", () => {
    const params = () => ({ token: "abc" })
    configureSocket({ path: "/socket", params })

    getSocket()

    expect(construct).toHaveBeenCalledWith("/socket", expect.objectContaining({ params }))
  })

  it("backs off 250/500/1000/2000 then holds at 5000", () => {
    configureSocket({ path: "/socket" })
    getSocket()

    const options = construct.mock.calls[0]?.[1] as { reconnectAfterMs: (n: number) => number }

    expect([1, 2, 3, 4, 5, 99].map(options.reconnectAfterMs)).toEqual([
      250, 500, 1000, 2000, 5000, 5000,
    ])
  })

  it("honours a custom backoff", () => {
    configureSocket({ path: "/socket", reconnectAfterMs: () => 42 })
    getSocket()

    const options = construct.mock.calls[0]?.[1] as { reconnectAfterMs: (n: number) => number }

    expect(options.reconnectAfterMs(1)).toBe(42)
  })

  it("disconnects the previous socket when reconfigured", () => {
    configureSocket({ path: "/socket" })
    getSocket()
    configureSocket({ path: "/other" })

    expect(disconnect).toHaveBeenCalledTimes(1)

    getSocket()
    expect(construct).toHaveBeenLastCalledWith("/other", expect.anything())
  })

  it("reports connection state, and false with no socket", () => {
    expect(isSocketConnected()).toBe(false)

    configureSocket({ path: "/socket" })
    getSocket()

    expect(isSocketConnected()).toBe(true)
  })
})
