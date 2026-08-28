<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import * as mdi from '@mdi/js'
  import * as flags from '$lib/flags'
  import Login from '../Login.svelte'
  import { hasPro } from '@pro'
  import { canUndo, canRedo, editorStore } from '$lib/store'

  export let proOpen: boolean = false
</script>

<header class="px-8 pb-8 pt-12 flex items-center mb-4">
  <h1 class="dark:text-slate-100 text-4xl font-semibold flex-1">
    Cosmos Keyboard Configurator <span class="text-purple-500 dark:text-pink-400"
      >{hasPro ? 'BETA' : 'OSS'}</span
    ><span class="text-teal-500 dark:text-teal-400 absolute text-6xl mt--4">V3</span>
  </h1>

  <button
    type="button"
    class="hoverbtn"
    title="Undo (Ctrl+Z)"
    disabled={!$canUndo}
    on:click={() => editorStore.undoConfig()}
  >
    <Icon path={mdi.mdiUndo} />
    Undo
  </button>
  <button
    type="button"
    class="hoverbtn"
    title="Redo (Ctrl+Y)"
    disabled={!$canRedo}
    on:click={() => editorStore.redoConfig()}
  >
    <Icon path={mdi.mdiRedo} />
    Redo
  </button>

  <a class="hoverbtn" href="https://cosmos-store.ryanis.cool?utm_source=generator">
    <Icon path={mdi.mdiShopping} />
    Store
  </a>
  <a class="hoverbtn" href="showcase/">
    <Icon path={mdi.mdiSealVariant} />
    Showcase
  </a>
  <a
    class="mr-6 flex items-center gap-2 border-2 px-3 py-1 rounded border-gray-500/20 hover:border-gray-500 transition-border-color text-gray-600 dark:text-gray-200"
    href="docs/"
  >
    Docs & FAQ
  </a>
  {#if flags.login && hasPro}
    <Login bind:dialogOpen={proOpen} />
  {/if}
</header>

<style>
  .hoverbtn {
    --at-apply: 'mr-3 flex items-center justify-start gap-2 border-2 max-w-9 hover:max-w-32 px-1.5 hover:px-3 py-1 rounded border-gray-500/20 hover:border-gray-500 transition-border-color text-gray-600 dark:text-gray-200 transition-all overflow-hidden';
  }
  .hoverbtn:disabled {
    --at-apply: 'opacity-40 cursor-not-allowed hover:max-w-9 hover:px-1.5 hover:border-gray-500/20';
  }
  :global(.hoverbtn svg) {
    --at-apply: 'flex-none';
  }
</style>
