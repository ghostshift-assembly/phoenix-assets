import type { Meta, StoryObj } from "@storybook/svelte-vite"
import Tabs from "./tabs.svelte"

const meta: Meta = { title: "DocShell/Tabs", component: Tabs }
export default meta
type Story = StoryObj

export const Default: Story = {
  args: {
    title: "Documentation sections",
    nodes: [
      {
        tag: "div",
        attrs: { title: "Overview" },
        content: [{ tag: "p", content: ["A short introduction to the documented feature."] }],
      },
      {
        tag: "div",
        attrs: { title: "Reference" },
        content: [{ tag: "p", content: ["Reference information for the same feature."] }],
      },
    ],
  },
}
