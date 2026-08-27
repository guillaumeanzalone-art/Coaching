import { supabase } from './supabase.js'

const CASE_COUNTS = [1, 10, 100, 500]
const CASE_RARITY_RANK = { normal:0, common:1, uncommon:2, rare:3, epic:4, legendary:5, mythic:6, ultra_mythic:7, abyssal:8 }
const CASE_BATCH_SIZE = 100

const CASE_TYPES = [
  {
    key: 'global',
    icon: '🎁',
    title: 'Caisse globale',
    note: 'Arme, armure ou relique. Prix standard.',
  },
  {
    key: 'weapon',
    icon: '🗡️',
    title: 'Caisse Arme',
    note: 'Contient uniquement une arme. Prix ×2.',
  },
  {
    key: 'armor',
    icon: '🛡️',
    title: 'Caisse Armure',
    note: 'Contient uniquement une armure. Prix ×2.',
  },
  {
    key: 'relic',
    icon: '💎',
    title: 'Caisse Relique',
    note: 'Contient uniquement une relique. Prix ×2.',
  },
]

const RARITIES = {
  normal: {
    icon: '⚪',
    label: 'Simple',
  },
  common: {
    icon: '🟢',
    label: 'Commun',
  },
  uncommon: {
    icon: '🔵',
    label: 'Peu commun',
  },
  rare: {
    icon: '🟣',
    label: 'Rare',
  },
  epic: {
    icon: '🟠',
    label: 'Épique',
  },
  legendary: {
    icon: '🟡',
    label: 'Légendaire',
  },
  mythic: {
    icon: '🔴',
    label: 'Mythique',
  },
  ultra_mythic: {
    icon: '🌟',
    label: 'Ultra mythique',
  },
  abyssal: {
    icon: '🫧',
    label: 'Abyssal',
  },
}

const SLOT_ICONS = {
  weapon: '🗡️',
  armor: '🛡️',
  relic: '💎',
}

function n(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits: digits,
    }
  ).format(n(value))
}

function maxItemLevel(progress) {
  const difficulty =
    Math.max(
      1,
      Math.floor(
        n(
          progress?.adventure_difficulty,
          1
        )
      )
    )

  return Math.min(
    1000,
    Math.max(
      1,
      Math.ceil(
        difficulty / 10
      )
    )
  )
}

function caseDifficultyForLevel(level) {
  const safe =
    Math.min(
      1000,
      Math.max(
        1,
        Math.floor(
          n(level, 1)
        )
      )
    )

  return Math.min(
    10000,
    Math.max(
      1,
      (safe - 1) * 10 + 1
    )
  )
}

function priceKey(level, type) {
  return `${level}:${type}`
}

function ensureState(
  state,
  athleteSlug,
  progress
) {
  const maxLevel =
    maxItemLevel(progress)

  if (
    state.athleteSlug !==
    athleteSlug
  ) {
    state.athleteSlug =
      athleteSlug

    state.prices = {}

    const saved =
      Number(
        localStorage.getItem(
          `rpg-case-level-v2:${athleteSlug}`
        )
      )

    state.selectedLevel =
      Number.isFinite(saved) &&
      saved >= 1
        ? saved
        : maxLevel
  }

  state.selectedLevel =
    Math.min(
      maxLevel,
      Math.max(
        1,
        Math.floor(
          n(
            state.selectedLevel,
            maxLevel
          )
        )
      )
    )

  return maxLevel
}

function extractPrice(data) {
  let raw =
    Array.isArray(data)
      ? data[0]
      : data

  if (
    raw &&
    typeof raw === 'object'
  ) {
    raw =
      raw.rpg_case_price_v20 ??
      raw.case_price ??
      raw.price ??
      Object.values(raw)[0]
  }

  const value =
    Number(raw)

  return Number.isFinite(value) &&
    value > 0
    ? Math.floor(value)
    : null
}

