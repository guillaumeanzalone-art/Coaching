PATCH V129 — SAISIE DIRECTE DES CHARGES

Base analysée : Coaching-main (10).zip

Comportement :
- aucun menu déroulant pour les charges ;
- aucun crayon nécessaire ;
- l’athlète écrit directement la charge avec le clavier ;
- la valeur est sauvegardée pendant la saisie ;
- le champ garde comme indication la charge ou l’intervalle prescrit ;
- la validation d’un Squat, Bench ou Deadlift est bloquée si la charge est vide ;
- les accessoires utilisent eux aussi un champ direct ;
- les menus RPE, temps, filtres et autres sélecteurs non liés à la charge restent inchangés.

Installation :
1. Remplacer app.js.
2. Remplacer les pages HTML contenues dans ce patch.
3. Ne pas remplacer supabase-config.js.
4. Commit GitHub, puis fermer et rouvrir la web app / Ctrl+F5.

Aucun SQL nécessaire.

Pages au rendu de charge remplacé : 36
Pages avec cache app.js actualisé : 39
