import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  QUICK_RPE_VALUES,
  plannedLoadSuggestion,
  plannedLoadForAthlete,
  athletePrReference,
  formatPlannedLoad,
  nextPendingSet,
  progressPercent,
} from '../src/training-ux.js'

test('raccourci charge utilise la borne basse sans enregistrer une valeur inventée', () => {
  assert.equal(plannedLoadSuggestion('62,5 - 65'), 62.5)
  assert.equal(plannedLoadSuggestion('90 – 95'), 90)
  assert.equal(plannedLoadSuggestion('75'), 75)
  assert.equal(formatPlannedLoad(62.5), '62,5')
  for (const invalid of ['', 'RPE 7', null, 0, '1200 - 1250', undefined]) {
    assert.equal(plannedLoadSuggestion(invalid), null)
  }
})

test('RPE rapides couvrent les choix habituels sans enlever le sélecteur complet', async () => {
  assert.deepEqual(QUICK_RPE_VALUES, [7, 8, 8.5, 9, 9.5])
  const code = await readFile(new URL('../src/training.js', import.meta.url), 'utf8')
  assert.match(code, /data-action="training-quick-rpe"/)
  assert.match(code, /data-action="rpe"/)
  assert.match(code, /completeFoundSet\(found, \{ rpe: String\(picked\) \}\)/)
  assert.match(code, /if \(!canEdit \|\| !isSbdExercise\(exercise\)\) return/)
})

test('prochaine série saute les séries terminées et échouées, sans changer leur statut', () => {
  const day = { exercises: [
    { name: 'Squat', sets: [{ id: 'sq-1', reps: 5 }, { id: 'sq-2', reps: 3 }] },
    { name: 'Bench', sets: [{ id: 'bn-1', reps: 2 }] },
  ] }
  const status = new Map([['sq-1', 'done'], ['sq-2', 'failed'], ['bn-1', 'pending']])
  const next = nextPendingSet(day, set => status.get(set.id))
  assert.deepEqual(next, { setId: 'bn-1', exercise: 'Bench', number: 1, reps: '2' })
  assert.equal(status.get('sq-1'), 'done')
  status.set('bn-1', 'done')
  assert.equal(nextPendingSet(day, set => status.get(set.id)), null)
  assert.equal(nextPendingSet({ exercises: [] }, () => 'pending'), null)
})

test('progression bornée et mode séance sans écriture de données', async () => {
  assert.equal(progressPercent(3, 12), 25)
  assert.equal(progressPercent(12, 12), 100)
  assert.equal(progressPercent(20, 12), 100)
  assert.equal(progressPercent(0, 0), 0)
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  const code = await readFile(new URL('../src/training.js', import.meta.url), 'utf8')
  const style = await readFile(new URL('../src/training-ux.css', import.meta.url), 'utf8')
  assert.match(main, /import '\.\/training-ux\.css'/)
  assert.match(main, /const ADVENT_CALENDAR_VISIBLE = false/)
  assert.match(code, /data-action="training-focus-toggle"/)
  assert.match(code, /data-action="training-next-set"/)
  assert.match(code, /data-training-ux-sync/)
  assert.match(code, /id="trainingUxElapsed"/)
  assert.match(code, /saveLoadWithoutRender\(sourceSet, formatPlannedLoad\(plannedKg\), true\)/)
  assert.match(code, /rememberSetViewport\(sourceSet.id\)/)
  assert.match(style, /min-height: 44px/)
  assert.match(style, /safe-area-inset-bottom/)
})


test('charge prévue SBD = pourcentage de son vrai PR ×1, arrondi à 2,5 kg', () => {
  const prs = {
    squat: { 1: { load_kg: 180 }, 5: { load_kg: 165 } },
    bench: { 1: { load_kg: 122.5 } },
    deadlift: { 1: { load_kg: 230 } },
  }
  assert.deepEqual(plannedLoadForAthlete(
    { type: 'SQ', name: 'Comp squat' },
    { percent: 81, loadRange: '155 - 160' }, prs
  ), {
    loadKg: 145,
    source: 'pr',
    percent: 81,
    reference: { lift: 'squat', oneRmKg: 180, reps: 1, estimated: false },
  })
  const bench = plannedLoadForAthlete({ type: 'BN' }, { percent: '85%' }, prs)
  assert.equal(bench.loadKg, 105) // 122,5 × 85 % = 104,125
  assert.equal(bench.source, 'pr')
  assert.equal(plannedLoadForAthlete({ type: 'DL' }, { percent: 75 }, prs).loadKg, 172.5)
})

test('nouveau PR change la suggestion sans modifier le programme', () => {
  const exercise = { type: 'SQ', name: 'Comp squat' }
  const prescribed = Object.freeze({ percent: 80, loadRange: '140 - 145' })
  const prs = { squat: { 1: { load_kg: 180 } } }
  assert.equal(plannedLoadForAthlete(exercise, prescribed, prs).loadKg, 145)
  prs.squat[1].load_kg = 190
  assert.equal(plannedLoadForAthlete(exercise, prescribed, prs).loadKg, 152.5)
  assert.deepEqual(prescribed, { percent: 80, loadRange: '140 - 145' })
})

test('sans x1 : charge basée sur le meilleur e1RM ×2 à ×6 signalé comme estimation', () => {
  const prs = { deadlift: {
    2: { load_kg: 180 },
    5: { load_kg: 165 },
    9: { load_kg: 250 }, // x9 volontairement ignoré
  } }
  const reference = athletePrReference({ type: 'DL' }, prs)
  assert.equal(reference.estimated, true)
  assert.equal(reference.reps, 5)
  assert.equal(reference.oneRmKg, 192.5)
  const planned = plannedLoadForAthlete({ type: 'DL' }, { percent: 80 }, prs)
  assert.equal(planned.source, 'pr-estime')
  assert.equal(planned.loadKg, 155)
})

test('sans PR, sans % ou sur exercice accessoire : garder la valeur programmée', () => {
  const prs = { squat: { 1: { load_kg: 180 } } }
  const sourceSet = { percent: 80, loadRange: '130 - 135' }
  assert.deepEqual(plannedLoadForAthlete({ type: 'SQ' }, sourceSet, {}), {
    loadKg: 130, source: 'programme', percent: null, reference: null,
  })
  assert.equal(plannedLoadForAthlete({ type: 'SQ' }, { loadRange: '100 - 105' }, prs).loadKg, 100)
  assert.equal(plannedLoadForAthlete({ type: 'ACCESSORY', name: 'Squat machine' }, sourceSet, prs).loadKg, 130)
  assert.equal(plannedLoadForAthlete({ type: 'SQ' }, { percent: 75 }, {}), null)
  assert.equal(plannedLoadForAthlete({ type: 'SQ' }, { percent: 200, loadRange: '125 - 135' }, prs).loadKg, 125)
  assert.equal(athletePrReference({ type: 'SQ' }, { squat: { 1: { load_kg: 0 } } }), null)
})

test('interface recalculée au clic depuis les records, sans données PR inscrites dans le DOM', async () => {
  const code = await readFile(new URL('../src/training.js', import.meta.url), 'utf8')
  assert.match(code, /const planned = plannedLoadForAthlete\(exercise, sourceSet, sbdPrs\)/)
  assert.match(code, /const isPrBased = planned\?\.source/)
  assert.match(code, /const plannedKg = planned\.loadKg/)
  assert.match(code, /formatPlannedLoad\(plannedKg\)/)
  assert.match(code, /const prBasisLabel =/)
  assert.match(code, /Renseigner la charge prévue|Charge calculée/)
})
