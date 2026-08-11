import { supabase } from './supabase.js'
import { rpgMonsterSprite } from './rpg-sprites.js'
import {
  playRpgBattleMusic,
  playRpgMenuMusic,
  playRpgEventMusic,
  rpgSfxAllowed,
  rpgSfxVolume,
} from './rpg-audio.js'

const TICK_MS = 50
const RESULT_TIMEOUT_MS = 15000

const CLASS_DEFS = {
  warrior: { icon: '???', label: 'Guerrier' },
  archer: { icon: '??', label: 'Archer' },
  mage: { icon: '??', label: 'Mage' },
}

const RARITY_DEFS = {
  normal: { icon: '?', label: 'Simple' },
  common: { icon: '??', label: 'Commun' },
  uncommon: { icon: '??', label: 'Peu commun' },
  rare: { icon: '??', label: 'Rare' },
  epic: { icon: '??', label: '?pique' },
  legendary: { icon: '??', label: 'L?gendaire' },
  mythic: { icon: '??', label: 'Mythique' },
  ultra_mythic: { icon: '??', label: 'Ultra Rare Mythique' },
  abyssal: { icon: '???', label: 'Abyssal' },
}

const FIRST_SPELLS = Object.freeze({
  warrior: {
    icon: '??',
    name: 'UNBOUND ? Brise-Limites',
    quote: 'Rien ne peut me retenir.',
    audio: 'sort1-guerrier.mp3',
    cutin: 'skill-cutin-warrior.webp',
  },

  archer: {
    icon: '??',
    name: 'PIERCING FATE ? Fl?che du Destin',
    quote: 'Ma fl?che dans ton pied.',
    audio: 'sort1-archer.mp3',
    cutin: 'skill-cutin-archer.webp',
  },

  mage: {
    icon: '?',
    name: 'SPARKLING CAT ? ?veil Astral',
    quote: 'Sparkling Cat.',
    audio: 'sort1-magicienne.mp3',
    cutin: 'skill-cutin-mage.webp',
  },
})

const FIRST_SPELL_DURATION_MS =
  5000

const FIRST_SPELL_DAMAGE_MULTIPLIER =
  1.35

const firstSpellAudioCache =
  new Map()

let activeState = null
let audioContext = null

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number)
    ? number
    : fallback
}

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  )
}

function esc(value) {
  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]
  )
}

function canonicalRarity(
  value
) {
  const raw =
    String(
      value || 'common'
    )
      .trim()
      .toLowerCase()
      .replace(
        /[ -]+/g,
        '_'
      )

  if (
    raw === 'simple'
  ) {
    return 'normal'
  }

  if (
    raw === 'peu_commun'
  ) {
    return 'uncommon'
  }

  if (
    raw === 'legendaire'
  ) {
    return 'legendary'
  }

  if (
    raw === 'mythique'
  ) {
    return 'mythic'
  }

  if (
    [
      'urm',
      'ultra',
      'ultra_rare_mythique',
      'ultra_mythique',
    ].includes(raw)
  ) {
    return 'ultra_mythic'
  }

  return RARITY_DEFS[raw]
    ? raw
    : 'common'
}

function progressMaxDifficulty(
  progress
) {
  return Math.max(
    1,
    Math.floor(
      n(
        progress?.adventure_difficulty,
        1
      )
    )
  )
}

function difficultyStorageKey(
  athleteSlug
) {
  return `rpg_difficulty_${athleteSlug}`
}

function selectedDifficulty(
  state,
  athleteSlug,
  progress
) {
  const max =
    progressMaxDifficulty(
      progress
    )

  const memory =
    n(
      state?.selectedDifficulty,
      n(
        localStorage.getItem(
          difficultyStorageKey(
            athleteSlug
          )
        ),
        max
      )
    )

  return clamp(
    Math.floor(
      memory || max
    ),
    1,
    max
  )
}

function formatNumber(
  value,
  digits = 0
) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits:
        digits,
    }
  ).format(
    n(value)
  )
}

function formatClock(ms) {
  const safe =
    Math.max(
      0,
      Math.ceil(
        ms / 100
      ) / 10
    )

  return safe
    .toFixed(1)
    .replace(
      '.',
      ','
    )
}

function randomBetween(
  min,
  max
) {
  return min +
    Math.random() *
    (max - min)
}

function deterministicLuckRoll(
  seed,
  clickNo
) {
  const modulus =
    2147483647

  return (
    (
      Math.max(
        1,
        Math.floor(
          n(seed, 1)
        )
      ) +
      Math.max(
        1,
        clickNo
      ) *
      48271
    ) %
    modulus
  ) /
  modulus
}

function damageForUnit(
  session,
  unitNo
) {
  let damage =
    Math.max(
      1,
      n(
        session.baseDamage,
        1
      )
    )

  const crit =
    deterministicLuckRoll(
      session.critSeed,
      unitNo
    ) <
    Math.max(
      0,
      n(
        session.critChance
      )
    ) /
    100

  if (crit) {
    damage *= 2
  }

  return {
    damage,
    crit,
  }
}

function firstSpellDef(
  session
) {
  return (
    FIRST_SPELLS[
      session?.classKey
    ] ||
    FIRST_SPELLS.warrior
  )
}

function rushAbilityActive(
  session
) {
  return !!(
    session?.rushStartedAt &&
    performance.now() <
      session.rushStartedAt +
      session.rushDurationMs
  )
}

function spellAssetUrl(
  file
) {
  try {
    return new URL(
      file,
      document.baseURI
    ).href
  } catch (_) {
    return file
  }
}

function ensureFirstSpellAudio(
  classKey
) {
  const key =
    FIRST_SPELLS[classKey]
      ? classKey
      : 'warrior'

  if (
    firstSpellAudioCache
      .has(key)
  ) {
    return firstSpellAudioCache
      .get(key)
  }

  const audio =
    document.createElement(
      'audio'
    )

  audio.preload =
    'none'

  audio.playsInline =
    true

  audio.setAttribute(
    'playsinline',
    ''
  )

  audio.setAttribute(
    'webkit-playsinline',
    ''
  )

  audio.src =
    spellAssetUrl(
      FIRST_SPELLS[key]
        .audio
    )

  audio.style.display =
    'none'

  document.body
    .appendChild(audio)

  firstSpellAudioCache
    .set(
      key,
      audio
    )

  return audio
}

function playFirstSpellSound(
  session
) {
  if (
    !rpgSfxAllowed()
  ) {
    return
  }

  try {
    const audio =
      ensureFirstSpellAudio(
        session?.classKey
      )

    audio.pause()
    audio.currentTime = 0

    audio.volume =
      Math.max(
        0,
        Math.min(
          1,
          rpgSfxVolume()
        )
      )

    const playback =
      audio.play()

    playback?.catch?.(
      error => {
        console.warn(
          'RPG SPELL AUDIO ERROR',
          error
        )
      }
    )
  } catch (error) {
    console.warn(
      'RPG SPELL AUDIO INIT ERROR',
      error
    )
  }
}