function normalizeItem(row = {}) {
  return {
    ...row,

    item_id:
      row.item_id ??
      row.id ??
      '',

    item_name:
      row.item_name ??
      row.name ??
      'Objet mystère',

    item_rarity:
      row.item_rarity ??
      row.rarity ??
      'normal',

    item_slot:
      row.item_slot ??
      row.slot ??
      'relic',

    item_level:
      row.item_level ??
      row.awarded_item_level ??
      row.required_level ??
      1,

    power_bonus:
      row.power_bonus ??
      row.awarded_power_bonus ??
      0,

    mastery_bonus:
      row.mastery_bonus ??
      row.awarded_mastery_bonus ??
      0,

    fortune_bonus:
      row.fortune_bonus ??
      row.awarded_fortune_bonus ??
      0,

    damage_bonus_pct:
      row.damage_bonus_pct ??
      row.awarded_damage_bonus_pct ??
      0,
  }
}

function splitBatches(count) {
  const batches = []

  let remaining =
    Math.max(
      1,
      Math.floor(
        n(count, 1)
      )
    )

  while (remaining > 0) {
    const amount =
      Math.min(
        CASE_BATCH_SIZE,
        remaining
      )

    batches.push(amount)
    remaining -= amount
  }

  return batches
}

function caseLuckStrength(
  progress,
  inventory
) {
  const equipped =
    (inventory || [])
      .filter(
        item =>
          item.equipped
      )

  const masteryGear =
    equipped.reduce(
      (sum, item) =>
        sum +
        n(
          item.scaled_mastery_bonus,
          n(
            item.mastery_bonus
          )
        ),
      0
    )

  const chance =
    Math.max(
      0,
      n(
        progress?.stat_mastery
      ) +
      masteryGear
    )

  const passive =
    equipped.reduce(
      (sum, item) => {
        if (
          item.passive_type ===
            'case_luck' ||
          item.passive_type ===
            'relic_luck'
        ) {
          return (
            sum +
            n(
              item.passive_value
            )
          )
        }

        return sum
      },
      0
    )

  return Math.min(
    0.02,
    Math.log1p(chance) / 500 +
      passive / 500
  )
}

function normalCaseOdds(
  progress,
  inventory
) {
  const luck =
    caseLuckStrength(
      progress,
      inventory
    )

  const weights = {
    normal: 48.889,

    common: 25,

    uncommon:
      15 *
      (
        1 +
        luck * 0.25
      ),

    rare:
      7 *
      (
        1 +
        luck * 0.60
      ),

    epic:
      3 *
      (
        1 +
        luck
      ),

    legendary:
      1 *
      (
        1 +
        luck * 1.40
      ),

    mythic:
      0.1 *
      (
        1 +
        luck * 1.80
      ),

    ultra_mythic:
      0.01 *
      (
        1 +
        luck * 2.20
      ),

    abyssal:
      0.001 *
      (
        1 +
        luck * 2.80
      ),
  }

  const total =
    Object.values(weights)
      .reduce(
        (sum, value) =>
          sum + value,
        0
      )

  return Object.fromEntries(
    Object.entries(weights)
      .map(
        ([key, value]) => [
          key,
          value / total * 100,
        ]
      )
  )
}

function aggregateItems(items) {
  const result =
    new Map()

  for (const item of items) {
    const key =
      item.item_id ||
      [
        item.item_name,
        item.item_rarity,
        item.item_slot,
        item.item_level,
      ].join('|')

    const current =
      result.get(key)

    if (current) {
      current.count += 1
    } else {
      result.set(
        key,
        {
          ...item,
          count: 1,
        }
      )
    }
  }

  return [
    ...result.values(),
  ]
}

