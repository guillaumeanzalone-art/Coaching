import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {getAthleteTheme} from '../src/athlete-themes.js'

const read = path => readFileSync(new URL(path,import.meta.url),'utf8')
const css=read('../src/theme-marvin-western.css')
const training=read('../src/training.js')
const main=read('../src/main.js')
const artwork=readFileSync(new URL('../public/marvin-cinematic-1899.webp',import.meta.url))

test('Marvin has just a banner and other athletes retain their themes',()=>{
  assert.equal(getAthleteTheme('marvin').variant,'marvin-cinematic-banner')
  assert.equal(getAthleteTheme('guillaume').variant,'anzalone-celestial-pantheon')
  assert.equal(getAthleteTheme('noe').variant,'noe-wakfu-skybound')
  assert.equal(getAthleteTheme('marvin').heroImage,'/marvin-cinematic-1899.webp?v=20261113a')
})
test('Banner is mounted using existing athlete theme renderer',()=>{
  assert.match(training,/athlete-theme-banner--marvin-cinematic/)
  assert.match(training,/marvin-cinematic__picture/)
  assert.match(training,/width="1024" height="576" loading="eager" decoding="async"/)
  assert.match(main,/import '\.\/theme-marvin-western\.css'/)
})
test('Only the banner gets new CSS, never workouts, recovery, timer, PRs or navigation',()=>{
  assert.match(css,/aspect-ratio:16 \/ 9/)
  assert.match(css,/data-athlete-theme="marvin"/)
  assert.doesNotMatch(css,/\.athlete-pr|\.week-tab|\.day-tab|\.training-set|\.training-topbar|\.recovery-|\.rest-timer|\.training-v3/)
  assert.doesNotMatch(training,/marvin-bounty-total|marvin-wanted-title|westernQuotes/)
  assert.match(training,/renderRestTimerDock\(\)/)
  assert.match(training,/renderSbdPrPanel\(\)/)
})

test('Bannière western haute qualité : vrai WebP panoramique et non ancien SVG',()=>{
  assert.equal(artwork.toString('ascii',0,4),'RIFF')
  assert.equal(artwork.toString('ascii',8,12),'WEBP')
  assert.ok(artwork.length>45000&&artwork.length<110000,'illustration WebP optimisée')
  assert.doesNotMatch(getAthleteTheme('marvin').heroImage,/\.svg/)
  assert.match(css,/object-fit:cover/)
})
