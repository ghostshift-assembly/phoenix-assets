import { getContext, setContext } from "svelte"
import type { ArtifactPage } from "./artifacts.js"

const key = Symbol.for("phoenix-assets/doc-shell/artifacts")
type Reader = () => ArtifactPage | undefined
export const artifactContext = (): Reader =>
  getContext<Reader | undefined>(key) ?? (() => undefined)
export const provideArtifacts = (read: Reader): void => {
  setContext(key, read)
}
