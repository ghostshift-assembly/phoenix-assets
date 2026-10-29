import {
  byteDigest,
  type JsonProof,
  jsonBytes,
  jsonDigest,
  jsonField,
  jsonItems,
  jsonProof,
  objectDigest,
} from "./artifact-json.js"
import { validateArtifactMedia } from "./artifact-media.js"
import { rendererCapabilities } from "./capabilities.js"
import type { DocAstElement, DocAstNode } from "./types.js"

export type ArtifactState = "fallback" | "enhanced" | "connected"
export type ArtifactRuntime = "browser_js" | "live_transport" | "native_host"
export interface ArtifactBinding {
  anchor: string
  subject_ref: string
  subject_kind: string
  subject_id: string
}
export interface ArtifactVariant {
  id: string
  profile: string
  profile_digest: string
  state: ArtifactState
  media_type: string
  blob_digest: string
  byte_length: number
  asset: string
  runtime: ArtifactRuntime[]
}
export interface ArtifactBlock {
  schema_version: "doc-shell-artifact-block/v1"
  profile: string
  profile_digest: string
  artifact_ref: string
  manifest_digest: string
  caption: string
  description: string
  locale: string
  bindings: ArtifactBinding[]
  variants: ArtifactVariant[]
  acceptable_states: ArtifactState[]
  essential: boolean
  fallback_digest: string
}
export interface ArtifactFeature {
  id: string
  profile: string
  profile_digest: string
  schema_digest: string
  output_mode: "static" | "hosted"
  state: ArtifactState
  media_types: string[]
  runtime: ArtifactRuntime[]
}
export interface ArtifactCapabilities {
  schema_version: "doc-shell-renderer-capabilities/v2"
  renderer_id: string
  renderer_version: string
  output_modes: Array<"static" | "hosted">
  features: ArtifactFeature[]
  [key: string]: unknown
}
export interface ArtifactConstraints {
  output_mode: "static" | "hosted"
  reader_mode?: "web" | "file"
  available_runtime: ArtifactRuntime[]
  forbidden_runtime: ArtifactRuntime[]
  preferences: string[]
  [key: string]: unknown
}
export interface ArtifactCheckedProjection {
  profile: string
  artifact_ref: string
  manifest_digest: string
  subjects: ArtifactBinding[]
  [key: string]: unknown
}
export interface ArtifactSelection {
  status: "available" | "unavailable"
  block_id: string
  profile: string
  profile_digest: string
  artifact_ref: string
  manifest_digest: string
  bindings: ArtifactBinding[]
  fallback_digest: string
  variant: ArtifactVariant | null
  presentation_id?: string
  checked_projection?: ArtifactCheckedProjection
}
export interface ArtifactReceipt {
  schema_version: "doc-shell-artifact-presentation/v1"
  page_digest: string
  descriptor_set_digest: string
  constraints_digest: string
  capabilities: ArtifactCapabilities
  constraints: ArtifactConstraints
  blocks: ArtifactSelection[]
}
export type ArtifactAssets = Record<string, { media_type: string; base64: string }>
export interface ArtifactView {
  id: string
  node: DocAstElement
  block: ArtifactBlock
  selection: ArtifactSelection
  source?: string
  projectionJson?: string
}
export interface ArtifactPage {
  blocks: ReadonlyMap<string, ArtifactView>
  receipt?: ArtifactReceipt
  constraintsJson?: string
  passive: boolean
}
export interface ArtifactProfileBinding {
  profile: string
  profile_digest: string
  schema_digest: string
}
export interface ArtifactProofOptions {
  canonicalContent?: string
  canonicalReceipt?: string
}

type RecordValue = Record<string, unknown>
const states = ["fallback", "enhanced", "connected"]
const runtimes = ["browser_js", "live_transport", "native_host"]
const modes = ["static", "hosted"]
const blockKeys =
  "schema_version profile profile_digest artifact_ref manifest_digest caption description locale bindings variants acceptable_states essential fallback_digest".split(
    " ",
  )
