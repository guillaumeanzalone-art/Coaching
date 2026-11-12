// Source unique des règles de puissance. Aucune limite liée au nombre de cartes.
export const DECK_SIZE = 8;
export const RARITY_RULES = Object.freeze({
  common:   { rank: 1, min: 30, max: 52, target: 0.20 },
  uncommon: { rank: 2, min: 50, max: 72, target: 0.20 },
  rare:     { rank: 3, min: 70, max: 92, target: 0.20 },
  ultra:    { rank: 4, min: 90, max: 112, target: 0.20 },
  secret:   { rank: 5, min: 110, max: 134, target: 0.20 },
});
export const ABILITY_RULES = Object.freeze({
  power:     { value: 3, reliability: 0.75, role: 'offense', counters: [] },
  guard:     { value: 3, reliability: 1, role: 'defense', counters: ['power','fire'] },
  tempo:     { value: 3, reliability: 0.7, role: 'control', counters: ['chaos'] },
  technique: { value: 3, reliability: 0.65, role: 'control', counters: ['power','fire'] },
  chaos:     { value: 2, reliability: 0.45, role: 'offense', counters: [] },
  poison:    { value: 4, reliability: 0.8, role: 'control', counters: ['guard'] },
  fire:      { value: 4, reliability: 0.85, role: 'offense', counters: [] },
});
export const SCORE_RULES = Object.freeze({
  rankPotential: 20, power: 2, damage: 3, factionBonus: 1,
  minPower: 1, maxPower: 15, minDamage: 1, maxDamage: 12,
  minUniqueFactionDecks: 2,
  targetTolerance: 0.12,
});
export const PUBLICATION_STATUSES = Object.freeze(['draft','test','published']);

