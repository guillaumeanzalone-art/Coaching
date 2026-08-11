import { supabase } from './supabase.js'

const CLASS_LABELS = {
  warrior: 'Guerrier',
  archer: 'Archer',
  mage: 'Mage',
}

const SORTS = [
  ['global', '🌟 Global'],
  ['difficulty', '🗺️ Palier max'],
  ['damage', '💥 Dégâts'],
  ['items', '🎴 Objets'],
  ['monsters', '👾 Monstres'],
  ['monolith', '🗿 Monolithe'],
]

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function fr(value, digits = 0) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: digits,
  }).format(n(value))
}

function big(value) {
  try {
    if (typeof value === 'bigint') return value
    const raw = String(value ?? '0').trim()
    if (!raw) return 0n
    if (/^-?\d+$/.test(raw)) return BigInt(raw)
    return BigInt(Math.floor(n(value)))
  } catch {
    return 0n
  }
}

function formatHuge(value) {
  const amount = big(value)
  try {
    return amount.toLocaleString('fr-FR')
  } catch {
    return String(amount)
  }
}

function itemScore(row) {
  return n(row?.mythic_item_drops)
    + n(row?.ultra_mythic_item_drops) * 6
    + n(row?.abyssal_item_drops) * 30
}

function monsterScore(row) {
  return n(row?.mythic_monster_kills)
    + n(row?.ultra_mythic_monster_kills) * 6
    + n(row?.abyssal_monster_kills) * 30
}

function sortValue(row, mode) {
  if (mode === 'difficulty') return n(row?.adventure_difficulty)
  if (mode === 'items') return itemScore(row)
  if (mode === 'monsters') return monsterScore(row)
  if (mode === 'damage') return big(row?.total_damage)
  if (mode === 'monolith') return big(row?.monolith_best_damage_30s)
  return n(row?.global_score)
}

function sortedRows(state) {
  const mode = state.sort || 'global'
  return [...state.rows].sort((a, b) => {
    const av = sortValue(a, mode)
    const bv = sortValue(b, mode)

    if (typeof av === 'bigint' || typeof bv === 'bigint') {
      const abi = typeof av === 'bigint' ? av : BigInt(Math.floor(n(av)))
      const bbi = typeof bv === 'bigint' ? bv : BigInt(Math.floor(n(bv)))
      if (abi !== bbi) return abi > bbi ? -1 : 1
    } else if (av !== bv) {
      return bv - av
    }

    return String(a?.display_name || a?.athlete_slug || '')
      .localeCompare(
        String(b?.display_name || b?.athlete_slug || ''),
        'fr'
      )
  })
}

function primaryValue(row, mode) {
  if (mode === 'difficulty') {
    return `Palier ${n(row?.adventure_difficulty, 1)}`
  }
  if (mode === 'damage') {
    return `${formatHuge(row?.total_damage)} dégâts`
  }
  if (mode === 'items') {
    return `${itemScore(row)} pts objets`
  }
  if (mode === 'monsters') {
    return `${monsterScore(row)} pts monstres`
  }
  if (mode === 'monolith') {
    return `${formatHuge(row?.monolith_best_damage_30s)} dégâts / 30 s`
  }
  return `${fr(row?.global_score)} pts`
}

