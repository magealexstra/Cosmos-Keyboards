<script lang="ts">
  import { T } from '@threlte/core'
  import Gizmo from '$lib/3d/ThrelteGizmo.svelte'
  import { showGizmo, showGrid, view } from '$lib/store'
  import type { Center } from '$lib/worker/config'

  export let floorZ: number = 0
  export let center: Center
</script>

{#if $showGizmo}
  <Gizmo verticalPlacement="top" horizontalPlacement="left" paddingX={50} paddingY={50} />
{/if}
{#if $showGrid}
  <T.GridHelper
    args={[$view == 'both' ? 400 : 300, $view == 'both' ? 40 : 30, 0x888888]}
    position.z={floorZ - (Object.values(center)[0] || [0, 0, 0])[2]}
    rotation={[-Math.PI / 2, 0, 0]}
  />
{/if}
