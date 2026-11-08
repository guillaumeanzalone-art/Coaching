import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arenaCombatStats, arenaBaseStats, createTcgArena, resolveTcgArenaRound } from '../src/tcg-arena.js';

const load = path => readFileSync(new URL(path, import.meta.url));
const src = load('../src/tcg-game.js').toString('utf8');
const css = load('../src/tcg-hugo-forge.css').toString('utf8');

const card = (slug, rarity = 1, archetype = 'fire') => ({
  id: slug + '-' + rarity, slug,
  athlete: { name: slug },
  rarityMeta: { rank: rarity },
  archetype: { id: archetype, label: archetype },
  attack: 8,
  guard: 6,
});

test('Hugo: real five-stage sprite stored as a valid nonempty WebP', () => {
  const asset = load('../public/tcg/hugo-forgeron-evolutions.webp');
  assert.ok(asset.length > 150000, 'full five-art sprite should be included in the repository');
  assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(asset.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.equal(asset.readUInt32LE(4) + 8, asset.length);
});

test('Hugo: all five rarities address unique image panels in order', () => {
  const match = src.match(/hugo:\s*\{\s*sprite:\s*'\/tcg\/hugo-forgeron-evolutions\.webp',\s*rarityIndex:\s*\{([^}]+)\}/);
  assert.ok(match, 'Hugo artwork not registered');
  const mappings = [...match[1].matchAll(/(common|uncommon|rare|ultra|secret):\s*([0-4])/g)];
  assert.deepEqual(mappings.map(m => m[1]), ['common','uncommon','rare','ultra','secret']);
  assert.deepEqual(mappings.map(m => Number(m[2])), [0,1,2,3,4]);
  assert.ok(src.includes('index * 25'), 'sprite panels must map to 0,25,50,75,100%');
});

test('Hugo: gallery, collection, booster reveal and combat rely on shared card renderer', () => {
  assert.match(src, /function renderHugoEvolutionGallery\(\)/);
  assert.ok(src.includes('${renderHugoEvolutionGallery()}'), 'gallery is not mounted');
  assert.match(src, /catalog\.get\(cardId\('hugo', rarity\)\)/);
  assert.match(src, /const isHugo = card\.slug === 'hugo'/);
  assert.match(src, /tcg-card--hugo tcg-forge-lvl-/);
  assert.match(src, /function renderCard\(/);
  assert.match(src, /function renderDuel\(/);
});

test('Hugo: full-height sprite and anchored stats prevent invisible artwork regression', () => {
  const art = css.match(/\.tcg-app\.tcg-spider \.tcg-card--hugo \.tcg-card-art\{([^}]+)\}/);
  assert.ok(art, 'art container style absent');
  assert.match(art[1], /position:absolute/);
  assert.match(art[1], /height:100%/);
  const sprite = css.match(/\.tcg-app\.tcg-spider \.tcg-card--hugo\.tcg-card--illustrated \.tcg-illustration-sprite\{([^}]+)\}/);
  assert.ok(sprite, 'Hugo sprite presentation missing');
  assert.match(sprite[1], /height:100%/);
  assert.match(sprite[1], /opacity:1/);
  assert.match(sprite[1], /visibility:visible/);
  assert.match(sprite[1], /background-size:500% 100%/);
  const stats = css.match(/\.tcg-app\.tcg-spider \.tcg-card--hugo \.tcg-card-body,[\s\S]*?\{([^}]+)\}/);
  assert.ok(stats);
  assert.match(stats[1], /position:absolute/);
  assert.match(stats[1], /bottom:7px/);
});

test('Hugo: level artwork and ember intensity increase from 1 to 5', () => {
  for(let n=1;n<=5;n++){
    assert.ok(css.includes('tcg-forge-lvl-'+n), 'Missing LVL '+n+' frame treatment');
  }
  assert.match(src, /tcg-forge-lvl/);
  assert.match(src, /LVL \$\{fireLevel\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('Hugo Fire: spending two Pillz builds an attack advantage', () => {
  const hugo = card('hugo');
  const enemy = card('rival', 1, 'guard');
  const one = arenaCombatStats(hugo, enemy, 1, 1, false, false);
  const two = arenaCombatStats(hugo, enemy, 2, 1, false, false);
  assert.ok(two.attack - one.attack >= one.power + 2);
});

test('Hugo Fire: family synergy grants power and Fury gains additional damage', () => {
  const hugo = card('hugo', 5);
  const rival = card('rival', 1, 'guard');
  const normal = arenaCombatStats(hugo, rival, 2, 1, false, false);
  const family = arenaCombatStats(hugo, rival, 2, 1, false, true);
  const fury = arenaCombatStats(hugo, rival, 2, 1, true, false);
  assert.equal(family.power, normal.power + 1);
  assert.equal(fury.damage, normal.damage + 3);
});

test('Hugo Fire: can complete a real round without affecting other cards', () => {
  const hand = [card('hugo'),card('support1',1,'guard'),card('support2',1,'tempo'),card('support3',1,'power')];
  const enemy = [card('rival1',1,'power'),card('rival2',1,'guard'),card('rival3',1,'tempo'),card('rival4',1,'chaos')];
  const battle = createTcgArena(hand, enemy);
  const after = resolveTcgArenaRound(battle,{index:0,pillz:2,fury:false},()=>0.5,{index:0,pillz:1,fury:false});
  assert.equal(after.history.length, 1);
  assert.equal(after.playerHand.length, 3);
  assert.equal(battle.playerHand.length, 4);
});
