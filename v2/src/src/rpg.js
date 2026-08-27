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

function classProfileHtml(
  progress
) {
  const def =
    CLASS_DEFS[
      progress.rpg_class
    ]

  if (!def) {
    return ''
  }

  return `
    <section class="rpg-section">
      <div class="rpg-section-title">
        Classe de combat
      </div>

      <div class="rpg-profile">
        <div class="rpg-avatar">
          ${def.icon}
        </div>

        <div>
          <strong>
            ${esc(def.title)}
          </strong>

          <span>
            ${esc(def.subtitle)}
          </span>

          <small>
            ${esc(def.perk)}
          </small>
        </div>
      </div>

      <div class="rpg-stat-grid">
        <div class="rpg-stat">
          <b>
            ${format(
              progress.stat_power,
              1
            )}
          </b>

          <span>
            ${esc(def.mainStat)}
          </span>
        </div>

        <div class="rpg-stat">
          <b>
            ${format(
              progress.stat_mastery,
              1
            )}
          </b>

          <span>
            ${esc(def.masteryStat)}
          </span>
        </div>

        <div class="rpg-stat">
          <b>
            ${format(
              progress.stat_fortune,
              1
            )}
          </b>

          <span>
            Fortune
          </span>
        </div>
      </div>

      <div class="rpg-record">
        <span>
          Victoires
          <b>
            ${format(
              progress.combat_wins
            )}
          </b>
        </span>

        <span>
          Défaites
          <b>
            ${format(
              progress.combat_losses
            )}
          </b>
        </span>

        <span>
          Boss
          <b>
            ${format(
              progress.boss_wins
            )}
          </b>
        </span>
      </div>
    </section>
  `
}

function progressionHtml(
  progress,
  canEdit
) {
  const xp =
    number(
      progress.xp_total
    )

  const calculated =
    xpProgressFromTotal(xp)

  const level =
    Math.max(
      1,
      number(
        progress.level,
        1
      ),
      calculated.level
    )

  const pct =
    Math.min(
      100,
      Math.max(
        0,
        calculated.into /
          calculated.cost *
          100
      )
    )

  return `
    <section class="rpg-hero">
      <div>
        <span>
          NIVEAU
        </span>

        <strong>
          ${level}
        </strong>
      </div>

      <div>
        <span>
          XP TOTAL
        </span>

        <strong>
          ${format(xp, 1)}
        </strong>
      </div>

      <div>
        <span>
          GOLD
        </span>

        <strong>
          🪙 ${format(
            progress.gold_balance
          )}
        </strong>
      </div>
    </section>

    <section class="rpg-xp-card">
      <div class="rpg-xp-head">
        <span>
          Niveau ${level}
        </span>

        <span>
          ${format(
            calculated.into,
            1
          )}
          /
          ${format(
            calculated.cost,
            1
          )} XP
        </span>
      </div>

      <div class="rpg-xp-bar">
        <span
          style="width:${pct}%"
        ></span>
      </div>

      <div class="rpg-mini-stats">
        <span>
          GL
          <b>
            ${format(
              progress.gl_points,
              1
            )}
          </b>
        </span>

        <span>
          Coeff.
          <b>
            ×${format(
              progress.gl_multiplier,
              2
            )}
          </b>
        </span>

        <span>
          Packs
          <b>
            ${format(
              progress.unopened_packs
            )}
          </b>
        </span>
      </div>
    </section>

    ${
      progress.rpg_class
        ? classProfileHtml(
            progress
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
          <span>
            Difficulté
          </span>

          <b>
            ${format(
              progress.adventure_difficulty,
              0
            )}
          </b>
        </div>

        <div>
          <span>
            Accès boss
          </span>

          <b>
            ${format(
              progress.kills_toward_boss,
              0
            )}/50
          </b>
        </div>

        <div>
          <span>
            Ultra cases raid
          </span>

          <b>
            ${format(
              progress.raid_ultra_cases,
              0
            )}
          </b>
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
  let activeTab =
    'progression'
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
          canEdit()
        )}

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
        ${renderRpgEquipment({
          progress,
          inventory,

          canEdit:
            canEdit(),
        })}

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

        <nav class="rpg-tabs">
          <button
            data-rpg-tab="progression"
            class="${
              activeTab ===
              'progression'
                ? 'active'
                : ''
            }"
          >
            ⚡ Progression
          </button>

          <button
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
            data-rpg-tab="cases"
            class="${
              activeTab ===
              'cases'
                ? 'active'
                : ''
            }"
          >
            📦 Cases
          </button>

          <button
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

        <div class="rpg-content">
          ${content}
        </div>
      </main>
    `
  }

  async function loadSelected() {
    if (!selectedSlug) {
      renderSelector()
      return
    }

    root.innerHTML = `
      <main class="rpg-page">
        <div class="rpg-loading">
          Chargement du RPG...
        </div>
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
          loadRpgCollections(
            selectedSlug,
            collectionState,
            inventory
          ),
        ])

      progress =
        nextProgress

      inventory =
        nextInventory

      /* RPG RAID INITIAL LOAD V2 */
      await loadRpgRaidState({
        athleteSlug:
          selectedSlug,
        state:
          raidState,
      })

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

          <div class="rpg-error">
            Impossible de charger la progression RPG.
            <small>
              ${esc(
                error?.message ||
                ''
              )}
            </small>
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

          window.alert(
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

          window.alert(
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

          window.alert(
            error?.message ||
            'Impossible de lancer le combat.'
          )
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
        const result =
          await handleRpgEquipmentAction({
            element:
              equipmentAction,

            athleteSlug:
              selectedSlug,

            canEdit:
              canEdit(),
          })

        if (
          result?.refresh
        ) {
          await loadSelected()
        }

        return
      }

      const caseAction =
        event.target.closest(
          '[data-rpg-case-open], [data-rpg-raid-open]'
        )

      if (caseAction) {
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

        return
      }

      const collectionAction =
        event.target.closest(
          '[data-rpg-collection-tab], [data-rpg-deposit-item], [data-rpg-deposit-all]'
        )

      if (collectionAction) {
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

        if (
          result?.refresh
        ) {
          await loadSelected()
        } else {
          renderProfile()
        }

        return
      }

      const tab =
        event.target.closest(
          '[data-rpg-tab]'
        )

      if (tab) {
        activeTab =
          tab.dataset.rpgTab

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
          window.alert(
            `Choix impossible : ${error.message}`
          )

          classButton.disabled =
            false

          return
        }

        await loadSelected()
      }
    }

  await loadSelected()
}
