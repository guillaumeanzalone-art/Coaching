import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RARITY_RULES, DECK_SIZE, validateCatalog, validateDeck, powerScore, deckPower, chooseClosestDeck } from '../src/tcg-catalog.js';
const {cards} = JSON.parse(readFileSync(new URL('../data/tcg-catalog-snapshot.json',import.meta.url),'utf8'));
const catalog = new Map(cards.map(c=>[c.id,c]));
test('snapshot : identifiants uniques et aucune carte inventee',()=>{
 assert.ok(cards.length>0);
 assert.equal(new Set(cards.map(x=>x.id)).size,cards.length);
 const report=validateCatalog(cards);
 assert.equal(report.blocking,0,JSON.stringify(report.findings.filter(x=>x.level==='blocking')));
 assert.equal(report.overpowered,0,JSON.stringify(report.findings.filter(x=>x.level==='overpowered')));
});
test('deck de huit cartes differentes sans restriction de rarete',()=>{
 assert.equal(DECK_SIZE,8);
 const ids=cards.slice(0,8).map(c=>c.id);
 assert.equal(validateDeck(ids,catalog).valid,true);
 assert.equal(validateDeck([...ids.slice(0,7),ids[0]],catalog).valid,false);
 assert.equal(validateDeck(ids.slice(0,7),catalog).valid,false);
 const high=cards.filter(c=>c.rarity==='secret').slice(0,8).map(c=>c.id);
 assert.equal(validateDeck(high,catalog).valid,true);
});
test('une carte ajoutee est une donnee, pas une modification du moteur',()=>{
 const newCard={...cards[0],id:'new-character:common',name:'Nouveau personnage',character_slug:'new-character',booster_ids:['*'],publication_status:'draft'};
 let report=validateCatalog([...cards,newCard]);
 assert.equal(report.total,cards.length+1);
 assert.equal(report.published,cards.length);
 newCard.publication_status='published';
 report=validateCatalog([...cards,newCard]);
 assert.equal(report.published,cards.length+1);
 const extended=new Map([...catalog,[newCard.id,newCard]]);
 assert.equal(validateDeck([...cards.slice(0,7).map(c=>c.id),newCard.id],extended).valid,true);
});
test('score et matchmaking sont independants du cout de deck',()=>{
 for(const card of cards)assert.ok(Number.isFinite(powerScore(card)));
 const chosen=cards.slice(0,8),alternative=cards.slice(-8);
 const target=deckPower(chosen);
 assert.equal(chooseClosestDeck(target,[alternative,chosen]),chosen);
});
test('une carte non publiee ne peut pas entrer dans un deck',()=>{
 const pending={...cards[0],publication_status:'test'};
 const id=pending.id;
 const map=new Map(catalog);map.set(id,pending);
 assert.equal(validateDeck(cards.slice(0,8).map(c=>c.id),map).valid,false);
});