function installFirstSpellStyles() {
  if (
    document.getElementById(
      'rpgFirstSpellStylesV2'
    )
  ) {
    return
  }

  const style =
    document.createElement(
      'style'
    )

  style.id =
    'rpgFirstSpellStylesV2'

  style.textContent = `
.rpg-combat-bottom-v2{
  gap:7px;
}

.rpg-rush-button-v2{
  flex:1.5!important;
  position:relative;
  overflow:hidden;
  border-color:rgba(240,196,77,.24)!important;
  background:
    linear-gradient(
      135deg,
      rgba(116,25,48,.94),
      rgba(35,16,29,.96)
    )!important;
  color:#f6d67c!important;
}

.rpg-rush-button-v2 small{
  display:block;
  margin-top:3px;
  font-size:6px;
  line-height:1.25;
  color:#b4a786;
}

.rpg-rush-button-v2.active{
  background:
    linear-gradient(
      135deg,
      #b42848,
      #7c1a34
    )!important;
  color:#fff!important;
  box-shadow:
    0 0 22px
    rgba(229,56,93,.38);
  animation:
    rpgSpellPulseV2
    .65s infinite alternate;
}

.rpg-rush-button-v2.used{
  opacity:.40;
}

@keyframes rpgSpellPulseV2{
  from{
    transform:scale(1);
  }

  to{
    transform:scale(1.025);
  }
}

.rpg-spell-cutin-v2{
  position:fixed;
  inset:0;
  z-index:15000;
  display:flex;
  align-items:center;
  justify-content:center;
  pointer-events:none;
  overflow:hidden;
  background:
    rgba(2,3,7,.72);
  animation:
    rpgCutinFadeV2
    1.18s both;
}

.rpg-spell-cutin-panel-v2{
  position:relative;
  width:min(100%,700px);
  height:min(58vw,300px);
  min-height:190px;
  overflow:hidden;
  border-top:
    2px solid #f0c44d;
  border-bottom:
    2px solid #f0c44d;
  background:#070a11;
  box-shadow:
    0 0 70px
    rgba(139,24,50,.45);
  animation:
    rpgCutinSlideV2
    .35s both;
}

.rpg-spell-cutin-panel-v2 img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
}

.rpg-spell-cutin-shade-v2{
  position:absolute;
  inset:0;
  background:
    linear-gradient(
      90deg,
      rgba(3,5,9,.08),
      rgba(3,5,9,.18) 38%,
      rgba(3,5,9,.92) 76%
    );
}

.rpg-spell-cutin-copy-v2{
  position:absolute;
  right:5%;
  top:50%;
  transform:
    translateY(-50%);
  width:52%;
  text-align:right;
  text-shadow:
    0 3px 10px #000;
}

.rpg-spell-cutin-copy-v2 strong{
  display:block;
  color:#f4ce63;
  font-size:
    clamp(18px,4vw,34px);
  font-weight:1000;
}

.rpg-spell-cutin-copy-v2 span{
  display:block;
  margin-top:7px;
  color:#fff;
  font-size:
    clamp(10px,2vw,15px);
  font-style:italic;
}

.rpg-spell-cutin-copy-v2 b{
  display:inline-block;
  margin-top:10px;
  padding:5px 9px;
  border-radius:999px;
  background:
    rgba(178,32,66,.74);
  color:#fff;
  font-size:9px;
}

@keyframes rpgCutinSlideV2{
  from{
    transform:
      translateX(-100%);
  }

  to{
    transform:
      translateX(0);
  }
}

@keyframes rpgCutinFadeV2{
  0%{
    opacity:0;
  }

  12%{
    opacity:1;
  }

  78%{
    opacity:1;
  }

  100%{
    opacity:0;
  }
}
`

  document.head
    .appendChild(style)
}

function showFirstSpellCutin(
  session
) {
  installFirstSpellStyles()

  document
    .getElementById(
      'rpgSpellCutinV2'
    )
    ?.remove()

  const def =
    firstSpellDef(
      session
    )

  const cutin =
    document.createElement(
      'div'
    )

  cutin.id =
    'rpgSpellCutinV2'

  cutin.className =
    'rpg-spell-cutin-v2'

  cutin.innerHTML = `
    <div
      class="rpg-spell-cutin-panel-v2"
    >
      <img
        src="${esc(
          spellAssetUrl(
            def.cutin
          )
        )}"
        alt=""
      >

      <div
        class="rpg-spell-cutin-shade-v2"
      ></div>

      <div
        class="rpg-spell-cutin-copy-v2"
      >
        <strong>
          ${esc(def.name)}
        </strong>

        <span>
          ?${esc(def.quote)}?
        </span>

        <b>
          D?G?TS +35 % ? 5 S
        </b>
      </div>
    </div>
  `

  document.body
    .appendChild(
      cutin
    )

  setTimeout(
    () => {
      cutin.remove()
    },
    1200
  )
}

function activateRushAbility(
  state
) {
  const session =
    state?.active

  if (
    !session ||
    session.finishing ||
    session.rushAbilityUsed
  ) {
    return false
  }

  session.rushAbilityUsed =
    true

  session.rushStartedAt =
    performance.now()

  session.rushElapsedMs =
    Math.max(
      0,
      Math.round(
        performance.now() -
        session.startedAt
      )
    )

  session.rushDurationMs =
    FIRST_SPELL_DURATION_MS

  const def =
    firstSpellDef(
      session
    )

  session.feedback =
    `${def.icon} ${def.name.toUpperCase()} ? +35 % D?G?TS !`

  session.feedbackType =
    'perfect'

  playFirstSpellSound(
    session
  )

  showFirstSpellCutin(
    session
  )

  if (
    navigator.vibrate
  ) {
    navigator.vibrate(
      [45,35,80]
    )
  }

  renderFight(
    state
  )

  setTimeout(
    () => {
      if (
        state?.active !==
        session
      ) {
        return
      }

      session.rushStartedAt =
        0

      renderFight(
        state
      )
    },
    FIRST_SPELL_DURATION_MS +
      20
  )

  return true
}

function playCombatTone(
  kind = 'hit'
) {
  if (
    !rpgSfxAllowed()
  ) {
    return
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext

    if (
      !AudioContextClass
    ) {
      return
    }

    audioContext ||=
      new AudioContextClass()

    const oscillator =
      audioContext
        .createOscillator()

    const gain =
      audioContext
        .createGain()

    const now =
      audioContext.currentTime

    const volume =
      Math.max(
        0.001,
        rpgSfxVolume() *
          0.08
      )

    oscillator.type =
      kind === 'miss'
        ? 'sawtooth'
        : 'sine'

    oscillator.frequency
      .setValueAtTime(
        kind === 'perfect'
          ? 720
          : kind === 'miss'
            ? 145
            : kind === 'crit'
              ? 930
              : 420,
        now
      )

    gain.gain
      .setValueAtTime(
        volume,
        now
      )

    gain.gain
      .exponentialRampToValueAtTime(
        0.001,
        now + 0.12
      )

    oscillator.connect(
      gain
    )

    gain.connect(
      audioContext.destination
    )

    oscillator.start(now)
    oscillator.stop(
      now + 0.13
    )
  } catch (_) {
    // Le combat reste jouable
    // sans WebAudio.
  }
}

