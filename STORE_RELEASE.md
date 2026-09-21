# GA Coaching — publication App Store + Google Play depuis Windows

Le workflow GitHub Actions est `.github/workflows/store-release.yml`.

Il est lancé depuis la branche par défaut `main`, mais construit par défaut le code de `v2-refactor`.

## 1. Secrets GitHub à créer

Dans GitHub : **Settings > Secrets and variables > Actions > New repository secret**.

### Android

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (nécessaire seulement pour la publication automatique)

### iOS

- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY_BASE64`

Ne jamais committer les fichiers `.jks`, `.keystore`, `.p8` ou JSON de compte de service dans Git.

## 2. Android — créer la clé de signature sur Windows

Si Android Studio est installé, PowerShell peut utiliser :

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore "$HOME\ga-coaching-release.jks" -alias ga-coaching -keyalg RSA -keysize 2048 -validity 10000
```

Conserver soigneusement le fichier `ga-coaching-release.jks` et les mots de passe. Cette clé doit rester la même pour les futures mises à jour de l'application.

Convertir ensuite le keystore en Base64 et copier le résultat :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\ga-coaching-release.jks")) | Set-Clipboard
```

Créer les secrets :

- `ANDROID_KEYSTORE_BASE64` = contenu du presse-papiers
- `ANDROID_KEYSTORE_PASSWORD` = mot de passe du keystore
- `ANDROID_KEY_ALIAS` = `ga-coaching`
- `ANDROID_KEY_PASSWORD` = mot de passe de la clé

## 3. Google Play — première mise en place

1. Créer l'application dans Google Play Console.
2. Lancer d'abord le workflow avec :
   - `source_ref = v2-refactor`
   - `version = 1.2.0`
   - `platform = android`
   - `publish = false`
3. Télécharger l'artefact `.aab` produit par GitHub Actions.
4. Faire le premier envoi manuellement dans une piste de test interne Google Play si nécessaire.
5. Dans Google Cloud :
   - créer un projet ;
   - activer **Google Play Developer API** ;
   - créer un compte de service ;
   - créer une clé JSON.
6. Dans Google Play Console > Utilisateurs et autorisations, inviter l'adresse du compte de service et lui donner les droits de publication nécessaires sur GA Coaching.
7. Copier le contenu complet du fichier JSON dans le secret GitHub `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

Après cette première configuration, le workflow peut publier automatiquement sur `internal`, `alpha`, `beta` ou `production`.

## 4. Apple — première mise en place

Le Bundle ID utilisé par l'application est :

```
com.gacoaching.app
```

Dans Apple Developer :

1. Vérifier/créer l'App ID `com.gacoaching.app`.
2. Activer la capability **HealthKit**, utilisée par GA Coaching.
3. Créer l'application correspondante dans App Store Connect.

### Clé API App Store Connect

Dans App Store Connect > Users and Access > Integrations > App Store Connect API :

1. Créer une **Team API Key** (pas une Individual API Key).
2. Utiliser un rôle permettant la distribution, idéalement Admin pour la configuration initiale.
3. Télécharger le fichier `AuthKey_XXXXXXXXXX.p8` — Apple ne permet son téléchargement qu'une fois.
4. Noter le **Key ID** et l'**Issuer ID**.
5. Trouver le **Team ID** dans le compte Apple Developer.

Convertir le fichier `.p8` en Base64 depuis PowerShell :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\chemin\AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard
```

Créer ensuite :

- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY_BASE64`

Le workflow utilise `xcodebuild` sur un runner GitHub `macos-26`, la signature automatique Apple et les certificats gérés dans le cloud. Aucun Mac local n'est requis.

## 5. Premier test recommandé

Dans GitHub :

**Actions > Store Release > Run workflow**

Utiliser :

- Source ref : `v2-refactor`
- Version : `1.2.0`
- Platform : `both`
- Publish : **false**
- Android track : `internal`

Le résultat attendu est :

- un `.aab` Android signé ;
- un `.ipa` iOS signé ;
- les deux fichiers disponibles dans les artefacts du run pendant 30 jours.

## 6. Publication

Après un build réussi, relancer le même workflow avec `publish = true`.

Pour commencer, garder Android sur `internal`.

Côté Apple, l'IPA est envoyé à App Store Connect et apparaît dans TestFlight après le traitement Apple. La soumission finale à l'App Store reste contrôlée dans App Store Connect.

## Versioning

Le workflow synchronise la même version marketing sur Android et iOS.

Exemple : `1.2.0`.

- Android : `versionCode = 100000 + numéro du run GitHub`
- iOS : build au format UTC `YYYYMMDDHHMM`

Cela évite les collisions de numéros de build entre les publications.
