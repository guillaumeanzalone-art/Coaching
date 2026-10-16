
import {
  BRUTE_WEAPONS,
  BRUTE_SKILLS,
  BRUTE_PETS,
} from './brute-config.js'

function hashSeed(input) {
  const text = String(input ?? '')
  let hash = 2166136261 >>> 0

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5

  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function normalizeWeaponList(snapshot) {
  const owned = array(snapshot?.weapons)
  const equipped = String(
    snapshot?.loadout?.weapon ||
    snapshot?.equipped_weapon ||
    ''
  )

  if (
    equipped &&
    BRUTE_WEAPONS[equipped]
  ) {
    return [
      equipped,
      ...owned.filter(
        id => id !== equipped
      ),
    ]
  }

  const valid = owned.filter(id => BRUTE_WEAPONS[id])

  return valid.length
    ? valid
    : ['fists']
}

function normalizeSkills(snapshot) {
  return new Set(
    array(snapshot?.skills).filter(
      id => BRUTE_SKILLS[id]
    )
  )
}

function normalizePets(snapshot) {
  return array(snapshot?.pets)
    .filter(id => BRUTE_PETS[id])
    .slice(0, 3)
    .map(id => ({
      ...BRUTE_PETS[id],
      id,
      hpCurrent: BRUTE_PETS[id].hp,
      nextTurn: 1,
    }))
}

function makeFighter(snapshot, side) {
  const hp = Math.max(30, Number(snapshot?.hp) || 100)
  return {
    side,
    slug: String(snapshot?.slug || snapshot?.athlete_slug || side),
    name: String(snapshot?.name || snapshot?.slug || side),
    level: Math.max(1, Number(snapshot?.level) || 1),
    hpMax: hp,
    hp,
    strength: Math.max(1, Number(snapshot?.strength) || 10),
    agility: Math.max(1, Number(snapshot?.agility) || 10),
    speed: Math.max(1, Number(snapshot?.speed) || 10),
    weapons: normalizeWeaponList(snapshot),
    weaponIndex: 0,
    skills: normalizeSkills(snapshot),
    pets: normalizePets(snapshot),
    appearance: snapshot?.appearance || {},
    loadout: snapshot?.loadout || {},
    stunned: 0,
    blind: 0,
    lockoutUsed: false,
    grindUsed: false,
    attacks: 0,
  }
}

function weaponFor(fighter) {
  const id =
    fighter.weapons[
      fighter.weaponIndex %
      fighter.weapons.length
    ] || 'fists'

  return BRUTE_WEAPONS[id] || BRUTE_WEAPONS.fists
}

function chance(random, probability) {
  return random() < clamp(probability, 0, 0.95)
}

function statRatio(attacker, defender) {
  return clamp(
    (
      attacker.strength * 1.35 +
      attacker.speed * 0.55 +
      attacker.agility * 0.35
    ) /
    Math.max(
      1,
      defender.strength * 0.7 +
      defender.agility * 0.75 +
      defender.speed * 0.4
    ),
    0.55,
    1.8
  )
}

function attackDamage(attacker, defender, weapon, random) {
  const base =
    weapon.damage +
    attacker.strength * 0.78

  const variance =
    0.84 + random() * 0.34

  return Math.max(
    1,
    Math.round(
      base *
      statRatio(attacker, defender) *
      variance
    )
  )
}

function defenderDodgeChance(defender, attacker) {
  const base =
    0.045 +
    defender.agility * 0.0065 -
    attacker.speed * 0.0018

  const arch =
    defender.skills.has('arch')
      ? 0.10
      : 0

  return clamp(base + arch, 0.03, 0.36)
}

function counterChance(defender) {
  return clamp(
    0.025 +
    defender.agility * 0.0035 +
    (
      defender.skills.has('leg_drive')
        ? 0.14
        : 0
    ),
    0.03,
    0.30
  )
}

function comboChance(attacker, weapon) {
  return clamp(
    0.035 +
    attacker.speed * 0.0045 +
    (weapon.speed - 0.75) * 0.10,
    0.03,
    0.34
  )
}

function critChance(attacker) {
  return clamp(
    0.055 +
    attacker.strength * 0.0028,
    0.06,
    0.22
  )
}

function accuracyChance(attacker, weapon) {
  const blindPenalty =
    attacker.blind > 0
      ? 0.28
      : 0

  return clamp(
    weapon.accuracy +
    attacker.agility * 0.0015 -
    blindPenalty,
    0.50,
    0.995
  )
}

function applyDamage(target, amount) {
  target.hp = Math.max(0, target.hp - amount)
  return target.hp
}

function snapshotState(left, right) {
  return {
    leftHp: left.hp,
    rightHp: right.hp,
    leftWeapon: weaponFor(left).id,
    rightWeapon: weaponFor(right).id,
  }
}

function pushEvent(events, type, payload, left, right) {
  events.push({
    i: events.length,
    type,
    ...payload,
    state: snapshotState(left, right),
  })
}

function maybePetAction(owner, target, random, events, left, right, turn) {
  const candidates =
    owner.pets.filter(
      pet =>
        pet.hpCurrent > 0 &&
        pet.nextTurn <= turn
    )

  if (!candidates.length) return

  const pet =
    candidates[
      Math.floor(random() * candidates.length)
    ]

  if (!chance(random, 0.38 + pet.speed * 0.008)) {
    pet.nextTurn = turn + 2
    return
  }

  const dodge =
    chance(
      random,
      clamp(
        target.agility * 0.004,
        0.02,
        0.16
      )
    )

  if (dodge) {
    pushEvent(
      events,
      'PET_DODGE',
      {
        actor: owner.side,
        pet: pet.id,
        target: target.side,
      },
      left,
      right
    )
  } else {
    const damage =
      Math.max(
        2,
        Math.round(
          pet.strength *
          (0.75 + random() * 0.5)
        )
      )

    applyDamage(target, damage)

    pushEvent(
      events,
      'PET_ATTACK',
      {
        actor: owner.side,
        pet: pet.id,
        target: target.side,
        damage,
      },
      left,
      right
    )
  }

  pet.nextTurn =
    turn +
    2 +
    Math.floor(random() * 3)
}

function applyGrindIfNeeded(target, events, left, right) {
  if (
    target.hp <= 0 &&
    target.skills.has('grind') &&
    !target.grindUsed
  ) {
    target.grindUsed = true
    target.hp = 1

    pushEvent(
      events,
      'GRIND',
      {
        actor: target.side,
        hp: 1,
      },
      left,
      right
    )

    return true
  }

  return false
}

function forceWinnerIfNeeded(left, right, winnerSlug, events) {
  if (!winnerSlug) return

  const desired =
    left.slug === winnerSlug
      ? left
      : right.slug === winnerSlug
        ? right
        : null

  if (!desired) return

  const loser =
    desired === left
      ? right
      : left

  if (loser.hp <= 0) return

  const damage = loser.hp
  loser.hp = 0

  pushEvent(
    events,
    'FINISHER',
    {
      actor: desired.side,
      target: loser.side,
      damage,
    },
    left,
    right
  )
}

function turnAttack(
  attacker,
  defender,
  random,
  events,
  left,
  right,
  meta = {}
) {
  const weapon = weaponFor(attacker)

  if (attacker.stunned > 0) {
    attacker.stunned -= 1

    pushEvent(
      events,
      'STUN_SKIP',
      {
        actor: attacker.side,
      },
      left,
      right
    )

    return { combo: false }
  }

  if (attacker.blind > 0) {
    attacker.blind -= 1
  }

  pushEvent(
    events,
    'MOVE',
    {
      actor: attacker.side,
      target: defender.side,
      weapon: weapon.id,
      counter: Boolean(meta.counter),
    },
    left,
    right
  )

  if (
    !chance(
      random,
      accuracyChance(attacker, weapon)
    )
  ) {
    pushEvent(
      events,
      'MISS',
      {
        actor: attacker.side,
        target: defender.side,
        weapon: weapon.id,
      },
      left,
      right
    )

    return {
      combo:
        chance(
          random,
          comboChance(attacker, weapon) * 0.45
        ),
    }
  }

  if (
    chance(
      random,
      defenderDodgeChance(defender, attacker)
    )
  ) {
    pushEvent(
      events,
      'DODGE',
      {
        actor: defender.side,
        from: attacker.side,
      },
      left,
      right
    )

    const counter =
      chance(
        random,
        counterChance(defender)
      )

    if (counter) {
      pushEvent(
        events,
        'COUNTER_READY',
        {
          actor: defender.side,
          target: attacker.side,
        },
        left,
        right
      )

      return {
        combo: false,
        counter: true,
      }
    }

    return { combo: false }
  }

  let damage =
    attackDamage(
      attacker,
      defender,
      weapon,
      random
    )

  const critical =
    chance(
      random,
      critChance(attacker)
    )

  if (critical) {
    damage =
      Math.round(
        damage * 1.52
      )
  }

  let lockout = false

  if (
    defender.skills.has('lockout') &&
    !defender.lockoutUsed &&
    damage >= defender.hpMax * 0.16
  ) {
    defender.lockoutUsed = true
    damage =
      Math.max(
        1,
        Math.round(damage * 0.35)
      )
    lockout = true
  }

  applyDamage(
    defender,
    damage
  )

  attacker.attacks += 1

  if (
    weapon.effect === 'blind' &&
    chance(random, 0.72)
  ) {
    defender.blind = 2
  }

  const stunned =
    attacker.skills.has('pause_bench') &&
    chance(
      random,
      clamp(
        0.07 +
        attacker.strength * 0.002,
        0.07,
        0.19
      )
    )

  if (stunned) {
    defender.stunned =
      Math.max(
        defender.stunned,
        1
      )
  }

  pushEvent(
    events,
    'ATTACK',
    {
      actor: attacker.side,
      target: defender.side,
      weapon: weapon.id,
      damage,
      critical,
      lockout,
      blind:
        weapon.effect === 'blind' &&
        defender.blind > 0,
      stun: stunned,
      counter: Boolean(meta.counter),
    },
    left,
    right
  )

  if (
    defender.hp <= 0
  ) {
    applyGrindIfNeeded(
      defender,
      events,
      left,
      right
    )
  }

  return {
    combo:
      defender.hp > 0 &&
      chance(
        random,
        comboChance(attacker, weapon)
      ),
  }
}

export function generateFightTimeline({
  seed,
  attacker,
  defender,
  winnerSlug = '',
  maxTurns = 90,
}) {
  const random =
    createSeededRandom(seed)

  const left =
    makeFighter(attacker, 'left')

  const right =
    makeFighter(defender, 'right')

  const events = []

  pushEvent(
    events,
    'START',
    {
      seed: String(seed),
    },
    left,
    right
  )

  let active =
    (
      left.speed +
      random() * 10
    ) >= (
      right.speed +
      random() * 10
    )
      ? left
      : right

  let turn = 0

  while (
    left.hp > 0 &&
    right.hp > 0 &&
    turn < maxTurns
  ) {
    turn += 1

    const defenderFighter =
      active === left
        ? right
        : left

    maybePetAction(
      active,
      defenderFighter,
      random,
      events,
      left,
      right,
      turn
    )

    if (
      defenderFighter.hp <= 0
    ) {
      applyGrindIfNeeded(
        defenderFighter,
        events,
        left,
        right
      )

      if (defenderFighter.hp <= 0) {
        break
      }
    }

    const result =
      turnAttack(
        active,
        defenderFighter,
        random,
        events,
        left,
        right
      )

    if (
      defenderFighter.hp <= 0
    ) {
      break
    }

    if (result.counter) {
      turnAttack(
        defenderFighter,
        active,
        random,
        events,
        left,
        right,
        { counter: true }
      )

      if (active.hp <= 0) {
        break
      }
    }

    if (
      result.combo &&
      defenderFighter.hp > 0
    ) {
      pushEvent(
        events,
        'COMBO',
        {
          actor: active.side,
        },
        left,
        right
      )

      turnAttack(
        active,
        defenderFighter,
        random,
        events,
        left,
        right,
        { combo: true }
      )
    }

    if (
      left.hp <= 0 ||
      right.hp <= 0
    ) {
      break
    }

    active =
      active === left
        ? right
        : left
  }

  forceWinnerIfNeeded(
    left,
    right,
    winnerSlug,
    events
  )

  let winner

  if (left.hp === right.hp) {
    winner =
      winnerSlug ||
      (
        random() > 0.5
          ? left.slug
          : right.slug
      )
  } else {
    winner =
      left.hp > right.hp
        ? left.slug
        : right.slug
  }

  if (
    winnerSlug &&
    winner !== winnerSlug
  ) {
    const desired =
      left.slug === winnerSlug
        ? left
        : right

    const loser =
      desired === left
        ? right
        : left

    desired.hp =
      Math.max(
        1,
        desired.hp
      )

    loser.hp = 0
    winner = winnerSlug

    pushEvent(
      events,
      'FINISHER',
      {
        actor: desired.side,
        target: loser.side,
        damage: 999,
      },
      left,
      right
    )
  }

  const loserSide =
    winner === left.slug
      ? 'right'
      : 'left'

  pushEvent(
    events,
    'KO',
    {
      actor:
        winner === left.slug
          ? 'left'
          : 'right',
      target: loserSide,
      winnerSlug: winner,
    },
    left,
    right
  )

  pushEvent(
    events,
    'END',
    {
      winnerSlug: winner,
    },
    left,
    right
  )

  return {
    seed: String(seed),
    winnerSlug: winner,
    left: {
      ...attacker,
      side: 'left',
      hpMax: left.hpMax,
    },
    right: {
      ...defender,
      side: 'right',
      hpMax: right.hpMax,
    },
    events,
  }
}

export function replayFingerprint(timeline) {
  const serial =
    timeline.events
      .map(event => [
        event.type,
        event.actor || '',
        event.target || '',
        event.weapon || '',
        event.damage || 0,
        event.state?.leftHp || 0,
        event.state?.rightHp || 0,
      ].join(':'))
      .join('|')

  return hashSeed(
    String(timeline.seed) +
    '|' +
    serial
  ).toString(16)
}
