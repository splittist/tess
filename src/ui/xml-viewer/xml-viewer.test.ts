import { describe, it, expect, beforeEach } from 'vitest'
import { createXmlViewer } from './xml-viewer'

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

    describe('collapse/expand functionality', () => {
      let viewer: ReturnType<typeof createXmlViewer>
      
      beforeEach(() => {
        const xml = '<root><parent><child>text</child></parent></root>'
        viewer = createXmlViewer({ xml })
        document.body.appendChild(viewer.element)
      })

      it('should have toggle buttons for elements with children', () => {
        const toggleButtons = viewer.element.querySelectorAll('button')
        expect(toggleButtons.length).toBeGreaterThan(0)
      })

      it('should hide children and closing tag when collapsed', () => {
        const toggleButton = viewer.element.querySelector('button') as HTMLButtonElement
        expect(toggleButton).toBeTruthy()
        
        // Get the element container (has class 'space-y-0')
        const container = viewer.element.querySelector('.space-y-0') as HTMLDivElement
        expect(container).toBeTruthy()
        
        // The container has 3 children: openLine, childrenWrapper, closeLine
        const children = Array.from(container.children) as HTMLElement[]
        expect(children.length).toBe(3)
        
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
        const toggleButton = viewer.element.querySelector('button') as HTMLButtonElement
        const container = viewer.element.querySelector('.space-y-0') as HTMLDivElement
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
        const toggleButton = viewer.element.querySelector('button') as HTMLButtonElement
        
        expect(toggleButton.title).toBe('Collapse element')
        
        toggleButton.click()
        expect(toggleButton.title).toBe('Expand element')
        
        toggleButton.click()
        expect(toggleButton.title).toBe('Collapse element')
      })
    })
  })
})
