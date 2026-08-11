import { supabase } from './supabase.js'
import {
  playRpgBattleMusic,
  playRpgMenuMusic,
} from './rpg-audio.js'

let activeFight = null
let fightTimer = null

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
    const raw = String(value ?? '0').trim()
    if (/^-?\d+$/.test(raw)) return BigInt(raw)
    return BigInt(Math.floor(n(value)))
  } catch {
    return 0n
  }
}

function formatHuge(value) {
  try {
    return big(value).toLocaleString('fr-FR')
  } catch {
    return String(value ?? '0')
  }
}

function raidTimeText(ms) {
  const total = Math.max(
    0,
    Math.ceil(n(ms) / 1000)
  )
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function derivedRaidStatus(raid) {
  if (!raid?.raid_id) return 'none'

  const now = Date.now()
  const opens = new Date(raid.portal_opens_at).getTime()
  const closes = new Date(raid.portal_closes_at).getTime()

  if (now < opens) return 'countdown'
  if (now < closes) return 'open'
  return 'closed'
}

function installStyles() {
  if (document.getElementById('rpgRaidV2Styles')) return

  const style = document.createElement('style')
  style.id = 'rpgRaidV2Styles'
  style.textContent = `
    .rpg-raid-card-v2{display:grid;gap:12px;margin-top:14px;padding:15px;border:1px solid rgba(118,83,255,.22);border-radius:18px;background:radial-gradient(circle at top right,rgba(91,57,205,.13),transparent 42%),rgba(255,255,255,.025);overflow:hidden}
    .rpg-raid-head-v2{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:10px;align-items:center}
    .rpg-raid-icon-v2{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:rgba(108,75,255,.12);font-size:24px;box-shadow:0 0 22px rgba(110,80,255,.12) inset}
    .rpg-raid-head-v2 strong,.rpg-raid-head-v2 span{display:block}
    .rpg-raid-head-v2 strong{font-size:13px}
    .rpg-raid-head-v2 span{margin-top:3px;color:var(--muted,#93a0b7);font-size:9px;line-height:1.35}
    .rpg-raid-status-v2{font-size:8px;padding:6px 8px;border-radius:999px;background:rgba(109,76,255,.13);color:#cbbcff;white-space:nowrap}
    .rpg-raid-countdown-v2{text-align:center;font-size:28px;font-weight:950;letter-spacing:.04em;font-variant-numeric:tabular-nums}
    .rpg-raid-grid-v2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
    .rpg-raid-grid-v2>div{min-width:0;padding:9px 5px;text-align:center;border-radius:11px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055)}
    .rpg-raid-grid-v2 strong,.rpg-raid-grid-v2 span{display:block}
    .rpg-raid-grid-v2 strong{font-size:12px;overflow:hidden;text-overflow:ellipsis}
    .rpg-raid-grid-v2 span{margin-top:3px;color:var(--muted,#93a0b7);font-size:7px;line-height:1.2}
    .rpg-raid-message-v2,.rpg-raid-wallet-v2,.rpg-raid-reward-v2{padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.03);font-size:9px;line-height:1.45;color:var(--muted,#a3adc1)}
    .rpg-raid-message-v2 strong,.rpg-raid-wallet-v2 strong,.rpg-raid-reward-v2 strong{color:var(--text,#fff)}
    .rpg-raid-message-v2.error{color:#ff9caa}
    .rpg-raid-reward-v2{border:1px solid rgba(91,226,142,.16);color:#97e8b4}
    .rpg-raid-action-v2{width:100%;min-height:44px;border:1px solid rgba(129,97,255,.35);border-radius:13px;background:linear-gradient(135deg,rgba(82,49,207,.86),rgba(142,59,190,.72));color:#fff;font:inherit;font-weight:950;cursor:pointer}
    .rpg-raid-action-v2.secondary{background:rgba(255,255,255,.045)}
    .rpg-raid-action-v2:disabled{opacity:.48;cursor:not-allowed}
    .rpg-raid-roster-v2{display:grid;gap:6px}
    .rpg-raid-roster-row-v2{display:grid;grid-template-columns:minmax(0,1fr) auto 34px;gap:8px;align-items:center;padding:8px 9px;border-radius:10px;background:rgba(255,255,255,.025);font-size:8px}
    .rpg-raid-roster-row-v2 span,.rpg-raid-roster-row-v2 small{color:var(--muted,#93a0b7)}
    .rpg-raid-loading-v2{padding:24px;text-align:center;color:var(--muted,#93a0b7)}
    .rpg-raid-overlay-v2{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:radial-gradient(circle at 50% 35%,rgba(77,44,177,.25),transparent 34%),rgba(2,4,10,.96);backdrop-filter:blur(10px)}
    .rpg-raid-arena-v2{width:min(100%,760px);height:min(92vh,780px);display:grid;grid-template-rows:auto auto minmax(300px,1fr) auto;gap:10px;padding:14px;border-radius:22px;border:1px solid rgba(150,118,255,.28);background:linear-gradient(180deg,#0b1020,#080b13);box-shadow:0 30px 90px rgba(0,0,0,.55);overflow:hidden}
    .rpg-raid-fight-head-v2{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
    .rpg-raid-fight-head-v2>div:last-child{text-align:right}
    .rpg-raid-fight-head-v2 strong,.rpg-raid-fight-head-v2 small{display:block}
    .rpg-raid-fight-head-v2 strong{font-size:12px}
    .rpg-raid-fight-head-v2 small{margin-top:2px;color:#8f9bb1;font-size:8px}
    .rpg-raid-clock-v2{font-size:28px;font-weight:950;font-variant-numeric:tabular-nums;text-align:center}
    .rpg-raid-phase-v2{display:grid;gap:6px}
    .rpg-raid-phase-line-v2{display:flex;justify-content:space-between;gap:10px;font-size:8px;color:#aab4c8}
    .rpg-raid-phase-track-v2{height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}
    .rpg-raid-phase-bar-v2{height:100%;width:0;background:linear-gradient(90deg,#6d55ff,#e14d9c,#ffbd59);transition:width .08s linear}
    .rpg-raid-stage-v2{position:relative;min-height:300px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.07);background:radial-gradient(circle at 50% 52%,rgba(111,72,255,.20),transparent 28%),radial-gradient(circle at 50% 50%,rgba(255,255,255,.045),transparent 60%),#070a12;touch-action:manipulation;user-select:none}
    .rpg-raid-portal-v2{position:absolute;left:50%;top:50%;width:180px;height:180px;transform:translate(-50%,-50%);border-radius:50%;border:2px solid rgba(143,111,255,.28);box-shadow:0 0 70px rgba(103,69,255,.16),0 0 28px rgba(103,69,255,.15) inset;animation:rpgRaidPortalPulse 1.8s ease-in-out infinite alternate}
    .rpg-raid-boss-v2{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:78px;filter:drop-shadow(0 8px 20px rgba(0,0,0,.55));pointer-events:none}
    .rpg-raid-target-v2{position:absolute;z-index:5;transform:translate(-50%,-50%);width:74px;height:74px;border-radius:50%;border:2px solid rgba(255,255,255,.76);display:grid;place-items:center;background:radial-gradient(circle,#fff,#62a8ff 46%,#244bb4);color:#07101d;font-weight:950;font-size:22px;box-shadow:0 0 0 8px rgba(80,155,255,.10),0 0 34px rgba(80,155,255,.55);cursor:pointer;touch-action:manipulation;animation:rpgRaidTargetPulse .34s ease-in-out infinite alternate}
    .rpg-raid-target-v2 span{position:absolute;left:50%;bottom:-17px;transform:translateX(-50%);white-space:nowrap;font-size:7px;color:#dce8ff;text-shadow:0 1px 5px #000}
    .rpg-raid-target-v2.double{background:radial-gradient(circle,#fff,#bd9cff 50%,#6039bd)}
    .rpg-raid-target-v2.chain{background:radial-gradient(circle,#fff,#66e0b8 48%,#17775e)}
    .rpg-raid-target-v2.danger{background:radial-gradient(circle,#fff,#ff6574 48%,#971a2b);box-shadow:0 0 0 9px rgba(255,55,75,.14),0 0 40px rgba(255,55,75,.66)}
    .rpg-raid-target-v2.golden{width:150px;height:48px;border-radius:14px;background:linear-gradient(90deg,#ffe58a,#fff,#78ddff,#fff,#ffe58a);font-size:0}
    .rpg-raid-target-v2.golden:before{content:'';width:124px;height:8px;border-radius:999px;background:#fff;box-shadow:0 0 22px #8fe3ff}
    .rpg-raid-hud-v2{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
    .rpg-raid-hud-v2>div{text-align:center;padding:7px 3px;border-radius:10px;background:rgba(255,255,255,.035)}
    .rpg-raid-hud-v2 strong,.rpg-raid-hud-v2 span{display:block}
    .rpg-raid-hud-v2 strong{font-size:11px}
    .rpg-raid-hud-v2 span{margin-top:2px;color:#8290a8;font-size:6px}
    .rpg-raid-result-v2{display:none;align-content:center;justify-items:center;text-align:center;gap:14px;height:100%;padding:24px}
    .rpg-raid-result-v2.show{display:grid}
    .rpg-raid-result-v2 h2{margin:0;font-size:26px}
    .rpg-raid-result-v2 p{margin:0;max-width:560px;color:#a9b3c7;font-size:11px;line-height:1.6}
    .rpg-raid-result-v2 button{min-width:220px;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(112,75,255,.35);color:#fff;font-weight:900;cursor:pointer}
    @keyframes rpgRaidPortalPulse{to{transform:translate(-50%,-50%) scale(1.08);box-shadow:0 0 100px rgba(103,69,255,.25),0 0 34px rgba(103,69,255,.25) inset}}
    @keyframes rpgRaidTargetPulse{to{transform:translate(-50%,-50%) scale(1.08)}}
    @media(max-width:620px){
      .rpg-raid-grid-v2{grid-template-columns:repeat(2,minmax(0,1fr))}
      .rpg-raid-arena-v2{height:calc(100dvh - 24px);padding:10px;border-radius:18px}
      .rpg-raid-stage-v2{min-height:260px}
      .rpg-raid-hud-v2{grid-template-columns:repeat(5,minmax(0,1fr))}
      .rpg-raid-hud-v2 strong{font-size:9px}
      .rpg-raid-target-v2{width:66px;height:66px}
    }
  `
  document.head.appendChild(style)
}

export function createRpgRaidState() {
  return {
    raid: null,
    participants: [],
    loading: false,
    busy: false,
    error: '',
    loadedAt: null,
  }
}

export async function loadRpgRaidState({
  athleteSlug,
  state,
} = {}) {
  if (!athleteSlug || !state) return state

  state.loading = true
  state.error = ''

  try {
    const { data, error } = await supabase.rpc(
      'get_rpg_raid_status',
      {
        p_athlete_slug: athleteSlug,
      }
    )

    if (error) throw error

    const row = Array.isArray(data)
      ? data[0]
      : data

    state.raid = row || null
    state.participants = []

    if (row?.raid_id) {
      const {
        data: participantData,
        error: participantError,
      } = await supabase.rpc(
        'get_rpg_raid_participants',
        {
          p_raid_id: row.raid_id,
        }
      )

      if (!participantError) {
        state.participants = Array.isArray(participantData)
          ? participantData
          : []
      } else {
        console.warn(
          'Participants Raid indisponibles :',
          participantError.message
        )
      }
    }

    state.loadedAt = Date.now()
  } catch (error) {
    state.error =
      error?.message ||
      'Raid indisponible'
    console.error('RPG RAID LOAD ERROR', error)
  } finally {
    state.loading = false
  }

  return state
}

function participantsHtml(participants) {
  if (!participants?.length) {
    return `
      <div class="rpg-raid-message-v2">
        Personne n'est encore entré dans le portail.
      </div>
    `
  }

  const rows = participants
    .slice(0, 10)
    .map(participant => `
      <div class="rpg-raid-roster-row-v2">
        <strong>
          ${esc(
            participant.display_name ||
            participant.athlete_slug
          )}
        </strong>
        <span>
          ${
            n(participant.raw_damage) > 0
              ? `${formatHuge(participant.raw_damage)} dégâts`
              : 'En attente'
          }
        </span>
        <small>
          ${Math.min(
            3,
            Math.max(
              0,
              Math.floor(n(participant.attempts_used))
            )
          )}/3
        </small>
      </div>
    `)
    .join('')

  const extra = participants.length > 10
    ? `
      <div class="rpg-raid-message-v2">
        +${participants.length - 10} autre(s) participant(s)
      </div>
    `
    : ''

  return `
    <div class="rpg-raid-roster-v2">
      ${rows}
      ${extra}
    </div>
  `
}

export function renderRpgRaid({
  progress,
  canEdit,
  state,
} = {}) {
  installStyles()

  if (state?.loading && !state?.raid) {
    return `
      <section class="rpg-raid-card-v2">
        <div class="rpg-raid-loading-v2">
          🌀 Recherche d'un portail...
        </div>
      </section>
    `
  }

  if (state?.error && !state?.raid) {
    return `
      <section class="rpg-raid-card-v2">
        <div class="rpg-raid-head-v2">
          <div class="rpg-raid-icon-v2">🌀</div>
          <div>
            <strong>Raid mondial</strong>
            <span>Impossible de lire l'état du portail.</span>
          </div>
          <b class="rpg-raid-status-v2">ERREUR</b>
        </div>
        <div class="rpg-raid-message-v2 error">
          ${esc(state.error)}
        </div>
        <button
          type="button"
          class="rpg-raid-action-v2 secondary"
          data-rpg-raid-refresh-v2
        >
          Réessayer
        </button>
      </section>
    `
  }

  const raid = state?.raid
  const balance = Math.max(
    0,
    Math.floor(
      n(
        raid?.ultra_cases_balance,
        progress?.raid_ultra_cases
      )
    )
  )

  const keyPity = Math.max(
    0,
    Math.floor(
      n(
        raid?.key_pity,
        progress?.raid_key_pity
      )
    )
  )

  if (!raid?.raid_id) {
    const keyChance = Math.min(
      20,
      0.5 + keyPity * 0.4
    )

    return `
      <section class="rpg-raid-card-v2">
        <div class="rpg-raid-head-v2">
          <div class="rpg-raid-icon-v2">🗝️</div>
          <div>
            <strong>Aucun portail actif</strong>
            <span>
              Chaque nouvelle série augmente la chance de révéler la clé mondiale.
            </span>
          </div>
          <b class="rpg-raid-status-v2">EN VEILLE</b>
        </div>

        <div class="rpg-raid-grid-v2">
          <div>
            <strong>${fr(keyChance, 1)} %</strong>
            <span>Chance prochaine série</span>
          </div>
          <div>
            <strong>${Math.max(1, 30 - keyPity)}</strong>
            <span>Garantie au plus tard</span>
          </div>
        </div>

        <div class="rpg-raid-message-v2">
          La chance commence à <strong>0,5 %</strong>,
          progresse après chaque échec et la clé est garantie
          au plus tard à la 30e série.
        </div>

        <div class="rpg-raid-wallet-v2">
          Solde : <strong>${balance} caisse${balance === 1 ? '' : 's'} Ultra</strong>.
        </div>

        <button
          type="button"
          class="rpg-raid-action-v2 secondary"
          data-rpg-raid-refresh-v2
        >
          🔄 Actualiser
        </button>
      </section>
    `
  }

  const status = derivedRaidStatus(raid)
  const deadline = status === 'countdown'
    ? new Date(raid.portal_opens_at).getTime()
    : new Date(raid.portal_closes_at).getTime()

  const statusLabel =
    status === 'countdown'
      ? 'PORTAIL EN CHARGE'
      : status === 'open'
        ? 'RAID OUVERT'
        : 'RAID TERMINÉ'

  const attemptsUsed = Math.min(
    3,
    Math.max(
      0,
      Math.floor(n(raid.attempts_used))
    )
  )

  const attemptsRemaining = Math.min(
    3,
    Math.max(
      0,
      Math.floor(
        n(
          raid.attempts_remaining,
          3 - attemptsUsed
        )
      )
    )
  )

  const bestCases = Math.max(
    0,
    Math.floor(
      status === 'closed'
        ? n(
            raid.final_reward_cases,
            raid.projected_reward_cases
          )
        : Math.max(
            n(raid.projected_reward_cases),
            n(raid.final_reward_cases)
          )
    )
  )

  let action = ''

  if (status === 'closed') {
    action = `
      <button
        type="button"
        class="rpg-raid-action-v2"
        disabled
      >
        🎁 ${bestCases} caisse${bestCases === 1 ? '' : 's'} gagnée${bestCases === 1 ? '' : 's'}
      </button>
    `
  } else if (!raid.joined) {
    action = `
      <button
        type="button"
        class="rpg-raid-action-v2"
        data-rpg-raid-join-v2
        ${canEdit ? '' : 'disabled'}
      >
        🌀 Entrer dans le raid
      </button>
    `
  } else if (status === 'countdown') {
    action = `
      <button
        type="button"
        class="rpg-raid-action-v2"
        disabled
      >
        ✅ Inscrit · prépare tes 3 tentatives
      </button>
    `
  } else if (attemptsRemaining <= 0) {
    action = `
      <button
        type="button"
        class="rpg-raid-action-v2"
        disabled
      >
        ✅ 3/3 tentatives · meilleure récompense ${bestCases}
      </button>
    `
  } else {
    action = `
      <button
        type="button"
        class="rpg-raid-action-v2"
        data-rpg-raid-start-v2
        ${canEdit ? '' : 'disabled'}
      >
        ⚔️ Tentative ${attemptsUsed + 1}/3 · 35 secondes
      </button>
    `
  }

  return `
    <section class="rpg-raid-card-v2">
      <div class="rpg-raid-head-v2">
        <div class="rpg-raid-icon-v2">
          ${esc(raid.boss_icon || '🌀')}
        </div>

        <div>
          <strong>
            ${esc(raid.boss_name || 'Boss de Raid')}
          </strong>
          <span>
            Clé trouvée par
            ${esc(
              raid.discovered_by_name ||
              raid.discovered_by_slug ||
              '???'
            )}
            · palier moyen
            ${Math.max(1, Math.floor(n(raid.raid_level, 1)))}
          </span>
        </div>

        <b class="rpg-raid-status-v2">
          ${statusLabel}
        </b>
      </div>

      <div
        class="rpg-raid-countdown-v2"
        data-rpg-raid-countdown-v2
        data-deadline="${deadline}"
      >
        ${
          status === 'closed'
            ? '00:00'
            : raidTimeText(deadline - Date.now())
        }
      </div>

      <div class="rpg-raid-grid-v2">
        <div>
          <strong>${Math.max(0, Math.floor(n(raid.participant_count)))}</strong>
          <span>Participants</span>
        </div>
        <div>
          <strong>×${fr(raid.team_multiplier, 2)}</strong>
          <span>Synergie équipe</span>
        </div>
        <div>
          <strong>${formatHuge(raid.personal_best_damage)}</strong>
          <span>Ton meilleur score</span>
        </div>
        <div>
          <strong>${bestCases}</strong>
          <span>Caisses gagnées</span>
        </div>
      </div>

      <div class="rpg-raid-message-v2">
        Tu disposes de <strong>3 tentatives</strong>.
        Seul ton meilleur résultat compte :
        améliorer ton score crédite uniquement la différence de caisses.
      </div>

      ${action}

      ${
        bestCases > 0
          ? `
            <div class="rpg-raid-reward-v2">
              ✅ ${bestCases} caisse${bestCases === 1 ? '' : 's'}
              Ultra déjà créditée${bestCases === 1 ? '' : 's'} sur ce raid.
            </div>
          `
          : ''
      }

      ${participantsHtml(state.participants)}

      <div class="rpg-raid-wallet-v2">
        Solde :
        <strong>${balance} caisse${balance === 1 ? '' : 's'} Ultra</strong>
      </div>

      <button
        type="button"
        class="rpg-raid-action-v2 secondary"
        data-rpg-raid-refresh-v2
      >
        🔄 Actualiser le Raid
      </button>
    </section>
  `
}

export async function handleRpgRaidAction({
  element,
  athleteSlug,
  state,
  canEdit,
} = {}) {
  if (!element || !athleteSlug || !state) return null

  if (
    element.matches(
      '[data-rpg-raid-refresh-v2]'
    )
  ) {
    await loadRpgRaidState({
      athleteSlug,
      state,
    })

    return {
      handled: true,
      refresh: true,
    }
  }

  if (
    element.matches(
      '[data-rpg-raid-join-v2]'
    )
  ) {
    if (
      !canEdit ||
      state.busy ||
      !state.raid?.raid_id
    ) {
      return null
    }

    state.busy = true

    try {
      const { error } = await supabase.rpc(
        'join_rpg_raid',
        {
          p_athlete_slug: athleteSlug,
          p_raid_id: state.raid.raid_id,
        }
      )

      if (error) throw error

      await loadRpgRaidState({
        athleteSlug,
        state,
      })

      return {
        handled: true,
        refresh: true,
        joined: true,
      }
    } finally {
      state.busy = false
    }
  }

  if (
    element.matches(
      '[data-rpg-raid-start-v2]'
    )
  ) {
    return {
      handled: true,
      startFight: true,
    }
  }

  return null
}

function reactionRand(seed, round, salt) {
  const modulus = 2147483647
  const base =
    Math.max(1, Math.floor(n(seed, 1))) +
    Math.max(1, round) * 48271 +
    Math.max(1, salt) * 69621
  return ((base * 48271) % modulus) / modulus
}

function comboTier(combo) {
  if (combo >= 35) return 4
  if (combo >= 20) return 3
  if (combo >= 10) return 2
  if (combo >= 5) return 1
  return 0
}

function targetType(seed, round, tier) {
  const roll = reactionRand(seed, round, 1)

  const tables = [
    [0.52, 0.68, 0.82, 0.94],
    [0.45, 0.65, 0.80, 0.92],
    [0.38, 0.61, 0.79, 0.91],
    [0.32, 0.57, 0.77, 0.90],
    [0.27, 0.53, 0.75, 0.89],
  ]

  const t = tables[Math.max(0, Math.min(4, tier))]

  return roll < t[0]
    ? 'normal'
    : roll < t[1]
      ? 'double'
      : roll < t[2]
        ? 'chain'
        : roll < t[3]
          ? 'danger'
          : 'golden'
}

function phaseState(fight, elapsed) {
  const ratio = Math.max(
    0,
    Math.min(
      1,
      elapsed / Math.max(1, fight.durationMs)
    )
  )

  if (ratio >= 0.75) {
    return {
      key: 'fury',
      label: 'PHASE 3 · FURIE DU PORTAIL',
      bonus: 'Tempête de cibles',
      interval: 620,
      maxActive: 3,
      durationMultiplier: 0.82,
    }
  }

  if (ratio >= 0.40) {
    return {
      key: 'overload',
      label: 'PHASE 2 · SURCHARGE',
      bonus: 'Rythme accéléré',
      interval: 820,
      maxActive: 2,
      durationMultiplier: 0.92,
    }
  }

  return {
    key: 'breach',
    label: 'PHASE 1 · BRÈCHE',
    bonus: 'Construis ton combo',
    interval: 1050,
    maxActive: 1,
    durationMultiplier: 1.05,
  }
}

function currentElapsed(fight) {
  return performance.now() - fight.startedAt
}

function accuracy(fight) {
  const total =
    fight.successful +
    fight.misses
  return total > 0
    ? fight.successful * 100 / total
    : 0
}

function targetIcon(type) {
  if (type === 'double') return '✌️'
  if (type === 'chain') return '🔗'
  if (type === 'danger') return '☠️'
  if (type === 'golden') return ''
  return '🎯'
}

function targetInstruction(spec) {
  if (spec.type === 'double') {
    return spec.step === 1
      ? 'ENCORE !'
      : 'DOUBLE TAP'
  }
  if (spec.type === 'chain') {
    return spec.step === 1
      ? '2 / 2'
      : '1 / 2'
  }
  if (spec.type === 'danger') return 'NE CLIQUE PAS'
  if (spec.type === 'golden') return 'FRAPPE LE TRAIT'
  return 'FRAPPE'
}

function targetDuration(type, multiplier) {
  const base =
    type === 'chain'
      ? 1200
      : type === 'double'
        ? 1250
        : type === 'golden'
          ? 1200
          : type === 'danger'
            ? 980
            : 1050

  return Math.max(
    650,
    Math.round(base * multiplier)
  )
}

function createTargetSpec(fight, elapsed) {
  fight.round += 1

  const tier = comboTier(fight.combo)
  const type = targetType(
    fight.critSeed,
    fight.round,
    tier
  )

  const phase = phaseState(fight, elapsed)

  return {
    round: fight.round,
    type,
    x: 14 + reactionRand(fight.critSeed, fight.round, 2) * 72,
    y: 17 + reactionRand(fight.critSeed, fight.round, 3) * 66,
    x2: 14 + reactionRand(fight.critSeed, fight.round, 4) * 72,
    y2: 17 + reactionRand(fight.critSeed, fight.round, 5) * 66,
    started: elapsed,
    duration: targetDuration(type, phase.durationMultiplier),
    step: 0,
    clickStarted: 0,
  }
}

function renderTarget(fight, spec) {
  const stage = document.querySelector(
    '[data-rpg-raid-stage-v2]'
  )
  if (!stage) return

  let button = stage.querySelector(
    `[data-rpg-raid-target-v2="${spec.round}"]`
  )

  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = `rpg-raid-target-v2 ${spec.type}`
    button.dataset.rpgRaidTargetV2 = String(spec.round)
    button.innerHTML = `
      ${targetIcon(spec.type)}
      <span>${targetInstruction(spec)}</span>
    `
    stage.appendChild(button)
  }

  button.style.left = `${spec.step && spec.type === 'chain' ? spec.x2 : spec.x}%`
  button.style.top = `${spec.step && spec.type === 'chain' ? spec.y2 : spec.y}%`
  const label = button.querySelector('span')
  if (label) {
    label.textContent = targetInstruction(spec)
  }
}

