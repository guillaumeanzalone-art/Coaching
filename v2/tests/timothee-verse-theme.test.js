import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAthleteTheme } from '../src/athlete-themes.js'
import {
  TIMOTHEE_VERSES,
  pickTimotheeVerse,
  getTimotheeVisitVerse,
  renderTimotheeThemeHero,
  renderTimotheeVersePanel,
} from '../src/timothee-verses.js'

const text = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const training = text('../src/training.js')
const main = text('../src/main.js')
const css = text('../src/theme-timothee-covenant.css')
const killianCss = text('../src/theme-killian-yonko.css')

test('Timothée has his own cinematic biblical variant and does not override other athletes', () => {
  const t = getAthleteTheme('timothee')
  assert.equal(t.variant,'timothee-bible-covenant')
  assert.equal(t.hideHeaderKicker,true)
  assert.equal(t.heroImage,'/timothee-bible-epic-wide.webp')
  assert.equal(t.heroMobileImage,'/timothee-bible-epic-mobile.webp')
  assert.equal(t.quote,'')
  assert.equal(t.noteText,'')
  assert.equal(getAthleteTheme('killian').variant,'killian-yonko-grandline')
  assert.equal(getAthleteTheme('noe').variant,'noe-wakfu-skybound')
})

test('Both hero images exist as complete original WebP files', () => {
  for (const name of [
    'timothee-bible-epic-wide.webp',
    'timothee-bible-epic-mobile.webp',
  ]) {
    const bytes = readFileSync(new URL('../public/' + name, import.meta.url))
    assert.ok(bytes.length > 150000,'Missing theme artwork '+name)
    assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF')
    assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP')
    assert.equal(bytes.readUInt32LE(4)+8,bytes.length)
  }
})

test('Eight authentic Louis Segond verses have unique references', () => {
  assert.ok(TIMOTHEE_VERSES.length >= 8)
  assert.equal(new Set(TIMOTHEE_VERSES.map(verse => verse.reference)).size,TIMOTHEE_VERSES.length)
  for (const verse of TIMOTHEE_VERSES) {
    assert.ok(verse.reference.length > 5)
    assert.ok(verse.text.length >= 30)
  }
  assert.ok(TIMOTHEE_VERSES.some(verse => verse.reference === '2 Timothée 1:7'))
  assert.ok(TIMOTHEE_VERSES.some(verse => verse.reference === 'Josué 1:9'))
})

test('Opening the page twice changes the verse, even for a constant random source', () => {
  const saved = new Map()
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key,value) => saved.set(key,value),
  }
  const first = getTimotheeVisitVerse(storage,()=>0)
  const second = getTimotheeVisitVerse(storage,()=>0)
  const third = getTimotheeVisitVerse(storage,()=>0.5)
  assert.notEqual(first.reference,second.reference)
  assert.notEqual(second.reference,third.reference)
  assert.equal(pickTimotheeVerse(first.reference,()=>0).reference,second.reference)
})

test('A verse stays usable when session storage is blocked or random is invalid', () => {
  const blocked = {
    getItem(){ throw new Error('Private storage blocked') },
    setItem(){ throw new Error('Private storage blocked') },
  }
  assert.ok(TIMOTHEE_VERSES.includes(getTimotheeVisitVerse(blocked,()=>0)))
  assert.equal(pickTimotheeVerse('not-a-ref',()=>Number.NaN),TIMOTHEE_VERSES[0])
})

test('Banner and scripture panel are semantic, accessible and escape supplied text', () => {
  const html = renderTimotheeThemeHero()
  assert.match(html,/athlete-theme-banner--timothee-covenant/)
  assert.match(html,/timothee-bible-epic-wide\.webp/)
  assert.match(html,/timothee-bible-epic-mobile\.webp/)
  assert.match(html,/aria-hidden="true"/)
  const panel = renderTimotheeVersePanel(TIMOTHEE_VERSES[0])
  assert.match(panel,/<blockquote/)
  assert.match(panel,/Bible Louis Segond 1910/i)
  assert.match(panel,/Josué 1:9/)
  const escaped = renderTimotheeVersePanel({reference:'<b>',text:'<script>alert("X")</script>'})
  assert.doesNotMatch(escaped,/<script>|<b>/)
  assert.match(escaped,/&lt;script&gt;/)
})

test('Once per profile visit, the verse is stable across workout tab rerenders', () => {
  assert.match(training,/const timotheeVisitVerse = athleteTheme\?\.variant === 'timothee-bible-covenant'/)
  assert.match(training,/renderTimotheeVersePanel\(timotheeVisitVerse\)/)
  const start=training.indexOf('function renderAthleteThemeBanner()')
  const end=training.indexOf("athleteTheme?.variant === 'killian-yonko-grandline'",start)
  const banner=training.slice(start,end)
  assert.match(banner,/renderTimotheeThemeHero\(\)/)
  assert.doesNotMatch(banner,/getTimotheeVisitVerse\(/)
})

test('Timothée can see his scripture and banner even if no program is published', () => {
  assert.match(main,/if \(athlete.id === 'timothee'\) \{/)
  assert.match(main,/const visitVerse = getTimotheeVisitVerse\(\)/)
  assert.match(main,/renderTimotheeThemeHero\(\)/)
  assert.match(main,/renderTimotheeVersePanel\(visitVerse\)/)
  assert.match(main,/Programmation à venir/)
})

test('The new look is readable, responsive, scoped and respects reduced motion', () => {
  assert.match(css,/\.training-page\[data-athlete-theme="timothee"\]/)
  assert.match(css,/timothee-covenant__scripture-text/)
  assert.match(css,/@keyframes covenantHeavenParallax/)
  assert.match(css,/@keyframes covenantStarRise/)
  assert.match(css,/@media\(max-width:650px\)/)
  assert.match(css,/prefers-reduced-motion:reduce/)
  assert.match(css,/\.training-set--done/)
  assert.match(css,/\.training-set--failed/)
  assert.ok(main.includes("import './theme-timothee-covenant.css'"))
})

test('Killian retains his Yonko poster but has no Grand Line scrolling menu', () => {
  assert.match(training,/athlete-theme-banner--killian-yonko/)
  assert.match(training,/killian-yonko__art/)
  assert.doesNotMatch(training,/killian-yonko__voyage|killian-yonko__worlds/)
  assert.doesNotMatch(killianCss,/killian-yonko__voyage|killian-yonko__worlds/)
  assert.match(killianCss,/@keyframes yonkoHakiPulse/)
})