function resultStats(item) {
  const stats = []

  if (
    n(
      item.damage_bonus_pct
    ) > 0
  ) {
    stats.push(
      `Dégâts +${formatNumber(
        item.damage_bonus_pct,
        2
      )} %`
    )
  }

  if (
    n(
      item.power_bonus
    ) > 0
  ) {
    stats.push(
      `Force +${formatNumber(
        item.power_bonus,
        2
      )}`
    )
  }

  if (
    n(
      item.mastery_bonus
    ) > 0
  ) {
    stats.push(
      `Chance +${formatNumber(
        item.mastery_bonus,
        2
      )}`
    )
  }

  if (
    n(
      item.fortune_bonus
    ) > 0
  ) {
    stats.push(
      `Fortune +${formatNumber(
        item.fortune_bonus,
        2
      )}`
    )
  }

  return stats.length
    ? stats.join(' · ')
    : 'Objet RPG'
}

function caseShowcaseItem(items) {
  return [...items]
    .sort(
      (a, b) =>
        (CASE_RARITY_RANK[b.item_rarity] || 0) -
          (CASE_RARITY_RANK[a.item_rarity] || 0) ||
        n(b.item_level) - n(a.item_level) ||
        n(b.damage_bonus_pct) - n(a.damage_bonus_pct) ||
        n(b.power_bonus) - n(a.power_bonus) ||
        n(b.fortune_bonus) - n(a.fortune_bonus)
    )[0] || items[0]
}

function chestTileHtml(item, target = false) {
  const rarityKey =
    item?.item_rarity ||
    'normal'

  return `
    <div
      class="rpg-case-roll-item-v2 rarity-${rarityKey}${target ? ' target-tile' : ''}"
      aria-hidden="true"
    >
      <div class="rpg-case-chest-v2">
        <div class="rpg-case-chest-art-v2">
          <div class="rpg-case-chest-lid-v2"></div>
          <div class="rpg-case-chest-body-v2"></div>
          <div class="rpg-case-chest-band-v2"></div>
          <div class="rpg-case-chest-lock-v2">SBD</div>
        </div>
        <b>SBD</b>
      </div>
    </div>
  `
}

function sortedCaseResults(items) {
  return aggregateItems(items)
    .sort(
      (a, b) =>
        (CASE_RARITY_RANK[b.item_rarity] || 0) -
          (CASE_RARITY_RANK[a.item_rarity] || 0) ||
        n(b.item_level) - n(a.item_level) ||
        n(b.damage_bonus_pct) - n(a.damage_bonus_pct) ||
        n(b.power_bonus) - n(a.power_bonus) ||
        n(b.fortune_bonus) - n(a.fortune_bonus) ||
        b.count - a.count
    )
}

function rarityOpeningSummary(items) {
  const counts = new Map()

  for (const item of items) {
    const key =
      item.item_rarity ||
      'normal'

    counts.set(
      key,
      (counts.get(key) || 0) + 1
    )
  }

  return Object
    .entries(CASE_RARITY_RANK)
    .sort((a, b) => b[1] - a[1])
    .filter(([key]) => counts.has(key))
    .map(([key]) => {
      const rarity =
        RARITIES[key] ||
        RARITIES.normal

      return `${rarity.icon} ${rarity.label} ×${counts.get(key)}`
    })
    .join(' · ')
}

function caseResultRowHtml(item, podium = 0) {
  const rarity =
    RARITIES[
      item.item_rarity
    ] ||
    RARITIES.normal

  return `
    <div
      class="rpg-case-result-v2 rarity-${item.item_rarity}${podium ? ` podium-${podium}` : ''}"
    >
      ${podium
        ? `<span class="rpg-case-podium-v2">${['🥇', '🥈', '🥉'][podium - 1]}</span>`
        : `<span class="rpg-case-result-icon-v2">${SLOT_ICONS[item.item_slot] || '🎒'}</span>`
      }

      <div>
        <b>
          ${rarity.icon}
          ${item.item_name}
        </b>

        <small>
          ${rarity.label}
          · Niveau ${formatNumber(item.item_level)}
          · ${resultStats(item)}
        </small>
      </div>

      <strong>
        ×${item.count}
      </strong>
    </div>
  `
}

