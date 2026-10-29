import { supabase } from './supabase.js'

const RARITIES = {
  common: {
    label: 'Commune',
    short: 'C',
    rank: 1,
    costBias: 0,
    budget: 8,
  },
  uncommon: {
    label: 'Peu commune',
    short: 'U',
    rank: 2,
    costBias: 0,
    budget: 10,
  },
  rare: {
    label: 'Rare',
    short: 'R',
    rank: 3,
    costBias: 1,
    budget: 12,
  },
  ultra: {
    label: 'Ultra Rare',
    short: 'UR',
    rank: 4,
    costBias: 1,
    budget: 14,
  },
  secret: {
    label: 'Secret Rare',
    short: 'SR',
    rank: 5,
    costBias: 2,
    budget: 16,
  },
}

const ARCHETYPES = [
  {
    id: 'power',
    label: 'Puissance',
    icon: '◆',
    text: '+2 ATK si son coût est ≥ à la carte adverse.',
  },
  {
    id: 'guard',
    label: 'Ancrage',
    icon: '⬟',
    text: '+2 DEF pendant le duel.',
  },
  {
    id: 'tempo',
    label: 'Tempo',
    icon: '»',
    text: '+1 ATK et +1 DEF si le coût est ≤ 2.',
  },
  {
    id: 'technique',
    label: 'Technique',
    icon: '◇',
    text: '+1 ATK et +1 DEF contre une carte plus offensive que défensive.',
  },
  {
    id: 'chaos',
    label: 'Instinct',
    icon: '✦',
    text: 'Variation de -1 à +2 ATK à chaque duel.',
  },
]

const BOOSTER_TEMPLATES = [
  ['forge', 'Forge', '🔥', 18],
  ['titan', 'Titan', '🗿', 38],
  ['voltage', 'Voltage', '⚡', 58],
  ['lunar', 'Lunaire', '🌙', 258],
  ['solar', 'Solaire', '☀️', 42],
  ['dragon', 'Dragon', '🐉', 6],
  ['crown', 'Couronne', '♛', 46],
  ['abyss', 'Abysses', '◉', 222],
  ['sakura', 'Sakura', '✿', 332],
  ['atlas', 'Atlas', '▲', 154],
  ['mirage', 'Mirage', '◈', 282],
  ['nordic', 'Nordique', '❄', 198],
  ['arena', 'Arène', '⚔', 12],
  ['precision', 'Précision', '◎', 174],
  ['wild', 'Wild', '✹', 88],
  ['champion', 'Champion', '★', 48],
  ['eclipse', 'Éclipse', '◐', 266],
  ['neon', 'Néon', '✧', 304],
  ['storm', 'Storm', 'ϟ', 210],
  ['secret-lab', 'Secret Lab', '⌁', 126],
]

const DECK_SIZE = 12
const MAX_COPY_IN_DECK = 2
const START_HP = 24
const MAX_TURNS = 14

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function hashString(value) {
  let hash = 2166136261

  for (
    const char
    of String(value || '')
  ) {
    hash ^=
      char.charCodeAt(0)

    hash =
      Math.imul(
        hash,
        16777619
      )
  }

  return Math.abs(
    hash >>> 0
  )
}

function seededRatio(value) {
  return (
    hashString(value) %
    10000
  ) / 10000
}

function athleteSlug(athlete) {
  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    ''
  )
    .trim()
    .toLowerCase()
}

function imageSrc(athlete) {
  const raw =
    String(
      athlete?.profileImage ||
      ''
    ).trim()

  if (!raw) {
    return ''
  }

  if (
    raw.startsWith('data:') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('/')
  ) {
    return raw
  }

  return '/' + raw
}

function cardId(
  slug,
  rarity
) {
  return (
    String(slug) +
    ':' +
    String(rarity)
  )
}

function parseCardId(id) {
  const [
    slug,
    rarity,
  ] =
    String(id || '')
      .split(':')

  return {
    slug,
    rarity,
  }
}

function rarityMeta(rarity) {
  return (
    RARITIES[rarity] ||
    RARITIES.common
  )
}

function archetypeFor(slug) {
  return ARCHETYPES[
    hashString(slug) %
    ARCHETYPES.length
  ]
}

function buildCard(
  athlete,
  rarity = 'common'
) {
  const slug =
    athleteSlug(athlete)

  const meta =
    rarityMeta(rarity)

  const archetype =
    archetypeFor(slug)

  const seed =
    hashString(
      slug +
      ':' +
      rarity
    )

  const cost =
    Math.max(
      1,
      Math.min(
        5,
        1 +
        Math.floor(
          (
            seed %
            5
          ) *
          .75
        ) +
        meta.costBias
      )
    )

  const usableBudget =
    meta.budget +
    Math.max(
      0,
      cost - 2
    )

  let attack =
    3 +
    (
      seed %
      Math.max(
        2,
        usableBudget - 4
      )
    )

  attack =
    Math.min(
      usableBudget - 2,
      attack
    )

  let guard =
    Math.max(
      2,
      usableBudget -
      attack
    )

  if (
    archetype.id ===
      'power'
  ) {
    attack += 1
    guard =
      Math.max(
        2,
        guard - 1
      )
  }

  if (
    archetype.id ===
      'guard'
  ) {
    guard += 1
    attack =
      Math.max(
        2,
        attack - 1
      )
  }

  return {
    id:
      cardId(
        slug,
        rarity
      ),
    slug,
    athlete,
    rarity,
    rarityMeta: meta,
    archetype,
    cost,
    attack,
    guard,
    score:
      attack +
      guard +
      meta.rank * 2 -
      cost * .6,
  }
}

function catalogForAthletes(
  athletes
) {
  const map =
    new Map()

  for (
    const athlete
    of athletes
  ) {
    const slug =
      athleteSlug(
        athlete
      )

    if (!slug) {
      continue
    }

    for (
      const rarity
      of Object.keys(
        RARITIES
      )
    ) {
      const card =
        buildCard(
          athlete,
          rarity
        )

      map.set(
        card.id,
        card
      )
    }
  }

  return map
}

function boosterCatalog(
  athletes
) {
  const clean =
    athletes.filter(
      athlete =>
        athleteSlug(
          athlete
        )
    )

  return BOOSTER_TEMPLATES
    .map(
      (
        [
          id,
          name,
          icon,
          hue,
        ],
        index
      ) => {
        const featured =
          clean.filter(
            (
              _,
              athleteIndex
            ) =>
              athleteIndex %
                BOOSTER_TEMPLATES.length ===
              index
          )

        const fallback =
          clean.filter(
            (
              _,
              athleteIndex
            ) =>
              athleteIndex %
                10 ===
              index %
                10
          )

        return {
          id,
          name,
          icon,
          hue,
          featured:
            featured.length
              ? featured
              : fallback,
        }
      }
    )
}

