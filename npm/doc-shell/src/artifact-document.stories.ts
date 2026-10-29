import type { Meta, StoryObj } from "@storybook/svelte-vite"
import corpus from "../test/fixtures/artifact-conformance-v1.json"
import ArtifactDocument from "./artifact-document.svelte"
import type { ArtifactReceipt } from "./artifacts.js"
import type { DocAstNode } from "./types.js"

const meta: Meta = { title: "DocShell/Verified artifact document", component: ArtifactDocument }
export default meta
type Story = StoryObj
const input = corpus.cases[0]
if (!input) throw new Error("Missing artifact story fixture")
export const Verified: Story = {
  args: {
    nodes: input.content as DocAstNode[],
    receipt: input.receipt as ArtifactReceipt,
    canonicalContent: input.canonical_content,
    assets: Object.fromEntries(
      input.assets.map((asset) => [
        asset.path,
        { media_type: asset.media_type, base64: asset.base64 },
      ]),
    ),
  },
}
