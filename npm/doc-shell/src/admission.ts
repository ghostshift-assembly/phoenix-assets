import { sha256 } from "@noble/hashes/sha2.js"
import { rendererCapabilities } from "./capabilities.js"
import type { SitePage } from "./types.js"

const encoder = new TextEncoder()
const digestPattern = /^sha256:[0-9a-f]{64}$/
const states = new Set(["fallback", "enhanced", "connected"])

const wellFormed = (value: string): boolean => {
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (character.length === 1 && code >= 0xd800 && code <= 0xdfff) return false
  }
  return true
}

// DocShell orders keys by UTF-8 bytes, which differs from UTF-16 sorting.
const compareKeys = (left: string, right: string): number => {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference) return difference
  }
  return a.length - b.length
}

const fallbackDigest = (content: SitePage["content"], feature: string): string => {
  const hash = sha256.create()
  let remaining = 8 * 1024 * 1024
  const append = (value: string) => {
    const bytes = encoder.encode(value)
    remaining -= bytes.length
    if (remaining < 0) throw new Error("DocShell fallback exceeds the 8 MiB admission limit")
    hash.update(bytes)
  }
  const encode = (value: unknown, depth: number): void => {
    if (depth > 256) throw new Error("DocShell fallback exceeds the admission depth limit")
    if (value === null || typeof value === "boolean") append(JSON.stringify(value))
    else if (typeof value === "string" && wellFormed(value)) append(JSON.stringify(value))
    else if (typeof value === "number" && Number.isSafeInteger(value)) append(String(value))
    else if (Array.isArray(value)) {
      append("[")
      for (let index = 0; index < value.length; index++) {
        if (index) append(",")
        encode(value[index], depth + 1)
      }
      append("]")
    } else if (
      typeof value === "object" &&
      value !== null &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value))
    ) {
      append("{")
      Object.keys(value)
        .sort(compareKeys)
        .forEach((key, index) => {
          if (index) append(",")
          encode(key, depth + 1)
          append(":")
          encode((value as Record<string, unknown>)[key], depth + 1)
        })
      append("}")
    } else throw new Error("DocShell fallback cannot reproduce the producer's canonical JSON")
  }
  encode({ content, feature }, 0)
  return `sha256:${Array.from(hash.digest(), (byte) => byte.toString(16).padStart(2, "0")).join("")}`
}

/** Enforce DocShell capability requirements before hosted or static rendering. */
export const admitPage = (page: SitePage): void => {
  if (!Array.isArray(page.requirements)) throw new Error("Invalid DocShell page requirements")
  for (const requirement of page.requirements) {
    if (
      !requirement ||
      typeof requirement.feature_id !== "string" ||
      !/^[a-z0-9][a-z0-9._/-]*$/.test(requirement.feature_id) ||
      typeof requirement["essential?"] !== "boolean" ||
      !Array.isArray(requirement.acceptable_states) ||
      !requirement.acceptable_states.length ||
      new Set(requirement.acceptable_states).size !== requirement.acceptable_states.length ||
      !requirement.acceptable_states.every((state) => states.has(state)) ||
      (requirement.fallback_digest != null && !digestPattern.test(requirement.fallback_digest))
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
    if (requirement.fallback_digest !== fallbackDigest(page.content, feature))
      throw new Error(`DocShell fallback digest mismatch: ${feature}`)
  }
}
