import { supabase } from './supabase.js'

const IDLE_TABS = new Set([
  'camp',
  'sleep',
  'pve',
  'pvp',
])

const ENERGY_CAP = 500
const SLEEP_TARGET_SECONDS = 8 * 60 * 60

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, number(value)))
}

function athleteSlug(athlete) {
  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    ''
  ).trim()
}

function durationLabel(totalSeconds) {
  const total =
    Math.max(
      0,
      Math.floor(number(totalSeconds))
    )

  const hours =
    Math.floor(total / 3600)

  const minutes =
    Math.floor((total % 3600) / 60)

  const seconds =
    total % 60

  if (hours > 0) {
    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].join(':')
  }

  return [
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':')
}

function metricPercent(value) {
  return clamp(value, 0, 100)
}

function displayNameFromSlug(value) {
  return String(value || '')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function assetPath(value) {
  const raw = String(value || '').trim()

  if (!raw) {
    return ''
  }

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:')
  ) {
    return raw
  }

  return '/' + raw.replace(/^\/+/, '')
}

function normalizeMonsterKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function ensureStyle() {
  if (
    document.getElementById(
      'ga-idle-game-style-v1'
    )
  ) {
    return
  }

  const style =
    document.createElement('style')

  style.id =
    'ga-idle-game-style-v1'

  style.textContent = `
    .idle-page-v1{min-height:100vh;padding:18px;color:#f7f4ff;background:
      radial-gradient(circle at 50% -15%,rgba(125,73,255,.26),transparent 36%),
      radial-gradient(circle at 10% 34%,rgba(34,190,255,.10),transparent 30%),
      linear-gradient(180deg,#060816,#090c1d 55%,#050711)}
    .idle-top-v1{max-width:1060px;margin:0 auto 14px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}
    .idle-top-v1 h1{margin:2px 0 0;font-size:26px;letter-spacing:-.03em}
    .idle-top-v1 span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#a99fff;text-transform:uppercase}
    .idle-back-v1,.idle-switch-v1{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.04);color:#f2efff;font-weight:900;cursor:pointer}
    .idle-shell-v1{max-width:1060px;margin:0 auto}
    .idle-tabs-v1{display:flex;gap:7px;overflow:auto;padding:3px 0 10px;scrollbar-width:none}
    .idle-tabs-v1::-webkit-scrollbar{display:none}
    .idle-tabs-v1 button{flex:0 0 auto;border:1px solid rgba(255,255,255,.075);border-radius:999px;padding:9px 13px;background:rgba(255,255,255,.035);color:#807f9d;font-size:11px;font-weight:950;cursor:pointer}
    .idle-tabs-v1 button.active{color:#fff;border-color:rgba(153,116,255,.55);background:linear-gradient(135deg,rgba(125,73,255,.28),rgba(44,170,255,.16));box-shadow:0 0 22px rgba(125,73,255,.13)}
    .idle-grid-v1{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:12px}
    .idle-card-v1{border:1px solid rgba(255,255,255,.08);border-radius:20px;background:linear-gradient(180deg,rgba(20,25,55,.92),rgba(9,12,28,.96));box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:hidden}
    .idle-card-pad-v1{padding:16px}
    .idle-hero-v1{position:relative;min-height:245px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;background:
      radial-gradient(circle at 88% 22%,rgba(113,79,255,.30),transparent 26%),
      radial-gradient(circle at 10% 78%,rgba(39,195,255,.14),transparent 30%),
      linear-gradient(140deg,#111638,#0b0f25 65%,#090c1d)}
    .idle-hero-v1:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(255,255,255,.38) 0 1px,transparent 1.5px);background-size:42px 42px;opacity:.08}
    .idle-hero-copy-v1{position:relative;z-index:1;max-width:610px}
    .idle-kicker-v1{display:inline-flex;gap:7px;align-items:center;color:#a9a2ff;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
    .idle-hero-v1 h2{margin:8px 0 5px;font-size:32px;letter-spacing:-.04em}
    .idle-hero-v1 p{margin:0;max-width:590px;color:#a7aac5;font-size:12px;line-height:1.6}
    .idle-power-row-v1{position:relative;z-index:1;display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}
    .idle-power-pill-v1{padding:10px 13px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(3,5,15,.38);backdrop-filter:blur(8px)}
    .idle-power-pill-v1 b{display:block;font-size:20px;color:#fff}
    .idle-power-pill-v1 span{font-size:9px;color:#848aa8;text-transform:uppercase;font-weight:900;letter-spacing:.08em}
    .idle-metrics-v1{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .idle-metric-v1{padding:13px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055)}
    .idle-metric-head-v1{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
    .idle-metric-head-v1 strong{font-size:13px}.idle-metric-head-v1 b{font-size:15px;color:#c9c1ff}
    .idle-metric-v1 p{min-height:30px;margin:5px 0 9px;color:#747c99;font-size:9px;line-height:1.5}
    .idle-track-v1{height:7px;border-radius:99px;background:#070a17;overflow:hidden}
    .idle-track-v1 span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7953ff,#52c6ff);box-shadow:0 0 14px rgba(111,83,255,.45)}
    .idle-energy-v1{display:grid;gap:10px}
    .idle-energy-ring-v1{width:152px;height:152px;margin:5px auto;display:grid;place-items:center;border-radius:50%;background:conic-gradient(#7a52ff var(--energy-pct),rgba(255,255,255,.055) 0);position:relative}
    .idle-energy-ring-v1:after{content:"";position:absolute;inset:10px;border-radius:50%;background:#0b0f24}
    .idle-energy-ring-v1 div{position:relative;z-index:1;text-align:center}
    .idle-energy-ring-v1 b{display:block;font-size:31px}.idle-energy-ring-v1 span{font-size:9px;color:#8189a6;text-transform:uppercase;font-weight:900}
    .idle-primary-v1,.idle-secondary-v1{border:0;border-radius:13px;padding:12px 15px;font-weight:950;cursor:pointer}
    .idle-primary-v1{background:linear-gradient(135deg,#7f5cff,#47bdf7);color:white;box-shadow:0 10px 28px rgba(103,81,255,.22)}
    .idle-secondary-v1{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#d8d9e9}
    .idle-primary-v1:disabled,.idle-secondary-v1:disabled{opacity:.38;cursor:not-allowed}
    .idle-note-v1{padding:10px 12px;border-radius:12px;background:rgba(125,83,255,.08);color:#aeb0c9;font-size:10px;line-height:1.55}
    .idle-notice-v1{margin-bottom:10px;padding:11px 13px;border:1px solid rgba(81,198,255,.18);border-radius:13px;background:rgba(81,198,255,.07);font-size:11px;color:#cfefff}
    .idle-select-v1{max-width:900px;margin:0 auto;padding:18px}
    .idle-select-grid-v1{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px;margin-top:14px}
    .idle-select-card-v1{display:grid;grid-template-columns:50px 1fr;gap:10px;align-items:center;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:11px;background:#0d1125;color:white;text-align:left;cursor:pointer}
    .idle-avatar-v1{width:48px;height:48px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#7a52ff,#1d9ed1);display:grid;place-items:center;font-size:22px;border:1px solid rgba(255,255,255,.12)}
    .idle-avatar-v1 img{width:100%;height:100%;object-fit:cover}
    .idle-sleep-v1{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.75fr);gap:12px}
    .idle-moon-v1{min-height:390px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px;text-align:center;background:
      radial-gradient(circle at 50% 34%,rgba(142,126,255,.30),transparent 24%),
      linear-gradient(180deg,#111436,#080b20)}
    .idle-moon-v1:before{content:"☾";font-size:112px;line-height:1;color:#d8d4ff;filter:drop-shadow(0 0 34px rgba(140,125,255,.38));animation:idleMoonFloat 5s ease-in-out infinite}
    .idle-sleep-time-v1{font-size:40px;font-weight:950;letter-spacing:-.04em;margin-top:5px;font-variant-numeric:tabular-nums}
    .idle-sleep-state-v1{font-size:11px;color:#969dbb;margin-top:4px}
    .idle-sounds-v1{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}
    .idle-sound-v1{border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:11px;background:rgba(255,255,255,.035);color:#b5b8cf;font-weight:900;cursor:pointer}
    .idle-sound-v1.active{border-color:rgba(139,118,255,.55);color:#fff;background:rgba(122,82,255,.15)}
    .idle-battle-stage-v1{position:relative;min-height:390px;display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;padding:20px;background:
      radial-gradient(circle at 50% 46%,rgba(137,75,255,.17),transparent 34%),
      linear-gradient(180deg,#111536,#080a1b)}
    .idle-fighter-v1{text-align:center}
    .idle-fighter-visual-v1{height:210px;display:grid;place-items:center}
    .idle-fighter-visual-v1 img{max-width:100%;max-height:210px;object-fit:contain;filter:drop-shadow(0 18px 18px rgba(0,0,0,.45))}
    .idle-fighter-visual-v1 .idle-avatar-v1{width:128px;height:128px;font-size:54px;margin:auto}
    .idle-fighter-v1 strong{display:block;font-size:15px}.idle-fighter-v1 small{display:block;margin-top:3px;color:#7e86a2;font-size:10px}
    .idle-vs-v1{font-size:21px;font-weight:950;color:#846aff;text-shadow:0 0 18px rgba(132,106,255,.4)}
    .idle-result-v1{margin:12px;padding:14px;border-radius:15px;text-align:center;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.035)}
    .idle-result-v1.win{border-color:rgba(71,221,161,.24);background:rgba(71,221,161,.07)}
    .idle-result-v1.loss{border-color:rgba(255,97,122,.22);background:rgba(255,97,122,.06)}
    .idle-result-v1 h3{margin:0;font-size:20px}.idle-result-v1 p{margin:7px 0 0;color:#989eb9;font-size:10px;line-height:1.6}
    .idle-history-v1{display:grid;gap:6px}
    .idle-history-row-v1{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.03)}
    .idle-history-row-v1 b{font-size:10px}.idle-history-row-v1 small{display:block;color:#747c98;font-size:8px;margin-top:2px}
    .idle-history-row-v1 em{font-style:normal;font-size:10px;font-weight:950}
    .idle-history-row-v1 em.win{color:#58dda8}.idle-history-row-v1 em.loss{color:#ff748b}
    .idle-busy-v1{opacity:.56;pointer-events:none}
    @keyframes idleMoonFloat{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-8px) rotate(2deg)}}
    @media(max-width:760px){
      .idle-grid-v1,.idle-sleep-v1{grid-template-columns:1fr}
      .idle-page-v1{padding:12px}
      .idle-top-v1{grid-template-columns:auto 1fr}
      .idle-switch-v1{grid-column:1/-1}
      .idle-metrics-v1{grid-template-columns:1fr}
      .idle-battle-stage-v1{grid-template-columns:1fr 44px 1fr;padding:12px}
      .idle-fighter-visual-v1{height:160px}
      .idle-fighter-visual-v1 img{max-height:160px}
      .idle-fighter-visual-v1 .idle-avatar-v1{width:92px;height:92px;font-size:38px}
      .idle-hero-v1 h2{font-size:27px}
    }
  `

  document.head.appendChild(style)
}

