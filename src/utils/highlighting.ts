export const DEFAULT_NAMESPACE_LABEL = '(no prefix)'

export interface TagMetadata {
  namespace: string
  localName: string
  tagName: string
}

export interface OverlayState {
  focusNamespace?: string | null
  highlightElement?: string | null
  dimOtherNamespaces: boolean
  allowCombination: boolean
}

const HIGHLIGHT_CLASSES = ['ring-1', 'ring-indigo-200', 'ring-inset', 'bg-indigo-50', 'shadow-sm']
const DIM_CLASSES = ['opacity-50']

export function describeTag(tagName: string): TagMetadata {
  const normalized = tagName.trim()
  const [namespace, ...rest] = normalized.split(':')

  if (rest.length === 0) {
    return { namespace: DEFAULT_NAMESPACE_LABEL, localName: normalized, tagName: normalized }
  }

  return {
    namespace: namespace || DEFAULT_NAMESPACE_LABEL,
    localName: rest.join(':') || normalized,
    tagName: normalized
  }
}

function clearOverlayClasses(line: HTMLElement): void {
  line.classList.remove(...HIGHLIGHT_CLASSES, ...DIM_CLASSES)
}

export function applyOverlayStyles(lines: Iterable<HTMLElement>, state: OverlayState): void {
  const focusNamespace = state.focusNamespace?.trim() || null
  const targetElement = state.highlightElement?.trim() || null
  const dimOthers = state.dimOtherNamespaces && Boolean(focusNamespace)

  for (const line of lines) {
    clearOverlayClasses(line)

    const lineNamespace = line.dataset.namespace ?? ''
    const lineElement = line.dataset.elementType ?? ''

    const matchesNamespace = focusNamespace ? lineNamespace === focusNamespace : false
    const matchesElement = targetElement ? lineElement === targetElement : false

    const shouldHighlight = state.allowCombination
      ? matchesNamespace || matchesElement
      : matchesElement || (matchesNamespace && !matchesElement)

    if (shouldHighlight) {
      line.classList.add(...HIGHLIGHT_CLASSES)
    }

    if (dimOthers && !matchesNamespace) {
      line.classList.add(...DIM_CLASSES)
    }
  }
}
