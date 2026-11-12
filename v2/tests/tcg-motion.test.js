import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TCG_MOTION,rarityCss,rarityFx,eventDuration,deviceMotionSettings} from '../src/tcg-motion-config.js';
import {createTcgTimeline} from '../src/tcg-timeline.js';
import {buildTcgRoundEvents} from '../src/tcg-combat-events.js';
import {createTcgArena,resolveTcgArenaRound} from '../src/tcg-arena.js';
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const card=(id,rarity='rare',family='guard',power=5,damage=3)=>({
  id,slug:id,rarity,rarityMeta:{rank:3},archetype:{id:family,label:family},
  ability_type:family,faction:family,attack:8,guard:6,power,damage,athlete:{name:id}
});
const lineup=prefix=>Array.from({length:4},(_,i)=>card(prefix+i));
test('les cinq raretés ont des intensités progressives et des variables cohérentes',()=>{
  assert.deepEqual(Object.keys(TCG_MOTION.rare),['common','uncommon','rare','ultra','secret']);
  const levels=Object.keys(TCG_MOTION.rare).map(r=>rarityFx(r));
  for(let i=1;i<levels.length;i++)assert.ok(levels[i].reveal>levels[i-1].reveal);
  assert.ok(levels.at(-1).reveal<=2000);
  assert.match(rarityCss('secret'),/--tcg-rarity-color/);
  assert.equal(deviceMotionSettings({matchMedia:()=>({matches:true})}).particles,0);
  assert.equal(eventDuration('damage',{speed:2})<eventDuration('damage',{speed:1}),true);
});
test('la timeline est annulable sans callback tardif ni changement du résultat',()=>{
  const pending=[],steps=[],completions=[];
  let nextId=0;
  const schedule=(fn,delay)=>{const item={id:++nextId,fn,delay};pending.push(item);return item.id};
  const clear=id=>{const i=pending.findIndex(t=>t.id===id);if(i>=0)pending.splice(i,1)};
  const timeline=createTcgTimeline({
    onStep:e=>steps.push(e.type),onComplete:e=>completions.push(e),
    setTimeoutFn:schedule,clearTimeoutFn:clear
  });
  const events=[{type:'locked',duration:260},{type:'reveal',duration:300},{type:'damage',duration:400}];
  timeline.play(events);
  assert.deepEqual(steps,['locked']);
  timeline.setSpeed(2);
  pending.shift().fn();
  assert.deepEqual(steps,['locked','reveal']);
  assert.equal(pending[0].delay,150);
  timeline.skip();
  assert.equal(timeline.active,false);
  assert.equal(pending.length,0);
  assert.equal(completions.length,1);
  assert.equal(completions[0].skipped,true);
  timeline.play(events);
  timeline.cancel();
  assert.equal(completions.length,1);
  assert.equal(pending.length,0);
});
test('le lecteur est fidèle aux résultats exacts du moteur, y compris égalité et bouclier',()=>{
  const start=createTcgArena(lineup('player'),lineup('enemy'));
  const result=resolveTcgArenaRound(start,{index:0,pillz:2,fury:false},()=>.5,{index:0,pillz:2,fury:false});
  const h=result.history.at(-1),events=buildTcgRoundEvents(start,result);
  assert.equal(h.playerAttack,h.aiAttack);
  assert.equal(events.find(e=>e.type==='priority')?.reason,'round_initiative');
  assert.equal(events.find(e=>e.type==='damage')?.amount,h.damage);
  assert.equal(events.find(e=>e.type==='damage')?.toHp,h.aiHpAfterHit);
  assert.equal(result.aiHp,h.aiHpAfter);
  assert.equal(events.find(e=>e.type==='attack')?.playerAttack,h.playerAttack);
  assert.equal(events.find(e=>e.type==='energy')?.playerPillz,result.playerPillz);
  const expected=h.playerEffects.concat(h.aiEffects);
  const modifiers=events.filter(e=>e.type==='modifier');
  assert.deepEqual(modifiers.map(e=>e.delta),expected.map(e=>e.delta));
  assert.ok(events.findIndex(e=>e.type==='attack')<events.findIndex(e=>e.type==='clash'));
  assert.ok(events.findIndex(e=>e.type==='clash')<events.findIndex(e=>e.type==='damage'));
});
test('poison réel puis fin de partie : événements ordonnés, aucune mécanique inventée',()=>{
  const player=lineup('p');player[0]=card('toxic','rare','poison',8,4);
  const start=createTcgArena(player,lineup('e'));
  const one=resolveTcgArenaRound(start,{index:0,pillz:3,fury:false},()=>.5,{index:0,pillz:0,fury:false});
  const events=buildTcgRoundEvents(start,one);
  assert.equal(events.some(e=>e.type==='poison_apply'),one.history.at(-1).poisonApplied);
  assert.equal(events.some(e=>e.type==='heal'),false);
  if(one.history.at(-1).poisonApplied){
    const two=resolveTcgArenaRound(one,{index:0,pillz:0,fury:false},()=>.5,{index:0,pillz:0,fury:false});
    const tick=buildTcgRoundEvents(one,two).find(e=>e.type==='poison' && e.side==='ai');
    assert.equal(tick?.amount,two.history.at(-1).venomDamageToAi);
  }
});
test('le booster affiché repose exclusivement sur les cartes renvoyées par le RPC v2',()=>{
  const game=src('../src/tcg-game.js'),open=game.slice(game.indexOf('  async function openPack()'),game.indexOf('  async function saveDeck()'));
  assert.match(open,/open_tcg_pack_v2/);
  assert.match(open,/result\?\.cards/);
  assert.match(open,/packPullMeta=cards\.map/);
  assert.doesNotMatch(open,/drawBooster\(/);
  assert.match(game,/tcg-fast-mode/);
  assert.match(game,/tcg-skip-pack/);
  assert.match(game,/tcg-skip-combat/);
  assert.match(game,/data-tcg-hpbar/);
  assert.match(game,/cleanupTcgView\(\)/);
  assert.match(game,/onTcgVisibility/);
});

test('quitter un écran annule ou neutralise les callbacks différés',()=>{
  const game=src('../src/tcg-game.js'),css=src('../src/tcg-motion.css');
  assert.match(game,/const viewMounted = \(\) =>/);
  assert.match(game,/if\(!viewMounted\(\)\)/);
  assert.match(game,/document\.removeEventListener\('visibilitychange',onTcgVisibility\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/tcg-impact-sparks/);
});