function createAmbientEngine() {
  let context = null
  let nodes = []

  function stop() {
    for (const node of nodes) {
      try {
        node.stop?.()
      } catch {
        // no-op
      }

      try {
        node.disconnect?.()
      } catch {
        // no-op
      }
    }

    nodes = []

    if (context) {
      try {
        context.close()
      } catch {
        // no-op
      }
    }

    context = null
  }

  async function start(mode) {
    stop()

    if (mode === 'none') {
      return
    }

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext

    if (!AudioContextClass) {
      return
    }

    context =
      new AudioContextClass()

    await context.resume()

    if (
      mode === 'rain' ||
      mode === 'brown'
    ) {
      const seconds = 4
      const length =
        context.sampleRate *
        seconds

      const buffer =
        context.createBuffer(
          1,
          length,
          context.sampleRate
        )

      const data =
        buffer.getChannelData(0)

      let last = 0

      for (
        let i = 0;
        i < length;
        i += 1
      ) {
        const white =
          Math.random() * 2 - 1

        if (mode === 'brown') {
          last =
            (last + 0.02 * white) /
            1.02

          data[i] =
            last * 3.2
        } else {
          data[i] =
            white * 0.55
        }
      }

      const source =
        context.createBufferSource()

      const filter =
        context.createBiquadFilter()

      const gain =
        context.createGain()

      source.buffer = buffer
      source.loop = true

      filter.type =
        mode === 'brown'
          ? 'lowpass'
          : 'bandpass'

      filter.frequency.value =
        mode === 'brown'
          ? 1200
          : 2400

      filter.Q.value =
        mode === 'brown'
          ? 0.5
          : 0.8

      gain.gain.value =
        mode === 'brown'
          ? 0.075
          : 0.052

      source.connect(filter)
      filter.connect(gain)
      gain.connect(
        context.destination
      )

      source.start()

      nodes.push(
        source,
        filter,
        gain
      )

      return
    }

    if (mode === 'temple') {
      const gain =
        context.createGain()

      gain.gain.value = 0.028
      gain.connect(
        context.destination
      )

      const lfo =
        context.createOscillator()

      const lfoGain =
        context.createGain()

      lfo.frequency.value = 0.08
      lfoGain.gain.value = 0.018

      lfo.connect(lfoGain)
      lfoGain.connect(
        gain.gain
      )

      const low =
        context.createOscillator()

      const high =
        context.createOscillator()

      low.type = 'sine'
      high.type = 'sine'
      low.frequency.value = 110
      high.frequency.value = 164.81

      low.connect(gain)
      high.connect(gain)

      lfo.start()
      low.start()
      high.start()

      nodes.push(
        lfo,
        lfoGain,
        low,
        high,
        gain
      )
    }
  }

  return {
    start,
    stop,
  }
}

