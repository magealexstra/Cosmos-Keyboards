<script lang="ts">
  import Dialog from '$lib/presentation/Dialog.svelte'
  import UrlView from '../dialogs/URLView.svelte'
  import BomView from '../dialogs/BomView.svelte'
  import KleView from '../dialogs/KleView.svelte'
  import HandFitView from '../dialogs/HandFitView.svelte'
  import DownloadDialog from '../dialogs/DownloadDialog.svelte'
  import { confError, protoConfig } from '$lib/store'
  import { isRenderable } from '$lib/worker/check'
  import { fromCosmosConfig, type CosmosKeyboard } from '$lib/worker/config.cosmos'
  import { microcontrollerConnectors } from '$lib/geometry/microcontrollers'
  import type { FullCuttleform, FullGeometry } from '$lib/worker/config'
  import type { WorkerPool } from '../workerPool'

  export let urlView: boolean = false
  export let bomView: boolean = false
  export let kleView: boolean = false
  export let showFit: boolean = false
  export let downloading: boolean = false
  export let lemonSwitch: boolean = false
  export let proOpen: boolean = false
  export let mode: string = 'basic'
  export let editorContent: string = ''
  export let config: FullCuttleform
  export let geometry: FullGeometry = {}
  export let pool: WorkerPool<typeof import('$lib/worker/api')>

  function switchUC(uc: Exclude<CosmosKeyboard['microcontroller'], null>) {
    $protoConfig.microcontroller = uc
    lemonSwitch = false

    try {
      const { mirrorConnectors, connectors } = microcontrollerConnectors(
        $protoConfig.microcontroller,
        $protoConfig.connectors
      )
      $protoConfig.connectors = connectors
      $protoConfig.mirrorConnectors = mirrorConnectors
      config = fromCosmosConfig($protoConfig)
    } catch (e) {
      alert('Error generating with a Lemon. reverting...')
    }
  }
</script>

{#if urlView}
  <Dialog on:close={() => (urlView = false)}>
    <span slot="title">What's in the URL?</span>
    <div slot="content"><UrlView {mode} {editorContent} /></div>
  </Dialog>
{/if}
{#if bomView}
  <Dialog big on:close={() => (bomView = false)}>
    <span slot="title">Bill of Materials</span>
    <div slot="content">
      {#if !config}
        <div class="bg-red-200 m-4 rounded p-4 dark:bg-red-700">
          Bill of Materials will not be available until the configuration is evaluated.
        </div>
      {:else if !isRenderable($confError)}
        <div class="bg-red-200 m-4 rounded p-4 dark:bg-red-700">
          Bill of Materials will not be available until you fix the errors in your configuration.
        </div>
      {:else}
        {#if (config?.right || config?.unibody)?.shell.type != 'basic'}
          <div class="bg-yellow-200 m-4 rounded p-4 dark:bg-yellow-700">
            Screw information is not yet finished non-standard cases. Make sure to check the model for
            any additional screws needed.
          </div>
        {/if}
        <BomView {geometry} />
      {/if}
    </div>
  </Dialog>
{/if}
{#if kleView}
  <Dialog big on:close={() => (kleView = false)}>
    <span slot="title">KLE Export</span>
    <div slot="content">
      <KleView geo={geometry} />
    </div>
  </Dialog>
{/if}
{#if showFit}
  <Dialog big on:close={() => (showFit = false)}>
    <span slot="title">Fit Stagger to Hand</span>
    <div slot="content">
      <HandFitView on:apply={() => (showFit = false)} />
    </div>
  </Dialog>
{/if}
{#if downloading}
  <DownloadDialog
    {config}
    {pool}
    on:close={() => (downloading = false)}
    on:gopro={() => {
      downloading = false
      proOpen = true
    }}
  />
{/if}
{#if lemonSwitch}
  <Dialog on:close={() => (lemonSwitch = false)}>
    <span slot="title">Switch to a Lemon microcontroller?</span>
    <div slot="content" class="text-center">
      {#if mode === 'advanced'}
        Sorry, you'll need to manually change the microcontroller in your Expert mode code.
      {:else}
        <p class="mb-4">
          Learn more about the microcontrollers on the <a
            class="underline"
            href="https://ryanis.cool/cosmos/lemon">Lemon microcontroller homepage</a
          >.
        </p>
        <button class="button" on:click={() => switchUC('lemon-wired')}>Lemon Wired</button>
        <button class="button" on:click={() => switchUC('lemon-wireless')}>Lemon Wireless</button>
      {/if}
    </div>
  </Dialog>
{/if}

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }
</style>
