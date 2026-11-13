import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAthleteTheme } from '../src/athlete-themes.js'

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const themeCss = source('../src/theme-marvin-western.css')
const app = source('../src/training.js')
const main = source('../src/main.js')
const svg = source('../public/marvin-western-banner.svg')

test('western is limited to Marvin; Anzalone and other athlete themes are intact', () => {
  const marvin = getAthleteTheme('marvin')
  const anzalone = getAthleteTheme('guillaume')
  assert.equal(marvin.variant, 'marvin-frontier-outlaw')
  assert.equal(anzalone.variant, 'anzalone-celestial-pantheon')
  assert.equal(getAthleteTheme('noe').variant, 'noe-wakfu-skybound')
  assert.equal(marvin.heroImage, '/marvin-western-banner.svg')
  assert.ok(!marvin.quote.includes('salope'))
  assert.match(main, /import '\.\/theme-marvin-western\.css'/)
  assert.match(themeCss, /\.training-page\[data-athlete-theme="marvin"\]/)
  assert.doesNotMatch(themeCss, /data-athlete-theme="killian"/)
  assert.doesNotMatch(themeCss, /data-athlete-theme="guillaume"/)
})
test('banner is original SVG, no protected assets and no duplicate name over image', () => {
  assert.match(svg, /viewBox="0 0 1440 490"/)
  assert.match(svg, /MARVIN/)
  assert.match(svg, /WANTED/)
  assert.doesNotMatch(svg, /rockstar|red dead redemption/i)
  assert.match(app, /athlete-theme-banner--marvin-western/)
  assert.match(app, /marvin-western__hero/)
  assert.match(app, /loading="eager" decoding="async"/)
})
test('maxes and bounty are always computed from existing PRs for selected repetition count', () => {
  const panel = app.slice(app.indexOf('function renderSbdPrPanel()'), app.indexOf('function stepsXpMultiplierForPanel('))
  assert.match(panel, /sbdPrs\[lift\]\?\.\[selectedSbdReps\]/)
  assert.match(panel, /bountyLoads\.reduce/)
  assert.match(panel, /bountyComplete/)
  assert.match(panel, /marvin-bounty-total/)
  assert.match(panel, /prFlash/)
  assert.doesNotMatch(panel, /(?:275|290|740)\s*kg/)
})
test('all real training behaviors are left in their existing modules', () => {
  assert.match(app, /renderRestTimerDock\(\)/)
  assert.match(app, /renderRestTimerEditor\(\)/)
  assert.match(app, /hydrateFromCloud\(\)/)
  assert.match(app, /renderAthleteInsights\(\)/)
  assert.match(app, /renderV3BlockHistory\(\)/)
  assert.match(app, /data-athlete-theme="\$\{escapeHtml\(cloudAthleteSlug\)\}"/)
  assert.match(themeCss, /prefers-reduced-motion:reduce/)
  assert.match(themeCss, /safe-area-inset-bottom/)
  assert.match(themeCss, /min-height:44px/)
})