function battleSound(won) {
  try {
    const audio =
      new Audio(
        won
          ? '/ragnarok-perfect.mp3'
          : '/ragnarok-miss.mp3'
      )

    audio.volume = 0.35
    void audio.play()
  } catch {
    // Audio is cosmetic.
  }
}

export async function mountIdleGame(
  root,
  options = {}
) {
  ensureStyle()

  const athletes =
    Array.isArray(options.athletes)
      ? options.athletes
      : []

  let selectedSlug =
    String(
      options.initialSlug || ''
    )

  let activeTab = 'camp'
  let snapshot = null
  let history = []
  let manifest = []
  let battle = null
  let busy = false
  let notice = ''
  let sleepTicker = null

  const ambient =
    createAmbientEngine()

  let soundMode = (() => {
    try {
      const saved =
        localStorage.getItem(
          'ga-idle-sleep-sound-v1'
        )

      return [
        'none',
        'rain',
        'brown',
        'temple',
      ].includes(saved)
        ? saved
        : 'rain'
    } catch {
      return 'rain'
    }
  })()

  function selectedAthlete() {
    return athletes.find(
      athlete =>
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

  function cleanup() {
    ambient.stop()

    if (sleepTicker) {
      clearInterval(sleepTicker)
      sleepTicker = null
    }

    root.onclick = null
  }

  function back() {
    cleanup()
    options.onBack?.()
  }

  async function loadManifest() {
    if (manifest.length) {
      return
    }

    try {
      const response =
        await fetch(
          '/sprites/monsters/manifest.json'
        )

      const data =
        await response.json()

      manifest =
        Array.isArray(data)
          ? data
          : []
    } catch {
      manifest = []
    }
  }

  function monsterImage(row) {
    const key =
      normalizeMonsterKey(
        row?.monster_key
      )

    const match =
      manifest.find(item =>
        normalizeMonsterKey(
          item?.key
        ) === key
      )

    return assetPath(
      row?.skin_path ||
      match?.file ||
      ''
    )
  }

  async function loadSelected() {
    if (!selectedSlug) {
      snapshot = null
      history = []
      return
    }

    busy = true
    notice = ''
    render()

    const [
      snapshotResult,
      historyResult,
    ] = await Promise.all([
      supabase.rpc(
        'idle_get_snapshot_v1',
        {
          p_athlete_slug:
            selectedSlug,
        }
      ),
      supabase.rpc(
        'idle_recent_battles_v1',
        {
          p_athlete_slug:
            selectedSlug,
          p_limit: 8,
        }
      ),
      loadManifest(),
    ])

    busy = false

    if (snapshotResult.error) {
      notice =
        snapshotResult.error.message ||
        'Idle indisponible.'
      snapshot = null
      render()
      return
    }

    snapshot =
      Array.isArray(
        snapshotResult.data
      )
        ? snapshotResult.data[0]
        : snapshotResult.data

    history =
      historyResult.error
        ? []
        : (
          Array.isArray(
            historyResult.data
          )
            ? historyResult.data
            : []
        )

    render()
  }

  function renderAthleteAvatar(
    athlete,
    large = false
  ) {
    const image =
      athlete?.profileImage

    return `
      <div class="idle-avatar-v1 ${large ? 'large' : ''}">
        ${image
          ? `
            <img
              src="${esc(image)}"
              alt=""
              loading="lazy"
            >
          `
          : esc(
              athlete?.emoji ||
              '🏋️'
            )}
      </div>
    `
  }

  function renderSelect() {
    root.innerHTML = `
      <main class="idle-page-v1">
        <section class="idle-select-v1">
          <button
            type="button"
            class="idle-back-v1"
            data-idle-back
          >
            ← Jeu
          </button>

          <div style="margin-top:18px">
            <span class="idle-kicker-v1">
              ⚡ GA IDLE
            </span>
            <h1 style="margin:7px 0 0">
              Choisir un combattant
            </h1>
          </div>

          <div class="idle-select-grid-v1">
            ${athletes.map(
              athlete => `
                <button
                  type="button"
                  class="idle-select-card-v1"
                  data-idle-select="${esc(
                    athleteSlug(
                      athlete
                    )
                  )}"
                >
                  ${renderAthleteAvatar(
                    athlete
                  )}
                  <div>
                    <strong>
                      ${esc(
                        athlete.name ||
                        athlete.id
                      )}
                    </strong>
                    <small style="display:block;margin-top:3px;color:#747c98">
                      Ouvrir GA Idle
                    </small>
                  </div>
                </button>
              `
            ).join('')}
          </div>
        </section>
      </main>
    `
  }

  function metricCard({
    icon,
    title,
    value,
    text,
    score,
  }) {
    return `
      <article class="idle-metric-v1">
        <div class="idle-metric-head-v1">
          <strong>
            ${icon} ${esc(title)}
          </strong>

          <b>
            ${Math.round(
              metricPercent(score)
            )}%
          </b>
        </div>

        <p>
          ${esc(value)}
          ·
          ${esc(text)}
        </p>

        <div class="idle-track-v1">
          <span
            style="width:${metricPercent(score)}%"
          ></span>
        </div>
      </article>
    `
  }

  function renderCamp() {
    const current =
      snapshot || {}

    const energy =
      number(
        current.idle_energy
      )

    const pending =
      number(
        current.pending_energy
      )

    const pct =
      clamp(
        energy / ENERGY_CAP * 100,
        0,
        100
      )

    return `
      <div class="idle-grid-v1">
        <section class="idle-card-v1">
          <div class="idle-hero-v1">
            <div class="idle-hero-copy-v1">
              <span class="idle-kicker-v1">
                ⚡ TON CORPS = TON BUILD
              </span>

              <h2>
                La vraie vie nourrit le jeu.
              </h2>

              <p>
                Ici aucun bouton ne remplace l'entraînement :
                tes séries validées, tes pas et ton sommeil
                déterminent directement ta puissance et ta
                production idle.
              </p>
            </div>

            <div class="idle-power-row-v1">
              <div class="idle-power-pill-v1">
                <b>
                  ${number(
                    current.power,
                    35
                  )}
                </b>
                <span>Puissance</span>
              </div>

              <div class="idle-power-pill-v1">
                <b>
                  +${number(
                    current.idle_rate
                  )}/h
                </b>
                <span>Énergie idle</span>
              </div>

              <div class="idle-power-pill-v1">
                <b>
                  ${number(
                    current.idle_xp
                  )}
                </b>
                <span>XP Idle</span>
              </div>

              <div class="idle-power-pill-v1">
                <b>
                  ${number(
                    current.rank_points,
                    1000
                  )}
                </b>
                <span>Cote PvP</span>
              </div>
            </div>
          </div>

          <div class="idle-card-pad-v1">
            <div class="idle-metrics-v1">
              ${metricCard({
                icon: '🏋️',
                title: 'Séance',
                value:
                  `${number(
                    current.training_sets
                  )} séries validées`,
                text:
                  `${number(
                    current.completed_sessions
                  )} séance(s) terminée(s)`,
                score:
                  current.training_score,
              })}

              ${metricCard({
                icon: '🚶',
                title: 'Steps',
                value:
                  `${number(
                    current.steps
                  ).toLocaleString(
                    'fr-FR'
                  )} pas`,
                text:
                  '10 000 = score max',
                score:
                  current.steps_score,
              })}

              ${metricCard({
                icon: '🌙',
                title: 'Sommeil',
                value:
                  durationLabel(
                    current.sleep_seconds
                  ),
                text:
                  '8 h = récupération max',
                score:
                  current.sleep_score,
              })}
            </div>
          </div>
        </section>

        <aside class="idle-card-v1 idle-card-pad-v1 idle-energy-v1">
          <span class="idle-kicker-v1">
            🔋 ÉNERGIE DE COMBAT
          </span>

          <div
            class="idle-energy-ring-v1"
            style="--energy-pct:${pct}%"
          >
            <div>
              <b>
                ${energy}
              </b>
              <span>
                / ${ENERGY_CAP}
              </span>
            </div>
          </div>

          <div class="idle-note-v1">
            ${pending > 0
              ? `+${pending} énergie disponible grâce à ton activité réelle depuis ta dernière collecte.`
              : current.idle_rate > 0
                ? `Production actuelle : +${number(current.idle_rate)} énergie par heure.`
                : 'Bouge, entraîne-toi ou dors pour lancer la production idle.'}
          </div>

          <button
            type="button"
            class="idle-primary-v1"
            data-idle-claim
            ${busy ? 'disabled' : ''}
          >
            ${pending > 0
              ? `Collecter +${pending}`
              : 'Actualiser mes données'}
          </button>

          <button
            type="button"
            class="idle-secondary-v1"
            data-idle-tab="pve"
          >
            ⚔️ Partir en PvE
          </button>
        </aside>
      </div>
    `
  }

  function renderSleep() {
    const activeStarted =
      snapshot?.active_sleep_started_at

    const active =
      Boolean(activeStarted)

    const elapsed =
      active
        ? Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                new Date(
                  activeStarted
                ).getTime()
              ) / 1000
            )
          )
        : number(
            snapshot?.sleep_seconds
          )

    const progress =
      clamp(
        elapsed /
        SLEEP_TARGET_SECONDS *
        100,
        0,
        100
      )

    return `
      <div class="idle-sleep-v1">
        <section class="idle-card-v1 idle-moon-v1">
          <div class="idle-sleep-time-v1" data-idle-sleep-timer>
            ${durationLabel(
              elapsed
            )}
          </div>

          <div class="idle-sleep-state-v1">
            ${active
              ? 'Sommeil en cours · le chrono est enregistré côté serveur'
              : 'Temps de sommeil enregistré aujourd’hui'}
          </div>

          <div style="width:min(100%,320px);margin-top:14px">
            <div class="idle-track-v1">
              <span
                style="width:${progress}%"
              ></span>
            </div>
            <small style="display:block;margin-top:6px;color:#747c98">
              Objectif jeu : 8 h · ${Math.round(progress)} %
            </small>
          </div>

          <button
            type="button"
            class="idle-primary-v1"
            style="margin-top:20px;min-width:220px"
            data-idle-sleep-toggle
            ${(!canEdit() || busy) ? 'disabled' : ''}
          >
            ${active
              ? '☀️ Je me réveille'
              : '🌙 Démarrer mon sommeil'}
          </button>
        </section>

        <aside class="idle-card-v1 idle-card-pad-v1">
          <span class="idle-kicker-v1">
            🎧 AMBIANCE MÉDITATION
          </span>

          <h3 style="margin:8px 0 4px">
            Son d’endormissement
          </h3>

          <p style="margin:0;color:#838ba8;font-size:10px;line-height:1.55">
            Le timer continue grâce à l’heure serveur même si
            l’application est fermée. Les sons sont générés
            localement et ne transmettent aucun micro.
          </p>

          <div class="idle-sounds-v1">
            ${[
              ['rain','🌧️ Pluie'],
              ['brown','🟤 Bruit brun'],
              ['temple','🕯️ Temple'],
              ['none','🔇 Silence'],
            ].map(
              ([key,label]) => `
                <button
                  type="button"
                  class="idle-sound-v1 ${soundMode === key ? 'active' : ''}"
                  data-idle-sound="${key}"
                >
                  ${label}
                </button>
              `
            ).join('')}
          </div>

          <div class="idle-note-v1" style="margin-top:12px">
            Le jeu utilise uniquement la durée entre
            « Démarrer mon sommeil » et « Je me réveille ».
            Maximum de contribution : 8 h pour le score de
            récupération.
          </div>
        </aside>
      </div>
    `
  }

  function fighterAvatar() {
    const athlete =
      selectedAthlete()

    return athlete?.profileImage
      ? `
        <div class="idle-avatar-v1">
          <img
            src="${esc(
              athlete.profileImage
            )}"
            alt=""
          >
        </div>
      `
      : `
        <div class="idle-avatar-v1">
          ${esc(
            athlete?.emoji ||
            '🏋️'
          )}
        </div>
      `
  }

  function renderBattleResult(
    mode
  ) {
    if (
      !battle ||
      battle.mode !== mode
    ) {
      return ''
    }

    const won =
      Boolean(battle.won)

    const opponent =
      mode === 'pve'
        ? (
          battle.monster_name ||
          battle.monster_key ||
          'Monstre'
        )
        : (
          battle.defender_name ||
          displayNameFromSlug(
            battle.defender_slug
          )
        )

    return `
      <div class="idle-result-v1 ${won ? 'win' : 'loss'}">
        <h3>
          ${won
            ? '🏆 Victoire'
            : '💀 Défaite'}
        </h3>

        <p>
          ${esc(opponent)}
          ·
          +${number(
            battle.xp_gain
          )} XP
          ${mode === 'pvp'
            ? ` · cote ${number(battle.rank_delta) >= 0 ? '+' : ''}${number(battle.rank_delta)}`
            : ''}
        </p>
      </div>
    `
  }

  function renderPve() {
    const current =
      snapshot || {}

    const image =
      battle?.mode === 'pve'
        ? monsterImage(
            battle
          )
        : '/sprites/monsters/le-monstre-du-sbd-complet.webp'

    const monsterName =
      battle?.mode === 'pve'
        ? (
          battle.monster_name ||
          battle.monster_key
        )
        : 'Prochaine rencontre'

    const monsterIcon =
      battle?.mode === 'pve'
        ? battle.icon
        : '👾'

    return `
      <div class="idle-grid-v1">
        <section class="idle-card-v1">
          <div class="idle-battle-stage-v1">
            <div class="idle-fighter-v1">
              <div class="idle-fighter-visual-v1">
                ${fighterAvatar()}
              </div>

              <strong>
                ${esc(
                  selectedAthlete()?.name ||
                  selectedSlug
                )}
              </strong>

              <small>
                Puissance ${number(
                  current.power,
                  35
                )}
              </small>
            </div>

            <div class="idle-vs-v1">
              VS
            </div>

            <div class="idle-fighter-v1">
              <div class="idle-fighter-visual-v1">
                ${image
                  ? `
                    <img
                      src="${esc(image)}"
                      alt=""
                    >
                  `
                  : `
                    <div class="idle-avatar-v1">
                      ${esc(
                        monsterIcon ||
                        '👾'
                      )}
                    </div>
                  `}
              </div>

              <strong>
                ${esc(
                  monsterName ||
                  'Monstre'
                )}
              </strong>

              <small>
                ${battle?.mode === 'pve'
                  ? `${esc(battle.rarity || '')} · Puissance ${number(battle.enemy_power)}`
                  : 'Le bestiaire complet peut apparaître'}
              </small>
            </div>
          </div>

          ${renderBattleResult(
            'pve'
          )}
        </section>

        <aside class="idle-card-v1 idle-card-pad-v1">
          <span class="idle-kicker-v1">
            👾 EXPÉDITION AUTOMATIQUE
          </span>

          <h3 style="margin:8px 0 5px">
            PvE · 6 énergie
          </h3>

          <p style="margin:0 0 12px;color:#858da9;font-size:10px;line-height:1.6">
            Combat automatique façon jeu idle.
            La difficulté monte toutes les 8 victoires
            et pioche dans les monstres déjà présents dans
            l’application.
          </p>

          <div class="idle-power-row-v1" style="margin:0 0 12px">
            <div class="idle-power-pill-v1">
              <b>
                ${number(
                  current.pve_wins
                )}
              </b>
              <span>Victoires</span>
            </div>

            <div class="idle-power-pill-v1">
              <b>
                ${number(
                  current.pve_losses
                )}
              </b>
              <span>Défaites</span>
            </div>
          </div>

          <button
            type="button"
            class="idle-primary-v1"
            data-idle-pve
            ${(!canEdit() || busy) ? 'disabled' : ''}
          >
            ⚔️ Lancer le combat
          </button>

          <button
            type="button"
            class="idle-secondary-v1"
            style="margin-top:8px;width:100%"
            data-idle-claim
          >
            🔋 Collecter l’énergie
          </button>
        </aside>
      </div>
    `
  }

  function renderPvp() {
    const current =
      snapshot || {}

    const opponent =
      battle?.mode === 'pvp'
        ? (
          battle.defender_name ||
          displayNameFromSlug(
            battle.defender_slug
          )
        )
        : 'Adversaire aléatoire'

    return `
      <div class="idle-grid-v1">
        <section class="idle-card-v1">
          <div class="idle-battle-stage-v1">
            <div class="idle-fighter-v1">
              <div class="idle-fighter-visual-v1">
                ${fighterAvatar()}
              </div>

              <strong>
                ${esc(
                  selectedAthlete()?.name ||
                  selectedSlug
                )}
              </strong>

              <small>
                ${number(
                  current.rank_points,
                  1000
                )} ELO · PWR ${number(
                  current.power,
                  35
                )}
              </small>
            </div>

            <div class="idle-vs-v1">
              VS
            </div>

            <div class="idle-fighter-v1">
              <div class="idle-fighter-visual-v1">
                <div class="idle-avatar-v1">
                  🥊
                </div>
              </div>

              <strong>
                ${esc(opponent)}
              </strong>

              <small>
                ${battle?.mode === 'pvp'
                  ? `PWR ${number(battle.defender_power)}`
                  : 'Puissance calculée sur ses vraies données'}
              </small>
            </div>
          </div>

          ${renderBattleResult(
            'pvp'
          )}
        </section>

        <aside class="idle-card-v1 idle-card-pad-v1">
          <span class="idle-kicker-v1">
            🥊 ARÈNE ASYNCHRONE
          </span>

          <h3 style="margin:8px 0 5px">
            PvP · 10 énergie
          </h3>

          <p style="margin:0 0 12px;color:#858da9;font-size:10px;line-height:1.6">
            Comme La Brute : tu lances le duel et les deux
            combattants se battent automatiquement.
            Aucun clic de vitesse : le résultat dépend des
            données séance + pas + sommeil des deux athlètes.
          </p>

          <div class="idle-power-row-v1" style="margin:0 0 12px">
            <div class="idle-power-pill-v1">
              <b>
                ${number(
                  current.pvp_wins
                )}
              </b>
              <span>Victoires</span>
            </div>

            <div class="idle-power-pill-v1">
              <b>
                ${number(
                  current.pvp_losses
                )}
              </b>
              <span>Défaites</span>
            </div>
          </div>

          <button
            type="button"
            class="idle-primary-v1"
            data-idle-pvp
            ${(!canEdit() || busy) ? 'disabled' : ''}
          >
            🥊 Chercher un adversaire
          </button>

          <div class="idle-history-v1" style="margin-top:14px">
            ${history.length
              ? history.slice(0,6).map(
                  row => `
                    <div class="idle-history-row-v1">
                      <span>
                        ${row.mode === 'pvp' ? '🥊' : '👾'}
                      </span>

                      <div>
                        <b>
                          ${esc(
                            row.opponent ||
                            'Combat'
                          )}
                        </b>
                        <small>
                          PWR
                          ${number(
                            row.attacker_power
                          )}
                          /
                          ${number(
                            row.defender_power
                          )}
                        </small>
                      </div>

                      <em class="${row.won ? 'win' : 'loss'}">
                        ${row.won ? 'WIN' : 'LOSE'}
                      </em>
                    </div>
                  `
                ).join('')
              : `
                <div class="idle-note-v1">
                  Aucun combat enregistré pour le moment.
                </div>
              `}
          </div>
        </aside>
      </div>
    `
  }

  function renderContent() {
    if (!snapshot) {
      return `
        <section class="idle-card-v1 idle-card-pad-v1">
          <strong>
            Chargement de GA Idle…
          </strong>
        </section>
      `
    }

    if (activeTab === 'sleep') {
      return renderSleep()
    }

    if (activeTab === 'pve') {
      return renderPve()
    }

    if (activeTab === 'pvp') {
      return renderPvp()
    }

    return renderCamp()
  }

  function scheduleSleepTicker() {
    if (sleepTicker) {
      clearInterval(sleepTicker)
      sleepTicker = null
    }

    if (
      !snapshot?.active_sleep_started_at
    ) {
      return
    }

    sleepTicker =
      setInterval(() => {
        const element =
          root.querySelector(
            '[data-idle-sleep-timer]'
          )

        if (!element) {
          return
        }

        const elapsed =
          Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                new Date(
                  snapshot.active_sleep_started_at
                ).getTime()
              ) / 1000
            )
          )

        element.textContent =
          durationLabel(
            elapsed
          )
      }, 1000)
  }

  function render() {
    if (
      !selectedSlug
    ) {
      renderSelect()
      return
    }

    const athlete =
      selectedAthlete()

    root.innerHTML = `
      <main class="idle-page-v1 ${busy ? 'idle-busy-v1' : ''}">
        <header class="idle-top-v1">
          <button
            type="button"
            class="idle-back-v1"
            data-idle-back
          >
            ← Jeu
          </button>

          <div>
            <span>
              GA COACHING · IDLE TRAINING
            </span>

            <h1>
              ${esc(
                athlete?.name ||
                selectedSlug
              )}
            </h1>
          </div>

          ${options.allowAthleteSelection
            ? `
              <button
                type="button"
                class="idle-switch-v1"
                data-idle-switch
              >
                Changer
              </button>
            `
            : ''}
        </header>

        <section class="idle-shell-v1">
          <nav class="idle-tabs-v1">
            ${[
              ['camp','⚡ Camp'],
              ['sleep','🌙 Sommeil'],
              ['pve','👾 PvE'],
              ['pvp','🥊 PvP'],
            ].map(
              ([key,label]) => `
                <button
                  type="button"
                  data-idle-tab="${key}"
                  class="${activeTab === key ? 'active' : ''}"
                >
                  ${label}
                </button>
              `
            ).join('')}
          </nav>

          ${notice
            ? `
              <div class="idle-notice-v1">
                ${esc(notice)}
              </div>
            `
            : ''}

          ${renderContent()}
        </section>
      </main>
    `

    scheduleSleepTicker()
  }

  root.onclick =
    async event => {
      const backButton =
        event.target.closest(
          '[data-idle-back]'
        )

      if (backButton) {
        back()
        return
      }

      const select =
        event.target.closest(
          '[data-idle-select]'
        )

      if (select) {
        selectedSlug =
          String(
            select.dataset.idleSelect ||
            ''
          )

        activeTab = 'camp'
        battle = null
        await loadSelected()
        return
      }

      const switchButton =
        event.target.closest(
          '[data-idle-switch]'
        )

      if (switchButton) {
        selectedSlug = ''
        snapshot = null
        history = []
        battle = null
        ambient.stop()
        render()
        return
      }

      const tab =
        event.target.closest(
          '[data-idle-tab]'
        )

      if (tab) {
        const next =
          String(
            tab.dataset.idleTab ||
            ''
          )

        if (IDLE_TABS.has(next)) {
          activeTab = next
          render()
        }

        return
      }

      const sound =
        event.target.closest(
          '[data-idle-sound]'
        )

      if (sound) {
        soundMode =
          String(
            sound.dataset.idleSound ||
            'none'
          )

        try {
          localStorage.setItem(
            'ga-idle-sleep-sound-v1',
            soundMode
          )
        } catch {
          // no-op
        }

        try {
          await ambient.start(
            soundMode
          )

          notice =
            soundMode === 'none'
              ? 'Ambiance coupée.'
              : 'Ambiance lancée. Le son reste local sur ton appareil.'
        } catch {
          notice =
            'Le navigateur a refusé le son. Retouche le bouton pour réessayer.'
        }

        render()
        return
      }

      const sleepToggle =
        event.target.closest(
          '[data-idle-sleep-toggle]'
        )

      if (sleepToggle) {
        if (
          !canEdit() ||
          busy
        ) {
          return
        }

        busy = true
        notice = ''
        render()

        if (
          snapshot?.active_sleep_started_at
        ) {
          const result =
            await supabase.rpc(
              'idle_sleep_stop_v1',
              {
                p_athlete_slug:
                  selectedSlug,
              }
            )

          ambient.stop()

          if (result.error) {
            notice =
              result.error.message
          } else {
            const row =
              Array.isArray(
                result.data
              )
                ? result.data[0]
                : result.data

            notice =
              `Sommeil enregistré : ${durationLabel(
                row?.duration_seconds
              )}.`
          }
        } else {
          const result =
            await supabase.rpc(
              'idle_sleep_start_v1',
              {
                p_athlete_slug:
                  selectedSlug,
                p_sound_mode:
                  soundMode,
              }
            )

          if (result.error) {
            notice =
              result.error.message
          } else {
            notice =
              'Bonne nuit. Le chrono serveur est lancé.'

            try {
              await ambient.start(
                soundMode
              )
            } catch {
              // Timer still works without audio.
            }
          }
        }

        busy = false
        await loadSelected()
        return
      }

      const claim =
        event.target.closest(
          '[data-idle-claim]'
        )

      if (claim) {
        if (busy) {
          return
        }

        busy = true
        render()

        const result =
          await supabase.rpc(
            'idle_claim_v1',
            {
              p_athlete_slug:
                selectedSlug,
            }
          )

        busy = false

        if (result.error) {
          notice =
            result.error.message
        } else {
          const row =
            Array.isArray(
              result.data
            )
              ? result.data[0]
              : result.data

          notice =
            number(row?.gained) > 0
              ? `+${number(row.gained)} énergie collectée.`
              : 'Données réelles actualisées.'
        }

        await loadSelected()
        return
      }

      const pve =
        event.target.closest(
          '[data-idle-pve]'
        )

      if (pve) {
        if (
          !canEdit() ||
          busy
        ) {
          return
        }

        busy = true
        notice = ''
        render()

        const result =
          await supabase.rpc(
            'idle_pve_fight_v1',
            {
              p_athlete_slug:
                selectedSlug,
            }
          )

        busy = false

        if (result.error) {
          notice =
            result.error.message
          render()
          return
        }

        const row =
          Array.isArray(
            result.data
          )
            ? result.data[0]
            : result.data

        battle = {
          ...row,
          mode: 'pve',
        }

        battleSound(
          Boolean(row?.won)
        )

        await loadSelected()
        return
      }

      const pvp =
        event.target.closest(
          '[data-idle-pvp]'
        )

      if (pvp) {
        if (
          !canEdit() ||
          busy
        ) {
          return
        }

        busy = true
        notice = ''
        render()

        const result =
          await supabase.rpc(
            'idle_pvp_fight_v1',
            {
              p_athlete_slug:
                selectedSlug,
              p_defender_slug:
                null,
            }
          )

        busy = false

        if (result.error) {
          notice =
            result.error.message
          render()
          return
        }

        const row =
          Array.isArray(
            result.data
          )
            ? result.data[0]
            : result.data

        battle = {
          ...row,
          mode: 'pvp',
        }

        battleSound(
          Boolean(row?.won)
        )

        await loadSelected()
        return
      }
    }

  if (!selectedSlug) {
    render()
    return
  }

  await loadSelected()
}
