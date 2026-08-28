<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
  import { T } from '@threlte/core'
  import { TransformControls as TTransformControls } from '@threlte/extras'
  import HandModel from '$lib/3d/HandModel.svelte'
  import {
    type Center,
    type Cuttleform,
    type FullCuttleform,
    type FullGeometry,
    encodeTuple,
  } from '$lib/worker/config'
  import { fromCosmosConfig, type CosmosKeyboard } from '$lib/worker/config.cosmos'
  import { DEFAULT_LAYOUT, lettersToFingers, relayout } from '$lib/geometry/layouts'
  import { type Finger, FINGERS, SolvedHand } from '$lib/hand'
  import * as flags from '$lib/flags'
  import { readHands, type HandData } from '$lib/handhelpers'
  import {
    type HandSide,
    HAND_SIDES,
    pos,
    pos15,
    keyPressDepth,
    findKeyByAttr,
    computeReachability,
  } from '../viewer3dHelpers'
  import {
    toFitConf,
    handCenter,
    wristRestMatrix,
    easeInOutQuad,
    SENTENCE,
    fitHand,
    findLetterSide,
    type HandFit,
    type FitConfs,
  } from '../handSimulation'

  export let geometry: FullGeometry
  export let center: Center
  export let showHand: boolean = true
  export let conf: FullCuttleform | undefined = undefined
  export let protoConfig: CosmosKeyboard | undefined = undefined
  export let tempConfig: CosmosKeyboard | undefined = undefined
  export let pressedLetter: string | null = null
  export let translation: number = 0
  export let reachabilityArr: any = {}
  export let jointsJSON: HandData | undefined = readHands()

  $: layout = protoConfig?.layout ?? DEFAULT_LAYOUT
  $: sentence = relayout(SENTENCE, DEFAULT_LAYOUT, layout)
  $: fingersToKeys = lettersToFingers(layout)

  let hands: Record<HandSide, SolvedHand | undefined> = { left: undefined, right: undefined }
  let handMatrix: Record<HandSide, Matrix4> = { left: new Matrix4(), right: new Matrix4() }
  let handRotation: Record<HandSide, [number, number, number]> = { left: [0, 0, 0], right: [0, 0, 0] }
  let handPosition: Record<HandSide, [number, number, number]> = { left: [0, 0, 0], right: [0, 0, 0] }
  $: if (protoConfig || conf)
    handMatrix = {
      left: wristRestMatrix('left', protoConfig, conf),
      right: wristRestMatrix('right', protoConfig, conf),
    }

  function setHandPose(side: HandSide, world: Matrix4) {
    handMatrix[side] = world
    handRotation[side] = new Euler().setFromRotationMatrix(world).toArray() as any
    handPosition[side] = new Vector3().setFromMatrixPosition(world).toArray()
  }

  function fit(targets: Record<Finger, Vector3 | undefined>, side: HandSide) {
    if (!jointsJSON) throw new Error('No jointsJSON')
    const { ik, m, hand } = fitHand(jointsJSON, targets, side, handMatrix[side])
    hands[side] = hand
    setHandPose(side, m)
    return ik
  }

  function theBigFit(fitConfs: FitConfs, side: HandSide) {
    const conf = fitConfs[side]!
    const isUnibody = fitConfs.isUnibody
    const isUnibodyLeft = side == 'left' && fitConfs.isUnibody
    return fit(
      {
        indexFinger: pos(conf, findKeyByAttr(conf, isUnibodyLeft, 'home', 'index'), side, isUnibody),
        middleFinger: pos(conf, findKeyByAttr(conf, isUnibodyLeft, 'home', 'middle'), side, isUnibody),
        ringFinger: pos(conf, findKeyByAttr(conf, isUnibodyLeft, 'home', 'ring'), side, isUnibody),
        pinky: pos(conf, findKeyByAttr(conf, isUnibodyLeft, 'home', 'pinky'), side, isUnibody),
        thumb: pos(conf, findKeyByAttr(conf, isUnibodyLeft, 'home', 'thumb'), side, isUnibody),
      },
      side
    )
  }

  let fitConfs: FitConfs = { left: undefined, right: undefined, isUnibody: false }
  $: if (conf) fitConfs = toFitConf(conf)
  $: if (tempConfig) fitConfs = toFitConf(fromCosmosConfig(tempConfig, true))
  $: handSides = HAND_SIDES.filter((s) => !!handCenter(s, center, geometry) && !!fitConfs[s])
  $: if (jointsJSON && geometry)
    handSides.forEach((side) => {
      if (fitConfs[side]) theBigFit(fitConfs, side)
    })

  let req: number

  const letterSide = (letter: string) => findLetterSide(letter, fitConfs, handSides, protoConfig?.layout)

  function fitHandsToLetter(active: HandSide | undefined, letter: string | undefined) {
    const fits = {} as Record<HandSide, HandFit>
    for (const side of handSides) {
      const conf = fitConfs[side]!
      const isUnibody = fitConfs.isUnibody
      const isUnibodyLeft = side == 'left' && fitConfs.isUnibody
      const key =
        side == active && letter ? findKeyByAttr(conf, isUnibodyLeft, 'letter', letter) : undefined
      fits[side] = key
        ? fit(
            { [fingersToKeys[letter!]]: pos15(conf, key, side, isUnibody) } as Record<
              Finger,
              Vector3 | undefined
            >,
            side
          )
        : theBigFit(fitConfs, side)
    }
    return fits
  }

  function pressDepth(side: HandSide, letter: string, hand: SolvedHand, finger: Finger) {
    const conf = fitConfs[side]!
    const isUnibodyleft = side == 'left' && fitConfs.isUnibody
    const key = findKeyByAttr(conf, isUnibodyleft, 'letter', letter)
    if (!key) return translation
    const pos = hand.worldPositions(finger, 1000)
    return keyPressDepth(pos[pos.length - 1], conf, key, side, fitConfs.isUnibody)
  }

  const handPoses = () =>
    Object.fromEntries(
      handSides.map((side) => [
        side,
        {
          position: new Vector3().fromArray(handPosition[side]),
          rotation: new Quaternion().setFromEuler(new Euler().fromArray(handRotation[side])),
        },
      ])
    ) as Record<HandSide, { position: Vector3; rotation: Quaternion }>

  let playing = false
  export function toggleplay() {
    if (playing) {
      playing = false
      return
    }
    if (!handSides.length) return
    playing = true
    const filteredSentence = Array.from(sentence)
      .filter((letter) => !!letterSide(letter))
      .join('')
    play(filteredSentence)
  }

  function play(sentence: string, beginning?: Record<HandSide, HandFit>, index = 0) {
    if (index > sentence.length) {
      playing = false
      return
    }
    if (!beginning) beginning = fitHandsToLetter(undefined, undefined)

    const letter: string | undefined = sentence[index]
    const active = letter ? letterSide(letter) : undefined
    const prevPose = handPoses()
    const targets = fitHandsToLetter(active, letter)
    const newPose = handPoses()

    const tStart = window.performance.now()
    ;(function step(t) {
      if (!jointsJSON) throw new Error('No jointsJSON')
      if (!beginning) throw new Error('No beginning')
      const p = (t - tStart) / 500
      if (p > 0.5) pressedLetter = letter ?? null

      const percent = easeInOutQuad(p)
      if (p > 1) return play(sentence, targets, ++index)
      for (const side of handSides) {
        const prevHand = hands[side]
        if (!prevHand || !beginning[side] || !targets[side]) continue
        const hand = new SolvedHand(jointsJSON[side], prevHand.position)
        hands[side] = hand
        for (const f of FINGERS) {
          const targetArr = targets[side][f]
          const beginArr = beginning[side][f]
          if (!targetArr || !beginArr) continue
          const current = beginArr.map((b, i) =>
            new Vector3().subVectors(targetArr[i], b).multiplyScalar(percent).add(b)
          )
          hand.fkBy(f, (i) => [current[i].z, current[i].y])
          if (pressedLetter && side == active && f == fingersToKeys[pressedLetter]) {
            translation = pressDepth(side, pressedLetter, hand, f)
          }
        }
        handPosition[side] = new Vector3()
          .subVectors(newPose[side].position, prevPose[side].position)
          .multiplyScalar(percent)
          .add(prevPose[side].position)
          .toArray()
        handRotation[side] = new Euler()
          .setFromQuaternion(
            new Quaternion().slerpQuaternions(prevPose[side].rotation, newPose[side].rotation, percent)
          )
          .toArray() as any
      }
      if (playing) req = requestAnimationFrame(step)
    })(tStart)
  }

  function updateHandMatrix(mat: Matrix4, side: HandSide) {
    handMatrix[side] = mat
    const conf = fitConfs[side]
    const isUnibodyLeft = side == 'left' && fitConfs.isUnibody
    if (!conf) return
    if (pressedLetter && letterSide(pressedLetter) == side) {
      const finger = fingersToKeys[pressedLetter]
      fit(
        {
          [finger]: pos15(
            conf,
            findKeyByAttr(conf, isUnibodyLeft, 'letter', pressedLetter),
            side,
            fitConfs.isUnibody
          ),
        } as Record<Finger, Vector3 | undefined>,
        side
      )
    } else {
      theBigFit(fitConfs, side)
    }
  }

  function updateWristRest(mat: Matrix4, side: HandSide) {
    const wrOrigin = new Vector3().setFromMatrixPosition(mat).toArray()
    if (side == 'left') wrOrigin[0] = -wrOrigin[0]
    if (protoConfig) protoConfig.wristRestPosition = encodeTuple(wrOrigin.map((w) => Math.round(w * 10)))
  }

  let timer: ReturnType<typeof setInterval> | undefined
  export function scanHand() {
    const win = window.open('scan2')
    if (!win) return
    timer = setInterval(() => {
      if (win.closed) {
        if (timer) clearInterval(timer)
        jointsJSON = readHands()
      }
    }, 1000)
  }
  onDestroy(() => {
    cancelAnimationFrame(req)
    if (timer) clearInterval(timer)
  })

  let handControlsReady = false
  onMount(async () => {
    await tick()
    handControlsReady = true
  })

  $: reachabilityArr =
    jointsJSON && flags.hand && showHand
      ? computeReachability(jointsJSON, fitConfs, handSides, handMatrix, geometry, fingersToKeys)
      : {}
</script>

{#if flags.hand && showHand && jointsJSON}
  {#each handSides as side (side)}
    {@const cent = handCenter(side, center, geometry)}
    {@const hand = hands[side]}
    {#if cent && hand}
      <T.Group position={[-cent[0], -cent[1], -cent[2]]}>
        <T.Group position={handPosition[side]} rotation={handRotation[side]} let:ref={handRef}>
          <HandModel reverse={side == 'right'} {hand} />
          {#if handControlsReady}
            <TTransformControls
              object={handRef}
              on:objectChange={() => {
                handRef.updateMatrix()
                updateHandMatrix(handRef.matrix, side)
              }}
              on:mouseUp={() => {
                handRef.updateMatrix()
                updateWristRest(handRef.matrix, side)
              }}
            />
          {/if}
        </T.Group>
      </T.Group>
    {/if}
  {/each}
{/if}
