
import { supabase } from './supabase.js'
import {
  BRUTE_PARTS,
  BRUTE_WEAPONS,
  BRUTE_SKILLS,
  BRUTE_PETS,
  DEFAULT_APPEARANCE,
  getBruteTheme,
  randomAppearance,
} from './brute-config.js'
import { renderBruteSvg, renderPetSvg } from './brute-svg.js'
import {
  createSeededRandom,
  generateFightTimeline,
  replayFingerprint,
} from './brute-engine.js'

function esc(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;')
}

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function athleteSlug(athlete) {
  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    ''
  ).trim()
}

function sleepLabel(seconds) {
  const total = Math.max(0, Math.floor(num(seconds)))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')
    : String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')
}

function ensureStyles() {
  if (document.getElementById('ga-brute-game-style-v1')) return

  const style = document.createElement('style')
  style.id = 'ga-brute-game-style-v1'
  style.textContent = [
    '.brute-app{--accent:#8b5cf6;min-height:100vh;padding:14px;color:#f7f7fb;background:radial-gradient(circle at 50% -15%,color-mix(in srgb,var(--accent),transparent 75%),transparent 35%),linear-gradient(180deg,#070812,#0b0d19 55%,#05060c);font-family:Inter,system-ui,sans-serif}',
    '.brute-shell{width:min(1100px,100%);margin:0 auto}',
    '.brute-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}.brute-top h1{margin:0;font-size:24px;letter-spacing:-.03em}.brute-top small{display:block;color:#8086a0;font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.brute-back,.brute-mini{border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.04);color:#f3f4f8;padding:9px 11px;font-weight:900;cursor:pointer}.brute-top .spacer{flex:1}',
    '.brute-panel{border:1px solid rgba(255,255,255,.08);border-radius:20px;background:linear-gradient(180deg,rgba(21,25,48,.95),rgba(9,11,24,.98));box-shadow:0 22px 60px rgba(0,0,0,.28);overflow:hidden}.brute-pad{padding:16px}',
    '.brute-title-screen{position:relative;min-height:650px;border-radius:24px;overflow:hidden;background:radial-gradient(circle at 50% 18%,rgba(255,248,189,.82),transparent 23%),linear-gradient(180deg,#84c7d7 0 26%,#d7c585 26% 32%,#c58b43 32% 100%);border:2px solid #65401f;box-shadow:0 28px 80px rgba(0,0,0,.35)}',
    '.brute-title-screen:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(63,65,72,.35) 0 4%,transparent 4% 96%,rgba(63,65,72,.35) 96%),linear-gradient(180deg,transparent 0 64%,rgba(85,47,18,.13) 64%);pointer-events:none}',
    '.brute-logo{position:relative;z-index:3;width:max-content;max-width:88%;margin:18px auto 0;padding:8px 24px;border:4px solid #6d391c;border-radius:8px;background:linear-gradient(180deg,#e8b85c,#bd6f2c);box-shadow:inset 0 0 0 3px #f5d78b,0 7px 0 #542813,0 13px 22px rgba(70,35,14,.28);font-size:clamp(31px,6vw,58px);font-weight:1000;letter-spacing:.08em;color:#552817;text-shadow:2px 2px 0 #f8dc91;transform:rotate(-1deg)}',
    '.brute-title-sub{text-align:center;position:relative;z-index:3;margin-top:10px;color:#63391e;font-size:9px;font-weight:1000;letter-spacing:.19em}',
    '.brute-menu-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(180px,.72fr) minmax(260px,1fr) minmax(180px,.72fr);gap:16px;align-items:center;min-height:520px;padding:20px 26px 30px}',
    '.brute-menu-side{display:grid;gap:13px}.brute-wood{border:3px solid #6c391e;border-radius:9px;background:linear-gradient(180deg,#b86b31,#7e3d1e);box-shadow:inset 0 0 0 2px rgba(255,220,145,.3),0 5px 0 #512713,0 10px 18px rgba(69,33,13,.18);padding:13px;color:#fff2b7;font-weight:1000;letter-spacing:.06em;text-shadow:0 2px 0 #4d2411;cursor:pointer}.brute-wood:hover{filter:brightness(1.08);transform:translateY(-1px)}.brute-wood small{display:block;margin-top:3px;font-size:8px;color:#efcb87;letter-spacing:0}',
    '.brute-menu-avatar{display:flex;flex-direction:column;align-items:center;justify-content:center}.brute-menu-avatar .ga-brute-svg{width:min(310px,100%);animation:bruteIdle 2.7s ease-in-out infinite;filter:drop-shadow(0 16px 13px rgba(73,40,18,.24))}.brute-nameplate{margin-top:-14px;padding:7px 16px;border:3px solid #70401f;border-radius:8px;background:#f0dba3;color:#66371c;font-weight:1000;box-shadow:0 4px 0 rgba(92,45,20,.25)}',
    '.brute-menu-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:min(350px,100%);margin-top:9px}.brute-menu-stat{padding:7px 5px;border:2px solid rgba(104,56,24,.36);border-radius:7px;background:rgba(255,242,190,.58);text-align:center;color:#693a1c}.brute-menu-stat b{display:block;font-size:14px}.brute-menu-stat span{font-size:7px;text-transform:uppercase;font-weight:1000}',
    '.brute-create{display:grid;grid-template-columns:minmax(270px,.85fr) minmax(0,1.15fr);gap:14px}.brute-create-preview{min-height:620px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--accent),transparent 73%),transparent 34%),#0b0f21}.brute-create-preview .ga-brute-svg{width:min(390px,100%);animation:bruteIdle 2.7s ease-in-out infinite}.brute-create-controls{padding:16px;max-height:76vh;overflow:auto}.brute-create-controls h2{margin:4px 0 8px}.brute-create-controls p{color:#858ba5;font-size:10px;line-height:1.6}',
    '.brute-name-input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#080b17;color:white;padding:12px;margin:8px 0 12px;font-weight:900}',
    '.brute-control{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.055)}.brute-control label{font-size:9px;color:#858ca8;text-transform:uppercase;font-weight:900;letter-spacing:.08em}.brute-control strong{display:block;margin-top:3px;font-size:12px;color:#fff}.brute-arrows{display:flex;gap:5px}.brute-arrows button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04);color:white;font-weight:1000;cursor:pointer}',
    '.brute-swatches{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.brute-swatch{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.22);cursor:pointer}.brute-swatch.active{outline:3px solid var(--accent);outline-offset:2px}',
    '.brute-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.brute-primary,.brute-secondary{border:0;border-radius:13px;padding:12px 15px;font-weight:1000;cursor:pointer}.brute-primary{background:linear-gradient(135deg,var(--accent),#47c7f7);color:white}.brute-secondary{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#e7e8f0}.brute-primary:disabled,.brute-secondary:disabled{opacity:.38;cursor:not-allowed}',
    '.brute-dashboard{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:12px}.brute-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.brute-stat-card{padding:12px;border:1px solid rgba(255,255,255,.06);border-radius:15px;background:rgba(255,255,255,.03)}.brute-stat-card b{display:block;font-size:22px}.brute-stat-card span{font-size:8px;color:#8087a2;text-transform:uppercase;font-weight:900}',
    '.brute-xp{margin-top:13px}.brute-track{height:8px;border-radius:999px;background:#060812;overflow:hidden}.brute-track i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#4ec6ff);border-radius:inherit}.brute-list{display:grid;gap:7px}.brute-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:13px;background:rgba(255,255,255,.025)}.brute-row .icon{font-size:25px}.brute-row b{font-size:11px}.brute-row small{display:block;margin-top:2px;color:#747c98;font-size:8px}',
    '.brute-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.brute-choice{padding:14px;border:1px solid color-mix(in srgb,var(--accent),transparent 55%);border-radius:16px;background:color-mix(in srgb,var(--accent),transparent 90%);color:#fff;cursor:pointer;text-align:left}.brute-choice .big{font-size:30px}.brute-choice b{display:block;margin-top:6px}.brute-choice small{color:#a8abc1}',
    '.brute-arena{position:relative;min-height:560px;overflow:hidden;background:radial-gradient(circle at 50% 24%,rgba(255,246,189,.72),transparent 25%),linear-gradient(180deg,#88c4d1 0 27%,#d6bd78 27% 34%,#b77638 34% 100%);border:2px solid #65401f;border-radius:21px}.brute-arena:after{content:"GA BRUTE";position:absolute;left:50%;top:58%;transform:translate(-50%,-50%) rotate(-7deg);font-size:65px;font-weight:1000;letter-spacing:.08em;color:rgba(87,43,18,.07);white-space:nowrap}',
    '.brute-hud{position:absolute;z-index:8;inset:12px 14px auto;display:grid;grid-template-columns:1fr 55px 1fr;gap:10px}.brute-hud-side.right{text-align:right}.brute-hud-name{font-size:10px;font-weight:1000;color:#fff4bd;text-shadow:0 2px #563018}.brute-hp{height:18px;padding:3px;border:2px solid #633719;border-radius:5px;background:#392216}.brute-hp i{display:block;height:100%;background:linear-gradient(180deg,#ffe646,#ffaf22 55%,#e6531d);transition:width .25s linear}.brute-round{display:grid;place-items:center;height:43px;border:3px solid #8e4d22;border-radius:50%;background:#fff0ae;color:#7b3d1d;font-size:9px;font-weight:1000}',
    '.brute-fighters{position:absolute;z-index:5;left:0;right:0;bottom:48px;display:grid;grid-template-columns:1fr 1fr;align-items:end;padding:0 4%}.brute-fighter{position:relative;display:flex;flex-direction:column;align-items:center}.brute-fighter .ga-brute-svg{width:min(340px,95%);transition:transform .22s ease,filter .18s ease}.brute-fighter.right .ga-brute-svg{transform:scaleX(-1)}.brute-fighter.attacking.left .ga-brute-svg{animation:bruteAttackLeft .42s ease}.brute-fighter.attacking.right .ga-brute-svg{animation:bruteAttackRight .42s ease}.brute-fighter.hit .ga-brute-svg{animation:bruteHit .34s ease}.brute-fighter.dodge.left .ga-brute-svg{animation:bruteDodgeLeft .34s ease}.brute-fighter.dodge.right .ga-brute-svg{animation:bruteDodgeRight .34s ease}.brute-fighter.ko .ga-brute-svg{transform:rotate(77deg) translate(24px,20px)!important;opacity:.48}',
    '.brute-pet-slot{position:absolute;bottom:7px;width:84px}.brute-fighter.left .brute-pet-slot{right:7%}.brute-fighter.right .brute-pet-slot{left:7%}.ga-brute-pet-svg{width:100%}',
    '.brute-float{position:absolute;z-index:15;top:25%;padding:5px 8px;border:2px solid #91451f;border-radius:9px;background:#fff6be;color:#d3241e;font-weight:1000;animation:bruteFloat .72s ease forwards}.brute-fighter.left .brute-float{right:15%}.brute-fighter.right .brute-float{left:15%}.brute-float.dodge{color:#285fa7}.brute-float.skill{color:#7b36b3}',
    '.brute-log{position:absolute;z-index:8;left:13px;right:13px;bottom:9px;text-align:center;color:#fff2ba;font-size:8px;font-weight:900;text-shadow:0 2px #4c2814}.brute-controls{display:flex;gap:7px;justify-content:center;margin-top:10px}',
    '.brute-equipment{display:grid;grid-template-columns:minmax(250px,.85fr) minmax(0,1.15fr);gap:12px}.brute-equipment-preview{display:grid;place-items:center;min-height:430px}.brute-equipment-preview .ga-brute-svg{width:min(360px,100%)}.brute-chip-row{display:flex;gap:7px;flex-wrap:wrap}.brute-chip{border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.04);color:#d8dae6;padding:8px 10px;font-size:9px;font-weight:900}.brute-chip.active{border-color:var(--accent);color:#fff;background:color-mix(in srgb,var(--accent),transparent 86%)}',
    '.brute-ranking{display:grid;gap:7px}.brute-rank-row{display:grid;grid-template-columns:34px 1fr repeat(3,auto);gap:9px;align-items:center;padding:10px;border-bottom:1px solid rgba(255,255,255,.055)}.brute-rank-row .rank{font-size:17px;font-weight:1000;color:var(--accent)}',
    '.brute-sleep{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.7fr);gap:12px}.brute-moon{min-height:390px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle at 50% 32%,rgba(131,112,255,.28),transparent 25%),#0a0d21}.brute-moon .moon{font-size:100px;filter:drop-shadow(0 0 25px rgba(129,109,255,.38));animation:bruteIdle 4s ease-in-out infinite}.brute-sleep-time{font-size:40px;font-weight:1000;font-variant-numeric:tabular-nums}.brute-sound-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
    '@keyframes bruteIdle{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.01)}}@keyframes bruteAttackLeft{0%,100%{transform:translateX(0)}50%{transform:translateX(42%) rotate(3deg)}}@keyframes bruteAttackRight{0%,100%{transform:scaleX(-1) translateX(0)}50%{transform:scaleX(-1) translateX(42%) rotate(3deg)}}@keyframes bruteHit{0%,100%{filter:none}30%{filter:brightness(1.8);transform:translateX(-9px)}60%{transform:translateX(7px)}}@keyframes bruteDodgeLeft{50%{transform:translateX(-30px)}}@keyframes bruteDodgeRight{50%{transform:scaleX(-1) translateX(-30px)}}@keyframes bruteFloat{0%{opacity:0;transform:translateY(12px) scale(.7)}35%{opacity:1;transform:translateY(-10px) scale(1.12)}100%{opacity:0;transform:translateY(-40px)}}',
    '@media(max-width:760px){.brute-app{padding:9px}.brute-menu-grid{grid-template-columns:1fr;padding:14px;min-height:0}.brute-menu-avatar{order:-1}.brute-menu-side{grid-template-columns:1fr 1fr}.brute-title-screen{min-height:0}.brute-logo{font-size:32px}.brute-create,.brute-dashboard,.brute-equipment,.brute-sleep{grid-template-columns:1fr}.brute-create-preview{min-height:350px}.brute-create-preview .ga-brute-svg{width:280px}.brute-create-controls{max-height:none}.brute-stat-grid{grid-template-columns:1fr 1fr}.brute-arena{min-height:440px}.brute-fighters{padding:0 0%;bottom:43px}.brute-fighter .ga-brute-svg{width:220px}.brute-hud{inset:8px 7px auto;grid-template-columns:1fr 39px 1fr;gap:5px}.brute-round{height:34px}.brute-choice-grid{grid-template-columns:1fr}.brute-rank-row{grid-template-columns:30px 1fr auto}.brute-rank-row .extra{display:none}}',
  ].join('')
  document.head.appendChild(style)
}

