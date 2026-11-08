import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url));
const src = read('../src/tcg-game.js').toString('utf8');
const css = read('../src/tcg-benoit-earth.css').toString('utf8');

test('Benoît: all five supplied images are packaged in a valid WebP sprite', () => {
  const file = read('../public/tcg/benoit-terre-evolutions.webp');
  assert.ok(file.length > 100000, 'Expected five original artworks, not placeholders');
  assert.equal(file.subarray(0,4).toString('ascii'), 'RIFF');
  assert.equal(file.subarray(8,12).toString('ascii'), 'WEBP');
  assert.equal(file.readUInt32LE(4) + 8, file.length);
});

test('Benoît: five rareties map to separate sprite panels, ordered LVL 1–5', () => {
  const pattern = /benoit:\s*\{\s*\/\/[^\n]*\n\s*sprite:\s*'\/tcg\/benoit-terre-evolutions\.webp',\s*rarityIndex:\s*\{([^}]+)\}/;
  const found = src.match(pattern);
  assert.ok(found, 'Benoît mapping is absent');
  const levels = [...found[1].matchAll(/(common|uncommon|rare|ultra|secret):\s*([0-4])/g)];
  assert.deepEqual(levels.map(z => z[1]), ['common','uncommon','rare','ultra','secret']);
  assert.deepEqual(levels.map(z => Number(z[2])), [0,1,2,3,4]);
  assert.match(src,/position:\s*index \* 25/);
});

test('Benoît: gallery and shared card renderer support collection, packs, decks and battle', () => {
  assert.match(src,/function renderBenoitEvolutionGallery\(\)/);
  assert.ok(src.includes('${renderBenoitEvolutionGallery()}'), 'Gallery not mounted');
  assert.match(src,/catalog\.get\(cardId\('benoit', rarity\)\)/);
  assert.match(src,/const isBenoit = card\.slug === 'benoit'/);
  assert.match(src,/tcg-card--benoit tcg-earth-lvl-/);
  assert.match(src,/function dedicatedCardArt\(/);
  assert.match(src,/function renderCard\(/);
  assert.match(src,/function renderDuel\(/);
});

test('Benoît: full-art image has a real height, image remains visible and stats stay anchored', () => {
  const art = css.match(/\.tcg-app\.tcg-spider \.tcg-card--benoit \.tcg-card-art\{([^}]+)\}/);
  assert.ok(art);
  assert.match(art[1], /position:absolute/);
  assert.match(art[1], /height:100%/);
  const sprite = css.match(/\.tcg-app\.tcg-spider \.tcg-card--benoit\.tcg-card--illustrated \.tcg-illustration-sprite\{([^}]+)\}/);
  assert.ok(sprite);
  assert.match(sprite[1], /height:100%/);
  assert.match(sprite[1], /opacity:1/);
  assert.match(sprite[1], /visibility:visible/);
  assert.match(sprite[1], /background-size:500% 100%/);
  const body = css.match(/\.tcg-app\.tcg-spider \.tcg-card--benoit\.tcg-card--full-art \.tcg-card-body,[\s\S]*?\{([^}]+)\}/);
  assert.ok(body);
  assert.match(body[1], /position:absolute/);
  assert.match(body[1], /bottom:7px/);
});

test('Benoît: LVL 1–5 and shine effects exist with motion-accessibility fallback', () => {
  for(let level=1;level<=5;level++)
    assert.ok(css.includes('tcg-earth-lvl-'+level), 'Missing LVL '+level);
  assert.ok(src.includes('LVL ${poisonLevel}'));
  assert.match(css, /@keyframes benoitFoilGlide/);
  assert.match(css, /@keyframes benoitEarthFloat/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
