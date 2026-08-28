<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import * as flags from '$lib/flags'
  import { confError, editorStore, protoConfig, tempConfig, view } from '$lib/store'
  import { fromCosmosConfig } from '$lib/worker/config.cosmos'
  import type { FullCuttleform } from '$lib/worker/config'
  import { updateReferenceModels } from './lib/viewers/viewer3dHelpers'
  import { objEntriesNotNull } from '$lib/worker/util'
  import DarkTheme from './lib/DarkTheme.svelte'
  import Performance from './lib/Performance.svelte'
  import Footer from './lib/Footer.svelte'
  import Alert from '$lib/presentation/Alerts.svelte'
  import AssemblyView from './lib/dialogs/AssemblyView.svelte'
  import AppHeader from './lib/components/AppHeader.svelte'
  import ViewerToolbar from './lib/components/ViewerToolbar.svelte'
  import ViewportContainer from './lib/components/ViewportContainer.svelte'
  import FilamentBadge from './lib/components/FilamentBadge.svelte'
  import EditorSidebar from './lib/components/EditorSidebar.svelte'
  import DialogHost from './lib/components/DialogHost.svelte'
  import { CadPipeline } from './lib/services/cadPipelineService'
  import { getInitialState, stateToHash } from './lib/services/urlStateService'
  import type { State } from './lib/serialize'
  import { deserialize } from './lib/serialize'

  let state: State = getInitialState(browser ? location.hash.substring(1) : '')
  let initialEditorContent = state.content
  let editorContent: string = ''
  let mode = state.content ? 'advanced' : 'basic'
  let viewer = '3d'
  let transparency = 95
  let showSupports = false
  let showFit = false
  let fullMatrix: any = null
  let hideWall = false
  let darkMode: boolean = false
  let proOpen = false
  let assemblyOpen = false
  let downloading = false
  let urlView = false
  let bomView = false
  let kleView = false
  let lemonSwitch = false
  let referenceModelInput: HTMLInputElement
  let config: FullCuttleform

  let unbindShortcuts: (() => void) | undefined

  onMount(() => {
    if (browser) {
      unbindShortcuts = editorStore.bindKeyboardShortcuts(window)
    }
  })

  let pipeline = new CadPipeline(() => {
    pipeline = pipeline
  })

  onDestroy(() => {
    unbindShortcuts?.()
    pipeline.destroy()
  })

  $: center = pipeline.centers[$view]
  $: size = pipeline.sizes[$view]
  $: keyboardEntries = objEntriesNotNull(pipeline.meshes).filter(
    ([s, v]) => s == 'unibody' || $view == 'both' || $view == s
  )

  function onHashChange() {
    const newHash = location.hash.substring(1)
    const oldHash = stateToHash(mode, $protoConfig, editorContent)
    if (!newHash.startsWith('cf')) {
      if (oldHash != newHash) {
        state = deserialize(location.hash.substring(1))
        const newMode = state.content ? 'advanced' : 'basic'
        if (state.content) initialEditorContent = state.content
        if (mode === 'advanced' && newMode !== 'advanced') {
          initialEditorContent = undefined
        }
        if (newMode != 'advanced' && viewer == 'programming') {
          protoConfig.set(state.options)
          config = fromCosmosConfig(state.options)
        }
        mode = newMode
      }
    }
  }

  $: if ($protoConfig || (mode == 'advanced' && editorContent))
    try {
      config
      if (mode != 'advanced') {
        const hash = stateToHash(mode, $protoConfig)
        if (window.location.hash.startsWith('#cf')) window.history.replaceState(null, '', '#' + hash)
        else window.location.hash = hash
      } else if (editorContent) {
        if (window.location.hash.startsWith('#expert'))
          window.history.replaceState(null, '', '#' + editorContent)
        else window.location.hash = editorContent
      }
    } catch (e) {
      console.error(e)
    }

  $: if (config && browser) {
    pipeline.scheduleFullProcess(config)
  }

  $: if ($tempConfig && browser) {
    pipeline.scheduleTempProcess(fromCosmosConfig($tempConfig), $tempConfig.fromProto)
  }
</script>

<svelte:window on:popstate={onHashChange} />

{#if flags.performance}<Performance />{/if}

<AppHeader bind:proOpen />

{#if assemblyOpen}
  <AssemblyView
    {size}
    {center}
    meshes={keyboardEntries}
    geometry={pipeline.microcontrollerGeometry}
    on:close={() => (assemblyOpen = false)}
  />
{:else}
  <main class="px-8 dark:text-slate-100 flex flex-col xs:flex-row-reverse">
    <div class="flex-1">
      {#if state.keyboard == 'lightcycle'}
        <div class="border-2 border-yellow-400 py-2 px-4 m-2 rounded bg-white dark:bg-gray-900">
          Generating the Lightcycle case takes an extremeley long time, so it is disabled by default.
          Turn on <span class="whitespace-nowrap bg-gray-200 dark:bg-gray-800 px-2 rounded"
            >Include Case</span
          > to generate it.
        </div>
      {/if}
      <div class="viewer relative xs:sticky h-[100vh] top-0">
        <ViewerToolbar
          bind:viewer
          bind:transparency
          on:importModel={() => referenceModelInput.click()}
        />
        <ViewportContainer
          {viewer}
          {config}
          geometry={pipeline.geometry}
          microcontrollerGeometry={pipeline.microcontrollerGeometry}
          meshes={pipeline.meshes}
          {center}
          {size}
          generatorProgress={pipeline.generatorProgress}
          {transparency}
          {showSupports}
          {darkMode}
          {mode}
          pool={pipeline.pool}
          ocError={pipeline.ocError}
          bind:showFit
          bind:fullMatrix
          {hideWall}
        />
        <FilamentBadge filament={pipeline.filament} {config} bind:showSupports />
      </div>
    </div>
    <EditorSidebar
      bind:mode
      {viewer}
      bind:config
      geometry={pipeline.geometry}
      {darkMode}
      {fullMatrix}
      bind:editorContent
      bind:initialEditorContent
      stateOptions={state.options}
      stateError={state.error}
      on:download={() => (downloading = true)}
      on:openUrlView={() => (urlView = true)}
      on:openBomView={() => (bomView = true)}
      on:openKleView={() => (kleView = true)}
      on:openLemonSwitch={() => (lemonSwitch = true)}
      on:openAssembly={() => (assemblyOpen = true)}
    />
  </main>
{/if}

<footer class="px-8 pb-8 pt-16">
  <Footer />
</footer>

<DialogHost
  bind:urlView
  bind:bomView
  bind:kleView
  bind:showFit
  bind:downloading
  bind:lemonSwitch
  bind:proOpen
  {mode}
  {editorContent}
  bind:config
  geometry={pipeline.geometry}
  pool={pipeline.pool}
/>

<DarkTheme bind:darkMode />
<Alert />

<input
  type="file"
  class="hidden"
  accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl,model/x.stl-binary,model/x.stl-ascii"
  multiple
  bind:this={referenceModelInput}
  on:change={() => updateReferenceModels(referenceModelInput.files || [], pipeline.geometry, center)}
/>

<style>
  @media (min-height: 480px) {
    .viewer {
      height: calc(100vh - 136px);
      top: 68px;
    }
  }

  @media (max-width: 520px) {
    .viewer {
      --at-apply: 'max-h-[50vh] mb-4 top-0';
    }
  }
</style>
