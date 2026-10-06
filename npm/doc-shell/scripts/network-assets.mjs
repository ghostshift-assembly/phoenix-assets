const networkAssetPatterns = [
  /\b(?:import\s*(?:\(\s*)?|from\s*)["'`](?:https?:)?\/\//i,
  /\b(?:fetch|importScripts|Worker|SharedWorker)\s*\(\s*["'`](?:https?:)?\/\//i,
  /<(?:script|link|img|source|video|audio|iframe|object|embed)\b[^>]*\b(?:src|srcset|href|poster|data)\s*=\s*["']?(?:https?:)?\/\//i,
  /\burl\s*\(\s*["']?(?:https?:)?\/\//i,
  /@import\s*["'](?:https?:)?\/\//i,
]

/** @param {string} source */
export function hasNetworkAssetReference(source) {
  return networkAssetPatterns.some((pattern) => pattern.test(source))
}
