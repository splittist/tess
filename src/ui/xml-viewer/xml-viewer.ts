import { RelationshipsBySource } from '../../core/relationships'
import { ReferenceNavigationDetail, ScrollTarget } from '../events'
import { ReferenceMapHandle } from '../../core/reference-map'
import { DEFAULT_NAMESPACE_LABEL, applyOverlayStyles, describeTag, TagMetadata } from '../../utils/highlighting'

interface XmlViewerOptions {
  xml: string
  title?: string
  path?: string
  relationshipsBySource?: RelationshipsBySource
  referenceMap?: ReferenceMapHandle
  onReferenceNavigate?: (detail: ReferenceNavigationDetail) => void
}

interface XmlViewerHandle {
  element: HTMLElement
  scrollToAnchor(target: ScrollTarget): boolean
}

function createToken(text: string, className: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = className
  span.style.display = 'inline'  // Use inline display for natural text wrapping
  span.textContent = text
  return span
}

function annotateLine(row: HTMLDivElement, metadata?: TagMetadata | null): void {
  if (!metadata) return

  row.dataset.tagName = metadata.tagName
  row.dataset.namespace = metadata.namespace
  row.dataset.elementType = metadata.localName
}

interface ReferenceDetectionContext {
  sourcePath?: string
  relationshipsBySource?: RelationshipsBySource
  referenceMap?: ReferenceMapHandle
  onReferenceNavigate?: (detail: ReferenceNavigationDetail) => void
}

interface AttributeReference {
  targetPath: string
  label: string
  scrollTarget?: ScrollTarget
}

interface ReferenceIndex {
  register(attribute: string, value: string, element: HTMLElement): void
  scrollTo(target: ScrollTarget): boolean
}

function anchorKey(attribute: string, value: string): string {
  return `${attribute.toLowerCase()}::${value}`
}

