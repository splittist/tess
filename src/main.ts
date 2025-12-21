import './style.css'
import { PackageModel, loadDocxPackage } from './core/zip-loader'
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
  <div class="min-h-screen bg-gray-100 text-gray-900" id="drop-zone">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <p class="text-xs text-indigo-600 font-semibold uppercase tracking-[0.2em]">Tess</p>
          <h1 class="text-2xl font-bold text-gray-900">Package explorer</h1>
          <p class="text-sm text-gray-600 mt-1">Inspect OPC/DOCX structure and XML relationships.</p>
        </div>
        <div class="text-right">
          <button id="file-picker-btn" class="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 focus:outline focus:outline-2 focus:outline-indigo-500">
            Choose File
          </button>
          <input type="file" id="file-input" accept=".docx" class="hidden" />
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

// UI state
let currentPackage: PackageModel | null = null
let fileTree: ReturnType<typeof createFileTree> | null = null
let contextPanel: ReturnType<typeof createContextPanel> | null = null

const treeMount = document.querySelector<HTMLDivElement>('#file-tree')
const tabPanel = document.querySelector<HTMLDivElement>('#tab-panel')
const contextPanelMount = document.querySelector<HTMLDivElement>('#context-panel')
const dropZone = document.querySelector<HTMLDivElement>('#drop-zone')
const fileInput = document.querySelector<HTMLInputElement>('#file-input')
const filePickerBtn = document.querySelector<HTMLButtonElement>('#file-picker-btn')

const tabs = createTabStore()

// Initialize empty state
function showEmptyState(): void {
  if (treeMount) {
    treeMount.innerHTML = `
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
        <p class="text-sm font-semibold text-gray-700 mb-2">No package loaded</p>
        <p class="text-xs text-gray-500">Drag and drop a .docx file or click "Choose File"</p>
      </div>
    `
  }
}

// Load a package
async function loadPackage(file: File): Promise<void> {
  try {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Please use a .docx file')
      return
    }

    // Load the package
    const arrayBuffer = await file.arrayBuffer()
    currentPackage = await loadDocxPackage(arrayBuffer)

    // Clear existing tabs
    tabs.closeAll()

    // Update file tree
    if (treeMount) {
      if (fileTree) {
        fileTree.update(currentPackage)
      } else {
        treeMount.innerHTML = ''
        fileTree = createFileTree({ model: currentPackage, eventTarget: appEvents })
        treeMount.appendChild(fileTree.element)
      }
    }

    // Update context panel
    if (contextPanelMount && currentPackage) {
      if (contextPanel) {
        contextPanelMount.innerHTML = ''
      }
      contextPanel = createContextPanel({ model: currentPackage, eventTarget: appEvents })
      contextPanelMount.appendChild(contextPanel.element)
    }
  } catch (error) {
    console.error('Failed to load package:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    alert(`Failed to load the DOCX file: ${errorMessage}\n\nPlease ensure it is a valid DOCX file.`)
  }
}

// Handle file opened events
appEvents.addEventListener(FILE_OPENED, (event) => {
  const detail = (event as CustomEvent<FileEventDetail>).detail
  if (!currentPackage || !tabs.getState().tabs.find((tab) => tab.path === detail.path)) {
    const file = currentPackage?.byPath[detail.path]
    tabs.open(detail, file?.text)
  }
})

// Setup tab view
if (tabPanel) {
  const tabView = createTabView({ store: tabs, sideBySide: true })
  tabPanel.appendChild(tabView.element)
}

// Setup drag and drop
if (dropZone) {
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault()
    dropZone.classList.add('bg-indigo-50')
  })

  dropZone.addEventListener('dragleave', (event) => {
    event.preventDefault()
    dropZone.classList.remove('bg-indigo-50')
  })

  dropZone.addEventListener('drop', async (event) => {
    event.preventDefault()
    dropZone.classList.remove('bg-indigo-50')

    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      await loadPackage(files[0])
    }
  })
}

// Setup file picker
if (filePickerBtn && fileInput) {
  filePickerBtn.addEventListener('click', () => {
    fileInput.click()
  })

  fileInput.addEventListener('change', async () => {
    const files = fileInput.files
    if (files && files.length > 0) {
      await loadPackage(files[0])
      fileInput.value = '' // Reset input
    }
  })
}

// Show initial empty state
showEmptyState()
