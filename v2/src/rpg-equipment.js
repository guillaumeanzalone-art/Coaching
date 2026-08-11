import { supabase } from './supabase.js'

export const RPG_SLOT_DEFS = {
  weapon: {
    label: 'Arme',
    icon: '🗡️',
  },
  armor: {
    label: 'Armure',
    icon: '🛡️',
  },
  relic: {
    label: 'Relique',
    icon: '💎',
  },
}

export const RPG_RARITY_DEFS = {
  normal: {
    label: 'Simple',
    icon: '⚪',
  },
  common: {
    label: 'Commun',
    icon: '🟢',
  },
  uncommon: {
    label: 'Peu commun',
    icon: '🔵',
  },
  rare: {
    label: 'Rare',
    icon: '🟣',
  },
  epic: {
    label: 'Épique',
    icon: '🟠',
  },
  legendary: {
    label: 'Légendaire',
    icon: '🟡',
  },
  mythic: {
    label: 'Mythique',
    icon: '🔴',
  },
  ultra_mythic: {
    label: 'Ultra méga mythique',
    icon: '🌟',
  },
  abyssal: {
    label: 'Abyssal',
    icon: '🫧',
  },
}

const CLASS_AFFINITY = {
  warrior: 'weapon',
  archer: 'armor',
  mage: 'relic',
}

function n(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback
  }

  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fr(value, digits = 1) {
  return n(value).toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        digits,
    }
  )
}

function upgradeCost(rank) {
  const safeRank =
    Math.max(
      0,
      Math.floor(
        n(rank)
      )
    )

  return (
    Math.ceil(
      (
        75 *
        Math.pow(
          1.15,
          safeRank
        )
      ) / 5
    ) * 5
  )
}

function itemValue(
  item,
  field,
  fallbackField
) {
  const scaled =
    n(
      item?.[field],
      NaN
    )

  if (
    Number.isFinite(scaled)
  ) {
    return scaled
  }

  return n(
    item?.[fallbackField]
  )
}

function itemStats(item) {
  return {
    power:
      itemValue(
        item,
        'scaled_power_bonus',
        'power_bonus'
      ),

    mastery:
      itemValue(
        item,
        'scaled_mastery_bonus',
        'mastery_bonus'
      ),

    fortune:
      itemValue(
        item,
        'scaled_fortune_bonus',
        'fortune_bonus'
      ),

    damage:
      n(
        item?.damage_bonus_pct
      ),
  }
}

function itemStatsText(item) {
  const stats =
    itemStats(item)

  const values = []

  if (stats.power) {
    values.push(
      `Force +${fr(
        stats.power,
        1
      )}`
    )
  }

  if (stats.mastery) {
    values.push(
      `Chance +${fr(
        stats.mastery,
        1
      )}`
    )
  }

  if (stats.fortune) {
    values.push(
      `Fortune +${fr(
        stats.fortune,
        1
      )}`
    )
  }

  if (stats.damage) {
    values.push(
      `Dégâts +${fr(
        stats.damage,
        2
      )} %`
    )
  }

  if (
    item?.passive_type &&
    n(item?.passive_value) > 0
  ) {
    values.push(
      `${item.passive_type} +${fr(
        item.passive_value,
        2
      )}`
    )
  }

  return values.length
    ? values.join(' · ')
    : 'Aucun bonus'
}

function gearTotals(
  progress,
  inventory
) {
  const affinity =
    CLASS_AFFINITY[
      progress?.rpg_class
    ]

  return inventory
    .filter(
      (item) =>
        item.equipped
    )
    .reduce(
      (sum, item) => {
        const stats =
          itemStats(item)

        const multiplier =
          affinity === item.slot
            ? 1.25
            : 1

        sum.power +=
          stats.power *
          multiplier

        sum.mastery +=
          stats.mastery *
          multiplier

        sum.fortune +=
          stats.fortune *
          multiplier

        return sum
      },
      {
        power: 0,
        mastery: 0,
        fortune: 0,
      }
    )
}

export async function loadRpgInventory(
  athleteSlug
) {
  let result =
    await supabase
      .from('rpg_inventory')
      .select(
        [
          'id',
          'athlete_slug',
          'item_name',
          'rarity',
          'slot',
          'case_tier',
          'required_level',
          'power_bonus',
          'mastery_bonus',
          'fortune_bonus',
          'scaled_power_bonus',
          'scaled_mastery_bonus',
          'scaled_fortune_bonus',
          'stat_growth_rate',
          'passive_growth_rate',
          'equipped',
          'source',
          'catalog_key',
          'quantity',
          'item_level',
          'damage_bonus_pct',
          'item_type',
          'passive_type',
          'passive_value',
          'obtained_at',
        ].join(',')
      )
      .eq(
        'athlete_slug',
        athleteSlug
      )
      .order(
        'obtained_at',
        {
          ascending: false,
        }
      )

  if (
    result.error &&
    /passive_|growth_rate|scaled_/i
      .test(
        result.error.message ||
        ''
      )
  ) {
    result =
      await supabase
        .from('rpg_inventory')
        .select(
          [
            'id',
            'athlete_slug',
            'item_name',
            'rarity',
            'slot',
            'case_tier',
            'required_level',
            'power_bonus',
            'mastery_bonus',
            'fortune_bonus',
            'equipped',
            'source',
            'catalog_key',
            'quantity',
            'item_level',
            'damage_bonus_pct',
            'item_type',
            'obtained_at',
          ].join(',')
        )
        .eq(
          'athlete_slug',
          athleteSlug
        )
        .order(
          'obtained_at',
          {
            ascending: false,
          }
        )
  }

  if (result.error) {
    throw result.error
  }

  return Array.isArray(
    result.data
  )
    ? result.data
    : []
}

