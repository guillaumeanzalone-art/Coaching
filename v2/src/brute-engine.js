import {
  BRUTE_WEAPONS,
  BRUTE_SKILLS,
  BRUTE_PETS,
  BRUTE_COMBAT_RULES,
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
  return Math.max(
    min,
    Math.min(
      max,
      Number(value) || 0
    )
  )
}

function array(value) {
  return Array.isArray(value)
    ? value
    : []
}

function normalizeActivity(snapshot) {
  const raw =
    snapshot?.activity || {}

  return {
    training:
      clamp(
        raw.training_score,
        0,
        100
      ),
    steps:
      clamp(
        raw.steps_score,
        0,
        100
      ),
    sleep:
      clamp(
        raw.sleep_score,
        0,
        100
      ),
    power:
      clamp(
        raw.power,
        35,
        BRUTE_COMBAT_RULES.activityMaxPower
      ),
  }
}

function normalizeWeaponList(snapshot) {
  const owned =
    array(snapshot?.weapons)
      .filter(id =>
        BRUTE_WEAPONS[id]
      )

  const equipped =
    String(
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
        id =>
          id !== equipped
      ),
    ]
  }

  return owned.length
    ? owned
    : ['fists']
}

function normalizeSkills(snapshot) {
  return new Set(
    array(snapshot?.skills)
      .filter(id =>
        BRUTE_SKILLS[id]
      )
  )
}

function normalizePets(snapshot) {
  return array(snapshot?.pets)
    .filter(id =>
      BRUTE_PETS[id]
    )
    .slice(0, 3)
    .map((id,index) => ({
      ...BRUTE_PETS[id],
      id,
      slot: index,
      hpCurrent:
        BRUTE_PETS[id].hp,
      nextTurn:
        .8 + index * .35,
    }))
}

function makeFighter(snapshot, side, random) {
  const activity =
    normalizeActivity(snapshot)

  const baseHp =
    Math.max(
      30,
      Number(snapshot?.hp) || 100
    )

  const hpMax =
    Math.round(
      baseHp *
      (
        1 +
        activity.sleep * .0012
      )
    )

  const strength =
    Math.max(
      1,
      (Number(snapshot?.strength) || 10) +
      Math.round(
        activity.training * .06
      )
    )

  const agility =
    Math.max(
      1,
      (Number(snapshot?.agility) || 10) +
      Math.round(
        activity.steps * .05 +
        activity.sleep * .015
      )
    )

  const speed =
    Math.max(
      1,
      (Number(snapshot?.speed) || 10) +
      Math.round(
        activity.steps * .055 +
        activity.sleep * .02
      )
    )

  return {
    side,
    slug:
      String(
        snapshot?.slug ||
        snapshot?.athlete_slug ||
        side
      ),
    name:
      String(
        snapshot?.name ||
        snapshot?.slug ||
        side
      ),
    level:
      Math.max(
        1,
        Number(snapshot?.level) || 1
      ),
    hpMax,
    hp: hpMax,
    strength,
    agility,
    speed,
    activity,
    weapons:
      normalizeWeaponList(snapshot),
    weaponIndex: 0,
    skills:
      normalizeSkills(snapshot),
    pets:
      normalizePets(snapshot),
    appearance:
      snapshot?.appearance || {},
    loadout:
      snapshot?.loadout || {},
    stunned: 0,
    blind: 0,
    fatigue: 0,
    lockoutUsed: false,
    grindUsed: false,
    attacks: 0,
    clock:
      random() * .22 +
      clamp(
        1.18 -
        speed * .015,
        .38,
        1.10
      ),
  }
}

function weaponFor(fighter) {
  if (!fighter.weapons.length) {
    fighter.weapons = ['fists']
    fighter.weaponIndex = 0
  }

  const id =
    fighter.weapons[
      fighter.weaponIndex %
      fighter.weapons.length
    ] || 'fists'

  return (
    BRUTE_WEAPONS[id] ||
    BRUTE_WEAPONS.fists
  )
}

