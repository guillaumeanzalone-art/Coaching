import { supabase } from './supabase.js'

const IDLE_TABS = new Set([
  'menu',
  'camp',
  'sleep',
  'pve',
  'pvp',
  'equipment',
])

const IDLE_SCREEN_MUSIC = {
  menu: '/main-menu.mp3',
  camp: '/main-menu.mp3',
  sleep: null,
  pve: '/mobs-epiques.mp3',
  pvp: '/combat-normal.mp3',
  equipment: '/casino.mp3',
}

const IDLE_AVATAR_SKINS = [
  { key: 'classic', label: 'Classique', icon: '🟤' },
  { key: 'tan', label: 'Bronze', icon: '🟠' },
  { key: 'night', label: 'Nocturne', icon: '🌑' },
  { key: 'gold', label: 'Champion', icon: '🏆' },
]

const IDLE_AVATAR_OUTFITS = [
  { key: 'rookie', label: 'Rookie', icon: '🥋' },
  { key: 'power', label: 'Power', icon: '🏋️' },
  { key: 'shadow', label: 'Shadow', icon: '🥷' },
  { key: 'ronin', label: 'Ronin', icon: '⚔️' },
  { key: 'sleep', label: 'Dreamer', icon: '🌙' },
]

const IDLE_AVATAR_AURAS = [
  { key: 'none', label: 'Aucune', icon: '⚪' },
  { key: 'violet', label: 'Violet', icon: '🟣' },
  { key: 'blue', label: 'Bleue', icon: '🔵' },
  { key: 'gold', label: 'Or', icon: '🟡' },
  { key: 'red', label: 'Rouge', icon: '🔴' },
]

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

const GA_BRUTE_WEAPONS = [
  { key: 'fists', icon: '👊', label: 'Poings', damage: 1.00, speed: 1.08 },
  { key: 'belt', icon: '🥋', label: 'Ceinture', damage: 1.06, speed: 1.04 },
  { key: 'dumbbell', icon: '🏋️', label: 'Haltère', damage: 1.24, speed: 0.86 },
  { key: 'shaker', icon: '🥤', label: 'Shaker', damage: 0.94, speed: 1.18 },
  { key: 'bench', icon: '🪑', label: 'Banc', damage: 1.18, speed: 0.88 },
  { key: 'hammer', icon: '🔨', label: 'Marteau', damage: 1.30, speed: 0.82 },
]

function deriveGaBruteStats(source = {}) {
  const training = metricPercent(source.training_score)
  const steps = metricPercent(source.steps_score)
  const sleep = metricPercent(source.sleep_score)

  const strength =
    5 +
    Math.round(
      training * 0.16 +
      sleep * 0.035
    )

  const agility =
    5 +
    Math.round(
      steps * 0.14 +
      sleep * 0.045
    )

  const speed =
    5 +
    Math.round(
      steps * 0.09 +
      sleep * 0.085
    )

  const vitality =
    5 +
    Math.round(
      training * 0.055 +
      sleep * 0.145
    )

  return {
    training,
    steps,
    sleep,
    strength,
    agility,
    speed,
    vitality,
    block:
      clamp(
        0.05 +
        training / 100 * 0.14 +
        sleep / 100 * 0.05,
        0.05,
        0.27
      ),
    evade:
      clamp(
        0.04 +
        agility * 0.007,
        0.05,
        0.25
      ),
    counter:
      clamp(
        0.035 +
        sleep / 100 * 0.09 +
        training / 100 * 0.055,
        0.04,
        0.22
      ),
    combo:
      clamp(
        0.055 +
        speed * 0.007,
        0.06,
        0.24
      ),
    crit:
      clamp(
        0.07 +
        strength * 0.0045,
        0.08,
        0.20
      ),
    disarm:
      clamp(
        0.025 +
        agility * 0.0025,
        0.03,
        0.10
      ),
  }
}

function deriveOpponentStats(power, random) {
  const base =
    clamp(
      (number(power, 35) - 35) / 3.8,
      0,
      100
    )

  const wobble = () =>
    clamp(
      base +
      (random() - 0.5) * 26,
      0,
      100
    )

  return deriveGaBruteStats({
    training_score: wobble(),
    steps_score: wobble(),
    sleep_score: wobble(),
  })
}