function removeTarget(spec) {
  document
    .querySelector(
      `[data-rpg-raid-target-v2="${spec.round}"]`
    )
    ?.remove()
}

function pushAction(fight, spec, kind, quality) {
  fight.actions.push({
    kind,
    type: spec.type,
    quality,
    round: spec.round,
    at_ms: Math.max(
      0,
      Math.round(currentElapsed(fight))
    ),
  })
}

function resolveMiss(fight, spec, kind = 'miss') {
  if (!fight.targets.has(spec.round)) return

  fight.targets.delete(spec.round)
  removeTarget(spec)

  fight.processed += 1
  fight.misses += 1
  fight.combo = 0
  fight.perfectStreak = 0
  fight.dodgeMultiplier = 1

  pushAction(
    fight,
    spec,
    kind,
    'miss'
  )
}

function resolveDangerDodge(fight, spec) {
  if (!fight.targets.has(spec.round)) return

  fight.targets.delete(spec.round)
  removeTarget(spec)

  fight.processed += 1
  fight.combo += 1
  fight.maxCombo = Math.max(
    fight.maxCombo,
    fight.combo
  )
  fight.dodgeMultiplier = Math.min(
    16,
    fight.dodgeMultiplier * 2
  )

  pushAction(
    fight,
    spec,
    'dodge',
    'perfect'
  )
}