function makeAmbient() {
  let ctx = null
  let nodes = []

  function stop() {
    nodes.forEach(node => {
      try { node.stop?.() } catch {}
      try { node.disconnect?.() } catch {}
    })
    nodes = []
    if (ctx) {
      try { ctx.close() } catch {}
    }
    ctx = null
  }

  async function play(mode) {
    stop()
    if (mode === 'none') return

    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return

    ctx = new AC()
    await ctx.resume()

    if (mode === 'rain' || mode === 'brown') {
      const length = ctx.sampleRate * 3
      const buffer = ctx.createBuffer(1,length,ctx.sampleRate)
      const data = buffer.getChannelData(0)
      let last = 0

      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1
        if (mode === 'brown') {
          last = (last + .02 * white) / 1.02
          data[i] = last * 3
        } else {
          data[i] = white * .5
        }
      }

      const src = ctx.createBufferSource()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      src.buffer = buffer
      src.loop = true
      filter.type = mode === 'brown' ? 'lowpass' : 'bandpass'
      filter.frequency.value = mode === 'brown' ? 1100 : 2400
      gain.gain.value = mode === 'brown' ? .07 : .045
      src.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      src.start()
      nodes.push(src,filter,gain)
      return
    }

    const gain = ctx.createGain()
    gain.gain.value = .025
    gain.connect(ctx.destination)
    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    a.frequency.value = 110
    b.frequency.value = 164.81
    a.connect(gain)
    b.connect(gain)
    a.start()
    b.start()
    nodes.push(a,b,gain)
  }

  return { play, stop }
}