function chance(random, probability) {
  return (
    random() <
    clamp(
      probability,
      0,
      .95
    )
  )
}

function statRatio(attacker, defender) {
  return clamp(
    (
      attacker.strength * 1.38 +
      attacker.speed * .46 +
      attacker.agility * .31
    ) /
    Math.max(
      1,
      defender.strength * .72 +
      defender.agility * .72 +
      defender.speed * .36
    ),
    .55,
    1.82
  )
}

function activityDamageMultiplier(fighter) {
  return (
    .94 +
    fighter.activity.training * .0018 +
    fighter.activity.sleep * .0007
  )
}

function attackDamage(
  attacker,
  defender,
  weapon,
  random
) {
  const fatiguePenalty =
    1 -
    clamp(
      attacker.fatigue /
      100,
      0,
      .42
    ) * .28

  const base =
    weapon.damage +
    attacker.strength * .76

  const variance =
    .84 +
    random() * .34

  return Math.max(
    1,
    Math.round(
      base *
      statRatio(
        attacker,
        defender
      ) *
      variance *
      activityDamageMultiplier(
        attacker
      ) *
      fatiguePenalty
    )
  )
}

function dodgeChance(
  defender,
  attacker
) {
  const arch =
    defender.skills.has('arch')
      ? .10
      : 0

  const rested =
    defender.activity.sleep *
    .00045

  return clamp(
    .035 +
    defender.agility * .0058 -
    attacker.speed * .0016 +
    arch +
    rested,
    .025,
    .38
  )
}

function blockChance(
  defender,
  attacker
) {
  const weapon =
    weaponFor(defender)

  return clamp(
    (weapon.block || 0) +
    defender.strength * .0014 +
    defender.agility * .001 -
    attacker.strength * .0006,
    .02,
    .34
  )
}

function counterChance(defender) {
  return clamp(
    .025 +
    defender.agility * .0032 +
    (
      defender.skills.has(
        'leg_drive'
      )
        ? .14
        : 0
    ),
    .03,
    .31
  )
}

function comboChance(
  attacker,
  weapon
) {
  return clamp(
    .03 +
    attacker.speed * .0042 +
    (weapon.combo || 0) +
    (
      weapon.speed -
      .75
    ) * .07 -
    attacker.fatigue * .0012,
    .025,
    .36
  )
}

function critChance(
  attacker,
  weapon
) {
  return clamp(
    .045 +
    attacker.strength * .0026 +
    (weapon.crit || 0),
    .05,
    .28
  )
}

function accuracyChance(
  attacker,
  weapon
) {
  const blindPenalty =
    attacker.blind > 0
      ? .29
      : 0

  const fatiguePenalty =
    attacker.fatigue * .0015

  const sleepBonus =
    attacker.activity.sleep *
    .00035

  return clamp(
    weapon.accuracy +
    attacker.agility * .0013 +
    sleepBonus -
    blindPenalty -
    fatiguePenalty,
    .45,
    .995
  )
}

function actionDelay(
  fighter,
  weapon,
  random
) {
  const speedFactor =
    clamp(
      1.18 -
      fighter.speed * .013,
      .48,
      1.10
    )

  const fatigueFactor =
    1 +
    fighter.fatigue * .006

  const jitter =
    .92 +
    random() * .17

  return clamp(
    (weapon.tempo || 1) *
    speedFactor *
    fatigueFactor *
    jitter,
    BRUTE_COMBAT_RULES.minActionDelay,
    BRUTE_COMBAT_RULES.maxActionDelay
  )
}

function applyDamage(
  target,
  amount
) {
  target.hp =
    Math.max(
      0,
      target.hp - amount
    )

  return target.hp
}

function snapshotState(left, right) {
  return {
    leftHp: left.hp,
    rightHp: right.hp,
    leftWeapon:
      weaponFor(left).id,
    rightWeapon:
      weaponFor(right).id,
    leftFatigue:
      Math.round(left.fatigue),
    rightFatigue:
      Math.round(right.fatigue),
    leftClock:
      Number(left.clock.toFixed(3)),
    rightClock:
      Number(right.clock.toFixed(3)),
  }
}