function randomItem(items) {
  if (!items.length) {
    return null
  }

  const bytes =
    new Uint32Array(1)

  crypto.getRandomValues(
    bytes
  )

  return items[
    bytes[0] %
    items.length
  ]
}

function randomPercent() {
  const bytes =
    new Uint32Array(1)

  crypto.getRandomValues(
    bytes
  )

  return (
    bytes[0] /
    4294967295
  ) * 100
}

function chooseRarity({
  premium = false,
  openingNumber = 1,
}) {
  if (
    premium &&
    openingNumber %
      50 ===
      0
  ) {
    return 'secret'
  }

  if (
    premium &&
    openingNumber %
      10 ===
      0
  ) {
    return 'ultra'
  }

  const roll =
    randomPercent()

  if (premium) {
    if (roll < 3) {
      return 'secret'
    }

    if (roll < 15) {
      return 'ultra'
    }

    if (roll < 50) {
      return 'rare'
    }

    return 'uncommon'
  }

  if (roll < .2) {
    return 'secret'
  }

  if (roll < 1.5) {
    return 'ultra'
  }

  if (roll < 9) {
    return 'rare'
  }

  if (roll < 36) {
    return 'uncommon'
  }

  return 'common'
}

function drawBooster({
  booster,
  athletes,
  openingNumber,
}) {
  const featured =
    booster?.featured ||
    []

  return Array.from(
    {
      length: 5,
    },
    (_, index) => {
      const rarity =
        chooseRarity({
          premium:
            index === 4,
          openingNumber,
        })

      const useFeatured =
        featured.length >
          0 &&
        randomPercent() <
          58

      const athlete =
        randomItem(
          useFeatured
            ? featured
            : athletes
        )

      return buildCard(
        athlete,
        rarity
      )
    }
  )
}

