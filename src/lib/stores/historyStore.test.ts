import { describe, expect, test } from 'bun:test'
import { createEditorStore } from './editorStore'
import { attachKeyboardShortcuts, deepClone, HistoryStore } from './historyStore'

interface TestConfig {
  name: string
  keys: number
  metadata?: {
    tags: string[]
    version: number
  }
}

describe('HistoryStore - Undo / Redo Operations', () => {
  test('initial state has canUndo = false and canRedo = false', () => {
    const history = new HistoryStore<TestConfig>()

    let canUndo = false
    let canRedo = false
    let historyLength = 0

    history.canUndo.subscribe(v => (canUndo = v))
    history.canRedo.subscribe(v => (canRedo = v))
    history.historyLength.subscribe(v => (historyLength = v))

    expect(canUndo).toBe(false)
    expect(canRedo).toBe(false)
    expect(historyLength).toBe(0)
    expect(history.getCurrent()).toBeUndefined()
  })

  test('single push creates history item with canUndo = false', () => {
    const history = new HistoryStore<TestConfig>({
      initialState: { name: 'Initial', keys: 60 },
    })

    let canUndo = false
    let canRedo = false
    let historyLength = 0

    history.canUndo.subscribe(v => (canUndo = v))
    history.canRedo.subscribe(v => (canRedo = v))
    history.historyLength.subscribe(v => (historyLength = v))

    expect(canUndo).toBe(false)
    expect(canRedo).toBe(false)
    expect(historyLength).toBe(1)
    expect(history.getCurrent()?.name).toBe('Initial')
  })

  test('pushing multiple items enables sequential undo and redo', () => {
    const history = new HistoryStore<TestConfig>()

    history.push({ name: 'State 1', keys: 10 })
    history.push({ name: 'State 2', keys: 20 })
    history.push({ name: 'State 3', keys: 30 })

    let canUndo = false
    let canRedo = false
    history.canUndo.subscribe(v => (canUndo = v))
    history.canRedo.subscribe(v => (canRedo = v))

    expect(canUndo).toBe(true)
    expect(canRedo).toBe(false)
    expect(history.getLength()).toBe(3)
    expect(history.getCurrent()?.name).toBe('State 3')

    // Undo to State 2
    const undone1 = history.undo()
    expect(undone1?.name).toBe('State 2')
    expect(undone1?.keys).toBe(20)
    expect(canUndo).toBe(true)
    expect(canRedo).toBe(true)

    // Undo to State 1
    const undone2 = history.undo()
    expect(undone2?.name).toBe('State 1')
    expect(canUndo).toBe(false)
    expect(canRedo).toBe(true)

    // Attempt undo beyond first state
    const undone3 = history.undo()
    expect(undone3).toBeUndefined()
    expect(canUndo).toBe(false)
    expect(canRedo).toBe(true)

    // Redo to State 2
    const redone1 = history.redo()
    expect(redone1?.name).toBe('State 2')
    expect(canUndo).toBe(true)
    expect(canRedo).toBe(true)

    // Redo to State 3
    const redone2 = history.redo()
    expect(redone2?.name).toBe('State 3')
    expect(canUndo).toBe(true)
    expect(canRedo).toBe(false)

    // Attempt redo beyond latest state
    const redone3 = history.redo()
    expect(redone3).toBeUndefined()
    expect(canUndo).toBe(true)
    expect(canRedo).toBe(false)
  })

  test('deep cloning guarantees immutability across snapshots', () => {
    const history = new HistoryStore<TestConfig>()
    const state: TestConfig = {
      name: 'Mutable',
      keys: 50,
      metadata: { tags: ['ergonomic', 'split'], version: 1 },
    }

    history.push(state)

    // Mutate local object after push
    state.name = 'Tampered'
    state.metadata!.tags.push('hacked')
    state.metadata!.version = 999

    const current = history.getCurrent()
    expect(current?.name).toBe('Mutable')
    expect(current?.metadata?.tags).toEqual(['ergonomic', 'split'])
    expect(current?.metadata?.version).toBe(1)

    // Mutate retrieved state
    current!.name = 'ModifiedAgain'
    expect(history.getCurrent()?.name).toBe('Mutable')
  })
})

