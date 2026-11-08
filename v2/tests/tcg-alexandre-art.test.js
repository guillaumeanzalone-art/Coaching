import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const art = new URL('../public/tcg/alexandre-evolutions.webp', import.meta.url);
const src = readFileSync(new URL('../src/tcg-game.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/tcg-alexandre-poison.css', import.meta.url), 'utf8');

test('five-stage Alexandre artwork exists as a real WebP image', () => {
  const sprite = readFileSync(art);
  assert.ok(sprite.length > 90000, 'sprite should contain the complete five illustrated evolutions');
  assert.equal(sprite.toString('ascii',0,4), 'RIFF');
  assert.equal(sprite.toString('ascii',8,12), 'WEBP');
});

test('Alexandre rarity map connects each level to a unique sprite frame', () => {
  const map = src.match(/alexandre:\s*\{[\s\S]*?sprite:\s*'\/tcg\/alexandre-evolutions\.webp',[\s\S]*?rarityIndex:\s*\{([^}]+)\}/);
  assert.ok(map, 'Alexandre sprite registration missing');
  const found = [...map[1].matchAll(/(common|uncommon|rare|ultra|secret):\s*([0-4])/g)];
  assert.deepEqual(found.map(m => m[1]), ['common','uncommon','rare','ultra','secret']);
  assert.deepEqual(found.map(m => Number(m[2])), [0,1,2,3,4]);
});

test('Collection, Deck, boosters and arena share the same card renderer', () => {
  assert.ok(src.includes('function renderCard('), 'shared card renderer missing');
  assert.ok(src.includes('function dedicatedCardArt('), 'dedicated artwork resolution missing');
  assert.ok(src.includes('renderCard(card)'), 'card screen integration missing');
  assert.ok(src.includes('function renderAlexandreEvolutionGallery()'), 'evolution gallery missing');
  assert.ok(src.includes('background-size:500% 100%'), 'sprite frame tiling missing');
});

test('Each Alexandre card shows the correct LVL and toxic stage decoration', () => {
  for(let i=1;i<=5;i++) assert.ok(styles.includes('.tcg-venom-lvl-'+i), 'missing LVL '+i+' art treatment');
  assert.ok(src.includes('tcg-venom-level'));
  assert.ok(src.includes('LVL ${poisonLevel}'));
  assert.ok(src.includes('tcg-venom-stage'));
});