function ensureStyles() {
  if (
    document.getElementById(
      'ga-tcg-style-v1'
    )
  ) {
    return
  }

  const style =
    document.createElement(
      'style'
    )

  style.id =
    'ga-tcg-style-v1'

  style.textContent = `
    .tcg-app{--tcg-accent:#ffca5d;min-height:100vh;padding:14px;color:#f7f8ff;background:radial-gradient(circle at 50% -10%,rgba(86,67,166,.28),transparent 32%),linear-gradient(180deg,#080a14,#101326 54%,#070912);font-family:Inter,system-ui,sans-serif}
    .tcg-shell{width:min(1180px,100%);margin:0 auto}
    .tcg-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}.tcg-top h1{margin:0;font-size:24px}.tcg-top small{display:block;color:#8a91ac;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.tcg-spacer{flex:1}.tcg-back,.tcg-chip{border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.045);color:#f7f8ff;padding:9px 11px;font-weight:900}.tcg-back{cursor:pointer}.tcg-chip b{color:#ffd66d}
    .tcg-athlete-select{min-width:160px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#12162a;color:white;padding:9px 10px;font-weight:800}
    .tcg-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(250px,.85fr);gap:15px;padding:18px;border:1px solid rgba(255,214,109,.18);border-radius:22px;background:radial-gradient(circle at 80% 5%,rgba(255,214,109,.13),transparent 28%),linear-gradient(135deg,rgba(36,27,72,.95),rgba(11,15,31,.98));box-shadow:0 26px 80px rgba(0,0,0,.28)}
    .tcg-hero h2{margin:5px 0 7px;font-size:clamp(25px,5vw,46px);line-height:.98;letter-spacing:-.04em}.tcg-hero p{margin:0;max-width:650px;color:#939bb5;font-size:12px;line-height:1.55}.tcg-kicker{color:#ffd66d;font-size:9px;font-weight:1000;letter-spacing:.16em}
    .tcg-hero-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tcg-hero-stat{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(5,7,16,.5)}.tcg-hero-stat span{display:block;color:#7e87a0;font-size:8px;font-weight:900;text-transform:uppercase}.tcg-hero-stat b{display:block;margin-top:4px;font-size:20px}.tcg-hero-stat em{color:#ffd66d;font-style:normal}
    .tcg-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:12px 0}.tcg-nav button{min-height:46px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#101529;color:#78829d;font-weight:950;cursor:pointer}.tcg-nav button.active{border-color:rgba(255,214,109,.42);background:linear-gradient(135deg,rgba(118,83,21,.32),rgba(74,49,18,.17));color:#fff}.tcg-panel{border:1px solid rgba(255,255,255,.075);border-radius:20px;background:rgba(11,14,28,.92);overflow:hidden}
    .tcg-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.018)}.tcg-panel-head h3{margin:0;font-size:16px}.tcg-panel-head p{margin:3px 0 0;color:#77809a;font-size:9px}.tcg-panel-pad{padding:14px}
    .tcg-booster-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.tcg-booster{--h:48;position:relative;min-height:190px;overflow:hidden;padding:13px;border:1px solid hsla(var(--h),80%,65%,.26);border-radius:18px;background:radial-gradient(circle at 75% 20%,hsla(var(--h),80%,65%,.2),transparent 38%),linear-gradient(145deg,hsl(var(--h) 36% 18%),#0d1120 72%);color:white;text-align:left;cursor:pointer;transition:.16s transform,.16s border-color}.tcg-booster:hover{transform:translateY(-3px);border-color:hsla(var(--h),90%,70%,.55)}.tcg-booster-icon{font-size:34px}.tcg-booster strong{display:block;margin-top:28px;font-size:16px}.tcg-booster small{display:block;margin-top:4px;color:#a8afc1;font-size:9px;line-height:1.4}.tcg-booster span{display:inline-block;margin-top:9px;padding:4px 7px;border-radius:999px;background:hsla(var(--h),80%,60%,.15);color:hsl(var(--h) 90% 78%);font-size:8px;font-weight:950}
    .tcg-open-stage{display:grid;gap:14px;padding:18px}.tcg-pack-big{--h:48;width:min(260px,72vw);aspect-ratio:.72;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid hsla(var(--h),85%,70%,.38);border-radius:22px;background:radial-gradient(circle at 50% 28%,hsla(var(--h),90%,70%,.3),transparent 28%),linear-gradient(145deg,hsl(var(--h) 40% 20%),#090c17);box-shadow:0 28px 70px rgba(0,0,0,.42),inset 0 0 60px rgba(255,255,255,.035)}.tcg-pack-big i{font-style:normal;font-size:58px}.tcg-pack-big strong{margin-top:18px;font-size:24px}.tcg-pack-big small{margin-top:4px;color:#9ca5ba}.tcg-open-btn,.tcg-primary,.tcg-secondary{border:0;border-radius:13px;padding:12px 16px;font-weight:1000;cursor:pointer}.tcg-open-btn,.tcg-primary{background:linear-gradient(135deg,#f6c554,#e38b34);color:#1a1207}.tcg-open-btn:disabled,.tcg-primary:disabled{opacity:.35;cursor:not-allowed}.tcg-secondary{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#e8ebf5}
    .tcg-reveal{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.tcg-card{--rarity:#8a94aa;position:relative;min-width:0;overflow:hidden;border:2px solid color-mix(in srgb,var(--rarity),transparent 18%);border-radius:16px;background:radial-gradient(circle at 50% 12%,color-mix(in srgb,var(--rarity),transparent 78%),transparent 34%),linear-gradient(180deg,#20263a,#0d1120 72%);box-shadow:0 15px 35px rgba(0,0,0,.28);color:#fff}.tcg-card[data-rarity="common"]{--rarity:#9ca4b4}.tcg-card[data-rarity="uncommon"]{--rarity:#5bd195}.tcg-card[data-rarity="rare"]{--rarity:#6ea7ff}.tcg-card[data-rarity="ultra"]{--rarity:#d46fff}.tcg-card[data-rarity="secret"]{--rarity:#ffd45f}.tcg-card.is-reveal{animation:tcgReveal .46s cubic-bezier(.2,.8,.2,1) both}.tcg-card:nth-child(2){animation-delay:.08s}.tcg-card:nth-child(3){animation-delay:.16s}.tcg-card:nth-child(4){animation-delay:.24s}.tcg-card:nth-child(5){animation-delay:.32s}
    .tcg-card-art{position:relative;aspect-ratio:1.08;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--rarity),#111 68%),#090b13)}.tcg-card-art img{width:100%;height:100%;object-fit:cover;object-position:center 22%;filter:saturate(.92) contrast(1.03)}.tcg-card-art .fallback{height:100%;display:grid;place-items:center;font-size:50px}.tcg-card-rarity{position:absolute;left:7px;top:7px;padding:4px 6px;border:1px solid color-mix(in srgb,var(--rarity),white 28%);border-radius:999px;background:rgba(7,9,16,.8);color:var(--rarity);font-size:7px;font-weight:1000}.tcg-card-cost{position:absolute;right:7px;top:7px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--rarity);color:#0c0d13;font-size:12px;font-weight:1000}.tcg-card-body{padding:9px}.tcg-card-name{display:block;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.tcg-card-type{margin-top:2px;color:var(--rarity);font-size:7px;font-weight:950;text-transform:uppercase}.tcg-card-stats{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.tcg-card-stats span{padding:6px;border-radius:8px;background:rgba(255,255,255,.04);color:#8c96ad;font-size:7px}.tcg-card-stats b{display:block;margin-top:1px;color:#fff;font-size:13px}.tcg-card-skill{min-height:38px;margin-top:7px;color:#838ca3;font-size:7px;line-height:1.35}.tcg-card-copy{position:absolute;right:7px;bottom:7px;padding:3px 5px;border-radius:7px;background:rgba(0,0,0,.55);font-size:8px;font-weight:950}
    .tcg-collection-toolbar{display:flex;gap:7px;flex-wrap:wrap}.tcg-collection-toolbar button{border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#11172a;color:#7e88a2;padding:7px 9px;font-size:9px;font-weight:900;cursor:pointer}.tcg-collection-toolbar button.active{border-color:#eab74d;color:#fff;background:#2c2416}.tcg-card-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.tcg-card-grid .tcg-card{cursor:pointer;transition:.14s transform,.14s filter}.tcg-card-grid .tcg-card:hover{transform:translateY(-3px);filter:brightness(1.06)}
    .tcg-deck-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:12px}.tcg-deck-list{display:grid;gap:7px}.tcg-deck-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:#101629}.tcg-deck-row .mini{width:38px;height:38px;display:grid;place-items:center;border-radius:9px;background:#181f35;font-weight:950}.tcg-deck-row strong{display:block;font-size:10px}.tcg-deck-row small{display:block;color:#76819a;font-size:8px}.tcg-deck-row button{border:0;border-radius:8px;background:#311b24;color:#ff9aab;padding:7px 8px;cursor:pointer}.tcg-deck-summary{padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:15px;background:#0d1222}.tcg-deck-summary h4{margin:0}.tcg-curve{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:11px}.tcg-curve div{text-align:center;padding:7px 3px;border-radius:8px;background:#141b2d}.tcg-curve b{display:block}.tcg-curve span{font-size:7px;color:#707b94}
    .tcg-duel{display:grid;gap:12px}.tcg-duel-board{position:relative;overflow:hidden;min-height:420px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:radial-gradient(circle at 50% 50%,rgba(103,73,184,.17),transparent 36%),linear-gradient(180deg,#151a31,#090c17)}.tcg-hp-row{display:flex;justify-content:space-between;gap:12px}.tcg-hp{width:44%;padding:9px;border-radius:11px;background:rgba(0,0,0,.28)}.tcg-hp header{display:flex;justify-content:space-between;font-size:9px;font-weight:900}.tcg-hp-track{height:7px;margin-top:5px;border-radius:999px;background:#272d42;overflow:hidden}.tcg-hp-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#ff625f,#ffb157);transition:width .25s ease}.tcg-battle-center{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;min-height:250px}.tcg-battle-slot{min-width:0}.tcg-battle-slot .tcg-card{width:min(190px,100%);margin:auto}.tcg-versus{font-size:18px;font-weight:1000;color:#6f7891}.tcg-battle-log{min-height:36px;padding:9px 11px;border-radius:11px;background:rgba(0,0,0,.25);color:#9da6ba;font-size:9px;text-align:center}.tcg-hand{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.tcg-hand .tcg-card{cursor:pointer;transition:.14s transform,.14s opacity}.tcg-hand .tcg-card:hover{transform:translateY(-4px)}.tcg-hand .tcg-card.is-locked{opacity:.34;cursor:not-allowed;filter:grayscale(.6)}.tcg-energy{text-align:center;color:#ffd66d;font-size:10px;font-weight:950}.tcg-duel-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
    .tcg-empty{padding:28px;text-align:center;color:#77829b}.tcg-empty b{display:block;color:#dce1ee;margin-bottom:5px}.tcg-error{margin:10px 0;padding:9px 11px;border:1px solid rgba(255,87,102,.24);border-radius:10px;background:rgba(111,28,37,.18);color:#ff9fac;font-size:9px}
    @keyframes tcgReveal{from{opacity:0;transform:translateY(22px) rotateY(80deg) scale(.9)}to{opacity:1;transform:none}}
    @media(max-width:900px){.tcg-booster-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.tcg-card-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.tcg-reveal{grid-template-columns:repeat(3,minmax(0,1fr))}.tcg-reveal .tcg-card:nth-child(4),.tcg-reveal .tcg-card:nth-child(5){grid-column:auto}.tcg-deck-layout{grid-template-columns:1fr}}
    @media(max-width:650px){.tcg-app{padding:8px}.tcg-top{flex-wrap:wrap}.tcg-top h1{font-size:19px}.tcg-athlete-select{order:5;width:100%}.tcg-hero{grid-template-columns:1fr;padding:13px}.tcg-hero h2{font-size:30px}.tcg-nav{grid-template-columns:repeat(2,1fr)}.tcg-booster-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-booster{min-height:160px}.tcg-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-reveal{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-reveal .tcg-card:last-child{grid-column:1/-1;width:50%;justify-self:center}.tcg-hand{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-battle-center{grid-template-columns:1fr 28px 1fr;gap:5px}.tcg-card-skill{display:none}.tcg-hp{width:48%}}
  `

  document.head.appendChild(
    style
  )
}

