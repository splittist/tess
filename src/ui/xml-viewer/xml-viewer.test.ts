import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createXmlViewer } from './xml-viewer'
import { RelationshipsBySource } from '../../core/relationships'
import { createReferenceMap } from '../../core/reference-map'

describe('xml-viewer', () => {
  describe('createXmlViewer', () => {
    it('should render simple XML with opening and closing tags', () => {
      const xml = '<root><child>content</child></root>'
      const viewer = createXmlViewer({ xml })

      expect(viewer.element).toBeTruthy()
      expect(viewer.element.textContent).toContain('root')
      expect(viewer.element.textContent).toContain('child')
      expect(viewer.element.textContent).toContain('content')
    })

    it('should show parse error for invalid XML', () => {
      const xml = '<root><unclosed>'
      const viewer = createXmlViewer({ xml })

      expect(viewer.element.textContent).toContain('Parse error')
    })

    it('should enable line wrapping with hanging indent', () => {
      const xml = '<root attribute="very long attribute value that should wrap when displayed in the viewer"><child>content</child></root>'
      const viewer = createXmlViewer({ xml })
      document.body.appendChild(viewer.element)

      // Find code elements that contain the XML content
      const codeElements = viewer.element.querySelectorAll('.font-mono')
      expect(codeElements.length).toBeGreaterThan(0)

      // Verify that marginLeft is applied for continuation line indent
      const hasMarginLeft = Array.from(codeElements).some((element) =>
        (element as HTMLElement).style.marginLeft === '54px'
      )
      expect(hasMarginLeft).toBe(true)
    })

    it('should keep attributes together when wrapping', () => {
      const xml = '<root foo="bar" baz="qux" lorem="ipsum" dolor="sit" amet="consectetur"><child>content</child></root>'
      const viewer = createXmlViewer({ xml })
      document.body.appendChild(viewer.element)

      // Find attribute containers - they should have inline-block class to prevent breaking
      const attributeContainers = viewer.element.querySelectorAll('.whitespace-nowrap')
      expect(attributeContainers.length).toBeGreaterThan(0)

      // Verify they have inline-block class
      const hasInlineBlock = Array.from(attributeContainers).some((element) =>
        element.classList.contains('inline-block')
      )
      expect(hasInlineBlock).toBe(true)
    })

    describe('collapse/expand functionality', () => {
      let viewer: ReturnType<typeof createXmlViewer>
      
      beforeEach(() => {
        const xml = '<root><parent><child>text</child></parent></root>'
        viewer = createXmlViewer({ xml })
        document.body.appendChild(viewer.element)
      })

      it('should have toggle buttons for elements with children', () => {
        const toggleButtons = viewer.element.querySelectorAll('button[title="Collapse element"]')
        expect(toggleButtons.length).toBeGreaterThan(0)
      })

      it('should hide children and closing tag when collapsed', () => {
        // Get the element container (has class 'space-y-0')
        const container = viewer.element.querySelector('.space-y-0') as HTMLDivElement
        expect(container).toBeTruthy()
        
        // The container has 3 children: openLine, childrenWrapper, closeLine
        const children = Array.from(container.children) as HTMLElement[]
        expect(children.length).toBe(3)

        const openLine = children[0] as HTMLDivElement
        const toggleButton = openLine.querySelector('button') as HTMLButtonElement
        expect(toggleButton).toBeTruthy()
        const childrenWrapper = children[1] as HTMLDivElement
        const closingLine = children[2] as HTMLDivElement
        
        expect(childrenWrapper).toBeTruthy()
        expect(closingLine).toBeTruthy()
        
        // Initially, children and closing tag should be visible
        expect(childrenWrapper.classList.contains('hidden')).toBe(false)
        expect(closingLine.classList.contains('hidden')).toBe(false)
        
        // Click to collapse
        toggleButton.click()
        
        // After collapse, both children and closing tag should be hidden
        expect(childrenWrapper.classList.contains('hidden')).toBe(true)
        expect(closingLine.classList.contains('hidden')).toBe(true)
        expect(toggleButton.textContent).toBe('▸')
      })

      it('should show children and closing tag when expanded after collapse', () => {
        const container = viewer.element.querySelector('.space-y-0') as HTMLDivElement
        const openLine = container.firstElementChild as HTMLElement
        const toggleButton = openLine.querySelector('button') as HTMLButtonElement
        const children = Array.from(container.children) as HTMLElement[]
        const childrenWrapper = children[1] as HTMLDivElement
        const closingLine = children[2] as HTMLDivElement
        
        // Collapse first
        toggleButton.click()
        expect(childrenWrapper.classList.contains('hidden')).toBe(true)
        expect(closingLine.classList.contains('hidden')).toBe(true)
        
        // Expand again
        toggleButton.click()
        
        // After expand, both children and closing tag should be visible
        expect(childrenWrapper.classList.contains('hidden')).toBe(false)
        expect(closingLine.classList.contains('hidden')).toBe(false)
        expect(toggleButton.textContent).toBe('▾')
      })

      it('should update button title when toggling', () => {
        const openLine = viewer.element.querySelector('.space-y-0')?.firstElementChild as HTMLElement
        const toggleButton = openLine.querySelector('button') as HTMLButtonElement
        
        expect(toggleButton.title).toBe('Collapse element')
        
        toggleButton.click()
        expect(toggleButton.title).toBe('Expand element')
        
        toggleButton.click()
        expect(toggleButton.title).toBe('Collapse element')
      })
    })

    it('detects and navigates relationship references', () => {
      const relationshipsBySource: RelationshipsBySource = {
        'word/document.xml': {
          rId1: {
            id: 'rId1',
            target: 'media/image1.png',
            resolvedTarget: 'word/media/image1.png',
            source: 'word/_rels/document.xml.rels',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
          }
        }
      }

      const xml = '<root xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><rel r:id="rId1" /></root>'
      const onReferenceNavigate = vi.fn()
      const viewer = createXmlViewer({
        xml,
        path: 'word/document.xml',
        relationshipsBySource,
        onReferenceNavigate
      })

      const reference = viewer.element.querySelector('button[title^=\"Open rId1\"]') as HTMLButtonElement
      expect(reference).toBeTruthy()

      reference.click()
      expect(onReferenceNavigate).toHaveBeenCalledWith({
        sourcePath: 'word/document.xml',
        targetPath: 'word/media/image1.png',
        scrollTarget: undefined
      })
    })

    it('detects and navigates comment references', () => {
      const relationshipsBySource: RelationshipsBySource = {
        'word/document.xml': {
          rId1: {
            id: 'rId1',
            target: 'comments.xml',
            resolvedTarget: 'word/comments.xml',
            source: 'word/_rels/document.xml.rels',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments'
          }
        }
      }

      const xml = '<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:commentRangeStart w:id="1" /></root>'
      const onReferenceNavigate = vi.fn()
      const viewer = createXmlViewer({
        xml,
        path: 'word/document.xml',
        relationshipsBySource,
        onReferenceNavigate
      })

      const reference = viewer.element.querySelector('button[title^=\"Open comment\"]') as HTMLButtonElement
      expect(reference).toBeTruthy()
      expect(reference.title).toBe('Open comment 1')

      reference.click()
      expect(onReferenceNavigate).toHaveBeenCalledWith({
        sourcePath: 'word/document.xml',
        targetPath: 'word/comments.xml',
        scrollTarget: { attribute: 'w:id', value: '1' }
      })
    })

    it('detects and navigates footnote references', () => {
      const relationshipsBySource: RelationshipsBySource = {
        'word/document.xml': {
          rId1: {
            id: 'rId1',
            target: 'footnotes.xml',
            resolvedTarget: 'word/footnotes.xml',
            source: 'word/_rels/document.xml.rels',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes'
          }
        }
      }

      const xml = '<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnoteReference w:id="2" /></root>'
      const onReferenceNavigate = vi.fn()
      const viewer = createXmlViewer({
        xml,
        path: 'word/document.xml',
        relationshipsBySource,
        onReferenceNavigate
      })

      const reference = viewer.element.querySelector('button[title^=\"Open footnote\"]') as HTMLButtonElement
      expect(reference).toBeTruthy()
      expect(reference.title).toBe('Open footnote 2')

      reference.click()
      expect(onReferenceNavigate).toHaveBeenCalledWith({
        sourcePath: 'word/document.xml',
        targetPath: 'word/footnotes.xml',
        scrollTarget: { attribute: 'w:id', value: '2' }
      })
    })

    it('detects and navigates endnote references', () => {
      const relationshipsBySource: RelationshipsBySource = {
        'word/document.xml': {
          rId1: {
            id: 'rId1',
            target: 'endnotes.xml',
            resolvedTarget: 'word/endnotes.xml',
            source: 'word/_rels/document.xml.rels',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes'
          }
        }
      }

      const xml = '<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:endnoteReference w:id="3" /></root>'
      const onReferenceNavigate = vi.fn()
      const viewer = createXmlViewer({
        xml,
        path: 'word/document.xml',
        relationshipsBySource,
        onReferenceNavigate
      })

      const reference = viewer.element.querySelector('button[title^=\"Open endnote\"]') as HTMLButtonElement
      expect(reference).toBeTruthy()
      expect(reference.title).toBe('Open endnote 3')

      reference.click()
      expect(onReferenceNavigate).toHaveBeenCalledWith({
        sourcePath: 'word/document.xml',
        targetPath: 'word/endnotes.xml',
        scrollTarget: { attribute: 'w:id', value: '3' }
      })
    })

    it('detects and navigates bookmark references', () => {
      const xml = '<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:hyperlink w:anchor="bookmark1" /></root>'
      const onReferenceNavigate = vi.fn()
      const viewer = createXmlViewer({
        xml,
        path: 'word/document.xml',
        onReferenceNavigate
      })

      const reference = viewer.element.querySelector('button[title^=\"Open bookmark\"]') as HTMLButtonElement
      expect(reference).toBeTruthy()
      expect(reference.title).toBe('Open bookmark bookmark1')

      reference.click()
      expect(onReferenceNavigate).toHaveBeenCalledWith({
        sourcePath: 'word/document.xml',
        targetPath: 'word/document.xml',
        scrollTarget: { attribute: 'name', value: 'bookmark1' }
      })
    })

    it('scrolls to anchors when requested', () => {
      const xml = '<root id=\"root\"><child id=\"target\">text</child></root>'
      const viewer = createXmlViewer({ xml, path: 'word/document.xml' })

      const scrolled = viewer.scrollToAnchor({ attribute: 'id', value: 'target' })
      expect(scrolled).toBe(true)
    })

    it('supports bidirectional navigation with reference map', () => {
      const relationshipsBySource: RelationshipsBySource = {
        'word/document.xml': {
          rId1: {
            id: 'rId1',
            target: 'comments.xml',
            resolvedTarget: 'word/comments.xml',
            source: 'word/_rels/document.xml.rels',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments'
          }
        }
      }

      const refMap = createReferenceMap()
      const onReferenceNavigate = vi.fn()

      // First, render the source document with a comment reference
      const sourceXml = '<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:commentRangeStart w:id="1" /></root>'
      const sourceViewer = createXmlViewer({
        xml: sourceXml,
        path: 'word/document.xml',
        relationshipsBySource,
        referenceMap: refMap,
        onReferenceNavigate
      })

      // Check that the forward reference is clickable
      const forwardRef = sourceViewer.element.querySelector('button[title^=\"Open comment\"]') as HTMLButtonElement
      expect(forwardRef).toBeTruthy()

      // Now render the target document
      const targetXml = '<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="1"><w:p><w:t>Comment text</w:t></w:p></w:comment></root>'
      const targetViewer = createXmlViewer({
        xml: targetXml,
        path: 'word/comments.xml',
        referenceMap: refMap,
        onReferenceNavigate
      })

      // Check that the reverse reference is clickable (target back to source)
      const reverseRef = targetViewer.element.querySelector('button[class*=\"text-blue-\"]') as HTMLButtonElement
      expect(reverseRef).toBeTruthy()
      expect(reverseRef.textContent).toContain('1')

      // Click the reverse reference
      reverseRef.click()
      expect(onReferenceNavigate).toHaveBeenCalledWith({
        sourcePath: 'word/comments.xml',
        targetPath: 'word/document.xml',
        scrollTarget: { attribute: 'w:id', value: '1' }
      })
    })
  })
})
