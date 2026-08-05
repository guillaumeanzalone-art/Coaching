PATCH V130 — AUDIO, MODE SPOTIFY ET OPTIMISATION DES MP3

Base analysée : Coaching-main (11).zip

Nouveaux réglages dans le panneau RPG :
- interrupteur séparé pour la musique du jeu ;
- interrupteur séparé pour les effets sonores ;
- réglage du volume de la musique ;
- réglage du volume des effets ;
- bouton « Mode Spotify » qui coupe tout l’audio du jeu ;
- bouton « Tout activer » ;
- mémorisation automatique des choix dans le navigateur pour toutes les pages athlètes.

Comportement musical :
- une musique désactivée ne peut plus redémarrer au combat suivant ;
- la même piste de combat reprend à la position mémorisée lorsqu’elle est réutilisée ;
- les musiques et effets sont chargés à la demande au lieu d’être tous préchargés ;
- les paliers 70–99 et le raid disposent de pistes de secours si leur MP3 dédié est absent ;
- le mode Spotify coupe musique et effets afin d’éviter au maximum de prendre le contrôle audio du téléphone.

Important pour Spotify :
- le mode Spotify est la solution la plus fiable car le jeu ne produit alors aucun son ;
- si les effets restent activés, iOS ou Android peut malgré tout baisser ou interrompre brièvement Spotify selon le navigateur. Ce comportement dépend du système et ne peut pas être imposé par une application web.

Optimisation du poids :
- les 28 fichiers MP3 ont été réencodés à 128 kbit/s ;
- poids total des MP3 avant : environ 72,54 Mio ;
- poids total des MP3 après : environ 49,97 Mio ;
- réduction : environ 31,1 % ;
- les durées des fichiers ont été conservées.

Installation :
1. Remplacer app.js.
2. Remplacer les pages HTML du patch afin d’actualiser la version de cache app.js.
3. Remplacer les MP3 par les versions optimisées fournies.
4. Ne pas remplacer supabase-config.js par un fichier d’exemple.
5. Publier sur GitHub puis effectuer un Ctrl+F5 ou fermer et rouvrir la web app.

Aucun SQL nécessaire.
Pages avec cache app.js actualisé : 39.
