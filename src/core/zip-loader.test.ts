import { describe, it, expect } from 'vitest'
import { loadDocxPackage } from './zip-loader'

const DOCX_BASE64 =
  'UEsDBBQAAAAIADF6lVv1VyqnPgAAAEcAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLMJqSxILbazcUlNSyzNKVFwrShJzSvOzM+zVarIzVFScM7PAwqUgFTZKiUWFORkJieWAKX1QbL6djb6EP0AUEsDBBQAAAAIADF6lVthey9DiQAAAPIAAAALAAAAX3JlbHMvLnJlbHONzzsOAiEQBuCrEA6ws1pYGKCy2dZ4AQLDIy6PDBj19lJYrMbCcuaffH9GnHHVPZbcQqyNPdKam+Sh93oEaCZg0m0qFfNIXKGk+xjJQ9Xmqj3Cfp4PQFuDK7E12WIlp8XuOLs8K/5jF+eiwVMxt4S5/6j4uhiyJo9d8nshC/a9ngbLQQn4eFG9AFBLAwQUAAAACAAxepVbHqyiyW8AAACMAAAAEQAAAHdvcmQvZG9jdW1lbnQueG1sRY1LDsIwEEOvgnoApmLBIgpZc42QDG2lzEfJoJTb08CCzbMtW7LvLkt6EbKddircXL9Nq5k6gJZWpNjOoshH95RK0Y5YF+hSs1ZJ2NrGCxW4zPMVKG48Bd/dQ/J7qA5YuGMp4mHYQf3yt4H/f/gAUEsDBBQAAAAIADF6lVvubcObigAAAOgAAAAcAAAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsc42PSwoCMRBErxJygOlR0IUkWbmZrXiBNul8cPIhiaC3N+BmBBcuqwreo8SFVuwhp+ZDaewZ19Qk972XE0DTniK2KRdKY7G5RuwjVgcF9R0dwX6ej1C3DK7ElskWI3ldzIGz66vQP+xsbdB0zvoRKfUfCghxuAcQq6MueSQT8FPupltIHJSAr2PqDVBLAwQUAAAACAAxepVbe5x3tAoAAAAIAAAAFQAAAHdvcmQvbWVkaWEvaW1hZ2UxLmJpbmNgTMrMSyyqBABQSwECFAMUAAAACAAxepVb9Vcqpz4AAABHAAAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIADF6lVthey9DiQAAAPIAAAALAAAAAAAAAAAAAACAAW8AAABfcmVscy8ucmVsc1BLAQIUAxQAAAAIADF6lVserKLJbwAAAIwAAAARAAAAAAAAAAAAAACAASEBAAB3b3JkL2RvY3VtZW50LnhtbFBLAQIUAxQAAAAIADF6lVvubcObigAAAOgAAAAcAAAAAAAAAAAAAACAAb8BAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzUEsBAhQDFAAAAAgAMXqVW3ucd7QKAAAACAAAABUAAAAAAAAAAAAAAIABgwIAAHdvcmQvbWVkaWEvaW1hZ2UxLmJpblBLBQYAAAAABQAFAEYBAADAAgAAAAA='

describe('zip-loader', () => {
  it('loads a DOCX package into memory with XML and binary entries', async () => {
    const buffer = Buffer.from(DOCX_BASE64, 'base64')
    const pkg = await loadDocxPackage(buffer)

    expect(pkg.files.length).toBeGreaterThan(0)
    expect(pkg.byPath['[Content_Types].xml'].text).toContain('<Types>')

    const documentXml = pkg.xmlDocuments['word/document.xml']
    expect(documentXml.text).toContain('<w:document')

    expect(pkg.relationships['_rels/.rels'].rId1.target).toBe('word/document.xml')
    expect(pkg.relationships['word/_rels/document.xml.rels'].rId5.target).toBe('media/image1.bin')

    const image = pkg.byPath['word/media/image1.bin']
    expect(image.metadata.isXml).toBe(false)
    expect(new Uint8Array(image.arrayBuffer)[0]).toBe(0)
  })
})
