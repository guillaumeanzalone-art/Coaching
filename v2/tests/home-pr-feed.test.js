import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mergeLatestSbdRecords } from '../src/home-pr-feed.js'

const source = readFileSync(new URL('../src/home-live.js', import.meta.url), 'utf8')
const row = (slug, lift, reps, load, date) => ({
  athlete_slug: slug, lift, reps, load_kg: load, achieved_at: date,
})

test('recent SBD PRs use genuine November 2026 dates, not the frozen August feed', () => {
  const reps = [
    row('duane', 'squat', 4, 240, '2026-11-09T10:53:42Z'),
    row('alexandre', 'deadlift', 6, 190, '2026-11-09T09:54:13Z'),
    row('allan', 'deadlift', 2, 280, '2026-11-08T17:10:04Z'),
  ]
  const legacy = [
    row('alexandre', 'bench', 1, 138, '2026-11-09T10:09:04Z'),
    row('louis', 'deadlift', 6, 210, '2026-08-29T19:47:00Z'),
  ]
  const result = mergeLatestSbdRecords(reps, legacy, 6)
  assert.deepEqual(result.map(x => x.athlete_slug + ':' + x.lift),
    ['duane:squat', 'alexandre:bench', 'alexandre:deadlift', 'allan:deadlift', 'louis:deadlift'])
  assert.equal(result[0].load_kg, 240)
  assert.equal(result[0].reps, 4)
  assert.equal(result[0].achieved_at, '2026-11-09T10:53:42.000Z')
})

test('identical records from both SBD PR tables are shown only once', () => {
  const first = row('alexandre', 'bench', 1, 138, '2026-11-09T10:09:04.945Z')
  const duplicate = row('alexandre', 'bench', 1, 138, '2026-11-09T10:09:04.946Z')
  const out = mergeLatestSbdRecords([first], [duplicate], 6)
  assert.equal(out.length, 1)
  assert.equal(out[0].load_kg, 138)
})

test('historical seed imports, corrupted loads and non-SBD lifts cannot fake fresh PRs', () => {
  const result = mergeLatestSbdRecords([
    row('guillaume', 'bench', 6, 200, null),
    row('camille', 'bench', 1, -1, '2026-11-09T11:00:00Z'),
    row('rudy', 'biceps', 8, 50, '2026-11-09T11:00:00Z'),
    row('camille', 'squat', 1, 120, 'not-a-date'),
    row('camille', 'squat', 1, 125, '2026-11-09T11:00:00Z'),
  ], [], 6)
  assert.equal(result.length, 1)
  assert.equal(result[0].athlete_slug, 'camille')
  assert.equal(result[0].previous_load_kg, null)
})

test('newer validated PR wins when a lift/reps appears more than once', () => {
  const result = mergeLatestSbdRecords(
    [row('malo', 'bench', 3, 145, '2026-11-07T15:34:41Z')],
    [row('malo', 'bench', 3, 140, '2026-11-06T15:34:41Z')],
    6
  )
  assert.equal(result.length, 1)
  assert.equal(result[0].load_kg, 145)
})

test('ordering is descending and display limit is enforced', () => {
  const rows = Array.from({length:15}, (_, i) =>
    row('athlete' + i, 'bench', i % 9 + 1, 80 + i,
      new Date(Date.UTC(2026,10,1,12,i)).toISOString()))
  const result = mergeLatestSbdRecords(rows, [], 6)
  assert.equal(result.length, 6)
  assert.equal(result[0].athlete_slug, 'athlete14')
  assert.equal(result[5].athlete_slug, 'athlete9')
})

test('home dashboard queries current PR tables and refreshes automatically without losing active tab', () => {
  assert.ok(source.includes(".from('athlete_sbd_rep_prs_v249')"))
  assert.ok(source.includes("loadLatestGroupSbdPrs(fetchLimit)"))
  assert.ok(source.includes(".not('achieved_at', 'is', null)"))
  assert.ok(!source.includes(".from('workout_activities')"))
  assert.ok(source.includes('setInterval(refresh, 60_000)'))
  assert.ok(source.includes("document.addEventListener('visibilitychange', homeLiveVisibilityHandler)"))
  assert.ok(source.includes("document.querySelector('[data-home-live]') !== container"))
  const asyncReturnPosition = source.indexOf("requestVersion !== homeLiveRequestVersion")
  const selectedTabPosition = source.indexOf('const activeTab =')
  assert.ok(selectedTabPosition > asyncReturnPosition, 'Tab selection must be read after the asynchronous fetch')
  assert.match(source, /\$\{activeTab === 'prs' \? 'active' : ''\}/)
  assert.match(source, /\$\{activeTab === 'training' \? '' : 'hidden'\}/)
})
