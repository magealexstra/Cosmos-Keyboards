import * as flags from '$lib/flags'
import { confError } from '$lib/store'
import { checkConfig, type ConfErrors, isRenderable } from '$lib/worker/check'
import { type Cuttleform, type FullCenter, type FullCuttleform, fullEstimatedCenter, fullEstimatedSize, type FullGeometry, type KeyboardSide, newFullGeometry, setBottomZ } from '$lib/worker/config'
import { notNull, objKeys } from '$lib/worker/util'
import { hasPro } from '@pro'
import { Matrix4 } from 'three'
import { estimateFilament, type FilamentEstimate } from '../filament'
import type { FullKeyboardMeshes } from '../viewers/viewer3dHelpers'
import { type TaskError, WorkerPool } from '../workerPool'

export const DEF_CENTER = [-35.510501861572266, -17.58449935913086, 35.66889877319336] as [
  number,
  number,
  number,
]

export function createDefaultCenters(): FullCenter {
  return {
    left: { left: DEF_CENTER, unibody: DEF_CENTER },
    both: {
      left: [0, DEF_CENTER[1], DEF_CENTER[2]],
      right: [0, DEF_CENTER[1], DEF_CENTER[2]],
      unibody: [0, DEF_CENTER[1], DEF_CENTER[2]],
    },
    right: { right: DEF_CENTER, unibody: DEF_CENTER },
  }
}

export function cloneConfig(c: FullCuttleform): FullCuttleform {
  return {
    left: c.left
      ? {
        ...c.left,
        shell: { ...c.left.shell },
        plate: c.left.plate ? { ...c.left.plate } : undefined,
      }
      : undefined,
    right: c.right
      ? {
        ...c.right,
        shell: { ...c.right.shell },
        plate: c.right.plate ? { ...c.right.plate } : undefined,
      }
      : undefined,
    center: c.center
      ? {
        ...c.center,
        shell: { ...c.center.shell },
        plate: c.center.plate ? { ...c.center.plate } : undefined,
      }
      : undefined,
    unibody: c.unibody
      ? {
        ...c.unibody,
        shell: { ...c.unibody.shell },
        plate: c.unibody.plate ? { ...c.unibody.plate } : undefined,
      }
      : undefined,
  }
}

export function areDifferent(c1: any, c2: any): string[] {
  if (c1 == undefined && c2 == undefined) return []
  if (c1 == undefined && c2 != undefined) return ['everything']
  if (c1 != undefined && c2 == undefined) return ['everything']
  const differences: string[] = []

  for (const prop of new Set([...Object.keys(c1), ...Object.keys(c2)])) {
    if (prop == 'bottomZ') continue
    if (JSON.stringify(c1[prop]) != JSON.stringify(c2[prop])) differences.push(prop)
  }
  return differences
}

export function areDifferent2(c1: FullCuttleform, c2: FullCuttleform): string[] {
  return [
    ...new Set([
      ...areDifferent(c1.left, c2.left),
      ...areDifferent(c1.right, c2.right),
      ...areDifferent(c1.center, c2.center),
      ...areDifferent(c1.unibody, c2.unibody),
    ]),
  ]
}

export function calcOtherPromises(
  conf: Cuttleform,
  side: KeyboardSide,
  pool: WorkerPool<typeof import('$lib/worker/api')>,
) {
  return {
    intersectionsPromise: pool.execute(
      (w) => w.intersections(conf, side) as Promise<ConfErrors>,
      'Intersections',
    ),
    cutPromise: pool.execute((w) => w.cutWall(conf), 'Cut wall'),
    holderPromise: pool.execute((w) => w.generateBoardHolder(conf), 'Holder'),
    screwPromise: pool.execute((w) => w.generateScrewInserts(conf), 'Inserts'),
    wristRestPromise: hasPro
      ? pool.execute((w) => w.generateWristRest(conf, side == 'left'), 'Wrist Rest')
      : undefined,
    secondWristRestPromise: hasPro && side == 'unibody'
      ? pool.execute((w) => w.generateMirroredWristRest(conf), 'Wrist Rest 2')
      : undefined,
    cutPlatePromise: pool.execute((w) => w.generatePlate(conf, true), 'Full Plate'),
  }
}

export class CadPipeline {
  pool: WorkerPool<typeof import('$lib/worker/api')>
  tempPool: WorkerPool<typeof import('$lib/worker/api')>

  centers: FullCenter = createDefaultCenters()
  sizes: ReturnType<typeof fullEstimatedSize> = fullEstimatedSize(undefined)
  geometry: FullGeometry = {}
  microcontrollerGeometry: FullGeometry = {}
  meshes: FullKeyboardMeshes = {}
  filament: FilamentEstimate | undefined = undefined
  generatorProgress: number = 1
  ocError: TaskError | undefined = undefined

  private lastRenderNumber = 0
  private oldConfig: FullCuttleform | null = null
  private oldTempConfig: FullCuttleform | null = null
  private processTimer: number = 0
  private onUpdate?: () => void

