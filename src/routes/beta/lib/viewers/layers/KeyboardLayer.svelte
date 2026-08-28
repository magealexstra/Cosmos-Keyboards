<script lang="ts">
  import { T } from '@threlte/core'
  import type { Center, FullGeometry } from '$lib/worker/config'
  import { showKeyInts } from '$lib/store'
  import * as flags from '$lib/flags'
  import Keyboard from '$lib/3d/Keyboard.svelte'
  import KeyboardMaterial from '$lib/3d/KeyboardMaterial.svelte'
  import GroupMatrix from '$lib/3d/GroupMatrix.svelte'
  import { componentBoxes, componentGeometry } from '$lib/worker/geometry'
  import { simplePartGeos, simpleSocketGeos } from '$lib/loaders/simpleparts'
  import { simpleKeyGeo, simpleKeyPosition } from '$lib/loaders/simplekeys'
  import Trsf from '$lib/worker/modeling/transformation'
  import { objEntriesNotNull } from '$lib/worker/util'

  export let geometry: FullGeometry
  export let center: Center
  export let transparency: number
  export let pressedLetter: string | null = null
  export let translation: number = 0
  export let reachabilityArr: any = {}
</script>

{#each objEntriesNotNull(geometry) as [kbd, geo] (kbd)}
  {@const cent = center[kbd]}
  {#if cent}
    <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
      <Keyboard
        geometry={geo}
        {transparency}
        flip={kbd == 'left'}
        {pressedLetter}
        {translation}
        reachability={reachabilityArr?.[kbd]}
        side={kbd}
      />
      {#if flags.intersection}
        {#each componentBoxes(geo.c, geo) as box}
          <T.Mesh geometry={componentGeometry(box)}>
            <KeyboardMaterial status="error" kind="key" />
          </T.Mesh>
        {/each}
      {/if}
      {#if $showKeyInts}
        {#each geo.c.keys as k, i}
          <GroupMatrix matrix={geo.keyHolesTrsfs[i].Matrix4()}>
            {#each simplePartGeos(k.type, k.variant || {}) as g}
              <T.Mesh geometry={g}><KeyboardMaterial status="error" kind="key" /></T.Mesh>
            {/each}
            {#each simpleSocketGeos(k.type, k.variant || {}) as g}
              <T.Mesh geometry={g}><KeyboardMaterial status="warning" kind="key" opacity={0.5} /></T.Mesh
              >
            {/each}
            {@const skey = simpleKeyGeo(k, true)}
            {#if skey}
              <GroupMatrix matrix={simpleKeyPosition(k, new Trsf()).Matrix4()}>
                <T.Mesh geometry={skey}><KeyboardMaterial status="error" kind="key" /></T.Mesh>
              </GroupMatrix>
            {/if}
          </GroupMatrix>
        {/each}
      {/if}
    </T.Group>
  {/if}
{/each}