function createReferenceIndex(): ReferenceIndex {
  const anchors = new Map<string, HTMLElement>()

  function register(attribute: string, value: string, element: HTMLElement): void {
    anchors.set(anchorKey(attribute, value), element)
  }

  function scrollTo(target: ScrollTarget): boolean {
    if (!target.attribute || !target.value) return false

    const anchor = anchors.get(anchorKey(target.attribute, target.value))
    if (!anchor) return false

    if (typeof anchor.scrollIntoView === 'function') {
      anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    anchor.classList.add('bg-amber-50')
    setTimeout(() => anchor.classList.remove('bg-amber-50'), 1200)
    return true
  }

  return { register, scrollTo }
}

function looksLikeRelationshipId(attribute: Attr): boolean {
  const name = attribute.name.toLowerCase()
  const value = attribute.value
  return name === 'r:id' || name.endsWith(':id') || name === 'id' || /^rId\d+$/i.test(value)
}

function resolveRelationshipReference(attribute: Attr, context: ReferenceDetectionContext): AttributeReference | null {
  if (context.sourcePath === undefined || !context.relationshipsBySource || !looksLikeRelationshipId(attribute)) return null

  const relationships = context.relationshipsBySource[context.sourcePath]
  const relationship = relationships?.[attribute.value]
  if (!relationship || relationship.targetMode?.toLowerCase() === 'external') return null

  return {
    targetPath: relationship.resolvedTarget,
    label: `${attribute.value} → ${relationship.resolvedTarget}`
  }
}

function resolveCommentReference(attribute: Attr, element: Element, context: ReferenceDetectionContext): AttributeReference | null {
  if (context.sourcePath === undefined || !context.relationshipsBySource) return null

  const tagName = element.tagName.toLowerCase()
  const attrName = attribute.name.toLowerCase()
  const value = attribute.value

  const isCommentReference = tagName.includes('comment') && attrName.endsWith('id') && /^\d+$/.test(value)
  if (!isCommentReference) return null

  const relationships = context.relationshipsBySource[context.sourcePath]
  const commentRelationship = Object.values(relationships ?? {}).find((rel) =>
    (rel.type ?? '').toLowerCase().includes('/comments')
  )

  if (!commentRelationship) return null

  return {
    targetPath: commentRelationship.resolvedTarget,
    label: `comment ${value}`,
    scrollTarget: { attribute: attribute.name, value }
  }
}

function resolveNoteReference(
  noteType: 'footnote' | 'endnote',
  attribute: Attr,
  element: Element,
  context: ReferenceDetectionContext
): AttributeReference | null {
  if (context.sourcePath === undefined || !context.relationshipsBySource) return null

  const tagName = element.tagName.toLowerCase()
  const attrName = attribute.name.toLowerCase()
  const value = attribute.value

  const isNoteReference = tagName.includes(noteType) && attrName.endsWith('id') && /^\d+$/.test(value)
  if (!isNoteReference) return null

  const relationships = context.relationshipsBySource[context.sourcePath]
  const noteRelationship = Object.values(relationships ?? {}).find((rel) =>
    (rel.type ?? '').toLowerCase().includes(`/${noteType}s`)
  )

  if (!noteRelationship) return null

  return {
    targetPath: noteRelationship.resolvedTarget,
    label: `${noteType} ${value}`,
    scrollTarget: { attribute: attribute.name, value }
  }
}

function resolveFootnoteReference(attribute: Attr, element: Element, context: ReferenceDetectionContext): AttributeReference | null {
  return resolveNoteReference('footnote', attribute, element, context)
}

function resolveEndnoteReference(attribute: Attr, element: Element, context: ReferenceDetectionContext): AttributeReference | null {
  return resolveNoteReference('endnote', attribute, element, context)
}

function resolveBookmarkReference(attribute: Attr, element: Element, context: ReferenceDetectionContext): AttributeReference | null {
  if (context.sourcePath === undefined) return null

  const tagName = element.tagName.toLowerCase()
  const attrName = attribute.name.toLowerCase()
  const value = attribute.value

  // Bookmark references use w:anchor attribute in hyperlink tags
  const isBookmarkReference = tagName.includes('hyperlink') && attrName.endsWith('anchor')
  if (!isBookmarkReference) return null

  // Bookmarks are typically in the same document
  return {
    targetPath: context.sourcePath,
    label: `bookmark ${value}`,
    scrollTarget: { attribute: 'name', value }
  }
}

function detectReference(attribute: Attr, element: Element, context: ReferenceDetectionContext): AttributeReference | null {
  return (
    resolveRelationshipReference(attribute, context) ??
    resolveCommentReference(attribute, element, context) ??
    resolveFootnoteReference(attribute, element, context) ??
    resolveEndnoteReference(attribute, element, context) ??
    resolveBookmarkReference(attribute, element, context)
  )
}

function registerReferenceInMap(
  attribute: Attr,
  reference: AttributeReference,
  context: ReferenceDetectionContext
): void {
  if (!context.referenceMap || !context.sourcePath) return

  context.referenceMap.addReference({
    sourcePath: context.sourcePath,
    sourceAttribute: attribute.name,
    sourceValue: attribute.value,
    targetPath: reference.targetPath,
    targetAttribute: reference.scrollTarget?.attribute ?? 'id',
    targetValue: reference.scrollTarget?.value ?? attribute.value,
    label: reference.label
  })
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
  code.className = 'font-mono text-[13px] leading-5 text-slate-800'
  code.style.paddingLeft = `${depth * 12 + 36}px`  // base depth + indent for wrapped attributes
  code.style.textIndent = '-36px'  // hanging indent to pull first line back
  code.appendChild(content)

  const codeText = code.textContent ?? ''
  row.dataset.lineNumber = lineNumber.toString()
  row.dataset.codeText = codeText

  row.append(number, toggleCell, code)
  return row
}

function createReferenceButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className =
    'text-emerald-700 underline decoration-dotted underline-offset-4 hover:text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 rounded px-0.5'
  button.textContent = label
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    onClick()
  })
  return button
}