function installStyles() {
  if (document.getElementById('rpgLeaderboardV2Styles')) return

  const style = document.createElement('style')
  style.id = 'rpgLeaderboardV2Styles'
  style.textContent = `
    .rpg-leaderboard-v2{display:grid;gap:12px}
    .rpg-leaderboard-head-v2{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025)}
    .rpg-leaderboard-head-v2 h3{margin:0;font-size:16px}
    .rpg-leaderboard-head-v2 p{margin:5px 0 0;color:var(--muted,#93a0b7);font-size:11px;line-height:1.45}
    .rpg-leaderboard-refresh-v2,.rpg-leaderboard-sort-v2{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:inherit;border-radius:10px;font:inherit;font-weight:800;cursor:pointer}
    .rpg-leaderboard-refresh-v2{padding:9px 11px;white-space:nowrap}
    .rpg-leaderboard-refresh-v2:disabled{opacity:.5;cursor:wait}
    .rpg-leaderboard-sorts-v2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .rpg-leaderboard-sort-v2{padding:9px 5px;font-size:10px}
    .rpg-leaderboard-sort-v2.active{border-color:rgba(212,51,91,.55);background:rgba(154,22,54,.28);box-shadow:0 0 0 1px rgba(212,51,91,.12) inset}
    .rpg-leaderboard-podium-v2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:end}
    .rpg-podium-card-v2{min-width:0;text-align:center;padding:14px 7px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02))}
    .rpg-podium-card-v2.place-1{padding-top:20px;padding-bottom:20px;transform:translateY(-4px)}
    .rpg-podium-rank-v2{font-size:24px}
    .rpg-podium-card-v2 strong,.rpg-podium-card-v2 span{display:block;overflow:hidden;text-overflow:ellipsis}
    .rpg-podium-card-v2 strong{margin-top:5px;font-size:12px;white-space:nowrap}
    .rpg-podium-card-v2 span{margin-top:4px;color:var(--muted,#93a0b7);font-size:9px}
    .rpg-leaderboard-table-v2{display:grid;gap:8px}
    .rpg-leaderboard-row-v2{display:grid;grid-template-columns:34px minmax(95px,1.1fr) minmax(90px,1fr);gap:9px;align-items:center;padding:11px;border-radius:14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)}
    .rpg-leaderboard-row-v2.me{border-color:rgba(202,44,82,.42);background:linear-gradient(135deg,rgba(127,18,46,.18),rgba(255,255,255,.025))}
    .rpg-leaderboard-rank-v2{font-weight:950;font-size:11px;color:var(--muted,#93a0b7)}
    .rpg-leaderboard-athlete-v2,.rpg-leaderboard-main-v2{min-width:0}
    .rpg-leaderboard-athlete-v2 strong,.rpg-leaderboard-main-v2 strong{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis}
    .rpg-leaderboard-athlete-v2 small,.rpg-leaderboard-main-v2 small{display:block;margin-top:3px;color:var(--muted,#93a0b7);font-size:8px;line-height:1.35}
    .rpg-leaderboard-details-v2{grid-column:2 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding-top:7px;border-top:1px solid rgba(255,255,255,.05);font-size:8px;color:var(--muted,#93a0b7)}
    .rpg-leaderboard-details-v2 b{color:var(--text,#fff)}
    .rpg-leaderboard-empty-v2{padding:28px 14px;text-align:center;color:var(--muted,#93a0b7);border:1px dashed rgba(255,255,255,.09);border-radius:15px;font-size:11px}
    .rpg-leaderboard-updated-v2{text-align:center;color:var(--muted,#93a0b7);font-size:8px}
    @media(max-width:620px){
      .rpg-leaderboard-sorts-v2{grid-template-columns:repeat(2,minmax(0,1fr))}
      .rpg-leaderboard-row-v2{grid-template-columns:30px minmax(0,1fr)}
      .rpg-leaderboard-main-v2{grid-column:2}
      .rpg-leaderboard-details-v2{grid-column:1 / -1}
    }
  `
  document.head.appendChild(style)
}

export function createRpgLeaderboardState() {
  return {
    rows: [],
    busy: false,
    error: '',
    loadedAt: null,
    sort: localStorage.getItem('rpg_leaderboard_sort_v155') || 'global',
  }
}

