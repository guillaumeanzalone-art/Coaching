#!/usr/bin/env node
// Simulation proxy reproductible : les 8 cartes sont évaluées en 4 rounds,
// avec bluff et gestion de Pillz, mais sans reproduire l'intégralité des animations.
import { readFileSync } from 'node:fs';
import { powerScore, deckPower, DECK_SIZE, validateCatalog } from '../src/tcg-catalog.js';
const load = path => { const obj = JSON.parse(readFileSync(path,'utf8')); return (Array.isArray(obj)?obj:obj.cards).filter(x=>x.publication_status==='published'); };
const before = process.argv[2] || new URL('../data/tcg-catalog-snapshot.json', import.meta.url);
const after = process.argv[3];
const seed = Number(process.env.TCG_SIM_SEED || 20261112) >>> 0, iterations=Number(process.env.TCG_SIM_GAMES || 3000);
function run(cards, baseSeed=seed) {
  let rng=baseSeed; const random=()=> ((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
  const shuffled=a=>a.map(x=>({x,r:random()})).sort((a,b)=>a.r-b.r).map(x=>x.x);
  const stats=new Map(cards.map(c=>[c.id,{wins:0,played:0,selected:0}]));
  const factions={}, pairs={}, rarityDiff={};
  const decks=[];
  for(let i=0;i<iterations*2;i++){
    const deck=shuffled(cards).slice(0,DECK_SIZE);
    if(deck.length<DECK_SIZE) break;
    decks.push(deck);
  }
  for(let i=0;i+1<decks.length;i+=2){
    const a=decks[i],b=decks[i+1];
    const sa=deckPower(a),sb=deckPower(b);
    let hpA=12,hpB=12,energyA=12,energyB=12;
    const handA=shuffled(a).slice(0,4),handB=shuffled(b).slice(0,4);
    for(let j=0;j<4;j++){
      const ca=handA[j],cb=handB[j],ba=Math.min(energyA,Math.floor(random()*5)),bb=Math.min(energyB,Math.floor(random()*5));
      energyA-=ba;energyB-=bb;
      const aa=Number(ca.power)*(ba+1)+random()*4,ab=Number(cb.power)*(bb+1)+random()*4;
      const won=aa>=ab,hit=Math.max(1,Number((won?ca:cb).damage));
      if(won)hpB-=hit;else hpA-=hit;
      for(const c of [ca,cb])stats.get(c.id).played++;
    }
    const result=hpA===hpB ? (random()<0.5) : hpA>hpB;
    for(const c of (result?a:b))stats.get(c.id).wins++;
    for(const deck of [a,b]){ const primary=deck[0].faction; (factions[primary]||=( {wins:0,games:0})).games++;}
    (factions[(result?a:b)[0].faction] ||= {wins:0,games:0}).wins++;
    const winning=(result?a:b);
    for(let j=0;j<winning.length;j++) for(let k=j+1;k<winning.length;k++){const key=[winning[j].id,winning[k].id].sort().join(' + ');pairs[key]=(pairs[key]||0)+1;}
    const diff=Math.round(Math.abs(sa-sb)/20)*20,bucket=String(diff);
    (rarityDiff[bucket]||={matches:0,strongerWon:0}).matches++;
    const stronger=sa>=sb?'a':'b';
    if((result?'a':'b')===stronger)rarityDiff[bucket].strongerWon++;
  }
  const rank=[...stats].map(([id,x])=>({id,played:x.played,wins:x.wins,winRate:x.played ? x.wins/x.played : 0}));
  return {seed:baseSeed,games:Math.floor(decks.length/2),cards:cards.length,validation:validateCatalog(cards),
    factions,rarityGap:rarityDiff,
    winningCards:rank.sort((a,b)=>b.wins-a.wins).slice(0,15),
    unusedCards:rank.filter(x=>x.played===0).map(x=>x.id),
    winningPairs:Object.entries(pairs).sort((a,b)=>b[1]-a[1]).slice(0,15)};
}
const old=run(load(before));const newer=after?run(load(after)):null;
console.log(JSON.stringify({before:old,after:newer,delta:newer?{
  cardCount:newer.cards-old.cards, factionWins:Object.fromEntries(Object.keys({...old.factions,...newer.factions}).map(k=>[k,(newer.factions[k]?.wins||0)-(old.factions[k]?.wins||0)]))
}:null},null,2));
