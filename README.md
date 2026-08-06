# Patch V153 — Difficulté et pool de monstres

## Palier débloqué

Le palier disponible est maintenant toujours :

`max(adventure_difficulty, niveau RPG)`

Un joueur niveau 173 ayant encore la valeur historique `1` passe donc
automatiquement au palier 173. La correction est appliquée :

- dans l'interface ;
- dans Supabase ;
- à tous les comptes déjà existants ;
- à chaque future montée de niveau.

## Nouveau pool de rareté

Table à 0 Chance :

- Simple : 32 %
- Commun : 28 %
- Peu commun : 22 %
- Rare : 10 %
- Épique : 5 %
- Légendaire : 2 %
- Mythique : 0,7 %
- Ultra mythique : 0,25 %
- Abyssal : 0,05 %

La Chance augmente Peu commun jusqu'à ×3 et Rare+ jusqu'à ×4.
Chasseur épique renforce Rare+ jusqu'à ×2.

Pour les valeurs visibles sur la capture — Chance 997 et Chasseur +22 % —
la nouvelle estimation est :

- Simple : 18.080 %
- Commun : 15.820 %
- Peu commun : 28.953 %
- Rare : 20.637 %
- Épique : 10.319 %
- Légendaire : 4.127 %
- Mythique : 1.445 %
- Ultra mythique : 0.516 %
- Abyssal : 0.103 %

Le serveur tire d'abord la rareté, puis un monstre de cette rareté. Le nombre
de monstres présents dans une catégorie ne modifie donc plus sa probabilité.

## Installation

### Supabase — en premier

Exécuter :

`SUPABASE/PATCH_SUPABASE_V153_DIFFICULTE_POOL.sql`

Les contrôles finaux doivent afficher :

- `comptes_encore_bloques = 0`
- `pool_v153_actif = true`

### GitHub

Remplacer uniquement `app.js` par celui du dossier `GITHUB`.

Faire ensuite **Commit changes**, attendre le déploiement et recharger avec
`Ctrl + F5`.

Aucun compte, équipement, XP, gold ou bestiaire n'est réinitialisé.
