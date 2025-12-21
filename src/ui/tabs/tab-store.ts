import { FileEventDetail } from '../events'

export interface TabRecord extends FileEventDetail {
  content?: string
}

export interface TabStoreHandle {
  open(detail: FileEventDetail, content?: string): void
  close(path: string): void
  closeAll(): void
  focus(path: string): void
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

  function open(detail: FileEventDetail, content?: string): void {
    const existing = state.tabs.find((tab) => tab.path === detail.path)
    if (existing) {
      state = { ...state, activePath: detail.path }
      notify()
      return
    }

    const tab: TabRecord = { ...detail, content }
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

  function focus(path: string): void {
    if (state.activePath === path || !state.tabs.find((tab) => tab.path === path)) return
    state = { ...state, activePath: path }
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
