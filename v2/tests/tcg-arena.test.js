import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_START_HP,
  ARENA_START_PILLZ,
  ARENA_FURY_COST,
  arenaBaseStats,
  arenaTeamActive,
  arenaCombatStats,
  createTcgArena,
  chooseTcgArenaAiMove,
  resolveTcgArenaRound,
} from '../src/tcg-arena.js';

const card = (id, family = 'tempo', attack = 8, guard = 6, rank = 2) => ({
  id,
  slug: id,
  athlete: { name: id },
  archetype: { id: family, label: family },
  attack,
  guard,
  rarityMeta: { rank },
});
const player = [
  card('all-a', 'power', 9, 6),
  card('all-b', 'guard', 7, 8),
  card('all-c', 'tempo', 8, 6),
  card('all-d', 'chaos', 8, 5),
];
const enemy = [
  card('rival-a', 'guard', 7, 8),
  card('rival-b', 'power', 9, 7),
  card('rival-c', 'technique', 8, 6),
  card('rival-d', 'chaos', 8, 8),
];
const forced = (index = 0, pillz = 0, fury = false) => ({ index, pillz, fury });

test('quatre combattants, douze vies et douze Pillz par camp', () => {
  const arena = createTcgArena(player, enemy);
  assert.equal(arena.playerHand.length, 4);
  assert.equal(arena.aiHand.length, 4);
  assert.equal(arena.playerHp, ARENA_START_HP);
  assert.equal(arena.aiHp, ARENA_START_HP);
  assert.equal(arena.playerPillz, ARENA_START_PILLZ);
  assert.equal(arena.history.length, 0);
});

test('les statistiques restent bornées même sur les cartes extrêmes', () => {
  assert.equal(arenaBaseStats(card('broken', 'power', 9999, 9999, 5)).power, 9);
  assert.equal(arenaBaseStats(card('weak', 'power', -10, -10, 1)).power >= 3, true);
});

test('un duo de même archétype active son bonus de famille', () => {
  const team = [card('p1', 'power'), card('p2', 'power'), ...player.slice(2)];
  const arena = createTcgArena(team, enemy);
  assert.equal(arenaTeamActive(arena, 'player', team[0]), true);
  assert.equal(arenaTeamActive(arena, 'player', team[2]), false);
  const base = arenaCombatStats(team[0], enemy[0], 2, 1, false, false);
  const boosted = arenaCombatStats(team[0], enemy[0], 2, 1, false, true);
  assert.ok(boosted.attack > base.attack);
});

test('puissance et Pillz augmentent bien la valeur de combat', () => {
  const a = arenaCombatStats(player[0], enemy[0], 0, 0, false, false);
  const b = arenaCombatStats(player[0], enemy[0], 3, 0, false, false);
  assert.ok(b.attack > a.attack);
});

test('Fury coûte trois Pillz supplémentaires et ajoute deux dégâts', () => {
  const arena = createTcgArena(player, enemy);
  const standard = resolveTcgArenaRound(arena, forced(0, 3), () => .2, forced(0, 0));
  const fury = resolveTcgArenaRound(arena, forced(0, 3, true), () => .2, forced(0, 0));
  assert.equal(standard.playerPillz - fury.playerPillz, ARENA_FURY_COST);
  assert.equal(fury.history[0].damage - standard.history[0].damage, 2);
});

test('impossible de dépenser plus de Pillz que le stock', () => {
  const arena = createTcgArena(player, enemy);
  assert.throws(() => resolveTcgArenaRound(arena, forced(0, 10, true), () => .1, forced(0, 0)), /Pillz/);
  assert.throws(() => resolveTcgArenaRound(arena, forced(22, 0), () => .1, forced(0, 0)), /carte/);
});

test('quatre rounds maximum et aucun recyclage des cartes', () => {
  let arena = createTcgArena(player, enemy);
  for (let round = 1; round <= 4 && !arena.finished; round++) {
    arena = resolveTcgArenaRound(arena, forced(0, 0), () => .5, forced(0, 0));
    assert.equal(arena.history.length, round);
    assert.equal(arena.playerHand.length, 4 - round);
  }
  assert.equal(arena.finished, true);
  assert.ok(['win', 'loss', 'draw'].includes(arena.result));
  assert.throws(() => resolveTcgArenaRound(arena, forced(0, 0)), /terminé/);
});

test('IA : ses mises ne dépassent jamais les ressources disponibles', () => {
  let arena = createTcgArena(player, enemy);
  for (let round = 1; round <= 4 && !arena.finished; round++) {
    const choice = chooseTcgArenaAiMove(arena, () => .3);
    assert.ok(choice.pillz + (choice.fury ? ARENA_FURY_COST : 0) <= arena.aiPillz);
    arena = resolveTcgArenaRound(arena, forced(0, 0), () => .3, choice);
  }
});

test('lancer un round ne modifie pas en place l’état précédent', () => {
  const arena = createTcgArena(player, enemy);
  const updated = resolveTcgArenaRound(arena, forced(0, 2), () => .4, forced(0, 2));
  assert.equal(arena.playerPillz, 12);
  assert.equal(arena.history.length, 0);
  assert.equal(updated.playerPillz, 10);
  assert.equal(updated.history.length, 1);
});
