import { RelationshipsBySource } from '../../core/relationships'
import { ReferenceNavigationDetail, ScrollTarget } from '../events'
import { ReferenceMapHandle } from '../../core/reference-map'

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
  span.textContent = text
  return span
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

function resolveFootnoteReference(attribute: Attr, element: Element, context: ReferenceDetectionContext): AttributeReference | null {
  if (context.sourcePath === undefined || !context.relationshipsBySource) return null

  const tagName = element.tagName.toLowerCase()
  const attrName = attribute.name.toLowerCase()
  const value = attribute.value

  const isFootnoteReference = tagName.includes('footnote') && attrName.endsWith('id') && /^\d+$/.test(value)
  if (!isFootnoteReference) return null

  const relationships = context.relationshipsBySource[context.sourcePath]
  const footnoteRelationship = Object.values(relationships ?? {}).find((rel) =>
    (rel.type ?? '').toLowerCase().includes('/footnotes')
  )

  if (!footnoteRelationship) return null

  return {
    targetPath: footnoteRelationship.resolvedTarget,
    label: `footnote ${value}`,
    scrollTarget: { attribute: attribute.name, value }
  }
}

function resolveEndnoteReference(attribute: Attr, element: Element, context: ReferenceDetectionContext): AttributeReference | null {
  if (context.sourcePath === undefined || !context.relationshipsBySource) return null

  const tagName = element.tagName.toLowerCase()
  const attrName = attribute.name.toLowerCase()
  const value = attribute.value

  const isEndnoteReference = tagName.includes('endnote') && attrName.endsWith('id') && /^\d+$/.test(value)
  if (!isEndnoteReference) return null

  const relationships = context.relationshipsBySource[context.sourcePath]
  const endnoteRelationship = Object.values(relationships ?? {}).find((rel) =>
    (rel.type ?? '').toLowerCase().includes('/endnotes')
  )

  if (!endnoteRelationship) return null

  return {
    targetPath: endnoteRelationship.resolvedTarget,
    label: `endnote ${value}`,
    scrollTarget: { attribute: attribute.name, value }
  }
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
  code.className = 'font-mono text-[13px] whitespace-pre leading-6 text-slate-800 flex items-start gap-2'
  code.style.paddingLeft = `${depth * 12}px`
  code.appendChild(content)

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

function createAttributeTokens(attribute: Attr, element: Element, referenceContext?: ReferenceDetectionContext): DocumentFragment {
  const frag = document.createDocumentFragment()
  frag.appendChild(createToken(attribute.name, 'text-amber-700'))
  frag.appendChild(createToken('=', 'text-gray-400'))

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
    frag.appendChild(button)
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
    frag.appendChild(button)
  } else {
    frag.appendChild(createToken(`"${attribute.value}"`, 'text-emerald-700'))
  }

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

function isAnchorAttribute(attribute: Attr): boolean {
  const name = attribute.name.toLowerCase()
  return name === 'id' || name.endsWith(':id') || name.endsWith('id')
}

function renderElement(
  element: Element,
  depth: number,
  lineCounter: { current: number },
  referenceIndex: ReferenceIndex,
  referenceContext?: ReferenceDetectionContext
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

  const anchorAttributes: Attr[] = []

  for (const attr of Array.from(element.attributes)) {
    openTag.appendChild(document.createTextNode(' '))
    openTag.appendChild(createAttributeTokens(attr, element, referenceContext))

    if (isAnchorAttribute(attr)) {
      anchorAttributes.push(attr)
    }
  }

  openTag.appendChild(createToken('>', 'text-gray-400'))

  const openLine = createLineRow(openTag, depth, lineCounter.current++, toggle)
  container.appendChild(openLine)

  for (const attr of anchorAttributes) {
    referenceIndex.register(attr.name, attr.value, openLine)
  }

  const childrenWrapper = document.createElement('div')
  container.appendChild(childrenWrapper)

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      childrenWrapper.appendChild(renderElement(child as Element, depth + 1, lineCounter, referenceIndex, referenceContext))
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

    return {
      element: container,
      scrollToAnchor() {
        return false
      }
    }
  }

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

  body.appendChild(renderElement(root, 0, lineCounter, referenceIndex, referenceContext))

  return {
    element: container,
    scrollToAnchor(target: ScrollTarget) {
      return referenceIndex.scrollTo(target)
    }
  }
}