const bindingKeys = ["anchor", "subject_ref", "subject_kind", "subject_id"]
const variantKeys =
  "id profile profile_digest state media_type blob_digest byte_length asset runtime".split(" ")
const featureKeys =
  "id profile profile_digest schema_digest output_mode state media_types runtime".split(" ")
const identityKeys =
  "profile profile_digest artifact_ref manifest_digest bindings fallback_digest".split(" ")
const selectionRequired = ["status", "variant", "block_id", ...identityKeys]
const selectionKeys = [...selectionRequired, "presentation_id", "checked_projection"]
const safeTags = new Set("p span strong em ul ol li dl dt dd code pre br".split(" "))
const encoder = new TextEncoder()
const fail = (reason: string): never => {
  throw new Error(`DocShell artifact admission failed: ${reason}`)
}
const requireValue = (condition: unknown, reason = "invalid record"): void => {
  if (!condition) fail(reason)
}
const record = (value: unknown): RecordValue => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return fail("invalid record")
  const descriptors = Object.getOwnPropertyDescriptors(value)
  requireValue(
    !Object.getOwnPropertySymbols(value).length &&
      Object.values(descriptors).every(
        (field) => field.enumerable && Object.hasOwn(field, "value"),
      ),
  )
  return value as RecordValue
}
const fields = (value: unknown, allowed: readonly string[], required = allowed) => {
  const result = record(value)
  requireValue(
    Object.keys(result).every((key) => allowed.includes(key)) &&
      required.every((key) => Object.hasOwn(result, key)),
  )
  return result
}
const list = (value: unknown, maximum = 1_000_000): unknown[] => {
  if (!Array.isArray(value) || value.length > maximum) return fail("invalid or oversized list")
  return value
}
const text = (value: unknown, maximum = 4096): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  encoder.encode(value).length <= maximum
const digest = (value: unknown) =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}(?![\s\S])/.test(value)
const id = (value: unknown) =>
  typeof value === "string" && /^[a-z][a-z0-9._-]{0,127}(?![\s\S])/.test(value)
const strings = (value: unknown, maximum = 2048) =>
  list(value).every((entry) => text(entry, maximum))
const unique = (values: readonly unknown[]) => new Set(values).size === values.length
const vocabulary = (value: unknown, allowed: readonly string[], nonempty = false) => {
  const values = list(value)
  return (
    (!nonempty || values.length > 0) &&
    unique(values) &&
    values.every((item) => typeof item === "string" && allowed.includes(item))
  )
}
const bindings = (value: unknown): ArtifactBinding[] => {
  const entries = list(value, 64)
  for (const entry of entries) {
    const binding = fields(entry, bindingKeys)
    requireValue(
      id(binding.anchor) &&
        ["subject_ref", "subject_kind", "subject_id"].every((key) => text(binding[key])),
    )
  }
  requireValue(unique(entries.map((entry) => record(entry).anchor)), "duplicate binding anchor")
  return entries as ArtifactBinding[]
}
const variant = (value: unknown): ArtifactVariant => {
  const entry = fields(value, variantKeys)
  requireValue(
    id(entry.id) &&
      text(entry.profile) &&
      text(entry.media_type) &&
      digest(entry.profile_digest) &&
      digest(entry.blob_digest),
  )
  requireValue(
    typeof entry.state === "string" &&
      states.includes(entry.state) &&
      vocabulary(entry.runtime, runtimes),
  )
  requireValue(
    typeof entry.byte_length === "number" &&
      Number.isSafeInteger(entry.byte_length) &&
      entry.byte_length > 0,
  )
  requireValue(
    typeof entry.asset === "string" &&
      entry.asset.length <= 512 &&
      /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*(?![\s\S])/.test(entry.asset) &&
      entry.asset.split("/").every((part) => part !== "." && part !== ".."),
  )
  return entry as unknown as ArtifactVariant
}
const equalBinding = (a: ArtifactBinding, b: ArtifactBinding) =>
  bindingKeys.every((key) => record(a)[key] === record(b)[key])
