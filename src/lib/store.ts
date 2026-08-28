import { browser } from '$app/environment'
import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
import { derived, type Readable, type Writable, writable } from 'svelte/store'
import type { BufferGeometry, Matrix4 } from 'three'
import type { User } from '../routes/beta/lib/login'
import type { ColorScheme } from './3d/materials'
import type { ConfErrors } from './worker/check'

import { editorStore, type ReferenceModelEntry, type TempConfig } from './stores/editorStore'

export { editorStore, type ReferenceModelEntry, type TempConfig }

export const protoConfig = editorStore.protoConfig
export const tempConfig = editorStore.tempConfig
export const confError = editorStore.confError
export const showErrorMsg = editorStore.showErrorMsg
export const transformMode = editorStore.transformMode
export const selectMode = editorStore.selectMode
export const user = writable<User>({ success: false, sponsor: undefined })
export const codeError = editorStore.codeError
export const openSelect = editorStore.openSelect

export const hoveredKey = editorStore.hoveredKey
export const clickedKey = editorStore.clickedKey
export const clickedSide = editorStore.clickedSide
export const lastKeycap = editorStore.lastKeycap

export const canUndo = editorStore.canUndo
export const canRedo = editorStore.canRedo
export const historyLength = editorStore.historyLength
export const historyStore = editorStore.history

// --- Alerts -----------------------------------------------------------------
//
// A lightweight popover-alert system: callers `pushAlert({ message, anchor })`
// from anywhere; `Alert.svelte` (mounted once in App.svelte) renders a
// dismissible popover next to the anchor element with a 10s auto-dismiss
// timer and a progress bar. Used by the layout dropdown to surface "missing
// keys" warnings and "you've switched to Custom" hints without blocking the
// page with a modal dialog.

export interface AlertItem {
  id: symbol
  message: string
  /** DOM element to anchor the popover next to (typically the Field that *  triggered the alert). */
  anchor: HTMLElement
  /** Auto-dismiss after this many ms. Default 10000. Pass 0 to disable. */
  durationMs?: number
}

export const alerts = writable<AlertItem[]>([])

export function pushAlert(a: Omit<AlertItem, 'id'>): symbol {
  const id = Symbol()
  alerts.update(xs => [...xs, { id, durationMs: 10000, ...a }])
  return id
}

export function dismissAlert(id: symbol) {
  alerts.update(xs => xs.filter(a => a.id !== id))
}

export const showGrid = editorStore.showGrid
export const noWall = editorStore.noWall
export const noBase = editorStore.noBase
export const noBlanks = editorStore.noBlanks
export const noLabels = editorStore.noLabels
export const referenceModels = editorStore.referenceModels

// Preferences
export const theme = storable<ColorScheme>('theme', 'purple')
export const showHand = storable('showHand', true)
export const view = storable<'left' | 'right' | 'both'>('view', 'both')
export const bomMultiplier = storable('bomMultiplier', '2')
export const stiltsMsg = storable('stiltsMsg', true)
export const modelName = storable('modelName', 'cosmotyl')
export const discordMsg = storable('discordMsg', true)
export const enableUndo = storable('enableUndo', false)
export const showHelp = storable('showHelp', true)
export const assemblyIsNew = storable('assemblyIsNew', true)
export const showScheduleEmail = storable('showScheduleEmail', false)
export const emailScheduled = storable('emailScheduled', false)
export const emailMinimized = storable('emailMinimized', 0)

export const developer = storable('developer', browser && location.origin.includes('localhost'))
export const showTiming = andcondition(developer, storable('developer.timing', false))
export const showKeyInts = andcondition(developer, storable('developer.showKeyInts', false))
export const showGizmo = andcondition(developer, storable('developer.showGizmo', false))
export const debugViewport = andcondition(developer, storable('developer.debugViewport', false))
export const noStitch = andcondition(developer, storable('developer.noStitch', false))

/** A Svelte store that writes and reads from localStorage. */
export function storable<T>(name: string, data: T): Writable<T> {
  const store = writable(data)
  const storageName = 'cosmos.prefs.' + name

  if (browser && localStorage[storageName]) {
    store.set(JSON.parse(localStorage[storageName]))
  }

  return {
    subscribe: store.subscribe,
    set: n => {
      if (browser) localStorage[storageName] = JSON.stringify(n)
      store.set(n)
    },
    update: (callback) => {
      store.update(value => {
        const newValue = callback(value)
        if (browser) localStorage[storageName] = JSON.stringify(newValue)
        return newValue
      })
    },
  }
}

/**
 * A Svelte store that returns the second store only when the condition store = true.
 * Otherwise takes on the ifNot value.
 * Writes are only possible when condition store = true.
 */
function conditional<T>(conditionStore: Readable<boolean>, dataStore: Writable<T>, ifNot: T): Writable<T> {
  let _cond: boolean = false

  const store = derived([conditionStore, dataStore], ([a, b]) => a ? b : ifNot)
  conditionStore.subscribe(c => _cond = c)

  return {
    subscribe: store.subscribe,
    set: n => _cond && dataStore.set(n),
    update: (callback) => _cond && dataStore.update(callback),
  }
}

/** Special case of conditional for booleans. Ands the two values. */
function andcondition(read: Readable<boolean>, write: Writable<boolean>) {
  return conditional(read, write, false)
}
