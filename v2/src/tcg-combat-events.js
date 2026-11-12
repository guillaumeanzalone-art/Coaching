// Convertit les valeurs exactes calculées par le moteur en événements visuels.
// Aucun jet de hasard, aucun recalcul de combat, aucun inventaire modifié ici.
import { TCG_MOTION } from './tcg-motion-config.js';
const emit=(type,payload={})=>({type,duration:TCG_MOTION.timings[type]||240,...payload});
const abilityLabel={power:'Puissance',guard:'Ancrage',tempo:'Tempo',technique:'Technique',chaos:'Instinct',poison:'Poison',fire:'Feu'};
export function buildTcgRoundEvents(before, after) {
  if (!before?.history || !after?.history || after.history.length !== before.history.length+1)
    throw new Error('La séquence requiert une manche réellement résolue.');
  const h=after.history.at(-1);
  const result=[
    emit('locked',{message:'Choix verrouillés : les deux combattants sont prêts.',round:h.round}),
    emit('reveal',{message:`${h.playerName} contre ${h.aiName} — cartes révélées.`,
      playerCardId:h.playerCardId,aiCardId:h.aiCardId,playerBid:h.playerBid,aiBid:h.aiBid}),
    emit('energy',{message:`Mises : ${h.playerBid} contre ${h.aiBid} Pillz${h.playerFury||h.aiFury?' · Fury engagée':''}.`,
      playerPillz:after.playerPillz,aiPillz:after.aiPillz}),
  ];
  for(const side of ['player','ai']){
    for(const effect of (h[side+'Effects']||[])){
      result.push(emit('modifier',{side,kind:effect.kind,source:effect.source,
        delta:effect.delta,message:`${side==='player'?h.playerName:h.aiName} · ${effect.source==='faction'?'Bonus de faction':effect.source==='fury'?'Fury':abilityLabel[effect.ability]||'Pouvoir'} : ${effect.label}.`}));
    }
  }
  result.push(emit('attack',{message:`ATQ finale : ${h.playerAttack} contre ${h.aiAttack}.`,
    playerAttack:h.playerAttack,aiAttack:h.aiAttack,playerPower:h.playerPower,aiPower:h.aiPower}));
  if(h.playerAttack===h.aiAttack){
    result.push(emit('priority',{message:h.priorityReason==='lower_bid'
      ?`Égalité d'attaque : la mise la plus basse donne la priorité à ${h.winner==='player'?h.playerName:h.aiName}.`
      :`Égalité parfaite : la priorité de la manche donne l'avantage à ${h.winner==='player'?h.playerName:h.aiName}.`,
      winner:h.winner,reason:h.priorityReason}));
  }
  if(h.shieldAbsorbed>0)result.push(emit('shield',{side:h.winner==='player'?'ai':'player',
    value:h.shieldAbsorbed,message:`Bouclier : ${h.shieldAbsorbed} dégât(s) absorbé(s).`}));
  result.push(emit('clash',{winner:h.winner,damage:h.damage,
    message:`${h.winner==='player'?h.playerName:h.aiName} gagne le duel.`}));
  result.push(emit('damage',{side:h.winner==='player'?'ai':'player',winner:h.winner,
    amount:h.damage,fromHp:h.winner==='player'?h.aiHpBefore:h.playerHpBefore,
    toHp:h.winner==='player'?h.aiHpAfterHit:h.playerHpAfterHit,
    message:`−${h.damage} PV · ${h.winner==='player'?h.aiName:h.playerName} subit l'impact.`}));
  if(h.venomDamageToPlayer>0)result.push(emit('poison',{side:'player',amount:h.venomDamageToPlayer,
    toHp:h.playerHpAfter,message:`Poison : −${h.venomDamageToPlayer} PV pour ${h.playerName}.`}));
  if(h.venomDamageToAi>0)result.push(emit('poison',{side:'ai',amount:h.venomDamageToAi,
    toHp:h.aiHpAfter,message:`Poison : −${h.venomDamageToAi} PV pour ${h.aiName}.`}));
  if(h.poisonApplied)result.push(emit('poison_apply',{side:h.winner==='player'?'ai':'player',
    message:'Poison appliqué : les dégâts commenceront à la prochaine manche.'}));
  if(h.playerHpAfter===0||h.aiHpAfter===0)result.push(emit('ko',{side:h.playerHpAfter===0?'player':'ai',
    message:h.playerHpAfter===0?`${h.playerName} est KO.`:`${h.aiName} est KO.`}));
  if(after.finished)result.push(emit('end',{result:after.result,
    playerHp:after.playerHp,aiHp:after.aiHp,
    message:after.result==='win'?'Victoire !':after.result==='loss'?'Défaite.':'Match nul.'}));
  return result;
}
export function roundEventSummary(before,after) {
 const list=buildTcgRoundEvents(before,after);
 return {events:list,finalHp:{player:after.playerHp,ai:after.aiHp},
  finalPillz:{player:after.playerPillz,ai:after.aiPillz}};
}
