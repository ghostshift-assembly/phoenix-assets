import { highlight } from "../highlighter.js"

export const enhance = (source: string, language: string) => highlight(source, language)
