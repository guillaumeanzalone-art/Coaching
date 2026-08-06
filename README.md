# Patch V144 — Séparation définitive des deux Tom

## Correspondances canoniques

| Athlète | Slug Supabase | Page GitHub | Avatar |
|---|---|---|---|
| Tom Deneuville | `tom` | `TomDeneuville.html` | `avatar-tom.png` |
| Tom Gibertini | `gibertini` | `gibertini.html` | `avatar-gibertini.png` |

## Protections ajoutées

- `gibertini` n’est plus exclu de la page d’accueil.
- Les deux athlètes ont désormais chacun une carte distincte.
- `Tom.html`, ancien fichier ambigu, n’est plus scanné par la page d’accueil.
- `app.js` verrouille l’identité selon le fichier ouvert :
  - `TomDeneuville.html` ne peut utiliser que `tom`.
  - `gibertini.html` ne peut utiliser que `gibertini`.
  - l’ancien `Tom.html` reste rattaché à `gibertini` pour ne pas déplacer ses anciennes données.
- Aucun slug, aucune progression RPG et aucune donnée Supabase ne sont déplacés.

## Installation GitHub

Décompresser le ZIP puis remplacer à la racine :

- `index.html`
- `app.js`
- `TomDeneuville.html`
- `gibertini.html`
- `avatar-tom.png`
- `avatar-gibertini.png`

Cliquer sur **Commit changes**, attendre le redéploiement puis effectuer `Ctrl + F5`.

Aucun SQL Supabase n’est nécessaire.
