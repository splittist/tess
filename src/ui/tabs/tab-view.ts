import { RelationshipsBySource } from '../../core/relationships'
import { ReferenceMapHandle } from '../../core/reference-map'
import { PackageModel } from '../../core/zip-loader'
import { searchPackageEntries } from '../../utils/search'
import { FileEventDetail, FileKind, ReferenceNavigationDetail } from '../events'
import { createXmlViewer } from '../xml-viewer/xml-viewer'
import { TabRecord, TabStoreHandle } from './tab-store'

interface TabViewOptions {
  store: TabStoreHandle
  sideBySide?: boolean
  relationshipsBySource?: () => RelationshipsBySource | undefined
  referenceMap?: () => ReferenceMapHandle | undefined
  onReferenceNavigate?: (detail: ReferenceNavigationDetail) => void
  packageModel?: () => PackageModel | null
}

interface TabViewHandle {
  element: HTMLElement
  destroy(): void
}

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'])

function resolveFileKind(isXml: boolean, extension: string): FileKind {
  if (isXml) return 'xml'
  return imageExtensions.has(extension.toLowerCase()) ? 'image' : 'binary'
}

function createTabButton(tab: TabRecord, active: boolean, onFocus: () => void, onClose: () => void): HTMLElement {
  const button = document.createElement('div')
  button.className = `group flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
    active
      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
  }`

  const label = document.createElement('span')
  label.className = 'truncate max-w-[140px]'
  label.textContent = tab.name

  const kind = document.createElement('span')
  kind.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
    tab.kind === 'xml'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : tab.kind === 'image'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-gray-50 text-gray-700 border-gray-200'
  }`
  kind.textContent = tab.kind.toUpperCase()

  const close = document.createElement('button')
  close.type = 'button'
  close.className = `opacity-0 group-hover:opacity-100 transition text-[12px] leading-4 rounded-full hover:bg-white/20 px-1 ${
    active ? 'text-white' : 'text-gray-600'
  }`
  close.textContent = '✕'
  close.title = `Close ${tab.name}`
  close.addEventListener('click', (event) => {
    event.stopPropagation()
    onClose()
  })

  button.addEventListener('click', onFocus)
  button.append(label, kind, close)
  return button
}

function highlightSnippet(snippet: string, query: string): HTMLElement {
  const wrapper = document.createElement('span')
  const lowerSnippet = snippet.toLowerCase()
  const lowerQuery = query.toLowerCase()

  let cursor = 0
  let index = lowerSnippet.indexOf(lowerQuery)

  while (index !== -1) {
    const prefix = snippet.slice(cursor, index)
    if (prefix) {
      wrapper.append(document.createTextNode(prefix))
    }

    const match = document.createElement('mark')
    match.className = 'bg-amber-100 text-amber-900 rounded px-0.5'
    match.textContent = snippet.slice(index, index + query.length)
    wrapper.append(match)

    cursor = index + query.length
    index = lowerSnippet.indexOf(lowerQuery, cursor)
  }

  const suffix = snippet.slice(cursor)
  if (suffix) {
    wrapper.append(document.createTextNode(suffix))
  }

  return wrapper
}

function createTabContent(tab: TabRecord, options: TabViewOptions): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'border border-gray-200 rounded-lg bg-white shadow-inner'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-4 py-2 border-b border-gray-200'

  const title = document.createElement('div')
  title.className = 'flex flex-col'

  const name = document.createElement('p')
  name.className = 'text-sm font-semibold text-gray-800'
  name.textContent = tab.path

  title.append(name)
  header.appendChild(title)
  panel.appendChild(header)

  const body = document.createElement('div')
  body.className = 'p-4 bg-slate-50'

  if (tab.kind === 'xml' && tab.content) {
    const viewer = createXmlViewer({
      xml: tab.content,
      path: tab.path,
      relationshipsBySource: options.relationshipsBySource?.(),
      referenceMap: options.referenceMap?.(),
      onReferenceNavigate: options.onReferenceNavigate
    })
    if (tab.scrollTarget) {
      viewer.scrollToAnchor(tab.scrollTarget)
    }
    body.appendChild(viewer.element)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'h-48 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center text-sm text-gray-500'
    placeholder.textContent = tab.kind === 'image' ? 'Image preview not yet available.' : 'Binary preview not available.'
    body.appendChild(placeholder)
  }

  panel.appendChild(body)
  return panel
}

export function createTabView(options: TabViewOptions): TabViewHandle {
  const { store, sideBySide = false } = options
  const container = document.createElement('div')
  container.className = 'bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col'

  const header = document.createElement('div')
  header.className = 'px-4 py-3 border-b border-gray-200 flex items-center justify-between'

  const title = document.createElement('div')
  title.className = 'flex flex-col'

  const heading = document.createElement('h2')
  heading.className = 'text-sm font-semibold uppercase tracking-wide text-gray-700'
  heading.textContent = 'Open tabs'

  const hint = document.createElement('p')
  hint.className = 'text-xs text-gray-500'
  hint.textContent = sideBySide
    ? 'Tabs render across two panels. Click a tab to focus.'
    : 'Tabs render in a single panel. Click a tab to focus.'

  title.append(heading, hint)

  const count = document.createElement('span')
  count.className = 'text-xs text-gray-500'

  header.append(title, count)

  const searchPanel = document.createElement('div')
  searchPanel.className = 'px-4 py-3 border-y border-gray-200 bg-slate-50 space-y-2'

  const searchForm = document.createElement('form')
  searchForm.className = 'flex items-center gap-2'

  const searchInput = document.createElement('input')
  searchInput.type = 'search'
  searchInput.placeholder = 'Search across package entries'
  searchInput.className =
    'flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  const searchButton = document.createElement('button')
  searchButton.type = 'submit'
  searchButton.className =
    'px-3 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  searchButton.textContent = 'Search'

  searchForm.append(searchInput, searchButton)

  const searchStatus = document.createElement('p')
  searchStatus.className = 'text-xs text-gray-600'
  searchStatus.textContent = 'Run a global search to find paths, line numbers, and snippets.'

  const searchResults = document.createElement('div')
  searchResults.className = 'max-h-56 overflow-auto space-y-1'

  searchPanel.append(searchForm, searchStatus, searchResults)

  const tabsBar = document.createElement('div')
  tabsBar.className = 'px-4 py-2 flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50'

  const panels = document.createElement('div')
  panels.className = sideBySide
    ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 bg-slate-100'
    : 'p-4 bg-slate-100 space-y-4'

  container.append(header, searchPanel, tabsBar, panels)

  function renderGlobalSearch(query: string): void {
    const model = options.packageModel?.()
    const trimmed = query.trim()

    searchResults.innerHTML = ''

    if (!model) {
      searchStatus.textContent = 'Load a package to search across entries.'
      return
    }

    if (!trimmed) {
      searchStatus.textContent = 'Enter a query to search all package entries.'
      return
    }

    const results = searchPackageEntries(model, trimmed, { maxResults: 200 })
    searchStatus.textContent = results.length
      ? `${results.length} match${results.length === 1 ? '' : 'es'} found`
      : `No matches found for "${trimmed}".`

    for (const result of results) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className =
        'w-full text-left rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 space-y-1'

      const headingRow = document.createElement('div')
      headingRow.className = 'flex items-center justify-between gap-2'

      const path = document.createElement('p')
      path.className = 'text-sm font-semibold text-gray-800 truncate'
      path.textContent = result.path

      const line = document.createElement('span')
      line.className = 'text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5'
      line.textContent = `Line ${result.lineNumber}`

      headingRow.append(path, line)

      const snippet = document.createElement('p')
      snippet.className = 'text-xs text-gray-700 font-mono break-all'
      snippet.append(highlightSnippet(result.snippet, trimmed))

      row.append(headingRow, snippet)

      row.addEventListener('click', () => {
        const file = model.byPath[result.path]
        if (!file || !file.text) return

        const detail: FileEventDetail = {
          path: file.metadata.path,
          name: file.metadata.name,
          kind: resolveFileKind(file.metadata.isXml, file.metadata.extension)
        }

        store.open(detail, file.text, {
          lineNumber: result.lineNumber,
          searchQuery: trimmed,
          lineText: result.line
        })
      })

      searchResults.appendChild(row)
    }
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault()
    renderGlobalSearch(searchInput.value)
  })

  const unsubscribe = store.subscribe((state) => {
    tabsBar.innerHTML = ''
    panels.innerHTML = ''

    count.textContent = state.tabs.length ? `${state.tabs.length} open` : 'No tabs open'

    if (state.tabs.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'text-sm text-gray-500 px-4 py-3'
      empty.textContent = 'Select an XML or binary entry to open it in a tab.'
      panels.appendChild(empty)
      return
    }

    const focused = state.tabs.find((tab) => tab.path === state.activePath) ?? state.tabs[0]

    for (const tab of state.tabs) {
      const button = createTabButton(
        tab,
        tab.path === focused.path,
        () => store.focus(tab.path),
        () => store.close(tab.path)
      )
      tabsBar.appendChild(button)
    }

    const renderTabs = sideBySide ? state.tabs.slice(-2) : [focused]
    for (const tab of renderTabs) {
      panels.appendChild(createTabContent(tab, options))
    }
  })

  return {
    element: container,
    destroy() {
      unsubscribe()
    }
  }
}
