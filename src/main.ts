import './style.css'
import { PackageFile, PackageFileMetadata, PackageModel } from './core/zip-loader'
import { FILE_OPENED, FileEventDetail, appEvents } from './ui/events'
import { createFileTree } from './ui/file-tree/file-tree'
import { createTabStore } from './ui/tabs/tab-store'
import { createTabView } from './ui/tabs/tab-view'
import { createContextPanel } from './ui/context-panel/context-panel'

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('App root not found')
}

root.innerHTML = `
  <div class="min-h-screen bg-gray-100 text-gray-900">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <p class="text-xs text-indigo-600 font-semibold uppercase tracking-[0.2em]">Tess</p>
          <h1 class="text-2xl font-bold text-gray-900">Package explorer</h1>
          <p class="text-sm text-gray-600 mt-1">Inspect OPC/DOCX structure and XML relationships.</p>
        </div>
        <div class="text-right text-xs text-gray-500">
          <p class="font-semibold text-gray-700">Status: Ready</p>
          <p>Load a package to begin exploring files</p>
        </div>
      </div>
    </header>
    <main class="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-7 gap-6">
      <section class="lg:col-span-2 space-y-4" id="file-tree-panel">
        <div id="file-tree"></div>
      </section>
      <section class="lg:col-span-3 space-y-4" id="tab-panel"></section>
      <aside class="lg:col-span-2 space-y-4" id="context-panel"></aside>
    </main>
  </div>
`

function base64ToArrayBuffer(data: string): ArrayBuffer {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function createPackageFile(path: string, text?: string, arrayBuffer?: ArrayBuffer): PackageFile {
  const extensionIndex = path.lastIndexOf('.')
  const extension = extensionIndex >= 0 ? path.slice(extensionIndex).toLowerCase() : ''
  const lastSlash = path.lastIndexOf('/')
  const folder = lastSlash >= 0 ? path.slice(0, lastSlash) : ''
  const metadata: PackageFileMetadata = {
    path,
    name: path.split('/').pop() ?? path,
    folder,
    extension,
    isXml: extension === '.xml' || extension === '.rels',
    size: arrayBuffer?.byteLength ?? text?.length ?? 0
  }

  return {
    metadata,
    arrayBuffer: arrayBuffer ?? new ArrayBuffer(0),
    text: metadata.isXml ? text ?? '' : undefined
  }
}

function createDemoPackage(): PackageModel {
  const transparentPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
  const tinyJpeg =
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAgEAABAwQDAQAAAAAAAAAAAAABAAIDBAUREiExMkFR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8A04LiXisgIZSZO9Q5q1uQMhV3vNo83j5SiJHFGL8Wl//Z'

  const files: PackageFile[] = [
    createPackageFile('[Content_Types].xml', '<Types><Default Extension="xml" /></Types>'),
    createPackageFile('docProps/core.xml', '<cp:coreProperties></cp:coreProperties>'),
    createPackageFile('word/document.xml', '<w:document><w:body /></w:document>'),
    createPackageFile('word/styles.xml', '<w:styles></w:styles>'),
    createPackageFile('word/media/image1.png', undefined, base64ToArrayBuffer(transparentPng)),
    createPackageFile('word/media/image2.jpeg', undefined, base64ToArrayBuffer(tinyJpeg)),
    createPackageFile('word/_rels/document.xml.rels', '<Relationships></Relationships>')
  ]

  const byPath = Object.fromEntries(files.map((file) => [file.metadata.path, file]))

  return {
    files,
    byPath,
    xmlDocuments: {},
    relationships: {}
  }
}

const demoPackage = createDemoPackage()
const treeMount = document.querySelector<HTMLDivElement>('#file-tree')
if (treeMount) {
  const fileTree = createFileTree({ model: demoPackage, eventTarget: appEvents })
  treeMount.appendChild(fileTree.element)
}

const tabPanel = document.querySelector<HTMLDivElement>('#tab-panel')
const contextPanelMount = document.querySelector<HTMLDivElement>('#context-panel')

const tabs = createTabStore()

appEvents.addEventListener(FILE_OPENED, (event) => {
  const detail = (event as CustomEvent<FileEventDetail>).detail
  const { tabs: openTabs } = tabs.getState()
  const existing = openTabs.find((tab) => tab.path === detail.path)

  if (existing) {
    tabs.focus(detail.path)
    return
  }

  const file = demoPackage.byPath[detail.path]
  tabs.open(detail, file?.text)
})

if (tabPanel) {
  const tabView = createTabView({ store: tabs, sideBySide: true })
  tabPanel.appendChild(tabView.element)
}

if (contextPanelMount) {
  const contextPanel = createContextPanel({ model: demoPackage, eventTarget: appEvents })
  contextPanelMount.appendChild(contextPanel.element)
}
