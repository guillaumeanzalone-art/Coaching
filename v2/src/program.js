import {
  getCachedProgramForAthlete as getCachedCloudProgramForAthlete,
  getProgramWithCloudFallback,
} from './program-cloud.js'

const PROGRAM_LOADERS = {
  "alexandre": () => import('./programs/alexandre.js'),
  "benoit": () => import('./programs/benoit.js'),
  "celia": () => import('./programs/celia.js'),
  "charles": () => import('./programs/charles.js'),
  "clemosaurus": () => import('./programs/clemosaurus.js'),
  "dorian": () => import('./programs/dorian.js'),
  "duane": () => import('./programs/duane.js'),
  "flop": () => import('./programs/flop.js'),
  "gibertini": () => import('./programs/gibertini.js'),
  "guillaume": () => import('./programs/guillaume.js'),
  "hugo": () => import('./programs/hugo.js'),
  "janel": () => import('./programs/janel.js'),
  "jolan": () => import('./programs/jolan.js'),
  "jonathan": async () => {
    const [
      baseModule,
      block2Module,
    ] = await Promise.all([
      import('./programs/jonathan.js'),
      import('./programs/jonathan-block2.js'),
    ])

    const baseProgram =
      baseModule.default ?? null

    const block2 =
      block2Module.default ?? null

    if (!baseProgram || !block2) {
      return {
        default: baseProgram,
      }
    }

    const previousBlocks =
      Array.isArray(baseProgram.blocks)
        ? baseProgram.blocks.filter(
            (item) =>
              item?.id !== block2.id
          )
        : []

    return {
      default: {
        ...baseProgram,
        defaultBlockId: block2.id,
        blocks: [
          ...previousBlocks,
          block2,
        ],
      },
    }
  },
  "kaoutar": () => import('./programs/kaoutar.js'),
  "killian": () => import('./programs/killian.js'),
  "lou": () => import('./programs/lou.js'),
  "louis": () => import('./programs/louis.js'),
  "lucine": () => import('./programs/lucine.js'),
  "magicarpe": () => import('./programs/magicarpe.js'),
  "malo": () => import('./programs/malo.js'),
  "marvin": () => import('./programs/marvin.js'),
  "matthieu": () => import('./programs/matthieu.js'),
  "maxence": () => import('./programs/maxence.js'),
  "metaknight": () => import('./programs/metaknight.js'),
  "noe": () => import('./programs/noe.js'),
  "sarah": () => import('./programs/sarah.js'),
  "saya": () => import('./programs/saya.js'),
  "serena": () => import('./programs/serena.js'),
  "tom": () => import('./programs/tom.js'),
  "yann": () => import('./programs/yann.js')
}

export async function getLocalProgramForAthlete(athleteId) {
  const loader = PROGRAM_LOADERS[athleteId]

  if (!loader) {
    return null
  }

  const module = await loader()
  return module.default ?? null
}


/* PROGRAM CLOUD V1 */

export async function getProgramForAthlete(
  athleteId
) {
  return getProgramWithCloudFallback({
    athleteId,

    localLoader:
      () =>
        getLocalProgramForAthlete(
          athleteId
        ),
  })
}

export function getCachedProgramForAthlete(
  athleteId
) {
  return getCachedCloudProgramForAthlete(
    athleteId
  )
}
