import { type Readable, type Writable, writable } from 'svelte/store'

export interface HistoryEntry<T> {
  state: T
  description?: string
  timestamp: number
}

export interface HistoryOptions<T> {
  capacity?: number
  initialState?: T
}

export interface KeyboardShortcutOptions<T> {
  onUndo?: (state: T | undefined) => void
  onRedo?: (state: T | undefined) => void
  shouldIgnore?: (event: KeyboardEvent) => boolean
}

/**
 * Deep clone an object to guarantee immutability across snapshots.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Fallback if structuredClone fails on non-serializable properties
    }
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return customClone(value)
  }
}

function customClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => customClone(item)) as unknown as T
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T
  }

  if (value instanceof Set) {
    const copy = new Set()
    for (const item of value) {
      copy.add(customClone(item))
    }
    return copy as unknown as T
  }

  if (value instanceof Map) {
    const copy = new Map()
    for (const [k, v] of value) {
      copy.set(customClone(k), customClone(v))
    }
    return copy as unknown as T
  }

  const copy = {} as Record<string, unknown>
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    copy[key] = customClone(val)
  }
  return copy as T
}

/**
 * HistoryStore maintains an in-memory bounded ring buffer of snapshots,
 * transaction management for grouping batch edits into atomic undo steps,
 * and reactive Svelte readable stores.
 */
export class HistoryStore<T> {
  private readonly capacity: number
  private snapshots: HistoryEntry<T>[] = []
  private currentIndex: number = -1

  private isTransactionActive: boolean = false
  private transactionInitialState: T | undefined = undefined
  private transactionCurrentState: T | undefined = undefined

  private readonly _canUndo: Writable<boolean> = writable(false)
  private readonly _canRedo: Writable<boolean> = writable(false)
  private readonly _historyLength: Writable<number> = writable(0)
  private readonly _currentState: Writable<T | undefined> = writable(undefined)
  private readonly _inTransaction: Writable<boolean> = writable(false)

  public readonly canUndo: Readable<boolean> = { subscribe: this._canUndo.subscribe }
  public readonly canRedo: Readable<boolean> = { subscribe: this._canRedo.subscribe }
  public readonly historyLength: Readable<number> = { subscribe: this._historyLength.subscribe }
  public readonly currentState: Readable<T | undefined> = { subscribe: this._currentState.subscribe }
  public readonly inTransaction: Readable<boolean> = { subscribe: this._inTransaction.subscribe }

  constructor(options: HistoryOptions<T> = {}) {
    this.capacity = options.capacity && options.capacity > 0 ? options.capacity : 50

    if (options.initialState !== undefined) {
      this.push(options.initialState, 'Initial State')
    }
  }

  /**
   * Pushes a new state into the history buffer.
   * Discards any branching redo history.
   * If capacity is exceeded, the oldest entry is removed.
   */
  public push(state: T, description?: string): T {
    const cloned = deepClone(state)

    // Prune any redo forward history if we are in the middle of history
    if (this.currentIndex < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.currentIndex + 1)
    }

    // Bounded ring buffer: drop oldest snapshot if capacity is reached
    if (this.snapshots.length >= this.capacity) {
      this.snapshots.shift()
    }

    const entry: HistoryEntry<T> = {
      state: cloned,
      description,
      timestamp: Date.now(),
    }

    this.snapshots.push(entry)
    this.currentIndex = this.snapshots.length - 1

