// GA TCG Arena — moteur original et indépendant, sans assets Urban Rivals.
// Le duel est résolu localement et les résultats sont stockés via la table existante.
const ARENA_MAX_ROUNDS = 4;
const ARENA_START_HP = 12;
const ARENA_START_PILLZ = 12;
const ARENA_FURY_COST = 3;

function arenaClamp(value, min, max) {
  const numeric = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : min));
}

function arenaBaseStats(card) {
  if (Number.isInteger(Number(card?.power)) && Number.isInteger(Number(card?.damage))) {
    return { power: arenaClamp(card.power, 3, 9), damage: arenaClamp(card.damage, 1, 7) };
  }
  const rarityRank = arenaClamp(card?.rarityMeta?.rank ?? 1, 1, 5);
  const power = arenaClamp(3 + Math.floor((Number(card?.attack) || 3) / 4) + Math.floor(rarityRank / 3), 3, 9);
  const damage = arenaClamp(1 + Math.ceil((Number(card?.guard) || 2) / 4) + (rarityRank === 5 ? 1 : 0), 1, 7);
  return { power, damage };
}

function arenaTeamBonuses(cards) {
  const counts = {};
  for (const card of cards) {
    const family = String(card?.faction || card?.archetype?.id || "neutral");
    counts[family] = (counts[family] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, count >= 2]));
}

function arenaTeamActive(state, side, card) {
  return Boolean(state?.[side === "player" ? "playerTeams" : "aiTeams"]?.[(card?.faction || card?.archetype?.id)]);
}

function arenaCombatStats(card, opposingCard, bid, opposingBid, fury, teamActive) {
  const base = arenaBaseStats(card);
  const enemyBase = arenaBaseStats(opposingCard);
  const family = String(card?.ability_type || card?.archetype?.id || "");
  let power = base.power;
  let damage = base.damage;
  let shield = 0;
  let attackBonus = 0;
  const effects = [];
  const change = (source,kind,delta,label) => effects.push({source,kind,delta,label,ability:family});
  if (family === "power" && bid >= opposingBid) {power += 1;change('ability','power',1,'Puissance +1');}
  if (family === "guard") {shield += 2;change('ability','shield',2,'Bouclier +2');}
  if (family === "tempo" && bid <= 3) {attackBonus += 3;change('ability','attack',3,'Attaque +3');}
  if (family === "technique" && enemyBase.power > base.power) {attackBonus += 3;change('ability','attack',3,'Attaque +3');}
  if (family === "chaos" && bid >= 4) {damage += 1;change('ability','damage',1,'Dégâts +1');}
  if (family === "poison" && bid >= 2) {attackBonus += 2;change('ability','attack',2,'Attaque +2');}
  // La Forge se déclenche dès deux Pillz investis, sans exception liée à l'identifiant.
  if (family === "fire" && bid >= 2) {attackBonus += 2;change('ability','attack',2,'Attaque +2');}
  if (teamActive) {
    if (family === "power") {power += 1;change('faction','power',1,'Puissance +1');}
    if (family === "guard") {shield += 1;change('faction','shield',1,'Bouclier +1');}
    if (family === "tempo") {attackBonus += 2;change('faction','attack',2,'Attaque +2');}
    if (family === "technique" && enemyBase.power >= base.power) {power += 1;change('faction','power',1,'Puissance +1');}
    if (family === "chaos") {damage += 1;change('faction','damage',1,'Dégâts +1');}
    if (family === "poison") {shield += 1;change('faction','shield',1,'Bouclier +1');}
    if (family === "fire") {power += 1;change('faction','power',1,'Puissance +1');}
  }
  if (fury) {damage += 2;change('fury','damage',2,'Dégâts +2');}
  if (fury && family === "fire") {damage += 1;change('fury','damage',1,'Forge +1 dégât');}
  return {
    power,
    damage: arenaClamp(damage, 1, 11),
    shield,
    attack: power * (bid + 1) + attackBonus,
    attackBonus,
    effects,
  };
}

// Poison is a status effect, applied only when Alexandre wins a round.
// No instant tick on the application round; subsequent rounds drain HP.
// Stronger evolutions extend the duration and intensity, capped to avoid stacking abuse.
function arenaVenomForCard(card) {
  if ((card?.ability_type || card?.archetype?.id) !== "poison") return { damage: 0, turns: 0 };
  const level = arenaClamp(card?.rarityMeta?.rank ?? 1, 1, 5);
  return { damage: level >= 4 ? 2 : 1, turns: level >= 5 ? 3 : level >= 3 ? 2 : 1 };
}
function arenaTickVenom(status) {
  const turns = Math.max(0, Number(status?.turns) || 0);
  const damage = arenaClamp(status?.damage ?? 0, 0, 2);
  return {
    tick: turns > 0 ? damage : 0,
    next: { damage: turns > 1 ? damage : 0, turns: Math.max(0, turns - 1) }
  };
}
function arenaMergeVenom(existing, incoming) {
  return {
    damage: Math.max(existing?.damage || 0, incoming?.damage || 0),
    turns: Math.max(existing?.turns || 0, incoming?.turns || 0),
  };
}

