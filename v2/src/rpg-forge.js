import { supabase } from './supabase.js'

const FORGE_RULES = Object.freeze({
  legendary: {
    required: 10,
    target: 'mythic',
    sourceLabel: 'L?gendaire',
    targetLabel: 'Mythique',
    icon: '??',
  },

  mythic: {
    required: 5,
    target: 'ultra_mythic',
    sourceLabel: 'Mythique',
    targetLabel: 'URM',
    icon: '??',
  },

  ultra_mythic: {
    required: 2,
    target: 'abyssal',
    sourceLabel: 'URM',
    targetLabel: 'Abyssal',
    icon: '??',
  },
})

function n(value, fallback = 0) {
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
    .replaceAll("'", '&#39;')
}

function formatNumber(value) {
  return Math.floor(
    n(value)
  ).toLocaleString('fr-FR')
}

function modeKey(slug) {
  return `rpg_dwarf_mode_v2_${slug}`
}

function betKey(slug) {
  return `rpg_casino_bet_v2_${slug}`
}

function storedMode(slug) {
  return localStorage.getItem(
    modeKey(slug)
  ) === 'casino'
    ? 'casino'
    : 'forge'
}

function storedBet(slug) {
  return Math.max(
    1,
    Math.floor(
      n(
        localStorage.getItem(
          betKey(slug)
        ),
        1000
      )
    )
  )
}

export function createRpgForgeState(
  athleteSlug = ''
) {
  return {
    athleteSlug,

    mode:
      storedMode(
        athleteSlug
      ),

    forgeBusy: false,
    forgeResult: null,

    casinoBusy: false,
    casinoReady: null,
    casinoError: '',

    casinoBet:
      storedBet(
        athleteSlug
      ),

    casinoState: {
      free_spins_remaining: 0,
      free_spin_bet: 0,
    },

    casinoResult: null,
  }
}

export function syncRpgForgeState(
  state,
  athleteSlug
) {
  if (
    state.athleteSlug ===
    athleteSlug
  ) {
    return
  }

  state.athleteSlug =
    athleteSlug

  state.mode =
    storedMode(
      athleteSlug
    )

  state.casinoBet =
    storedBet(
      athleteSlug
    )

  state.forgeBusy = false
  state.forgeResult = null

  state.casinoBusy = false
  state.casinoReady = null
  state.casinoError = ''

  state.casinoState = {
    free_spins_remaining: 0,
    free_spin_bet: 0,
  }

  state.casinoResult = null
}

export async function loadRpgCasinoState({
  athleteSlug,
  state,
}) {
  syncRpgForgeState(
    state,
    athleteSlug
  )

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_rpg_casino_state_v185',
      {
        p_athlete_slug:
          athleteSlug,
      }
    )

  if (error) {
    state.casinoReady = false
    state.casinoError =
      error.message ||
      String(error)

    return {
      ok: false,
      error,
    }
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data

  state.casinoReady = true
  state.casinoError = ''

  state.casinoState = {
    free_spins_remaining:
      Math.max(
        0,
        Math.floor(
          n(
            row?.free_spins_remaining
          )
        )
      ),

    free_spin_bet:
      Math.max(
        0,
        Math.floor(
          n(
            row?.free_spin_bet
          )
        )
      ),
  }

  return {
    ok: true,
    row,
  }
}

function forgeGroups(
  inventory = []
) {
  const groups =
    new Map()

  for (
    const item of inventory
  ) {
    const rarity =
      String(
        item?.rarity || ''
      ).toLowerCase()

    if (
      !FORGE_RULES[
        rarity
      ]
    ) {
      continue
    }

    if (
      item?.equipped ||
      item?.is_locked
    ) {
      continue
    }

    const level =
      Math.max(
        1,
        Math.floor(
          n(
            item?.item_level,
            1
          )
        )
      )

    const key =
      `${rarity}:${level}`

    if (
      !groups.has(key)
    ) {
      groups.set(
        key,
        {
          rarity,
          level,
          quantity: 0,
        }
      )
    }

    groups.get(key)
      .quantity +=
      Math.max(
        0,
        Math.floor(
          n(
            item?.quantity,
            1
          )
        )
      )
  }

  const rank = {
    ultra_mythic: 3,
    mythic: 2,
    legendary: 1,
  }

  return [
    ...groups.values(),
  ].sort(
    (a, b) =>
      (
        rank[b.rarity] || 0
      ) -
      (
        rank[a.rarity] || 0
      ) ||
      b.level -
      a.level
  )
}

