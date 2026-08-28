<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import Tooltip from '$lib/presentation/Tooltip.svelte'
  import * as mdi from '@mdi/js'
  import { SUPPORTS_DENSITY, type FilamentEstimate } from '../filament'
  import FilamentChart from '../FilamentChart.svelte'
  import type { FullCuttleform } from '$lib/worker/config'
  import { confError } from '$lib/store'
  import { isRenderable } from '$lib/worker/check'

  export let filament: FilamentEstimate | undefined = undefined
  export let config: FullCuttleform | undefined = undefined
  export let showSupports: boolean = false

  let referenceElement: HTMLElement
</script>

{#if filament && isRenderable($confError) && (config?.right ?? config?.unibody)?.shell?.type == 'basic'}
  <div
    class="absolute bottom-0 right-0 text-right mb-2 bg-white/50 dark:bg-gray-800/50 rounded px-2 py-0.5 z-10"
  >
    {filament.length.toFixed(1)}m
    <span class="text-gray-600 dark:text-gray-100">of filament</span>
    <button class="s-help" bind:this={referenceElement}>
      <Icon path={mdi.mdiInformation} size="20px" />
    </button>
    <Tooltip {referenceElement} placement="top" spaceAway={4} bind:open={showSupports}>
      <div
        class="flex gap-4 items-end rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1 mx-4 text-gray-600 dark:text-gray-100"
      >
        <FilamentChart fractionKeyboard={filament.fractionKeyboard} />
        <div>
          <p class="whitespace-nowrap mb-2">
            Estimated {#if config?.right}for 2 halves{/if} using
            <span class="font-semibold text-teal-500 dark:text-teal-400">100% infill</span>,<br /><span
              class="font-semibold text-purple-500 dark:text-purple-400"
              >{SUPPORTS_DENSITY * 100}% supports density</span
            >.
          </p>
          <p class="whitespace-nowrap mb-1">
            This will cost about <span class="font-semibold text-black dark:text-white"
              >${filament.cost.toFixed(2)}</span
            >.
          </p>
          <p class="whitespace-nowrap text-sm">
            The keyboard itself uses {filament.keyboard.length.toFixed(1)}m ({filament.keyboard.mass.toFixed(
              0
            )}g).
          </p>
        </div>
      </div>
    </Tooltip>
  </div>
{/if}
