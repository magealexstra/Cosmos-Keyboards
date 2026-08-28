import { DEFAULT_LAYOUT, flippedKey, lettersToFingers, relayout } from '$lib/geometry/layouts'
import { type Finger, FINGERS, SolvedHand } from '$lib/hand'
import type { HandData } from '$lib/handhelpers'
import { type Center, type Cuttleform, encodeTuple, type FullCuttleform, type FullGeometry, tupleToXYZ } from '$lib/worker/config'
import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
import ETrsf, { keyPosition } from '$lib/worker/modeling/transformation-ext'
import { mapObjNotNull, objEntries } from '$lib/worker/util'
import type { Layout } from '$target/cosmosStructs'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { refine } from '../handoptim'
import { findKeyByAttr, type HandSide, keyPressDepth, pos, pos15 } from './viewer3dHelpers'

export type HandFit = Record<string, Vector3[] | false>
export type FitConfs = Record<HandSide, Cuttleform | undefined> & { isUnibody: boolean }

export const toFitConf = (c: FullCuttleform): FitConfs => ({
  right: c.right || c.unibody,
  left: c.left || c.unibody,
  isUnibody: !!c.unibody,
})

export function handCenter(side: HandSide, center: Center, geometry: FullGeometry) {
  return geometry.unibody ? center.unibody : center[side]
}

export function wristRestMatrix(side: HandSide, protoConfig?: CosmosKeyboard, conf?: FullCuttleform): Matrix4 {
  const mirror = side == 'left'
  if (protoConfig) {
    const [x, y, z] = tupleToXYZ(protoConfig.wristRestPosition)
    return new Matrix4().makeTranslation(mirror ? -x : x, y, z)
  }
  const anyConf = conf?.right || conf?.unibody
  if (anyConf?.wristRestOrigin) {
    const trsf = new ETrsf(anyConf.wristRestOrigin.history)
    if (mirror) trsf.mirrored([1, 0, 0])
    return trsf.evaluate({ flat: false }).Matrix4()
  }
  return new Matrix4()
}

export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

export const SENTENCE = 'the quick brown fox jumps over the lazy dog.'

export function fitHand(
  jointsJSON: HandData,
  targets: Record<Finger, Vector3 | undefined>,
  side: HandSide,
  handMatrix: Matrix4,
): { ik: HandFit; m: Matrix4; hand: SolvedHand } {
  const tg = mapObjNotNull(targets, (v) => v)
  const ik: Record<string, Vector3[] | false> = Object.fromEntries(
    FINGERS.map((f) => [f, [new Vector3(), new Vector3(), new Vector3(), new Vector3()]]),
  )
  const origin = new Vector3().setFromMatrixPosition(handMatrix)
  const seed = new Matrix4().makeRotationFromEuler(new Euler(0, -Math.PI / 2, 0)).setPosition(origin)
  const { m } = refine(seed, jointsJSON[side], tg)
  const hand = new SolvedHand(jointsJSON[side], m)
  for (const [finger, position] of objEntries(tg)) {
    ik[finger] = hand.ik(finger, position, 1000)
  }
  return { ik, m, hand }
}

export function findLetterSide(
  letter: string,
  fitConfs: FitConfs,
  handSides: HandSide[],
  layout?: Layout,
): HandSide | undefined {
  if (fitConfs.isUnibody) {
    const conf = fitConfs.left || fitConfs.right!
    const flipped = flippedKey(letter, layout)
    const matchThis = findKeyByAttr(conf, false, 'letter', letter)
    const matchFlip = typeof flipped !== 'undefined' ? findKeyByAttr(conf, false, 'letter', flipped) : undefined
    if (!matchThis) return undefined
    const thisX = keyPosition(conf, matchThis, false).origin().x
    if (!matchFlip) return thisX < 0 ? 'left' : 'right'
    const flipX = keyPosition(conf, matchFlip, false).origin().x
    return thisX < flipX ? 'left' : 'right'
  } else {
    return handSides.find((s) => !!findKeyByAttr(fitConfs[s]!, false, 'letter', letter))
  }
}
