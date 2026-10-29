import type { SearchFilters, SearchRecord } from "./types.js"

const normalize = (value: string) => value.normalize("NFC").toLocaleLowerCase("und")

const audienceMatches = (record: SearchRecord, expected: string | string[]) => {
  const actual = Array.isArray(record.audience) ? record.audience : [record.audience]
  const values = Array.isArray(expected) ? expected : [expected]
  return values.every((value) => actual.includes(value))
}

const filterMatches = (record: SearchRecord, filters: SearchFilters) =>
  Object.entries(filters).every(([name, value]) => {
    if (value === undefined) return true
    if (name === "tag") return record.tags.includes(String(value))
    if (name === "audience") return audienceMatches(record, value)
    return record[name as keyof SearchRecord] === value
  })

const fieldScore = (value: string | null | undefined, needle: string, weight: number) =>
  value && normalize(value).includes(needle) ? weight : 0

export const querySearchRecords = (
  records: readonly SearchRecord[],
  query: string,
  filters: SearchFilters = {},
  limit = 20,
): SearchRecord[] => {
  const needle = normalize(query)
  return records
    .filter((record) => filterMatches(record, filters))
    .map((record) => ({
      record,
      score:
        needle === ""
          ? 1
          : fieldScore(record.title, needle, 4) +
            fieldScore(record.section, needle, 2) +
            fieldScore(record.text, needle, 1),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.record.route.localeCompare(right.record.route) ||
        left.record.id.localeCompare(right.record.id),
    )
    .slice(0, limit)
    .map(({ record }) => record)
}

export interface PagefindResult {
  id?: string
  url: string
  meta: Record<string, string>
  excerpt: string
  filters?: Record<string, string[]>
}

interface PagefindSearchResult {
  results: Array<{ data: () => Promise<PagefindResult> }>
}

export interface PagefindApi {
  search: (
    query: string,
    options?: { filters?: Record<string, string | string[]> },
  ) => Promise<PagefindSearchResult>
}

export interface PagefindContract {
  schema_version: "doc-shell-search-query/v1"
  algorithm: "pagefind/v1"
  path: string
  indexes?: Record<string, string>
}

export type PagefindModuleLoader = (path: string) => Promise<unknown>

const isPagefindApi = (value: unknown): value is PagefindApi =>
  typeof value === "object" && value !== null && typeof (value as PagefindApi).search === "function"

export const admitPagefindContract = (
  value: unknown,
  origin = window.location.origin,
): PagefindContract | undefined => {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as Record<string, unknown>).schema_version !== "doc-shell-search-query/v1" ||
    (value as Record<string, unknown>).algorithm !== "pagefind/v1"
  )
    return undefined

  const path = (value as Record<string, unknown>).path
  const indexes = (value as Record<string, unknown>).indexes
  if (!safeIndexPath(path, origin)) return undefined
  if (indexes !== undefined) {
    if (
      typeof indexes !== "object" ||
      indexes === null ||
      Array.isArray(indexes) ||
      Object.keys(indexes).length === 0 ||
      Object.keys(indexes).length > 256 ||
      Object.entries(indexes).some(
        ([locale, index]) => !locale || locale.length > 256 || typeof index !== "string",
      )
    )
      return undefined
    try {
      const normalized = Object.fromEntries(
        Object.entries(indexes).map(([locale, index]) => {
          const url = new URL(index as string, new URL(path, origin))
          if (
            url.origin !== origin ||
            url.search ||
            url.hash ||
            !safeIndexPath(url.pathname, origin)
          )
            throw new Error("Invalid locale index")
          return [locale, url.pathname]
        }),
      )
      return { ...(value as PagefindContract), indexes: normalized }
    } catch {
      return undefined
    }
  }

  return value as PagefindContract
}

const safeIndexPath = (path: unknown, origin: string): path is string => {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return false

  try {
    const url = new URL(path, origin)
    if (
      url.origin !== origin ||
      url.pathname !== path ||
      url.search !== "" ||
      url.hash !== "" ||
      path.split("/").some((segment) => segment === "." || segment === "..")
    )
      return false
  } catch {
    return false
  }
  return true
}

export const loadPagefindModule: PagefindModuleLoader = async (path) =>
  import(/* @vite-ignore */ path)

export const createContractPagefindSearch = (
  value: unknown,
  load: PagefindModuleLoader = loadPagefindModule,
  origin = window.location.origin,
) => {
  const contract = admitPagefindContract(value, origin)
  if (!contract) return undefined

  const indexPaths = contract.indexes ?? { "": contract.path }
  const searches = new Map(
    Object.entries(indexPaths).map(([locale, path]) => [
      locale,
      createPagefindSearch(async () => {
        const module = await load(path)
        if (!isPagefindApi(module)) throw new Error("Invalid Pagefind browser module")
        return module
      }),
    ]),
  )
  return async (query: string, filters: SearchFilters = {}): Promise<PagefindResult[]> => {
    const selected = filters.locale
      ? [searches.get(filters.locale) ?? searches.get("")].filter((search) => search !== undefined)
      : [...searches.values()]
    return (await Promise.all(selected.map((search) => search(query, filters)))).flat()
  }
}

export const createPagefindSearch = (load: () => Promise<PagefindApi>) => {
  let api: Promise<PagefindApi> | undefined

  return async (query: string, filters: SearchFilters = {}): Promise<PagefindResult[]> => {
    api ??= load().catch((error) => {
      api = undefined
      throw error
    })
    const search = await api
    const result = await search.search(query, {
      filters: Object.fromEntries(
        Object.entries(filters).filter(
          (entry): entry is [string, string | string[]] => entry[1] !== undefined,
        ),
      ),
    })
    const records = await Promise.all(result.results.map((item) => item.data()))
    return records.map((record) => ({
      ...record,
      id: record.id ?? record.meta.record_id,
      url: record.meta.route ?? record.url,
    }))
  }
}
