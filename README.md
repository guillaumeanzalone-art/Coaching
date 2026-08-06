# Patch V159 — Palier aventure fiable

## Le bandeau « Exceeding usage limits »

Il peut provoquer des erreurs si Supabase a réellement restreint les services.
Dans ce cas, aucune requête applicative ne peut fonctionner avant la levée de
la restriction.

Le patch V159 distingue désormais clairement ce cas d'un bug d'affichage.

## Correction

- RPC dédiée qui lit seulement :
  - adventure_difficulty
  - kills_toward_boss
  - boss_wins
- Aucun recalcul avec le niveau ou l'XP.
- Aucun fallback silencieux vers palier 1.
- En cas d'erreur Supabase, l'erreur exacte apparaît dans le panneau.
- Lecture actualisée à chaque ouverture du panneau RPG.
- Toutes les pages chargent une URL V159 neuve pour casser le cache V151.

## Installation

1. Exécuter `SUPABASE/PATCH_SUPABASE_V159_PALIER_RPC.sql`.
2. Téléverser tout le contenu du dossier `GITHUB` à la racine du dépôt.
3. Commit changes, attendre GitHub Pages, puis Ctrl + F5.

## Vérification Guillaume

Le panneau doit afficher :

- En ligne · V159
- source RPC dédiée OK
- palier SQL 173
- compteur boss 50/50

Si une erreur 402, 5xx ou quota apparaît, le problème vient alors réellement
de la restriction Supabase et non du calcul du palier.

Pages HTML mises à jour : 41.