function forgeHtml({
  inventory,
  canEdit,
  state,
}) {
  const groups =
    forgeGroups(
      inventory
    )

  const cards =
    groups.length
      ? groups.map(
          group => {
            const rule =
              FORGE_RULES[
                group.rarity
              ]

            const enough =
              group.quantity >=
              rule.required

            return `
              <div class="rpg-forge-group-v2">
                <div>
                  <strong>
                    ${rule.icon}
                    ${esc(
                      rule.sourceLabel
                    )}
                    niv. ${group.level}
                    ?
                    ${esc(
                      rule.targetLabel
                    )}
                  </strong>

                  <span>
                    ${group.quantity}
                    /
                    ${rule.required}
                    objets
                  </span>

                  <small>
                    M?me niveau obligatoire
                  </small>
                </div>

                <button
                  type="button"
                  data-rpg-forge-v2
                  data-rpg-forge-rarity-v2="${esc(
                    group.rarity
                  )}"
                  data-rpg-forge-level-v2="${group.level}"
                  ${
                    !canEdit ||
                    state.forgeBusy ||
                    !enough
                      ? 'disabled'
                      : ''
                  }
                >
                  ${
                    state.forgeBusy
                      ? '?? TING?'
                      : `Forger ?${rule.required}`
                  }
                </button>
              </div>
            `
          }
        ).join('')
      : `
          <div class="rpg-forge-empty-v2">
            Aucun lot compatible avec
            la forge pour le moment.
          </div>
        `

  let result = ''

  if (
    state.forgeResult
  ) {
    result =
      state.forgeResult.success
        ? `
          <div class="rpg-forge-result-v2 success">
            ? <strong>R?USSITE</strong><br>

            ${esc(
              state.forgeResult
                .result_item_name ||
              state.forgeResult
                .target_rarity ||
              'Objet sup?rieur'
            )}
          </div>
        `
        : `
          <div class="rpg-forge-result-v2 fail">
            ?? <strong>?CHEC</strong><br>

            ${formatNumber(
              state.forgeResult
                .items_consumed
            )}
            objets d?truits.
          </div>
        `
  }

  return `
    <div class="rpg-forge-rules-v2">
      <div>
        <strong>10</strong>
        <span>
          L?gendaires ? Mythique
        </span>
      </div>

      <div>
        <strong>5</strong>
        <span>
          Mythiques ? URM
        </span>
      </div>

      <div>
        <strong>2</strong>
        <span>
          URM ? Abyssal
        </span>
      </div>
    </div>

    <div class="rpg-forge-warning-v2">
      ?? Le r?sultat est d?cid?
      directement par le serveur.

      En cas d'?chec,
      les objets sacrifi?s sont perdus.
    </div>

    <div class="rpg-forge-groups-v2">
      ${cards}
    </div>

    ${result}
  `
}

function casinoReels(
  outcome = ''
) {
  const reels = {
    jackpot:
      ['??', '??', '??'],

    bonus:
      ['??', '??', '??'],

    x10:
      ['??', '??', '??'],

    x5:
      ['??', '??', '??'],

    x2:
      ['??', '??', '??'],

    x1:
      ['??', '??', '??'],

    loss:
      ['??', '7??', '??'],
  }

  return (
    reels[
      String(
        outcome || ''
      ).toLowerCase()
    ] ||
    ['??', '??', '??']
  )
}

