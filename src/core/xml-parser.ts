export interface ParsedXml {
  path?: string
  text: string
  document: Document
}

function normalizeXml(xml: string): string {
  return xml.replace(/\r\n/g, '\n').trim()
}

/**
 * Parse an XML string into both text and DOM representations for downstream consumers.
 */
export function parseXml(xml: string, options: { path?: string; normalizeWhitespace?: boolean } = {}): ParsedXml {
  const normalized = options.normalizeWhitespace === false ? xml : normalizeXml(xml)
  const parser = new DOMParser()
  const document = parser.parseFromString(normalized, 'application/xml')
  const parserError = document.querySelector('parsererror')

  if (parserError) {
    const context = options.path ? ` (${options.path})` : ''
    throw new Error(`Unable to parse XML${context}: ${parserError.textContent ?? 'Unknown parser error'}`)
  }

  return { path: options.path, text: normalized, document }
}

/**
 * Convert a DOM Document back into normalized text to keep string and DOM views aligned.
 */
export function xmlToString(document: Document): string {
  const serializer = new XMLSerializer()
  return normalizeXml(serializer.serializeToString(document))
}
