import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const game = readFileSync(new URL('../src/tcg-game.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/tcg-supplied-evolutions.css', import.meta.url), 'utf8')
const rarities = ['common', 'uncommon', 'rare', 'ultra', 'secret']
const supplied = [
  { slug: 'lou', width: 4160, height: 1256, focus: 'Dragonne impériale' },
  { slug: 'flop', width: 4240, height: 1264, focus: 'Maître du casino' },
  { slug: 'duane', width: 5120, height: 1024, focus: 'Prédateur cybernétique' },
  { slug: 'serena', width: 4960, height: 1059, focus: 'Divine des glaces' },
]

test('All 20 original artworks are stored in four valid lossily encoded HD WebP strips', () => {
  for (const { slug, width, height } of supplied) {
    const data = readFileSync(new URL('../public/tcg/' + slug + '-evolutions.webp', import.meta.url))
    assert.ok(data.length > 1_000_000, 'HD image truncated: ' + slug)
    assert.equal(data.toString('ascii', 0, 4), 'RIFF')
    assert.equal(data.toString('ascii', 8, 12), 'WEBP')
    assert.equal(data.toString('ascii', 12, 16), 'VP8 ')
    assert.equal(data.readUInt32LE(4) + 8, data.length)
    assert.equal(data.readUInt16LE(26) & 0x3fff, width, slug + ' width')
    assert.equal(data.readUInt16LE(28) & 0x3fff, height, slug + ' height')
  }
})

test('Four character sprites preserve user order from common to secret', () => {
  for (const { slug } of supplied) {
    const match = game.match(new RegExp('\\b' + slug + ':\\s*\\{\\s*sprite: \'/tcg/' +
      slug + '-evolutions\\.webp\',\\s*rarityIndex:\\s*\\{([^}]+)\\}'))
    assert.ok(match, 'No artwork registered for ' + slug)
    const found = [...match[1].matchAll(/(common|uncommon|rare|ultra|secret):\s*([0-4])/g)]
    assert.deepEqual(found.map(m => m[1]), rarities)
    assert.deepEqual(found.map(m => Number(m[2])), [0, 1, 2, 3, 4])
    assert.match(game, /tcg-card--evo tcg-evo--/)
    assert.match(css, new RegExp('tcg-evo--' + slug))
    assert.match(game, new RegExp('tcg-evo-gallery--\\$\\{esc\\(slug\\)\\}'))
  }
})

test('Duane and Serena retain original non-2:3 geometry without stretching', () => {
  assert.match(game, /SQUARE_SPRITE_PANELS = new Set\(\['charles', 'celia', 'hugo', 'magicarpe', 'duane'\]\)/)
  assert.match(game, /duane:\s*1024 \/ 1024/)
  assert.match(game, /serena:\s*1059 \/ 992/)
  assert.match(game, /panelHeight < 1\.4 \? 'meet' : 'slice'/)
  assert.match(game, /tcg-illustration-svg tcg-illustration-primary/)
  assert.match(game, /tcg-illustration-svg tcg-illustration-backdrop/)
})

test('Serena Divine displays supplied fifth evolution instead of the old theme portrait', () => {
  assert.match(game, /SERENA DIVINE/)
  assert.match(game, /serena-evolutions\.webp/)
  assert.doesNotMatch(game, /portraitImage: '\/serena-turquoise-sovereign-mobile\.webp'/)
  assert.match(css, /tcg-evo--serena\.tcg-evo-lvl-5/)
  assert.match(game, /const isSerenaDivine = card\.slug === 'serena' && card\.rarity === 'secret'/)
})

test('The four player galleries appear in the Collection screen', () => {
  for (const { focus } of supplied) assert.ok(game.includes(focus))
  assert.match(game, /\$\{renderSuppliedEvolutionGalleries\(\)\}/)
})
