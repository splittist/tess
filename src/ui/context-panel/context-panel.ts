import { PackageFile, PackageModel } from '../../core/zip-loader'
import { FileEventDetail, IMAGE_PREVIEW_REQUESTED, appEvents } from '../events'

interface ContextPanelOptions {
  model: PackageModel
  eventTarget?: EventTarget
}

interface ContextPanelHandle {
  element: HTMLElement
}

const imageExtensions = new Set(['.png', '.jpg', '.jpeg'])

function isPreviewableImage(file?: PackageFile): boolean {
  if (!file) return false
  return imageExtensions.has(file.metadata.extension.toLowerCase())
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function resolveMimeType(extension: string): string {
  const normalized = extension.toLowerCase()
  if (normalized === '.png') return 'image/png'
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

function createMetadataRow(label: string, value: string): HTMLElement {
  const row = document.createElement('div')
  row.className = 'flex justify-between text-xs text-gray-600'

  const name = document.createElement('span')
  name.className = 'font-semibold text-gray-700'
  name.textContent = label

  const val = document.createElement('span')
  val.className = 'truncate text-gray-600'
  val.textContent = value

  row.append(name, val)
  return row
}

export function createContextPanel(options: ContextPanelOptions): ContextPanelHandle {
  const target = options.eventTarget ?? appEvents
  const container = document.createElement('div')
  container.className = 'bg-white rounded-lg border border-gray-200 shadow-sm hidden'

  const header = document.createElement('div')
  header.className = 'px-4 py-3 border-b border-gray-200 flex items-center justify-between'

  const title = document.createElement('div')
  title.className = 'flex flex-col'

  const heading = document.createElement('h2')
  heading.className = 'text-sm font-semibold uppercase tracking-wide text-gray-700'
  heading.textContent = 'Context panel'

  const subtitle = document.createElement('p')
  subtitle.className = 'text-xs text-gray-500'
  subtitle.textContent = 'Image previews and related metadata.'

  title.append(heading, subtitle)

  const toggleButton = document.createElement('button')
  toggleButton.type = 'button'
  toggleButton.className =
    'text-xs font-semibold px-3 py-1 rounded-full border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100'
  toggleButton.textContent = 'Collapse'

  header.append(title, toggleButton)

  const body = document.createElement('div')
  body.className = 'p-4 space-y-3'

  const previewContainer = document.createElement('div')
  previewContainer.className = 'rounded-lg border border-gray-200 bg-slate-50 p-3 flex flex-col gap-3'

  const imageFrame = document.createElement('div')
  imageFrame.className =
    'relative aspect-video w-full overflow-hidden rounded-md bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center'

  const image = document.createElement('img')
  image.className = 'max-h-80 max-w-full object-contain'
  image.alt = ''

  const emptyState = document.createElement('p')
  emptyState.className = 'text-sm text-gray-500'
  emptyState.textContent = 'Select an image to view its preview.'

  imageFrame.appendChild(emptyState)
  previewContainer.appendChild(imageFrame)

  const metaSection = document.createElement('div')
  metaSection.className = 'rounded-md border border-dashed border-gray-200 p-3 space-y-2 bg-white'

  const metaHeading = document.createElement('p')
  metaHeading.className = 'text-xs font-semibold uppercase tracking-wide text-gray-600'
  metaHeading.textContent = 'Metadata'

  const metaList = document.createElement('div')
  metaList.className = 'space-y-1'

  metaSection.append(metaHeading, metaList)

  const futureSection = document.createElement('div')
  futureSection.className = 'rounded-md border border-dashed border-gray-200 p-3 bg-slate-50'
  const futureHeading = document.createElement('p')
  futureHeading.className = 'text-xs font-semibold uppercase tracking-wide text-gray-600'
  futureHeading.textContent = 'Context hooks'
  const futureBody = document.createElement('p')
  futureBody.className = 'text-sm text-gray-600'
  futureBody.textContent = 'Future contextual data will be displayed here.'
  futureSection.append(futureHeading, futureBody)

  body.append(previewContainer, metaSection, futureSection)
  container.append(header, body)

  let collapsed = false
  let currentUrl: string | null = null

  function hidePanel(): void {
    container.classList.add('hidden')
    metaList.innerHTML = ''
    image.src = ''
    image.alt = ''
    emptyState.textContent = 'Select an image to view its preview.'
    imageFrame.replaceChildren(emptyState)
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl)
      currentUrl = null
    }
  }

  function showPanel(): void {
    container.classList.remove('hidden')
  }

  function renderPreview(detail: FileEventDetail, file: PackageFile): void {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl)
      currentUrl = null
    }

    const mimeType = resolveMimeType(file.metadata.extension)
    currentUrl = URL.createObjectURL(new Blob([file.arrayBuffer], { type: mimeType }))

    image.src = currentUrl
    image.alt = `${detail.name} preview`
    imageFrame.replaceChildren(image)

    metaList.innerHTML = ''
    metaList.append(
      createMetadataRow('Path', detail.path),
      createMetadataRow('Type', `${mimeType.toUpperCase()}`),
      createMetadataRow('Size', formatBytes(file.metadata.size))
    )
  }

  toggleButton.addEventListener('click', () => {
    collapsed = !collapsed
    body.classList.toggle('hidden', collapsed)
    toggleButton.textContent = collapsed ? 'Expand' : 'Collapse'
  })

  target.addEventListener(IMAGE_PREVIEW_REQUESTED, (event) => {
    const detail = (event as CustomEvent<FileEventDetail>).detail
    const file = options.model.byPath[detail.path]

    if (!isPreviewableImage(file)) {
      hidePanel()
      return
    }

    showPanel()
    renderPreview(detail, file)
  })

  hidePanel()

  return { element: container }
}
