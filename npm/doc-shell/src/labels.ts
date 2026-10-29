import { getContext, setContext } from "svelte"

const contextKey = Symbol.for("phoenix-assets/doc-shell/labels")
type Labels = Readonly<Record<string, string>>
type Reader = () => Labels | undefined

/** Inherit host text through recursive components without translating source content. */
export const inheritLabels = (own: Reader = () => undefined) => {
  const parent = getContext<Reader | undefined>(contextKey)
  const read = () => own() ?? parent?.() ?? {}
  setContext(contextKey, read)
  return (key: string, fallback: string) => read()[key] ?? fallback
}