  constructor(onUpdate?: () => void) {
    this.onUpdate = onUpdate
    this.pool = new WorkerPool<typeof import('$lib/worker/api')>(4, () => {
      return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
    })
    this.tempPool = new WorkerPool<typeof import('$lib/worker/api')>(2, () => {
      return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
    })
  }

  destroy() {
    if (this.processTimer) clearTimeout(this.processTimer)
    this.pool.reset()
    this.tempPool.reset()
  }

  updateCenters(geo: FullGeometry) {
    this.centers = fullEstimatedCenter(geo)
    this.sizes = fullEstimatedSize(geo)
    this.onUpdate?.()
  }

  async scheduleFullProcess(config: FullCuttleform) {
    if (this.pool.someAvailable()) {
      this.process(config, true).catch((e) => console.error(e))
    } else {
      this.microcontrollerGeometry = this.geometry = newFullGeometry(config)
      this.onUpdate?.()
      if (this.tempPool.someAvailable()) {
        await this.process(config, false)
      }
      if (this.processTimer) clearTimeout(this.processTimer)
      this.processTimer = window.setTimeout(
        () => this.process(config, true).catch((e) => console.error(e)),
        500,
      )
    }
  }

  async scheduleTempProcess(config: FullCuttleform, fromProto: boolean) {
    if (fromProto) return
    if (this.tempPool.someAvailable()) {
      await this.process(config, false)
    } else {
      this.geometry = newFullGeometry(config)
      this.onUpdate?.()
    }
  }

