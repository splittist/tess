import { describe, it, expect } from 'vitest'
import { describeTag, applyOverlayStyles, DEFAULT_NAMESPACE_LABEL } from './highlighting'

describe('highlighting', () => {
  describe('describeTag', () => {
    it('should extract namespace from prefixed tag name', () => {
      const result = describeTag('w:p')
      expect(result.namespace).toBe('w')
      expect(result.localName).toBe('p')
      expect(result.tagName).toBe('w:p')
    })

    it('should handle tags without namespace prefix', () => {
      const result = describeTag('div')
      expect(result.namespace).toBe(DEFAULT_NAMESPACE_LABEL)
      expect(result.localName).toBe('div')
      expect(result.tagName).toBe('div')
    })

    it('should extract namespace from attribute name', () => {
      const result = describeTag('w:id')
      expect(result.namespace).toBe('w')
      expect(result.localName).toBe('id')
      expect(result.tagName).toBe('w:id')
    })

    it('should handle attribute names without namespace', () => {
      const result = describeTag('id')
      expect(result.namespace).toBe(DEFAULT_NAMESPACE_LABEL)
      expect(result.localName).toBe('id')
      expect(result.tagName).toBe('id')
    })
  })

  describe('applyOverlayStyles', () => {
    it('should highlight lines matching element namespace', () => {
      const line = document.createElement('div')
      line.dataset.namespace = 'w'
      line.dataset.elementType = 'p'

      applyOverlayStyles([line], {
        focusNamespace: 'w',
        highlightElement: null,
        dimOtherNamespaces: false,
        allowCombination: true
      })

      expect(line.classList.contains('bg-indigo-50')).toBe(true)
      expect(line.classList.contains('ring-1')).toBe(true)
    })

    it('should highlight lines with matching attribute namespaces', () => {
      const line = document.createElement('div')
      line.dataset.namespace = 'p' // element has different namespace
      line.dataset.elementType = 'para'
      line.dataset.attributeNamespaces = 'w,r' // but attributes have w and r namespaces

      applyOverlayStyles([line], {
        focusNamespace: 'w', // focusing on w namespace
        highlightElement: null,
        dimOtherNamespaces: false,
        allowCombination: true
      })

      // Should be highlighted because one of the attributes has the 'w' namespace
      expect(line.classList.contains('bg-indigo-50')).toBe(true)
      expect(line.classList.contains('ring-1')).toBe(true)
    })

    it('should not highlight lines without matching namespace', () => {
      const line = document.createElement('div')
      line.dataset.namespace = 'p'
      line.dataset.elementType = 'para'
      line.dataset.attributeNamespaces = 'r,v'

      applyOverlayStyles([line], {
        focusNamespace: 'w',
        highlightElement: null,
        dimOtherNamespaces: false,
        allowCombination: true
      })

      expect(line.classList.contains('bg-indigo-50')).toBe(false)
      expect(line.classList.contains('ring-1')).toBe(false)
    })

    it('should dim lines without matching namespace when dimOtherNamespaces is true', () => {
      const matchingLine = document.createElement('div')
      matchingLine.dataset.namespace = 'w'
      matchingLine.dataset.elementType = 'p'

      const nonMatchingLine = document.createElement('div')
      nonMatchingLine.dataset.namespace = 'r'
      nonMatchingLine.dataset.elementType = 'run'

      applyOverlayStyles([matchingLine, nonMatchingLine], {
        focusNamespace: 'w',
        highlightElement: null,
        dimOtherNamespaces: true,
        allowCombination: true
      })

      expect(matchingLine.classList.contains('opacity-50')).toBe(false)
      expect(nonMatchingLine.classList.contains('opacity-50')).toBe(true)
    })

    it('should not dim lines with matching attribute namespace when dimOtherNamespaces is true', () => {
      const matchingLine = document.createElement('div')
      matchingLine.dataset.namespace = 'p'
      matchingLine.dataset.elementType = 'para'
      matchingLine.dataset.attributeNamespaces = 'w,r'

      const nonMatchingLine = document.createElement('div')
      nonMatchingLine.dataset.namespace = 'r'
      nonMatchingLine.dataset.elementType = 'run'

      applyOverlayStyles([matchingLine, nonMatchingLine], {
        focusNamespace: 'w',
        highlightElement: null,
        dimOtherNamespaces: true,
        allowCombination: true
      })

      // matchingLine should not be dimmed because it has an attribute with 'w' namespace
      expect(matchingLine.classList.contains('opacity-50')).toBe(false)
      expect(nonMatchingLine.classList.contains('opacity-50')).toBe(true)
    })
  })
})
