import { supabase } from './supabase.js'

const ITEM_RARITIES = {
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
    label: 'Ultra Rare Mythique',
  },
  abyssal: {
    icon: '🫧',
    label: 'Abyssal',
  },
}

const MONSTER_RARITIES = {
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
    label: 'Ultra Rare Mythique',
  },
  abyssal: {
    icon: '🫧',
    label: 'Abyssal',
  },
  secret: {
    icon: '🌈',
    label: 'Secret',
  },
}

const SLOT_DEFS = {
  weapon: {
    icon: '🗡️',
    label: 'Arme',
  },
  armor: {
    icon: '🛡️',
    label: 'Armure',
  },
  relic: {
    icon: '💎',
    label: 'Relique',
  },
}

const RARITY_ORDER = [
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

function n(value, fallback = 0) {
  const number =
    Number(value)

  return Number.isFinite(number)
    ? number
    : fallback
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function fr(value, digits = 1) {
  return n(value)
    .toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits:
          digits,
      }
    )
}

function formatDate(value) {
  if (!value) {
    return 'Date inconnue'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Date inconnue'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  ).format(date)
}

function fallbackMonster(row) {
  return {
    monster_key:
      row?.monster_key,

    monster_name:
      row?.monster_name ||
      String(
        row?.monster_key ||
        'monstre'
      ).replaceAll(
        '_',
        ' '
      ),

    rarity:
      row?.rarity ||
      'common',

    icon:
      '👾',

    xp_bonus:
      0,

    visible_before_discovery:
      true,

    sort_order:
      999999,

    category:
      'Archives retrouvées',
  }
}

function fallbackItem(
  row,
  inventory
) {
  const inv =
    inventory.find(
      item =>
        item.catalog_key &&
        row?.catalog_key &&
        item.catalog_key ===
          row.catalog_key
    ) || {}

  const slot =
    inv.slot ||
    row?.slot ||
    'weapon'

  const rarity =
    inv.rarity ||
    row?.rarity ||
    'normal'

  const name =
    row?.source_item_name ||
    inv.item_name ||
    row?.item_name ||
    String(
      row?.catalog_key ||
      'Objet inconnu'
    ).replaceAll(
      '_',
      ' '
    )

  return {
    catalog_key:
      row?.catalog_key ||
      inv.catalog_key ||
      `archive_${name
        .replaceAll(' ', '_')
        .toLowerCase()}`,

    item_name:
      name,

    rarity,

    slot,

    item_type:
      inv.item_type ||
      row?.item_type ||
      'generic',

    icon:
      inv.icon ||
      SLOT_DEFS[slot]?.icon ||
      '🎴',

    power_collect_bonus:
      n(
        row?.deposited_power_bonus
      ),

    mastery_collect_bonus:
      n(
        row?.deposited_mastery_bonus
      ),

    fortune_collect_bonus:
      n(
        row?.deposited_fortune_bonus
      ),

    sort_order:
      999999,
  }
}

function collectionBonusText(
  item
) {
  const values = []

  const power =
    n(
      item?.power_collect_bonus
    )

  const mastery =
    n(
      item?.mastery_collect_bonus
    )

  const fortune =
    n(
      item?.fortune_collect_bonus
    )

  if (power) {
    values.push(
      `Force +${fr(
        power,
        1
      )}`
    )
  }

  if (mastery) {
    values.push(
      `Chance +${fr(
        mastery,
        1
      )}`
    )
  }

  if (fortune) {
    values.push(
      `Fortune +${fr(
        fortune,
        1
      )}`
    )
  }

  return values.length
    ? values.join(' · ')
    : 'Bonus permanent activé'
}

function collectionTotals(
  itemCatalog,
  itemCollection
) {
  const owned =
    new Set(
      itemCollection.map(
        row =>
          row.catalog_key
      )
    )

  return itemCatalog
    .filter(
      item =>
        owned.has(
          item.catalog_key
        )
    )
    .reduce(
      (total, item) => {
        total.power +=
          n(
            item.power_collect_bonus
          )

        total.mastery +=
          n(
            item.mastery_collect_bonus
          )

        total.fortune +=
          n(
            item.fortune_collect_bonus
          )

        return total
      },
      {
        power: 0,
        mastery: 0,
        fortune: 0,
      }
    )
}

function eligibleDepositItems(
  inventory,
  itemCollection
) {
  const deposited =
    new Set(
      itemCollection.map(
        row =>
          row.catalog_key
      )
    )

  return inventory.filter(
    item => {
      if (
        !item.catalog_key ||
        deposited.has(
          item.catalog_key
        )
      ) {
        return false
      }

      const quantity =
        Math.max(
          1,
          n(
            item.quantity,
            1
          )
        )

      if (
        item.equipped &&
        quantity <= 1
      ) {
        return false
      }

      return true
    }
  )
}

export function createRpgCollectionState() {
  return {
    athleteSlug: '',

    loading: false,

    loaded: false,

    error: '',

    subTab:
      'bestiary',

    search: '',

    rarity:
      'all',

    status:
      'all',

    category:
      'all',

    monsterCatalog: [],

    monsterCollection: [],

    itemCatalog: [],

    itemCollection: [],
  }
}

export async function loadRpgCollections(
  athleteSlug,
  state,
  inventory = []
) {
  if (!athleteSlug) {
    return
  }

  if (
    state.athleteSlug !==
    athleteSlug
  ) {
    state.athleteSlug =
      athleteSlug

    state.loaded = false

    state.search = ''
    state.rarity = 'all'
    state.status = 'all'
    state.category = 'all'
  }

  state.loading = true
  state.error = ''

  const [
    monsters,
    monsterOwned,
    items,
    itemOwned,
  ] =
    await Promise.all([
      supabase
        .from(
          'rpg_monster_catalog'
        )
        .select('*')
        .order(
          'sort_order',
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          'rpg_monster_collection'
        )
        .select('*')
        .eq(
          'athlete_slug',
          athleteSlug
        ),

      supabase
        .from(
          'rpg_item_catalog'
        )
        .select('*')
        .order(
          'sort_order',
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          'rpg_item_collection'
        )
        .select('*')
        .eq(
          'athlete_slug',
          athleteSlug
        ),
    ])

  state.monsterCatalog =
    monsters.error
      ? []
      : Array.isArray(
          monsters.data
        )
        ? monsters.data
        : []

  state.monsterCollection =
    monsterOwned.error
      ? []
      : Array.isArray(
          monsterOwned.data
        )
        ? monsterOwned.data
        : []

  state.itemCatalog =
    items.error
      ? []
      : Array.isArray(
          items.data
        )
        ? items.data
        : []

  state.itemCollection =
    itemOwned.error
      ? []
      : Array.isArray(
          itemOwned.data
        )
        ? itemOwned.data
        : []

  const monsterKeys =
    new Set(
      state.monsterCatalog
        .map(
          monster =>
            monster.monster_key
        )
    )

  for (
    const owned of
      state.monsterCollection
  ) {
    if (
      !monsterKeys.has(
        owned.monster_key
      )
    ) {
      state.monsterCatalog.push(
        fallbackMonster(
          owned
        )
      )

      monsterKeys.add(
        owned.monster_key
      )
    }
  }

  const itemKeys =
    new Set(
      state.itemCatalog
        .map(
          item =>
            item.catalog_key
        )
    )

  for (
    const owned of
      state.itemCollection
  ) {
    if (
      !itemKeys.has(
        owned.catalog_key
      )
    ) {
      const fallback =
        fallbackItem(
          owned,
          inventory
        )

      state.itemCatalog.push(
        fallback
      )

      itemKeys.add(
        fallback.catalog_key
      )
    }
  }

  const errors = [
    monsters.error,
    monsterOwned.error,
    items.error,
    itemOwned.error,
  ].filter(Boolean)

  if (errors.length) {
    state.error =
      errors
        .map(
          error =>
            error.message
        )
        .join(' · ')
  }

  state.loading = false
  state.loaded = true
}

function bestiaryHtml(
  progress,
  state
) {
  const discovered =
    new Map(
      state.monsterCollection
        .map(
          row => [
            row.monster_key,
            row,
          ]
        )
    )

  const total =
    Math.max(
      state.monsterCatalog.length,
      discovered.size,
      300
    )

  const found =
    discovered.size

  const kills =
    state.monsterCollection
      .reduce(
        (sum, row) =>
          sum +
          n(row.kills),
        0
      )

  const categories =
    [
      ...new Set(
        state.monsterCatalog
          .map(
            monster =>
              monster.category
          )
          .filter(Boolean)
      ),
    ].sort(
      (a, b) =>
        a.localeCompare(
          b,
          'fr'
        )
    )

  const query =
    state.search
      .trim()
      .toLocaleLowerCase(
        'fr'
      )

  const filtered =
    state.monsterCatalog
      .filter(
        monster => {
          const entry =
            discovered.get(
              monster.monster_key
            )

          if (
            state.rarity !==
              'all' &&
            monster.rarity !==
              state.rarity
          ) {
            return false
          }

          if (
            state.category !==
              'all' &&
            monster.category !==
              state.category
          ) {
            return false
          }

          if (
            state.status ===
              'found' &&
            !entry
          ) {
            return false
          }

          if (
            state.status ===
              'missing' &&
            entry
          ) {
            return false
          }

          if (query) {
            const haystack =
              `${monster.monster_name || ''} ${monster.category || ''}`
                .toLocaleLowerCase(
                  'fr'
                )

            if (
              !haystack.includes(
                query
              )
            ) {
              return false
            }
          }

          return true
        }
      )

  return `
    <div class="rpg-collection-summary">
      <div>
        <b>
          ${found}/${total}
        </b>

        <span>
          Monstres
        </span>
      </div>

      <div>
        <b>
          +${fr(
            progress?.collection_xp_bonus,
            1
          )} %
        </b>

        <span>
          XP permanent
        </span>
      </div>

      <div>
        <b>
          ${fr(kills, 0)}
        </b>

        <span>
          Kills connus
        </span>
      </div>
    </div>

    <div class="rpg-bestiary-tools">
      <input
        type="search"
        value="${esc(
          state.search
        )}"
        placeholder="Rechercher un monstre…"
        data-rpg-collection-filter="search"
      >

      <select
        data-rpg-collection-filter="rarity"
      >
        <option value="all">
          Toutes raretés
        </option>

        ${Object
          .entries(
            MONSTER_RARITIES
          )
          .map(
            ([key, def]) => `
              <option
                value="${key}"
                ${
                  state.rarity ===
                  key
                    ? 'selected'
                    : ''
                }
              >
                ${def.icon}
                ${def.label}
              </option>
            `
          )
          .join('')}
      </select>

      <select
        data-rpg-collection-filter="status"
      >
        <option
          value="all"
          ${
            state.status ===
            'all'
              ? 'selected'
              : ''
          }
        >
          Tous
        </option>

        <option
          value="found"
          ${
            state.status ===
            'found'
              ? 'selected'
              : ''
          }
        >
          Découverts
        </option>

        <option
          value="missing"
          ${
            state.status ===
            'missing'
              ? 'selected'
              : ''
          }
        >
          Non découverts
        </option>
      </select>

      <select
        data-rpg-collection-filter="category"
      >
        <option value="all">
          Toutes catégories
        </option>

        ${categories
          .map(
            category => `
              <option
                value="${esc(
                  category
                )}"
                ${
                  state.category ===
                  category
                    ? 'selected'
                    : ''
                }
              >
                ${esc(
                  category
                )}
              </option>
            `
          )
          .join('')}
      </select>
    </div>

    <div class="rpg-bestiary-count">
      ${filtered.length}
      monstre${
        filtered.length > 1
          ? 's'
          : ''
      }
      affiché${
        filtered.length > 1
          ? 's'
          : ''
      }
    </div>

    ${
      !state.monsterCatalog.length
        ? `
          <div class="rpg-collection-empty">
            Catalogue des monstres indisponible.
          </div>
        `
        : `
          <div class="rpg-bestiary-grid">
            ${filtered
              .map(
                monster => {
                  const entry =
                    discovered.get(
                      monster.monster_key
                    )

                  const hidden =
                    !monster
                      .visible_before_discovery &&
                    !entry

                  const rarityKey =
                    monster.rarity ||
                    'common'

                  const rarity =
                    MONSTER_RARITIES[
                      rarityKey
                    ] ||
                    MONSTER_RARITIES.common

                  const name =
                    hidden
                      ? '???'
                      : monster.monster_name

                  const icon =
                    hidden
                      ? rarityKey ===
                        'secret'
                        ? '🌈❓'
                        : '❓'
                      : monster.icon ||
                        '👾'

                  return `
                    <article
                      class="rpg-monster-card rarity-${esc(
                        rarityKey
                      )} ${
                        entry
                          ? 'discovered'
                          : 'undiscovered'
                      }"
                    >
                      ${
                        entry
                          ? `
                            <span class="rpg-monster-kills">
                              ×${fr(
                                entry.kills,
                                0
                              )}
                            </span>
                          `
                          : ''
                      }

                      <div class="rpg-monster-icon">
                        ${esc(icon)}
                      </div>

                      <strong>
                        ${esc(name)}
                      </strong>

                      <span>
                        ${rarity.icon}
                        ${
                          hidden
                            ? 'Rareté inconnue'
                            : esc(
                                rarity.label
                              )
                        }
                      </span>

                      <small>
                        ${
                          hidden
                            ? 'Archive inconnue'
                            : esc(
                                monster.category ||
                                'Autres'
                              )
                        }
                      </small>

                      ${
                        entry
                          ? `
                            <small>
                              Première victoire :
                              ${esc(
                                formatDate(
                                  entry.first_discovered_at
                                )
                              )}
                            </small>
                          `
                          : ''
                      }

                      <b>
                        ${
                          hidden
                            ? 'Bonus inconnu'
                            : `Découverte : +${fr(
                                monster.xp_bonus,
                                0
                              )} % XP`
                        }
                      </b>
                    </article>
                  `
                }
              )
              .join('')}
          </div>
        `
    }
  `
}