function installCombatStyles() {
  if (
    document.getElementById(
      'rpgCombatV2Styles'
    )
  ) {
    return
  }

  const style =
    document.createElement(
      'style'
    )

  style.id =
    'rpgCombatV2Styles'

  style.textContent = `
.rpg-combat-launch-v2{
  margin-top:12px;
  padding:13px;
  border:1px solid rgba(240,196,77,.18);
  border-radius:16px;
  background:linear-gradient(
    145deg,
    rgba(20,28,45,.96),
    rgba(8,11,18,.96)
  );
  box-shadow:0 14px 35px rgba(0,0,0,.22);
}

.rpg-combat-launch-head-v2{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}

.rpg-combat-launch-head-v2 strong{
  display:block;
  font-size:13px;
  color:#f7d779;
}

.rpg-combat-launch-head-v2 small{
  display:block;
  margin-top:3px;
  font-size:8px;
  line-height:1.45;
  color:#8f9ab0;
}

.rpg-combat-difficulty-v2{
  margin-top:11px;
  padding:10px;
  border-radius:12px;
  background:rgba(255,255,255,.035);
}

.rpg-combat-difficulty-v2 label{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  font-size:9px;
  color:#a8b1c4;
}

.rpg-combat-difficulty-v2 b{
  color:#fff;
}

.rpg-combat-difficulty-v2 input{
  width:100%;
  margin-top:8px;
}

.rpg-combat-launch-actions-v2{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:7px;
  margin-top:10px;
}

.rpg-combat-launch-actions-v2 button{
  border:1px solid rgba(255,255,255,.08);
  border-radius:11px;
  padding:10px 8px;
  background:#172035;
  color:#eef2f7;
  font-size:9px;
  font-weight:950;
  cursor:pointer;
}

.rpg-combat-launch-actions-v2 button:first-child{
  background:linear-gradient(
    135deg,
    #7b2234,
    #32111d
  );
  border-color:rgba(233,88,115,.28);
}

.rpg-combat-launch-actions-v2 button.boss{
  background:linear-gradient(
    135deg,
    #8d6421,
    #34220d
  );
  border-color:rgba(240,196,77,.30);
  color:#ffe5a0;
}

.rpg-combat-launch-actions-v2 button:disabled{
  opacity:.35;
  cursor:not-allowed;
}

.rpg-combat-overlay-v2{
  position:fixed;
  inset:0;
  z-index:12000;
  display:none;
  align-items:center;
  justify-content:center;
  padding:12px;
  background:rgba(3,5,10,.94);
  backdrop-filter:blur(10px);
}

.rpg-combat-overlay-v2.show{
  display:flex;
}

.rpg-combat-shell-v2{
  width:min(100%,620px);
  max-height:96vh;
  overflow:auto;
  border:1px solid rgba(240,196,77,.20);
  border-radius:22px;
  background:
    radial-gradient(
      circle at 50% -10%,
      rgba(116,20,45,.30),
      transparent 42%
    ),
    #090d16;
  color:#eef2f7;
  box-shadow:0 30px 80px rgba(0,0,0,.55);
}

.rpg-combat-top-v2{
  padding:13px 14px 8px;
}

.rpg-combat-title-v2{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}

.rpg-combat-title-v2 strong{
  font-size:15px;
}

.rpg-combat-title-v2 small{
  display:block;
  margin-top:3px;
  color:#8d99b0;
  font-size:8px;
}

.rpg-combat-rarity-v2{
  font-size:8px;
  font-weight:900;
  padding:5px 8px;
  border-radius:999px;
  background:rgba(255,255,255,.06);
}

.rpg-combat-hp-v2{
  margin-top:10px;
  height:12px;
  overflow:hidden;
  border-radius:999px;
  background:#20283a;
}

.rpg-combat-hp-v2 > span{
  display:block;
  height:100%;
  width:100%;
  background:linear-gradient(
    90deg,
    #a71f3b,
    #ed4966
  );
  transition:width .14s;
}

.rpg-combat-hp-label-v2{
  display:flex;
  justify-content:space-between;
  gap:8px;
  margin-top:5px;
  font-size:8px;
  color:#9ca7ba;
}

.rpg-combat-enemy-v2{
  position:relative;
  display:grid;
  place-items:center;
  min-height:180px;
  padding:10px 12px;
}

.rpg-combat-enemy-v2 img{
  width:min(52vw,220px);
  height:min(52vw,220px);
  object-fit:contain;
  filter:drop-shadow(
    0 14px 20px rgba(0,0,0,.45)
  );
  transition:transform .08s;
}

.rpg-combat-fallback-v2{
  font-size:78px;
}

.rpg-combat-stats-v2{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:6px;
  padding:0 12px 10px;
}

.rpg-combat-stat-v2{
  padding:8px 5px;
  border-radius:10px;
  background:rgba(255,255,255,.035);
  text-align:center;
}

.rpg-combat-stat-v2 b{
  display:block;
  font-size:11px;
}

.rpg-combat-stat-v2 span{
  display:block;
  margin-top:2px;
  font-size:7px;
  color:#818da4;
}

.rpg-reaction-stage-v2{
  position:relative;
  height:210px;
  margin:0 12px 10px;
  overflow:hidden;
  border-radius:17px;
  border:1px solid rgba(240,196,77,.14);
  background:
    radial-gradient(
      circle at 50% 45%,
      rgba(77,91,130,.15),
      transparent 50%
    ),
    rgba(0,0,0,.28);
  touch-action:manipulation;
  user-select:none;
}

.rpg-reaction-hint-v2{
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  width:90%;
  text-align:center;
  font-size:8px;
  color:#758198;
  pointer-events:none;
}

.rpg-reaction-target-v2{
  position:absolute;
  transform:translate(-50%,-50%);
  width:54px;
  height:54px;
  border-radius:50%;
  display:grid;
  place-items:center;
  border:2px solid rgba(255,255,255,.84);
  background:
    radial-gradient(
      circle,
      #e94361 0 34%,
      #851c32 36% 58%,
      rgba(80,12,27,.84) 60%
    );
  box-shadow:
    0 0 0 5px rgba(233,67,97,.10),
    0 8px 20px rgba(0,0,0,.32);
  color:#fff;
  font-size:15px;
  font-weight:1000;
  cursor:pointer;
}

.rpg-reaction-target-v2.golden{
  border-radius:13px;
  background:linear-gradient(
    135deg,
    #ffe578,
    #b77b14
  );
  color:#251703;
}

.rpg-reaction-target-v2.danger{
  background:#090a10;
  border-color:#f36b6b;
}

.rpg-reaction-target-v2.chain{
  background:#4d36a5;
  border-color:#b9a9ff;
}

.rpg-reaction-target-v2.double{
  background:#256b9c;
  border-color:#90ddff;
}

.rpg-reaction-target-v2 small{
  position:absolute;
  left:50%;
  top:calc(100% + 4px);
  transform:translateX(-50%);
  font-size:6px;
  white-space:nowrap;
}

.rpg-combat-feedback-v2{
  min-height:26px;
  padding:2px 12px 8px;
  text-align:center;
  font-size:11px;
  font-weight:1000;
  color:#f3cf69;
}

.rpg-combat-feedback-v2.miss{
  color:#ff777e;
}

.rpg-combat-feedback-v2.perfect{
  color:#77e7b1;
}

.rpg-combat-bottom-v2{
  display:flex;
  padding:0 12px 13px;
}

.rpg-combat-bottom-v2 button{
  flex:1;
  border:1px solid rgba(255,255,255,.08);
  border-radius:11px;
  padding:10px;
  background:#171e2d;
  color:#cbd3e2;
  font-size:9px;
  font-weight:900;
  cursor:pointer;
}

.rpg-combat-result-v2{
  display:none;
  padding:24px 18px;
  text-align:center;
}

.rpg-combat-result-v2.show{
  display:block;
}

.rpg-combat-result-v2 h2{
  margin:0;
  font-size:23px;
}

.rpg-combat-result-v2 p{
  font-size:10px;
  line-height:1.65;
  color:#aeb8ca;
}

.rpg-combat-result-rewards-v2{
  margin:13px 0;
  padding:12px;
  border-radius:13px;
  background:rgba(240,196,77,.07);
  border:1px solid rgba(240,196,77,.14);
  font-size:10px;
  line-height:1.7;
}

.rpg-combat-result-v2 button{
  border:0;
  border-radius:11px;
  padding:11px 16px;
  background:linear-gradient(
    135deg,
    #a8761e,
    #e0b746
  );
  color:#171006;
  font-size:9px;
  font-weight:1000;
  cursor:pointer;
}

@media(max-width:430px){
  .rpg-combat-stats-v2{
    grid-template-columns:repeat(2,1fr);
  }

  .rpg-combat-launch-actions-v2{
    grid-template-columns:1fr;
  }

  .rpg-reaction-stage-v2{
    height:230px;
  }
}
`

  document.head
    .appendChild(style)
}

function ensureOverlay() {
  installCombatStyles()
  installFirstSpellStyles()

  let overlay =
    document.getElementById(
      'rpgCombatOverlayV2'
    )

  if (overlay) {
    return overlay
  }

  overlay =
    document.createElement(
      'div'
    )

  overlay.id =
    'rpgCombatOverlayV2'

  overlay.className =
    'rpg-combat-overlay-v2'

  overlay.innerHTML = `
    <div
      class="rpg-combat-shell-v2"
      role="dialog"
      aria-modal="true"
    >
      <div data-rpg-combat-fight-v2>
        <div class="rpg-combat-top-v2">
          <div class="rpg-combat-title-v2">
            <div>
              <strong data-rpg-combat-name-v2>
                Combat
              </strong>

              <small data-rpg-combat-meta-v2></small>
            </div>

            <span
              class="rpg-combat-rarity-v2"
              data-rpg-combat-rarity-v2
            ></span>
          </div>

          <div class="rpg-combat-hp-v2">
            <span data-rpg-combat-hpbar-v2></span>
          </div>

          <div class="rpg-combat-hp-label-v2">
            <span data-rpg-combat-hplabel-v2></span>
            <strong data-rpg-combat-clock-v2></strong>
          </div>
        </div>

        <div
          class="rpg-combat-enemy-v2"
          data-rpg-combat-enemy-v2
        ></div>

        <div class="rpg-combat-stats-v2">
          <div class="rpg-combat-stat-v2">
            <b data-rpg-combat-success-v2>0</b>
            <span>Réussies</span>
          </div>

          <div class="rpg-combat-stat-v2">
            <b data-rpg-combat-perfect-v2>0</b>
            <span>Parfaites</span>
          </div>

          <div class="rpg-combat-stat-v2">
            <b data-rpg-combat-combo-v2>?0</b>
            <span>Combo</span>
          </div>

          <div class="rpg-combat-stat-v2">
            <b data-rpg-combat-damage-v2>0</b>
            <span>Dégâts</span>
          </div>
        </div>

        <div
          class="rpg-reaction-stage-v2"
          data-rpg-reaction-stage-v2
        >
          <div
            class="rpg-reaction-hint-v2"
            data-rpg-reaction-hint-v2
          >
            Les cibles vont appara?tre ici.
          </div>
        </div>

        <div
          class="rpg-combat-feedback-v2"
          data-rpg-combat-feedback-v2
        ></div>

        <div class="rpg-combat-bottom-v2">
          <button
            type="button"
            class="rpg-rush-button-v2"
            data-rpg-rush-v2
          >
            SORT 1
          </button>

          <button
            type="button"
            data-rpg-combat-abandon-v2
          >
            Abandonner
          </button>
        </div>
      </div>

      <div
        class="rpg-combat-result-v2"
        data-rpg-combat-result-v2
      >
        <h2 data-rpg-combat-result-title-v2></h2>

        <p data-rpg-combat-result-text-v2></p>

        <div
          class="rpg-combat-result-rewards-v2"
          data-rpg-combat-result-rewards-v2
        ></div>

        <button
          type="button"
          data-rpg-combat-result-close-v2
        >
          R?cup?rer et revenir
        </button>
      </div>
    </div>
  `

  document.body
    .appendChild(
      overlay
    )

  overlay.addEventListener(
    'pointerdown',
    event => {
      const state =
        activeState

      const session =
        state?.active

      if (
        !session ||
        session.finishing
      ) {
        return
      }

      const target =
        event.target.closest(
          '[data-rpg-reaction-target-v2]'
        )

      if (target) {
        event.preventDefault()

        handleTargetPress(
          state,
          target,
          event
        )

        return
      }

      const stage =
        event.target.closest(
          '[data-rpg-reaction-stage-v2]'
        )

      if (
        stage &&
        session.target
      ) {
        event.preventDefault()

        resolveMiss(
          state,
          event,
          stage
        )
      }
    }
  )

  overlay.addEventListener(
    'click',
    async event => {
      const state =
        activeState

      if (!state) {
        return
      }

      /* RPG RUSH CLICK V2 */

      if (
        event.target.closest(
          '[data-rpg-rush-v2]'
        )
      ) {
        activateRushAbility(
          state
        )

        return
      }

      if (
        event.target.closest(
          '[data-rpg-combat-abandon-v2]'
        )
      ) {
        await abandonRpgCombat(
          state
        )

        return
      }

      if (
        event.target.closest(
          '[data-rpg-combat-result-close-v2]'
        )
      ) {
        closeRpgCombat(
          state
        )
      }
    }
  )

  return overlay
}

