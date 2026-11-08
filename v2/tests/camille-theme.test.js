import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAthleteTheme } from '../src/athlete-themes.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const training = read('../src/training.js')
const main = read('../src/main.js')
const css = read('../src/theme-camille-abyss.css')
const art = read('../public/camille-sanctuaire-abysses.svg')

test('Camille has a unique active aquatic theme without changing other athlete themes', () => {
  const camille = getAthleteTheme('camille')
  assert.equal(camille.variant, 'camille-abyss-sanctuary')
  assert.match(camille.headerKicker, /ABYSSALE/)
  assert.equal(camille.heroImage, '/camille-sanctuaire-abysses.svg')
  assert.equal(getAthleteTheme('allan').variant, 'allan-crimson-trinity')
  assert.notEqual(getAthleteTheme('rudy').variant, camille.variant)
})

test('The training renderer mounts the Camille-only accessible underwater banner', () => {
  assert.match(training, /athleteTheme\?\.variant ===\s*'camille-abyss-sanctuary'/)
  assert.match(training, /athlete-theme-banner--camille-abyss/)
  assert.match(training, /Les Abysses/)
  assert.match(training, /camille-abyss__bubbles/)
  assert.match(training, /camille-abyss__emblems/)
  assert.match(training, /aria-label="Sanctuaire aquatique/)
  assert.match(training, /renderAthleteThemeBanner\(\)/)
})

test('The original underwater illustration exists and is not an external dependency', () => {
  assert.match(art, /<svg[^>]*viewBox="0 0 1500 540"/)
  assert.match(art, /id="ocean"/)
  assert.match(art, /<\/svg>/)
  assert.ok(art.length > 3500)
  assert.doesNotMatch(art, /<image|href="https?:\/\//)
})

test('The styles load after base styles and only affect Camille training', () => {
  assert.ok(main.indexOf("import './theme-spider.css'") < main.indexOf("import './theme-camille-abyss.css'"))
  assert.match(css, /\.training-page\[data-athlete-theme="camille"\]/)
  assert.match(css, /athlete-theme-banner--camille-abyss/)
  assert.match(css, /z-index: 0;\s*inset: 0;\s*background:/)
  assert.match(css, /\.week-tab--active/)
  assert.match(css, /\.day-tab-v2--active/)
  assert.match(css, /\.training-set--done/)
  assert.match(css, /\.training-set--failed/)
  assert.match(css, /@media\(max-width:650px\)/)
  assert.match(css, /prefers-reduced-motion:reduce/)
})

test('No scripts or controls are added by decorative aquatic visuals', () => {
  assert.doesNotMatch(art, /<script|onload=|onclick=/i)
  assert.doesNotMatch(css, /https?:\/\//)
  assert.match(training, /aria-hidden="true"><i><\/i>/)
})