function resolveSuccess(
  fight,
  spec,
  quality
) {
  if (!fight.targets.has(spec.round)) return

  fight.targets.delete(spec.round)
  removeTarget(spec)

  fight.processed += 1
  fight.successful += 1
  fight.combo += 1
  fight.maxCombo = Math.max(
    fight.maxCombo,
    fight.combo
  )

  if (quality === 'perfect') {
    fight.perfect += 1
    fight.perfectStreak += 1
    fight.maxPerfectStreak = Math.max(
      fight.maxPerfectStreak,
      fight.perfectStreak
    )
  } else {
    fight.good += 1
    fight.perfectStreak = 0
  }

  let units =
    quality === 'perfect'
      ? 6
      : 4

  if (spec.type === 'golden') {
    units += 2
  }

  if (
    spec.type === 'double' ||
    spec.type === 'chain'
  ) {
    units *= 2
  }

  units *= fight.dodgeMultiplier
  fight.dodgeMultiplier = 1

  fight.effectiveClicks = Math.min(
    400,
    fight.effectiveClicks + units
  )

  pushAction(
    fight,
    spec,
    spec.type,
    quality
  )
}

function hitTarget(fight, spec) {
  if (
    !fight ||
    fight.finishing ||
    !fight.targets.has(spec.round)
  ) {
    return
  }

  const elapsed =
    currentElapsed(fight) -
    spec.started

  if (spec.type === 'danger') {
    resolveMiss(
      fight,
      spec,
      'danger_hit'
    )
    navigator.vibrate?.(35)
    return
  }

  if (
    spec.type === 'double' &&
    spec.step === 0
  ) {
    spec.step = 1
    spec.clickStarted = elapsed
    renderTarget(fight, spec)
    return
  }

  if (
    spec.type === 'chain' &&
    spec.step === 0
  ) {
    spec.step = 1
    spec.clickStarted = elapsed
    spec.started = currentElapsed(fight)
    spec.duration = 1100
    renderTarget(fight, spec)
    return
  }

  const ratio =
    elapsed /
    Math.max(1, spec.duration)

  const quality =
    ratio <= 0.48
      ? 'perfect'
      : 'good'

  resolveSuccess(
    fight,
    spec,
    quality
  )

  navigator.vibrate?.(
    quality === 'perfect'
      ? 18
      : 10
  )
}