function createAttributeTokens(attribute: Attr, element: Element, referenceContext?: ReferenceDetectionContext): HTMLSpanElement {
  // Wrap the entire attribute in a container to prevent breaking mid-attribute
  const container = document.createElement('span')
  container.className = 'whitespace-nowrap'
  container.style.display = 'inline-block'  // Allow wrapping between attributes, not within
  
  container.appendChild(createToken(attribute.name, 'text-amber-700'))
  container.appendChild(createToken(' = ', 'text-gray-400'))

  // Check for forward references (this attribute references something else)
  const forwardReference = referenceContext ? detectReference(attribute, element, referenceContext) : null
  
  // Register the forward reference in the map
  if (forwardReference && referenceContext) {
    registerReferenceInMap(attribute, forwardReference, referenceContext)
  }

  // Check for reverse references (this attribute is referenced by something else)
  const reverseReferences =
    referenceContext?.referenceMap && referenceContext.sourcePath
      ? referenceContext.referenceMap.getReferencesTo(referenceContext.sourcePath, attribute.name, attribute.value)
      : []

  // If we have a forward reference OR reverse references, make it clickable
  if (forwardReference && forwardReference.targetPath) {
    const button = createReferenceButton(`"${attribute.value}"`, () => {
      referenceContext?.onReferenceNavigate?.({
        sourcePath: referenceContext.sourcePath ?? '',
        targetPath: forwardReference.targetPath,
        scrollTarget: forwardReference.scrollTarget
      })
    })
    button.title = `Open ${forwardReference.label}`
    container.appendChild(button)
  } else if (reverseReferences.length > 0) {
    // This is a target that is referenced from elsewhere
    const firstRef = reverseReferences[0]
    const label = reverseReferences.length === 1 
      ? `"${attribute.value}" (← ${firstRef.label ?? firstRef.sourcePath})`
      : `"${attribute.value}" (← ${reverseReferences.length} references)`
    
    const button = createReferenceButton(label, () => {
      // Navigate back to the first reference source
      referenceContext?.onReferenceNavigate?.({
        sourcePath: referenceContext.sourcePath ?? '',
        targetPath: firstRef.sourcePath,
        scrollTarget: { attribute: firstRef.sourceAttribute, value: firstRef.sourceValue }
      })
    })
    button.title = reverseReferences.length === 1
      ? `Go to reference in ${firstRef.sourcePath}`
      : `Go to reference (${reverseReferences.length} total)`
    button.className = 'text-blue-700 underline decoration-dotted underline-offset-4 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 rounded px-0.5'
    container.appendChild(button)
  } else {
    container.appendChild(createToken(`"${attribute.value}"`, 'text-emerald-700'))
  }

  return container
}

function renderTextNode(
  text: string,
  depth: number,
  lineNumber: number,
  tagMetadata?: TagMetadata | null
): HTMLDivElement | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const frag = document.createDocumentFragment()
  frag.appendChild(createToken(trimmed, 'text-slate-700'))
  const line = createLineRow(frag, depth, lineNumber)
  annotateLine(line, tagMetadata)
  return line
}

function renderCommentNode(
  text: string,
  depth: number,
  lineNumber: number,
  tagMetadata?: TagMetadata | null
): HTMLDivElement {
  const frag = document.createDocumentFragment()
  frag.appendChild(createToken('<!--', 'text-gray-400'))
  frag.appendChild(createToken(text, 'text-slate-500'))
  frag.appendChild(createToken('-->', 'text-gray-400'))
  const line = createLineRow(frag, depth, lineNumber)
  annotateLine(line, tagMetadata)
  return line
}

function isAnchorAttribute(attribute: Attr): boolean {
  const name = attribute.name.toLowerCase()
  return name === 'id' || name.endsWith(':id') || name.endsWith('id')
}

