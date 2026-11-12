import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const src = read('../src/tcg-game.js')
const css = read('../src/tcg-interface-clean.css')

test('The TCG imports its clean interface skin after pack-opening visuals', () => {
  assert.match(src, /import '\.\/tcg-pack-opening\.css'\s+import '\.\/tcg-interface-clean\.css'/)
  assert.match(css, /\.tcg-app\.tcg-spider/)
  assert.match(css, /--ui-panel:/)
  assert.match(css, /--ui-muted:/)
})

test('There is only one user-facing navigation and all four tabs remain functional', () => {
  assert.match(src, /<nav class="tcg-spider-side-nav" aria-label="Sections du jeu">/)
  assert.doesNotMatch(src, /<nav class="tcg-nav tcg-spider-nav"/)
  for (const tab of ['duel', 'collection', 'deck', 'boosters']) {
    assert.match(src, new RegExp("id: '" + tab + "'"))
  }
  assert.match(src, /data-action="tcg-tab"/)
  assert.match(src, /aria-current=/)
  assert.match(css, /@media\(max-width:760px\)/)
})

test('The menu has a real collection progress indicator', () => {
  assert.match(src, /const collectionPercent = catalog\.size > 0/)
  assert.match(src, /class="tcg-sidebar-progress-track" role="progressbar"/)
  assert.match(src, /aria-valuenow="\$\{collectionPercent\}"/)
  assert.match(src, /\$\{uniqueOwned\(\)\} \/ \$\{catalog\.size\} cartes débloquées/)
  assert.match(css, /tcg-sidebar-progress-track/)
})

test('Booster spotlight precedes catalog and opens via the existing RPC action', () => {
  const spotlight = src.indexOf('class="tcg-panel tcg-featured-panel"')
  const catalog = src.indexOf('Les éditions à collectionner')
  assert.ok(spotlight >= 0 && catalog > spotlight)
  assert.match(src, /class="tcg-open-details"/)
  assert.match(src, /data-action="tcg-open-pack"/)
  assert.match(src, /case 'tcg-open-pack':/)
  assert.match(src, /data-action="tcg-select-booster"/)
  assert.match(src, /scrollIntoView/)
  assert.match(css, /grid-template-columns:minmax\(230px,\.92fr\)/)
  assert.match(css, /@media\(max-width:590px\)/)
})

test('Hero quick actions target valid sections and UI remains motion-accessible', () => {
  assert.match(src, /class="tcg-hero-actions"/)
  assert.match(src, /data-tab="collection"/)
  assert.match(src, /data-tab="deck"/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.match(css, /:focus-visible/)
})