function updateFightHud(fight) {
  const elapsed = currentElapsed(fight)
  const remaining = Math.max(
    0,
    fight.durationMs - elapsed
  )
  const phase = phaseState(
    fight,
    elapsed
  )

  const clock = document.querySelector(
    '[data-rpg-raid-clock-v2]'
  )
  const phaseLabel = document.querySelector(
    '[data-rpg-raid-phase-label-v2]'
  )
  const phaseBonus = document.querySelector(
    '[data-rpg-raid-phase-bonus-v2]'
  )
  const phaseBar = document.querySelector(
    '[data-rpg-raid-phase-bar-v2]'
  )
  const combo = document.querySelector(
    '[data-rpg-raid-combo-v2]'
  )
  const streak = document.querySelector(
    '[data-rpg-raid-streak-v2]'
  )
  const accuracyEl = document.querySelector(
    '[data-rpg-raid-accuracy-v2]'
  )
  const units = document.querySelector(
    '[data-rpg-raid-units-v2]'
  )
  const damage = document.querySelector(
    '[data-rpg-raid-damage-v2]'
  )

  if (clock) {
    clock.textContent =
      (remaining / 1000)
        .toFixed(1)
        .replace('.', ',')
  }

  if (phaseLabel) {
    phaseLabel.textContent = phase.label
  }

  if (phaseBonus) {
    phaseBonus.textContent = phase.bonus
  }

  if (phaseBar) {
    phaseBar.style.width =
      `${Math.round(
        Math.min(
          1,
          elapsed / fight.durationMs
        ) * 100
      )}%`
  }

  if (combo) {
    combo.textContent = `×${fight.combo}`
  }

  if (streak) {
    streak.textContent =
      `×${fight.perfectStreak}`
  }

  if (accuracyEl) {
    accuracyEl.textContent =
      `${fr(accuracy(fight))} %`
  }

  if (units) {
    units.textContent =
      String(fight.effectiveClicks)
  }

  if (damage) {
    const estimated =
      big(fight.baseDamage) *
      BigInt(
        Math.max(
          0,
          Math.floor(
            fight.effectiveClicks
          )
        )
      )

    damage.textContent =
      formatHuge(estimated)
  }

  return remaining
}

