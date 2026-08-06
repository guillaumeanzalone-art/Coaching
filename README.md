# Patch V148 — Décimales final

Ce patch contient le dernier `app.js` et conserve toutes les corrections
récentes, notamment :

- séparation stricte de Tom Deneuville (`tom`) et Tom Gibertini (`gibertini`) ;
- saisie des charges avec virgule ou point ;
- valeurs comme `72,5`, `72.5`, `102,25` et `102.25` ;
- compatibilité Supabase, tonnage, PR et activités ;
- aucune modification des anciennes charges.

## Installation GitHub

1. Décompresser le ZIP.
2. Remplacer uniquement `app.js` à la racine du dépôt.
3. Cliquer sur **Commit changes**.
4. Attendre le redéploiement.
5. Recharger l’application avec `Ctrl + F5`.

Aucun SQL Supabase n’est nécessaire.
