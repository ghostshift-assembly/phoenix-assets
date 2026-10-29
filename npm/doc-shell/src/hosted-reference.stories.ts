import type { Meta, StoryObj } from "@storybook/svelte-vite"
import HostedReference from "./hosted-reference.svelte"
import type { PublicationBinding } from "./types.js"

const expected: PublicationBinding = {
  schema_version: "doc-shell-publication/v1",
  publication_id: "snapshot-1",
  source_view: "view-1",
  graph_position: "position-1",
  locale: "en",
  release: "v1",
  disclosure_surface: "public",
}
const meta: Meta = { title: "DocShell/Hosted publication", component: HostedReference }
export default meta
type Story = StoryObj
export const AdmittedPair: Story = {
  args: {
    expected,
    currentId: "intro",
    presentation: {
      schema_version: "doc-shell/v2",
      publication: expected,
      navigation: [],
      search: [],
      content: {
        intro: [
          {
            tag: "p",
            attrs: {},
            meta: {},
            content: ["Narrative and API from one admitted publication."],
          },
        ],
      },
    },
    openapi: {
      openapi: "3.1.0",
      "x-doc-shell-publication": expected,
      info: { title: "Example API", version: "v1" },
      paths: {},
    },
  },
}