describe('HistoryStore - Ring Buffer Capacity Limits', () => {
  test('drops oldest snapshots when capacity is exceeded', () => {
    const capacity = 5
    const history = new HistoryStore<number>({ capacity })

    for (let i = 1; i <= 10; i++) {
      history.push(i, `Step ${i}`)
    }

    expect(history.getLength()).toBe(5)
    expect(history.getCurrent()).toBe(10)

    // History should contain [6, 7, 8, 9, 10]
    expect(history.undo()).toBe(9)
    expect(history.undo()).toBe(8)
    expect(history.undo()).toBe(7)
    expect(history.undo()).toBe(6)

    // Cannot undo past the oldest retained snapshot (6)
    expect(history.undo()).toBeUndefined()
    expect(history.getCurrent()).toBe(6)

    // Redo back to the head
    expect(history.redo()).toBe(7)
    expect(history.redo()).toBe(8)
    expect(history.redo()).toBe(9)
    expect(history.redo()).toBe(10)
    expect(history.redo()).toBeUndefined()
  })

  test('default 50-step capacity ring buffer works with 60 pushes', () => {
    const history = new HistoryStore<number>()

    for (let i = 1; i <= 60; i++) {
      history.push(i)
    }

    expect(history.getLength()).toBe(50)
    expect(history.getCurrent()).toBe(60)

    // Undo 49 times to reach oldest retained element (11)
    let lastUndone: number | undefined
    for (let i = 0; i < 49; i++) {
      lastUndone = history.undo()
    }

    expect(lastUndone).toBe(11)
    expect(history.undo()).toBeUndefined()
  })
})

describe('HistoryStore - Branching History Drop', () => {
  test('prunes forward redo history when pushing a new state after undo', () => {
    const history = new HistoryStore<string>()

    history.push('A')
    history.push('B')
    history.push('C')
    history.push('D')
    history.push('E')

    expect(history.getLength()).toBe(5)
    expect(history.getCurrent()).toBe('E')

    // Undo 2 times -> current is C
    expect(history.undo()).toBe('D')
    expect(history.undo()).toBe('C')

    let canRedo = false
    history.canRedo.subscribe(v => (canRedo = v))
    expect(canRedo).toBe(true)

    // Push new branch F from C
    history.push('F')

    // canRedo must now be false (D and E were discarded)
    expect(canRedo).toBe(false)
    expect(history.getCurrent()).toBe('F')
    expect(history.getLength()).toBe(4) // [A, B, C, F]

    // Undo should traverse F -> C -> B -> A
    expect(history.undo()).toBe('C')
    expect(history.undo()).toBe('B')
    expect(history.undo()).toBe('A')
    expect(history.undo()).toBeUndefined()

    // Redo should traverse A -> B -> C -> F
    expect(history.redo()).toBe('B')
    expect(history.redo()).toBe('C')
    expect(history.redo()).toBe('F')
    expect(history.redo()).toBeUndefined()
  })
})

describe('HistoryStore - Transaction Management', () => {
  test('groups multiple intermediate updates into a single undo step', () => {
    const history = new HistoryStore<{ count: number; label: string }>()

    history.push({ count: 0, label: 'Base' })

    history.startTransaction()
    let inTransaction = false
    history.inTransaction.subscribe(v => (inTransaction = v))
    expect(inTransaction).toBe(true)

    // Multiple drag or keystroke updates
    history.updateTransaction({ count: 1, label: 'Typing' })
    history.updateTransaction({ count: 2, label: 'Typing more' })
    history.updateTransaction({ count: 10, label: 'Final Edit' })

    // No intermediate undo steps should be pushed yet
    expect(history.getLength()).toBe(1)

    const committed = history.commitTransaction('Committed batch edit')
    expect(committed).toEqual({ count: 10, label: 'Final Edit' })
    expect(inTransaction).toBe(false)
    expect(history.getLength()).toBe(2)
    expect(history.getCurrent()).toEqual({ count: 10, label: 'Final Edit' })

    // Single undo steps back to Base
    const undone = history.undo()
    expect(undone).toEqual({ count: 0, label: 'Base' })
    expect(history.undo()).toBeUndefined()

    // Redo restores committed batch state
    const redone = history.redo()
    expect(redone).toEqual({ count: 10, label: 'Final Edit' })
  })

  test('cancelTransaction restores initial state and discards pending changes', () => {
    const history = new HistoryStore<{ count: number }>()

    history.push({ count: 5 })

    history.startTransaction()
    history.updateTransaction({ count: 50 })
    history.updateTransaction({ count: 100 })

    const restored = history.cancelTransaction()
    expect(restored).toEqual({ count: 5 })
    expect(history.getLength()).toBe(1)
    expect(history.getCurrent()).toEqual({ count: 5 })
    expect(history.undo()).toBeUndefined()
  })

  test('cancelTransaction and commitTransaction gracefully handle inactive state', () => {
    const history = new HistoryStore<string>()
    expect(history.cancelTransaction()).toBeUndefined()
    expect(history.commitTransaction()).toBeUndefined()
  })

  test('clear resets history buffer, pointer, and transaction state', () => {
    const history = new HistoryStore<number>()
    history.push(1)
    history.push(2)
    history.startTransaction()
    history.updateTransaction(3)

    history.clear()

    expect(history.getLength()).toBe(0)
    expect(history.getIndex()).toBe(-1)
    expect(history.getCurrent()).toBeUndefined()

    let canUndo = false
    let canRedo = false
    let inTransaction = false
    history.canUndo.subscribe(v => (canUndo = v))
    history.canRedo.subscribe(v => (canRedo = v))
    history.inTransaction.subscribe(v => (inTransaction = v))

    expect(canUndo).toBe(false)
    expect(canRedo).toBe(false)
    expect(inTransaction).toBe(false)
  })
})

