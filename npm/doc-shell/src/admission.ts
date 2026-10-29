import { type JsonProof, jsonProof, objectDigest } from "./artifact-json.js"
import { rendererCapabilities } from "./capabilities.js"
import type { SitePage } from "./types.js"

const digestPattern = /^sha256:[0-9a-f]{64}(?![\s\S])/
const states = new Set(["fallback", "enhanced", "connected"])

/** Enforce capability requirements; original canonical content preserves numeric spellings. */
export const admitPage = (page: SitePage, canonicalContent?: string): void => {
  let proof: JsonProof | undefined
  if (!Array.isArray(page.requirements)) throw new Error("Invalid DocShell page requirements")
  for (const requirement of page.requirements) {
    if (
      !requirement ||
      typeof requirement.feature_id !== "string" ||
      !/^[a-z0-9][a-z0-9._/-]*(?![\s\S])/.test(requirement.feature_id) ||
      typeof requirement["essential?"] !== "boolean" ||
      !Array.isArray(requirement.acceptable_states) ||
      !requirement.acceptable_states.length ||
      new Set(requirement.acceptable_states).size !== requirement.acceptable_states.length ||
      !requirement.acceptable_states.every((state) => states.has(state)) ||
      (requirement.fallback_digest != null &&
        (typeof requirement.fallback_digest !== "string" ||
          !digestPattern.test(requirement.fallback_digest)))
    )
      throw new Error("Invalid DocShell capability requirement")
    const feature = requirement.feature_id
    const capabilities: Readonly<Record<string, { states: readonly string[] }>> =
      rendererCapabilities.features
    if (
      Object.hasOwn(capabilities, feature) &&
      requirement.acceptable_states.some((state) => capabilities[feature]?.states.includes(state))
    )
      continue
    if (requirement["essential?"]) throw new Error(`Unsupported DocShell capability: ${feature}`)
    proof ??= jsonProof(page.content, canonicalContent)
    if (
      requirement.fallback_digest !==
      objectDigest([
        ["content", proof],
        ["feature", jsonProof(feature)],
      ])
    )
      throw new Error(`DocShell fallback digest mismatch: ${feature}`)
  }
}
