
// GA Brute — original configuration and catalogs.
// No Motion Twin / Eternaltwin code or assets are used here.

export const BRUTE_THEMES = {
  dorian: {
    emoji: '🛹',
    accent: '#6ee7ff',
    victory: "t'as oublié ta waxx",
  },

  flop: {
    emoji: '🎰',
    accent: '#f5b82e',
    victory: 'Rush B',
  },
}

export const DEFAULT_BRUTE_THEME = {
  emoji: '🏋️',
  accent: '#8b5cf6',
  victory: 'PR validé.',
}

export const BRUTE_WEAPONS = {
  fists: {
    id: 'fists',
    name: 'Poings',
    icon: '👊',
    damage: 6,
    speed: 1.12,
    reach: 0.75,
    accuracy: 0.97,
    tempo: 0.82,
    block: 0.06,
    combo: 0.10,
    crit: 0.03,
    category: 'unarmed',
  },

  olympic_bar: {
    id: 'olympic_bar',
    name: 'Barre olympique',
    icon: '🏋️',
    damage: 20,
    speed: 0.74,
    reach: 1.55,
    accuracy: 0.84,
    tempo: 1.42,
    block: 0.16,
    combo: -0.04,
    crit: 0.10,
    category: 'heavy',
  },

  kettlebell: {
    id: 'kettlebell',
    name: 'Kettlebell',
    icon: '🔔',
    damage: 15,
    speed: 0.91,
    reach: 0.9,
    accuracy: 0.91,
    tempo: 1.18,
    block: 0.08,
    combo: 0.01,
    crit: 0.07,
    category: 'heavy',
  },

  plate20: {
    id: 'plate20',
    name: 'Disque 20 kg',
    icon: '⭕',
    damage: 17,
    speed: 0.82,
    reach: 0.85,
    accuracy: 0.88,
    tempo: 1.30,
    block: 0.11,
    combo: -0.02,
    crit: 0.09,
    category: 'heavy',
    throwable: true,
  },

  belt: {
    id: 'belt',
    name: 'Ceinture',
    icon: '🥋',
    damage: 10,
    speed: 1.03,
    reach: 1.15,
    accuracy: 0.94,
    tempo: 0.96,
    block: 0.12,
    combo: 0.07,
    crit: 0.02,
    category: 'flexible',
  },

  chalk: {
    id: 'chalk',
    name: 'Chalk',
    icon: '☁️',
    damage: 3,
    speed: 1.2,
    reach: 1.15,
    accuracy: 0.98,
    tempo: 0.72,
    block: 0.01,
    combo: 0.13,
    crit: 0.00,
    category: 'ranged',
    throwable: true,
    effect: 'blind',
  },

  straps: {
    id: 'straps',
    name: 'Sangles',
    icon: '🪢',
    damage: 8,
    speed: 1.08,
    reach: 1.1,
    accuracy: 0.96,
    tempo: 0.88,
    block: 0.05,
    combo: 0.12,
    crit: 0.03,
    category: 'flexible',
    effect: 'grip',
  },
}

export const BRUTE_COMBAT_RULES = {
  engineVersion: 4,
  activityMaxPower: 435,
  baseInitiative: 100,
  fatiguePerAttack: 5,
  fatigueRecovery: 9,
  maxFatigue: 100,
  maxTimelineEvents: 180,
  minActionDelay: 0.42,
  maxActionDelay: 2.4,
}

export const BRUTE_SKILLS = {
  leg_drive: {
    id: 'leg_drive',
    name: 'Leg Drive',
    icon: '🦵',
    description: 'Augmente la chance de contre-attaque.',
    kind: 'reaction',
    stat: 'counter',
  },

  arch: {
    id: 'arch',
    name: 'Arch',
    icon: '🌉',
    description: 'Augmente les chances d’esquive.',
    kind: 'passive',
    stat: 'dodge',
  },

  lockout: {
    id: 'lockout',
    name: 'Lockout',
    icon: '🛡️',
    description: 'Réduit fortement un impact une fois par combat.',
    kind: 'guard',
    charges: 1,
  },

  pause_bench: {
    id: 'pause_bench',
    name: 'Pause Bench',
    icon: '⏸️',
    description: 'Peut étourdir l’adversaire.',
    kind: 'control',
  },

  grind: {
    id: 'grind',
    name: 'Grind',
    icon: '🔥',
    description: 'Survit à 1 PV une fois par combat.',
    kind: 'survival',
    charges: 1,
  },
}