function casinoHtml({
  progress,
  canEdit,
  state,
}) {
  const gold =
    Math.max(
      0,
      Math.floor(
        n(
          progress?.gold_balance
        )
      )
    )

  const free =
    Math.max(
      0,
      Math.floor(
        n(
          state.casinoState
            ?.free_spins_remaining
        )
      )
    )

  const lockedBet =
    Math.max(
      0,
      Math.floor(
        n(
          state.casinoState
            ?.free_spin_bet
        )
      )
    )

  const bet =
    free > 0
      ? lockedBet
      : Math.max(
          1,
          Math.floor(
            n(
              state.casinoBet,
              1000
            )
          )
        )

  const reels =
    casinoReels(
      state.casinoResult
        ?.outcome
    )

  let resultText =
    'Mise ton Gold et tente la roue.'

  const result =
    state.casinoResult

  if (result) {
    const outcome =
      String(
        result.outcome || ''
      ).toLowerCase()

    if (
      outcome === 'jackpot'
    ) {
      resultText =
        `?? JACKPOT ? +${formatNumber(
          result.payout
        )} Gold`
    } else if (
      outcome === 'bonus'
    ) {
      resultText =
        `?? BONUS ? ${formatNumber(
          result.free_spins_awarded
        )} free spins`
    } else if (
      n(
        result.payout
      ) > 0
    ) {
      resultText =
        `?? Gain : ${formatNumber(
          result.payout
        )} Gold`
    } else {
      resultText =
        '?? Perdu. Le nain rigole.'
    }
  }

  const disabled =
    !canEdit ||
    state.casinoBusy ||
    state.casinoReady === false ||
    (
      free <= 0 &&
      (
        bet < 1 ||
        bet > gold
      )
    )

  return `
    <div class="rpg-casino-machine-v2">
      <div class="rpg-casino-head-v2">
        <strong>
          ?? Casino Gold
        </strong>

        <span>
          Solde :
          ${formatNumber(gold)}
          ??
        </span>
      </div>

      ${
        free > 0
          ? `
            <div class="rpg-casino-free-v2">
              ?? ${free} FREE SPINS
            </div>
          `
          : ''
      }

      <div class="rpg-casino-reels-v2">
        ${reels.map(
          reel => `
            <div class="rpg-casino-reel-v2">
              ${reel}
            </div>
          `
        ).join('')}
      </div>

      <div class="rpg-casino-result-v2">
        ${esc(
          resultText
        )}
      </div>

      <div class="rpg-casino-bet-v2">
        <input
          type="number"
          min="1"
          step="1"
          value="${bet}"
          data-rpg-casino-bet-v2
          ${
            free > 0 ||
            state.casinoBusy
              ? 'disabled'
              : ''
          }
        >

        <button
          type="button"
          data-rpg-casino-spin-v2
          ${
            disabled
              ? 'disabled'
              : ''
          }
        >
          ${
            state.casinoBusy
              ? 'TING TING?'
              : free > 0
                ? `?? JOUER (${free})`
                : 'SPIN'
          }
        </button>
      </div>

      <div class="rpg-casino-presets-v2">
        ${
          [
            1000,
            10000,
            100000,
            1000000,
          ].map(
            value => `
              <button
                type="button"
                data-rpg-casino-preset-v2="${value}"
                ${
                  free > 0 ||
                  state.casinoBusy
                    ? 'disabled'
                    : ''
                }
              >
                ${formatNumber(
                  value
                )}
              </button>
            `
          ).join('')
        }
      </div>

      ${
        state.casinoReady === false
          ? `
            <div class="rpg-casino-error-v2">
              ?? ${esc(
                state.casinoError
              )}
            </div>
          `
          : ''
      }
    </div>
  `
}

export function renderRpgForge({
  athleteSlug,
  progress,
  inventory = [],
  canEdit = false,
  state,
}) {
  syncRpgForgeState(
    state,
    athleteSlug
  )

  return `
    <section class="rpg-dwarf-workshop-v2">
      <header class="rpg-dwarf-head-v2">
        <div class="rpg-dwarf-avatar-v2">
          ???????
        </div>

        <div>
          <strong>
            Le Nain Forgeron
          </strong>

          <p>
            ? Donne-moi tes reliques?
            ou ton Gold.
            Le m?tal et la roue d?cideront. ?
          </p>
        </div>
      </header>

      <div class="rpg-dwarf-tabs-v2">
        <button
          type="button"
          data-rpg-dwarf-mode-v2="forge"
          class="${
            state.mode === 'forge'
              ? 'active'
              : ''
          }"
        >
          ?? Forge d'?quipement
        </button>

        <button
          type="button"
          data-rpg-dwarf-mode-v2="casino"
          class="${
            state.mode === 'casino'
              ? 'active'
              : ''
          }"
        >
          ?? Casino Gold
        </button>
      </div>

      <div class="rpg-dwarf-body-v2">
        ${
          state.mode === 'casino'
            ? casinoHtml({
                progress,
                canEdit,
                state,
              })
            : forgeHtml({
                inventory,
                canEdit,
                state,
              })
        }
      </div>
    </section>
  `
}

