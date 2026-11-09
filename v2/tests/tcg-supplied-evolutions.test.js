import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url))
const source = read('../src/tcg-game.js').toString('utf8')
const css = read('../src/tcg-supplied-evolutions.css').toString('utf8')
const characters = [
  ['charles', 'charles-casino'],
  ['celia', 'celia-foudre'],
  ['camille', 'camille-abysses'],
  ['magicarpe', 'magicarpe-lego'],
  ['jolan', 'jolan-bonbons'],
]
const rarities = ['common', 'uncommon', 'rare', 'ultra', 'secret']

test('Original player-supplied WebP art exists for each of the five characters', () => {
  for (const pair of characters) {
    const name = pair[1]
    const data = read('../public/tcg/' + name + '-evolutions.webp')
    assert.ok(data.length > 110000, 'Expected original art for ' + name)
    assert.equal(data.subarray(0,4).toString('ascii'), 'RIFF')
    assert.equal(data.subarray(8,12).toString('ascii'), 'WEBP')
    assert.equal(data.readUInt32LE(4)+8, data.length)
  }
})

test('Five rarities map to five consecutive panels on each supplied sprite', () => {
  for (const pair of characters) {
    const slug = pair[0]
    const asset = pair[1]
    const match = source.match(new RegExp(
      '\\b' + slug + ':\\s*\\{(?:\\s*\\/\\/[^\\n]*\\n)+\\s*sprite:\\s*' +
      "'/tcg/" + asset + "-evolutions.webp',\\s*rarityIndex:\\s*\\{([^}]+)\\}"
    ))
    assert.ok(match, 'Missing rarity art: ' + slug)
    const seen = [...match[1].matchAll(/(common|uncommon|rare|ultra|secret):\s*([0-4])/g)]
    assert.deepEqual(seen.map(x=>x[1]), rarities)
    assert.deepEqual(seen.map(x=>Number(x[2])), [0,1,2,3,4])
  }
  assert.match(source, /position: artworkOverride \? 0 : index \* 25/)
  assert.match(css, /background-size:500% 100%/)
})

test('All five heroes get individual LVL badges in the existing card engine', () => {
  for (const pair of characters) {
    const slug = pair[0]
    assert.ok(source.includes("slug: '" + slug + "'"), 'Missing gallery: ' + slug)
  }
  assert.match(source, /SUPPLIED_EVOLUTION_SLUGS\.has\(card\.slug\)/)
  assert.match(source, /tcg-card--evo tcg-evo--/)
  assert.match(source, /tcg-evo-lvl-/)
  assert.match(source, /tcg-evo-lvl">LVL/)
  assert.match(source, /function dedicatedCardArt\(/)
  assert.match(source, /function renderCard\(/)
  assert.match(source, /function renderDuel\(/)
  assert.match(source, /function renderSuppliedEvolutionGalleries\(/)
  assert.match(css, /tcg-evo--jolan/)
  assert.match(css, /tcg-evo-gallery--jolan/)
  assert.ok(source.includes('$' + '{renderSuppliedEvolutionGalleries()}'))
})

test('Gallery uses actual rarity cards and existing ownership information', () => {
  assert.match(source, /rarities\.map\(\(rarity, idx\) =>/)
  assert.match(source, /catalog\.get\(cardId\(slug, rarity\)\)/)
  assert.match(source, /ownedCopies\(card\.id\) > 0/)
  assert.match(source, /renderCard\(card\)/)
  assert.match(source, /DÉBLOQUÉE/)
  assert.match(source, /À DÉBLOQUER/)
  assert.match(css, /tcg-evo-gallery-grid/)
})

test('Visible full art, five foil tiers, responsive layout and accessible motion', () => {
  const art = css.match(/\.tcg-app\.tcg-spider \.tcg-card--evo \.tcg-card-art \{([^}]+)\}/)
  assert.ok(art)
  assert.match(art[1], /height:100%/)
  const sprite = css.match(/\.tcg-app\.tcg-spider \.tcg-card--evo\.tcg-card--illustrated \.tcg-illustration-sprite \{([^}]+)\}/)
  assert.ok(sprite)
  assert.match(sprite[1], /height:100%/)
  assert.match(sprite[1], /visibility:visible/)
  for(let lvl=1;lvl<=5;lvl++) assert.ok(css.includes('tcg-evo-lvl-'+lvl))
  assert.match(css, /@keyframes tcgEvoHolograph/)
  assert.match(css, /@keyframes tcgEvoSpark/)
  assert.match(css, /max-width:650px/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.ok(source.indexOf("import './tcg-benoit-earth.css'") < source.indexOf("import './tcg-supplied-evolutions.css'"))
})

test('Clara secret LVL 5 uses the newly supplied full-art image while LVL 1–4 keep their original sprite', () => {
  const newImage = read('../public/tcg/clara-magicarpe-lvl5.webp')
  assert.ok(newImage.length > 120000, 'Clara supplied image is missing or replaced by a placeholder')
  assert.equal(newImage.subarray(0, 4).toString('ascii'), 'RIFF')
  assert.equal(newImage.subarray(8, 12).toString('ascii'), 'WEBP')
  assert.equal(newImage.readUInt32LE(4) + 8, newImage.length)

  const magicarpe = source.slice(source.indexOf('  magicarpe: {', source.indexOf('const CHARACTER_CARD_ART')))
  assert.match(magicarpe, /sprite: '\/tcg\/magicarpe-lego-evolutions\.webp'/)
  assert.match(magicarpe, /raritySprites: \{\s*secret: '\/tcg\/clara-magicarpe-lvl5\.webp'/)
  assert.match(source, /const artworkOverride = art\.raritySprites\?\.\[card\?\.rarity\]/)
  assert.match(source, /sprite: artworkOverride \|\| art\.sprite/)
  assert.match(css, /\.tcg-evo--magicarpe\.tcg-evo-lvl-5 \.tcg-illustration-sprite \{/)
  assert.match(css, /background-size: cover/)
  assert.match(css, /background-position: center center !important/)
})