function pointerPoint(
  event,
  stage
) {
  const rect =
    stage.getBoundingClientRect()

  const x =
    rect.width
      ? clamp(
          (
            (
              event.clientX -
              rect.left
            ) /
            rect.width
          ) *
          100,
          0,
          100
        )
      : 50

  const y =
    rect.height
      ? clamp(
          (
            (
              event.clientY -
              rect.top
            ) /
            rect.height
          ) *
          100,
          0,
          100
        )
      : 50

  return {
    x,
    y,
  }
}

function targetSpec(
  session
) {
  const roll =
    Math.random()

  const type =
    roll < 0.09
      ? 'danger'
      : roll < 0.17
        ? 'golden'
        : roll < 0.31
          ? 'double'
          : roll < 0.43
            ? 'chain'
            : 'normal'

  const round =
    ++session.round

  const now =
    performance.now()

  const duration =
    type === 'golden'
      ? 900
      : type === 'danger'
        ? 950
        : type === 'double'
          ? 1100
          : type === 'chain'
            ? 1150
            : 1050

  return {
    round,
    type,
    x: randomBetween(13, 87),
    y: randomBetween(18, 82),
    x2: randomBetween(13, 87),
    y2: randomBetween(18, 82),
    startedAt: now,
    duration,
    firstPressAt: 0,
    firstPoint: null,
  }
}

function targetLabel(
  spec
) {
  if (
    spec.type === 'danger'
  ) {
    return '??<small>?VITE</small>'
  }

  if (
    spec.type === 'golden'
  ) {
    return '?<small>PARFAIT</small>'
  }

  if (
    spec.type === 'double'
  ) {
    return '2?<small>DOUBLE</small>'
  }

  if (
    spec.type === 'chain'
  ) {
    return '??<small>1 / 2</small>'
  }

  return '?<small>TOUCHE</small>'
}

function spawnTarget(
  state
) {
  const session =
    state.active

  if (
    !session ||
    session.finishing ||
    session.target
  ) {
    return
  }

  session.target =
    targetSpec(
      session
    )

  renderFight(state)
}

function targetActionBase(
  session,
  spec,
  point
) {
  return {
    round: spec.round,

    t_ms:
      Math.max(
        0,
        Math.round(
          performance.now() -
          session.startedAt
        )
      ),

    x:
      Number(
        point.x.toFixed(2)
      ),

    y:
      Number(
        point.y.toFixed(2)
      ),
  }
}

function qualityFromTiming(
  spec
) {
  const elapsed =
    performance.now() -
    spec.startedAt

  const center =
    spec.duration / 2

  const delta =
    Math.abs(
      elapsed -
      center
    )

  if (
    spec.type === 'golden'
  ) {
    return 'perfect'
  }

  if (
    spec.type === 'double'
  ) {
    return delta <= 420
      ? 'perfect'
      : 'good'
  }

  if (
    spec.type === 'chain'
  ) {
    return delta <= 360
      ? 'perfect'
      : 'good'
  }

  return delta <= 260
    ? 'perfect'
    : 'good'
}

function handleTargetPress(
  state,
  targetElement,
  event
) {
  const session =
    state.active

  const spec =
    session?.target

  const stage =
    document.querySelector(
      '[data-rpg-reaction-stage-v2]'
    )

  if (
    !session ||
    !spec ||
    !stage
  ) {
    return
  }

  const point =
    pointerPoint(
      event,
      stage
    )

  const actionBase =
    targetActionBase(
      session,
      spec,
      point
    )

  if (
    spec.type === 'danger'
  ) {
    resolveTarget(
      state,
      spec,
      {
        ...actionBase,
        kind: 'miss',
      },
      'miss'
    )

    return
  }

  if (
    spec.type === 'double'
  ) {
    if (
      !spec.firstPressAt
    ) {
      spec.firstPressAt =
        performance.now()

      spec.firstPoint =
        point

      targetElement.innerHTML =
        '1?<small>ENCORE</small>'

      return
    }

    if (
      performance.now() -
        spec.firstPressAt >
      700
    ) {
      resolveTarget(
        state,
        spec,
        {
          ...actionBase,
          kind: 'miss',
        },
        'miss'
      )

      return
    }

    resolveTarget(
      state,
      spec,
      {
        ...actionBase,
        kind: 'double',
      },
      qualityFromTiming(
        spec
      )
    )

    return
  }

  if (
    spec.type === 'chain'
  ) {
    if (
      !spec.firstPressAt
    ) {
      spec.firstPressAt =
        performance.now()

      spec.firstPoint =
        point

      spec.firstActionTime =
        actionBase.t_ms

      renderFight(state)
      return
    }

    const chainMs =
      Math.round(
        performance.now() -
        spec.firstPressAt
      )

    const firstPoint =
      spec.firstPoint ||
      point

    const firstTime =
      n(
        spec.firstActionTime,
        actionBase.t_ms
      )

    resolveTarget(
      state,
      spec,
      {
        round:
          spec.round,

        kind:
          'chain',

        t_ms:
          firstTime,

        x:
          Number(
            firstPoint.x
              .toFixed(2)
          ),

        y:
          Number(
            firstPoint.y
              .toFixed(2)
          ),

        t2_ms:
          actionBase.t_ms,

        x2:
          Number(
            point.x
              .toFixed(2)
          ),

        y2:
          Number(
            point.y
              .toFixed(2)
          ),

        chain_ms:
          chainMs,
      },

      chainMs <= 800
        ? 'perfect'
        : chainMs <= 1100
          ? 'good'
          : 'miss'
    )

    return
  }

  resolveTarget(
    state,
    spec,
    {
      ...actionBase,
      kind: 'tap',
    },
    qualityFromTiming(
      spec
    )
  )
}

function resolveMiss(
  state,
  event,
  stage
) {
  const session =
    state.active

  const spec =
    session?.target

  if (
    !session ||
    !spec
  ) {
    return
  }

  const point =
    pointerPoint(
      event,
      stage
    )

  resolveTarget(
    state,
    spec,
    {
      ...targetActionBase(
        session,
        spec,
        point
      ),

      kind:
        'miss',
    },

    'miss'
  )
}

function addDamageUnits(
  session,
  units
) {
  let addedDamage = 0
  let crits = 0

  const spellActive =
    rushAbilityActive(
      session
    )

  const multiplier =
    spellActive
      ? FIRST_SPELL_DAMAGE_MULTIPLIER
      : 1

  for (
    let index = 0;
    index < units;
    index += 1
  ) {
    session.damageClickNo +=
      1

    const hit =
      damageForUnit(
        session,
        session.damageClickNo
      )

    addedDamage +=
      hit.damage *
      multiplier

    session.serverUnitsFloat +=
      multiplier

    if (hit.crit) {
      crits += 1
    }
  }

  session.effectiveClicks =
    Math.max(
      session.effectiveClicks,
      Math.floor(
        session.serverUnitsFloat +
        0.000001
      )
    )

  session.damage +=
    addedDamage

  session.localCrits +=
    crits

  session.hp =
    Math.max(
      0,
      session.maxHp -
      session.damage
    )

  if (crits > 0) {
    playCombatTone('crit')
  } else {
    playCombatTone('hit')
  }

  return {
    addedDamage,
    crits,
    spellActive,
    multiplier,
  }
}

