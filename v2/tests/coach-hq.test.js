import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  normalizeCoachSnapshot,
  coachHqPriority,
  coachHqRows,
  coachHqSummary,
  COACH_HQ_FILTERS,
  COACH_HQ_SORTS,
} from '../src/coach-hq.js'

const sample = {
  generated_at: '2026-11-27T19:00:00Z',
  athletes: [
    {slug:'louis', name:'Louis', block_title:'Bloc 6', total_weeks:4, week_number:1, completed_days:3, planned_days:5, rated_sets:28, over_8:11, over_85:6, last_over_8:4, last_over_85:3, last_session_at:'2026-11-27T19:00:00Z', sessions_7d:3, top_exercises:[{name:'Squat',over_8:5,over_85:3}]},
    {slug:'tom', name:'Tom Gibertini', block_title:'Bloc 7', total_weeks:4, week_number:1, rated_sets:50, over_8:7, over_85:3, last_over_8:1, last_over_85:1, last_session_at:'2026-11-26T18:00:00Z', sessions_7d:4},
    {slug:'maxence', name:'Maxence', block_title:'Bloc 3', total_weeks:3, week_number:1, rated_sets:70, over_8:8, over_85:1, last_session_at:'2026-11-25T18:00:00Z', sessions_7d:2},
    {slug:'noe', name:'Noé', block_title:'Bloc 4', total_weeks:4, week_number:null, rated_sets:0, over_8:0, over_85:0, last_session_at:null, sessions_7d:0},
  ],
}

test('normalise et conserve les vrais décomptes sans RPE moyen', () => {
  const result = normalizeCoachSnapshot(sample)
  assert.equal(result.athletes.length, 4)
  const louis = result.athletes[0]
  assert.equal(louis.rated, 28)
  assert.equal(louis.over8, 11)
  assert.equal(louis.over85, 6)
  assert.deepEqual(louis.exercises[0], {name:'Squat',over8:5,over85:3})
  assert.equal(result.athletes[3].week, 0)
  assert.throws(() => normalizeCoachSnapshot({}), /invalide/)
})

test('alerte indicative, sans modifier les charges prescrites', () => {
  const rows = normalizeCoachSnapshot(sample).athletes
  assert.equal(coachHqPriority(rows[0]), 'high')
  assert.equal(coachHqPriority(rows[1]), 'watch')
  assert.equal(coachHqPriority(rows[2]), 'watch')
  assert.equal(coachHqPriority(rows[3]), 'missing')
  assert.ok(COACH_HQ_FILTERS.includes('high'))
  assert.ok(COACH_HQ_SORTS.includes('over85'))
})

test('classement par nombre strict de dépassements et recherche accent-insensible', () => {
  const rows = normalizeCoachSnapshot(sample).athletes
  assert.deepEqual(coachHqRows(rows).map(r => r.name), ['Louis','Maxence','Tom Gibertini','Noé'])
  assert.deepEqual(coachHqRows(rows, { sort: 'over85' }).map(r => r.name), ['Louis','Tom Gibertini','Maxence','Noé'])
  assert.deepEqual(coachHqRows(rows, { filter: 'high' }).map(r => r.name), ['Louis'])
  assert.deepEqual(coachHqRows(rows, { filter: 'missing' }).map(r => r.name), ['Noé'])
  assert.deepEqual(coachHqRows(rows, { search: 'noe' }).map(r => r.name), ['Noé'])
  assert.deepEqual(coachHqRows(rows, { sort: 'recent' }).slice(0,1).map(r=>r.name), ['Louis'])
})

test('totaux globaux et absence de double comptage involontaire', () => {
  const s = coachHqSummary(normalizeCoachSnapshot(sample).athletes)
  assert.deepEqual(s, { athletes:4, over8:26, over85:10, sessions7d:9 })
  assert.ok(s.over85 <= s.over8)
})

test('RPC réservé au coach; aucun accès au calendrier de l Avent réactivé', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261127214000_coach_hq_snapshot_v1.sql', import.meta.url), 'utf8')
  assert.match(sql, /SECURITY INVOKER/)
  assert.match(sql, /NOT public\.is_coach\(\)/)
  assert.match(sql, /REVOKE ALL.+PUBLIC, anon/i)
  assert.match(sql, /v\.rpe > 8\)/)
  assert.match(sql, /v\.rpe > 8\.5\)/)
  assert.match(sql, /s\.status = 'completed'/)
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(main, /data-action="coach-hq"/)
  assert.match(main, /currentMember\?\.role === 'coach'/)
  assert.match(main, /const ADVENT_CALENDAR_VISIBLE = false/)
})
