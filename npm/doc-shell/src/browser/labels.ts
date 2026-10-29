/** Read inert host labels from the nearest shell or standalone control root. */
export const browserLabel = (element: Element, key: string, fallback: string): string => {
  const encoded = element.closest<HTMLElement>("[data-doc-labels]")?.dataset.docLabels
  if (!encoded || encoded.length > 1_048_576) return fallback
  try {
    const labels: unknown = JSON.parse(encoded)
    if (typeof labels !== "object" || labels === null || Array.isArray(labels)) return fallback
    const value = (labels as Record<string, unknown>)[key]
    return typeof value === "string" && value.length <= 4096 ? value : fallback
  } catch {
    return fallback
  }
}
