import type { ColorScheme } from '$lib/3d/materials'
import type { ConfErrors } from '$lib/worker/check'
import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
import { derived, type Readable, type Writable, writable } from 'svelte/store'
import type { BufferGeometry, Matrix4 } from 'three'
import { attachKeyboardShortcuts, deepClone, HistoryStore, type KeyboardShortcutOptions } from './historyStore'

export type TempConfig = CosmosKeyboard & { fromProto: boolean }

export interface ReferenceModelEntry {
  id: number
  name: string
  geometry: BufferGeometry
  matrix: Matrix4
}

export interface EditorSelectionState {
  transformMode: 'translate' | 'rotate' | 'select'
  selectMode: 'key' | 'column' | 'cluster'
  openSelect: symbol | null
  hoveredKey: number | null
  clickedKey: number | null
  clickedSide: 'left' | 'right' | 'unibody' | 'center' | null
  lastKeycap: number
}

export interface EditorViewportState {
  viewer: string
  view: 'left' | 'right' | 'both'
  showGrid: boolean
  noWall: boolean
  noBase: boolean
  noBlanks: boolean
  noLabels: boolean
  showHand: boolean
  showHelp: boolean
  theme: ColorScheme
  referenceModels: ReferenceModelEntry[]
}

export interface EditorDiagnosticsState {
  confErrors: ConfErrors
  showErrorMsg: boolean
  codeError: Error | null
  developer: boolean
  showTiming: boolean
  showKeyInts: boolean
  showGizmo: boolean
  debugViewport: boolean
  noStitch: boolean
}

export interface EditorState {
  config: CosmosKeyboard | undefined
  tempConfig: TempConfig | undefined
  selection: EditorSelectionState
  viewport: EditorViewportState
  diagnostics: EditorDiagnosticsState
}

export const initialEditorSelectionState: EditorSelectionState = {
  transformMode: 'select',
  selectMode: 'key',
  openSelect: null,
  hoveredKey: null,
  clickedKey: null,
  clickedSide: null,
  lastKeycap: 0,
}

export const initialEditorViewportState: EditorViewportState = {
  viewer: '3d',
  view: 'both',
  showGrid: false,
  noWall: false,
  noBase: false,
  noBlanks: false,
  noLabels: false,
  showHand: true,
  showHelp: true,
  theme: 'purple',
  referenceModels: [],
}

export const initialEditorDiagnosticsState: EditorDiagnosticsState = {
  confErrors: [],
  showErrorMsg: false,
  codeError: null,
  developer: false,
  showTiming: false,
  showKeyInts: false,
  showGizmo: false,
  debugViewport: false,
  noStitch: false,
}

export const initialEditorState: EditorState = {
  config: undefined,
  tempConfig: undefined,
  selection: initialEditorSelectionState,
  viewport: initialEditorViewportState,
  diagnostics: initialEditorDiagnosticsState,
}

function createSliceStore<T>(
  rootStore: Writable<EditorState>,
  getter: (state: EditorState) => T,
  setter: (state: EditorState, value: T) => EditorState,
): Writable<T> {
  return {
    subscribe: (run, invalidate) => {
      let initialized = false
      let previous: T | undefined
      return rootStore.subscribe(
        state => {
          const current = getter(state)
          if (!initialized || current !== previous) {
            initialized = true
            previous = current
            run(current as T)
          }
        },
        invalidate ? (state?: EditorState) => invalidate(state ? (getter(state) as any) : undefined) : undefined,
      )
    },
    set: (value: T) => {
      rootStore.update(state => setter(state, value))
    },
    update: (updater: (val: T) => T) => {
      rootStore.update(state => {
        const current = getter(state)
        const updated = updater(current)
        return setter(state, updated)
      })
    },
  }
}

export class EditorStore implements Writable<EditorState> {
  private readonly store: Writable<EditorState>
  public readonly history: HistoryStore<CosmosKeyboard>
  private isInternalHistorySync: boolean = false
  private currentRawState: EditorState

