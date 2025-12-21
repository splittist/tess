import { describe, it, expect } from 'vitest'
import {
  buildRelationshipsBySource,
  parseRelationships,
  resolveRelationshipTarget,
  sourcePathFromRelationshipsPath
} from './relationships'

const xml = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="type-a" Target="/doc.xml" />
  <Relationship Id="rId2" Type="type-b" Target="/media/image.png" TargetMode="External" />
</Relationships>`

describe('relationships', () => {
  it('creates an Id -> Target map with context', () => {
    const rels = parseRelationships(xml, '_rels/.rels')

    expect(rels.rId1).toEqual({ id: 'rId1', target: '/doc.xml', type: 'type-a', targetMode: undefined, source: '_rels/.rels' })
    expect(rels.rId2).toEqual({ id: 'rId2', target: '/media/image.png', type: 'type-b', targetMode: 'External', source: '_rels/.rels' })
  })

  it('derives source path from rels files', () => {
    expect(sourcePathFromRelationshipsPath('_rels/.rels')).toBe('')
    expect(sourcePathFromRelationshipsPath('word/_rels/document.xml.rels')).toBe('word/document.xml')
    expect(sourcePathFromRelationshipsPath('customXml/item1.xml.rels')).toBe('customXml/item1.xml')
  })

  it('resolves relationship targets relative to the source path', () => {
    expect(resolveRelationshipTarget('word/document.xml', 'media/image.png')).toBe('word/media/image.png')
    expect(resolveRelationshipTarget('word/document.xml', '/customXml/item1.xml')).toBe('customXml/item1.xml')
    expect(resolveRelationshipTarget('word/header1.xml', '../media/image2.png')).toBe('media/image2.png')
  })

  it('builds a map of relationships keyed by source path with resolved targets', () => {
    const rels = parseRelationships(xml, 'word/_rels/document.xml.rels')
    const index = buildRelationshipsBySource({ 'word/_rels/document.xml.rels': rels })

    expect(index['word/document.xml'].rId1.resolvedTarget).toBe('doc.xml')
    expect(index['word/document.xml'].rId2.resolvedTarget).toBe('/media/image.png')
  })
})
