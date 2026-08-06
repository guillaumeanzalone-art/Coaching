# Patch V141 — Accueil Magicarpe et Saya Bloc 2

## Corrections

- Le compte Supabase de Magicarpe utilise réellement le slug `magicarpe`.
- `Magicarpe.html` et `app.js` utilisent désormais ce slug sans migration SQL.
- L’ancien typo `magicapre` n’est plus utilisé comme identité Supabase.
- La clé de programme existante de Magicarpe est conservée pour ne pas déplacer les séries déjà saisies.
- L’accueil affiche séparément `Saya — Bloc 1` et `Saya — Bloc 2`.
- `Saya2.html` conserve le même athlete_slug `saya`, mais son programKey distinct protège ses séries, charges, RPE et chronomètres.
- Le leaderboard ne contient qu’une seule ligne Saya.

## Installation GitHub

1. Décompresser le ZIP.
2. Dans le dépôt GitHub : **Add file → Upload files**.
3. Déposer `index.html`, `app.js`, `Magicarpe.html` et `Saya2.html` à la racine.
4. Accepter le remplacement puis cliquer sur **Commit changes**.
5. Attendre le redéploiement et recharger avec `Ctrl + F5`.

Aucun SQL Supabase n’est nécessaire. Ne modifie pas la ligne `app_users` de Magicarpe : elle est déjà correcte avec `athlete_slug = magicarpe`.
