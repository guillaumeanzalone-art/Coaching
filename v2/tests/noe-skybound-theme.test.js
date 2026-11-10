import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAthleteTheme } from '../src/athlete-themes.js'

const src = path => readFileSync(new URL(path, import.meta.url))
const training = src('../src/training.js').toString('utf8')
const main = src('../src/main.js').toString('utf8')
const css = src('../src/theme-noe-skybound.css').toString('utf8')

test('Noé gets unique aircraft and Zapatos theme, unchanged athletes remain independent', () => {
  const noe = getAthleteTheme('noe')
  assert.equal(noe.variant, 'noe-wakfu-skybound')
  assert.equal(noe.hideHeaderKicker, true)
  assert.equal(noe.heroImage, '/noe-wakfu-zapatos-wide.webp')
  assert.equal(noe.heroMobileImage, '/noe-wakfu-zapatos-square.webp')
  assert.equal(noe.backgroundImage, '/noe-wakfu-zapatos-square.webp')
  assert.equal(getAthleteTheme('camille').variant, 'camille-abyss-sanctuary')
  assert.equal(getAthleteTheme('guillaume').variant, 'anzalone-celestial-pantheon')
})

test('Desktop and mobile versions of player-approved theme art are valid WebP', () => {
  for (const p of [
    '../public/noe-wakfu-zapatos-wide.webp',
    '../public/noe-wakfu-zapatos-square.webp',
  ]) {
    const data = src(p)
    assert.ok(data.length > 150000, 'Missing artwork: ' + p)
    assert.equal(data.subarray(0, 4).toString('ascii'), 'RIFF')
    assert.equal(data.subarray(8, 12).toString('ascii'), 'WEBP')
    assert.equal(data.readUInt32LE(4)+8, data.length)
  }
})

test('Training page shows the atmospheric aircraft theme only for Noé', () => {
  assert.match(training, /athleteTheme\?\.variant === 'noe-wakfu-skybound'/)
  assert.match(training, /athlete-theme-banner--noe-skybound/)
  assert.match(training, /noe-skybound__hero/)
  assert.match(training, /noe-skybound__flight-lines/)
  assert.match(training, /noe-skybound__wind/)
  assert.match(training, /noe-skybound__clouds/)
  assert.match(training, /noe-skybound__sparks/)
  assert.match(training, /Noé, le ciel des avions fantastiques et des chaussures volantes/)
  assert.match(training, /renderAthleteThemeBanner\(\)/)
})

test('Only Noé program styles change; source art stays behind readable controls', () => {
  assert.match(css, /\.training-page\[data-athlete-theme="noe"\]/)
  assert.match(css, /\.athlete-theme-banner--noe-skybound/)
  assert.match(css, /\.training-set--done/)
  assert.match(css, /\.training-set--failed/)
  assert.match(css, /\.week-tab--active/)
  assert.match(css, /\.day-tab-v2--active/)
  assert.match(css, /url\('\/noe-wakfu-zapatos-square\.webp'\)/)
  assert.match(css, /@keyframes noeWindTrail/)
  assert.match(css, /@keyframes noeSkyFloat/)
  assert.match(css, /@media\(max-width:650px\)/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.ok(main.indexOf("import './theme-camille-abyss.css'") < main.indexOf("import './theme-noe-skybound.css'"))
})

test('Decorative scene remains noninteractive and does not edit workouts', () => {
  const start = training.indexOf("athleteTheme?.variant === 'noe-wakfu-skybound'")
  const end = training.indexOf("'camille-abyss-sanctuary'", start)
  const banner = training.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.doesNotMatch(banner, /onClick|data-action=|onkeydown=|<button/i)
  assert.match(banner, /aria-hidden="true"/)
  assert.match(banner, /<picture/)
  assert.doesNotMatch(banner, /<h2>|<p>|<b>/)
})
