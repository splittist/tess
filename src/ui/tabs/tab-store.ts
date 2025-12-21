import { FileEventDetail, ScrollTarget } from '../events'

export interface TabRecord extends FileEventDetail {
  content?: string
  scrollTarget?: ScrollTarget
}

export interface TabStoreHandle {
  open(detail: FileEventDetail, content?: string, scrollTarget?: ScrollTarget): void
  close(path: string): void
  closeAll(): void
  focus(path: string, scrollTarget?: ScrollTarget): void
  subscribe(listener: (state: TabStoreState) => void): () => void
  getState(): TabStoreState
}

export interface TabStoreState {
  tabs: TabRecord[]
  activePath: string | null
}

export function createTabStore(): TabStoreHandle {
  let state: TabStoreState = { tabs: [], activePath: null }
  const listeners = new Set<(state: TabStoreState) => void>()

  function notify(): void {
    for (const listener of listeners) listener(state)
  }

  function open(detail: FileEventDetail, content?: string, scrollTarget?: ScrollTarget): void {
    const existingIndex = state.tabs.findIndex((tab) => tab.path === detail.path)
    if (existingIndex >= 0) {
      const tabs = [...state.tabs]
      const existing = tabs[existingIndex]
      const updated = scrollTarget ? { ...existing, scrollTarget } : existing
      tabs[existingIndex] = updated
      state = { ...state, tabs, activePath: detail.path }
      notify()
      return
    }

    const tab: TabRecord = { ...detail, content, scrollTarget }
    state = {
      tabs: [...state.tabs, tab],
      activePath: detail.path
    }
    notify()
  }

  function close(path: string): void {
    const tabs = state.tabs.filter((tab) => tab.path !== path)
    const removedActive = state.activePath === path
    const nextActive = removedActive ? tabs[tabs.length - 1]?.path ?? null : state.activePath
    state = { tabs, activePath: nextActive }
    notify()
  }

  function closeAll(): void {
    state = { tabs: [], activePath: null }
    notify()
  }

  function focus(path: string, scrollTarget?: ScrollTarget): void {
    const index = state.tabs.findIndex((tab) => tab.path === path)
    if (index === -1) return

    const tabs = [...state.tabs]
    if (scrollTarget) {
      tabs[index] = { ...tabs[index], scrollTarget }
    }

    if (state.activePath === path && !scrollTarget) return

    state = { ...state, tabs, activePath: path }
    notify()
  }

  function subscribe(listener: (state: TabStoreState) => void): () => void {
    listeners.add(listener)
    listener(state)
    return () => listeners.delete(listener)
  }

  return {
    open,
    close,
    closeAll,
    focus,
    subscribe,
    getState() {
      return state
    }
  }
}
