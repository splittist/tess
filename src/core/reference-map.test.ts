import { describe, it, expect, beforeEach } from 'vitest'
import { createReferenceMap, ReferenceLink } from './reference-map'

describe('reference-map', () => {
  describe('createReferenceMap', () => {
    let refMap: ReturnType<typeof createReferenceMap>

    beforeEach(() => {
      refMap = createReferenceMap()
    })

    it('should track forward references', () => {
      const link: ReferenceLink = {
        sourcePath: 'word/document.xml',
        sourceAttribute: 'w:id',
        sourceValue: '1',
        targetPath: 'word/comments.xml',
        targetAttribute: 'w:id',
        targetValue: '1',
        label: 'comment 1'
      }

      refMap.addReference(link)

      const targets = refMap.getReferencesFrom('word/document.xml', 'w:id', '1')
      expect(targets).toHaveLength(1)
      expect(targets[0].targetPath).toBe('word/comments.xml')
      expect(targets[0].targetAttribute).toBe('w:id')
      expect(targets[0].targetValue).toBe('1')
    })

    it('should track reverse references', () => {
      const link: ReferenceLink = {
        sourcePath: 'word/document.xml',
        sourceAttribute: 'w:id',
        sourceValue: '1',
        targetPath: 'word/comments.xml',
        targetAttribute: 'w:id',
        targetValue: '1',
        label: 'comment 1'
      }

      refMap.addReference(link)

      const sources = refMap.getReferencesTo('word/comments.xml', 'w:id', '1')
      expect(sources).toHaveLength(1)
      expect(sources[0].sourcePath).toBe('word/document.xml')
      expect(sources[0].sourceAttribute).toBe('w:id')
      expect(sources[0].sourceValue).toBe('1')
      expect(sources[0].label).toBe('comment 1')
    })

    it('should handle multiple references from the same source', () => {
      refMap.addReference({
        sourcePath: 'word/document.xml',
        sourceAttribute: 'w:id',
        sourceValue: '1',
        targetPath: 'word/comments.xml',
        targetAttribute: 'w:id',
        targetValue: '1'
      })

      refMap.addReference({
        sourcePath: 'word/document.xml',
        sourceAttribute: 'w:id',
        sourceValue: '1',
        targetPath: 'word/footnotes.xml',
        targetAttribute: 'w:id',
        targetValue: '1'
      })

      const targets = refMap.getReferencesFrom('word/document.xml', 'w:id', '1')
      expect(targets).toHaveLength(2)
    })

    it('should handle multiple references to the same target', () => {
      refMap.addReference({
        sourcePath: 'word/document.xml',
        sourceAttribute: 'w:id',
        sourceValue: '1',
        targetPath: 'word/comments.xml',
        targetAttribute: 'w:id',
        targetValue: '1'
      })

      refMap.addReference({
        sourcePath: 'word/header1.xml',
        sourceAttribute: 'w:id',
        sourceValue: '1',
        targetPath: 'word/comments.xml',
        targetAttribute: 'w:id',
        targetValue: '1'
      })

      const sources = refMap.getReferencesTo('word/comments.xml', 'w:id', '1')
      expect(sources).toHaveLength(2)
    })

    it('should be case-insensitive for attribute names', () => {
      refMap.addReference({
        sourcePath: 'word/document.xml',
        sourceAttribute: 'W:ID',
        sourceValue: '1',
        targetPath: 'word/comments.xml',
        targetAttribute: 'w:id',
        targetValue: '1'
      })

      const targets = refMap.getReferencesFrom('word/document.xml', 'w:id', '1')
      expect(targets).toHaveLength(1)
    })

    it('should return empty array for non-existent references', () => {
      const targets = refMap.getReferencesFrom('word/document.xml', 'w:id', '999')
      expect(targets).toEqual([])

      const sources = refMap.getReferencesTo('word/comments.xml', 'w:id', '999')
      expect(sources).toEqual([])
    })

    it('should clear all references', () => {
      refMap.addReference({
        sourcePath: 'word/document.xml',
        sourceAttribute: 'w:id',
        sourceValue: '1',
        targetPath: 'word/comments.xml',
        targetAttribute: 'w:id',
        targetValue: '1'
      })

      refMap.clear()

      const targets = refMap.getReferencesFrom('word/document.xml', 'w:id', '1')
      expect(targets).toEqual([])
    })
  })
})
