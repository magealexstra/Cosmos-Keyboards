<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import Preset from '$lib/presentation/Preset.svelte'
  import Icon from '$lib/presentation/Icon.svelte'
  import * as mdi from '@mdi/js'
  import * as flags from '$lib/flags'
  import { hasPro } from '@pro'
  import { SORTED_VENDORS } from '@pro/assemblyService'
  import { base } from '$app/paths'
  import { assemblyIsNew, protoConfig } from '$lib/store'
  import VisualEditor2 from '../editor/VisualEditor2.svelte'
  import Editor from '../editor/CodeEditor.svelte'
  import PeaConfig from '../editor/PeaConfig.svelte'
  import PeaWarnings from '../editor/PeaWarnings.svelte'
  import type { FullCuttleform, FullGeometry } from '$lib/worker/config'
  import { fromCosmosConfig, toFullCosmosConfig } from '$lib/worker/config.cosmos'

  export let mode: string = 'basic'
  export let viewer: string = '3d'
  export let config: FullCuttleform
  export let geometry: FullGeometry = {}
  export let darkMode: boolean = false
  export let fullMatrix: any = null
  export let editorContent: string = ''
  export let initialEditorContent: string | undefined = undefined
  export let stateOptions: any = undefined
  export let stateError: any = undefined

  const dispatch = createEventDispatcher<{
    download: void
    openUrlView: void
    openBomView: void
    openKleView: void
    openLemonSwitch: void
    openAssembly: void
    modeChanged: string
  }>()

  $: hasLemon = (config?.right || config?.unibody)?.microcontroller?.startsWith('lemon')

  function setMode(newMode: string) {
    if (mode === 'advanced' && newMode !== 'advanced') {
      try {
        if (config) {
          const next = toFullCosmosConfig(config, true)
          if (stateOptions) {
            stateOptions = next
          }
          protoConfig.set(next)
          config = fromCosmosConfig(next)
        }
        initialEditorContent = undefined
      } catch (e) {
        console.error(e)
        alert('Could not convert your expert mode config. Was there an error in it?')
      }
    }
    mode = newMode
    dispatch('modeChanged', newMode)
  }
</script>

