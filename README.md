# Patch V160 — Palier lu directement depuis athlete_progress

## Ce que le ZIP utilisateur a révélé

Le dépôt envoyé contient déjà :

- `app.js` V159 ;
- `Guillaume.html` demandant V159.

Le site affichait pourtant V151. Le navigateur ou le déploiement servait donc
encore un ancien fichier.

## Contournement définitif du cache

Toutes les pages chargent désormais un nouveau fichier qui n'a jamais existé :

`app-v160.js?build=20260806-2002`

Le navigateur ne peut pas réutiliser l'ancien `app.js` V151 pour cette URL.

## Lecture du palier

V160 lit directement dans `athlete_progress` :

- `adventure_difficulty`
- `kills_toward_boss`
- `boss_wins`

Aucune RPC n'est nécessaire.
Aucun fallback vers le palier 1 n'est utilisé.

Le slug de Guillaume est également déclaré explicitement comme `guillaume`.

## Installation GitHub

1. Décompresser le ZIP.
2. Téléverser tout son contenu à la racine du dépôt.
3. Accepter le remplacement des pages HTML et de `app.js`.
4. Vérifier que le nouveau fichier `app-v160.js` apparaît bien dans GitHub.
5. Commit changes.
6. Attendre le déploiement et faire Ctrl + F5.

Aucun SQL Supabase n'est nécessaire.

## Résultat attendu pour Guillaume

Le panneau doit afficher :

- `En ligne · V160`
- `source lecture directe OK`
- `palier SQL 173`
- `compteur boss 50/50`

Au premier chargement V160, si l'ancien palier de farm local était resté à 1,
le sélecteur est replacé une seule fois sur le maximum débloqué.

## Diagnostic du déploiement

Si le site affiche encore V151 après avoir confirmé la présence de
`app-v160.js` dans GitHub, GitHub Pages publie une autre branche ou un autre
dossier que celui modifié. Ce ne sera alors plus un bug Supabase ou JavaScript.