function renderCard(
  card,
  {
    copies = null,
    reveal = false,
    action = '',
    locked = false,
  } = {}
) {
  const image =
    imageSrc(
      card.athlete
    )

  return `
    <article
      class="tcg-card ${reveal ? 'is-reveal' : ''} ${locked ? 'is-locked' : ''}"
      data-rarity="${esc(card.rarity)}"
      ${action ? `data-action="${esc(action)}" data-card-id="${esc(card.id)}"` : ''}
    >
      <div class="tcg-card-art">
        ${image
          ? `
            <img
              src="${esc(image)}"
              alt=""
            >
          `
          : `
            <div class="fallback">
              ${esc(card.athlete?.emoji || '🏋️')}
            </div>
          `
        }

        <span class="tcg-card-rarity">
          ${esc(card.rarityMeta.label)}
        </span>

        <span class="tcg-card-cost">
          ${card.cost}
        </span>
      </div>

      <div class="tcg-card-body">
        <strong class="tcg-card-name">
          ${esc(card.athlete?.name || card.slug)}
        </strong>

        <div class="tcg-card-type">
          ${esc(card.archetype.icon)}
          ${esc(card.archetype.label)}
        </div>

        <div class="tcg-card-stats">
          <span>
            ATK
            <b>${card.attack}</b>
          </span>

          <span>
            DEF
            <b>${card.guard}</b>
          </span>
        </div>

        <div class="tcg-card-skill">
          ${esc(card.archetype.text)}
        </div>
      </div>

      ${copies !== null
        ? `
          <span class="tcg-card-copy">
            ×${Number(copies) || 0}
          </span>
        `
        : ''
      }
    </article>
  `
}

function shuffled(items) {
  const result =
    items.slice()

  for (
    let index =
      result.length - 1;
    index > 0;
    index -= 1
  ) {
    const j =
      Math.floor(
        randomPercent() /
          100 *
          (
            index + 1
          )
      )

    ;[
      result[index],
      result[j],
    ] = [
      result[j],
      result[index],
    ]
  }

  return result
}

function appliedStats(
  card,
  opponent
) {
  let attack =
    card.attack
  let guard =
    card.guard

  switch (
    card.archetype.id
  ) {
    case 'power':
      if (
        card.cost >=
        opponent.cost
      ) {
        attack += 2
      }
      break

    case 'guard':
      guard += 2
      break

    case 'tempo':
      if (
        card.cost <= 2
      ) {
        attack += 1
        guard += 1
      }
      break

    case 'technique':
      if (
        opponent.attack >
        opponent.guard
      ) {
        attack += 1
        guard += 1
      }
      break

    case 'chaos':
      attack +=
        Math.floor(
          randomPercent() /
            25
        ) - 1
      break
  }

  return {
    attack:
      Math.max(
        0,
        attack
      ),
    guard:
      Math.max(
        0,
        guard
      ),
  }
}

function autoDeck(
  collection,
  catalog
) {
  const pool = []

  for (
    const row
    of collection
  ) {
    const card =
      catalog.get(
        row.card_id
      )

    if (!card) {
      continue
    }

    const count =
      Math.min(
        MAX_COPY_IN_DECK,
        Number(
          row.copies
        ) || 0
      )

    for (
      let i = 0;
      i < count;
      i += 1
    ) {
      pool.push(
        card
      )
    }
  }

  pool.sort(
    (a, b) =>
      b.score -
      a.score
  )

  const chosen = []
  const costCount =
    new Map()

  for (
    const card
    of pool
  ) {
    if (
      chosen.length >=
      DECK_SIZE
    ) {
      break
    }

    const sameCost =
      costCount.get(
        card.cost
      ) || 0

    if (
      card.cost >= 4 &&
      sameCost >= 4
    ) {
      continue
    }

    chosen.push(
      card.id
    )

    costCount.set(
      card.cost,
      sameCost + 1
    )
  }

  if (
    chosen.length <
      DECK_SIZE
  ) {
    for (
      const card
      of pool
    ) {
      if (
        chosen.length >=
        DECK_SIZE
      ) {
        break
      }

      const inDeck =
        chosen.filter(
          id =>
            id ===
            card.id
        ).length

      if (
        inDeck <
          MAX_COPY_IN_DECK
      ) {
        chosen.push(
          card.id
        )
      }
    }
  }

  return chosen
}

function buildAiDeck(
  athletes,
  playerCards
) {
  const avgRank =
    playerCards.length
      ? playerCards.reduce(
          (
            sum,
            card
          ) =>
            sum +
            card.rarityMeta.rank,
          0
        ) /
        playerCards.length
      : 1.6

  const rarityPool =
    avgRank >= 3.5
      ? [
          'uncommon',
          'rare',
          'rare',
          'ultra',
        ]
      : avgRank >= 2.4
        ? [
            'common',
            'uncommon',
            'uncommon',
            'rare',
          ]
        : [
            'common',
            'common',
            'uncommon',
            'rare',
          ]

  return Array.from(
    {
      length: DECK_SIZE,
    },
    () =>
      buildCard(
        randomItem(
          athletes
        ),
        randomItem(
          rarityPool
        )
      )
  )
}

