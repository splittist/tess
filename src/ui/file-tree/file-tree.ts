import { PackageFile, PackageModel } from '../../core/zip-loader'
import {
  FILE_OPENED,
  FileEventDetail,
  FileKind,
  IMAGE_PREVIEW_REQUESTED,
  appEvents,
  publishFileOpened,
  publishImagePreview
} from '../events'

interface FileTreeOptions {
  model: PackageModel
  eventTarget?: EventTarget
}

interface FileTreeHandle {
  element: HTMLElement
  update(model: PackageModel): void
}

interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  children: TreeNode[]
  file?: PackageFile
}

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'])

function isImageFile(file: PackageFile): boolean {
  return imageExtensions.has(file.metadata.extension.toLowerCase())
}

function toFileKind(file: PackageFile): FileKind {
  if (file.metadata.isXml) return 'xml'
  if (isImageFile(file)) return 'image'
  return 'binary'
}

function buildTree(model: PackageModel): TreeNode[] {
  const root: TreeNode = {
    name: '',
    path: '',
    isFolder: true,
    children: []
  }

  for (const file of model.files) {
    const segments = file.metadata.path.split('/')
    const fileName = segments.pop() ?? file.metadata.path

    let parent = root
    let accumulatedPath = ''

    for (const segment of segments) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment
      let folderNode = parent.children.find((child) => child.isFolder && child.name === segment)
      if (!folderNode) {
        folderNode = {
          name: segment,
          path: accumulatedPath,
          isFolder: true,
          children: []
        }
        parent.children.push(folderNode)
      }
      parent = folderNode
    }

    const fileNode: TreeNode = {
      name: fileName,
      path: file.metadata.path,
      isFolder: false,
      children: [],
      file
    }
    parent.children.push(fileNode)
  }

  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .map((node) => ({
        ...node,
        children: sortNodes(node.children)
      }))
      .sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1
        if (!a.isFolder && b.isFolder) return 1
        return a.name.localeCompare(b.name)
      })
  }

  return sortNodes(root.children)
}

function createFolderRow(
  node: TreeNode,
  depth: number,
  onToggle: (path: string) => void,
  expanded: boolean,
  rerender: () => void
): HTMLElement {
  const row = document.createElement('div')
  row.className = 'flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-800 hover:bg-gray-100 rounded-md cursor-pointer'
  row.style.paddingLeft = `${depth * 12}px`

  const caret = document.createElement('span')
  caret.textContent = expanded ? '▾' : '▸'
  caret.className = 'text-gray-500'

  const icon = document.createElement('span')
  icon.textContent = '📁'

  const label = document.createElement('span')
  label.textContent = node.name

  row.append(caret, icon, label)
  row.addEventListener('click', () => {
    onToggle(node.path)
    rerender()
  })

  return row
}

function createBadge(kind: FileKind): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'text-[11px] font-semibold px-2 py-0.5 rounded-full border'

  if (kind === 'xml') {
    badge.textContent = 'XML'
    badge.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-200')
  } else if (kind === 'image') {
    badge.textContent = 'IMG'
    badge.classList.add('bg-green-50', 'text-green-700', 'border-green-200')
  } else {
    badge.textContent = 'BIN'
    badge.classList.add('bg-gray-50', 'text-gray-700', 'border-gray-200')
  }

  return badge
}

function createFileRow(node: TreeNode, depth: number, target: EventTarget): HTMLElement {
  const file = node.file!
  const kind = toFileKind(file)
  const row = document.createElement('button')
  row.type = 'button'
  row.className =
    'w-full flex items-center gap-2 px-2 py-1 text-sm text-left text-gray-800 rounded-md hover:bg-indigo-50 focus-visible:outline focus-visible:outline-indigo-300'
  row.style.paddingLeft = `${depth * 12}px`

  const icon = document.createElement('span')
  icon.textContent = kind === 'image' ? '🖼️' : '📄'

  const label = document.createElement('span')
  label.textContent = node.name
  label.className = 'flex-1 truncate'

  const badge = createBadge(kind)

  row.append(icon, label, badge)

  row.addEventListener('click', () => {
    const detail: FileEventDetail = {
      path: file.metadata.path,
      name: file.metadata.name,
      kind
    }
    if (kind === 'image') {
      publishImagePreview(detail, target)
    } else {
      publishFileOpened(detail, target)
    }
  })

  return row
}

function renderNodes(
  nodes: TreeNode[],
  container: HTMLElement,
  target: EventTarget,
  expandedFolders: Set<string>,
  rerender: () => void,
  depth = 0
): void {
  for (const node of nodes) {
    const item = document.createElement('li')
    item.setAttribute('role', 'treeitem')

    if (node.isFolder) {
      const isExpanded = !expandedFolders.has(node.path)
      const header = createFolderRow(
        node,
        depth,
        (path) => {
          if (expandedFolders.has(path)) {
            expandedFolders.delete(path)
          } else {
            expandedFolders.add(path)
          }
        },
        isExpanded,
        rerender
      )
      item.appendChild(header)
      if (node.children.length > 0) {
        const childList = document.createElement('ul')
        childList.className = isExpanded ? 'mt-1 space-y-1' : 'hidden'
        childList.setAttribute('role', 'group')
        renderNodes(node.children, childList, target, expandedFolders, rerender, depth + 1)
        item.appendChild(childList)
      }
    } else {
      item.appendChild(createFileRow(node, depth + 1, target))
    }

    container.appendChild(item)
  }
}

export function createFileTree(options: FileTreeOptions): FileTreeHandle {
  const target = options.eventTarget ?? appEvents
  let tree = buildTree(options.model)
  const expandedFolders = new Set<string>()

  const container = document.createElement('div')
  container.className = 'bg-white rounded-lg border border-gray-200 shadow-sm'

  const header = document.createElement('div')
  header.className = 'px-4 py-3 border-b border-gray-200 flex items-center justify-between'

  const title = document.createElement('h2')
  title.className = 'text-sm font-semibold uppercase tracking-wide text-gray-700'
  title.textContent = 'Package paths'

  const hint = document.createElement('span')
  hint.className = 'text-xs text-gray-500'
  hint.textContent = 'Click to open tabs or previews'

  header.append(title, hint)
  container.appendChild(header)

  const list = document.createElement('ul')
  list.className = 'p-3 space-y-1'
  list.setAttribute('role', 'tree')
  container.appendChild(list)

  function render(): void {
    list.innerHTML = ''
    renderNodes(tree, list, target, expandedFolders, render)
  }

  render()

  return {
    element: container,
    update(model: PackageModel) {
      tree = buildTree(model)
      expandedFolders.clear()
      render()
    }
  }
}

export { FILE_OPENED, IMAGE_PREVIEW_REQUESTED }
