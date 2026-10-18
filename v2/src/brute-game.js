
import { supabase } from './supabase.js'
import {
  BRUTE_PARTS,
  BRUTE_PALETTES,
  BRUTE_APPEARANCE_VERSION,
  BRUTE_WEAPONS,
  BRUTE_SKILLS,
  BRUTE_PETS,
  OPENPOWERLIFTING_FFFORCE_RIVALS,
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
    '.brute-create{display:grid;grid-template-columns:minmax(270px,.85fr) minmax(0,1.15fr);gap:14px}.brute-create-stage{position:relative;min-height:650px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border:2px solid #65401f;border-radius:20px;background:radial-gradient(circle at 50% 22%,rgba(255,247,191,.84),transparent 25%),linear-gradient(180deg,#88c7d7 0 27%,#d9c47d 27% 34%,#b97a3c 34% 100%);box-shadow:0 22px 60px rgba(0,0,0,.28)}.brute-create-stage:after{content:"CHARACTER";position:absolute;left:50%;top:63%;transform:translate(-50%,-50%) rotate(-8deg);font-size:62px;font-weight:1000;letter-spacing:.08em;color:rgba(89,44,18,.06)}.brute-create-stage .ga-brute-svg{position:relative;z-index:2;width:min(390px,92%);filter:drop-shadow(0 18px 14px rgba(73,40,18,.25));animation:bruteIdle 2.7s ease-in-out infinite}.brute-create-sign{position:relative;z-index:3;margin-bottom:-6px;padding:7px 18px;border:4px solid #6d391c;border-radius:8px;background:linear-gradient(180deg,#e8b85c,#bd6f2c);box-shadow:inset 0 0 0 3px #f5d78b,0 6px 0 #542813;color:#552817;font-size:18px;font-weight:1000;text-shadow:1px 1px 0 #f8dc91}.brute-creator-random{position:relative;z-index:3;width:min(280px,82%);margin-top:10px}.brute-creator-section{margin-top:10px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025);overflow:hidden}.brute-creator-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border-bottom:1px solid rgba(255,255,255,.06);background:linear-gradient(90deg,color-mix(in srgb,var(--accent),transparent 84%),transparent);font-size:9px;font-weight:1000;letter-spacing:.09em;color:#d9dcef;text-transform:uppercase}.brute-section-random{width:28px;height:24px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.05);color:#fff;cursor:pointer;font-size:12px;line-height:1}.brute-section-random:hover{background:color-mix(in srgb,var(--accent),transparent 82%)}.brute-creator-section-body{padding:0 11px 5px}.brute-create-help{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0 12px}.brute-create-help span{padding:4px 7px;border:1px solid rgba(255,255,255,.07);border-radius:999px;background:rgba(255,255,255,.03);font-size:7px;color:#858ca8;font-weight:900;text-transform:uppercase}.brute-creator-counter{font-size:7px;color:#676e88;font-weight:800}.brute-create-preview{min-height:620px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--accent),transparent 73%),transparent 34%),#0b0f21}.brute-create-preview .ga-brute-svg{width:min(390px,100%);animation:bruteIdle 2.7s ease-in-out infinite}.brute-create-controls{padding:16px;max-height:76vh;overflow:auto}.brute-create-controls h2{margin:4px 0 8px}.brute-create-controls p{color:#858ba5;font-size:10px;line-height:1.6}',
    '.brute-name-input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#080b17;color:white;padding:12px;margin:8px 0 12px;font-weight:900}',
    '.brute-control{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.055)}.brute-control label{font-size:9px;color:#858ca8;text-transform:uppercase;font-weight:900;letter-spacing:.08em}.brute-control strong{display:block;margin-top:3px;font-size:12px;color:#fff}.brute-arrows{display:flex;gap:5px}.brute-arrows button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04);color:white;font-weight:1000;cursor:pointer}',
    '.brute-swatches{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.brute-swatch{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.22);cursor:pointer}.brute-swatch.active{outline:3px solid var(--accent);outline-offset:2px}',
    '.brute-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.brute-primary,.brute-secondary{border:0;border-radius:13px;padding:12px 15px;font-weight:1000;cursor:pointer}.brute-primary{background:linear-gradient(135deg,var(--accent),#47c7f7);color:white}.brute-secondary{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#e7e8f0}.brute-primary:disabled,.brute-secondary:disabled{opacity:.38;cursor:not-allowed}',
    '.brute-dashboard{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:12px}.brute-camp-scene{position:relative;overflow:hidden;border:2px solid #65401f;border-radius:24px;background:radial-gradient(circle at 50% 13%,rgba(255,246,188,.75),transparent 25%),linear-gradient(180deg,#8fc9d7 0 21%,#dec786 21% 28%,#bd7d3d 28% 100%);box-shadow:0 26px 70px rgba(0,0,0,.34);padding:18px}.brute-camp-scene:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(79,64,46,.20) 0 4%,transparent 4% 96%,rgba(79,64,46,.20) 96%),linear-gradient(180deg,transparent 0 69%,rgba(91,50,22,.12) 69%);pointer-events:none}.brute-camp-sign{position:relative;z-index:2;width:max-content;margin:0 auto 16px;padding:7px 21px;border:4px solid #6a361a;border-radius:8px;background:linear-gradient(180deg,#e8ba64,#bd6e2c);box-shadow:inset 0 0 0 3px #f7d993,0 6px 0 #512613;color:#562817;font-size:26px;font-weight:1000;letter-spacing:.08em;text-shadow:1px 1px 0 #f8db91}.brute-camp-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(220px,.85fr) minmax(260px,1fr) minmax(220px,.85fr);gap:14px;align-items:start}.brute-camp-column{display:grid;gap:10px}.brute-camp-card{border:3px solid #6a381d;border-radius:10px;padding:12px;background:linear-gradient(180deg,rgba(248,220,153,.97),rgba(211,160,88,.97));box-shadow:inset 0 0 0 2px rgba(255,247,200,.43),0 5px 0 #512713,0 9px 16px rgba(70,34,14,.19);color:#63361d}.brute-camp-card h3{margin:0 0 6px;font-size:12px;color:#5b2d16}.brute-camp-card small{color:#80522f;font-size:8px;font-weight:800}.brute-camp-kpi{display:grid;grid-template-columns:1fr 1fr;gap:6px}.brute-camp-kpi div{padding:8px;border:2px solid rgba(107,57,29,.24);border-radius:8px;background:rgba(255,245,198,.55)}.brute-camp-kpi span{display:block;font-size:7px;font-weight:1000;text-transform:uppercase}.brute-camp-kpi b{display:block;margin-top:2px;font-size:15px}.brute-camp-avatar{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:390px}.brute-camp-avatar .ga-brute-svg{width:min(300px,100%);filter:drop-shadow(0 16px 12px rgba(76,40,20,.22));animation:bruteIdle 2.7s ease-in-out infinite}.brute-camp-energy{margin-top:8px;width:min(330px,100%)}.brute-camp-energy-head{display:flex;justify-content:space-between;gap:10px;align-items:center;color:#66351b;font-size:9px;font-weight:1000}.brute-camp-energy-track{height:12px;margin-top:5px;padding:2px;border:2px solid #6a371d;border-radius:999px;background:#3d2116}.brute-camp-energy-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#66d56f,#f1dc54,#f49a38);transition:width .35s ease}.brute-camp-action{width:100%;border:3px solid #6e391b;border-radius:9px;padding:11px 12px;background:linear-gradient(180deg,#b96b30,#7f3d1d);box-shadow:inset 0 0 0 2px rgba(255,221,148,.30),0 4px 0 #4e2512;color:#fff0b5;font-size:10px;font-weight:1000;letter-spacing:.04em;text-shadow:0 2px 0 #48220f;cursor:pointer}.brute-camp-action.sleep{background:linear-gradient(180deg,#6f64b9,#403879);border-color:#372e68;box-shadow:inset 0 0 0 2px rgba(214,204,255,.25),0 4px 0 #282151;color:#f4eeff}.brute-camp-action:disabled{opacity:.48;cursor:not-allowed}.brute-camp-history{max-height:280px;overflow:auto}.brute-camp-history .brute-row{background:rgba(255,246,206,.44);border-color:rgba(104,56,28,.22);color:#63361d}.brute-camp-history .brute-row small{color:#845632}.brute-camp-xp{margin-top:8px}.brute-camp-xp .brute-track{height:10px;border:2px solid #6a381d;background:#3b2116}.brute-camp-xp .brute-track i{background:linear-gradient(90deg,#7d54cb,#4fc4e8,#f0d85c)}.brute-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.brute-stat-card{padding:12px;border:1px solid rgba(255,255,255,.06);border-radius:15px;background:rgba(255,255,255,.03)}.brute-stat-card b{display:block;font-size:22px}.brute-stat-card span{font-size:8px;color:#8087a2;text-transform:uppercase;font-weight:900}',
    '.brute-xp{margin-top:13px}.brute-track{height:8px;border-radius:999px;background:#060812;overflow:hidden}.brute-track i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#4ec6ff);border-radius:inherit}.brute-list{display:grid;gap:7px}.brute-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:13px;background:rgba(255,255,255,.025)}.brute-row .icon{font-size:25px}.brute-row b{font-size:11px}.brute-row small{display:block;margin-top:2px;color:#747c98;font-size:8px}.brute-selector-avatar{width:48px;height:48px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#0b0f21;display:grid;place-items:center;font-size:25px}.brute-selector-avatar img{width:100%;height:100%;object-fit:cover}.brute-real-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.brute-real-card{padding:11px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018))}.brute-real-card b{display:block;font-size:18px}.brute-real-card span{font-size:8px;color:#858ca8;text-transform:uppercase;font-weight:900}.brute-real-card small{display:block;margin-top:3px;color:#68708b;font-size:7px}.brute-real-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.06);border-radius:13px;background:rgba(255,255,255,.025)}',
    '.brute-choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.brute-tcg-pack{position:relative;margin-top:15px;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:radial-gradient(circle at 50% -20%,color-mix(in srgb,var(--accent),transparent 72%),transparent 45%),linear-gradient(180deg,rgba(15,18,39,.98),rgba(7,9,21,.98));overflow:hidden}.brute-tcg-pack:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 0 38%,rgba(255,255,255,.035) 48%,transparent 58%)}.brute-tcg-head{position:relative;z-index:2;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:11px}.brute-tcg-head span{display:block;color:var(--accent);font-size:8px;font-weight:1000;letter-spacing:.13em;text-transform:uppercase}.brute-tcg-head h3{margin:3px 0 0;font-size:18px}.brute-tcg-head small{color:#7d849f;font-size:8px;font-weight:800}.brute-choice{--card:#7d879c;--glow:rgba(125,135,156,.2);position:relative;min-height:214px;padding:13px;border:1px solid color-mix(in srgb,var(--card),transparent 42%);border-radius:17px;background:radial-gradient(circle at 50% 6%,color-mix(in srgb,var(--card),transparent 70%),transparent 38%),linear-gradient(160deg,rgba(28,31,52,.98),rgba(10,12,27,.99));color:#fff;cursor:pointer;text-align:left;box-shadow:inset 0 1px rgba(255,255,255,.06),0 10px 28px rgba(0,0,0,.2);overflow:hidden;animation:bruteCardDeal .55s cubic-bezier(.16,.85,.25,1) both;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.brute-choice:nth-child(2){animation-delay:.08s}.brute-choice:nth-child(3){animation-delay:.16s}.brute-choice:hover{transform:translateY(-7px) rotateX(2deg);box-shadow:0 18px 38px rgba(0,0,0,.34),0 0 26px var(--glow);border-color:var(--card)}.brute-choice.rarity-common{--card:#96a0b4;--glow:rgba(150,160,180,.16)}.brute-choice.rarity-rare{--card:#45a3ff;--glow:rgba(69,163,255,.28)}.brute-choice.rarity-epic{--card:#a766ff;--glow:rgba(167,102,255,.34)}.brute-choice.rarity-legendary{--card:#ffc94a;--glow:rgba(255,201,74,.36);background:radial-gradient(circle at 50% 5%,rgba(255,205,73,.3),transparent 40%),linear-gradient(160deg,#33240f,#111020 70%)}.brute-choice:before{content:"";position:absolute;inset:-40% -55%;background:linear-gradient(110deg,transparent 43%,rgba(255,255,255,.15) 49%,transparent 55%);transform:translateX(-45%) rotate(8deg);transition:transform .38s ease}.brute-choice:hover:before{transform:translateX(45%) rotate(8deg)}.brute-card-rarity{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:7px;color:var(--card);font-size:7px;font-weight:1000;letter-spacing:.1em}.brute-card-rarity i{width:7px;height:7px;border-radius:50%;background:var(--card);box-shadow:0 0 10px var(--card)}.brute-choice .big{position:relative;z-index:2;display:block;margin-top:17px;font-size:42px;filter:drop-shadow(0 5px 8px rgba(0,0,0,.25))}.brute-choice b{position:relative;z-index:2;display:block;margin-top:8px;font-size:15px}.brute-choice small{position:relative;z-index:2;display:block;margin-top:5px;color:#a8abc1;font-size:8px;line-height:1.45}.brute-card-type{position:relative;z-index:2;display:inline-flex;margin-top:11px;padding:4px 7px;border:1px solid color-mix(in srgb,var(--card),transparent 58%);border-radius:999px;background:color-mix(in srgb,var(--card),transparent 88%);color:var(--card);font-size:7px;font-weight:1000;text-transform:uppercase}.brute-card-current{position:relative;z-index:2;margin-top:8px;color:#6f7793;font-size:7px;font-weight:900}.brute-card-pick{position:absolute;z-index:2;right:10px;bottom:9px;color:var(--card);font-size:8px;font-weight:1000}.brute-tcg-pack.compact{max-width:760px;margin:14px auto 0}.brute-tcg-pack.compact .brute-choice{min-height:196px}',
    '.brute-arena{position:relative;min-height:560px;overflow:hidden;background:radial-gradient(circle at 50% 24%,rgba(255,246,189,.72),transparent 25%),linear-gradient(180deg,#88c4d1 0 27%,#d6bd78 27% 34%,#b77638 34% 100%);border:2px solid #65401f;border-radius:21px}.brute-arena:after{content:"GA BRUTE";position:absolute;left:50%;top:58%;transform:translate(-50%,-50%) rotate(-7deg);font-size:65px;font-weight:1000;letter-spacing:.08em;color:rgba(87,43,18,.07);white-space:nowrap}',
    '.brute-hud{position:absolute;z-index:8;inset:12px 14px auto;display:grid;grid-template-columns:1fr 55px 1fr;gap:10px}.brute-hud-meta{display:flex;gap:5px;align-items:center;margin-top:3px;font-size:7px;font-weight:900;color:#6b3a1d}.brute-hud-side.right .brute-hud-meta{justify-content:flex-end}.brute-fatigue{height:4px;margin-top:3px;border-radius:99px;background:rgba(76,40,20,.28);overflow:hidden}.brute-fatigue i{display:block;height:100%;width:0;background:linear-gradient(90deg,#55d979,#f0cf3c,#e34f2f);transition:width .22s linear}.brute-activity-pill{padding:2px 5px;border:1px solid rgba(108,58,28,.25);border-radius:99px;background:rgba(255,244,191,.45)}.brute-hud-side.right{text-align:right}.brute-hud-name{font-size:10px;font-weight:1000;color:#fff4bd;text-shadow:0 2px #563018}.brute-hp{height:18px;padding:3px;border:2px solid #633719;border-radius:5px;background:#392216}.brute-hp i{display:block;height:100%;background:linear-gradient(180deg,#ffe646,#ffaf22 55%,#e6531d);transition:width .25s linear}.brute-round{display:grid;place-items:center;height:43px;border:3px solid #8e4d22;border-radius:50%;background:#fff0ae;color:#7b3d1d;font-size:9px;font-weight:1000}',
    '.brute-fighters{position:absolute;z-index:5;left:0;right:0;bottom:48px;display:grid;grid-template-columns:1fr 1fr;align-items:end;padding:0 4%}.brute-fighter{--fight-offset:0%;--fight-y:0px;--knock:12px;--hit-y:0px;--hit-tilt:0deg;position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(var(--fight-offset),var(--fight-y));transition:transform .28s cubic-bezier(.2,.8,.2,1),z-index .2s}.brute-fighter .brute-shadow{transform-box:fill-box;transform-origin:center;transition:opacity .25s ease,transform .25s ease}.brute-fighter.arriving.left .ga-brute-svg{animation:bruteArriveLeft .62s cubic-bezier(.12,.82,.24,1)}.brute-fighter.arriving.right .ga-brute-svg{animation:bruteArriveRight .62s cubic-bezier(.12,.82,.24,1)}.brute-fighter.windup-fast .brute-arm-right{transform-box:fill-box;transform-origin:20% 15%;animation:bruteWindupFast .23s ease}.brute-fighter.windup-heavy .brute-arm-right{transform-box:fill-box;transform-origin:20% 15%;animation:bruteWindupHeavy .36s ease}.brute-fighter.windup-ranged .brute-arm-right{transform-box:fill-box;transform-origin:20% 15%;animation:bruteWindupRanged .30s ease}.brute-fighter.windup-flexible .brute-arm-right{transform-box:fill-box;transform-origin:20% 15%;animation:bruteWindupFlexible .28s ease}.brute-fighter.staggering.left .ga-brute-svg{animation:bruteStaggerLeft .46s ease}.brute-fighter.staggering.right .ga-brute-svg{animation:bruteStaggerRight .46s ease}.brute-fighter.ko .brute-shadow{opacity:.38;transform:scale(.62)}.brute-fighter .ga-brute-svg{width:min(340px,95%);transition:filter .16s ease,opacity .2s ease}.brute-fighter.right .ga-brute-svg{transform:scaleX(-1)}.brute-fighter.attack-fast.left .ga-brute-svg{animation:bruteAttackFastLeft .30s cubic-bezier(.2,.9,.2,1)}.brute-fighter.attack-fast.right .ga-brute-svg{animation:bruteAttackFastRight .30s cubic-bezier(.2,.9,.2,1)}.brute-fighter.attack-heavy.left .ga-brute-svg{animation:bruteAttackHeavyLeft .48s cubic-bezier(.15,.75,.2,1)}.brute-fighter.attack-heavy.right .ga-brute-svg{animation:bruteAttackHeavyRight .48s cubic-bezier(.15,.75,.2,1)}.brute-fighter.attack-ranged.left .ga-brute-svg{animation:bruteAttackRangedLeft .38s ease}.brute-fighter.attack-ranged.right .ga-brute-svg{animation:bruteAttackRangedRight .38s ease}.brute-fighter.attack-flexible.left .ga-brute-svg{animation:bruteAttackFlexibleLeft .36s ease}.brute-fighter.attack-flexible.right .ga-brute-svg{animation:bruteAttackFlexibleRight .36s ease}.brute-fighter.countering .ga-brute-svg{filter:drop-shadow(0 0 14px rgba(177,102,255,.85))}.brute-fighter.comboing .ga-brute-svg{filter:drop-shadow(0 0 12px rgba(255,195,64,.75))}.brute-fighter.guard .ga-brute-svg{animation:bruteGuard .42s ease}.brute-fighter.stunned .ga-brute-svg{animation:bruteStun .56s ease}.brute-fighter.hit.left .ga-brute-svg{animation:bruteHitLeft .34s ease}.brute-fighter.hit.right .ga-brute-svg{animation:bruteHitRight .34s ease}.brute-fighter.hit-heavy.left .ga-brute-svg{animation:bruteHitHeavyLeft .46s ease}.brute-fighter.hit-heavy.right .ga-brute-svg{animation:bruteHitHeavyRight .46s ease}.brute-fighter.dodge.left .ga-brute-svg{animation:bruteDodgeLeft .48s cubic-bezier(.2,.85,.2,1)}.brute-fighter.dodge.right .ga-brute-svg{animation:bruteDodgeRight .48s cubic-bezier(.2,.85,.2,1)}.brute-fighter.ko.left .ga-brute-svg{animation:bruteKoLeft .78s cubic-bezier(.18,.75,.25,1) forwards}.brute-fighter.ko.right .ga-brute-svg{animation:bruteKoRight .78s cubic-bezier(.18,.75,.25,1) forwards}.brute-fighter.attack-heavy .brute-arm-right{transform-box:fill-box;transform-origin:15% 15%;animation:bruteArmHeavy .48s ease}.brute-fighter.attack-fast .brute-arm-right{transform-box:fill-box;transform-origin:20% 15%;animation:bruteArmFast .30s ease}.brute-fighter.guard .brute-arm-left{transform-box:fill-box;transform-origin:80% 20%;animation:bruteGuardArm .42s ease}.brute-fighter.stunned .brute-head{transform-box:fill-box;transform-origin:center;animation:bruteHeadStun .56s ease}',
    '.brute-pet-slot{position:absolute;bottom:7px;width:84px}.brute-fighter.left .brute-pet-slot{right:7%}.brute-fighter.right .brute-pet-slot{left:7%}.ga-brute-pet-svg{width:100%}',
    '.brute-float{position:absolute;z-index:15;top:25%;padding:5px 8px;border:2px solid #91451f;border-radius:9px;background:#fff6be;color:#d3241e;font-size:14px;font-weight:1000;box-shadow:0 4px 0 rgba(82,38,17,.15);animation:bruteFloat .78s ease forwards}.brute-fighter.left .brute-float{right:15%}.brute-fighter.right .brute-float{left:15%}.brute-float.dodge{color:#285fa7}.brute-float.skill{color:#7b36b3}.brute-float.crit{font-size:20px;color:#e01818}.brute-float.combo{color:#a85a00}.brute-float.heal{color:#198754}.brute-stagefx{position:absolute;z-index:12;inset:0;pointer-events:none;overflow:hidden}.brute-impact{position:absolute;width:86px;height:86px;border-radius:50%;border:7px solid rgba(255,246,182,.95);box-shadow:0 0 0 10px rgba(255,157,38,.22),0 0 34px rgba(255,106,0,.75);transform:translate(-50%,-50%) scale(.2);animation:bruteImpact .42s ease forwards}.brute-impact.crit{width:120px;height:120px;border-color:#fff;background:radial-gradient(circle,rgba(255,255,255,.98) 0 8%,rgba(255,199,60,.82) 9% 18%,transparent 45%);box-shadow:0 0 55px rgba(255,58,30,.85)}.brute-dust{position:absolute;bottom:76px;width:100px;height:34px;border-radius:50%;background:radial-gradient(ellipse,rgba(238,214,157,.72),rgba(206,160,93,.24) 56%,transparent 70%);filter:blur(3px);animation:bruteDust .5s ease forwards}.brute-skill-banner{position:absolute;z-index:20;left:50%;top:25%;transform:translate(-50%,-50%) scale(.7);padding:9px 14px;border:3px solid #6e3a1c;border-radius:12px;background:#fff2b6;color:#743617;font-size:15px;font-weight:1000;letter-spacing:.05em;box-shadow:0 5px 0 rgba(82,39,17,.2);animation:bruteSkillBanner .72s ease forwards}.brute-projectile{position:absolute;z-index:18;top:48%;font-size:34px;filter:drop-shadow(0 3px 3px rgba(0,0,0,.28));animation:bruteProjectileLR .38s cubic-bezier(.2,.6,.4,1) forwards}.brute-projectile.right{animation-name:bruteProjectileRL}.brute-projectile:after{content:"";position:absolute;left:50%;top:50%;width:42px;height:3px;border-radius:99px;background:rgba(255,255,255,.45);transform:translate(-100%,-50%);filter:blur(2px)}.brute-arena.shake{animation:bruteArenaShake .34s ease}.brute-arena.flash:before{content:"";position:absolute;z-index:30;inset:0;background:rgba(255,248,213,.88);animation:bruteFlash .24s ease forwards;pointer-events:none}',
    '.brute-log{position:absolute;z-index:8;left:13px;right:13px;bottom:9px;text-align:center;color:#fff2ba;font-size:8px;font-weight:900;text-shadow:0 2px #4c2814}.brute-controls{display:flex;gap:7px;justify-content:center;margin-top:10px}.brute-xp-result{margin-top:10px;padding:16px;text-align:center;overflow:hidden;position:relative}.brute-xp-gain{display:inline-flex;align-items:center;gap:7px;margin-top:8px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--accent),transparent 45%);border-radius:999px;background:color-mix(in srgb,var(--accent),transparent 88%);font-size:18px;font-weight:1000;color:#fff}.brute-xp-track{width:min(500px,100%);height:13px;margin:13px auto 5px;padding:2px;border-radius:999px;background:#050711;border:1px solid rgba(255,255,255,.08);overflow:hidden}.brute-xp-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),#54d5ff,#ffe46a);transition:width 1.1s cubic-bezier(.15,.8,.2,1)}.brute-level-up{margin:10px auto 0;width:max-content;max-width:100%;padding:8px 15px;border:2px solid #e6b739;border-radius:10px;background:linear-gradient(180deg,#ffe98d,#d99c2d);color:#5d3218;font-size:17px;font-weight:1000;box-shadow:0 0 25px rgba(255,203,67,.3);animation:bruteLevelUp .9s ease}.brute-reward-inline{margin-top:14px}.brute-reward-inline .brute-choice-grid{max-width:620px;margin:8px auto 0}',
    '.brute-fight-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:620px;margin:12px auto 0}.brute-fight-summary-side{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.025)}.brute-fight-summary-side h4{margin:0 0 7px;font-size:10px;color:#d8d9e6}.brute-fight-summary-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.brute-fight-summary-stats span{padding:6px;border-radius:9px;background:rgba(255,255,255,.035);font-size:7px;color:#858ba5;text-transform:uppercase;font-weight:900}.brute-fight-summary-stats b{display:block;margin-top:2px;color:#fff;font-size:12px}.brute-weapon-label{display:inline-flex;gap:4px;align-items:center;margin-top:3px;padding:2px 6px;border-radius:99px;background:rgba(255,244,191,.45);color:#6b3a1d;font-size:7px;font-weight:1000}.brute-resting .ga-brute-svg{animation:bruteBreathe .7s ease}.brute-switching .ga-brute-svg{animation:bruteWeaponSwitch .48s ease}.brute-blocking.left .ga-brute-svg{animation:bruteBlockLeft .42s ease}.brute-blocking.right .ga-brute-svg{animation:bruteBlockRight .42s ease}.brute-equipment{display:grid;grid-template-columns:minmax(250px,.85fr) minmax(0,1.15fr);gap:12px}.brute-equipment-preview{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:430px;padding:18px}.brute-equipment-preview .ga-brute-svg{width:min(210px,72%)}.brute-equipment-preview .brute-actions{width:100%}.brute-chip-row{display:flex;gap:7px;flex-wrap:wrap}.brute-chip{border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.04);color:#d8dae6;padding:8px 10px;font-size:9px;font-weight:900}.brute-chip.active{border-color:var(--accent);color:#fff;background:color-mix(in srgb,var(--accent),transparent 86%)}',
    '.brute-ranking{display:grid;gap:7px}.brute-rank-row{display:grid;grid-template-columns:34px 1fr repeat(3,auto);gap:9px;align-items:center;padding:10px;border-bottom:1px solid rgba(255,255,255,.055)}.brute-rank-row .rank{font-size:17px;font-weight:1000;color:var(--accent)}',
    '.brute-sleep{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.7fr);gap:12px}.brute-sleep-energy{margin-top:12px;padding:10px 12px;border:2px solid rgba(127,112,208,.32);border-radius:13px;background:rgba(104,91,176,.12);color:#d9d2ff}.brute-sleep-energy b{display:block;font-size:18px}.brute-sleep-energy small{color:#8f88bc;font-size:8px}.brute-moon{min-height:390px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle at 50% 32%,rgba(131,112,255,.28),transparent 25%),#0a0d21}.brute-moon .moon{font-size:100px;filter:drop-shadow(0 0 25px rgba(129,109,255,.38));animation:bruteIdle 4s ease-in-out infinite}.brute-sleep-time{font-size:40px;font-weight:1000;font-variant-numeric:tabular-nums}.brute-sound-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
    '.brute-fighter.windup-stance-0 .brute-torso{transform-box:fill-box;transform-origin:center bottom;animation:bruteWindupBodyA .32s ease}.brute-fighter.windup-stance-1 .brute-head{transform-box:fill-box;transform-origin:center;animation:bruteWindupHead .32s ease}.brute-fighter.windup-stance-2 .brute-leg-left,.brute-fighter.windup-stance-2 .brute-leg-right{transform-box:fill-box;transform-origin:center top;animation:bruteWindupLegs .32s ease}.brute-fighter.attack-v0.left .ga-brute-svg{animation:bruteAttackJabLeft .31s cubic-bezier(.16,.9,.22,1)}.brute-fighter.attack-v0.right .ga-brute-svg{animation:bruteAttackJabRight .31s cubic-bezier(.16,.9,.22,1)}.brute-fighter.attack-v1.left .ga-brute-svg{animation:bruteAttackHookLeft .38s cubic-bezier(.16,.82,.2,1)}.brute-fighter.attack-v1.right .ga-brute-svg{animation:bruteAttackHookRight .38s cubic-bezier(.16,.82,.2,1)}.brute-fighter.attack-v2.left .ga-brute-svg{animation:bruteAttackUpperLeft .39s cubic-bezier(.18,.82,.2,1)}.brute-fighter.attack-v2.right .ga-brute-svg{animation:bruteAttackUpperRight .39s cubic-bezier(.18,.82,.2,1)}.brute-fighter.attack-v3.left .ga-brute-svg{animation:bruteAttackSpinLeft .43s cubic-bezier(.18,.8,.22,1)}.brute-fighter.attack-v3.right .ga-brute-svg{animation:bruteAttackSpinRight .43s cubic-bezier(.18,.8,.22,1)}.brute-fighter.attack-v4.left .ga-brute-svg{animation:bruteAttackSlamLeft .48s cubic-bezier(.14,.75,.2,1)}.brute-fighter.attack-v4.right .ga-brute-svg{animation:bruteAttackSlamRight .48s cubic-bezier(.14,.75,.2,1)}.brute-fighter.attack-v5.left .ga-brute-svg{animation:bruteAttackSweepLeft .40s cubic-bezier(.2,.84,.22,1)}.brute-fighter.attack-v5.right .ga-brute-svg{animation:bruteAttackSweepRight .40s cubic-bezier(.2,.84,.22,1)}.brute-fighter.dodge-v0.left .ga-brute-svg{animation:bruteDodgeStepLeft .46s ease}.brute-fighter.dodge-v0.right .ga-brute-svg{animation:bruteDodgeStepRight .46s ease}.brute-fighter.dodge-v1.left .ga-brute-svg{animation:bruteDodgeDuckLeft .46s ease}.brute-fighter.dodge-v1.right .ga-brute-svg{animation:bruteDodgeDuckRight .46s ease}.brute-fighter.dodge-v2.left .ga-brute-svg{animation:bruteDodgeHopLeft .49s cubic-bezier(.2,.85,.2,1)}.brute-fighter.dodge-v2.right .ga-brute-svg{animation:bruteDodgeHopRight .49s cubic-bezier(.2,.85,.2,1)}.brute-fighter.block-v0 .brute-arm-left{transform-box:fill-box;transform-origin:80% 20%;animation:bruteParryArm .38s ease}.brute-fighter.block-v1 .brute-torso{transform-box:fill-box;transform-origin:center bottom;animation:bruteBraceBody .4s ease}.brute-fighter.block-v2 .brute-head{transform-box:fill-box;transform-origin:center;animation:bruteGuardHead .38s ease}.brute-fighter.miss-v0.left .ga-brute-svg{animation:bruteMissOverLeft .33s ease}.brute-fighter.miss-v0.right .ga-brute-svg{animation:bruteMissOverRight .33s ease}.brute-fighter.miss-v1.left .ga-brute-svg{animation:bruteMissLowLeft .34s ease}.brute-fighter.miss-v1.right .ga-brute-svg{animation:bruteMissLowRight .34s ease}.brute-fighter.miss-v2.left .ga-brute-svg{animation:bruteMissSpinLeft .38s ease}.brute-fighter.miss-v2.right .ga-brute-svg{animation:bruteMissSpinRight .38s ease}.brute-fighter.critical-burst .ga-brute-svg{filter:drop-shadow(0 0 17px rgba(255,210,70,.9)) brightness(1.12)}.brute-fighter.finisher .ga-brute-svg{filter:drop-shadow(0 0 24px rgba(255,235,143,.95))}.brute-fighter.ko-v0.left .ga-brute-svg{animation:bruteKoFallLeft .82s cubic-bezier(.18,.75,.25,1) forwards}.brute-fighter.ko-v0.right .ga-brute-svg{animation:bruteKoFallRight .82s cubic-bezier(.18,.75,.25,1) forwards}.brute-fighter.ko-v1.left .ga-brute-svg{animation:bruteKoSpinLeft .86s cubic-bezier(.18,.72,.25,1) forwards}.brute-fighter.ko-v1.right .ga-brute-svg{animation:bruteKoSpinRight .86s cubic-bezier(.18,.72,.25,1) forwards}.brute-fighter.ko-v2.left .ga-brute-svg{animation:bruteKoLaunchLeft .9s cubic-bezier(.12,.75,.25,1) forwards}.brute-fighter.ko-v2.right .ga-brute-svg{animation:bruteKoLaunchRight .9s cubic-bezier(.12,.75,.25,1) forwards}.brute-speedline{position:absolute;z-index:10;top:45%;left:23%;width:47%;height:44px;background:repeating-linear-gradient(0deg,transparent 0 6px,rgba(255,246,199,.75) 7px 9px,transparent 10px 15px);clip-path:polygon(0 35%,100% 0,100% 100%,0 65%);filter:blur(.3px);animation:bruteSpeedlineLR .34s ease forwards}.brute-speedline.right{left:auto;right:23%;transform:scaleX(-1)}.brute-slash-fx{position:absolute;z-index:17;left:29%;top:38%;width:45%;height:115px;border-top:7px solid rgba(255,242,175,.9);border-radius:50%;transform:rotate(-15deg) scale(.4);filter:drop-shadow(0 0 7px rgba(255,155,63,.85));animation:bruteSlashLR .42s ease forwards}.brute-slash-fx.right{transform:rotate(195deg) scale(.4)}.brute-shockwave{position:absolute;z-index:16;width:45px;height:24px;border:5px solid rgba(255,237,174,.82);border-radius:50%;transform:translate(-50%,-50%) scale(.2);box-shadow:0 0 20px rgba(255,122,44,.55);animation:bruteShockwave .48s ease forwards}.brute-crit-burst{position:absolute;z-index:26;width:30px;height:30px;transform:translate(-50%,-50%);background:radial-gradient(circle,#fff 0 10%,#ffe66d 11% 24%,#ff612e 25% 35%,transparent 36%);animation:bruteCritBurst .58s ease forwards}.brute-crit-burst:before,.brute-crit-burst:after{content:"";position:absolute;left:50%;top:50%;width:120px;height:4px;background:linear-gradient(90deg,transparent,#fff7bc,transparent);transform:translate(-50%,-50%) rotate(45deg)}.brute-crit-burst:after{transform:translate(-50%,-50%) rotate(-45deg)}.brute-miss-swoosh{position:absolute;z-index:15;left:32%;top:43%;width:33%;height:70px;border-top:4px solid rgba(255,255,255,.55);border-radius:50%;transform:rotate(-12deg);animation:bruteMissSwoosh .4s ease forwards}.brute-miss-swoosh.right{transform:scaleX(-1) rotate(-12deg)}.brute-parry-spark{position:absolute;z-index:22;width:22px;height:22px;transform:translate(-50%,-50%);background:radial-gradient(circle,#fff 0 12%,#a9d8ff 13% 30%,transparent 32%);filter:drop-shadow(0 0 8px rgba(88,175,255,.9));animation:bruteParrySpark .45s ease forwards}.brute-finisher-flare{position:absolute;z-index:24;top:15%;bottom:10%;width:8px;background:linear-gradient(180deg,transparent,#fff9bd 22%,#ff9d39 50%,#fff9bd 78%,transparent);filter:blur(1px) drop-shadow(0 0 14px rgba(255,186,56,.9));transform:translateX(-50%) scaleY(.1);animation:bruteFinisherFlare .68s ease forwards}.brute-arena.finisher{animation:bruteFinisherArena .62s ease}.brute-arena.finisher:after{color:rgba(255,255,255,.16);text-shadow:0 0 22px rgba(255,220,92,.35)}.brute-arena.impact-heavy .brute-fighters{animation:bruteGroundBump .34s ease}.brute-arena.impact-ranged .brute-stagefx{filter:saturate(1.25)}',
    '@keyframes bruteWindupBodyA{0%,100%{transform:rotate(0) scale(1)}55%{transform:rotate(-3deg) scale(.97,1.03)}}@keyframes bruteWindupHead{0%,100%{transform:rotate(0)}55%{transform:rotate(-7deg) translateY(2px)}}@keyframes bruteWindupLegs{0%,100%{transform:translateY(0)}55%{transform:translateY(4px) scaleY(.96)}}@keyframes bruteAttackJabLeft{0%,100%{transform:translate(0,0) rotate(0)}42%{transform:translate(23%,-2px) rotate(-1deg)}58%{transform:translate(35%,-1px) rotate(2deg)}}@keyframes bruteAttackJabRight{0%,100%{transform:scaleX(-1) translate(0,0) rotate(0)}42%{transform:scaleX(-1) translate(23%,-2px) rotate(-1deg)}58%{transform:scaleX(-1) translate(35%,-1px) rotate(2deg)}}@keyframes bruteAttackHookLeft{0%,100%{transform:translateX(0) rotate(0)}30%{transform:translateX(-4%) rotate(-9deg)}62%{transform:translateX(30%) rotate(11deg)}80%{transform:translateX(14%) rotate(3deg)}}@keyframes bruteAttackHookRight{0%,100%{transform:scaleX(-1) translateX(0) rotate(0)}30%{transform:scaleX(-1) translateX(-4%) rotate(-9deg)}62%{transform:scaleX(-1) translateX(30%) rotate(11deg)}80%{transform:scaleX(-1) translateX(14%) rotate(3deg)}}@keyframes bruteAttackUpperLeft{0%,100%{transform:translate(0,0) rotate(0)}32%{transform:translate(-2%,8px) rotate(-5deg) scaleY(.96)}62%{transform:translate(27%,-18px) rotate(5deg) scaleY(1.03)}80%{transform:translate(13%,-4px)}}@keyframes bruteAttackUpperRight{0%,100%{transform:scaleX(-1) translate(0,0) rotate(0)}32%{transform:scaleX(-1) translate(-2%,8px) rotate(-5deg) scaleY(.96)}62%{transform:scaleX(-1) translate(27%,-18px) rotate(5deg) scaleY(1.03)}80%{transform:scaleX(-1) translate(13%,-4px)}}@keyframes bruteAttackSpinLeft{0%,100%{transform:translateX(0) rotate(0)}28%{transform:translateX(-7%) rotate(-14deg)}55%{transform:translateX(25%) rotate(18deg)}72%{transform:translateX(31%) rotate(7deg)}}@keyframes bruteAttackSpinRight{0%,100%{transform:scaleX(-1) translateX(0) rotate(0)}28%{transform:scaleX(-1) translateX(-7%) rotate(-14deg)}55%{transform:scaleX(-1) translateX(25%) rotate(18deg)}72%{transform:scaleX(-1) translateX(31%) rotate(7deg)}}@keyframes bruteAttackSlamLeft{0%,100%{transform:translate(0,0) rotate(0)}24%{transform:translate(-4%,-16px) rotate(-7deg)}55%{transform:translate(28%,10px) rotate(8deg)}72%{transform:translate(17%,3px)}}@keyframes bruteAttackSlamRight{0%,100%{transform:scaleX(-1) translate(0,0) rotate(0)}24%{transform:scaleX(-1) translate(-4%,-16px) rotate(-7deg)}55%{transform:scaleX(-1) translate(28%,10px) rotate(8deg)}72%{transform:scaleX(-1) translate(17%,3px)}}@keyframes bruteAttackSweepLeft{0%,100%{transform:translate(0,0) rotate(0)}28%{transform:translate(-3%,6px) rotate(-5deg)}58%{transform:translate(29%,5px) rotate(6deg) scaleY(.96)}76%{transform:translate(14%,1px)}}@keyframes bruteAttackSweepRight{0%,100%{transform:scaleX(-1) translate(0,0) rotate(0)}28%{transform:scaleX(-1) translate(-3%,6px) rotate(-5deg)}58%{transform:scaleX(-1) translate(29%,5px) rotate(6deg) scaleY(.96)}76%{transform:scaleX(-1) translate(14%,1px)}}@keyframes bruteDodgeStepLeft{0%,100%{transform:translate(0,0)}45%{transform:translate(-42px,-8px) rotate(-3deg)}}@keyframes bruteDodgeStepRight{0%,100%{transform:scaleX(-1) translate(0,0)}45%{transform:scaleX(-1) translate(-42px,-8px) rotate(-3deg)}}@keyframes bruteDodgeDuckLeft{0%,100%{transform:translate(0,0) scaleY(1)}42%{transform:translate(-18px,26px) scaleY(.82) rotate(-2deg)}}@keyframes bruteDodgeDuckRight{0%,100%{transform:scaleX(-1) translate(0,0) scaleY(1)}42%{transform:scaleX(-1) translate(-18px,26px) scaleY(.82) rotate(-2deg)}}@keyframes bruteDodgeHopLeft{0%,100%{transform:translate(0,0)}38%{transform:translate(-34px,-44px) rotate(-6deg)}68%{transform:translate(-24px,-12px)}}@keyframes bruteDodgeHopRight{0%,100%{transform:scaleX(-1) translate(0,0)}38%{transform:scaleX(-1) translate(-34px,-44px) rotate(-6deg)}68%{transform:scaleX(-1) translate(-24px,-12px)}}@keyframes bruteParryArm{0%,100%{transform:rotate(0)}42%{transform:rotate(-68deg) translate(-8px,-8px)}70%{transform:rotate(-28deg)}}@keyframes bruteBraceBody{0%,100%{transform:scale(1) translateY(0)}42%{transform:scale(.94,1.04) translateY(5px)}}@keyframes bruteGuardHead{0%,100%{transform:rotate(0)}40%{transform:rotate(-11deg) translate(-2px,4px)}}@keyframes bruteMissOverLeft{0%,100%{transform:translate(0,0) rotate(0)}55%{transform:translate(28%,-10px) rotate(9deg)}}@keyframes bruteMissOverRight{0%,100%{transform:scaleX(-1) translate(0,0) rotate(0)}55%{transform:scaleX(-1) translate(28%,-10px) rotate(9deg)}}@keyframes bruteMissLowLeft{0%,100%{transform:translate(0,0) rotate(0)}55%{transform:translate(27%,16px) rotate(-6deg)}}@keyframes bruteMissLowRight{0%,100%{transform:scaleX(-1) translate(0,0) rotate(0)}55%{transform:scaleX(-1) translate(27%,16px) rotate(-6deg)}}@keyframes bruteMissSpinLeft{0%,100%{transform:translateX(0) rotate(0)}55%{transform:translateX(26%) rotate(15deg)}}@keyframes bruteMissSpinRight{0%,100%{transform:scaleX(-1) translateX(0) rotate(0)}55%{transform:scaleX(-1) translateX(26%) rotate(15deg)}}@keyframes bruteKoFallLeft{0%{transform:rotate(0) translate(0,0);opacity:1}45%{transform:rotate(28deg) translate(14px,5px);opacity:1}100%{transform:rotate(88deg) translate(44px,35px);opacity:.4}}@keyframes bruteKoFallRight{0%{transform:scaleX(-1) rotate(0) translate(0,0);opacity:1}45%{transform:scaleX(-1) rotate(28deg) translate(14px,5px);opacity:1}100%{transform:scaleX(-1) rotate(88deg) translate(44px,35px);opacity:.4}}@keyframes bruteKoSpinLeft{0%{transform:rotate(0) translate(0,0);opacity:1}45%{transform:rotate(-34deg) translate(-10px,-12px);opacity:1}100%{transform:rotate(-104deg) translate(-48px,30px);opacity:.38}}@keyframes bruteKoSpinRight{0%{transform:scaleX(-1) rotate(0) translate(0,0);opacity:1}45%{transform:scaleX(-1) rotate(-34deg) translate(-10px,-12px);opacity:1}100%{transform:scaleX(-1) rotate(-104deg) translate(-48px,30px);opacity:.38}}@keyframes bruteKoLaunchLeft{0%{transform:translate(0,0) rotate(0);opacity:1}36%{transform:translate(-12px,-46px) rotate(-8deg);opacity:1}100%{transform:translate(-58px,46px) rotate(-78deg);opacity:.34}}@keyframes bruteKoLaunchRight{0%{transform:scaleX(-1) translate(0,0) rotate(0);opacity:1}36%{transform:scaleX(-1) translate(-12px,-46px) rotate(-8deg);opacity:1}100%{transform:scaleX(-1) translate(-58px,46px) rotate(-78deg);opacity:.34}}@keyframes bruteSpeedlineLR{0%{opacity:0;transform:translateX(-20%) scaleX(.5)}30%{opacity:.8}100%{opacity:0;transform:translateX(42%) scaleX(1.2)}}@keyframes bruteSlashLR{0%{opacity:0;transform:rotate(-15deg) scale(.3)}42%{opacity:1;transform:rotate(-7deg) scale(1)}100%{opacity:0;transform:rotate(2deg) scale(1.25)}}@keyframes bruteShockwave{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}38%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(3.8)}}@keyframes bruteCritBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(.25) rotate(0)}28%{opacity:1;transform:translate(-50%,-50%) scale(1.3) rotate(20deg)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4) rotate(52deg)}}@keyframes bruteMissSwoosh{0%{opacity:0;transform:translateX(-20%) rotate(-12deg) scale(.6)}38%{opacity:.7}100%{opacity:0;transform:translateX(35%) rotate(-5deg) scale(1.15)}}@keyframes bruteParrySpark{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}35%{opacity:1;transform:translate(-50%,-50%) scale(1.35)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.2)}}@keyframes bruteFinisherFlare{0%{opacity:0;transform:translateX(-50%) scaleY(.1)}38%{opacity:1;transform:translateX(-50%) scaleY(1)}100%{opacity:0;transform:translateX(-50%) scaleY(1.2)}}@keyframes bruteFinisherArena{0%,100%{filter:none}24%{filter:contrast(1.3) saturate(1.4)}45%{filter:brightness(1.25) saturate(1.7)}70%{filter:contrast(1.15)}}@keyframes bruteGroundBump{0%,100%{transform:translateY(0)}30%{transform:translateY(5px)}55%{transform:translateY(-2px)}}@keyframes bruteCardDeal{0%{opacity:0;transform:translateY(28px) rotateY(-12deg) scale(.88)}58%{opacity:1;transform:translateY(-4px) rotateY(3deg) scale(1.025)}100%{opacity:1;transform:translateY(0) rotateY(0) scale(1)}}@keyframes bruteIdle{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.01)}}@keyframes bruteAttackFastLeft{0%,100%{transform:translateX(0) rotate(0)}40%{transform:translateX(24%) rotate(2deg)}56%{transform:translateX(34%) rotate(-2deg)}}@keyframes bruteAttackFastRight{0%,100%{transform:scaleX(-1) translateX(0) rotate(0)}40%{transform:scaleX(-1) translateX(24%) rotate(2deg)}56%{transform:scaleX(-1) translateX(34%) rotate(-2deg)}}@keyframes bruteAttackHeavyLeft{0%{transform:translateX(0) rotate(0)}27%{transform:translateX(-5%) rotate(-5deg)}62%{transform:translateX(34%) rotate(5deg)}100%{transform:translateX(0) rotate(0)}}@keyframes bruteAttackHeavyRight{0%{transform:scaleX(-1) translateX(0) rotate(0)}27%{transform:scaleX(-1) translateX(-5%) rotate(-5deg)}62%{transform:scaleX(-1) translateX(34%) rotate(5deg)}100%{transform:scaleX(-1) translateX(0) rotate(0)}}@keyframes bruteAttackRangedLeft{0%,100%{transform:translateX(0)}35%{transform:translateX(-6%) rotate(-3deg)}65%{transform:translateX(9%) rotate(2deg)}}@keyframes bruteAttackRangedRight{0%,100%{transform:scaleX(-1) translateX(0)}35%{transform:scaleX(-1) translateX(-6%) rotate(-3deg)}65%{transform:scaleX(-1) translateX(9%) rotate(2deg)}}@keyframes bruteAttackFlexibleLeft{0%,100%{transform:translateX(0) rotate(0)}28%{transform:translateX(-4%) rotate(-7deg)}58%{transform:translateX(22%) rotate(8deg)}78%{transform:translateX(12%) rotate(-4deg)}}@keyframes bruteAttackFlexibleRight{0%,100%{transform:scaleX(-1) translateX(0) rotate(0)}28%{transform:scaleX(-1) translateX(-4%) rotate(-7deg)}58%{transform:scaleX(-1) translateX(22%) rotate(8deg)}78%{transform:scaleX(-1) translateX(12%) rotate(-4deg)}}@keyframes bruteHitLeft{0%,100%{filter:none;transform:translate(0,0) rotate(0)}22%{filter:brightness(1.75) saturate(1.4);transform:translate(-8px,var(--hit-y)) rotate(var(--hit-tilt))}55%{transform:translate(7px,0) rotate(0)}}@keyframes bruteHitRight{0%,100%{filter:none;transform:scaleX(-1) translate(0,0) rotate(0)}22%{filter:brightness(1.75) saturate(1.4);transform:scaleX(-1) translate(-8px,var(--hit-y)) rotate(var(--hit-tilt))}55%{transform:scaleX(-1) translate(7px,0) rotate(0)}}@keyframes bruteHitHeavyLeft{0%,100%{filter:none;transform:translate(0,0) rotate(0)}18%{filter:brightness(2) saturate(1.5);transform:translate(-18px,var(--hit-y)) rotate(var(--hit-tilt))}48%{transform:translate(13px,0) rotate(2deg)}72%{transform:translate(-5px,0)}}@keyframes bruteHitHeavyRight{0%,100%{filter:none;transform:scaleX(-1) translate(0,0) rotate(0)}18%{filter:brightness(2) saturate(1.5);transform:scaleX(-1) translate(-18px,var(--hit-y)) rotate(var(--hit-tilt))}48%{transform:scaleX(-1) translate(13px,0) rotate(2deg)}72%{transform:scaleX(-1) translate(-5px,0)}}@keyframes bruteDodgeLeft{0%,100%{transform:translate(0,0)}42%{transform:translate(-38px,-38px) rotate(-4deg)}70%{transform:translate(-22px,-9px)}}@keyframes bruteDodgeRight{0%,100%{transform:scaleX(-1) translate(0,0)}42%{transform:scaleX(-1) translate(-38px,-38px) rotate(-4deg)}70%{transform:scaleX(-1) translate(-22px,-9px)}}@keyframes bruteKoLeft{0%{transform:rotate(0) translate(0,0);opacity:1}38%{transform:rotate(18deg) translate(12px,-8px);opacity:1}100%{transform:rotate(78deg) translate(35px,34px);opacity:.45}}@keyframes bruteKoRight{0%{transform:scaleX(-1) rotate(0) translate(0,0);opacity:1}38%{transform:scaleX(-1) rotate(18deg) translate(12px,-8px);opacity:1}100%{transform:scaleX(-1) rotate(78deg) translate(35px,34px);opacity:.45}}@keyframes bruteGuard{0%,100%{filter:none}45%{filter:drop-shadow(0 0 18px rgba(101,167,255,.95)) brightness(1.25)}}@keyframes bruteStun{0%,100%{filter:none}25%{filter:saturate(.2) brightness(1.3)}50%{filter:saturate(.2) brightness(.75)}75%{filter:saturate(.2) brightness(1.2)}}@keyframes bruteArmHeavy{0%,100%{transform:rotate(0)}30%{transform:rotate(-38deg)}62%{transform:rotate(62deg)}}@keyframes bruteArmFast{0%,100%{transform:rotate(0)}45%{transform:rotate(52deg)}}@keyframes bruteGuardArm{0%,100%{transform:rotate(0)}50%{transform:rotate(-55deg) translate(-5px,-6px)}}@keyframes bruteHeadStun{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}50%{transform:rotate(9deg)}75%{transform:rotate(-5deg)}}@keyframes bruteFloat{0%{opacity:0;transform:translateY(12px) scale(.7)}35%{opacity:1;transform:translateY(-10px) scale(1.12)}100%{opacity:0;transform:translateY(-44px) scale(.92)}}@keyframes bruteImpact{0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0)}35%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(18deg)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.45) rotate(36deg)}}@keyframes bruteDust{0%{opacity:0;transform:scale(.45)}35%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(1.45)}}@keyframes bruteSkillBanner{0%{opacity:0;transform:translate(-50%,-30%) scale(.65)}28%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}78%{opacity:1;transform:translate(-50%,-60%) scale(1)}100%{opacity:0;transform:translate(-50%,-85%) scale(.9)}}@keyframes bruteProjectileLR{0%{left:24%;transform:rotate(-20deg) scale(.75)}100%{left:73%;transform:rotate(220deg) scale(1.08)}}@keyframes bruteProjectileRL{0%{left:73%;transform:rotate(20deg) scale(.75)}100%{left:24%;transform:rotate(-220deg) scale(1.08)}}@keyframes bruteArenaShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-5px,2px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-4px,-1px)}80%{transform:translate(3px,2px)}}@keyframes bruteFlash{0%{opacity:0}30%{opacity:.85}100%{opacity:0}}@keyframes bruteLevelUp{0%{opacity:0;transform:translateY(12px) scale(.8)}45%{opacity:1;transform:translateY(-3px) scale(1.08)}100%{transform:translateY(0) scale(1)}}@keyframes bruteBreathe{0%,100%{transform:scale(1)}50%{transform:scale(.985) translateY(3px)}}@keyframes bruteWeaponSwitch{0%,100%{transform:rotate(0)}35%{transform:rotate(-5deg) translateY(-6px)}70%{transform:rotate(4deg)}}@keyframes bruteBlockLeft{0%,100%{transform:translateX(0)}45%{transform:translateX(-7px) scale(.97);filter:drop-shadow(0 0 14px rgba(92,165,255,.9))}}@keyframes bruteBlockRight{0%,100%{transform:scaleX(-1) translateX(0)}45%{transform:scaleX(-1) translateX(-7px) scale(.97);filter:drop-shadow(0 0 14px rgba(92,165,255,.9))}}@keyframes bruteArriveLeft{0%{transform:translate(-78%,-90px) rotate(-8deg) scale(.9);opacity:0}58%{transform:translate(5%,8px) rotate(2deg) scale(1.02);opacity:1}100%{transform:translate(0,0) rotate(0) scale(1)}}@keyframes bruteArriveRight{0%{transform:scaleX(-1) translate(-78%,-90px) rotate(-8deg) scale(.9);opacity:0}58%{transform:scaleX(-1) translate(5%,8px) rotate(2deg) scale(1.02);opacity:1}100%{transform:scaleX(-1) translate(0,0) rotate(0) scale(1)}}@keyframes bruteWindupFast{0%{transform:rotate(0)}100%{transform:rotate(-32deg) translate(-4px,-2px)}}@keyframes bruteWindupHeavy{0%{transform:rotate(0)}55%{transform:rotate(-58deg) translate(-8px,-6px)}100%{transform:rotate(-45deg) translate(-5px,-4px)}}@keyframes bruteWindupRanged{0%{transform:rotate(0)}100%{transform:rotate(-38deg) translate(-8px,-8px)}}@keyframes bruteWindupFlexible{0%{transform:rotate(0)}55%{transform:rotate(-46deg) translate(-5px,-4px)}100%{transform:rotate(-22deg) translate(3px,-2px)}}@keyframes bruteStaggerLeft{0%,100%{transform:translateX(0)}13%{transform:translateX(calc(var(--knock) * -1)) rotate(-2deg);filter:brightness(1.9)}30%{transform:translateX(calc(var(--knock) * -.55)) rotate(1deg)}46%{transform:translateX(calc(var(--knock) * -.76))}64%{transform:translateX(calc(var(--knock) * -.34))}82%{transform:translateX(calc(var(--knock) * -.14))}}@keyframes bruteStaggerRight{0%,100%{transform:scaleX(-1) translateX(0)}13%{transform:scaleX(-1) translateX(calc(var(--knock) * -1)) rotate(-2deg);filter:brightness(1.9)}30%{transform:scaleX(-1) translateX(calc(var(--knock) * -.55)) rotate(1deg)}46%{transform:scaleX(-1) translateX(calc(var(--knock) * -.76))}64%{transform:scaleX(-1) translateX(calc(var(--knock) * -.34))}82%{transform:scaleX(-1) translateX(calc(var(--knock) * -.14))}}',
    '@media(max-width:760px){.brute-choice-grid{grid-template-columns:1fr}.brute-tcg-head{align-items:flex-start;flex-direction:column}.brute-choice{min-height:178px}.brute-app{padding:9px}.brute-menu-grid{grid-template-columns:1fr;padding:14px;min-height:0}.brute-camp-grid{grid-template-columns:1fr}.brute-camp-avatar{order:-1;min-height:320px}.brute-camp-avatar .ga-brute-svg{width:260px}.brute-camp-scene{padding:11px}.brute-camp-sign{font-size:21px}.brute-menu-avatar{order:-1}.brute-menu-side{grid-template-columns:1fr 1fr}.brute-title-screen{min-height:0}.brute-logo{font-size:32px}.brute-create,.brute-dashboard,.brute-equipment,.brute-sleep{grid-template-columns:1fr}.brute-create-preview{min-height:350px}.brute-create-preview .ga-brute-svg{width:280px}.brute-create-controls{max-height:none}.brute-stat-grid{grid-template-columns:1fr 1fr}.brute-arena{min-height:440px}.brute-fighters{padding:0 0%;bottom:43px}.brute-fighter .ga-brute-svg{width:220px}.brute-hud{inset:8px 7px auto;grid-template-columns:1fr 39px 1fr;gap:5px}.brute-round{height:34px}.brute-choice-grid{grid-template-columns:1fr}.brute-rank-row{grid-template-columns:30px 1fr auto}.brute-rank-row .extra{display:none}.brute-real-grid{grid-template-columns:1fr 1fr}.brute-selector-avatar{width:44px;height:44px}.brute-fight-summary{grid-template-columns:1fr}}',
    '.brute-mybrute-create{width:min(420px,100%);margin:22px auto 0;padding:0 0 28px}.brute-mybrute-paper{position:relative;min-height:500px;padding:18px 26px 24px;border:4px solid #6e3a1f;border-radius:12px;background:radial-gradient(circle at 50% 17%,rgba(255,248,201,.95),rgba(239,214,154,.97) 34%,rgba(205,158,88,.98) 100%);box-shadow:inset 0 0 0 3px rgba(255,244,196,.58),0 8px 0 #4d2513,0 20px 42px rgba(0,0,0,.28);color:#65361e}.brute-mybrute-paper:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.14;background:repeating-linear-gradient(0deg,transparent 0 8px,rgba(87,45,20,.14) 9px 10px)}.brute-mybrute-heading{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:7px;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.06em}.brute-mybrute-heading b{font-size:18px;transform:rotate(10deg)}.brute-mybrute-name-row{position:relative;z-index:3;display:grid;grid-template-columns:1fr 42px;gap:7px;width:min(245px,100%);margin:0 auto}.brute-mybrute-name{min-width:0;border:3px solid #6a361c;border-radius:5px;background:#fff4c5;color:#60321b;padding:8px 9px;text-align:center;font-size:13px;font-weight:1000;box-shadow:inset 0 0 0 2px rgba(147,83,36,.14)}.brute-mybrute-lock{border:3px solid #6a361c;border-radius:6px;background:linear-gradient(#e7b65f,#bb6b2c);color:#542710;font-size:18px;cursor:pointer}.brute-mybrute-lock.locked{background:linear-gradient(#8ed88d,#4d9d58)}.brute-mybrute-status{position:relative;z-index:2;margin:7px auto 0;text-align:center;font-size:7px;font-weight:1000;letter-spacing:.12em;color:#8b5a35}.brute-mybrute-character{position:relative;z-index:2;height:238px;display:flex;align-items:flex-start;justify-content:center;padding-top:10px}.brute-mybrute-character .ga-brute-svg{width:116px;max-height:218px;filter:drop-shadow(0 8px 6px rgba(74,39,18,.22));animation:bruteIdle 2.8s ease-in-out infinite}.brute-mybrute-tools{position:relative;z-index:3;display:flex;justify-content:space-between;gap:34px;width:min(300px,100%);margin:-8px auto 0}.brute-mybrute-tool{width:112px;height:86px;border:3px solid #6b371c;border-radius:11px;background:linear-gradient(180deg,#f2d98f,#c88a41);box-shadow:inset 0 0 0 2px rgba(255,249,204,.48),0 4px 0 #5a2a16;color:#65331a;font-size:8px;font-weight:1000;text-transform:uppercase;cursor:pointer}.brute-mybrute-tool:hover{filter:brightness(1.07);transform:translateY(-1px)}.brute-mybrute-tool .icon{display:block;margin-bottom:3px;font-size:31px}.brute-mybrute-help{position:relative;z-index:2;width:min(300px,100%);margin:15px auto 10px;text-align:center;color:#80512f;font-size:8px;line-height:1.45;font-weight:800}.brute-mybrute-validate{position:relative;z-index:3;display:block;width:min(245px,100%);margin:0 auto;border:4px solid #6a361b;border-radius:8px;padding:11px 12px;background:linear-gradient(180deg,#d98d3f,#9f4f24);box-shadow:inset 0 0 0 3px rgba(255,214,125,.4),0 5px 0 #4d2412;color:#fff2b1;font-size:11px;font-weight:1000;letter-spacing:.06em;text-shadow:0 2px #4e2410;cursor:pointer}.brute-mybrute-validate:disabled{opacity:.5;cursor:wait}',
    '.brute-menu-avatar .ga-brute-svg{width:min(185px,72%)}.brute-camp-avatar .ga-brute-svg{width:min(190px,72%)}.brute-fighter .ga-brute-svg{width:min(190px,58%)}',
    '@media(max-width:760px){.brute-mybrute-create{margin-top:8px}.brute-mybrute-paper{min-height:470px;padding:14px 16px 21px}.brute-mybrute-character{height:216px}.brute-mybrute-character .ga-brute-svg{width:105px;max-height:198px}.brute-mybrute-tools{gap:22px}.brute-menu-avatar .ga-brute-svg,.brute-camp-avatar .ga-brute-svg{width:min(150px,66%)}.brute-fighter .ga-brute-svg{width:min(135px,56%)}}',
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
  let draft = randomAppearance()
  let draftName = ''
  let draftFixed = false
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
  let idleSnapshot = null
  let idleSnapshotAt = Date.now()
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
      idleResult,
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
      supabase.rpc('idle_get_snapshot_v1',{
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
    idleSnapshot = idleResult.error
      ? null
      : (
          Array.isArray(idleResult.data)
            ? idleResult.data[0]
            : idleResult.data
        )

    idleSnapshotAt = Date.now()

    const storedVersion =
      num(
        brute.appearance?.v,
        0
      )

    const needsCreation =
      !brute.appearance_locked_at ||
      storedVersion !==
        BRUTE_APPEARANCE_VERSION

    if (needsCreation) {
      const canReuseDraft =
        storedVersion ===
          BRUTE_APPEARANCE_VERSION &&
        Object.keys(
          brute.appearance ||
          {}
        ).length > 0

      const storedAppearance =
        canReuseDraft
          ? clone(
              brute.appearance
            )
          : null

      draft =
        storedAppearance
          ? {
              ...clone(
                DEFAULT_APPEARANCE
              ),
              ...storedAppearance,
              colors:
                Array.isArray(
                  storedAppearance.colors
                )
                  ? [
                      ...storedAppearance.colors,
                    ]
                  : [
                      ...DEFAULT_APPEARANCE.colors,
                    ],
              v:
                BRUTE_APPEARANCE_VERSION,
            }
          : randomAppearance()

      draftName =
        brute.name ||
        selectedAthlete()?.name ||
        selectedSlug

      draftFixed = false
      screen = 'creator'
    } else if (
      screen === 'selector' ||
      screen === 'creator'
    ) {
      screen = 'menu'
    }

    if (renderAfter) render()
  }

  async function loadSleep() {
    const result = await supabase.rpc('idle_get_snapshot_v1',{
      p_athlete_slug:selectedSlug,
    })

    if (!result.error) {
      idleSnapshot = Array.isArray(result.data)
        ? result.data[0]
        : result.data

      idleSnapshotAt = Date.now()
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

  function athleteAvatarMarkup(athlete) {
    const raw =
      String(
        athlete?.profileImage ||
        ''
      ).trim()

    const src =
      !raw
        ? ''
        : (
            raw.startsWith('data:') ||
            raw.startsWith('http://') ||
            raw.startsWith('https://') ||
            raw.startsWith('/')
          )
          ? raw
          : '/' + raw

    return src
      ? '<span class="brute-selector-avatar"><img src="' + esc(src) + '" alt=""></span>'
      : '<span class="brute-selector-avatar">' + esc(athlete?.emoji || '🏋️') + '</span>'
  }

  function renderSelector() {
    return '<div class="brute-panel brute-pad">'+
      '<div><small style="color:#858ca8;font-weight:900">IDLE TRAINING · GA BRUTE</small><h2>Choisir un athlète</h2><p style="margin:4px 0 13px;color:#747c98;font-size:9px">Sommeil · steps · séances · personnage · PvE · Duel</p></div>'+
      '<div class="brute-list">'+
        athletes.map(a =>
          '<button class="brute-row brute-secondary" data-brute-select="'+esc(athleteSlug(a))+'">'+
            athleteAvatarMarkup(a)+
            '<span><b>'+esc(a.name || a.id)+'</b><small>Ouvrir son Idle Training</small></span>'+
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

  function creatorSection(
    title,
    icon,
    content,
    randomKey = ''
  ) {
    return '<div class="brute-creator-section">'+
      '<div class="brute-creator-section-title"><span>'+esc(icon+' '+title)+'</span>'+
        (
          randomKey
            ? '<button type="button" class="brute-section-random" data-brute-random-section="'+esc(randomKey)+'" title="Randomiser cette partie">🎲</button>'
            : ''
        )+
      '</div>'+
      '<div class="brute-creator-section-body">'+content+'</div>'+
    '</div>'
  }

  function randomizeDraftSection(section) {
    const random = randomAppearance()
    const groups = {
      morphology:[
        'body',
        'head',
        'skin',
      ],
      face:[
        'eyes',
        'nose',
        'mouth',
        'marking',
      ],
      hair:[
        'hair',
        'hairColor',
        'beard',
      ],
      outfit:[
        'top',
        'bottom',
        'colors',
      ],
      accessory:[
        'acc',
      ],
    }

    const keys =
      groups[
        String(section || '')
      ] || []

    for (const key of keys) {
      draft[key] =
        clone(
          random[key]
        )
    }
  }

  function renderCreator() {
    const status =
      draftFixed
        ? 'APPARENCE VERROUILLÉE'
        : 'APPARENCE LIBRE'

    return '<section class="brute-mybrute-create">'+
      '<div class="brute-mybrute-paper">'+
        '<div class="brute-mybrute-heading">'+
          '<span>Choisis ton nom</span>'+
          '<b>➜</b>'+
        '</div>'+
        '<div class="brute-mybrute-name-row">'+
          '<input class="brute-mybrute-name" maxlength="28" data-brute-name value="'+esc(draftName)+'" placeholder="Nom de la brute">'+
          '<button type="button" class="brute-mybrute-lock '+(draftFixed ? 'locked' : '')+'" data-brute-lock title="'+esc(status)+'">'+
            (draftFixed ? '🔒' : '🔓')+
          '</button>'+
        '</div>'+
        '<div class="brute-mybrute-status">'+esc(status)+'</div>'+
        '<div class="brute-mybrute-character" data-brute-creator-preview>'+
          renderBruteSvg(
            draft,
            {
              label:'Ma brute',
            }
          )+
        '</div>'+
        '<div class="brute-mybrute-tools">'+
          '<button type="button" class="brute-mybrute-tool" data-brute-change-appearance>'+
            '<span class="icon">👤</span>'+
            '<span>Changer<br>l’apparence</span>'+
          '</button>'+
          '<button type="button" class="brute-mybrute-tool" data-brute-change-colors>'+
            '<span class="icon">🎨</span>'+
            '<span>Changer<br>les couleurs</span>'+
          '</button>'+
        '</div>'+
        '<p class="brute-mybrute-help">Comme dans My Brute : choisis une combinaison, change les couleurs, verrouille-la puis valide.</p>'+
        '<button class="brute-mybrute-validate" data-brute-create '+(busy ? 'disabled' : '')+'>'+
          (busy ? 'CRÉATION…' : 'VALIDER MA BRUTE')+
        '</button>'+
      '</div>'+
    '</section>'
  }

  function renderMenu() {
    const t = theme()
    const weaponId = brute.loadout?.weapon || 'fists'
    const weapon = BRUTE_WEAPONS[weaponId] || BRUTE_WEAPONS.fists
    const pet = BRUTE_PETS[(brute.pets || [])[0]]

    return '<section class="brute-title-screen">'+
      '<div class="brute-logo">IDLE TRAINING</div>'+
      '<div class="brute-title-sub">GA BRUTE · TRAIN · WALK · SLEEP · FIGHT</div>'+
      '<div class="brute-menu-grid">'+
        '<div class="brute-menu-side">'+
          '<button class="brute-wood" data-brute-screen="camp">⛺ CAMP<small>Séances · steps · sommeil · progression</small></button>'+
          '<button class="brute-wood" data-brute-screen="pve">⚔️ PVE<small>Combat d’entraînement</small></button>'+
          '<button class="brute-wood" data-brute-screen="ranking">🏆 CLASSEMENT<small>Toutes les brutes</small></button>'+
        '</div>'+
        '<div class="brute-menu-avatar">'+
          renderBruteSvg(brute.appearance,{label:brute.name,weapon,pet})+
          '<div class="brute-nameplate">'+esc(t.emoji)+' '+esc(brute.name)+'</div>'+
          '<div class="brute-menu-stats">'+
            '<div class="brute-menu-stat"><b>'+num(brute.level,1)+'</b><span>Niveau</span></div>'+
            '<div class="brute-menu-stat"><b>'+num(idleSnapshot?.steps,0)+'</b><span>Steps</span></div>'+
            '<div class="brute-menu-stat"><b>'+Math.round(num(idleSnapshot?.sleep_seconds,0)/3600*10)/10+'h</b><span>Sommeil</span></div>'+
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

  function rewardTypeLabel(
    choice
  ) {
    const labels = {
      stat:'STAT',
      weapon:'ARME',
      skill:'SKILL',
      pet:'FAMILIER',
    }

    return (
      labels[
        choice?.type
      ] ||
      'BONUS'
    )
  }

  function rewardCurrentValue(
    choice
  ) {
    if (
      choice?.type !==
        'stat'
    ) {
      return ''
    }

    const labels = {
      hp:'PV',
      strength:'FORCE',
      agility:'AGILITÉ',
      speed:'VITESSE',
    }

    const current =
      num(
        brute?.[
          choice.id
        ],
        0
      )

    const amount =
      num(
        choice.amount,
        0
      )

    return (
      (labels[choice.id] || 'STAT') +
      ' · ' +
      current +
      ' → ' +
      (
        current +
        amount
      )
    )
  }

  function renderRewardCard(
    choice,
    index
  ) {
    const rarity =
      String(
        choice?.rarity ||
        'common'
      )

    const rarityLabel =
      choice?.rarity_label ||
      (
        rarity === 'legendary'
          ? 'LÉGENDAIRE'
          : rarity === 'epic'
            ? 'ÉPIQUE'
            : rarity === 'rare'
              ? 'RARE'
              : 'COMMUNE'
      )

    return (
      '<button class="brute-choice rarity-'+esc(rarity)+'" data-brute-choice="'+index+'">'+
        '<span class="brute-card-rarity"><span>'+esc(rarityLabel)+'</span><i></i></span>'+
        '<span class="big">'+esc(choice?.icon || '⭐')+'</span>'+
        '<b>'+esc(choice?.name || 'Bonus')+'</b>'+
        '<small>'+esc(choice?.description || 'Amélioration permanente de ta brute.')+'</small>'+
        '<span class="brute-card-type">'+esc(rewardTypeLabel(choice))+'</span>'+
        (
          rewardCurrentValue(choice)
            ? '<div class="brute-card-current">'+esc(rewardCurrentValue(choice))+'</div>'
            : ''
        )+
        '<span class="brute-card-pick">CHOISIR →</span>'+
      '</button>'
    )
  }

  function renderTcgPack(
    choices,
    compact = false
  ) {
    if (
      !Array.isArray(choices) ||
      !choices.length
    ) {
      return ''
    }

    const rewardLevel =
      num(
        choices[0]
          ?.reward_level,
        brute?.pending_reward_level ||
        brute?.level ||
        1
      )

    return (
      '<section class="brute-tcg-pack '+(compact?'compact':'')+'">'+
        '<div class="brute-tcg-head">'+
          '<div><span>LEVEL UP · TCG PACK</span><h3>Niveau '+rewardLevel+' · choisis 1 carte</h3></div>'+
          '<small>1 choix définitif · 3 cartes</small>'+
        '</div>'+
        '<div class="brute-choice-grid">'+
          choices
            .slice(0,3)
            .map(
              (choice,index) =>
                renderRewardCard(
                  choice,
                  index
                )
            )
            .join('')+
        '</div>'+
      '</section>'
    )
  }

  function renderChoices() {
    return renderTcgPack(
      levelChoices
    )
  }

  function passiveEnergyNow() {
    const stored =
      num(
        idleSnapshot?.idle_energy,
        0
      )

    const anchor =
      idleSnapshot?.last_claim_at

    if (!anchor) {
      return Math.max(
        0,
        Math.min(
          500,
          stored
        )
      )
    }

    const elapsedMinutes =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            new Date(
              anchor
            ).getTime()
          ) /
          60000
        )
      )

    return Math.max(
      0,
      Math.min(
        500,
        stored +
        elapsedMinutes
      )
    )
  }

  function sleepScoreNow() {
    const base =
      num(
        idleSnapshot?.sleep_score,
        0
      )

    if (
      !idleSnapshot
        ?.active_sleep_started_at
    ) {
      return Math.max(
        0,
        Math.min(
          100,
          base
        )
      )
    }

    const extraSeconds =
      Math.max(
        0,
        (
          Date.now() -
          idleSnapshotAt
        ) / 1000
      )

    return Math.max(
      0,
      Math.min(
        100,
        base +
        Math.round(
          extraSeconds /
          28800 *
          100
        )
      )
    )
  }

  function sleepXpBonusNow() {
    return Math.round(
      sleepScoreNow() *
      .22
    )
  }

  function renderCamp() {
    const pct =
      Math.min(
        100,
        Math.round(
          num(brute.xp) /
          Math.max(
            1,
            xpNeeded()
          ) *
          100
        )
      )

    const recent =
      history.slice(0,6)

    const energy =
      passiveEnergyNow()

    const energyPct =
      Math.max(
        0,
        Math.min(
          100,
          energy / 500 * 100
        )
      )

    const asleep =
      Boolean(
        idleSnapshot?.active_sleep_started_at
      )

    const weaponId =
      brute.loadout?.weapon ||
      'fists'

    const weapon =
      BRUTE_WEAPONS[weaponId] ||
      BRUTE_WEAPONS.fists

    const pet =
      BRUTE_PETS[
        (brute.pets || [])[0]
      ]

    return topBar('Camp','Idle Training')+
      '<section class="brute-camp-scene">'+
        '<div class="brute-camp-sign">⛺ CAMP</div>'+
        '<div class="brute-camp-grid">'+
          '<div class="brute-camp-column">'+
            '<div class="brute-camp-card">'+
              '<h3>🏋️ ENTRAÎNEMENT</h3>'+
              '<div class="brute-camp-kpi">'+
                '<div><span>Séries</span><b>'+num(idleSnapshot?.training_sets,0)+'</b></div>'+
                '<div><span>Score</span><b>'+num(idleSnapshot?.training_score,0)+'/100</b></div>'+
              '</div>'+
              '<small>Les séances terminées renforcent ta puissance de combat.</small>'+
            '</div>'+
            '<div class="brute-camp-card">'+
              '<h3>🚶 ACTIVITÉ</h3>'+
              '<div class="brute-camp-kpi">'+
                '<div><span>Steps</span><b>'+num(idleSnapshot?.steps,0)+'</b></div>'+
                '<div><span>Score</span><b>'+num(idleSnapshot?.steps_score,0)+'/100</b></div>'+
              '</div>'+
              '<small>Les pas améliorent agilité/vitesse et ajoutent jusqu’à +18 XP sur une victoire. Bonus actuel : +'+Math.round(num(idleSnapshot?.steps_score,0)*.18)+' XP.</small>'+
            '</div>'+
            '<button class="brute-camp-action" data-brute-screen="equipment">🎒 ÉQUIPEMENT</button>'+
            '<button class="brute-camp-action" data-brute-screen="duel">🥊 ALLER AU DUEL</button>'+
          '</div>'+

          '<div class="brute-camp-avatar">'+
            renderBruteSvg(
              brute.appearance,
              {
                label:brute.name,
                weapon,
                pet,
              }
            )+
            '<div class="brute-nameplate">'+esc(brute.name)+' · NIV. '+num(brute.level,1)+'</div>'+
            '<div class="brute-camp-energy">'+
              '<div class="brute-camp-energy-head"><span>⚡ ÉNERGIE · +1 / MIN</span><span data-brute-energy-value>'+energy+' / 500</span></div>'+
              '<div class="brute-camp-energy-track"><i data-brute-energy-bar style="width:'+energyPct+'%"></i></div>'+
              '<div class="brute-camp-xp">'+
                '<div class="brute-camp-energy-head"><span>✨ XP</span><span>'+num(brute.xp)+' / '+xpNeeded()+'</span></div>'+
                '<div class="brute-track"><i style="width:'+pct+'%"></i></div>'+
              '</div>'+
            '</div>'+
            '<small style="margin-top:7px;color:#744725;font-weight:900">Régénération passive : 1 énergie chaque minute, même hors de l’app.</small>'+
            renderChoices()+
          '</div>'+

          '<div class="brute-camp-column">'+
            '<div class="brute-camp-card">'+
              '<h3>🌙 RÉCUPÉRATION</h3>'+
              '<div class="brute-camp-kpi">'+
                '<div><span>Sommeil</span><b>'+Math.round(num(idleSnapshot?.sleep_seconds,0)/3600*10)/10+' h</b></div>'+
                '<div><span>Score</span><b>'+num(idleSnapshot?.sleep_score,0)+'/100</b></div>'+
              '</div>'+
              '<small>Le sommeil sert uniquement à l’XP. Jusqu’à +22 XP par victoire. Bonus actuel : +'+Math.round(num(idleSnapshot?.sleep_score,0)*.22)+' XP.</small>'+
            '</div>'+
            '<button class="brute-camp-action sleep" data-brute-go-sleep>'+
              (
                asleep
                  ? '🌙 SOMMEIL EN COURS · XP +'+sleepXpBonusNow()
                  : '🌙 ALLER SE COUCHER'
              )+
            '</button>'+
            '<div class="brute-camp-card">'+
              '<h3>⚡ PUISSANCE DU JOUR</h3>'+
              '<div class="brute-camp-kpi">'+
                '<div><span>Puissance</span><b>'+num(idleSnapshot?.power,35)+'</b></div>'+
                '<div><span>Énergie</span><b>+1/min</b></div>'+
              '</div>'+
              '<small>Entraînement + steps influencent le combat. Le sommeil influence uniquement l’XP gagnée.</small>'+
            '</div>'+
            '<div class="brute-camp-card brute-camp-history">'+
              '<h3>⚔️ DERNIERS COMBATS</h3>'+
              '<div class="brute-list">'+
                (
                  recent.length
                    ? recent.map(f => {
                        const opp =
                          f.attacker_slug === selectedSlug
                            ? f.defender_slug
                            : f.attacker_slug

                        const win =
                          f.winner_slug === selectedSlug

                        return '<div class="brute-row"><span class="icon">'+(win?'🏆':'💀')+'</span><span><b>'+esc(opp)+'</b><small>+'+num(f.xp_gained)+' XP</small></span><button class="brute-mini" data-brute-replay="'+esc(f.id)+'">Replay</button></div>'
                      }).join('')
                    : '<small>Aucun combat depuis le reset.</small>'
                )+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</section>'
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

  function normalizedRivalScore(rival) {
    if (rival.metric === 'GLP') {
      return Math.max(
        0,
        Math.min(
          1,
          (
            num(rival.points,75) -
            75
          ) / 30
        )
      )
    }

    return Math.max(
      0,
      Math.min(
        1,
        (
          num(rival.points,400) -
          400
        ) / 150
      )
    )
  }

  function pveOpponent(seed) {
    const random =
      createSeededRandom(seed)

    const roster =
      [
        ...OPENPOWERLIFTING_FFFORCE_RIVALS,
      ].sort(
        (a,b) =>
          normalizedRivalScore(a) -
          normalizedRivalScore(b)
      )

    const maxIndex =
      Math.min(
        roster.length - 1,
        5 +
        Math.max(
          1,
          num(brute.level,1)
        ) * 2
      )

    const rival =
      roster[
        Math.floor(
          random() *
          Math.max(
            1,
            maxIndex + 1
          )
        )
      ] ||
      roster[0]

    const rankFactor =
      normalizedRivalScore(
        rival
      )

    const levelShift =
      random() < .56
        ? -1
        : random() < .82
          ? 0
          : 1

    const level =
      Math.max(
        1,
        num(brute.level,1) +
        levelShift
      )

    const pveScale =
      .70 +
      rankFactor * .10

    const strengthBias =
      (
        num(rival.squat,200) +
        num(rival.deadlift,220) -
        420
      ) / 220

    const agilityBias =
      (
        95 -
        num(rival.bodyweight,85)
      ) / 28

    const speedBias =
      (
        rankFactor -
        .45
      ) * 2.1

    const strength =
      Math.max(
        5,
        Math.round(
          num(brute.strength,10) *
          pveScale +
          strengthBias
        )
      )

    const agility =
      Math.max(
        5,
        Math.round(
          num(brute.agility,10) *
          pveScale +
          agilityBias
        )
      )

    const speed =
      Math.max(
        5,
        Math.round(
          num(brute.speed,10) *
          pveScale +
          speedBias
        )
      )

    const hp =
      Math.max(
        58,
        Math.round(
          num(brute.hp,100) *
          (
            .72 +
            rankFactor * .08
          )
        )
      )

    const weaponRoll =
      random()

    const weapon =
      weaponRoll > .82
        ? 'plate20'
        : weaponRoll > .55
          ? 'kettlebell'
          : 'fists'

    return {
      slug:
        'openpower-'+
        seed,
      name:rival.name,
      level,
      hp,
      strength,
      agility,
      speed,
      weapons:
        weapon === 'fists'
          ? ['fists']
          : [
              weapon,
              'fists',
            ],
      skills:
        rankFactor > .78 &&
        random() > .76
          ? ['lockout']
          : [],
      pets:[],
      appearance:
        randomAppearance(
          random
        ),
      activity:{
        training_score:
          22 +
          Math.floor(
            random() * 30
          ),
        steps_score:
          18 +
          Math.floor(
            random() * 34
          ),
        sleep_score:
          18 +
          Math.floor(
            random() * 34
          ),
        power:
          70 +
          Math.floor(
            rankFactor * 55
          ),
      },
      loadout:{
        weapon,
      },
      openpowerlifting:{
        total:
          rival.total,
        squat:
          rival.squat,
        bench:
          rival.bench,
        deadlift:
          rival.deadlift,
        metric:
          rival.metric,
        points:
          rival.points,
        bodyweight:
          rival.bodyweight,
      },
    }
  }

  function renderPve() {
    const energy =
      passiveEnergyNow()

    const canFight =
      energy >= 8

    return topBar('PvE','Entraînement')+
      '<section class="brute-panel brute-pad" style="text-align:center">'+
        '<div style="font-size:54px">🏋️</div><h2>OpenPower PvE</h2>'+
        '<p style="max-width:620px;margin:0 auto;color:#858ca8;font-size:10px;line-height:1.6">Tu affrontes des profils générés à partir de noms et performances FFForce présents dans OpenPowerlifting. Les meilleurs GL Points / DOTS apparaissent progressivement, mais le PvE est volontairement plus accessible que le Duel.</p>'+
        '<div style="display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin:12px 0 4px">'+
          '<span class="brute-activity-pill">⚡ Coût 8 énergie</span>'+
          '<span class="brute-activity-pill">🔋 <b data-brute-pve-energy>'+energy+'</b> / 500</span>'+
          '<span class="brute-activity-pill">⏱️ +1/min</span>'+
        '</div>'+
        '<p style="max-width:560px;margin:8px auto 0;color:#858ca8;font-size:9px;line-height:1.5">Victoire : XP de base + bonus steps + sommeil + entraînement. Le Duel reste plus rentable.</p>'+
        '<div class="brute-actions" style="justify-content:center"><button class="brute-primary" data-brute-pve '+(canFight ? '' : 'disabled')+'>'+(
          canFight
            ? '⚔️ Lancer le combat'
            : '⚡ Énergie insuffisante'
        )+'</button></div>'+
      '</section>'
  }

  function renderEquipment() {
    const equipped =
      brute.loadout?.weapon ||
      'fists'

    return topBar(
      'Équipement / Skin',
      'Build'
    )+
      '<div class="brute-equipment">'+
        '<section class="brute-panel brute-equipment-preview">'+
          renderBruteSvg(
            brute.appearance,
            {
              label:brute.name,
              weapon:
                BRUTE_WEAPONS[
                  equipped
                ],
              pet:
                BRUTE_PETS[
                  (brute.pets || [])[0]
                ],
            }
          )+
          '<div class="brute-actions" style="justify-content:center;padding:0 14px 16px">'+
            '<button class="brute-primary" data-brute-reroll-skin '+(busy ? 'disabled' : '')+'>🎲 NOUVEAU SKIN ALÉATOIRE</button>'+
            '<button class="brute-secondary" data-brute-reroll-colors '+(busy ? 'disabled' : '')+'>🎨 COULEURS ALÉATOIRES</button>'+
          '</div>'+
        '</section>'+
        '<section class="brute-panel brute-pad">'+
          '<small style="color:var(--accent);font-weight:1000">STYLE MODIFIABLE À VOLONTÉ</small>'+
          '<h2 style="margin:5px 0 8px">'+esc(brute.name)+'</h2>'+
          '<p style="color:#858ca8;font-size:10px;line-height:1.55">Tu peux relancer ton apparence autant de fois que tu veux. Cela ne change ni ton niveau, ni tes stats, ni tes armes, ni tes compétences.</p>'+
          '<h3>Armes équipables</h3>'+
          '<div class="brute-chip-row">'+
            (brute.weapons || []).map(id => {
              const w =
                BRUTE_WEAPONS[id] ||
                {
                  name:id,
                  icon:'⚔️',
                }

              return '<button class="brute-chip '+(equipped===id?'active':'')+'" data-brute-equip="'+esc(id)+'">'+esc(w.icon+' '+w.name)+'</button>'
            }).join('')+
          '</div>'+
          '<h3>Compétences</h3>'+
          '<div class="brute-chip-row">'+
            (
              (brute.skills || []).length
                ? (brute.skills || []).map(id => {
                    const s =
                      BRUTE_SKILLS[id] ||
                      {
                        name:id,
                        icon:'✨',
                      }

                    return '<span class="brute-chip">'+esc(s.icon+' '+s.name)+'</span>'
                  }).join('')
                : '<span style="color:#747c98;font-size:9px">Aucune pour le moment.</span>'
            )+
          '</div>'+
          '<h3>Familiers</h3>'+
          '<div class="brute-chip-row">'+
            (
              (brute.pets || []).length
                ? (brute.pets || []).map(id => {
                    const p =
                      BRUTE_PETS[id] ||
                      {
                        name:id,
                        emoji:'🐾',
                      }

                    return '<span class="brute-chip">'+esc(p.emoji+' '+p.name)+'</span>'
                  }).join('')
                : '<span style="color:#747c98;font-size:9px">0 / 3</span>'
            )+
          '</div>'+
          (
            options.isCoach
              ? '<div class="brute-actions"><button class="brute-secondary" data-brute-reset>♻️ Refaire la création complète</button></div>'
              : ''
          )+
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
    const active =
      idleSnapshot?.active_sleep_started_at

    const baseSeconds =
      num(
        idleSnapshot?.sleep_seconds
      )

    const liveSeconds =
      active
        ? Math.max(
            0,
            (
              Date.now() -
              new Date(active).getTime()
            ) / 1000
          )
        : 0

    return topBar('Sommeil','Récupération')+
      '<div class="brute-sleep">'+
        '<section class="brute-panel brute-moon">'+
          '<div class="moon">☾</div>'+
          '<div class="brute-sleep-time" data-brute-sleep-time>'+
            sleepLabel(
              active
                ? liveSeconds
                : baseSeconds
            )+
          '</div>'+
          '<small style="color:#858ca8">'+
            (
              active
                ? 'Sommeil en cours'
                : 'Sommeil enregistré aujourd’hui'
            )+
          '</small>'+
          '<div class="brute-sleep-energy">'+
            '<b data-brute-sleep-xp>✨ Bonus XP +'+sleepXpBonusNow()+'</b>'+
            '<small>8 h de sommeil = score 100/100 = jusqu’à +22 XP par victoire. Aucun gain d’énergie ici.</small>'+
          '</div>'+
          '<button class="brute-primary" style="margin-top:18px" data-brute-sleep-toggle>'+
            (
              active
                ? '☀️ Je me réveille'
                : '🌙 Démarrer mon sommeil'
            )+
          '</button>'+
        '</section>'+
        '<aside class="brute-panel brute-pad">'+
          '<h3>Ambiance</h3>'+
          '<p style="color:#858ca8;font-size:10px;line-height:1.6">Le chrono tourne côté serveur même si tu fermes l’app. Le sommeil augmente uniquement ton bonus d’XP. L’énergie, elle, revient automatiquement à raison de +1 par minute.</p>'+
          '<div class="brute-sound-grid">'+
            [['rain','🌧️ Pluie'],['brown','🟤 Bruit brun'],['temple','🕯️ Temple'],['none','🔇 Silence']].map(([key,label]) =>
              '<button class="brute-secondary '+(sleepMode===key?'active':'')+'" data-brute-sound="'+key+'">'+label+'</button>'
            ).join('')+
          '</div>'+
        '</aside>'+
      '</div>'
  }

  function fighterGraphic(
    fighter,
    side,
    weaponId
  ) {
    const weapon =
      BRUTE_WEAPONS[weaponId] ||
      BRUTE_WEAPONS.fists

    const pet =
      BRUTE_PETS[
        (fighter.pets || [])[0]
      ]

    return renderBruteSvg(
      fighter.appearance,
      {
        label:fighter.name,
        weapon,
      }
    )+
    (
      pet
        ? '<div class="brute-pet-slot">'+
            renderPetSvg(
              pet,
              side === 'right'
                ? 'left'
                : 'right'
            )+
          '</div>'
        : ''
    )
  }

  function syncFightWeapon(
    side,
    tl,
    weaponId
  ) {
    const el =
      root.querySelector(
        '[data-fighter="'+side+'"]'
      )

    if (!el) return

    const next =
      String(
        weaponId ||
        'fists'
      )

    if (
      el.dataset.weaponCurrent ===
      next
    ) {
      return
    }

    const fighter =
      side === 'left'
        ? tl.left
        : tl.right

    el.innerHTML =
      fighterGraphic(
        fighter,
        side,
        next
      )

    el.dataset.weaponCurrent =
      next
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
      '<div class="brute-stagefx" data-brute-stagefx></div>'+
      '<div class="brute-hud">'+
        '<div class="brute-hud-side"><div class="brute-hud-name">'+esc(left.name)+' · Niv. '+num(left.level,1)+'</div><div class="brute-hp"><i data-hp-left style="width:100%"></i></div><div class="brute-hud-name" data-hp-text-left>'+num(left.hpMax)+' / '+num(left.hpMax)+'</div><div class="brute-fatigue"><i data-fatigue-left></i></div><div class="brute-hud-meta"><span class="brute-activity-pill">🏋️ '+num(left.activity?.training,0)+'</span><span class="brute-activity-pill">🚶 '+num(left.activity?.steps,0)+'</span><span class="brute-activity-pill">🌙 '+num(left.activity?.sleep,0)+'</span></div><div class="brute-weapon-label" data-weapon-left>'+esc(leftWeapon.icon+' '+leftWeapon.name)+'</div></div>'+
        '<div class="brute-round" data-brute-round>GO</div>'+
        '<div class="brute-hud-side right"><div class="brute-hud-name">'+esc(right.name)+' · Niv. '+num(right.level,1)+'</div><div class="brute-hp"><i data-hp-right style="width:100%"></i></div><div class="brute-hud-name" data-hp-text-right>'+num(right.hpMax)+' / '+num(right.hpMax)+'</div><div class="brute-fatigue"><i data-fatigue-right></i></div><div class="brute-hud-meta"><span class="brute-activity-pill">🏋️ '+num(right.activity?.training,0)+'</span><span class="brute-activity-pill">🚶 '+num(right.activity?.steps,0)+'</span><span class="brute-activity-pill">🌙 '+num(right.activity?.sleep,0)+'</span></div><div class="brute-weapon-label" data-weapon-right>'+esc(rightWeapon.icon+' '+rightWeapon.name)+'</div></div>'+
      '</div>'+
      '<div class="brute-fighters">'+
        '<div class="brute-fighter left" data-fighter="left" data-weapon-current="'+esc(leftWeapon.id)+'">'+fighterGraphic(left,'left',leftWeapon.id)+'</div>'+
        '<div class="brute-fighter right" data-fighter="right" data-weapon-current="'+esc(rightWeapon.id)+'">'+fighterGraphic(right,'right',rightWeapon.id)+'</div>'+
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
    if (sleepTimer) {
      clearInterval(
        sleepTimer
      )
    }

    sleepTimer = null

    if (
      screen !== 'sleep' &&
      screen !== 'camp' &&
      screen !== 'pve'
    ) {
      return
    }

    sleepTimer =
      setInterval(
        () => {
          const energy =
            passiveEnergyNow()

          const energyEl =
            root.querySelector(
              '[data-brute-energy-value]'
            )

          if (energyEl) {
            energyEl.textContent =
              energy +
              ' / 500'
          }

          const pveEnergyEl =
            root.querySelector(
              '[data-brute-pve-energy]'
            )

          if (pveEnergyEl) {
            pveEnergyEl.textContent =
              String(energy)
          }

          const energyBar =
            root.querySelector(
              '[data-brute-energy-bar]'
            )

          if (energyBar) {
            energyBar.style.width =
              Math.max(
                0,
                Math.min(
                  100,
                  energy / 500 * 100
                )
              ) +
              '%'
          }

          const timeEl =
            root.querySelector(
              '[data-brute-sleep-time]'
            )

          if (
            timeEl &&
            idleSnapshot
              ?.active_sleep_started_at
          ) {
            timeEl.textContent =
              sleepLabel(
                Math.max(
                  0,
                  (
                    Date.now() -
                    new Date(
                      idleSnapshot
                        .active_sleep_started_at
                    ).getTime()
                  ) /
                  1000
                )
              )
          }

          const sleepXpEl =
            root.querySelector(
              '[data-brute-sleep-xp]'
            )

          if (sleepXpEl) {
            sleepXpEl.textContent =
              '✨ Bonus XP +' +
              sleepXpBonusNow()
          }
        },
        1000
      )
  }

  function adjustDraft(key,direction) {
    const maps = {
      body:BRUTE_PARTS.bodies,
      head:BRUTE_PARTS.heads,
      hair:BRUTE_PARTS.hairs,
      beard:BRUTE_PARTS.beards,
      eyes:BRUTE_PARTS.eyes,
      nose:BRUTE_PARTS.noses,
      mouth:BRUTE_PARTS.mouths,
      marking:BRUTE_PARTS.markings,
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

  function fightSfx(type) {
    const map = {
      hit: '/ragnarok-hit.mp3',
      miss: '/ragnarok-miss.mp3',
      critical: '/critical-ragnarok.mp3',
      perfect: '/ragnarok-perfect.mp3',
    }

    const src = map[type]
    if (!src) return

    try {
      const audio = new Audio(src)
      audio.volume = type === 'critical' ? .32 : .20
      void audio.play().catch(() => {})
    } catch {
      // Cosmetic sound only.
    }
  }

  function weaponAnimationClass(weaponId) {
    const category =
      BRUTE_WEAPONS[
        weaponId
      ]?.category ||
      'unarmed'

    if (category === 'heavy') {
      return 'attack-heavy'
    }

    if (category === 'ranged') {
      return 'attack-ranged'
    }

    if (category === 'flexible') {
      return 'attack-flexible'
    }

    return 'attack-fast'
  }

  function eventDelay(event) {
    const delays = {
      START: 180,
      ARRIVE: 620,
      WINDUP:
        event?.category === 'heavy'
          ? 360
          : event?.category === 'ranged'
            ? 300
            : event?.category === 'flexible'
              ? 285
              : 225,
      MOVE: 190,
      MOVE_BACK: 210,
      REPOSITION: 260,
      WEAPON_SWITCH: 430,
      WEAPON_THROW: 260,
      BLOCK: 390,
      COUNTER: 250,
      REST: 430,
      SKILL_ACTIVATE: 520,
      ATTACK: event?.critical ? 560 : 400,
      DODGE: 480,
      MISS: 330,
      COUNTER_READY: 300,
      COMBO: 210,
      DISARM: 480,
      GRIND: 540,
      PET_ATTACK: 410,
      PET_DODGE: 320,
      STUN_SKIP: 480,
      FINISHER: 620,
      KO: 760,
      END: 80,
    }

    return Math.max(
      90,
      num(delays[event?.type], 320) /
      Math.max(.5, playbackSpeed)
    )
  }

  function clearAnimClasses() {
    root.querySelectorAll('.brute-fighter').forEach(el => {
      el.classList.remove(
        'attack-fast',
        'attack-heavy',
        'attack-ranged',
        'attack-flexible',
        'hit',
        'hit-heavy',
        'dodge',
        'guard',
        'stunned',
        'countering',
        'comboing',
        'resting',
        'switching',
        'blocking',
        'arriving',
        'windup-fast',
        'windup-heavy',
        'windup-ranged',
        'windup-flexible',
        'windup-stance-0',
        'windup-stance-1',
        'windup-stance-2',
        'attack-v0',
        'attack-v1',
        'attack-v2',
        'attack-v3',
        'attack-v4',
        'attack-v5',
        'dodge-v0',
        'dodge-v1',
        'dodge-v2',
        'block-v0',
        'block-v1',
        'block-v2',
        'miss-v0',
        'miss-v1',
        'miss-v2',
        'ko-v0',
        'ko-v1',
        'ko-v2',
        'finisher',
        'critical-burst',
        'staggering'
      )
    })
    root.querySelectorAll('.brute-float').forEach(el => el.remove())
    root.querySelectorAll('.brute-impact,.brute-dust,.brute-skill-banner,.brute-projectile,.brute-speedline,.brute-slash-fx,.brute-shockwave,.brute-crit-burst,.brute-miss-swoosh,.brute-parry-spark,.brute-finisher-flare').forEach(el => el.remove())

    const arena =
      root.querySelector('[data-brute-arena]')

    arena?.classList.remove(
      'shake',
      'flash',
      'finisher',
      'impact-heavy',
      'impact-flexible',
      'impact-ranged'
    )
  }

  function fightOffset(el) {
    return num(
      el?.dataset
        ?.fightOffset,
      0
    )
  }

  function setFightOffset(
    el,
    value
  ) {
    if (!el) return

    const bounded =
      Math.max(
        -28,
        Math.min(
          28,
          num(value,0)
        )
      )

    el.dataset.fightOffset =
      String(bounded)

    el.style.setProperty(
      '--fight-offset',
      bounded + '%'
    )
  }

  function nudgeFightOffset(
    el,
    delta
  ) {
    setFightOffset(
      el,
      fightOffset(el) +
      num(delta,0)
    )
  }

  function eventText(event,tl) {
    const actor =
      event.actor === 'left'
        ? tl.left.name
        : tl.right.name

    const target =
      event.target === 'left'
        ? tl.left.name
        : tl.right.name

    if (event.type === 'START') return 'GO !'
    if (event.type === 'ARRIVE') return 'Les brutes entrent dans l’arène.'
    if (event.type === 'WINDUP') return actor+' prépare son attaque.'
    if (event.type === 'REPOSITION') return 'Les combattants se replacent.'
    if (event.type === 'MOVE') return actor+' ferme la distance sur '+target+'.'
    if (event.type === 'MOVE_BACK') return actor+' reprend sa position.'
    if (event.type === 'WEAPON_SWITCH') return actor+' sort '+(BRUTE_WEAPONS[event.weapon]?.name || 'une nouvelle arme')+'.'
    if (event.type === 'WEAPON_THROW') return actor+' lance '+(BRUTE_WEAPONS[event.weapon]?.name || 'son arme')+' !'
    if (event.type === 'BLOCK') return actor+' bloque le coup !'
    if (event.type === 'COUNTER') return actor+' contre immédiatement !'
    if (event.type === 'REST') return actor+' reprend son souffle.'
    if (event.type === 'DODGE') return actor+' esquive !'
    if (event.type === 'MISS') return actor+' rate son attaque.'
    if (event.type === 'COUNTER_READY') return actor+' prépare un contre !'
    if (event.type === 'COMBO') return actor+' enchaîne !'
    if (event.type === 'GRIND') return actor+' active GRIND et survit à 1 PV !'
    if (event.type === 'DISARM') return target+' perd '+(BRUTE_WEAPONS[event.weapon]?.name || 'son arme')+' !'
    if (event.type === 'SKILL_ACTIVATE') return actor+' active '+(BRUTE_SKILLS[event.skill]?.name || event.skill)+' !'
    if (event.type === 'PET_ATTACK') return actor+' reçoit l’aide de son familier.'
    if (event.type === 'PET_DODGE') return target+' esquive le familier.'
    if (event.type === 'STUN_SKIP') return actor+' est étourdi.'
    if (event.type === 'FINISHER') return actor+' déclenche le coup final !'
    if (event.type === 'KO') return target+' est K.O.'
    if (event.type === 'ATTACK') {
      return actor+' inflige '+num(event.damage)+' à '+target+
        (event.critical?' · CRITIQUE':'')+
        (event.lockout?' · LOCKOUT':'')+
        (event.stun?' · PAUSE BENCH':'')+
        (event.blind?' · AVEUGLÉ':'')
    }

    return 'Combat en cours…'
  }

  function applyEvent(event,tl) {
    clearAnimClasses()

    const arena =
      root.querySelector(
        '[data-brute-arena]'
      )

    const fx =
      root.querySelector(
        '[data-brute-stagefx]'
      )

    const leftEl =
      root.querySelector(
        '[data-fighter="left"]'
      )

    const rightEl =
      root.querySelector(
        '[data-fighter="right"]'
      )

    const actorEl =
      event.actor === 'left'
        ? leftEl
        : rightEl

    const targetEl =
      event.target === 'left'
        ? leftEl
        : rightEl

    if (event.type === 'START') {
      setFightOffset(
        leftEl,
        0
      )
      setFightOffset(
        rightEl,
        0
      )
      leftEl?.style.setProperty('--fight-y','0px')
      rightEl?.style.setProperty('--fight-y','0px')
    }

    if (event.type === 'ARRIVE') {
      leftEl?.classList.add('arriving')
      rightEl?.classList.add('arriving')
      leftEl?.style.setProperty('--fight-y',num(event.leftY,0)+'px')
      rightEl?.style.setProperty('--fight-y',num(event.rightY,0)+'px')

      for (const side of ['left','right']) {
        const dust = document.createElement('span')
        dust.className = 'brute-dust'
        dust.style.left = side === 'left' ? '22%' : '70%'
        fx?.appendChild(dust)
      }
    }

    if (event.type === 'WINDUP') {
      const cls =
        event.category === 'heavy'
          ? 'windup-heavy'
          : event.category === 'ranged'
            ? 'windup-ranged'
            : event.category === 'flexible'
              ? 'windup-flexible'
              : 'windup-fast'

      actorEl?.classList.add(
        cls,
        'windup-stance-' +
        (
          Math.abs(
            Math.floor(
              num(
                event.animationVariant,
                0
              )
            )
          ) % 3
        )
      )
    }

    if (event.type === 'REPOSITION') {
      leftEl?.style.setProperty('--fight-y',num(event.leftY,0)+'px')
      rightEl?.style.setProperty('--fight-y',num(event.rightY,0)+'px')

      setFightOffset(
        leftEl,
        Math.abs(
          fightOffset(leftEl)
        ) < 1
          ? 0
          : fightOffset(leftEl) * .45
      )

      setFightOffset(
        rightEl,
        Math.abs(
          fightOffset(rightEl)
        ) < 1
          ? 0
          : fightOffset(rightEl) * .45
      )
    }

    if (event.type === 'MOVE') {
      const reach =
        num(event.reach,1)

      const distance =
        reach >= 1.45
          ? 14
          : reach >= 1.1
            ? 21
            : 29

      setFightOffset(
        actorEl,
        event.actor === 'left'
          ? distance
          : -distance
      )

      const dust =
        document.createElement(
          'span'
        )

      dust.className =
        'brute-dust'

      dust.style.left =
        event.actor === 'left'
          ? '23%'
          : '70%'

      fx?.appendChild(dust)
    }

    if (event.type === 'MOVE_BACK') {
      setFightOffset(
        actorEl,
        0
      )
    }

    if (event.type === 'WEAPON_SWITCH') {
      actorEl?.classList.add('switching')

      const banner = document.createElement('span')
      banner.className = 'brute-skill-banner'
      const meta = BRUTE_WEAPONS[event.weapon]
      banner.textContent = (meta?.icon || '⚔️') + ' ' + (meta?.name || 'ARME')
      fx?.appendChild(banner)
    }

    if (event.type === 'WEAPON_THROW') {
      actorEl?.classList.add('attack-ranged')
      const projectile = document.createElement('span')
      projectile.className = 'brute-projectile ' + (event.actor === 'right' ? 'right' : '')
      projectile.textContent = BRUTE_WEAPONS[event.weapon]?.icon || '⭕'
      fx?.appendChild(projectile)
    }

    if (event.type === 'BLOCK') {
      const blockVariant =
        Math.abs(
          Math.floor(
            num(
              event.animationVariant,
              0
            )
          )
        ) % 3

      actorEl?.classList.add(
        'blocking',
        'block-v' +
          blockVariant
      )

      nudgeFightOffset(
        actorEl,
        (
          event.actor === 'left'
            ? -1
            : 1
        ) *
        num(
          event.knockback,
          7
        ) *
        .45
      )

      const floater = document.createElement('span')
      floater.className = 'brute-float skill'
      floater.textContent = 'BLOQUÉ'
      actorEl?.appendChild(floater)

      const spark =
        document.createElement(
          'span'
        )

      spark.className =
        'brute-parry-spark variant-' +
        blockVariant

      spark.style.left =
        event.actor === 'left'
          ? '36%'
          : '64%'

      spark.style.top =
        '53%'

      fx?.appendChild(
        spark
      )
    }

    if (event.type === 'COUNTER') {
      actorEl?.classList.add('countering')
      const banner = document.createElement('span')
      banner.className = 'brute-skill-banner'
      banner.textContent = '↩ CONTRE'
      fx?.appendChild(banner)
    }

    if (event.type === 'REST') {
      actorEl?.classList.add('resting')
      const floater = document.createElement('span')
      floater.className = 'brute-float heal'
      floater.textContent = 'SOUFFLE'
      actorEl?.appendChild(floater)
    }

    if (
      event.type === 'ATTACK' ||
      event.type === 'FINISHER'
    ) {
      const weaponId =
        event.weapon ||
        (
          event.actor === 'left'
            ? tl.left.loadout?.weapon
            : tl.right.loadout?.weapon
        ) ||
        'fists'

      const attackVariant =
        Math.abs(
          Math.floor(
            num(
              event.attackVariant,
              event.animationVariant
            )
          )
        ) % 6

      actorEl?.classList.add(
        weaponAnimationClass(
          weaponId
        ),
        'attack-v' +
          attackVariant
      )

      if (
        event.type ===
          'FINISHER'
      ) {
        actorEl?.classList.add(
          'finisher'
        )

        arena?.classList.add(
          'finisher'
        )
      }

      if (event.counter) {
        actorEl?.classList.add(
          'countering'
        )
      }

      const category =
        event.category ||
        BRUTE_WEAPONS[
          weaponId
        ]?.category ||
        'unarmed'

      if (
        category === 'heavy'
      ) {
        arena?.classList.add(
          'impact-heavy'
        )

        const shockwave =
          document.createElement(
            'span'
          )

        shockwave.className =
          'brute-shockwave'

        shockwave.style.left =
          event.target === 'left'
            ? '31%'
            : '69%'

        shockwave.style.top =
          '58%'

        fx?.appendChild(
          shockwave
        )
      } else if (
        category === 'flexible'
      ) {
        arena?.classList.add(
          'impact-flexible'
        )

        const slash =
          document.createElement(
            'span'
          )

        slash.className =
          'brute-slash-fx ' +
          (
            event.actor === 'right'
              ? 'right'
              : ''
          )

        fx?.appendChild(
          slash
        )
      } else if (
        category === 'ranged'
      ) {
        arena?.classList.add(
          'impact-ranged'
        )
      } else {
        const speedline =
          document.createElement(
            'span'
          )

        speedline.className =
          'brute-speedline ' +
          (
            event.actor === 'right'
              ? 'right'
              : ''
          )

        fx?.appendChild(
          speedline
        )
      }

      if (
        category === 'ranged' &&
        !event.thrown
      ) {
        const projectile =
          document.createElement(
            'span'
          )

        projectile.className =
          'brute-projectile ' +
          (
            event.actor === 'right'
              ? 'right'
              : ''
          )

        projectile.textContent =
          BRUTE_WEAPONS[weaponId]?.icon ||
          '•'

        fx?.appendChild(
          projectile
        )
      }

      if (event.critical) {
        actorEl?.classList.add(
          'critical-burst'
        )

        const burst =
          document.createElement(
            'span'
          )

        burst.className =
          'brute-crit-burst'

        burst.style.left =
          event.target === 'left'
            ? '30%'
            : '70%'

        burst.style.top =
          '50%'

        fx?.appendChild(
          burst
        )
      }

      if (
        event.type ===
          'FINISHER'
      ) {
        const flare =
          document.createElement(
            'span'
          )

        flare.className =
          'brute-finisher-flare'

        flare.style.left =
          event.actor === 'left'
            ? '42%'
            : '58%'

        fx?.appendChild(
          flare
        )
      }
    }

    if (event.type === 'COMBO') {
      actorEl?.classList.add(
        'comboing'
      )

      const banner =
        document.createElement(
          'span'
        )

      banner.className =
        'brute-skill-banner'

      banner.textContent =
        '⚡ ENCHAÎNEMENT'

      fx?.appendChild(banner)
    }

    if (event.type === 'COUNTER_READY') {
      actorEl?.classList.add(
        'countering'
      )

      const banner =
        document.createElement(
          'span'
        )

      banner.className =
        'brute-skill-banner'

      banner.textContent =
        '↩ CONTRE'

      fx?.appendChild(banner)
    }

    if (
      event.type ===
      'SKILL_ACTIVATE'
    ) {
      actorEl?.classList.add(
        event.skill === 'lockout'
          ? 'guard'
          : 'comboing'
      )

      const skill =
        BRUTE_SKILLS[
          event.skill
        ]

      const banner =
        document.createElement(
          'span'
        )

      banner.className =
        'brute-skill-banner'

      banner.textContent =
        (skill?.icon || '✨') +
        ' ' +
        (skill?.name || event.skill)

      fx?.appendChild(banner)
    }

    if (event.type === 'DODGE') {
      const dodgeVariant =
        Math.abs(
          Math.floor(
            num(
              event.animationVariant,
              0
            )
          )
        ) % 3

      actorEl?.classList.add(
        'dodge',
        'dodge-v' +
          dodgeVariant
      )

      nudgeFightOffset(
        actorEl,
        (
          event.actor === 'left'
            ? -1
            : 1
        ) *
        num(
          event.distance,
          10
        )
      )

      const floater =
        document.createElement(
          'span'
        )

      floater.className =
        'brute-float dodge'

      floater.textContent =
        'ESQUIVE'

      actorEl?.appendChild(
        floater
      )

      fightSfx('miss')
    }

    if (event.type === 'MISS') {
      const missVariant =
        Math.abs(
          Math.floor(
            num(
              event.animationVariant,
              0
            )
          )
        ) % 3

      actorEl?.classList.add(
        'miss-v' +
          missVariant
      )

      const swoosh =
        document.createElement(
          'span'
        )

      swoosh.className =
        'brute-miss-swoosh ' +
        (
          event.actor === 'right'
            ? 'right'
            : ''
        )

      fx?.appendChild(
        swoosh
      )

      const floater =
        document.createElement(
          'span'
        )

      floater.className =
        'brute-float dodge'

      floater.textContent =
        'MISS'

      targetEl?.appendChild(
        floater
      )

      fightSfx('miss')
    }

    if (event.type === 'STUN_SKIP') {
      actorEl?.classList.add(
        'stunned'
      )

      const floater =
        document.createElement(
          'span'
        )

      floater.className =
        'brute-float skill'

      floater.textContent =
        'STUN'

      actorEl?.appendChild(
        floater
      )
    }

    if (event.type === 'DISARM') {
      targetEl?.classList.add(
        'hit'
      )

      const banner =
        document.createElement(
          'span'
        )

      banner.className =
        'brute-skill-banner'

      banner.textContent =
        '💥 DÉSARMÉ'

      fx?.appendChild(banner)
    }

    if (event.type === 'GRIND') {
      actorEl?.classList.add(
        'guard'
      )

      const banner =
        document.createElement(
          'span'
        )

      banner.className =
        'brute-skill-banner'

      banner.textContent =
        '🔥 GRIND · 1 PV'

      fx?.appendChild(banner)
    }

    if (
      event.type === 'ATTACK' ||
      event.type === 'PET_ATTACK' ||
      event.type === 'FINISHER'
    ) {
      const targetHpMax =
        event.target === 'left'
          ? num(tl.left.hpMax,1)
          : num(tl.right.hpMax,1)

      const heavy =
        event.critical ||
        event.type === 'FINISHER' ||
        num(event.damage) >=
          targetHpMax * .18

      targetEl?.classList.add(
        heavy
          ? 'hit-heavy'
          : 'hit'
      )

      const impactVariant =
        Math.abs(
          Math.floor(
            num(
              event.impactVariant,
              num(event.damage,0) % 3
            )
          )
        ) % 3

      const hitMotion = [
        {
          y:'-2px',
          tilt:'-4deg',
        },
        {
          y:'2px',
          tilt:'3deg',
        },
        {
          y:'-6px',
          tilt:'-1deg',
        },
      ][impactVariant]

      targetEl?.style.setProperty(
        '--hit-y',
        hitMotion.y
      )

      targetEl?.style.setProperty(
        '--hit-tilt',
        hitMotion.tilt
      )

      const knockback =
        Math.max(
          4,
          Math.min(
            72,
            num(
              event.knockback,
              heavy ? 28 : 12
            )
          )
        )

      targetEl?.style.setProperty(
        '--knock',
        knockback+'px'
      )

      if (!event.blocked) {
        nudgeFightOffset(
          targetEl,
          (
            event.target === 'left'
              ? -1
              : 1
          ) *
          Math.max(
            2,
            Math.min(
              12,
              knockback / 6
            )
          )
        )
      }

      if (heavy) {
        arena?.classList.add(
          'shake'
        )
      }

      if (
        event.critical ||
        event.type === 'FINISHER'
      ) {
        arena?.classList.add(
          'flash'
        )
      }

      const impact =
        document.createElement(
          'span'
        )

      impact.className =
        'brute-impact ' +
        esc(
          event.impactStyle ||
          ''
        ) +
        (
          event.critical
            ? ' crit'
            : ''
        )

      impact.style.left =
        event.target === 'left'
          ? '30%'
          : '70%'

      impact.style.top =
        '53%'

      fx?.appendChild(
        impact
      )

      fightSfx(
        event.critical
          ? 'critical'
          : 'hit'
      )
    }

    if (event.type === 'KO') {
      const koVariant =
        Math.abs(
          Math.floor(
            num(
              event.animationVariant,
              0
            )
          )
        ) % 3

      targetEl?.classList.add(
        'ko',
        'ko-v' +
          koVariant
      )

      targetEl?.style.setProperty(
        '--fight-offset',
        '0%'
      )

      fightSfx('perfect')
    }

    if (event.state) {
      const leftHp =
        num(event.state.leftHp)

      const rightHp =
        num(event.state.rightHp)

      const lPct =
        Math.max(
          0,
          Math.min(
            100,
            leftHp /
            Math.max(
              1,
              num(tl.left.hpMax)
            ) *
            100
          )
        )

      const rPct =
        Math.max(
          0,
          Math.min(
            100,
            rightHp /
            Math.max(
              1,
              num(tl.right.hpMax)
            ) *
            100
          )
        )

      const lBar =
        root.querySelector(
          '[data-hp-left]'
        )

      const rBar =
        root.querySelector(
          '[data-hp-right]'
        )

      const lText =
        root.querySelector(
          '[data-hp-text-left]'
        )

      const rText =
        root.querySelector(
          '[data-hp-text-right]'
        )

      if (lBar) {
        lBar.style.width =
          lPct + '%'
      }

      if (rBar) {
        rBar.style.width =
          rPct + '%'
      }

      if (lText) {
        lText.textContent =
          leftHp +
          ' / ' +
          num(tl.left.hpMax)
      }

      if (rText) {
        rText.textContent =
          rightHp +
          ' / ' +
          num(tl.right.hpMax)
      }

      const lFatigue = root.querySelector('[data-fatigue-left]')
      const rFatigue = root.querySelector('[data-fatigue-right]')
      const lWeapon = root.querySelector('[data-weapon-left]')
      const rWeapon = root.querySelector('[data-weapon-right]')

      if (lFatigue) {
        lFatigue.style.width = Math.max(0,Math.min(100,num(event.state.leftFatigue)))+'%'
      }

      if (rFatigue) {
        rFatigue.style.width = Math.max(0,Math.min(100,num(event.state.rightFatigue)))+'%'
      }

      if (lWeapon) {
        const w = BRUTE_WEAPONS[event.state.leftWeapon] || BRUTE_WEAPONS.fists
        lWeapon.textContent = w.icon+' '+w.name
      }

      if (rWeapon) {
        const w = BRUTE_WEAPONS[event.state.rightWeapon] || BRUTE_WEAPONS.fists
        rWeapon.textContent = w.icon+' '+w.name
      }

      syncFightWeapon(
        'left',
        tl,
        event.state.leftWeapon
      )

      syncFightWeapon(
        'right',
        tl,
        event.state.rightWeapon
      )
    }

    if (
      num(event.damage) > 0 &&
      targetEl
    ) {
      const floater =
        document.createElement(
          'span'
        )

      floater.className =
        'brute-float' +
        (
          event.critical
            ? ' crit'
            : ''
        ) +
        (
          event.lockout
            ? ' skill'
            : ''
        )

      floater.textContent =
        '-' +
        num(event.damage)

      targetEl.appendChild(
        floater
      )
    }

    const log =
      root.querySelector(
        '[data-brute-log]'
      )

    if (log) {
      log.textContent =
        eventText(event,tl)
    }

    const round =
      root.querySelector(
        '[data-brute-round]'
      )

    if (round) {
      round.textContent =
        event.type === 'START'
          ? 'GO'
          : String(
              event.i || 1
            )
    }
  }

  function renderFightSummary(tl) {
    const left = tl.summary?.left || {}
    const right = tl.summary?.right || {}

    const side = (title,data) =>
      '<div class="brute-fight-summary-side"><h4>'+esc(title)+'</h4><div class="brute-fight-summary-stats">'+
        '<span>Dégâts<b>'+num(data.damage)+'</b></span>'+
        '<span>Critiques<b>'+num(data.crits)+'</b></span>'+
        '<span>Esquives<b>'+num(data.dodges)+'</b></span>'+
        '<span>Blocks<b>'+num(data.blocks)+'</b></span>'+
        '<span>Contres<b>'+num(data.counters)+'</b></span>'+
        '<span>Combos<b>'+num(data.combos)+'</b></span>'+
      '</div></div>'

    return '<div class="brute-fight-summary">'+
      side(tl.left.name,left)+
      side(tl.right.name,right)+
    '</div>'
  }

  function finishFightPlayback(tl) {
    const result =
      root.querySelector(
        '[data-brute-fight-result]'
      )

    if (!result) return

    const won =
      tl.winnerSlug ===
      selectedSlug

    const t = theme()

    const xp =
      currentFightMeta?.xp_progress

    const replayOnly =
      Boolean(
        currentFightMeta?.replay
      )

    const practice =
      Boolean(
        currentFightMeta?.practice
      )

    const pve =
      Boolean(
        currentFightMeta?.pve
      )

    const gained =
      practice
        ? 0
        : num(
            xp?.xp_gained,
            currentFightMeta?.fight?.xp_gained ||
            0
          )

    const thresholdAfter =
      Math.max(
        1,
        num(
          xp?.threshold_after,
          xpNeeded()
        )
      )

    const beforePct =
      xp
        ? (
            xp.leveled_up
              ? 100
              : Math.max(
                  0,
                  Math.min(
                    100,
                    num(xp.xp_before) /
                    Math.max(
                      1,
                      num(
                        xp.threshold_before,
                        thresholdAfter
                      )
                    ) *
                    100
                  )
                )
          )
        : 0

    const afterPct =
      xp
        ? Math.max(
            0,
            Math.min(
              100,
              num(xp.xp_after) /
              thresholdAfter *
              100
            )
          )
        : 0

    const choices =
      !replayOnly &&
      !practice &&
      Array.isArray(
        currentFightMeta?.level_choices
      )
        ? currentFightMeta.level_choices
        : []

    result.innerHTML =
      '<div class="brute-panel brute-xp-result">'+
        '<h2 style="margin:0">'+
          (
            won
              ? '🏆 VICTOIRE'
              : '💀 DÉFAITE'
          )+
        '</h2>'+
        '<p style="color:#969bb1;font-size:10px">'+
          (
            won
              ? esc(t.victory)
              : 'Tu reviendras plus fort.'
          )+
        '</p>'+
        (
          practice
            ? '<div class="brute-xp-gain">ENTRAÎNEMENT · 0 XP</div>'
            : replayOnly
              ? '<div class="brute-xp-gain">↻ Replay · XP déjà attribuée</div>'
              : '<div class="brute-xp-gain">'+(pve ? '🏋️ OPENPOWER PVE · ' : '✨ ')+'+'+gained+' XP</div>'
        )+
        (
          pve &&
          currentFightMeta
            ?.openpowerlifting
            ? '<div style="margin-top:8px;color:#7e859f;font-size:8px;font-weight:900">OPENPOWERLIFTING · TOTAL '+num(currentFightMeta.openpowerlifting.total,0)+' KG · '+num(currentFightMeta.openpowerlifting.points,0)+' '+esc(currentFightMeta.openpowerlifting.metric || '')+' · ⚡ -'+num(currentFightMeta?.energy?.cost,8)+'</div>'
            : ''
        )+
        (
          xp && !practice && !replayOnly
            ? '<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:9px auto 0;max-width:620px">'+
                '<span class="brute-activity-pill">Base +'+num(xp.base_xp,0)+'</span>'+
                '<span class="brute-activity-pill">🚶 Steps +'+num(xp.steps_bonus,0)+'</span>'+
                '<span class="brute-activity-pill">🌙 Sommeil +'+num(xp.sleep_bonus,0)+'</span>'+
                '<span class="brute-activity-pill">🏋️ Training +'+num(xp.training_bonus,0)+'</span>'+
              '</div>'
            : ''
        )+
        (
          xp
            ? (
                xp.leveled_up
                  ? '<div class="brute-level-up">NIVEAU '+num(xp.level_before)+' → '+num(xp.level_after)+' !</div>'
                  : ''
              )+
              '<div class="brute-xp-track"><i data-brute-xp-bar style="width:'+beforePct+'%"></i></div>'+
              '<small style="color:#7e859f">'+num(xp.xp_after)+' / '+thresholdAfter+' XP · Niveau '+num(xp.level_after)+'</small>'
            : ''
        )+
        (
          choices.length
            ? renderTcgPack(
                choices,
                true
              )
            : ''
        )+
        renderFightSummary(tl)+
        '<div class="brute-actions" style="justify-content:center">'+
          '<button class="brute-primary" data-brute-replay-current>↻ Revoir</button>'+
          '<button class="brute-secondary" data-brute-after-fight>Retour au camp</button>'+
        '</div>'+
      '</div>'

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const bar =
          root.querySelector(
            '[data-brute-xp-bar]'
          )

        if (bar) {
          bar.style.width =
            afterPct + '%'
        }
      })
    })
  }

  async function playTimeline(tl) {
    const token = ++playbackToken
    await wait(80)
    for (const event of tl.events) {
      if (token !== playbackToken) return
      applyEvent(event,tl)
      if (event.type === 'END') break
      await wait(
        eventDelay(event)
      )
    }
    if (token !== playbackToken) return
    finishFightPlayback(tl)
  }

  async function startServerDuel(defenderSlug = null) {
    busy = true
    notice = ''
    render()

    let result

    try {
      result = await supabase.rpc(
        'brute_start_fight_v2',
        {
          p_attacker_slug:
            selectedSlug,
          p_defender_slug:
            defenderSlug,
        }
      )
    } catch (error) {
      console.error(
        '[GA Brute] start duel',
        error
      )
      busy = false
      notice =
        'Connexion au Duel impossible. Vérifie ta connexion puis réessaie.'
      screen = 'duel'
      render()
      return
    }

    busy = false

    if (result.error) {
      notice = result.error.message
      screen = 'duel'
      render()
      return
    }

    const data =
      Array.isArray(result.data)
        ? result.data[0]
        : result.data

    const fight =
      data?.fight

    if (
      !fight?.attacker_snapshot ||
      !fight?.defender_snapshot
    ) {
      notice =
        'Le combat reçu est incomplet. Recharge le Duel et réessaie.'
      screen = 'duel'
      render()
      return
    }

    currentFightMeta = data

    if (data?.attacker) {
      brute = {
        ...brute,
        ...data.attacker,
      }
    }

    levelChoices =
      Array.isArray(
        data?.level_choices
      )
        ? data.level_choices
        : []

    try {
      currentTimeline = generateFightTimeline({
        seed:fight.seed,
        attacker:fight.attacker_snapshot,
        defender:fight.defender_snapshot,
        winnerSlug:fight.winner_slug,
      })
    } catch (error) {
      console.error(
        '[GA Brute] timeline duel',
        error
      )
      currentTimeline = null
      currentFightMeta = null
      notice =
        'Le moteur de combat a rencontré une erreur. Réessaie après rechargement.'
      screen = 'duel'
      render()
      return
    }

    daily = data?.daily || daily
    screen = 'fight'
    render()
    void playTimeline(currentTimeline)
  }

  async function startPve() {
    if (busy) return

    busy = true
    notice = ''
    render()

    const seed = Date.now()
    const opponent =
      pveOpponent(seed)

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
      activity:{
        training_score:
          num(
            idleSnapshot
              ?.training_score,
            0
          ),
        steps_score:
          num(
            idleSnapshot
              ?.steps_score,
            0
          ),
        sleep_score:
          num(
            idleSnapshot
              ?.sleep_score,
            0
          ),
        power:
          num(
            idleSnapshot
              ?.power,
            35
          ),
      },
    }

    let timeline

    try {
      timeline =
        generateFightTimeline({
          seed,
          attacker:selfSnapshot,
          defender:opponent,
        })
    } catch (error) {
      console.error(
        '[GA Brute] timeline PVE',
        error
      )

      busy = false
      notice =
        'Impossible de lancer le combat d’entraînement. Recharge GA Brute et réessaie.'
      screen = 'pve'
      render()
      return
    }

    let reward

    try {
      reward =
        await supabase.rpc(
          'brute_finish_pve_v1',
          {
            p_athlete_slug:
              selectedSlug,
            p_won:
              timeline.winnerSlug ===
              selectedSlug,
          }
        )
    } catch (error) {
      console.error(
        '[GA Brute] reward PVE',
        error
      )

      busy = false
      notice =
        'Impossible de valider le combat PvE. Réessaie dans quelques secondes.'
      screen = 'pve'
      render()
      return
    }

    if (reward.error) {
      busy = false
      notice =
        reward.error.message ||
        'Impossible de valider le combat PvE.'
      screen = 'pve'
      render()
      return
    }

    const rewardData =
      Array.isArray(
        reward.data
      )
        ? reward.data[0]
        : reward.data

    currentTimeline =
      timeline

    currentFightMeta = {
      pve:true,
      openpowerlifting:
        opponent.openpowerlifting,
      xp_progress:
        rewardData
          ?.xp_progress,
      level_choices:
        Array.isArray(
          rewardData
            ?.level_choices
        )
          ? rewardData
              .level_choices
          : [],
      energy:
        rewardData
          ?.energy,
    }

    if (
      rewardData
        ?.attacker
    ) {
      brute = {
        ...brute,
        ...rewardData
          .attacker,
      }
    }

    levelChoices =
      currentFightMeta
        .level_choices

    if (
      rewardData
        ?.energy
    ) {
      idleSnapshot = {
        ...idleSnapshot,
        idle_energy:
          num(
            rewardData
              .energy
              .remaining,
            idleSnapshot
              ?.idle_energy
          ),
        last_claim_at:
          rewardData
            .energy
            .last_claim_at ||
          new Date()
            .toISOString(),
      }

      idleSnapshotAt =
        Date.now()
    }

    busy = false
    screen = 'fight'
    render()

    void playTimeline(
      currentTimeline
    )
  }

  async function replayFight(id) {
    const fight = history.find(row => row.id === id)
    if (!fight) return
    currentFightMeta = {
      replay:true,
      fight,
    }
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
      const nextSlug =
        String(
          select.dataset.bruteSelect ||
          ''
        )

      if (!nextSlug) {
        return
      }

      selectedSlug = nextSlug
      brute = null
      busy = true
      notice = ''

      root.innerHTML =
        '<main class="brute-app"><div class="brute-shell"><section class="brute-panel brute-pad" style="text-align:center;padding:40px"><h2>Chargement de la brute…</h2><p style="color:#858ca8;font-size:10px">Connexion à Supabase</p></section></div></main>'

      await refreshData(false)
      busy = false

      if (!brute) {
        selectedSlug = ''
        screen = 'selector'
      }

      render()
      return
    }

    const switchBtn = event.target.closest('[data-brute-switch]')
    if (switchBtn) {
      selectedSlug = ''
      brute = null
      idleSnapshot = null
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

    if (event.target.closest('[data-brute-go-sleep]')) {
      const active =
        idleSnapshot?.active_sleep_started_at

      if (!active) {
        const result =
          await supabase.rpc(
            'idle_sleep_start_v1',
            {
              p_athlete_slug:
                selectedSlug,
              p_sound_mode:
                sleepMode,
            }
          )

        if (result.error) {
          notice =
            result.error.message
          render()
          return
        }

        try {
          await ambient.play(
            sleepMode
          )
        } catch {
          // Audio is optional.
        }

        await loadSleep()
      }

      screen = 'sleep'
      notice =
        active
          ? ''
          : 'Bonne nuit. Ton énergie remonte pendant ton sommeil.'
      render()
      return
    }

    const screenBtn = event.target.closest('[data-brute-screen]')
    if (screenBtn) {
      const next = String(screenBtn.dataset.bruteScreen || 'menu')
      if (next === 'sleep') await loadSleep()
      setScreen(next)
      return
    }

    if (event.target.closest('[data-brute-lock]')) {
      draftFixed = !draftFixed
      render()
      return
    }

    if (event.target.closest('[data-brute-change-appearance]')) {
      draft = randomAppearance()
      render()
      return
    }

    if (event.target.closest('[data-brute-change-colors]')) {
      const next =
        randomAppearance()

      draft = {
        ...draft,
        skin:
          next.skin,
        hairColor:
          next.hairColor,
        colors:
          clone(
            next.colors
          ),
        v:
          BRUTE_APPEARANCE_VERSION,
      }

      render()
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
      else if (key === 'primary') draft.colors[0] = BRUTE_PALETTES.primary[index] || BRUTE_PALETTES.primary[0]
      else if (key === 'secondary') draft.colors[1] = BRUTE_PALETTES.secondary[index] || BRUTE_PALETTES.secondary[0]
      render()
      return
    }

    const randomSection =
      event.target.closest(
        '[data-brute-random-section]'
      )

    if (randomSection) {
      randomizeDraftSection(
        randomSection.dataset
          .bruteRandomSection
      )
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
      if (busy) return

      const index =
        num(
          choice.dataset
            .bruteChoice
        )

      const picked =
        levelChoices[
          index
        ] ||
        currentFightMeta
          ?.level_choices?.[
            index
          ]

      busy = true

      root
        .querySelectorAll(
          '[data-brute-choice]'
        )
        .forEach(
          button => {
            button.disabled = true
          }
        )

      const result =
        await supabase.rpc(
          'brute_choose_reward_v1',
          {
            p_athlete_slug:
              selectedSlug,
            p_choice:
              index,
          }
        )

      busy = false

      if (result.error) {
        notice =
          result.error.message
      } else {
        const data =
          Array.isArray(
            result.data
          )
            ? result.data[0]
            : result.data

        if (data?.brute) {
          brute = {
            ...brute,
            ...data.brute,
          }
        }

        levelChoices =
          Array.isArray(
            data?.next_choices
          )
            ? data.next_choices
            : []

        notice =
          (
            picked
              ?.rarity_label
              ? picked.rarity_label +
                ' · '
              : ''
          ) +
          (
            picked?.name ||
            'Carte'
          ) +
          ' obtenue.'

        if (
          screen === 'fight'
        ) {
          screen = 'camp'
        }
      }

      render()
      return
    }

    if (event.target.closest('[data-brute-reroll-skin]')) {
      if (busy) return

      busy = true
      render()

      const nextAppearance =
        randomAppearance()

      const result =
        await supabase.rpc(
          'brute_reroll_appearance_v1',
          {
            p_athlete_slug:
              selectedSlug,
            p_appearance:
              nextAppearance,
          }
        )

      busy = false

      if (result.error) {
        notice =
          result.error.message
      } else {
        brute =
          Array.isArray(
            result.data
          )
            ? result.data[0]
            : result.data

        notice =
          'Nouveau skin aléatoire appliqué.'
      }

      render()
      return
    }

    if (event.target.closest('[data-brute-reroll-colors]')) {
      if (busy) return

      busy = true
      render()

      const random =
        randomAppearance()

      const nextAppearance = {
        ...clone(
          brute.appearance ||
          DEFAULT_APPEARANCE
        ),
        skin:
          random.skin,
        hairColor:
          random.hairColor,
        colors:
          clone(
            random.colors
          ),
        v:
          BRUTE_APPEARANCE_VERSION,
      }

      const result =
        await supabase.rpc(
          'brute_reroll_appearance_v1',
          {
            p_athlete_slug:
              selectedSlug,
            p_appearance:
              nextAppearance,
          }
        )

      busy = false

      if (result.error) {
        notice =
          result.error.message
      } else {
        brute =
          Array.isArray(
            result.data
          )
            ? result.data[0]
            : result.data

        notice =
          'Nouvelles couleurs appliquées.'
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
        draft = randomAppearance()
        draftName = brute.name
        draftFixed = false
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
      await startPve()
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
      const active =
        idleSnapshot?.active_sleep_started_at

      const result =
        active
          ? await supabase.rpc(
              'idle_sleep_stop_v2',
              {
                p_athlete_slug:
                  selectedSlug,
              }
            )
          : await supabase.rpc(
              'idle_sleep_start_v1',
              {
                p_athlete_slug:
                  selectedSlug,
                p_sound_mode:
                  sleepMode,
              }
            )

      if (result.error) {
        notice =
          result.error.message
      } else {
        if (active) {
          ambient.stop()

          notice =
            'Réveil enregistré. Ton sommeil augmente uniquement ton bonus d’XP.'
        } else {
          try {
            await ambient.play(
              sleepMode
            )
          } catch {
            // Audio is optional.
          }

          notice =
            'Bonne nuit. Le chrono sommeil augmente ton bonus d’XP.'
        }

        await loadSleep()
        await refreshData(false)
      }

      render()
      return
    }
  }

  root.oninput = event => {
    const input =
      event.target.closest(
        '[data-brute-name]'
      )

    if (input) {
      draftName =
        String(
          input.value ||
          ''
        ).slice(
          0,
          28
        )

      if (!draftFixed) {
        draft =
          randomAppearance()

        const preview =
          root.querySelector(
            '[data-brute-creator-preview]'
          )

        if (preview) {
          preview.innerHTML =
            renderBruteSvg(
              draft,
              {
                label:'Ma brute',
              }
            )
        }
      }
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
