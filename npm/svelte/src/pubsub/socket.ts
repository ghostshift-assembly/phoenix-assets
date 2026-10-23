import { Socket, type SocketConnectOption } from "phoenix"

/**
 * The one Phoenix socket for an app.
 *
 * `$phoenix/pubsub` generates typed topic builders and `matchEvent` narrows the
 * event union, but nothing shipped the transport underneath — so every app wrote
 * the same module-level singleton, the same `connect()` on first use, and the
 * same reconnect backoff. This is that module, once.
 *
 * Configure it at boot, before anything joins a channel:
 *
 * ```ts
 * configureSocket({ path: env.socketPath, params: () => ({ token: getToken() }) })
 * ```
 */
export interface SocketConfig {
  /** Endpoint path, e.g. `"/socket"`. */
  path: string
  /**
   * Connect params, re-read on every (re)connect — so a rotated token is picked
   * up without tearing the socket down.
   */
  params?: () => Record<string, unknown>
  /**
   * Reconnect backoff in milliseconds, by attempt number. Defaults to
   * 250/500/1000/2000, then 5000. Channels that heal missed events on rejoin
   * can safely leave this alone.
   */
  reconnectAfterMs?: (tries: number) => number
  /** Escape hatch for anything else `phoenix`'s Socket accepts. */
  options?: Partial<SocketConnectOption>
}

const DEFAULT_BACKOFF = [250, 500, 1000, 2000]

/**
 * Creates an independent, unconnected transport. The caller owns connect,
 * disconnect and credential lifetime; no other scope reuses this instance.
 */
export function createSocket(config: SocketConfig): Socket {
  return new Socket(config.path, {
    params: config.params,
    reconnectAfterMs: config.reconnectAfterMs ?? ((tries) => DEFAULT_BACKOFF[tries - 1] ?? 5000),
    ...config.options,
  })
}

let config: SocketConfig | null = null
let socket: Socket | null = null

/** Sets the socket configuration. Disconnects an existing socket first. */
export function configureSocket(next: SocketConfig): void {
  if (socket) disconnectSocket()
  config = next
}

/**
 * The shared socket, connecting it on first use.
 *
 * Throws when {@link configureSocket} has not run — a socket pointed at a
 * guessed default would fail later, further from the cause.
 */
export function getSocket(): Socket {
  if (socket) return socket

  if (!config) {
    throw new Error(
      "getSocket: call configureSocket({ path }) before joining a channel — " +
        "usually once in your root layout.",
    )
  }

  socket = createSocket(config)

  socket.connect()
  return socket
}

/** Disconnects and forgets the shared socket. Configuration is kept. */
export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

/** Whether a socket exists and is currently connected. */
export function isSocketConnected(): boolean {
  return socket?.isConnected() ?? false
}
