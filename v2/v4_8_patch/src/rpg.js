import {
  createRpgLeaderboardState,
  loadRpgLeaderboard,
  renderRpgLeaderboard,
  handleRpgLeaderboardAction,
} from './rpg-leaderboard.js'

import {
  createRpgRaidState,
  loadRpgRaidState,
  renderRpgRaid,
  handleRpgRaidAction,
  startRpgRaidFight,
} from './rpg-raid.js'

﻿import { supabase } from './supabase.js'
import { xpProgressFromTotal } from './xp.js'
import { loadRpgInventory, renderRpgEquipment, handleRpgEquipmentAction, updateRpgEquipmentUi } from './rpg-equipment.js'
import { createRpgCaseState, setRpgCaseLevel, loadRpgCasePrices, renderRpgCases, handleRpgCaseAction } from './rpg-cases.js'
import { createRpgCollectionState, loadRpgCollections, renderRpgCollection, updateRpgCollectionFilter, handleRpgCollectionAction } from './rpg-collection.js'
import { installRpgAudioControls, playRpgMenuMusic } from './rpg-audio.js'
import {
  createRpgCombatState,
  renderRpgCombatLauncher,
  setRpgCombatDifficulty,
  startRpgCombat
} from './rpg-combat.js'
import {
  createRpgForgeState,
  loadRpgCasinoState,
  renderRpgForge,
  setRpgCasinoBet,
  handleRpgForgeAction
} from './rpg-forge.js'
import { installRpgBestiarySpriteEnhancer } from './rpg-bestiary-sprites.js'
import {
  createRpgHealthState,
  loadRpgHealth,
  renderRpgHealth,
  handleRpgHealthAction,
} from './rpg-health.js'

export const CLASS_DEFS = {
  warrior: {
    icon: '⚔️',
    title: 'Guerrier',
    subtitle: 'Spécialiste Squat',
    lift: 'sq',
    mainStat: 'Force',
    masteryStat: 'Chance',
    affinity: 'Armes',
    perk: '+25 % d’XP sur les séries et PR de squat',
    combat:
      'Rage du colosse · pendant 5 s, les cibles réussies infligent +35 % de dégâts.',
  },

  archer: {
    icon: '🏹',
    title: 'Archer',
    subtitle: 'Spécialiste Bench',
    lift: 'bn',
    mainStat: 'Précision',
    masteryStat: 'Chance',
    affinity: 'Armures',
    perk: '+25 % d’XP sur les séries et PR de bench',
    combat:
      'Œil du faucon · pendant 5 s, les zones sont plus larges et les cibles valides deviennent parfaites.',
  },

  mage: {
    icon: '🔮',
    title: 'Mage',
    subtitle: 'Spécialiste Deadlift',
    lift: 'dl',
    mainStat: 'Magie',
    masteryStat: 'Chance',
    affinity: 'Reliques',
    perk: '+25 % d’XP sur les séries et PR de deadlift',
    combat:
      'Arrêt du temps · fige le chrono pendant 4 s et ajoute 4 cibles.',
  },
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function number(value, fallback = 0) {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function format(value, digits = 0) {
  return number(value).toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: digits,
    }
  )
}

const PROFILE_RARITIES_V34 = [
  'normal',
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
  'ultra_mythic',
  'abyssal',
]

const PROFILE_RARITY_LABELS_V34 = {
  normal: 'Simple',
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
  mythic: 'Mythique',
  ultra_mythic: 'URM',
  abyssal: 'Abyssal',
}

function profileRarityV34(
  inventory = [],
  collectionState = {}
) {
  const found = []

  for (const item of Array.isArray(inventory) ? inventory : []) {
    found.push(
      String(
        item?.rarity ||
        item?.item_rarity ||
        'normal'
      )
    )
  }

  const catalogByKey =
    new Map(
      (Array.isArray(collectionState?.itemCatalog)
        ? collectionState.itemCatalog
        : []
      ).map(item => [
        String(item?.catalog_key || ''),
        item,
      ])
    )

  for (
    const owned of
      Array.isArray(collectionState?.itemCollection)
        ? collectionState.itemCollection
        : []
  ) {
    const catalog =
      catalogByKey.get(
        String(owned?.catalog_key || '')
      )

    found.push(
      String(
        owned?.rarity ||
        catalog?.rarity ||
        'normal'
      )
    )
  }

  let best = 'normal'

  for (const rarity of found) {
    if (
      PROFILE_RARITIES_V34.indexOf(rarity) >
      PROFILE_RARITIES_V34.indexOf(best)
    ) {
      best = rarity
    }
  }

  return {
    key: best,
    label:
      PROFILE_RARITY_LABELS_V34[best] ||
      best,
  }
}

function uniqueCountV34(rows, key) {
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map(row => String(row?.[key] || ''))
      .filter(Boolean)
  ).size
}

