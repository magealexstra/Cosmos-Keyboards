import { confError } from '$lib/store'
import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
import { deserialize, serialize, type State } from '../serialize'

export function getInitialState(hash: string): State {
  const state: State = deserialize(hash)
  if (state.error) {
    confError.set([{ type: 'exception', error: state.error, side: 'right', when: 'parsing URL' }])
  }
  return state
}

export function stateToHash(mode: string, options: CosmosKeyboard, editorContent?: string): string {
  if (mode !== 'advanced') {
    return serialize({
      keyboard: 'cm',
      options,
    })
  }
  return editorContent || ''
}

export function syncUrlHash(mode: string, options: CosmosKeyboard, editorContent?: string): void {
  try {
    if (mode !== 'advanced') {
      const hash = stateToHash(mode, options)
      if (window.location.hash.startsWith('#cf')) {
        window.history.replaceState(null, '', '#' + hash)
      } else {
        window.location.hash = hash
      }
    } else if (editorContent) {
      if (window.location.hash.startsWith('#expert')) {
        window.history.replaceState(null, '', '#' + editorContent)
      } else {
        window.location.hash = editorContent
      }
    }
  } catch (e) {
    console.error(e)
  }
}