async function playOpeningAnimation(
  items,
  {
    count,
    raid = false,
    totalCost = 0,
  } = {}
) {
  if (!items.length) {
    return
  }

  document
    .querySelector(
      '[data-rpg-case-overlay]'
    )
    ?.remove()

  const showcase =
    caseShowcaseItem(items)

  const targetIndex = 38
  const totalTiles = 46

  const fillerRarities = raid
    ? [
        'rare',
        'epic',
        'legendary',
        'epic',
        'mythic',
        'rare',
        'legendary',
        'ultra_mythic',
      ]
    : [
        'normal',
        'common',
        'normal',
        'uncommon',
        'normal',
        'common',
        'rare',
        'normal',
        'epic',
        'common',
      ]

  const rollItems =
    Array.from(
      {
        length: totalTiles,
      },
      (_, index) => {
        if (index === targetIndex) {
          return showcase
        }

        return {
          item_rarity:
            fillerRarities[
              (index * 7 + count) %
              fillerRarities.length
            ],
        }
      }
    )

  const overlay =
    document.createElement(
      'div'
    )

  overlay.className =
    'rpg-case-overlay-v2'

  overlay.dataset.rpgCaseOverlay =
    '1'

  overlay.innerHTML = `
    <div class="rpg-case-opening-v2">
      <div data-rpg-case-animation>
        <div class="rpg-case-opening-title-v2">
          ${raid
            ? 'OUVERTURE DE COFFRES ULTRA'
            : 'OUVERTURE DE COFFRES SBD'
          }
        </div>

        <div class="rpg-case-opening-subtitle-v2">
          L'animation ne peut pas être passée.
        </div>

        <div class="rpg-case-roulette-v2">
          <div class="rpg-case-marker-v2"></div>

          <div
            class="rpg-case-roll-v2"
            data-rpg-case-roll
          >
            ${rollItems
              .map(
                (item, index) =>
                  chestTileHtml(
                    item,
                    index === targetIndex
                  )
              )
              .join('')}
          </div>
        </div>

        <div
          class="rpg-case-opening-status-v2"
          data-rpg-case-status
        >
          ${count} coffre${count > 1 ? 's' : ''}
          ${raid ? 'Ultra' : 'SBD'}
          en cours d'ouverture…
        </div>

        <div class="rpg-case-lock-note-v2">
          🔒 Ouverture sécurisée · aucun bouton Skip
        </div>
      </div>

      <div
        class="rpg-case-results-v2"
        data-rpg-case-results
        hidden
      ></div>
    </div>
  `

  document.body.appendChild(
    overlay
  )

  const track =
    overlay.querySelector(
      '[data-rpg-case-roll]'
    )

  const roulette =
    track?.parentElement

  const status =
    overlay.querySelector(
      '[data-rpg-case-status]'
    )

  /*
   * Force un vrai état initial rendu avant de lancer la translation.
   * Sans ces deux frames certains WebView/Chrome appliquent directement
   * la position finale et donnent l'impression qu'il n'y a pas de roll.
   */
  if (track) {
    track.style.transition =
      'none'

    track.style.transform =
      'translate3d(0,0,0)'

    void track.offsetWidth
  }

  await new Promise(
    resolve =>
      requestAnimationFrame(
        () =>
          requestAnimationFrame(
            resolve
          )
      )
  )

  if (track) {
    const targetTile =
      track.children[
        targetIndex
      ]

    const targetCenter =
      targetTile.offsetLeft +
      targetTile.offsetWidth / 2

    const viewportCenter =
      (roulette?.clientWidth || 380) /
      2

    const finalX =
      viewportCenter -
      targetCenter

    const duration = raid
      ? 3000 +
        Math.min(
          1800,
          count * 12
        )
      : 4300 +
        Math.min(
          4200,
          count * 35
        )

    track.style.transition =
      `transform ${duration}ms cubic-bezier(.06,.74,.12,1)`

    track.style.transform =
      `translate3d(${finalX}px,0,0)`

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          duration + 250
        )
    )
  }

  if (status) {
    const rarity =
      RARITIES[
        showcase.item_rarity
      ] ||
      RARITIES.normal

    status.innerHTML =
      `<strong>${rarity.icon} ${rarity.label}</strong> · coffre arrêté !`
  }

  if (
    navigator.vibrate &&
    [
      'legendary',
      'mythic',
      'ultra_mythic',
      'abyssal',
    ].includes(
      showcase.item_rarity
    )
  ) {
    navigator.vibrate(
      [120, 60, 180, 60, 260]
    )
  }

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        700
      )
  )

  const animation =
    overlay.querySelector(
      '[data-rpg-case-animation]'
    )

  const results =
    overlay.querySelector(
      '[data-rpg-case-results]'
    )

  if (animation) {
    animation.hidden = true
  }

  const aggregated =
    sortedCaseResults(items)

  const isMassOpening =
    count >= 10

  const displayed =
    isMassOpening
      ? aggregated.slice(0, 3)
      : aggregated

  if (results) {
    results.hidden = false

    results.innerHTML = `
      <h2>
        ${isMassOpening
          ? '🏆 TOP 3 DU BUTIN'
          : 'Butin obtenu'
        }
      </h2>

      <p>
        ${raid
          ? `${count} caisse${count > 1 ? 's' : ''} Ultra ouverte${count > 1 ? 's' : ''}.`
          : `${count} caisse${count > 1 ? 's' : ''} ouverte${count > 1 ? 's' : ''} · ${formatNumber(totalCost)} gold dépensé.`
        }
        ${isMassOpening
          ? '<br>Les 3 meilleurs objets sont affichés ci-dessous.'
          : ` ${aggregated.length} objet${aggregated.length > 1 ? 's' : ''} différent${aggregated.length > 1 ? 's' : ''}.`
        }
      </p>

      <div class="rpg-case-result-grid-v2${isMassOpening ? ' mass-opening' : ''}">
        ${displayed
          .map(
            (item, index) =>
              caseResultRowHtml(
                item,
                isMassOpening
                  ? index + 1
                  : 0
              )
          )
          .join('')}
      </div>

      <button
        type="button"
        class="rpg-case-close-v2"
        data-rpg-case-overlay-close
      >
        ${isMassOpening
          ? '← Retour au menu des coffres'
          : "Ranger dans l'inventaire"
        }
      </button>
    `
  }

  await new Promise(
    resolve => {
      const button =
        overlay.querySelector(
          '[data-rpg-case-overlay-close]'
        )

      if (!button) {
        resolve()
        return
      }

      button.addEventListener(
        'click',
        () => {
          overlay.remove()
          resolve()
        },
        {
          once: true,
        }
      )
    }
  )
}