function createTcgArena(playerCards, opponentCards) {
  if (!Array.isArray(playerCards) || !Array.isArray(opponentCards) || playerCards.length < 4 || opponentCards.length < 4) {
    throw new Error("Il faut 4 cartes de chaque côté pour entrer dans l'arène.");
  }
  const playerHand = playerCards.slice(0, 4);
  const aiHand = opponentCards.slice(0, 4);
  return {
    playerHp: ARENA_START_HP,
    aiHp: ARENA_START_HP,
    playerPillz: ARENA_START_PILLZ,
    aiPillz: ARENA_START_PILLZ,
    playerTeams: arenaTeamBonuses(playerHand),
    playerVenom: { damage: 0, turns: 0 },
    aiVenom: { damage: 0, turns: 0 },
    aiTeams: arenaTeamBonuses(aiHand),
    playerHand,
    aiHand,
    playerCard: null,
    aiCard: null,
    playerBid: 2,
    playerFury: false,
    selectedIndex: 0,
    turn: 1,
    round: 1,
    history: [],
    log: "Choisis un combattant, mise des Pillz et valide ton attaque.",
    finished: false,
    result: "",
    lastWinner: "",
  };
}

function chooseTcgArenaAiMove(state, random = Math.random) {
  if (!state?.aiHand?.length) throw new Error("Aucune carte adverse disponible.");
  const turnsLeft = Math.max(1, 5 - state.round);
  const lifePressure = state.aiHp <= state.playerHp - 3 ? 1 : 0;
  const candidates = state.aiHand.map((card, index) => {
    const base = arenaBaseStats(card);
    return { index, score: base.power * 1.6 + base.damage + (arenaTeamActive(state, "ai", card) ? 1.5 : 0) + random() * 5 };
  });
  candidates.sort((a, b) => b.score - a.score);
  const index = candidates[0].index;
  const target = Math.round(state.aiPillz / turnsLeft + (random() - 0.5) * 4 + lifePressure);
  const pillz = arenaClamp(target, 0, state.aiPillz);
  const fury = state.aiPillz - pillz >= ARENA_FURY_COST &&
    (state.round === 4 || (state.playerHp <= 5 && random() < .3));
  return { index, pillz, fury };
}

