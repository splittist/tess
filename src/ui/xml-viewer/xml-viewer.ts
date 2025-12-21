interface XmlViewerOptions {
  xml: string
  title?: string
}

interface XmlViewerHandle {
  element: HTMLElement
}

function createToken(text: string, className: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = className
  span.textContent = text
  return span
}

function createLineRow(content: Node, depth: number, lineNumber: number, toggleButton?: HTMLButtonElement): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'grid grid-cols-[auto,auto,1fr] gap-2 items-start'

  const number = document.createElement('span')
  number.className = 'w-12 text-right text-[11px] leading-6 text-gray-400 select-none'
  number.textContent = lineNumber.toString()

  const toggleCell = document.createElement('div')
  toggleCell.className = 'w-5 flex items-start justify-center'
  if (toggleButton) {
    toggleCell.appendChild(toggleButton)
  }

  const code = document.createElement('div')
  code.className = 'font-mono text-[13px] whitespace-pre leading-6 text-slate-800 flex items-start gap-2'
  code.style.paddingLeft = `${depth * 12}px`
  code.appendChild(content)

  row.append(number, toggleCell, code)
  return row
}

function createAttributeTokens(attribute: Attr): DocumentFragment {
  const frag = document.createDocumentFragment()
  frag.appendChild(createToken(attribute.name, 'text-amber-700'))
  frag.appendChild(createToken('=', 'text-gray-400'))
  frag.appendChild(createToken(`"${attribute.value}"`, 'text-emerald-700'))
  return frag
}

function renderTextNode(text: string, depth: number, lineNumber: number): HTMLDivElement | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const frag = document.createDocumentFragment()
  frag.appendChild(createToken(trimmed, 'text-slate-700'))
  return createLineRow(frag, depth, lineNumber)
}

function renderCommentNode(text: string, depth: number, lineNumber: number): HTMLDivElement {
  const frag = document.createDocumentFragment()
  frag.appendChild(createToken('<!--', 'text-gray-400'))
  frag.appendChild(createToken(text, 'text-slate-500'))
  frag.appendChild(createToken('-->', 'text-gray-400'))
  return createLineRow(frag, depth, lineNumber)
}

function renderElement(
  element: Element,
  depth: number,
  lineCounter: { current: number }
): HTMLDivElement {
  const container = document.createElement('div')
  container.className = 'space-y-0'

  const hasChildren = Array.from(element.childNodes).some((node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? '').trim())
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = `h-5 w-5 rounded border border-gray-200 text-[11px] leading-5 text-gray-600 flex items-center justify-center ${
    hasChildren ? 'hover:bg-gray-100' : 'opacity-30 pointer-events-none'
  }`
  toggle.textContent = '▾'
  toggle.title = hasChildren ? 'Collapse element' : 'No child nodes'

  const openTag = document.createDocumentFragment()
  openTag.appendChild(createToken('<', 'text-gray-400'))
  openTag.appendChild(createToken(element.tagName, 'text-indigo-700 font-semibold'))

  for (const attr of Array.from(element.attributes)) {
    openTag.appendChild(document.createTextNode(' '))
    openTag.appendChild(createAttributeTokens(attr))
  }

  openTag.appendChild(createToken('>', 'text-gray-400'))

  const openLine = createLineRow(openTag, depth, lineCounter.current++, toggle)
  container.appendChild(openLine)

  const childrenWrapper = document.createElement('div')
  container.appendChild(childrenWrapper)

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      childrenWrapper.appendChild(renderElement(child as Element, depth + 1, lineCounter))
    } else if (child.nodeType === Node.TEXT_NODE) {
      const textLine = renderTextNode(child.textContent ?? '', depth + 1, lineCounter.current)
      if (textLine) {
        childrenWrapper.appendChild(textLine)
        lineCounter.current += 1
      }
    } else if (child.nodeType === Node.COMMENT_NODE) {
      childrenWrapper.appendChild(renderCommentNode(child.textContent ?? '', depth + 1, lineCounter.current++))
    }
  }

  const closeTag = document.createDocumentFragment()
  closeTag.appendChild(createToken('</', 'text-gray-400'))
  closeTag.appendChild(createToken(element.tagName, 'text-indigo-700 font-semibold'))
  closeTag.appendChild(createToken('>', 'text-gray-400'))

  const closeLine = createLineRow(closeTag, depth, lineCounter.current++)
  container.appendChild(closeLine)

  if (hasChildren) {
    toggle.addEventListener('click', () => {
      const collapsed = childrenWrapper.classList.toggle('hidden')
      closeLine.classList.toggle('hidden', collapsed)
      toggle.textContent = collapsed ? '▸' : '▾'
      toggle.title = collapsed ? 'Expand element' : 'Collapse element'
    })
  }

  return container
}

export function createXmlViewer(options: XmlViewerOptions): XmlViewerHandle {
  const container = document.createElement('div')
  container.className = 'rounded-lg border border-gray-200 bg-slate-50'

  const body = document.createElement('div')
  body.className = 'p-4 overflow-auto max-h-[700px]'
  container.appendChild(body)

  const parser = new DOMParser()
  const doc = parser.parseFromString(options.xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')

  if (parseError) {
    const errorBox = document.createElement('div')
    errorBox.className = 'rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700'
    errorBox.innerHTML = `<strong>Parse error:</strong> ${parseError.textContent ?? 'Unknown issue'}`

    const sample = document.createElement('pre')
    sample.className = 'mt-2 text-xs bg-white border border-red-100 rounded p-3 overflow-auto'
    sample.textContent = options.xml.slice(0, 1000)

    body.append(errorBox, sample)

    return { element: container }
  }

  const lineCounter = { current: 1 }
  const root = doc.documentElement

  body.appendChild(renderElement(root, 0, lineCounter))

  return { element: container }
}