function progressionDashboardV34(
  progress,
  inventory = [],
  collectionState = {}
) {
  const rarity =
    profileRarityV34(
      inventory,
      collectionState
    )

  const itemOwned =
    uniqueCountV34(
      collectionState?.itemCollection,
      'catalog_key'
    )

  const monsterOwned =
    uniqueCountV34(
      collectionState?.monsterCollection,
      'monster_key'
    )

  const itemTotal =
    Math.max(
      itemOwned,
      Array.isArray(collectionState?.itemCatalog)
        ? collectionState.itemCatalog.length
        : 0
    )

  const monsterTotal =
    Math.max(
      monsterOwned,
      Array.isArray(collectionState?.monsterCatalog)
        ? collectionState.monsterCatalog.length
        : 0
    )

  const itemPct =
    itemTotal
      ? Math.min(100, itemOwned / itemTotal * 100)
      : 0

  const monsterPct =
    monsterTotal
      ? Math.min(100, monsterOwned / monsterTotal * 100)
      : 0

  const bossKills =
    Math.max(
      0,
      Math.min(
        50,
        number(
          progress?.kills_toward_boss
        )
      )
    )

  const bossLeft =
    Math.max(0, 50 - bossKills)

  const bossPct =
    bossKills / 50 * 100

  return `
    <section class="rpg-progress-dashboard-v34">
      <div class="rpg-progress-dashboard-head-v34">
        <div>
          <span>PROFIL RPG</span>
          <strong>Vue d’ensemble</strong>
        </div>

        <div class="rpg-progress-rarity-v34 rarity-${esc(rarity.key)}">
          <small>Rareté max</small>
          <b>${esc(rarity.label)}</b>
        </div>
      </div>

      <div class="rpg-progress-kpis-v34">
        <div>
          <span>🗺️ Palier max</span>
          <b>${format(progress?.adventure_difficulty, 0)}</b>
        </div>

        <div>
          <span>💥 Meilleur combat</span>
          <b>${format(progress?.best_combat_damage, 0)}</b>
        </div>

        <div>
          <span>🏆 Victoires</span>
          <b>${format(progress?.combat_wins, 0)}</b>
        </div>

        <div>
          <span>👑 Boss vaincus</span>
          <b>${format(progress?.boss_wins, 0)}</b>
        </div>

        <div>
          <span>🪙 Gold gagné</span>
          <b>${format(progress?.gold_total_earned, 0)}</b>
        </div>

        <div>
          <span>📚 Collection</span>
          <b>${itemOwned + monsterOwned}</b>
        </div>
      </div>

      <div class="rpg-progress-tracks-v34">
        <div class="rpg-progress-track-v34 boss">
          <div>
            <strong>👹 Prochain boss</strong>
            <span>
              ${bossLeft > 0
                ? `${bossLeft} combat${bossLeft > 1 ? 's' : ''} restant${bossLeft > 1 ? 's' : ''}`
                : 'Boss disponible'}
            </span>
          </div>
          <div class="rpg-progress-track-bar-v34">
            <i style="width:${bossPct}%"></i>
          </div>
          <small>${format(bossKills, 0)}/50</small>
        </div>

        <div class="rpg-progress-track-v34">
          <div>
            <strong>🎒 Codex objets</strong>
            <span>${itemOwned}/${itemTotal || 0}</span>
          </div>
          <div class="rpg-progress-track-bar-v34">
            <i style="width:${itemPct}%"></i>
          </div>
          <small>${format(itemPct, 0)} %</small>
        </div>

        <div class="rpg-progress-track-v34">
          <div>
            <strong>📖 Bestiaire</strong>
            <span>${monsterOwned}/${monsterTotal || 0}</span>
          </div>
          <div class="rpg-progress-track-bar-v34">
            <i style="width:${monsterPct}%"></i>
          </div>
          <small>${format(monsterPct, 0)} %</small>
        </div>
      </div>
    </section>
  `
}


const ATHLETE_AVATARS = {
  alexandre: '/avatar-alexandre.png',
  benoit: '/avatar-benoit.png',
  celia: '/avatar-celia.png',
  charles: '/avatar-charles.png',
  clemosaurus: '/avatar-clemosaurus.png',
  dorian: '/avatar-dorian.png',
  duane: '/avatar-duane.png',
  flop: '/avatar-flop.png',
  gibertini: '/avatar-gibertini.png',
  guillaume: '/avatar-guillaume.png',
  hugo: '/avatar-hugo.png',
  janel: '/avatar-janel.png',
  jolan: '/avatar-jolan.png',
  jonathan: '/avatar-jonathan.png',
  kaoutar: '/avatar-kaoutar.png',
  killian: '/avatar-killian.png',
  lou: '/avatar-lou.png',
  louis: '/avatar-louis.png',
  lucine: '/avatar-lucine.png',
  magicarpe: '/avatar-magicapre.png',
  magicapre: '/avatar-magicapre.png',
  malo: '/avatar-malo.png',
  marvin: '/avatar-marvin-v202.png',
  matthieu: '/avatar-Matthieu.png',
  maxence: '/avatar-Maxence.png',
  metaknight: '/avatar-Metaknight.png',
  noe: '/avatar-Noe.png',
  sarah: '/avatar-sarah.png',
  saya: '/avatar-saya.png',
  serena: '/avatar-serena.png',
  tom: '/avatar-tom.png',
  yann: '/avatar-yann.png',
}

function avatarKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(' ', '')
    .replaceAll('-', '')
    .replaceAll('_', '')
}

function athleteAvatar(athlete) {
  const candidates = [
    athlete?.id,
    athlete?.slug,
    athlete?.cloudSlug,
    athlete?.name,
  ]

  for (const candidate of candidates) {
    const key =
      avatarKey(candidate)

    if (ATHLETE_AVATARS[key]) {
      return ATHLETE_AVATARS[key]
    }

    for (
      const [name, url] of
        Object.entries(
          ATHLETE_AVATARS
        )
    ) {
      if (
        key.includes(
          avatarKey(name)
        )
      ) {
        return url
      }
    }
  }

  return ''
}

function athleteSlug(athlete) {
  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    ''
  )
}

function defaultProgress(slug) {
  return {
    athlete_slug: slug,
    xp_total: 0,
    level: 1,
    unopened_packs: 0,
    gl_points: 0,
    gl_multiplier: 1,
    rpg_class: null,
    combat_wins: 0,
    combat_losses: 0,
    gold_balance: 0,
    gold_total_earned: 0,
    stat_power: 0,
    stat_mastery: 0,
    stat_fortune: 0,
    adventure_difficulty: 1,
    kills_toward_boss: 0,
    boss_wins: 0,
    raid_ultra_cases: 0,
  }
}

async function fetchProgress(slug) {
  const { data, error } =
    await supabase
      .from('athlete_progress')
      .select(
        [
          'athlete_slug',
          'xp_total',
          'level',
          'unopened_packs',
          'gl_points',
          'gl_multiplier',
          'rpg_class',
          'class_chosen_at',
          'combat_wins',
          'combat_losses',
          'best_combat_damage',
          'gold_balance',
          'gold_total_earned',
          'stat_power',
          'stat_mastery',
          'stat_fortune',
          'collection_xp_bonus',
          'best_damage_trial',
          'damage_trial_attempts',
          'adventure_difficulty',
          'kills_toward_boss',
          'boss_wins',
          'raid_ultra_cases',
        ].join(',')
      )
      .eq(
        'athlete_slug',
        slug
      )
      .maybeSingle()

  if (error) {
    throw error
  }

  return {
    ...defaultProgress(slug),
    ...(data || {}),
  }
}

