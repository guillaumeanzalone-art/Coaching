import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const rewards=src('../src/tcg-rewards.js');
const tracker=src('../src/training.js');
const claimSql=src('../supabase/migrations/20261112093000_tcg_successful_training_rewards_v2.sql');
const openingSql=src('../supabase/migrations/20261112095000_tcg_link_session_award_to_booster_opening.sql');
test('attribution des packs par validation Supabase, jamais par un simple jour de programme',()=>{
  assert.match(rewards,/'claim_tcg_workout_pack_v2'/);
  assert.doesNotMatch(rewards,/'claim_tcg_workout_pack_v1'/);
  assert.match(claimSql,/training_sessions_v2/);
  assert.match(claimSql,/workout_sets/);
  assert.match(claimSql,/v_session.status<>'completed'/);
  assert.match(claimSql,/min_completion_ratio/);
  assert.match(claimSql,/min_duration_seconds/);
  assert.match(claimSql,/min_set_span_seconds/);
});
test('récompense idempotente, maximum quotidien, aucune attribution client directe',()=>{
  assert.match(claimSql,/session_id uuid primary key/);
  assert.match(claimSql,/on conflict\(session_id\) do nothing/);
  assert.match(claimSql,/v_daily>=v_policy.max_packs_per_day/);
  assert.match(claimSql,/revoke all on function public.claim_tcg_workout_pack_v1/);
  assert.match(openingSql,/opening_id=v_id, booster_id=p_booster_id/);
});
test('hors ligne : récompense conservée jusqu’à synchronisation',()=>{
  assert.match(rewards,/queueClaim\(payload\)/);
  assert.match(rewards,/session_not_synced/);
  assert.match(rewards,/sets_not_synced/);
  assert.match(tracker,/flushTrainingSessionOutbox\(setSyncStatus\)/);
  assert.match(tracker,/flushTcgWorkoutPackOutbox\(\)/);
});
test('athlète informé de son gain et des raisons de refus',()=>{
  assert.match(tracker,/explainTcgAward\(result\)/);
  assert.match(tracker,/tcgPackNotice/);
  for(const code of ['duration_too_short','sets_too_fast','insufficient_sets','daily_limit'])
    assert.ok(rewards.includes(code),code);
});
