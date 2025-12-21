import { RelationshipsBySource } from '../../core/relationships'
import { ReferenceNavigationDetail } from '../events'
import { createXmlViewer } from '../xml-viewer/xml-viewer'
import { TabRecord, TabStoreHandle } from './tab-store'

interface TabViewOptions {
  store: TabStoreHandle
  sideBySide?: boolean
  relationshipsBySource?: () => RelationshipsBySource | undefined
  onReferenceNavigate?: (detail: ReferenceNavigationDetail) => void
}

interface TabViewHandle {
  element: HTMLElement
  destroy(): void
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

  const tabsBar = document.createElement('div')
  tabsBar.className = 'px-4 py-2 flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50'

  const panels = document.createElement('div')
  panels.className = sideBySide
    ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 bg-slate-100'
    : 'p-4 bg-slate-100 space-y-4'

  container.append(header, tabsBar, panels)

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