function codexHtml(
  inventory,
  state,
  canEdit
) {
  const collectionByKey =
    new Map(
      state.itemCollection
        .map(
          row => [
            row.catalog_key,
            row,
          ]
        )
    )

  const owned =
    new Set(
      collectionByKey.keys()
    )

  const totals =
    collectionTotals(
      state.itemCatalog,
      state.itemCollection
    )

  const eligible =
    eligibleDepositItems(
      inventory,
      state.itemCollection
    )

  const groups =
    [
      ...new Set(
        state.itemCatalog
          .map(
            item =>
              item.rarity ||
              'normal'
          )
      ),
    ].sort(
      (a, b) => {
        const ai =
          RARITY_ORDER
            .indexOf(a)

        const bi =
          RARITY_ORDER
            .indexOf(b)

        return (
          (
            ai < 0
              ? 999
              : ai
          ) -
          (
            bi < 0
              ? 999
              : bi
          )
        )
      }
    )

  return `
    <div class="rpg-collection-summary">
      <div>
        <b>
          ${owned.size}/${
            Math.max(
              state.itemCatalog.length,
              owned.size
            )
          }
        </b>

        <span>
          Objets uniques
        </span>
      </div>

      <div>
        <b>
          +${fr(
            totals.power,
            1
          )}
        </b>

        <span>
          Force
        </span>
      </div>

      <div>
        <b>
          +${fr(
            totals.mastery +
            totals.fortune,
            1
          )}
        </b>

        <span>
          Chance + Fortune
        </span>
      </div>
    </div>

    ${
      canEdit
        ? `
          <section class="rpg-codex-deposit">
            <div class="rpg-codex-deposit-head">
              <div>
                <strong>
                  Objets disponibles à déposer
                </strong>

                <span>
                  ${eligible.length}
                  objet${
                    eligible.length > 1
                      ? 's'
                      : ''
                  }
                  unique${
                    eligible.length > 1
                      ? 's'
                      : ''
                  }
                  éligible${
                    eligible.length > 1
                      ? 's'
                      : ''
                  }
                </span>
              </div>

              <button
                type="button"
                data-rpg-deposit-all
                ${
                  !eligible.length
                    ? 'disabled'
                    : ''
                }
              >
                Tout déposer
              </button>
            </div>

            <div class="rpg-codex-deposit-list">
              ${eligible
                .map(
                  item => {
                    const rarity =
                      ITEM_RARITIES[
                        item.rarity
                      ] ||
                      ITEM_RARITIES.normal

                    const slot =
                      SLOT_DEFS[
                        item.slot
                      ] || {
                        icon: '🎴',
                        label: 'Objet',
                      }

                    return `
                      <div class="rpg-codex-deposit-row">
                        <span>
                          ${slot.icon}
                        </span>

                        <div>
                          <b>
                            ${rarity.icon}
                            ${esc(
                              item.item_name
                            )}
                          </b>

                          <small>
                            ${esc(
                              slot.label
                            )}
                            · ×${fr(
                              item.quantity,
                              0
                            )}
                          </small>
                        </div>

                        <button
                          type="button"
                          data-rpg-deposit-item="${esc(
                            item.id
                          )}"
                        >
                          Déposer 1
                        </button>
                      </div>
                    `
                  }
                )
                .join('')}
            </div>
          </section>
        `
        : ''
    }

    <div class="rpg-codex-title">
      Objets déposés
    </div>

    ${
      state.itemCollection.length
        ? `
          <div class="rpg-deposited-list">
            ${state.itemCollection
              .slice()
              .sort(
                (a, b) =>
                  new Date(
                    b.deposited_at ||
                    0
                  ) -
                  new Date(
                    a.deposited_at ||
                    0
                  )
              )
              .map(
                row => {
                  const item =
                    state.itemCatalog
                      .find(
                        candidate =>
                          candidate.catalog_key ===
                          row.catalog_key
                      ) ||
                    fallbackItem(
                      row,
                      inventory
                    )

                  const rarity =
                    ITEM_RARITIES[
                      item.rarity
                    ] ||
                    ITEM_RARITIES.normal

                  const slot =
                    SLOT_DEFS[
                      item.slot
                    ] || {
                      icon: '🎴',
                    }

                  return `
                    <article class="rpg-deposited-row rarity-${esc(
                      item.rarity ||
                      'normal'
                    )}">
                      <div>
                        ${item.icon ||
                          slot.icon}
                      </div>

                      <div>
                        <strong>
                          ${rarity.icon}
                          ${esc(
                            item.item_name
                          )}
                        </strong>

                        <span>
                          ${esc(
                            rarity.label
                          )}
                          · déposé le
                          ${esc(
                            formatDate(
                              row.deposited_at
                            )
                          )}
                        </span>

                        <small>
                          Objet sacrifié :
                          niveau
                          ${fr(
                            row.deposited_item_level,
                            0
                          )}
                          · dégâts
                          +${fr(
                            row.deposited_damage_bonus_pct,
                            2
                          )} %
                        </small>

                        <b>
                          Bonus permanent :
                          ${esc(
                            collectionBonusText(
                              item
                            )
                          )}
                        </b>
                      </div>
                    </article>
                  `
                }
              )
              .join('')}
          </div>
        `
        : `
          <div class="rpg-collection-empty">
            Aucun objet déposé dans le codex.
          </div>
        `
    }

    <div class="rpg-codex-title">
      Album complet
    </div>

    <div class="rpg-codex-groups">
      ${groups
        .map(
          rarityKey => {
            const rarity =
              ITEM_RARITIES[
                rarityKey
              ] || {
                icon: '🎴',
                label: rarityKey,
              }

            const items =
              state.itemCatalog
                .filter(
                  item =>
                    (
                      item.rarity ||
                      'normal'
                    ) ===
                    rarityKey
                )

            if (!items.length) {
              return ''
            }

            const count =
              items.filter(
                item =>
                  owned.has(
                    item.catalog_key
                  )
              ).length

            return `
              <details
                class="rpg-codex-group rarity-${esc(
                  rarityKey
                )}"
                ${
                  [
                    'normal',
                    'common',
                  ].includes(
                    rarityKey
                  )
                    ? 'open'
                    : ''
                }
              >
                <summary>
                  ${rarity.icon}
                  ${esc(
                    rarity.label
                  )}
                  ·
                  ${count}/${items.length}
                </summary>

                <div class="rpg-codex-grid">
                  ${items
                    .map(
                      item => {
                        const has =
                          owned.has(
                            item.catalog_key
                          )

                        const slot =
                          SLOT_DEFS[
                            item.slot
                          ] || {
                            icon: '🎴',
                            label:
                              item.slot ||
                              'Objet',
                          }

                        const deposit =
                          collectionByKey
                            .get(
                              item.catalog_key
                            )

                        return `
                          <article
                            class="rpg-codex-card ${
                              has
                                ? 'owned'
                                : 'missing'
                            }"
                          >
                            <div>
                              ${item.icon ||
                                slot.icon}
                            </div>

                            <strong>
                              ${esc(
                                item.item_name
                              )}
                            </strong>

                            <span>
                              ${
                                has
                                  ? '✅ Déposé'
                                  : '⬜ Manquant'
                              }
                            </span>

                            <small>
                              ${esc(
                                slot.label
                              )}
                              ·
                              ${esc(
                                item.item_type ||
                                'generic'
                              )}
                            </small>

                            ${
                              has
                                ? `
                                  <small>
                                    ${esc(
                                      formatDate(
                                        deposit
                                          ?.deposited_at
                                      )
                                    )}
                                  </small>
                                `
                                : ''
                            }

                            <b>
                              ${esc(
                                collectionBonusText(
                                  item
                                )
                              )}
                            </b>
                          </article>
                        `
                      }
                    )
                    .join('')}
                </div>
              </details>
            `
          }
        )
        .join('')}
    </div>
  `
}

