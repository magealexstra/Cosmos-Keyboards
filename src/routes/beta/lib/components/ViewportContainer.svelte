<script lang="ts">
  import Viewer3D from '../viewers/Viewer3D.svelte'
  import Thick3D from '../viewers/ViewerThickness.svelte'
  import ViewerLayout from '../viewers/ViewerLayout.svelte'
  import ViewerMatrix from '../viewers/ViewerMatrix.svelte'
  import ViewerPea from '../viewers/ViewerPea.svelte'
  import ViewerTiming from '../viewers/ViewerTiming.svelte'
  import ViewerDev from '../viewers/ViewerDev.svelte'
  import KeyboardModel from '$lib/3d/KeyboardModel.svelte'
  import ConfError from '../ConfError.svelte'
  import { T } from '@threlte/core'
  import { isRenderable } from '$lib/worker/check'
  import { codeError, confError, showHand, view } from '$lib/store'
  import { objEntriesNotNull } from '$lib/worker/util'
  import type { FullCuttleform, FullGeometry } from '$lib/worker/config'
  import type { FullKeyboardMeshes } from '../viewers/viewer3dHelpers'
  import type { WorkerPool, TaskError } from '../workerPool'

  export let viewer: string = '3d'
  export let config: FullCuttleform
  export let geometry: FullGeometry = {}
  export let microcontrollerGeometry: FullGeometry = {}
  export let meshes: FullKeyboardMeshes = {}
  export let center: any
  export let size: [number, number, number] = [0, 0, 0]
  export let generatorProgress: number = 1
  export let transparency: number = 95
  export let showSupports: boolean = false
  export let darkMode: boolean = false
  export let mode: string = 'basic'
  export let pool: WorkerPool<typeof import('$lib/worker/api')>
  export let ocError: TaskError | undefined = undefined
  export let showFit: boolean = false
  export let fullMatrix: any = null
  export let hideWall: boolean = false

  $: cTransparency = showSupports ? 0 : transparency
  $: hasLemon = (config?.right || config?.unibody)?.microcontroller?.startsWith('lemon')
  $: keyboardEntries = objEntriesNotNull(meshes).filter(
    ([s, v]) => s == 'unibody' || $view == 'both' || $view == s
  )
</script>

{#if viewer == '3d'}
  <Viewer3D
    {darkMode}
    geometry={microcontrollerGeometry}
    transparency={cTransparency}
    conf={isRenderable($confError) ? config : undefined}
    isExpert={mode == 'advanced'}
    {showSupports}
    {center}
    bind:showFit
    enableZoom={true}
    showHand={$showHand}
    progress={generatorProgress}
    {size}
  >
    {#each keyboardEntries as [kbd, mesh] (kbd)}
      {@const cent = center[kbd]}
      {#if cent}
        <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
          <KeyboardModel
            side={kbd}
            {hideWall}
            {transparency}
            {showSupports}
            microcontrollerGeometry={microcontrollerGeometry[kbd]}
            meshes={mesh}
          />
        </T.Group>
      {/if}
    {/each}
  </Viewer3D>
{:else if viewer == 'thick'}
  <Thick3D
    geometry={isRenderable($confError) ? geometry : undefined}
    {center}
    enableZoom={true}
    {darkMode}
    {size}
  >
    {#each keyboardEntries as [kbd, mesh] (kbd)}
      {@const cent = center[kbd]}
      {#if cent}
        <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
          <KeyboardModel
            side={kbd}
            noWeb
            {hideWall}
            {transparency}
            {showSupports}
            microcontrollerGeometry={microcontrollerGeometry[kbd]}
            meshes={mesh}
          />
        </T.Group>
      {/if}
    {/each}
  </Thick3D>
{:else if viewer == 'top'}
  <ViewerLayout {geometry} {darkMode} conf={config} confError={$confError} />
{:else if viewer == 'programming'}
  {#if hasLemon}
    <ViewerPea {geometry} confError={$confError} bind:fullMatrix />
  {:else}
    <ViewerMatrix {geometry} {darkMode} confError={$confError} />
  {/if}
{:else if viewer == 'timing'}
  <ViewerTiming {pool} {darkMode} />
{:else if viewer == 'dev'}
  <ViewerDev {geometry} />
{/if}

{#if $codeError && viewer == '3d'}
  <div class="absolute text-white m-4 left-0 right-0 rounded p-4 top-[10%] bg-red-700">
    <h3 class="font-bold">There is an error with your code.</h3>
    <p class="mb-2">{$codeError.message}</p>
  </div>
{:else}
  {#if $confError.length && viewer == '3d'}
    <ConfError {config} {mode} />
  {/if}
  {#if ocError && viewer == '3d'}
    {#if String(ocError.message).startsWith('Stilts ')}
      <div class="absolute text-white m-4 left-0 right-0 rounded p-4 top-[10%] bg-pink-700">
        <p class="mb-2">
          Stilts mode doesn't work with every model out there. The generator reported the issue:
          <span class="font-600">{ocError}</span>.
        </p>
        <p class="mb-2">
          Often this is because your keys are angled too horizontal or your microcontroller is
          interfering with the walls.
        </p>
        <p class="mb-2">
          Try the following to fix the problem: Set the microcontroller to none, then tilt keys to be
          more vertical. Once you have a working model, you can go back and readd the microcontroller and
          key tilting.
        </p>
      </div>
    {:else}
      <div class="absolute text-white m-4 left-0 right-0 rounded p-4 top-[10%] bg-red-700">
        <p>There are some rough edges in this tool, and you've found one of them.</p>
        <p class="mb-2">The set of options you've chosen cannot be previewed.</p>
        <p class="mb-2">Here's some technical information:</p>
        <p class="text-sm"><code>During processing of <b>{ocError.task}</b></code></p>
        <p class="text-sm">
          <code
            >{ocError}<br />{ocError.stack ? ocError.stack.split('\n').slice(0, 5).join('\n') : ''}</code
          >
        </p>
      </div>
    {/if}
  {/if}
{/if}