export function createRpgCaseState() {
  return {
    athleteSlug: '',
    selectedLevel: null,
    prices: {},
    loading: false,
    opening: false,
    error: '',
  }
}

export function setRpgCaseLevel({
  athleteSlug,
  progress,
  state,
  level,
}) {
  ensureState(
    state,
    athleteSlug,
    progress
  )

  const maxLevel =
    maxItemLevel(progress)

  state.selectedLevel =
    Math.min(
      maxLevel,
      Math.max(
        1,
        Math.floor(
          n(level, 1)
        )
      )
    )

  localStorage.setItem(
    `rpg-case-level-v2:${athleteSlug}`,
    String(
      state.selectedLevel
    )
  )
}

export async function loadRpgCasePrices({
  athleteSlug,
  progress,
  state,
  force = false,
}) {
  if (
    !athleteSlug ||
    !progress
  ) {
    return false
  }

  ensureState(
    state,
    athleteSlug,
    progress
  )

  const level =
    state.selectedLevel

  const ready =
    CASE_TYPES.every(
      type =>
        Number.isFinite(
          Number(
            state.prices[
              priceKey(
                level,
                type.key
              )
            ]
          )
        ) &&
        Number(
          state.prices[
            priceKey(
              level,
              type.key
            )
          ]
        ) > 0
    )

  if (
    ready &&
    !force
  ) {
    return true
  }

  if (state.loading) {
    return false
  }

  state.loading = true
  state.error = ''

  const results =
    await Promise.all(
      CASE_TYPES.map(
        async type => {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              'rpg_case_price_v20',
              {
                p_athlete_slug:
                  athleteSlug,

                p_item_level:
                  level,

                p_case_type:
                  type.key,
              }
            )

          return {
            type:
              type.key,

            data,
            error,
          }
        }
      )
    )

  let success = true

  for (
    const result of results
  ) {
    if (result.error) {
      success = false

      console.warn(
        'Prix caisse indisponible :',
        result.type,
        result.error.message
      )

      continue
    }

    const price =
      extractPrice(
        result.data
      )

    if (price === null) {
      success = false
      continue
    }

    state.prices[
      priceKey(
        level,
        result.type
      )
    ] = price
  }

  state.loading = false

  if (!success) {
    state.error =
      'Certains prix serveur sont indisponibles.'
  }

  return success
}

