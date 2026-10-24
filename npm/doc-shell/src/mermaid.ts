/** Mermaid extensions cannot add resource loading or override the closed renderer policy. */
export const admitMermaidSource = (source: string) => {
  if (
    source.length > 50000 ||
    /%%\{|^\s*---|@import|!\s*\[|(?:https?|data|javascript)\s*:|url\s*\(|<\s*(?:img|image|iframe)|\b(?:img|icon|image)\s*:/im.test(
      source,
    )
  )
    throw new Error(
      "Diagram enhancement is unavailable under the local resource policy; source is retained",
    )
}

export const renderMermaid = async (source: string): Promise<string> => {
  admitMermaidSource(source)
  const mermaid = (await import("mermaid")).default
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    layout: "dagre",
    theme: "default",
    look: "classic",
  })
  return (await mermaid.render(`doc-shell-${crypto.randomUUID()}`, source)).svg
}