describe('HistoryStore - Keyboard Event Handling', () => {
  interface MockEventTarget {
    listeners: Record<string, ((event: any) => void)[]>
    addEventListener(type: string, listener: (event: any) => void): void
    removeEventListener(type: string, listener: (event: any) => void): void
    dispatch(type: string, event: any): void
  }

  function createMockTarget(): MockEventTarget {
    const listeners: Record<string, ((event: any) => void)[]> = {}
    return {
      listeners,
      addEventListener(type, listener) {
        listeners[type] = listeners[type] || []
        listeners[type].push(listener)
      },
      removeEventListener(type, listener) {
        if (!listeners[type]) return
        listeners[type] = listeners[type].filter(l => l !== listener)
      },
      dispatch(type, event) {
        if (!listeners[type]) return
        for (const l of listeners[type]) {
          l(event)
        }
      },
    }
  }

  test('handles Ctrl+Z and Ctrl+Y shortcuts', () => {
    const history = new HistoryStore<number>()
    history.push(1)
    history.push(2)
    history.push(3)

    const mockWindow = createMockTarget()
    let undoCount = 0
    let redoCount = 0

    const unbind = attachKeyboardShortcuts(history, mockWindow as any, {
      onUndo: () => undoCount++,
      onRedo: () => redoCount++,
    })

    let defaultPrevented = false
    const mockCtrlZ = {
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {
        defaultPrevented = true
      },
    }

    mockWindow.dispatch('keydown', mockCtrlZ)
    expect(defaultPrevented).toBe(true)
    expect(undoCount).toBe(1)
    expect(history.getCurrent()).toBe(2)

    defaultPrevented = false
    const mockCtrlY = {
      key: 'y',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {
        defaultPrevented = true
      },
    }

    mockWindow.dispatch('keydown', mockCtrlY)
    expect(defaultPrevented).toBe(true)
    expect(redoCount).toBe(1)
    expect(history.getCurrent()).toBe(3)

    // Ctrl+Shift+Z for Redo
    defaultPrevented = false
    mockWindow.dispatch('keydown', mockCtrlZ) // Undo to 2
    const mockCtrlShiftZ = {
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      preventDefault: () => {
        defaultPrevented = true
      },
    }
    mockWindow.dispatch('keydown', mockCtrlShiftZ) // Redo to 3
    expect(redoCount).toBe(2)
    expect(history.getCurrent()).toBe(3)

    // Unbind cleanly
    unbind()
    mockWindow.dispatch('keydown', mockCtrlZ)
    expect(undoCount).toBe(2) // Not incremented
  })
})