export const BRUTE_PETS = {
  gym_rat: {
    id: 'gym_rat',
    name: 'Rat de salle',
    emoji: '🐀',
    hp: 24,
    strength: 7,
    agility: 13,
    speed: 16,
  },

  chalk_goblin: {
    id: 'chalk_goblin',
    name: 'Gobelin de magnésie',
    emoji: '👺',
    hp: 30,
    strength: 9,
    agility: 10,
    speed: 11,
  },

  rack_hound: {
    id: 'rack_hound',
    name: 'Chien du rack',
    emoji: '🐕',
    hp: 38,
    strength: 11,
    agility: 9,
    speed: 10,
  },

  mini_spotter: {
    id: 'mini_spotter',
    name: 'Mini spotter',
    emoji: '🧍',
    hp: 34,
    strength: 8,
    agility: 9,
    speed: 12,
  },

  plate_sprite: {
    id: 'plate_sprite',
    name: 'Esprit du disque',
    emoji: '🟡',
    hp: 20,
    strength: 12,
    agility: 12,
    speed: 15,
  },
}

export const BRUTE_PARTS = {
  bodies: [
    { id: 0, name: 'Sec' },
    { id: 1, name: 'Athlétique' },
    { id: 2, name: 'Compact' },
    { id: 3, name: 'Massif' },
    { id: 4, name: 'Powerlifter' },
    { id: 5, name: 'Heavyweight' },
  ],

  heads: [
    { id: 0, name: 'Classique' },
    { id: 1, name: 'Carré' },
    { id: 2, name: 'Rond' },
    { id: 3, name: 'Fin' },
    { id: 4, name: 'Mâchoire large' },
    { id: 5, name: 'Pommettes hautes' },
  ],

  skins: [
    '#f7d7c4',
    '#edc3a5',
    '#dca57f',
    '#c9865f',
    '#a96443',
    '#82503a',
    '#5f3a2e',
    '#3d2824',
  ],

  hairs: [
    { id: 0, name: 'Buzz cut' },
    { id: 1, name: 'Crête' },
    { id: 2, name: 'Man bun' },
    { id: 3, name: 'Afro' },
    { id: 4, name: 'Mulet' },
    { id: 5, name: 'Chauve' },
    { id: 6, name: 'Couettes' },
    { id: 7, name: 'Mèche emo' },
    { id: 8, name: 'Dreads' },
    { id: 9, name: 'Banane' },
    { id: 10, name: 'Queue de cheval' },
    { id: 11, name: 'Fade' },
    { id: 12, name: 'Curly crop' },
    { id: 13, name: 'Undercut' },
    { id: 14, name: 'Long ondulé' },
    { id: 15, name: 'Tresses' },
    { id: 16, name: 'Mohawk court' },
    { id: 17, name: 'Slick back' },
  ],

  hairColors: [
    '#111111',
    '#4b2d1f',
    '#7a4c2b',
    '#c78a45',
    '#e6d39a',
    '#d14c3f',
    '#7f56d9',
    '#35b6d4',
    '#60d36f',
    '#f15fc5',
  ],

  beards: [
    { id: 0, name: 'Aucune' },
    { id: 1, name: 'Moustache' },
    { id: 2, name: 'Bouc' },
    { id: 3, name: 'Barbe courte' },
    { id: 4, name: 'Barbe complète' },
    { id: 5, name: 'Barbe viking' },
    { id: 6, name: 'Moustache + bouc' },
    { id: 7, name: 'Barbe de 3 jours' },
  ],

  eyes: [
    { id: 0, name: 'Déterminé' },
    { id: 1, name: 'Énervé' },
    { id: 2, name: 'Blasé' },
    { id: 3, name: 'Fou' },
    { id: 4, name: 'Concentré' },
    { id: 5, name: 'Serein' },
    { id: 6, name: 'Fatigué' },
    { id: 7, name: 'Provocateur' },
  ],

  noses: [
    { id: 0, name: 'Droit' },
    { id: 1, name: 'Court' },
    { id: 2, name: 'Large' },
    { id: 3, name: 'Aquilin' },
    { id: 4, name: 'Cassé' },
    { id: 5, name: 'Petit' },
  ],

  mouths: [
    { id: 0, name: 'Neutre' },
    { id: 1, name: 'Sourire' },
    { id: 2, name: 'Grimace' },
    { id: 3, name: 'Cri' },
    { id: 4, name: 'Coin de bouche' },
    { id: 5, name: 'Défi' },
    { id: 6, name: 'Serrée' },
    { id: 7, name: 'Smirk' },
  ],

  markings: [
    { id: 0, name: 'Aucun' },
    { id: 1, name: 'Cicatrice sourcil' },
    { id: 2, name: 'Cicatrice joue' },
    { id: 3, name: 'Freckles' },
    { id: 4, name: 'Chalk face' },
    { id: 5, name: 'Eye black' },
  ],

  tops: [
    { id: 0, name: 'Débardeur' },
    { id: 1, name: 'Singlet compétition' },
    { id: 2, name: 'T-shirt' },
    { id: 3, name: 'Torse nu' },
    { id: 4, name: 'Hoodie sans manches' },
    { id: 5, name: 'Crop training' },
  ],

  bottoms: [
    { id: 0, name: 'Short' },
    { id: 1, name: 'Singlet' },
    { id: 2, name: 'Jogging' },
    { id: 3, name: 'Short compression' },
    { id: 4, name: 'Pantalon training' },
  ],

  accessories: [
    { id: 0, name: 'Aucun' },
    { id: 1, name: 'Bandeau' },
    { id: 2, name: 'Genouillères' },
    { id: 3, name: 'Protège-poignets' },
    { id: 4, name: 'Chaîne en or' },
    { id: 5, name: 'Lunettes' },
    { id: 6, name: 'Casquette arrière' },
    { id: 7, name: 'Bande nasale' },
    { id: 8, name: 'Boucle d’oreille' },
    { id: 9, name: 'Ceinture de force' },
  ],
}