export function renderRpgCases({
  athleteSlug,
  progress,
  inventory,
  canEdit,
  state,
  mobilityDropBoost = false,
}) {
  const maxLevel =
    ensureState(
      state,
      athleteSlug,
      progress
    )

  const level =
    state.selectedLevel

  const gold =
    n(
      progress?.gold_balance
    )

  const difficulty =
    caseDifficultyForLevel(
      level
    )

  const odds =
    normalCaseOdds(
      progress,
      inventory
    )

  const cards =
    CASE_TYPES.map(
      type => {
        const cost =
          Number(
            state.prices[
              priceKey(
                level,
                type.key
              )
            ]
          )

        const priceReady =
          Number.isFinite(cost) &&
          cost > 0

        return `
          <article class="rpg-case-type-v2">
            <div class="rpg-case-type-icon-v2">
              ${type.icon}
            </div>

            <b>
              ${type.title}
            </b>

            <small>
              ${type.note}
            </small>

            <div class="rpg-case-price-v2">
              ${
                priceReady
                  ? `${formatNumber(
                      cost
                    )} gold / caisse`
                  : '⏳ Prix serveur…'
              }
            </div>

            <div class="rpg-case-buy-grid-v2">
              ${CASE_COUNTS
                .map(count => {
                  const total =
                    priceReady
                      ? cost * count
                      : 0

                  const disabled =
                    !priceReady ||
                    !canEdit ||
                    state.opening ||
                    gold < total

                  return `
                    <button
                      type="button"
                      data-rpg-case-open="${type.key}"
                      data-rpg-case-count="${count}"
                      ${disabled
                        ? 'disabled'
                        : ''}
                    >
                      <strong>
                        ×${count}
                      </strong>

                      <span>
                        ${
                          priceReady
                            ? `${formatNumber(
                                total
                              )} 🪙`
                            : '—'
                        }
                      </span>
                    </button>
                  `
                })
                .join('')}
            </div>
          </article>
        `
      }
    )
    .join('')

  const raidBalance =
    Math.max(
      0,
      Math.floor(
        n(
          progress?.raid_ultra_cases
        )
      )
    )

  return `
    <div class="rpg-cases-v2">

      ${mobilityDropBoost ? `
        <div class="rpg-case-daily-boost-v48">
          <span>🧘 DAILY VALIDÉE</span>
          <strong>🎁 DROP ×2 ACTIF</strong>
          <small>Chaque coffre standard effectue 2 tirages réels pour le prix d’un jusqu’à minuit.</small>
        </div>
      ` : ''}

      <div class="rpg-case-wallet-v2">
        <div>
          <span>
            GOLD DISPONIBLE
          </span>

          <strong>
            🪙
            ${formatNumber(
              gold
            )}
          </strong>
        </div>

        <span>
          Caisses Ultra :
          ${raidBalance}
        </span>
      </div>

      ${
        state.error
          ? `
            <div class="rpg-case-error-v2">
              ${state.error}
            </div>
          `
          : ''
      }

      <section class="rpg-case-section-v2">
        <h3>
          Niveau de la caisse
        </h3>

        <div class="rpg-case-level-v2">
          <div>
            <b>
              Niveau d'objet
            </b>

            <strong>
              ${level}
            </strong>
          </div>

          <input
            type="range"
            min="1"
            max="${maxLevel}"
            value="${level}"
            step="1"
            data-rpg-case-level-input
          >

          <small>
            Niveau ${level}
            = paliers
            ${difficulty}
            à
            ${Math.min(
              10000,
              difficulty + 9
            )}.

            Ton palier actuel autorise
            jusqu'au niveau
            ${maxLevel}.
          </small>
        </div>

        <div class="rpg-case-types-v2">
          ${cards}
        </div>
      </section>

      <section class="rpg-case-section-v2">
        <h3>
          🌀 Caisses Ultra de raid
        </h3>

        <div class="rpg-raid-case-v2">
          <div class="rpg-raid-case-head-v2">
            <span>
              🌀🎁
            </span>

            <div>
              <b>
                Caisse Ultra
              </b>

              <small>
                Récompense des raids.
              </small>
            </div>

            <strong>
              ${raidBalance}
            </strong>
          </div>

          <div class="rpg-raid-rates-v2">
            <span>
              🫧 Abyssal 0,10 %
            </span>

            <span>
              🌟 Ultra 0,90 %
            </span>

            <span>
              🔴 Mythique 6 %
            </span>

            <span>
              🟡 Légendaire 22 %
            </span>

            <span>
              🟠 Épique 35 %
            </span>

            <span>
              🟣 Rare 36 %
            </span>
          </div>

          <div class="rpg-case-buy-grid-v2">
            ${CASE_COUNTS
              .map(count => `
                <button
                  type="button"
                  data-rpg-raid-open="${count}"
                  ${
                    !canEdit ||
                    state.opening ||
                    raidBalance < count
                      ? 'disabled'
                      : ''
                  }
                >
                  <strong>
                    ×${count}
                  </strong>

                  <span>
                    GRATUIT
                  </span>
                </button>
              `)
              .join('')}
          </div>
        </div>
      </section>

      <section class="rpg-case-section-v2">
        <h3>
          Probabilités
        </h3>

        <div class="rpg-case-odds-v2">
          ${Object
            .entries(RARITIES)
            .map(
              ([key, rarity]) => {
                const value =
                  odds[key] || 0

                const digits =
                  value < 0.01
                    ? 5
                    : value < 1
                      ? 3
                      : 2

                return `
                  <div class="rarity-${key}">
                    <b>
                      ${rarity.icon}
                      ${rarity.label}
                    </b>

                    <span>
                      ${formatNumber(
                        value,
                        digits
                      )}
                      %
                    </span>
                  </div>
                `
              }
            )
            .join('')}
        </div>

        <p class="rpg-case-note-v2">
          La Chance modifie légèrement les
          pondérations. Le résultat réel de
          chaque ouverture reste décidé et
          enregistré côté Supabase.
        </p>
      </section>

    </div>
  `
}