export async function mountBruteGame(root, options = {}) {
  ensureStyles()

  const athletes = Array.isArray(options.athletes) ? options.athletes : []
  let selectedSlug = String(options.initialSlug || '')
  let brute = null
  let draft = clone(DEFAULT_APPEARANCE)
  let draftName = ''
  let screen = 'selector'
  let roster = []
  let history = []
  let daily = { used:0, limit:6, remaining:6 }
  let levelChoices = []
  let busy = false
  let notice = ''
  let playbackSpeed = 1
  let playbackToken = 0
  let currentTimeline = null
  let currentFightMeta = null
  let sleepSnapshot = null
  let sleepMode = 'rain'
  let sleepTimer = null
  let music = null
  const ambient = makeAmbient()

  function selectedAthlete() {
    return athletes.find(a => athleteSlug(a) === selectedSlug)
  }

  function theme() {
    const base = getBruteTheme(selectedSlug)
    const athlete = selectedAthlete()
    return {
      ...base,
      emoji: athlete?.emoji || base.emoji,
    }
  }

  function canEdit() {
    return Boolean(options.canEditAthlete?.(selectedSlug))
  }

  function stopMusic() {
    if (!music) return
    try {
      music.pause()
      music.currentTime = 0
    } catch {}
    music = null
  }

  function syncMusic() {
    if (screen === 'sleep' || screen === 'fight') {
      stopMusic()
      return
    }

    const src =
      screen === 'pve'
        ? '/mobs-epiques.mp3'
        : screen === 'duel'
          ? '/combat-normal.mp3'
          : screen === 'equipment'
            ? '/casino.mp3'
            : '/main-menu.mp3'

    if (music?.dataset?.src === src) return

    stopMusic()
    try {
      const audio = new Audio(src)
      audio.loop = true
      audio.volume = .16
      audio.dataset.src = src
      music = audio
      void audio.play().catch(() => {
        if (music === audio) {
          music = null
        }
      })
    } catch {
      music = null
    }
  }

  function cleanup() {
    playbackToken += 1
    stopMusic()
    ambient.stop()
    if (sleepTimer) clearInterval(sleepTimer)
    sleepTimer = null
    root.onclick = null
    root.oninput = null
  }

  function xpNeeded() {
    return 80 + Math.max(1,num(brute?.level,1)) * 25
  }

  async function refreshData(renderAfter = true) {
    if (!selectedSlug) return

    const [
      bruteResult,
      rosterResult,
      historyResult,
      dailyResult,
      choicesResult,
    ] = await Promise.all([
      supabase.rpc('brute_get_or_create_v1',{
        p_athlete_slug:selectedSlug,
      }),
      supabase.from('brutes').select('*').order('rating',{ascending:false}).order('level',{ascending:false}),
      supabase.from('brute_fights').select('*').or('attacker_slug.eq.'+selectedSlug+',defender_slug.eq.'+selectedSlug).order('created_at',{ascending:false}).limit(20),
      supabase.rpc('brute_daily_status_v1',{
        p_athlete_slug:selectedSlug,
      }),
      supabase.rpc('brute_level_choices_v1',{
        p_athlete_slug:selectedSlug,
      }),
    ])

    if (bruteResult.error) {
      notice = bruteResult.error.message
      if (renderAfter) render()
      return
    }

    brute = bruteResult.data
    if (Array.isArray(brute)) brute = brute[0]

    roster = rosterResult.error ? [] : (rosterResult.data || [])
    history = historyResult.error ? [] : (historyResult.data || [])
    daily = dailyResult.error ? daily : (dailyResult.data || daily)
    levelChoices = choicesResult.error ? [] : (choicesResult.data || [])

    if (!brute.appearance_locked_at) {
      draft = Object.keys(brute.appearance || {}).length
        ? clone(brute.appearance)
        : clone(DEFAULT_APPEARANCE)
      draftName = brute.name || selectedAthlete()?.name || selectedSlug
      screen = 'creator'
    } else if (screen === 'selector' || screen === 'creator') {
      screen = 'menu'
    }

    if (renderAfter) render()
  }

  async function loadSleep() {
    const result = await supabase.rpc('idle_get_snapshot_v1',{
      p_athlete_slug:selectedSlug,
    })

    if (!result.error) {
      sleepSnapshot = Array.isArray(result.data)
        ? result.data[0]
        : result.data
    }
  }

  function topBar(title, subtitle) {
    return '<header class="brute-top">'+
      '<button class="brute-back" data-brute-menu>← Menu</button>'+
      '<div><small>'+esc(subtitle || 'GA BRUTE')+'</small><h1>'+esc(title)+'</h1></div>'+
      '<div class="spacer"></div>'+
      (options.allowAthleteSelection ? '<button class="brute-mini" data-brute-switch>Changer</button>' : '')+
    '</header>'
  }

  function renderSelector() {
    return '<div class="brute-panel brute-pad">'+
      '<div><small style="color:#858ca8;font-weight:900">GA BRUTE</small><h2>Choisir un athlète</h2></div>'+
      '<div class="brute-list">'+
        athletes.map(a =>
          '<button class="brute-row brute-secondary" data-brute-select="'+esc(athleteSlug(a))+'">'+
            '<span class="icon">'+esc(a.emoji || '🏋️')+'</span>'+
            '<span><b>'+esc(a.name || a.id)+'</b><small>Ouvrir sa brute</small></span>'+
            '<span>›</span>'+
          '</button>'
        ).join('')+
      '</div>'+
    '</div>'
  }

  function partName(list,index) {
    const item = list[Math.max(0,Math.min(list.length-1,num(index)))]
    return typeof item === 'string' ? item : (item?.name || '')
  }

  function control(key,label,valueName) {
    return '<div class="brute-control">'+
      '<div><label>'+esc(label)+'</label><strong>'+esc(valueName)+'</strong></div>'+
      '<div class="brute-arrows">'+
        '<button data-brute-prev="'+esc(key)+'">◀</button>'+
        '<button data-brute-next="'+esc(key)+'">▶</button>'+
      '</div>'+
    '</div>'
  }

  function colorSwatches(key,list,current) {
    return '<div class="brute-control"><div style="grid-column:1/-1"><label>'+esc(key === 'primary' ? 'Couleur primaire' : key === 'secondary' ? 'Couleur secondaire' : key === 'skin' ? 'Peau' : 'Couleur cheveux')+'</label>'+
      '<div class="brute-swatches">'+list.map((c,i) =>
        '<button class="brute-swatch '+(String(current) === String(i) || String(current) === c ? 'active' : '')+'" style="background:'+esc(c)+'" data-brute-color-key="'+esc(key)+'" data-brute-color-index="'+i+'" aria-label="'+esc(c)+'"></button>'
      ).join('')+'</div></div></div>'
  }

  function renderCreator() {
    return '<div class="brute-create">'+
      '<section class="brute-panel brute-create-preview">'+
        renderBruteSvg(draft,{label:draftName || 'Ma brute'})+
        '<div class="brute-nameplate">'+esc(draftName || 'Ma brute')+'</div>'+
      '</section>'+
      '<section class="brute-panel brute-create-controls">'+
        '<small style="color:var(--accent);font-weight:1000">PREMIÈRE CONNEXION</small>'+
        '<h2>Crée ta brute</h2>'+
        '<p>Tout le personnage est dessiné en SVG original. Une fois validée, ton apparence est figée. Seul le coach pourra la réinitialiser.</p>'+
        '<input class="brute-name-input" maxlength="28" data-brute-name value="'+esc(draftName)+'" placeholder="Nom de la brute">'+
        control('body','Corps',partName(BRUTE_PARTS.bodies,draft.body))+
        colorSwatches('skin',BRUTE_PARTS.skins,draft.skin)+
        control('hair','Coupe de cheveux',partName(BRUTE_PARTS.hairs,draft.hair))+
        colorSwatches('hairColor',BRUTE_PARTS.hairColors,draft.hairColor)+
        control('beard','Pilosité',partName(BRUTE_PARTS.beards,draft.beard))+
        control('eyes','Yeux / sourcils',partName(BRUTE_PARTS.eyes,draft.eyes))+
        control('mouth','Bouche',partName(BRUTE_PARTS.mouths,draft.mouth))+
        control('top','Haut',partName(BRUTE_PARTS.tops,draft.top))+
        control('bottom','Bas',partName(BRUTE_PARTS.bottoms,draft.bottom))+
        colorSwatches('primary',['#7c3aed','#2563eb','#dc2626','#059669','#d97706','#e11d48','#f8fafc','#111827'],draft.colors?.[0])+
        colorSwatches('secondary',['#111827','#1f2937','#3f3f46','#0f172a','#27272a','#f8fafc','#f59e0b','#06b6d4'],draft.colors?.[1])+
        control('acc','Accessoire',partName(BRUTE_PARTS.accessories,draft.acc))+
        '<div class="brute-actions">'+
          '<button class="brute-secondary" data-brute-random>🎲 Aléatoire</button>'+
          '<button class="brute-primary" data-brute-create '+(busy ? 'disabled' : '')+'>Valider ma brute</button>'+
        '</div>'+
      '</section>'+
    '</div>'
  }

  function renderMenu() {
    const t = theme()
    const weaponId = brute.loadout?.weapon || 'fists'
    const weapon = BRUTE_WEAPONS[weaponId] || BRUTE_WEAPONS.fists
    const pet = BRUTE_PETS[(brute.pets || [])[0]]

    return '<section class="brute-title-screen">'+
      '<div class="brute-logo">GA BRUTE</div>'+
      '<div class="brute-title-sub">POWERLIFTING ARENA</div>'+
      '<div class="brute-menu-grid">'+
        '<div class="brute-menu-side">'+
          '<button class="brute-wood" data-brute-screen="camp">⛺ CAMP<small>Stats · niveau · historique</small></button>'+
          '<button class="brute-wood" data-brute-screen="pve">⚔️ PVE<small>Combat d’entraînement</small></button>'+
          '<button class="brute-wood" data-brute-screen="ranking">🏆 CLASSEMENT<small>Toutes les brutes</small></button>'+
        '</div>'+
        '<div class="brute-menu-avatar">'+
          renderBruteSvg(brute.appearance,{label:brute.name,weapon,pet})+
          '<div class="brute-nameplate">'+esc(t.emoji)+' '+esc(brute.name)+'</div>'+
          '<div class="brute-menu-stats">'+
            '<div class="brute-menu-stat"><b>'+num(brute.level,1)+'</b><span>Niveau</span></div>'+
            '<div class="brute-menu-stat"><b>'+num(brute.rating,1000)+'</b><span>Cote</span></div>'+
            '<div class="brute-menu-stat"><b>'+num(daily.remaining,6)+'/6</b><span>Duels</span></div>'+
          '</div>'+
        '</div>'+
        '<div class="brute-menu-side">'+
          '<button class="brute-wood" data-brute-screen="duel">🥊 DUEL<small>6 combats par jour</small></button>'+
          '<button class="brute-wood" data-brute-screen="equipment">🎒 ÉQUIPEMENT / SKIN<small>Armes · skills · familiers</small></button>'+
          '<button class="brute-wood" data-brute-screen="sleep">🌙 SOMMEIL<small>Timer · récupération</small></button>'+
        '</div>'+
      '</div>'+
      '<div style="position:absolute;right:12px;bottom:10px;z-index:6">'+
        '<button class="brute-mini" data-brute-exit>← Jeu</button>'+
      '</div>'+
    '</section>'
  }

  function statCard(label,value,icon) {
    return '<div class="brute-stat-card"><span>'+esc(icon+' '+label)+'</span><b>'+num(value)+'</b></div>'
  }

  function renderChoices() {
    if (!Array.isArray(levelChoices) || !levelChoices.length) return ''

    return '<div style="margin-top:15px">'+
      '<small style="color:var(--accent);font-weight:1000">LEVEL UP · CHOISIS 1 BONUS</small>'+
      '<div class="brute-choice-grid" style="margin-top:8px">'+
        levelChoices.slice(0,2).map((choice,index) =>
          '<button class="brute-choice" data-brute-choice="'+index+'">'+
            '<span class="big">'+esc(choice.icon || '⭐')+'</span>'+
            '<b>'+esc(choice.name || 'Bonus')+'</b>'+
            '<small>'+esc(choice.type || '')+'</small>'+
          '</button>'
        ).join('')+
      '</div>'+
    '</div>'
  }

  function renderCamp() {
    const pct = Math.min(100,Math.round(num(brute.xp) / Math.max(1,xpNeeded()) * 100))
    const recent = history.slice(0,6)

    return topBar('Camp','Progression')+
      '<div class="brute-dashboard">'+
        '<section class="brute-panel brute-pad">'+
          '<div class="brute-stat-grid">'+
            statCard('PV',brute.hp,'❤️')+
            statCard('Force',brute.strength,'💪')+
            statCard('Agilité',brute.agility,'🤸')+
            statCard('Vitesse',brute.speed,'⚡')+
          '</div>'+
          '<div class="brute-xp"><div style="display:flex;justify-content:space-between;font-size:9px;color:#858ca8;margin-bottom:5px"><span>XP niveau '+num(brute.level,1)+'</span><span>'+num(brute.xp)+' / '+xpNeeded()+'</span></div><div class="brute-track"><i style="width:'+pct+'%"></i></div></div>'+
          renderChoices()+
          '<div class="brute-actions"><button class="brute-secondary" data-brute-screen="equipment">🎒 Équipement</button><button class="brute-secondary" data-brute-screen="duel">🥊 Duel</button></div>'+
        '</section>'+
        '<aside class="brute-panel brute-pad"><small style="color:#858ca8;font-weight:900">20 DERNIERS COMBATS</small><div class="brute-list" style="margin-top:8px">'+
          (recent.length ? recent.map(f => {
            const opp = f.attacker_slug === selectedSlug ? f.defender_slug : f.attacker_slug
            const win = f.winner_slug === selectedSlug
            return '<div class="brute-row"><span class="icon">'+(win?'🏆':'💀')+'</span><span><b>'+esc(opp)+'</b><small>'+new Date(f.created_at).toLocaleString('fr-FR')+' · +'+num(f.xp_gained)+' XP</small></span><button class="brute-mini" data-brute-replay="'+esc(f.id)+'">Replay</button></div>'
          }).join('') : '<div style="color:#737b96;font-size:10px">Aucun combat.</div>')+
        '</div></aside>'+
      '</div>'
  }

  function renderDuel() {
    const opponents = roster
      .filter(row => row.athlete_slug !== selectedSlug && row.appearance_locked_at)
      .sort((a,b) => Math.abs(a.level-brute.level)-Math.abs(b.level-brute.level))
      .slice(0,12)

    return topBar('Duel','Arène PvP')+
      '<section class="brute-panel brute-pad">'+
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><small style="color:#858ca8;font-weight:900">COMBATS DU JOUR</small><h2 style="margin:3px 0">'+num(daily.remaining,6)+' / 6 restants</h2></div><button class="brute-primary" data-brute-random-duel '+(num(daily.remaining)<=0?'disabled':'')+'>⚔️ Adversaire aléatoire</button></div>'+
        '<div class="brute-list" style="margin-top:12px">'+
          (opponents.length ? opponents.map(o =>
            '<div class="brute-row"><span class="icon">'+esc(getBruteTheme(o.athlete_slug).emoji)+'</span><span><b>'+esc(o.name)+'</b><small>Niv. '+num(o.level)+' · Cote '+num(o.rating)+' · '+num(o.wins)+'V/'+num(o.losses)+'D</small></span><button class="brute-secondary" data-brute-duel="'+esc(o.athlete_slug)+'" '+(num(daily.remaining)<=0?'disabled':'')+'>Combattre</button></div>'
          ).join('') : '<div style="color:#7f859e">Aucune autre brute validée pour le moment.</div>')+
        '</div>'+
      '</section>'
  }

  function pveOpponent(seed) {
    const random = createSeededRandom(seed)
    const level = Math.max(1,brute.level + Math.floor(random()*5)-2)
    return {
      slug:'rack-beast-'+seed,
      name:['Le Spotter Sauvage','Le Rack Possédé','Le Démon du Deload','La Barre Maudite'][Math.floor(random()*4)],
      level,
      hp:90+level*5+Math.floor(random()*20),
      strength:9+Math.floor(level*.75)+Math.floor(random()*4),
      agility:9+Math.floor(level*.65)+Math.floor(random()*4),
      speed:9+Math.floor(level*.7)+Math.floor(random()*4),
      weapons:['fists','kettlebell','plate20'].slice(0,1+Math.floor(random()*3)),
      skills:random()>.62?['lockout']:[],
      pets:[],
      appearance:randomAppearance(random),
      loadout:{weapon:random()>.55?'kettlebell':'fists'},
    }
  }

  function renderPve() {
    return topBar('PvE','Entraînement')+
      '<section class="brute-panel brute-pad" style="text-align:center">'+
        '<div style="font-size:54px">👹</div><h2>Combat d’entraînement</h2>'+
        '<p style="max-width:560px;margin:0 auto;color:#858ca8;font-size:10px;line-height:1.6">Même moteur déterministe que le Duel, mais sans consommer tes 6 combats et sans modifier ton classement. Parfait pour tester ton build.</p>'+
        '<div class="brute-actions" style="justify-content:center"><button class="brute-primary" data-brute-pve>⚔️ Lancer le combat</button></div>'+
      '</section>'
  }

  function renderEquipment() {
    const equipped = brute.loadout?.weapon || 'fists'
    return topBar('Équipement / Skin','Build')+
      '<div class="brute-equipment">'+
        '<section class="brute-panel brute-equipment-preview">'+renderBruteSvg(brute.appearance,{label:brute.name,weapon:BRUTE_WEAPONS[equipped],pet:BRUTE_PETS[(brute.pets||[])[0]]})+'</section>'+
        '<section class="brute-panel brute-pad">'+
          '<small style="color:var(--accent);font-weight:1000">APPARENCE VERROUILLÉE</small><h2 style="margin:5px 0 8px">'+esc(brute.name)+'</h2>'+
          '<p style="color:#858ca8;font-size:10px">Ton corps, visage et vêtements de création sont figés. Les armes, compétences et familiers se débloquent aux montées de niveau.</p>'+
          '<h3>Armes</h3><div class="brute-chip-row">'+(brute.weapons||[]).map(id => {
            const w=BRUTE_WEAPONS[id]||{name:id,icon:'⚔️'}
            return '<button class="brute-chip '+(equipped===id?'active':'')+'" data-brute-equip="'+esc(id)+'">'+esc(w.icon+' '+w.name)+'</button>'
          }).join('')+'</div>'+
          '<h3>Compétences</h3><div class="brute-chip-row">'+((brute.skills||[]).length?(brute.skills||[]).map(id => {
            const s=BRUTE_SKILLS[id]||{name:id,icon:'✨'}
            return '<span class="brute-chip">'+esc(s.icon+' '+s.name)+'</span>'
          }).join(''):'<span style="color:#747c98;font-size:9px">Aucune pour le moment.</span>')+'</div>'+
          '<h3>Familiers</h3><div class="brute-chip-row">'+((brute.pets||[]).length?(brute.pets||[]).map(id => {
            const p=BRUTE_PETS[id]||{name:id,emoji:'🐾'}
            return '<span class="brute-chip">'+esc(p.emoji+' '+p.name)+'</span>'
          }).join(''):'<span style="color:#747c98;font-size:9px">0 / 3</span>')+'</div>'+
          (options.isCoach ? '<div class="brute-actions"><button class="brute-secondary" data-brute-reset>♻️ Réinitialiser la création</button></div>' : '')+
        '</section>'+
      '</div>'
  }

  function renderRanking() {
    return topBar('Classement','Toutes les brutes')+
      '<section class="brute-panel brute-pad"><div class="brute-ranking">'+
        roster.slice(0,100).map((row,index) =>
          '<div class="brute-rank-row"><span class="rank">#'+(index+1)+'</span><span><b>'+esc(getBruteTheme(row.athlete_slug).emoji+' '+row.name)+'</b><small>Niv. '+num(row.level)+' · '+num(row.wins)+'V / '+num(row.losses)+'D</small></span><b>'+num(row.rating)+'</b><span class="extra">💪 '+num(row.strength)+'</span><span class="extra">⚡ '+num(row.speed)+'</span></div>'
        ).join('')+
      '</div></section>'
  }

  function renderSleep() {
    const active = sleepSnapshot?.active_sleep_started_at
    const baseSeconds = num(sleepSnapshot?.sleep_seconds)
    return topBar('Sommeil','Récupération')+
      '<div class="brute-sleep">'+
        '<section class="brute-panel brute-moon"><div class="moon">☾</div><div class="brute-sleep-time" data-brute-sleep-time>'+sleepLabel(active ? Math.max(0,(Date.now()-new Date(active).getTime())/1000) : baseSeconds)+'</div><small style="color:#858ca8">'+(active?'Sommeil en cours':'Sommeil enregistré aujourd’hui')+'</small><button class="brute-primary" style="margin-top:18px" data-brute-sleep-toggle>'+(active?'☀️ Je me réveille':'🌙 Démarrer mon sommeil')+'</button></section>'+
        '<aside class="brute-panel brute-pad"><h3>Ambiance</h3><p style="color:#858ca8;font-size:10px;line-height:1.6">Le chrono est côté serveur : fermer l’app n’efface pas ton temps.</p><div class="brute-sound-grid">'+
          [['rain','🌧️ Pluie'],['brown','🟤 Bruit brun'],['temple','🕯️ Temple'],['none','🔇 Silence']].map(([key,label]) => '<button class="brute-secondary '+(sleepMode===key?'active':'')+'" data-brute-sound="'+key+'">'+label+'</button>').join('')+
        '</div></aside>'+
      '</div>'
  }

  function renderFight() {
    const tl = currentTimeline
    if (!tl) return ''

    const left = tl.left
    const right = tl.right
    const leftWeapon = BRUTE_WEAPONS[left.loadout?.weapon] || BRUTE_WEAPONS[(left.weapons||[])[0]] || BRUTE_WEAPONS.fists
    const rightWeapon = BRUTE_WEAPONS[right.loadout?.weapon] || BRUTE_WEAPONS[(right.weapons||[])[0]] || BRUTE_WEAPONS.fists
    const leftPet = BRUTE_PETS[(left.pets||[])[0]]
    const rightPet = BRUTE_PETS[(right.pets||[])[0]]

    return '<div class="brute-arena" data-brute-arena>'+
      '<div class="brute-hud">'+
        '<div class="brute-hud-side"><div class="brute-hud-name">'+esc(left.name)+'</div><div class="brute-hp"><i data-hp-left style="width:100%"></i></div></div>'+
        '<div class="brute-round" data-brute-round>GO</div>'+
        '<div class="brute-hud-side right"><div class="brute-hud-name">'+esc(right.name)+'</div><div class="brute-hp"><i data-hp-right style="width:100%"></i></div></div>'+
      '</div>'+
      '<div class="brute-fighters">'+
        '<div class="brute-fighter left" data-fighter="left">'+renderBruteSvg(left.appearance,{label:left.name,weapon:leftWeapon})+(leftPet?'<div class="brute-pet-slot">'+renderPetSvg(leftPet)+'</div>':'')+'</div>'+
        '<div class="brute-fighter right" data-fighter="right">'+renderBruteSvg(right.appearance,{label:right.name,weapon:rightWeapon})+(rightPet?'<div class="brute-pet-slot">'+renderPetSvg(rightPet,'left')+'</div>':'')+'</div>'+
      '</div>'+
      '<div class="brute-log" data-brute-log>Combat déterministe · '+esc(replayFingerprint(tl))+'</div>'+
    '</div>'+
    '<div class="brute-controls">'+
      '<button class="brute-secondary '+(playbackSpeed===1?'active':'')+'" data-brute-speed="1">x1</button>'+
      '<button class="brute-secondary '+(playbackSpeed===2?'active':'')+'" data-brute-speed="2">x2</button>'+
      '<button class="brute-secondary" data-brute-skip>Passer</button>'+
    '</div>'+
    '<div data-brute-fight-result></div>'
  }

  function render() {
    const t = theme()
    const content =
      !selectedSlug
        ? renderSelector()
        : screen === 'creator'
          ? renderCreator()
          : screen === 'menu'
            ? renderMenu()
            : screen === 'camp'
              ? renderCamp()
              : screen === 'duel'
                ? renderDuel()
                : screen === 'pve'
                  ? renderPve()
                  : screen === 'equipment'
                    ? renderEquipment()
                    : screen === 'ranking'
                      ? renderRanking()
                      : screen === 'sleep'
                        ? renderSleep()
                        : screen === 'fight'
                          ? renderFight()
                          : renderMenu()

    root.innerHTML = '<main class="brute-app" style="--accent:'+esc(t.accent)+'"><div class="brute-shell">'+
      (notice ? '<div style="margin-bottom:9px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--accent),transparent 58%);border-radius:12px;background:color-mix(in srgb,var(--accent),transparent 91%);font-size:10px">'+esc(notice)+'</div>' : '')+
      content+
    '</div></main>'

    syncMusic()
    scheduleSleepTicker()
  }

  function scheduleSleepTicker() {
    if (sleepTimer) clearInterval(sleepTimer)
    sleepTimer = null
    if (screen !== 'sleep' || !sleepSnapshot?.active_sleep_started_at) return

    sleepTimer = setInterval(() => {
      const el = root.querySelector('[data-brute-sleep-time]')
      if (!el) return
      el.textContent = sleepLabel(Math.max(0,(Date.now()-new Date(sleepSnapshot.active_sleep_started_at).getTime())/1000))
    },1000)
  }

  function adjustDraft(key,direction) {
    const maps = {
      body:BRUTE_PARTS.bodies,
      hair:BRUTE_PARTS.hairs,
      beard:BRUTE_PARTS.beards,
      eyes:BRUTE_PARTS.eyes,
      mouth:BRUTE_PARTS.mouths,
      top:BRUTE_PARTS.tops,
      bottom:BRUTE_PARTS.bottoms,
      acc:BRUTE_PARTS.accessories,
    }
    const list = maps[key]
    if (!list) return
    const current = num(draft[key])
    draft[key] = (current + direction + list.length) % list.length
  }

  function setScreen(next) {
    playbackToken += 1
    ambient.stop()
    screen = next
    notice = ''
    render()
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve,ms))
  }

  function clearAnimClasses() {
    root.querySelectorAll('.brute-fighter').forEach(el => {
      el.classList.remove('attacking','hit','dodge','ko')
    })
    root.querySelectorAll('.brute-float').forEach(el => el.remove())
  }

  function eventText(event,tl) {
    const actor = event.actor === 'left' ? tl.left.name : tl.right.name
    const target = event.target === 'left' ? tl.left.name : tl.right.name
    if (event.type === 'DODGE') return target+' esquive !'
    if (event.type === 'MISS') return actor+' rate son attaque.'
    if (event.type === 'COUNTER_READY') return actor+' prépare un contre.'
    if (event.type === 'COMBO') return actor+' enchaîne !'
    if (event.type === 'GRIND') return actor+' GRIND : survit à 1 PV.'
    if (event.type === 'PET_ATTACK') return actor+' reçoit l’aide de son familier.'
    if (event.type === 'STUN_SKIP') return actor+' est stun.'
    if (event.type === 'FINISHER') return actor+' termine le combat !'
    if (event.type === 'KO') return target+' est K.O.'
    if (event.type === 'ATTACK') return actor+' inflige '+num(event.damage)+' à '+target+(event.critical?' · CRITIQUE':'')+(event.lockout?' · LOCKOUT':'')+(event.stun?' · PAUSE BENCH':'')
    return 'Combat en cours…'
  }

  function applyEvent(event,tl) {
    clearAnimClasses()

    const leftEl = root.querySelector('[data-fighter="left"]')
    const rightEl = root.querySelector('[data-fighter="right"]')
    const actorEl = event.actor === 'left' ? leftEl : rightEl
    const targetEl = event.target === 'left' ? leftEl : rightEl

    if (event.type === 'MOVE' || event.type === 'ATTACK' || event.type === 'FINISHER') {
      actorEl?.classList.add('attacking')
    }
    if (event.type === 'ATTACK' || event.type === 'PET_ATTACK' || event.type === 'FINISHER') {
      targetEl?.classList.add('hit')
    }
    if (event.type === 'DODGE') {
      actorEl?.classList.add('dodge')
    }
    if (event.type === 'KO') {
      targetEl?.classList.add('ko')
    }

    if (event.state) {
      const lPct = Math.max(0,Math.min(100,num(event.state.leftHp)/Math.max(1,num(tl.left.hpMax))*100))
      const rPct = Math.max(0,Math.min(100,num(event.state.rightHp)/Math.max(1,num(tl.right.hpMax))*100))
      const lBar = root.querySelector('[data-hp-left]')
      const rBar = root.querySelector('[data-hp-right]')
      if (lBar) lBar.style.width = lPct+'%'
      if (rBar) rBar.style.width = rPct+'%'
    }

    if (num(event.damage) > 0 && targetEl) {
      const floater = document.createElement('span')
      floater.className = 'brute-float'+(event.lockout?' skill':'')
      floater.textContent = '-'+num(event.damage)
      targetEl.appendChild(floater)
    }

    const log = root.querySelector('[data-brute-log]')
    if (log) log.textContent = eventText(event,tl)
    const round = root.querySelector('[data-brute-round]')
    if (round) round.textContent = String(event.i || 1)
  }

  function finishFightPlayback(tl) {
    const result = root.querySelector('[data-brute-fight-result]')
    if (!result) return
    const won = tl.winnerSlug === selectedSlug
    const t = theme()
    result.innerHTML = '<div class="brute-panel brute-pad" style="margin-top:10px;text-align:center"><h2 style="margin:0">'+(won?'🏆 VICTOIRE':'💀 DÉFAITE')+'</h2><p style="color:#969bb1;font-size:10px">'+(won?esc(t.victory):'Tu reviendras plus fort.')+'</p><div class="brute-actions" style="justify-content:center"><button class="brute-primary" data-brute-replay-current>↻ Revoir</button><button class="brute-secondary" data-brute-after-fight>Retour au camp</button></div></div>'
  }

  async function playTimeline(tl) {
    const token = ++playbackToken
    await wait(80)
    for (const event of tl.events) {
      if (token !== playbackToken) return
      applyEvent(event,tl)
      if (event.type === 'END') break
      await wait(Math.max(95,420/playbackSpeed))
    }
    if (token !== playbackToken) return
    finishFightPlayback(tl)
  }

  async function startServerDuel(defenderSlug = null) {
    busy = true
    notice = ''
    render()

    const result = await supabase.rpc('brute_start_fight_v1',{
      p_attacker_slug:selectedSlug,
      p_defender_slug:defenderSlug,
    })

    busy = false

    if (result.error) {
      notice = result.error.message
      screen = 'duel'
      render()
      return
    }

    const data = result.data
    const fight = data.fight
    currentFightMeta = data
    currentTimeline = generateFightTimeline({
      seed:fight.seed,
      attacker:fight.attacker_snapshot,
      defender:fight.defender_snapshot,
      winnerSlug:fight.winner_slug,
    })
    daily = data.daily || daily
    screen = 'fight'
    render()
    void playTimeline(currentTimeline)
  }

  function startPve() {
    const seed = Date.now()
    const opponent = pveOpponent(seed)
    const selfSnapshot = {
      slug:brute.athlete_slug,
      name:brute.name,
      level:brute.level,
      hp:brute.hp,
      strength:brute.strength,
      agility:brute.agility,
      speed:brute.speed,
      weapons:brute.weapons,
      skills:brute.skills,
      pets:brute.pets,
      appearance:brute.appearance,
      loadout:brute.loadout,
    }

    currentFightMeta = { practice:true }
    currentTimeline = generateFightTimeline({
      seed,
      attacker:selfSnapshot,
      defender:opponent,
    })
    screen = 'fight'
    render()
    void playTimeline(currentTimeline)
  }

  async function replayFight(id) {
    const fight = history.find(row => row.id === id)
    if (!fight) return
    currentFightMeta = { replay:true }
    currentTimeline = generateFightTimeline({
      seed:fight.seed,
      attacker:fight.attacker_snapshot,
      defender:fight.defender_snapshot,
      winnerSlug:fight.winner_slug,
    })
    screen = 'fight'
    render()
    void playTimeline(currentTimeline)
  }

  root.onclick = async event => {
    const back = event.target.closest('[data-brute-exit]')
    if (back) {
      cleanup()
      options.onBack?.()
      return
    }

    const select = event.target.closest('[data-brute-select]')
    if (select) {
      selectedSlug = String(select.dataset.bruteSelect || '')
      busy = true
      render()
      await refreshData()
      busy = false
      return
    }

    const switchBtn = event.target.closest('[data-brute-switch]')
    if (switchBtn) {
      selectedSlug = ''
      brute = null
      screen = 'selector'
      render()
      return
    }

    const menuBtn = event.target.closest('[data-brute-menu]')
    if (menuBtn) {
      await refreshData(false)
      setScreen('menu')
      return
    }

    const screenBtn = event.target.closest('[data-brute-screen]')
    if (screenBtn) {
      const next = String(screenBtn.dataset.bruteScreen || 'menu')
      if (next === 'sleep') await loadSleep()
      setScreen(next)
      return
    }

    const prev = event.target.closest('[data-brute-prev]')
    if (prev) {
      adjustDraft(String(prev.dataset.brutePrev || ''),-1)
      render()
      return
    }

    const next = event.target.closest('[data-brute-next]')
    if (next) {
      adjustDraft(String(next.dataset.bruteNext || ''),1)
      render()
      return
    }

    const swatch = event.target.closest('[data-brute-color-key]')
    if (swatch) {
      const key = String(swatch.dataset.bruteColorKey || '')
      const index = num(swatch.dataset.bruteColorIndex)
      if (key === 'skin') draft.skin = index
      else if (key === 'hairColor') draft.hairColor = index
      else if (key === 'primary') draft.colors[0] = ['#7c3aed','#2563eb','#dc2626','#059669','#d97706','#e11d48','#f8fafc','#111827'][index]
      else if (key === 'secondary') draft.colors[1] = ['#111827','#1f2937','#3f3f46','#0f172a','#27272a','#f8fafc','#f59e0b','#06b6d4'][index]
      render()
      return
    }

    if (event.target.closest('[data-brute-random]')) {
      draft = randomAppearance()
      render()
      return
    }

    if (event.target.closest('[data-brute-create]')) {
      busy = true
      render()
      const result = await supabase.rpc('brute_save_creation_v1',{
        p_athlete_slug:selectedSlug,
        p_name:draftName,
        p_appearance:draft,
      })
      busy = false
      if (result.error) {
        notice = result.error.message
        render()
        return
      }
      brute = Array.isArray(result.data) ? result.data[0] : result.data
      await refreshData(false)
      screen = 'menu'
      notice = 'Brute créée.'
      render()
      return
    }

    const choice = event.target.closest('[data-brute-choice]')
    if (choice) {
      const index = num(choice.dataset.bruteChoice)
      const result = await supabase.rpc('brute_choose_reward_v1',{
        p_athlete_slug:selectedSlug,
        p_choice:index,
      })
      if (result.error) {
        notice = result.error.message
      } else {
        notice = 'Bonus appliqué.'
        await refreshData(false)
      }
      render()
      return
    }

    const equip = event.target.closest('[data-brute-equip]')
    if (equip) {
      const result = await supabase.rpc('brute_update_loadout_v1',{
        p_athlete_slug:selectedSlug,
        p_weapon:String(equip.dataset.bruteEquip || ''),
      })
      if (result.error) notice = result.error.message
      else {
        brute = Array.isArray(result.data) ? result.data[0] : result.data
        notice = 'Arme équipée.'
      }
      render()
      return
    }

    if (event.target.closest('[data-brute-reset]')) {
      const result = await supabase.rpc('brute_reset_appearance_v1',{
        p_athlete_slug:selectedSlug,
      })
      if (result.error) notice = result.error.message
      else {
        brute = Array.isArray(result.data) ? result.data[0] : result.data
        draft = clone(DEFAULT_APPEARANCE)
        draftName = brute.name
        screen = 'creator'
      }
      render()
      return
    }

    const duel = event.target.closest('[data-brute-duel]')
    if (duel) {
      await startServerDuel(String(duel.dataset.bruteDuel || ''))
      return
    }

    if (event.target.closest('[data-brute-random-duel]')) {
      await startServerDuel(null)
      return
    }

    if (event.target.closest('[data-brute-pve]')) {
      startPve()
      return
    }

    const replay = event.target.closest('[data-brute-replay]')
    if (replay) {
      await replayFight(String(replay.dataset.bruteReplay || ''))
      return
    }

    const speedBtn = event.target.closest('[data-brute-speed]')
    if (speedBtn) {
      playbackSpeed = num(speedBtn.dataset.bruteSpeed,1)
      root.querySelectorAll('[data-brute-speed]').forEach(button => {
        button.classList.toggle(
          'active',
          num(button.dataset.bruteSpeed,1) === playbackSpeed
        )
      })
      return
    }

    if (event.target.closest('[data-brute-skip]')) {
      playbackToken += 1
      const finalEvent = currentTimeline?.events?.[currentTimeline.events.length-2]
      if (finalEvent) applyEvent(finalEvent,currentTimeline)
      finishFightPlayback(currentTimeline)
      return
    }

    if (event.target.closest('[data-brute-replay-current]')) {
      if (!currentTimeline) return
      render()
      void playTimeline(currentTimeline)
      return
    }

    if (event.target.closest('[data-brute-after-fight]')) {
      await refreshData(false)
      screen = 'camp'
      render()
      return
    }

    const sound = event.target.closest('[data-brute-sound]')
    if (sound) {
      sleepMode = String(sound.dataset.bruteSound || 'none')
      try { await ambient.play(sleepMode) } catch {}
      render()
      return
    }

    if (event.target.closest('[data-brute-sleep-toggle]')) {
      const active = sleepSnapshot?.active_sleep_started_at
      const result = active
        ? await supabase.rpc('idle_sleep_stop_v1',{p_athlete_slug:selectedSlug})
        : await supabase.rpc('idle_sleep_start_v1',{p_athlete_slug:selectedSlug,p_sound_mode:sleepMode})

      if (result.error) {
        notice = result.error.message
      } else {
        if (active) ambient.stop()
        else {
          try { await ambient.play(sleepMode) } catch {}
        }
        await loadSleep()
      }
      render()
    }
  }

  root.oninput = event => {
    const input = event.target.closest('[data-brute-name]')
    if (input) {
      draftName = String(input.value || '').slice(0,28)
      const plate = root.querySelector('.brute-nameplate')
      if (plate) plate.textContent = draftName || 'Ma brute'
    }
  }

  if (!selectedSlug) {
    screen = 'selector'
    render()
    return
  }

  await refreshData(false)
  render()
}
