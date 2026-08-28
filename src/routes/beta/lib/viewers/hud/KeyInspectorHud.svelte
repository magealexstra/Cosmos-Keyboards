<script lang="ts">
  import { decodeTuple, encodeTuple } from '$lib/worker/config'
  import Trsf from '$lib/worker/modeling/transformation'
  import {
    protoConfig,
    transformMode,
    clickedKey,
    selectMode,
    tempConfig,
    hoveredKey,
    showHelp,
  } from '$lib/store'
  import * as flags from '$lib/flags'
  import * as mdi from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import { diff, notNull, objKeys } from '$lib/worker/util'
  import {
    nthKey,
    nthPartType,
    type CosmosCluster,
    type CosmosKey,
    nthProfile,
    nthPartAspect,
    nthCurvature,
    isNthFirstColumn,
    isNthLastColumn,
    nthPartVariant,
    ROUND_PARTS,
    clusterName,
    cosmosKeyPosition,
    rotationPositionETrsf,
    nthSplay,
    calculateSplay,
    PARTS_WITH_KEYCAPS,
  } from '$lib/worker/config.cosmos'
  import { PROFILE } from '$target/cosmosStructs'
  import {
    formatHoming,
    keyProp,
    formatProfile,
    profileName,
    sortProfiles,
    keyPos,
    keyRot,
    AbsPositionStore,
    AbsRotationStore,
  } from '../viewer3dHelpers'
  import Field from '$lib/presentation/Field.svelte'
  import DecimalInput from '../../editor/DecimalInput.svelte'
  import Select from '$lib/presentation/Select.svelte'
  import { TupleStore, TupleMux } from '../../editor/tuple'
  import DecimalInputInherit from '../../editor/DecimalInputInherit.svelte'
  import SelectInherit from '$lib/presentation/SelectInherit.svelte'
  import { encodeVariant, PART_INFO, sortedCategories } from '$lib/geometry/socketsParts'
  import AngleInput from '../../editor/AngleInput.svelte'
  import AngleInputInherit from '../../editor/AngleInputInherit.svelte'
  import { base } from '$app/paths'
  import SelectThingy from '../../editor/SelectThingy.svelte'
  import SelectPartInner from '../../editor/SelectPartInner.svelte'
  import type { Writable } from 'svelte/store'
  import { Vector3 } from 'three'

  export let isExpert: boolean = false
  export let useAbsolute: Writable<boolean>
  export let popoutShown: boolean = false

  function removeKey() {
    if ($clickedKey == null) return
    protoConfig.update((proto) => {
      const { key, column, cluster } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') column.keys.splice(column.keys.indexOf(key), 1)
      // If there are no keys left in the column, delete the column too
      if ($selectMode == 'column' || column.keys.length == 0)
        cluster.clusters.splice(cluster.clusters.indexOf(column), 1)
      return proto
    })
    $clickedKey = null
  }

  function changeKey(e: CustomEvent) {
    protoConfig.update((proto) => {
      const newType: any = e.detail
      const { key, column } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') {
        key.partType.type = newType
        key.partType.variant = key.sizeA = key.sizeB = key.sizeC = undefined
        if (newType == 'blank') key.marginX = key.marginY = undefined
      }
      if ($selectMode == 'column') {
        column.partType.type = newType
        column.partType.variant = undefined
      }
      return proto
    })
  }

  function changeKeyAspect(e: Event) {
    protoConfig.update((proto) => {
      const oldAspect = nthPartAspect(proto, $clickedKey!, 'key')
      const newAspect = Number((e.target as HTMLInputElement).value)
      const newKey = diff(newAspect, nthPartAspect(proto, $clickedKey!, 'column'))
      const newColumn = diff(newAspect, nthPartAspect(proto, $clickedKey!, 'cluster'))
      let colOffset = 0
      // If the column is both first and last, these 2 cancel out so colOffset = 0
      if (isNthFirstColumn(proto, $clickedKey!)) colOffset += (oldAspect - newAspect) / 2
      if (isNthLastColumn(proto, $clickedKey!)) colOffset += (newAspect - oldAspect) / 2
      const { key, column } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') {
        key.partType.aspect = newKey
        key.column! = (key.column ?? column.column!) + colOffset
      }
      if ($selectMode == 'column') {
        column.partType.aspect = newColumn
        column.column! += colOffset
      }
      return proto
    })
  }

  function changeKeyVariant(e: Event, elem: string) {
    const newValue = (e.target as HTMLInputElement).value
    protoConfig.update((proto) => {
      const oldVariant = nthPartVariant(proto, $clickedKey!)
      const type = nthPartType(proto, $clickedKey!, 'key')
      oldVariant[elem] = newValue
      const { key } = nthKey(proto, $clickedKey!)
      key.partType.variant = encodeVariant(type, oldVariant)
      return proto
    })
  }

  function updateTuple(elem: 'position' | 'rotation', t: bigint, mode: 'key' | 'column' | 'cluster') {
    if ($clickedKey == null || t < 0) return
    const current = nthKey($protoConfig, $clickedKey!)[mode]
    if (t == (current[elem] || 0n)) return
    protoConfig.update((proto) => {
      const target = nthKey(proto, $clickedKey!)[mode]
      target[elem] = t
      return proto
    })
  }

  function setFingerSplay(e: CustomEvent) {
    const splay = Number(e.detail)
    protoConfig.update((proto) => {
      const { column, cluster } = nthKey(proto, $clickedKey!)
      const prevSplay = calculateSplay(column, cluster)
      const prevColumnIndex = cluster.clusters.indexOf(column) - 1

      const clusterTrsfInv =
        rotationPositionETrsf(cluster)?.evaluate({ flat: false }).invert() || new Trsf()

      const columnCenter = cosmosKeyPosition({ row: 0 } as any, column, cluster, proto)
        .evaluate({ flat: false })
        .premultiply(clusterTrsfInv)
        .origin()

      let topKeyTop = columnCenter
      let botKeyBot = columnCenter
      if (prevColumnIndex >= 0) {
        // Pose of each key in the column
        const keyPositions = column.keys.map((k) =>
          cosmosKeyPosition(k, cluster.clusters[prevColumnIndex], cluster, proto)
            .evaluate({ flat: false })
            .premultiply(clusterTrsfInv)
        )
        keyPositions.sort((a, b) => a.origin().y - b.origin().y)
        const mul = cluster.side == 'left' ? -1 : 1
        topKeyTop = keyPositions[keyPositions.length - 1].pretranslate(mul * 9.75, 9.75, 0).origin()
        botKeyBot = keyPositions[0].pretranslate(mul * 9.75, -9.75, 0).origin()
      }
      for (let colInd = prevColumnIndex + 1; colInd < cluster.clusters.length; colInd++) {
        const column = cluster.clusters[colInd]
        let [tx, ty, tz] = decodeTuple(column.position || 0n)
        let [irx, iry, irz] = decodeTuple(column.rotation || 0n)
        // Position of the center of the column
        const colPt = cosmosKeyPosition({ row: 0 } as any, column, cluster, proto)
          .evaluate({ flat: false })
          .premultiply(clusterTrsfInv)
          .origin()

        function applySplay(dA: number, abt: Vector3) {
          const rad = dA * (Math.PI / 180) * (cluster.side == 'left' ? 1 : -1)
          const newX = (colPt.x - abt.x) * Math.cos(rad) - (colPt.y - abt.y) * Math.sin(rad) + abt.x
          const newY = (colPt.x - abt.x) * Math.sin(rad) + (colPt.y - abt.y) * Math.cos(rad) + abt.y
          tx += 10 * (newX - colPt.x)
          ty += 10 * (newY - colPt.y)
        }

        applySplay(-prevSplay, prevSplay < 0 ? topKeyTop : botKeyBot) // Undo the current splay
        applySplay(splay, splay < 0 ? topKeyTop : botKeyBot) // Apply the current splay
        irz += (cluster.side == 'left' ? -1 : 1) * Math.round((prevSplay - splay) * 45) // Adjust this column's rotation
        column.position = encodeTuple([Math.round(tx), Math.round(ty), tz])
        column.rotation = encodeTuple([irx, iry, irz])
      }
      return proto
    })
  }

  function updateProto() {
    protoConfig.update((p) => p)
  }

  function setLetter(e: Event) {
    if ($clickedKey == null) return
    const letter = (e.target as HTMLInputElement).value
    protoConfig.update((p) => {
      const key = nthKey(p, $clickedKey!).key
      key.profile.letter = letter
      return p
    })
  }

  function changeCType(cluster: CosmosCluster | undefined) {
    if (!cluster || $clickedKey == null) return
    protoConfig.update((p) => {
      const targetCluster = nthKey(p, $clickedKey!).cluster
      if (targetCluster.type == 'matrix') targetCluster.type = 'sphere'
      else targetCluster.type = 'matrix'

      targetCluster.clusters.forEach((c) => (c.type = targetCluster.type))
      return p
    })
  }

  const positionStore = new TupleMux(
    useAbsolute,
    new TupleStore(-1n),
    new AbsPositionStore(tempConfig, clickedKey)
  )
  const [positionX, positionY, positionZ, _] = positionStore.components()
  positionStore.tuple.subscribe((t) => updateTuple('position', t, 'key'))
  $: if ($clickedKey != null) positionStore.update(nthKey($tempConfig, $clickedKey).key.position || 0n)

  const rotationStore = new TupleMux(
    useAbsolute,
    new TupleStore(-1n, 45),
    new AbsRotationStore(tempConfig, clickedKey)
  )
  const [rotationX, rotationY, rotationZ, __] = rotationStore.components()
  rotationStore.tuple.subscribe((t) => updateTuple('rotation', t, 'key'))
  $: if ($clickedKey != null) rotationStore.update(nthKey($tempConfig, $clickedKey).key.rotation || 0n)

  const cpositionStore = new TupleStore(-1n)
  const [cpositionX, cpositionY, cpositionZ, _3] = cpositionStore.components()
  cpositionStore.tuple.subscribe((t) => updateTuple('position', t, 'column'))
  $: if ($clickedKey != null)
    cpositionStore.update(nthKey($tempConfig, $clickedKey).column.position || 0n)

  const crotationStore = new TupleStore(-1n, 45)
  const [crotationX, crotationY, crotationZ, _4] = crotationStore.components()
  crotationStore.tuple.subscribe((t) => updateTuple('rotation', t, 'column'))
  $: if ($clickedKey != null)
    crotationStore.update(nthKey($tempConfig, $clickedKey).column.rotation || 0n)

  const lpositionStore = new TupleStore(-1n)
  const [lpositionX, lpositionY, lpositionZ, _5] = lpositionStore.components()
  lpositionStore.tuple.subscribe((t) => updateTuple('position', t, 'cluster'))
  $: if ($clickedKey != null)
    lpositionStore.update(nthKey($tempConfig, $clickedKey).cluster.position || 0n)

  const lrotationStore = new TupleStore(-1n, 45)
  const [lrotationX, lrotationY, lrotationZ, _6] = lrotationStore.components()
  lrotationStore.tuple.subscribe((t) => updateTuple('rotation', t, 'cluster'))
  $: if ($clickedKey != null)
    lrotationStore.update(nthKey($tempConfig, $clickedKey).cluster.rotation || 0n)

  $: keyIsClicked = $clickedKey == null ? null : nthKey($protoConfig, $clickedKey).key
  $: columnIsClicked = $clickedKey == null ? null : nthKey($protoConfig, $clickedKey).column
  $: clusterIsClicked = $clickedKey == null ? null : nthKey($protoConfig, $clickedKey).cluster
  $: keyIsHovered = $hoveredKey == null ? null : nthKey($protoConfig, $hoveredKey).key
  $: columnIsHovered = $hoveredKey == null ? null : nthKey($protoConfig, $hoveredKey).column
  $: clusterIsHovered = $hoveredKey == null ? null : nthKey($protoConfig, $hoveredKey).cluster
  $: hoveredPosition = $hoveredKey == null ? null : keyPos($protoConfig, $hoveredKey, $useAbsolute)
  $: hoveredCPosition = columnIsHovered == null ? null : decodeTuple(columnIsHovered.position || 0n)
  $: hoveredLPosition = clusterIsHovered == null ? null : decodeTuple(clusterIsHovered.position || 0n)
  $: hoveredRotation = $hoveredKey == null ? null : keyRot($protoConfig, $hoveredKey, $useAbsolute)
  $: hoveredCRotation = columnIsHovered == null ? null : decodeTuple(columnIsHovered.rotation || 0n)
  $: hoveredLRotation = clusterIsHovered == null ? null : decodeTuple(clusterIsHovered.rotation || 0n)

  $: columnType = columnIsClicked?.type
  $: clusterType = clusterIsClicked?.type
  $: sphereColumn = (columnIsClicked || columnIsHovered)?.type == 'sphere'
  // Spheres bend by a single curvature, so disparity would do nothing for them.
  $: sphereCluster = (clusterIsClicked || clusterIsHovered)?.clusters.some((c) => c.type == 'sphere')