function classChoiceHtml(canEdit) {
  return `
    <section class="rpg-section">
      <div class="rpg-section-title">
        Choisis ta classe
      </div>

      <p class="rpg-warning">
        Ce choix est permanent et définitif.
      </p>

      <div class="rpg-class-grid">
        ${Object.entries(CLASS_DEFS)
          .map(([key, def]) => `
            <button
              type="button"
              class="rpg-class-card"
              data-rpg-class="${key}"
              ${canEdit ? '' : 'disabled'}
            >
              <span class="rpg-class-icon">
                ${def.icon}
              </span>

              <strong>
                ${esc(def.title)}
              </strong>

              <span>
                ${esc(def.subtitle)}
              </span>

              <small>
                ${esc(def.perk)}
              </small>

              <small>
                Affinité : ${esc(def.affinity)} +25 %
              </small>

              <small>
                ${esc(def.combat)}
              </small>
            </button>
          `)
          .join('')}
      </div>
    </section>
  `
}

function affinitySlotV44(classKey) {
  if (classKey === 'warrior') return 'weapon'
  if (classKey === 'archer') return 'armor'
  if (classKey === 'mage') return 'relic'
  return ''
}

function progressionStatsV44(
  progress,
  inventory = [],
  collectionState = {}
) {
  const affinitySlot =
    affinitySlotV44(
      progress?.rpg_class
    )

  const gear =
    (Array.isArray(inventory) ? inventory : [])
      .filter(item => item?.equipped)
      .reduce(
        (sum, item) => {
          const affinity =
            item?.slot === affinitySlot
              ? 1.25
              : 1

          return {
            power:
              sum.power +
              number(
                item?.scaled_power_bonus,
                number(item?.power_bonus)
              ) * affinity,
            mastery:
              sum.mastery +
              number(
                item?.scaled_mastery_bonus,
                number(item?.mastery_bonus)
              ) * affinity,
            fortune:
              sum.fortune +
              number(
                item?.scaled_fortune_bonus,
                number(item?.fortune_bonus)
              ) * affinity,
          }
        },
        {
          power: 0,
          mastery: 0,
          fortune: 0,
        }
      )

  const owned =
    new Set(
      (Array.isArray(collectionState?.itemCollection)
        ? collectionState.itemCollection
        : []
      )
        .map(row => String(row?.catalog_key || ''))
        .filter(Boolean)
    )

  const collection =
    (Array.isArray(collectionState?.itemCatalog)
      ? collectionState.itemCatalog
      : []
    )
      .filter(item =>
        owned.has(
          String(item?.catalog_key || '')
        )
      )
      .reduce(
        (sum, item) => ({
          power:
            sum.power +
            number(
              item?.collection_power_bonus
            ) / 10,
          mastery:
            sum.mastery +
            number(
              item?.collection_mastery_bonus
            ) / 10,
          fortune:
            sum.fortune +
            number(
              item?.collection_fortune_bonus
            ) / 10,
        }),
        {
          power: 0,
          mastery: 0,
          fortune: 0,
        }
      )

  const base = {
    power: number(progress?.stat_power),
    mastery: number(progress?.stat_mastery),
    fortune: number(progress?.stat_fortune),
  }

  return {
    base,
    gear,
    collection,
    total: {
      power:
        base.power + gear.power + collection.power,
      mastery:
        base.mastery + gear.mastery + collection.mastery,
      fortune:
        base.fortune + gear.fortune + collection.fortune,
    },
  }
}

function powerDamageMultiplierV44(value) {
  const power =
    Math.max(0, number(value))

  if (power <= 300) {
    return 1 + power / 25
  }

  return 13 *
    Math.pow(
      power / 300,
      0.70
    )
}

function chanceCritPctV44(value) {
  return 25 *
    (
      1 -
      Math.exp(
        -Math.max(0, number(value)) /
        250
      )
    )
}

function goldJackpotChancePctV44(value) {
  return 3 *
    (
      1 -
      Math.exp(
        -Math.max(0, number(value)) /
        500
      )
    )
}

function encounterSummaryV44(
  chance,
  inventory = []
) {
  const hunter =
    (Array.isArray(inventory) ? inventory : [])
      .filter(item =>
        item?.equipped &&
        item?.passive_type === 'epic_hunter'
      )
      .reduce(
        (sum, item) =>
          sum + number(item?.passive_value),
        0
      )

  const uncommonMult =
    1 +
    Math.min(1500, Math.max(0, chance)) /
    750

  const eliteMult =
    1 +
    Math.min(1500, Math.max(0, chance)) /
    500

  const hunterMult =
    1 +
    Math.min(100, Math.max(0, hunter)) /
    100

  const weights = {
    normal: 33.889,
    common: 30,
    uncommon: 20 * uncommonMult,
    rare: 10 * eliteMult * hunterMult,
    epic: 5 * eliteMult * hunterMult,
    legendary: 1 * eliteMult * hunterMult,
    mythic: .1 * eliteMult * hunterMult,
    ultra_mythic: .01 * eliteMult * hunterMult,
    abyssal: .001 * eliteMult * hunterMult,
  }

  const total =
    Object.values(weights)
      .reduce((a, b) => a + b, 0) || 1

  const uncommonPlus =
    (
      weights.uncommon +
      weights.rare +
      weights.epic +
      weights.legendary +
      weights.mythic +
      weights.ultra_mythic +
      weights.abyssal
    ) /
    total *
    100

  return {
    uncommonPlus,
    eliteMult,
  }
}