function resolveTarget(
  state,
  spec,
  action,
  quality
) {
  const session =
    state.active

  if (
    !session ||
    session.target?.round !==
      spec.round
  ) {
    return
  }

  session.actions.push(
    action
  )

  session.processed += 1

  if (
    quality === 'miss'
  ) {
    session.misses += 1
    session.combo = 0
    session.perfectStreak = 0
    session.feedback = 'RATÉ'
    session.feedbackType = 'miss'

    playCombatTone('miss')
  } else {
    session.successful += 1
    session.combo += 1

    session.maxCombo =
      Math.max(
        session.maxCombo,
        session.combo
      )

    if (
      spec.type === 'danger'
    ) {
      session.feedback =
        'ESQUIVE PARFAITE'

      session.feedbackType =
        'perfect'

      playCombatTone(
        'perfect'
      )
    } else {
      if (
        quality === 'perfect'
      ) {
        session.perfect += 1
        session.perfectStreak += 1

        session.maxPerfectStreak =
          Math.max(
            session.maxPerfectStreak,
            session.perfectStreak
          )
      } else {
        session.good += 1
        session.perfectStreak = 0
      }

      const comboMultiplier =
        Math.min(
          1.15,
          1 +
          Math.floor(
            (
              session.combo -
              1
            ) /
            5
          ) *
          0.05
        )

      const baseUnits =
        (
          quality ===
          'perfect'
            ? 6
            : 4
        ) +
        (
          spec.type ===
          'golden'
            ? 2
            : 0
        )

      const units =
        Math.max(
          1,
          Math.round(
            baseUnits *
            comboMultiplier
          )
        )

      const damage =
        addDamageUnits(
          session,
          units
        )

      session.feedback =
        `${
          quality ===
          'perfect'
            ? 'PARFAIT'
            : 'BON'
        } ? ` +
        `${formatNumber(
          damage.addedDamage
        )} dégâts` +
        `${
          damage.crits
            ? ` ? ${damage.crits} CRIT`
            : ''
        }`

      session.feedbackType =
        quality

      if (
        quality ===
        'perfect'
      ) {
        playCombatTone(
          'perfect'
        )
      }
    }
  }

  session.target = null

  session.nextSpawnAt =
    performance.now() +
    260

  renderFight(state)

  if (
    session.hp <= 0 &&
    !session.finishing
  ) {
    void finishRpgCombat(
      state,
      'monster-defeated'
    )
  }
}

function expireTarget(
  state
) {
  const session =
    state.active

  const spec =
    session?.target

  if (
    !session ||
    !spec
  ) {
    return
  }

  const elapsed =
    performance.now() -
    spec.startedAt

  const extra =
    spec.type === 'chain' &&
    spec.firstPressAt
      ? 1100
      : 0

  if (
    elapsed <=
    spec.duration +
    extra
  ) {
    return
  }

  if (
    spec.type === 'danger' &&
    !spec.firstPressAt
  ) {
    resolveTarget(
      state,
      spec,
      {
        ...targetActionBase(
          session,
          spec,
          {
            x: spec.x,
            y: spec.y,
          }
        ),

        kind:
          'dodge',
      },

      'perfect'
    )

    return
  }

  resolveTarget(
    state,
    spec,
    {
      ...targetActionBase(
        session,
        spec,
        {
          x: spec.x,
          y: spec.y,
        }
      ),

      kind:
        'miss',
    },

    'miss'
  )
}

function combatActionsPayload(
  session
) {
  const actions =
    session.actions.map(
      action => ({
        ...action,
      })
    )

  actions.push({
    kind:
      'combat_summary_v62',

    successful_actions:
      Math.max(
        0,
        Math.floor(
          session.successful
        )
      ),

    perfect_actions:
      Math.max(
        0,
        Math.floor(
          session.perfect
        )
      ),

    good_actions:
      Math.max(
        0,
        Math.floor(
          session.good
        )
      ),

    missed_actions:
      Math.max(
        0,
        Math.floor(
          session.misses
        )
      ),

    processed_actions:
      Math.max(
        0,
        Math.floor(
          session.processed
        )
      ),

    generated_targets:
      Math.max(
        0,
        Math.floor(
          session.round
        )
      ),

    client_combo_max:
      Math.max(
        0,
        Math.floor(
          session.maxCombo
        )
      ),

    client_perfect_streak_max:
      Math.max(
        0,
        Math.floor(
          session.maxPerfectStreak
        )
      ),

    effective_clicks:
      Math.max(
        0,
        Math.floor(
          session.effectiveClicks
        )
      ),

    rush_ability_used:
      !!session.rushAbilityUsed,

    rush_elapsed_ms:
      session.rushElapsedMs,

    rush_duration_ms:
      session.rushAbilityUsed
        ? FIRST_SPELL_DURATION_MS
        : 0,

    rush_damage_multiplier:
      session.rushAbilityUsed
        ? FIRST_SPELL_DAMAGE_MULTIPLIER
        : 1,

    definition:
      'perfect_zero_ok_zero_miss',
  })

  return actions
}

function tickCombat(
  state
) {
  const session =
    state.active

  if (
    !session ||
    session.finishing
  ) {
    return
  }

  const now =
    performance.now()

  const elapsed =
    now -
    session.startedAt

  const remaining =
    Math.max(
      0,
      session.durationMs -
      elapsed
    )

  session.remainingMs =
    remaining

  expireTarget(state)

  if (
    !session.target &&
    now >=
      session.nextSpawnAt &&
    remaining > 250
  ) {
    spawnTarget(state)
  }

  renderFight(state)

  if (
    remaining <= 0
  ) {
    void finishRpgCombat(
      state,
      'timer'
    )
  }
}

function spriteHtml(
  session
) {
  const sprite =
    rpgMonsterSprite(
      session.monsterName,
      session.skinPath
    )

  if (!sprite) {
    return `
      <div class="rpg-combat-fallback-v2">
        ??
      </div>
    `
  }

  return `
    <img
      src="${esc(sprite)}"
      alt="${esc(session.monsterName)}"
      draggable="false"
    >
  `
}

function renderTarget(
  session
) {
  const spec =
    session.target

  if (!spec) {
    return ''
  }

  const secondChain =
    spec.type === 'chain' &&
    spec.firstPressAt

  const x =
    secondChain
      ? spec.x2
      : spec.x

  const y =
    secondChain
      ? spec.y2
      : spec.y

  const className =
    spec.type === 'normal'
      ? ''
      : ` ${spec.type}`

  const label =
    secondChain
      ? '??<small>2 / 2</small>'
      : targetLabel(spec)

  return `
    <button
      type="button"
      class="rpg-reaction-target-v2${className}"
      data-rpg-reaction-target-v2
      style="left:${x}%;top:${y}%"
    >
      ${label}
    </button>
  `
}