export function powerScore(card) {
  const rarity = RARITY_RULES[card?.rarity];
  const ability = ABILITY_RULES[card?.ability_type || card?.archetype?.id];
  if (!rarity || !ability) return NaN;
  const power = Number(card.power ?? card.arenaPower);
  const damage = Number(card.damage ?? card.arenaDamage);
  const reliability = Number(card?.ability_params?.reliability ?? ability.reliability);
  const bonus = Number(card.faction_bonus ?? 2);
  return Math.round((rarity.rank * SCORE_RULES.rankPotential +
    power * SCORE_RULES.power + damage * SCORE_RULES.damage +
    ability.value * reliability + bonus * SCORE_RULES.factionBonus) * 100) / 100;
}
export function deckPower(cards) {
  return (cards || []).reduce((sum, card) => sum + (Number.isFinite(powerScore(card)) ? powerScore(card) : 0), 0);
}
export function validateDeck(ids, catalog, ownedIds = null) {
  const problems = [];
  if (!Array.isArray(ids) || ids.length !== DECK_SIZE)
    problems.push(`Un deck doit contenir exactement ${DECK_SIZE} cartes différentes.`);
  const distinct = new Set(ids || []);
  if (distinct.size !== (ids || []).length) problems.push('Une même carte apparaît plusieurs fois.');
  for (const id of distinct) {
    const card = catalog instanceof Map ? catalog.get(id) : (catalog || []).find(row => row.id === id);
    if (!card) problems.push(`Carte absente ou non publiée : ${id}`);
    if (card && card.publication_status !== 'published') problems.push(`Carte indisponible : ${id}`);
    if (ownedIds && !ownedIds.has(id)) problems.push(`Carte non possédée : ${id}`);
  }
  return { valid: problems.length === 0, problems, power: deckPower([...distinct].map(id => catalog instanceof Map ? catalog.get(id) : (catalog || []).find(row => row.id === id)).filter(Boolean)) };
}
export function validateCard(card, allIds = null) {
  const findings = [];
  const add = (level,message) => findings.push({ level, id: card?.id || null, message });
  for (const key of ['id','name','character_slug','rarity','faction','power','damage','ability_type','publication_status']) {
    if (card?.[key] === undefined || card[key] === null || card[key] === '') add('blocking', `Champ obligatoire absent : ${key}`);
  }
  if (!/^[a-z0-9][a-z0-9:_-]*$/.test(String(card?.id || ''))) add('blocking','Identifiant invalide.');
  if (allIds && allIds.get(card.id) > 1) add('blocking', 'Identifiant en double.');
  if (!RARITY_RULES[card?.rarity]) add('blocking','Rareté inconnue.');
  if (!/^[a-z][a-z0-9_-]*$/.test(String(card?.faction || ''))) add('blocking','Faction invalide.');
  if (!ABILITY_RULES[card?.ability_type]) add('blocking','Pouvoir inconnu du moteur.');
  if (!PUBLICATION_STATUSES.includes(card?.publication_status)) add('blocking','Statut de publication invalide.');
  if (!Number.isInteger(Number(card?.power)) || Number(card?.power) < SCORE_RULES.minPower || Number(card?.power) > SCORE_RULES.maxPower) add('blocking','Puissance hors limites.');
  if (!Number.isInteger(Number(card?.damage)) || Number(card?.damage) < SCORE_RULES.minDamage || Number(card?.damage) > SCORE_RULES.maxDamage) add('blocking','Dégâts hors limites.');
  if (!Array.isArray(card?.booster_ids)) add('warning','Aucune liste de boosters définie.');
  if (!['offense','defense','control','versatile'].includes(card?.role)) add('warning','Rôle non renseigné ou inconnu.');
  const p = powerScore(card);
  const range = RARITY_RULES[card?.rarity];
  if (Number.isFinite(p) && range) {
    if (p > range.max) add('overpowered',`Score ${p} > plafond de rareté ${range.max}.`);
    if (p < range.min) add('underpowered',`Score ${p} < plancher de rareté ${range.min}.`);
  }
  if (card?.ability_text && card?.ability_type && !String(card.ability_text).includes(card.ability_type))
    add('warning','Texte de pouvoir à vérifier par rapport aux données.');
  if (card?.publication_status === 'published' && !(card?.booster_ids || []).length)
    add('warning','Carte publiée inaccessible dans les boosters.');
  return findings;
}
export function validateCatalog(cards, { rarityTargets = RARITY_RULES, minFactionDecks = SCORE_RULES.minUniqueFactionDecks } = {}) {
  const rows = Array.isArray(cards) ? cards : [];
  const ids = new Map();
  for (const row of rows) ids.set(row.id,(ids.get(row.id)||0)+1);
  const findings = rows.flatMap(row => validateCard(row, ids));
  const published = rows.filter(row => row.publication_status === 'published');
  const rarity = {}, faction = {}, roles = {};
  for (const row of published) {
    rarity[row.rarity] = (rarity[row.rarity] || 0) + 1;
    faction[row.faction] = (faction[row.faction] || 0) + 1;
    const role = row.role || ABILITY_RULES[row.ability_type]?.role || 'unknown';
    (roles[row.faction] ||= {})[role] = ((roles[row.faction] || {})[role] || 0) + 1;
  }
  for (const [key, config] of Object.entries(rarityTargets)) {
    const share = published.length ? (rarity[key] || 0) / published.length : 0;
    if (published.length >= 20 && Math.abs(share - config.target) > SCORE_RULES.targetTolerance) findings.push({level:'warning',id:null,message:`Rareté ${key} : ${Math.round(share*100)}% au lieu de ${Math.round(config.target*100)}%.`});
  }
  // À 8 cartes distinctes il faut au moins 9 cartes publiées pour former 2 decks distincts.
  for (const [key,count] of Object.entries(faction)) {
    if (count < DECK_SIZE + Math.max(0,minFactionDecks-1)) findings.push({level:'warning',id:null,message:`Faction ${key} : ${count} cartes, trop peu pour ${minFactionDecks} decks mono-faction différents.`});
    if (!roles[key]?.defense && !roles[key]?.control) findings.push({level:'warning',id:null,message:`Faction ${key} : aucune carte de contrôle ou défense.`});
    if (Math.max(...Object.values(roles[key] || {unknown:0})) / count > 0.8 && count >= DECK_SIZE) findings.push({level:'warning',id:null,message:`Faction ${key} : rôles trop concentrés.`});
  }
  const allAbilities = new Set(published.map(x => x.ability_type));
  for (const [key, ability] of Object.entries(ABILITY_RULES)) {
    if (allAbilities.has(key) && ability.counters.length && !ability.counters.some(x=>allAbilities.has(x)))
      findings.push({level:'warning',id:null,message:`Aucune réponse publiée au pouvoir ${key}.`});
  }
  return { total:rows.length, published:published.length, rarity, faction, roles,
    findings, blocking:findings.filter(x=>x.level==='blocking').length,
    overpowered:findings.filter(x=>x.level==='overpowered').length,
    underpowered:findings.filter(x=>x.level==='underpowered').length,
    warnings:findings.filter(x=>x.level==='warning').length };
}
export function chooseClosestDeck(targetPower, candidates) {
  return [...candidates].sort((a,b) => Math.abs(deckPower(a)-targetPower)-Math.abs(deckPower(b)-targetPower))[0] || null;
}