export async function loadRpgLeaderboard({
  state,
  force = false,
} = {}) {
  if (!state || state.busy) return state
  if (!force && state.rows.length) return state

  state.busy = true
  state.error = ''

  try {
    const [rpgResponse, monolithResponse] = await Promise.all([
      supabase.rpc('get_rpg_leaderboard_v155'),
      supabase.rpc('get_rpg_monolith_leaderboard_v168'),
    ])

    if (rpgResponse?.error) {
      throw new Error(
        `Leaderboard indisponible : ${rpgResponse.error.message}`
      )
    }

    const baseRows = Array.isArray(rpgResponse?.data)
      ? rpgResponse.data
      : rpgResponse?.data
        ? [rpgResponse.data]
        : []

    const monolithRows = Array.isArray(monolithResponse?.data)
      ? monolithResponse.data
      : monolithResponse?.data
        ? [monolithResponse.data]
        : []

    const monolithBySlug = new Map(
      monolithRows.map(row => [
        String(row?.athlete_slug || ''),
        row,
      ])
    )

    state.rows = baseRows.map(row => {
      const mono = monolithBySlug.get(
        String(row?.athlete_slug || '')
      ) || {}

      return {
        ...row,
        monolith_best_damage_30s:
          mono.best_damage_30s ?? 0,
        monolith_attempts:
          mono.attempts ?? 0,
        monolith_last_attempt_at:
          mono.last_attempt_at ?? null,
      }
    })

    for (const mono of monolithRows) {
      if (
        state.rows.some(
          row => row.athlete_slug === mono.athlete_slug
        )
      ) {
        continue
      }

      state.rows.push({
        athlete_slug: mono.athlete_slug,
        display_name: mono.display_name,
        rpg_class: mono.rpg_class,
        level: mono.level ?? 1,
        adventure_difficulty:
          mono.adventure_difficulty ?? 1,
        total_damage: '0',
        best_combat_damage: '0',
        boss_wins: 0,
        mythic_item_drops: 0,
        ultra_mythic_item_drops: 0,
        abyssal_item_drops: 0,
        mythic_monster_kills: 0,
        ultra_mythic_monster_kills: 0,
        abyssal_monster_kills: 0,
        global_score: 0,
        monolith_best_damage_30s:
          mono.best_damage_30s ?? 0,
        monolith_attempts:
          mono.attempts ?? 0,
        monolith_last_attempt_at:
          mono.last_attempt_at ?? null,
      })
    }

    if (monolithResponse?.error) {
      state.error =
        `Classement Monolithe indisponible : ${monolithResponse.error.message}`
    }

    state.loadedAt = new Date()
  } catch (error) {
    state.error =
      error?.message ||
      'Classement indisponible'
  } finally {
    state.busy = false
  }

  return state
}

