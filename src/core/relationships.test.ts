import { describe, it, expect } from 'vitest'
import { parseRelationships } from './relationships'

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
})
