import './style.css'
import { PackageFile, PackageFileMetadata, PackageModel } from './core/zip-loader'
import { FILE_OPENED, FileEventDetail, IMAGE_PREVIEW_REQUESTED, appEvents } from './ui/events'
import { createFileTree } from './ui/file-tree/file-tree'

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
    <main class="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <section class="md:col-span-1" id="file-tree-panel">
        <div id="file-tree"></div>
      </section>
      <section class="md:col-span-2 space-y-4">
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Open tabs</h2>
              <p class="text-xs text-gray-500">Click XML or binary files to open/focus tabs.</p>
            </div>
            <span id="tab-count" class="text-xs text-gray-500"></span>
          </div>
          <div id="tab-list" class="p-4 space-y-3"></div>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Image preview</h2>
              <p class="text-xs text-gray-500">Click image entries to request a preview.</p>
            </div>
          </div>
          <div id="image-preview" class="p-4 text-sm text-gray-700"></div>
        </div>
      </section>
    </main>
  </div>
`

function createPackageFile(path: string, text?: string): PackageFile {
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
    size: text?.length ?? 0
  }

  return {
    metadata,
    arrayBuffer: new ArrayBuffer(0),
    text: metadata.isXml ? text ?? '' : undefined
  }
}

function createDemoPackage(): PackageModel {
  const files: PackageFile[] = [
    createPackageFile('[Content_Types].xml', '<Types><Default Extension="xml" /></Types>'),
    createPackageFile('docProps/core.xml', '<cp:coreProperties></cp:coreProperties>'),
    createPackageFile('word/document.xml', '<w:document><w:body /></w:document>'),
    createPackageFile('word/styles.xml', '<w:styles></w:styles>'),
    createPackageFile('word/media/image1.png'),
    createPackageFile('word/media/image2.jpeg'),
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

function renderEmptyMessage(container: HTMLElement, message: string): void {
  container.innerHTML = ''
  const placeholder = document.createElement('p')
  placeholder.className = 'text-sm text-gray-500'
  placeholder.textContent = message
  container.appendChild(placeholder)
}

const demoPackage = createDemoPackage()
const treeMount = document.querySelector<HTMLDivElement>('#file-tree')
if (treeMount) {
  const fileTree = createFileTree({ model: demoPackage, eventTarget: appEvents })
  treeMount.appendChild(fileTree.element)
}

const tabList = document.querySelector<HTMLDivElement>('#tab-list')
const tabCount = document.querySelector<HTMLSpanElement>('#tab-count')
const imagePreview = document.querySelector<HTMLDivElement>('#image-preview')

const openTabs: FileEventDetail[] = []
let activeTab: FileEventDetail | null = null

function setActiveTab(path: string): void {
  const match = openTabs.find((tab) => tab.path === path)
  activeTab = match ?? activeTab
  renderTabs()
}

function renderTabs(): void {
  if (!tabList || !tabCount) return
  tabList.innerHTML = ''

  if (openTabs.length === 0) {
    tabCount.textContent = 'No tabs open'
    renderEmptyMessage(tabList, 'Select an XML or binary entry to open it in a tab.')
    return
  }

  tabCount.textContent = `${openTabs.length} tab${openTabs.length === 1 ? '' : 's'}`

  const tabButtons = document.createElement('div')
  tabButtons.className = 'flex flex-wrap gap-2'

  openTabs.forEach((tab) => {
    const btn = document.createElement('button')
    const isActive = activeTab?.path === tab.path
    btn.type = 'button'
    btn.className = `px-3 py-1 rounded-full text-xs font-semibold border transition ${
      isActive
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
    }`
    btn.textContent = tab.name
    btn.addEventListener('click', () => setActiveTab(tab.path))
    tabButtons.appendChild(btn)
  })

  tabList.appendChild(tabButtons)

  const activeDetail = document.createElement('div')
  activeDetail.className = 'mt-3 p-3 border border-dashed border-gray-200 rounded-lg bg-gray-50'
  if (activeTab) {
    const title = document.createElement('p')
    title.className = 'font-semibold text-sm text-gray-800'
    title.textContent = activeTab.name

    const meta = document.createElement('p')
    meta.className = 'text-xs text-gray-600'
    meta.textContent = `${activeTab.kind.toUpperCase()} • ${activeTab.path}`

    activeDetail.append(title, meta)
  } else {
    const message = document.createElement('p')
    message.className = 'text-sm text-gray-600'
    message.textContent = 'Select a tab to focus it.'
    activeDetail.appendChild(message)
  }

  tabList.appendChild(activeDetail)
}

function renderImagePreview(detail?: FileEventDetail): void {
  if (!imagePreview) return
  imagePreview.innerHTML = ''

  if (!detail) {
    renderEmptyMessage(imagePreview, 'No image preview requested yet. Select an image to render it here.')
    return
  }

  const title = document.createElement('p')
  title.className = 'font-semibold text-sm text-gray-800'
  title.textContent = detail.name

  const meta = document.createElement('p')
  meta.className = 'text-xs text-gray-600 mt-1'
  meta.textContent = `Image preview requested for ${detail.path}`

  const placeholder = document.createElement('div')
  placeholder.className =
    'mt-3 h-36 rounded-lg border border-dashed border-gray-300 bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-sm text-gray-500'
  placeholder.textContent = 'Preview will render here once available.'

  imagePreview.append(title, meta, placeholder)
}

appEvents.addEventListener(FILE_OPENED, (event) => {
  const detail = (event as CustomEvent<FileEventDetail>).detail
  if (!openTabs.find((tab) => tab.path === detail.path)) {
    openTabs.push(detail)
  }
  setActiveTab(detail.path)
})

appEvents.addEventListener(IMAGE_PREVIEW_REQUESTED, (event) => {
  const detail = (event as CustomEvent<FileEventDetail>).detail
  renderImagePreview(detail)
})

renderTabs()
renderImagePreview()
