export type FileKind = 'xml' | 'image' | 'binary'

export interface FileEventDetail {
  path: string
  name: string
  kind: FileKind
}

export const FILE_OPENED = 'FILE_OPENED'
export const IMAGE_PREVIEW_REQUESTED = 'IMAGE_PREVIEW_REQUESTED'

/**
 * Shared event target for UI coordination.
 */
export const appEvents = new EventTarget()

export function publishFileOpened(detail: FileEventDetail, target: EventTarget = appEvents): void {
  target.dispatchEvent(new CustomEvent<FileEventDetail>(FILE_OPENED, { detail }))
}

export function publishImagePreview(detail: FileEventDetail, target: EventTarget = appEvents): void {
  target.dispatchEvent(new CustomEvent<FileEventDetail>(IMAGE_PREVIEW_REQUESTED, { detail }))
}