export function renderRpgCollection({
  progress,
  inventory,
  canEdit,
  state,
}) {
  if (state.loading) {
    return `
      <div class="rpg-loading">
        Chargement de la collection…
      </div>
    `
  }

  return `
    <div class="rpg-collection-page">
      ${
        state.error
          ? `
            <div class="rpg-collection-warning">
              Certaines données n'ont pas pu être chargées :
              ${esc(
                state.error
              )}
            </div>
          `
          : ''
      }

      <div class="rpg-collection-tabs">
        <button
          type="button"
          data-rpg-collection-tab="bestiary"
          class="${
            state.subTab ===
            'bestiary'
              ? 'active'
              : ''
          }"
        >
          👾 Bestiaire
        </button>

        <button
          type="button"
          data-rpg-collection-tab="items"
          class="${
            state.subTab ===
            'items'
              ? 'active'
              : ''
          }"
        >
          🎴 Codex objets
        </button>
      </div>

      <section class="rpg-section">
        <div class="rpg-section-title">
          ${
            state.subTab ===
            'bestiary'
              ? 'Collection de monstres'
              : 'Album des équipements'
          }
        </div>

        ${
          state.subTab ===
          'bestiary'
            ? bestiaryHtml(
                progress,
                state
              )
            : codexHtml(
                inventory,
                state,
                canEdit
              )
        }
      </section>
    </div>
  `
}