function spawnTargets(fight) {
  const elapsed = currentElapsed(fight)
  const phase = phaseState(
    fight,
    elapsed
  )

  const tier = comboTier(
    fight.combo
  )

  const tierMultiplier = [
    1.05,
    0.92,
    0.82,
    0.72,
    0.62,
  ][tier]

  const maxActive =
    Math.min(
      5,
      phase.maxActive +
      (tier >= 3 ? 1 : 0)
    )

  if (
    elapsed < fight.nextSpawnAt ||
    fight.targets.size >= maxActive
  ) {
    return
  }

  const spec =
    createTargetSpec(
      fight,
      elapsed
    )

  fight.targets.set(
    spec.round,
    spec
  )
  fight.generated += 1

  renderTarget(
    fight,
    spec
  )

  fight.nextSpawnAt =
    elapsed +
    Math.max(
      470,
      Math.round(
        phase.interval *
        tierMultiplier
      )
    )
}

function expireTargets(fight) {
  const elapsed = currentElapsed(fight)

  for (const spec of [...fight.targets.values()]) {
    const life =
      elapsed -
      spec.started

    const extra =
      spec.step &&
      (spec.type === 'chain' ||
       spec.type === 'double')
        ? 450
        : 0

    if (
      life <=
      spec.duration + extra
    ) {
      continue
    }

    if (spec.type === 'danger') {
      resolveDangerDodge(
        fight,
        spec
      )
    } else {
      resolveMiss(
        fight,
        spec
      )
    }
  }
}

