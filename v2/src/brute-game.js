
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
import {
  renderBruteSvg,
  renderPetSvg,
  renderWeaponIconSvg,
  renderSkillIconSvg,
} from './brute-svg.js'
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
    '.brute-row-self{border-color:rgba(255,205,74,.38)!important;background:linear-gradient(90deg,rgba(255,202,68,.08),rgba(255,255,255,.025))!important;box-shadow:inset 3px 0 #f2c24d}.brute-self-pill{display:inline-flex;margin-left:6px;padding:2px 5px;border:1px solid rgba(255,205,74,.32);border-radius:999px;background:rgba(255,196,42,.08);color:#ffd568;font-size:7px;font-style:normal;letter-spacing:.05em}.brute-menu-music{position:absolute;z-index:10;right:12px;top:12px;background:rgba(80,43,22,.72);border-color:rgba(255,236,177,.28);color:#fff0b0;backdrop-filter:blur(7px)}',
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

  style.textContent += `
/* ================================================================
   GA BRUTE · CELL / ARENA PRESENTATION V2
   Independent visual implementation inspired by classic browser
   arena games. No upstream assets or source are embedded here.
   ================================================================ */

.brute-cell-v2{
  position:relative;
  min-height:680px;
  overflow:hidden;
  border:3px solid #5b3119;
  border-radius:18px;
  color:#5a3018;
  background:
    linear-gradient(180deg,rgba(255,255,255,.18),transparent 20%),
    linear-gradient(180deg,#7fc6d7 0 25%,#d6c888 25% 31%,#b87538 31% 100%);
  box-shadow:
    inset 0 0 0 2px rgba(255,241,184,.28),
    0 24px 70px rgba(0,0,0,.36);
}
.brute-cell-v2:before{
  content:"";
  position:absolute;
  inset:31% 0 0;
  opacity:.34;
  pointer-events:none;
  background:
    repeating-linear-gradient(90deg,rgba(87,44,19,.12) 0 2px,transparent 2px 96px),
    repeating-linear-gradient(0deg,rgba(76,39,17,.1) 0 2px,transparent 2px 54px);
}
.brute-cell-sky{
  position:absolute;
  z-index:0;
  inset:0 0 auto;
  height:31%;
  overflow:hidden;
  pointer-events:none;
}
.brute-cell-sky:before,
.brute-cell-sky:after{
  content:"";
  position:absolute;
  width:180px;
  height:42px;
  border-radius:50%;
  background:rgba(255,255,255,.36);
  filter:blur(1px);
  box-shadow:
    45px 12px 0 rgba(255,255,255,.24),
    95px -5px 0 rgba(255,255,255,.18);
  animation:bruteCloudDrift 20s linear infinite;
}
.brute-cell-sky:before{left:-100px;top:52px}
.brute-cell-sky:after{right:-70px;top:96px;animation-duration:27s;animation-direction:reverse}
.brute-cell-header{
  position:relative;
  z-index:6;
  min-height:70px;
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:12px;
  padding:10px 15px;
  border-bottom:3px solid #60341b;
  background:
    linear-gradient(180deg,rgba(255,237,177,.96),rgba(218,174,94,.98));
  box-shadow:0 5px 0 rgba(83,42,19,.25);
}
.brute-cell-name{text-align:center}
.brute-cell-name>span{
  display:block;
  color:#8a532d;
  font-size:8px;
  font-weight:1000;
  letter-spacing:.13em;
}
.brute-cell-name h1{
  margin:0;
  color:#5b2c16;
  font-size:clamp(22px,4vw,34px);
  line-height:1;
  text-shadow:0 1px rgba(255,245,197,.8);
}
.brute-cell-header-actions{display:flex;gap:7px;justify-content:flex-end}
.brute-cell-small{
  border:2px solid #68391d;
  border-radius:8px;
  padding:8px 10px;
  background:linear-gradient(#c77b3e,#8f4925);
  box-shadow:inset 0 0 0 2px rgba(255,222,151,.22),0 3px 0 #502612;
  color:#fff0bc;
  font-size:9px;
  font-weight:1000;
  cursor:pointer;
}
.brute-cell-grid-v2{
  position:relative;
  z-index:3;
  display:grid;
  grid-template-columns:minmax(210px,.78fr) minmax(300px,1.25fr) minmax(210px,.78fr);
  gap:14px;
  padding:16px;
}
.brute-cell-inventory,
.brute-cell-actions{
  align-self:start;
  padding:10px;
  border:3px solid #66371d;
  border-radius:12px;
  background:
    linear-gradient(180deg,rgba(242,208,139,.98),rgba(190,127,63,.98));
  box-shadow:
    inset 0 0 0 2px rgba(255,240,185,.35),
    0 6px 0 #4d2613,
    0 12px 20px rgba(67,33,14,.18);
}
.brute-cell-board-title{
  margin:-3px -3px 9px;
  padding:7px 10px;
  border:2px solid #68391e;
  border-radius:7px;
  background:linear-gradient(#af642f,#77391e);
  color:#ffe9aa;
  text-align:center;
  font-size:10px;
  font-weight:1000;
  letter-spacing:.11em;
  text-shadow:0 1px #4d2412;
}
.brute-cell-shelf{
  margin-top:8px;
  padding:8px;
  border:2px solid rgba(100,53,26,.36);
  border-radius:9px;
  background:
    linear-gradient(180deg,rgba(255,240,190,.5),rgba(118,66,34,.1));
}
.brute-cell-shelf header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:7px;
  color:#72411f;
  font-size:7px;
  font-weight:1000;
  letter-spacing:.09em;
}
.brute-cell-shelf header b{
  display:grid;
  place-items:center;
  min-width:20px;
  height:20px;
  border-radius:50%;
  background:#71401f;
  color:#ffe4a2;
}
.brute-cell-items{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:5px;
}
.brute-cell-item{
  min-width:0;
  min-height:55px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  gap:2px;
  padding:4px 2px;
  border:2px solid rgba(99,54,28,.22);
  border-radius:7px;
  background:rgba(255,242,194,.55);
  box-shadow:inset 0 -2px rgba(91,49,25,.08);
}
.brute-cell-item.active{
  border-color:#d9902f;
  background:#fff0b0;
  box-shadow:0 0 0 2px rgba(255,203,83,.28),inset 0 -3px #d69334;
}
.brute-cell-item b{font-size:20px;line-height:1}
.brute-cell-item small{
  width:100%;
  overflow:hidden;
  color:#754622;
  font-size:6px;
  font-weight:900;
  text-align:center;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.brute-cell-empty{
  color:#896344;
  font-size:8px;
  font-weight:900;
}
.brute-cell-inventory-link{
  width:100%;
  margin-top:10px;
  border:2px solid #66371d;
  border-radius:8px;
  padding:9px;
  background:#754120;
  color:#ffe6a1;
  font-size:8px;
  font-weight:1000;
  cursor:pointer;
}
.brute-cell-main{
  min-width:0;
  display:flex;
  flex-direction:column;
  align-items:center;
}
.brute-cell-level-ribbon{
  position:relative;
  z-index:5;
  width:min(330px,92%);
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  margin-bottom:-13px;
  padding:7px 12px;
  border:3px solid #66371c;
  border-radius:8px;
  background:linear-gradient(#f6d67e,#cc8d3b);
  box-shadow:inset 0 0 0 2px rgba(255,247,199,.45),0 5px 0 #522714;
  color:#5b2d16;
}
.brute-cell-level-ribbon span,
.brute-cell-level-ribbon i{
  font-size:7px;
  font-weight:1000;
  font-style:normal;
  letter-spacing:.07em;
}
.brute-cell-level-ribbon i{text-align:right}
.brute-cell-level-ribbon b{
  display:grid;
  place-items:center;
  width:38px;
  height:38px;
  margin:-12px 7px;
  border:3px solid #67371b;
  border-radius:50%;
  background:#fff0a9;
  font-size:17px;
}
.brute-cell-avatar-stage{
  position:relative;
  width:100%;
  min-height:335px;
  display:flex;
  justify-content:center;
  align-items:flex-end;
  overflow:hidden;
  border:3px solid #66361c;
  border-radius:14px;
  background:
    radial-gradient(circle at 50% 22%,rgba(255,251,217,.9),transparent 27%),
    linear-gradient(180deg,#e7d29a 0 61%,#ac6b37 61% 100%);
  box-shadow:
    inset 0 0 0 3px rgba(255,241,183,.36),
    0 7px 0 rgba(79,38,18,.32);
}
.brute-cell-avatar-stage:before{
  content:"";
  position:absolute;
  inset:61% 0 0;
  background:
    repeating-linear-gradient(90deg,rgba(74,37,17,.18) 0 2px,transparent 2px 70px),
    linear-gradient(180deg,rgba(255,255,255,.1),transparent);
}
.brute-cell-window{
  position:absolute;
  left:50%;
  top:27px;
  width:112px;
  height:92px;
  transform:translateX(-50%);
  border:8px solid #74431f;
  border-radius:52px 52px 7px 7px;
  background:
    linear-gradient(90deg,transparent 47%,rgba(91,57,33,.45) 48% 52%,transparent 53%),
    linear-gradient(180deg,transparent 47%,rgba(91,57,33,.45) 48% 52%,transparent 53%),
    linear-gradient(#7bc4d5,#d8e8c8);
  box-shadow:inset 0 0 0 3px #c38b4b;
}
.brute-cell-avatar{
  position:relative;
  z-index:3;
  width:100%;
  display:flex;
  justify-content:center;
  align-items:flex-end;
  padding-bottom:17px;
}
.brute-cell-avatar .ga-brute-svg{
  width:min(230px,67%);
  max-height:285px;
  animation:bruteCellIdle 3s ease-in-out infinite;
  filter:drop-shadow(0 13px 8px rgba(76,40,19,.28));
}
.brute-cell-avatar-shadow,
.brute-fighter-shadow{
  position:absolute;
  z-index:1;
  left:50%;
  bottom:17px;
  width:126px;
  height:24px;
  transform:translateX(-50%);
  border-radius:50%;
  background:radial-gradient(ellipse,rgba(65,35,18,.42),transparent 68%);
  filter:blur(2px);
}
.brute-cell-pet-label{
  position:absolute;
  z-index:5;
  right:8px;
  bottom:8px;
  padding:4px 7px;
  border:2px solid #69391d;
  border-radius:999px;
  background:#f5dda0;
  color:#69401f;
  font-size:7px;
  font-weight:1000;
}
.brute-cell-statline{
  width:min(430px,100%);
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:6px;
  margin-top:10px;
}
.brute-cell-statline>span{
  min-width:0;
  padding:7px 4px;
  border:2px solid #6b3b20;
  border-radius:8px;
  background:linear-gradient(#f6df9f,#d6a354);
  color:#62371c;
  text-align:center;
  box-shadow:0 3px 0 rgba(78,37,17,.25);
}
.brute-cell-statline i{display:block;font-style:normal;font-size:14px}
.brute-cell-statline b{display:block;font-size:15px}
.brute-cell-statline small{font-size:6px;font-weight:1000}
.brute-cell-bars{
  width:min(430px,100%);
  display:grid;
  gap:7px;
  margin-top:10px;
}
.brute-cell-bars.compact{width:min(370px,100%)}
.brute-cell-bars>div>header{
  display:flex;
  justify-content:space-between;
  gap:8px;
  margin-bottom:3px;
  color:#65381c;
  font-size:7px;
  font-weight:1000;
}
.brute-cell-bar{
  height:12px;
  padding:2px;
  overflow:hidden;
  border:2px solid #60331b;
  border-radius:99px;
  background:#3a2117;
}
.brute-cell-bar i{
  display:block;
  height:100%;
  border-radius:99px;
  transition:width .35s ease;
}
.brute-cell-bar.xp i{background:linear-gradient(90deg,#7656cb,#5bc2e9,#f1d65a)}
.brute-cell-bar.energy i{background:linear-gradient(90deg,#58bd6d,#d7dc48,#f39a35)}
.brute-cell-fights{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:9px;
  padding:8px 10px;
  border:2px solid rgba(96,48,24,.32);
  border-radius:8px;
  background:rgba(255,240,187,.52);
}
.brute-cell-fights span{font-size:7px;font-weight:1000;letter-spacing:.08em}
.brute-cell-fights b{font-size:16px}
.brute-cell-action{
  width:100%;
  display:grid;
  grid-template-columns:34px 1fr 15px;
  gap:8px;
  align-items:center;
  margin-top:7px;
  padding:9px 8px;
  border:2px solid #66371d;
  border-radius:8px;
  background:linear-gradient(#aa5e2e,#71371d);
  color:#ffefb4;
  text-align:left;
  box-shadow:inset 0 0 0 2px rgba(255,222,147,.16),0 3px 0 #4d2513;
  cursor:pointer;
  transition:transform .14s ease,filter .14s ease;
}
.brute-cell-action:hover{transform:translateY(-1px);filter:brightness(1.08)}
.brute-cell-action.primary{
  background:linear-gradient(#d37e35,#93451f);
  box-shadow:inset 0 0 0 2px rgba(255,229,150,.24),0 4px 0 #552713,0 0 18px rgba(255,197,74,.12);
}
.brute-cell-action-icon{font-size:23px;text-align:center}
.brute-cell-action b{display:block;font-size:10px}
.brute-cell-action small{display:block;margin-top:2px;color:#e2bd78;font-size:6px}
.brute-cell-action i{font-style:normal;font-size:20px}
.brute-cell-record{
  margin-top:10px;
  padding:8px;
  border-top:2px solid rgba(97,51,26,.23);
  text-align:center;
}
.brute-cell-record>span{font-size:7px;font-weight:1000;letter-spacing:.1em}
.brute-cell-record>div{display:flex;justify-content:center;gap:4px;align-items:baseline;margin-top:3px}
.brute-cell-record b{font-size:16px}
.brute-cell-record small{font-size:7px;font-weight:1000}
.brute-camp-v2{
  position:relative;
  display:grid;
  grid-template-columns:minmax(210px,.8fr) minmax(300px,1.25fr) minmax(210px,.8fr);
  gap:13px;
  min-height:590px;
  padding:16px;
  overflow:hidden;
  border:3px solid #5d321a;
  border-radius:18px;
  background:
    radial-gradient(circle at 50% 8%,rgba(255,249,205,.65),transparent 26%),
    linear-gradient(180deg,#83c5d4 0 23%,#dac889 23% 30%,#b87639 30% 100%);
  box-shadow:0 24px 68px rgba(0,0,0,.34);
}
.brute-camp-v2:before{
  content:"";
  position:absolute;
  inset:30% 0 0;
  opacity:.35;
  background:
    repeating-linear-gradient(90deg,rgba(74,37,18,.14) 0 2px,transparent 2px 78px);
}
.brute-camp-v2-left,
.brute-camp-v2-center,
.brute-camp-v2-right{
  position:relative;
  z-index:2;
}
.brute-camp-v2-left,
.brute-camp-v2-right{display:grid;gap:10px;align-content:start}
.brute-parchment-panel{
  padding:11px;
  border:3px solid #66371c;
  border-radius:10px;
  background:linear-gradient(#f2d995,#ca9150);
  box-shadow:inset 0 0 0 2px rgba(255,245,194,.34),0 5px 0 #4f2814;
  color:#63361b;
}
.brute-parchment-panel h3{
  margin:0 0 9px;
  padding-bottom:6px;
  border-bottom:2px solid rgba(100,54,27,.25);
  font-size:10px;
  letter-spacing:.08em;
}
.brute-camp-v2-meter{margin-top:10px}
.brute-camp-v2-meter header{
  display:flex;
  justify-content:space-between;
  gap:8px;
  font-size:7px;
  font-weight:1000;
}
.brute-camp-v2-meter>div{
  height:8px;
  margin-top:4px;
  overflow:hidden;
  border:1px solid #6e3e20;
  border-radius:99px;
  background:#62371f;
}
.brute-camp-v2-meter>div i{
  display:block;
  height:100%;
  border-radius:99px;
  background:linear-gradient(90deg,#67b8dd,#70d17a,#ead65a);
}
.brute-camp-v2-meter small{
  display:block;
  margin-top:3px;
  color:#805331;
  font-size:6px;
  font-weight:800;
}
.brute-camp-v2-action,
.brute-camp-v2-sleep{
  border:3px solid #67371c;
  border-radius:9px;
  padding:11px 9px;
  background:linear-gradient(#ae6230,#773a1d);
  box-shadow:inset 0 0 0 2px rgba(255,223,148,.18),0 4px 0 #4f2613;
  color:#ffedaf;
  font-size:9px;
  font-weight:1000;
  cursor:pointer;
}
.brute-camp-v2-action.main{background:linear-gradient(#d48138,#91451f)}
.brute-camp-v2-center{
  display:flex;
  flex-direction:column;
  align-items:center;
  min-width:0;
}
.brute-camp-v2-sign{
  position:relative;
  z-index:5;
  max-width:92%;
  margin-bottom:-12px;
  padding:7px 13px;
  border:3px solid #65351a;
  border-radius:8px;
  background:linear-gradient(#f1c86c,#b96a2d);
  box-shadow:inset 0 0 0 2px rgba(255,244,190,.4),0 5px 0 #4f2512;
  color:#5b2b15;
  font-size:11px;
  font-weight:1000;
  letter-spacing:.06em;
}
.brute-camp-v2-avatar{
  position:relative;
  width:100%;
  min-height:325px;
  display:flex;
  justify-content:center;
  align-items:flex-end;
  overflow:hidden;
  border:3px solid #66371d;
  border-radius:14px;
  background:
    radial-gradient(circle at 50% 22%,rgba(255,246,192,.7),transparent 26%),
    linear-gradient(180deg,#dfce95 0 65%,#a96636 65%);
  box-shadow:inset 0 0 0 3px rgba(255,239,181,.3),0 6px 0 rgba(77,37,17,.3);
}
.brute-camp-v2-avatar:before{
  content:"";
  position:absolute;
  inset:65% 0 0;
  background:repeating-linear-gradient(90deg,rgba(75,36,16,.18) 0 2px,transparent 2px 72px);
}
.brute-camp-v2-avatar .ga-brute-svg{
  position:relative;
  z-index:3;
  width:min(220px,68%);
  max-height:276px;
  margin-bottom:15px;
  animation:bruteCellIdle 3s ease-in-out infinite;
  filter:drop-shadow(0 13px 8px rgba(69,35,17,.25));
}
.brute-camp-v2-name{
  margin-top:8px;
  padding:5px 11px;
  border:2px solid #65361c;
  border-radius:999px;
  background:#efd594;
  color:#66391e;
  font-size:8px;
  font-weight:1000;
}
.brute-camp-v2-sleep{
  width:min(360px,100%);
  margin-top:10px;
  background:linear-gradient(#7065b9,#433b78);
  border-color:#382f68;
  color:#f1eaff;
}
.brute-camp-v2-sleep.active{
  box-shadow:inset 0 0 0 2px rgba(224,214,255,.23),0 4px 0 #292252,0 0 22px rgba(103,91,193,.28);
}
.brute-camp-v2-power{text-align:center;padding:10px 0}
.brute-camp-v2-power b{display:block;font-size:36px;line-height:1}
.brute-camp-v2-power span{font-size:7px;font-weight:1000}
.brute-cell-statline.mini{grid-template-columns:repeat(3,1fr);margin-top:2px}
.brute-cell-statline.mini>span{padding:5px 2px}
.brute-cell-statline.mini i{font-size:11px}
.brute-cell-statline.mini b{font-size:12px}
.brute-parchment-panel.history{max-height:300px;overflow:auto}
.brute-camp-v2-history-row{
  display:grid;
  grid-template-columns:auto 1fr auto;
  gap:7px;
  align-items:center;
  padding:7px 0;
  border-bottom:1px solid rgba(98,52,26,.2);
}
.brute-camp-v2-history-row>span{font-size:17px}
.brute-camp-v2-history-row b{display:block;font-size:8px}
.brute-camp-v2-history-row small{display:block;color:#855735;font-size:6px}
.brute-armory-v2{
  display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);
  gap:13px;
}
.brute-armory-board,
.brute-armory-character{
  border:3px solid #63351c;
  border-radius:16px;
  box-shadow:inset 0 0 0 2px rgba(255,240,184,.28),0 7px 0 rgba(70,33,15,.32);
}
.brute-armory-board{
  padding:12px;
  background:
    repeating-linear-gradient(90deg,rgba(96,49,24,.08) 0 2px,transparent 2px 82px),
    linear-gradient(#e0bd78,#b67339);
}
.brute-armory-weapons{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
}
.brute-armory-weapon{
  min-height:94px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:3px;
  border:2px solid rgba(95,49,23,.42);
  border-radius:9px;
  background:rgba(255,235,178,.45);
  color:#65371c;
  cursor:pointer;
}
.brute-armory-weapon:hover{filter:brightness(1.06)}
.brute-armory-weapon.active{
  border-color:#ffc64e;
  background:#ffe6a1;
  box-shadow:0 0 0 3px rgba(255,196,62,.22),inset 0 -4px #d48c2f;
}
.brute-armory-weapon span{font-size:31px}
.brute-armory-weapon b{font-size:8px}
.brute-armory-weapon small{font-size:6px;font-weight:1000}
.brute-armory-subtitle{
  margin:14px 0 7px;
  color:#64371c;
  font-size:8px;
  font-weight:1000;
  letter-spacing:.1em;
}
.brute-armory-perks{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:6px;
}
.brute-armory-perks>span{
  min-width:0;
  min-height:68px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:3px;
  border:2px solid rgba(97,51,25,.27);
  border-radius:8px;
  background:rgba(255,240,190,.44);
  color:#65381d;
}
.brute-armory-perks b{font-size:23px}
.brute-armory-perks small{
  max-width:100%;
  overflow:hidden;
  padding:0 3px;
  font-size:6px;
  font-weight:900;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.brute-armory-character{
  position:relative;
  min-height:520px;
  display:flex;
  flex-direction:column;
  align-items:center;
  padding:12px;
  overflow:hidden;
  background:
    radial-gradient(circle at 50% 25%,rgba(255,248,201,.8),transparent 28%),
    linear-gradient(180deg,#e2ce96 0 70%,#aa6835 70%);
}
.brute-armory-character:before{
  content:"";
  position:absolute;
  inset:70% 0 0;
  background:repeating-linear-gradient(90deg,rgba(74,36,17,.18) 0 2px,transparent 2px 72px);
}
.brute-armory-name{
  position:relative;
  z-index:4;
  padding:6px 12px;
  border:3px solid #66371b;
  border-radius:8px;
  background:#efd68f;
  color:#64361c;
  font-size:9px;
  font-weight:1000;
}
.brute-armory-avatar{
  position:relative;
  z-index:2;
  flex:1;
  width:100%;
  display:flex;
  justify-content:center;
  align-items:flex-end;
}
.brute-armory-avatar .ga-brute-svg{
  width:min(235px,72%);
  max-height:330px;
  margin-bottom:10px;
  animation:bruteCellIdle 3s ease-in-out infinite;
  filter:drop-shadow(0 14px 9px rgba(70,36,18,.26));
}
.brute-armory-equipped{
  position:relative;
  z-index:4;
  margin-top:5px;
  padding:5px 9px;
  border:2px solid #63351b;
  border-radius:999px;
  background:#f4dda0;
  color:#65391d;
  font-size:7px;
  font-weight:1000;
}
.brute-armory-actions{
  position:relative;
  z-index:4;
  display:flex;
  gap:7px;
  flex-wrap:wrap;
  justify-content:center;
  margin-top:9px;
}
.brute-fight-shell{width:100%}
.brute-arena.brute-arena-v2{
  min-height:560px;
  border:3px solid #4f2d19;
  border-radius:15px;
  background:
    linear-gradient(180deg,#8bc9d9 0 30%,#d5c17f 30% 35%,#ad6a37 35% 100%);
  box-shadow:
    inset 0 0 0 2px rgba(255,238,176,.2),
    0 20px 65px rgba(0,0,0,.34);
}
.brute-arena.brute-arena-v2:after{display:none}
.brute-arena-v2-cloud{
  position:absolute;
  z-index:0;
  width:150px;
  height:35px;
  border-radius:50%;
  background:rgba(255,255,255,.35);
  filter:blur(1px);
}
.brute-arena-v2-cloud.c1{top:100px;left:-45px;animation:bruteCloudDrift 17s linear infinite}
.brute-arena-v2-cloud.c2{top:145px;right:-40px;animation:bruteCloudDrift 22s linear infinite reverse}
.brute-arena-v2-wall{
  position:absolute;
  z-index:1;
  left:0;
  right:0;
  top:31%;
  height:100px;
  border-top:5px solid #8b572c;
  border-bottom:5px solid #70401f;
  background:
    repeating-linear-gradient(90deg,#c69758 0 48px,#ba884d 48px 96px);
  box-shadow:inset 0 8px rgba(255,230,165,.18);
}
.brute-arena-v2-wall i{
  position:absolute;
  bottom:-24px;
  width:18px;
  height:30px;
  border:4px solid #71401f;
  border-radius:10px 10px 0 0;
  background:#d2a664;
}
.brute-arena-v2-wall i:nth-child(1){left:8%}
.brute-arena-v2-wall i:nth-child(2){left:28%}
.brute-arena-v2-wall i:nth-child(3){left:49%}
.brute-arena-v2-wall i:nth-child(4){left:70%}
.brute-arena-v2-wall i:nth-child(5){left:90%}
.brute-arena-v2-crowd{
  position:absolute;
  z-index:2;
  left:0;
  right:0;
  top:39%;
  height:62px;
  opacity:.18;
  background:
    radial-gradient(circle at 4% 100%,#3d2518 0 10px,transparent 11px),
    radial-gradient(circle at 12% 100%,#3d2518 0 13px,transparent 14px),
    radial-gradient(circle at 22% 100%,#3d2518 0 9px,transparent 10px),
    radial-gradient(circle at 35% 100%,#3d2518 0 14px,transparent 15px),
    radial-gradient(circle at 48% 100%,#3d2518 0 10px,transparent 11px),
    radial-gradient(circle at 61% 100%,#3d2518 0 13px,transparent 14px),
    radial-gradient(circle at 74% 100%,#3d2518 0 9px,transparent 10px),
    radial-gradient(circle at 86% 100%,#3d2518 0 12px,transparent 13px),
    radial-gradient(circle at 96% 100%,#3d2518 0 10px,transparent 11px);
}
.brute-arena-v2-floor{
  position:absolute;
  z-index:0;
  inset:47% 0 0;
  background:
    radial-gradient(ellipse at 50% 15%,rgba(255,224,151,.34),transparent 47%),
    repeating-linear-gradient(90deg,rgba(85,45,23,.1) 0 2px,transparent 2px 110px),
    linear-gradient(#b8783d,#98582e);
}
.brute-hud.brute-hud-v2{
  z-index:12;
  inset:10px 11px auto;
  grid-template-columns:1fr 58px 1fr;
  gap:8px;
}
.brute-hud-v2-side{
  min-width:0;
  padding:7px 8px;
  border:2px solid #593019;
  border-radius:9px;
  background:linear-gradient(180deg,rgba(244,216,151,.97),rgba(190,128,67,.97));
  box-shadow:inset 0 0 0 2px rgba(255,242,193,.3),0 4px 0 rgba(73,34,16,.32);
  color:#5b3019;
}
.brute-hud-v2-side.right{text-align:right}
.brute-hud-v2-head{
  display:flex;
  align-items:center;
  gap:7px;
}
.brute-hud-v2-side.right .brute-hud-v2-head{flex-direction:row-reverse}
.brute-hud-v2-medal{
  width:30px;
  height:30px;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  border:2px solid #65361c;
  border-radius:50%;
  background:#f8e3a1;
  font-size:17px;
}
.brute-hud-v2-head b{
  display:block;
  max-width:140px;
  overflow:hidden;
  font-size:10px;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.brute-hud-v2-head small{display:block;margin-top:1px;font-size:6px;font-weight:1000}
.brute-hud-v2-hp{
  height:14px;
  margin-top:5px;
  padding:2px;
  border:2px solid #57301a;
  border-radius:4px;
  background:#3a2117;
}
.brute-hud-v2-hp i{
  display:block;
  height:100%;
  border-radius:2px;
  background:linear-gradient(#f5e85a,#f2a22c 55%,#d84c20);
  transition:width .25s linear;
}
.brute-hud-v2-side.right .brute-hud-v2-hp i{margin-left:auto}
.brute-hud-v2-meta{
  display:flex;
  justify-content:space-between;
  gap:8px;
  margin-top:3px;
  font-size:6px;
  font-weight:1000;
}
.brute-hud-v2-side.right .brute-hud-v2-meta{flex-direction:row-reverse}
.brute-fatigue.v2{height:3px;background:rgba(67,35,19,.2)}
.brute-round-v2{
  align-self:start;
  height:48px;
  border-color:#6b391d;
  background:linear-gradient(#fff2b0,#d99a3f);
  color:#69351a;
  box-shadow:0 3px 0 rgba(75,35,16,.3);
}
.brute-fighters.brute-fighters-v2{
  z-index:7;
  bottom:39px;
  padding:0 5%;
}
.brute-fighters-v2 .brute-fighter{
  position:relative;
  min-height:310px;
  display:flex;
  align-items:flex-end;
  justify-content:center;
}
.brute-fighters-v2 .brute-fighter-shadow{
  bottom:13px;
  width:120px;
  height:20px;
  opacity:.72;
}
.brute-fighters-v2 .brute-fighter .ga-brute-svg{
  position:relative;
  z-index:3;
  width:min(190px,58%);
  max-height:278px;
}
.brute-log.brute-log-v2{
  z-index:13;
  left:50%;
  right:auto;
  bottom:7px;
  width:min(610px,72%);
  transform:translateX(-50%);
  padding:7px 12px;
  border:2px solid rgba(77,40,19,.6);
  border-radius:7px;
  background:rgba(250,225,166,.88);
  color:#61351c;
  text-align:center;
  font-size:8px;
  font-weight:1000;
  box-shadow:0 3px 0 rgba(73,35,17,.22);
  backdrop-filter:blur(4px);
}
.brute-fight-toolbar{
  display:flex;
  justify-content:center;
  gap:6px;
  flex-wrap:wrap;
  margin:9px auto 0;
}
.brute-fight-tool{
  min-width:62px;
  min-height:46px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  border:1px solid rgba(255,255,255,.09);
  border-radius:10px;
  background:linear-gradient(180deg,rgba(34,38,61,.96),rgba(13,15,29,.98));
  color:#f2f3f9;
  font-size:13px;
  font-weight:1000;
  cursor:pointer;
}
.brute-fight-tool small{
  display:block;
  margin-top:2px;
  color:#8087a2;
  font-size:6px;
  letter-spacing:.05em;
}
.brute-fight-tool.active{
  border-color:color-mix(in srgb,var(--accent),white 22%);
  background:color-mix(in srgb,var(--accent),#101324 73%);
  box-shadow:0 0 18px color-mix(in srgb,var(--accent),transparent 72%);
}
.brute-fight-tool.danger{color:#ffc278}
.brute-xp-result{
  margin-top:10px;
  border-color:rgba(255,219,125,.16);
}
@keyframes bruteCellIdle{
  0%,100%{transform:translateY(0) rotate(0)}
  45%{transform:translateY(-4px) rotate(-.35deg)}
  55%{transform:translateY(-4px) rotate(.35deg)}
}
@keyframes bruteCloudDrift{
  0%{transform:translateX(-20px)}
  50%{transform:translateX(35px)}
  100%{transform:translateX(-20px)}
}
@media(max-width:900px){
  .brute-cell-grid-v2,
  .brute-camp-v2{
    grid-template-columns:1fr 1.15fr;
  }
  .brute-cell-actions,
  .brute-camp-v2-right{
    grid-column:1/-1;
  }
  .brute-cell-actions{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:6px;
  }
  .brute-cell-actions .brute-cell-board-title,
  .brute-cell-actions .brute-cell-fights,
  .brute-cell-actions .brute-cell-record{
    grid-column:1/-1;
  }
  .brute-armory-v2{grid-template-columns:1fr}
  .brute-armory-character{min-height:430px}
}
@media(max-width:660px){
  .brute-cell-v2{min-height:0;border-radius:12px}
  .brute-cell-header{
    grid-template-columns:auto 1fr auto;
    padding:8px;
  }
  .brute-cell-header-actions .brute-cell-small:last-child{display:none}
  .brute-cell-grid-v2,
  .brute-camp-v2{
    grid-template-columns:1fr;
    gap:10px;
    padding:9px;
  }
  .brute-cell-main,
  .brute-camp-v2-center{grid-row:1}
  .brute-cell-inventory{grid-row:2}
  .brute-cell-actions{grid-row:3}
  .brute-cell-avatar-stage{min-height:300px}
  .brute-cell-avatar .ga-brute-svg{width:min(185px,62%);max-height:250px}
  .brute-cell-statline{gap:4px}
  .brute-cell-statline>span{padding:6px 2px}
  .brute-cell-actions{display:grid;grid-template-columns:1fr 1fr}
  .brute-cell-action{grid-template-columns:28px 1fr 10px;padding:8px 6px}
  .brute-cell-action-icon{font-size:18px}
  .brute-cell-inventory{display:block}
  .brute-cell-shelf{margin-top:6px}
  .brute-cell-items{grid-template-columns:repeat(4,minmax(0,1fr))}
  .brute-camp-v2-left{grid-row:2}
  .brute-camp-v2-right{grid-row:3}
  .brute-camp-v2-avatar{min-height:285px}
  .brute-camp-v2-avatar .ga-brute-svg{width:min(180px,62%);max-height:245px}
  .brute-armory-weapons{grid-template-columns:repeat(2,minmax(0,1fr))}
  .brute-armory-perks{grid-template-columns:repeat(4,minmax(0,1fr))}
  .brute-armory-character{min-height:390px}
  .brute-armory-avatar .ga-brute-svg{width:min(185px,64%);max-height:275px}
  .brute-arena.brute-arena-v2{min-height:450px}
  .brute-hud.brute-hud-v2{grid-template-columns:1fr 40px 1fr;gap:4px;inset:6px 5px auto}
  .brute-hud-v2-side{padding:5px}
  .brute-hud-v2-medal{width:24px;height:24px;font-size:13px}
  .brute-hud-v2-head b{max-width:84px;font-size:8px}
  .brute-hud-v2-meta{font-size:5px}
  .brute-round-v2{height:36px;font-size:9px}
  .brute-fighters.brute-fighters-v2{bottom:34px;padding:0}
  .brute-fighters-v2 .brute-fighter{min-height:250px}
  .brute-fighters-v2 .brute-fighter .ga-brute-svg{width:min(140px,56%);max-height:225px}
  .brute-log.brute-log-v2{width:84%;font-size:7px}
  .brute-fight-tool{min-width:52px;min-height:42px}
}
`

  style.textContent += `
.brute-duel-v2,
.brute-ranking-v2,
.brute-pve-v2,
.brute-sleep-v2{
  border:3px solid #5e3219;
  border-radius:16px;
  box-shadow:0 22px 64px rgba(0,0,0,.32);
  overflow:hidden;
}
.brute-duel-v2{
  padding:14px;
  background:
    radial-gradient(circle at 50% 0%,rgba(255,244,186,.48),transparent 28%),
    linear-gradient(180deg,#d8c486,#b77639);
}
.brute-duel-v2-head{
  display:grid;
  grid-template-columns:minmax(130px,.55fr) minmax(260px,1fr);
  gap:12px;
  align-items:stretch;
  margin-bottom:13px;
}
.brute-duel-v2-head>div{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  border:3px solid #67371c;
  border-radius:10px;
  background:linear-gradient(#f2db99,#ce9452);
  box-shadow:inset 0 0 0 2px rgba(255,246,194,.32),0 4px 0 #4f2814;
  color:#63361c;
}
.brute-duel-v2-head>div span,
.brute-duel-v2-head>div small{
  font-size:7px;
  font-weight:1000;
  letter-spacing:.08em;
}
.brute-duel-v2-head>div b{font-size:28px;line-height:1}
.brute-cell-action.random{margin:0;min-height:74px}
.brute-duel-posters{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:10px;
}
.brute-duel-poster{
  position:relative;
  min-height:220px;
  padding:15px 10px 10px;
  border:2px solid #7e5531;
  border-radius:3px;
  background:
    repeating-linear-gradient(0deg,rgba(93,54,25,.035) 0 2px,transparent 2px 9px),
    linear-gradient(#f4e2ac,#d6b06c);
  box-shadow:2px 4px 0 rgba(79,42,20,.22),0 9px 18px rgba(75,39,17,.12);
  color:#5f3218;
  text-align:center;
  transform:rotate(var(--poster-tilt,0deg));
}
.brute-duel-poster:nth-child(3n+1){--poster-tilt:-.7deg}
.brute-duel-poster:nth-child(3n+2){--poster-tilt:.6deg}
.brute-duel-pin{
  position:absolute;
  left:50%;
  top:5px;
  width:9px;
  height:9px;
  transform:translateX(-50%);
  border-radius:50%;
  background:#7a351f;
  box-shadow:inset 0 1px rgba(255,255,255,.3),0 2px 2px rgba(0,0,0,.25);
}
.brute-duel-avatar{
  display:grid;
  place-items:center;
  width:65px;
  height:65px;
  margin:7px auto 8px;
  border:3px double #73411f;
  border-radius:50%;
  background:#fff0bb;
  font-size:34px;
}
.brute-duel-poster-title b{
  display:block;
  overflow:hidden;
  font-size:11px;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.brute-duel-poster-title small{
  display:block;
  margin-top:3px;
  font-size:6px;
  font-weight:1000;
}
.brute-duel-threat{
  width:max-content;
  margin:8px auto;
  padding:3px 7px;
  border:1px solid #74401f;
  border-radius:999px;
  font-size:6px;
  font-weight:1000;
  letter-spacing:.06em;
}
.brute-duel-threat.danger{background:#8f2f25;color:#fff0d3;border-color:#642017}
.brute-duel-threat.fort{background:#d47c30;color:#fff0c3}
.brute-duel-threat.facile{background:#5f9b55;color:#efffe8;border-color:#477a3f}
.brute-duel-threat.équilibré{background:#d2b45a}
.brute-duel-record{
  display:flex;
  justify-content:center;
  gap:5px;
  margin:7px 0;
  font-size:7px;
  font-weight:1000;
}
.brute-duel-record span{
  padding:3px 5px;
  border:1px solid rgba(102,55,27,.24);
  border-radius:4px;
  background:rgba(255,246,203,.48);
}
.brute-duel-fight{
  width:100%;
  border:2px solid #63341a;
  border-radius:6px;
  padding:8px 6px;
  background:linear-gradient(#bd672e,#7d3c1e);
  box-shadow:0 3px 0 #4b2412;
  color:#ffecae;
  font-size:8px;
  font-weight:1000;
  cursor:pointer;
}
.brute-duel-fight:disabled{opacity:.4;cursor:not-allowed}
.brute-duel-empty{
  grid-column:1/-1;
  padding:30px;
  color:#754622;
  text-align:center;
  font-size:9px;
  font-weight:900;
}
.brute-pve-v2{
  display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);
  min-height:500px;
  background:linear-gradient(180deg,#86c4d5 0 27%,#d7c78d 27% 34%,#a86635 34%);
}
.brute-pve-v2-stage{
  position:relative;
  min-height:500px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  padding:25px;
  border-right:3px solid #5f3219;
  color:#60331a;
  text-align:center;
}
.brute-pve-v2-stage:before{
  content:"";
  position:absolute;
  inset:34% 0 0;
  background:
    repeating-linear-gradient(90deg,rgba(75,37,17,.16) 0 2px,transparent 2px 82px),
    linear-gradient(180deg,rgba(255,235,177,.1),transparent);
}
.brute-pve-v2-sign{
  position:relative;
  z-index:2;
  padding:7px 15px;
  border:3px solid #63341a;
  border-radius:8px;
  background:linear-gradient(#edc36a,#ae602a);
  box-shadow:0 5px 0 #4a2412;
  font-size:10px;
  font-weight:1000;
  letter-spacing:.08em;
}
.brute-pve-v2-icon{
  position:relative;
  z-index:2;
  margin:17px 0 7px;
  font-size:78px;
  filter:drop-shadow(0 12px 8px rgba(73,37,17,.22));
}
.brute-pve-v2-stage h2{
  position:relative;
  z-index:2;
  margin:0;
  font-size:25px;
}
.brute-pve-v2-stage p{
  position:relative;
  z-index:2;
  max-width:520px;
  margin:9px auto 0;
  color:#784a2a;
  font-size:9px;
  line-height:1.6;
  font-weight:800;
}
.brute-pve-v2-plates i{
  position:absolute;
  bottom:50px;
  width:75px;
  height:18px;
  border:4px solid #5d321b;
  border-radius:50%;
  background:#2f3542;
  box-shadow:inset 0 0 0 5px #727c8a;
}
.brute-pve-v2-plates i:nth-child(1){left:6%;transform:rotate(8deg)}
.brute-pve-v2-plates i:nth-child(2){left:17%;bottom:38px;transform:rotate(-5deg)}
.brute-pve-v2-plates i:nth-child(3){right:7%;transform:rotate(-7deg)}
.brute-pve-v2-plates i:nth-child(4){right:19%;bottom:39px;transform:rotate(6deg)}
.brute-pve-v2-board{
  padding:13px;
  background:linear-gradient(#efd793,#c68c4a);
  color:#63361c;
}
.brute-pve-v2-energy{text-align:center;padding:16px 0 8px}
.brute-pve-v2-energy span{display:block;font-size:8px;font-weight:1000;letter-spacing:.1em}
.brute-pve-v2-energy b{font-size:44px;line-height:1}
.brute-pve-v2-energy small{font-size:10px;font-weight:1000}
.brute-pve-v2-rules{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:6px;
  margin:13px 0;
}
.brute-pve-v2-rules span{
  min-height:66px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  padding:5px;
  border:2px solid rgba(99,53,27,.25);
  border-radius:8px;
  background:rgba(255,242,193,.45);
  text-align:center;
}
.brute-pve-v2-rules b{font-size:18px}
.brute-pve-v2-rules small{margin-top:2px;font-size:6px;font-weight:900}
.brute-pve-v2-launch{
  width:100%;
  border:3px solid #62331a;
  border-radius:8px;
  padding:12px 8px;
  background:linear-gradient(#d78235,#93451f);
  box-shadow:inset 0 0 0 2px rgba(255,228,149,.22),0 4px 0 #4d2411;
  color:#fff0b2;
  font-size:10px;
  font-weight:1000;
  cursor:pointer;
}
.brute-pve-v2-launch:disabled{opacity:.45;cursor:not-allowed}
.brute-pve-v2-note{
  display:block;
  margin-top:10px;
  color:#815332;
  font-size:7px;
  line-height:1.5;
  font-weight:800;
  text-align:center;
}
.brute-ranking-v2{
  padding:14px;
  background:linear-gradient(#d9c48a,#b87539);
}
.brute-ranking-v2-podium{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:10px;
  align-items:end;
  max-width:700px;
  margin:0 auto 14px;
}
.brute-podium{
  min-height:155px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-end;
  padding:12px 8px;
  border:3px solid #63351b;
  border-radius:10px 10px 4px 4px;
  background:linear-gradient(#f4dfa6,#c88d4c);
  color:#63361c;
  box-shadow:0 5px 0 #4c2613;
}
.brute-podium.place-1{min-height:190px;background:linear-gradient(#ffe9a5,#d9a23e)}
.brute-podium.place-2{min-height:170px}
.brute-podium-crown{font-size:26px}
.brute-podium-avatar{
  display:grid;
  place-items:center;
  width:58px;
  height:58px;
  margin:4px 0 7px;
  border:3px solid #66371d;
  border-radius:50%;
  background:#fff0ba;
  font-size:30px;
}
.brute-podium b{font-size:10px}
.brute-podium small{font-size:7px;font-weight:900}
.brute-podium>div{display:flex;gap:7px;margin-top:5px;font-size:7px;font-weight:1000}
.brute-ranking-v2-board{
  overflow:hidden;
  border:3px solid #64361c;
  border-radius:10px;
  background:#edcf89;
  box-shadow:inset 0 0 0 2px rgba(255,245,193,.3);
}
.brute-ranking-v2-row{
  display:grid;
  grid-template-columns:44px 34px minmax(0,1fr) 70px 65px 65px;
  gap:6px;
  align-items:center;
  min-height:44px;
  padding:5px 9px;
  border-bottom:1px solid rgba(98,52,26,.18);
  color:#63361c;
}
.brute-ranking-v2-row:nth-child(even){background:rgba(255,246,207,.24)}
.brute-ranking-v2-row.self{background:#ffe69b;box-shadow:inset 4px 0 #d58c2c}
.brute-ranking-v2-row .rank{font-size:9px;font-weight:1000}
.brute-ranking-v2-row .avatar{font-size:19px}
.brute-ranking-v2-row .name b{display:block;font-size:9px}
.brute-ranking-v2-row .name small{display:block;font-size:6px;font-weight:800}
.brute-ranking-v2-row .rating{text-align:right;font-size:11px}
.brute-ranking-v2-row .stat{font-size:7px;font-weight:900;text-align:right}
.brute-sleep-v2{
  display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);
  min-height:500px;
  background:#17152e;
}
.brute-sleep-v2-room{
  position:relative;
  min-height:500px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  border-right:3px solid #392d65;
  background:
    radial-gradient(circle at 28% 23%,rgba(147,143,226,.2),transparent 24%),
    linear-gradient(180deg,#242044 0 68%,#46334c 68%);
}
.brute-sleep-v2-room:before{
  content:"";
  position:absolute;
  inset:68% 0 0;
  background:repeating-linear-gradient(90deg,rgba(18,13,33,.22) 0 2px,transparent 2px 74px);
}
.brute-sleep-v2-window{
  position:absolute;
  left:9%;
  top:55px;
  width:120px;
  height:125px;
  overflow:hidden;
  border:8px solid #4f3763;
  border-radius:62px 62px 8px 8px;
  background:linear-gradient(#0c1732,#253a66);
  box-shadow:inset 0 0 0 3px #7c5d84;
}
.brute-sleep-v2-window span{
  position:absolute;
  left:25px;
  top:17px;
  color:#ffeaa3;
  font-size:42px;
  text-shadow:0 0 18px rgba(255,232,149,.45);
}
.brute-sleep-v2-window i{
  position:absolute;
  width:3px;
  height:3px;
  border-radius:50%;
  background:#fffbd5;
  box-shadow:0 0 7px rgba(255,255,255,.8);
}
.brute-sleep-v2-window i:nth-child(2){left:82px;top:29px}
.brute-sleep-v2-window i:nth-child(3){left:66px;top:66px}
.brute-sleep-v2-window i:nth-child(4){left:95px;top:84px}
.brute-sleep-v2-bed{
  position:absolute;
  right:7%;
  bottom:55px;
  width:230px;
  height:105px;
  border:7px solid #3f2850;
  border-radius:20px 20px 8px 8px;
  background:#775a78;
  box-shadow:0 12px 0 #2e203c;
}
.brute-sleep-v2-bed .pillow{
  position:absolute;
  left:14px;
  top:9px;
  width:76px;
  height:30px;
  border-radius:50%;
  background:#c8b9db;
}
.brute-sleep-v2-bed .blanket{
  position:absolute;
  left:12px;
  right:12px;
  bottom:8px;
  height:58px;
  border-radius:20px 20px 7px 7px;
  background:linear-gradient(90deg,#594c91,#7768b8);
}
.brute-sleep-v2-clock{
  position:relative;
  z-index:3;
  color:#fff0c0;
  font-size:clamp(42px,8vw,78px);
  font-weight:1000;
  letter-spacing:.05em;
  text-shadow:0 4px 18px rgba(0,0,0,.45);
}
.brute-sleep-v2-status{
  position:relative;
  z-index:3;
  color:#a9a1d3;
  font-size:8px;
  font-weight:1000;
  letter-spacing:.15em;
}
.brute-sleep-v2-xp{
  position:relative;
  z-index:3;
  margin-top:8px;
  padding:6px 10px;
  border:1px solid rgba(244,221,126,.25);
  border-radius:999px;
  background:rgba(244,221,126,.08);
  color:#f2df88;
  font-size:9px;
  font-weight:1000;
}
.brute-sleep-v2-toggle{
  position:relative;
  z-index:3;
  margin-top:14px;
  border:2px solid #8c78bb;
  border-radius:9px;
  padding:11px 17px;
  background:linear-gradient(#7464ae,#453b76);
  box-shadow:0 4px 0 #2d2750;
  color:#f6efff;
  font-size:9px;
  font-weight:1000;
  cursor:pointer;
}
.brute-sleep-v2-toggle.wake{background:linear-gradient(#d59b4c,#9d5f2d);border-color:#b27b3f}
.brute-sleep-v2-panel{
  padding:13px;
  background:linear-gradient(#332c58,#211c3e);
  color:#e8e1ff;
}
.brute-sleep-v2-panel p{
  color:#aaa2ca;
  font-size:8px;
  line-height:1.6;
}
.brute-sleep-v2-score{
  margin:17px auto;
  text-align:center;
}
.brute-sleep-v2-score b{font-size:48px;line-height:1}
.brute-sleep-v2-score span{font-size:12px;font-weight:1000}
.brute-sleep-v2-score small{display:block;margin-top:3px;color:#9d94c3;font-size:7px;font-weight:1000}
.brute-sound-grid.v2{grid-template-columns:1fr 1fr}
.brute-sleep-v2-tip{
  margin-top:12px;
  padding:9px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:8px;
  background:rgba(255,255,255,.035);
  color:#948caf;
  font-size:7px;
  text-align:center;
}
@media(max-width:850px){
  .brute-duel-posters{grid-template-columns:repeat(3,minmax(0,1fr))}
  .brute-pve-v2,
  .brute-sleep-v2{grid-template-columns:1fr}
  .brute-pve-v2-stage,
  .brute-sleep-v2-room{border-right:0;border-bottom:3px solid #5f3219}
}
@media(max-width:620px){
  .brute-duel-v2-head{grid-template-columns:1fr}
  .brute-duel-posters{grid-template-columns:repeat(2,minmax(0,1fr))}
  .brute-duel-poster{min-height:205px}
  .brute-ranking-v2-podium{gap:5px}
  .brute-podium{min-height:130px;padding:8px 4px}
  .brute-podium.place-1{min-height:155px}
  .brute-podium.place-2{min-height:142px}
  .brute-podium-avatar{width:44px;height:44px;font-size:23px}
  .brute-ranking-v2-row{grid-template-columns:34px 26px minmax(0,1fr) 55px}
  .brute-ranking-v2-row .stat{display:none}
  .brute-sleep-v2-room{min-height:430px}
  .brute-sleep-v2-window{left:6%;top:42px;width:90px;height:98px}
  .brute-sleep-v2-bed{right:4%;width:165px;height:80px}
}
`

  style.textContent += `
/* ================================================================
   GA BRUTE · GAME FEEL V3
   Custom SVG art, progression HUD, combo feedback and stat effects
   ================================================================ */

.ga-ui-glyph{
  display:block;
  width:100%;
  height:100%;
}
.ga-weapon-icon,
.ga-skill-icon,
.ga-brute-pet-svg{
  display:block;
  width:100%;
  height:100%;
}
.ga-weapon-icon{
  overflow:visible;
  filter:drop-shadow(0 4px 5px rgba(0,0,0,.18));
  transition:filter .18s ease,transform .18s ease;
}
.ga-weapon-icon[data-category="heavy"]{filter:drop-shadow(0 4px 5px rgba(0,0,0,.18)) drop-shadow(0 0 5px rgba(242,154,56,.18))}
.ga-weapon-icon[data-category="flexible"]{filter:drop-shadow(0 4px 5px rgba(0,0,0,.18)) drop-shadow(0 0 5px rgba(142,106,216,.20))}
.ga-weapon-icon[data-category="ranged"]{filter:drop-shadow(0 4px 5px rgba(0,0,0,.18)) drop-shadow(0 0 5px rgba(85,184,201,.22))}
.ga-skill-icon{
  color:#8d6be4;
  filter:drop-shadow(0 4px 6px rgba(55,39,100,.2));
}
.brute-cell-art{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  margin:0 auto;
}
.brute-cell-art .ga-weapon-icon,
.brute-cell-art .ga-skill-icon,
.brute-cell-art .ga-brute-pet-svg{
  width:38px;
  height:38px;
}
.brute-cell-item{
  position:relative;
  overflow:hidden;
}
.brute-cell-item:after{
  content:"";
  position:absolute;
  inset:auto 7px 4px;
  height:2px;
  border-radius:99px;
  background:rgba(107,58,29,.15);
}
.brute-cell-item.active:after{
  background:#d6902f;
  box-shadow:0 0 8px rgba(214,144,47,.5);
}
.brute-cell-pet-label{
  display:flex;
  align-items:center;
  gap:5px;
  padding:3px 8px 3px 3px;
}
.brute-cell-pet-label b{
  font-size:7px;
}
.brute-cell-pet-mini{
  width:26px;
  height:26px;
  display:block;
}
.brute-cell-pet-mini .ga-brute-pet-svg{
  width:26px;
  height:26px;
}
.brute-cell-action-icon{
  width:27px;
  height:27px;
  color:#ffe7a7;
}
.brute-cell-action.primary .brute-cell-action-icon{
  color:#fff0b5;
  filter:drop-shadow(0 0 7px rgba(255,210,93,.35));
}
.brute-cell-statline-v3{
  width:min(520px,100%);
  gap:7px;
}
.brute-cell-statline-v3>span{
  position:relative;
  overflow:hidden;
  min-height:108px;
  padding:8px 5px 7px;
  border:2px solid #6b3b20;
  border-radius:10px;
  background:
    radial-gradient(circle at 50% 5%,rgba(255,255,255,.42),transparent 36%),
    linear-gradient(#f6df9f,#d6a354);
  color:#62371c;
  text-align:center;
  box-shadow:0 3px 0 rgba(78,37,17,.25);
}
.brute-stat-v3:before{
  content:"";
  position:absolute;
  inset:0;
  opacity:0;
  pointer-events:none;
  background:radial-gradient(circle at 50% 28%,rgba(255,255,255,.55),transparent 36%);
  transition:opacity .2s ease;
}
.brute-stat-v3:hover:before{opacity:.55}
.brute-stat-v3-glyph{
  width:24px;
  height:24px;
  margin:0 auto 2px;
  color:#6f4023;
}
.brute-stat-v3 b{
  display:block;
  font-size:18px;
  line-height:1;
}
.brute-stat-v3 small{
  display:block;
  margin-top:3px;
  font-size:6px;
  font-weight:1000;
  letter-spacing:.08em;
}
.brute-stat-v3 em{
  display:block;
  min-height:16px;
  margin-top:3px;
  color:#8a5a37;
  font-size:5px;
  font-style:normal;
  font-weight:900;
  line-height:1.2;
}
.brute-stat-v3-progress{
  height:5px;
  margin:5px 3px 3px;
  overflow:hidden;
  border:1px solid rgba(91,45,22,.45);
  border-radius:99px;
  background:rgba(87,44,21,.18);
}
.brute-stat-v3-progress i{
  display:block;
  height:100%;
  background:linear-gradient(90deg,#ce7c34,#ffd164);
  box-shadow:0 0 8px rgba(255,192,68,.35);
}
.brute-stat-v3 u{
  display:block;
  color:#7d4d2c;
  font-size:5px;
  font-weight:1000;
  text-decoration:none;
}
.brute-stat-v3.tier-3{
  box-shadow:0 3px 0 rgba(78,37,17,.25),0 0 12px rgba(237,177,69,.15);
}
.brute-stat-v3.tier-4{
  border-color:#a9602c;
  box-shadow:0 3px 0 rgba(78,37,17,.25),0 0 15px rgba(234,143,51,.24);
}
.brute-stat-v3.tier-5,
.brute-stat-v3.tier-6{
  border-color:#86492b;
  background:
    radial-gradient(circle at 50% 5%,rgba(255,242,163,.62),transparent 38%),
    linear-gradient(#f6d67f,#c9813d);
  box-shadow:0 3px 0 rgba(78,37,17,.25),0 0 20px rgba(255,151,50,.32);
}
.brute-armory-v3{
  display:grid;
  grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr);
  gap:13px;
}
.brute-armory-v3-list,
.brute-armory-v3-focus{
  border:3px solid #63351c;
  border-radius:16px;
  box-shadow:inset 0 0 0 2px rgba(255,240,184,.28),0 7px 0 rgba(70,33,15,.32);
}
.brute-armory-v3-list{
  padding:12px;
  background:
    repeating-linear-gradient(90deg,rgba(96,49,24,.08) 0 2px,transparent 2px 82px),
    linear-gradient(#e0bd78,#b67339);
}
.brute-armory-weapons-v3{
  display:grid;
  gap:8px;
}
.brute-armory-weapon-v3{
  display:grid;
  grid-template-columns:68px minmax(0,1fr) auto;
  gap:9px;
  align-items:center;
  min-height:78px;
  padding:7px 9px;
  border:2px solid rgba(95,49,23,.38);
  border-radius:10px;
  background:rgba(255,239,190,.48);
  color:#63361c;
  text-align:left;
  cursor:pointer;
  transition:transform .14s ease,filter .14s ease,box-shadow .14s ease;
}
.brute-armory-weapon-v3:hover{
  transform:translateX(3px);
  filter:brightness(1.04);
}
.brute-armory-weapon-v3.active{
  border-color:#f3b43c;
  background:linear-gradient(90deg,#ffe6a0,#efc66f);
  box-shadow:inset 4px 0 #c97d2f,0 0 18px rgba(243,180,60,.22);
}
.brute-armory-weapon-art{
  width:58px;
  height:58px;
  display:grid;
  place-items:center;
}
.brute-armory-weapon-art .ga-weapon-icon{
  width:58px;
  height:58px;
}
.brute-armory-weapon-copy b{
  display:block;
  font-size:10px;
}
.brute-armory-weapon-copy small{
  display:block;
  margin-top:2px;
  color:#9b5d2c;
  font-size:6px;
  font-weight:1000;
  letter-spacing:.08em;
}
.brute-armory-weapon-copy em{
  display:block;
  margin-top:4px;
  color:#80502f;
  font-size:6px;
  font-style:normal;
  font-weight:850;
}
.brute-armory-weapon-v3>i{
  font-size:6px;
  font-style:normal;
  font-weight:1000;
}
.brute-armory-perks-v3{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:7px;
}
.brute-armory-perk-v3{
  min-height:90px;
  display:grid;
  grid-template-columns:46px 1fr;
  grid-template-rows:auto auto;
  gap:1px 7px;
  align-items:center;
  padding:7px;
  border:2px solid rgba(97,51,25,.25);
  border-radius:9px;
  background:rgba(255,240,190,.44);
  color:#65381d;
}
.brute-armory-perk-v3 .ga-skill-icon,
.brute-armory-perk-v3 .ga-brute-pet-svg{
  grid-row:1/3;
  width:46px;
  height:46px;
}
.brute-armory-perk-v3 b{
  font-size:8px;
}
.brute-armory-perk-v3 small{
  align-self:start;
  color:#845636;
  font-size:6px;
  line-height:1.35;
  font-weight:800;
}
.brute-armory-v3-focus{
  position:relative;
  min-height:610px;
  display:flex;
  flex-direction:column;
  align-items:center;
  padding:12px;
  overflow:hidden;
  background:
    radial-gradient(circle at 50% 16%,rgba(255,245,184,.68),transparent 27%),
    linear-gradient(180deg,#e5d09a 0 72%,#a96835 72%);
}
.brute-armory-v3-weapon-focus{
  position:relative;
  z-index:4;
  width:100%;
  display:grid;
  grid-template-columns:126px 1fr;
  gap:10px;
  align-items:center;
  margin-top:10px;
  padding:10px;
  border:2px solid rgba(93,48,23,.34);
  border-radius:12px;
  background:rgba(255,239,189,.57);
}
.brute-armory-v3-weapon-orbit{
  width:118px;
  height:118px;
  display:grid;
  place-items:center;
  border-radius:50%;
  background:radial-gradient(circle,#fff5c9 0 41%,rgba(255,223,129,.45) 42% 55%,transparent 56%);
  animation:bruteWeaponOrbit 4.5s ease-in-out infinite;
}
.brute-armory-v3-weapon-orbit .ga-weapon-icon{
  width:110px;
  height:110px;
}
.brute-armory-v3-weapon-title span{
  color:#a0602d;
  font-size:7px;
  font-weight:1000;
  letter-spacing:.11em;
}
.brute-armory-v3-weapon-title h2{
  margin:2px 0 4px;
  color:#61341b;
  font-size:20px;
}
.brute-armory-v3-weapon-title p{
  margin:0;
  color:#7b4e2d;
  font-size:7px;
  line-height:1.5;
  font-weight:800;
}
.brute-armory-v3-metrics{
  position:relative;
  z-index:4;
  width:100%;
  display:grid;
  gap:5px;
  margin-top:9px;
}
.brute-weapon-metric header{
  display:flex;
  justify-content:space-between;
  gap:8px;
  font-size:6px;
  font-weight:1000;
  color:#63361c;
}
.brute-weapon-metric>div{
  height:6px;
  overflow:hidden;
  border:1px solid #62331a;
  border-radius:99px;
  background:rgba(82,42,21,.18);
}
.brute-weapon-metric i{
  display:block;
  height:100%;
  border-radius:99px;
  background:linear-gradient(90deg,#bd6a2d,#f0b943,#ffe27c);
}
.brute-armory-v3-avatar{
  position:relative;
  z-index:3;
  flex:1;
  width:100%;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  min-height:260px;
}
.brute-armory-v3-avatar .ga-brute-svg{
  width:min(210px,62%);
  max-height:305px;
  margin-bottom:4px;
  animation:bruteCellIdle 3s ease-in-out infinite;
  filter:drop-shadow(0 14px 9px rgba(70,36,18,.26));
}
.brute-hud-v3{
  grid-template-columns:minmax(0,1fr) 68px minmax(0,1fr)!important;
  align-items:start;
}
.brute-hud-v3-side{
  min-width:0;
  padding:6px 7px 7px;
  border:2px solid #4d2a17;
  background:
    linear-gradient(180deg,rgba(250,224,162,.98),rgba(185,122,63,.98));
  box-shadow:
    inset 0 0 0 2px rgba(255,247,206,.25),
    0 4px 0 rgba(72,34,15,.34),
    0 7px 16px rgba(0,0,0,.13);
}
.brute-hud-v3-head{
  display:grid;
  grid-template-columns:42px minmax(0,1fr) 50px;
  gap:6px;
  align-items:center;
}
.brute-hud-v3-side.right .brute-hud-v3-head{
  grid-template-columns:50px minmax(0,1fr) 42px;
}
.brute-hud-v3-side.right .brute-hud-v3-portrait{grid-column:3}
.brute-hud-v3-side.right .brute-hud-v3-name{grid-column:2;grid-row:1;text-align:right}
.brute-hud-v3-side.right .brute-combo-meter{grid-column:1;grid-row:1}
.brute-hud-v3-portrait{
  width:40px;
  height:40px;
  display:flex;
  align-items:flex-start;
  justify-content:center;
  overflow:hidden;
  border:2px solid #60331b;
  border-radius:50%;
  background:#f9e6ae;
}
.brute-hud-v3-portrait .ga-brute-svg{
  width:42px;
  height:50px;
  margin-top:2px;
  transform:scale(1.35) translateY(8px);
  transform-origin:50% 20%;
}
.brute-hud-v3-name b{
  display:block;
  overflow:hidden;
  font-size:10px;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.brute-hud-v3-name small{
  display:block;
  margin-top:2px;
  color:#81502e;
  font-size:6px;
  font-weight:1000;
}
.brute-hud-v3-hp{
  position:relative;
  height:17px!important;
  margin-top:5px;
}
.brute-hud-v3-hp span{
  position:absolute;
  inset:0;
  z-index:2;
  display:grid;
  place-items:center;
  color:#fff7d7;
  text-shadow:0 1px 2px #5c2914;
  font-size:6px;
  font-weight:1000;
  pointer-events:none;
}
.brute-hud-v3-live{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:3px;
  margin-top:4px;
}
.brute-hud-v3-live span{
  min-width:0;
  padding:3px 2px;
  border:1px solid rgba(95,48,22,.2);
  border-radius:4px;
  background:rgba(255,242,191,.38);
  color:#784928;
  text-align:center;
  font-size:5px;
  font-weight:900;
  white-space:nowrap;
}
.brute-hud-v3-live b{font-size:6px}
.brute-hud-v3-weapon{
  min-height:35px;
  display:grid;
  grid-template-columns:33px 1fr;
  gap:5px;
  align-items:center;
  margin-top:4px;
  padding:3px 5px;
  border:1px solid rgba(94,48,24,.22);
  border-radius:6px;
  background:rgba(255,245,205,.35);
}
.brute-hud-v3-side.right .brute-hud-v3-weapon{
  grid-template-columns:1fr 33px;
  text-align:right;
}
.brute-hud-v3-side.right .brute-weapon-hud-icon{grid-column:2}
.brute-hud-v3-side.right .brute-weapon-hud-copy{grid-column:1;grid-row:1}
.brute-weapon-hud-icon{
  width:30px;
  height:30px;
  display:block;
}
.brute-weapon-hud-icon .ga-weapon-icon{
  width:30px;
  height:30px;
}
.brute-weapon-hud-copy b{
  display:block;
  font-size:7px;
  line-height:1.1;
}
.brute-weapon-hud-copy small{
  display:block;
  margin-top:2px;
  color:#865534;
  font-size:5px;
  font-weight:900;
}
.brute-fatigue-v3{
  margin-top:4px;
}
.brute-combo-meter{
  position:relative;
  min-width:46px;
  height:37px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  overflow:hidden;
  border:1px solid rgba(91,45,21,.22);
  border-radius:6px;
  background:rgba(255,242,188,.32);
  color:#8b5c37;
  opacity:.45;
  transform:scale(.93);
  transition:opacity .16s ease,transform .16s ease,box-shadow .16s ease;
}
.brute-combo-meter.active{
  opacity:1;
  transform:scale(1);
  color:#ad4f1f;
  background:linear-gradient(#ffe69a,#f4b745);
  box-shadow:0 0 14px rgba(255,179,51,.42);
  animation:bruteComboMeter .28s ease;
}
.brute-combo-meter b{
  position:relative;
  z-index:2;
  font-size:12px;
  line-height:1;
}
.brute-combo-meter small{
  position:relative;
  z-index:2;
  margin-top:1px;
  font-size:4.5px;
  font-weight:1000;
  letter-spacing:.08em;
}
.brute-combo-meter i{
  position:absolute;
  left:0;
  right:0;
  bottom:0;
  height:3px;
  background:
    linear-gradient(90deg,#d06722,#ffd15c);
  transform-origin:left;
  transition:width .18s ease;
}
.brute-round-stack{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:4px;
}
.brute-fight-xp-preview{
  min-width:54px;
  padding:4px 5px;
  border:1px solid rgba(255,228,132,.35);
  border-radius:6px;
  background:rgba(36,31,54,.84);
  color:#f6db75;
  text-align:center;
  box-shadow:0 0 12px rgba(238,198,73,.12);
}
.brute-fight-xp-preview span{
  display:block;
  font-size:5px;
  font-weight:1000;
  letter-spacing:.12em;
}
.brute-fight-xp-preview b{
  display:block;
  font-size:10px;
}
.brute-combo-stage{
  position:absolute;
  z-index:28;
  top:43%;
  width:22%;
  pointer-events:none;
}
.brute-combo-stage.left{left:8%}
.brute-combo-stage.right{right:8%}
.brute-combo-burst{
  display:block;
  text-align:center;
  color:#fff4b1;
  text-shadow:0 2px 0 #9c451b,0 0 18px rgba(255,174,54,.65);
  animation:bruteComboBurst .5s cubic-bezier(.15,.9,.2,1) forwards;
}
.brute-combo-burst b{
  display:block;
  font-size:28px;
  line-height:1;
}
.brute-combo-burst small{
  display:block;
  font-size:7px;
  font-weight:1000;
  letter-spacing:.13em;
}
.brute-banner-art{
  width:40px;
  height:40px;
  display:block;
  flex:0 0 auto;
}
.brute-banner-art .ga-weapon-icon,
.brute-banner-art .ga-skill-icon{
  width:40px;
  height:40px;
}
.brute-skill-banner.weapon,
.brute-skill-banner.skill-art{
  display:flex;
  align-items:center;
  gap:7px;
  min-width:180px;
  padding:7px 10px;
  text-align:left;
}
.brute-skill-banner.weapon span:last-child b,
.brute-skill-banner.skill-art span:last-child b{
  display:block;
  font-size:10px;
}
.brute-skill-banner.weapon span:last-child small,
.brute-skill-banner.skill-art span:last-child small{
  display:block;
  margin-top:2px;
  color:#b8bdd0;
  font-size:6px;
  font-weight:900;
}
.brute-skill-banner.combo{
  min-width:150px;
  text-align:center;
  background:linear-gradient(135deg,rgba(124,57,22,.94),rgba(232,145,38,.96));
  border-color:#ffcf5d;
  color:#fff2b5;
}
.brute-skill-banner.combo b{
  display:block;
  font-size:16px;
}
.brute-skill-banner.combo small{
  display:block;
  font-size:6px;
  letter-spacing:.12em;
}
.brute-projectile.weapon-art{
  width:74px;
  height:74px;
  display:grid;
  place-items:center;
  background:none!important;
  font-size:0!important;
}
.brute-projectile.weapon-art .ga-weapon-icon,
.brute-projectile .ga-weapon-icon.projectile{
  width:68px;
  height:68px;
}
.brute-afterimage{
  position:absolute!important;
  z-index:1!important;
  left:50%!important;
  bottom:0!important;
  width:min(190px,58%)!important;
  max-height:278px!important;
  transform:translateX(-50%);
  opacity:0;
  pointer-events:none;
  filter:saturate(1.4) brightness(1.2);
  animation:bruteAfterimage .34s ease forwards!important;
}
.brute-afterimage.windup{
  animation-duration:.28s!important;
}
.brute-afterimage.dodge-ghost{
  filter:hue-rotate(25deg) saturate(1.5) brightness(1.3);
}
.brute-stat-spark{
  position:absolute;
  z-index:25;
  width:7px;
  height:22px;
  border-radius:50%;
  background:linear-gradient(#fff4a9,#f08d32,transparent);
  transform:rotate(28deg);
  filter:drop-shadow(0 0 6px rgba(255,163,55,.85));
  animation:bruteStatSpark .45s ease forwards;
}
.brute-arena.stat-strength .brute-arena-v2-floor{
  filter:saturate(1.18) brightness(1.04);
}
.brute-fighter[class*="attack-v"] .ga-brute-svg{
  animation-duration:calc(.39s * var(--motion-boost,1))!important;
}
.brute-fighter.attack-heavy .weapon-olympic_bar .brute-weapon-shape{
  transform-box:fill-box;
  transform-origin:50% 70%;
  animation:bruteWeaponBarStrike .46s cubic-bezier(.16,.84,.22,1);
}
.brute-fighter.attack-heavy .weapon-kettlebell .brute-weapon-shape{
  transform-box:fill-box;
  transform-origin:50% 20%;
  animation:bruteWeaponKettleSwing .46s cubic-bezier(.16,.82,.22,1);
}
.brute-fighter.attack-heavy .weapon-plate20 .brute-weapon-shape{
  transform-box:fill-box;
  transform-origin:center;
  animation:bruteWeaponPlateSpin .43s cubic-bezier(.18,.84,.22,1);
}
.brute-fighter.attack-flexible .weapon-belt .brute-weapon-shape{
  transform-box:fill-box;
  transform-origin:50% 90%;
  animation:bruteWeaponBeltWhip .43s ease;
}
.brute-fighter.attack-flexible .weapon-straps .brute-weapon-shape{
  transform-box:fill-box;
  transform-origin:50% 90%;
  animation:bruteWeaponStrapWhip .42s ease;
}
.brute-fighter.attack-ranged .weapon-chalk .brute-weapon-shape{
  transform-box:fill-box;
  transform-origin:center;
  animation:bruteWeaponChalkBurst .38s ease;
}
.brute-fight-summary.v3{
  gap:9px;
}
.brute-fight-summary-side.v3{
  display:grid;
  grid-template-columns:58px 1fr;
  gap:10px;
  align-items:center;
  padding:10px;
}
.brute-fight-grade{
  width:52px;
  height:52px;
  display:grid;
  place-items:center;
  border:2px solid rgba(255,255,255,.12);
  border-radius:50%;
  background:#202538;
  color:#c8cedf;
  font-size:23px;
  font-weight:1000;
  box-shadow:inset 0 0 0 3px rgba(255,255,255,.025);
}
.brute-fight-grade.grade-s{
  color:#ffe17c;
  border-color:#f0c64e;
  background:radial-gradient(circle,#6d531d,#2f2819);
  box-shadow:0 0 22px rgba(240,198,78,.3);
}
.brute-fight-grade.grade-a{
  color:#9fd8ff;
  border-color:#65aee1;
}
.brute-fight-grade.grade-b{color:#b8e8c4;border-color:#70b985}
.brute-fight-summary-copy h4{
  margin:0 0 6px;
}
.brute-result-title{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:9px;
}
.brute-result-title h2{margin:0}
.brute-result-glyph{
  width:34px;
  height:34px;
  display:block;
}
.brute-result-title.win .brute-result-glyph{
  color:#f2cf58;
  filter:drop-shadow(0 0 10px rgba(242,207,88,.35));
}
.brute-result-title.loss .brute-result-glyph{
  color:#bf7181;
}
.brute-xp-gain.v3{
  width:min(420px,100%);
  display:grid;
  grid-template-columns:1fr auto;
  grid-template-rows:auto auto;
  gap:1px 8px;
  align-items:center;
  margin:10px auto;
  padding:9px 12px;
  border:1px solid rgba(239,206,91,.28);
  border-radius:10px;
  background:
    radial-gradient(circle at 50% 0,rgba(244,211,83,.12),transparent 48%),
    rgba(255,255,255,.025);
  text-align:left;
}
.brute-xp-gain.v3 span{
  color:#8f95aa;
  font-size:6px;
  font-weight:1000;
  letter-spacing:.12em;
}
.brute-xp-gain.v3 b{
  grid-row:1/3;
  grid-column:2;
  color:#f5d660;
  font-size:21px;
  text-shadow:0 0 14px rgba(245,214,96,.2);
}
.brute-xp-gain.v3 small{
  color:#686f89;
  font-size:6px;
  font-weight:900;
}
.brute-brand-mark,.brute-meter-label,.brute-bar-label{display:inline-flex;align-items:center;gap:5px}
.brute-brand-glyph{width:15px;height:15px;color:#ffe4a0}
.brute-meter-glyph{width:13px;height:13px;color:#86502c}
.brute-bar-glyph{width:11px;height:11px;color:currentColor}
.brute-inline-glyph{width:15px;height:15px;display:inline-grid;place-items:center;vertical-align:-3px;margin-right:4px}
.brute-inline-glyph .ga-ui-glyph{width:100%;height:100%}
.brute-selector-avatar.custom,.brute-pve-v2-icon.custom{display:grid;place-items:center}
.brute-selector-glyph{width:38px;height:38px;color:#6e3d21}
.brute-random-glyph,.brute-lock-glyph,.brute-creator-tool-glyph{width:22px;height:22px}
.brute-section-random .ga-ui-glyph{width:18px;height:18px}
.brute-history-glyph{width:20px;height:20px;display:grid;place-items:center;color:#8e5a2b}
.brute-history-glyph .ga-ui-glyph{width:18px;height:18px}
.brute-icon-button{width:28px;height:28px;display:grid!important;place-items:center;padding:5px!important}
.brute-icon-button .ga-ui-glyph{width:16px;height:16px}
.brute-pve-glyph{width:55px;height:55px;color:#66361c}
.brute-duel-avatar.custom,.brute-podium-avatar.custom,.brute-ranking-v2-row .avatar.custom{overflow:hidden;display:flex;align-items:flex-start;justify-content:center;background:linear-gradient(#f6dfa6,#ca8c4b);border:2px solid rgba(92,47,23,.55)}
.brute-duel-avatar.custom .ga-brute-svg{width:76px;height:94px;transform:scale(1.35) translateY(13px);transform-origin:50% 20%}
.brute-podium-avatar.custom .ga-brute-svg{width:54px;height:68px;transform:scale(1.32) translateY(10px);transform-origin:50% 20%}
.brute-ranking-v2-row .avatar.custom .ga-brute-svg{width:30px;height:38px;transform:scale(1.28) translateY(6px);transform-origin:50% 20%}
.brute-podium-crown{width:23px;height:23px;display:grid!important;place-items:center}
.brute-podium-crown .ga-ui-glyph{width:21px;height:21px}
.brute-rank-stat-glyph{width:10px;height:10px;display:inline-block;vertical-align:-2px}
.brute-sleep-moon{width:68px;height:68px;display:grid;place-items:center;color:#f5e9bd;filter:drop-shadow(0 0 14px rgba(225,214,255,.34))}
.brute-sleep-moon .ga-ui-glyph{width:100%;height:100%}
.brute-choice .big.art{width:62px;height:62px;display:grid;place-items:center;margin:4px auto 7px;font-size:0}
.brute-choice .big.art .ga-weapon-icon,.brute-choice .big.art .ga-skill-icon,.brute-choice .big.art .ga-brute-pet-svg,.brute-choice .big.art .ga-ui-glyph{width:58px;height:58px}
.brute-reward-stat-glyph{color:#ffe69a;filter:drop-shadow(0 0 9px rgba(255,205,82,.32))}
.brute-weapon-identity{display:block;margin-top:5px;color:#6f3c20;font-size:7px;letter-spacing:.08em}
.brute-weapon-mastery{position:relative;display:block;height:8px;margin-top:4px;overflow:hidden;border-radius:99px;background:rgba(79,40,20,.18)}
.brute-weapon-mastery>i{position:absolute;inset:0 auto 0 0;display:block;border-radius:inherit;background:linear-gradient(90deg,#b7622a,#f5be47,#ffe582);box-shadow:0 0 8px rgba(244,183,65,.38)}
.brute-weapon-mastery>em{position:absolute;inset:0;display:grid;place-items:center;color:#5f3119;font-size:4.5px;font-style:normal;font-weight:1000;letter-spacing:.07em;text-shadow:0 1px rgba(255,245,205,.48)}
.brute-combo-meter[data-tier="3"]{border-color:#e49235;box-shadow:0 0 18px rgba(244,158,50,.45)}
.brute-combo-meter[data-tier="4"]{border-color:#ffb62f;background:linear-gradient(#fff0a7,#ef9e2f);box-shadow:0 0 23px rgba(255,161,31,.58)}
.brute-combo-meter[data-tier="5"]{border-color:#fff0a4;color:#7c2f10;background:linear-gradient(#fff8be,#ffae32);box-shadow:0 0 30px rgba(255,191,58,.72);animation:bruteComboOverdrive .42s ease infinite alternate}
.brute-combo-burst.tier-4,.brute-combo-burst.tier-5{filter:drop-shadow(0 0 15px rgba(255,195,66,.72))}
.brute-combo-burst.tier-5 b{font-size:36px}
.brute-fighter:before{content:"";position:absolute;z-index:-1;left:50%;bottom:5%;width:56%;height:74%;border-radius:50%;transform:translateX(-50%) scale(.78);opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease}
.brute-fighter.stat-force:before{opacity:.14;background:radial-gradient(ellipse,rgba(255,147,52,.55),rgba(255,95,27,.12) 48%,transparent 72%)}
.brute-fighter.stat-force-elite:before{opacity:.27;transform:translateX(-50%) scale(.9);filter:drop-shadow(0 0 18px rgba(255,129,42,.38))}
.brute-fighter.stat-agility .ga-brute-svg{filter:drop-shadow(0 0 5px rgba(98,223,255,.20))}
.brute-fighter.stat-agility-elite .ga-brute-svg{filter:drop-shadow(0 0 9px rgba(98,223,255,.32))}
.brute-fighter.stat-speed:after{content:"";position:absolute;z-index:-2;left:23%;right:23%;bottom:28%;height:3px;opacity:.22;background:linear-gradient(90deg,transparent,rgba(245,235,164,.75),transparent);box-shadow:0 -12px rgba(245,235,164,.16),0 12px rgba(245,235,164,.12);animation:bruteSpeedAura 1.05s linear infinite}
.brute-fighter.stat-speed-elite:after{opacity:.42;height:4px;box-shadow:0 -16px rgba(245,235,164,.22),0 16px rgba(245,235,164,.18),0 -30px rgba(245,235,164,.10);animation-duration:.7s}
.brute-fighter.stat-apex{filter:drop-shadow(0 0 7px rgba(255,226,121,.18))}
.brute-arena-v3.impact-heavy .brute-stagefx:after,.brute-arena-v3.impact-flexible .brute-stagefx:after,.brute-arena-v3.impact-ranged .brute-stagefx:after{content:"";position:absolute;inset:0;pointer-events:none;animation:bruteArenaPulse .34s ease forwards}
.brute-arena-v3.impact-heavy .brute-stagefx:after{background:radial-gradient(circle at 50% 62%,rgba(255,175,70,.12),transparent 35%)}
.brute-arena-v3.impact-flexible .brute-stagefx:after{background:linear-gradient(110deg,transparent 35%,rgba(169,123,255,.12) 48%,transparent 62%)}
.brute-arena-v3.impact-ranged .brute-stagefx:after{background:radial-gradient(circle at 50% 45%,rgba(110,224,239,.16),transparent 29%)}
@keyframes bruteComboOverdrive{from{transform:scale(1);filter:brightness(1)}to{transform:scale(1.045);filter:brightness(1.14)}}
@keyframes bruteSpeedAura{0%{transform:translateX(-18px);opacity:.05}50%{opacity:.42}100%{transform:translateX(18px);opacity:.05}}
@keyframes bruteArenaPulse{0%{opacity:0}35%{opacity:1}100%{opacity:0}}
@keyframes bruteWeaponOrbit{
  0%,100%{transform:translateY(0) rotate(-1deg)}
  50%{transform:translateY(-5px) rotate(1deg)}
}
@keyframes bruteComboMeter{
  0%{transform:scale(.72)}
  55%{transform:scale(1.12)}
  100%{transform:scale(1)}
}
@keyframes bruteComboBurst{
  0%{opacity:0;transform:translateY(12px) scale(.55) rotate(-4deg)}
  45%{opacity:1;transform:translateY(-8px) scale(1.18) rotate(2deg)}
  100%{opacity:0;transform:translateY(-28px) scale(.92)}
}
@keyframes bruteAfterimage{
  0%{opacity:.42;transform:translateX(-52%) scale(.99)}
  45%{opacity:.2;transform:translateX(-63%) scale(.98)}
  100%{opacity:0;transform:translateX(-74%) scale(.96)}
}
@keyframes bruteStatSpark{
  0%{opacity:0;transform:translateY(8px) scale(.4) rotate(28deg)}
  35%{opacity:1}
  100%{opacity:0;transform:translateY(-30px) scale(1.15) rotate(42deg)}
}
@keyframes bruteWeaponBarStrike{
  0%,100%{transform:rotate(-28deg)}
  28%{transform:rotate(-68deg) translateY(-5px)}
  62%{transform:rotate(36deg) translateY(4px)}
}
@keyframes bruteWeaponKettleSwing{
  0%,100%{transform:rotate(0)}
  28%{transform:rotate(-42deg) translate(-4px,-8px)}
  62%{transform:rotate(52deg) translate(6px,5px)}
}
@keyframes bruteWeaponPlateSpin{
  0%{transform:rotate(0) scale(1)}
  55%{transform:rotate(190deg) scale(1.08)}
  100%{transform:rotate(360deg) scale(1)}
}
@keyframes bruteWeaponBeltWhip{
  0%,100%{transform:rotate(-18deg) skewX(0)}
  28%{transform:rotate(-58deg) skewX(-8deg)}
  62%{transform:rotate(44deg) skewX(10deg)}
}
@keyframes bruteWeaponStrapWhip{
  0%,100%{transform:rotate(0) scaleY(1)}
  25%{transform:rotate(-36deg) scaleY(1.08)}
  60%{transform:rotate(48deg) scaleY(.96)}
}
@keyframes bruteWeaponChalkBurst{
  0%,100%{transform:rotate(0) scale(1)}
  35%{transform:rotate(-18deg) scale(.92)}
  62%{transform:rotate(20deg) scale(1.1)}
}
/* ================================================================
   GA BRUTE · ARCADE FIGHT PASS V4
   Deeper stage, stronger silhouettes, hit-stop and versus-fighter HUD
   ================================================================ */
.brute-arena.brute-arena-v3{
  min-height:620px;
  isolation:isolate;
  overflow:hidden;
  border:3px solid #24170f;
  background:
    radial-gradient(circle at 50% 23%,rgba(255,216,122,.3),transparent 24%),
    linear-gradient(180deg,#4f9fc1 0 28%,#d0a85f 28% 34%,#9b5b31 34% 100%);
  box-shadow:inset 0 0 0 2px rgba(255,222,141,.18),inset 0 -55px 90px rgba(43,20,12,.2),0 24px 70px rgba(0,0,0,.4);
}
.brute-arena-v4-sun{
  position:absolute;z-index:0;left:50%;top:115px;width:330px;height:170px;transform:translateX(-50%);
  border-radius:50%;
  background:radial-gradient(ellipse,rgba(255,241,181,.7) 0 11%,rgba(255,198,102,.28) 27%,transparent 70%);
  pointer-events:none;
}
.brute-arena-v4-banner{
  position:absolute;z-index:2;top:31%;width:54px;height:185px;border:3px solid rgba(72,31,22,.72);border-top:0;
  background:linear-gradient(90deg,rgba(255,255,255,.08),transparent 25% 72%,rgba(0,0,0,.15)),linear-gradient(#8f2b27,#541a1e);
  box-shadow:0 12px 25px rgba(45,19,14,.28);transform-origin:50% 0;animation:bruteBannerSway 3.8s ease-in-out infinite;
}
.brute-arena-v4-banner.left{left:8%;transform:rotate(2deg)}
.brute-arena-v4-banner.right{right:8%;transform:rotate(-2deg);animation-delay:-1.8s}
.brute-arena-v4-banner:after{
  content:"";position:absolute;left:50%;bottom:-18px;width:34px;height:34px;transform:translateX(-50%) rotate(45deg);
  background:#541a1e;border-right:3px solid rgba(72,31,22,.72);border-bottom:3px solid rgba(72,31,22,.72);
}
.brute-arena-v4-banner i{
  position:absolute;left:50%;top:45px;width:28px;height:28px;transform:translateX(-50%) rotate(45deg);
  border:3px solid rgba(255,222,144,.65);opacity:.7;
}
.brute-arena-v4-gong{
  position:absolute;z-index:2;left:50%;top:37%;width:108px;height:108px;transform:translate(-50%,-50%);
  border:8px solid rgba(64,34,22,.7);border-radius:50%;
  background:radial-gradient(circle at 50% 46%,#d4a555 0 12%,#8c562d 13% 20%,#ba7b3d 21% 42%,#633a25 43% 48%,#b1773c 49% 100%);
  box-shadow:inset 0 0 0 4px rgba(255,226,153,.18),0 8px 20px rgba(44,20,12,.24);opacity:.78;
}
.brute-arena-v4-gong:before,.brute-arena-v4-gong:after{
  content:"";position:absolute;left:50%;top:50%;width:58px;height:7px;border-radius:99px;background:rgba(64,34,22,.52);
  transform:translate(-50%,-50%) rotate(38deg);
}
.brute-arena-v4-gong:after{transform:translate(-50%,-50%) rotate(-38deg)}
.brute-arena-v2-crowd{opacity:.28;filter:blur(.2px);transform:scaleY(1.18);transform-origin:50% 100%}
.brute-arena-v2-floor{
  inset:46% 0 0;
  background:radial-gradient(ellipse at 50% 12%,rgba(255,222,142,.48),transparent 43%),
    linear-gradient(90deg,transparent 49.7%,rgba(65,34,22,.22) 49.8% 50.2%,transparent 50.3%),
    repeating-linear-gradient(90deg,rgba(70,35,22,.14) 0 2px,transparent 2px 106px),linear-gradient(#b9773f,#814426);
}
.brute-arena-v2-floor:before{
  content:"";position:absolute;inset:0;opacity:.28;
  background:linear-gradient(77deg,transparent 0 24%,rgba(54,28,18,.42) 24.2% 24.5%,transparent 24.8%),
    linear-gradient(103deg,transparent 0 24%,rgba(54,28,18,.42) 24.2% 24.5%,transparent 24.8%),
    repeating-linear-gradient(0deg,transparent 0 62px,rgba(52,27,18,.28) 63px 65px);
  clip-path:polygon(0 0,100% 0,91% 100%,9% 100%);
}
.brute-arena-v4-vignette{
  position:absolute;z-index:9;inset:0;pointer-events:none;
  background:linear-gradient(90deg,rgba(31,17,17,.2),transparent 14% 86%,rgba(31,17,17,.2)),
    linear-gradient(180deg,rgba(10,15,23,.1),transparent 22% 78%,rgba(29,13,10,.24));
  mix-blend-mode:multiply;
}
.brute-arena-v4-foreground{
  position:absolute;z-index:10;left:-4%;right:-4%;bottom:-22px;height:74px;opacity:.72;pointer-events:none;
  background:radial-gradient(ellipse at 7% 100%,#1d1718 0 28px,transparent 30px),
    radial-gradient(ellipse at 93% 100%,#1d1718 0 34px,transparent 36px),
    linear-gradient(86deg,transparent 0 8%,#1d1718 8.2% 8.8%,transparent 9% 91%,#1d1718 91.2% 91.8%,transparent 92%);
}
.brute-versus-callout{
  position:absolute;z-index:27;left:50%;top:57%;width:min(360px,52%);transform:translate(-50%,-50%) rotate(-4deg) scale(.7);
  text-align:center;pointer-events:none;opacity:0;animation:bruteFightCallout 1.05s cubic-bezier(.15,.86,.2,1) .16s forwards;
}
.brute-versus-callout:before{
  content:"";position:absolute;z-index:-1;left:0;right:0;top:50%;height:70px;transform:translateY(-50%) skewX(-15deg);
  background:linear-gradient(90deg,transparent,#0c0d12 12% 88%,transparent);filter:drop-shadow(0 7px 8px rgba(0,0,0,.35));
}
.brute-versus-callout b{
  display:block;color:#ffe36b;font-size:48px;font-style:italic;line-height:.9;letter-spacing:-.06em;
  text-shadow:3px 3px 0 #cf3f1d,-2px -2px 0 #f5f0d3,0 0 18px rgba(255,160,46,.68);transform:skewX(-8deg);
}
.brute-versus-callout i{
  display:block;width:75%;height:5px;margin:5px auto 0;
  background:linear-gradient(90deg,transparent,#ff6a24,#ffe46e,#ff6a24,transparent);box-shadow:0 0 12px rgba(255,118,35,.5);
}
.brute-hud.brute-hud-v3{inset:11px 12px auto;grid-template-columns:minmax(0,1fr) 78px minmax(0,1fr)!important;gap:9px}
.brute-hud-v3-side{
  position:relative;overflow:hidden;padding:7px 9px 8px;border:2px solid #d1903a;border-radius:8px;
  background:linear-gradient(105deg,rgba(11,16,26,.97),rgba(27,28,36,.96) 60%,rgba(58,34,25,.95));color:#fff2ca;
  box-shadow:inset 0 0 0 1px rgba(255,236,176,.16),inset 0 -18px 28px rgba(0,0,0,.18),0 5px 0 rgba(25,15,12,.46),0 10px 22px rgba(0,0,0,.18);
}
.brute-hud-v3-side:before{
  content:"";position:absolute;left:-18%;top:-25px;width:48%;height:75px;transform:rotate(-14deg);
  background:linear-gradient(90deg,transparent,rgba(255,171,59,.13),transparent);pointer-events:none;
}
.brute-hud-v3-side.right:before{left:auto;right:-18%;transform:rotate(14deg)}
.brute-hud-v3-portrait{
  width:46px;height:46px;border:2px solid #efaa48;border-radius:8px 15px 8px 15px;
  background:radial-gradient(circle at 50% 20%,rgba(255,218,130,.36),transparent 52%),#171d29;box-shadow:0 0 12px rgba(238,153,53,.24);
}
.brute-hud-v3-portrait .ga-brute-svg{width:47px;height:56px;margin-top:1px}
.brute-hud-v3-name b{color:#fff4d4;font-size:12px;font-style:italic;letter-spacing:.02em;text-shadow:0 1px 0 #000}
.brute-hud-v3-name small{color:#d7b17c;font-size:6px}
.brute-hud-v3-hp{
  height:18px!important;padding:2px;border:2px solid #0b0d12!important;background:#1b1110!important;
  box-shadow:inset 0 0 0 1px rgba(255,235,179,.15),0 0 8px rgba(0,0,0,.35);
}
.brute-hud-v3-hp i{
  background:linear-gradient(180deg,#fff17b 0 20%,#ffb027 21% 56%,#e35224 57% 100%)!important;
  box-shadow:inset 0 1px rgba(255,255,255,.46),0 0 10px rgba(255,140,33,.34);
}
.brute-hud-v3-hp span{color:#fff;font-size:6.5px;text-shadow:0 1px 2px #000,0 0 3px #000}
.brute-hud-v3-live span{border-color:rgba(255,205,124,.18);background:rgba(255,255,255,.055);color:#d7b889}
.brute-hud-v3-live b{color:#fff4d2}
.brute-hud-v3-weapon{border-color:rgba(255,195,98,.19);background:linear-gradient(90deg,rgba(255,188,80,.07),rgba(255,255,255,.035))}
.brute-weapon-hud-copy b{color:#fff0c5}.brute-weapon-hud-copy small{color:#c9a779}.brute-weapon-identity{color:#dfa853!important}
.brute-weapon-mastery{background:rgba(0,0,0,.38)}.brute-weapon-mastery>em{color:#fff0c6;text-shadow:0 1px #000}
.brute-combo-meter{border-color:rgba(255,183,75,.28);background:rgba(255,169,54,.06);color:#b68d64}
.brute-combo-meter.active{color:#3f1f12;border-color:#ffbe3d;background:linear-gradient(#ffe986,#f09a25);box-shadow:0 0 18px rgba(255,160,39,.52)}
.brute-round-v2{
  width:58px;height:58px;border:3px solid #e6a344;border-radius:50%;
  background:radial-gradient(circle,#25202a 0 56%,#0f1118 57% 100%);color:#ffd95f;font-size:17px;text-shadow:0 0 9px rgba(255,190,61,.48);
  box-shadow:inset 0 0 0 3px rgba(255,218,124,.12),0 5px 0 rgba(24,12,10,.48),0 0 16px rgba(255,149,42,.2);
}
.brute-fight-xp-preview{border-color:rgba(85,167,255,.35);background:linear-gradient(#1f304b,#142239);color:#ffe072}
.brute-fighters.brute-fighters-v2{z-index:7;bottom:34px;padding:0 3.2%}
.brute-fighters-v2 .brute-fighter{min-height:365px}
.brute-fighters-v2 .brute-fighter .ga-brute-svg.fight-model{
  width:min(276px,76%);max-height:345px;overflow:visible;
  filter:drop-shadow(0 18px 8px rgba(55,24,12,.27)) drop-shadow(0 0 1px rgba(255,240,192,.25));transform-origin:50% 100%;
}
.brute-fighter.right .ga-brute-svg.fight-model{transform:scaleX(-1)}
.brute-fighters-v2 .fight-model .brute-stage{transform-origin:50% 100%;animation:bruteArcadeBreath 1.55s ease-in-out infinite}
.brute-fighters-v2 .fight-model .brute-head{transform-origin:50% 100%;animation:bruteArcadeHead 2.1s ease-in-out infinite}
.brute-fighters-v2 .fight-model .brute-shadow{opacity:.25}
.brute-fighters-v2 .brute-fighter-shadow{
  bottom:7px;width:160px;height:25px;opacity:.78;filter:blur(1px);background:radial-gradient(ellipse,rgba(39,20,15,.52),transparent 70%);
}
.brute-fighter.hitstop .ga-brute-svg,.brute-fighter.hitstop .ga-brute-svg *{animation-play-state:paused!important}
.brute-fighter.windup-heavy .ga-brute-svg.fight-model{filter:drop-shadow(0 0 12px rgba(255,120,43,.45)) drop-shadow(0 18px 8px rgba(55,24,12,.27))}
.brute-fighter.windup-fast .ga-brute-svg.fight-model,.brute-fighter.windup-flexible .ga-brute-svg.fight-model{filter:drop-shadow(0 0 10px rgba(255,222,105,.3)) drop-shadow(0 18px 8px rgba(55,24,12,.27))}
.brute-fighter.attack-heavy .brute-fighter-shadow,.brute-fighter.hit-heavy .brute-fighter-shadow{animation:bruteShadowImpact .4s ease}
.brute-speedline{
  top:42%;height:70px;opacity:.9;background:repeating-linear-gradient(0deg,transparent 0 8px,rgba(255,243,184,.82) 9px 11px,transparent 12px 18px);
  filter:blur(.45px) drop-shadow(0 0 7px rgba(255,164,54,.5));
}
.brute-impact{
  width:104px;height:104px;border:0;border-radius:0;
  background:radial-gradient(circle,#fff 0 8%,#ffe26b 9% 18%,#ff7a2d 19% 31%,rgba(255,67,31,.35) 32% 40%,transparent 41%),
    conic-gradient(from 8deg,transparent 0 6%,#fff4af 7% 10%,transparent 11% 19%,#ff9c3e 20% 23%,transparent 24% 33%,#fff4af 34% 37%,transparent 38% 48%,#ff7a2d 49% 52%,transparent 53% 62%,#fff4af 63% 66%,transparent 67% 78%,#ff9c3e 79% 82%,transparent 83%);
  clip-path:polygon(50% 0,58% 31%,78% 8%,69% 37%,100% 28%,73% 49%,100% 62%,67% 60%,84% 92%,59% 68%,50% 100%,42% 69%,18% 92%,34% 61%,0 64%,28% 50%,0 31%,32% 38%,22% 8%,43% 31%);
  box-shadow:none;filter:drop-shadow(0 0 16px rgba(255,99,32,.82));
}
.brute-impact.crit{
  width:146px;height:146px;
  background:radial-gradient(circle,#fff 0 9%,#fff27d 10% 18%,#ff5e2d 19% 31%,transparent 44%),
    conic-gradient(from 4deg,transparent 0 5%,#fff 6% 9%,transparent 10% 18%,#ffca55 19% 23%,transparent 24% 35%,#fff 36% 39%,transparent 40% 49%,#ff5e2d 50% 54%,transparent 55% 64%,#fff 65% 68%,transparent 69%);
  filter:drop-shadow(0 0 23px rgba(255,65,32,.95));
}
.brute-dust{bottom:65px;width:130px;height:42px;opacity:.9}
.brute-log.brute-log-v3{
  z-index:29;bottom:9px;width:min(560px,61%);padding:8px 18px;border:1px solid rgba(244,177,68,.78);border-radius:3px;
  background:linear-gradient(90deg,transparent,rgba(11,14,20,.91) 8% 92%,transparent);color:#fff0c4;font-size:9px;letter-spacing:.04em;
  text-shadow:0 1px 2px #000;box-shadow:0 0 18px rgba(0,0,0,.2);
}
.brute-arena.shake .brute-arena-v4-foreground{animation:bruteForegroundImpact .34s ease}
.brute-arena.flash .brute-arena-v4-vignette{animation:bruteVignetteFlash .26s ease}
@keyframes bruteArcadeBreath{0%,100%{transform:translateY(0) scale(1,1)}48%{transform:translateY(2px) scale(1.012,.992)}}
@keyframes bruteArcadeHead{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(1px) rotate(-1.2deg)}}
@keyframes bruteBannerSway{0%,100%{filter:brightness(.96)}50%{filter:brightness(1.08)}}
@keyframes bruteFightCallout{
  0%{opacity:0;transform:translate(-50%,-50%) rotate(-7deg) scale(.42)}
  34%{opacity:1;transform:translate(-50%,-50%) rotate(-3deg) scale(1.16)}
  61%{opacity:1;transform:translate(-50%,-50%) rotate(-4deg) scale(1)}
  100%{opacity:0;transform:translate(-50%,-50%) rotate(-2deg) scale(1.22)}
}
@keyframes bruteShadowImpact{0%,100%{transform:scale(1)}35%{transform:scale(1.35,.72);opacity:.9}}
@keyframes bruteForegroundImpact{0%,100%{transform:translate(0,0)}28%{transform:translate(-4px,2px)}52%{transform:translate(5px,-1px)}76%{transform:translate(-2px,1px)}}
@keyframes bruteVignetteFlash{0%,100%{filter:none}35%{filter:brightness(1.45) saturate(1.35)}}

/* ================================================================
   GA BRUTE · INTERFACE FLUIDITY V6
   Screen transitions, tactile controls and progression feedback
   ================================================================ */
.brute-shell>section,
.brute-shell>.brute-fight-shell{
  animation:bruteScreenIn .34s cubic-bezier(.16,.84,.2,1) both;
  transform-origin:50% 12%;
}
.brute-primary,
.brute-secondary,
.brute-camp-action,
.brute-cell-action,
.brute-fight-tool,
.brute-armory-weapon-v3,
.brute-choice,
.brute-section-random,
.brute-icon-button{
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation;
  transition:
    transform .14s cubic-bezier(.2,.8,.2,1),
    filter .14s ease,
    box-shadow .14s ease,
    border-color .14s ease,
    background .14s ease;
}
.brute-primary:hover,
.brute-camp-action:hover,
.brute-cell-action:hover,
.brute-fight-tool:hover,
.brute-armory-weapon-v3:hover,
.brute-secondary:hover{
  transform:translateY(-2px);
  filter:brightness(1.055);
}
.brute-primary:active,
.brute-secondary:active,
.brute-camp-action:active,
.brute-cell-action:active,
.brute-fight-tool:active,
.brute-armory-weapon-v3:active,
.brute-choice:active,
.brute-section-random:active,
.brute-icon-button:active{
  transform:translateY(1px) scale(.975);
  filter:brightness(.98);
  transition-duration:.06s;
}
.brute-primary:focus-visible,
.brute-secondary:focus-visible,
.brute-camp-action:focus-visible,
.brute-cell-action:focus-visible,
.brute-fight-tool:focus-visible,
.brute-armory-weapon-v3:focus-visible,
.brute-choice:focus-visible{
  outline:2px solid rgba(255,216,95,.95);
  outline-offset:3px;
}
.brute-camp-card,
.brute-cell-shelf,
.brute-cell-action,
.brute-armory-v3-list,
.brute-armory-v3-focus,
.brute-tcg-pack,
.brute-real-card{
  will-change:transform;
}
.brute-camp-card,
.brute-real-card,
.brute-cell-shelf{
  transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;
}
.brute-camp-card:hover,
.brute-real-card:hover,
.brute-cell-shelf:hover{
  transform:translateY(-2px);
  filter:brightness(1.025);
}
.brute-track i,
.brute-camp-energy-track i,
.brute-stat-v3-progress i,
.brute-weapon-mastery>i,
.brute-weapon-metric i,
.brute-hud-v3-hp i,
.brute-fatigue i{
  transition:
    width .32s cubic-bezier(.16,.82,.2,1),
    filter .2s ease,
    box-shadow .2s ease;
}
.brute-cell-statline-v3>span{
  transition:transform .16s ease,filter .16s ease,box-shadow .16s ease;
}
.brute-cell-statline-v3>span:hover{
  transform:translateY(-3px) scale(1.012);
  filter:brightness(1.035);
}
.brute-armory-v3-avatar .ga-brute-svg,
.brute-menu-avatar .ga-brute-svg,
.brute-camp-avatar .ga-brute-svg{
  transform-origin:50% 100%;
}
.brute-armory-v3-avatar:hover .ga-brute-svg,
.brute-menu-avatar:hover .ga-brute-svg,
.brute-camp-avatar:hover .ga-brute-svg{
  filter:drop-shadow(0 19px 12px rgba(70,36,18,.29)) brightness(1.025);
}
.brute-armory-v3-weapon-orbit{
  will-change:transform;
}
.brute-armory-weapon-v3.active .brute-armory-weapon-art{
  animation:bruteSelectedWeapon .34s cubic-bezier(.16,.86,.2,1);
}
.brute-choice{
  perspective:600px;
  transform-style:preserve-3d;
}
.brute-choice:hover .big.art{
  transform:translateY(-3px) scale(1.055);
}
.brute-choice .big.art{
  transition:transform .18s cubic-bezier(.16,.86,.2,1);
}
.brute-choice.rarity-legendary{
  animation:bruteCardDeal .55s cubic-bezier(.16,.85,.25,1) both,bruteLegendPulse 2.4s ease-in-out .7s infinite;
}
.brute-fight-toolbar{
  animation:bruteToolbarIn .34s cubic-bezier(.16,.84,.2,1) .08s both;
}
.brute-fight-tool.active{
  transform:translateY(-1px);
  box-shadow:0 0 0 1px rgba(255,218,118,.18),0 5px 16px rgba(0,0,0,.18);
}
.brute-selector-avatar.custom,
.brute-duel-avatar.custom,
.brute-podium-avatar.custom,
.brute-ranking-v2-row .avatar.custom{
  transition:transform .16s ease,filter .16s ease,box-shadow .16s ease;
}
.brute-duel-avatar.custom:hover,
.brute-ranking-v2-row:hover .avatar.custom{
  transform:scale(1.06);
  filter:brightness(1.05);
}
.brute-row,
.brute-ranking-v2-row{
  transition:transform .14s ease,background .14s ease,border-color .14s ease;
}
.brute-row:hover,
.brute-ranking-v2-row:hover{
  transform:translateX(3px);
}
.brute-result-title,
.brute-xp-gain.v3,
.brute-fight-summary.v3{
  animation:bruteResultIn .42s cubic-bezier(.16,.84,.2,1) both;
}
.brute-xp-gain.v3{animation-delay:.05s}
.brute-fight-summary.v3{animation-delay:.1s}
@keyframes bruteScreenIn{
  0%{opacity:0;transform:translateY(10px) scale(.992)}
  62%{opacity:1;transform:translateY(-1px) scale(1.002)}
  100%{opacity:1;transform:none}
}
@keyframes bruteToolbarIn{
  0%{opacity:0;transform:translateY(-7px)}
  100%{opacity:1;transform:none}
}
@keyframes bruteSelectedWeapon{
  0%{transform:scale(.86) rotate(-5deg)}
  58%{transform:scale(1.08) rotate(2deg)}
  100%{transform:none}
}
@keyframes bruteLegendPulse{
  0%,100%{box-shadow:inset 0 1px rgba(255,255,255,.06),0 10px 28px rgba(0,0,0,.2),0 0 12px rgba(255,201,74,.08)}
  50%{box-shadow:inset 0 1px rgba(255,255,255,.08),0 14px 34px rgba(0,0,0,.24),0 0 26px rgba(255,201,74,.18)}
}
@keyframes bruteResultIn{
  0%{opacity:0;transform:translateY(12px) scale(.975)}
  70%{opacity:1;transform:translateY(-2px) scale(1.008)}
  100%{opacity:1;transform:none}
}

/* ================================================================
   GA BRUTE · MOTION / ARTICULATION V5
   Per-limb animation, camera follow, contact particles and pacing
   ================================================================ */
.brute-arena-v3,
.brute-fighters-v2,
.brute-fighters-v2 .brute-fighter,
.brute-fighters-v2 .ga-brute-svg,
.brute-fighters-v2 .ga-brute-svg *{
  backface-visibility:hidden;
}
.brute-arena-v3{contain:layout paint}
.brute-fighters-v2{
  transform-origin:50% 76%;
  transition:transform .18s cubic-bezier(.16,.82,.22,1),filter .18s ease;
  will-change:transform;
}
.brute-fighters-v2 .brute-fighter{
  will-change:transform;
  transition:transform .2s cubic-bezier(.16,.86,.2,1),filter .12s ease;
}
.brute-fighters-v2 .fight-model .brute-torso,
.brute-fighters-v2 .fight-model .brute-head,
.brute-fighters-v2 .fight-model .brute-arm,
.brute-fighters-v2 .fight-model .brute-leg,
.brute-fighters-v2 .fight-model .brute-bottom,
.brute-fighters-v2 .fight-model .brute-weapon{
  transform-box:fill-box;
  will-change:transform,filter;
}
.brute-fighters-v2 .fight-model .brute-torso{transform-origin:50% 85%;animation:bruteFighterTorsoIdle 1.55s ease-in-out infinite}
.brute-fighters-v2 .fight-model .brute-arm-left{transform-origin:82% 58%;animation:bruteGuardIdleLeft 1.35s ease-in-out infinite}
.brute-fighters-v2 .fight-model .brute-arm-right{transform-origin:18% 58%;animation:bruteGuardIdleRight 1.35s ease-in-out infinite -.18s}
.brute-fighters-v2 .fight-model .brute-leg-left{transform-origin:70% 12%;animation:bruteRearLegIdle 1.55s ease-in-out infinite}
.brute-fighters-v2 .fight-model .brute-leg-right{transform-origin:30% 12%;animation:bruteLeadLegIdle 1.55s ease-in-out infinite}
.brute-fighters-v2 .fight-model .brute-bottom{transform-origin:50% 10%;animation:bruteHipIdle 1.55s ease-in-out infinite}
.brute-fighter.dashing .fight-model .brute-stage{animation:bruteDashBody .22s ease-out!important}
.brute-fighter.dashing .fight-model .brute-leg-left{animation:bruteDashRear .22s ease-out!important}
.brute-fighter.dashing .fight-model .brute-leg-right{animation:bruteDashLead .22s ease-out!important}
.brute-fighter.dashing .fight-model .brute-arm-left,
.brute-fighter.dashing .fight-model .brute-arm-right{animation:bruteDashGuard .22s ease-out!important}
.brute-fighter.recovery-step .fight-model .brute-stage{animation:bruteRecoveryBody .24s ease-out!important}
.brute-fighter.windup-fast .fight-model .brute-torso{animation:bruteWindupTorsoFast .22s ease!important}
.brute-fighter.windup-fast .fight-model .brute-arm-right{animation:bruteWindupGuardFast .22s ease!important}
.brute-fighter.windup-heavy .fight-model .brute-torso{animation:bruteWindupTorsoHeavy .34s ease!important}
.brute-fighter.windup-heavy .fight-model .brute-arm-right{animation:bruteWindupGuardHeavy .34s ease!important}
.brute-fighter.windup-heavy .fight-model .brute-leg-left{animation:bruteWindupRearHeavy .34s ease!important}
.brute-fighter.windup-flexible .fight-model .brute-torso{animation:bruteWindupTorsoFlex .27s ease!important}
.brute-fighter.windup-ranged .fight-model .brute-arm-right{animation:bruteWindupRangedArm .28s ease!important}

/* Jab */
.brute-fighter.attack-v0 .fight-model .brute-arm-right{animation:bruteLimbJab .31s cubic-bezier(.12,.86,.18,1)!important}
.brute-fighter.attack-v0 .fight-model .brute-torso{animation:bruteTorsoJab .31s cubic-bezier(.12,.86,.18,1)!important}
.brute-fighter.attack-v0 .fight-model .brute-leg-left{animation:bruteRearDrive .31s ease!important}
/* Hook */
.brute-fighter.attack-v1 .fight-model .brute-arm-right{animation:bruteLimbHook .38s cubic-bezier(.12,.82,.2,1)!important}
.brute-fighter.attack-v1 .fight-model .brute-arm-left{animation:bruteGuardCounterbalance .38s ease!important}
.brute-fighter.attack-v1 .fight-model .brute-torso{animation:bruteTorsoHook .38s ease!important}
.brute-fighter.attack-v1 .fight-model .brute-bottom{animation:bruteHipHook .38s ease!important}
/* Uppercut */
.brute-fighter.attack-v2 .fight-model .brute-arm-right{animation:bruteLimbUpper .39s cubic-bezier(.13,.8,.18,1)!important}
.brute-fighter.attack-v2 .fight-model .brute-torso{animation:bruteTorsoUpper .39s ease!important}
.brute-fighter.attack-v2 .fight-model .brute-leg-left,
.brute-fighter.attack-v2 .fight-model .brute-leg-right{animation:bruteLegUpper .39s ease!important}
/* Spin / cross */
.brute-fighter.attack-v3 .fight-model .brute-arm-right{animation:bruteLimbSpin .43s ease!important}
.brute-fighter.attack-v3 .fight-model .brute-arm-left{animation:bruteLimbSpinGuard .43s ease!important}
.brute-fighter.attack-v3 .fight-model .brute-torso{animation:bruteTorsoSpin .43s ease!important}
.brute-fighter.attack-v3 .fight-model .brute-bottom{animation:bruteHipSpin .43s ease!important}
/* Heavy slam */
.brute-fighter.attack-v4 .fight-model .brute-arm-right{animation:bruteLimbSlam .48s cubic-bezier(.13,.74,.18,1)!important}
.brute-fighter.attack-v4 .fight-model .brute-arm-left{animation:bruteLimbSlamGuard .48s ease!important}
.brute-fighter.attack-v4 .fight-model .brute-torso{animation:bruteTorsoSlam .48s ease!important}
.brute-fighter.attack-v4 .fight-model .brute-leg-left{animation:bruteRearDriveHeavy .48s ease!important}
/* Low sweep */
.brute-fighter.attack-v5 .fight-model .brute-torso{animation:bruteTorsoSweep .4s ease!important}
.brute-fighter.attack-v5 .fight-model .brute-leg-right{animation:bruteLeadSweep .4s cubic-bezier(.18,.8,.2,1)!important}
.brute-fighter.attack-v5 .fight-model .brute-arm-left,
.brute-fighter.attack-v5 .fight-model .brute-arm-right{animation:bruteSweepGuard .4s ease!important}

.brute-fighter.dodge-v0 .fight-model .brute-torso{animation:bruteDodgeTorsoStep .46s ease!important}
.brute-fighter.dodge-v0 .fight-model .brute-leg-left,
.brute-fighter.dodge-v0 .fight-model .brute-leg-right{animation:bruteDodgeLegStep .46s ease!important}
.brute-fighter.dodge-v1 .fight-model .brute-torso{animation:bruteDodgeTorsoDuck .46s ease!important}
.brute-fighter.dodge-v1 .fight-model .brute-arm-left,
.brute-fighter.dodge-v1 .fight-model .brute-arm-right{animation:bruteDodgeGuardDuck .46s ease!important}
.brute-fighter.dodge-v2 .fight-model .brute-leg-left,
.brute-fighter.dodge-v2 .fight-model .brute-leg-right{animation:bruteDodgeLegHop .49s ease!important}
.brute-fighter.blocking .fight-model .brute-arm-left{animation:bruteBlockGuardLeft .38s ease!important}
.brute-fighter.blocking .fight-model .brute-arm-right{animation:bruteBlockGuardRight .38s ease!important}
.brute-fighter.blocking .fight-model .brute-torso{animation:bruteBlockTorso .38s ease!important}
.brute-fighter.hit-react .fight-model .brute-head{animation:bruteHitHead .34s ease!important}
.brute-fighter.hit-react .fight-model .brute-arm-left,
.brute-fighter.hit-react .fight-model .brute-arm-right{animation:bruteHitGuardBreak .34s ease!important}
.brute-fighter.hit-heavy.hit-react .fight-model .brute-torso{animation:bruteHitTorsoHeavy .46s ease!important}
.brute-fighter.hit-heavy.hit-react .fight-model .brute-head{animation:bruteHitHeadHeavy .46s ease!important}

.brute-arena.camera-intro .brute-fighters{animation:bruteCameraIntro .54s cubic-bezier(.16,.86,.2,1)}
.brute-arena.camera-left .brute-fighters{transform:translateX(1.1%) scale(1.012)}
.brute-arena.camera-right .brute-fighters{transform:translateX(-1.1%) scale(1.012)}
.brute-arena.camera-attack-left .brute-fighters{transform:translateX(1.9%) scale(1.025)}
.brute-arena.camera-attack-right .brute-fighters{transform:translateX(-1.9%) scale(1.025)}
.brute-arena.camera-impact .brute-fighters{animation:bruteCameraImpact .32s cubic-bezier(.12,.72,.2,1)}
.brute-arena.camera-critical .brute-fighters{animation:bruteCameraCritical .38s cubic-bezier(.12,.76,.18,1)}
.brute-arena.camera-ko .brute-fighters{animation:bruteCameraKo .7s cubic-bezier(.12,.74,.18,1) forwards}
.brute-arena.camera-left .brute-arena-v2-wall,
.brute-arena.camera-attack-left .brute-arena-v2-wall{transform:translateX(-.5%) scale(1.004)}
.brute-arena.camera-right .brute-arena-v2-wall,
.brute-arena.camera-attack-right .brute-arena-v2-wall{transform:translateX(.5%) scale(1.004)}
.brute-arena-v2-wall{transition:transform .2s ease;transform-origin:50% 50%}

.brute-floor-streak{
  position:absolute;z-index:6;bottom:78px;width:165px;height:10px;border-radius:50%;
  background:linear-gradient(90deg,transparent,rgba(255,226,157,.8),rgba(102,55,31,.34),transparent);
  filter:blur(2px);animation:bruteFloorStreak .32s ease-out forwards;
}
.brute-floor-streak.left{left:12%}
.brute-floor-streak.right{right:12%;transform:scaleX(-1)}
.brute-dust.secondary{opacity:.58;transform:scale(.72);animation-delay:.05s}
.brute-contact-ring{
  position:absolute;z-index:21;width:64px;height:64px;border:4px solid rgba(255,244,184,.9);border-radius:50%;
  transform:translate(-50%,-50%) scale(.22);box-shadow:0 0 12px rgba(255,124,39,.65);
  animation:bruteContactRing .34s ease-out forwards;
}
.brute-contact-ring.heavy{width:92px;height:92px;border-width:6px}
.brute-debris{
  position:absolute;z-index:22;width:9px;height:5px;border-radius:1px;
  background:linear-gradient(90deg,#fff0a5,#e66d2b);
  box-shadow:0 0 7px rgba(255,111,39,.65);
  transform:translate(-50%,-50%);
  animation:bruteDebris .46s cubic-bezier(.12,.7,.2,1) forwards;
}
.brute-afterimage{
  animation-delay:calc(var(--ghost-index,0) * .025s)!important;
  opacity:calc(.34 - var(--ghost-index,0) * .07);
}
.brute-hud-v3-hp i.damage-tick{animation:bruteHpDamage .28s ease}
.brute-log.brute-log-v3.pulse{animation:bruteLogPulse .24s ease}

@keyframes bruteFighterTorsoIdle{0%,100%{transform:translateY(0) rotate(-.4deg) scale(1)}50%{transform:translateY(2px) rotate(.5deg) scale(1.008,.994)}}
@keyframes bruteGuardIdleLeft{0%,100%{transform:rotate(-1deg) translateY(0)}50%{transform:rotate(2.2deg) translateY(1px)}}
@keyframes bruteGuardIdleRight{0%,100%{transform:rotate(1deg) translateY(0)}50%{transform:rotate(-2deg) translateY(-1px)}}
@keyframes bruteRearLegIdle{0%,100%{transform:rotate(0) translateY(0)}50%{transform:rotate(-1.2deg) translateY(1px)}}
@keyframes bruteLeadLegIdle{0%,100%{transform:rotate(0) translateY(0)}50%{transform:rotate(1deg) translateY(-1px)}}
@keyframes bruteHipIdle{0%,100%{transform:translateX(0) rotate(0)}50%{transform:translateX(1px) rotate(.6deg)}}
@keyframes bruteDashBody{0%{transform:translateX(-7px) skewX(-2deg)}55%{transform:translateX(9px) skewX(2deg)}100%{transform:none}}
@keyframes bruteDashRear{0%{transform:rotate(-8deg) translateX(-4px)}55%{transform:rotate(9deg) translateX(6px)}100%{transform:none}}
@keyframes bruteDashLead{0%{transform:rotate(6deg) translateX(4px)}55%{transform:rotate(-7deg) translateX(-4px)}100%{transform:none}}
@keyframes bruteDashGuard{0%{transform:translateX(-3px)}55%{transform:translateX(6px)}100%{transform:none}}
@keyframes bruteRecoveryBody{0%{transform:translateX(7px)}55%{transform:translateX(-3px)}100%{transform:none}}
@keyframes bruteWindupTorsoFast{0%{transform:none}100%{transform:translateX(-3px) rotate(-4deg) scale(.99,1.015)}}
@keyframes bruteWindupGuardFast{0%{transform:none}100%{transform:rotate(-23deg) translate(-5px,-2px)}}
@keyframes bruteWindupTorsoHeavy{0%{transform:none}55%,100%{transform:translate(-5px,3px) rotate(-8deg) scale(.97,1.025)}}
@keyframes bruteWindupGuardHeavy{0%{transform:none}55%,100%{transform:rotate(-44deg) translate(-8px,-6px)}}
@keyframes bruteWindupRearHeavy{0%{transform:none}55%,100%{transform:rotate(-5deg) translate(-4px,3px)}}
@keyframes bruteWindupTorsoFlex{0%{transform:none}55%,100%{transform:rotate(-6deg) translateX(-4px)}}
@keyframes bruteWindupRangedArm{0%{transform:none}100%{transform:rotate(-32deg) translate(-8px,-8px)}}
@keyframes bruteLimbJab{0%,100%{transform:none}30%{transform:rotate(-6deg) translateX(-4px)}56%{transform:rotate(12deg) translate(31px,-2px)}72%{transform:rotate(5deg) translateX(15px)}}
@keyframes bruteTorsoJab{0%,100%{transform:none}30%{transform:rotate(-2deg) translateX(-2px)}56%{transform:rotate(5deg) translateX(8px)}}
@keyframes bruteRearDrive{0%,100%{transform:none}42%{transform:rotate(-4deg) translateX(-3px)}60%{transform:rotate(3deg) translateX(3px)}}
@keyframes bruteLimbHook{0%,100%{transform:none}24%{transform:rotate(-38deg) translate(-7px,2px)}58%{transform:rotate(58deg) translate(24px,-4px)}76%{transform:rotate(28deg) translate(12px,-2px)}}
@keyframes bruteGuardCounterbalance{0%,100%{transform:none}55%{transform:rotate(-13deg) translate(-5px,-2px)}}
@keyframes bruteTorsoHook{0%,100%{transform:none}25%{transform:rotate(-8deg) translateX(-4px)}58%{transform:rotate(15deg) translateX(10px)}76%{transform:rotate(5deg)}}
@keyframes bruteHipHook{0%,100%{transform:none}58%{transform:rotate(11deg) translateX(5px)}}
@keyframes bruteLimbUpper{0%,100%{transform:none}25%{transform:rotate(-22deg) translate(-5px,9px)}58%{transform:rotate(-72deg) translate(17px,-24px)}75%{transform:rotate(-38deg) translate(10px,-10px)}}
@keyframes bruteTorsoUpper{0%,100%{transform:none}26%{transform:translateY(8px) scaleY(.96)}58%{transform:translate(7px,-13px) rotate(5deg) scaleY(1.035)}}
@keyframes bruteLegUpper{0%,100%{transform:none}28%{transform:translateY(5px) scaleY(.96)}58%{transform:translateY(-4px) scaleY(1.02)}}
@keyframes bruteLimbSpin{0%,100%{transform:none}24%{transform:rotate(-55deg) translate(-8px,2px)}58%{transform:rotate(72deg) translate(25px,-2px)}}
@keyframes bruteLimbSpinGuard{0%,100%{transform:none}55%{transform:rotate(-24deg) translate(-8px,-3px)}}
@keyframes bruteTorsoSpin{0%,100%{transform:none}25%{transform:rotate(-13deg)}58%{transform:rotate(20deg) translateX(8px)}}
@keyframes bruteHipSpin{0%,100%{transform:none}58%{transform:rotate(14deg) translateX(5px)}}
@keyframes bruteLimbSlam{0%,100%{transform:none}22%{transform:rotate(-64deg) translate(-8px,-16px)}54%{transform:rotate(44deg) translate(27px,16px)}75%{transform:rotate(15deg) translate(12px,5px)}}
@keyframes bruteLimbSlamGuard{0%,100%{transform:none}26%{transform:rotate(-28deg) translate(-6px,-10px)}56%{transform:rotate(18deg) translate(8px,7px)}}
@keyframes bruteTorsoSlam{0%,100%{transform:none}22%{transform:translate(-4px,-10px) rotate(-7deg)}54%{transform:translate(9px,9px) rotate(9deg) scaleY(.98)}}
@keyframes bruteRearDriveHeavy{0%,100%{transform:none}24%{transform:rotate(-7deg) translate(-4px,-2px)}54%{transform:rotate(5deg) translate(5px,4px)}}
@keyframes bruteTorsoSweep{0%,100%{transform:none}25%{transform:translateY(9px) rotate(-5deg) scaleY(.95)}58%{transform:translate(7px,12px) rotate(7deg) scaleY(.94)}}
@keyframes bruteLeadSweep{0%,100%{transform:none}28%{transform:rotate(-5deg) translateY(2px)}58%{transform:rotate(46deg) translate(25px,8px)}74%{transform:rotate(18deg) translate(9px,3px)}}
@keyframes bruteSweepGuard{0%,100%{transform:none}55%{transform:rotate(-12deg) translateY(7px)}}
@keyframes bruteDodgeTorsoStep{0%,100%{transform:none}42%{transform:rotate(-8deg) translate(-8px,-2px)}}
@keyframes bruteDodgeLegStep{0%,100%{transform:none}42%{transform:rotate(-6deg) translateX(-5px)}}
@keyframes bruteDodgeTorsoDuck{0%,100%{transform:none}42%{transform:translateY(18px) scaleY(.84) rotate(-3deg)}}
@keyframes bruteDodgeGuardDuck{0%,100%{transform:none}42%{transform:translateY(11px) rotate(-12deg)}}
@keyframes bruteDodgeLegHop{0%,100%{transform:none}38%{transform:translateY(-8px) rotate(-4deg)}68%{transform:translateY(-2px)}}
@keyframes bruteBlockGuardLeft{0%,100%{transform:none}42%{transform:rotate(-52deg) translate(-8px,-7px)}}
@keyframes bruteBlockGuardRight{0%,100%{transform:none}42%{transform:rotate(-24deg) translate(-4px,-5px)}}
@keyframes bruteBlockTorso{0%,100%{transform:none}42%{transform:scale(.95,1.03) translateY(4px)}}
@keyframes bruteHitHead{0%,100%{transform:none}20%{transform:rotate(-10deg) translate(-3px,1px)}48%{transform:rotate(4deg)}}
@keyframes bruteHitGuardBreak{0%,100%{transform:none}18%{transform:rotate(15deg) translate(7px,3px)}50%{transform:rotate(-5deg)}}
@keyframes bruteHitTorsoHeavy{0%,100%{transform:none}18%{transform:rotate(-14deg) translate(-8px,4px) scale(.96,1.03)}48%{transform:rotate(6deg) translate(4px,-1px)}}
@keyframes bruteHitHeadHeavy{0%,100%{transform:none}16%{transform:rotate(-18deg) translate(-5px,1px)}50%{transform:rotate(8deg)}}
@keyframes bruteCameraIntro{0%{transform:scale(.94);filter:blur(.8px)}65%{transform:scale(1.025);filter:blur(0)}100%{transform:scale(1)}}
@keyframes bruteCameraImpact{0%,100%{transform:scale(1)}22%{transform:translate(-4px,2px) scale(1.025)}42%{transform:translate(5px,-2px) scale(1.035)}68%{transform:translate(-2px,1px) scale(1.018)}}
@keyframes bruteCameraCritical{0%{transform:scale(1)}28%{transform:scale(1.06)}52%{transform:translate(4px,-3px) scale(1.045)}100%{transform:scale(1)}}
@keyframes bruteCameraKo{0%{transform:scale(1)}35%{transform:scale(1.055)}100%{transform:scale(1.035) translateY(-4px)}}
@keyframes bruteFloorStreak{0%{opacity:0;transform:scaleX(.25)}35%{opacity:.9}100%{opacity:0;transform:translateX(42px) scaleX(1.2)}}
@keyframes bruteContactRing{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}35%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(2.2)}}
@keyframes bruteDebris{0%{opacity:0;transform:translate(-50%,-50%) scale(.4) rotate(0)}24%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--debris-x)),calc(-50% + var(--debris-y))) scale(.2) rotate(var(--debris-r))}}
@keyframes bruteHpDamage{0%,100%{filter:none}28%{filter:brightness(2) saturate(1.6)}58%{filter:brightness(.8) saturate(1.4)}}
@keyframes bruteLogPulse{0%{transform:translateX(-50%) scale(.98);opacity:.68}55%{transform:translateX(-50%) scale(1.018);opacity:1}100%{transform:translateX(-50%) scale(1);opacity:1}}

@media (prefers-reduced-motion: reduce){
  .brute-fighters-v2 .fight-model .brute-stage,
  .brute-fighters-v2 .fight-model .brute-torso,
  .brute-fighters-v2 .fight-model .brute-arm,
  .brute-fighters-v2 .fight-model .brute-leg,
  .brute-fighters-v2 .fight-model .brute-bottom,
  .brute-fighters-v2 .fight-model .brute-head,
  .brute-arena-v4-banner,
  .brute-arena-v2-cloud,
  .brute-versus-callout{animation-duration:.001ms!important;animation-iteration-count:1!important}
}

@media(max-width:900px){
  .brute-armory-v3{grid-template-columns:1fr}
  .brute-armory-v3-focus{min-height:520px}
}
@media(max-width:660px){
  .brute-cell-statline-v3{grid-template-columns:repeat(2,1fr)}
  .brute-stat-v3{min-height:96px}
  .brute-armory-weapon-v3{grid-template-columns:55px 1fr auto}
  .brute-armory-weapon-art,
  .brute-armory-weapon-art .ga-weapon-icon{width:48px;height:48px}
  .brute-armory-perks-v3{grid-template-columns:1fr}
  .brute-armory-v3-weapon-focus{grid-template-columns:92px 1fr}
  .brute-armory-v3-weapon-orbit{width:88px;height:88px}
  .brute-armory-v3-weapon-orbit .ga-weapon-icon{width:84px;height:84px}
  .brute-hud-v3{grid-template-columns:1fr 42px 1fr!important}
  .brute-hud-v3-side{padding:4px}
  .brute-hud-v3-head{grid-template-columns:30px minmax(0,1fr) 38px}
  .brute-hud-v3-side.right .brute-hud-v3-head{grid-template-columns:38px minmax(0,1fr) 30px}
  .brute-hud-v3-portrait{width:29px;height:29px}
  .brute-hud-v3-portrait .ga-brute-svg{width:31px;height:38px}
  .brute-hud-v3-name b{font-size:7px}
  .brute-hud-v3-name small{font-size:4.5px}
  .brute-combo-meter{min-width:35px;height:29px}
  .brute-combo-meter b{font-size:9px}
  .brute-combo-meter small{font-size:3.5px}
  .brute-hud-v3-live span:nth-child(n+4){display:none}
  .brute-hud-v3-live{grid-template-columns:repeat(3,1fr)}
  .brute-hud-v3-weapon{grid-template-columns:25px 1fr;min-height:28px}
  .brute-hud-v3-side.right .brute-hud-v3-weapon{grid-template-columns:1fr 25px}
  .brute-weapon-hud-icon,
  .brute-weapon-hud-icon .ga-weapon-icon{width:23px;height:23px}
  .brute-weapon-hud-copy small{display:none}
  .brute-fight-xp-preview{display:none}
  .brute-afterimage{width:min(140px,56%)!important}
  .brute-arena.brute-arena-v3{min-height:500px}
  .brute-fighters-v2 .brute-fighter{min-height:285px}
  .brute-fighters-v2 .brute-fighter .ga-brute-svg.fight-model{width:min(178px,68%);max-height:255px}
  .brute-arena-v4-banner{width:34px;height:118px}
  .brute-arena-v4-gong{width:72px;height:72px;border-width:5px}
  .brute-versus-callout{width:58%}
  .brute-versus-callout b{font-size:32px}
  .brute-log.brute-log-v3{width:72%;font-size:7px;padding:6px 10px}
}
`

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
  let playbackPaused = false
  let playbackToken = 0
  let currentTimeline = null
  let currentFightMeta = null
  let fightTelemetry = null
  let idleSnapshot = null
  let idleSnapshotAt = Date.now()
  let sleepMode = 'rain'
  let sleepTimer = null
  let music = null
  let musicEnabled =
    (() => {
      try {
        return (
          localStorage.getItem(
            'ga-brute-music-v1'
          ) !== 'off'
        )
      } catch {
        return true
      }
    })()
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
    if (
      !musicEnabled ||
      screen === 'sleep' ||
      screen === 'fight'
    ) {
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
      '<button class="brute-mini" data-brute-music-toggle>'+(musicEnabled ? 'MUSIQUE' : 'MUET')+'</button>'+
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
      : '<span class="brute-selector-avatar custom">' + uiGlyph('profile','brute-selector-glyph') + '</span>'
  }

  function renderSelector() {
    const preferred =
      String(
        options.preferredSlug ||
        ''
      )
        .trim()
        .toLowerCase()

    const ordered =
      athletes
        .slice()
        .sort(
          (a,b) => {
            const aSlug =
              athleteSlug(a)
                .toLowerCase()

            const bSlug =
              athleteSlug(b)
                .toLowerCase()

            const aOwn =
              preferred &&
              aSlug === preferred
                ? 1
                : 0

            const bOwn =
              preferred &&
              bSlug === preferred
                ? 1
                : 0

            if (aOwn !== bOwn) {
              return bOwn - aOwn
            }

            return String(
              a?.name ||
              ''
            ).localeCompare(
              String(
                b?.name ||
                ''
              ),
              'fr',
              {
                sensitivity:'base',
              }
            )
          }
        )

    return '<div class="brute-panel brute-pad">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">'+
        '<div><small style="color:#858ca8;font-weight:900">IDLE TRAINING · GA BRUTE</small><h2>Choisir un athlète</h2><p style="margin:4px 0 13px;color:#747c98;font-size:9px">Sommeil · steps · séances · personnage · PvE · Duel</p></div>'+
        '<button class="brute-mini" data-brute-music-toggle>'+(musicEnabled ? 'MUSIQUE' : 'MUET')+'</button>'+
      '</div>'+
      '<div class="brute-list">'+
        ordered.map(a => {
          const slug =
            athleteSlug(a)

          const mine =
            preferred &&
            slug.toLowerCase() ===
              preferred

          return '<button class="brute-row brute-secondary '+(mine?'brute-row-self':'')+'" data-brute-select="'+esc(slug)+'">'+
            athleteAvatarMarkup(a)+
            '<span><b>'+esc(a.name || a.id)+(mine?' <em class="brute-self-pill">MOI</em>':'')+'</b><small>'+(mine?'Ton profil · ':'')+'Ouvrir son Idle Training</small></span>'+
            '<span>›</span>'+
          '</button>'
        }).join('')+
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
      '<div class="brute-creator-section-title"><span>'+esc(title)+'</span>'+
        (
          randomKey
            ? '<button type="button" class="brute-section-random" data-brute-random-section="'+esc(randomKey)+'" title="Randomiser cette partie">'+uiGlyph('random','brute-random-glyph')+'</button>'
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
          '<b>›</b>'+
        '</div>'+
        '<div class="brute-mybrute-name-row">'+
          '<input class="brute-mybrute-name" maxlength="28" data-brute-name value="'+esc(draftName)+'" placeholder="Nom de la brute">'+
          '<button type="button" class="brute-mybrute-lock '+(draftFixed ? 'locked' : '')+'" data-brute-lock title="'+esc(status)+'">'+
            uiGlyph(draftFixed ? 'lock' : 'unlock','brute-lock-glyph')+
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
            '<span class="icon">'+uiGlyph('profile','brute-creator-tool-glyph')+'</span>'+
            '<span>Changer<br>l’apparence</span>'+
          '</button>'+
          '<button type="button" class="brute-mybrute-tool" data-brute-change-colors>'+
            '<span class="icon">'+uiGlyph('palette','brute-creator-tool-glyph')+'</span>'+
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

  function uiGlyph(
    name,
    className = ''
  ) {
    const shapes = {
      arena:'<path d="M18 73 Q50 44 82 73 M25 76 L18 40 L34 49 L50 28 L66 49 L82 40 L75 76Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/><path d="M31 77 H69" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
      pve:'<path d="M19 59 H81 M27 48 V70 M73 48 V70 M37 42 V76 M63 42 V76" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M41 31 Q50 19 59 31" fill="none" stroke="currentColor" stroke-width="7"/>',
      camp:'<path d="M17 78 L50 22 L83 78Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/><path d="M50 22 V80 M36 55 H64" stroke="currentColor" stroke-width="6"/>',
      sleep:'<path d="M66 22 Q42 27 39 49 Q37 70 60 80 Q39 87 24 71 Q9 55 20 36 Q31 17 51 18 Q58 18 66 22Z" fill="currentColor"/>',
      ranking:'<path d="M21 77 H79 M29 75 V48 H45 V75 M55 75 V33 H71 V75 M37 42 V24 H53 V42" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>',
      weapon:'<path d="M24 74 L68 30 M62 24 L76 20 L80 34 L36 78Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M29 67 L40 78" stroke="currentColor" stroke-width="8"/>',
      heart:'<path d="M50 80 Q15 59 18 35 Q20 19 36 19 Q46 19 50 31 Q55 19 66 19 Q81 20 82 35 Q84 58 50 80Z" fill="currentColor"/>',
      strength:'<path d="M17 43 H83 M22 33 V53 M78 33 V53 M31 28 V58 M69 28 V58" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
      agility:'<path d="M19 62 Q36 25 55 46 Q70 61 83 31 M58 25 L83 31 L75 52" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
      speed:'<path d="M18 31 H52 M12 49 H45 M20 67 H56 M64 24 L47 53 H62 L49 80 L84 43 H68Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
      profile:'<circle cx="50" cy="34" r="17" fill="none" stroke="currentColor" stroke-width="7"/><path d="M20 82 Q25 57 50 57 Q75 57 80 82" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
      palette:'<path d="M50 18 Q79 18 84 43 Q88 64 70 72 Q61 76 55 68 Q51 61 43 66 Q32 74 22 65 Q12 56 17 41 Q23 19 50 18Z" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="34" cy="36" r="5" fill="currentColor"/><circle cx="51" cy="29" r="5" fill="currentColor"/><circle cx="67" cy="39" r="5" fill="currentColor"/>',
      random:'<path d="M18 30 H32 Q42 30 49 42 L59 58 Q66 70 78 70 H84 M74 61 L84 70 L74 79 M18 70 H31 Q41 70 48 58 L58 42 Q65 30 78 30 H84 M74 21 L84 30 L74 39" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
      lock:'<rect x="24" y="43" width="52" height="39" rx="8" fill="none" stroke="currentColor" stroke-width="7"/><path d="M34 43 V34 Q34 18 50 18 Q66 18 66 34 V43" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="61" r="5" fill="currentColor"/>',
      unlock:'<rect x="24" y="43" width="52" height="39" rx="8" fill="none" stroke="currentColor" stroke-width="7"/><path d="M34 43 V34 Q34 18 50 18 Q62 18 66 28" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="61" r="5" fill="currentColor"/>',
      energy:'<path d="M57 15 L28 54 H48 L42 84 L74 43 H54Z" fill="currentColor"/>',
      xp:'<path d="M50 14 L59 38 L85 39 L64 55 L71 81 L50 66 L29 81 L36 55 L15 39 L41 38Z" fill="currentColor"/>',
      trophy:'<path d="M31 19 H69 V39 Q69 59 50 64 Q31 59 31 39Z M31 28 H18 V38 Q18 51 33 53 M69 28 H82 V38 Q82 51 67 53 M50 64 V76 M35 82 H65" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
      replay:'<path d="M29 31 Q43 18 61 24 Q79 30 82 49 Q84 69 67 79 Q47 90 29 76 Q18 67 18 53 M18 32 V53 H39" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
      loss:'<path d="M27 27 L73 73 M73 27 L27 73" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
    }

    return '<svg class="ga-ui-glyph '+esc(className)+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
      (shapes[name] || shapes.weapon)+
    '</svg>'
  }

  function statTier(
    value
  ) {
    const v =
      Math.max(
        0,
        num(value)
      )

    return Math.max(
      1,
      Math.floor(
        v / 5
      )
    )
  }

  function statCell(
    kind,
    value
  ) {
    const meta = {
      hp:{
        label:'PV',
        effect:'SURVIE',
        glyph:'heart',
      },
      strength:{
        label:'FORCE',
        effect:'DÉGÂTS · STUN',
        glyph:'strength',
      },
      agility:{
        label:'AGILITÉ',
        effect:'ESQUIVE · CONTRE',
        glyph:'agility',
      },
      speed:{
        label:'VITESSE',
        effect:'INITIATIVE · COMBO',
        glyph:'speed',
      },
    }[kind]

    const v =
      Math.max(
        0,
        num(value)
      )

    const tier =
      statTier(
        kind === 'hp'
          ? v / 6
          : v
      )

    const normalized =
      kind === 'hp'
        ? v / 6
        : v

    const nextNormalized =
      (
        Math.floor(
          normalized / 5
        ) +
        1
      ) *
      5

    const next =
      kind === 'hp'
        ? nextNormalized * 6
        : nextNormalized

    const pct =
      Math.max(
        0,
        Math.min(
          100,
          (
            normalized %
            5
          ) /
          5 *
          100
        )
      )

    return (
      '<span class="brute-stat-v3 tier-'+Math.min(6,tier)+'">'+
        uiGlyph(
          meta.glyph,
          'brute-stat-v3-glyph'
        )+
        '<b>'+v+'</b>'+
        '<small>'+meta.label+'</small>'+
        '<em>'+meta.effect+'</em>'+
        '<div class="brute-stat-v3-progress"><i style="width:'+pct+'%"></i></div>'+
        '<u>PALIER '+tier+' · '+Math.ceil(next)+'</u>'+
      '</span>'
    )
  }

  function weaponRole(
    weapon
  ) {
    const category =
      weapon?.category ||
      'unarmed'

    if (category === 'heavy') {
      return 'IMPACT'
    }

    if (category === 'flexible') {
      return 'PRESSION'
    }

    if (category === 'ranged') {
      return 'CONTRÔLE'
    }

    return 'COMBO'
  }

  function weaponIdentity(
    weapon
  ) {
    const labels = {
      fists:'RAPIDE · PRÉCIS · CHAÎNES',
      olympic_bar:'PORTÉE · IMPACT · CRITIQUE',
      kettlebell:'SWING · IMPACT · POLYVALENT',
      plate20:'LOURD · LANCER · KNOCKBACK',
      belt:'FOUET · PRESSION · CONTRE',
      chalk:'AVEUGLE · RAPIDE · COMBO',
      straps:'GRIP · CADENCE · COMBO',
    }

    return labels[weapon?.id || 'fists'] || weaponRole(weapon)
  }

  function weaponMastery(
    fighter,
    weapon
  ) {
    const f = fighter || brute || {}
    const strength = num(f.strength)
    const agility = num(f.agility)
    const speed = num(f.speed)
    const category = weapon?.category || 'unarmed'

    const weighted =
      category === 'heavy'
        ? strength * .62 + speed * .23 + agility * .15
        : category === 'flexible'
          ? agility * .44 + speed * .36 + strength * .20
          : category === 'ranged'
            ? speed * .48 + agility * .38 + strength * .14
            : speed * .40 + agility * .35 + strength * .25

    return Math.max(8,Math.min(100,Math.round(weighted / 30 * 100)))
  }

  function comboTier(streak) {
    if (streak >= 8) return { label:'OVERDRIVE', level:5 }
    if (streak >= 6) return { label:'FURY', level:4 }
    if (streak >= 4) return { label:'RUSH', level:3 }
    if (streak >= 2) return { label:'FLOW', level:2 }
    return { label:'CHAÎNE', level:1 }
  }

  function fighterAuraClass(fighter) {
    const classes = []
    if (num(fighter?.strength) >= 15) classes.push('stat-force')
    if (num(fighter?.strength) >= 22) classes.push('stat-force-elite')
    if (num(fighter?.agility) >= 15) classes.push('stat-agility')
    if (num(fighter?.agility) >= 22) classes.push('stat-agility-elite')
    if (num(fighter?.speed) >= 15) classes.push('stat-speed')
    if (num(fighter?.speed) >= 22) classes.push('stat-speed-elite')
    if (num(fighter?.strength) >= 20 && num(fighter?.agility) >= 20 && num(fighter?.speed) >= 20) classes.push('stat-apex')
    return classes.join(' ')
  }

  function weaponHudMarkup(
    weapon,
    fighter = null
  ) {
    const w =
      weapon ||
      BRUTE_WEAPONS.fists

    const mastery =
      weaponMastery(
        fighter,
        w
      )

    return (
      '<span class="brute-weapon-hud-icon">'+
        renderWeaponIconSvg(
          w,
          {
            className:'hud',
          }
        )+
      '</span>'+
      '<span class="brute-weapon-hud-copy">'+
        '<b>'+esc(w.name)+'</b>'+
        '<small>'+esc(weaponIdentity(w))+'</small>'+
        '<span class="brute-weapon-mastery"><i style="width:'+mastery+'%"></i><em>MAÎTRISE '+mastery+'</em></span>'+
      '</span>'
    )
  }

  function fighterBuildTag(
    fighter
  ) {
    const stats = [
      ['FOR',num(fighter.strength)],
      ['AGI',num(fighter.agility)],
      ['VIT',num(fighter.speed)],
    ]

    const best =
      stats
        .slice()
        .sort(
          (a,b) =>
            b[1] - a[1]
        )[0]

    return (
      best[0] +
      ' ' +
      best[1]
    )
  }

  function resetFightTelemetry(
    tl
  ) {
    fightTelemetry = {
      timeline:tl,
      streak:{
        left:0,
        right:0,
      },
      maxCombo:{
        left:1,
        right:1,
      },
      damage:{
        left:0,
        right:0,
      },
      crits:{
        left:0,
        right:0,
      },
      lastAttacker:'',
    }
  }

  function ensureFightTelemetry(
    tl
  ) {
    if (
      !fightTelemetry ||
      fightTelemetry.timeline !== tl
    ) {
      resetFightTelemetry(
        tl
      )
    }

    return fightTelemetry
  }

  function updateFightTelemetry(
    event,
    tl
  ) {
    const telemetry =
      ensureFightTelemetry(
        tl
      )

    const actor =
      event.actor

    const target =
      event.target

    if (
      (
        event.type === 'ATTACK' ||
        event.type === 'PET_ATTACK' ||
        event.type === 'FINISHER'
      ) &&
      (
        actor === 'left' ||
        actor === 'right'
      )
    ) {
      if (
        telemetry.lastAttacker ===
          actor
      ) {
        telemetry.streak[actor] += 1
      } else {
        telemetry.streak[actor] = 1
      }

      telemetry.lastAttacker =
        actor

      telemetry.damage[actor] +=
        num(
          event.damage
        )

      if (event.critical) {
        telemetry.crits[actor] += 1
      }

      telemetry.maxCombo[actor] =
        Math.max(
          telemetry.maxCombo[actor],
          telemetry.streak[actor]
        )
    }

    if (
      event.type === 'COMBO' &&
      (
        actor === 'left' ||
        actor === 'right'
      )
    ) {
      telemetry.streak[actor] =
        Math.max(
          2,
          telemetry.streak[actor] +
          1
        )

      telemetry.maxCombo[actor] =
        Math.max(
          telemetry.maxCombo[actor],
          telemetry.streak[actor]
        )
    }

    if (
      event.type === 'MISS' &&
      (
        actor === 'left' ||
        actor === 'right'
      )
    ) {
      telemetry.streak[actor] = 0
    }

    if (
      event.type === 'DODGE' &&
      (
        target === 'left' ||
        target === 'right'
      )
    ) {
      telemetry.streak[target] = 0
    }

    for (
      const side of [
        'left',
        'right',
      ]
    ) {
      const combo =
        root.querySelector(
          '[data-combo-'+side+']'
        )

      const damage =
        root.querySelector(
          '[data-fight-damage-'+side+']'
        )

      const crit =
        root.querySelector(
          '[data-fight-crits-'+side+']'
        )

      if (combo) {
        const streak =
          telemetry.streak[side]

        combo.classList.toggle(
          'active',
          streak >= 2
        )

        const tier =
          comboTier(
            streak
          )

        combo.dataset.tier =
          String(
            tier.level
          )

        combo.innerHTML =
          '<b>x'+Math.max(1,streak)+'</b><small>'+tier.label+'</small><i style="width:'+Math.min(100,Math.max(16,streak*12.5))+'%"></i>'
      }

      if (damage) {
        damage.textContent =
          telemetry.damage[side]
      }

      if (crit) {
        crit.textContent =
          telemetry.crits[side]
      }
    }
  }

  function inventoryTile(
    kind,
    id,
    active = false
  ) {
    let item
    let name = id
    let art = ''

    if (kind === 'weapon') {
      item =
        BRUTE_WEAPONS[id] ||
        BRUTE_WEAPONS.fists

      name =
        item?.name ||
        id

      art =
        renderWeaponIconSvg(
          item,
          {
            className:'cell',
          }
        )
    } else if (kind === 'skill') {
      item =
        BRUTE_SKILLS[id]

      name =
        item?.name ||
        id

      art =
        renderSkillIconSvg(
          id,
          {
            className:'cell',
          }
        )
    } else {
      item =
        BRUTE_PETS[id]

      name =
        item?.name ||
        id

      art =
        renderPetSvg(
          item
        )
    }

    return (
      '<span class="brute-cell-item '+(active?'active':'')+'" title="'+esc(name)+'">'+
        '<b class="brute-cell-art">'+art+'</b>'+
        '<small>'+esc(name)+'</small>'+
      '</span>'
    )
  }

  function renderInventoryShelf(
    title,
    kind,
    ids,
    activeId = ''
  ) {
    const list =
      Array.isArray(ids)
        ? ids
        : []

    return (
      '<section class="brute-cell-shelf">'+
        '<header><span>'+esc(title)+'</span><b>'+list.length+'</b></header>'+
        '<div class="brute-cell-items">'+
          (
            list.length
              ? list
                  .slice(0,12)
                  .map(
                    id =>
                      inventoryTile(
                        kind,
                        id,
                        id === activeId
                      )
                  )
                  .join('')
              : '<span class="brute-cell-empty">—</span>'
          )+
        '</div>'+
      '</section>'
    )
  }

  function cellAction(
    screenName,
    icon,
    title,
    subtitle,
    extra = ''
  ) {
    return (
      '<button class="brute-cell-action '+esc(extra)+'" data-brute-screen="'+esc(screenName)+'">'+
        '<span class="brute-cell-action-icon">'+uiGlyph(icon)+'</span>'+
        '<span><b>'+esc(title)+'</b><small>'+esc(subtitle)+'</small></span>'+
        '<i>›</i>'+
      '</button>'
    )
  }

  function renderMenu() {
    const t = theme()
    const weaponId =
      brute.loadout?.weapon ||
      'fists'

    const weapon =
      BRUTE_WEAPONS[weaponId] ||
      BRUTE_WEAPONS.fists

    const petId =
      (brute.pets || [])[0]

    const pet =
      BRUTE_PETS[petId]

    const xpPct =
      Math.max(
        0,
        Math.min(
          100,
          num(brute.xp) /
            Math.max(
              1,
              xpNeeded()
            ) *
            100
        )
      )

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

    return (
      '<section class="brute-cell-v2">'+
        '<div class="brute-cell-sky"></div>'+
        '<header class="brute-cell-header">'+
          '<button class="brute-cell-small" data-brute-exit>← GA</button>'+
          '<div class="brute-cell-name">'+
            '<span class="brute-brand-mark">'+uiGlyph('strength','brute-brand-glyph')+' GA BRUTE</span>'+
            '<h1>'+esc(brute.name)+'</h1>'+
          '</div>'+
          '<div class="brute-cell-header-actions">'+
            '<button class="brute-cell-small" data-brute-music-toggle>'+(musicEnabled ? 'SON' : 'MUET')+'</button>'+
            (
              options.allowAthleteSelection
                ? '<button class="brute-cell-small" data-brute-switch>Changer</button>'
                : ''
            )+
          '</div>'+
        '</header>'+
        '<div class="brute-cell-grid-v2">'+
          '<aside class="brute-cell-inventory">'+
            '<div class="brute-cell-board-title">ARSENAL</div>'+
            renderInventoryShelf(
              'ARMES',
              'weapon',
              brute.weapons || [],
              weaponId
            )+
            renderInventoryShelf(
              'COMPÉTENCES',
              'skill',
              brute.skills || []
            )+
            renderInventoryShelf(
              'FAMILIERS',
              'pet',
              brute.pets || [],
              petId
            )+
            '<button class="brute-cell-inventory-link" data-brute-screen="equipment">GÉRER L’ÉQUIPEMENT</button>'+
          '</aside>'+
          '<main class="brute-cell-main">'+
            '<div class="brute-cell-level-ribbon">'+
              '<span>NIVEAU</span><b>'+num(brute.level,1)+'</b>'+
              '<i>Cote '+num(brute.rating,1000)+'</i>'+
            '</div>'+
            '<div class="brute-cell-avatar-stage">'+
              '<div class="brute-cell-window"></div>'+
              '<div class="brute-cell-avatar-shadow"></div>'+
              '<div class="brute-cell-avatar">'+
                renderBruteSvg(
                  brute.appearance,
                  {
                    label:brute.name,
                    weapon,
                    pet,
                  }
                )+
              '</div>'+
              (
                pet
                  ? '<span class="brute-cell-pet-label">'+
                      '<span class="brute-cell-pet-mini">'+renderPetSvg(pet)+'</span>'+
                      '<b>'+esc(pet.name)+'</b>'+
                    '</span>'
                  : ''
              )+
            '</div>'+
            '<div class="brute-cell-statline brute-cell-statline-v3">'+
              statCell('hp',brute.hp)+
              statCell('strength',brute.strength)+
              statCell('agility',brute.agility)+
              statCell('speed',brute.speed)+
            '</div>'+
            '<div class="brute-cell-bars">'+
              '<div><header><span>EXPÉRIENCE</span><b>'+num(brute.xp)+' / '+xpNeeded()+'</b></header><div class="brute-cell-bar xp"><i style="width:'+xpPct+'%"></i></div></div>'+
              '<div><header><span>ÉNERGIE · +1/MIN</span><b data-brute-energy-value>'+energy+' / 500</b></header><div class="brute-cell-bar energy"><i data-brute-energy-bar style="width:'+energyPct+'%"></i></div></div>'+
            '</div>'+
            renderChoices()+
          '</main>'+
          '<aside class="brute-cell-actions">'+
            '<div class="brute-cell-board-title">AUJOURD’HUI</div>'+
            '<div class="brute-cell-fights"><span>COMBATS</span><b>'+num(daily.remaining,6)+' / '+num(daily.limit,6)+'</b></div>'+
            cellAction(
              'duel',
              'arena',
              'ARÈNE',
              'Affronter une autre brute',
              'primary'
            )+
            cellAction(
              'pve',
              'pve',
              'OPENPOWER',
              'PvE · 8 énergie'
            )+
            cellAction(
              'camp',
              'camp',
              'CAMP',
              'Progression du jour'
            )+
            cellAction(
              'sleep',
              'sleep',
              'SOMMEIL',
              'Bonus XP & récupération'
            )+
            cellAction(
              'ranking',
              'ranking',
              'CLASSEMENT',
              'Toutes les brutes'
            )+
            '<div class="brute-cell-record">'+
              '<span>PALMARÈS</span>'+
              '<div><b>'+num(brute.wins)+'</b><small>V</small><b>'+num(brute.losses)+'</b><small>D</small></div>'+
            '</div>'+
          '</aside>'+
        '</div>'+
      '</section>'
    )
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

  function rewardArt(choice) {
    if (choice?.type === 'weapon') {
      return renderWeaponIconSvg(BRUTE_WEAPONS[choice.id] || BRUTE_WEAPONS.fists,{ className:'reward' })
    }
    if (choice?.type === 'skill') {
      return renderSkillIconSvg(choice.id,{ className:'reward' })
    }
    if (choice?.type === 'pet') {
      return renderPetSvg(BRUTE_PETS[choice.id] || { id:choice.id, name:choice.name })
    }
    const glyph =
      choice?.id === 'strength'
        ? 'strength'
        : choice?.id === 'agility'
          ? 'agility'
          : choice?.id === 'speed'
            ? 'speed'
            : 'heart'
    return uiGlyph(glyph,'brute-reward-stat-glyph')
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
        '<span class="big art">'+rewardArt(choice)+'</span>'+
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
      history.slice(0,5)

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

    const scoreMeter =
      (
        label,
        value,
        icon,
        note
      ) => {
        const score =
          Math.max(
            0,
            Math.min(
              100,
              num(value)
            )
          )

        return (
          '<div class="brute-camp-v2-meter">'+
            '<header><span class="brute-meter-label">'+uiGlyph(icon,'brute-meter-glyph')+esc(label)+'</span><b>'+score+'/100</b></header>'+
            '<div><i style="width:'+score+'%"></i></div>'+
            '<small>'+esc(note)+'</small>'+
          '</div>'
        )
      }

    return (
      topBar(
        'Camp',
        'Cellule · progression'
      )+
      '<section class="brute-camp-v2">'+
        '<div class="brute-camp-v2-left">'+
          '<div class="brute-parchment-panel">'+
            '<h3>JOURNÉE</h3>'+
            scoreMeter(
              'Entraînement',
              idleSnapshot?.training_score,
              'strength',
              num(idleSnapshot?.training_sets,0)+' séries enregistrées'
            )+
            scoreMeter(
              'Activité',
              idleSnapshot?.steps_score,
              'speed',
              num(idleSnapshot?.steps,0)+' pas'
            )+
            scoreMeter(
              'Sommeil',
              sleepScoreNow(),
              'sleep',
              Math.round(num(idleSnapshot?.sleep_seconds,0)/360)/10+' h · bonus XP +'+sleepXpBonusNow()
            )+
          '</div>'+
          '<button class="brute-camp-v2-action" data-brute-screen="equipment"><span class="brute-inline-glyph">'+uiGlyph('weapon')+'</span> Arsenal & apparence</button>'+
          '<button class="brute-camp-v2-action main" data-brute-screen="duel"><span class="brute-inline-glyph">'+uiGlyph('arena')+'</span> Aller à l’arène</button>'+
        '</div>'+
        '<div class="brute-camp-v2-center">'+
          '<div class="brute-camp-v2-sign">CAMP DE '+esc(brute.name)+'</div>'+
          '<div class="brute-camp-v2-avatar">'+
            '<div class="brute-cell-avatar-shadow"></div>'+
            renderBruteSvg(
              brute.appearance,
              {
                label:brute.name,
                weapon,
                pet,
              }
            )+
          '</div>'+
          '<div class="brute-camp-v2-name">NIV. '+num(brute.level,1)+' · '+esc(brute.name)+'</div>'+
          '<div class="brute-cell-bars compact">'+
            '<div><header><span class="brute-bar-label">'+uiGlyph('energy','brute-bar-glyph')+' ÉNERGIE</span><b data-brute-energy-value>'+energy+' / 500</b></header><div class="brute-cell-bar energy"><i data-brute-energy-bar style="width:'+energyPct+'%"></i></div></div>'+
            '<div><header><span class="brute-bar-label">'+uiGlyph('xp','brute-bar-glyph')+' XP</span><b>'+num(brute.xp)+' / '+xpNeeded()+'</b></header><div class="brute-cell-bar xp"><i style="width:'+pct+'%"></i></div></div>'+
          '</div>'+
          (
            asleep
              ? '<button class="brute-camp-v2-sleep active" data-brute-go-sleep><span class="brute-inline-glyph">'+uiGlyph('sleep')+'</span> SOMMEIL EN COURS · XP +'+sleepXpBonusNow()+'</button>'
              : '<button class="brute-camp-v2-sleep" data-brute-go-sleep><span class="brute-inline-glyph">'+uiGlyph('sleep')+'</span> ALLER SE COUCHER</button>'
          )+
          renderChoices()+
        '</div>'+
        '<aside class="brute-camp-v2-right">'+
          '<div class="brute-parchment-panel">'+
            '<h3>PUISSANCE</h3>'+
            '<div class="brute-camp-v2-power"><b>'+num(idleSnapshot?.power,35)+'</b><span>PUISSANCE DU JOUR</span></div>'+
            '<div class="brute-cell-statline mini">'+
              '<span><i>'+uiGlyph('strength')+'</i><b>'+num(brute.strength)+'</b></span>'+
              '<span><i>'+uiGlyph('agility')+'</i><b>'+num(brute.agility)+'</b></span>'+
              '<span><i>'+uiGlyph('speed')+'</i><b>'+num(brute.speed)+'</b></span>'+
            '</div>'+
          '</div>'+
          '<div class="brute-parchment-panel history">'+
            '<h3>DERNIERS COMBATS</h3>'+
            (
              recent.length
                ? recent.map(f => {
                    const opp =
                      f.attacker_slug === selectedSlug
                        ? f.defender_slug
                        : f.attacker_slug

                    const win =
                      f.winner_slug === selectedSlug

                    return (
                      '<div class="brute-camp-v2-history-row">'+
                        '<span class="brute-history-glyph">'+uiGlyph(win?'trophy':'loss')+'</span>'+
                        '<div><b>'+esc(opp)+'</b><small>+'+num(f.xp_gained)+' XP</small></div>'+
                        '<button class="brute-mini brute-icon-button" data-brute-replay="'+esc(f.id)+'">'+uiGlyph('replay')+'</button>'+
                      '</div>'
                    )
                  }).join('')
                : '<small class="brute-cell-empty">Aucun combat.</small>'
            )+
          '</div>'+
        '</aside>'+
      '</section>'
    )
  }

  function renderDuel() {
    const opponents =
      roster
        .filter(
          row =>
            row.athlete_slug !==
              selectedSlug &&
            row.appearance_locked_at
        )
        .sort(
          (a,b) =>
            Math.abs(
              a.level -
              brute.level
            ) -
            Math.abs(
              b.level -
              brute.level
            )
        )
        .slice(0,12)

    const threat =
      opponent => {
        const delta =
          num(opponent.level) -
          num(brute.level)

        if (delta >= 2) return 'DANGER'
        if (delta === 1) return 'FORT'
        if (delta <= -2) return 'FACILE'
        return 'ÉQUILIBRÉ'
      }

    return (
      topBar(
        'Arène',
        'Choisis ton adversaire'
      )+
      '<section class="brute-duel-v2">'+
        '<header class="brute-duel-v2-head">'+
          '<div><span>COMBATS DU JOUR</span><b>'+num(daily.remaining,6)+' / '+num(daily.limit,6)+'</b><small>restants</small></div>'+
          '<button class="brute-cell-action primary random" data-brute-random-duel '+(num(daily.remaining)<=0?'disabled':'')+'>'+
            '<span class="brute-cell-action-icon">'+uiGlyph('arena')+'</span>'+
            '<span><b>ADVERSAIRE ALÉATOIRE</b><small>Entrer directement dans l’arène</small></span>'+
            '<i>›</i>'+
          '</button>'+
        '</header>'+
        '<div class="brute-duel-posters">'+
          (
            opponents.length
              ? opponents.map(o => {
                  const ratio =
                    num(o.wins) +
                    num(o.losses) > 0
                      ? Math.round(
                          num(o.wins) /
                          (
                            num(o.wins) +
                            num(o.losses)
                          ) *
                          100
                        )
                      : 0

                  return (
                    '<article class="brute-duel-poster">'+
                      '<div class="brute-duel-pin"></div>'+
                      '<span class="brute-duel-avatar custom">'+renderBruteSvg(o.appearance,{label:o.name,className:'duel-mini'})+'</span>'+
                      '<div class="brute-duel-poster-title"><b>'+esc(o.name)+'</b><small>NIV. '+num(o.level)+' · COTE '+num(o.rating)+'</small></div>'+
                      '<div class="brute-duel-threat '+threat(o).toLowerCase()+'">'+threat(o)+'</div>'+
                      '<div class="brute-duel-record"><span>'+num(o.wins)+' V</span><span>'+num(o.losses)+' D</span><span>'+ratio+'%</span></div>'+
                      '<button class="brute-duel-fight" data-brute-duel="'+esc(o.athlete_slug)+'" '+(num(daily.remaining)<=0?'disabled':'')+'>COMBATTRE</button>'+
                    '</article>'
                  )
                }).join('')
              : '<div class="brute-duel-empty">Aucune autre brute validée pour le moment.</div>'
          )+
        '</div>'+
      '</section>'
    )
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

    const progress =
      Math.max(
        0,
        Math.min(
          100,
          energy / 500 * 100
        )
      )

    return (
      topBar(
        'OpenPower',
        'Entraînement PvE'
      )+
      '<section class="brute-pve-v2">'+
        '<div class="brute-pve-v2-stage">'+
          '<div class="brute-pve-v2-sign">OPENPOWER TRAINING PIT</div>'+
          '<div class="brute-pve-v2-plates"><i></i><i></i><i></i><i></i></div>'+
          '<div class="brute-pve-v2-icon custom">'+uiGlyph('strength','brute-pve-glyph')+'</div>'+
          '<h2>Affronte les monstres du total</h2>'+
          '<p>Les adversaires sont construits à partir de performances FFForce présentes dans OpenPowerlifting. Plus tu montes de niveau, plus les profils deviennent dangereux.</p>'+
        '</div>'+
        '<aside class="brute-pve-v2-board">'+
          '<div class="brute-cell-board-title">PRÉPARATION</div>'+
          '<div class="brute-pve-v2-energy"><span class="brute-bar-label">'+uiGlyph('energy','brute-bar-glyph')+' ÉNERGIE</span><b data-brute-pve-energy>'+energy+'</b><small>/ 500</small></div>'+
          '<div class="brute-cell-bar energy"><i data-brute-energy-bar style="width:'+progress+'%"></i></div>'+
          '<div class="brute-pve-v2-rules">'+
            '<span><b>8</b><small>énergie / combat</small></span>'+
            '<span><b>+1</b><small>énergie / min</small></span>'+
            '<span><b>XP</b><small>steps + sommeil + training</small></span>'+
          '</div>'+
          '<button class="brute-pve-v2-launch" data-brute-pve '+(canFight?'':'disabled')+'>'+
            (canFight ? 'ENTRER DANS LA FOSSE' : 'ÉNERGIE INSUFFISANTE')+
          '</button>'+
          '<small class="brute-pve-v2-note">Le Duel reste plus rentable en XP. Le PvE sert à progresser régulièrement et tester ton build.</small>'+
        '</aside>'+
      '</section>'
    )
  }

  function renderEquipment() {
    const equipped =
      brute.loadout?.weapon ||
      'fists'

    const equippedWeapon =
      BRUTE_WEAPONS[equipped] ||
      BRUTE_WEAPONS.fists

    const metricBar = (
      label,
      value,
      max,
      suffix = ''
    ) => {
      const pct =
        Math.max(
          3,
          Math.min(
            100,
            num(value) /
            Math.max(
              1,
              num(max)
            ) *
            100
          )
        )

      return (
        '<div class="brute-weapon-metric">'+
          '<header><span>'+esc(label)+'</span><b>'+esc(value)+esc(suffix)+'</b></header>'+
          '<div><i style="width:'+pct+'%"></i></div>'+
        '</div>'
      )
    }

    return (
      topBar(
        'Arsenal',
        'Armes · compétences · familiers'
      )+
      '<section class="brute-armory-v3">'+
        '<aside class="brute-armory-v3-list">'+
          '<div class="brute-cell-board-title">RÂTELIER D’ARMES</div>'+
          '<div class="brute-armory-weapons-v3">'+
            (
              (brute.weapons || [])
                .map(id => {
                  const w =
                    BRUTE_WEAPONS[id] ||
                    BRUTE_WEAPONS.fists

                  return (
                    '<button class="brute-armory-weapon-v3 '+(equipped===id?'active':'')+'" data-brute-equip="'+esc(id)+'">'+
                      '<span class="brute-armory-weapon-art">'+renderWeaponIconSvg(w,{className:'armory'})+'</span>'+
                      '<span class="brute-armory-weapon-copy">'+
                        '<b>'+esc(w.name)+'</b>'+
                        '<small>'+weaponRole(w)+'</small>'+
                        '<em>'+esc(weaponIdentity(w))+' · MAÎTRISE '+weaponMastery(brute,w)+'</em>'+
                      '</span>'+
                      '<i>'+(equipped===id?'ÉQUIPÉE':'ÉQUIPER')+'</i>'+
                    '</button>'
                  )
                })
                .join('')
            )+
          '</div>'+
          '<div class="brute-armory-subtitle">COMPÉTENCES</div>'+
          '<div class="brute-armory-perks-v3">'+
            (
              (brute.skills || []).length
                ? (brute.skills || []).map(id => {
                    const s =
                      BRUTE_SKILLS[id] ||
                      {
                        name:id,
                        description:'',
                      }

                    return (
                      '<span class="brute-armory-perk-v3" title="'+esc(s.name)+'">'+
                        renderSkillIconSvg(id,{className:'armory'})+
                        '<b>'+esc(s.name)+'</b>'+
                        '<small>'+esc(s.description || '')+'</small>'+
                      '</span>'
                    )
                  }).join('')
                : '<small class="brute-cell-empty">Aucune compétence.</small>'
            )+
          '</div>'+
          '<div class="brute-armory-subtitle">FAMILIERS</div>'+
          '<div class="brute-armory-perks-v3 pets">'+
            (
              (brute.pets || []).length
                ? (brute.pets || []).map(id => {
                    const p =
                      BRUTE_PETS[id] ||
                      {
                        id,
                        name:id,
                      }

                    return (
                      '<span class="brute-armory-perk-v3 pet" title="'+esc(p.name)+'">'+
                        renderPetSvg(p)+
                        '<b>'+esc(p.name)+'</b>'+
                        '<small>PV '+num(p.hp)+' · FOR '+num(p.strength)+' · AGI '+num(p.agility)+' · VIT '+num(p.speed)+'</small>'+
                      '</span>'
                    )
                  }).join('')
                : '<small class="brute-cell-empty">0 / 3</small>'
            )+
          '</div>'+
        '</aside>'+
        '<main class="brute-armory-v3-focus">'+
          '<div class="brute-armory-name">'+esc(brute.name)+' · NIV. '+num(brute.level,1)+'</div>'+
          '<div class="brute-armory-v3-weapon-focus">'+
            '<div class="brute-armory-v3-weapon-orbit">'+
              renderWeaponIconSvg(
                equippedWeapon,
                {
                  className:'focus',
                }
              )+
            '</div>'+
            '<div class="brute-armory-v3-weapon-title">'+
              '<span>'+weaponRole(equippedWeapon)+'</span>'+
              '<h2>'+esc(equippedWeapon.name)+'</h2>'+
              '<p>'+
                (
                  equippedWeapon.category === 'heavy'
                    ? 'Arme lente mais très forte en impact. La Force amplifie particulièrement son potentiel.'
                    : equippedWeapon.category === 'flexible'
                      ? 'Arme de pression et d’enchaînement. Agilité et Vitesse la rendent plus dangereuse.'
                      : equippedWeapon.category === 'ranged'
                        ? 'Arme de contrôle à distance. Vitesse et précision comptent davantage.'
                        : 'Combat rapproché : précis, rapide et idéal pour transformer la Vitesse en longues chaînes.'
                )+
                '<strong class="brute-weapon-identity">'+esc(weaponIdentity(equippedWeapon))+'</strong>'+
              '</p>'+
            '</div>'+
          '</div>'+
          '<div class="brute-armory-v3-metrics">'+
            metricBar('DÉGÂTS',equippedWeapon.damage,22)+
            metricBar('VITESSE',Math.round(num(equippedWeapon.speed,1)*100),125)+
            metricBar('PORTÉE',num(equippedWeapon.reach,1),1.6)+
            metricBar('CRITIQUE',Math.round(num(equippedWeapon.crit)*100),12,'%')+
            metricBar('COMBO',Math.round((num(equippedWeapon.combo)+.08)*100),22)+
            metricBar('MAÎTRISE BUILD',weaponMastery(brute,equippedWeapon),100,'%')+
          '</div>'+
          '<div class="brute-armory-v3-avatar">'+
            '<div class="brute-cell-avatar-shadow"></div>'+
            renderBruteSvg(
              brute.appearance,
              {
                label:brute.name,
                weapon:equippedWeapon,
                pet:
                  BRUTE_PETS[
                    (brute.pets || [])[0]
                  ],
              }
            )+
          '</div>'+
          '<div class="brute-armory-actions">'+
            '<button class="brute-primary" data-brute-reroll-skin '+(busy?'disabled':'')+'>NOUVEAU SKIN</button>'+
            '<button class="brute-secondary" data-brute-reroll-colors '+(busy?'disabled':'')+'>COULEURS</button>'+
          '</div>'+
          (
            options.isCoach
              ? '<button class="brute-secondary" data-brute-reset>Refaire la création complète</button>'
              : ''
          )+
        '</main>'+
      '</section>'
    )
  }

  function renderRanking() {
    const top =
      roster.slice(0,3)

    const rest =
      roster.slice(3,100)

    return (
      topBar(
        'Classement',
        'Hall des brutes'
      )+
      '<section class="brute-ranking-v2">'+
        '<div class="brute-ranking-v2-podium">'+
          top.map(
            (row,index) => {
              const place =
                index + 1

              return (
                '<div class="brute-podium place-'+place+'">'+
                  '<span class="brute-podium-crown">'+uiGlyph(place===1?'trophy':'ranking')+'</span>'+
                  '<span class="brute-podium-avatar custom">'+renderBruteSvg(row.appearance,{label:row.name,className:'ranking-mini'})+'</span>'+
                  '<b>'+esc(row.name)+'</b>'+
                  '<small>Niv. '+num(row.level)+' · '+num(row.rating)+'</small>'+
                  '<div><span>'+num(row.wins)+'V</span><span>'+num(row.losses)+'D</span></div>'+
                '</div>'
              )
            }
          ).join('')+
        '</div>'+
        '<div class="brute-ranking-v2-board">'+
          rest.map(
            (row,index) =>
              '<div class="brute-ranking-v2-row '+(row.athlete_slug===selectedSlug?'self':'')+'">'+
                '<span class="rank">#'+(index+4)+'</span>'+
                '<span class="avatar custom">'+renderBruteSvg(row.appearance,{label:row.name,className:'ranking-row-mini'})+'</span>'+
                '<span class="name"><b>'+esc(row.name)+'</b><small>Niv. '+num(row.level)+' · '+num(row.wins)+'V / '+num(row.losses)+'D</small></span>'+
                '<b class="rating">'+num(row.rating)+'</b>'+
                '<span class="stat">'+uiGlyph('strength','brute-rank-stat-glyph')+' '+num(row.strength)+'</span>'+
                '<span class="stat">'+uiGlyph('speed','brute-rank-stat-glyph')+' '+num(row.speed)+'</span>'+
              '</div>'
          ).join('')+
        '</div>'+
      '</section>'
    )
  }

  function renderSleep() {
    const active =
      idleSnapshot
        ?.active_sleep_started_at

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
              new Date(active)
                .getTime()
            ) / 1000
          )
        : 0

    return (
      topBar(
        'Sommeil',
        'Chambre de récupération'
      )+
      '<section class="brute-sleep-v2">'+
        '<div class="brute-sleep-v2-room">'+
          '<div class="brute-sleep-v2-window"><span class="brute-sleep-moon">'+uiGlyph('sleep')+'</span><i></i><i></i><i></i></div>'+
          '<div class="brute-sleep-v2-bed">'+
            '<div class="pillow"></div>'+
            '<div class="blanket"></div>'+
          '</div>'+
          '<div class="brute-sleep-v2-clock" data-brute-sleep-time>'+
            sleepLabel(
              active
                ? liveSeconds
                : baseSeconds
            )+
          '</div>'+
          '<div class="brute-sleep-v2-status">'+(active?'SOMMEIL EN COURS':'SOMMEIL DU JOUR')+'</div>'+
          '<div class="brute-sleep-v2-xp" data-brute-sleep-xp>Bonus XP +'+sleepXpBonusNow()+'</div>'+
          '<button class="brute-sleep-v2-toggle '+(active?'wake':'')+'" data-brute-sleep-toggle>'+
            (active?'JE ME RÉVEILLE':'ALLER SE COUCHER')+
          '</button>'+
        '</div>'+
        '<aside class="brute-sleep-v2-panel">'+
          '<div class="brute-cell-board-title">AMBIANCE</div>'+
          '<p>Le sommeil fait progresser ton bonus d’XP. L’énergie revient indépendamment à +1 par minute, même quand l’application est fermée.</p>'+
          '<div class="brute-sleep-v2-score"><b>'+Math.round(sleepScoreNow())+'</b><span>/ 100</span><small>SCORE SOMMEIL</small></div>'+
          '<div class="brute-sound-grid v2">'+
            [['rain','Pluie'],['brown','Bruit brun'],['temple','Temple'],['none','Silence']].map(([key,label]) =>
              '<button class="brute-secondary '+(sleepMode===key?'active':'')+'" data-brute-sound="'+key+'">'+label+'</button>'
            ).join('')+
          '</div>'+
          '<div class="brute-sleep-v2-tip">8 h ≈ score 100/100 · jusqu’à +22 XP sur une victoire.</div>'+
        '</aside>'+
      '</section>'
    )
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
        className:'fight-model',
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
      '<span class="brute-fighter-shadow"></span>' +
      fighterGraphic(
        fighter,
        side,
        next
      )

    el.dataset.weaponCurrent =
      next
  }

  function renderFight() {
    const tl =
      currentTimeline

    if (!tl) return ''

    ensureFightTelemetry(
      tl
    )

    const left =
      tl.left

    const right =
      tl.right

    const leftWeapon =
      BRUTE_WEAPONS[
        left.loadout?.weapon
      ] ||
      BRUTE_WEAPONS[
        (left.weapons || [])[0]
      ] ||
      BRUTE_WEAPONS.fists

    const rightWeapon =
      BRUTE_WEAPONS[
        right.loadout?.weapon
      ] ||
      BRUTE_WEAPONS[
        (right.weapons || [])[0]
      ] ||
      BRUTE_WEAPONS.fists

    const potentialXp =
      num(
        currentFightMeta
          ?.xp_progress
          ?.xp_gained,
        currentFightMeta
          ?.fight
          ?.xp_gained ||
        0
      )

    const hud =
      (
        fighter,
        side,
        weapon
      ) => (
        '<div class="brute-hud-v2-side brute-hud-v3-side '+side+'">'+
          '<div class="brute-hud-v3-head">'+
            '<div class="brute-hud-v3-portrait">'+
              renderBruteSvg(
                fighter.appearance,
                {
                  label:fighter.name,
                  className:'hud-portrait-svg',
                }
              )+
            '</div>'+
            '<div class="brute-hud-v3-name">'+
              '<b>'+esc(fighter.name)+'</b>'+
              '<small>NIV. '+num(fighter.level,1)+' · '+esc(fighterBuildTag(fighter))+'</small>'+
            '</div>'+
            '<div class="brute-combo-meter" data-combo-'+side+'>'+
              '<b>x1</b><small>CHAÎNE</small><i style="--chain:1"></i>'+
            '</div>'+
          '</div>'+
          '<div class="brute-hud-v2-hp brute-hud-v3-hp"><i data-hp-'+side+' style="width:100%"></i><span data-hp-text-'+side+'>'+num(fighter.hpMax)+' / '+num(fighter.hpMax)+'</span></div>'+
          '<div class="brute-hud-v3-live">'+
            '<span>DÉGÂTS <b data-fight-damage-'+side+'>0</b></span>'+
            '<span>CRIT <b data-fight-crits-'+side+'>0</b></span>'+
            '<span>FOR <b>'+num(fighter.strength)+'</b></span>'+
            '<span>AGI <b>'+num(fighter.agility)+'</b></span>'+
            '<span>VIT <b>'+num(fighter.speed)+'</b></span>'+
          '</div>'+
          '<div class="brute-hud-v3-weapon" data-weapon-'+side+'>'+
            weaponHudMarkup(
              weapon,
              fighter
            )+
          '</div>'+
          '<div class="brute-fatigue v2 brute-fatigue-v3"><i data-fatigue-'+side+'></i></div>'+
        '</div>'
      )

    return (
      '<section class="brute-fight-shell">'+
        '<div class="brute-arena brute-arena-v2 brute-arena-v3" data-brute-arena>'+
          '<div class="brute-stagefx" data-brute-stagefx></div>'+
          '<div class="brute-arena-v4-sun"></div>'+
          '<div class="brute-arena-v2-cloud c1"></div>'+
          '<div class="brute-arena-v2-cloud c2"></div>'+
          '<div class="brute-arena-v4-banner left"><i></i></div>'+
          '<div class="brute-arena-v4-banner right"><i></i></div>'+
          '<div class="brute-arena-v4-gong"></div>'+
          '<div class="brute-arena-v2-wall">'+
            '<i></i><i></i><i></i><i></i><i></i>'+
          '</div>'+
          '<div class="brute-arena-v2-crowd"></div>'+
          '<div class="brute-arena-v2-floor"></div>'+
          '<div class="brute-arena-v4-vignette"></div>'+
          '<div class="brute-arena-v4-foreground"></div>'+
          '<div class="brute-versus-callout" aria-hidden="true"><b>FIGHT!</b><i></i></div>'+
          '<div class="brute-hud brute-hud-v2 brute-hud-v3">'+
            hud(left,'left',leftWeapon)+
            '<div class="brute-round-stack">'+
              '<div class="brute-round brute-round-v2" data-brute-round>GO</div>'+
              (
                potentialXp > 0
                  ? '<div class="brute-fight-xp-preview"><span>XP</span><b>+'+potentialXp+'</b></div>'
                  : ''
              )+
            '</div>'+
            hud(right,'right',rightWeapon)+
          '</div>'+
          '<div class="brute-fighters brute-fighters-v2">'+
            '<div class="brute-fighter left '+fighterAuraClass(left)+'" data-fighter="left" data-weapon-current="'+esc(leftWeapon.id)+'">'+
              '<span class="brute-fighter-shadow"></span>'+
              fighterGraphic(left,'left',leftWeapon.id)+
            '</div>'+
            '<div class="brute-fighter right '+fighterAuraClass(right)+'" data-fighter="right" data-weapon-current="'+esc(rightWeapon.id)+'">'+
              '<span class="brute-fighter-shadow"></span>'+
              fighterGraphic(right,'right',rightWeapon.id)+
            '</div>'+
          '</div>'+
          '<div class="brute-combo-stage left" data-combo-stage-left></div>'+
          '<div class="brute-combo-stage right" data-combo-stage-right></div>'+
          '<div class="brute-log brute-log-v2 brute-log-v3" data-brute-log>PRÊTS ?</div>'+
        '</div>'+
        '<div class="brute-fight-toolbar">'+
          '<button class="brute-fight-tool '+(playbackPaused?'active':'')+'" data-brute-pause>'+(playbackPaused?'▶':'Ⅱ')+'<small>'+(playbackPaused?'JOUER':'PAUSE')+'</small></button>'+
          '<button class="brute-fight-tool '+(playbackSpeed===1?'active':'')+'" data-brute-speed="1">×1<small>NORMAL</small></button>'+
          '<button class="brute-fight-tool '+(playbackSpeed===2?'active':'')+'" data-brute-speed="2">×2<small>RAPIDE</small></button>'+
          '<button class="brute-fight-tool '+(playbackSpeed===3?'active':'')+'" data-brute-speed="3">×3<small>TURBO</small></button>'+
          '<button class="brute-fight-tool" data-brute-music-toggle>'+(musicEnabled?'SON':'MUET')+'<small>AUDIO</small></button>'+
          '<button class="brute-fight-tool danger" data-brute-skip>»<small>PASSER</small></button>'+
        '</div>'+
        '<div data-brute-fight-result></div>'+
      '</section>'
    )
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
              'Bonus XP +' +
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
      START: 120,
      ARRIVE: 520,
      WINDUP:
        event?.category === 'heavy'
          ? 320
          : event?.category === 'ranged'
            ? 260
            : event?.category === 'flexible'
              ? 245
              : 190,
      MOVE: 150,
      MOVE_BACK: 165,
      REPOSITION: 190,
      WEAPON_SWITCH: 360,
      WEAPON_THROW: 230,
      BLOCK: 340,
      COUNTER: 210,
      REST: 360,
      SKILL_ACTIVATE: 430,
      ATTACK: event?.critical ? 480 : 350,
      DODGE: 390,
      MISS: 280,
      COUNTER_READY: 240,
      COMBO: 170,
      DISARM: 400,
      GRIND: 460,
      PET_ATTACK: 350,
      PET_DODGE: 270,
      STUN_SKIP: 390,
      FINISHER: 540,
      KO: 700,
      END: 70,
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
        'staggering',
        'hitstop',
        'dashing',
        'recovery-step',
        'committed',
        'hit-react'
      )
    })
    root.querySelectorAll('.brute-float').forEach(el => el.remove())
    root.querySelectorAll('.brute-impact,.brute-dust,.brute-skill-banner,.brute-projectile,.brute-speedline,.brute-slash-fx,.brute-shockwave,.brute-crit-burst,.brute-miss-swoosh,.brute-parry-spark,.brute-finisher-flare,.brute-afterimage,.brute-stat-spark,.brute-combo-burst,.brute-floor-streak,.brute-debris,.brute-contact-ring').forEach(el => el.remove())

    const arena =
      root.querySelector('[data-brute-arena]')

    arena?.classList.remove(
      'shake',
      'flash',
      'finisher',
      'impact-heavy',
      'impact-flexible',
      'impact-ranged',
      'stat-strength',
      'camera-intro',
      'camera-left',
      'camera-right',
      'camera-attack-left',
      'camera-attack-right',
      'camera-impact',
      'camera-critical',
      'camera-ko'
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
    updateFightTelemetry(
      event,
      tl
    )

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

    const actorFighter =
      event.actor === 'left'
        ? tl.left
        : tl.right

    const actorSpeed =
      num(
        actorFighter?.speed
      )

    const actorAgility =
      num(
        actorFighter?.agility
      )

    const actorStrength =
      num(
        actorFighter?.strength
      )

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
      arena?.classList.add('camera-intro')
    }

    if (event.type === 'ARRIVE') {
      leftEl?.classList.add('arriving')
      rightEl?.classList.add('arriving')
      arena?.classList.add('camera-intro')
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
      if (
        actorSpeed >= 15 &&
        actorEl
      ) {
        const ghost =
          actorEl
            .querySelector(
              '.ga-brute-svg'
            )
            ?.cloneNode(
              true
            )

        if (ghost) {
          ghost.classList.add(
            'brute-afterimage',
            'windup'
          )
          actorEl.appendChild(
            ghost
          )
        }
      }

      const cls =
        event.category === 'heavy'
          ? 'windup-heavy'
          : event.category === 'ranged'
            ? 'windup-ranged'
            : event.category === 'flexible'
              ? 'windup-flexible'
              : 'windup-fast'

      arena?.classList.add(
        event.actor === 'left'
          ? 'camera-left'
          : 'camera-right'
      )

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
      actorEl?.classList.add('dashing')
      arena?.classList.add(
        event.actor === 'left'
          ? 'camera-left'
          : 'camera-right'
      )

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

      const streak =
        document.createElement('span')

      streak.className =
        'brute-floor-streak ' +
        (
          event.actor === 'right'
            ? 'right'
            : 'left'
        )

      fx?.appendChild(streak)

      const dust2 =
        document.createElement('span')

      dust2.className = 'brute-dust secondary'
      dust2.style.left =
        event.actor === 'left'
          ? '18%'
          : '76%'

      fx?.appendChild(dust2)
    }

    if (event.type === 'MOVE_BACK') {
      actorEl?.classList.add('recovery-step')

      setFightOffset(
        actorEl,
        0
      )
    }

    if (event.type === 'WEAPON_SWITCH') {
      actorEl?.classList.add('switching')

      const banner =
        document.createElement(
          'span'
        )

      banner.className =
        'brute-skill-banner weapon'

      const meta =
        BRUTE_WEAPONS[
          event.weapon
        ] ||
        BRUTE_WEAPONS.fists

      banner.innerHTML =
        '<span class="brute-banner-art">'+
          renderWeaponIconSvg(
            meta,
            {
              className:'banner',
            }
          )+
        '</span>'+
        '<span><b>'+esc(meta.name)+'</b><small>'+weaponRole(meta)+'</small></span>'

      fx?.appendChild(
        banner
      )
    }

    if (event.type === 'WEAPON_THROW') {
      actorEl?.classList.add('attack-ranged')

      const projectile =
        document.createElement(
          'span'
        )

      projectile.className =
        'brute-projectile weapon-art ' +
        (
          event.actor === 'right'
            ? 'right'
            : ''
        )

      projectile.innerHTML =
        renderWeaponIconSvg(
          BRUTE_WEAPONS[
            event.weapon
          ] ||
          BRUTE_WEAPONS.fists,
          {
            bare:true,
            className:'projectile',
          }
        )

      fx?.appendChild(
        projectile
      )
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
          attackVariant,
        'committed'
      )

      arena?.classList.add(
        event.actor === 'left'
          ? 'camera-attack-left'
          : 'camera-attack-right'
      )

      actorEl?.style.setProperty(
        '--motion-boost',
        Math.max(
          .82,
          Math.min(
            1.35,
            1.18 -
            actorSpeed * .012
          )
        )
      )

      if (
        actorSpeed >= 17 &&
        actorEl
      ) {
        for (
          let ghostIndex = 0;
          ghostIndex < (
            actorSpeed >= 23
              ? 3
              : 2
          );
          ghostIndex += 1
        ) {
          const ghost =
            actorEl
              .querySelector(
                '.ga-brute-svg'
              )
              ?.cloneNode(
                true
              )

          if (ghost) {
            ghost.classList.add(
              'brute-afterimage',
              event.actor === 'right'
                ? 'right'
                : 'left'
            )

            ghost.style.setProperty(
              '--ghost-index',
              String(
                ghostIndex
              )
            )

            actorEl.appendChild(
              ghost
            )
          }
        }
      }

      if (
        actorStrength >= 17
      ) {
        arena?.classList.add(
          'stat-strength'
        )

        for (
          let i = 0;
          i < Math.min(
            5,
            Math.floor(
              actorStrength / 5
            )
          );
          i += 1
        ) {
          const spark =
            document.createElement(
              'span'
            )

          spark.className =
            'brute-stat-spark'

          spark.style.left =
            (
              event.target === 'left'
                ? 27
                : 67
            ) +
            i * 2 +
            '%'

          spark.style.top =
            (
              49 +
              i * 3
            ) +
            '%'

          fx?.appendChild(
            spark
          )
        }
      }

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

        projectile.innerHTML =
          renderWeaponIconSvg(
            BRUTE_WEAPONS[
              weaponId
            ] ||
            BRUTE_WEAPONS.fists,
            {
              bare:true,
              className:'projectile',
            }
          )

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

      const streak =
        Math.max(
          2,
          fightTelemetry
            ?.streak?.[
              event.actor
            ] ||
          2
        )

      const banner =
        document.createElement(
          'span'
        )

      banner.className =
        'brute-skill-banner combo'

      const comboRank =
        comboTier(
          streak
        )

      banner.innerHTML =
        '<b>COMBO x'+streak+'</b><small>'+comboRank.label+'</small>'

      fx?.appendChild(
        banner
      )

      const stage =
        root.querySelector(
          '[data-combo-stage-'+
          event.actor+
          ']'
        )

      if (stage) {
        stage.innerHTML =
          '<span class="brute-combo-burst tier-'+comboRank.level+'"><b>x'+streak+'</b><small>'+comboRank.label+'</small></span>'
      }
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

      banner.classList.add(
        'skill-art'
      )

      banner.innerHTML =
        '<span class="brute-banner-art">'+
          renderSkillIconSvg(
            event.skill,
            {
              className:'banner',
            }
          )+
        '</span>'+
        '<span><b>'+esc(skill?.name || event.skill)+'</b><small>SKILL ACTIVÉ</small></span>'

      fx?.appendChild(banner)
    }

    if (event.type === 'DODGE') {
      if (
        actorAgility >= 15 &&
        actorEl
      ) {
        const ghost =
          actorEl
            .querySelector(
              '.ga-brute-svg'
            )
            ?.cloneNode(
              true
            )

        if (ghost) {
          ghost.classList.add(
            'brute-afterimage',
            'dodge-ghost'
          )
          actorEl.appendChild(
            ghost
          )
        }
      }

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
        'DÉSARMÉ'

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
        'GRIND · 1 PV'

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
          : 'hit',
        'hit-react'
      )

      const impactVariant =
        Math.abs(
          Math.floor(
            num(
              event.impactVariant,
              num(event.damage,0) % 5
            )
          )
        ) % 5

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
        {
          y:'5px',
          tilt:'6deg',
        },
        {
          y:'-9px',
          tilt:'-7deg',
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
          'shake',
          'camera-impact'
        )

        const freezeDelay =
          Math.max(
            55,
            118 /
            Math.max(
              .5,
              playbackSpeed
            )
          )

        const freezeTime =
          Math.max(
            34,
            (
              event.critical ||
              event.type === 'FINISHER'
                ? 82
                : 58
            ) /
            Math.max(
              .5,
              playbackSpeed
            )
          )

        setTimeout(
          () => {
            actorEl?.classList.add('hitstop')
            targetEl?.classList.add('hitstop')

            setTimeout(
              () => {
                actorEl?.classList.remove('hitstop')
                targetEl?.classList.remove('hitstop')
              },
              freezeTime
            )
          },
          freezeDelay
        )
      }

      if (
        event.critical ||
        event.type === 'FINISHER'
      ) {
        arena?.classList.add(
          'flash',
          'camera-critical'
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

      const ring =
        document.createElement(
          'span'
        )

      ring.className =
        'brute-contact-ring' +
        (
          heavy
            ? ' heavy'
            : ''
        )

      ring.style.left =
        event.target === 'left'
          ? '30%'
          : '70%'

      ring.style.top =
        '53%'

      fx?.appendChild(
        ring
      )

      const debrisCount =
        heavy
          ? 9
          : 5

      for (
        let debrisIndex = 0;
        debrisIndex < debrisCount;
        debrisIndex += 1
      ) {
        const debris =
          document.createElement(
            'span'
          )

        debris.className =
          'brute-debris'

        const direction =
          event.target === 'left'
            ? -1
            : 1

        const spread =
          (
            debrisIndex -
            (
              debrisCount - 1
            ) / 2
          )

        debris.style.left =
          event.target === 'left'
            ? '30%'
            : '70%'

        debris.style.top =
          (
            50 +
            (
              debrisIndex % 3
            ) * 2
          ) +
          '%'

        debris.style.setProperty(
          '--debris-x',
          (
            direction *
            (
              24 +
              Math.abs(spread) * 9
            )
          ) +
          'px'
        )

        debris.style.setProperty(
          '--debris-y',
          (
            -18 -
            (
              debrisIndex % 4
            ) *
            9
          ) +
          'px'
        )

        debris.style.setProperty(
          '--debris-r',
          (
            spread * 24
          ) +
          'deg'
        )

        fx?.appendChild(
          debris
        )
      }

      const hpBar =
        root.querySelector(
          '[data-hp-'+
          event.target+
          ']'
        )

      if (hpBar) {
        hpBar.classList.remove(
          'damage-tick'
        )

        void hpBar.offsetWidth

        hpBar.classList.add(
          'damage-tick'
        )
      }

      fightSfx(
        event.critical
          ? 'critical'
          : 'hit'
      )
    }

    if (event.type === 'KO') {
      arena?.classList.add('camera-ko')

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
        const w =
          BRUTE_WEAPONS[
            event.state.leftWeapon
          ] ||
          BRUTE_WEAPONS.fists

        lWeapon.innerHTML =
          weaponHudMarkup(
            w,
            tl.left
          )
      }

      if (rWeapon) {
        const w =
          BRUTE_WEAPONS[
            event.state.rightWeapon
          ] ||
          BRUTE_WEAPONS.fists

        rWeapon.innerHTML =
          weaponHudMarkup(
            w,
            tl.right
          )
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
      log.classList.remove(
        'pulse'
      )

      void log.offsetWidth

      log.textContent =
        eventText(event,tl)

      log.classList.add(
        'pulse'
      )
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
    const left =
      tl.summary?.left ||
      {}

    const right =
      tl.summary?.right ||
      {}

    const gradeFor =
      data => {
        const score =
          num(data.damage) +
          num(data.crits) * 22 +
          num(data.dodges) * 10 +
          num(data.blocks) * 9 +
          num(data.counters) * 13 +
          num(data.combos) * 18 +
          num(data.disarms) * 15

        if (score >= 280) return 'S'
        if (score >= 200) return 'A'
        if (score >= 135) return 'B'
        if (score >= 85) return 'C'
        return 'D'
      }

    const side = (
      title,
      data,
      sideKey
    ) => {
      const grade =
        gradeFor(
          data
        )

      const maxCombo =
        Math.max(
          1,
          fightTelemetry
            ?.maxCombo?.[
              sideKey
            ] ||
          num(data.combos) + 1
        )

      return (
        '<div class="brute-fight-summary-side v3">'+
          '<div class="brute-fight-grade grade-'+grade.toLowerCase()+'">'+grade+'</div>'+
          '<div class="brute-fight-summary-copy">'+
            '<h4>'+esc(title)+'</h4>'+
            '<div class="brute-fight-summary-stats">'+
              '<span>Dégâts<b>'+num(data.damage)+'</b></span>'+
              '<span>Critiques<b>'+num(data.crits)+'</b></span>'+
              '<span>Esquives<b>'+num(data.dodges)+'</b></span>'+
              '<span>Blocks<b>'+num(data.blocks)+'</b></span>'+
              '<span>Contres<b>'+num(data.counters)+'</b></span>'+
              '<span>Meilleur combo<b>x'+maxCombo+'</b></span>'+
            '</div>'+
          '</div>'+
        '</div>'
      )
    }

    return (
      '<div class="brute-fight-summary v3">'+
        side(
          tl.left.name,
          left,
          'left'
        )+
        side(
          tl.right.name,
          right,
          'right'
        )+
      '</div>'
    )
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
        '<div class="brute-result-title '+(won?'win':'loss')+'">'+
          '<span class="brute-result-glyph">'+uiGlyph(won?'ranking':'weapon')+'</span>'+
          '<h2>'+(won?'VICTOIRE':'DÉFAITE')+'</h2>'+
        '</div>'+
        '<p style="color:#969bb1;font-size:10px">'+
          (
            won
              ? esc(t.victory)
              : 'Tu reviendras plus fort.'
          )+
        '</p>'+
        (
          practice
            ? '<div class="brute-xp-gain v3">ENTRAÎNEMENT · 0 XP</div>'
            : replayOnly
              ? '<div class="brute-xp-gain v3">REPLAY · XP DÉJÀ ATTRIBUÉE</div>'
              : '<div class="brute-xp-gain v3"><span>EXPÉRIENCE</span><b>+'+gained+' XP</b><small>'+(pve?'OPENPOWER PVE':'DUEL')+'</small></div>'
        )+
        (
          pve &&
          currentFightMeta
            ?.openpowerlifting
            ? '<div style="margin-top:8px;color:#7e859f;font-size:8px;font-weight:900">OPENPOWERLIFTING · TOTAL '+num(currentFightMeta.openpowerlifting.total,0)+' KG · '+num(currentFightMeta.openpowerlifting.points,0)+' '+esc(currentFightMeta.openpowerlifting.metric || '')+' · ÉNERGIE -'+num(currentFightMeta?.energy?.cost,8)+'</div>'
            : ''
        )+
        (
          xp && !practice && !replayOnly
            ? '<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:9px auto 0;max-width:620px">'+
                '<span class="brute-activity-pill">BASE +'+num(xp.base_xp,0)+'</span>'+
                '<span class="brute-activity-pill">STEPS +'+num(xp.steps_bonus,0)+'</span>'+
                '<span class="brute-activity-pill">SOMMEIL +'+num(xp.sleep_bonus,0)+'</span>'+
                '<span class="brute-activity-pill">TRAINING +'+num(xp.training_bonus,0)+'</span>'+
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
          (
            !replayOnly &&
            !practice
              ? '<button class="brute-primary" data-brute-rematch><span class="brute-inline-glyph">'+uiGlyph('arena')+'</span> Recombattre</button>'
              : ''
          )+
          '<button class="brute-secondary" data-brute-replay-current><span class="brute-inline-glyph">'+uiGlyph('replay')+'</span> Revoir le combat</button>'+
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
    playbackPaused = false
    resetFightTelemetry(
      tl
    )
    await wait(80)

    for (const event of tl.events) {
      if (token !== playbackToken) return

      while (
        playbackPaused &&
        token === playbackToken
      ) {
        await wait(80)
      }

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

    if (event.target.closest('[data-brute-pause]')) {
      playbackPaused =
        !playbackPaused

      const button =
        root.querySelector(
          '[data-brute-pause]'
        )

      if (button) {
        button.classList.toggle(
          'active',
          playbackPaused
        )

        button.innerHTML =
          (
            playbackPaused
              ? '▶'
              : 'Ⅱ'
          ) +
          '<small>' +
          (
            playbackPaused
              ? 'JOUER'
              : 'PAUSE'
          ) +
          '</small>'
      }

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
      playbackPaused = false
      playbackToken += 1
      const finalEvent = currentTimeline?.events?.[currentTimeline.events.length-2]
      if (finalEvent) applyEvent(finalEvent,currentTimeline)
      finishFightPlayback(currentTimeline)
      return
    }

    if (event.target.closest('[data-brute-rematch]')) {
      if (busy) return

      const pve =
        Boolean(
          currentFightMeta?.pve
        )

      const defenderSlug =
        currentFightMeta
          ?.fight
          ?.defender_slug ||
        currentTimeline
          ?.right
          ?.slug ||
        ''

      if (pve) {
        await startPve()
      } else {
        await startServerDuel(
          defenderSlug || null
        )
      }
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

    if (event.target.closest('[data-brute-music-toggle]')) {
      musicEnabled =
        !musicEnabled

      try {
        localStorage.setItem(
          'ga-brute-music-v1',
          musicEnabled
            ? 'on'
            : 'off'
        )
      } catch {
        // Preference is optional.
      }

      if (musicEnabled) {
        syncMusic()
      } else {
        stopMusic()
      }

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
