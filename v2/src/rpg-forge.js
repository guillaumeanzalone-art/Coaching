import { supabase } from './supabase.js'

const FORGE_RULES = Object.freeze({
  legendary: {
    required: 10,
    target: 'mythic',
    sourceLabel: 'Légendaire',
    targetLabel: 'Mythique',
    icon: '🔥',
  },

  mythic: {
    required: 5,
    target: 'ultra_mythic',
    sourceLabel: 'Mythique',
    targetLabel: 'URM',
    icon: '🌌',
  },

  ultra_mythic: {
    required: 2,
    target: 'abyssal',
    sourceLabel: 'URM',
    targetLabel: 'Abyssal',
    icon: '🕳️',
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

            const pct =
              Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    (
                      group.quantity /
                      rule.required
                    ) *
                    100
                  )
                )
              )

            return `
              <article class="rpg-forge-group-v2 rarity-${esc(
                group.rarity
              )} ${enough ? 'is-ready' : ''}">
                <div class="rpg-forge-group-main-v31">
                  <div class="rpg-forge-group-title-v31">
                    <span class="rpg-forge-rarity-orb-v31"></span>

                    <div>
                      <strong>
                        ${rule.icon}
                        ${esc(
                          rule.sourceLabel
                        )}
                        <span>
                          niv. ${group.level}
                        </span>
                      </strong>

                      <small>
                        → ${esc(
                          rule.targetLabel
                        )}
                        niv. ${group.level}
                      </small>
                    </div>

                    <b class="rpg-forge-ready-v31">
                      ${
                        enough
                          ? 'PRÊT'
                          : `${group.quantity}/${rule.required}`
                      }
                    </b>
                  </div>

                  <div class="rpg-forge-progress-v31">
                    <span
                      style="width:${pct}%"
                    ></span>
                  </div>

                  <div class="rpg-forge-group-meta-v31">
                    <span>
                      ${group.quantity}
                      objets disponibles
                    </span>

                    <span>
                      ${rule.required}
                      consommés / tentative
                    </span>
                  </div>

                  <small class="rpg-forge-exclusion-v31">
                    🔒 Équipés et verrouillés exclus ·
                    même rareté et même niveau obligatoires
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
                      ? '⚒️ FORGE…'
                      : `⚒️ Forger ×${rule.required}`
                  }
                </button>
              </article>
            `
          }
        ).join('')
      : `
          <div class="rpg-forge-empty-v2">
            <strong>⚒️ Aucun lot forgeable</strong>
            <span>
              Il faut des objets Légendaires,
              Mythiques ou URM de même niveau,
              non équipés et non verrouillés.
            </span>
          </div>
        `

  let result = ''

  if (
    state.forgeResult
  ) {
    const resultLevel =
      Math.max(
        1,
        Math.floor(
          n(
            state.forgeResult
              .item_level,
            1
          )
        )
      )

    result =
      state.forgeResult.success
        ? `
          <div class="rpg-forge-result-v2 success">
            <div class="rpg-forge-result-icon-v31">
              ✨
            </div>

            <div>
              <strong>
                FORGE RÉUSSIE
              </strong>

              <span>
                ${esc(
                  state.forgeResult
                    .result_item_name ||
                  state.forgeResult
                    .target_rarity ||
                  'Objet supérieur'
                )}
              </span>

              <small>
                Niveau ${resultLevel} ·
                objet ajouté à l'inventaire
              </small>
            </div>
          </div>
        `
        : `
          <div class="rpg-forge-result-v2 fail">
            <div class="rpg-forge-result-icon-v31">
              💥
            </div>

            <div>
              <strong>
                FORGE ÉCHOUÉE
              </strong>

              <span>
                ${formatNumber(
                  state.forgeResult
                    .items_consumed
                )}
                objets détruits
              </span>

              <small>
                Le lot sacrifié est définitivement perdu.
              </small>
            </div>
          </div>
        `
  }

  return `
    <div class="rpg-forge-rules-v2">
      <div class="rarity-legendary">
        <strong>🔥 10</strong>
        <span>
          Légendaires
        </span>
        <b>→ Mythique</b>
      </div>

      <div class="rarity-mythic">
        <strong>🌌 5</strong>
        <span>
          Mythiques
        </span>
        <b>→ URM</b>
      </div>

      <div class="rarity-ultra_mythic">
        <strong>🕳️ 2</strong>
        <span>
          URM
        </span>
        <b>→ Abyssal</b>
      </div>
    </div>

    <div class="rpg-forge-warning-v2">
      <strong>
        ⚠️ 1 échec sur 8
      </strong>

      <span>
        Le serveur décide du résultat.
        En cas d'échec, tout le lot est détruit.
        Le niveau obtenu reste identique.
      </span>
    </div>

    ${result}

    <div class="rpg-forge-groups-head-v31">
      <strong>
        Lots disponibles
      </strong>

      <span>
        ${
          groups.filter(
            group =>
              group.quantity >=
              FORGE_RULES[
                group.rarity
              ].required
          ).length
        }
        prêt(s)
      </span>
    </div>

    <div class="rpg-forge-groups-v2">
      ${cards}
    </div>
  `
}