function combatPayload(fight) {
  return [
    ...fight.actions,
    {
      kind: 'combat_summary_v62',
      successful_actions:
        Math.max(
          0,
          Math.floor(
            fight.successful
          )
        ),
      perfect_actions:
        Math.max(
          0,
          Math.floor(
            fight.perfect
          )
        ),
      good_actions:
        Math.max(
          0,
          Math.floor(
            fight.good
          )
        ),
      missed_actions:
        Math.max(
          0,
          Math.floor(
            fight.misses
          )
        ),
      processed_actions:
        Math.max(
          0,
          Math.floor(
            fight.processed
          )
        ),
      effective_clicks:
        Math.max(
          0,
          Math.min(
            400,
            Math.floor(
              fight.effectiveClicks
            )
          )
        ),
      generated_targets:
        Math.max(
          0,
          Math.floor(
            fight.generated
          )
        ),
      client_combo_max:
        Math.max(
          0,
          Math.floor(
            fight.maxCombo
          )
        ),
      client_perfect_streak_max:
        Math.max(
          0,
          Math.floor(
            fight.maxPerfectStreak
          )
        ),
      definition:
        'perfect_zero_ok_zero_miss',
    },
  ]
}

function ensureFightOverlay() {
  installStyles()

  let overlay = document.getElementById(
    'rpgRaidFightOverlayV2'
  )

  if (overlay) {
    return overlay
  }

  overlay = document.createElement('div')
  overlay.id = 'rpgRaidFightOverlayV2'
  overlay.className = 'rpg-raid-overlay-v2'
  overlay.hidden = true

  overlay.innerHTML = `
    <div class="rpg-raid-arena-v2">
      <div
        class="rpg-raid-fight-view-v2"
        data-rpg-raid-fight-view-v2
        style="display:contents"
      >
        <div class="rpg-raid-fight-head-v2">
          <div>
            <strong data-rpg-raid-boss-name-v2>
              Raid mondial
            </strong>
            <small>
              Palier <span data-rpg-raid-level-v2>1</span>
            </small>
          </div>

          <div
            class="rpg-raid-clock-v2"
            data-rpg-raid-clock-v2
          >
            35,0
          </div>

          <div>
            <strong data-rpg-raid-attempt-v2>
              Essai 1/3
            </strong>
            <small>
              Synergie
              <span data-rpg-raid-team-v2>×1</span>
            </small>
          </div>
        </div>

        <div class="rpg-raid-phase-v2">
          <div class="rpg-raid-phase-line-v2">
            <strong data-rpg-raid-phase-label-v2>
              PHASE 1 · BRÈCHE
            </strong>
            <span data-rpg-raid-phase-bonus-v2>
              Construis ton combo
            </span>
          </div>
          <div class="rpg-raid-phase-track-v2">
            <div
              class="rpg-raid-phase-bar-v2"
              data-rpg-raid-phase-bar-v2
            ></div>
          </div>
        </div>

        <div
          class="rpg-raid-stage-v2"
          data-rpg-raid-stage-v2
        >
          <div class="rpg-raid-portal-v2"></div>
          <div
            class="rpg-raid-boss-v2"
            data-rpg-raid-boss-icon-v2
          >
            🌀
          </div>
        </div>

        <div class="rpg-raid-hud-v2">
          <div>
            <strong data-rpg-raid-combo-v2>×0</strong>
            <span>COMBO</span>
          </div>
          <div>
            <strong data-rpg-raid-streak-v2>×0</strong>
            <span>PARFAIT</span>
          </div>
          <div>
            <strong data-rpg-raid-accuracy-v2>0 %</strong>
            <span>PRÉCISION</span>
          </div>
          <div>
            <strong data-rpg-raid-units-v2>0</strong>
            <span>IMPACTS</span>
          </div>
          <div>
            <strong data-rpg-raid-damage-v2>0</strong>
            <span>DÉGÂTS EST.</span>
          </div>
        </div>
      </div>

      <div
        class="rpg-raid-result-v2"
        data-rpg-raid-result-v2
      >
        <div style="font-size:46px">🌀🏆</div>
        <h2>RAID TERMINÉ</h2>
        <p data-rpg-raid-result-text-v2></p>
        <button
          type="button"
          data-rpg-raid-close-v2
        >
          Revenir à la progression
        </button>
      </div>
    </div>
  `

  overlay.addEventListener(
    'pointerdown',
    event => {
      const button =
        event.target.closest(
          '[data-rpg-raid-target-v2]'
        )

      if (
        !button ||
        !activeFight
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const round =
        Number(
          button.dataset
            .rpgRaidTargetV2
        )

      const spec =
        activeFight.targets.get(
          round
        )

      if (spec) {
        hitTarget(
          activeFight,
          spec
        )
      }
    }
  )

  overlay
    .querySelector(
      '[data-rpg-raid-close-v2]'
    )
    .addEventListener(
      'click',
      async () => {
        overlay.hidden = true
        overlay.remove()
        activeFight = null
        clearInterval(fightTimer)
        fightTimer = null
        await playRpgMenuMusic()
      }
    )

  document.body.appendChild(
    overlay
  )

  return overlay
}

async function publishRaidActivity(
  fight,
  result
) {
  try {
    const {
      data: userData,
    } =
      await supabase.auth.getUser()

    const user =
      userData?.user

    if (
      !user ||
      !fight?.raidId
    ) {
      return
    }

    const payload = {
      set_key:
        `raid|${fight.athleteSlug}|${fight.raidId}`,
      athlete_slug:
        fight.athleteSlug,
      athlete_name:
        fight.athleteName ||
        fight.athleteSlug,
      athlete_emoji:
        fight.athleteEmoji ||
        '🏋️',
      program_key:
        'rpg',
      week_index:
        0,
      week_label:
        'RPG',
      day_index:
        0,
      day_name:
        'Raid mondial',
      set_index:
        0,
      exercise_code:
        'raid',
      exercise_name:
        'Raid mondial',
      reps:
        Math.max(
          1,
          n(
            result?.successful_actions,
            fight.successful
          )
        ),
      load_kg:
        0,
      rpe:
        1,
      activity_type:
        'raid',
      details_text:
        `${fight.athleteName || fight.athleteSlug} a infligé ${formatHuge(result?.raw_damage)} dégâts au raid ${fight.bossName} avec une synergie ×${fr(result?.team_multiplier, 2)}.`,
      created_by:
        user.id,
      updated_at:
        new Date().toISOString(),
    }

    const { error } =
      await supabase
        .from('workout_activities')
        .upsert(
          payload,
          {
            onConflict:
              'set_key',
          }
        )

    if (error) {
      console.warn(
        'Activité Raid non publiée :',
        error.message
      )
    }
  } catch (error) {
    console.warn(
      'Activité Raid non publiée :',
      error
    )
  }
}

async function finishFight(fight) {
  if (
    !fight ||
    fight.finishing
  ) {
    return
  }

  fight.finishing = true

  clearInterval(
    fightTimer
  )
  fightTimer = null

  for (const spec of [...fight.targets.values()]) {
    if (spec.type === 'danger') {
      resolveDangerDodge(
        fight,
        spec
      )
    } else {
      resolveMiss(
        fight,
        spec
      )
    }
  }

  const overlay =
    ensureFightOverlay()

  const resultView =
    overlay.querySelector(
      '[data-rpg-raid-result-v2]'
    )

  const fightView =
    overlay.querySelector(
      '[data-rpg-raid-fight-view-v2]'
    )

  const resultText =
    overlay.querySelector(
      '[data-rpg-raid-result-text-v2]'
    )

  if (fightView) {
    fightView.style.display = 'none'
  }

  resultView?.classList.add(
    'show'
  )

  if (resultText) {
    resultText.innerHTML =
      'Calcul des dégâts et sauvegarde de la tentative...'
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'finish_rpg_raid_run',
      {
        p_run_id:
          fight.id,
        p_actions:
          combatPayload(fight),
      }
    )

  if (error) {
    fight.finishing = false

    if (resultText) {
      resultText.innerHTML = `
        <strong>La tentative est terminée localement.</strong><br>
        La sauvegarde Supabase a échoué :
        ${esc(error.message)}.
      `
    }

    return
  }

  const result =
    Array.isArray(data)
      ? data[0]
      : data

  const awarded =
    Math.max(
      0,
      Math.floor(
        n(
          result?.reward_cases_awarded
        )
      )
    )

  const totalCases =
    Math.max(
      0,
      Math.floor(
        n(
          result?.total_reward_cases,
          result?.projected_reward_cases
        )
      )
    )

  if (resultText) {
    resultText.innerHTML = `
      Essai
      <strong>${n(result?.attempt_number, fight.attemptNumber)}/3</strong>
      · rang personnel provisoire
      <strong>#${n(result?.personal_rank, 1)}</strong>.<br><br>

      Tu as infligé
      <strong>${formatHuge(result?.raw_damage)} dégâts</strong>
      avec
      <strong>${n(result?.successful_actions)} actions réussies</strong>.<br>

      Précision
      <strong>${fr(result?.accuracy_pct)} %</strong>
      · parfaits
      <strong>${n(result?.perfect_actions)}</strong>
      · combo max
      <strong>×${n(result?.max_combo)}</strong>
      · perfect streak
      <strong>×${n(result?.max_perfect_streak)}</strong>.<br><br>

      Synergie :
      <strong>×${fr(result?.team_multiplier, 2)}</strong>
      avec
      <strong>${n(result?.participant_count)}</strong>
      participant${n(result?.participant_count) === 1 ? '' : 's'}.
      Dégâts effectifs :
      <strong>${formatHuge(result?.effective_damage)}</strong>.<br><br>

      ${
        awarded > 0
          ? `🎁 <strong>+${awarded} caisse${awarded === 1 ? '' : 's'} Ultra</strong> immédiatement.`
          : 'Aucune caisse supplémentaire sur cet essai.'
      }<br>

      Total gagné sur ce raid :
      <strong>${totalCases} caisse${totalCases === 1 ? '' : 's'} Ultra</strong>.<br>

      Tentatives restantes :
      <strong>${Math.max(0, n(result?.attempts_remaining))}</strong>.
    `
  }

  await publishRaidActivity(
    fight,
    result
  )

  await loadRpgRaidState({
    athleteSlug:
      fight.athleteSlug,
    state:
      fight.state,
  })

  await fight.onFinished?.(
    result
  )

  navigator.vibrate?.(
    [100, 60, 160, 60, 220]
  )
}

function tickFight(fight) {
  if (
    !fight ||
    fight.finishing
  ) {
    return
  }

  spawnTargets(fight)
  expireTargets(fight)

  const remaining =
    updateFightHud(fight)

  if (remaining <= 0) {
    void finishFight(fight)
  }
}

export async function startRpgRaidFight({
  athleteSlug,
  athleteName,
  athleteEmoji,
  state,
  onFinished,
} = {}) {
  if (
    activeFight ||
    !athleteSlug ||
    !state?.raid?.raid_id
  ) {
    return null
  }

  const raid = state.raid

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'start_rpg_raid_run',
      {
        p_athlete_slug:
          athleteSlug,
        p_raid_id:
          raid.raid_id,
      }
    )

  if (error) {
    throw error
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data

  if (!row?.run_id) {
    throw new Error(
      'Le serveur n’a pas créé la tentative de Raid.'
    )
  }

  const duration =
    Math.max(
      1,
      n(
        row.duration_seconds,
        35
      )
    )

  activeFight = {
    id:
      row.run_id,
    raidId:
      row.raid_id,
    athleteSlug,
    athleteName,
    athleteEmoji,
    state,
    onFinished,
    classKey:
      row.rpg_class,
    bossName:
      row.boss_name ||
      raid.boss_name ||
      'Boss de Raid',
    bossIcon:
      row.boss_icon ||
      raid.boss_icon ||
      '🌀',
    raidLevel:
      Math.max(
        1,
        Math.floor(
          n(
            row.raid_level,
            raid.raid_level
          )
        )
      ),
    baseDamage:
      row.base_damage ||
      1,
    critSeed:
      n(
        row.crit_seed,
        1
      ),
    critChance:
      n(
        row.crit_chance_pct,
        5
      ),
    teamMultiplier:
      n(
        row.team_multiplier,
        1
      ),
    attemptNumber:
      Math.max(
        1,
        Math.floor(
          n(
            row.attempt_number,
            1
          )
        )
      ),
    attemptsRemaining:
      Math.max(
        0,
        Math.floor(
          n(
            row.attempts_remaining,
            2
          )
        )
      ),
    rewardCasesBest:
      Math.max(
        0,
        Math.floor(
          n(
            row.reward_cases_best
          )
        )
      ),
    duration,
    durationMs:
      duration * 1000,
    startedAt:
      performance.now(),
    serverStartedAt:
      row.started_at ||
      null,
    nextSpawnAt:
      650,
    round:
      0,
    targets:
      new Map(),
    actions:
      [],
    successful:
      0,
    perfect:
      0,
    good:
      0,
    misses:
      0,
    processed:
      0,
    generated:
      0,
    combo:
      0,
    maxCombo:
      0,
    perfectStreak:
      0,
    maxPerfectStreak:
      0,
    effectiveClicks:
      0,
    dodgeMultiplier:
      1,
    finishing:
      false,
  }

  const fight =
    activeFight

  const overlay =
    ensureFightOverlay()

  overlay.hidden = false

  const fightView =
    overlay.querySelector(
      '[data-rpg-raid-fight-view-v2]'
    )

  const resultView =
    overlay.querySelector(
      '[data-rpg-raid-result-v2]'
    )

  if (fightView) {
    fightView.style.display = 'contents'
  }

  resultView?.classList.remove(
    'show'
  )

  overlay.querySelector(
    '[data-rpg-raid-boss-name-v2]'
  ).textContent =
    fight.bossName

  overlay.querySelector(
    '[data-rpg-raid-level-v2]'
  ).textContent =
    String(
      fight.raidLevel
    )

  overlay.querySelector(
    '[data-rpg-raid-boss-icon-v2]'
  ).textContent =
    fight.bossIcon

  overlay.querySelector(
    '[data-rpg-raid-team-v2]'
  ).textContent =
    `×${fr(
      fight.teamMultiplier,
      2
    )}`

  overlay.querySelector(
    '[data-rpg-raid-attempt-v2]'
  ).textContent =
    `Essai ${fight.attemptNumber}/3`

  await playRpgBattleMusic({
    mode: 'raid',
    raid: true,
    raidLevel:
      fight.raidLevel,
    bossName:
      fight.bossName,
    isBoss: true,
    isEliteSpecial: true,
  })

  clearInterval(
    fightTimer
  )

  fightTimer =
    setInterval(
      () => {
        tickFight(
          fight
        )
      },
      50
    )

  tickFight(
    fight
  )

  return fight
}
