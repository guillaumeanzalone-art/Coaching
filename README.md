# Patch V158 — Saisie stable des charges

## Correction

- La charge reste un brouillon pendant la frappe.
- Aucun appel Supabase et aucun rendu pendant que l'athlète écrit.
- Virgule et point acceptés : `5`, `72,5`, `72.5`, `102,25`.
- Sauvegarde uniquement à la sortie du champ, avec Entrée ou au clic sur la série.
- Une actualisation distante ne peut plus écraser la ligne active.
- Un effacement accidentel restaure la dernière charge valide.
- Entrée place le focus sur la validation de la série.
- Cible de validation agrandie à 40 × 40 px.

## Installation

Téléverser tout le contenu du ZIP à la racine GitHub.
Les 41 pages HTML sont incluses uniquement pour forcer le chargement de `app.js?v=20260806-v158-stable-load-entry`.

Aucun SQL Supabase nécessaire. Après déploiement, faire `Ctrl + F5` et vérifier le badge V158.