function renderFight(
  state
) {
  const session =
    state.active

  const overlay =
    ensureOverlay()

  if (
    !session ||
    !overlay
  ) {
    return
  }

  const rarity =
    RARITY_DEFS[
      session.rarity
    ] ||
    RARITY_DEFS.common

  const classDef =
    CLASS_DEFS[
      session.classKey
    ] || {
      icon: '??',
      label: 'Combattant',
    }

  const hpPct =
    session.maxHp > 0
      ? clamp(
          (
            session.hp /
            session.maxHp
          ) *
          100,
          0,
          100
        )
      : 0

  const enemy =
    overlay.querySelector(
      '[data-rpg-combat-enemy-v2]'
    )

  if (enemy) {
    const currentName =
      enemy.dataset
        .monsterName || ''

    if (
      currentName !==
      session.monsterName
    ) {
      enemy.innerHTML =
        spriteHtml(
          session
        )

      enemy.dataset
        .monsterName =
        session.monsterName
    }
  }

  const setText = (
    selector,
    value
  ) => {
    const element =
      overlay.querySelector(
        selector
      )

    if (element) {
      element.textContent =
        value
    }
  }

  setText(
    '[data-rpg-combat-name-v2]',
    session.monsterName
  )

  setText(
    '[data-rpg-combat-meta-v2]',
    `${classDef.icon} ${classDef.label} ? ${
      session.isBoss
        ? 'BOSS ? '
        : ''
    }palier ${session.difficulty} ? ${session.world}`
  )

  setText(
    '[data-rpg-combat-rarity-v2]',
    `${rarity.icon} ${rarity.label}`
  )

  setText(
    '[data-rpg-combat-hplabel-v2]',
    `${formatNumber(
      session.hp
    )} / ${formatNumber(
      session.maxHp
    )} PV`
  )

  setText(
    '[data-rpg-combat-clock-v2]',
    `${formatClock(
      session.remainingMs
    )} s`
  )

  setText(
    '[data-rpg-combat-success-v2]',
    String(
      session.successful
    )
  )

  setText(
    '[data-rpg-combat-perfect-v2]',
    String(
      session.perfect
    )
  )

  setText(
    '[data-rpg-combat-combo-v2]',
    `?${session.combo}`
  )

  setText(
    '[data-rpg-combat-damage-v2]',
    formatNumber(
      session.damage
    )
  )

  const hpBar =
    overlay.querySelector(
      '[data-rpg-combat-hpbar-v2]'
    )

  if (hpBar) {
    hpBar.style.width =
      `${hpPct}%`
  }

  const stage =
    overlay.querySelector(
      '[data-rpg-reaction-stage-v2]'
    )

  if (stage) {
    const signature =
      session.target
        ? (
            session.target.type ===
              'chain' &&
            session.target.firstPressAt
          )
          ? `${session.target.round}:chain:2`
          : `${session.target.round}:${session.target.type}`
        : ''

    if (
      stage.dataset
        .targetSignature !==
      signature
    ) {
      stage
        .querySelectorAll(
          '[data-rpg-reaction-target-v2]'
        )
        .forEach(
          target =>
            target.remove()
        )

      stage.insertAdjacentHTML(
        'beforeend',
        renderTarget(
          session
        )
      )

      stage.dataset
        .targetSignature =
        signature
    }
  }

  const hint =
    overlay.querySelector(
      '[data-rpg-reaction-hint-v2]'
    )

  if (hint) {
    hint.textContent =
      session.target
        ? session.target.type ===
            'danger'
          ? 'Ne clique pas la t?te de mort.'
          : session.target.type ===
              'double'
            ? 'Double clic rapide sur la cible.'
            : session.target.type ===
                'chain'
              ? session.target
                  .firstPressAt
                ? 'Deuxi?me maillon !'
                : 'Clique puis suis le deuxi?me maillon.'
              : 'Vise la cible.'
        : 'Pr?pare-toi?'
  }

  /* RPG RUSH BUTTON RENDER V2 */

  const rushButton =
    overlay.querySelector(
      '[data-rpg-rush-v2]'
    )

  if (rushButton) {
    const def =
      firstSpellDef(
        session
      )

    const active =
      rushAbilityActive(
        session
      )

    rushButton.innerHTML =
      `${def.icon} ${esc(def.name)}
        <small>
          ${
            active
              ? 'ACTIF ? +35 % dégâts'
              : session.rushAbilityUsed
                ? 'D?j? utilis?'
                : '+35 % dégâts ? 5 s ? 1 utilisation'
          }
        </small>
      `

    rushButton.disabled =
      session.rushAbilityUsed ||
      session.finishing

    rushButton.classList
      .toggle(
        'active',
        active
      )

    rushButton.classList
      .toggle(
        'used',
        session.rushAbilityUsed &&
        !active
      )
  }

  const feedback =
    overlay.querySelector(
      '[data-rpg-combat-feedback-v2]'
    )

  if (feedback) {
    feedback.textContent =
      session.feedback ||
      ''

    feedback.className =
      `rpg-combat-feedback-v2 ${
        session.feedbackType ||
        ''
      }`
  }
}

function showFight(
  state
) {
  const overlay =
    ensureOverlay()

  overlay.classList
    .add('show')

  overlay
    .querySelector(
      '[data-rpg-combat-fight-v2]'
    )
    .style.display = ''

  overlay
    .querySelector(
      '[data-rpg-combat-result-v2]'
    )
    .classList
    .remove('show')

  renderFight(state)
}


/* RPG PERFECT COMBAT V2 */

function perfectMultiplierTextV2(
  value
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return '2'
  }

  return number
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
}

function ensurePerfectCombatStylesV2() {
  if (
    document.getElementById(
      'rpgPerfectCombatStylesV2'
    )
  ) {
    return
  }

  const style =
    document.createElement(
      'style'
    )

  style.id =
    'rpgPerfectCombatStylesV2'

  style.textContent = `
.rpg-perfect-overlay-v2{
  position:fixed;
  inset:0;
  z-index:20000;

  display:flex;
  align-items:center;
  justify-content:center;

  pointer-events:none;

  background:
    radial-gradient(
      circle at 50% 45%,
      rgba(240,196,77,.20),
      rgba(5,7,12,.88) 48%,
      rgba(3,4,8,.96)
    );

  animation:
    rpgPerfectOverlayV2
    2.15s ease both;
}

.rpg-perfect-card-v2{
  position:relative;
  width:min(
    calc(100vw - 32px),
    430px
  );

  overflow:hidden;

  padding:
    23px 18px
    19px;

  border:
    1px solid
    rgba(255,219,103,.55);

  border-radius:22px;

  background:
    linear-gradient(
      145deg,
      rgba(40,27,10,.98),
      rgba(13,14,21,.98) 48%,
      rgba(27,13,28,.98)
    );

  box-shadow:
    0 0 0 1px
      rgba(255,255,255,.05),
    0 0 40px
      rgba(240,196,77,.28),
    0 25px 80px
      rgba(0,0,0,.65);

  text-align:center;

  animation:
    rpgPerfectCardV2
    .48s cubic-bezier(
      .2,
      1.35,
      .35,
      1
    ) both;
}

.rpg-perfect-card-v2::before{
  content:'';

  position:absolute;
  inset:-70% -20%;

  background:
    conic-gradient(
      from 0deg,
      transparent,
      rgba(255,215,90,.11),
      transparent 22%,
      transparent 55%,
      rgba(210,84,255,.10),
      transparent 75%
    );

  animation:
    rpgPerfectRotateV2
    2.4s linear infinite;
}

.rpg-perfect-inner-v2{
  position:relative;
  z-index:2;
}

.rpg-perfect-crown-v2{
  font-size:45px;

  filter:
    drop-shadow(
      0 0 14px
      rgba(255,210,68,.60)
    );

  animation:
    rpgPerfectCrownV2
    .65s ease-in-out infinite alternate;
}

.rpg-perfect-title-v2{
  margin-top:5px;

  color:#ffe28a;

  font-size:
    clamp(24px,7vw,38px);

  font-weight:1000;

  letter-spacing:.035em;

  text-shadow:
    0 0 15px
    rgba(240,196,77,.38);
}

.rpg-perfect-gold-v2{
  display:inline-flex;
  align-items:center;
  justify-content:center;

  margin-top:11px;

  padding:
    7px 15px;

  border-radius:999px;

  background:
    linear-gradient(
      135deg,
      #aa7419,
      #f1ce61,
      #a36e17
    );

  color:#241707;

  font-size:17px;
  font-weight:1000;

  box-shadow:
    0 0 20px
    rgba(240,196,77,.25);
}

.rpg-perfect-stats-v2{
  display:grid;

  grid-template-columns:
    repeat(3,1fr);

  gap:7px;

  margin-top:15px;
}

.rpg-perfect-stat-v2{
  padding:
    9px 5px;

  border-radius:11px;

  background:
    rgba(255,255,255,.045);

  border:
    1px solid
    rgba(255,255,255,.055);
}

.rpg-perfect-stat-v2 strong{
  display:block;

  color:#fff;

  font-size:17px;
}

.rpg-perfect-stat-v2 span{
  display:block;

  margin-top:3px;

  color:#929cb0;

  font-size:7px;

  text-transform:uppercase;

  letter-spacing:.06em;
}

.rpg-perfect-sub-v2{
  margin-top:12px;

  color:#c3cad6;

  font-size:9px;

  line-height:1.5;
}

@keyframes rpgPerfectOverlayV2{
  0%{
    opacity:0;
  }

  12%{
    opacity:1;
  }

  80%{
    opacity:1;
  }

  100%{
    opacity:0;
  }
}

@keyframes rpgPerfectCardV2{
  from{
    opacity:0;

    transform:
      scale(.55)
      rotate(-4deg);
  }

  to{
    opacity:1;

    transform:
      scale(1)
      rotate(0);
  }
}

@keyframes rpgPerfectRotateV2{
  to{
    transform:
      rotate(360deg);
  }
}

@keyframes rpgPerfectCrownV2{
  from{
    transform:
      translateY(0)
      scale(1);
  }

  to{
    transform:
      translateY(-4px)
      scale(1.06);
  }
}
`

  document.head
    .appendChild(
      style
    )
}

