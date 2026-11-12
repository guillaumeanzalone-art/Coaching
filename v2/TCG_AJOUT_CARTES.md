# Ajouter des cartes au TCG (sans budget de deck)

## Règles stables
Un deck = **8 cartes différentes**, sans coût de construction, sans plafond de points. Le score n'est qu'un indicateur d'équilibre et de matchmaking. Une carte rare a un avantage voulu sans victoire garantie (Pillz, bluff, contres). Aucune limite de catalogue.

## Format et publication
La source en production est `public.tcg_cards_v2` sur Supabase. Son identifiant `id` est **immuable**, même si le nom, l'image ou les stats changent. Nouveau contenu : `draft`, puis `test`, enfin `published`. Seules les cartes publiées peuvent être obtenues ou jouées. Les boosters utilisent `booster_ids` (identifiants existants ou `*`), pas une liste fixe dans le moteur.

Champs obligatoires : `id`, `character_slug`, `name`, `rarity`, `faction`, `attack`, `guard`, `power`, `damage`, `ability_type`, `publication_status`, `booster_ids`. `legacy_duel_cost` n'est PAS un coût de deck : uniquement une ancienne valeur technique liée au duel, conservée pour compatibilité.

Voir le modèle JSON `data/tcg-card-template.json`. Lors de l'ajout d'un nouveau personnage, relier `character_slug` à son profil visuel si possible et renseigner `art_url` sinon.

## Score et fourchettes
Le score est calculé, jamais fixé librement : **20 × rang de rareté + 2 × puissance + 3 × dégâts + valeur(pouvoir) × fiabilité + bonus de faction**. Fourchettes proposées :
- Commune : 30–52
- Peu commune : 50–72
- Rare : 70–92
- Ultra : 90–112
- Secrète : 110–134

Les valeurs sont dans `src/tcg-catalog.js`, modifiables. Pouvoirs disponibles : power (3; 75 %), guard (3; 100 %), tempo (3; 70 %), technique (3; 65 %), chaos (2; 45 %), poison (4; 80 %), fire (4; 85 %). Les pourcentages sont des coefficients de fiabilité d'équilibrage, **pas** des probabilités de déclenchement. Modifier ces valeurs dans la configuration centrale, puis relancer les contrôles.

## Ajouter une carte
1. Copier `data/tcg-card-template.json`, compléter les champs, attribuer un ID inédit et mettre `publication_status: draft`.
2. Insérer la ligne dans `public.tcg_cards_v2` via l'éditeur SQL Supabase (pas dans le code du moteur).
3. Exporter le catalogue en JSON pour les contrôles ou actualiser `data/tcg-catalog-snapshot.json`.
4. Vérifier : `node scripts/tcg-validate.mjs [catalogue.json]`.
5. Simuler : `node scripts/tcg-simulate.mjs [catalogue-avant.json] [catalogue-apres.json]`. Rejouer exactement avec `TCG_SIM_SEED=20261112`.
6. Vérifier les messages bloquants puis publier la carte. Toute désactivation conserve ses IDs dans les collections historiques ; les decks concernés sont signalés.

Pour créer un nouveau type de pouvoir, ajouter sa règle dans `ABILITY_RULES`, son effet dans `tcg-arena.js` (et le duel classique s'il est encore utilisé), sa description et des tests de combat. Aucune exception basée sur un identifiant de carte.

## Récompenses et sécurité
Les ouvertures de boosters doivent passer par `open_tcg_pack_v2`, qui tire et enregistre toutes les cartes côté serveur avant l'animation. La configuration de taux est `tcg_slot_odds_v2`. Les anciens RPC acceptant les cartes proposées par le client ne doivent plus être accessibles aux athlètes.

## Limites de simulation
La simulation fournie est un **proxy statistique déterministe**, utile pour dépister des écarts. Elle ne prétend pas reproduire 100 % des interactions du moteur de combat ; valider les écarts importants avec des tests de combat dédiés.

## Attribution de boosters après entraînement

Les règles de validation sont stockées dans la table centrale `public.tcg_reward_policy_v2` et peuvent être modifiées sans nouveau déploiement :
- `min_completion_ratio = 0.80` (80 % des séries validées)
- `min_duration_seconds = 900` (15 minutes minimum)
- `min_completed_sets = 3`
- `min_set_span_seconds = 300` (au moins cinq minutes entre première et dernière validation, pour limiter la triche)
- `max_packs_per_day = 2`

Seules les séances clôturées et synchronisées **après l'activation de la règle** sont éligibles. Attribution transactionnelle via `claim_tcg_workout_pack_v2`, identifiant de séance unique et blocage des doublons. Toute séance hors ligne attend la synchronisation des séries et de la session. Les ouvertures et cartes sont liées à leur séance récompensée via `tcg_session_pack_awards_v2` et `tcg_openings`.

Pour ajuster : dans l'éditeur SQL du projet Supabase, par exemple :
```sql
update public.tcg_reward_policy_v2
set min_completion_ratio=0.80,min_duration_seconds=900,
    min_completed_sets=3,min_set_span_seconds=300,max_packs_per_day=2
where id=1;
```
Ne pas réactiver les RPC historiques `claim_tcg_workout_pack_v1` et `open_tcg_pack_v1`, car ils ne vérifient pas toutes les conditions côté serveur.