  // Slices / backward-compatible stores
  public readonly protoConfig: Writable<CosmosKeyboard>
  public readonly tempConfig: Writable<TempConfig>
  public readonly transformMode: Writable<'translate' | 'rotate' | 'select'>
  public readonly selectMode: Writable<'key' | 'column' | 'cluster'>
  public readonly openSelect: Writable<symbol | null>
  public readonly hoveredKey: Writable<number | null>
  public readonly clickedKey: Writable<number | null>
  public readonly clickedSide: Writable<'left' | 'right' | 'unibody' | 'center' | null>
  public readonly lastKeycap: Writable<number>

  public readonly viewer: Writable<string>
  public readonly view: Writable<'left' | 'right' | 'both'>
  public readonly showGrid: Writable<boolean>
  public readonly noWall: Writable<boolean>
  public readonly noBase: Writable<boolean>
  public readonly noBlanks: Writable<boolean>
  public readonly noLabels: Writable<boolean>
  public readonly showHand: Writable<boolean>
  public readonly showHelp: Writable<boolean>
  public readonly theme: Writable<ColorScheme>
  public readonly referenceModels: Writable<ReferenceModelEntry[]>

  public readonly confError: Writable<ConfErrors>
  public readonly showErrorMsg: Writable<boolean>
  public readonly codeError: Writable<Error | null>
  public readonly developer: Writable<boolean>
  public readonly showTiming: Writable<boolean>
  public readonly showKeyInts: Writable<boolean>
  public readonly showGizmo: Writable<boolean>
  public readonly debugViewport: Writable<boolean>
  public readonly noStitch: Writable<boolean>

  public readonly canUndo: Readable<boolean>
  public readonly canRedo: Readable<boolean>
  public readonly historyLength: Readable<number>