function showPerfectCombatAnimationV2(
  result
) {
  if (
    !result?.perfect_combat
  ) {
    return
  }

  ensurePerfectCombatStylesV2()

  document
    .getElementById(
      'rpgPerfectOverlayV2'
    )
    ?.remove()

  const streak =
    Math.max(
      0,
      Math.floor(
        Number(
          result
            .perfect_combat_streak
        ) || 0
      )
    )

  const multiplier =
    perfectMultiplierTextV2(
      result
        .perfect_gold_multiplier
    )

  const successful =
    Math.max(
      0,
      Math.floor(
        Number(
          result
            .successful_actions
        ) || 0
      )
    )

  const lootCombo =
    Math.max(
      0,
      Math.floor(
        Number(
          result
            .combat_drop_combo
        ) || 0
      )
    )

  const overlay =
    document.createElement(
      'div'
    )

  overlay.id =
    'rpgPerfectOverlayV2'

  overlay.className =
    'rpg-perfect-overlay-v2'

  overlay.innerHTML = `
    <div
      class="rpg-perfect-card-v2"
    >
      <div
        class="rpg-perfect-inner-v2"
      >
        <div
          class="rpg-perfect-crown-v2"
        >
          ??
        </div>

        <div
          class="rpg-perfect-title-v2"
        >
          COMBAT PARFAIT
        </div>

        <div
          class="rpg-perfect-gold-v2"
        >
          ?? GOLD ?${multiplier}
        </div>

        <div
          class="rpg-perfect-stats-v2"
        >
          <div
            class="rpg-perfect-stat-v2"
          >
            <strong>
              ${streak}
            </strong>

            <span>
              Streak parfait
            </span>
          </div>

          <div
            class="rpg-perfect-stat-v2"
          >
            <strong>
              ${successful}
            </strong>

            <span>
              Actions réussies
            </span>
          </div>

          <div
            class="rpg-perfect-stat-v2"
          >
            <strong>
              ${lootCombo}
            </strong>

            <span>
              Combo loot
            </span>
          </div>
        </div>

        <div
          class="rpg-perfect-sub-v2"
        >
          Z?ro erreur.
          R?compense parfaite valid?e
          par le serveur.
        </div>
      </div>
    </div>
  `

  document.body
    .appendChild(
      overlay
    )

  if (
    navigator.vibrate
  ) {
    navigator.vibrate(
      [
        45,
        30,
        70,
        30,
        115,
      ]
    )
  }

  setTimeout(
    () => {
      overlay.remove()
    },
    2200
  )
}

function showResult(
  state,
  result
) {
  const session =
    state.active

  const overlay =
    ensureOverlay()

  if (!session) {
    return
  }

  if (
    result?.perfect_combat
  ) {
    showPerfectCombatAnimationV2(
      result
    )
  }

  const won =
    !!result?.won

  const title =
    won
      ? session.isBoss
        ? 'BOSS TERRASS? !'
        : 'VICTOIRE !'
      : 'DÉFAITE'

  const gold =
    n(
      result?.gold_earned
    )

  const xp =
    n(
      result?.xp_earned
    )

  const accuracy =
    n(
      result?.accuracy_pct
    )

  const successful =
    n(
      result
        ?.successful_actions,
      session.successful
    )

  const perfect =
    n(
      result
        ?.perfect_actions,
      session.perfect
    )

  const maxCombo =
    n(
      result?.max_combo,
      session.maxCombo
    )

  const itemName =
    String(
      result
        ?.combat_item_name ||
      result
        ?.special_drop_name ||
      ''
    ).trim()

  const discoveredName =
    String(
      result
        ?.discovered_monster_name ||
      ''
    ).trim()

  overlay
    .querySelector(
      '[data-rpg-combat-fight-v2]'
    )
    .style.display =
    'none'

  overlay
    .querySelector(
      '[data-rpg-combat-result-v2]'
    )
    .classList
    .add('show')

  const titleElement =
    overlay.querySelector(
      '[data-rpg-combat-result-title-v2]'
    )

  const textElement =
    overlay.querySelector(
      '[data-rpg-combat-result-text-v2]'
    )

  const rewardsElement =
    overlay.querySelector(
      '[data-rpg-combat-result-rewards-v2]'
    )

  if (titleElement) {
    titleElement.textContent =
      title
  }

  if (textElement) {
    textElement.innerHTML = `
      ${
        won
          ? 'Tu as vaincu'
          : 'Fin du combat contre'
      }
      <strong>${esc(
        session.monsterName
      )}</strong>.<br>

      ${successful} actions réussies ?
      ${formatNumber(
        accuracy,
        1
      )} % de pr?cision ?
      ${perfect} parfaites ?
      combo max ?${maxCombo}.<br>

      Dégâts serveur :
      <strong>${formatNumber(
        result?.damage_dealt,
        0
      )}</strong>.
    `
  }

  if (rewardsElement) {
    rewardsElement.innerHTML =
      won
        ? `
          ?? <strong>+${formatNumber(
            gold
          )} Gold</strong><br>

          ? <strong>+${formatNumber(
            xp,
            2
          )} XP</strong>

          ${
            result?.gold_jackpot
              ? '<br>?? <strong>JACKPOT ?10</strong>'
              : ''
          }

          ${
            result?.perfect_combat
              ? `<br>?? <strong>COMBAT PARFAIT ?${formatNumber(
                  result
                    ?.perfect_gold_multiplier,
                  3
                )} Gold</strong>`
              : ''
          }

          ${
            itemName
              ? `<br>?? Loot : <strong>${esc(
                  itemName
                )}</strong>`
              : ''
          }

          ${
            discoveredName
              ? `<br>?? Nouveau bestiaire : <strong>${esc(
                  discoveredName
                )}</strong>`
              : ''
          }
        `
        : 'Aucune r?compense de victoire.'
  }

  if (
    won &&
    result?.gold_jackpot
  ) {
    void playRpgEventMusic(
      'jackpot'
    )
  }
}

async function rpcWithTimeout(
  name,
  args
) {
  return Promise.race([
    supabase.rpc(
      name,
      args
    ),

    new Promise(
      resolve => {
        setTimeout(
          () => {
            resolve({
              data: null,
              error: {
                message:
                  'Le serveur met trop de temps ? r?pondre.',
              },
            })
          },
          RESULT_TIMEOUT_MS
        )
      }
    ),
  ])
}

function serverRow(data) {
  return Array.isArray(data)
    ? data[0]
    : data
}

function sessionFromRow({
  athleteSlug,
  row,
  isBoss,
  difficulty,
}) {
  const maxHp =
    n(
      row?.monster_hp,
      NaN
    )

  const baseDamage =
    n(
      row?.base_damage,
      NaN
    )

  const combatId =
    String(
      row?.combat_id ||
      ''
    ).trim()

  const monsterName =
    String(
      row?.monster_name ||
      ''
    ).trim()

  const durationSeconds =
    Math.max(
      1,
      n(
        row?.duration_seconds,
        isBoss
          ? 45
          : 30
      )
    )

  if (
    !combatId ||
    !monsterName ||
    !Number.isFinite(maxHp) ||
    maxHp <= 0 ||
    !Number.isFinite(baseDamage) ||
    baseDamage <= 0
  ) {
    throw new Error(
      'R?ponse de combat invalide : identifiant, monstre, PV ou dégâts manquants.'
    )
  }

  const now =
    performance.now()

  return {
    athleteSlug,

    id:
      combatId,

    isBoss,

    classKey:
      String(
        row?.rpg_class ||
        ''
      ),

    monsterName,

    rarity:
      canonicalRarity(
        row?.monster_rarity ||
        row?.rarity ||
        (
          isBoss
            ? 'legendary'
            : 'common'
        )
      ),

    world:
      String(
        row?.monster_world ||
        (
          isBoss
            ? 'Boss de palier'
            : 'Aventure'
        )
      ),

    monsterKey:
      String(
        row?.monster_key ||
        ''
      ),

    skinPath:
      String(
        row?.skin_path ||
        ''
      ),

    maxHp,
    hp: maxHp,
    baseDamage,

    critSeed:
      n(
        row?.crit_seed,
        1
      ),

    critChance:
      n(
        row?.crit_chance_pct,
        0
      ),

    difficulty:
      Math.max(
        1,
        Math.floor(
          n(
            row?.difficulty,
            difficulty
          )
        )
      ),

    durationMs:
      durationSeconds *
      1000,

    remainingMs:
      durationSeconds *
      1000,

    startedAt:
      now,

    nextSpawnAt:
      now + 650,

    finishing:
      false,

    finishValidationFailed:
      false,

    round:
      0,

    target:
      null,

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

    damageClickNo:
      0,

    serverUnitsFloat:
      0,

    rushAbilityUsed:
      false,

    rushStartedAt:
      0,

    rushElapsedMs:
      null,

    rushDurationMs:
      FIRST_SPELL_DURATION_MS,

    damage:
      0,

    localCrits:
      0,

    feedback:
      '',

    feedbackType:
      '',
  }
}

export function createRpgCombatState() {
  return {
    busy: false,
    selectedDifficulty: null,
    active: null,
    timer: null,
    result: null,
    error: '',
    onFinished: null,
  }
}

export function setRpgCombatDifficulty(
  state,
  athleteSlug,
  value,
  progress
) {
  const max =
    progressMaxDifficulty(
      progress
    )

  const difficulty =
    clamp(
      Math.floor(
        n(
          value,
          max
        )
      ),
      1,
      max
    )

  state.selectedDifficulty =
    difficulty

  localStorage.setItem(
    difficultyStorageKey(
      athleteSlug
    ),
    String(
      difficulty
    )
  )

  return difficulty
}