function gaBruteTraits(stats) {
  const traits = []

  if (stats.training >= 70) {
    traits.push('💪 Force du top set')
  }

  if (stats.steps >= 70) {
    traits.push('⚡ Jambes légères')
  }

  if (stats.sleep >= 70) {
    traits.push('🌙 Récupération profonde')
  }

  if (
    stats.training >= 70 &&
    stats.steps >= 70 &&
    stats.sleep >= 70
  ) {
    traits.push('👑 SBD complet')
  }

  return traits
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
    .idle-brute-arena-v1{position:relative;min-height:430px;overflow:hidden;color:#3b2618;background:
      radial-gradient(circle at 50% 22%,rgba(255,249,190,.82),transparent 34%),
      linear-gradient(180deg,#f0c46f 0 23%,#d99a48 23% 27%,#bc7637 27% 29%,#d39b58 29% 100%);border-bottom:1px solid rgba(255,255,255,.08)}
    .idle-brute-arena-v1:before{content:"";position:absolute;left:-8%;right:-8%;bottom:-8%;height:54%;opacity:.75;background:
      linear-gradient(90deg,transparent 0 12%,rgba(93,53,24,.16) 12% 13%,transparent 13% 25%,rgba(93,53,24,.16) 25% 26%,transparent 26% 38%,rgba(93,53,24,.16) 38% 39%,transparent 39% 51%,rgba(93,53,24,.16) 51% 52%,transparent 52% 64%,rgba(93,53,24,.16) 64% 65%,transparent 65% 77%,rgba(93,53,24,.16) 77% 78%,transparent 78%),
      linear-gradient(0deg,transparent 0 24%,rgba(93,53,24,.16) 24% 26%,transparent 26% 49%,rgba(93,53,24,.16) 49% 51%,transparent 51% 74%,rgba(93,53,24,.16) 74% 76%,transparent 76%);
      transform:perspective(440px) rotateX(58deg);transform-origin:bottom}
    .idle-brute-arena-v1:after{content:"GA BRUTE";position:absolute;left:50%;top:51%;transform:translate(-50%,-50%) rotate(-7deg);font-size:54px;font-weight:1000;letter-spacing:.08em;color:rgba(117,55,22,.08);white-space:nowrap}
    .idle-brute-hud-v1{position:absolute;z-index:7;inset:12px 14px auto;display:grid;grid-template-columns:1fr 58px 1fr;gap:10px;align-items:start}
    .idle-brute-hud-side-v1{min-width:0}
    .idle-brute-hud-side-v1.right{text-align:right}
    .idle-brute-name-v1{display:flex;align-items:center;gap:7px;margin-bottom:5px;color:#fff7cf;font-size:11px;font-weight:1000;letter-spacing:.06em;text-shadow:0 2px 0 rgba(93,49,21,.55)}
    .idle-brute-hud-side-v1.right .idle-brute-name-v1{justify-content:flex-end}
    .idle-brute-power-v1{font-size:8px;color:#6f3e1e;font-weight:950;text-transform:uppercase;letter-spacing:.08em}
    .idle-brute-hp-shell-v1{height:20px;padding:3px;border-radius:4px;background:#3e2417;border:2px solid #6d3f20;box-shadow:inset 0 0 0 1px rgba(255,232,137,.35),0 2px 0 rgba(59,31,16,.25);overflow:hidden}
    .idle-brute-hp-v1{height:100%;border-radius:2px;background:linear-gradient(180deg,#ffe53b,#ffb300 44%,#e85b20 100%);box-shadow:inset 0 1px rgba(255,255,255,.55);transition:width .36s ease}
    .idle-brute-hp-number-v1{margin-top:3px;font-size:8px;font-weight:950;color:#6f3e1e}
    .idle-brute-round-v1{display:grid;place-items:center;height:46px;border-radius:50%;background:#fff3b5;border:3px solid #a95f26;color:#8a431d;font-size:10px;font-weight:1000;box-shadow:0 2px 0 rgba(83,43,20,.25)}
    .idle-brute-floor-v1{position:absolute;z-index:2;left:8%;right:8%;bottom:17%;height:3px;border-radius:50%;background:rgba(89,47,25,.25);box-shadow:0 0 30px 18px rgba(84,44,21,.08)}
    .idle-brute-fighters-v1{position:absolute;z-index:4;left:0;right:0;bottom:44px;display:grid;grid-template-columns:1fr 1fr;align-items:end;padding:0 7%}
    .idle-brute-fighter-v1{position:relative;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;transition:filter .2s}
    .idle-brute-fighter-v1.enemy{transform:scaleX(-1)}
    .idle-brute-fighter-v1.enemy .idle-brute-label-v1,.idle-brute-fighter-v1.enemy .idle-brute-damage-v1{transform:scaleX(-1)}
    .idle-brute-sprite-v1{height:225px;max-width:82%;display:grid;place-items:end center;transform-origin:50% 100%;position:relative}
    .idle-brute-sprite-v1 img{display:block;max-width:100%;max-height:225px;object-fit:contain;filter:drop-shadow(0 12px 9px rgba(69,33,14,.28))}
    .idle-brute-sprite-v1 .idle-avatar-v1{width:132px;height:132px;border-radius:24px;border:4px solid rgba(255,246,189,.72);font-size:52px;box-shadow:0 12px 25px rgba(71,34,15,.22)}
    .idle-brute-label-v1{margin-top:-2px;padding:5px 9px;border-radius:999px;background:rgba(80,39,17,.8);color:#fff2b4;font-size:9px;font-weight:1000;letter-spacing:.05em;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}
    .idle-brute-weapon-v1{position:absolute;z-index:9;top:45%;font-size:33px;filter:drop-shadow(0 3px 2px rgba(0,0,0,.2));animation:idleBruteWeapon .48s ease both}
    .idle-brute-fighter-v1.player .idle-brute-weapon-v1{right:7%}
    .idle-brute-fighter-v1.enemy .idle-brute-weapon-v1{right:7%;transform:scaleX(-1)}
    .idle-brute-damage-v1{position:absolute;z-index:12;top:18%;padding:4px 7px;border-radius:8px;background:#fff8c9;border:2px solid #a34d24;color:#d62d20;font-size:15px;font-weight:1000;box-shadow:0 3px 0 rgba(86,39,17,.18);animation:idleBruteDamage .68s ease both}
    .idle-brute-damage-v1.dodge{color:#3f67a9}
    .idle-brute-damage-v1.crit{font-size:20px;color:#c21919}
    .idle-brute-fighter-v1.attacking.player .idle-brute-sprite-v1{animation:idleBruteAttackRight .54s cubic-bezier(.2,.8,.2,1)}
    .idle-brute-fighter-v1.attacking.enemy .idle-brute-sprite-v1{animation:idleBruteAttackLeft .54s cubic-bezier(.2,.8,.2,1)}
    .idle-brute-fighter-v1.hit .idle-brute-sprite-v1{animation:idleBruteHit .48s ease}
    .idle-brute-fighter-v1.ko .idle-brute-sprite-v1{animation:idleBruteKo .72s ease forwards}
    .idle-brute-center-v1{position:absolute;z-index:6;left:50%;top:53%;transform:translate(-50%,-50%);text-align:center;pointer-events:none}
    .idle-brute-action-v1{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:12px;background:rgba(255,247,199,.92);border:2px solid rgba(145,71,28,.7);color:#723a1b;font-size:10px;font-weight:1000;box-shadow:0 4px 0 rgba(94,48,22,.16)}
    .idle-brute-log-v1{position:absolute;z-index:8;left:12px;right:12px;bottom:9px;display:flex;gap:6px;justify-content:center;pointer-events:none}
    .idle-brute-log-line-v1{max-width:45%;padding:5px 8px;border-radius:9px;background:rgba(65,32,15,.72);color:#fff1bc;font-size:8px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .idle-brute-ready-v1{position:absolute;z-index:6;left:50%;top:52%;transform:translate(-50%,-50%);padding:10px 14px;border-radius:14px;background:rgba(255,245,186,.92);border:3px solid #a45b25;color:#814019;font-size:13px;font-weight:1000;box-shadow:0 4px 0 rgba(79,38,17,.2)}
    .idle-brute-replay-v1{margin:0 12px 12px;width:calc(100% - 24px)}
    .idle-brute-sheet-v1{margin:12px 0 14px;padding:12px;border:1px solid rgba(255,235,157,.16);border-radius:16px;background:linear-gradient(180deg,rgba(116,70,28,.12),rgba(255,255,255,.025))}
    .idle-brute-sheet-title-v1{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px;color:#ffe8a7;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}
    .idle-brute-stat-v1{display:grid;grid-template-columns:72px 1fr 28px;gap:7px;align-items:center;margin:6px 0}
    .idle-brute-stat-v1 span{font-size:9px;color:#a8acc2;font-weight:900;text-transform:uppercase}
    .idle-brute-stat-v1 b{font-size:10px;text-align:right;color:#fff0b2}
    .idle-brute-stat-track-v1{height:8px;border-radius:999px;background:#070a17;overflow:hidden;border:1px solid rgba(255,255,255,.04)}
    .idle-brute-stat-track-v1 i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#f2c037,#ff7d2d)}
    .idle-brute-traits-v1{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}
    .idle-brute-trait-v1{padding:5px 7px;border-radius:999px;border:1px solid rgba(255,232,151,.16);background:rgba(255,205,79,.07);color:#d9d4c1;font-size:8px;font-weight:850}
    .idle-brute-rage-v1{height:4px;margin-top:4px;border-radius:99px;background:rgba(82,31,16,.28);overflow:hidden}
    .idle-brute-rage-v1 span{display:block;height:100%;background:linear-gradient(90deg,#e34622,#ffcf35);transition:width .25s ease}
    .idle-brute-fighter-v1.blocking .idle-brute-sprite-v1{animation:idleBruteBlock .46s ease}
    .idle-brute-fighter-v1.dodging .idle-brute-sprite-v1{animation:idleBruteDodge .46s ease}
    .idle-brute-fighter-v1.raging .idle-brute-sprite-v1{filter:drop-shadow(0 0 18px rgba(255,92,26,.8))}
    .idle-brute-damage-v1.block{color:#7d5b2c}
    .idle-brute-damage-v1.counter{color:#8b2ccd}
    .idle-brute-damage-v1.rage{color:#ef3d1f;font-size:20px}
    @keyframes idleBruteBlock{0%,100%{transform:translateX(0)}35%{transform:translateX(8px) scale(.96)}60%{transform:translateX(3px) scale(1.02)}}
    @keyframes idleBruteDodge{0%,100%{transform:translateX(0)}45%{transform:translateX(-28px) translateY(-4px)}70%{transform:translateX(-10px)}}
    @keyframes idleBruteAttackRight{0%,100%{transform:translateX(0) rotate(0)}45%{transform:translateX(46%) rotate(4deg)}60%{transform:translateX(38%) rotate(-3deg)}}
    @keyframes idleBruteAttackLeft{0%,100%{transform:translateX(0) rotate(0)}45%{transform:translateX(46%) rotate(4deg)}60%{transform:translateX(38%) rotate(-3deg)}}
    @keyframes idleBruteHit{0%,100%{transform:translateX(0);filter:none}20%{transform:translateX(-9px);filter:brightness(1.8)}45%{transform:translateX(8px)}65%{transform:translateX(-5px)}}
    @keyframes idleBruteKo{0%{transform:rotate(0) translateY(0);opacity:1}100%{transform:rotate(78deg) translate(28px,22px);opacity:.45}}
    @keyframes idleBruteDamage{0%{opacity:0;transform:translateY(12px) scale(.7)}35%{opacity:1;transform:translateY(-12px) scale(1.15)}100%{opacity:0;transform:translateY(-34px) scale(.9)}}
    @keyframes idleBruteWeapon{0%{opacity:0;transform:scale(.4) rotate(-35deg)}35%{opacity:1;transform:scale(1.15) rotate(12deg)}100%{opacity:0;transform:scale(.8) rotate(38deg)}}
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

    .idle-title-v2{position:relative;min-height:640px;overflow:hidden;border:1px solid rgba(255,236,173,.22);border-radius:26px;background:
      radial-gradient(circle at 50% 14%,rgba(255,249,194,.72),transparent 25%),
      radial-gradient(circle at 10% 42%,rgba(79,166,191,.24),transparent 26%),
      linear-gradient(180deg,#8bc9d8 0 25%,#d9c58b 25% 31%,#c69a55 31% 100%);box-shadow:0 28px 80px rgba(0,0,0,.34)}
    .idle-title-v2:before{content:"";position:absolute;inset:0;pointer-events:none;background:
      linear-gradient(90deg,rgba(65,66,73,.38) 0 4%,transparent 4% 96%,rgba(65,66,73,.38) 96%),
      linear-gradient(180deg,transparent 0 66%,rgba(104,64,28,.17) 66%);
      opacity:.42}
    .idle-title-logo-v2{position:relative;z-index:3;width:max-content;max-width:88%;margin:18px auto 0;padding:10px 24px;border:4px solid #7c431d;border-radius:8px;background:linear-gradient(180deg,#e9bc67,#c77d32);box-shadow:inset 0 0 0 3px #f7d98f,0 8px 0 #6b3619,0 14px 26px rgba(72,36,13,.3);color:#5c2a17;font-size:clamp(31px,6vw,58px);font-weight:1000;letter-spacing:.06em;text-shadow:2px 2px 0 #f6dd9a,-1px -1px 0 #f6dd9a;transform:rotate(-1deg)}
    .idle-title-sub-v2{position:relative;z-index:3;text-align:center;margin:11px 0 0;color:#64391f;font-size:10px;font-weight:1000;letter-spacing:.18em;text-transform:uppercase}
    .idle-title-scene-v2{position:relative;z-index:2;display:grid;grid-template-columns:minmax(190px,.75fr) minmax(240px,1fr) minmax(190px,.75fr);gap:16px;align-items:center;min-height:480px;padding:22px 28px 28px}
    .idle-title-menu-side-v2{display:grid;gap:13px}
    .idle-title-menu-side-v2.right{align-self:stretch;align-content:center}
    .idle-wood-btn-v2{position:relative;border:3px solid #713d1f;border-radius:8px;padding:13px 13px;background:linear-gradient(180deg,#b86b32,#80401f);box-shadow:inset 0 0 0 2px rgba(255,220,145,.34),0 5px 0 #552914,0 9px 18px rgba(73,35,14,.2);color:#fff3ba;font-size:12px;font-weight:1000;letter-spacing:.07em;text-shadow:0 2px 0 #4e2412;cursor:pointer;transition:transform .14s ease,filter .14s ease}
    .idle-wood-btn-v2:hover,.idle-wood-btn-v2.active{transform:translateY(-2px) rotate(-.4deg);filter:brightness(1.08)}
    .idle-wood-btn-v2 small{display:block;margin-top:3px;color:#f0cf8b;font-size:8px;letter-spacing:.02em}
    .idle-title-avatar-card-v2{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:415px}
    .idle-title-avatar-name-v2{margin-top:5px;padding:7px 16px;border:3px solid #74431f;border-radius:8px;background:#f2dda7;color:#6f3b1e;font-weight:1000;letter-spacing:.07em;box-shadow:0 4px 0 rgba(96,49,23,.28)}
    .idle-brute-avatar-v2{--skin:#d7a06c;--outfit:#4e5b72;--accent:#eacb72;position:relative;width:210px;height:290px;filter:drop-shadow(0 18px 15px rgba(72,40,20,.28))}
    .idle-brute-avatar-v2.skin-tan{--skin:#b96f42}.idle-brute-avatar-v2.skin-night{--skin:#4d536b}.idle-brute-avatar-v2.skin-gold{--skin:#d9b34c}
    .idle-brute-avatar-v2.outfit-power{--outfit:#7d262f;--accent:#e7a02f}.idle-brute-avatar-v2.outfit-shadow{--outfit:#252b3f;--accent:#6f57c9}.idle-brute-avatar-v2.outfit-ronin{--outfit:#5e2329;--accent:#d5b45e}.idle-brute-avatar-v2.outfit-sleep{--outfit:#545683;--accent:#b4a8ff}
    .idle-brute-avatar-aura-v2{position:absolute;left:50%;top:48%;width:178px;height:236px;transform:translate(-50%,-50%);border-radius:48%;filter:blur(18px);opacity:.42;pointer-events:none}
    .idle-brute-avatar-aura-v2.violet{background:#7452ff}.idle-brute-avatar-aura-v2.blue{background:#3fb5ff}.idle-brute-avatar-aura-v2.gold{background:#ffd65d}.idle-brute-avatar-aura-v2.red{background:#ff4d4d}
    .idle-brute-avatar-body-v2{position:absolute;left:50%;bottom:25px;width:118px;height:154px;transform:translateX(-50%);border:4px solid #432a1b;border-radius:50px 50px 28px 28px;background:linear-gradient(90deg,color-mix(in srgb,var(--outfit),#000 14%),var(--outfit) 48%,color-mix(in srgb,var(--outfit),#fff 9%));box-shadow:inset 0 -17px rgba(0,0,0,.12)}
    .idle-brute-avatar-body-v2:before,.idle-brute-avatar-body-v2:after{content:"";position:absolute;top:36px;width:40px;height:112px;border:4px solid #432a1b;border-radius:24px;background:var(--skin);z-index:-1}
    .idle-brute-avatar-body-v2:before{left:-32px;transform:rotate(13deg)}.idle-brute-avatar-body-v2:after{right:-32px;transform:rotate(-13deg)}
    .idle-brute-avatar-belt-v2{position:absolute;left:50%;bottom:72px;width:122px;height:21px;transform:translateX(-50%);border:4px solid #432a1b;border-radius:9px;background:var(--accent);z-index:3}
    .idle-brute-avatar-leg-v2{position:absolute;bottom:0;width:45px;height:83px;border:4px solid #432a1b;border-radius:20px 20px 13px 13px;background:#25273a}.idle-brute-avatar-leg-v2.left{left:54px;transform:rotate(5deg)}.idle-brute-avatar-leg-v2.right{right:54px;transform:rotate(-5deg)}
    .idle-brute-avatar-shoe-v2{position:absolute;bottom:-1px;width:68px;height:28px;border:4px solid #432a1b;border-radius:20px 20px 10px 10px;background:#ece8d5}.idle-brute-avatar-shoe-v2.left{left:32px}.idle-brute-avatar-shoe-v2.right{right:32px}
    .idle-brute-avatar-head-v2{position:absolute;z-index:5;left:50%;top:17px;width:116px;height:116px;transform:translateX(-50%);overflow:hidden;border:5px solid #432a1b;border-radius:48% 48% 44% 44%;background:var(--skin);box-shadow:inset 0 -8px rgba(0,0,0,.08),0 5px 0 rgba(255,232,164,.26)}
    .idle-brute-avatar-head-v2 img{width:100%;height:100%;object-fit:cover;object-position:center 23%;transform:scale(1.08)}
    .idle-brute-avatar-fallback-v2{width:100%;height:100%;display:grid;place-items:center;font-size:52px}
    .idle-brute-avatar-weapon-v2{position:absolute;z-index:7;right:18px;bottom:71px;font-size:42px;transform:rotate(-18deg);filter:drop-shadow(0 3px 2px rgba(0,0,0,.22))}
    .idle-title-stats-v2{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:min(340px,100%);margin-top:10px}
    .idle-title-stat-v2{padding:7px 5px;border:2px solid rgba(103,56,26,.38);border-radius:7px;background:rgba(255,242,190,.58);text-align:center;color:#6d3d1e}.idle-title-stat-v2 b{display:block;font-size:14px}.idle-title-stat-v2 span{font-size:7px;font-weight:1000;text-transform:uppercase}
    .idle-title-footer-v2{position:absolute;z-index:5;right:12px;bottom:10px;display:flex;gap:7px}
    .idle-title-mini-v2{border:2px solid #764322;border-radius:8px;padding:8px 10px;background:#f3dda2;color:#6b391c;font-size:9px;font-weight:1000;cursor:pointer}
    .idle-section-top-v2{display:flex;gap:9px;align-items:center;margin-bottom:11px}.idle-section-top-v2 .idle-back-v1{flex:0 0 auto}.idle-section-top-v2 strong{font-size:14px}.idle-section-top-v2 small{display:block;color:#797f9a;font-size:9px;margin-top:2px}
    .idle-avatar-creator-v2{position:relative;z-index:4;display:grid;grid-template-columns:minmax(240px,.9fr) minmax(0,1.1fr);gap:16px;align-items:center;min-height:500px;padding:28px}
    .idle-avatar-creator-panel-v2{padding:18px;border:3px solid #74431f;border-radius:12px;background:linear-gradient(180deg,rgba(255,242,190,.96),rgba(221,190,126,.96));box-shadow:0 7px 0 #5a2e18;color:#60371e}
    .idle-avatar-creator-panel-v2 h2{margin:4px 0 6px;font-size:25px;letter-spacing:-.03em}.idle-avatar-creator-panel-v2 p{margin:0 0 14px;font-size:10px;line-height:1.6;color:#7a5235}
    .idle-avatar-creator-v2 .idle-equip-group-v2 h4{color:#744522}
    .idle-avatar-creator-v2 .idle-equip-option-v2{border-color:rgba(101,54,25,.28);background:rgba(255,249,215,.48);color:#6a3a1f}.idle-avatar-creator-v2 .idle-equip-option-v2.active{border-color:#8c4a20;background:#d79545;color:#fff8cf}
    .idle-avatar-confirm-v2{width:100%;margin-top:8px;border:3px solid #633318;border-radius:10px;padding:13px 15px;background:linear-gradient(180deg,#d47b36,#9c4d24);box-shadow:0 5px 0 #512615;color:#fff2b6;font-weight:1000;letter-spacing:.06em;cursor:pointer}
    .idle-equipment-v2{display:grid;grid-template-columns:minmax(230px,.8fr) minmax(0,1.2fr);gap:12px}
    .idle-equipment-avatar-v2{min-height:410px;display:grid;place-items:center;padding:18px;background:radial-gradient(circle at 50% 34%,rgba(123,90,255,.2),transparent 36%),#0b0f25}
    .idle-equip-group-v2{margin-bottom:15px}.idle-equip-group-v2 h4{margin:0 0 7px;font-size:10px;color:#aaa5c9;text-transform:uppercase;letter-spacing:.09em}
    .idle-equip-options-v2{display:flex;gap:7px;flex-wrap:wrap}
    .idle-equip-option-v2{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:9px 11px;background:rgba(255,255,255,.035);color:#c9cadb;font-size:10px;font-weight:900;cursor:pointer}.idle-equip-option-v2.active{color:#fff;border-color:rgba(255,206,92,.55);background:rgba(255,195,60,.11)}.idle-equip-option-v2:disabled{opacity:.35;cursor:not-allowed}
    .idle-equip-option-v2 small{display:block;margin-top:2px;font-size:7px;color:#7b829d}
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
      .idle-brute-arena-v1{min-height:360px}
      .idle-brute-hud-v1{inset:9px 8px auto;grid-template-columns:1fr 42px 1fr;gap:6px}
      .idle-brute-round-v1{height:36px;font-size:8px}
      .idle-brute-sprite-v1{height:170px;max-width:94%}
      .idle-brute-sprite-v1 img{max-height:170px}
      .idle-brute-sprite-v1 .idle-avatar-v1{width:92px;height:92px;border-radius:20px}
      .idle-brute-fighters-v1{padding:0 2%;bottom:40px}
      .idle-brute-arena-v1:after{font-size:36px}
      .idle-brute-name-v1{font-size:9px}
      .idle-brute-log-line-v1{max-width:48%;font-size:7px}
      .idle-brute-damage-v1{top:20%;font-size:13px}
      .idle-title-v2{min-height:0}
      .idle-title-scene-v2{grid-template-columns:1fr;padding:16px;min-height:0}
      .idle-title-menu-side-v2{grid-template-columns:1fr 1fr}
      .idle-title-menu-side-v2.right{grid-template-columns:1fr 1fr}
      .idle-title-avatar-card-v2{order:-1;min-height:335px}
      .idle-brute-avatar-v2{transform:scale(.88);margin:-16px 0}
      .idle-title-footer-v2{position:static;justify-content:center;padding:0 0 14px}
      .idle-equipment-v2{grid-template-columns:1fr}
      .idle-avatar-creator-v2{grid-template-columns:1fr;padding:15px}
      .idle-avatar-creator-panel-v2{order:2}
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

  let activeTab = 'menu'
  let snapshot = null
  let avatarProfile = null
  let history = []
  let manifest = []
  let battle = null
  let combatReplay = null
  let combatTimer = null
  let busy = false
  let notice = ''
  let sleepTicker = null
  let screenMusic = null
  let musicEnabled = (() => {
    try {
      return localStorage.getItem('ga-idle-music-v2') !== 'off'
    } catch {
      return true
    }
  })()

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

  function stopScreenMusic() {
    if (!screenMusic) {
      return
    }

    try {
      screenMusic.pause()
      screenMusic.currentTime = 0
    } catch {
      // Cosmetic audio only.
    }

    screenMusic = null
  }

  function syncScreenMusic(force = false) {
    const src =
      IDLE_SCREEN_MUSIC[
        activeTab
      ]

    if (
      !musicEnabled ||
      !src ||
      activeTab === 'sleep'
    ) {
      stopScreenMusic()
      return
    }

    if (
      !force &&
      screenMusic &&
      screenMusic.dataset?.src === src
    ) {
      return
    }

    stopScreenMusic()

    try {
      const audio =
        new Audio(src)

      audio.loop = true
      audio.volume = 0.18
      audio.dataset.src = src
      screenMusic = audio
      void audio.play().catch(() => {})
    } catch {
      screenMusic = null
    }
  }

  function setActiveTab(next, playMusic = true) {
    if (!IDLE_TABS.has(next)) {
      return
    }

    if (
      activeTab !== 'sleep' &&
      next === 'sleep'
    ) {
      stopScreenMusic()
    }

    activeTab = next

    if (playMusic) {
      syncScreenMusic()
    }

    render()
  }

  function cleanup() {
    ambient.stop()
    stopScreenMusic()

    if (sleepTicker) {
      clearInterval(sleepTicker)
      sleepTicker = null
    }

    if (combatTimer) {
      clearTimeout(combatTimer)
      combatTimer = null
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
      avatarResult,
      avatarStatusResult,
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
      supabase.rpc(
        'idle_avatar_get_v1',
        {
          p_athlete_slug:
            selectedSlug,
        }
      ),
      supabase.rpc(
        'idle_avatar_status_v1',
        {
          p_athlete_slug:
            selectedSlug,
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

    avatarProfile =
      avatarResult.error
        ? {
            avatar_seed: 0,
            avatar_skin: 'classic',
            avatar_outfit: 'rookie',
            avatar_weapon: 'fists',
            avatar_aura: 'none',
            avatar_confirmed_at: new Date().toISOString(),
          }
        : {
            ...(
              Array.isArray(
                avatarResult.data
              )
                ? avatarResult.data[0]
                : avatarResult.data
            ),
            avatar_confirmed_at:
              avatarStatusResult.error
                ? new Date().toISOString()
                : avatarStatusResult.data,
          }

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

  function avatarHeadImage(
    athlete = selectedAthlete()
  ) {
    return assetPath(
      athlete?.profileImage ||
      ''
    )
  }

  function weaponMeta(key) {
    return (
      GA_BRUTE_WEAPONS.find(
        weapon =>
          weapon.key === key
      ) ||
      GA_BRUTE_WEAPONS[0]
    )
  }

  function weaponUnlocked(
    key,
    source = snapshot || {}
  ) {
    const training =
      metricPercent(
        source.training_score
      )

    const sleep =
      metricPercent(
        source.sleep_score
      )

    if (key === 'fists') return true
    if (key === 'belt') return training >= 25
    if (key === 'shaker') return sleep >= 35
    if (key === 'dumbbell') return training >= 45
    if (key === 'bench') return training >= 70
    if (key === 'hammer') return training >= 88
    return false
  }

  function weaponRequirement(key) {
    if (key === 'belt') return '25 % entraînement'
    if (key === 'shaker') return '35 % sommeil'
    if (key === 'dumbbell') return '45 % entraînement'
    if (key === 'bench') return '70 % entraînement'
    if (key === 'hammer') return '88 % entraînement'
    return 'Débloqué'
  }

  function renderBruteAvatarV2(
    athlete = selectedAthlete(),
    profile = avatarProfile || {}
  ) {
    const image =
      avatarHeadImage(
        athlete
      )

    const skin =
      profile.avatar_skin ||
      'classic'

    const outfit =
      profile.avatar_outfit ||
      'rookie'

    const aura =
      profile.avatar_aura ||
      'none'

    const selectedWeapon =
      weaponMeta(
        profile.avatar_weapon ||
        'fists'
      )

    return `
      <div class="idle-brute-avatar-v2 skin-${esc(skin)} outfit-${esc(outfit)}">
        ${aura !== 'none'
          ? `
            <div class="idle-brute-avatar-aura-v2 ${esc(aura)}"></div>
          `
          : ''}

        <div class="idle-brute-avatar-leg-v2 left"></div>
        <div class="idle-brute-avatar-leg-v2 right"></div>
        <div class="idle-brute-avatar-shoe-v2 left"></div>
        <div class="idle-brute-avatar-shoe-v2 right"></div>
        <div class="idle-brute-avatar-body-v2"></div>
        <div class="idle-brute-avatar-belt-v2"></div>

        <div class="idle-brute-avatar-head-v2">
          ${image
            ? `
              <img
                src="${esc(image)}"
                alt=""
                loading="eager"
              >
            `
            : `
              <div class="idle-brute-avatar-fallback-v2">
                ${esc(
                  athlete?.emoji ||
                  '🏋️'
                )}
              </div>
            `}
        </div>

        <div class="idle-brute-avatar-weapon-v2">
          ${esc(
            selectedWeapon.icon
          )}
        </div>
      </div>
    `
  }

  function renderAvatarCreator() {
    const athlete =
      selectedAthlete()

    const profile =
      avatarProfile || {
        avatar_skin: 'classic',
        avatar_outfit: 'rookie',
        avatar_weapon: 'fists',
        avatar_aura: 'none',
      }

    return `
      <section class="idle-title-v2">
        <div class="idle-title-logo-v2">
          GA BRUTE
        </div>

        <div class="idle-title-sub-v2">
          CRÉE TON COMBATTANT
        </div>

        <div class="idle-avatar-creator-v2">
          <div class="idle-title-avatar-card-v2">
            ${renderBruteAvatarV2(
              athlete,
              profile
            )}

            <div class="idle-title-avatar-name-v2">
              ${esc(
                athlete?.name ||
                selectedSlug
              )}
            </div>
          </div>

          <div class="idle-avatar-creator-panel-v2">
            <span class="idle-kicker-v1">
              PREMIÈRE CONNEXION
            </span>

            <h2>
              Ta tête. Ton combattant.
            </h2>

            <p>
              On garde automatiquement ton avatar de profil pour
              la tête. Choisis ton corps et ton style : ils seront
              sauvegardés dans le cloud pour les prochaines connexions.
            </p>

            <div class="idle-equip-group-v2">
              <h4>Skin</h4>

              <div class="idle-equip-options-v2">
                ${IDLE_AVATAR_SKINS.map(
                  item => `
                    <button
                      type="button"
                      class="idle-equip-option-v2 ${profile.avatar_skin === item.key ? 'active' : ''}"
                      data-idle-avatar-field="avatar_skin"
                      data-idle-avatar-value="${esc(item.key)}"
                    >
                      ${item.icon} ${esc(item.label)}
                    </button>
                  `
                ).join('')}
              </div>
            </div>

            <div class="idle-equip-group-v2">
              <h4>Tenue de départ</h4>

              <div class="idle-equip-options-v2">
                ${IDLE_AVATAR_OUTFITS.map(
                  item => `
                    <button
                      type="button"
                      class="idle-equip-option-v2 ${profile.avatar_outfit === item.key ? 'active' : ''}"
                      data-idle-avatar-field="avatar_outfit"
                      data-idle-avatar-value="${esc(item.key)}"
                    >
                      ${item.icon} ${esc(item.label)}
                    </button>
                  `
                ).join('')}
              </div>
            </div>

            <div class="idle-equip-group-v2">
              <h4>Aura</h4>

              <div class="idle-equip-options-v2">
                ${IDLE_AVATAR_AURAS.map(
                  item => `
                    <button
                      type="button"
                      class="idle-equip-option-v2 ${profile.avatar_aura === item.key ? 'active' : ''}"
                      data-idle-avatar-field="avatar_aura"
                      data-idle-avatar-value="${esc(item.key)}"
                    >
                      ${item.icon} ${esc(item.label)}
                    </button>
                  `
                ).join('')}
              </div>
            </div>

            <button
              type="button"
              class="idle-avatar-confirm-v2"
              data-idle-avatar-confirm
            >
              GO ! CRÉER MON COMBATTANT
            </button>
          </div>
        </div>
      </section>
    `
  }

  function renderTitleMenu() {
    if (
      avatarProfile &&
      !avatarProfile.avatar_confirmed_at
    ) {
      return renderAvatarCreator()
    }

    const athlete =
      selectedAthlete()

    const current =
      snapshot || {}

    const name =
      athlete?.name ||
      selectedSlug

    return `
      <section class="idle-title-v2">
        <div class="idle-title-logo-v2">
          GA BRUTE
        </div>

        <div class="idle-title-sub-v2">
          TRAIN · WALK · SLEEP · FIGHT
        </div>

        <div class="idle-title-scene-v2">
          <div class="idle-title-menu-side-v2">
            <button
              type="button"
              class="idle-wood-btn-v2"
              data-idle-tab="camp"
            >
              ⛺ CAMP
              <small>Progression · énergie</small>
            </button>

            <button
              type="button"
              class="idle-wood-btn-v2"
              data-idle-tab="pve"
            >
              ⚔️ PVE
              <small>Expéditions automatiques</small>
            </button>
          </div>

          <div class="idle-title-avatar-card-v2">
            ${renderBruteAvatarV2(
              athlete,
              avatarProfile
            )}

            <div class="idle-title-avatar-name-v2">
              ${esc(name)}
            </div>

            <div class="idle-title-stats-v2">
              <div class="idle-title-stat-v2">
                <b>${number(current.power,35)}</b>
                <span>Puissance</span>
              </div>

              <div class="idle-title-stat-v2">
                <b>${number(current.idle_energy)}</b>
                <span>Énergie</span>
              </div>

              <div class="idle-title-stat-v2">
                <b>${number(current.rank_points,1000)}</b>
                <span>Cote Duel</span>
              </div>
            </div>
          </div>

          <div class="idle-title-menu-side-v2 right">
            <button
              type="button"
              class="idle-wood-btn-v2"
              data-idle-tab="pvp"
            >
              🥊 DUEL
              <small>Arène contre les athlètes</small>
            </button>

            <button
              type="button"
              class="idle-wood-btn-v2"
              data-idle-tab="sleep"
            >
              🌙 SOMMEIL
              <small>Récupération · ambiance</small>
            </button>

            <button
              type="button"
              class="idle-wood-btn-v2"
              data-idle-tab="equipment"
            >
              🎒 ÉQUIPEMENT / SKIN
              <small>Avatar · arme · aura</small>
            </button>
          </div>
        </div>

        <div class="idle-title-footer-v2">
          <button
            type="button"
            class="idle-title-mini-v2"
            data-idle-music
          >
            ${musicEnabled
              ? '🔊 MUSIQUE'
              : '🔇 MUSIQUE'}
          </button>

          <button
            type="button"
            class="idle-title-mini-v2"
            data-idle-back
          >
            ← JEU
          </button>
        </div>
      </section>
    `
  }

  function renderEquipment() {
    const current =
      snapshot || {}

    const profile =
      avatarProfile || {
        avatar_skin: 'classic',
        avatar_outfit: 'rookie',
        avatar_weapon: 'fists',
        avatar_aura: 'none',
      }

    const weaponButtons =
      GA_BRUTE_WEAPONS.map(
        weapon => {
          const unlocked =
            weaponUnlocked(
              weapon.key,
              current
            )

          return `
            <button
              type="button"
              class="idle-equip-option-v2 ${profile.avatar_weapon === weapon.key ? 'active' : ''}"
              data-idle-avatar-field="avatar_weapon"
              data-idle-avatar-value="${esc(weapon.key)}"
              ${unlocked ? '' : 'disabled'}
            >
              ${esc(weapon.icon)}
              ${esc(weapon.label)}
              <small>
                ${esc(
                  unlocked
                    ? 'Débloqué'
                    : weaponRequirement(
                        weapon.key
                      )
                )}
              </small>
            </button>
          `
        }
      ).join('')

    return `
      <div class="idle-equipment-v2">
        <section class="idle-card-v1 idle-equipment-avatar-v2">
          <div>
            ${renderBruteAvatarV2(
              selectedAthlete(),
              profile
            )}

            <div class="idle-title-avatar-name-v2">
              ${esc(
                selectedAthlete()?.name ||
                selectedSlug
              )}
            </div>
          </div>
        </section>

        <section class="idle-card-v1 idle-card-pad-v1">
          <span class="idle-kicker-v1">
            🎒 TON COMBATTANT
          </span>

          <h3 style="margin:8px 0 14px">
            Équipement & skin
          </h3>

          <div class="idle-note-v1" style="margin-bottom:14px">
            La tête vient de ton avatar athlète et reste la même.
            Le corps et l'équipement sont sauvegardés dans le cloud.
          </div>

          <div class="idle-equip-group-v2">
            <h4>Skin</h4>

            <div class="idle-equip-options-v2">
              ${IDLE_AVATAR_SKINS.map(
                item => `
                  <button
                    type="button"
                    class="idle-equip-option-v2 ${profile.avatar_skin === item.key ? 'active' : ''}"
                    data-idle-avatar-field="avatar_skin"
                    data-idle-avatar-value="${esc(item.key)}"
                  >
                    ${item.icon} ${esc(item.label)}
                  </button>
                `
              ).join('')}
            </div>
          </div>

          <div class="idle-equip-group-v2">
            <h4>Tenue</h4>

            <div class="idle-equip-options-v2">
              ${IDLE_AVATAR_OUTFITS.map(
                item => `
                  <button
                    type="button"
                    class="idle-equip-option-v2 ${profile.avatar_outfit === item.key ? 'active' : ''}"
                    data-idle-avatar-field="avatar_outfit"
                    data-idle-avatar-value="${esc(item.key)}"
                  >
                    ${item.icon} ${esc(item.label)}
                  </button>
                `
              ).join('')}
            </div>
          </div>

          <div class="idle-equip-group-v2">
            <h4>Arme</h4>

            <div class="idle-equip-options-v2">
              ${weaponButtons}
            </div>
          </div>

          <div class="idle-equip-group-v2">
            <h4>Aura</h4>

            <div class="idle-equip-options-v2">
              ${IDLE_AVATAR_AURAS.map(
                item => `
                  <button
                    type="button"
                    class="idle-equip-option-v2 ${profile.avatar_aura === item.key ? 'active' : ''}"
                    data-idle-avatar-field="avatar_aura"
                    data-idle-avatar-value="${esc(item.key)}"
                  >
                    ${item.icon} ${esc(item.label)}
                  </button>
                `
              ).join('')}
            </div>
          </div>
        </section>
      </div>
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

  function athleteBySlug(slug) {
    const wanted =
      normalizeMonsterKey(slug)

    return athletes.find(athlete =>
      normalizeMonsterKey(
        athleteSlug(athlete)
      ) === wanted
    )
  }

  function athleteBattleImage(
    athlete
  ) {
    if (!athlete) {
      return ''
    }

    const slugKey =
      normalizeMonsterKey(
        athleteSlug(athlete)
      )

    const nameKey =
      normalizeMonsterKey(
        athlete.name
      )

    const tokens =
      Array.from(
        new Set(
          [
            slugKey,
            ...nameKey.split(' '),
          ].filter(
            token =>
              token.length >= 3
          )
        )
      )

    const sprite =
      manifest.find(item => {
        const words =
          normalizeMonsterKey(
            item?.name ||
            item?.key
          ).split(' ')

        return tokens.some(
          token =>
            words.includes(token)
        )
      })

    return assetPath(
      sprite?.file ||
      athlete.profileImage ||
      ''
    )
  }

  function renderFighterVisual(
    athlete,
    fallbackEmoji = '🏋️'
  ) {
    const image =
      athleteBattleImage(
        athlete
      )

    return image
      ? `
        <img
          src="${esc(image)}"
          alt=""
          loading="eager"
        >
      `
      : `
        <div class="idle-avatar-v1">
          ${esc(
            athlete?.emoji ||
            fallbackEmoji
          )}
        </div>
      `
  }

  function renderBruteSheet(source = snapshot || {}) {
    const stats =
      deriveGaBruteStats(source)

    const traits =
      gaBruteTraits(stats)

    const statRow = (
      label,
      value
    ) => {
      const pct =
        clamp(
          value / 25 * 100,
          0,
          100
        )

      return `
        <div class="idle-brute-stat-v1">
          <span>${esc(label)}</span>

          <div class="idle-brute-stat-track-v1">
            <i style="width:${pct}%"></i>
          </div>

          <b>${value}</b>
        </div>
      `
    }

    return `
      <div class="idle-brute-sheet-v1">
        <div class="idle-brute-sheet-title-v1">
          <span>Profil de combat</span>
          <span>GA BRUTE</span>
        </div>

        ${statRow('Force', stats.strength)}
        ${statRow('Agilité', stats.agility)}
        ${statRow('Vitesse', stats.speed)}
        ${statRow('Vitalité', stats.vitality)}

        <div class="idle-brute-traits-v1">
          ${traits.length
            ? traits.map(
                trait => `
                  <span class="idle-brute-trait-v1">
                    ${esc(trait)}
                  </span>
                `
              ).join('')
            : `
              <span class="idle-brute-trait-v1">
                Entraîne-toi, marche et dors pour débloquer des traits
              </span>
            `}
        </div>
      </div>
    `
  }

  function seededRandom(seedText) {
    let seed = 2166136261

    for (
      let i = 0;
      i < seedText.length;
      i += 1
    ) {
      seed ^=
        seedText.charCodeAt(i)

      seed =
        Math.imul(
          seed,
          16777619
        )
    }

    return () => {
      seed += 0x6D2B79F5

      let value = seed
      value =
        Math.imul(
          value ^ value >>> 15,
          value | 1
        )

      value ^=
        value +
        Math.imul(
          value ^ value >>> 7,
          value | 61
        )

      return (
        (
          value ^ value >>> 14
        ) >>> 0
      ) / 4294967296
    }
  }

  function buildCombatReplay(
    row,
    mode
  ) {
    const random =
      seededRandom(
        String(
          row?.battle_id ||
          `${mode}-${selectedSlug}`
        )
      )

    const playerPower =
      Math.max(
        20,
        number(
          mode === 'pve'
            ? row?.player_power
            : row?.attacker_power,
          snapshot?.power || 35
        )
      )

    const enemyPower =
      Math.max(
        20,
        number(
          mode === 'pve'
            ? row?.enemy_power
            : row?.defender_power,
          35
        )
      )

    const playerStats =
      deriveGaBruteStats(
        snapshot || {}
      )

    const enemyStats =
      deriveOpponentStats(
        enemyPower,
        random
      )

    const playerMax =
      Math.round(
        82 +
        playerStats.vitality * 8 +
        playerStats.strength * 2.2
      )

    const enemyMax =
      Math.round(
        82 +
        enemyStats.vitality * 8 +
        enemyStats.strength * 2.2
      )

    let playerHp = playerMax
    let enemyHp = enemyMax
    let playerRage = 0
    let enemyRage = 0

    const expectedWinner =
      row?.won
        ? 'player'
        : 'enemy'

    const chooseWeapon = stats => {
      const unlocked =
        GA_BRUTE_WEAPONS.filter(
          weapon =>
            weapon.key === 'fists' ||
            (
              weapon.key === 'dumbbell' &&
              stats.training >= 45
            ) ||
            (
              weapon.key === 'belt' &&
              stats.training >= 25
            ) ||
            (
              weapon.key === 'shaker' &&
              stats.sleep >= 35
            ) ||
            (
              weapon.key === 'bench' &&
              stats.training >= 70
            ) ||
            (
              weapon.key === 'hammer' &&
              stats.training >= 88
            )
        )

      return unlocked[
        Math.floor(
          random() *
          unlocked.length
        )
      ] || GA_BRUTE_WEAPONS[0]
    }

    const preferredPlayerWeapon =
      GA_BRUTE_WEAPONS.find(
        weapon =>
          weapon.key ===
          (
            avatarProfile?.avatar_weapon ||
            'fists'
          )
      )

    let playerWeapon =
      preferredPlayerWeapon &&
      weaponUnlocked(
        preferredPlayerWeapon.key,
        snapshot || {}
      )
        ? preferredPlayerWeapon
        : chooseWeapon(playerStats)

    let enemyWeapon =
      chooseWeapon(enemyStats)

    const events = []

    let actor =
      (
        playerStats.speed +
        random() * 6
      ) >= (
        enemyStats.speed +
        random() * 6
      )
        ? 'player'
        : 'enemy'

    let comboCarry = false

    const totalTurns =
      9 +
      Math.floor(
        random() * 6
      )

    for (
      let turn = 0;
      turn < totalTurns - 1;
      turn += 1
    ) {
      const target =
        actor === 'player'
          ? 'enemy'
          : 'player'

      const attackerStats =
        actor === 'player'
          ? playerStats
          : enemyStats

      const defenderStats =
        target === 'player'
          ? playerStats
          : enemyStats

      const attackerPower =
        actor === 'player'
          ? playerPower
          : enemyPower

      const defenderPower =
        target === 'player'
          ? playerPower
          : enemyPower

      const weapon =
        actor === 'player'
          ? playerWeapon
          : enemyWeapon

      const targetMax =
        target === 'player'
          ? playerMax
          : enemyMax

      const targetHp =
        target === 'player'
          ? playerHp
          : enemyHp

      const currentRage =
        actor === 'player'
          ? playerRage
          : enemyRage

      const rage =
        currentRage >= 100

      const dodge =
        !rage &&
        random() <
          defenderStats.evade *
          (
            0.84 +
            random() * 0.28
          )

      const block =
        !dodge &&
        !rage &&
        random() <
          defenderStats.block *
          (
            0.78 +
            random() * 0.30
          )

      const crit =
        !dodge &&
        (
          rage ||
          random() <
            attackerStats.crit
        )

      const powerRatio =
        clamp(
          attackerPower /
          Math.max(
            1,
            defenderPower
          ),
          0.62,
          1.55
        )

      let damage = 0

      if (!dodge) {
        const raw =
          (
            5 +
            attackerStats.strength * 1.25 +
            random() *
              (
                5 +
                attackerStats.agility * 0.55
              )
          ) *
          powerRatio *
          (weapon?.damage || 1) *
          (crit ? 1.48 : 1) *
          (rage ? 1.45 : 1)

        damage =
          Math.max(
            3,
            Math.round(
              block
                ? raw * 0.34
                : raw
            )
          )

        const reserve =
          Math.max(
            1,
            Math.round(
              targetMax *
              (
                target ===
                  expectedWinner
                  ? 0.22
                  : 0.06
              )
            )
          )

        damage =
          Math.min(
            damage,
            Math.max(
              0,
              targetHp - reserve
            )
          )
      }

      if (target === 'player') {
        playerHp =
          Math.max(
            1,
            playerHp - damage
          )

        playerRage =
          clamp(
            playerRage +
            Math.max(
              6,
              Math.round(
                damage /
                Math.max(
                  1,
                  playerMax
                ) *
                115
              )
            ),
            0,
            100
          )
      } else {
        enemyHp =
          Math.max(
            1,
            enemyHp - damage
          )

        enemyRage =
          clamp(
            enemyRage +
            Math.max(
              6,
              Math.round(
                damage /
                Math.max(
                  1,
                  enemyMax
                ) *
                115
              )
            ),
            0,
            100
          )
      }

      if (rage) {
        if (actor === 'player') {
          playerRage = 0
        } else {
          enemyRage = 0
        }
      }

      const counter =
        (
          block ||
          dodge
        ) &&
        random() <
          defenderStats.counter

      const combo =
        !dodge &&
        !block &&
        !counter &&
        random() <
          attackerStats.combo

      const disarm =
        !dodge &&
        !block &&
        weapon?.key !== 'fists' &&
        random() <
          defenderStats.disarm

      if (disarm) {
        if (actor === 'player') {
          playerWeapon =
            GA_BRUTE_WEAPONS[0]
        } else {
          enemyWeapon =
            GA_BRUTE_WEAPONS[0]
        }
      }

      events.push({
        actor,
        target,
        damage,
        dodge,
        block,
        counter,
        combo,
        disarm,
        crit,
        rage,
        weapon:
          weapon?.icon ||
          '👊',
        weaponLabel:
          weapon?.label ||
          'Poings',
        playerHp,
        enemyHp,
        playerRage,
        enemyRage,
      })

      if (counter) {
        actor = target
        comboCarry = true
      } else if (combo) {
        comboCarry = true
      } else {
        actor =
          actor === 'player'
            ? 'enemy'
            : 'player'

        comboCarry = false
      }

      if (comboCarry && random() < 0.18) {
        // Keep the same fighter one extra time to make combos readable.
      }
    }

    const finalActor =
      expectedWinner

    const finalTarget =
      expectedWinner === 'player'
        ? 'enemy'
        : 'player'

    const finalHp =
      finalTarget === 'player'
        ? playerHp
        : enemyHp

    if (finalTarget === 'player') {
      playerHp = 0
    } else {
      enemyHp = 0
    }

    const finalWeapon =
      finalActor === 'player'
        ? playerWeapon
        : enemyWeapon

    events.push({
      actor:
        finalActor,
      target:
        finalTarget,
      damage:
        Math.max(
          finalHp,
          Math.round(
            (
              finalTarget === 'player'
                ? playerMax
                : enemyMax
            ) * 0.16
          )
        ),
      dodge: false,
      block: false,
      counter: false,
      combo: false,
      disarm: false,
      crit: true,
      rage: true,
      weapon:
        finalWeapon?.icon ||
        '👊',
      weaponLabel:
        finalWeapon?.label ||
        'Poings',
      playerHp,
      enemyHp,
      playerRage:
        finalActor === 'player'
          ? 0
          : playerRage,
      enemyRage:
        finalActor === 'enemy'
          ? 0
          : enemyRage,
      knockout: true,
    })

    return {
      mode,
      events,
      index: -1,
      running: true,
      done: false,
      playerMax,
      enemyMax,
      playerHp:
        playerMax,
      enemyHp:
        enemyMax,
      playerRage: 0,
      enemyRage: 0,
      playerStats,
      enemyStats,
      lastEvent: null,
      log: [],
    }
  }

  function eventLabel(
    event,
    playerName,
    enemyName
  ) {
    const actorName =
      event.actor === 'player'
        ? playerName
        : enemyName

    const targetName =
      event.target === 'player'
        ? playerName
        : enemyName

    if (event.dodge) {
      return `${targetName} esquive ${event.weaponLabel || 'le coup'}`
    }

    if (event.block) {
      return `${targetName} bloque et encaisse ${event.damage}`
    }

    if (event.counter) {
      return `${targetName} déclenche une contre-attaque`
    }

    if (event.disarm) {
      return `${targetName} désarme ${actorName}`
    }

    if (event.knockout) {
      return `${actorName} met ${targetName} K.O. !`
    }

    if (event.rage) {
      return `${actorName} libère sa RAGE : ${event.damage}`
    }

    if (event.combo) {
      return `${actorName} enchaîne : ${event.damage}`
    }

    if (event.crit) {
      return `${actorName} place un critique à ${event.damage}`
    }

    return `${actorName} inflige ${event.damage}`
  }

  function stopCombatReplay() {
    if (combatTimer) {
      clearTimeout(
        combatTimer
      )

      combatTimer = null
    }
  }

  function advanceCombatReplay() {
    if (
      !combatReplay ||
      !combatReplay.running
    ) {
      return
    }

    combatReplay.index += 1

    const event =
      combatReplay.events[
        combatReplay.index
      ]

    if (!event) {
      combatReplay.running = false
      combatReplay.done = true
      render()
      return
    }

    combatReplay.playerHp =
      event.playerHp

    combatReplay.enemyHp =
      event.enemyHp

    combatReplay.playerRage =
      number(
        event.playerRage
      )

    combatReplay.enemyRage =
      number(
        event.enemyRage
      )

    combatReplay.lastEvent =
      event

    const playerName =
      selectedAthlete()?.name ||
      selectedSlug ||
      'Athlète'

    const enemyName =
      battle?.mode === 'pve'
        ? (
          battle?.monster_name ||
          'Monstre'
        )
        : (
          battle?.defender_name ||
          displayNameFromSlug(
            battle?.defender_slug
          ) ||
          'Adversaire'
        )

    combatReplay.log.unshift(
      eventLabel(
        event,
        playerName,
        enemyName
      )
    )

    combatReplay.log =
      combatReplay.log.slice(
        0,
        2
      )

    const isLast =
      combatReplay.index >=
      combatReplay.events.length - 1

    if (isLast) {
      combatReplay.running = false
      combatReplay.done = true

      render()

      battleSound(
        Boolean(
          battle?.won
        )
      )

      return
    }

    render()

    combatTimer =
      setTimeout(
        advanceCombatReplay,
        720
      )
  }

  function startCombatReplay(
    row,
    mode
  ) {
    stopCombatReplay()

    combatReplay =
      buildCombatReplay(
        row,
        mode
      )

    render()

    combatTimer =
      setTimeout(
        advanceCombatReplay,
        620
      )
  }

  function renderBattleResult(
    mode
  ) {
    if (
      !battle ||
      battle.mode !== mode ||
      (
        combatReplay &&
        combatReplay.mode === mode &&
        !combatReplay.done
      )
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

      <button
        type="button"
        class="idle-secondary-v1 idle-brute-replay-v1"
        data-idle-replay
      >
        ↻ Revoir le combat
      </button>
    `
  }

  function renderBruteArena(
    mode
  ) {
    const current =
      snapshot || {}

    const player =
      selectedAthlete()

    const opponentAthlete =
      mode === 'pvp' &&
      battle?.mode === 'pvp'
        ? athleteBySlug(
            battle.defender_slug
          )
        : null

    const playerName =
      player?.name ||
      selectedSlug ||
      'Athlète'

    const enemyName =
      mode === 'pve'
        ? (
          battle?.mode === 'pve'
            ? (
              battle.monster_name ||
              battle.monster_key ||
              'Monstre'
            )
            : 'Prochaine rencontre'
        )
        : (
          battle?.mode === 'pvp'
            ? (
              battle.defender_name ||
              opponentAthlete?.name ||
              displayNameFromSlug(
                battle.defender_slug
              )
            )
            : 'Adversaire aléatoire'
        )

    const playerPower =
      number(
        mode === 'pve'
          ? battle?.player_power
          : battle?.attacker_power,
        current.power || 35
      )

    const enemyPower =
      number(
        mode === 'pve'
          ? battle?.enemy_power
          : battle?.defender_power,
        35
      )

    const playerMax =
      combatReplay?.mode === mode
        ? combatReplay.playerMax
        : Math.round(
            105 +
            playerPower * 0.72
          )

    const enemyMax =
      combatReplay?.mode === mode
        ? combatReplay.enemyMax
        : Math.round(
            105 +
            enemyPower * 0.72
          )

    const playerHp =
      combatReplay?.mode === mode
        ? combatReplay.playerHp
        : playerMax

    const enemyHp =
      combatReplay?.mode === mode
        ? combatReplay.enemyHp
        : enemyMax

    const playerPct =
      clamp(
        playerHp /
        Math.max(
          1,
          playerMax
        ) *
        100,
        0,
        100
      )

    const enemyPct =
      clamp(
        enemyHp /
        Math.max(
          1,
          enemyMax
        ) *
        100,
        0,
        100
      )

    const last =
      combatReplay?.mode === mode
        ? combatReplay.lastEvent
        : null

    const playerClass = [
      'idle-brute-fighter-v1',
      'player',
      last?.actor === 'player'
        ? 'attacking'
        : '',
      last?.target === 'player'
        ? (
          last?.dodge
            ? 'dodging'
            : last?.block
              ? 'blocking'
              : 'hit'
        )
        : '',
      last?.rage &&
      last?.actor === 'player'
        ? 'raging'
        : '',
      playerHp <= 0
        ? 'ko'
        : '',
    ].filter(Boolean).join(' ')

    const enemyClass = [
      'idle-brute-fighter-v1',
      'enemy',
      last?.actor === 'enemy'
        ? 'attacking'
        : '',
      last?.target === 'enemy'
        ? (
          last?.dodge
            ? 'dodging'
            : last?.block
              ? 'blocking'
              : 'hit'
        )
        : '',
      last?.rage &&
      last?.actor === 'enemy'
        ? 'raging'
        : '',
      enemyHp <= 0
        ? 'ko'
        : '',
    ].filter(Boolean).join(' ')

    const enemyVisual =
      mode === 'pve'
        ? (
          battle?.mode === 'pve'
            ? (
              monsterImage(
                battle
              ) ||
              '/sprites/monsters/le-monstre-du-sbd-complet.webp'
            )
            : '/sprites/monsters/le-monstre-du-sbd-complet.webp'
        )
        : athleteBattleImage(
            opponentAthlete
          )

    const round =
      combatReplay?.mode === mode
        ? Math.max(
            1,
            combatReplay.index + 2
          )
        : 1

    const action =
      !battle ||
      battle.mode !== mode
        ? (
          mode === 'pve'
            ? 'Lance une expédition'
            : 'Cherche un adversaire'
        )
        : combatReplay?.running
          ? (
            last?.dodge
              ? 'ESQUIVE !'
              : last?.block
                ? 'BLOQUÉ !'
                : last?.counter
                  ? 'CONTRE !'
                  : last?.rage
                    ? 'RAGE !'
                    : last?.combo
                      ? 'ENCHAÎNEMENT !'
                      : last?.crit
                        ? 'COUP CRITIQUE !'
                        : 'COMBAT !'
          )
          : combatReplay?.done
            ? (
              battle.won
                ? 'VICTOIRE !'
                : 'K.O.'
            )
            : 'PRÊT'

    return `
      <div class="idle-brute-arena-v1">
        <div class="idle-brute-hud-v1">
          <div class="idle-brute-hud-side-v1">
            <div class="idle-brute-name-v1">
              ${esc(playerName)}
            </div>

            <div class="idle-brute-hp-shell-v1">
              <div
                class="idle-brute-hp-v1"
                style="width:${playerPct}%"
              ></div>
            </div>

            <div class="idle-brute-hp-number-v1">
              ${Math.max(0, playerHp)} / ${playerMax}
              · PWR ${playerPower}
            </div>

            <div class="idle-brute-rage-v1">
              <span
                style="width:${clamp(
                  combatReplay?.mode === mode
                    ? combatReplay.playerRage
                    : 0,
                  0,
                  100
                )}%"
              ></span>
            </div>
          </div>

          <div class="idle-brute-round-v1">
            T${round}
          </div>

          <div class="idle-brute-hud-side-v1 right">
            <div class="idle-brute-name-v1">
              ${esc(enemyName)}
            </div>

            <div class="idle-brute-hp-shell-v1">
              <div
                class="idle-brute-hp-v1"
                style="width:${enemyPct}%"
              ></div>
            </div>

            <div class="idle-brute-hp-number-v1">
              ${Math.max(0, enemyHp)} / ${enemyMax}
              · PWR ${enemyPower}
            </div>

            <div class="idle-brute-rage-v1">
              <span
                style="width:${clamp(
                  combatReplay?.mode === mode
                    ? combatReplay.enemyRage
                    : 0,
                  0,
                  100
                )}%"
              ></span>
            </div>
          </div>
        </div>

        <div class="idle-brute-floor-v1"></div>

        <div class="idle-brute-fighters-v1">
          <div class="${playerClass}">
            <div class="idle-brute-sprite-v1">
              ${renderFighterVisual(
                player
              )}
            </div>

            ${last?.actor === 'player'
              ? `
                <div class="idle-brute-weapon-v1">
                  ${esc(
                    last.weapon ||
                    '👊'
                  )}
                </div>
              `
              : ''}

            ${last?.target === 'player'
              ? `
                <div class="idle-brute-damage-v1 ${last.dodge ? 'dodge' : ''} ${last.block ? 'block' : ''} ${last.counter ? 'counter' : ''} ${last.crit ? 'crit' : ''} ${last.rage ? 'rage' : ''}">
                  ${last.dodge
                    ? 'ESQUIVE'
                    : last.block
                      ? `BLOQUE -${last.damage}`
                      : last.counter
                        ? 'CONTRE'
                        : last.rage
                          ? `RAGE -${last.damage}`
                          : `-${last.damage}`}
                </div>
              `
              : ''}

            <div class="idle-brute-label-v1">
              ${esc(playerName)}
            </div>
          </div>

          <div class="${enemyClass}">
            <div class="idle-brute-sprite-v1">
              ${enemyVisual
                ? `
                  <img
                    src="${esc(enemyVisual)}"
                    alt=""
                    loading="eager"
                  >
                `
                : `
                  <div class="idle-avatar-v1">
                    🥊
                  </div>
                `}
            </div>

            ${last?.actor === 'enemy'
              ? `
                <div class="idle-brute-weapon-v1">
                  ${esc(
                    last.weapon ||
                    '👊'
                  )}
                </div>
              `
              : ''}

            ${last?.target === 'enemy'
              ? `
                <div class="idle-brute-damage-v1 ${last.dodge ? 'dodge' : ''} ${last.block ? 'block' : ''} ${last.counter ? 'counter' : ''} ${last.crit ? 'crit' : ''} ${last.rage ? 'rage' : ''}">
                  ${last.dodge
                    ? 'ESQUIVE'
                    : last.block
                      ? `BLOQUE -${last.damage}`
                      : last.counter
                        ? 'CONTRE'
                        : last.rage
                          ? `RAGE -${last.damage}`
                          : `-${last.damage}`}
                </div>
              `
              : ''}

            <div class="idle-brute-label-v1">
              ${esc(enemyName)}
            </div>
          </div>
        </div>

        <div class="idle-brute-center-v1">
          <div class="idle-brute-action-v1">
            ${esc(action)}
          </div>
        </div>

        ${combatReplay?.mode === mode &&
          combatReplay.log.length
          ? `
            <div class="idle-brute-log-v1">
              ${combatReplay.log.map(
                line => `
                  <div class="idle-brute-log-line-v1">
                    ${esc(line)}
                  </div>
                `
              ).join('')}
            </div>
          `
          : ''}
      </div>
    `
  }

  function renderPve() {
    const current =
      snapshot || {}

    const fighting =
      combatReplay?.mode === 'pve' &&
      combatReplay.running

    return `
      <div class="idle-grid-v1">
        <section class="idle-card-v1">
          ${renderBruteArena(
            'pve'
          )}

          ${renderBattleResult(
            'pve'
          )}
        </section>

        <aside class="idle-card-v1 idle-card-pad-v1">
          <span class="idle-kicker-v1">
            👾 GA BRUTE · EXPÉDITION
          </span>

          <h3 style="margin:8px 0 5px">
            PvE · 6 énergie
          </h3>

          <p style="margin:0 0 12px;color:#858da9;font-size:10px;line-height:1.6">
            Le duel se joue tout seul : initiative, armes,
            esquives, blocages, contres, enchaînements, rage,
            critiques et K.O. Force = entraînement, agilité =
            steps, vitalité/récupération = sommeil.
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

          ${renderBruteSheet(
            current
          )}

          <button
            type="button"
            class="idle-primary-v1"
            data-idle-pve
            ${(!canEdit() || busy || fighting) ? 'disabled' : ''}
          >
            ${fighting
              ? '⚔️ Combat en cours…'
              : '⚔️ Lancer le combat'}
          </button>

          <button
            type="button"
            class="idle-secondary-v1"
            style="margin-top:8px;width:100%"
            data-idle-claim
            ${fighting ? 'disabled' : ''}
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

    const fighting =
      combatReplay?.mode === 'pvp' &&
      combatReplay.running

    return `
      <div class="idle-grid-v1">
        <section class="idle-card-v1">
          ${renderBruteArena(
            'pvp'
          )}

          ${renderBattleResult(
            'pvp'
          )}
        </section>

        <aside class="idle-card-v1 idle-card-pad-v1">
          <span class="idle-kicker-v1">
            🥊 GA BRUTE · ARÈNE
          </span>

          <h3 style="margin:8px 0 5px">
            PvP · 10 énergie
          </h3>

          <p style="margin:0 0 12px;color:#858da9;font-size:10px;line-height:1.6">
            Duel automatique façon brute arena :
            initiative, armes, esquive, blocage, contre-attaque,
            combo, désarmement et jauge de rage. Le résultat reste
            calculé à partir des données réelles des deux athlètes.
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

            <div class="idle-power-pill-v1">
              <b>
                ${number(
                  current.rank_points,
                  1000
                )}
              </b>
              <span>Cote</span>
            </div>
          </div>

          ${renderBruteSheet(
            current
          )}

          <button
            type="button"
            class="idle-primary-v1"
            data-idle-pvp
            ${(!canEdit() || busy || fighting) ? 'disabled' : ''}
          >
            ${fighting
              ? '🥊 Duel en cours…'
              : '🥊 Chercher un adversaire'}
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

    if (activeTab === 'menu') {
      return renderTitleMenu()
    }

    if (activeTab === 'equipment') {
      return renderEquipment()
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
        ${activeTab !== 'menu'
          ? `
            <header class="idle-top-v1">
              <button
                type="button"
                class="idle-back-v1"
                data-idle-menu
              >
                ← Menu
              </button>

              <div>
                <span>
                  GA BRUTE · ${esc(
                    activeTab === 'pvp'
                      ? 'DUEL'
                      : activeTab === 'pve'
                        ? 'PVE'
                        : activeTab === 'sleep'
                          ? 'SOMMEIL'
                          : activeTab === 'equipment'
                            ? 'ÉQUIPEMENT'
                            : 'CAMP'
                  )}
                </span>

                <h1>
                  ${esc(
                    athlete?.name ||
                    selectedSlug
                  )}
                </h1>
              </div>

              <button
                type="button"
                class="idle-switch-v1"
                data-idle-music
              >
                ${musicEnabled ? '🔊' : '🔇'}
              </button>
            </header>
          `
          : ''}

        <section class="idle-shell-v1">
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

        activeTab = 'menu'
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
        avatarProfile = null
        battle = null
        combatReplay = null
        stopCombatReplay()
        ambient.stop()
        stopScreenMusic()
        render()
        return
      }

      const menuButton =
        event.target.closest(
          '[data-idle-menu]'
        )

      if (menuButton) {
        stopCombatReplay()
        combatReplay = null
        battle = null
        ambient.stop()
        setActiveTab('menu')
        return
      }

      const musicButton =
        event.target.closest(
          '[data-idle-music]'
        )

      if (musicButton) {
        musicEnabled =
          !musicEnabled

        try {
          localStorage.setItem(
            'ga-idle-music-v2',
            musicEnabled
              ? 'on'
              : 'off'
          )
        } catch {
          // no-op
        }

        syncScreenMusic(true)
        render()
        return
      }

      const avatarOption =
        event.target.closest(
          '[data-idle-avatar-field]'
        )

      if (avatarOption) {
        if (
          !canEdit() ||
          busy
        ) {
          return
        }

        const field =
          String(
            avatarOption.dataset.idleAvatarField ||
            ''
          )

        const value =
          String(
            avatarOption.dataset.idleAvatarValue ||
            ''
          )

        if (
          field === 'avatar_weapon' &&
          !weaponUnlocked(
            value,
            snapshot || {}
          )
        ) {
          notice =
            'Cette arme n’est pas encore débloquée.'
          render()
          return
        }

        const payload = {
          p_athlete_slug:
            selectedSlug,
          p_avatar_skin:
            field === 'avatar_skin'
              ? value
              : null,
          p_avatar_outfit:
            field === 'avatar_outfit'
              ? value
              : null,
          p_avatar_weapon:
            field === 'avatar_weapon'
              ? value
              : null,
          p_avatar_aura:
            field === 'avatar_aura'
              ? value
              : null,
        }

        busy = true
        render()

        const result =
          await supabase.rpc(
            'idle_avatar_update_v1',
            payload
          )

        busy = false

        if (result.error) {
          notice =
            result.error.message ||
            'Impossible de sauvegarder l’avatar.'
        } else {
          const updatedAvatar =
            Array.isArray(
              result.data
            )
              ? result.data[0]
              : result.data

          avatarProfile = {
            ...avatarProfile,
            ...updatedAvatar,
          }

          notice =
            'Avatar sauvegardé.'
        }

        render()
        return
      }

      const avatarConfirm =
        event.target.closest(
          '[data-idle-avatar-confirm]'
        )

      if (avatarConfirm) {
        if (
          !canEdit() ||
          busy
        ) {
          return
        }

        busy = true
        render()

        const result =
          await supabase.rpc(
            'idle_avatar_confirm_v1',
            {
              p_athlete_slug:
                selectedSlug,
            }
          )

        busy = false

        if (result.error) {
          notice =
            result.error.message ||
            'Impossible de créer le combattant.'
        } else {
          avatarProfile = {
            ...avatarProfile,
            avatar_confirmed_at:
              result.data ||
              new Date().toISOString(),
          }

          notice =
            'Combattant créé. Bienvenue dans GA Brute.'
          syncScreenMusic(true)
        }

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
          stopCombatReplay()
          combatReplay = null
          battle = null

          if (next !== 'sleep') {
            ambient.stop()
          }

          setActiveTab(next)
        }

        return
      }

      const sound =
        event.target.closest(
          '[data-idle-sound]'
        )

      if (sound) {
        stopScreenMusic()

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

      const replay =
        event.target.closest(
          '[data-idle-replay]'
        )

      if (replay) {
        if (
          battle &&
          (
            battle.mode === 'pve' ||
            battle.mode === 'pvp'
          )
        ) {
          startCombatReplay(
            battle,
            battle.mode
          )
        }

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

        await loadSelected()

        startCombatReplay(
          battle,
          'pve'
        )

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

        await loadSelected()

        startCombatReplay(
          battle,
          'pvp'
        )

        return
      }
    }

  if (!selectedSlug) {
    render()
    return
  }

  await loadSelected()
  syncScreenMusic()
}