  constructor(initialState: EditorState = initialEditorState) {
    this.currentRawState = deepClone(initialState)
    this.store = writable<EditorState>(this.currentRawState)
    this.store.subscribe(s => {
      this.currentRawState = s
    })

    this.history = new HistoryStore<CosmosKeyboard>({
      capacity: 50,
      initialState: initialState.config,
    })

    this.canUndo = this.history.canUndo
    this.canRedo = this.history.canRedo
    this.historyLength = this.history.historyLength

    // Config slices with automatic history synchronization
    this.protoConfig = {
      subscribe: (run, invalidate) => {
        let initialized = false
        let previous: CosmosKeyboard | undefined
        return this.store.subscribe(
          state => {
            const current = state.config
            if (!initialized || current !== previous) {
              initialized = true
              previous = current
              run(current as CosmosKeyboard)
            }
          },
          invalidate ? (state?: EditorState) => invalidate(state?.config as any) : undefined,
        )
      },
      set: (value: CosmosKeyboard) => {
        if (!this.isInternalHistorySync && value) {
          if (this.history.isInTransaction()) {
            this.history.updateTransaction(value)
          } else {
            this.history.push(value)
          }
        }
        this.store.update(s => ({
          ...s,
          config: value ? deepClone(value) : undefined,
          tempConfig: value ? { ...deepClone(value), fromProto: true } : undefined,
        }))
      },
      update: (updater: (val: CosmosKeyboard) => CosmosKeyboard) => {
        let updated: CosmosKeyboard | undefined
        this.store.update(state => {
          if (!state.config) return state
          updated = updater(deepClone(state.config))
          return {
            ...state,
            config: deepClone(updated),
            tempConfig: { ...deepClone(updated), fromProto: true },
          }
        })

        if (!this.isInternalHistorySync && updated) {
          if (this.history.isInTransaction()) {
            this.history.updateTransaction(updated)
          } else {
            this.history.push(updated)
          }
        }
      },
    }

    this.tempConfig = createSliceStore(
      this.store,
      s => s.tempConfig as TempConfig,
      (s, v) => ({ ...s, tempConfig: v }),
    )

    // Selection slices
    this.transformMode = createSliceStore(
      this.store,
      s => s.selection.transformMode,
      (s, v) => ({ ...s, selection: { ...s.selection, transformMode: v } }),
    )

    this.selectMode = createSliceStore(
      this.store,
      s => s.selection.selectMode,
      (s, v) => ({ ...s, selection: { ...s.selection, selectMode: v } }),
    )

    this.openSelect = createSliceStore(
      this.store,
      s => s.selection.openSelect,
      (s, v) => ({ ...s, selection: { ...s.selection, openSelect: v } }),
    )

    this.hoveredKey = createSliceStore(
      this.store,
      s => s.selection.hoveredKey,
      (s, v) => ({ ...s, selection: { ...s.selection, hoveredKey: v } }),
    )

    this.clickedKey = createSliceStore(
      this.store,
      s => s.selection.clickedKey,
      (s, v) => ({ ...s, selection: { ...s.selection, clickedKey: v } }),
    )

    this.clickedSide = createSliceStore(
      this.store,
      s => s.selection.clickedSide,
      (s, v) => ({ ...s, selection: { ...s.selection, clickedSide: v } }),
    )

    this.lastKeycap = createSliceStore(
      this.store,
      s => s.selection.lastKeycap,
      (s, v) => ({ ...s, selection: { ...s.selection, lastKeycap: v } }),
    )

    // Viewport slices
    this.viewer = createSliceStore(
      this.store,
      s => s.viewport.viewer,
      (s, v) => ({ ...s, viewport: { ...s.viewport, viewer: v } }),
    )

    this.view = createSliceStore(
      this.store,
      s => s.viewport.view,
      (s, v) => ({ ...s, viewport: { ...s.viewport, view: v } }),
    )

    this.showGrid = createSliceStore(
      this.store,
      s => s.viewport.showGrid,
      (s, v) => ({ ...s, viewport: { ...s.viewport, showGrid: v } }),
    )

    this.noWall = createSliceStore(
      this.store,
      s => s.viewport.noWall,
      (s, v) => ({ ...s, viewport: { ...s.viewport, noWall: v } }),
    )

    this.noBase = createSliceStore(
      this.store,
      s => s.viewport.noBase,
      (s, v) => ({ ...s, viewport: { ...s.viewport, noBase: v } }),
    )

    this.noBlanks = createSliceStore(
      this.store,
      s => s.viewport.noBlanks,
      (s, v) => ({ ...s, viewport: { ...s.viewport, noBlanks: v } }),
    )

    this.noLabels = createSliceStore(
      this.store,
      s => s.viewport.noLabels,
      (s, v) => ({ ...s, viewport: { ...s.viewport, noLabels: v } }),
    )

    this.showHand = createSliceStore(
      this.store,
      s => s.viewport.showHand,
      (s, v) => ({ ...s, viewport: { ...s.viewport, showHand: v } }),
    )

    this.showHelp = createSliceStore(
      this.store,
      s => s.viewport.showHelp,
      (s, v) => ({ ...s, viewport: { ...s.viewport, showHelp: v } }),
    )

    this.theme = createSliceStore(
      this.store,
      s => s.viewport.theme,
      (s, v) => ({ ...s, viewport: { ...s.viewport, theme: v } }),
    )

    this.referenceModels = createSliceStore(
      this.store,
      s => s.viewport.referenceModels,
      (s, v) => ({ ...s, viewport: { ...s.viewport, referenceModels: v } }),
    )

    // Diagnostics slices
    this.confError = createSliceStore(
      this.store,
      s => s.diagnostics.confErrors,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, confErrors: v } }),
    )

    this.showErrorMsg = createSliceStore(
      this.store,
      s => s.diagnostics.showErrorMsg,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, showErrorMsg: v } }),
    )

    this.codeError = createSliceStore(
      this.store,
      s => s.diagnostics.codeError,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, codeError: v } }),
    )

    this.developer = createSliceStore(
      this.store,
      s => s.diagnostics.developer,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, developer: v } }),
    )

    this.showTiming = createSliceStore(
      this.store,
      s => s.diagnostics.showTiming,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, showTiming: v } }),
    )

    this.showKeyInts = createSliceStore(
      this.store,
      s => s.diagnostics.showKeyInts,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, showKeyInts: v } }),
    )

    this.showGizmo = createSliceStore(
      this.store,
      s => s.diagnostics.showGizmo,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, showGizmo: v } }),
    )

    this.debugViewport = createSliceStore(
      this.store,
      s => s.diagnostics.debugViewport,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, debugViewport: v } }),
    )

    this.noStitch = createSliceStore(
      this.store,
      s => s.diagnostics.noStitch,
      (s, v) => ({ ...s, diagnostics: { ...s.diagnostics, noStitch: v } }),
    )
  }

  public subscribe(
    run: (value: EditorState) => void,
    invalidate?: (value?: EditorState) => void,
  ): () => void {
    return this.store.subscribe(run, invalidate)
  }

  public set(value: EditorState): void {
    this.store.set(deepClone(value))
  }

  public update(updater: (value: EditorState) => EditorState): void {
    this.store.update(current => deepClone(updater(current)))
  }

  // --- Keyboard Config Actions ---

  public applyRestoredConfig(restored: CosmosKeyboard): void {
    this.isInternalHistorySync = true
    this.store.update(state => ({
      ...state,
      config: deepClone(restored),
      tempConfig: { ...deepClone(restored), fromProto: true },
    }))
    this.isInternalHistorySync = false
  }

  public setConfig(
    config: CosmosKeyboard | undefined,
    recordHistory: boolean = true,
    description?: string,
  ): void {
    this.isInternalHistorySync = true
    this.store.update(state => ({
      ...state,
      config: config ? deepClone(config) : undefined,
      tempConfig: config ? { ...deepClone(config), fromProto: true } : undefined,
    }))
    this.isInternalHistorySync = false

    if (recordHistory && config) {
      this.history.push(config, description)
    }
  }

  public updateConfig(
    updater: (current: CosmosKeyboard) => CosmosKeyboard,
    recordHistory: boolean = true,
    description?: string,
  ): void {
    let updated: CosmosKeyboard | undefined
    this.isInternalHistorySync = true
    this.store.update(state => {
      if (!state.config) return state
      updated = updater(deepClone(state.config))
      return {
        ...state,
        config: deepClone(updated),
        tempConfig: { ...deepClone(updated), fromProto: true },
      }
    })
    this.isInternalHistorySync = false

    if (recordHistory && updated) {
      this.history.push(updated, description)
    }
  }

  public undoConfig(): CosmosKeyboard | undefined {
    const restored = this.history.undo()
    if (restored) {
      this.applyRestoredConfig(restored)
    }
    return restored
  }

  public redoConfig(): CosmosKeyboard | undefined {
    const restored = this.history.redo()
    if (restored) {
      this.applyRestoredConfig(restored)
    }
    return restored
  }

  public startConfigTransaction(initialConfig?: CosmosKeyboard): void {
    this.history.startTransaction(initialConfig ?? this.currentRawState.config)
  }

  public updateConfigTransaction(config: CosmosKeyboard): void {
    this.history.updateTransaction(config)
    this.isInternalHistorySync = true
    this.store.update(state => ({
      ...state,
      config: deepClone(config),
      tempConfig: { ...deepClone(config), fromProto: true },
    }))
    this.isInternalHistorySync = false
  }

  public commitConfigTransaction(description?: string): CosmosKeyboard | undefined {
    const committed = this.history.commitTransaction(description)
    if (committed) {
      this.isInternalHistorySync = true
      this.store.update(state => ({
        ...state,
        config: deepClone(committed),
        tempConfig: { ...deepClone(committed), fromProto: true },
      }))
      this.isInternalHistorySync = false
    }
    return committed
  }

  public cancelConfigTransaction(): CosmosKeyboard | undefined {
    const reverted = this.history.cancelTransaction()
    if (reverted) {
      this.isInternalHistorySync = true
      this.store.update(state => ({
        ...state,
        config: deepClone(reverted),
        tempConfig: { ...deepClone(reverted), fromProto: true },
      }))
      this.isInternalHistorySync = false
    }
    return reverted
  }

  /**
   * Binds global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z) to history undo/redo
   * and synchronizes the restored state to editor stores.
   */
  public bindKeyboardShortcuts(
    target?: Window | Document | HTMLElement,
    options?: KeyboardShortcutOptions<CosmosKeyboard>,
  ): () => void {
    return attachKeyboardShortcuts(this.history, target, {
      ...options,
      onUndo: (restored) => {
        if (restored) this.applyRestoredConfig(restored)
        options?.onUndo?.(restored)
      },
      onRedo: (restored) => {
        if (restored) this.applyRestoredConfig(restored)
        options?.onRedo?.(restored)
      },
    })
  }

  // --- Selection Actions ---

  public setSelection(patch: Partial<EditorSelectionState>): void {
    this.store.update(state => ({
      ...state,
      selection: {
        ...state.selection,
        ...patch,
      },
    }))
  }

  public selectKey(
    keyIndex: number | null,
    side: 'left' | 'right' | 'unibody' | 'center' | null = null,
  ): void {
    this.store.update(state => ({
      ...state,
      selection: {
        ...state.selection,
        clickedKey: keyIndex,
        clickedSide: side,
      },
    }))
  }

  public setHoveredKey(keyIndex: number | null): void {
    this.store.update(state => ({
      ...state,
      selection: {
        ...state.selection,
        hoveredKey: keyIndex,
      },
    }))
  }

  public setTransformMode(mode: 'translate' | 'rotate' | 'select'): void {
    this.store.update(state => ({
      ...state,
      selection: {
        ...state.selection,
        transformMode: mode,
      },
    }))
  }

  public setSelectMode(mode: 'key' | 'column' | 'cluster'): void {
    this.store.update(state => ({
      ...state,
      selection: {
        ...state.selection,
        selectMode: mode,
      },
    }))
  }

  public clearSelection(): void {
    this.store.update(state => ({
      ...state,
      selection: {
        ...state.selection,
        clickedKey: null,
        clickedSide: null,
        hoveredKey: null,
        openSelect: null,
      },
    }))
  }

  // --- Viewport Actions ---

  public setViewport(patch: Partial<EditorViewportState>): void {
    this.store.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        ...patch,
      },
    }))
  }

  public setView(view: 'left' | 'right' | 'both'): void {
    this.store.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        view,
      },
    }))
  }

  public setViewer(viewer: string): void {
    this.store.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        viewer,
      },
    }))
  }

  public toggleGrid(): void {
    this.store.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        showGrid: !state.viewport.showGrid,
      },
    }))
  }

  public addReferenceModel(model: ReferenceModelEntry): void {
    this.store.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        referenceModels: [...state.viewport.referenceModels, model],
      },
    }))
  }

  public removeReferenceModel(id: number): void {
    this.store.update(state => ({
      ...state,
      viewport: {
        ...state.viewport,
        referenceModels: state.viewport.referenceModels.filter(m => m.id !== id),
      },
    }))
  }

  // --- Diagnostics Actions ---

  public setDiagnostics(patch: Partial<EditorDiagnosticsState>): void {
    this.store.update(state => ({
      ...state,
      diagnostics: {
        ...state.diagnostics,
        ...patch,
      },
    }))
  }

  public setConfErrors(errors: ConfErrors): void {
    this.store.update(state => ({
      ...state,
      diagnostics: {
        ...state.diagnostics,
        confErrors: errors,
      },
    }))
  }

  public setShowErrorMsg(show: boolean): void {
    this.store.update(state => ({
      ...state,
      diagnostics: {
        ...state.diagnostics,
        showErrorMsg: show,
      },
    }))
  }

  public setCodeError(error: Error | null): void {
    this.store.update(state => ({
      ...state,
      diagnostics: {
        ...state.diagnostics,
        codeError: error,
      },
    }))
  }

  // --- Reset Action ---

  public reset(): void {
    this.history.clear()
    this.store.set(deepClone(initialEditorState))
  }
}

/**
 * Creates a new central EditorStore instance.
 */
export function createEditorStore(initialState?: EditorState): EditorStore {
  return new EditorStore(initialState)
}

/**
 * Default global singleton instance of editorStore.
 */
export const editorStore = new EditorStore()
