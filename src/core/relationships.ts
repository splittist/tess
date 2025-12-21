import { parseXml } from './xml-parser'

export interface Relationship {
  id: string
  target: string
  type?: string
  targetMode?: string
  source: string
}

export type RelationshipMap = Record<string, Relationship>

export interface IndexedRelationship extends Relationship {
  resolvedTarget: string
}

export type RelationshipsBySource = Record<string, Record<string, IndexedRelationship>>

function normalizeTargetPath(path: string): string {
  const parts = path.split('/')
  const stack: string[] = []

  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      stack.pop()
    } else {
      stack.push(part)
    }
  }

  return stack.join('/')
}

export function sourcePathFromRelationshipsPath(path: string): string {
  const segments = path.split('/')
  const relsIndex = segments.lastIndexOf('_rels')
  const filename = segments.pop() ?? ''
  const baseName = filename.endsWith('.rels') ? filename.slice(0, -5) : filename
  const folderFromRels = relsIndex === -1 ? null : segments.slice(0, relsIndex).join('/')
  const folder = folderFromRels ?? segments.join('/')

  if (baseName === '.rels' && !folder) return ''
  if (!folder) return baseName
  return `${folder}/${baseName}`
}

export function resolveRelationshipTarget(sourcePath: string, target: string): string {
  if (!target) return ''

  if (target.startsWith('/')) {
    return normalizeTargetPath(target.slice(1))
  }

  const folder = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : ''
  return normalizeTargetPath(`${folder}${target}`)
}

export function buildRelationshipsBySource(relationships: Record<string, RelationshipMap>): RelationshipsBySource {
  const indexed: RelationshipsBySource = {}

  for (const [relsPath, relMap] of Object.entries(relationships)) {
    const sourcePath = sourcePathFromRelationshipsPath(relsPath)
    const targetMap = indexed[sourcePath] ?? (indexed[sourcePath] = {})

    for (const relationship of Object.values(relMap)) {
      const resolvedTarget =
        relationship.targetMode?.toLowerCase() === 'external'
          ? relationship.target
          : resolveRelationshipTarget(sourcePath, relationship.target)

      targetMap[relationship.id] = { ...relationship, resolvedTarget }
    }
  }

  return indexed
}

/**
 * Parse an OPC relationships (.rels) part into a normalized Id -> Target map with source context.
 */
export function parseRelationships(xml: string | Document, source: string): RelationshipMap {
  const document = typeof xml === 'string' ? parseXml(xml, { path: source }).document : xml
  const relationships: RelationshipMap = {}

  for (const relationship of Array.from(document.getElementsByTagName('Relationship'))) {
    const id = relationship.getAttribute('Id') ?? relationship.getAttribute('id')
    const target = relationship.getAttribute('Target') ?? relationship.getAttribute('target')

    if (!id || !target) continue

    relationships[id] = {
      id,
      target,
      type: relationship.getAttribute('Type') ?? relationship.getAttribute('type') ?? undefined,
      targetMode: relationship.getAttribute('TargetMode') ?? relationship.getAttribute('targetMode') ?? undefined,
      source
    }
  }

  return relationships
}