<div class="xs:w-80 md:w-[32rem]">
  {#if viewer == 'programming'}
    <button class="infobutton" on:click={() => dispatch('openKleView')}>Download KLE Layout</button>
    {#if flags.lemons && !hasLemon}
      <button
        class="relative bg-teal-500/10 hover:bg-teal-500/30 rounded mt-8 px-4 py-2 ml--2 text-start"
        on:click={() => dispatch('openLemonSwitch')}
      >
        <span class="font-medium">Autogenerate your firmware with Lemon microcontrollers.</span>
        <div class="mt-2 flex gap-4 items-center">
          <div class="text-sm">
            <span class="opacity-70"
              >Because of the Lemon's structured I/Os, Cosmos can automate mapping your keyboard matrix
              and generating a firmware.</span
            >
            <span class="ml-0.5" />
          </div>
          <div
            class="rounded-full bg-teal-200 dark:bg-teal-600 flex items-center justify-center w-8 h-8 flex-none"
          >
            <Icon size={24} path={mdi.mdiChevronRight} />
          </div>
        </div></button
      >
    {/if}
    {#if hasLemon}
      {#if fullMatrix}
        {#if config}
          <PeaConfig {config} {geometry} matrix={fullMatrix} />
        {/if}
      {:else}
        <p class="mt-4 mb-2">Autogenerate your firmware with peaMK!</p>
        <ol class="list-decimal ml-6">
          <li>
            <a class="text-pink-600 underline" target="_blank" href="docs/firmware/#key-labeling"
              >Label all your keys</a
            > to your liking.
          </li>
          <li>
            Download and flash <a
              class="text-pink-600 underline"
              target="_blank"
              href="https://github.com/rianadon/peaMK/tree/main?tab=readme-ov-file#binaries">peaMK</a
            > to your microcontroller(s).
          </li>
          <li>Press the indicated blue key (on the right) on your keyboard.</li>
          <li>If a key doesn't work, double check your wiring.</li>
          <li>When all keys have been pressed Cosmos will auto-generate your firmware.</li>
        </ol>
        {#if config}
          <PeaWarnings {config} {geometry} />
        {/if}
      {/if}
    {:else}
      <p class="mt-4 mb-2">Some things that will happen here in the future:</p>
      <ul class="list-disc pl-4">
        <li>The thumb cluster matrix will be wired more efficiently</li>
        <li>The thumb cluster matrix will be connected to the larger key matrix</li>
        <li>The generator will make a QMK template for you to use</li>
        <li>And maybe a generated assembly / wiring guide</li>
      </ul>
    {/if}
  {:else}
    <div class="flex items-center justify-between mr-2">
      <div>
        <Preset purple on:click={() => setMode('basic')} name="Basic" selected={mode == 'basic'} />
        <Preset
          purple
          on:click={() => setMode('intermediate')}
          name="Advanced"
          selected={mode == 'intermediate'}
        />
        <Preset
          purple
          on:click={() => setMode('advanced')}
          name="Expert"
          selected={mode == 'advanced'}
        />
      </div>
      <button class="button" on:click={() => dispatch('download')}>Download</button>
    </div>
    <div class="flex justify-between pr-2 mt-1">
      <button class="infobutton" on:click={() => dispatch('openUrlView')}>What's in the URL?</button>
      <div>
        <button class="infobutton" on:click={() => dispatch('openBomView')}
          >View Bill of Materials</button
        >
      </div>
    </div>

    {#if flags.assembly && hasPro}
      <button
        class="relative bg-teal-500/10 hover:bg-teal-500/30 rounded mt-8 px-4 py-2 ml--2 text-start"
        class:hover:animate-wiggle={$assemblyIsNew}
        on:click={() => {
          $assemblyIsNew = false
          dispatch('openAssembly')
        }}
      >
        {#if $assemblyIsNew}
          <div class="absolute right-2 top--3 bg-teal-600 text-white px-2 rotate-5 rounded">NEW</div>
        {/if}
        <b class="text-teal-600 dark:text-teal-400">No Time to Tinker?</b>
        <span class="font-medium">Buy Keyboard Assembled and Ready to Use.</span>
        <div class="mt-2 flex gap-4 items-center">
          <div class="text-sm">
            <span class="opacity-70"
              >You can now get your hands on your dream keyboard faster &amp; easier. Ships globally in
              1–2 weeks from</span
            >
            <span class="ml-0.5" />
            {#each SORTED_VENDORS as vendor}
              <Icon class="inline mx-0.5 mt--0.5" size="1.3em" name="flag-{vendor.flag}" />
            {/each}
          </div>
          <div
            class="rounded-full bg-teal-200 dark:bg-teal-600 flex items-center justify-center w-8 h-8 flex-none"
          >
            <Icon size={24} path={mdi.mdiChevronRight} />
          </div>
        </div>
      </button>
    {:else}
      <div class="bg-teal-500/10 rounded my-4 px-4 py-2 mx--2">
        <b class="text-teal-600">Coming Soon!</b>
        <span class="font-medium">Buy Your Keyboard Assembled and Ready to Use.</span>
        <p class="text-sm mt-2 opacity-70">
          I'll be pairing up with a couple keyboard makers/enthusiasts so you can get your hands on your
          dream keyboard faster &amp; easier. <a class="underline" href="{base}/docs/assembly-service/"
            >Learn more.</a
          >
        </p>
      </div>
    {/if}

    {#if mode == 'basic' || mode == 'intermediate'}
      {#if !stateError}
        <VisualEditor2
          basic={mode == 'basic'}
          cosmosConf={stateOptions}
          {geometry}
          bind:conf={config}
          on:goAdvanced={() => (mode = 'intermediate')}
        />
      {/if}
    {:else}
      <Editor
        bind:initialContent={initialEditorContent}
        bind:hashContent={editorContent}
        {darkMode}
        cosmosConf={$protoConfig}
        bind:conf={config}
      />
    {/if}
  {/if}
</div>

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }

  .infobutton {
    --at-apply: 'bg-purple-100 dark:bg-gray-900/50 hover:bg-purple-200 dark:hover:bg-pink-900/70 rounded px-4 py-1 focus:outline-none border border-transparent focus:border-pink-500';
  }

  :global(.inline-flag) {
    --at-apply: 'inline skew-x--5';
  }
</style>