function pushEvent(
  events,
  type,
  payload,
  left,
  right
) {
  events.push({
    i: events.length,
    type,
    ...payload,
    state:
      snapshotState(
        left,
        right
      ),
  })
}

function applyGrindIfNeeded(
  target,
  events,
  left,
  right
) {
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

function maybeSwitchWeapon(
  fighter,
  random,
  events,
  left,
  right
) {
  if (
    fighter.weapons.length <= 1 ||
    fighter.attacks < 2 ||
    !chance(
      random,
      .10 +
      fighter.speed * .0015
    )
  ) {
    return
  }

  const current =
    weaponFor(fighter).id

  let nextIndex =
    fighter.weaponIndex

  for (
    let tries = 0;
    tries < fighter.weapons.length;
    tries += 1
  ) {
    nextIndex =
      (
        nextIndex +
        1 +
        Math.floor(
          random() *
          fighter.weapons.length
        )
      ) %
      fighter.weapons.length

    if (
      fighter.weapons[nextIndex] !==
      current
    ) {
      break
    }
  }

  fighter.weaponIndex =
    nextIndex

  const next =
    weaponFor(fighter)

  pushEvent(
    events,
    'WEAPON_SWITCH',
    {
      actor: fighter.side,
      from: current,
      weapon: next.id,
    },
    left,
    right
  )
}

function maybeRest(
  fighter,
  random,
  events,
  left,
  right
) {
  if (
    fighter.fatigue < 70 ||
    !chance(
      random,
      .20 +
      fighter.fatigue * .004
    )
  ) {
    return false
  }

  const recovered =
    Math.round(
      BRUTE_COMBAT_RULES.fatigueRecovery +
      fighter.activity.sleep * .05
    )

  fighter.fatigue =
    Math.max(
      0,
      fighter.fatigue -
      recovered
    )

  fighter.clock +=
    .48 +
    random() * .25

  pushEvent(
    events,
    'REST',
    {
      actor: fighter.side,
      recovered,
    },
    left,
    right
  )

  return true
}

function maybePetAction(
  owner,
  target,
  random,
  events,
  left,
  right
) {
  const ready =
    owner.pets
      .filter(pet =>
        pet.hpCurrent > 0 &&
        pet.nextTurn <=
          owner.clock
      )

  if (!ready.length) {
    return
  }

  const pet =
    ready[
      Math.floor(
        random() *
        ready.length
      )
    ]

  const acts =
    chance(
      random,
      .36 +
      pet.speed * .009
    )

  if (!acts) {
    pet.nextTurn =
      owner.clock +
      .8 +
      random() * .8
    return
  }

  const dodge =
    chance(
      random,
      clamp(
        target.agility * .0037,
        .02,
        .17
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
          (
            .72 +
            random() * .56
          )
        )
      )

    applyDamage(
      target,
      damage
    )

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

    applyGrindIfNeeded(
      target,
      events,
      left,
      right
    )
  }

  pet.nextTurn =
    owner.clock +
    .72 +
    random() * 1.05
}

function maybeThrowWeapon(
  attacker,
  weapon,
  random,
  events,
  left,
  right
) {
  if (
    !weapon.throwable ||
    weapon.id === 'fists' ||
    !chance(
      random,
      .14 +
      attacker.agility * .0014
    )
  ) {
    return false
  }

  pushEvent(
    events,
    'WEAPON_THROW',
    {
      actor: attacker.side,
      weapon: weapon.id,
    },
    left,
    right
  )

  return true
}

