/* La Toile des Ombres — pack-specific drops and rarity odds.
 * Pokémon-inspired slot distribution; these are original GA rates, not official TCG odds.
 * All decisions are made before the server RPC saves the resulting five cards.
 */
export const PACK_IDENTITY = Object.freeze({
  forge:      { name:'Forge',       sigil:'anvil',   lead:'hugo',      pool:['hugo','benoit','charles','maxence'] },
  titan:      { name:'Titan',       sigil:'mountain',lead:'benoit',    pool:['benoit','marvin','noe','dorian'] },
  voltage:    { name:'Voltage',     sigil:'bolt',    lead:'celia',     pool:['celia','allan','malo','saya'] },
  lunar:      { name:'Lunaire',     sigil:'moon',    lead:'camille',   pool:['camille','lucine','sarah','janel'] },
  solar:      { name:'Solaire',     sigil:'sun',     lead:'magicarpe',     pool:['magicarpe','clemence','lou','noe'] },
  dragon:     { name:'Dragon',      sigil:'dragon',  lead:'killian',   pool:['killian','malo','metaknight','yann'] },
  crown:      { name:'Serena',      sigil:'crown',   lead:'serena',    pool:['serena','lucine','janel','kaoutar'], secretOnly:'serena' },
  abyss:      { name:'Abysses',     sigil:'trident', lead:'camille',   pool:['camille','alexandre','rudy','sarah'] },
  sakura:     { name:'Sakura',      sigil:'flower',  lead:'lou',       pool:['lou','kaoutar','janel','serena'] },
  atlas:      { name:'Atlas',       sigil:'compass', lead:'guillaume', pool:['guillaume','allan','matthieu','duane'] },
  mirage:     { name:'Mirage',      sigil:'eye',     lead:'rudy',      pool:['rudy','saya','flop','dorian'] },
  nordic:     { name:'Nordique',    sigil:'snow',    lead:'tom',       pool:['tom','gibertini','yann','benoit'] },
  arena:      { name:'Arène',       sigil:'swords',  lead:'allan',     pool:['allan','guillaume','clemence','charles'] },
  precision:  { name:'Précision',   sigil:'target',  lead:'charles',   pool:['charles','matthieu','marvin','rudy'] },
  wild:       { name:'Sauvage',     sigil:'claw',    lead:'alexandre', pool:['alexandre','clemosaurus','hugo','jolan'] },
  champion:   { name:'Champion',    sigil:'laurel',  lead:'yann',      pool:['yann','guillaume','noe','clemence'] },
  eclipse:    { name:'Éclipse',     sigil:'eclipse', lead:'malo',      pool:['malo','metaknight','jonathan','killian'] },
  neon:       { name:'Néon',        sigil:'diamond', lead:'jolan',     pool:['jolan','celia','jonathan','maxence'] },
  storm:      { name:'Tempête',     sigil:'storm',   lead:'saya',      pool:['saya','allan','duane','louis'] },
  'secret-lab':{name:'Laboratoire', sigil:'flask',   lead:'alexandre', pool:['alexandre','hugo','rudy','flop'] },
})

// Five distinct slots: ordinary pulls, development pull, rare slot and chase slot.
// Percentages are exact per slot before hard pity, not official Pokémon rates.
export const SLOT_ODDS = Object.freeze([
  Object.freeze({common: 80, uncommon: 20}),
  Object.freeze({common: 70, uncommon: 30}),
  Object.freeze({common: 25, uncommon: 60, rare: 15}),
  Object.freeze({uncommon: 58, rare: 40, ultra: 1.8, secret: 0.2}),
  Object.freeze({rare: 88, ultra: 10, secret: 2}),
])

// Uniform 0 <= value < 1. crypto RNG avoids Math.random predictability.
export function secureRatio() {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 0x100000000
}

export function rollWeighted(odds, random = secureRatio) {
  const roll = Math.min(1 - Number.EPSILON, Math.max(0, random())) * 100
  let cumulative = 0
  for (const [rarity, weight] of Object.entries(odds)) {
    cumulative += weight
    if (roll < cumulative) return rarity
  }
  return Object.keys(odds).at(-1)
}

export function rollSlotRarity(slot, openingNumber = 1, random = secureRatio) {
  if (slot === 4 && Number.isInteger(openingNumber) && openingNumber > 0) {
    if (openingNumber % 50 === 0) return 'secret'
    if (openingNumber % 10 === 0) return 'ultra'
  }
  return rollWeighted(SLOT_ODDS[slot] || SLOT_ODDS[4], random)
}

export function resolvePackIdentity(id) {
  return PACK_IDENTITY[id] || null
}

export function packRoster(pack, athletes, slugOf) {
  const available = new Map(athletes.filter(Boolean).map(person => [slugOf(person),person]))
  const selected = (pack?.poolSlugs || []).map(slug => available.get(slug)).filter(Boolean)
  return selected.length ? selected : athletes.filter(person => slugOf(person) && slugOf(person) !== 'serena')
}

function weightedAthlete(athletes, pack, slugOf, previous, rarity, random) {
  const candidates = athletes.filter(athlete => {
    const slug = slugOf(athlete)
    if (rarity === 'secret' && slug === 'serena' && pack?.id !== 'crown') return false
    if (rarity === 'secret' && pack?.secretOnly && slug !== pack.secretOnly) return false
    return true
  })
  if (!candidates.length) return null
  const unused = candidates.filter(athlete => !previous.has(slugOf(athlete) + ':' + rarity))
  const eligible = unused.length ? unused : candidates
  const weightOf = athlete => slugOf(athlete) === pack.leadSlug ? 5 : 1
  const total = eligible.reduce((sum,athlete) => sum + weightOf(athlete),0)
  let target = random() * total
  for (const athlete of eligible) {
    target -= weightOf(athlete)
    if (target < 0) return athlete
  }
  return eligible.at(-1)
}

export function drawThemedBooster({
  booster, athletes, openingNumber, slugOf, buildCard, random = secureRatio,
}) {
  const roster = packRoster(booster, athletes, slugOf)
  if (!roster.length) throw new Error('Aucun athlète éligible pour ce booster')
  const previous = new Set()
  return SLOT_ODDS.map((_,slot) => {
    let rarity = rollSlotRarity(slot, openingNumber, random)
    let athlete = weightedAthlete(roster,booster,slugOf,previous,rarity,random)
    // Do not leak an exclusive divine card from the wrong pack.
    if (!athlete && rarity === 'secret') {
      rarity = 'ultra'
      athlete = weightedAthlete(roster,booster,slugOf,previous,rarity,random)
    }
    if (!athlete) throw new Error('Pool du booster indisponible')
    const card = buildCard(athlete,rarity)
    previous.add(card.id)
    return card
  })
}