function statCard(
  key,
  label,
  description,
  progress,
  gear,
  canEdit
) {
  const base =
    n(
      progress?.[
        `stat_${key}`
      ]
    )

  const equipment =
    n(
      gear[key]
    )

  const total =
    base +
    equipment

  const cost =
    upgradeCost(base)

  const gold =
    n(
      progress?.gold_balance
    )

  const disabled =
    !canEdit ||
    gold < cost ||
    base >= 50

  return `
    <article class="rpg-eq-upgrade">
      <div>
        <strong>
          ${esc(label)}
          <span>
            ${fr(total, 1)}
          </span>
        </strong>

        <small>
          Permanent ${fr(base, 1)}
          · équipement +${fr(equipment, 1)}
        </small>

        <p>
          ${esc(description)}
        </p>
      </div>

      <button
        type="button"
        data-rpg-upgrade="${key}"
        ${disabled ? 'disabled' : ''}
      >
        +1
        <small>
          ${fr(cost, 0)} gold
        </small>
      </button>
    </article>
  `
}

function equippedHtml(
  inventory
) {
  return `
    <div class="rpg-eq-slots">
      ${Object.entries(
        RPG_SLOT_DEFS
      )
        .map(
          ([slot, def]) => {
            const item =
              inventory.find(
                (candidate) =>
                  candidate.slot ===
                    slot &&
                  candidate.equipped
              )

            if (!item) {
              return `
                <article class="rpg-eq-slot">
                  <div class="rpg-eq-slot-icon">
                    ${def.icon}
                  </div>

                  <strong>
                    ${esc(def.label)}
                  </strong>

                  <span>
                    Emplacement vide
                  </span>
                </article>
              `
            }

            const rarity =
              RPG_RARITY_DEFS[
                item.rarity
              ] ||
              RPG_RARITY_DEFS.normal

            return `
              <article
                class="rpg-eq-slot rarity-${esc(
                  item.rarity ||
                  'normal'
                )}"
              >
                <div class="rpg-eq-slot-icon">
                  ${def.icon}
                </div>

                <strong>
                  ${esc(def.label)}
                </strong>

                <b>
                  ${rarity.icon}
                  ${esc(
                    item.item_name
                  )}
                </b>

                <span>
                  Niv. ${fr(
                    item.item_level,
                    0
                  )}
                  · ${esc(
                    itemStatsText(
                      item
                    )
                  )}
                </span>
              </article>
            `
          }
        )
        .join('')}
    </div>
  `
}

function inventoryHtml(
  progress,
  inventory,
  canEdit
) {
  if (!inventory.length) {
    return `
      <div class="rpg-eq-empty">
        Aucun objet dans l'inventaire.
      </div>
    `
  }

  return `
    <div class="rpg-eq-inventory">
      ${inventory
        .map((item) => {
          const rarity =
            RPG_RARITY_DEFS[
              item.rarity
            ] ||
            RPG_RARITY_DEFS.normal

          const slot =
            RPG_SLOT_DEFS[
              item.slot
            ] || {
              icon: '🎒',
              label: 'Objet',
            }

          const locked =
            n(
              progress?.level,
              1
            ) <
            n(
              item.required_level,
              1
            )

          return `
            <article
              class="rpg-eq-item rarity-${esc(
                item.rarity ||
                'normal'
              )} ${
                item.equipped
                  ? 'equipped'
                  : ''
              }"
            >
              <div class="rpg-eq-item-head">
                <div>
                  <strong>
                    ${rarity.icon}
                    ${esc(
                      item.item_name
                    )}
                  </strong>

                  <span>
                    ${slot.icon}
                    ${esc(slot.label)}
                    · ${esc(
                      rarity.label
                    )}
                    · Niv. ${fr(
                      item.item_level,
                      0
                    )}
                    · ×${fr(
                      item.quantity,
                      0
                    )}
                  </span>
                </div>

                ${
                  item.equipped
                    ? '<b>ÉQUIPÉ</b>'
                    : ''
                }
              </div>

              <div class="rpg-eq-item-stats">
                ${esc(
                  itemStatsText(
                    item
                  )
                )}
              </div>

              <div class="rpg-eq-actions">
                <button
                  type="button"
                  data-rpg-equip="${esc(
                    item.id
                  )}"
                  ${
                    !canEdit ||
                    item.equipped ||
                    locked
                      ? 'disabled'
                      : ''
                  }
                >
                  ${
                    item.equipped
                      ? 'Équipé'
                      : locked
                        ? `Palier ${fr(
                            item.required_level,
                            0
                          )}`
                        : 'Équiper'
                  }
                </button>

                <button
                  type="button"
                  data-rpg-sell="${esc(
                    item.id
                  )}"
                  ${
                    !canEdit ||
                    item.equipped
                      ? 'disabled'
                      : ''
                  }
                >
                  Vendre 1
                </button>
              </div>
            </article>
          `
        })
        .join('')}
    </div>
  `
}

