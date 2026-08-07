# V166 — Résistance d'équipement universelle + XP à 50 paliers

## Règle des dégâts

Tous les monstres appliquent le malus de sous-équipement :

- Simple
- Commun
- Peu commun
- Rare
- Épique
- Légendaire
- Mythique
- Ultra mythique
- Abyssal
- personnages spéciaux
- boss

Il n'existe aucune immunité liée à la rareté DU MONSTRE.

L'immunité concerne uniquement les PIÈCES équipées :

- Ultra mythique
- Abyssale

Une telle pièce est considérée comme couvrant le niveau requis pour son propre
emplacement. Les autres emplacements ordinaires peuvent toujours provoquer
le malus.

## XP

L'écart est calculé directement en paliers par rapport au maximum débloqué :

- 0–9 : 100 %
- 10–19 : 90 %
- 20–29 : 75 %
- 30–39 : 60 %
- 40–49 : 45 %
- 50+ : 0 %

Exemple max 173 :
- palier 124 = écart 49 = 45 % XP
- palier 123 = écart 50 = 0 XP

Les boss restent à 0 XP selon la règle déjà existante.

## Installation

1. Exécuter le SQL Supabase.
2. Téléverser le contenu GITHUB à la racine quand GitHub Pages est disponible.
3. Vérifier que le badge affiche V166.

Le SQL crée un wrapper de validation de combat idempotent afin qu'un clic
"Réessayer la validation" ne puisse pas appliquer deux fois la correction XP.