const equalVariant = (a: ArtifactVariant, b: ArtifactVariant) =>
  variantKeys.every((key) =>
    key === "runtime"
      ? a.runtime.join(",") === b.runtime.join(",")
      : record(a)[key] === record(b)[key],
  )
const sameRuntime = (a: readonly ArtifactRuntime[], b: readonly ArtifactRuntime[]) =>
  [...a].sort().join(",") === [...b].sort().join(",")
const safeFallback = (nodes: unknown): void => {
  for (const node of list(nodes)) {
    if (typeof node === "string") continue
    const entry = record(node)
    const attrs = fields(entry.attrs, ["id"], [])
    requireValue(
      typeof entry.tag === "string" &&
        safeTags.has(entry.tag) &&
        (!Object.hasOwn(attrs, "id") || id(attrs.id)),
      "unsafe fallback",
    )
    requireValue(entry.tag !== "br" || list(entry.content).length === 0, "void fallback content")
    safeFallback(entry.content)
  }
}
const block = (node: DocAstElement): ArtifactBlock => {
  const entry = fields(record(node.meta).artifact, blockKeys)
  requireValue(entry.schema_version === "doc-shell-artifact-block/v1" && id(node.attrs?.id))
  requireValue(
    ["profile", "artifact_ref", "caption", "description", "locale"].every((key) =>
      text(entry[key]),
    ) &&
      ["profile_digest", "manifest_digest", "fallback_digest"].every((key) => digest(entry[key])),
  )
  bindings(entry.bindings)
  const variants = list(entry.variants, 16).map(variant)
  requireValue(
    unique(variants.map((item) => item.id)) &&
      variants.every(
        (item) => item.profile === entry.profile && item.profile_digest === entry.profile_digest,
      ),
  )
  requireValue(
    typeof entry.essential === "boolean" &&
      vocabulary(entry.acceptable_states, states, true) &&
      list(node.content).length > 0,
  )
  safeFallback(node.content)
  return entry as unknown as ArtifactBlock
}
const declaration = (capabilities: unknown, constraints: unknown): void => {
  const caps = record(capabilities)
  const policy = record(constraints)
  requireValue(
    caps.schema_version === "doc-shell-renderer-capabilities/v2" &&
      text(caps.renderer_id, 2048) &&
      text(caps.renderer_version, 2048),
  )
  requireValue(
    vocabulary(caps.output_modes, modes) && list(caps.output_modes).includes(policy.output_mode),
  )
  requireValue(
    !Object.hasOwn(policy, "reader_mode") ||
      (typeof policy.reader_mode === "string" && ["web", "file"].includes(policy.reader_mode)),
  )
  requireValue(
    vocabulary(policy.available_runtime, runtimes) &&
      vocabulary(policy.forbidden_runtime, runtimes) &&
      strings(policy.preferences),
  )
  const features = list(caps.features, 128)
  requireValue(unique(features.map((entry) => record(entry).id)), "duplicate feature ID")
  for (const entry of features) {
    const feature = fields(entry, featureKeys)
    requireValue(
      text(feature.id, 2048) &&
        text(feature.profile, 2048) &&
        digest(feature.profile_digest) &&
        digest(feature.schema_digest),
    )
    requireValue(
      typeof feature.output_mode === "string" &&
        modes.includes(feature.output_mode) &&
        typeof feature.state === "string" &&
        states.includes(feature.state) &&
        strings(feature.media_types) &&
        list(feature.media_types).length > 0 &&
        vocabulary(feature.runtime, runtimes),
    )
  }
}
const selected = (
  selection: ArtifactSelection,
  block: ArtifactBlock,
  receipt: ArtifactReceipt,
): void => {
  if (selection.checked_projection !== undefined) {
    const checked = record(selection.checked_projection)
    requireValue(
      checked.profile === block.profile &&
        checked.artifact_ref === block.artifact_ref &&
        checked.manifest_digest === block.manifest_digest,
      "checked projection identity",
    )
    const subjects = bindings(checked.subjects)
    requireValue(
      block.bindings.every((binding) => subjects.some((subject) => equalBinding(binding, subject))),
      "checked subject membership",
    )
  }
  if (selection.status === "unavailable") {
    requireValue(
      !block.essential &&
        block.acceptable_states.includes("fallback") &&
        selection.variant === null &&
        !Object.hasOwn(selection, "presentation_id"),
      "invalid unavailable presentation",
    )
    return
  }
  requireValue(
    selection.status === "available" &&
      text(selection.presentation_id, 2048) &&
      selection.checked_projection !== undefined,
  )
  const value = variant(selection.variant)
  requireValue(
    block.variants.some((entry) => equalVariant(entry, value)),
    "selected variant identity",
  )
  const feature = receipt.capabilities.features.find(
    (entry) => entry.id === selection.presentation_id,
  )
  requireValue(
    feature &&
      feature.profile === block.profile &&
      feature.profile_digest === block.profile_digest &&
      feature.output_mode === receipt.constraints.output_mode &&
      feature.state === value.state &&
      block.acceptable_states.includes(feature.state) &&
      feature.media_types.includes(value.media_type) &&
      sameRuntime(feature.runtime, value.runtime),
    "selected feature identity",
  )
  requireValue(
    value.runtime.every(
      (runtime) =>
        receipt.constraints.available_runtime.includes(runtime) &&
        !receipt.constraints.forbidden_runtime.includes(runtime),
    ),
    "selected runtime",
  )
  requireValue(
    receipt.constraints.output_mode !== "static" ||
      (value.state !== "connected" && !value.runtime.includes("live_transport")),
    "live static presentation",
  )
}
const scan = (content: unknown): Array<{ node: DocAstElement; path: number[] }> => {
  const blocks: Array<{ node: DocAstElement; path: number[] }> = []
  const anchors: string[] = []
  const walk = (nodes: unknown, path: number[], depth: number): void => {
    const children = list(nodes)
    if (!children.length) return
    requireValue(depth <= 64, "AST depth limit")
    children.forEach((node, index) => {
      if (typeof node === "string") return
      const entry = record(node)
      requireValue(
        typeof entry.tag === "string" &&
          typeof entry.meta === "object" &&
          entry.meta !== null &&
          !Array.isArray(entry.meta),
      )
      const attrs = record(entry.attrs)
      const next = [...path, index]
      if (typeof attrs.id === "string") anchors.push(attrs.id)
      if (entry.tag === "artifact")
        blocks.push({ node: entry as unknown as DocAstElement, path: next })
      walk(entry.content, next, depth + 1)
    })
  }
  walk(content, [], 1)
  requireValue(unique(anchors) && blocks.length <= 256, "duplicate anchor or block limit")
  for (const { node } of blocks)
    requireValue(
      block(node).bindings.every((binding) => anchors.includes(binding.anchor)),
      "missing document anchor",
    )
  return blocks
}
const nodeProof = (root: JsonProof, path: readonly number[]): JsonProof => {
  let proof = root
  for (const [index, position] of path.entries()) {
    if (index) proof = jsonField(proof, "content")
    const child = jsonItems(proof)[position]
    if (!child) return fail("missing AST proof")
    proof = child
  }
  return proof
}
const base64Table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const decodeAsset = (value: string): Uint8Array => {
  requireValue(
    value.length > 0 && value.length <= 44_739_244 && value.length % 4 === 0,
    "asset byte limit",
  )
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0
  for (let index = 0; index < value.length - padding; index++)
    requireValue(base64Table.includes(value[index] ?? "!"), "invalid asset base64")
  const last = base64Table.indexOf(value[value.length - padding - 1] ?? "!")
  requireValue(!padding || (last & (padding === 2 ? 15 : 3)) === 0, "noncanonical asset base64")
  let binary: string
  try {
    binary = atob(value)
  } catch {
    return fail("invalid asset base64")
  }
  requireValue(binary.length <= 33_554_432, "asset byte limit")
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}
const assetRegistry = (assets: unknown): ArtifactAssets => {
  const registry = record(assets)
  const names = Object.keys(registry)
  requireValue(
    names.length <= 4096 &&
      names.every(
        (name) =>
          name.length <= 512 &&
          /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*(?![\s\S])/.test(name) &&
          name.split("/").every((part) => part !== "." && part !== ".."),
      ) &&
      unique(names.map((name) => name.toLowerCase())),
    "asset registry limit or collision",
  )
  let total = 0
  for (const value of Object.values(registry)) {
    const asset = fields(value, ["media_type", "base64"])
    requireValue(
      text(asset.media_type) &&
        typeof asset.base64 === "string" &&
        asset.base64.length <= 44_739_244,
      "invalid asset record",
    )
    const encoded = asset.base64 as string
    requireValue(encoded.length % 4 === 0, "invalid asset base64")
    total += (encoded.length / 4) * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0)
    requireValue(total <= 268_435_456, "aggregate asset byte limit")
  }
  return registry as ArtifactAssets
}