export async function mountTcgGame(
  root,
  options = {}
) {
  ensureStyles()

  const athletes =
    Array.isArray(
      options.athletes
    )
      ? options.athletes
      : []

  const catalog =
    catalogForAthletes(
      athletes
    )

  const boosters =
    boosterCatalog(
      athletes
    )

  let activeSlug =
    String(
      options.initialSlug ||
      options.preferredSlug ||
      athleteSlug(
        athletes[0]
      ) ||
      ''
    ).toLowerCase()

  let tab = 'boosters'
  let selectedBooster =
    boosters[0] || null
  let profile = {
    unopened_packs: 0,
    opened_packs: 0,
    dust: 0,
  }
  let collection = []
  let deck = []
  let loading = true
  let error = ''
  let lastOpened = []
  let rarityFilter = 'all'
  let battle = null

  function currentAthlete() {
    return (
      athletes.find(
        athlete =>
          athleteSlug(
            athlete
          ) ===
          activeSlug
      ) ||
      athletes[0] ||
      null
    )
  }

  function ownedRows() {
    return collection
      .map(
        row => ({
          ...row,
          card:
            catalog.get(
              row.card_id
            ),
        })
      )
      .filter(
        row =>
          row.card
      )
  }

  function uniqueOwned() {
    return ownedRows()
      .length
  }

  function totalCopies() {
    return ownedRows()
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          (
            Number(
              row.copies
            ) || 0
          ),
        0
      )
  }

  function deckCards() {
    return deck
      .map(
        id =>
          catalog.get(id)
      )
      .filter(Boolean)
  }

  async function loadState() {
    if (!activeSlug) {
      loading = false
      render()
      return
    }

    loading = true
    error = ''
    battle = null
    lastOpened = []
    render()

    try {
      const [
        profileResult,
        collectionResult,
        deckResult,
      ] =
        await Promise.all([
          supabase.rpc(
            'ensure_tcg_profile_v1',
            {
              p_athlete_slug:
                activeSlug,
            }
          ),
          supabase
            .from(
              'tcg_collection'
            )
            .select(
              'card_id,copies,first_pulled_at,last_pulled_at'
            )
            .eq(
              'athlete_slug',
              activeSlug
            ),
          supabase
            .from(
              'tcg_decks'
            )
            .select(
              'deck'
            )
            .eq(
              'athlete_slug',
              activeSlug
            )
            .maybeSingle(),
        ])

      if (
        profileResult.error
      ) {
        throw profileResult.error
      }

      if (
        collectionResult.error
      ) {
        throw collectionResult.error
      }

      if (
        deckResult.error
      ) {
        throw deckResult.error
      }

      const row =
        Array.isArray(
          profileResult.data
        )
          ? profileResult.data[0]
          : profileResult.data

      profile = {
        unopened_packs:
          Number(
            row?.unopened_packs ||
            0
          ),
        opened_packs:
          Number(
            row?.opened_packs ||
            0
          ),
        dust:
          Number(
            row?.dust ||
            0
          ),
      }

      collection =
        collectionResult.data ||
        []

      deck =
        Array.isArray(
          deckResult.data?.deck
        )
          ? deckResult.data.deck
          : []

      if (
        deck.length !==
          DECK_SIZE &&
        collection.length
      ) {
        deck =
          autoDeck(
            collection,
            catalog
          )
      }
    } catch (loadError) {
      console.error(
        'TCG LOAD ERROR',
        loadError
      )

      error =
        loadError?.message ||
        'Impossible de charger le TCG.'
    } finally {
      loading = false
      render()
    }
  }

  async function refreshProfileAndCollection() {
    const [
      p,
      c,
    ] =
      await Promise.all([
        supabase
          .from(
            'tcg_profiles'
          )
          .select(
            'unopened_packs,opened_packs,dust'
          )
          .eq(
            'athlete_slug',
            activeSlug
          )
          .single(),
        supabase
          .from(
            'tcg_collection'
          )
          .select(
            'card_id,copies,first_pulled_at,last_pulled_at'
          )
          .eq(
            'athlete_slug',
            activeSlug
          ),
      ])

    if (p.error) {
      throw p.error
    }

    if (c.error) {
      throw c.error
    }

    profile =
      p.data

    collection =
      c.data ||
      []
  }

  async function openPack() {
    if (
      !selectedBooster ||
      Number(
        profile.unopened_packs
      ) <= 0
    ) {
      return
    }

    error = ''

    const nextOpening =
      Number(
        profile.opened_packs ||
        0
      ) + 1

    const cards =
      drawBooster({
        booster:
          selectedBooster,
        athletes,
        openingNumber:
          nextOpening,
      })

    const {
      data,
      error:
        openError,
    } =
      await supabase.rpc(
        'open_tcg_pack_v1',
        {
          p_athlete_slug:
            activeSlug,
          p_booster_id:
            selectedBooster.id,
          p_cards:
            cards.map(
              card => ({
                card_id:
                  card.id,
                rarity:
                  card.rarity,
              })
            ),
        }
      )

    if (openError) {
      error =
        openError.message
      render()
      return
    }

    lastOpened =
      cards

    const result =
      Array.isArray(data)
        ? data[0]
        : data

    profile.unopened_packs =
      Number(
        result?.remaining_packs ??
        Math.max(
          0,
          Number(
            profile.unopened_packs
          ) - 1
        )
      )

    profile.opened_packs =
      nextOpening

    await refreshProfileAndCollection()
    render()
  }

  async function saveDeck() {
    error = ''

    if (
      deck.length !==
        DECK_SIZE
    ) {
      error =
        `Le deck doit contenir exactement ${DECK_SIZE} cartes.`
      render()
      return
    }

    const {
      error:
        saveError,
    } =
      await supabase
        .from(
          'tcg_decks'
        )
        .upsert(
          {
            athlete_slug:
              activeSlug,
            deck,
            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              'athlete_slug',
          }
        )

    if (saveError) {
      error =
        saveError.message
    }

    render()
  }

  function copiesInDeck(
    cardIdValue
  ) {
    return deck.filter(
      id =>
        id ===
        cardIdValue
    ).length
  }

  function ownedCopies(
    cardIdValue
  ) {
    return Number(
      collection.find(
        row =>
          row.card_id ===
          cardIdValue
      )?.copies ||
      0
    )
  }

  function addToDeck(
    cardIdValue
  ) {
    if (
      deck.length >=
        DECK_SIZE
    ) {
      return
    }

    const already =
      copiesInDeck(
        cardIdValue
      )

    const owned =
      ownedCopies(
        cardIdValue
      )

    if (
      already >=
        MAX_COPY_IN_DECK ||
      already >= owned
    ) {
      return
    }

    deck = [
      ...deck,
      cardIdValue,
    ]

    render()
  }

  function removeFromDeck(
    cardIdValue
  ) {
    const index =
      deck.lastIndexOf(
        cardIdValue
      )

    if (index < 0) {
      return
    }

    deck = [
      ...deck.slice(
        0,
        index
      ),
      ...deck.slice(
        index + 1
      ),
    ]

    render()
  }

  function beginBattle() {
    let ids =
      deck.slice()

    if (
      ids.length !==
        DECK_SIZE
    ) {
      ids =
        autoDeck(
          collection,
          catalog
        )
    }

    if (
      ids.length <
        DECK_SIZE
    ) {
      error =
        'Il faut au moins 12 cartes disponibles pour lancer un duel.'
      render()
      return
    }

    const playerDeck =
      shuffled(
        ids
          .map(
            id =>
              catalog.get(id)
          )
          .filter(Boolean)
      )

    const aiDeck =
      shuffled(
        buildAiDeck(
          athletes,
          playerDeck
        )
      )

    battle = {
      playerHp:
        START_HP,
      aiHp:
        START_HP,
      turn: 1,
      energy: 1,
      playerDeck,
      aiDeck,
      playerHand:
        playerDeck.splice(
          0,
          4
        ),
      aiHand:
        aiDeck.splice(
          0,
          4
        ),
      playerCard: null,
      aiCard: null,
      log:
        'Choisis une carte pour le premier duel.',
      finished: false,
      result: '',
    }

    error = ''
    render()
  }

  async function persistBattle(
    result
  ) {
    try {
      await supabase
        .from(
          'tcg_battles'
        )
        .insert({
          athlete_slug:
            activeSlug,
          result,
          opponent:
            'GA Rival AI',
          turns:
            battle?.turn ||
            0,
          player_hp:
            battle?.playerHp ||
            0,
          opponent_hp:
            battle?.aiHp ||
            0,
        })
    } catch (battleError) {
      console.error(
        'TCG BATTLE SAVE ERROR',
        battleError
      )
    }
  }

  function finishBattle() {
    if (!battle) {
      return
    }

    let result = 'draw'

    if (
      battle.playerHp >
      battle.aiHp
    ) {
      result = 'win'
    } else if (
      battle.aiHp >
      battle.playerHp
    ) {
      result = 'loss'
    }

    battle.finished = true
    battle.result = result
    battle.log =
      result === 'win'
        ? 'VICTOIRE · ton deck prend le dessus.'
        : result === 'loss'
          ? 'DÉFAITE · ajuste ta courbe de coût et tes matchups.'
          : 'ÉGALITÉ · duel parfaitement serré.'

    void persistBattle(
      result
    )
  }

  function playBattleCard(
    cardIdValue
  ) {
    if (
      !battle ||
      battle.finished
    ) {
      return
    }

    const playerIndex =
      battle.playerHand
        .findIndex(
          card =>
            card.id ===
            cardIdValue
        )

    const playerCard =
      battle.playerHand[
        playerIndex
      ]

    if (
      !playerCard ||
      playerCard.cost >
        battle.energy
    ) {
      return
    }

    const affordableAi =
      battle.aiHand
        .filter(
          card =>
            card.cost <=
            battle.energy
        )
        .sort(
          (a, b) =>
            (
              b.attack +
              b.guard * .8
            ) -
            (
              a.attack +
              a.guard * .8
            )
        )

    const aiCard =
      affordableAi[0] ||
      battle.aiHand
        .slice()
        .sort(
          (a, b) =>
            a.cost -
            b.cost
        )[0]

    if (!aiCard) {
      finishBattle()
      render()
      return
    }

    const aiIndex =
      battle.aiHand
        .findIndex(
          card =>
            card === aiCard
        )

    const playerStats =
      appliedStats(
        playerCard,
        aiCard
      )

    const aiStats =
      appliedStats(
        aiCard,
        playerCard
      )

    let damageToAi =
      Math.max(
        0,
        playerStats.attack -
        aiStats.guard
      )

    let damageToPlayer =
      Math.max(
        0,
        aiStats.attack -
        playerStats.guard
      )

    if (
      damageToAi === 0 &&
      damageToPlayer === 0
    ) {
      if (
        playerStats.attack >
        aiStats.attack
      ) {
        damageToAi = 1
      } else if (
        aiStats.attack >
        playerStats.attack
      ) {
        damageToPlayer = 1
      }
    }

    battle.playerHp =
      Math.max(
        0,
        battle.playerHp -
        damageToPlayer
      )

    battle.aiHp =
      Math.max(
        0,
        battle.aiHp -
        damageToAi
      )

    battle.playerCard =
      playerCard

    battle.aiCard =
      aiCard

    battle.playerHand.splice(
      playerIndex,
      1
    )

    battle.aiHand.splice(
      aiIndex,
      1
    )

    battle.log =
      `${playerCard.athlete.name} inflige ${damageToAi} · ${aiCard.athlete.name} inflige ${damageToPlayer}.`

    if (
      battle.playerHp <= 0 ||
      battle.aiHp <= 0
    ) {
      finishBattle()
      render()
      return
    }

    if (
      battle.turn >=
        MAX_TURNS ||
      (
        !battle.playerDeck.length &&
        !battle.playerHand.length
      )
    ) {
      finishBattle()
      render()
      return
    }

    battle.turn += 1
    battle.energy =
      Math.min(
        5,
        battle.turn
      )

    if (
      battle.playerDeck.length
    ) {
      battle.playerHand.push(
        battle.playerDeck.shift()
      )
    }

    if (
      battle.aiDeck.length
    ) {
      battle.aiHand.push(
        battle.aiDeck.shift()
      )
    }

    render()
  }

  function renderBoosters() {
    if (lastOpened.length) {
      return `
        <section class="tcg-panel">
          <header class="tcg-panel-head">
            <div>
              <h3>
                Booster ouvert · ${esc(selectedBooster?.name || '')}
              </h3>
              <p>
                5 cartes ajoutées à ta collection.
              </p>
            </div>

            <button
              class="tcg-secondary"
              data-action="tcg-close-reveal"
              type="button"
            >
              Fermer
            </button>
          </header>

          <div class="tcg-panel-pad">
            <div class="tcg-reveal">
              ${lastOpened
                .map(
                  card =>
                    renderCard(
                      card,
                      {
                        reveal: true,
                      }
                    )
                )
                .join('')}
            </div>
          </div>
        </section>
      `
    }

    return `
      <section class="tcg-panel">
        <header class="tcg-panel-head">
          <div>
            <h3>
              20 boosters GA
            </h3>
            <p>
              Même taux de rareté · pool vedette différent pour chaque série.
            </p>
          </div>

          <strong>
            🎴 ${Number(profile.unopened_packs) || 0}
          </strong>
        </header>

        <div class="tcg-panel-pad">
          <div class="tcg-booster-grid">
            ${boosters
              .map(
                booster => `
                  <button
                    class="tcg-booster"
                    style="--h:${booster.hue}"
                    data-action="tcg-select-booster"
                    data-booster-id="${esc(booster.id)}"
                    type="button"
                  >
                    <span class="tcg-booster-icon">
                      ${esc(booster.icon)}
                    </span>

                    <strong>
                      ${esc(booster.name)}
                    </strong>

                    <small>
                      ${booster.featured
                        .slice(0, 3)
                        .map(
                          athlete =>
                            esc(
                              athlete.name
                            )
                        )
                        .join(' · ') ||
                        'Pool mixte'
                      }
                    </small>

                    <span>
                      OUVRIR
                    </span>
                  </button>
                `
              )
              .join('')}
          </div>
        </div>
      </section>

      ${selectedBooster
        ? `
          <section class="tcg-panel" style="margin-top:12px">
            <div class="tcg-open-stage">
              <div
                class="tcg-pack-big"
                style="--h:${selectedBooster.hue}"
              >
                <i>
                  ${esc(selectedBooster.icon)}
                </i>

                <strong>
                  ${esc(selectedBooster.name)}
                </strong>

                <small>
                  5 cartes · slot final premium
                </small>
              </div>

              <button
                class="tcg-open-btn"
                data-action="tcg-open-pack"
                type="button"
                ${Number(profile.unopened_packs) > 0 ? '' : 'disabled'}
              >
                ${Number(profile.unopened_packs) > 0
                  ? 'OUVRIR LE BOOSTER'
                  : 'TERMINE UNE SÉANCE POUR GAGNER UN BOOSTER'
                }
              </button>

              <p style="margin:0;text-align:center;color:#737d96;font-size:9px">
                Pity : Ultra Rare garantie tous les 10 boosters · Secret Rare au 50e.
              </p>
            </div>
          </section>
        `
        : ''
      }
    `
  }

  function renderCollection() {
    const rows =
      ownedRows()
        .filter(
          row =>
            rarityFilter ===
              'all' ||
            row.card.rarity ===
              rarityFilter
        )
        .sort(
          (a, b) =>
            b.card.rarityMeta.rank -
              a.card.rarityMeta.rank ||
            a.card.athlete.name.localeCompare(
              b.card.athlete.name,
              'fr'
            )
        )

    return `
      <section class="tcg-panel">
        <header class="tcg-panel-head">
          <div>
            <h3>
              Collection
            </h3>
            <p>
              Chaque athlète existe en 5 raretés avec un coût et des stats équilibrés.
            </p>
          </div>

          <strong>
            ${uniqueOwned()} / ${catalog.size}
          </strong>
        </header>

        <div class="tcg-panel-pad">
          <div class="tcg-collection-toolbar">
            ${[
              ['all', 'Toutes'],
              ['common', 'Communes'],
              ['uncommon', 'Peu communes'],
              ['rare', 'Rares'],
              ['ultra', 'Ultra'],
              ['secret', 'Secret'],
            ]
              .map(
                ([id, label]) => `
                  <button
                    class="${rarityFilter === id ? 'active' : ''}"
                    data-action="tcg-rarity-filter"
                    data-rarity="${id}"
                    type="button"
                  >
                    ${label}
                  </button>
                `
              )
              .join('')}
          </div>

          <div
            class="tcg-card-grid"
            style="margin-top:12px"
          >
            ${rows.length
              ? rows
                  .map(
                    row =>
                      renderCard(
                        row.card,
                        {
                          copies:
                            row.copies,
                          action:
                            'tcg-add-card',
                        }
                      )
                  )
                  .join('')
              : `
                <div class="tcg-empty" style="grid-column:1/-1">
                  <b>Aucune carte ici.</b>
                  Ouvre des boosters pour compléter ta collection.
                </div>
              `
            }
          </div>
        </div>
      </section>
    `
  }

  function renderDeck() {
    const cards =
      deckCards()

    const curve =
      Array.from(
        {
          length: 5,
        },
        (_, index) =>
          cards.filter(
            card =>
              card.cost ===
              index + 1
          ).length
      )

    return `
      <section class="tcg-panel">
        <header class="tcg-panel-head">
          <div>
            <h3>
              Deck · ${deck.length}/${DECK_SIZE}
            </h3>
            <p>
              Maximum ${MAX_COPY_IN_DECK} copies d’une même carte.
            </p>
          </div>

          <div>
            <button
              class="tcg-secondary"
              data-action="tcg-auto-deck"
              type="button"
            >
              Auto
            </button>

            <button
              class="tcg-primary"
              data-action="tcg-save-deck"
              type="button"
              ${deck.length === DECK_SIZE ? '' : 'disabled'}
            >
              Sauver
            </button>
          </div>
        </header>

        <div class="tcg-panel-pad tcg-deck-layout">
          <div class="tcg-deck-list">
            ${cards.length
              ? cards
                  .map(
                    card => `
                      <article class="tcg-deck-row">
                        <div class="mini">
                          ${esc(card.rarityMeta.short)}
                        </div>

                        <div>
                          <strong>
                            ${esc(card.athlete.name)}
                          </strong>

                          <small>
                            ${esc(card.archetype.label)}
                            · coût ${card.cost}
                            · ${card.attack}/${card.guard}
                          </small>
                        </div>

                        <button
                          data-action="tcg-remove-card"
                          data-card-id="${esc(card.id)}"
                          type="button"
                        >
                          −
                        </button>
                      </article>
                    `
                  )
                  .join('')
              : `
                <div class="tcg-empty">
                  <b>Deck vide.</b>
                  Clique sur des cartes dans Collection ou utilise Auto.
                </div>
              `
            }
          </div>

          <aside class="tcg-deck-summary">
            <h4>
              Courbe d’énergie
            </h4>

            <div class="tcg-curve">
              ${curve
                .map(
                  (
                    value,
                    index
                  ) => `
                    <div>
                      <b>${value}</b>
                      <span>
                        coût ${index + 1}
                      </span>
                    </div>
                  `
                )
                .join('')}
            </div>

            <p style="color:#79849c;font-size:9px;line-height:1.55">
              Un deck régulier évite les mains injouables. Les Ultra et Secret ont plus de budget de stats mais demandent davantage d’énergie.
            </p>
          </aside>
        </div>
      </section>
    `
  }

  function renderDuel() {
    if (!battle) {
      return `
        <section class="tcg-panel">
          <div class="tcg-panel-pad tcg-duel">
            <div class="tcg-empty">
              <b>
                Duel TCG · 24 PV
              </b>

              12 cartes · énergie 1→5 · un affrontement de cartes par tour.
              Le coût compense la puissance des raretés élevées.
            </div>

            <div class="tcg-duel-actions">
              <button
                class="tcg-primary"
                data-action="tcg-start-duel"
                type="button"
                ${ownedRows().reduce((sum,row)=>sum+Math.min(Number(row.copies)||0,MAX_COPY_IN_DECK),0) >= DECK_SIZE ? '' : 'disabled'}
              >
                LANCER UN DUEL
              </button>
            </div>
          </div>
        </section>
      `
    }

    return `
      <section class="tcg-panel">
        <div class="tcg-panel-pad tcg-duel">
          <div class="tcg-energy">
            TOUR ${battle.turn} · ÉNERGIE ${battle.energy}/5
          </div>

          <div class="tcg-duel-board">
            <div class="tcg-hp-row">
              <div class="tcg-hp">
                <header>
                  <span>
                    ${esc(currentAthlete()?.name || 'Toi')}
                  </span>
                  <b>
                    ${battle.playerHp} PV
                  </b>
                </header>

                <div class="tcg-hp-track">
                  <i style="width:${Math.max(0,battle.playerHp/START_HP*100)}%"></i>
                </div>
              </div>

              <div class="tcg-hp">
                <header>
                  <span>
                    GA Rival
                  </span>
                  <b>
                    ${battle.aiHp} PV
                  </b>
                </header>

                <div class="tcg-hp-track">
                  <i style="width:${Math.max(0,battle.aiHp/START_HP*100)}%"></i>
                </div>
              </div>
            </div>

            <div class="tcg-battle-center">
              <div class="tcg-battle-slot">
                ${battle.playerCard
                  ? renderCard(
                      battle.playerCard
                    )
                  : ''
                }
              </div>

              <div class="tcg-versus">
                VS
              </div>

              <div class="tcg-battle-slot">
                ${battle.aiCard
                  ? renderCard(
                      battle.aiCard
                    )
                  : ''
                }
              </div>
            </div>

            <div class="tcg-battle-log">
              ${esc(battle.log)}
            </div>
          </div>

          ${battle.finished
            ? `
              <div class="tcg-duel-actions">
                <button
                  class="tcg-primary"
                  data-action="tcg-start-duel"
                  type="button"
                >
                  REVANCHE
                </button>
              </div>
            `
            : `
              <div class="tcg-hand">
                ${battle.playerHand
                  .map(
                    card =>
                      renderCard(
                        card,
                        {
                          action:
                            'tcg-play-card',
                          locked:
                            card.cost >
                            battle.energy,
                        }
                      )
                  )
                  .join('')}
              </div>
            `
          }
        </div>
      </section>
    `
  }

  function render() {
    const athlete =
      currentAthlete()

    root.innerHTML = `
      <main class="tcg-app">
        <div class="tcg-shell">
          <header class="tcg-top">
            <button
              class="tcg-back"
              data-action="tcg-back"
              type="button"
            >
              ← Arcade
            </button>

            <div>
              <small>
                GA COACHING · TCG
              </small>

              <h1>
                GA Trading Card Game
              </h1>
            </div>

            <div class="tcg-spacer"></div>

            ${options.allowAthleteSelection
              ? `
                <select
                  class="tcg-athlete-select"
                  data-action="tcg-athlete"
                >
                  ${athletes
                    .map(
                      item => {
                        const slug =
                          athleteSlug(
                            item
                          )

                        return `
                          <option
                            value="${esc(slug)}"
                            ${slug === activeSlug ? 'selected' : ''}
                          >
                            ${esc(item.name)}
                          </option>
                        `
                      }
                    )
                    .join('')}
                </select>
              `
              : ''
            }

            <div class="tcg-chip">
              🎴
              <b>
                ${Number(profile.unopened_packs) || 0}
              </b>
            </div>
          </header>

          <section class="tcg-hero">
            <div>
              <span class="tcg-kicker">
                ENTRAÎNE-TOI · OUVRE · COLLECTIONNE · JOUE
              </span>

              <h2>
                Les athlètes deviennent des cartes.
              </h2>

              <p>
                Une séance terminée = un booster gagné. Chaque personne possède cinq versions, de Commune à Secret Rare. Les cartes rares gagnent du budget de stats, mais leur coût d’énergie augmente pour garder les duels équilibrés.
              </p>
            </div>

            <div class="tcg-hero-stats">
              <div class="tcg-hero-stat">
                <span>Booster(s)</span>
                <b><em>${Number(profile.unopened_packs) || 0}</em></b>
              </div>

              <div class="tcg-hero-stat">
                <span>Ouverts</span>
                <b>${Number(profile.opened_packs) || 0}</b>
              </div>

              <div class="tcg-hero-stat">
                <span>Cartes uniques</span>
                <b>${uniqueOwned()}</b>
              </div>

              <div class="tcg-hero-stat">
                <span>Copies</span>
                <b>${totalCopies()}</b>
              </div>
            </div>
          </section>

          <nav class="tcg-nav">
            ${[
              ['boosters','🎴 Boosters'],
              ['collection','✦ Collection'],
              ['deck','▦ Deck'],
              ['duel','⚔ Duel'],
            ]
              .map(
                ([id,label]) => `
                  <button
                    class="${tab === id ? 'active' : ''}"
                    data-action="tcg-tab"
                    data-tab="${id}"
                    type="button"
                  >
                    ${label}
                  </button>
                `
              )
              .join('')}
          </nav>

          ${error
            ? `
              <div class="tcg-error">
                ${esc(error)}
              </div>
            `
            : ''
          }

          ${loading
            ? `
              <section class="tcg-panel">
                <div class="tcg-empty">
                  <b>Chargement du TCG…</b>
                </div>
              </section>
            `
            : tab === 'boosters'
              ? renderBoosters()
              : tab === 'collection'
                ? renderCollection()
                : tab === 'deck'
                  ? renderDeck()
                  : renderDuel()
          }
        </div>
      </main>
    `
  }

  root.onclick =
    async event => {
      const action =
        event.target.closest(
          '[data-action]'
        )

      if (!action) {
        return
      }

      switch (
        action.dataset.action
      ) {
        case 'tcg-back':
          options.onBack?.()
          return

        case 'tcg-tab':
          tab =
            action.dataset.tab ||
            'boosters'
          error = ''
          render()
          return

        case 'tcg-select-booster':
          selectedBooster =
            boosters.find(
              booster =>
                booster.id ===
                action.dataset.boosterId
            ) ||
            selectedBooster
          render()
          return

        case 'tcg-open-pack':
          await openPack()
          return

        case 'tcg-close-reveal':
          lastOpened = []
          render()
          return

        case 'tcg-rarity-filter':
          rarityFilter =
            action.dataset.rarity ||
            'all'
          render()
          return

        case 'tcg-add-card':
          addToDeck(
            action.dataset.cardId
          )
          return

        case 'tcg-remove-card':
          removeFromDeck(
            action.dataset.cardId
          )
          return

        case 'tcg-auto-deck':
          deck =
            autoDeck(
              collection,
              catalog
            )
          render()
          return

        case 'tcg-save-deck':
          await saveDeck()
          return

        case 'tcg-start-duel':
          beginBattle()
          return

        case 'tcg-play-card':
          playBattleCard(
            action.dataset.cardId
          )
          return
      }
    }

  root.onchange =
    event => {
      const input =
        event.target

      if (
        input.dataset.action ===
          'tcg-athlete'
      ) {
        activeSlug =
          String(
            input.value ||
            ''
          ).toLowerCase()

        void loadState()
      }
    }

  render()
  await loadState()
}