function casinoReels(
  outcome = ''
) {
  const reels = {
    jackpot:
      ['💎', '💎', '💎'],

    bonus:
      ['🎁', '🎁', '🎁'],

    x10:
      ['👑', '👑', '👑'],

    x5:
      ['🔥', '🔥', '🔥'],

    x2:
      ['⚡', '⚡', '⚡'],

    x1:
      ['🪙', '🪙', '🪙'],

    loss:
      ['🍒', '7️⃣', '💀'],
  }

  return (
    reels[
      String(
        outcome || ''
      ).toLowerCase()
    ] ||
    ['❔', '❔', '❔']
  )
}

function setCasinoBusyVisualV13A(
  busy
) {
  const machine =
    document.querySelector(
      '.rpg-casino-machine-v2'
    )

  if (machine) {
    machine.classList
      .toggle(
        'is-spinning',
        !!busy
      )
  }
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

  const result =
    state.casinoResult

  const outcome =
    String(
      result?.outcome || ''
    ).toLowerCase()

  const payout =
    Math.max(
      0,
      Math.floor(
        n(
          result?.payout
        )
      )
    )

  const multiplier =
    bet > 0 &&
    payout > 0
      ? payout / bet
      : 0

  let resultText =
    'Mise ton Gold et tente la roue.'

  let resultSub =
    'Les probabilités sont décidées côté serveur.'

  if (result) {
    if (
      outcome === 'jackpot'
    ) {
      resultText =
        `💎 JACKPOT · +${formatNumber(
          payout
        )} Gold`

      resultSub =
        multiplier > 0
          ? `Gain ×${Math.round(
              multiplier
            ).toLocaleString(
              'fr-FR'
            )} la mise`
          : 'Max Win déclenché'
    } else if (
      outcome === 'bonus'
    ) {
      resultText =
        `🔥 BONUS · ${formatNumber(
          result.free_spins_awarded ||
          free
        )} free spins`

      resultSub =
        'La mise reste verrouillée pendant le bonus.'
    } else if (
      payout > 0
    ) {
      resultText =
        `🪙 +${formatNumber(
          payout
        )} Gold`

      resultSub =
        multiplier > 0
          ? `Retour ×${multiplier.toLocaleString(
              'fr-FR',
              {
                maximumFractionDigits: 2,
              }
            )}`
          : 'Spin gagnant'
    } else {
      resultText =
        '💀 Aucun gain'

      resultSub =
        'La prochaine rotation est indépendante.'
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

  const balanceAfter =
    result?.gold_after ===
      undefined
      ? gold
      : Math.max(
          0,
          Math.floor(
            n(
              result.gold_after,
              gold
            )
          )
        )

  return `
    <div class="rpg-casino-machine-v2 ${outcome ? `outcome-${esc(outcome)}` : ''}">
      <div class="rpg-casino-head-v2">
        <div>
          <strong>
            🎰 Gold Slot
          </strong>

          <small>
            RTP cible 95 %
          </small>
        </div>

        <span>
          🪙 ${formatNumber(
            balanceAfter
          )}
        </span>
      </div>

      <div class="rpg-casino-math-v31">
        <div>
          <span>
            🎁 Bonus
          </span>
          <strong>
            1 / 400
          </strong>
        </div>

        <div>
          <span>
            💎 Max Win
          </span>
          <strong>
            1 / 3 000
          </strong>
        </div>

        <div>
          <span>
            🔥 Max Win bonus
          </span>
          <strong>
            1 / 200
          </strong>
        </div>
      </div>

      ${
        free > 0
          ? `
            <div class="rpg-casino-free-v2">
              <strong>
                🔥 BONUS ACTIF
              </strong>

              <span>
                ${free}
                free spin${free > 1 ? 's' : ''}
                restant${free > 1 ? 's' : ''}
                · mise verrouillée :
                ${formatNumber(
                  lockedBet
                )}
              </span>
            </div>
          `
          : ''
      }

      <div class="rpg-casino-reels-frame-v31">
        <div class="rpg-casino-payline-v31"></div>

        <div class="rpg-casino-reels-v2">
          ${reels.map(
            reel => `
              <div class="rpg-casino-reel-v2">
                <span>
                  ${reel}
                </span>
              </div>
            `
          ).join('')}
        </div>
      </div>

      <div class="rpg-casino-result-v2">
        <strong>
          ${esc(
            resultText
          )}
        </strong>

        <span>
          ${esc(
            resultSub
          )}
        </span>
      </div>

      <div class="rpg-casino-bet-label-v31">
        <span>
          Mise
        </span>

        ${
          free <= 0 &&
          bet > gold
            ? `
              <b>
                Gold insuffisant
              </b>
            `
            : `
              <b>
                ${formatNumber(
                  bet
                )} 🪙
              </b>
            `
        }
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
              ? '🎰 TING TING…'
              : free > 0
                ? `🔥 FREE SPIN (${free})`
                : '🎰 SPIN'
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
                class="${
                  free <= 0 &&
                  bet === value
                    ? 'active'
                    : ''
                }"
                ${
                  free > 0 ||
                  state.casinoBusy ||
                  value > gold
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
              <strong>
                ⚠️ Casino indisponible
              </strong>

              <span>
                ${esc(
                  state.casinoError
                )}
              </span>
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
          <svg
            class="rpg-dwarf-svg-v13a"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            <path
              d="M15 28c1-14 8-21 17-21s16 7 17 21"
              fill="#9b5e23"
              stroke="#f0c44d"
              stroke-width="2"
            />
            <path
              d="M12 28h40l-5 8H17z"
              fill="#d58a31"
            />
            <circle
              cx="32"
              cy="34"
              r="12"
              fill="#e2a06d"
            />
            <circle
              cx="27"
              cy="33"
              r="1.5"
              fill="#121722"
            />
            <circle
              cx="37"
              cy="33"
              r="1.5"
              fill="#121722"
            />
            <path
              d="M21 39c3 17 19 21 22 0-5 4-17 4-22 0z"
              fill="#a85b28"
            />
            <path
              d="M46 15l4-4 3 3-4 4 8 8-4 4-8-8-4 4-3-3 4-4z"
              fill="#c5cedb"
              stroke="#596579"
              stroke-width="1"
            />
          </svg>
        </div>

        <div>
          <strong>
            Le Nain Forgeron
          </strong>

          <p>
            « Donne-moi tes reliques…
            ou ton Gold.
            Le métal et la roue décideront. »
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
          ⚒️ Forge d'équipement
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
          🎰 Casino Gold
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
        `Sacrifier ${rule.required} objets ${rule.sourceLabel} niveau ${level} pour tenter de créer 1 ${rule.targetLabel} niveau ${level} ?

En cas d'échec, le lot est perdu.`
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

    setCasinoBusyVisualV13A(
      true
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

    setCasinoBusyVisualV13A(
      false
    )

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