function renderElement(
  element: Element,
  depth: number,
  lineCounter: { current: number },
  referenceIndex: ReferenceIndex,
  referenceContext: ReferenceDetectionContext | undefined,
  lineRegistry: Map<number, HTMLDivElement>,
  namespaceSet: Set<string>,
  elementNames: Set<string>
): HTMLDivElement {
  const container = document.createElement('div')
  container.className = 'space-y-0'

  const tagMetadata = describeTag(element.tagName)
  namespaceSet.add(tagMetadata.namespace)
  elementNames.add(tagMetadata.localName)

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

  const anchorAttributes: Attr[] = []

  for (const attr of Array.from(element.attributes)) {
    openTag.appendChild(document.createTextNode(' '))
    openTag.appendChild(createAttributeTokens(attr, element, referenceContext))

    if (isAnchorAttribute(attr)) {
      anchorAttributes.push(attr)
    }
  }

  openTag.appendChild(createToken('>', 'text-gray-400'))

  const openLineNumber = lineCounter.current++
  const openLine = createLineRow(openTag, depth, openLineNumber, toggle)
  annotateLine(openLine, tagMetadata)
  container.appendChild(openLine)
  lineRegistry.set(openLineNumber, openLine)

  for (const attr of anchorAttributes) {
    referenceIndex.register(attr.name, attr.value, openLine)
  }

  const childrenWrapper = document.createElement('div')
  container.appendChild(childrenWrapper)

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      childrenWrapper.appendChild(
        renderElement(
          child as Element,
          depth + 1,
          lineCounter,
          referenceIndex,
          referenceContext,
          lineRegistry,
          namespaceSet,
          elementNames
        )
      )
    } else if (child.nodeType === Node.TEXT_NODE) {
      const lineNumber = lineCounter.current
      const textLine = renderTextNode(child.textContent ?? '', depth + 1, lineNumber, tagMetadata)
      if (textLine) {
        lineCounter.current += 1
        childrenWrapper.appendChild(textLine)
        lineRegistry.set(lineNumber, textLine)
      }
    } else if (child.nodeType === Node.COMMENT_NODE) {
      const commentLineNumber = lineCounter.current++
      const commentLine = renderCommentNode(child.textContent ?? '', depth + 1, commentLineNumber, tagMetadata)
      childrenWrapper.appendChild(commentLine)
      lineRegistry.set(commentLineNumber, commentLine)
    }
  }

  const closeTag = document.createDocumentFragment()
  closeTag.appendChild(createToken('</', 'text-gray-400'))
  closeTag.appendChild(createToken(element.tagName, 'text-indigo-700 font-semibold'))
  closeTag.appendChild(createToken('>', 'text-gray-400'))

  const closeLineNumber = lineCounter.current++
  const closeLine = createLineRow(closeTag, depth, closeLineNumber)
  annotateLine(closeLine, tagMetadata)
  container.appendChild(closeLine)
  lineRegistry.set(closeLineNumber, closeLine)

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
  container.className = 'rounded-lg border border-gray-200 bg-white flex flex-col'

  const controls = document.createElement('div')
  controls.className =
    'px-4 py-2 border-b border-gray-200 bg-white sticky top-0 z-10 flex flex-col gap-2 text-sm'

  const searchRow = document.createElement('div')
  searchRow.className = 'w-full flex flex-wrap items-center gap-2'
  const searchInput = document.createElement('input')
  searchInput.type = 'search'
  searchInput.className =
    'flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
  searchInput.placeholder = 'Search in this file'

  const prevBtn = document.createElement('button')
  prevBtn.type = 'button'
  prevBtn.className =
    'px-2 py-1 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50'
  prevBtn.textContent = 'Prev'

  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className =
    'px-2 py-1 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50'
  nextBtn.textContent = 'Next'

  const matchStatus = document.createElement('span')
  matchStatus.className = 'text-xs text-gray-600'
  matchStatus.textContent = '0 / 0'

  searchRow.append(searchInput, prevBtn, nextBtn, matchStatus)

  const overlayRow = document.createElement('div')
  overlayRow.className = 'w-full flex flex-wrap items-center gap-2 text-xs text-gray-700'

  const namespaceSelect = document.createElement('select')
  namespaceSelect.className =
    'rounded-md border border-gray-200 bg-white px-2 py-1 text-xs min-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-300'
  namespaceSelect.innerHTML = '<option value=\"\">All namespaces</option>'
  namespaceSelect.title = 'Focus on a specific namespace prefix'

  const dimNamespaceLabel = document.createElement('label')
  dimNamespaceLabel.className = 'inline-flex items-center gap-1'
  const dimNamespaceToggle = document.createElement('input')
  dimNamespaceToggle.type = 'checkbox'
  dimNamespaceToggle.className = 'rounded border-gray-300'
  dimNamespaceToggle.disabled = true
  const dimNamespaceText = document.createElement('span')
  dimNamespaceText.textContent = 'Dim others'
  dimNamespaceLabel.append(dimNamespaceToggle, dimNamespaceText)

  const elementSelect = document.createElement('select')
  elementSelect.className =
    'rounded-md border border-gray-200 bg-white px-2 py-1 text-xs min-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-300'
  elementSelect.innerHTML = '<option value=\"\">Highlight element type</option>'
  elementSelect.title = 'Highlight all instances of a tag'

  const stackingLabel = document.createElement('label')
  stackingLabel.className = 'inline-flex items-center gap-1'
  const stackingToggle = document.createElement('input')
  stackingToggle.type = 'checkbox'
  stackingToggle.className = 'rounded border-gray-300'
  stackingToggle.checked = true
  const stackingText = document.createElement('span')
  stackingText.textContent = 'Combine overlays'
  stackingLabel.append(stackingToggle, stackingText)

  overlayRow.append(namespaceSelect, dimNamespaceLabel, elementSelect, stackingLabel)

  controls.append(searchRow, overlayRow)

  const scrollContainer = document.createElement('div')
  scrollContainer.className = 'overflow-auto max-h-[700px]'

  const body = document.createElement('div')
  body.className = 'p-4 bg-slate-50'
  scrollContainer.appendChild(body)
  container.append(controls, scrollContainer)

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

    return {
      element: container,
      scrollToAnchor() {
        return false
      }
    }
  }

  const namespaces = new Set<string>()
  const elementNames = new Set<string>()
  const lineRegistry = new Map<number, HTMLDivElement>()
  const lineCounter = { current: 1 }
  const root = doc.documentElement
  const referenceIndex = createReferenceIndex()
  const referenceContext: ReferenceDetectionContext | undefined =
    options.path !== undefined
      ? {
          sourcePath: options.path,
          relationshipsBySource: options.relationshipsBySource,
          referenceMap: options.referenceMap,
          onReferenceNavigate: options.onReferenceNavigate
        }
      : undefined

  body.appendChild(
    renderElement(
      root,
      0,
      lineCounter,
      referenceIndex,
      referenceContext,
      lineRegistry,
      namespaces,
      elementNames
    )
  )

  const overlayState = {
    focusNamespace: null as string | null,
    highlightElement: null as string | null,
    dimOtherNamespaces: false,
    allowCombination: true
  }

  function refreshOverlayOptions(): void {
    const currentNamespace = namespaceSelect.value
    const currentElement = elementSelect.value

    namespaceSelect.innerHTML = ''
    const namespaceDefault = document.createElement('option')
    namespaceDefault.value = ''
    namespaceDefault.textContent = 'All namespaces'
    namespaceSelect.appendChild(namespaceDefault)

    for (const ns of Array.from(namespaces).sort((a, b) => a.localeCompare(b))) {
      const option = document.createElement('option')
      option.value = ns
      option.textContent = ns === DEFAULT_NAMESPACE_LABEL ? `${ns}` : ns
      namespaceSelect.appendChild(option)
    }

    if (currentNamespace && namespaces.has(currentNamespace)) {
      namespaceSelect.value = currentNamespace
    }

    elementSelect.innerHTML = ''
    const elementDefault = document.createElement('option')
    elementDefault.value = ''
    elementDefault.textContent = 'Highlight element type'
    elementSelect.appendChild(elementDefault)

    for (const elementName of Array.from(elementNames).sort((a, b) => a.localeCompare(b))) {
      const option = document.createElement('option')
      option.value = elementName
      option.textContent = elementName
      elementSelect.appendChild(option)
    }

    if (currentElement && elementNames.has(currentElement)) {
      elementSelect.value = currentElement
    }

    dimNamespaceToggle.disabled = !namespaceSelect.value
  }

  const updateOverlayStyles = (): void => {
    applyOverlayStyles(lineRegistry.values(), overlayState)
  }

  namespaceSelect.addEventListener('change', () => {
    overlayState.focusNamespace = namespaceSelect.value || null
    if (!overlayState.allowCombination && overlayState.focusNamespace) {
      overlayState.highlightElement = null
      elementSelect.value = ''
    }
    if (!overlayState.focusNamespace) {
      overlayState.dimOtherNamespaces = false
      dimNamespaceToggle.checked = false
    }
    dimNamespaceToggle.disabled = !overlayState.focusNamespace
    updateOverlayStyles()
  })

  dimNamespaceToggle.addEventListener('change', () => {
    overlayState.dimOtherNamespaces = dimNamespaceToggle.checked
    updateOverlayStyles()
  })

  elementSelect.addEventListener('change', () => {
    overlayState.highlightElement = elementSelect.value || null
    if (!overlayState.allowCombination && overlayState.highlightElement) {
      overlayState.focusNamespace = null
      namespaceSelect.value = ''
      overlayState.dimOtherNamespaces = false
      dimNamespaceToggle.checked = false
      dimNamespaceToggle.disabled = true
    }
    updateOverlayStyles()
  })

  stackingToggle.addEventListener('change', () => {
    overlayState.allowCombination = stackingToggle.checked
    if (!overlayState.allowCombination && overlayState.focusNamespace && overlayState.highlightElement) {
      overlayState.highlightElement = null
      elementSelect.value = ''
    }
    updateOverlayStyles()
  })

  refreshOverlayOptions()
  updateOverlayStyles()

  let matches: { lineNumber: number; element: HTMLDivElement }[] = []
  let activeMatchIndex = -1

  function clearMatchStyles(): void {
    for (const element of lineRegistry.values()) {
      element.classList.remove('bg-amber-50', 'ring-2', 'ring-amber-500')
    }
  }

  function updateNavigationState(): void {
    const total = matches.length
    const current = activeMatchIndex >= 0 ? activeMatchIndex + 1 : 0
    matchStatus.textContent = `${current} / ${total}`
    prevBtn.disabled = total === 0
    nextBtn.disabled = total === 0
  }

  function focusMatch(index: number): void {
    if (matches.length === 0) {
      activeMatchIndex = -1
      updateNavigationState()
      return
    }

    activeMatchIndex = ((index % matches.length) + matches.length) % matches.length
    clearMatchStyles()

    matches.forEach((match) => match.element.classList.add('bg-amber-50'))

    const active = matches[activeMatchIndex]
    active.element.classList.add('ring-2', 'ring-amber-500')
    active.element.scrollIntoView({ block: 'center', behavior: 'smooth' })

    updateNavigationState()
  }

  function runLocalSearch(query: string): void {
    const normalizedQuery = query.trim().toLowerCase()
    matches = []
    activeMatchIndex = -1
    clearMatchStyles()

    if (!normalizedQuery) {
      updateNavigationState()
      return
    }

    const lines = Array.from(lineRegistry.entries()).sort((a, b) => a[0] - b[0])
    for (const [lineNumber, element] of lines) {
      const text = (element.dataset.codeText ?? '').toLowerCase()
      let index = text.indexOf(normalizedQuery)
      while (index !== -1) {
        matches.push({ lineNumber, element })
        index = text.indexOf(normalizedQuery, index + normalizedQuery.length || index + 1)
      }
    }

    focusMatch(0)
  }

  function scrollToLine(target: ScrollTarget): boolean {
    const exact = target.lineNumber !== undefined ? lineRegistry.get(target.lineNumber) : undefined
    if (exact) {
      exact.scrollIntoView({ block: 'center', behavior: 'smooth' })
      exact.classList.add('bg-amber-50')
      setTimeout(() => exact.classList.remove('bg-amber-50'), 1200)
      return true
    }

    const searchText = target.lineText ?? target.searchQuery
    if (searchText) {
      const match = Array.from(lineRegistry.values()).find((line) =>
        (line.dataset.codeText ?? '').toLowerCase().includes(searchText.toLowerCase())
      )
      if (match) {
        match.scrollIntoView({ block: 'center', behavior: 'smooth' })
        match.classList.add('bg-amber-50')
        setTimeout(() => match.classList.remove('bg-amber-50'), 1200)
        return true
      }
    }

    return false
  }

  prevBtn.addEventListener('click', () => focusMatch(activeMatchIndex - 1))
  nextBtn.addEventListener('click', () => focusMatch(activeMatchIndex + 1))
  searchInput.addEventListener('input', () => runLocalSearch(searchInput.value))
  updateNavigationState()

  return {
    element: container,
    scrollToAnchor(target: ScrollTarget) {
      if (target.searchQuery) {
        searchInput.value = target.searchQuery
        runLocalSearch(target.searchQuery)
        const targetIndex = target.lineNumber
          ? matches.findIndex((match) => match.lineNumber === target.lineNumber)
          : 0
        focusMatch(targetIndex >= 0 ? targetIndex : 0)
        return matches.length > 0
      }

      if (target.lineNumber !== undefined || target.lineText) {
        return scrollToLine(target)
      }

      return referenceIndex.scrollTo(target)
    }
  }
}