describe('EditorStore - State Machine & Unified Stores', () => {
  test('initializes default state and responds to slice modifications', () => {
    const editor = createEditorStore()

    let transformMode = ''
    let showGrid = true
    let confErrors: any[] = []

    editor.transformMode.subscribe(v => (transformMode = v))
    editor.showGrid.subscribe(v => (showGrid = v))
    editor.confError.subscribe(v => (confErrors = v))

    expect(transformMode).toBe('select')
    expect(showGrid).toBe(false)
    expect(confErrors).toEqual([])

    // Update selection mode
    editor.setTransformMode('rotate')
    expect(transformMode).toBe('rotate')

    // Toggle grid
    editor.toggleGrid()
    expect(showGrid).toBe(true)

    // Select key
    editor.selectKey(5, 'left')
    let clickedKey: number | null = null
    let clickedSide: any = null
    editor.clickedKey.subscribe(v => (clickedKey = v))
    editor.clickedSide.subscribe(v => (clickedSide = v))

    expect(clickedKey).toBe(5)
    expect(clickedSide).toBe('left')

    editor.clearSelection()
    expect(clickedKey).toBeNull()
    expect(clickedSide).toBeNull()
  })

  test('integrates keyboard config undo and redo via HistoryStore', () => {
    const editor = createEditorStore()

    const configA = { wallThickness: 2 } as any
    const configB = { wallThickness: 3 } as any
    const configC = { wallThickness: 4 } as any

    editor.setConfig(configA)
    editor.setConfig(configB)
    editor.setConfig(configC)

    let canUndo = false
    editor.canUndo.subscribe(v => (canUndo = v))
    expect(canUndo).toBe(true)

    let currentConfig: any
    editor.protoConfig.subscribe(v => (currentConfig = v))
    expect(currentConfig?.wallThickness).toBe(4)

    // Undo
    editor.undoConfig()
    expect(currentConfig?.wallThickness).toBe(3)

    // Undo again
    editor.undoConfig()
    expect(currentConfig?.wallThickness).toBe(2)

    // Redo
    editor.redoConfig()
    expect(currentConfig?.wallThickness).toBe(3)
  })

  test('supports config transactions in editorStore', () => {
    const editor = createEditorStore()

    const baseConfig = { wallThickness: 1 } as any
    editor.setConfig(baseConfig)

    editor.startConfigTransaction()
    editor.updateConfigTransaction({ wallThickness: 2 } as any)
    editor.updateConfigTransaction({ wallThickness: 3 } as any)
    editor.updateConfigTransaction({ wallThickness: 5 } as any)

    let currentConfig: any
    editor.protoConfig.subscribe(v => (currentConfig = v))
    expect(currentConfig?.wallThickness).toBe(5)

    editor.commitConfigTransaction('Committed thickness changes')

    // Undoing should return straight back to baseConfig (wallThickness: 1)
    editor.undoConfig()
    expect(currentConfig?.wallThickness).toBe(1)
  })

  test('reset restores initial state and clears history', () => {
    const editor = createEditorStore()

    editor.setConfig({ wallThickness: 10 } as any)
    editor.setTransformMode('translate')
    editor.toggleGrid()

    editor.reset()

    let transformMode = ''
    let showGrid = true
    let canUndo = true
    let protoConfig: any = {}

    editor.transformMode.subscribe(v => (transformMode = v))
    editor.showGrid.subscribe(v => (showGrid = v))
    editor.canUndo.subscribe(v => (canUndo = v))
    editor.protoConfig.subscribe(v => (protoConfig = v))

    expect(transformMode).toBe('select')
    expect(showGrid).toBe(false)
    expect(canUndo).toBe(false)
    expect(protoConfig).toBeUndefined()
  })

  test('protoConfig slice updates automatically register undo snapshots', () => {
    const editor = createEditorStore()

    editor.protoConfig.set({ wallThickness: 2 } as any)
    let canUndo = false
    editor.canUndo.subscribe(v => (canUndo = v))
    expect(canUndo).toBe(false) // 1 item in history (initial)

    editor.protoConfig.update((c: any) => ({ ...c, wallThickness: 4 }))
    expect(canUndo).toBe(true) // 2 items in history

    let currentConfig: any
    editor.protoConfig.subscribe(v => (currentConfig = v))
    expect(currentConfig?.wallThickness).toBe(4)

    editor.undoConfig()
    expect(currentConfig?.wallThickness).toBe(2)
    expect(canUndo).toBe(false)

    editor.redoConfig()
    expect(currentConfig?.wallThickness).toBe(4)
    expect(canUndo).toBe(true)
  })

  test('editorStore.bindKeyboardShortcuts triggers undo and updates stores', () => {
    const editor = createEditorStore()

    editor.protoConfig.set({ wallThickness: 1 } as any)
    editor.protoConfig.update((c: any) => ({ ...c, wallThickness: 2 }))

    const mockWindow: any = {
      listeners: {} as Record<string, ((event: any) => void)[]>,
      addEventListener(type: string, listener: (event: any) => void) {
        this.listeners[type] = this.listeners[type] || []
        this.listeners[type].push(listener)
      },
      removeEventListener(type: string, listener: (event: any) => void) {
        if (!this.listeners[type]) return
        this.listeners[type] = this.listeners[type].filter((l: any) => l !== listener)
      },
      dispatch(type: string, event: any) {
        if (!this.listeners[type]) return
        for (const l of this.listeners[type]) {
          l(event)
        }
      },
    }

    let undoCalled = false
    const unbind = editor.bindKeyboardShortcuts(mockWindow, {
      onUndo: () => {
        undoCalled = true
      },
    })

    let currentConfig: any
    editor.protoConfig.subscribe(v => (currentConfig = v))
    expect(currentConfig?.wallThickness).toBe(2)

    // Send Ctrl+Z
    mockWindow.dispatch('keydown', {
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {},
    })

    expect(undoCalled).toBe(true)
    expect(currentConfig?.wallThickness).toBe(1)

    // Send Ctrl+Y
    mockWindow.dispatch('keydown', {
      key: 'y',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {},
    })

    expect(currentConfig?.wallThickness).toBe(2)

    unbind()
  })
})
