import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { athletes, getAthlete } from '../src/athletes.js'
const read = path => readFileSync(new URL(path, import.meta.url),'utf8')
const main = read('../src/main.js')
const css = read('../src/theme-benjamin.css')
test('Benjamin is a single active roster athlete without a fabricated program',()=>{
  const benjamin=getAthlete('benjamin')
  assert.ok(benjamin)
  assert.equal(athletes.filter(a=>a.id==='benjamin').length,1)
  assert.equal(benjamin.name,'Benjamin')
  assert.equal(benjamin.bodyWeight,null)
  assert.equal(benjamin.blockCount,0)
  assert.equal(benjamin.programKey,'benjamin')
  assert.equal(benjamin.profileImage,'avatar-benjamin.webp')
})
test('Benjamin illustration appears in the roster and on his blank profile',()=>{
  assert.match(main,/benjamin: '\/avatar-benjamin\.webp'/)
  assert.match(main,/Portrait illustré de Benjamin/)
  assert.match(main,/data-athlete-theme="benjamin"/)
  assert.match(main,/Programmation à venir/)
  assert.match(css,/\.benjamin-profile/)
  assert.doesNotMatch(css,/data-athlete-theme="marvin"|data-athlete-theme="guillaume"/)
})
