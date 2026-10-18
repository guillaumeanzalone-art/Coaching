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


test('GA Brute dodge block and thrown motion metadata stay in safe bounds', () => {
  let sawDodge = false
  let sawBlock = false
  let sawThrow = false

  for (
    let seed = 1;
    seed <= 240;
    seed += 1
  ) {
    const timeline =
      generateFightTimeline({
        seed,
        attacker:fighter(
          'thrower',
          {
            agility:18,
            speed:17,
            weapons:['plate20'],
            loadout:{
              weapon:'plate20',
            },
          }
        ),
        defender:fighter(
          'defender',
          {
            agility:18,
            speed:16,
            weapons:['belt'],
            loadout:{
              weapon:'belt',
            },
          }
        ),
      })

    timeline.events.forEach(
      (event,index) => {
        if (event.type === 'DODGE') {
          sawDodge = true
          assert.ok(
            Number(event.distance) >= 7 &&
            Number(event.distance) <= 16,
            'dodge distance should remain inside visual bounds'
          )
        }

        if (event.type === 'BLOCK') {
          sawBlock = true
          assert.ok(
            Number(event.knockback) >= 5 &&
            Number(event.knockback) <= 12,
            'block knockback should remain controlled'
          )
        }

        if (event.type === 'ATTACK') {
          assert.ok(
            Number(event.impactVariant) >= 0 &&
            Number(event.impactVariant) <= 4,
            'attack impact variant should be one of the five hit poses'
          )
        }

        if (event.type === 'WEAPON_THROW') {
          sawThrow = true

          const next =
            timeline.events[
              index + 1
            ]

          assert.notEqual(
            next?.type,
            'MOVE',
            'a thrown weapon should resolve from range instead of forcing melee movement'
          )
        }
      }
    )

    if (
      sawDodge &&
      sawBlock &&
      sawThrow
    ) {
      break
    }
  }

  assert.ok(
    sawDodge,
    'test seeds should exercise at least one dodge'
  )

  assert.ok(
    sawBlock,
    'test seeds should exercise at least one block'
  )

  assert.ok(
    sawThrow,
    'test seeds should exercise at least one weapon throw'
  )
})


test('sleep score changes XP only and does not change the combat timeline', () => {
  const base = {
    seed: 424242,
    attacker: fighter('awake',{
      activity:{
        training_score:55,
        steps_score:65,
        sleep_score:0,
        power:120,
      },
    }),
    defender: fighter('target',{
      activity:{
        training_score:45,
        steps_score:50,
        sleep_score:50,
        power:110,
      },
    }),
  }

  const rested = {
    ...base,
    attacker: fighter('awake',{
      activity:{
        training_score:55,
        steps_score:65,
        sleep_score:100,
        power:120,
      },
    }),
  }

  const withoutSleep =
    generateFightTimeline(base)

  const withSleep =
    generateFightTimeline(rested)

  assert.equal(
    replayFingerprint(withoutSleep),
    replayFingerprint(withSleep),
    'sleep score must not change combat stats or combat outcome'
  )
})


test('combat events expose diverse deterministic animation variants', () => {
  const attackVariants =
    new Set()

  const dodgeVariants =
    new Set()

  const blockVariants =
    new Set()

  const koVariants =
    new Set()

  for (
    let seed = 1;
    seed <= 320;
    seed += 1
  ) {
    const timeline =
      generateFightTimeline({
        seed,
        attacker:fighter(
          'anim-a',
          {
            level:8,
            hp:160,
            strength:18,
            agility:18,
            speed:18,
            weapons:[
              'fists',
              'olympic_bar',
              'plate20',
              'belt',
            ],
            loadout:{
              weapon:'olympic_bar',
            },
            skills:[
              'leg_drive',
              'arch',
              'lockout',
              'pause_bench',
            ],
          }
        ),
        defender:fighter(
          'anim-b',
          {
            level:8,
            hp:165,
            strength:17,
            agility:19,
            speed:17,
            weapons:[
              'fists',
              'kettlebell',
              'straps',
            ],
            loadout:{
              weapon:'straps',
            },
            skills:[
              'leg_drive',
              'arch',
              'lockout',
            ],
          }
        ),
      })

    timeline.events.forEach(
      event => {
        if (
          event.type ===
            'ATTACK'
        ) {
          assert.ok(
            Number(event.attackVariant) >= 0 &&
            Number(event.attackVariant) <= 5
          )

          assert.ok(
            Number(event.impactVariant) >= 0 &&
            Number(event.impactVariant) <= 4
          )

          attackVariants.add(
            Number(
              event.attackVariant
            )
          )
        }

        if (
          event.type ===
            'DODGE'
        ) {
          assert.ok(
            Number(event.animationVariant) >= 0 &&
            Number(event.animationVariant) <= 2
          )

          dodgeVariants.add(
            Number(
              event.animationVariant
            )
          )
        }

        if (
          event.type ===
            'BLOCK'
        ) {
          assert.ok(
            Number(event.animationVariant) >= 0 &&
            Number(event.animationVariant) <= 2
          )

          blockVariants.add(
            Number(
              event.animationVariant
            )
          )
        }

        if (
          event.type ===
            'KO'
        ) {
          assert.ok(
            Number(event.animationVariant) >= 0 &&
            Number(event.animationVariant) <= 2
          )

          koVariants.add(
            Number(
              event.animationVariant
            )
          )
        }
      }
    )
  }

  assert.ok(
    attackVariants.size >= 5,
    'fight seeds should exercise most attack animation poses'
  )

  assert.ok(
    dodgeVariants.size >= 2,
    'fight seeds should exercise multiple dodge animations'
  )

  assert.ok(
    blockVariants.size >= 2,
    'fight seeds should exercise multiple block animations'
  )

  assert.ok(
    koVariants.size >= 2,
    'fight seeds should exercise multiple KO animations'
  )
})
