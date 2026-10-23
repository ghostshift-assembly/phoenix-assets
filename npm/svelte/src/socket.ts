/**
 * The shared Phoenix socket, behind its own subpath.
 *
 * `phoenix` is an optional peer: an app that syncs purely over Electric shapes
 * never installs it, and pulling it into the main barrel would make it a hard
 * requirement for everyone. Same reasoning as `@phoenix-assets/svelte/collection`
 * and the `@tanstack/*` peers.
 */
export {
  configureSocket,
  createSocket,
  disconnectSocket,
  getSocket,
  isSocketConnected,
  type SocketConfig,
} from "./pubsub/socket.js"