async function openStandardCases({
  element,
  athleteSlug,
  progress,
  state,
}) {
  const type =
    element.dataset.rpgCaseOpen

  const count =
    CASE_COUNTS.includes(
      Number(
        element.dataset.rpgCaseCount
      )
    )
      ? Number(
          element.dataset.rpgCaseCount
        )
      : 1

  await loadRpgCasePrices({
    athleteSlug,
    progress,
    state,
    force: true,
  })

  const level =
    state.selectedLevel

  const cost =
    Number(
      state.prices[
        priceKey(
          level,
          type
        )
      ]
    )

  if (
    !Number.isFinite(cost) ||
    cost <= 0
  ) {
    state.error =
      'Prix serveur indisponible.'

    return {
      refresh: false,
    }
  }

  const totalCost =
    cost * count

  if (
    n(
      progress?.gold_balance
    ) < totalCost
  ) {
    state.error =
      `Pas assez de gold : ${formatNumber(
        totalCost
      )} requis.`

    return {
      refresh: false,
    }
  }

  state.opening = true
  state.error = ''

  const items = []
  let opened = 0

  for (
    const batch of
      splitBatches(count)
  ) {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'open_rpg_cases_v248',
        {
          p_athlete_slug: athleteSlug,
          p_item_level: level,
          p_case_type: type,
          p_quantity: batch,
        }
      )

    if (error) {
      state.error =
        `Ouverture interrompue : ${error.message}`

      if (!items.length) {
        state.opening = false

        return {
          refresh: false,
        }
      }

      break
    }

    const payload = Array.isArray(data) ? data[0] : data
    const rawItems = payload?.items ?? payload
    const rows = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : []

    items.push(...rows.map(normalizeItem))

    opened += batch
  }

  if (!items.length) {
    state.opening = false

    return {
      refresh: false,
    }
  }

  await playOpeningAnimation(
    items,
    {
      count: opened,
      raid: false,
      totalCost:
        cost * opened,
    }
  )

  state.opening = false

  return {
    refresh: true,
  }
}

