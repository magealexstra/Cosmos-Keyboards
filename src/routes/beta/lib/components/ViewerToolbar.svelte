<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import Preset from '$lib/presentation/Preset.svelte'
  import Popover from '$lib/presentation/Popover.svelte'
  import Icon from '$lib/presentation/Icon.svelte'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import * as mdi from '@mdi/js'
  import * as flags from '$lib/flags'
  import {
    showTiming,
    developer,
    showHand,
    view,
    showGrid,
    noWall,
    noBase,
    noLabels,
    noBlanks,
    showHelp,
  } from '$lib/store'

  export let viewer: string = '3d'
  export let transparency: number = 95

  const dispatch = createEventDispatcher<{
    importModel: void
  }>()

  let referenceElementTools: HTMLButtonElement
  let referenceElementPrefs: HTMLButtonElement
  let prefsOpen = false
  let toolsOpen = false
</script>

<div class="flex gap-1 justify-center items-center h-[42px]">
  <Preset purple class="relative z-10 !px-2" on:click={() => (viewer = '3d')} selected={viewer == '3d'}
    >3D</Preset
  >
  <Preset purple class="relative z-10 !px-2" on:click={() => (viewer = 'top')} selected={viewer == 'top'}
    >Keys</Preset
  >
  <Preset
    purple
    class="relative z-10 !px-2"
    on:click={() => (viewer = 'programming')}
    selected={viewer == 'programming'}>Program</Preset
  >
  <div class="preset-overflow <xl:hidden">
    <Preset
      purple
      class="relative z-10 !px-2"
      on:click={() => (viewer = 'thick')}
      selected={viewer == 'thick'}>Thickness</Preset
    >
    {#if $showTiming}<Preset
        purple
        class="relative z-10 !px-2"
        on:click={() => (viewer = 'timing')}
        selected={viewer == 'timing'}>Timing</Preset
      >{/if}
    {#if $developer}
      <Preset
        purple
        class="relative z-10 !px-2"
        on:click={() => (viewer = 'dev')}
        selected={viewer == 'dev'}>Dev</Preset
      >
    {/if}
  </div>
  <Preset
    purple
    class="xl:hidden relative z-10 !px-2 flex items-center gap-2"
    selected={['board', 'thick', 'timing', 'dev'].includes(viewer)}
    bind:button={referenceElementTools}><Icon path={mdi.mdiToolboxOutline} /> ...</Preset
  >
  <input class="relative z-10 mx-2" type="range" min="0" max="100" bind:value={transparency} />
  {#if flags.hand}<Preset
      purple
      square
      class="relative z-10"
      on:click={() => ($showHand = !$showHand)}
      selected={$showHand}><Icon path={mdi.mdiHandBackRightOutline} /></Preset
    >{/if}
  <Preset
    purple
    square
    class="relative z-10 !px-2"
    bind:button={referenceElementPrefs}
    selected={prefsOpen}><Icon path={mdi.mdiCogOutline} /></Preset
  >
</div>
<div style="--z-index: 1000">
  <Popover
    referenceElement={referenceElementPrefs}
    placement="bottom-end"
    spaceAway={4}
    bind:open={prefsOpen}
  >
    <div
      class="bg-[#f8f5ff]/80 dark:bg-gray-900/80 backdrop-blur-md px-2 py-1 mr-[-.5rem] rounded-2 text-small select-none"
    >
      <div>
        <button
          title="View Left Side Only"
          class="basicbutton px-2 rounded-l"
          on:click={() => ($view = 'left')}
          class:selected={$view == 'left'}><Icon name="kb-left" /></button
        >
        <button
          title="View All Sides"
          class="basicbutton px-2"
          on:click={() => ($view = 'both')}
          class:selected={$view == 'both'}><Icon name="kbs" /></button
        >
        <button
          title="View Right Side Only"
          class="basicbutton px-2 rounded-r"
          on:click={() => ($view = 'right')}
          class:selected={$view == 'right'}><Icon name="kb-right" /></button
        >
      </div>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="flex items-center mt-2 mb-4">
        <Checkbox small purple basic bind:value={$showGrid} /> Show Grid
      </label>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="flex items-center my-2">
        <Checkbox small purple basic bind:value={$noWall} /> Hide Wall
      </label>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="flex items-center my-2">
        <Checkbox small purple basic bind:value={$noBase} /> Hide Base
      </label>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="flex items-center my-2">
        <Checkbox small purple basic bind:value={$noLabels} /> Hide Labels
      </label>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="flex items-center my-2">
        <Checkbox small purple basic bind:value={$noBlanks} /> Hide Shapers
      </label>
      <button
        class="text-center text-sm w-full opacity-70 block mb-1"
        on:click={() => {
          dispatch('importModel')
        }}>Import Model</button
      >
      <button
        class="text-center text-sm w-full opacity-70 block mb-1"
        on:click={() => {
          $showHelp = true
          prefsOpen = false
        }}>Show Help</button
      >
    </div>
  </Popover>
</div>
<div class="xl:hidden" style="--z-index: 50">
  <Popover
    referenceElement={referenceElementTools}
    placement="bottom-end"
    spaceAway={4}
    bind:open={toolsOpen}
  >
    <div class="bg-white/50 dark:bg-gray-800/50 px-2 py-1 mr-[-.5rem] rounded">
      <Preset purple class="!px-2" on:click={() => (viewer = 'thick')} selected={viewer == 'thick'}
        >Thickness</Preset
      >
      {#if $showTiming}<Preset
          purple
          class="relative z-10 !px-2"
          on:click={() => (viewer = 'timing')}
          selected={viewer == 'timing'}>Timing</Preset
        >{/if}
      {#if $developer}
        <Preset
          purple
          class="relative z-10 !px-2"
          on:click={() => (viewer = 'dev')}
          selected={viewer == 'dev'}>Dev</Preset
        >
      {/if}
    </div>
  </Popover>
</div>

<style>
  .basicbutton {
    --at-apply: 'bg-purple-100 dark:bg-gray-900/50 hover:bg-purple-200 dark:hover:bg-pink-900/70 py-1 focus:outline-none border border-transparent focus:border-pink-500';
  }
  .basicbutton.selected {
    --at-apply: 'bg-purple-400 dark:bg-pink-700';
  }

  input[type='range'] {
    --at-apply: 'appearance-none bg-transparent';
  }

  input[type='range']::-moz-range-track {
    --at-apply: 'appearance-none bg-[#EFE8FF] dark:bg-slate-900 h-2 rounded';
  }

  input[type='range']::-webkit-slider-runnable-track {
    --at-apply: 'appearance-none bg-[#EFE8FF] dark:bg-slate-900 h-2 rounded';
  }

  input[type='range']::-moz-range-thumb {
    --at-apply: "appearance-none w-6 h-6 bg-purple-300 dark:bg-pink-600 rounded-full border-transparent bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')]";
    background-size: 1.3rem 1.3rem;
    background-position: center 40%;
    background-repeat: no-repeat;
  }

  input[type='range']::-webkit-slider-thumb {
    --at-apply: "appearance-none w-6.8 h-6.8 bg-purple-300 dark:bg-pink-600 rounded-full border-transparent mt--2.4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')]";
    background-size: 1.3rem 1.3rem;
    background-position: center 40%;
    background-repeat: no-repeat;
  }

  input[type='range']::-moz-range-thumb:hover {
    --at-apply: 'bg-purple-400 dark:bg-pink-800';
  }
  input[type='range']::-webkit-slider-thumb:hover {
    --at-apply: 'bg-purple-400 dark:bg-pink-800';
  }
</style>