function removeWeapon(
  fighter,
  weaponId
) {
  fighter.weapons =
    fighter.weapons
      .filter(id =>
        id !== weaponId
      )

  if (!fighter.weapons.length) {
    fighter.weapons = ['fists']
  }

  fighter.weaponIndex = 0
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
  let weapon =
    weaponFor(attacker)

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

    return {
      combo: false,
      counter: false,
      delay:
        actionDelay(
          attacker,
          weapon,
          random
        ),
    }
  }

  if (attacker.blind > 0) {
    attacker.blind -= 1
  }

  maybeSwitchWeapon(
    attacker,
    random,
    events,
    left,
    right
  )

  weapon =
    weaponFor(attacker)

  const thrown =
    maybeThrowWeapon(
      attacker,
      weapon,
      random,
      events,
      left,
      right
    )

  pushEvent(
    events,
    'MOVE',
    {
      actor: attacker.side,
      target: defender.side,
      weapon: weapon.id,
      reach: weapon.reach || 1,
      counter:
        Boolean(meta.counter),
      thrown,
    },
    left,
    right
  )

  if (
    !chance(
      random,
      accuracyChance(
        attacker,
        weapon
      )
    )
  ) {
    pushEvent(
      events,
      'MISS',
      {
        actor: attacker.side,
        target: defender.side,
        weapon: weapon.id,
        thrown,
      },
      left,
      right
    )

    if (thrown) {
      removeWeapon(
        attacker,
        weapon.id
      )
    }

    attacker.fatigue =
      clamp(
        attacker.fatigue +
        BRUTE_COMBAT_RULES.fatiguePerAttack,
        0,
        BRUTE_COMBAT_RULES.maxFatigue
      )

    return {
      combo:
        chance(
          random,
          comboChance(
            attacker,
            weapon
          ) * .4
        ),
      counter: false,
      delay:
        actionDelay(
          attacker,
          weapon,
          random
        ),
    }
  }

  if (
    chance(
      random,
      dodgeChance(
        defender,
        attacker
      )
    )
  ) {
    pushEvent(
      events,
      'DODGE',
      {
        actor: defender.side,
        from: attacker.side,
        weapon: weapon.id,
      },
      left,
      right
    )

    if (thrown) {
      removeWeapon(
        attacker,
        weapon.id
      )
    }

    const counter =
      chance(
        random,
        counterChance(
          defender
        )
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
    }

    attacker.fatigue =
      clamp(
        attacker.fatigue +
        BRUTE_COMBAT_RULES.fatiguePerAttack,
        0,
        BRUTE_COMBAT_RULES.maxFatigue
      )

    return {
      combo: false,
      counter,
      delay:
        actionDelay(
          attacker,
          weapon,
          random
        ),
    }
  }

  let damage =
    attackDamage(
      attacker,
      defender,
      weapon,
      random
    )

  const blocked =
    chance(
      random,
      blockChance(
        defender,
        attacker
      )
    )

  if (blocked) {
    damage =
      Math.max(
        1,
        Math.round(
          damage *
          (
            .42 +
            random() * .12
          )
        )
      )

    pushEvent(
      events,
      'BLOCK',
      {
        actor: defender.side,
        target: attacker.side,
        weapon:
          weaponFor(defender).id,
        damage,
      },
      left,
      right
    )
  }

  const critical =
    chance(
      random,
      critChance(
        attacker,
        weapon
      )
    )

  if (critical) {
    damage =
      Math.round(
        damage * 1.5
      )
  }

  let lockout = false

  if (
    defender.skills.has(
      'lockout'
    ) &&
    !defender.lockoutUsed &&
    damage >=
      defender.hpMax * .15
  ) {
    defender.lockoutUsed = true

    damage =
      Math.max(
        1,
        Math.round(
          damage * .34
        )
      )

    lockout = true

    pushEvent(
      events,
      'SKILL_ACTIVATE',
      {
        actor: defender.side,
        target: attacker.side,
        skill: 'lockout',
      },
      left,
      right
    )
  }

  applyDamage(
    defender,
    damage
  )

  attacker.attacks += 1

  if (
    weapon.effect === 'blind' &&
    chance(
      random,
      .72
    )
  ) {
    defender.blind = 2
  }

  const stunned =
    attacker.skills.has(
      'pause_bench'
    ) &&
    chance(
      random,
      clamp(
        .065 +
        attacker.strength * .002,
        .07,
        .19
      )
    )

  if (stunned) {
    defender.stunned =
      Math.max(
        defender.stunned,
        1
      )

    pushEvent(
      events,
      'SKILL_ACTIVATE',
      {
        actor: attacker.side,
        target: defender.side,
        skill: 'pause_bench',
      },
      left,
      right
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
      blocked,
      lockout,
      blind:
        weapon.effect === 'blind' &&
        defender.blind > 0,
      stun: stunned,
      counter:
        Boolean(meta.counter),
      thrown,
    },
    left,
    right
  )

  if (thrown) {
    removeWeapon(
      attacker,
      weapon.id
    )
  }

  const defenderWeapon =
    weaponFor(defender)

  const disarm =
    defender.hp > 0 &&
    defenderWeapon.id !==
      'fists' &&
    damage > 0 &&
    chance(
      random,
      clamp(
        .025 +
        attacker.agility * .0025 +
        (
          weapon.effect === 'grip'
            ? .07
            : 0
        ),
        .025,
        .18
      )
    )

  if (disarm) {
    removeWeapon(
      defender,
      defenderWeapon.id
    )

    pushEvent(
      events,
      'DISARM',
      {
        actor: attacker.side,
        target: defender.side,
        weapon: defenderWeapon.id,
      },
      left,
      right
    )
  }

  applyGrindIfNeeded(
    defender,
    events,
    left,
    right
  )

  attacker.fatigue =
    clamp(
      attacker.fatigue +
      BRUTE_COMBAT_RULES.fatiguePerAttack +
      (weapon.category === 'heavy' ? 3 : 0),
      0,
      BRUTE_COMBAT_RULES.maxFatigue
    )

  defender.fatigue =
    clamp(
      defender.fatigue +
      (blocked ? 2 : 1),
      0,
      BRUTE_COMBAT_RULES.maxFatigue
    )

  const counter =
    defender.hp > 0 &&
    blocked &&
    chance(
      random,
      counterChance(
        defender
      ) * .72
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
  }

  return {
    combo:
      defender.hp > 0 &&
      chance(
        random,
        comboChance(
          attacker,
          weapon
        )
      ),
    counter,
    delay:
      actionDelay(
        attacker,
        weapon,
        random
      ),
  }
}

