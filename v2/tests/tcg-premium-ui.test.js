import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const js=readFileSync(new URL('../src/tcg-game.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/tcg-premium-ui.css',import.meta.url),'utf8')
test('Premium theme is imported and scoped away from coaching screens',()=>{
  assert.match(js,/import '\.\/tcg-premium-ui\.css'/)
  assert.match(css,/\.tcg-app\.tcg-spider/)
  for(const key of ['--tcg-bg','--tcg-text','--tcg-accent','--tcg-health','--tcg-energy','--tcg-faction-power','--tcg-secret'])assert.ok(css.includes(key))
})
test('Card art remains original and all galleries remain accessible',()=>{
  for(const key of ['dedicatedCardArt(card)','renderAlexandreEvolutionGallery()','renderHugoEvolutionGallery()','renderBenoitEvolutionGallery()','renderSuppliedEvolutionGalleries()'])assert.ok(js.includes(key))
  assert.match(js,/loading="lazy" decoding="async"/)
  assert.match(js,/tcg-card--\$\{esc\(size\)\}/)
})
test('Collection supports rarity and faction filters, search and progressive loading',()=>{
  for(const key of ['tcg-card-search','tcg-faction-filter','tcg-collection-sort','tcg-more-cards','tcg-card-detail','tcg-toggle-all-cards'])assert.ok(js.includes(key))
  assert.match(js,/collectionLimit\s*=\s*36/)
})
test('Deck remains 8 unique cards with local named presets and Supabase active deck',()=>{
  assert.match(js,/Array\.from\(\{length:DECK_SIZE\}/)
  for(const key of ['tcg-save-preset','tcg-load-preset','tcg-remove-preset','ga-tcg-decks-','tcg_decks'])assert.ok(js.includes(key))
  assert.match(js,/validateDeck\(deck,catalog/)
})
test('Combat presentation retains engine and supports reduced motion and touch',()=>{
  for(const key of ['resolveTcgArenaRound','tcg-battle-meta','tcg-arena-history','tcg-pick-card','tcg-bid-up'])assert.ok(js.includes(key))
  assert.match(css,/prefers-reduced-motion/)
  assert.match(css,/env\(safe-area-inset-bottom\)/)
  assert.match(css,/min-height:44px/)
})
test('Profile and modal are connected to the navigation',()=>{
  assert.match(js,/id: 'profile'/)
  assert.match(js,/renderProfile\(\)/)
  assert.match(js,/renderCardDetail\(\)/)
  assert.match(js,/role="dialog" aria-modal="true"/)
})
