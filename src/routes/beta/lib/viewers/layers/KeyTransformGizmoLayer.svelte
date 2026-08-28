<script lang="ts">
  import { T } from '@threlte/core'
  import type { Center, FullGeometry, KeyboardSide } from '$lib/worker/config'
  import { protoConfig, transformMode, clickedKey, selectMode, view } from '$lib/store'
  import AddButton from '$lib/3d/AddButton.svelte'
  import TransformControls from '$lib/3d/TransformControls.svelte'
  import GroupMatrix from '$lib/3d/GroupMatrix.svelte'
  import { adjacentPositions, flipMatrixX, shouldFlipKey } from '../viewer3dHelpers'
  import type { Matrix4 } from 'three'

  export let geometry: FullGeometry
  export let center: Center
  export let clickedConfigSide: KeyboardSide | null
  export let darkMode: boolean
  export let showSupports: boolean = false
  export let snapRotation: boolean = false
  export let useAbsolute: boolean = false
  export let onAddKey: (dx: number, dy: number) => void
  export let onMove: (mat: Matrix4, change: boolean) => void
</script>

{#if clickedConfigSide != null}
  {@const clickedC = center[clickedConfigSide] || [0, 0, 0]}
  <T.Group position={[-clickedC[0], -clickedC[1], -clickedC[2]]}>
    {#if $transformMode == 'select' && !showSupports}
      {#each adjacentPositions(geometry[clickedConfigSide] ?? null, $clickedKey, $protoConfig, $selectMode) as adj}
        <GroupMatrix
          matrix={shouldFlipKey($view, $clickedKey, $protoConfig) ? flipMatrixX(adj.pos) : adj.pos}
        >
          <AddButton {darkMode} on:click={() => onAddKey(adj.dx, adj.dy)} />
        </GroupMatrix>
      {/each}
    {/if}
    <TransformControls
      snap={snapRotation}
      visible={!showSupports}
      {useAbsolute}
      on:move={(e) => onMove(e.detail, false)}
      on:change={(e) => onMove(e.detail, true)}
    />
  </T.Group>
{/if}
