import JSZip from './jszip-lite'
import { parseRelationships, RelationshipMap } from './relationships'
import { parseXml, ParsedXml } from './xml-parser'

export interface PackageFileMetadata {
  path: string
  name: string
  folder: string
  extension: string
  isXml: boolean
  lastModified?: Date
  size: number
}

export interface PackageFile {
  metadata: PackageFileMetadata
  arrayBuffer: ArrayBuffer
  text?: string
}

export interface PackageModel {
  files: PackageFile[]
  byPath: Record<string, PackageFile>
  xmlDocuments: Record<string, ParsedXml>
  relationships: Record<string, RelationshipMap>
}

const decoder = new TextDecoder()
const xmlExtensions = new Set(['.xml', '.rels'])

function getExtension(path: string): string {
  const index = path.lastIndexOf('.')
  return index >= 0 ? path.slice(index).toLowerCase() : ''
}

function getFolder(path: string): string {
  const lastSlash = path.lastIndexOf('/')
  if (lastSlash === -1) return ''
  return path.slice(0, lastSlash)
}

function decodeText(buffer: ArrayBuffer): string {
  return decoder.decode(new Uint8Array(buffer))
}

/**
 * Load a DOCX/OPC zip package into memory with XML and binary views for each entry.
 */
export async function loadDocxPackage(input: ArrayBuffer | Uint8Array | Blob): Promise<PackageModel> {
  const zip = await JSZip.loadAsync(input)
  const files: PackageFile[] = []
  const xmlDocuments: Record<string, ParsedXml> = {}
  const relationships: Record<string, RelationshipMap> = {}

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue

    const arrayBuffer = (await entry.async('arraybuffer')) as ArrayBuffer
    const path = entry.name
    const extension = getExtension(path)
    const isXml = xmlExtensions.has(extension)
    const text = isXml ? decodeText(arrayBuffer) : undefined
    const metadata: PackageFileMetadata = {
      path,
      name: path.split('/').pop() ?? path,
      folder: getFolder(path),
      extension,
      isXml,
      lastModified: entry.date,
      size: arrayBuffer.byteLength
    }

    const file: PackageFile = { metadata, arrayBuffer, text }
    files.push(file)

    if (isXml && text !== undefined) {
      const parsed = parseXml(text, { path })
      xmlDocuments[path] = parsed

      if (path.toLowerCase().endsWith('.rels')) {
        relationships[path] = parseRelationships(parsed.document, path)
      }
    }
  }

  files.sort((a, b) => a.metadata.path.localeCompare(b.metadata.path))

  const byPath = Object.fromEntries(files.map((file) => [file.metadata.path, file]))

  return { files, byPath, xmlDocuments, relationships }
}