    this.updateStores()
    return deepClone(cloned)
  }

  /**
   * Undoes the last action, moving back one step in history.
   * Returns deep clone of previous state or undefined if cannot undo.
   */
  public undo(): T | undefined {
    if (this.currentIndex <= 0 || this.snapshots.length === 0) {
      return undefined
    }

    this.currentIndex--
    this.updateStores()

    return deepClone(this.snapshots[this.currentIndex].state)
  }

  /**
   * Redoes the next action, moving forward one step in history.
   * Returns deep clone of next state or undefined if cannot redo.
   */
  public redo(): T | undefined {
    if (this.currentIndex >= this.snapshots.length - 1 || this.snapshots.length === 0) {
      return undefined
    }

    this.currentIndex++
    this.updateStores()

    return deepClone(this.snapshots[this.currentIndex].state)
  }

  /**
   * Clears the history buffer and resets transaction state.
   */
  public clear(): void {
    this.snapshots = []
    this.currentIndex = -1
    this.isTransactionActive = false
    this.transactionInitialState = undefined
    this.transactionCurrentState = undefined

    this._inTransaction.set(false)
    this.updateStores()
  }

  /**
   * Begins a batch transaction. Subsequent edits via updateTransaction
   * will not create individual undo history entries.
   */
  public startTransaction(initialState?: T): void {
    this.isTransactionActive = true
    this._inTransaction.set(true)

    if (initialState !== undefined) {
      this.transactionInitialState = deepClone(initialState)
    } else if (this.currentIndex >= 0 && this.currentIndex < this.snapshots.length) {
      this.transactionInitialState = deepClone(this.snapshots[this.currentIndex].state)
    } else {
      this.transactionInitialState = undefined
    }

    this.transactionCurrentState = this.transactionInitialState !== undefined
      ? deepClone(this.transactionInitialState)
      : undefined
  }

  /**
   * Updates the in-flight state of the active transaction.
   */
  public updateTransaction(state: T): void {
    if (!this.isTransactionActive) {
      this.startTransaction(state)
    }
    this.transactionCurrentState = deepClone(state)
  }

  /**
   * Commits the active transaction as a single undo step in history.
   */
  public commitTransaction(description?: string): T | undefined {
    if (!this.isTransactionActive) {
      return undefined
    }

    const stateToCommit = this.transactionCurrentState !== undefined
      ? this.transactionCurrentState
      : this.transactionInitialState

    this.isTransactionActive = false
    this.transactionInitialState = undefined
    this.transactionCurrentState = undefined
    this._inTransaction.set(false)

    if (stateToCommit !== undefined) {
      return this.push(stateToCommit, description)
    }

    return undefined
  }

  /**
   * Cancels the active transaction and returns the initial state prior to the transaction.
   */
  public cancelTransaction(): T | undefined {
    if (!this.isTransactionActive) {
      return undefined
    }

    const revertedState = this.transactionInitialState !== undefined
      ? deepClone(this.transactionInitialState)
      : undefined

    this.isTransactionActive = false
    this.transactionInitialState = undefined
    this.transactionCurrentState = undefined
    this._inTransaction.set(false)

    return revertedState
  }

  /**
   * Returns current state clone.
   */
  public getCurrent(): T | undefined {
    if (this.currentIndex < 0 || this.currentIndex >= this.snapshots.length) {
      return undefined
    }
    return deepClone(this.snapshots[this.currentIndex].state)
  }

  /**
   * Returns current history length.
   */
  public getLength(): number {
    return this.snapshots.length
  }

  /**
   * Returns current pointer index.
   */
  public getIndex(): number {
    return this.currentIndex
  }

  /**
   * Returns snapshots metadata array.
   */
  public getEntries(): ReadonlyArray<Omit<HistoryEntry<T>, 'state'>> {
    return this.snapshots.map(({ description, timestamp }) => ({ description, timestamp }))
  }

  /**
   * Returns whether a transaction is currently active.
   */
  public isInTransaction(): boolean {
    return this.isTransactionActive
  }

  /**
   * Returns max capacity.
   */
  public getCapacity(): number {
    return this.capacity
  }

  /**
   * Binds global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z) to undo/redo.
   * Returns an unbind cleanup function.
   */
  public bindKeyboardShortcuts(
    target?: Window | Document | HTMLElement,
    options?: KeyboardShortcutOptions<T>,
  ): () => void {
    return attachKeyboardShortcuts(this, target, options)
  }

  private updateStores(): void {
    const canUndoValue = this.currentIndex > 0
    const canRedoValue = this.currentIndex >= 0 && this.currentIndex < this.snapshots.length - 1
    const current = this.currentIndex >= 0 && this.currentIndex < this.snapshots.length
      ? deepClone(this.snapshots[this.currentIndex].state)
      : undefined

    this._canUndo.set(canUndoValue)
    this._canRedo.set(canRedoValue)
    this._historyLength.set(this.snapshots.length)
    this._currentState.set(current)
  }
}

/**
 * Creates a new HistoryStore instance.
 */
export function createHistoryStore<T>(options?: HistoryOptions<T>): HistoryStore<T> {
  return new HistoryStore<T>(options)
}

/**
 * Attaches global keyboard listeners for Undo / Redo operations.
 */
export function attachKeyboardShortcuts<T>(
  historyStore: HistoryStore<T>,
  target?: Window | Document | HTMLElement,
  options: KeyboardShortcutOptions<T> = {},
): () => void {
  const resolvedTarget = target || (typeof window !== 'undefined' ? window : undefined)

  if (!resolvedTarget || typeof (resolvedTarget as EventTarget).addEventListener !== 'function') {
    return () => {}
  }

  const handler = (event: Event) => {
    const keyEvent = event as KeyboardEvent
    if (!keyEvent || typeof keyEvent.key !== 'string') return

    if (options.shouldIgnore && options.shouldIgnore(keyEvent)) {
      return
    }

    // Ignore when focused on native input controls to preserve default text editing
    if (typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null
      if (
        active
        && (active.tagName === 'INPUT'
          || active.tagName === 'TEXTAREA'
          || active.tagName === 'SELECT'
          || active.isContentEditable)
      ) {
        return
      }
    }

    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
    const isModifier = isMac ? keyEvent.metaKey : keyEvent.ctrlKey

    if (!isModifier) return

    const key = keyEvent.key.toLowerCase()

    // Undo: Ctrl+Z / Cmd+Z (without Shift)
    if (key === 'z' && !keyEvent.shiftKey) {
      keyEvent.preventDefault()
      const restored = historyStore.undo()
      options.onUndo?.(restored)
      return
    }

    // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
    if (key === 'y' || (key === 'z' && keyEvent.shiftKey)) {
      keyEvent.preventDefault()
      const restored = historyStore.redo()
      options.onRedo?.(restored)
      return
    }
  }

  resolvedTarget.addEventListener('keydown', handler)
  return () => {
    resolvedTarget.removeEventListener('keydown', handler)
  }
}