export const DEFAULT_APPEARANCE = {
  v: 2,
  body: 1,
  head: 0,
  skin: 2,
  hair: 0,
  hairColor: 0,
  beard: 0,
  eyes: 0,
  nose: 0,
  mouth: 0,
  marking: 0,
  top: 0,
  bottom: 0,
  colors: ['#7c3aed', '#111827'],
  acc: 0,
}

export function getBruteTheme(slug) {
  return (
    BRUTE_THEMES[String(slug || '').toLowerCase()] ||
    DEFAULT_BRUTE_THEME
  )
}

export function randomAppearance(random = Math.random) {
  const pickIndex = length =>
    Math.floor(
      random() *
      Math.max(1, length)
    )

  const palette = [
    '#7c3aed',
    '#2563eb',
    '#dc2626',
    '#059669',
    '#d97706',
    '#e11d48',
    '#06b6d4',
    '#f8fafc',
  ]

  const neutrals = [
    '#111827',
    '#1f2937',
    '#3f3f46',
    '#0f172a',
    '#27272a',
    '#f8fafc',
    '#f59e0b',
    '#0f766e',
  ]

  return {
    v: 2,
    body: pickIndex(BRUTE_PARTS.bodies.length),
    head: pickIndex(BRUTE_PARTS.heads.length),
    skin: pickIndex(BRUTE_PARTS.skins.length),
    hair: pickIndex(BRUTE_PARTS.hairs.length),
    hairColor: pickIndex(BRUTE_PARTS.hairColors.length),
    beard: pickIndex(BRUTE_PARTS.beards.length),
    eyes: pickIndex(BRUTE_PARTS.eyes.length),
    nose: pickIndex(BRUTE_PARTS.noses.length),
    mouth: pickIndex(BRUTE_PARTS.mouths.length),
    marking: pickIndex(BRUTE_PARTS.markings.length),
    top: pickIndex(BRUTE_PARTS.tops.length),
    bottom: pickIndex(BRUTE_PARTS.bottoms.length),
    colors: [
      palette[pickIndex(palette.length)],
      neutrals[pickIndex(neutrals.length)],
    ],
    acc: pickIndex(BRUTE_PARTS.accessories.length),
  }
}
