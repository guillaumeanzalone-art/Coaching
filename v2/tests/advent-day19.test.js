import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  ADVENT_DAY19_UNLOCK,
  ADVENT_DAY19_TABLE,
  parisDay,
  day19Unlocked,
  cleanSuggestion,
  groupDay19Suggestions,
} from '../src/advent-day19.js'

test('le jour 19 se déverrouille à minuit heure de Paris', () => {
  assert.equal(ADVENT_DAY19_UNLOCK, '2026-12-19')
  assert.equal(day19Unlocked(new Date('2026-12-18T22:59:59.000Z')), false)
  assert.equal(day19Unlocked(new Date('2026-12-18T23:00:00.000Z')), true)
  assert.equal(day19Unlocked(new Date('2026-12-19T08:00:00.000Z')), true)
  assert.equal(parisDay(new Date('2026-12-18T23:00:00.000Z')), '2026-12-19')
})

test('les réponses sont libres, nettoyées et limitées', () => {
  assert.equal(cleanSuggestion('   Louis \n  Roi  '), 'Louis Roi')
  assert.equal(cleanSuggestion('A'.repeat(200)).length, 120)
  assert.equal(cleanSuggestion(null), '')
})

test('le classement regroupe les variantes de casse et accents', () => {
  const results = groupDay19Suggestions([
    { suggestion: '  Félix  ' },
    { suggestion: 'felix' },
    { suggestion: 'LOUIS' },
    { suggestion: 'louis ' },
    { suggestion: 'Maxence' },
    { suggestion: '   ' },
  ])
  assert.equal(results.length, 3)
  assert.deepEqual(results.slice(0, 2).map(r => r.votes), [2, 2])
  assert.deepEqual(results.find(r => r.name === 'Maxence'), { name: 'Maxence', votes: 1 })
})

test('la table Supabase et les contrôles RLS sont déclarés', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261127103000_advent_day19_tcg_suggestions.sql', import.meta.url), 'utf8')
  assert.ok(migration.includes(ADVENT_DAY19_TABLE))
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /for select to authenticated/i)
  assert.match(migration, /for insert to authenticated/i)
  assert.match(migration, /for update to authenticated/i)
  assert.match(migration, /is_coach\(\)/)
  assert.match(migration, /2026-12-19/)
  assert.match(migration, /unique \(voter_id\)/)
})
