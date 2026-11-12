// La Toile des Ombres — source unique des réglages d'animations et des couleurs.
// La rareté influe uniquement sur la présentation, jamais sur le tirage.
export const TCG_MOTION = Object.freeze({
  timings: Object.freeze({
    packTension: 430, packTear: 690, cardsEnter: 240,
    cardFlipBase: 380, recap: 200,
    locked: 260, reveal: 310, energy: 230, modifier: 180,
    attack: 300, priority: 230, shield: 180, clash: 380,
    damage: 370, poison: 260, ko: 500, end: 470,
  }),
  maxParticles: 8,
  lowEndParticles: 2,
  defaultVolume: 0.23,
  rare: Object.freeze({
    common:   { color:'#abb2c4', glow:'rgba(159,179,213,.12)', sheen:0.06, particles:0, reveal:300 },
    uncommon: { color:'#55cfa4', glow:'rgba(85,207,164,.23)', sheen:0.12, particles:1, reveal:420 },
    rare:     { color:'#6c9dff', glow:'rgba(108,157,255,.30)', sheen:0.19, particles:2, reveal:570 },
    ultra:    { color:'#ca8aff', glow:'rgba(202,138,255,.38)', sheen:0.29, particles:4, reveal:800 },
    secret:   { color:'#f9cf7c', glow:'rgba(249,207,124,.47)', sheen:0.39, particles:6, reveal:1150 },
  }),
  soundNotes: Object.freeze({
    start: 280, tear: 165, flip: 460, rare: 670, secret: 890,
    attack: 130, impact: 95, poison: 210, shield: 320, ko: 80, victory: 630,
  }),
})
export function rarityFx(rarity) {
  return TCG_MOTION.rare[rarity] || TCG_MOTION.rare.common;
}
export function rarityCss(rarity) {
  const x=rarityFx(rarity);
  return `--tcg-rarity-color:${x.color};--tcg-rarity-glow:${x.glow};--tcg-rarity-sheen:${x.sheen}`;
}
export function deviceMotionSettings(win = typeof window !== 'undefined' ? window : null) {
  const reduced = Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const low = Boolean(win?.navigator?.connection?.saveData) ||
    (Number(win?.navigator?.hardwareConcurrency) > 0 && Number(win?.navigator?.hardwareConcurrency) <= 4);
  return {reduced, low, particles:reduced ? 0 : low ? TCG_MOTION.lowEndParticles : TCG_MOTION.maxParticles};
}
export function eventDuration(type, {speed=1,reduced=false}={}) {
  if (reduced) return 50;
  return Math.max(50,Math.round((TCG_MOTION.timings[type] || 220)/(speed===2?2:1)));
}
