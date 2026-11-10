import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAthleteTheme } from '../src/athlete-themes.js'

const read = path => readFileSync(new URL(path, import.meta.url))
const training = read('../src/training.js').toString('utf8')
const main = read('../src/main.js').toString('utf8')
const css = read('../src/theme-killian-yonko.css').toString('utf8')

test('Killian has the unique Grand Line Yonko theme, without affecting anyone else', () => {
  const killian = getAthleteTheme('killian')
  assert.equal(killian.variant, 'killian-yonko-grandline')
  assert.equal(killian.hideHeaderKicker, true)
  assert.equal(killian.heroImage, '/killian-one-piece-yonko-wide.webp')
  assert.equal(killian.heroMobileImage, '/killian-one-piece-yonko-mobile.webp')
  assert.equal(killian.backgroundImage, '/killian-one-piece-yonko-mobile.webp')
  assert.equal(killian.quote, '')
  assert.equal(killian.noteText, '')
  assert.equal(getAthleteTheme('noe').variant, 'noe-wakfu-skybound')
  assert.equal(getAthleteTheme('camille').variant, 'camille-abyss-sanctuary')
  assert.equal(getAthleteTheme('guillaume').variant, 'anzalone-celestial-pantheon')
})

test('Desktop and mobile Yonko themed images are original valid local WebP files', () => {
  for (const p of ['../public/killian-one-piece-yonko-wide.webp',
                   '../public/killian-one-piece-yonko-mobile.webp']) {
    const img = read(p)
    assert.ok(img.length > 150000, 'Missing themed image ' + p)
    assert.equal(img.subarray(0,4).toString('ascii'), 'RIFF')
    assert.equal(img.subarray(8,12).toString('ascii'), 'WEBP')
    assert.equal(img.readUInt32LE(4)+8,img.length)
  }
})

test('Killian banner presents the seven named emperors and their worlds', () => {
  assert.ok(training.includes("athleteTheme?.variant === 'killian-yonko-grandline'"))
  assert.match(training,/athlete-theme-banner--killian-yonko/)
  assert.match(training,/killian-yonko__picture/)
  assert.match(training,/killian-yonko__haki/)
  assert.match(training,/killian-yonko__ocean/)
  assert.match(training,/killian-yonko__embers/)
  const entries = [
    ['shanks','Shanks le Roux','Elbaf'],
    ['whitebeard','Barbe Blanche','Moby Dick'],
    ['bigmom','Big Mom','Whole Cake'],
    ['kaido','Kaido','Onigashima'],
    ['blackbeard','Barbe Noire','Hachinosu'],
    ['luffy','Monkey D. Luffy','Thousand Sunny'],
    ['buggy','Baggy le Clown','Cross Guild'],
  ]
  for (const [slug,name,place] of entries) {
    assert.ok(training.includes('killian-yonko__world--'+slug))
    assert.ok(training.includes(name))
    assert.ok(training.includes(place))
  }
  const start=training.indexOf("athleteTheme?.variant === 'killian-yonko-grandline'")
  const end=training.indexOf("athleteTheme?.variant === 'noe-wakfu-skybound'",start)
  const banner=training.slice(start,end)
  assert.ok(end>start)
  assert.equal((banner.match(/class="killian-yonko__world killian-yonko__world--/g)||[]).length,7)
  assert.match(banner,/loading="eager"/)
  assert.match(banner,/aria-hidden="true"/)
  assert.doesNotMatch(banner,/<button|data-action=|onClick=/)
})

test('All visual styles are scoped and the artwork remains legible at mobile sizes', () => {
  assert.match(css,/\.training-page\[data-athlete-theme="killian"\]/)
  assert.match(css,/\.killian-yonko__worlds/)
  assert.match(css,/scroll-snap-type:x proximity/)
  assert.match(css,/\.training-set--done/)
  assert.match(css,/\.training-set--failed/)
  assert.match(css,/\.week-tab--active/)
  assert.match(css,/\.day-tab-v2--active/)
  assert.match(css,/@keyframes yonkoHakiPulse/)
  assert.match(css,/@keyframes yonkoOceanParallax/)
  assert.match(css,/@media\(max-width:650px\)/)
  assert.match(css,/prefers-reduced-motion:reduce/)
  assert.match(css,/url\('\/killian-one-piece-yonko-mobile\.webp'\)/)
  assert.ok(main.indexOf("import './theme-noe-skybound.css'") <
            main.indexOf("import './theme-killian-yonko.css'"))
})

test('The theme does not rewrite exercise prescriptions or touch training data', () => {
  const start=training.indexOf("athleteTheme?.variant === 'killian-yonko-grandline'")
  const end=training.indexOf("athleteTheme?.variant === 'noe-wakfu-skybound'",start)
  const fragment=training.slice(start,end)
  assert.doesNotMatch(fragment,/setProgram|updateProgram|loadKg|exercise\.sets|session\.sets/)
  assert.match(fragment,/<picture/)
  assert.match(fragment,/Les sept empereurs et leurs mondes/)
})