function progressionXpHeroV44(
  progress
) {
  const xp =
    number(progress?.xp_total)

  const calculated =
    xpProgressFromTotal(xp)

  const level =
    Math.max(
      1,
      number(progress?.level, 1),
      calculated.level
    )

  const pct =
    Math.min(
      100,
      Math.max(
        0,
        calculated.into /
          Math.max(1, calculated.cost) *
          100
      )
    )

  return `
    <section class="rpg-xp-legacy-v44">
      <div class="rpg-xp-level-v44">
        NIVEAU ${format(level, 0)}
      </div>

      <div class="rpg-xp-total-v44">
        ${format(xp, 1)}
        <small>XP au total</small>
      </div>

      <div class="rpg-xp-progress-v44">
        <span style="width:${pct}%"></span>
      </div>

      <div class="rpg-xp-next-v44">
        <span>
          ${format(calculated.into, 1)} /
          ${format(calculated.cost, 0)} XP
        </span>
        <span>Niveau ${format(level + 1, 0)}</span>
      </div>

      <div class="rpg-xp-stats-v44">
        <div>
          <b>${format(progress?.gl_points, 1)}</b>
          <span>GL POINTS</span>
        </div>

        <div>
          <b>×${format(progress?.gl_multiplier, 2)}</b>
          <span>COEFFICIENT GL</span>
        </div>

        <div>
          <b class="gold">🪙 ${format(progress?.gold_balance, 0)}</b>
          <span>GOLD</span>
        </div>
      </div>
    </section>
  `
}

function classProfileHtml(
  progress,
  athlete,
  inventory = [],
  collectionState = {}
) {
  const def =
    CLASS_DEFS[
      progress.rpg_class
    ]

  if (!def) {
    return ''
  }

  const snapshot =
    progressionStatsV44(
      progress,
      inventory,
      collectionState
    )

  const stats = [
    {
      key: 'power',
      label: def.mainStat,
    },
    {
      key: 'mastery',
      label: def.masteryStat,
    },
    {
      key: 'fortune',
      label: 'Fortune',
    },
  ]

  const chance =
    snapshot.total.mastery

  const encounter =
    encounterSummaryV44(
      chance,
      inventory
    )

  const avatar =
    athleteAvatar(athlete)

  return `
    <section class="rpg-class-legacy-v44">
      <div class="rpg-class-title-v44">
        CLASSE DE COMBAT
      </div>

      <div class="rpg-class-profile-v44">
        <div class="rpg-class-avatar-v44">
          ${avatar
            ? `<img src="${esc(avatar)}" alt="Avatar de ${esc(athlete?.name || def.title)}">`
            : `<span>${def.icon}</span>`}
        </div>

        <div>
          <strong>${esc(def.title)}</strong>
          <span>
            ${esc(def.subtitle)} · choix définitif
          </span>
        </div>
      </div>

      <div class="rpg-class-statline-v44">
        ${stats.map(stat => {
          const base = snapshot.base[stat.key]
          const gear = snapshot.gear[stat.key]
          const collection = snapshot.collection[stat.key]
          const total = snapshot.total[stat.key]

          return `
            <div class="rpg-class-stat-v44">
              <b>${format(total, 1)}</b>
              <span>${esc(stat.label)}</span>
              <small>
                ${format(base, 1)} +
                ${format(gear, 1)} équipement<br>
                (affinité incluse) +
                ${format(collection, 1)} collection
              </small>
            </div>
          `
        }).join('')}
      </div>

      <div class="rpg-class-influence-v44">
        <div class="force">
          <span>FORCE</span>
          <strong>
            Dégâts ×${format(
              powerDamageMultiplierV44(
                snapshot.total.power
              ),
              2
            )}
          </strong>
          <p>
            Progression directe jusqu’à 300,
            puis croissance maîtrisée.
          </p>
        </div>

        <div class="chance">
          <span>CHANCE</span>
          <strong>
            ${format(
              chanceCritPctV44(chance),
              2
            )} % crit
          </strong>
          <p>
            Peu commun+ ${format(encounter.uncommonPlus, 3)} % ·
            poids Rare+ ×${format(encounter.eliteMult, 2)} ·
            Gold ×10 ${format(goldJackpotChancePctV44(chance), 2)} %.
          </p>
        </div>

        <div class="fortune">
          <span>FORTUNE</span>
          <strong>
            +${format(snapshot.total.fortune * 3, 1)} % gold
          </strong>
          <p>+3 % gold par rang.</p>
        </div>
      </div>

      <div class="rpg-class-record-v44">
        <span>Victoires <b>${format(progress?.combat_wins, 0)}</b></span>
        <span>Défaites <b>${format(progress?.combat_losses, 0)}</b></span>
        <span>Boss <b>${format(progress?.boss_wins, 0)}</b></span>
      </div>
    </section>
  `
}

function progressionHtml(
  progress,
  canEdit,
  inventory = [],
  collectionState = {},
  athlete = null
) {
  return `
    ${progressionXpHeroV44(progress)}

    ${
      progress.rpg_class
        ? classProfileHtml(
            progress,
            athlete,
            inventory,
            collectionState
          )
        : classChoiceHtml(
            canEdit
          )
    }


    <section class="rpg-section">
      <div class="rpg-section-title">
        Aventure
      </div>

      <div class="rpg-adventure">
        <div>
          <span>Difficulté</span>
          <b>${format(progress.adventure_difficulty, 0)}</b>
        </div>

        <div>
          <span>Accès boss</span>
          <b>${format(progress.kills_toward_boss, 0)}/50</b>
        </div>

        <div>
          <span>Coffres Ultra raid</span>
          <b>${format(progress.raid_ultra_cases, 0)}</b>
        </div>
      </div>
    </section>
  `
}

function placeholderHtml(
  icon,
  title,
  text
) {
  return `
    <section class="rpg-placeholder">
      <div>
        ${icon}
      </div>

      <h2>
        ${esc(title)}
      </h2>

      <p>
        ${esc(text)}
      </p>
    </section>
  `
}

