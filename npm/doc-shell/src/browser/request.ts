import { isAllowedTryItOrigin, resolveTryItTarget } from "../url.js"

export interface RequestPolicy {
  apiOrigin: string
  allowedOrigins?: readonly string[]
  currentHref?: string
}

export interface AdmittedRequest {
  url: string
  crossOrigin: boolean
  confirmation: string | undefined
  credentials: RequestCredentials
}

export const admitRequest = (operationPath: string, policy: RequestPolicy): AdmittedRequest => {
  const target = resolveTryItTarget(policy.apiOrigin, operationPath, policy.currentHref)
  if (target.crossOrigin && !isAllowedTryItOrigin(target.origin, policy.allowedOrigins ?? [])) {
    throw new Error("request origin is not allowlisted")
  }
  return {
    url: target.url,
    crossOrigin: target.crossOrigin,
    confirmation: target.crossOrigin ? `Send this request to ${target.origin}` : undefined,
    credentials: "same-origin",
  }
}

/** Reads a bounded response and cancels the remaining stream. */
export const readResponseText = async (response: Response, maxBytes = 65536): Promise<string> => {
  if (!response.body) return ""
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ""
  let remaining = maxBytes
  try {
    while (remaining > 0) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()
      const bytes = value.subarray(0, remaining)
      text += decoder.decode(bytes, { stream: true })
      remaining -= bytes.length
    }
    await reader.cancel()
    return `${text}…`
  } finally {
    reader.releaseLock()
  }
}