</script>

{#if $clickedKey !== null}
  <div class="relative flex flex-1 justify-center">
    {#if $showHelp && $selectMode != 'cluster'}
      <div class="relative mr--0.5 max-[528px]:hidden">
        <div
          class="absolute z-10 top-16 left--5 w-50 font-urbanist font-500 text-sm light:opacity-80"
          class:left--24!={PART_INFO[nthPartType($protoConfig, $clickedKey, $selectMode)].partName
            .length < 20}
        >
          <svg
            class="absolute h-13 top--9 right-7 opacity-80"
            viewBox="340.4670715390309 429.628023054668 90.38483407847127 100.52045602861654"
          >
            <use xlink:href="{base}/arrows.svg#arrow2" />
          </svg>
          You can change a key to a trackball, trackpad, display, or encoder here!
        </div>
      </div>
    {/if}
    <div
      class="flex justify-center bg-[#EFE8FF] dark:bg-gray-900 rounded-5 pl-1 pr-2 gap-0.5 z-100 items-center mt-2 overflow-hidden"
    >
      {#if $selectMode == 'cluster'}
        <div class="line-height-8 px-8 capitalize">{clusterName(clusterIsClicked)} Cluster</div>
      {:else}
        <div class="relative">
          <div
            class="z-1 pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
          >
            <Icon
              size="20px"
              name={PART_INFO[nthPartType($protoConfig, $clickedKey, $selectMode)]?.icon || 'keycap'}
            />
          </div>
          <SelectThingy
            pink
            class="appearance-none bg-[#EFE8FF] dark:bg-gray-900 w-88 pl-20 h-8 pl-11! text-start {PART_INFO[
              nthPartType($protoConfig, $clickedKey, $selectMode)
            ].partName.length < 20
              ? 'w-64!'
              : ''}"
            options={Object.fromEntries(
              sortedCategories.map((cat) => [
                cat,
                notNull(objKeys(PART_INFO))
                  .filter(
                    (v) =>
                      PART_INFO[v].category == cat &&
                      (flags.draftuc || (!PART_INFO[v].draft && !PART_INFO[v].deprecated))
                  )
                  .map((p) => ({ key: p, label: PART_INFO[p].partName, ...PART_INFO[p] })),
              ])
            )}
            on:change={changeKey}
            value={nthPartType($protoConfig, $clickedKey, $selectMode)}
            component={SelectPartInner}
          />
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
          >
            <Icon path={mdi.mdiChevronDown} size="20px" />
          </div>
        </div>
      {/if}
      {#if ($selectMode == 'key' && PART_INFO[nthPartType($protoConfig, $clickedKey, 'key')].keycap) || $selectMode == 'column'}
        <div class="relative">
          <select
            class="appearance-none bg-purple-200 dark:bg-pink-900/80 w-22 h-8 px-2"
            on:change={changeKeyAspect}
            value={nthPartAspect($protoConfig, $clickedKey, $selectMode)}
          >
            {#each [1, 1.25, 1.5, 1.75, 2] as part}
              <option value={part}>{part}u</option>
            {/each}
          </select>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
          >
            <Icon path={mdi.mdiChevronDown} size="20px" />
          </div>
        </div>
      {/if}
      {#if $selectMode == 'key'}
        {@const info = PART_INFO[nthPartType($protoConfig, $clickedKey, 'key')]}
        {#each Object.entries('variants' in info ? info.variants : {}) as [key, opt]}
          <div class="relative">
            <select
              class="appearance-none bg-purple-200 dark:bg-pink-900/80 w-24 h-8 px-2"
              class:w-30!={key == 'led'}
              class:w-34!={key == 'sensor'}
              value={nthPartVariant($protoConfig, $clickedKey)[key]}
              on:change={(ev) => changeKeyVariant(ev, key)}
            >
              {#each opt as part}
                <option value={part}>{part}</option>
              {/each}
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
            >
              <Icon path={mdi.mdiChevronDown} size="20px" />
            </div>
          </div>
        {/each}
      {/if}
      {#if $selectMode != 'cluster'}
        <button class="sidebutton" title="Remove" on:click|stopPropagation={removeKey}>
          <Icon size="20px" path={mdi.mdiDelete} />
        </button>
      {/if}
    </div>
    {#if $showHelp && $selectMode != 'cluster'}
      <div class="relative mr--0.5 max-[528px]:hidden">
        <div
          class="absolute z-10 top-16 right--5 w-48 font-urbanist font-500 select-none text-sm light:opacity-80"
        >
          <svg
            class="absolute h-13 top--9 right-7 opacity-80"
            viewBox="0 0 90.38483407847127 100.52045602861654"
          >
            <use xlink:href="{base}/arrows.svg#arrow1" />
          </svg>
          Delete keys using this button or the <span class="kbd">delete</span> key.
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if !isExpert}
  <div class="absolute top-10 bottom-10 right-0 flex flex-col justify-center select-none">
    <div class="relative flex flex-col gap-2 h-87">
      <div
        class="bigmenu bg-[#EFE8FF] dark:bg-slate-900 flex flex-col rounded-5 relative z-10 p-0.5 gap-0.5"
      >
        <button
          class="sidebutton"
          class:selected={$transformMode == 'select'}
          on:click|stopPropagation={() => transformMode.set('select')}
          ><Icon size="20px" path={mdi.mdiCursorDefaultOutline} />
        </button>
        <button
          class="sidebutton"
          class:selected={$transformMode == 'translate'}
          on:click|stopPropagation={() => transformMode.set('translate')}
          ><Icon path={mdi.mdiCursorMove} size="20px" />
        </button>
        <button
          class="sidebutton"
          class:selected={$transformMode == 'rotate'}
          on:click|stopPropagation={() => transformMode.set('rotate')}
          ><Icon path={mdi.mdiRotateOrbit} size="20px" />
        </button>
        <div class="my-2 h-[1px] bg-white dark:bg-slate-700" />

        <button
          class="sidebutton"
          class:selected={$selectMode == 'key'}
          on:click|stopPropagation={() => selectMode.set('key')}
          ><Icon size="20px" name="keycap" />
        </button>
        <button
          class="sidebutton"
          class:selected={$selectMode == 'column'}
          on:click|stopPropagation={() => selectMode.set('column')}
          ><Icon name="column" size="20px" />
        </button>
        <button
          class="sidebutton"
          class:selected={$selectMode == 'cluster'}
          on:click|stopPropagation={() => selectMode.set('cluster')}
          ><Icon path={mdi.mdiGrid} size="20px" />
        </button>
      </div>
      <div
        class="mhelp absolute right-8.5 top-0 text-right flex flex-col py-0.5 px-1 gap-0.5 text-purple-950/60 dark:text-pink-300/90 text-sm z-1 pointer-events-none font-medium"
        class:hidden!={popoutShown}
      >
        <div class="mhelpitem">Select / Add (q)</div>
        <div class="mhelpitem">Reposition (w/g)</div>
        <div class="mhelpitem">Rotate (e/r)</div>
        <div class="h-[1px] my-2" />
        <div class="mhelpitem">Select Keys (k)</div>
        <div class="mhelpitem">Select Columns (l)</div>
        <div class="mhelpitem">Select Clusters (o)</div>
      </div>
      {#if $showHelp && !popoutShown}
        <div
          class="absolute right-19 top-13 z-10 font-urbanist font-500 w-45 light:opacity-80 text-sm text-right max-[528px]:hidden"
        >
          <svg
            class="absolute h-11 right--12.5 top--2 opacity-80"
            viewBox="324.63186981735146 429.628023054668 106.22003580015075 94.79661453649442"
          >
            <use xlink:href="{base}/arrows.svg#arrow3" />
          </svg>
          Use these tools to select or reposition keys.<br />
          <span class="text-xs">tip: hold ctrl while rotating to snap to 90&deg;</span>
        </div>
        <div
          class="absolute right-19 top-38 z-10 font-urbanist font-500 w-45 light:opacity-80 text-sm text-right max-[528px]:hidden"
        >
          <svg
            class="absolute h-11 right--12.5 top--3.8"
            viewBox="324.63186981735146 429.628023054668 106.22003580015075 94.79661453649442"
          >
            <use xlink:href="{base}/arrows.svg#arrow4" />
          </svg>
          Change selection mode!
          <span class="text-xs">tip: you can add columns by switching to column mode</span>
        </div>
        <div
          class="absolute right-19 top-64 z-10 font-urbanist font-500 w-60 light:opacity-80 text-sm text-right max-[528px]:hidden"
        >
          <svg
            class="absolute h-11 right--12.5 opacity-80"
            viewBox="324.63186981735146 429.628023054668 106.22003580015075 94.79661453649442"
          >
            <use xlink:href="{base}/arrows.svg#arrow5" />
          </svg>
          <p class="w-45 ml-auto">This menu has *lots* of goodies. Try opening it!</p>
          <span class="text-xs">it changes for each selection mode</span>
        </div>
      {/if}
      <button
        class="sidemenu"
        class:selected={popoutShown}
        on:click={() => (popoutShown = !popoutShown)}
      >
        {#if $selectMode == 'key'}Edit Key{/if}
        {#if $selectMode == 'column'}Edit Column{/if}
        {#if $selectMode == 'cluster'}Edit Cluster{/if}
      </button>
      {#if popoutShown}
        <div
          class="absolute right-10 bottom-[-8rem]"
          class:w-60={$clickedKey != null}
          class:w-50={$clickedKey == null}
        >
          {#if $selectMode == 'key'}
            <div
              class="tab"
              class:hide={$clickedKey != null
                ? ![...PARTS_WITH_KEYCAPS, ...ROUND_PARTS].includes(
                    nthPartType($protoConfig, $clickedKey, 'key')
                  )
                : $hoveredKey == null ||
                  ![...PARTS_WITH_KEYCAPS, ...ROUND_PARTS].includes(
                    nthPartType($protoConfig, $hoveredKey, 'key')
                  )}
            >
              {#if $clickedKey != null ? PARTS_WITH_KEYCAPS.includes(nthPartType($protoConfig, $clickedKey, 'key')) : $hoveredKey == null || PARTS_WITH_KEYCAPS.includes(nthPartType($protoConfig, $hoveredKey, 'key'))}
                <div class="tabhead">Keycap</div>
                <div class="px-2 py-1">
                  <Field small name="Profile" icon="keycapsmall">
                    {#if keyIsClicked && $clickedKey != null}<SelectInherit
                        small
                        bind:value={keyIsClicked.profile.profile}
                        inherit={nthProfile($protoConfig, $clickedKey, 'column')}
                        on:change={updateProto}
                      >
                        {#each notNull(PROFILE).sort(sortProfiles) as prof}
                          <option value={prof}>{profileName(prof)}</option>
                        {/each}
                      </SelectInherit>
                    {:else if keyIsHovered}<span
                        class="fallback"
                        class:inherit={!keyIsHovered.profile.profile}
                        >{formatProfile($protoConfig, $hoveredKey)}</span
                      >
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                  <Field small name="Row">
                    {#if keyIsClicked}<Select
                        small
                        bind:value={keyIsClicked.profile.row}
                        on:change={updateProto}
                      >
                        <option value={5}>R5</option>
                        <option value={4}>R4</option>
                        <option value={3}>R3</option>
                        <option value={2}>R2</option>
                        <option value={1}>R1</option>
                        <option value={0}>R0</option>
                      </Select>
                    {:else if keyIsHovered}<span class="fallback">{'R' + keyIsHovered.profile.row}</span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                  {#if $clickedKey != null ? nthPartType($protoConfig, $clickedKey, 'key') != 'blank' : $hoveredKey == null || nthPartType($protoConfig, $hoveredKey, 'key') != 'blank'}
                    <Field small name="Homing">
                      {#if keyIsClicked}<Select
                          small
                          bind:value={keyIsClicked.profile.home}
                          on:change={updateProto}
                        >
                          <option value={null}>None</option>
                          <option value="thumb">Thumb</option>
                          <option value="index">Index</option>
                          <option value="middle">Middle</option>
                          <option value="ring">Ring</option>
                          <option value="pinky">Pinky</option>
                        </Select>
                      {:else if keyIsHovered}<span class="fallback">{formatHoming(keyIsHovered)}</span>
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                    <Field small name="Letter" icon="letter">
                      {#if keyIsClicked}<input
                          class="s-input w-[5.4rem] mx-0 px-2"
                          bind:value={keyIsClicked.profile.letter}
                          on:change={updateProto}
                          on:input={setLetter}
                        />
                      {:else if keyIsHovered}<span class="fallback"
                          >{keyIsHovered.profile.letter || ''}</span
                        >
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                  {:else}
                    <Field small name="Width">
                      {#if keyIsClicked}<DecimalInputInherit
                          small
                          noColor
                          inherit={18.5}
                          bind:value={keyIsClicked.sizeA}
                          on:change={updateProto}
                        />
                      {:else if keyIsHovered}<span class="fallback">{keyIsHovered.sizeA || '18.5'}</span>
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                    <Field small name="Height">
                      {#if keyIsClicked}<DecimalInputInherit
                          small
                          noColor
                          inherit={18.5}
                          bind:value={keyIsClicked.sizeB}
                          on:change={updateProto}
                        />
                      {:else if keyIsHovered}<span class="fallback">{keyIsHovered.sizeB || '18.5'}</span>
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                    <Field small name="Depth">
                      {#if keyIsClicked}<DecimalInputInherit
                          small
                          noColor
                          inherit={5}
                          bind:value={keyIsClicked.sizeC}
                          on:change={updateProto}
                        />
                      {:else if keyIsHovered}<span class="fallback">{keyIsHovered.sizeC || '5'}</span>
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                  {/if}
                </div>
              {:else}
                <div class="tabhead">Trackball / Trackpad</div>
                <div class="px-2 py-1">
                  <Field small name="Sides">
                    {#if keyIsClicked}<DecimalInputInherit
                        small
                        noColor
                        inherit={20}
                        bind:value={keyIsClicked.sizeB}
                        on:change={updateProto}
                      />
                    {:else if keyIsHovered}<span class="fallback">{keyIsHovered.sizeB || '20'}</span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                </div>
              {/if}
            </div>
            <div class="tab">
              <div class="tabhead">Key Position</div>
              <div class="px-2 py-1">
                <Field small name="Row">
                  {#if keyIsClicked && columnIsClicked}<DecimalInput
                      small
                      bind:value={keyIsClicked.row}
                      on:change={updateProto}
                      divisor={100}
                    />
                  {:else if keyIsHovered}<span
                      class="fallback"
                      class:inherit={typeof keyIsHovered.row == 'undefined'}
                    >
                      {keyProp($protoConfig, $hoveredKey, 'row')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name={sphereColumn ? 'Angle' : 'Column'}>
                  {#if keyIsClicked && columnIsClicked}
                    {#if sphereColumn}<AngleInputInherit
                        small
                        bind:value={keyIsClicked.column}
                        inherit={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {:else}<DecimalInputInherit
                        small
                        bind:value={keyIsClicked.column}
                        inherit={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {/if}
                  {:else if keyIsHovered}<span
                      class="fallback"
                      class:inherit={typeof keyIsHovered.column == 'undefined'}
                    >
                      {keyProp($protoConfig, $hoveredKey, 'column')}{#if sphereColumn}&deg;{/if}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                {#if $clickedKey != null ? nthPartType($protoConfig, $clickedKey, 'key') != 'blank' : $hoveredKey == null || nthPartType($protoConfig, $hoveredKey, 'key') != 'blank'}
                  <Field small name="Margin X" icon="expand-horizontal" iconColor="#ff3653">
                    {#if keyIsClicked}<DecimalInputInherit
                        small
                        noColor
                        inherit={0}
                        bind:value={keyIsClicked.marginX}
                        on:change={updateProto}
                      />
                    {:else if keyIsHovered}<span class="fallback">{keyIsHovered.marginX || '0'}</span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                  <Field small name="Margin Y" icon="expand-vertical" iconColor="#8adb00">
                    {#if keyIsClicked}<DecimalInputInherit
                        small
                        noColor
                        inherit={0}
                        bind:value={keyIsClicked.marginY}
                        on:change={updateProto}
                      />
                    {:else if keyIsHovered}<span class="fallback">{keyIsHovered.marginY || '0'}</span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                  <div class="my-2" />
                {/if}
                <Field
                  small
                  name={$useAbsolute ? 'Position X' : 'Offset X'}
                  icon="movex"
                  iconColor="#ff3653"
                >
                  {#if $clickedKey != null}<DecimalInput small bind:value={$positionX} />
                  {:else if hoveredPosition}<span class="fallback">{hoveredPosition[0]}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field
                  small
                  name={$useAbsolute ? 'Position Y' : 'Offset Y'}
                  icon="movey"
                  iconColor="#8adb00"
                >
                  {#if $clickedKey != null}<DecimalInput small bind:value={$positionY} />
                  {:else if hoveredPosition}<span class="fallback">{hoveredPosition[1]}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field
                  small
                  name={$useAbsolute ? 'Position Z' : 'Offset Z'}
                  icon="movez"
                  iconColor="#2c8fff"
                >
                  {#if $clickedKey != null}<DecimalInput small bind:value={$positionZ} />
                  {:else if hoveredPosition}<span class="fallback">{hoveredPosition[2]}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="text-sm opacity-70 mt-0.5 mb-1 text-center">
                  Margin &amp; {$useAbsolute ? 'position' : 'offset'} are in
                  <span class="font-bold italic">mm</span>
                </div>
                <Field small name="Rotation X" icon="rotatex" iconColor="#ff3653">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$rotationX} />
                  {:else if hoveredRotation}
                    <span class="fallback">{hoveredRotation[0]}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Y" icon="rotatey" iconColor="#8adb00">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$rotationY} />
                  {:else if hoveredRotation}
                    <span class="fallback">{hoveredRotation[1]}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Z" icon="rotatez" iconColor="#2c8fff">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$rotationZ} />
                  {:else if hoveredRotation}
                    <span class="fallback">{hoveredRotation[2]}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <p class="text-center">
                  <button
                    class="text-sm underline opacity-70 px-2 py-0.5 rounded"
                    class:bg-pink-300={$useAbsolute}
                    class:dark:bg-pink-800={$useAbsolute}
                    on:click={() => ($useAbsolute = !$useAbsolute)}
                  >
                    Show {#if $useAbsolute}relative{:else}absolute{/if} coords
                  </button>
                </p>
              </div>
            </div>
          {:else if $selectMode == 'column'}
            <div class="tab">
              <div class="tabhead">
                Column Curvature
                {#if columnType}<button
                    class="ctbutton"
                    on:click={() => changeCType(columnIsClicked ?? undefined)}
                  >
                    {columnType}
                  </button>{/if}
              </div>
              <div class="px-2 py-1">
                <Field small name="Curvature" icon="column-curve">
                  {#if columnIsClicked && $clickedKey != null}<AngleInputInherit
                      small
                      bind:value={columnIsClicked.curvature.curvatureB}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'curvatureB', 'cluster')}
                    />
                  {:else if $hoveredKey != null && columnIsHovered}<span
                      class="fallback"
                      class:inherit={typeof columnIsHovered.curvature.curvatureB == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'curvatureB', 'column')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                {#if !sphereColumn}
                  <Field small name="Disparity" icon="column-curve">
                    {#if columnIsClicked && $clickedKey != null}<DecimalInputInherit
                        small
                        divisor={100}
                        bind:value={columnIsClicked.curvature.columnDisparity}
                        on:change={updateProto}
                        inherit={nthCurvature($protoConfig, $clickedKey, 'columnDisparity', 'cluster')}
                      />
                    {:else if $hoveredKey != null && columnIsHovered}<span
                        class="fallback"
                        class:inherit={typeof columnIsHovered.curvature.columnDisparity == 'undefined'}
                      >
                        {nthCurvature($protoConfig, $hoveredKey, 'columnDisparity', 'column')}
                      </span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                {/if}
                {#if !sphereColumn}
                  <Field small name="Arc" icon="bulge">
                    {#if columnIsClicked && $clickedKey != null}<DecimalInputInherit
                        small
                        bind:value={columnIsClicked.curvature.arc}
                        on:change={updateProto}
                        inherit={nthCurvature($protoConfig, $clickedKey, 'arc', 'cluster')}
                      />
                    {:else if $hoveredKey != null && columnIsHovered}<span
                        class="fallback"
                        class:inherit={typeof columnIsHovered.curvature.arc == 'undefined'}
                      >
                        {nthCurvature($protoConfig, $hoveredKey, 'arc', 'column')}&deg;
                      </span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                {/if}
                <Field small name="Spacing" icon="expand-vertical">
                  {#if columnIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={columnIsClicked.curvature.verticalSpacing}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'verticalSpacing', 'cluster')}
                    />
                  {:else if $hoveredKey != null && columnIsHovered}<span
                      class="fallback"
                      class:inherit={typeof columnIsHovered.curvature.verticalSpacing == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'verticalSpacing', 'column')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
              </div>
            </div>
            <div class="tab">
              <div class="tabhead">Column Position</div>
              <div class="px-2 py-1">
                <Field small name={sphereColumn ? 'Angle' : 'Column'}>
                  {#if columnIsClicked && columnIsClicked}
                    {#if sphereColumn}<AngleInput
                        small
                        bind:value={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {:else}<DecimalInput
                        small
                        bind:value={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {/if}
                  {:else if columnIsHovered}<span class="fallback">
                      {columnIsHovered.column}{#if sphereColumn}&deg;{/if}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                {#if !sphereColumn}
                  <Field small name="Splay">
                    {#if $clickedKey != null}
                      <AngleInput
                        small
                        value={nthSplay($protoConfig, $clickedKey)}
                        on:change={setFingerSplay}
                      />
                    {:else if $hoveredKey != null}
                      <span class="fallback"
                        >{Math.round(nthSplay($protoConfig, $hoveredKey) / 4.5) / 10}&deg;</span
                      >
                    {:else}
                      <span class="fallback">-</span>
                    {/if}
                  </Field>
                {/if}
                <div class="my-2" />
                <Field small name="Offset X" icon="movex" iconColor="#ff3653">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$cpositionX} />
                  {:else if hoveredCPosition}<span class="fallback">{hoveredCPosition[0] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Y" icon="movey" iconColor="#8adb00">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$cpositionY} />
                  {:else if hoveredCPosition}<span class="fallback">{hoveredCPosition[1] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Z" icon="movez" iconColor="#2c8fff">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$cpositionZ} />
                  {:else if hoveredCPosition}<span class="fallback">{hoveredCPosition[2] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="Rotation X" icon="rotatex" iconColor="#ff3653">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$crotationX} />
                  {:else if hoveredCRotation}
                    <span class="fallback">{Math.round(hoveredCRotation[0] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Y" icon="rotatey" iconColor="#8adb00">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$crotationY} />
                  {:else if hoveredCRotation}
                    <span class="fallback">{Math.round(hoveredCRotation[1] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Z" icon="rotatez" iconColor="#2c8fff">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$crotationZ} />
                  {:else if hoveredCRotation}
                    <span class="fallback">{Math.round(hoveredCRotation[2] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
              </div>
            </div>
          {:else if $selectMode == 'cluster'}
            <div class="tab">
              <div class="tabhead">
                Cluster Curvature
                {#if clusterType}<button
                    class="ctbutton"
                    on:click={() => changeCType(clusterIsClicked ?? undefined)}
                  >
                    {clusterType}
                  </button>{/if}
              </div>
              <div class="px-2 py-1">
                <Field small name="Row Curve" icon="row-curve">
                  {#if clusterIsClicked && $clickedKey != null}<AngleInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.curvatureA}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'curvatureA', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.curvatureA == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'curvatureA', 'cluster')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                {#if !sphereCluster}
                  <Field small name="Row Dispty">
                    {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                        small
                        divisor={100}
                        bind:value={clusterIsClicked.curvature.rowDisparity}
                        on:change={updateProto}
                        inherit={nthCurvature($protoConfig, $clickedKey, 'rowDisparity', 'kb')}
                      />
                    {:else if $hoveredKey != null && clusterIsHovered}<span
                        class="fallback"
                        class:inherit={typeof clusterIsHovered.curvature.rowDisparity == 'undefined'}
                      >
                        {nthCurvature($protoConfig, $hoveredKey, 'rowDisparity', 'cluster')}
                      </span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                {/if}
                <Field small name="Col Curve" icon="column-curve">
                  {#if clusterIsClicked && $clickedKey != null}<AngleInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.curvatureB}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'curvatureB', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.curvatureB == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'curvatureB', 'cluster')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                {#if !sphereCluster}
                  <Field small name="Col Dispty">
                    {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                        small
                        divisor={100}
                        bind:value={clusterIsClicked.curvature.columnDisparity}
                        on:change={updateProto}
                        inherit={nthCurvature($protoConfig, $clickedKey, 'columnDisparity', 'kb')}
                      />
                    {:else if $hoveredKey != null && clusterIsHovered}<span
                        class="fallback"
                        class:inherit={typeof clusterIsHovered.curvature.columnDisparity == 'undefined'}
                      >
                        {nthCurvature($protoConfig, $hoveredKey, 'columnDisparity', 'cluster')}
                      </span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                {/if}
                <Field small name="Arc" icon="bulge">
                  {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.arc}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'arc', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.arc == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'arc', 'cluster')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="H Spacing" icon="expand-horizontal">
                  {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.horizontalSpacing}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'horizontalSpacing', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.horizontalSpacing == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'horizontalSpacing', 'cluster')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="V Spacing" icon="expand-vertical">
                  {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.verticalSpacing}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'verticalSpacing', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.verticalSpacing == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'verticalSpacing', 'cluster')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
              </div>
            </div>
            <div class="tab">
              <div class="tabhead">Cluster Position</div>
              <div class="px-2 py-1">
                <Field small name="Offset X" icon="movex" iconColor="#ff3653">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$lpositionX} />
                  {:else if hoveredLPosition}<span class="fallback">{hoveredLPosition[0] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Y" icon="movey" iconColor="#8adb00">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$lpositionY} />
                  {:else if hoveredLPosition}<span class="fallback">{hoveredLPosition[1] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Z" icon="movez" iconColor="#2c8fff">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$lpositionZ} />
                  {:else if hoveredLPosition}<span class="fallback">{hoveredLPosition[2] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="Rotation X" icon="rotatex" iconColor="#ff3653">
                  {#if $clickedKey != null}
                    <DecimalInput small bind:value={$lrotationX} divisor={45} />
                  {:else if hoveredLRotation}
                    <span class="fallback">{Math.round(hoveredLRotation[0] / 4.5) / 10}</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Y" icon="rotatey" iconColor="#8adb00">
                  {#if $clickedKey != null}
                    <DecimalInput small bind:value={$lrotationY} divisor={45} />
                  {:else if hoveredLRotation}
                    <span class="fallback">{Math.round(hoveredLRotation[1] / 4.5) / 10}</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Z" icon="rotatez" iconColor="#2c8fff">
                  {#if $clickedKey != null}
                    <DecimalInput small bind:value={$lrotationZ} divisor={45} />
                  {:else if hoveredLRotation}
                    <span class="fallback">{Math.round(hoveredLRotation[2] / 4.5) / 10}</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
              </div>
            </div>
          {/if}
          {#if $showHelp}
            <div
              class="absolute right-70 top-72 z-10 font-urbanist font-500 w-70 light:opacity-80 text-sm text-right max-[528px]:hidden"
            >
              <svg
                class="absolute h-11 right--12.5"
                viewBox="324.63186981735146 429.628023054668 106.22003580015075 94.79661453649442"
              >
                <use xlink:href="{base}/arrows.svg#arrow5" />
              </svg>
              If moving keys around by hand isn't accurate enough for you, you can edit the exact positions
              here!
              <p class="text-xs mt-2">
                Row and Column move the key along its curve, while offset moves it in all directions.
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ctbutton {
    z-index: 10;
    --at-apply: 'appearance-none bg-purple-200 dark:bg-pink-900 px-2 rounded text-gray-800 dark:text-gray-200';
  }

  .sidebutton {
    --at-apply: 'appearance-none hover:bg-purple-200 dark:hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-full text-gray-800 dark:text-gray-200';
  }
  .sidemenu {
    --at-apply: 'text-sm relative z-10 appearance-none hover:bg-purple-200 dark:hover:bg-gray-200 dark:hover:bg-gray-700 py-4 rounded-5 bg-[#EFE8FF] dark:bg-gray-900 text-gray-800 dark:text-gray-200 write-vertical-left flex items-center';
    width: 2.25rem;
  }
  .sidebutton.selected,
  .sidemenu.selected {
    --at-apply: 'bg-purple-300 dark:bg-pink-600 dark:text-white';
  }

  .fallback {
    --at-apply: 'text-gray-500 dark:text-gray-400 whitespace-nowrap';
  }
  .fallback.inherit {
    --at-apply: 'text-yellow-500/70';
  }

  .hide {
    opacity: 0;
    z-index: -1;
  }

  .tab {
    --at-apply: 'bg-[#f8f5ff]/80 backdrop-blur-md dark:bg-slate-900/80 rounded-2 overflow-hidden mb-4 transition-opacity relative z-10';
  }
  .tabhead {
    --at-apply: 'bg-purple-300 dark:bg-pink-600 px-3 py-0.5 flex justify-between';
  }
  .mhelp {
    opacity: 0;
    transform: translate(10px);
    transition: transform 0.2s ease-out, opacity 0.1s ease-out;
  }
  .bigmenu:hover + .mhelp {
    opacity: 1;
    transform: none;
  }
  .mhelpitem {
    --at-apply: 'line-height-[20px] pl-4 pr-2 py-1.5 whitespace-nowrap from-white/80 dark:from-slate-800/80 via-white/60 to-white/0 dark:via-slate-800/70 dark:to-slate-800/50 backdrop-blur-sm rounded-2';
    background: radial-gradient(ellipse 70% 80% at 60% center, var(--un-gradient-stops));
  }

  .kbd {
    --at-apply: 'relative bg-slate-100 dark:bg-slate-900 border border-slate-400 rounded px-1 mx-[0.1em] text-[0.9em] bottom-0.05em';
  }

  /* Fudge factors */
  .font-urbanist.text-sm {
    font-size: 0.95rem;
  }
  .font-urbanist .text-xs {
    font-size: 0.8rem;
  }
</style>