export async function mountRpg(
  root,
  options = {}
) {
  installRpgAudioControls()
  installRpgBestiarySpriteEnhancer(root)
  const combatState =
    createRpgCombatState()

  const forgeState =
    createRpgForgeState()

  const healthState =
    createRpgHealthState()


  document.addEventListener(
    'pointerdown',
    () => {
      void playRpgMenuMusic()
    },
    {
      once: true,
    }
  )

  const athletes =
    Array.isArray(
      options.athletes
    )
      ? options.athletes
      : []

  let selectedSlug =
    String(
      options.initialSlug ||
      ''
    )

  let progress = null
  let inventory = []
  let uiNotice = null

  function setUiNotice(message, tone = 'error') {
    const text = String(message || '').trim()
    uiNotice = text
      ? { message: text, tone: tone === 'info' ? 'info' : tone === 'success' ? 'success' : 'error' }
      : null
  }

  function renderUiNotice() {
    if (!uiNotice) return ''

    return `
      <div class="rpg-ui-notice-v37 ${esc(uiNotice.tone)}" role="status">
        <span>${uiNotice.tone === 'success' ? '✓' : uiNotice.tone === 'info' ? 'ℹ️' : '⚠️'}</span>
        <strong>${esc(uiNotice.message)}</strong>
        <button type="button" data-rpg-notice-close aria-label="Fermer">×</button>
      </div>
    `
  }

  function applyActionNotice(result) {
    const notice = result?.notice

    if (!notice?.message) {
      return
    }

    setUiNotice(
      notice.message,
      notice.tone || 'info'
    )
  }

  const RPG_TABS = new Set([
    'progression',
    'equipment',
    'cases',
    'collection',
    'leaderboard',
  ])

  function tabStorageKey(slug = selectedSlug) {
    return `ga-rpg-active-tab-v2:${String(slug || 'global')}`
  }

  function savedTab(slug = selectedSlug) {
    try {
      const value =
        localStorage.getItem(
          tabStorageKey(slug)
        )

      return RPG_TABS.has(value)
        ? value
        : 'progression'
    } catch {
      return 'progression'
    }
  }

  function saveTab(value) {
    if (!RPG_TABS.has(value)) {
      return
    }

    try {
      localStorage.setItem(
        tabStorageKey(),
        value
      )
    } catch {
      // Storage may be unavailable in private contexts.
    }
  }

  let activeTab =
    savedTab(selectedSlug)

  function revealActiveRpgTab({
    smooth = false,
  } = {}) {
    requestAnimationFrame(() => {
      const tabs =
        root.querySelector(
          '.rpg-tabs'
        )

      const active =
        tabs?.querySelector(
          'button.active'
        )

      if (!tabs || !active) {
        return
      }

      const left =
        active.offsetLeft -
        Math.max(
          0,
          (
            tabs.clientWidth -
            active.offsetWidth
          ) / 2
        )

      tabs.scrollTo({
        left:
          Math.max(0, left),
        behavior:
          smooth
            ? 'smooth'
            : 'auto',
      })
    })
  }

  const caseState = createRpgCaseState()
  const collectionState = createRpgCollectionState()

  /* RPG 6F RAID + LEADERBOARD V2 */
  const raidState =
    createRpgRaidState()

  const leaderboardState =
    createRpgLeaderboardState()

  function selectedAthlete() {
    return athletes.find(
      (athlete) =>
        athleteSlug(athlete) ===
        selectedSlug
    )
  }

  function canEdit() {
    return Boolean(
      options.canEditAthlete?.(
        selectedSlug
      )
    )
  }

  function renderSelector() {
    root.innerHTML = `
      <main class="rpg-page">
        <header class="rpg-topbar">
          <button
            type="button"
            class="back-button"
            data-rpg-back
          >
            ← Accueil
          </button>

          <div>
            <span>
              L'ARAIGNÉE COACHING
            </span>

            <h1>
              RPG
            </h1>
          </div>
        </header>

        <section class="rpg-section">
          <div class="rpg-section-title">
            Choisir un athlète
          </div>

          <div class="rpg-athlete-grid">
            ${athletes
              .map((athlete) => `
                <button
                  type="button"
                  data-rpg-athlete="${esc(
                    athleteSlug(
                      athlete
                    )
                  )}"
                >
                  <div class="rpg-athlete-avatar">
                    ${athleteAvatar(athlete)
                      ? `
                        <img
                          src="${esc(
                            athleteAvatar(
                              athlete
                            )
                          )}"
                          alt=""
                          loading="lazy"
                        >
                      `
                      : `
                        <span>
                          ${esc(
                            athlete.emoji ||
                            '???'
                          )}
                        </span>
                      `
                    }
                  </div>

                  <strong>
                    ${esc(
                      athlete.name ||
                      athlete.id
                    )}
                  </strong>

                  <span>
                    Ouvrir le profil RPG
                  </span>
                </button>
              `)
              .join('')}
          </div>
        </section>
      </main>
    `
  }

  function renderProfile() {
    const athlete =
      selectedAthlete()

    const name =
      athlete?.name ||
      selectedSlug

    let content = ''

    if (
      activeTab ===
      'progression'
    ) {
      content = `
        ${progressionHtml(
          progress,
          canEdit(),
          inventory,
          collectionState,
          athlete
        )}

        ${renderRpgHealth({
          state:
            healthState,
          canEdit:
            canEdit(),
        })}

        ${renderRpgCombatLauncher({
          athleteSlug:
            selectedSlug,

          progress,

          inventory,

          canEdit:
            canEdit(),

          state:
            combatState,
        })}

        ${renderRpgRaid({
          progress,
          canEdit:
            canEdit(),
          state:
            raidState,
        })}
      `
    }

    if (
      activeTab ===
      'equipment'
    ) {
      /* FORGE EQUIPMENT UI V2 */

      content = `
        ${renderRpgForge({
          athleteSlug:
            selectedSlug,

          progress,

          inventory,

          canEdit:
            canEdit(),

          state:
            forgeState,
        })}

        ${renderRpgEquipment({
          progress,
          inventory,
          itemCollection:
            collectionState.itemCollection,

          canEdit:
            canEdit(),
        })}
      `
    }

    if (
      activeTab ===
      'cases'
    ) {
      content =
        renderRpgCases({
          athleteSlug:
            selectedSlug,

          progress,
          inventory,

          canEdit:
            canEdit(),

          state:
            caseState,
          mobilityDropBoost:
            Boolean(healthState.mobilityCompleted),
        })
    }

    if (
      activeTab ===
      'collection'
    ) {
      content =
        renderRpgCollection({
          progress,
          inventory,

          canEdit:
            canEdit(),

          state:
            collectionState,
        })
    }

    if (
      activeTab ===
      'leaderboard'
    ) {
      content =
        renderRpgLeaderboard({
          state:
            leaderboardState,
          selectedSlug,
        })
    }

    if (!content.trim()) {
      content = `
        <section class="rpg-empty-production-v45">
          <div aria-hidden="true">🕸️</div>
          <strong>Cette section n’est pas disponible.</strong>
          <small>Retourne sur Progression puis réessaie.</small>
          <button type="button" data-rpg-tab="progression">← Progression</button>
        </section>
      `
    }

    root.innerHTML = `
      <main class="rpg-page">
        <header class="rpg-topbar">
          <button
            type="button"
            class="back-button"
            data-rpg-back
          >
            ← Accueil
          </button>

          <div>
            <span>
              L'ARAIGNÉE COACHING · RPG
            </span>

            <h1>
              ${esc(name)}
            </h1>
          </div>

          ${
            options.allowAthleteSelection
              ? `
                <button
                  type="button"
                  class="rpg-switch"
                  data-rpg-switch
                >
                  Changer
                </button>
              `
              : ''
          }
        </header>

        <nav class="rpg-tabs" aria-label="Navigation RPG">
          <button
            type="button"
            role="tab"
            aria-selected="${activeTab === 'progression' ? 'true' : 'false'}"
            data-rpg-tab="progression"
            class="${
              activeTab ===
              'progression'
                ? 'active'
                : ''
            }"
          >
            ⚡ Progression
            <span class="rpg-daily-tab-v48 ${healthState.mobilityCompleted ? 'done' : ''}">${healthState.mobilityCompleted ? '✓ DAILY' : 'DAILY'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected="${activeTab === 'equipment' ? 'true' : 'false'}"
            data-rpg-tab="equipment"
            class="${
              activeTab ===
              'equipment'
                ? 'active'
                : ''
            }"
          >
            🛡️ Équipement
          </button>

          <button
            type="button"
            role="tab"
            aria-selected="${activeTab === 'cases' ? 'true' : 'false'}"
            data-rpg-tab="cases"
            class="${
              activeTab ===
              'cases'
                ? 'active'
                : ''
            }"
          >
            📦 Coffres
          </button>

          <button
            type="button"
            role="tab"
            aria-selected="${activeTab === 'collection' ? 'true' : 'false'}"
            data-rpg-tab="collection"
            class="${
              activeTab ===
              'collection'
                ? 'active'
                : ''
            }"
          >
            👾 Collection
          </button>

          <button
            type="button"
            role="tab"
            aria-selected="${activeTab === 'leaderboard' ? 'true' : 'false'}"
            data-rpg-tab="leaderboard"
            class="${
              activeTab ===
              'leaderboard'
                ? 'active'
                : ''
            }"
          >
            🏆 Classement
          </button>
        </nav>

        ${renderUiNotice()}

        <div class="rpg-content" data-rpg-content>
          ${content}
        </div>
      </main>
    `

    revealActiveRpgTab()
  }

  async function loadSelected() {
    if (!selectedSlug) {
      renderSelector()
      return
    }

    root.innerHTML = `
      <main class="rpg-page">
        <section class="rpg-loading-v45" aria-live="polite" aria-label="Chargement du RPG">
          <div class="rpg-loading-head-v45">
            <span class="rpg-loading-spinner-v45" aria-hidden="true"></span>
            <div>
              <strong>Chargement de ta progression</strong>
              <small>Synchronisation du profil RPG…</small>
            </div>
          </div>

          <div class="rpg-loading-hero-v45">
            <i></i>
            <i></i>
            <i></i>
          </div>

          <div class="rpg-loading-grid-v45">
            ${Array.from({ length: 6 }, () => `
              <div class="rpg-loading-card-v45">
                <i></i>
                <i></i>
                <i></i>
              </div>
            `).join('')}
          </div>
        </section>
      </main>
    `

    try {
      const [
        nextProgress,
        nextInventory,
      ] =
        await Promise.all([
          fetchProgress(
            selectedSlug
          ),
          loadRpgInventory(
            selectedSlug
          ),
        ])

      progress =
        nextProgress

      inventory =
        nextInventory

      await Promise.all([
        loadRpgCollections(
          selectedSlug,
          collectionState,
          inventory
        ),

        loadRpgRaidState({
          athleteSlug:
            selectedSlug,
          state:
            raidState,
        }),

        loadRpgHealth({
          athleteSlug:
            selectedSlug,
          state:
            healthState,
        }),
      ])

      renderProfile()
    } catch (error) {
      console.error(
        'RPG LOAD ERROR',
        error
      )

      root.innerHTML = `
        <main class="rpg-page">
          <button
            class="back-button"
            data-rpg-back
          >
            ← Accueil
          </button>

          <div class="rpg-error rpg-error-v37 rpg-error-production-v45">
            <div class="rpg-error-icon-v45" aria-hidden="true">⚠️</div>
            <strong>La progression n’a pas pu être chargée.</strong>
            <small>
              Vérifie ta connexion puis réessaie. Aucune donnée locale n’a été supprimée.
            </small>
            <button type="button" data-rpg-retry>↻ Réessayer</button>
          </div>
        </main>
      `
    }
  }

  root.onchange =
    async (event) => {

      /* CASINO BET CHANGE V2 */

      const casinoBetInput =
        event.target.closest(
          '[data-rpg-casino-bet-v2]'
        )

      if (
        casinoBetInput &&
        selectedSlug
      ) {
        setRpgCasinoBet({
          athleteSlug:
            selectedSlug,

          state:
            forgeState,

          value:
            casinoBetInput.value,
        })

        renderProfile()
        return
      }


      /* COMBAT DIFFICULTY HANDLER V2 */

      const combatDifficulty =
        event.target.closest(
          '[data-rpg-combat-difficulty-v2]'
        )

      if (
        combatDifficulty &&
        selectedSlug &&
        progress
      ) {
        setRpgCombatDifficulty(
          combatState,
          selectedSlug,
          combatDifficulty.value,
          progress
        )

        renderProfile()
        return
      }

      const equipmentUiControl = event.target.closest('[data-rpg-equipment-sort], [data-rpg-equipment-rarity], [data-rpg-equipment-sort-value], [data-rpg-equipment-rarity-value]')

      if (equipmentUiControl && updateRpgEquipmentUi(equipmentUiControl)) {
        renderProfile()
        return
      }

      const collectionFilter =
        event.target.closest(
          '[data-rpg-collection-filter]'
        )

      if (collectionFilter) {
        updateRpgCollectionFilter(
          collectionState,
          collectionFilter
        )

        renderProfile()
        return
      }

      const levelInput =
        event.target.closest(
          '[data-rpg-case-level-input]'
        )

      if (
        !levelInput ||
        !selectedSlug
      ) {
        return
      }

      setRpgCaseLevel({
        athleteSlug:
          selectedSlug,

        progress,

        state:
          caseState,

        level:
          levelInput.value,
      })

      renderProfile()

      await loadRpgCasePrices({
        athleteSlug:
          selectedSlug,

        progress,

        state:
          caseState,
      })

      renderProfile()
    }

  root.onclick =
    async (event) => {

      if (event.target.closest('[data-rpg-notice-close]')) {
        setUiNotice('')
        renderProfile()
        return
      }

      if (event.target.closest('[data-rpg-retry]')) {
        setUiNotice('')
        await loadSelected()
        return
      }

      const healthActionV47 =
        event.target.closest(
          '[data-rpg-health-sync-v47], [data-rpg-mobility-set-v47], [data-rpg-mobility-validate-v47]'
        )

      if (
        healthActionV47 &&
        selectedSlug
      ) {
        const handled =
          await handleRpgHealthAction({
            element:
              healthActionV47,
            athleteSlug:
              selectedSlug,
            state:
              healthState,
            canEdit:
              canEdit(),
          })

        if (handled) {
          renderProfile()
          return
        }
      }

      const equipmentUiButton =
        event.target.closest(
          '[data-rpg-equipment-sort-value], [data-rpg-equipment-rarity-value]'
        )

      if (
        equipmentUiButton &&
        updateRpgEquipmentUi(
          equipmentUiButton
        )
      ) {
        renderProfile()
        return
      }

      /* RPG 6F CLICK HANDLERS V2 */

      const leaderboardTabV2 =
        event.target.closest(
          '[data-rpg-tab="leaderboard"]'
        )

      if (
        leaderboardTabV2 &&
        !leaderboardState.rows.length &&
        !leaderboardState.busy
      ) {
        void loadRpgLeaderboard({
          state:
            leaderboardState,
        }).then(() => {
          if (
            activeTab ===
            'leaderboard'
          ) {
            renderProfile()
          }
        })
      }

      const leaderboardActionV2 =
        event.target.closest(
          '[data-rpg-leaderboard-refresh-v2], [data-rpg-leaderboard-sort-v2]'
        )

      if (leaderboardActionV2) {
        try {
          await handleRpgLeaderboardAction({
            element:
              leaderboardActionV2,
            state:
              leaderboardState,
          })
        } catch (error) {
          console.error(
            'RPG LEADERBOARD ACTION ERROR',
            error
          )
        }

        renderProfile()
        return
      }

      const raidActionV2 =
        event.target.closest(
          '[data-rpg-raid-refresh-v2], [data-rpg-raid-join-v2], [data-rpg-raid-start-v2]'
        )

      if (
        raidActionV2 &&
        selectedSlug &&
        progress
      ) {
        try {
          const result =
            await handleRpgRaidAction({
              element:
                raidActionV2,
              athleteSlug:
                selectedSlug,
              state:
                raidState,
              canEdit:
                canEdit(),
            })

          if (
            result?.startFight
          ) {
            const athlete =
              selectedAthlete()

            await startRpgRaidFight({
              athleteSlug:
                selectedSlug,
              athleteName:
                athlete?.name ||
                selectedSlug,
              athleteEmoji:
                athlete?.emoji ||
                '🏋️',
              state:
                raidState,
              onFinished:
                async () => {
                  const [
                    nextProgress,
                    nextInventory,
                  ] =
                    await Promise.all([
                      fetchProgress(
                        selectedSlug
                      ),
                      loadRpgInventory(
                        selectedSlug
                      ),
                    ])

                  progress =
                    nextProgress

                  inventory =
                    nextInventory

                  await Promise.all([
                    loadRpgRaidState({
                      athleteSlug:
                        selectedSlug,
                      state:
                        raidState,
                    }),
                    loadRpgCollections(
                      selectedSlug,
                      collectionState,
                      inventory
                    ),
                  ])

                  renderProfile()
                },
            })

            return
          }

          if (
            result?.handled ||
            result?.refresh ||
            result?.joined
          ) {
            progress =
              await fetchProgress(
                selectedSlug
              )

            renderProfile()
            return
          }
        } catch (error) {
          console.error(
            'RPG RAID ACTION ERROR',
            error
          )

          setUiNotice(
            error?.message ||
            'Action Raid impossible.'
          )

          renderProfile()
          return
        }
      }

      /* FORGE CLICK HANDLER V2 */

      const forgeTarget =
        event.target.closest(
          '[data-rpg-dwarf-mode-v2], [data-rpg-forge-v2], [data-rpg-casino-preset-v2], [data-rpg-casino-spin-v2]'
        )

      if (
        forgeTarget &&
        selectedSlug &&
        progress
      ) {
        try {
          const result =
            await handleRpgForgeAction({
              target:
                forgeTarget,

              athleteSlug:
                selectedSlug,

              state:
                forgeState,

              canEdit:
                canEdit(),
            })

          if (
            result?.refresh
          ) {
            const [
              nextProgress,
              nextInventory,
            ] =
              await Promise.all([
                fetchProgress(
                  selectedSlug
                ),

                loadRpgInventory(
                  selectedSlug
                ),
              ])

            progress =
              nextProgress

            inventory =
              nextInventory

            await loadRpgCollections(
              selectedSlug,
              collectionState,
              inventory
            )
          }

          if (
            result?.handled
          ) {
            renderProfile()
            return
          }
        } catch (error) {
          console.error(
            'RPG FORGE ERROR',
            error
          )

          setUiNotice(
            error?.message ||
            'Erreur du Nain Forgeron.'
          )

          renderProfile()
          return
        }
      }


      /* COMBAT CLICK HANDLER V2 */

      const combatStartButton =
        event.target.closest(
          '[data-rpg-combat-start-v2]'
        )

      const bossStartButton =
        event.target.closest(
          '[data-rpg-boss-start-v2]'
        )

      if (
        combatStartButton ||
        bossStartButton
      ) {
        if (
          !selectedSlug ||
          !progress ||
          !canEdit()
        ) {
          return
        }

        const isBoss =
          !!bossStartButton

        try {
          await startRpgCombat({
            athleteSlug:
              selectedSlug,

            progress,

            state:
              combatState,

            isBoss,

            onFinished:
              async () => {
                const [
                  nextProgress,
                  nextInventory,
                ] =
                  await Promise.all([
                    fetchProgress(
                      selectedSlug
                    ),

                    loadRpgInventory(
                      selectedSlug
                    ),
                  ])

                progress =
                  nextProgress

                inventory =
                  nextInventory

                await loadRpgCollections(
                  selectedSlug,
                  collectionState,
                  inventory
                )

                renderProfile()
              },
          })
        } catch (error) {
          console.error(
            'RPG COMBAT START ERROR',
            error
          )

          setUiNotice(
            error?.message ||
            'Impossible de lancer le combat.'
          )
          renderProfile()
        }

        return
      }

      if (
        event.target.closest(
          '[data-rpg-back]'
        )
      ) {
        root.onclick = null
        options.onBack?.()
        return
      }

      if (
        event.target.closest(
          '[data-rpg-switch]'
        )
      ) {
        selectedSlug = ''
        progress = null
        renderSelector()
        return
      }

      const athleteButton =
        event.target.closest(
          '[data-rpg-athlete]'
        )

      if (athleteButton) {
        selectedSlug =
          athleteButton.dataset
            .rpgAthlete

        activeTab =
          savedTab(selectedSlug)

        combatState.selectedDifficulty =
          null

        await loadSelected()
        return
      }

      const equipmentAction =
        event.target.closest(
          '[data-rpg-upgrade], [data-rpg-equip], [data-rpg-sell], [data-rpg-lock], [data-rpg-deposit], [data-rpg-deposit-all], [data-rpg-sell-all]'
        )

      if (equipmentAction) {
        try {
          const result =
            await handleRpgEquipmentAction({
              element:
                equipmentAction,

              athleteSlug:
                selectedSlug,

              inventory,
              itemCollection:
                collectionState.itemCollection,

              canEdit:
                canEdit(),
            })

          applyActionNotice(result)

          if (
            result?.refresh
          ) {
            await loadSelected()
          } else if (result?.notice) {
            renderProfile()
          }
        } catch (error) {
          console.error('RPG EQUIPMENT ACTION ERROR', error)
          setUiNotice(error?.message || 'Action équipement impossible.')
          renderProfile()
        }

        return
      }

      const caseAction =
        event.target.closest(
          '[data-rpg-case-open], [data-rpg-raid-open]'
        )

      if (caseAction) {
        try {
          const result =
            await handleRpgCaseAction({
              element:
                caseAction,

              athleteSlug:
                selectedSlug,

              progress,

              canEdit:
                canEdit(),

              state:
                caseState,
            })

          if (
            result?.refresh
          ) {
            await loadSelected()
          } else {
            renderProfile()
          }
        } catch (error) {
          console.error('RPG CASE ACTION ERROR', error)
          setUiNotice(error?.message || 'Ouverture de coffre impossible.')
          renderProfile()
        }

        return
      }

      const collectionAction =
        event.target.closest(
          '[data-rpg-collection-tab], [data-rpg-deposit-item], [data-rpg-deposit-all]'
        )

      if (collectionAction) {
        try {
          const result =
            await handleRpgCollectionAction({
              element:
                collectionAction,

              athleteSlug:
                selectedSlug,

              inventory,

              canEdit:
                canEdit(),

              state:
                collectionState,
            })

          applyActionNotice(result)

          if (
            result?.refresh
          ) {
            await loadSelected()
          } else {
            renderProfile()
          }
        } catch (error) {
          console.error('RPG COLLECTION ACTION ERROR', error)
          setUiNotice(error?.message || 'Action collection impossible.')
          renderProfile()
        }

        return
      }

      const tab =
        event.target.closest(
          '[data-rpg-tab]'
        )

      if (tab) {
        const nextTab =
          tab.dataset.rpgTab

        if (!RPG_TABS.has(nextTab)) {
          return
        }

        const pageY =
          window.scrollY

        activeTab =
          nextTab

        saveTab(activeTab)

        /* LOAD CASINO ON EQUIPMENT TAB V2 */

        if (
          activeTab ===
            'equipment' &&
          forgeState.mode ===
            'casino' &&
          selectedSlug
        ) {
          await loadRpgCasinoState({
            athleteSlug:
              selectedSlug,

            state:
              forgeState,
          })
        }

        if (
          activeTab ===
          'cases'
        ) {
          await loadRpgCasePrices({
            athleteSlug:
              selectedSlug,

            progress,

            state:
              caseState,
          })
        }

        renderProfile()

        requestAnimationFrame(() => {
          window.scrollTo({
            top: pageY,
            behavior: 'auto',
          })

          revealActiveRpgTab({
            smooth: true,
          })
        })

        return
      }

      const classButton =
        event.target.closest(
          '[data-rpg-class]'
        )

      if (
        classButton &&
        canEdit() &&
        !progress?.rpg_class
      ) {
        const classKey =
          classButton.dataset
            .rpgClass

        const def =
          CLASS_DEFS[
            classKey
          ]

        if (!def) {
          return
        }

        const confirmed =
          window.confirm(
            `Choisir ${def.title} (${def.subtitle}) ? Ce choix est permanent et définitif.`
          )

        if (!confirmed) {
          return
        }

        classButton.disabled = true

        const {
          error,
        } =
          await supabase.rpc(
            'choose_athlete_class',
            {
              p_athlete_slug:
                selectedSlug,
              p_class:
                classKey,
            }
          )

        if (error) {
          classButton.disabled =
            false

          setUiNotice(
            `Choix impossible : ${error.message}`,
            'error'
          )
          renderProfile()

          return
        }

        await loadSelected()
      }
    }

  await loadSelected()
}
