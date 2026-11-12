import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const game = read('../src/tcg-game.js')
const styles = read('../src/tcg-pack-opening.css')

test('Premium pack design is imported, sealed and shared by grid and main opening stage', () => {
  assert.match(game, /import '\.\/tcg-pack-opening\.css'/)
  assert.match(game, /function renderPackShell\(booster, seriesNumber = 1\)/)
  assert.match(game, /\$\{renderPackShell\(booster, index \+ 1\)\}/)
  assert.match(game, /\$\{renderPackShell\(selectedBooster,/)
  for (const selector of ['.tcg-pack-shell','.tcg-pack-seal--top','.tcg-pack-seal--bottom','.tcg-pack-emblem','.tcg-pack-tear','.tcg-pack-crease']) {
    assert.ok(styles.includes(selector), 'Missing pack visual: ' + selector)
  }
  assert.match(styles, /aspect-ratio:\s*\.695/)
  assert.match(game, /spider-sigil\.svg/)
})

test('Server-side random draw and pack debit are guarded before card reveal', () => {
  assert.match(game, /if \(openingBusy \|\| lastOpened\.length \|\| !selectedBooster/)
  assert.match(game, /openingBusy = true/)
  assert.match(game, /supabase\\.rpc\\('open_tcg_pack_v2'/)
  assert.match(game, /if \(openError\) throw openError/)
  assert.match(game, /Never reroll or debit again after a successful RPC/)
  assert.match(game, /await refreshProfileAndCollection\(\)/)
  assert.match(game, /lastOpened = cards/)
  assert.match(game, /openingStage = 'tearing'/)
})

test('Every card has a concealed back, individual flip and progressive reveal', () => {
  assert.match(game, /function scheduleNextReveal\(\)/)
  assert.match(game, /revealCount \+= 1/)
  assert.match(game, /tile\.classList\.add\('is-flipped'\)/)
  assert.match(game, /tcg-pull-face--back/)
  assert.match(game, /tcg-pull-face--front/)
  assert.match(game, /data-reveal-rarity/)
  assert.match(game, /case 'tcg-reveal-all'/)
  assert.match(game, /clearTimeout\(revealTimer\)/)
  assert.match(styles, /transform-style:preserve-3d/)
  assert.match(styles, /backface-visibility:hidden/)
  assert.match(styles, /\.tcg-pull\.is-flipped/)
})

test('Rarity visuals, improved arena and reduced-motion support exist', () => {
  assert.match(styles, /data-rarity="ultra"/)
  assert.match(styles, /data-rarity="secret"/)
  assert.match(styles, /\.tcg-arena-board/)
  assert.match(styles, /\.tcg-arena-choice/)
  assert.match(styles, /prefers-reduced-motion:reduce/)
  assert.match(game, /matchMedia\?\./)
})