export function renderRpgLeaderboard({
  state,
  selectedSlug = '',
} = {}) {
  installStyles()

  if (!state) {
    return ''
  }

  const sorts = SORTS
    .map(([key, label]) => `
      <button
        type="button"
        class="rpg-leaderboard-sort-v2 ${state.sort === key ? 'active' : ''}"
        data-rpg-leaderboard-sort-v2="${key}"
      >
        ${label}
      </button>
    `)
    .join('')

  if (state.busy && !state.rows.length) {
    return `
      <section class="rpg-leaderboard-v2">
        <div class="rpg-leaderboard-head-v2">
          <div>
            <h3>🏆 Leaderboard RPG</h3>
            <p>Chargement du classement...</p>
          </div>
        </div>
        <div class="rpg-leaderboard-empty-v2">
          Chargement...
        </div>
      </section>
    `
  }

  if (state.error && !state.rows.length) {
    return `
      <section class="rpg-leaderboard-v2">
        <div class="rpg-leaderboard-head-v2">
          <div>
            <h3>🏆 Leaderboard RPG</h3>
            <p>Classement chargé à la demande.</p>
          </div>
          <button
            type="button"
            class="rpg-leaderboard-refresh-v2"
            data-rpg-leaderboard-refresh-v2
          >
            Réessayer
          </button>
        </div>
        <div class="rpg-leaderboard-empty-v2">
          ${esc(state.error)}
        </div>
      </section>
    `
  }

  const rows = sortedRows(state)
  const podiumIcons = ['🥇', '🥈', '🥉']

  const podium = rows
    .slice(0, 3)
    .map((row, index) => `
      <article class="rpg-podium-card-v2 place-${index + 1}">
        <div class="rpg-podium-rank-v2">
          ${podiumIcons[index]}
        </div>
        <strong>
          ${esc(row.display_name || row.athlete_slug)}
        </strong>
        <span>
          ${esc(primaryValue(row, state.sort))}
        </span>
      </article>
    `)
    .join('')

  const table = rows
    .map((row, index) => {
      const isMe =
        String(row.athlete_slug || '') ===
        String(selectedSlug || '')

      const className =
        CLASS_LABELS[row.rpg_class] ||
        row.rpg_class ||
        'Classe non choisie'

      return `
        <article class="rpg-leaderboard-row-v2 ${isMe ? 'me' : ''}">
          <div class="rpg-leaderboard-rank-v2">
            #${index + 1}
          </div>

          <div class="rpg-leaderboard-athlete-v2">
            <strong>
              ${esc(row.display_name || row.athlete_slug)}
              ${isMe ? ' · toi' : ''}
            </strong>
            <small>
              Niv. ${n(row.level, 1)}
              · ${esc(className)}
            </small>
          </div>

          <div class="rpg-leaderboard-main-v2">
            <strong>
              ${esc(primaryValue(row, state.sort))}
            </strong>
            <small>
              Palier ${n(row.adventure_difficulty, 1)}
              · ${formatHuge(row.total_damage)} dégâts
            </small>
          </div>

          <div class="rpg-leaderboard-details-v2">
            <span>
              Objets :
              <b>
                Myth. ${n(row.mythic_item_drops)}
                · Ultra ${n(row.ultra_mythic_item_drops)}
                · Abyssal ${n(row.abyssal_item_drops)}
              </b>
            </span>

            <span>
              Monstres :
              <b>
                Myth. ${n(row.mythic_monster_kills)}
                · Ultra ${n(row.ultra_mythic_monster_kills)}
                · Abyssal ${n(row.abyssal_monster_kills)}
              </b>
            </span>

            <span>
              Boss :
              <b>${n(row.boss_wins)}</b>
              · meilleur combat :
              <b>${formatHuge(row.best_combat_damage)}</b>
            </span>

            <span>
              🗿 Roi Noeil :
              <b>${formatHuge(row.monolith_best_damage_30s)}</b>
              / 30 s
              · ${n(row.monolith_attempts)} essai${n(row.monolith_attempts) === 1 ? '' : 's'}
            </span>
          </div>
        </article>
      `
    })
    .join('')

  const updated = state.loadedAt
    ? new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(state.loadedAt)
    : 'jamais'

  return `
    <section class="rpg-leaderboard-v2">
      <div class="rpg-leaderboard-head-v2">
        <div>
          <h3>🏆 Leaderboard RPG</h3>
          <p>
            Global, palier, dégâts, raretés et Roi Noeil.
          </p>
        </div>

        <button
          type="button"
          class="rpg-leaderboard-refresh-v2"
          data-rpg-leaderboard-refresh-v2
          ${state.busy ? 'disabled' : ''}
        >
          ${state.busy ? 'Actualisation...' : '↻ Actualiser'}
        </button>
      </div>

      <div class="rpg-leaderboard-sorts-v2">
        ${sorts}
      </div>

      ${
        rows.length
          ? `
            <div class="rpg-leaderboard-podium-v2">
              ${podium}
            </div>
            <div class="rpg-leaderboard-table-v2">
              ${table}
            </div>
          `
          : `
            <div class="rpg-leaderboard-empty-v2">
              Aucune statistique disponible.
            </div>
          `
      }

      <div class="rpg-leaderboard-updated-v2">
        ${
          state.error
            ? esc(state.error)
            : `Dernière actualisation : ${updated}`
        }
      </div>
    </section>
  `
}

export async function handleRpgLeaderboardAction({
  element,
  state,
} = {}) {
  if (!element || !state) return null

  if (
    element.matches(
      '[data-rpg-leaderboard-sort-v2]'
    )
  ) {
    const requested =
      element.dataset.rpgLeaderboardSortV2 ||
      'global'

    state.sort =
      SORTS.some(([key]) => key === requested)
        ? requested
        : 'global'

    localStorage.setItem(
      'rpg_leaderboard_sort_v155',
      state.sort
    )

    return {
      handled: true,
      refresh: false,
    }
  }

  if (
    element.matches(
      '[data-rpg-leaderboard-refresh-v2]'
    )
  ) {
    await loadRpgLeaderboard({
      state,
      force: true,
    })

    return {
      handled: true,
      refresh: true,
    }
  }

  return null
}
