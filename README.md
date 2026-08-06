# Patch V155 — Leaderboard RPG

## Nouvel onglet

Un onglet **🏆 Leaderboard** est placé juste après **Collection**.

Il n'est pas abonné au temps réel. Les données sont récupérées uniquement :

- quand l'utilisateur ouvre l'onglet ;
- quand il clique sur **Actualiser**.

## Classements disponibles

- Global
- Palier
- Dégâts cumulés
- Objets rares obtenus
- Monstres rares tués

## Statistiques affichées

- Niveau RPG
- Palier de difficulté
- Dégâts cumulés
- Meilleur dégât
- Boss vaincus
- Objets Mythiques obtenus
- Objets Ultra mythiques obtenus
- Objets Abyssaux obtenus
- Monstres Mythiques tués
- Monstres Ultra mythiques tués
- Monstres Abyssaux tués

Les grands nombres utilisent :

- K, M, B, T
- AA, AB, AC, etc.

## Historique des objets

Le premier lancement initialise les compteurs avec :

- les quantités présentes dans l'inventaire ;
- les objets déjà sacrifiés dans le codex.

Les ventes ou transferts anciens ne peuvent pas être reconstitués s'ils ne
sont plus présents dans la base. Après installation, les nouveaux gains sont
comptés automatiquement. Les transferts/cadeaux explicitement identifiés par
leur source sont exclus.

## Installation

### 1. Supabase

Exécuter :

`SUPABASE/PATCH_SUPABASE_V155_RPG_LEADERBOARD.sql`

Le résultat final doit afficher les deux fonctions et le nombre d'athlètes
initialisés.

### 2. GitHub

Remplacer uniquement :

`GITHUB/app.js`

Puis Commit changes, attendre le déploiement et effectuer `Ctrl + F5`.
