# Patch V157 — Palier réel

## Cause exacte

L'ancienne requête demandait une longue liste de colonnes.

Si une seule colonne récente était absente du schéma ou du cache Supabase,
l'application utilisait une requête de secours. Cette requête récupérait le
niveau, l'XP, l'or et la puissance, mais pas :

- adventure_difficulty
- kills_toward_boss
- boss_wins

Le jeu remettait donc localement le palier à 1 et le compteur à 0.

## Correction

- Lecture de la ligne complète avec select('*').
- Suppression du fallback incomplet.
- Vérification du slug de la ligne reçue.
- adventure_difficulty utilisé tel quel.
- kills_toward_boss utilisé tel quel.
- Niveau RPG et XP exclus.
- Suppression des triggers V153/V154/V156 d'alignement sur le niveau.

## Guillaume

La ligne montrée dans Supabase doit produire :

- palier 173
- compteur 50/50
- boss disponible

## Installation

### Supabase

Exécuter :

SUPABASE/PATCH_SUPABASE_V157_PALIER_REEL.sql

Le premier contrôle doit conserver les valeurs de Guillaume.
triggers_alignement_restants doit afficher 0.

### GitHub

Téléverser tout le contenu du dossier GITHUB à la racine.

Après le déploiement et Ctrl + F5, vérifier :

- En ligne · V157
- Progression V157
- ligne guillaume
- palier Supabase 173
- compteur boss 50/50

Pages HTML incluses : 41.
