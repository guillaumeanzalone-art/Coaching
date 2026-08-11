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
  "jonathan": () => import('./programs/jonathan.js'),
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

export async function getProgramForAthlete(athleteId) {
  const loader = PROGRAM_LOADERS[athleteId]

  if (!loader) {
    return null
  }

  const module = await loader()
  return module.default ?? null
}