export function renderRpgCombatLauncher({
  athleteSlug,
  progress,
  canEdit,
  state,
}) {
  const maxDifficulty =
    progressMaxDifficulty(
      progress
    )

  const difficulty =
    selectedDifficulty(
      state,
      athleteSlug,
      progress
    )

  state.selectedDifficulty =
    difficulty

  const hasClass =
    !!progress?.rpg_class

  const kills =
    Math.max(
      0,
      Math.floor(
        n(
          progress
            ?.kills_toward_boss
        )
      )
    )

  /* RPG BOSS LOCAL TEST V2
     Autorisé uniquement avec le serveur Vite DEV.
     Désactivé automatiquement dans le build production.
  */
  const bossReady = kills >= 50

  const disabled =
    !canEdit ||
    !hasClass ||
    state?.busy ||
    !!state?.active

  return `
    <section class="rpg-combat-launch-v2 rpg-combat-panel-v2">
      <div class="rpg-combat-launch-head-v2">
        <div>
          <strong>
            Aventure & Combat
          </strong>

          <small>
            Combat dynamique : précision, dégâts, Gold, XP, loot et Bestiaire synchronisés avec Supabase.
            dégâts, Gold, XP, loot et Bestiaire
            valid?s par Supabase.
          </small>
        </div>

        <span>
          ?? ${kills}/50
        </span>
      </div>

      ${
        hasClass
          ? `
            <div class="rpg-combat-difficulty-v2">
              <label>
                <span>
                  Palier choisi
                </span>

                <b>
                  ${difficulty} / ${maxDifficulty}
                </b>
              </label>

              <input class="rpg-combat-range-v2"
                type="range"
                min="1"
                max="${maxDifficulty}"
                value="${difficulty}"
                data-rpg-combat-difficulty-v2
                ${
                  disabled
                    ? 'disabled'
                    : ''
                }
              >
            </div>

            <div class="rpg-combat-launch-actions-v2">
              <button class="rpg-combat-primary-v2"
                type="button"
                data-rpg-combat-start-v2
                ${
                  disabled
                    ? 'disabled'
                    : ''
                }
              >
                Combattre le palier ${difficulty}
              </button>

              <button
                type="button"
                class="boss rpg-combat-boss-v2"
                data-rpg-boss-start-v2
                ${
                  disabled ||
                  !bossReady
                    ? 'disabled'
                    : ''
                }
              >
                ?? ${
                  bossReady
                    ? 'Affronter le Boss'
                    : `Boss ? ${kills}/50`
                }
              </button>
            </div>
          `
          : `
            <div class="rpg-combat-difficulty-v2">
              Choisis d?abord ta classe RPG
              pour d?bloquer les combats.
            </div>
          `
      }

      ${
        !canEdit
          ? `
            <small
              style="
                display:block;
                margin-top:8px;
                color:#7f8aa2
              "
            >
              Profil visible en lecture seule ?
              le combat est r?serv? ? cet athl?te
              et au coach.
            </small>
          `
          : ''
      }
    </section>
  `
}

export async function startRpgCombat({
  athleteSlug,
  progress,
  state,
  isBoss = false,
  onFinished,
}) {
  if (
    !state ||
    state.busy ||
    state.active
  ) {
    return false
  }

  if (!athleteSlug) {
    throw new Error(
      'Athl?te RPG manquant.'
    )
  }

  if (
    !progress?.rpg_class
  ) {
    throw new Error(
      'Choisis une classe avant de combattre.'
    )
  }

  if (
    isBoss &&
    n(
      progress
        ?.kills_toward_boss
    ) < 50 &&
    !import.meta.env.DEV
  ) {
    throw new Error(
      'Le boss se débloque après 50 victoires de palier.'
    )
  }

  const difficulty =
    selectedDifficulty(
      state,
      athleteSlug,
      progress
    )

  state.busy = true
  state.error = ''
  state.onFinished =
    onFinished || null

  activeState =
    state

  try {
    const response =
      isBoss
        ? await supabase.rpc(
            'start_rpg_boss',
            {
              p_athlete_slug:
                athleteSlug,
            }
          )
        : await supabase.rpc(
            'start_rpg_combat_special_v25',
            {
              p_athlete_slug:
                athleteSlug,

              p_difficulty:
                difficulty,
            }
          )

    if (
      response.error
    ) {
      throw response.error
    }

    const row =
      serverRow(
        response.data
      )

    if (!row) {
      throw new Error(
        'Supabase n?a renvoy? aucun combat.'
      )
    }

    if (
      !isBoss &&
      Math.floor(
        n(
          row.difficulty,
          difficulty
        )
      ) !==
      difficulty
    ) {
      throw new Error(
        'Le serveur a renvoy? un palier diff?rent de celui demand?.'
      )
    }

    state.active =
      sessionFromRow({
        athleteSlug,
        row,
        isBoss,
        difficulty,
      })

    state.result =
      null

    void playRpgBattleMusic({
      monsterName:
        state.active
          .monsterName,

      monsterRarity:
        state.active
          .rarity,

      difficulty:
        state.active
          .difficulty,

      isBoss,
    })

    showFight(
      state
    )

    clearInterval(
      state.timer
    )

    state.timer =
      setInterval(
        () =>
          tickCombat(
            state
          ),
        TICK_MS
      )

    tickCombat(
      state
    )

    return true
  } catch (error) {
    state.error =
      error?.message ||
      String(error)

    state.active =
      null

    activeState =
      null

    throw error
  } finally {
    state.busy =
      false
  }
}

export async function finishRpgCombat(
  state,
  reason = 'automatic'
) {
  const session =
    state?.active

  if (
    !session ||
    session.finishing
  ) {
    return
  }

  if (
    reason !== 'abandon' &&
    reason !== 'timer' &&
    session.hp > 0
  ) {
    return
  }

  session.finishing =
    true

  session.target =
    null

  clearInterval(
    state.timer
  )

  state.timer =
    null

  renderFight(
    state
  )

  const rpcName =
    session.isBoss
      ? 'finish_rpg_boss_codex_xp_v35'
      : 'finish_rpg_combat_v166'

  const response =
    await rpcWithTimeout(
      rpcName,
      {
        p_combat_id:
          session.id,

        p_actions:
          combatActionsPayload(
            session
          ),

        p_client_clicks:
          Math.max(
            0,
            Math.floor(
              session.effectiveClicks
            )
          ),
      }
    )

  if (
    response.error
  ) {
    session.finishing =
      false

    session.feedback =
      `Validation impossible : ${response.error.message}`

    session.feedbackType =
      'miss'

    renderFight(
      state
    )

    throw response.error
  }

  const result =
    serverRow(
      response.data
    ) || {}

  state.result =
    result

  showResult(
    state,
    result
  )

  try {
    await state
      .onFinished?.(
        result,
        session
      )
  } catch (error) {
    console.warn(
      'RPG COMBAT REFRESH ERROR',
      error
    )
  }
}

export async function abandonRpgCombat(
  state
) {
  const session =
    state?.active

  if (
    !session ||
    session.finishing
  ) {
    return
  }

  if (
    !session.isBoss
  ) {
    await finishRpgCombat(
      state,
      'abandon'
    )

    return
  }

  session.finishing =
    true

  clearInterval(
    state.timer
  )

  state.timer =
    null

  const response =
    await rpcWithTimeout(
      'abandon_rpg_boss_v20',
      {
        p_combat_id:
          session.id,
      }
    )

  if (
    response.error
  ) {
    session.finishing =
      false

    session.feedback =
      `Abandon serveur impossible : ${response.error.message}`

    session.feedbackType =
      'miss'

    state.timer =
      setInterval(
        () =>
          tickCombat(
            state
          ),
        TICK_MS
      )

    renderFight(
      state
    )

    throw response.error
  }

  showResult(
    state,
    {
      won: false,

      damage_dealt:
        session.damage,

      successful_actions:
        session.successful,

      accuracy_pct:
        session.processed
          ? (
              session.successful /
              session.processed
            ) *
            100
          : 0,

      perfect_actions:
        session.perfect,

      max_combo:
        session.maxCombo,
    }
  )

  try {
    await state
      .onFinished?.(
        serverRow(
          response.data
        ) || {},
        session
      )
  } catch (error) {
    console.warn(
      'RPG BOSS ABANDON REFRESH ERROR',
      error
    )
  }
}

export function closeRpgCombat(
  state
) {
  if (!state) {
    return
  }

  clearInterval(
    state.timer
  )

  state.timer = null
  state.active = null
  state.result = null
  state.busy = false

  document
    .getElementById(
      'rpgCombatOverlayV2'
    )
    ?.classList
    .remove('show')

  if (
    activeState === state
  ) {
    activeState =
      null
  }

  void playRpgMenuMusic()
}
