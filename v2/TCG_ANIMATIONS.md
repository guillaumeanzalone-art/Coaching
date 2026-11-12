# Animations TCG — La Toile des Ombres (v2)

## Architecture auditée
- Stack : Vite + JavaScript natif, CSS thématique et Supabase. Pas de moteur visuel externe ni dépendance lourde.
- Moteur et résultats : `src/tcg-arena.js` (statistiques, mise, effets, HP, poison).
- Événements basés sur le résultat : `src/tcg-combat-events.js`.
- Lecture annulable et accélérable : `src/tcg-timeline.js`.
- Présentation, touches et état : `src/tcg-game.js`.
- Palette, durées, intensités : `src/tcg-motion-config.js`.
- Animations GPU et styles mobiles : `src/tcg-motion.css`.
- Sons synthétiques originaux / vibration facultative : `src/tcg-feedback.js`.

Les illustrations WebP et SVG du projet sont conservées telles quelles ; aucun asset externe n'est copié.

## Rareté
Les cinq raretés existantes ont des coloris, bordures, auras et temps de révélation progressifs. Le moteur ne consulte pas ces valeurs : **la rareté est déjà déterminée côté serveur** par `open_tcg_pack_v2` avant toute animation.

## Ouverture
1. Sélection d'un booster scellé et clic/toucher, avec blocage des doubles soumissions.
2. Chargement sans prétendre avoir obtenu des cartes avant confirmation du serveur.
3. Déchirure (sauf ouverture rapide/réduite).
4. Cinq cartes serveur face cachée, retournables par toucher/clavier ou automatiquement.
5. Bouton « Tout révéler » et « Passer / récapitulatif ».
6. Récapitulatif NOUVELLE / DOUBLON fondé sur la collection avant le RPC.
7. Choix de la vitesse ×2, mode rapide, son et vibration (désactivés par défaut).

Les probabilités éventuelles sont chargées depuis `tcg_slot_odds_v2`. En cas d'indisponibilité, elles ne sont pas affichées. Les garanties Ultra/Secrète et replis sont documentés.

## Combats
Le moteur enregistre les mêmes valeurs numériques qu'il utilise pour ses résultats. Le constructeur d'événements produit les étapes réellement applicables : verrouillage, révélation, Pillz, pouvoirs et bonus, attaque finale, départage éventuel, bouclier, choc, dégâts, poison, KO, résultat final. Aucun soin ou annulation de pouvoir n'est simulé puisque ces mécaniques n'existent pas encore dans ce moteur.

La présentation consomme les événements dans l'ordre, sans recalculer les dégâts : cartes face cachée, retournement, nombres d'attaque, impact, HP et statut. La vitesse ×2 et « Passer » terminent immédiatement la séquence, sans modifier l'issue. Les animations sont annulées quand l'écran est quitté. Avec `prefers-reduced-motion`, la timeline ne joue que de courtes transitions de texte et les secousses/particules sont désactivées.

## Paramètres modifiables
`TCG_MOTION.timings` : durées par étape. `TCG_MOTION.rare` : couleurs, particules et durée de révélation de chaque rareté. `soundNotes` : tonalités synthétisées. Les réglages individuels sont stockés localement.

## Tests
`npm run test:tcg` + `npm run build` avec GitHub Actions ; `tests/tcg-motion.test.js` teste l'ordre chronologique, les HP/dégâts exacts, la priorité, l'idempotence de l'animation, la réduction de mouvement et le tirage serveur.

## Limites
- Aucun effet de soin ou d'annulation ne doit s'afficher tant que le moteur ne les produit pas.
- Les animations graphiques exactes sur Safari iOS et la cadence 60 FPS doivent être mesurées sur un appareil réel. Les tests Node/build ne prouvent pas la fluidité de tout smartphone.
- Les sons sont des tonalités créées par WebAudio et peuvent rester muets lorsque le navigateur bloque l'audio (comportement normal). La vibration n'est disponible que si le navigateur la prend en charge.