  async process(conf: FullCuttleform, full: boolean) {
    const kbdNames = (objKeys(conf) as KeyboardSide[])
      .filter((k): k is KeyboardSide => !!conf[k])
      .sort((a, b) => b.localeCompare(a))

    if (this.oldConfig && this.geometry && full) {
      const differences = areDifferent2(this.oldConfig, conf)
      if (differences.length == 0) return
      this.oldConfig = cloneConfig(conf)
      this.oldTempConfig = cloneConfig(conf)

      if (
        differences.every((d) => d == 'wristRestLeft' || d == 'wristRestRight' || d == 'wristRestOrigin')
      ) {
        const renderNumber = ++this.lastRenderNumber
        try {
          this.ocError = undefined
          this.generatorProgress = 0.5
          this.updateCenters(this.geometry)
          if (conf.unibody) {
            this.pool.reset(2)
            const wristMeshes = await Promise.all([
              this.pool.execute((w) => w.generateWristRest(conf.unibody!), 'Wrist Rest'),
              this.pool.execute((w) => w.generateMirroredWristRest(conf.unibody!), 'Wrist Rest 2'),
            ])
            if (renderNumber >= this.lastRenderNumber) {
              if (this.meshes.unibody) {
                this.meshes.unibody.wristBuf = wristMeshes[0].mesh ?? undefined
                this.meshes.unibody.secondWristBuf = wristMeshes[1].mesh ?? undefined
              }
            }
          } else {
            this.pool.reset(kbdNames.length)
            const wristMeshes = await Promise.all(
              kbdNames.map((k) => this.pool.execute((w) => w.generateWristRest(conf[k]!, k == 'left'), 'Wrist Rest')),
            )
            if (renderNumber >= this.lastRenderNumber) {
              wristMeshes.forEach((wristMesh, i) => {
                const sideMesh = this.meshes[kbdNames[i]]
                if (sideMesh) {
                  sideMesh.wristBuf = wristMesh.mesh ?? undefined
                }
              })
            }
          }
          this.generatorProgress = 1
          this.ocError = undefined
          this.onUpdate?.()
        } catch (e) {
          console.error(e)
          this.ocError = e as TaskError
          this.onUpdate?.()
        }
        return
      }
    } else if (full) {
      this.oldConfig = cloneConfig(conf)
      this.oldTempConfig = cloneConfig(conf)
    } else {
      if (this.oldTempConfig) {
        const differences = areDifferent2(this.oldTempConfig, conf)
        if (differences.length == 0) return
      }
      this.oldTempConfig = cloneConfig(conf)
    }

    let originalErr: ConfErrors = []
    for (const kbd of kbdNames) {
      originalErr = checkConfig(conf[kbd]!, undefined, false, kbd)
      if (originalErr.length) break
    }
    if (kbdNames.length == 0) originalErr = [{ type: 'nokeys', side: 'unibody' }]
    if (!!conf.left != !!conf.right) {
      originalErr = [{ type: 'nokeys', side: !conf.left ? 'left' : 'right' }]
    }
    confError.set(originalErr)
    if (!isRenderable(originalErr)) return

    const renderNumber = ++this.lastRenderNumber
    try {
      setBottomZ(conf, !full)
    } catch (e) {
      console.error(e)
      confError.set([
        {
          type: 'exception',
          error: e as Error,
          side: 'right',
          when: 'Setting keyboard bottom',
        },
      ])
      return
    }

    const newGeo = newFullGeometry(conf)
    this.geometry = newGeo
    this.microcontrollerGeometry = newGeo
    for (const kbd of kbdNames) {
      originalErr = checkConfig(conf[kbd]!, newGeo[kbd]!, full, kbd)
      if (originalErr.length) break
    }
    confError.set(originalErr)
    if (!isRenderable(originalErr)) return

    this.ocError = undefined
    const pl = full ? this.pool : this.tempPool
    if (full) this.pool.reset()

    try {
      const quickPromises = kbdNames.map((k) => pl.execute((w) => w.generateQuick(conf[k]!, full), 'Preview'))
      const otherPromises = !flags.fast && full ? kbdNames.map((k) => calcOtherPromises(conf[k]!, k, this.pool)) : []

      if (full) {
        this.generatorProgress = 0.1
        this.updateCenters(newGeo)
      }
      const quickResults = await Promise.all(quickPromises)
      if (renderNumber >= this.lastRenderNumber) {
        quickResults.forEach((prom, i) => {
          this.meshes[kbdNames[i]] = {
            ...this.meshes[kbdNames[i]],
            webBuf: prom.web.mesh,
            keyBufs: prom.keys.keys.map((k) => ({
              ...k,
              matrix: new Matrix4().copy(k.matrix),
            })),
            wallBuf: prom.wall.mesh,
            plateTopBuf: prom.plate.top.mesh,
            plateBotBuf: prom.plate.bottom.mesh || undefined,
            holderBuf: undefined,
            screwBaseBuf: undefined,
            screwPlateBuf: undefined,
          }
        })
        for (const key of objKeys(this.meshes)) {
          if (!kbdNames.includes(key)) delete this.meshes[key]
        }
        this.onUpdate?.()
      }

      if (!flags.fast && full) {
        const queue = otherPromises.flatMap((p, i) => notNull(Object.values(p)).map((q) => ({ i, kbd: kbdNames[i], prom: q })))
        const initialLength = queue.length
        const errors: Error[] = []
        this.generatorProgress = 0.2
        this.onUpdate?.()

        while (queue.length) {
          const { result, finished, error } = (await Promise.race(
            queue.map((p) =>
              p.prom.then(
                (res) => ({ result: res, finished: p, error: undefined }),
                (error: Error) => ({ error, finished: p, result: undefined }),
              )
            ),
          )) as { result: any; finished: { i: number; kbd: KeyboardSide; prom: Promise<any> }; error?: Error }

          queue.splice(queue.indexOf(finished), 1)
          if (renderNumber >= this.lastRenderNumber) {
            this.generatorProgress = 0.2 + ((initialLength - queue.length) / initialLength) * 0.8
            this.onUpdate?.()
          }
          if (error) {
            errors.push(error)
            continue
          }
          if (finished.prom == otherPromises[finished.i].intersectionsPromise) {
            originalErr = [...originalErr, ...result]
            confError.set(originalErr)
          } else if (renderNumber >= this.lastRenderNumber) {
            const sideMeshes = this.meshes[finished.kbd]
            if (sideMeshes) {
              if (finished.prom == otherPromises[finished.i].holderPromise) {
                if (conf[finished.kbd]!.microcontroller) sideMeshes.holderBuf = result.mesh
              } else if (finished.prom == otherPromises[finished.i].screwPromise) {
                sideMeshes.screwBaseBuf = result.baseInserts.mesh
                sideMeshes.screwPlateBuf = result.plateInserts.mesh
              } else if (finished.prom == otherPromises[finished.i].cutPromise) {
                sideMeshes.wallBuf = result.mesh
              } else if (finished.prom == otherPromises[finished.i].wristRestPromise) {
                sideMeshes.wristBuf = result.mesh
              } else if (finished.prom == otherPromises[finished.i].secondWristRestPromise) {
                sideMeshes.secondWristBuf = result.mesh
              } else if (finished.prom == otherPromises[finished.i].cutPlatePromise) {
                sideMeshes.plateTopBuf = result.top.mesh
                sideMeshes.plateBotBuf = result.bottom.mesh || undefined
              }
            }
            this.onUpdate?.()
          }
        }
        if (errors.length) throw errors[0]

        let volume = 0
        let supportVolume = 0
        for (let i = 0; i < otherPromises.length; i++) {
          volume += (await otherPromises[i].cutPromise).mass
            + quickResults[i].web.mass
            + quickResults[i].keys.mass
            + (await otherPromises[i].screwPromise).plateInserts.mass
            + (await otherPromises[i].screwPromise).baseInserts.mass
          supportVolume += (await otherPromises[i].cutPromise).supports.volume
            + quickResults[i].web.supports.volume
            + quickResults[i].keys.supports.volume
        }

        if (renderNumber >= this.lastRenderNumber) {
          this.filament = estimateFilament(volume, supportVolume)
          for (let i = 0; i < kbdNames.length; i++) {
            const sideMeshes = this.meshes[kbdNames[i]]
            if (sideMeshes) {
              sideMeshes.supportGeometries = [
                (await otherPromises[i].cutPromise).supports,
                quickResults[i].web.supports,
                quickResults[i].keys.supports as any,
              ]
            }
          }
          this.onUpdate?.()
        }
      }
      if (full && renderNumber >= this.lastRenderNumber) this.generatorProgress = 1
      this.ocError = undefined
      this.onUpdate?.()
    } catch (e) {
      console.error(e)
      this.ocError = e as TaskError
      this.onUpdate?.()
    }
  }
}
