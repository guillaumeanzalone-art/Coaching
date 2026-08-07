# V171 — GL Points automatiques

- IPF GL Classic / Raw 3-Lift uniquement.
- Backfill immédiat de tous les `athlete_progress.gl_points`.
- Anzalone : 350 / 210 / 350 à 120 kg = 105.783819 GL.
- Le programme courant est identifié par `programKey`.
- À chaque nouveau programme principal, l'accueil et la page de l'athlète
  renvoient ses nouveaux maxes/PDC/sexe à Supabase.
- Les maxes figés des profils canoniques de l'accueil ne bloquent plus les
  nouvelles programmations.
- Le parsing des maxes recherche explicitement `Squat:`, `Bench:`, `Deadlift:`.
- Louis utilise `Louis (2).html` / `louis_v3`, le bloc le plus récent.
- Magicarpe V170 est conservée.
- RPE Tom Gibertini V167 conservé.
- Roi Noeil / leaderboard V168 conservé.

`gl_multiplier` n'est pas réinventé ici : ce patch corrige la source
`gl_points` et conserve la logique de coefficient XP déjà existante.

Installation :
1. SQL Supabase.
2. Contenu GITHUB à la racine.
3. Vérifier V171.