function forceWinnerIfNeeded(
  left,
  right,
  winnerSlug,
  events
) {
  if (!winnerSlug) {
    return
  }

  const desired =
    left.slug === winnerSlug
      ? left
      : right.slug === winnerSlug
        ? right
        : null

  if (!desired) {
    return
  }

  const loser =
    desired === left
      ? right
      : left

  if (loser.hp <= 0) {
    return
  }

  const damage = loser.hp
  loser.hp = 0

  pushEvent(
    events,
    'FINISHER',
    {
      actor: desired.side,
      target: loser.side,
      damage,
      weapon:
        weaponFor(desired).id,
    },
    left,
    right
  )
}

function summarize(
  events,
  left,
  right
) {
  const sideSummary = side => {
    const attacks =
      events.filter(
        e =>
          e.type === 'ATTACK' &&
          e.actor === side
      )

    return {
      damage:
        attacks.reduce(
          (sum,e) =>
            sum +
            Number(e.damage || 0),
          0
        ) +
        events
          .filter(
            e =>
              e.type === 'PET_ATTACK' &&
              e.actor === side
          )
          .reduce(
            (sum,e) =>
              sum +
              Number(e.damage || 0),
            0
          ),
      hits: attacks.length,
      crits:
        attacks.filter(
          e => e.critical
        ).length,
      dodges:
        events.filter(
          e =>
            e.type === 'DODGE' &&
            e.actor === side
        ).length,
      blocks:
        events.filter(
          e =>
            e.type === 'BLOCK' &&
            e.actor === side
        ).length,
      counters:
        events.filter(
          e =>
            e.type === 'COUNTER_READY' &&
            e.actor === side
        ).length,
      combos:
        events.filter(
          e =>
            e.type === 'COMBO' &&
            e.actor === side
        ).length,
      disarms:
        events.filter(
          e =>
            e.type === 'DISARM' &&
            e.actor === side
        ).length,
      petHits:
        events.filter(
          e =>
            e.type === 'PET_ATTACK' &&
            e.actor === side
        ).length,
    }
  }

  return {
    left:
      sideSummary(left.side),
    right:
      sideSummary(right.side),
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
    makeFighter(
      attacker,
      'left',
      random
    )

  const right =
    makeFighter(
      defender,
      'right',
      random
    )

  const events = []

  pushEvent(
    events,
    'START',
    {
      seed: String(seed),
      engineVersion:
        BRUTE_COMBAT_RULES.engineVersion,
      leftActivity:
        left.activity,
      rightActivity:
        right.activity,
    },
    left,
    right
  )

  let actions = 0

  while (
    left.hp > 0 &&
    right.hp > 0 &&
    actions < maxTurns &&
    events.length <
      BRUTE_COMBAT_RULES.maxTimelineEvents
  ) {
    actions += 1

    const active =
      left.clock <= right.clock
        ? left
        : right

    const target =
      active === left
        ? right
        : left

    if (
      maybeRest(
        active,
        random,
        events,
        left,
        right
      )
    ) {
      continue
    }

    maybePetAction(
      active,
      target,
      random,
      events,
      left,
      right
    )

    if (target.hp <= 0) {
      applyGrindIfNeeded(
        target,
        events,
        left,
        right
      )

      if (target.hp <= 0) {
        break
      }
    }

    const result =
      turnAttack(
        active,
        target,
        random,
        events,
        left,
        right
      )

    active.clock +=
      result.delay

    if (target.hp <= 0) {
      break
    }

    if (result.counter) {
      const counterWeapon =
        weaponFor(target)

      pushEvent(
        events,
        'COUNTER',
        {
          actor: target.side,
          target: active.side,
          weapon: counterWeapon.id,
        },
        left,
        right
      )

      const counterResult =
        turnAttack(
          target,
          active,
          random,
          events,
          left,
          right,
          { counter: true }
        )

      target.clock +=
        Math.max(
          .18,
          counterResult.delay * .45
        )

      if (active.hp <= 0) {
        break
      }
    }

    if (
      result.combo &&
      target.hp > 0
    ) {
      pushEvent(
        events,
        'COMBO',
        {
          actor: active.side,
          target: target.side,
        },
        left,
        right
      )

      active.clock =
        Math.max(
          0,
          active.clock -
          .28
        )
    }

    pushEvent(
      events,
      'MOVE_BACK',
      {
        actor: active.side,
      },
      left,
      right
    )

    active.fatigue =
      Math.max(
        0,
        active.fatigue -
        .6
      )

    target.fatigue =
      Math.max(
        0,
        target.fatigue -
        1.2
      )
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
        random() > .5
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
        weapon:
          weaponFor(desired).id,
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

  const leftSnapshot = {
    ...attacker,
    side: 'left',
    hpMax: left.hpMax,
    effectiveStrength:
      left.strength,
    effectiveAgility:
      left.agility,
    effectiveSpeed:
      left.speed,
    activity:
      left.activity,
  }

  const rightSnapshot = {
    ...defender,
    side: 'right',
    hpMax: right.hpMax,
    effectiveStrength:
      right.strength,
    effectiveAgility:
      right.agility,
    effectiveSpeed:
      right.speed,
    activity:
      right.activity,
  }

  return {
    seed: String(seed),
    engineVersion:
      BRUTE_COMBAT_RULES.engineVersion,
    winnerSlug: winner,
    left: leftSnapshot,
    right: rightSnapshot,
    events,
    summary:
      summarize(
        events,
        left,
        right
      ),
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
        event.state?.leftFatigue || 0,
        event.state?.rightFatigue || 0,
      ].join(':'))
      .join('|')

  return hashSeed(
    String(timeline.seed) +
    '|' +
    String(
      timeline.engineVersion || 1
    ) +
    '|' +
    serial
  ).toString(16)
}
