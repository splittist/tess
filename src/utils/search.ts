import { PackageModel } from '../core/zip-loader'

export interface SearchOptions {
  caseSensitive?: boolean
  maxResults?: number
}

export interface TextMatch {
  lineNumber: number
  start: number
  end: number
  line: string
}

export interface PackageSearchResult extends TextMatch {
  path: string
  snippet: string
}

function normalize(text: string, caseSensitive: boolean): string {
  return caseSensitive ? text : text.toLowerCase()
}

function buildSnippet(line: string, start: number, end: number, radius = 50): string {
  const prefixStart = Math.max(0, start - radius)
  const suffixEnd = Math.min(line.length, end + radius)

  const prefix = prefixStart > 0 ? `…${line.slice(prefixStart, start)}` : line.slice(0, start)
  const match = line.slice(start, end)
  const suffix = suffixEnd < line.length ? `${line.slice(end, suffixEnd)}…` : line.slice(end)

  return `${prefix}${match}${suffix}`
}

export function findMatchesInLines(lines: string[], query: string, options: SearchOptions = {}): TextMatch[] {
  if (!query) return []

  const normalizedQuery = normalize(query, options.caseSensitive ?? false)
  const matches: TextMatch[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const normalizedLine = normalize(line, options.caseSensitive ?? false)

    let index = normalizedLine.indexOf(normalizedQuery)
    while (index !== -1) {
      const match: TextMatch = {
        lineNumber: i + 1,
        start: index,
        end: index + query.length,
        line
      }

      matches.push(match)
      if (options.maxResults && matches.length >= options.maxResults) {
        return matches
      }

      index = normalizedLine.indexOf(normalizedQuery, index + query.length || index + 1)
    }
  }

  return matches
}

export function findMatchesInText(text: string, query: string, options: SearchOptions = {}): TextMatch[] {
  const lines = text.split(/\r?\n/)
  return findMatchesInLines(lines, query, options)
}

export function searchPackageEntries(model: PackageModel, query: string, options: SearchOptions = {}): PackageSearchResult[] {
  const results: PackageSearchResult[] = []

  for (const file of model.files) {
    if (!file.text) continue

    const matches = findMatchesInText(file.text, query, options)
    for (const match of matches) {
      results.push({
        ...match,
        path: file.metadata.path,
        snippet: buildSnippet(match.line, match.start, match.end)
      })

      if (options.maxResults && results.length >= options.maxResults) {
        return results
      }
    }
  }

  return results
}