/** Consume an upstream producer-admitted receipt; no callbacks, discovery or renegotiation occur here. */
export const admitArtifactPage = (
  content: DocAstNode[],
  receipt?: ArtifactReceipt | null,
  assets: ArtifactAssets = {},
  options: ArtifactProofOptions = {},
): ArtifactPage => {
  if (receipt == null) {
    const pending: DocAstNode[] = [...content]
    let count = 0
    while (pending.length) {
      requireValue(++count <= 1_000_000, "AST value limit")
      const node = pending.pop()
      if (!node || typeof node === "string") continue
      requireValue(
        !(node.tag === "artifact" && node.meta && Object.hasOwn(node.meta, "artifact")),
        "receipt required",
      )
      if (Array.isArray(node.content)) {
        requireValue(count + pending.length + node.content.length <= 1_000_000, "AST value limit")
        for (const child of node.content) pending.push(child)
      }
    }
    return { blocks: new Map(), passive: false }
  }
  const contentProof = jsonProof(content, options.canonicalContent)
  const receiptProof = jsonProof(receipt, options.canonicalReceipt)
  fields(
    receipt,
    "schema_version page_digest descriptor_set_digest constraints_digest capabilities constraints blocks".split(
      " ",
    ),
  )
  requireValue(
    receipt.schema_version === "doc-shell-artifact-presentation/v1" &&
      [receipt.page_digest, receipt.descriptor_set_digest, receipt.constraints_digest].every(
        digest,
      ),
    "receipt identity",
  )
  declaration(receipt.capabilities, receipt.constraints)
  requireValue(
    jsonDigest(contentProof) === receipt.page_digest &&
      jsonDigest(jsonField(receiptProof, "constraints")) === receipt.constraints_digest,
    "page or constraints digest",
  )
  const nodes = scan(content)
  const selections = list(receipt.blocks, 256) as ArtifactSelection[]
  requireValue(nodes.length === selections.length, "receipt block count")
  const registry = assetRegistry(assets)
  const result = new Map<string, ArtifactView>()
  const verifiedAssets = new Map<
    string,
    { source: string; digest: string; length: number; media: string }
  >()
  for (const [index, { node, path }] of nodes.entries()) {
    const envelope = block(node)
    const selection = selections[index]
    if (!selection) return fail("missing selection")
    fields(selection, selectionKeys, selectionRequired)
    const selectionBindings = bindings(selection.bindings)
    requireValue(
      selection.block_id === node.attrs?.id &&
        identityKeys.every((key) =>
          key === "bindings"
            ? selectionBindings.length === envelope.bindings.length &&
              selectionBindings.every((binding, index) => {
                const expected = envelope.bindings[index]
                return expected && equalBinding(binding, expected)
              })
            : record(selection)[key] === record(envelope)[key],
        ),
      "selection identity",
    )
    const proof = nodeProof(contentProof, path)
    const envelopeProof = jsonField(jsonField(proof, "meta"), "artifact")
    const fallback = objectDigest([
      ..."profile profile_digest artifact_ref manifest_digest bindings caption description locale"
        .split(" ")
        .map((key) => [key, jsonField(envelopeProof, key)] as const),
      ["block_id", jsonField(jsonField(proof, "attrs"), "id")],
      ["fallback", jsonField(proof, "content")],
    ])
    requireValue(fallback === envelope.fallback_digest, "fallback digest")
    selected(selection, envelope, receipt)
    let source: string | undefined
    if (selection.variant) {
      requireValue(
        selection.variant.state === "fallback" && selection.variant.runtime.length === 0,
        "unsupported renderer state",
      )
      const asset = registry[selection.variant.asset]
      requireValue(
        asset && asset.media_type === selection.variant.media_type,
        "selected asset required",
      )
      if (!asset) return fail("selected asset required")
      const cached = verifiedAssets.get(selection.variant.asset)
      if (cached) {
        requireValue(
          cached.digest === selection.variant.blob_digest &&
            cached.length === selection.variant.byte_length &&
            cached.media === selection.variant.media_type,
          "selected asset integrity",
        )
        source = cached.source
      } else {
        const bytes = decodeAsset(asset.base64)
        requireValue(
          bytes.length === selection.variant.byte_length &&
            byteDigest(bytes) === selection.variant.blob_digest,
          "selected asset integrity",
        )
        validateArtifactMedia(asset.media_type, bytes)
        source = `data:${asset.media_type};base64,${asset.base64}`
        verifiedAssets.set(selection.variant.asset, {
          source,
          digest: selection.variant.blob_digest,
          length: bytes.length,
          media: asset.media_type,
        })
      }
    }
    const proofSelection = jsonItems(jsonField(receiptProof, "blocks"))[index]
    const projectionJson =
      selection.checked_projection && proofSelection
        ? jsonBytes(jsonField(proofSelection, "checked_projection"))
        : undefined
    requireValue(
      !projectionJson || encoder.encode(projectionJson).length <= 1_048_576,
      "checked projection byte limit",
    )
    result.set(selection.block_id, {
      id: selection.block_id,
      node,
      block: envelope,
      selection,
      source,
      projectionJson,
    })
  }
  return {
    blocks: result,
    receipt,
    constraintsJson: jsonBytes(jsonField(receiptProof, "constraints")),
    passive:
      !receipt.constraints.available_runtime.includes("browser_js") ||
      receipt.constraints.forbidden_runtime.includes("browser_js"),
  }
}

