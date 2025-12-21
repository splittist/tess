import { describe, it, expect } from 'vitest'
import { parseXml, xmlToString } from './xml-parser'

const sampleXml = `<?xml version="1.0"?>
<root>
  <child attribute="value">text</child>
</root>`

describe('xml-parser', () => {
  it('parses XML into text and DOM representations', () => {
    const parsed = parseXml(sampleXml, { path: 'root.xml' })

    expect(parsed.text).toContain('<child attribute="value">text</child>')
    expect(parsed.document.querySelector('child')?.textContent).toBe('text')
  })

  it('throws a descriptive error for invalid XML', () => {
    expect(() => parseXml('<root><bad></root>', { path: 'bad.xml' })).toThrow(/Unable to parse XML/)
  })

  it('round-trips DOM back to normalized XML text', () => {
    const parsed = parseXml(sampleXml)
    const serialized = xmlToString(parsed.document)

    expect(serialized.startsWith('<root>')).toBe(true)
    expect(serialized.includes('attribute="value"')).toBe(true)
  })
})