export function renderRpgEquipment({
  progress,
  inventory,
  canEdit,
}) {
  const safeInventory =
    Array.isArray(inventory)
      ? inventory
      : []

  const gear =
    gearTotals(
      progress,
      safeInventory
    )

  const classKey =
    progress?.rpg_class

  const mainStat =
    classKey === 'archer'
      ? 'Précision'
      : classKey === 'mage'
        ? 'Magie'
        : 'Force'

  const itemCount =
    safeInventory.reduce(
      (sum, item) =>
        sum +
        n(
          item.quantity,
          1
        ),
      0
    )

  return `
    <section class="rpg-eq-wallet">
      <div>
        <span>
          TON PORTE-MONNAIE
        </span>

        <strong>
          🪙 ${fr(
            progress?.gold_balance,
            0
          )} gold
        </strong>
      </div>

      <span>
        Total gagné :
        ${fr(
          progress?.gold_total_earned,
          0
        )}
      </span>
    </section>

    <section class="rpg-section">
      <div class="rpg-section-title">
        Améliorer les statistiques
        · coût +15 % par rang
      </div>

      <div class="rpg-eq-upgrades">
        ${statCard(
          'power',
          mainStat,
          '+4 % de dégâts de base par rang.',
          progress,
          gear,
          canEdit
        )}

        ${statCard(
          'mastery',
          'Chance',
          'Critiques, jackpot gold et influence très faible sur les caisses.',
          progress,
          gear,
          canEdit
        )}

        ${statCard(
          'fortune',
          'Fortune',
          '+3 % de gold gagné par rang.',
          progress,
          gear,
          canEdit
        )}
      </div>
    </section>

    <section class="rpg-section">
      <div class="rpg-section-title">
        Équipement porté
      </div>

      ${equippedHtml(
        safeInventory
      )}
    </section>

    <section class="rpg-section">
      <div class="rpg-section-title">
        Inventaire
        · ${itemCount} objets
        · ${safeInventory.length} piles
      </div>

      ${inventoryHtml(
        progress,
        safeInventory,
        canEdit
      )}
    </section>
  `
}

export async function handleRpgEquipmentAction({
  element,
  athleteSlug,
  canEdit,
}) {
  if (
    !element ||
    !canEdit
  ) {
    return {
      handled: Boolean(element),
      refresh: false,
    }
  }

  const stat =
    element.dataset
      .rpgUpgrade

  if (stat) {
    if (
      ![
        'power',
        'mastery',
        'fortune',
      ].includes(stat)
    ) {
      return {
        handled: true,
        refresh: false,
      }
    }

    element.disabled = true

    const {
      error,
    } =
      await supabase.rpc(
        'upgrade_rpg_stat',
        {
          p_athlete_slug:
            athleteSlug,
          p_stat:
            stat,
        }
      )

    if (error) {
      window.alert(
        `Amélioration impossible : ${error.message}`
      )

      return {
        handled: true,
        refresh: false,
      }
    }

    return {
      handled: true,
      refresh: true,
    }
  }

  const itemToEquip =
    element.dataset
      .rpgEquip

  if (itemToEquip) {
    element.disabled = true

    const {
      error,
    } =
      await supabase.rpc(
        'equip_rpg_item',
        {
          p_athlete_slug:
            athleteSlug,
          p_item_id:
            itemToEquip,
        }
      )

    if (error) {
      window.alert(
        `Équipement impossible : ${error.message}`
      )

      return {
        handled: true,
        refresh: false,
      }
    }

    return {
      handled: true,
      refresh: true,
    }
  }

  const itemToSell =
    element.dataset
      .rpgSell

  if (itemToSell) {
    const confirmed =
      window.confirm(
        'Vendre un exemplaire de cet objet contre du gold ?'
      )

    if (!confirmed) {
      return {
        handled: true,
        refresh: false,
      }
    }

    element.disabled = true

    const {
      error,
    } =
      await supabase.rpc(
        'sell_rpg_item',
        {
          p_athlete_slug:
            athleteSlug,
          p_item_id:
            itemToSell,
        }
      )

    if (error) {
      window.alert(
        `Vente impossible : ${error.message}`
      )

      return {
        handled: true,
        refresh: false,
      }
    }

    return {
      handled: true,
      refresh: true,
    }
  }

  return {
    handled: false,
    refresh: false,
  }
}
