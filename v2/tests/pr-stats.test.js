import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validStatsRows,statsForLift,observedE1rmRows,chartGeometry,observedSummary} from '../src/pr-stats-model.js'
const row=(code,reps,load,day,extra={})=>({exercise_code:code,reps,new_load_kg:load,achieved_at:day+'T12:00:00Z',...extra})
test('only real dated positive SBD loads in supported rep ranges',()=>{
 const data=validStatsRows([row('sq',3,180,'2026-11-12'),row('bn',1,120,'2026-11-01'),row('ac',3,300,'2026-11-12'),row('sq',0,100,'2026-11-12'),row('sq',5,0,'2026-11-12'),{exercise_code:'sq',reps:1,new_load_kg:200,achieved_at:null}])
 assert.deepEqual(data.map(r=>r.exercise_code),['bn','sq'])
 assert.equal(statsForLift(data,'sq',3).length,1)
 assert.equal(statsForLift(data,'sq',1).length,0)
})
test('deduplicates dates and preserves daily declines instead of inventing a PR',()=>{
 const rows=validStatsRows([row('sq',5,180,'2026-10-01'),row('sq',5,190,'2026-10-01'),row('sq',5,175,'2026-10-08')],true)
 assert.deepEqual(rows.map(r=>r.new_load_kg),[190,175])
})
test('one dated point is centered and has finite geometry',()=>{
 const g=chartGeometry(validStatsRows([row('sq',1,340,'2026-10-01')]))
 assert.equal(g.points.length,1)
 assert.equal(g.points[0].x,(g.x1+g.x2)/2)
 assert.ok(Number.isFinite(g.points[0].y))
 assert.equal(chartGeometry([]),null)
})
test('e1RM uses exact singles and best estimated set for each lift/day',()=>{
 const rows=observedE1rmRows([row('sq',1,200,'2026-10-01'),row('sq',5,180,'2026-10-01'),row('bn',1,120,'2026-10-01')])
 assert.equal(rows.length,2)
 assert.equal(rows.find(r=>r.exercise_code==='sq').new_load_kg,210)
 assert.equal(rows.find(r=>r.exercise_code==='bn').new_load_kg,120)
})
test('volume and dates are aggregated without inflating observations',()=>{
 assert.deepEqual(observedSummary([row('bn',3,100,'2026-11-01',{set_count:2,tonnage:600}),row('sq',5,150,'2026-11-01',{set_count:3,tonnage:2250})]),{sets:5,tonnage:2850,days:1})
})
test('frontend connects observed RPC, paginated history, refresh and reference records',()=>{
 const stats=readFileSync(new URL('../src/pr-stats.js',import.meta.url),'utf8')
 const training=readFileSync(new URL('../src/training.js',import.meta.url),'utf8')
 const sbd=readFileSync(new URL('../src/sbd-pr.js',import.meta.url),'utf8')
 assert.match(stats,/athlete_observed_sbd_stats_v1/)
 assert.match(stats,/\.range\(offset,offset\+size-1\)/)
 assert.match(stats,/Records historiques/)
 assert.match(training,/observedRows: prObservedRows/)
 assert.match(training,/references: sbdPrs/)
 assert.match(training,/hydratePrStats\(true, true\)/)
 assert.match(sbd,/if \(explicit\) return null/)
 assert.match(sbd,/if \(repError \|\|/)
})
