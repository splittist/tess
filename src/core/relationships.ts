import { parseXml } from './xml-parser'

export interface Relationship {
  id: string
  target: string
  type?: string
  targetMode?: string
  source: string
}

export type RelationshipMap = Record<string, Relationship>

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
