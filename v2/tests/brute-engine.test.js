import test from 'node:test'
import assert from 'node:assert/strict'

import {
  generateFightTimeline,
  replayFingerprint,
} from '../src/brute-engine.js'

function fighter(slug, overrides = {}) {
  return {
    slug,
    name: slug,
    level: 1,
    hp: 100,
    strength: 12,
    agility: 10,
    speed: 11,
    weapons: ['fists'],
    skills: [],
    pets: [],
    appearance: {},
    loadout: {
      weapon: 'fists',
    },
    activity: {
      training_score: 25,
      steps_score: 25,
      sleep_score: 25,
      power: 55,
    },
    ...overrides,
  }
}

test('GA Brute generates a playable deterministic fight timeline', () => {
  const input = {
    seed: 20261016,
    attacker: fighter('alpha'),
    defender: fighter('beta', {
      strength: 11,
      agility: 12,
      speed: 10,
    }),
  }

  const first =
    generateFightTimeline(input)

  const second =
    generateFightTimeline(input)

  assert.ok(
    first.events.length > 3,
    'timeline should contain fight events'
  )

  assert.equal(
    first.events[0]?.type,
    'START'
  )

  assert.ok(
    first.events.some(
      event =>
        event.type === 'WINDUP'
    ),
    'timeline should contain a windup phase'
  )

  const attacks =
    first.events.filter(
      event =>
        event.type === 'ATTACK'
    )

  assert.ok(
    attacks.length > 0,
    'timeline should contain at least one attack'
  )

  for (const attack of attacks) {
    assert.ok(
      Number.isFinite(
        Number(
          attack.knockback
        )
      ),
      'attack knockback should be computed after impact'
    )

    assert.ok(
      Number(attack.knockback) >= 4 &&
      Number(attack.knockback) <= 72,
      'attack knockback should remain inside visual bounds'
    )
  }

  assert.equal(
    replayFingerprint(first),
    replayFingerprint(second),
    'same seed and fighters should replay identically'
  )
})