function resolveTcgArenaRound(state, selection, random = Math.random, opponentMove = null) {
  if (!state || state.finished) throw new Error("Le duel est déjà terminé.");
  const index = Number(selection?.index);
  if (!Number.isInteger(index) || index < 0 || index >= state.playerHand.length) {
    throw new Error("Choisis une carte valide.");
  }
  const pillz = Number(selection?.pillz);
  const fury = Boolean(selection?.fury);
  if (!Number.isInteger(pillz) || pillz < 0 || pillz + (fury ? ARENA_FURY_COST : 0) > state.playerPillz) {
    throw new Error("Pas assez de Pillz pour cette attaque.");
  }
  const choice = opponentMove || chooseTcgArenaAiMove(state, random);
  if (!Number.isInteger(choice.index) || choice.index < 0 || choice.index >= state.aiHand.length ||
      !Number.isInteger(choice.pillz) || choice.pillz < 0 ||
      choice.pillz + (choice.fury ? ARENA_FURY_COST : 0) > state.aiPillz) {
    throw new Error("Mise adverse invalide.");
  }
  const playerCard = state.playerHand[index];
  const aiCard = state.aiHand[choice.index];
  const playerStats = arenaCombatStats(playerCard, aiCard, pillz, choice.pillz, fury, arenaTeamActive(state, "player", playerCard));
  const aiStats = arenaCombatStats(aiCard, playerCard, choice.pillz, pillz, Boolean(choice.fury), arenaTeamActive(state, "ai", aiCard));
  let winner = "draw";
  let priorityReason = null;
  if (playerStats.attack > aiStats.attack) winner = "player";
  else if (aiStats.attack > playerStats.attack) winner = "ai";
  else if (pillz < choice.pillz) {winner = "player"; priorityReason = "lower_bid";}
  else if (choice.pillz < pillz) {winner = "ai"; priorityReason = "lower_bid";}
  else {winner = state.round % 2 === 1 ? "player" : "ai"; priorityReason = "round_initiative";}
  const damage = winner === "player"
    ? Math.max(1, playerStats.damage - aiStats.shield)
    : Math.max(1, aiStats.damage - playerStats.shield);
  const playerVenomTick = arenaTickVenom(state.playerVenom);
  const aiVenomTick = arenaTickVenom(state.aiVenom);
  const playerHpAfterHit = Math.max(0, state.playerHp - (winner === "ai" ? damage : 0));
  const aiHpAfterHit = Math.max(0, state.aiHp - (winner === "player" ? damage : 0));
  const playerHp = Math.max(0, playerHpAfterHit - playerVenomTick.tick);
  const aiHp = Math.max(0, aiHpAfterHit - aiVenomTick.tick);
  let playerVenom = playerVenomTick.next;
  let aiVenom = aiVenomTick.next;
  // A toxic victory infects the survivor. New poison starts ticking next round.
  let poisonApplied = false;
  if (winner === "player" && (playerCard?.ability_type || playerCard?.archetype?.id) === "poison" && aiHp > 0) {
    poisonApplied = true;
    aiVenom = arenaMergeVenom(aiVenom, arenaVenomForCard(playerCard));
  }
  if (winner === "ai" && (aiCard?.ability_type || aiCard?.archetype?.id) === "poison" && playerHp > 0) {
    poisonApplied = true;
    playerVenom = arenaMergeVenom(playerVenom, arenaVenomForCard(aiCard));
  }
  const playerHand = state.playerHand.filter((_, i) => i !== index);
  const aiHand = state.aiHand.filter((_, i) => i !== choice.index);
  const finished = playerHp === 0 || aiHp === 0 || state.round >= ARENA_MAX_ROUNDS ||
    playerHand.length === 0 || aiHand.length === 0;
  const result = !finished ? "" : playerHp > aiHp ? "win" : aiHp > playerHp ? "loss" : "draw";
  const name = (card) => String(card?.athlete?.name || card?.slug || "Combattant");
  const venomExtra = (playerVenomTick.tick || aiVenomTick.tick) ? ` · ☣ poison : ${playerVenomTick.tick} / ${aiVenomTick.tick}` : "";
  const venomInflicted = poisonApplied;
  const log = `${winner === "player" ? name(playerCard) : name(aiCard)} remporte le round · ${damage} dégâts · ATQ ${playerStats.attack} contre ${aiStats.attack}.${venomInflicted ? " ☣ Miasmes empoisonnés !" : ""}${venomExtra}`;
  const history = [...state.history, {
    round: state.round,
    playerCardId: playerCard.id,
    aiCardId: aiCard.id,
    playerName: name(playerCard),
    aiName: name(aiCard),
    playerBid: pillz,
    aiBid: choice.pillz,
    playerFury: fury,
    aiFury: Boolean(choice.fury),
    playerAttack: playerStats.attack,
    aiAttack: aiStats.attack,
    playerPower: playerStats.power,
    aiPower: aiStats.power,
    playerDamage: playerStats.damage,
    aiDamage: aiStats.damage,
    playerShield: playerStats.shield,
    aiShield: aiStats.shield,
    shieldAbsorbed: Math.max(0,(winner==="player"?playerStats.damage:aiStats.damage)-damage),
    priorityReason,
    playerEffects: playerStats.effects,
    aiEffects: aiStats.effects,
    playerHpBefore: state.playerHp,
    aiHpBefore: state.aiHp,
    playerHpAfterHit,
    aiHpAfterHit,
    playerHpAfter: playerHp,
    aiHpAfter: aiHp,
    poisonApplied,
    damage,
    venomDamageToPlayer: playerVenomTick.tick,
    venomDamageToAi: aiVenomTick.tick,
    playerVenomTurns: playerVenom.turns,
    aiVenomTurns: aiVenom.turns,
    winner,
  }];
  return {
    ...state,
    playerHand, aiHand, playerCard, aiCard, playerHp, aiHp,
    playerVenom, aiVenom,
    playerPillz: state.playerPillz - pillz - (fury ? ARENA_FURY_COST : 0),
    aiPillz: state.aiPillz - choice.pillz - (choice.fury ? ARENA_FURY_COST : 0),
    playerBid: 0,
    playerFury: false,
    selectedIndex: 0,
    round: state.round + (finished ? 0 : 1),
    turn: state.round,
    history, log, finished, result, lastWinner: winner,
  };
}

export { ARENA_MAX_ROUNDS, ARENA_START_HP, ARENA_START_PILLZ, ARENA_FURY_COST, arenaBaseStats, arenaTeamActive, arenaCombatStats, arenaVenomForCard, createTcgArena, chooseTcgArenaAiMove, resolveTcgArenaRound };