async function openRaidCases({
  element,
  athleteSlug,
  progress,
  state,
}) {
  const count =
    CASE_COUNTS.includes(
      Number(
        element.dataset.rpgRaidOpen
      )
    )
      ? Number(
          element.dataset.rpgRaidOpen
        )
      : 1

  if (
    n(
      progress?.raid_ultra_cases
    ) < count
  ) {
    state.error =
      'Pas assez de caisses Ultra.'

    return {
      refresh: false,
    }
  }

  state.opening = true
  state.error = ''

  const items = []
  let opened = 0

  for (
    const batch of
      splitBatches(count)
  ) {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'open_rpg_raid_cases',
        {
          p_athlete_slug:
            athleteSlug,

          p_quantity:
            batch,
        }
      )

    if (error) {
      state.error =
        `Ouverture Ultra interrompue : ${error.message}`

      if (!items.length) {
        state.opening = false

        return {
          refresh: false,
        }
      }

      break
    }

    const rows =
      Array.isArray(data)
        ? data
        : data
          ? [data]
          : []

    items.push(
      ...rows.map(
        normalizeItem
      )
    )

    opened += batch
  }

  if (!items.length) {
    state.opening = false

    return {
      refresh: false,
    }
  }

  await playOpeningAnimation(
    items,
    {
      count: opened,
      raid: true,
    }
  )

  state.opening = false

  return {
    refresh: true,
  }
}

export async function handleRpgCaseAction({
  element,
  athleteSlug,
  progress,
  canEdit,
  state,
}) {
  if (
    !element ||
    !athleteSlug ||
    !progress ||
    state.opening
  ) {
    return {
      refresh: false,
    }
  }

  if (!canEdit) {
    state.error =
      'Profil en lecture seule.'

    return {
      refresh: false,
    }
  }

  if (
    element.matches(
      '[data-rpg-case-open]'
    )
  ) {
    return openStandardCases({
      element,
      athleteSlug,
      progress,
      state,
    })
  }

  if (
    element.matches(
      '[data-rpg-raid-open]'
    )
  ) {
    return openRaidCases({
      element,
      athleteSlug,
      progress,
      state,
    })
  }

  return {
    refresh: false,
  }
}