export function updateRpgCollectionFilter(
  state,
  element
) {
  const key =
    element?.dataset
      ?.rpgCollectionFilter

  if (!key) {
    return false
  }

  if (key === 'search') {
    state.search =
      element.value || ''
  }

  if (key === 'rarity') {
    state.rarity =
      element.value ||
      'all'
  }

  if (key === 'status') {
    state.status =
      element.value ||
      'all'
  }

  if (key === 'category') {
    state.category =
      element.value ||
      'all'
  }

  return true
}

export async function handleRpgCollectionAction({
  element,
  athleteSlug,
  inventory,
  canEdit,
  state,
}) {
  const subTab =
    element?.dataset
      ?.rpgCollectionTab

  if (subTab) {
    if (
      [
        'bestiary',
        'items',
      ].includes(
        subTab
      )
    ) {
      state.subTab =
        subTab
    }

    return {
      handled: true,
      refresh: false,
    }
  }

  if (
    !canEdit ||
    !athleteSlug
  ) {
    return {
      handled: false,
      refresh: false,
    }
  }

  const itemId =
    element?.dataset
      ?.rpgDepositItem

  if (itemId) {
    const confirmed =
      window.confirm(
        'Déposer un exemplaire dans le codex ? Un seul objet sera consommé et le bonus restera permanent.'
      )

    if (!confirmed) {
      return {
        handled: true,
        refresh: false,
      }
    }

    const {
      error,
    } =
      await supabase.rpc(
        'deposit_rpg_collection_item',
        {
          p_athlete_slug:
            athleteSlug,

          p_item_id:
            itemId,
        }
      )

    if (error) {
      window.alert(
        `Dépôt impossible : ${error.message}`
      )

      return {
        handled: true,
        refresh: false,
      }
    }

    state.subTab =
      'items'

    await loadRpgCollections(
      athleteSlug,
      state,
      inventory
    )

    return {
      handled: true,
      refresh: true,
    }
  }

  if (
    element?.hasAttribute(
      'data-rpg-deposit-all'
    )
  ) {
    const eligible =
      eligibleDepositItems(
        inventory,
        state.itemCollection
      )

    if (!eligible.length) {
      return {
        handled: true,
        refresh: false,
      }
    }

    const confirmed =
      window.confirm(
        `Déposer automatiquement ${eligible.length} objet${eligible.length > 1 ? 's' : ''} unique${eligible.length > 1 ? 's' : ''} dans le codex ? Un exemplaire de chaque objet sera consommé. Les objets équipés sans doublon seront conservés.`
      )

    if (!confirmed) {
      return {
        handled: true,
        refresh: false,
      }
    }

    const {
      error,
    } =
      await supabase.rpc(
        'deposit_all_rpg_collection_items',
        {
          p_athlete_slug:
            athleteSlug,
        }
      )

    if (error) {
      window.alert(
        `Dépôt global impossible : ${error.message}`
      )

      return {
        handled: true,
        refresh: false,
      }
    }

    state.subTab =
      'items'

    await loadRpgCollections(
      athleteSlug,
      state,
      inventory
    )

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