export function setRpgCasinoBet({
  athleteSlug,
  state,
  value,
}) {
  syncRpgForgeState(
    state,
    athleteSlug
  )

  state.casinoBet =
    Math.max(
      1,
      Math.floor(
        n(
          value,
          1
        )
      )
    )

  localStorage.setItem(
    betKey(
      athleteSlug
    ),
    String(
      state.casinoBet
    )
  )
}

export async function handleRpgForgeAction({
  target,
  athleteSlug,
  state,
  canEdit = false,
}) {
  syncRpgForgeState(
    state,
    athleteSlug
  )

  const modeButton =
    target.closest(
      '[data-rpg-dwarf-mode-v2]'
    )

  if (modeButton) {
    state.mode =
      modeButton.dataset
        .rpgDwarfModeV2 ===
        'casino'
        ? 'casino'
        : 'forge'

    localStorage.setItem(
      modeKey(
        athleteSlug
      ),
      state.mode
    )

    if (
      state.mode === 'casino'
    ) {
      await loadRpgCasinoState({
        athleteSlug,
        state,
      })
    }

    return {
      handled: true,
      refresh: false,
    }
  }

  const preset =
    target.closest(
      '[data-rpg-casino-preset-v2]'
    )

  if (preset) {
    setRpgCasinoBet({
      athleteSlug,
      state,

      value:
        preset.dataset
          .rpgCasinoPresetV2,
    })

    return {
      handled: true,
      refresh: false,
    }
  }

  const forgeButton =
    target.closest(
      '[data-rpg-forge-v2]'
    )

  if (forgeButton) {
    if (
      !canEdit ||
      state.forgeBusy
    ) {
      return {
        handled: true,
        refresh: false,
      }
    }

    const rarity =
      forgeButton.dataset
        .rpgForgeRarityV2

    const level =
      Math.max(
        1,
        Math.floor(
          n(
            forgeButton.dataset
              .rpgForgeLevelV2,
            1
          )
        )
      )

    const rule =
      FORGE_RULES[
        rarity
      ]

    if (!rule) {
      return {
        handled: true,
        refresh: false,
      }
    }

    const confirmed =
      window.confirm(
        `Sacrifier ${rule.required} objets ${rule.sourceLabel} niveau ${level} pour tenter de cr?er 1 ${rule.targetLabel} niveau ${level} ?

En cas d'?chec, le lot est perdu.`
      )

    if (!confirmed) {
      return {
        handled: true,
        refresh: false,
      }
    }

    state.forgeBusy = true
    state.forgeResult = null

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'forge_rpg_items_v185',
        {
          p_athlete_slug:
            athleteSlug,

          p_rarity:
            rarity,

          p_item_level:
            level,
        }
      )

    state.forgeBusy = false

    if (error) {
      throw error
    }

    state.forgeResult =
      Array.isArray(data)
        ? data[0]
        : data

    return {
      handled: true,
      refresh: true,
    }
  }

  const spinButton =
    target.closest(
      '[data-rpg-casino-spin-v2]'
    )

  if (spinButton) {
    if (
      !canEdit ||
      state.casinoBusy
    ) {
      return {
        handled: true,
        refresh: false,
      }
    }

    state.casinoBusy = true

    const free =
      Math.max(
        0,
        Math.floor(
          n(
            state.casinoState
              ?.free_spins_remaining
          )
        )
      )

    const lockedBet =
      Math.max(
        1,
        Math.floor(
          n(
            state.casinoState
              ?.free_spin_bet,
            state.casinoBet
          )
        )
      )

    const bet =
      free > 0
        ? lockedBet
        : state.casinoBet

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'rpg_casino_spin_v185',
        {
          p_athlete_slug:
            athleteSlug,

          p_bet:
            bet,
        }
      )

    state.casinoBusy = false

    if (error) {
      throw error
    }

    const row =
      Array.isArray(data)
        ? data[0]
        : data

    state.casinoResult =
      row || null

    state.casinoReady = true
    state.casinoError = ''

    state.casinoState = {
      free_spins_remaining:
        Math.max(
          0,
          Math.floor(
            n(
              row?.free_spins_remaining
            )
          )
        ),

      free_spin_bet:
        Math.max(
          0,
          Math.floor(
            n(
              row?.free_spin_bet
            )
          )
        ),
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

export {
  FORGE_RULES,
}
