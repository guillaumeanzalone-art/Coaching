import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PACK_IDENTITY, SLOT_ODDS, rollSlotRarity, drawThemedBooster } from '../src/tcg-pack-rules.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const slugOf = athlete => athlete.slug
const athletes = [...new Set(Object.values(PACK_IDENTITY).flatMap(pack => pack.pool))].map(slug => ({ slug, name:slug }))
const buildCard = (athlete, rarity) => ({ id:athlete.slug + ':' + rarity, slug:athlete.slug, rarity })
const packFor = id => ({ id, poolSlugs: PACK_IDENTITY[id].pool, leadSlug: PACK_IDENTITY[id].lead, secretOnly:PACK_IDENTITY[id].secretOnly })
const draw = (id, openingNumber, ratio=.75) => drawThemedBooster({
  booster:packFor(id), athletes, openingNumber, slugOf, buildCard, random:() => ratio,
})

test('20 identifiable pack themes exist with one matching SVG icon each', () => {
  assert.equal(Object.keys(PACK_IDENTITY).length,20)
  const svg = read('../public/tcg/pack-icons.svg')
  for (const [id, pack] of Object.entries(PACK_IDENTITY)) {
    assert.ok(pack.pool.includes(pack.lead), id + ' must feature its lead athlete')
    assert.match(svg,new RegExp('<symbol id="' + pack.sigil + '"'))
  }
  assert.equal(PACK_IDENTITY.crown.name,'Serena')
  assert.equal(PACK_IDENTITY.crown.secretOnly,'serena')
  assert.equal(PACK_IDENTITY.crown.sigil,'crown')
})

test('five explicit slot probability tables each total exactly 100%', () => {
  assert.equal(SLOT_ODDS.length,5)
  for (const odds of SLOT_ODDS) {
    assert.equal(Object.values(odds).reduce((sum, probability) => sum + probability, 0),100)
    assert.ok(Object.values(odds).every(value => value >= 0))
  }
  assert.deepEqual(SLOT_ODDS[4],{rare:88,ultra:10,secret:2})
  assert.equal(rollSlotRarity(4,1,() => .9799),'ultra')
  assert.equal(rollSlotRarity(4,1,() => .9999),'secret')
})

test('pity protects opening 10 with ultra and opening 50 with secret', () => {
  assert.equal(rollSlotRarity(4,10,() => .1),'ultra')
  assert.equal(rollSlotRarity(4,50,() => .1),'secret')
  assert.equal(draw('crown',10)[4].rarity,'ultra')
  assert.equal(draw('crown',50)[4].id,'serena:secret')
})

test('Serena Divine is exclusive to Pack Serena, including the non-premium secret slot', () => {
  const forcedSecret = () => .9999
  for (const id of Object.keys(PACK_IDENTITY)) {
    const cards = drawThemedBooster({
      booster: packFor(id), athletes, openingNumber:1, slugOf, buildCard, random:forcedSecret,
    })
    assert.equal(cards.length,5)
    assert.ok(cards.every(card => PACK_IDENTITY[id].pool.includes(card.slug)))
    if (id === 'crown') {
      assert.ok(cards.some(card => card.id === 'serena:secret'))
      assert.ok(cards.filter(card => card.rarity === 'secret').every(card => card.slug === 'serena'))
    } else {
      assert.ok(!cards.some(card => card.id === 'serena:secret'), id)
    }
  }
})

test('five-card boosters never repeat the same rarity and athlete while alternatives exist', () => {
  for (const id of Object.keys(PACK_IDENTITY)) {
    const cards = draw(id,1)
    assert.equal(cards.length,5,id)
    assert.equal(new Set(cards.map(card => card.id)).size,5,id)
  }
})

test('the shared card renderer preserves native sprite geometry instead of stretching square art', () => {
  const game = read('../src/tcg-game.js')
  const quality = read('../src/tcg-art-quality.css')
  assert.match(game,/SQUARE_SPRITE_PANELS = new Set\(\['charles', 'celia', 'hugo', 'magicarpe'\]\)/)
  assert.match(game,/viewBox="\$\{dedicatedArt\.index\} 0 1 \$\{dedicatedArt\.panelHeight\}"/)
  assert.match(game,/preserveAspectRatio="xMidYMid slice"/)
  assert.match(game,/tcg-illustration-svg tcg-illustration-primary/)
  assert.match(game,/tcg-illustration-svg tcg-illustration-backdrop/)
  assert.match(game,/panelHeight === 1 \? 'meet' : 'slice'/)
  assert.match(quality,/filter:blur\(13px\)/)
  assert.match(quality,/background-image:none!important/)
  assert.match(game,/serena-turquoise-sovereign-mobile\.webp/)
  assert.match(game,/SERENA DIVINE/)
  assert.match(game,/if \(card\?\.slug === 'guillaume'\) return null/)
})
