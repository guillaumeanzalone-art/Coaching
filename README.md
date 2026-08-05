# GA Coaching — dossier de production

Ce dossier contient uniquement les fichiers utiles au site publié.

## Nouveautés de cette version

- Mini-jeu de combat simplifié : fenêtre de « parfait » nettement élargie sur toutes les cibles.
- Enchaînement facilité : cibles plus grandes, délai maximal d’environ 1 seconde et fenêtre de parfait beaucoup plus large.
- Suppression visuelle du bouton doré : il est remplacé par un grand trait lumineux. Toute frappe valide sur ce trait donne automatiquement un « parfait ».
- Double tap plus tolérant et cibles générales agrandies pour le jeu mobile.
- Version de `app.js` renouvelée sur toutes les pages afin d’éviter que le navigateur conserve l’ancien mini-jeu en cache.

- Rééquilibrage RPG : Force, Chance et Fortune utilisent maintenant un coût exponentiel (+15 % par rang).
- Remise à zéro globale des statistiques permanentes achetées, Maxence compris, sans toucher au gold, à l’XP ou aux objets.

- Bilan en bas de chaque séance : hydratation, douleur upper, douleur lower, sommeil et nombre de steps.
- Sauvegarde locale immédiate, puis synchronisation Supabase lorsque le compte est connecté.
- Pendant le repos, affichage unifié de la prochaine série avec l’exercice, le numéro de série, les répétitions et la charge cible.
- Ajout de la synchronisation commune aux pages Alexandre, Lucine et Matthieu.
- Suppression des anciennes archives ZIP, correctifs, guides intermédiaires, scripts JS doublons et pages athlètes dupliquées.

## Mise en ligne

1. Dans Supabase, ouvrir **SQL Editor**.
2. Exécuter une seule fois `MIGRATION_SESSION_CHECKINS.sql`.
3. Exécuter une seule fois `MIGRATION_STATS_RPG_EXPONENTIELLES_RESET.sql`. Cette migration remet immédiatement Force, Chance et Fortune à zéro pour tout le monde.
4. Remplacer les fichiers du dépôt GitHub par le contenu de ce dossier.
5. Conserver `supabase-config.js` avec la configuration actuelle du projet.
6. Attendre la fin du déploiement GitHub Pages, puis forcer l’actualisation du navigateur si nécessaire.

Le fichier `supabase-schema.sql` reste la base du schéma pour une installation neuve. Pour le projet déjà en ligne, exécuter les deux migrations indiquées ci-dessus : le bilan de séance, puis le rééquilibrage RPG.

## Fichiers principaux

- `index.html` : accueil et classements.
- `*.html` : programmations des athlètes.
- `app.js` : bundle principal de synchronisation, activité, PR et RPG.
- `session-tools.js` : bilan de séance et aperçu de la série suivante.
- `program-theme.css` / `index-theme.css` : styles communs.
- `supabase-config.js` : connexion au projet Supabase.
- `MIGRATION_SESSION_CHECKINS.sql` : ajout de la table des bilans de séance.
- `MIGRATION_STATS_RPG_EXPONENTIELLES_RESET.sql` : nouveau coût exponentiel et remise à zéro globale des trois statistiques RPG.
- `supabase-schema.sql` : schéma complet pour une nouvelle installation.
