const textDecoder = new TextDecoder()

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50

type ZipLikeInput = ArrayBuffer | ArrayBufferView | Uint8Array | Blob

interface ParsedEntry {
  name: string
  dir: boolean
  compressedSize: number
  uncompressedSize: number
  compressionMethod: number
  date: Date
  data: Uint8Array
}

async function normalizeInput(input: ZipLikeInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    const buffer = await input.arrayBuffer()
    return new Uint8Array(buffer)
  }

  throw new TypeError('Unsupported input passed to JSZip.loadAsync')
}

function findEndOfCentralDirectory(data: Uint8Array): number {
  const minOffset = Math.max(0, data.length - 0x10000)
  for (let i = data.length - 22; i >= minOffset; i--) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      return i
    }
  }

  return -1
}

function parseDosDateTime(date: number, time: number): Date {
  const day = date & 0x1f
  const month = ((date >> 5) & 0x0f) - 1
  const year = 1980 + ((date >> 9) & 0x7f)

  const seconds = (time & 0x1f) * 2
  const minutes = (time >> 5) & 0x3f
  const hours = time >> 11

  return new Date(Date.UTC(year, month, day, hours, minutes, seconds))
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Blob.prototype.stream === 'function') {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let total = 0

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value)
      chunks.push(chunk)
      total += chunk.length
    }

    const result = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  // @ts-ignore - Node.js fallback for environments without DecompressionStream
  const { inflateRawSync } = await import('node:zlib')
  // @ts-ignore
  const inflated = inflateRawSync((globalThis as any).Buffer.from(data))
  return new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength)
}

async function decompress(compressionMethod: number, compressedData: Uint8Array): Promise<Uint8Array> {
  if (compressionMethod === 0) {
    return compressedData
  }

  if (compressionMethod === 8) {
    return inflateRaw(compressedData)
  }

  throw new Error(`Unsupported compression method: ${compressionMethod}`)
}

async function parseEntries(data: Uint8Array): Promise<ParsedEntry[]> {
  const eocdOffset = findEndOfCentralDirectory(data)
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP: could not locate end of central directory')
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true)

  let pointer = centralDirectoryOffset
  const entries: ParsedEntry[] = []

  for (let i = 0; i < totalEntries; i++) {
    const signature = view.getUint32(pointer, true)
    if (signature !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid ZIP: corrupt central directory entry')
    }

    const compressionMethod = view.getUint16(pointer + 10, true)
    const dosTime = view.getUint16(pointer + 12, true)
    const dosDate = view.getUint16(pointer + 14, true)
    const compressedSize = view.getUint32(pointer + 20, true)
    const uncompressedSize = view.getUint32(pointer + 24, true)
    const fileNameLength = view.getUint16(pointer + 28, true)
    const extraLength = view.getUint16(pointer + 30, true)
    const commentLength = view.getUint16(pointer + 32, true)
    const localHeaderOffset = view.getUint32(pointer + 42, true)

    const nameBytes = data.slice(pointer + 46, pointer + 46 + fileNameLength)
    const name = textDecoder.decode(nameBytes)
    const dir = name.endsWith('/')

    const localFileHeaderSignature = view.getUint32(localHeaderOffset, true)
    if (localFileHeaderSignature !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error('Invalid ZIP: missing local file header')
    }

    const localNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    const compressedData = data.slice(dataStart, dataStart + compressedSize)
    const payload = dir ? new Uint8Array(0) : await decompress(compressionMethod, compressedData)

    entries.push({
      name,
      dir,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      date: parseDosDateTime(dosDate, dosTime),
      data: payload
    })

    pointer += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

export class JSZipObject {
  name: string
  dir: boolean
  date?: Date
  comment: string
  private _data: Uint8Array

  constructor(name: string, dir: boolean, data: Uint8Array, date?: Date) {
    this.name = name
    this.dir = dir
    this.date = date
    this.comment = ''
    this._data = data
  }

  async async(type: 'arraybuffer' | 'uint8array' | 'string' | 'text'): Promise<ArrayBuffer | Uint8Array | string> {
    if (type === 'arraybuffer') {
      return this._data.buffer.slice(this._data.byteOffset, this._data.byteOffset + this._data.byteLength) as ArrayBuffer
    }

    if (type === 'uint8array') {
      return new Uint8Array(this._data)
    }

    if (type === 'string' || type === 'text') {
      return textDecoder.decode(this._data)
    }

    throw new Error(`Unsupported output type: ${type}`)
  }
}

export default class JSZip {
  files: Record<string, JSZipObject>

  constructor(files: Record<string, JSZipObject>) {
    this.files = files
  }

  static async loadAsync(input: ZipLikeInput): Promise<JSZip> {
    const normalized = await normalizeInput(input)
    const entries = await parseEntries(normalized)
    const files: Record<string, JSZipObject> = {}

    for (const entry of entries) {
      files[entry.name] = new JSZipObject(entry.name, entry.dir, entry.data, entry.date)
    }

    return new JSZip(files)
  }
}

export type JSZipInput = ZipLikeInput
