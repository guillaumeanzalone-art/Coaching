# La Toile / Nocturne — Refonte visuelle TCG

## Audit (source du 13 novembre 2026)
Le TCG Vite de l'application CoachTrack possédait déjà des cartes par rareté, une collection, un deck de 8 cartes, des boosters, le combat et ses animations. Les anciens styles étaient cependant dispersés dans `ensureStyles()`, `tcg-spider-theme.css`, `tcg-interface-clean.css`, `tcg-motion.css` et des styles propres aux personnages. Symptômes : plusieurs palettes contradictoires, textes parfois en 7–11px, disposition de deck sous forme de liste, combat compact et priorité visuelle insuffisante aux PV/Pillz. Audit basé sur le code ; aucun contrôle Safari iOS physique ni capture navigateur authentifiée n'a été exécuté.

## Direction artistique : « Nocturne »
Univers d'archives mystérieuses et de factions, fond encre `#090c12`, surface `#141924`, surface relevée `#1c2330`, texte `#f6f3fa`, texte secondaire `#bec4d4`, accent lilas `#d9b4f3`. Titres Georgia (sérif éditorial), corps Inter avec repli system-ui. Échelle CSS 4 / 8 / 12 / 16 / 24 / 32px. Arrondis 10 / 16 / 24px. Toutes les nouvelles règles sont regroupées dans `src/tcg-premium-ui.css` et limitées à `.tcg-app.tcg-spider`, sans impact sur l'entraînement.

Factions (variables CSS) : puissance `#c89bfa`, garde `#83baff`, tempo `#8ee6d5`, technique `#ffd093`, chaos `#fc9aad`, poison `#a9e488`, feu `#ffb178`. Les symboles natifs `archetype.icon` et le libellé complètent la couleur. Raretés : commune `#abb2c4`, peu commune `#55cfa4`, rare `#6c9dff`, ultra `#ca8aff`, secrète `#f9cf7c`. États : PV `#fa888f`, énergie `#ffd488`, victoire `#78e5b2`, défaite `#ff929d`. Les choix d'animation de rareté continuent d'utiliser `tcg-motion-config.js`.

## Interfaces modifiées
- **Cartes** : `renderCard` dispose d'un paramètre `size` (mini, hand, combat, detail), expose la faction pour le style et rend les statistiques du moteur plus lisibles. Les arts WebP, sprites et illustrations individuels existants sont inchangés. Les galeries d'évolution sont conservées.
- **Collection** : recherche par nom, filtres rareté/faction, tri rareté/puissance/dégâts/nom, affichage des cartes non possédées, 36 cartes initiales et bouton « Afficher davantage », images lazy, indicateur de présence dans l'équipe et fiche au toucher. Les pouvoirs sont consultables dans la fiche.
- **Équipes** : 8 emplacements visuels, retrait direct, validation avec le même `validateDeck`, composition et raretés, bonus possibles signalés. Le deck actif conserve sa sauvegarde Supabase historique. Les compositions secondaires sont des presets dans le `localStorage` **de l'appareil uniquement** (non synchronisés).
- **Combat** : badges manche/priorité/état, zone AI au-dessus du duel et statut joueur sous le duel en portrait, PV/Pillz rehaussés et historique repliable. Le moteur et les ressources ne changent pas.
- **Menus** : priorité « Combattre », badge boosters disponibles, dock portrait cinq destinations, écran Profil avec progression et paramètres audio/vibrations, zones sûres de l'iPhone et cibles tactiles 44px.

## Assets et état de validation
Aucun fichier image existant remplacé. Aucun nouvel asset sous licence ajouté ; le thème utilise seulement CSS et les icônes de faction déjà présentes. Assets optionnels ultérieurs : sept blasons de faction SVG 64×64 (pour l'accessibilité et les écrans de détails), cinq textures de rareté SVG 256×384, un fond d'arène WebP 1080×1920 optimisé. Ce sont des **suggestions non produites** ; l'application reste utilisable sans eux.

Vérification automatisée : tests Node TCG existants + `tcg-premium-ui.test.js`, validateur de catalogue, simulation reproductible et build Vite via GitHub Actions. Les captures *avant/après* réelles en 390×844 et 1440×900 restent à réaliser sur un navigateur avec session de jeu authentifiée. Safari iOS physique, VoiceOver, profil à 300 cartes et performances de GPU faible non vérifiés manuellement. Ne pas présenter ces vérifications comme exécutées.