/** Declare only the passive formats and fallback state this renderer actually implements. */
export const artifactCapabilities = (
  profiles: readonly ArtifactProfileBinding[],
  mode: "static" | "hosted" = "static",
): ArtifactCapabilities => {
  jsonProof(profiles)
  requireValue(profiles.length <= 128 && modes.includes(mode), "profile or output-mode limit")
  const features = [...profiles]
    .sort((a, b) => (a.profile < b.profile ? -1 : a.profile > b.profile ? 1 : 0))
    .map((profile) => {
      fields(profile, ["profile", "profile_digest", "schema_digest"])
      requireValue(
        text(profile.profile, 2048) &&
          digest(profile.profile_digest) &&
          digest(profile.schema_digest),
        "profile binding",
      )
      return {
        id: `still/${profile.profile_digest.slice(7)}`,
        profile: profile.profile,
        profile_digest: profile.profile_digest,
        schema_digest: profile.schema_digest,
        output_mode: mode,
        state: "fallback" as const,
        media_types: ["image/svg+xml", "image/png"],
        runtime: [],
      }
    })
  requireValue(
    unique(profiles.map((profile) => profile.profile)) &&
      unique(features.map((feature) => feature.id)),
    "duplicate profile",
  )
  return {
    schema_version: "doc-shell-renderer-capabilities/v2",
    renderer_id: rendererCapabilities.renderer_id,
    renderer_version: rendererCapabilities.renderer_version,
    output_modes: [mode],
    features,
  }
}
