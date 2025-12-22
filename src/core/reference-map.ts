/**
 * Reference map tracks bidirectional relationships between XML elements.
 * This enables forward navigation (source → target) and reverse navigation (target → source).
 */

export interface ReferenceSource {
  /** Path to the source document */
  sourcePath: string
  /** Attribute name that contains the reference */
  sourceAttribute: string
  /** Value of the reference attribute */
  sourceValue: string
  /** Label for display purposes */
  label?: string
}

export interface ReferenceTarget {
  /** Path to the target document */
  targetPath: string
  /** Attribute name in the target that matches this reference */
  targetAttribute: string
  /** Value of the target attribute */
  targetValue: string
}

/**
 * A reference link connects a source and target
 */
export interface ReferenceLink extends ReferenceSource, ReferenceTarget {}

/**
 * Key format: "path::attribute::value"
 */
function createReferenceKey(path: string, attribute: string, value: string): string {
  return `${path}::${attribute.toLowerCase()}::${value}`
}

export interface ReferenceMapHandle {
  /** Register a bidirectional reference */
  addReference(link: ReferenceLink): void
  
  /** Get all references from a specific source */
  getReferencesFrom(path: string, attribute: string, value: string): ReferenceTarget[]
  
  /** Get all references to a specific target (reverse navigation) */
  getReferencesTo(path: string, attribute: string, value: string): ReferenceSource[]
  
  /** Clear all references */
  clear(): void
}

export function createReferenceMap(): ReferenceMapHandle {
  // Forward map: source -> targets
  const forwardMap = new Map<string, ReferenceTarget[]>()
  
  // Reverse map: target -> sources
  const reverseMap = new Map<string, ReferenceSource[]>()

  function addReference(link: ReferenceLink): void {
    const sourceKey = createReferenceKey(link.sourcePath, link.sourceAttribute, link.sourceValue)
    const targetKey = createReferenceKey(link.targetPath, link.targetAttribute, link.targetValue)

    // Add to forward map
    const existingTargets = forwardMap.get(sourceKey) ?? []
    forwardMap.set(sourceKey, [
      ...existingTargets,
      {
        targetPath: link.targetPath,
        targetAttribute: link.targetAttribute,
        targetValue: link.targetValue
      }
    ])

    // Add to reverse map
    const existingSources = reverseMap.get(targetKey) ?? []
    reverseMap.set(targetKey, [
      ...existingSources,
      {
        sourcePath: link.sourcePath,
        sourceAttribute: link.sourceAttribute,
        sourceValue: link.sourceValue,
        label: link.label
      }
    ])
  }

  function getReferencesFrom(path: string, attribute: string, value: string): ReferenceTarget[] {
    const key = createReferenceKey(path, attribute, value)
    return forwardMap.get(key) ?? []
  }

  function getReferencesTo(path: string, attribute: string, value: string): ReferenceSource[] {
    const key = createReferenceKey(path, attribute, value)
    return reverseMap.get(key) ?? []
  }

  function clear(): void {
    forwardMap.clear()
    reverseMap.clear()
  }

  return {
    addReference,
    getReferencesFrom,
    getReferencesTo,
    clear
  }
}
