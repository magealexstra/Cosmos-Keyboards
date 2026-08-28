<script lang="ts">
  import { Matrix4 } from 'three'
  import type { Center, KeyboardSide, FullGeometry, FullCuttleform } from '$lib/worker/config'
  import Trsf from '$lib/worker/modeling/transformation'
  import {
    debugViewport,
    protoConfig,
    transformMode,
    clickedKey,
    selectMode,
    tempConfig,
    showGrid,
    showHelp,
    referenceModels,
    type TempConfig,
  } from '$lib/store'
  import * as flags from '$lib/flags'
  import * as mdi from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import NewViewer from './Viewer.svelte'
  import {
    indexOfKey,
    nthKey,
    toPosRotation,
    type CosmosCluster,
    type CosmosKey,
    type CosmosKeyboard,
  } from '$lib/worker/config.cosmos'
  import {
    addColumnInPlace,
    addKeyInPlace,
    transformationCenter,
    updateReferenceModels,
  } from './viewer3dHelpers'
  import type { HandData } from '$lib/handhelpers'
  import { writable } from 'svelte/store'

  import KeyInspectorHud from './hud/KeyInspectorHud.svelte'
  import ReferenceModelList from './hud/ReferenceModelList.svelte'
  import DebugViewportHud from './hud/DebugViewportHud.svelte'
  import ViewerHelpOverlay from './hud/ViewerHelpOverlay.svelte'

  import KeyboardLayer from './layers/KeyboardLayer.svelte'
  import HandSimulationLayer from './layers/HandSimulationLayer.svelte'
  import ReferenceModelsLayer from './layers/ReferenceModelsLayer.svelte'
  import KeyTransformGizmoLayer from './layers/KeyTransformGizmoLayer.svelte'
  import SceneEnvironmentLayer from './layers/SceneEnvironmentLayer.svelte'

  export let darkMode: boolean
  export let showSupports = false
  export let style: string = ''
  export let center: Center
  export let size: [number, number, number]
  export let cameraPosition: [number, number, number] = [0.16, -0.96, 0.56]
  export let enableRotate = true
  export let enableZoom = false
  export let isExpert: boolean
  export let transparency: number
  export let showHand = true
  export let showFit: boolean
  export let geometry: FullGeometry
  export let progress = 1
  export let conf: FullCuttleform | undefined

  let snapRotation = false
  const useAbsolute = writable<boolean>(false)

  $: if (conf && $showHelp) $clickedKey = 0

  $: if ($debugViewport) {
    const origFn = HTMLCanvasElement.prototype.getContext
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = function (type, attributes) {
      if (type === 'webgl' || type === 'webgl2') {
        attributes = Object.assign({}, attributes, { preserveDrawingBuffer: true })
      }
      // @ts-ignore
      return origFn.call(this, type, attributes)
    }
  }

  function removeKey() {
    if ($clickedKey == null) return
    protoConfig.update((proto) => {
      const { key, column, cluster } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') column.keys.splice(column.keys.indexOf(key), 1)
      if ($selectMode == 'column' || column.keys.length == 0)
        cluster.clusters.splice(cluster.clusters.indexOf(column), 1)
      return proto
    })
    $clickedKey = null
  }

  function addKey(dx: number, dy: number) {
    protoConfig.update((proto) => {
      let newKey: CosmosKey | undefined
      if ($selectMode == 'key') newKey = addKeyInPlace(proto, $clickedKey!, dx, dy)
      if ($selectMode == 'column') newKey = addColumnInPlace(proto, $clickedKey!, dx)
      if (newKey) clickedKey.set(indexOfKey(proto, newKey))
      return proto
    })
  }

  function onMove(obj: Matrix4, change: boolean) {
    if (!change) {
      tempConfig.update((proto) => {
        const oldPosition = transformationCenter($clickedKey!, proto, $selectMode, true)
        obj.premultiply(oldPosition.evaluate({ flat: false }, new Trsf()).Matrix4().invert())
        const { position, rotation } = toPosRotation(obj)
        const { key, column, cluster } = nthKey(proto, $clickedKey!)
        const update = (k: CosmosKey | CosmosCluster) => {
          k.position = position
          k.rotation = rotation
        }
        if ($selectMode == 'key') update(key)
        if ($selectMode == 'column') update(column)
        if ($selectMode == 'cluster') update(cluster)
        ;(proto as TempConfig).fromProto = false
        return proto
      })
    } else {
      protoConfig.update((proto) => {
        const oldPosition = transformationCenter($clickedKey!, proto, $selectMode, true)
        obj.premultiply(oldPosition.evaluate({ flat: false }, new Trsf()).Matrix4().invert())
        const { position, rotation } = toPosRotation(obj)
        const { key, column, cluster } = nthKey(proto, $clickedKey!)
        const update = (k: CosmosKey | CosmosCluster) => {
          k.position = position
          k.rotation = rotation
        }
        if ($selectMode == 'key') update(key)
        if ($selectMode == 'column') update(column)
        if ($selectMode == 'cluster') update(cluster)
        return proto
      })
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (document.activeElement != document.body) return
    if (event.keyCode == 17) snapRotation = true
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    if (event.key == 'Escape') $clickedKey = null
    else if (event.key == 'q') $transformMode = 'select'
    else if (event.key == 'e' || event.key == 'r') $transformMode = 'rotate'
    else if (event.key == 'w' || event.key == 'g') $transformMode = 'translate'
    else if (event.key == 'k') $selectMode = 'key'
    else if (event.key == 'l') $selectMode = 'column'
    else if (event.key == 'o') $selectMode = 'cluster'
    else if (event.key == 'Delete') {
      if (selectedImportId != null) deleteImport(selectedImportId)
      else removeKey()
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.keyCode == 17) snapRotation = false
  }

  function getClickedSide(config: CosmosKeyboard, n: number | null): KeyboardSide | null {
    if (config?.unibody) return 'unibody'
    if (n == null) return null
    return nthKey(config, n).cluster.side
  }

  $: clickedConfigSide = getClickedSide($protoConfig, $clickedKey)

  let handSimLayer: HandSimulationLayer | undefined
  let jointsJSON: HandData | undefined
  let pressedLetter: string | null = null
  let zPos: number = 0
  let reachabilityArr: any = {}

  let importedOpacity = 1
  let selectedImportId: number | null = null
  let hoveredImportId: number | null = null
  let fileDragging = false
  $: if ($clickedKey != null) selectedImportId = null

  function deleteImport(id: number) {
    referenceModels.update((r) => r.filter((m) => m.id != id))
    if (selectedImportId == id) selectedImportId = null
    if (hoveredImportId == id) hoveredImportId = null
  }

  // prettier-ignore
  const STL_MIME_TYPES = ['', 'model/stl', 'application/sla', 'application/vnd.ms-pki.stl', 'model/x.stl-binary', 'model/x.stl-ascii']

  function handleDragOver(e: DragEvent) {
    if (!e.dataTransfer) return
    const isStl = Array.from(e.dataTransfer.items || []).some(
      (i) => i.kind == 'file' && STL_MIME_TYPES.includes(i.type.toLowerCase())
    )
    if (isStl) {
      e.preventDefault()
      fileDragging = true
    }
  }
  function handleDragLeave(e: DragEvent) {
    if (e.currentTarget == e.target) fileDragging = false
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    fileDragging = false
    updateReferenceModels(e.dataTransfer?.files || [], geometry, center)
  }

  $: floorZ = $showGrid ? (geometry.right || geometry.unibody)?.floorZ ?? 0 : 0
</script>

<svelte:window on:keydown={handleKeydown} on:keyup={handleKeyUp} />

<div class="absolute top-10 left-0 right-0">
  {#if flags.hand && showHand}
    <div class="flex justify-center gap-2">
      <button class="button" on:click={() => handSimLayer?.scanHand()}>Scan Hand</button>
      {#if jointsJSON}
        {#if !isExpert}
          <button
            on:click={() => (showFit = true)}
            class="button bg-gradient-to-r! from-pink-300 to-orange-300 dark:from-pink-800 dark:to-orange-800"
          >
            Fit to Hand
          </button>
        {/if}
        <button class="button" on:click={() => handSimLayer?.toggleplay()}>Simulate</button>
      {/if}
    </div>
  {/if}
  <KeyInspectorHud {isExpert} {useAbsolute} />
  {#if progress != 1}
    <div
      class="mx-auto mt-4 bg-slate-100 dark:bg-slate-700 py-2 w-48 text-center rounded z-1 relative flex items-center gap-4 px-4"
    >
      <Icon path={mdi.mdiLoading} class="animate-spin" />
      Generating: {Math.round(progress * 100)}%
    </div>
  {/if}
</div>

<NewViewer
  {style}
  bind:cameraPosition
  {enableRotate}
  {enableZoom}
  enablePan={true}
  suggestedSize={size}
  on:dragenter={handleDragOver}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <KeyboardLayer
    {geometry}
    {center}
    {transparency}
    {pressedLetter}
    translation={zPos}
    {reachabilityArr}
  />
  <slot />
  <ReferenceModelsLayer bind:selectedImportId bind:hoveredImportId {importedOpacity} />
  <HandSimulationLayer
    bind:this={handSimLayer}
    bind:jointsJSON
    bind:pressedLetter
    bind:translation={zPos}
    bind:reachabilityArr
    {geometry}
    {center}
    {showHand}
    {conf}
    protoConfig={$protoConfig}
    tempConfig={$tempConfig}
  />
  <KeyTransformGizmoLayer
    {geometry}
    {center}
    {clickedConfigSide}
    {darkMode}
    {showSupports}
    {snapRotation}
    useAbsolute={$useAbsolute}
    onAddKey={addKey}
    {onMove}
  />
  <SceneEnvironmentLayer {floorZ} {center} />
</NewViewer>

{#if fileDragging}
  <div
    class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-white/40 dark:bg-gray-900/60 backdrop-blur-2 rounded-2"
  >
    <div class="text-lg rounded-3 bg-white/80 dark:bg-gray-900/80 px-6 py-4">
      Drop the STL file to import it as a reference model
    </div>
  </div>
{/if}
<ReferenceModelList bind:importedOpacity bind:selectedImportId bind:hoveredImportId />
<DebugViewportHud bind:cameraPosition />
<ViewerHelpOverlay />

<style>
  .button {
    z-index: 10;
    --at-apply: 'appearance-none bg-gray-200 dark:bg-gray-900 p-1 pr-2 m-1 rounded text-gray-800 dark:text-gray-200 flex gap-2';
  }
  .button:not(:disabled) {
    --at-apply: 'hover:bg-gray-400 dark:hover:bg-gray-700';
  }
  .button:disabled {
    --at-apply: 'opacity-40';
  }
</style>
