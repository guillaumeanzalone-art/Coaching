import { supabase } from './supabase.js'

const CLASS_LABELS = {
  warrior: 'Guerrier',
  archer: 'Archer',
  mage: 'Mage',
}

const CLASS_ICONS = {
  warrior: '⚔️',
  archer: '🏹',
  mage: '🔮',
}

const SORTS = [
  ['global', '🌟 Global'],
  ['difficulty', '🗺️ Palier'],
  ['damage', '💥 Dégâts'],
  ['items', '🎴 Objets'],
  ['monsters', '👾 Monstres'],
  ['boss', '👑 Boss'],
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

function rareItemCount(row) {
  return n(row?.mythic_item_drops)
    + n(row?.ultra_mythic_item_drops)
    + n(row?.abyssal_item_drops)
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
  if (mode === 'boss') return n(row?.boss_wins)
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
  if (mode === 'boss') {
    return `${fr(row?.boss_wins)} boss`
  }
  if (mode === 'monolith') {
    return `${formatHuge(row?.monolith_best_damage_30s)} / 30 s`
  }
  return `${fr(row?.global_score)} pts`
}

function secondaryValue(row, mode) {
  if (mode === 'difficulty') {
    return `${formatHuge(row?.total_damage)} dégâts cumulés`
  }
  if (mode === 'damage') {
    return `Palier ${n(row?.adventure_difficulty, 1)}`
  }
  if (mode === 'items') {
    return `${rareItemCount(row)} drops Mythique+`
  }
  if (mode === 'monsters') {
    return `${n(row?.boss_wins)} boss vaincus`
  }
  if (mode === 'boss') {
    return `Meilleur combat ${formatHuge(row?.best_combat_damage)}`
  }
  if (mode === 'monolith') {
    return `${n(row?.monolith_attempts)} essai${n(row?.monolith_attempts) === 1 ? '' : 's'}`
  }
  return `Palier ${n(row?.adventure_difficulty, 1)} · ${formatHuge(row?.total_damage)} dégâts`
}

function installStyles() {
  if (document.getElementById('rpgLeaderboardV29Styles')) return

  const style = document.createElement('style')
  style.id = 'rpgLeaderboardV29Styles'
  style.textContent = `
    .rpg-leaderboard-v29{display:grid;gap:12px;min-width:0}
    .rpg-leaderboard-head-v29{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px;border:1px solid rgba(240,196,77,.16);border-radius:17px;background:linear-gradient(145deg,rgba(240,196,77,.055),rgba(255,255,255,.018));box-shadow:0 14px 35px rgba(0,0,0,.18)}
    .rpg-leaderboard-head-v29 h3{margin:0;color:#f0c44d;font-size:16px;letter-spacing:.02em}
    .rpg-leaderboard-head-v29 p{margin:5px 0 0;color:var(--muted,#93a0b7);font-size:10px;line-height:1.45}
    .rpg-leaderboard-refresh-v29,.rpg-leaderboard-sort-v29{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:inherit;border-radius:10px;font:inherit;font-weight:850;cursor:pointer;touch-action:manipulation}
    .rpg-leaderboard-refresh-v29{padding:9px 11px;white-space:nowrap}
    .rpg-leaderboard-refresh-v29:disabled{opacity:.5;cursor:wait}
    .rpg-leaderboard-sorts-v29{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
    .rpg-leaderboard-sort-v29{min-height:38px;padding:7px 5px;font-size:9px}
    .rpg-leaderboard-sort-v29.active{border-color:rgba(240,196,77,.54);background:linear-gradient(180deg,rgba(240,196,77,.18),rgba(240,196,77,.06));color:#ffe28a;box-shadow:0 0 0 1px rgba(240,196,77,.08) inset,0 8px 22px rgba(0,0,0,.12)}

    .rpg-leaderboard-me-v29{display:grid;grid-template-columns:auto minmax(0,1fr);gap:11px;align-items:center;padding:13px;border-radius:16px;border:1px solid rgba(70,153,255,.28);background:linear-gradient(135deg,rgba(40,103,186,.16),rgba(255,255,255,.025))}
    .rpg-leaderboard-me-rank-v29{display:grid;place-items:center;min-width:54px;height:54px;padding:0 7px;border-radius:14px;background:rgba(23,102,201,.16);border:1px solid rgba(70,153,255,.22);color:#80bdff;font-size:17px;font-weight:950}
    .rpg-leaderboard-me-copy-v29{min-width:0}
    .rpg-leaderboard-me-copy-v29 strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rpg-leaderboard-me-copy-v29 small{display:block;margin-top:3px;color:#8fa4c3;font-size:8px}
    .rpg-leaderboard-me-stats-v29{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .rpg-leaderboard-me-stat-v29{padding:8px 5px;border-radius:10px;background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.05);text-align:center;min-width:0}
    .rpg-leaderboard-me-stat-v29 b,.rpg-leaderboard-me-stat-v29 span{display:block;overflow:hidden;text-overflow:ellipsis}
    .rpg-leaderboard-me-stat-v29 b{font-size:9px;white-space:nowrap}
    .rpg-leaderboard-me-stat-v29 span{margin-top:2px;color:#74839b;font-size:7px;text-transform:uppercase;letter-spacing:.04em}

    .rpg-leaderboard-podium-v29{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:end;padding-top:5px}
    .rpg-podium-card-v29{position:relative;min-width:0;text-align:center;padding:14px 7px 13px;border-radius:17px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018));overflow:hidden}
    .rpg-podium-card-v29:before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.6;background:radial-gradient(circle at 50% 0,rgba(255,255,255,.09),transparent 58%)}
    .rpg-podium-card-v29.place-1{padding-top:21px;padding-bottom:19px;transform:translateY(-5px);border-color:rgba(240,196,77,.46);box-shadow:0 0 24px rgba(240,196,77,.10);background:linear-gradient(180deg,rgba(240,196,77,.13),rgba(255,255,255,.018))}
    .rpg-podium-card-v29.place-2{border-color:rgba(188,202,222,.26)}
    .rpg-podium-card-v29.place-3{border-color:rgba(196,125,74,.28)}
    .rpg-podium-rank-v29{position:relative;font-size:25px}
    .rpg-podium-class-v29{position:relative;margin-top:5px;color:#7f8aa2;font-size:8px}
    .rpg-podium-card-v29 strong,.rpg-podium-card-v29 span{position:relative;display:block;overflow:hidden;text-overflow:ellipsis}
    .rpg-podium-card-v29 strong{margin-top:4px;font-size:11px;white-space:nowrap}
    .rpg-podium-card-v29 .value{margin-top:6px;color:#f7d56e;font-size:9px;font-weight:900;white-space:nowrap}
    .rpg-podium-card-v29 .sub{margin-top:3px;color:#74839b;font-size:7px;white-space:nowrap}

    .rpg-leaderboard-table-v29{display:grid;gap:7px}
    .rpg-leaderboard-row-v29{display:grid;grid-template-columns:34px minmax(100px,1fr) minmax(100px,.9fr);gap:9px;align-items:center;padding:10px;border-radius:14px;border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.022)}
    .rpg-leaderboard-row-v29.me{border-color:rgba(70,153,255,.36);background:linear-gradient(135deg,rgba(40,103,186,.13),rgba(255,255,255,.02))}
    .rpg-leaderboard-rank-v29{font-weight:950;font-size:11px;color:#7f8aa2;text-align:center}
    .rpg-leaderboard-row-v29:nth-child(1) .rpg-leaderboard-rank-v29{color:#f0c44d}
    .rpg-leaderboard-row-v29:nth-child(2) .rpg-leaderboard-rank-v29{color:#c5d0df}
    .rpg-leaderboard-row-v29:nth-child(3) .rpg-leaderboard-rank-v29{color:#c98d63}
    .rpg-leaderboard-athlete-v29,.rpg-leaderboard-main-v29{min-width:0}
    .rpg-leaderboard-athlete-v29 strong,.rpg-leaderboard-main-v29 strong{display:block;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rpg-leaderboard-athlete-v29 small,.rpg-leaderboard-main-v29 small{display:block;margin-top:3px;color:#78869b;font-size:7px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rpg-leaderboard-main-v29{text-align:right}
    .rpg-leaderboard-main-v29 strong{color:#dfe8f7}
    .rpg-leaderboard-stats-v29{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding-top:7px;border-top:1px solid rgba(255,255,255,.045)}
    .rpg-leaderboard-stat-v29{min-width:0;padding:6px 4px;border-radius:8px;background:rgba(0,0,0,.13);text-align:center}
    .rpg-leaderboard-stat-v29 b,.rpg-leaderboard-stat-v29 span{display:block;overflow:hidden;text-overflow:ellipsis}
    .rpg-leaderboard-stat-v29 b{font-size:8px;white-space:nowrap}
    .rpg-leaderboard-stat-v29 span{margin-top:2px;color:#657289;font-size:6px;text-transform:uppercase}
    .rpg-stat-mythic-v29 b{color:#ec87ff}
    .rpg-stat-ultra-v29 b{color:#77e5ff}
    .rpg-stat-abyssal-v29 b{color:#ff6d93}
    .rpg-stat-monolith-v29 b{color:#c8d0dd}

    .rpg-leaderboard-empty-v29{padding:28px 14px;text-align:center;color:#8491a6;border:1px dashed rgba(255,255,255,.09);border-radius:15px;font-size:10px}
    .rpg-leaderboard-updated-v29{text-align:center;color:#66748a;font-size:7px}

    @media(max-width:700px){
      .rpg-leaderboard-sorts-v29{grid-template-columns:repeat(2,minmax(0,1fr))}
      .rpg-leaderboard-me-stats-v29{grid-template-columns:repeat(2,minmax(0,1fr))}
      .rpg-leaderboard-row-v29{grid-template-columns:29px minmax(0,1fr);gap:7px}
      .rpg-leaderboard-main-v29{grid-column:2;text-align:left}
      .rpg-leaderboard-stats-v29{grid-column:1/-1;grid-template-columns:repeat(5,minmax(0,1fr))}
    }
    @media(max-width:430px){
      .rpg-leaderboard-head-v29{padding:12px}
      .rpg-leaderboard-head-v29 p{font-size:8px}
      .rpg-leaderboard-refresh-v29{padding:8px;font-size:9px}
      .rpg-leaderboard-podium-v29{gap:5px}
      .rpg-podium-card-v29{padding-left:4px;padding-right:4px}
      .rpg-podium-card-v29 strong{font-size:9px}
      .rpg-podium-card-v29 .value{font-size:7px}
      .rpg-podium-card-v29 .sub{font-size:6px}
      .rpg-leaderboard-stats-v29{grid-template-columns:repeat(3,minmax(0,1fr))}
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
    sort: localStorage.getItem('rpg_leaderboard_sort_v29') || 'global',
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

function renderMyPosition(rows, selectedSlug, mode) {
  if (!selectedSlug) return ''

  const index = rows.findIndex(
    row => String(row?.athlete_slug || '') === String(selectedSlug)
  )

  if (index < 0) return ''

  const row = rows[index]
  const className = CLASS_LABELS[row.rpg_class] || row.rpg_class || 'Classe non choisie'
  const classIcon = CLASS_ICONS[row.rpg_class] || '🎮'

  return `
    <section class="rpg-leaderboard-me-v29">
      <div class="rpg-leaderboard-me-rank-v29">#${index + 1}</div>
      <div class="rpg-leaderboard-me-copy-v29">
        <strong>Ta position · ${esc(primaryValue(row, mode))}</strong>
        <small>${classIcon} ${esc(className)} · niveau ${n(row.level, 1)} · ${esc(secondaryValue(row, mode))}</small>
      </div>
      <div class="rpg-leaderboard-me-stats-v29">
        <div class="rpg-leaderboard-me-stat-v29"><b>Palier ${n(row.adventure_difficulty, 1)}</b><span>Palier max</span></div>
        <div class="rpg-leaderboard-me-stat-v29"><b>${formatHuge(row.total_damage)}</b><span>Dégâts cumulés</span></div>
        <div class="rpg-leaderboard-me-stat-v29"><b>${rareItemCount(row)}</b><span>Drops Mythique+</span></div>
        <div class="rpg-leaderboard-me-stat-v29"><b>${formatHuge(row.monolith_best_damage_30s)}</b><span>Monolithe 30 s</span></div>
      </div>
    </section>
  `
}

export function renderRpgLeaderboard({
  state,
  selectedSlug = '',
} = {}) {
  installStyles()

  if (!state) return ''

  const sorts = SORTS
    .map(([key, label]) => `
      <button
        type="button"
        class="rpg-leaderboard-sort-v29 ${state.sort === key ? 'active' : ''}"
        data-rpg-leaderboard-sort-v2="${key}"
      >
        ${label}
      </button>
    `)
    .join('')

  if (state.busy && !state.rows.length) {
    return `
      <section class="rpg-leaderboard-v29">
        <div class="rpg-leaderboard-head-v29">
          <div><h3>🏆 Classement RPG</h3><p>Chargement du classement réel…</p></div>
        </div>
        <div class="rpg-leaderboard-empty-v29">Chargement…</div>
      </section>
    `
  }

  if (state.error && !state.rows.length) {
    return `
      <section class="rpg-leaderboard-v29">
        <div class="rpg-leaderboard-head-v29">
          <div><h3>🏆 Classement RPG</h3><p>Impossible de récupérer les statistiques.</p></div>
          <button type="button" class="rpg-leaderboard-refresh-v29" data-rpg-leaderboard-refresh-v2>Réessayer</button>
        </div>
        <div class="rpg-leaderboard-empty-v29">${esc(state.error)}</div>
      </section>
    `
  }

  const rows = sortedRows(state)
  const podiumIcons = ['🥇', '🥈', '🥉']

  const podium = rows
    .slice(0, 3)
    .map((row, index) => {
      const className = CLASS_LABELS[row.rpg_class] || row.rpg_class || 'Sans classe'
      const classIcon = CLASS_ICONS[row.rpg_class] || '🎮'
      return `
        <article class="rpg-podium-card-v29 place-${index + 1}">
          <div class="rpg-podium-rank-v29">${podiumIcons[index]}</div>
          <div class="rpg-podium-class-v29">${classIcon} ${esc(className)} · Niv. ${n(row.level, 1)}</div>
          <strong>${esc(row.display_name || row.athlete_slug)}</strong>
          <span class="value">${esc(primaryValue(row, state.sort))}</span>
          <span class="sub">${esc(secondaryValue(row, state.sort))}</span>
        </article>
      `
    })
    .join('')

  const table = rows
    .map((row, index) => {
      const isMe = String(row.athlete_slug || '') === String(selectedSlug || '')
      const className = CLASS_LABELS[row.rpg_class] || row.rpg_class || 'Classe non choisie'
      const classIcon = CLASS_ICONS[row.rpg_class] || '🎮'

      return `
        <article class="rpg-leaderboard-row-v29 ${isMe ? 'me' : ''}">
          <div class="rpg-leaderboard-rank-v29">#${index + 1}</div>

          <div class="rpg-leaderboard-athlete-v29">
            <strong>${esc(row.display_name || row.athlete_slug)}${isMe ? ' · TOI' : ''}</strong>
            <small>${classIcon} ${esc(className)} · Niv. ${n(row.level, 1)}</small>
          </div>

          <div class="rpg-leaderboard-main-v29">
            <strong>${esc(primaryValue(row, state.sort))}</strong>
            <small>${esc(secondaryValue(row, state.sort))}</small>
          </div>

          <div class="rpg-leaderboard-stats-v29">
            <div class="rpg-leaderboard-stat-v29"><b>${n(row.adventure_difficulty, 1)}</b><span>Palier</span></div>
            <div class="rpg-leaderboard-stat-v29 rpg-stat-mythic-v29"><b>${n(row.mythic_item_drops)}</b><span>Myth.</span></div>
            <div class="rpg-leaderboard-stat-v29 rpg-stat-ultra-v29"><b>${n(row.ultra_mythic_item_drops)}</b><span>URM</span></div>
            <div class="rpg-leaderboard-stat-v29 rpg-stat-abyssal-v29"><b>${n(row.abyssal_item_drops)}</b><span>Abyssal</span></div>
            <div class="rpg-leaderboard-stat-v29 rpg-stat-monolith-v29"><b>${formatHuge(row.monolith_best_damage_30s)}</b><span>🗿 30 s</span></div>
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
    <section class="rpg-leaderboard-v29">
      <div class="rpg-leaderboard-head-v29">
        <div>
          <h3>🏆 Classement RPG</h3>
          <p>Palier max · dégâts cumulés · drops rares · monstres · boss · Monolithe 30 s.</p>
        </div>
        <button type="button" class="rpg-leaderboard-refresh-v29" data-rpg-leaderboard-refresh-v2 ${state.busy ? 'disabled' : ''}>
          ${state.busy ? 'Actualisation…' : '↻ Actualiser'}
        </button>
      </div>

      <div class="rpg-leaderboard-sorts-v29">${sorts}</div>

      ${rows.length ? renderMyPosition(rows, selectedSlug, state.sort) : ''}

      ${
        rows.length
          ? `
            <div class="rpg-leaderboard-podium-v29">${podium}</div>
            <div class="rpg-leaderboard-table-v29">${table}</div>
          `
          : `<div class="rpg-leaderboard-empty-v29">Aucune statistique disponible.</div>`
      }

      <div class="rpg-leaderboard-updated-v29">
        ${state.error ? esc(state.error) : `Dernière actualisation : ${updated}`}
      </div>
    </section>
  `
}

export async function handleRpgLeaderboardAction({
  element,
  state,
} = {}) {
  if (!element || !state) return null

  if (element.matches('[data-rpg-leaderboard-sort-v2]')) {
    const requested = element.dataset.rpgLeaderboardSortV2 || 'global'

    state.sort = SORTS.some(([key]) => key === requested)
      ? requested
      : 'global'

    localStorage.setItem('rpg_leaderboard_sort_v29', state.sort)

    return {
      handled: true,
      refresh: false,
    }
  }

  if (element.matches('[data-rpg-leaderboard-refresh-v2]')) {
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
