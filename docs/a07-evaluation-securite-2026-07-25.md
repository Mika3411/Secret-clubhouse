# A07 — Évaluation de sécurité complémentaire du 25 juillet 2026

**Évaluateur technique :** Codex, sur le dépôt local partagé<br>
**Périmètre :** API/web, continuité Web Push, provenance Render, client Android et APK public<br>
**Données :** aucune donnée d’enfant, aucun secret fournisseur affiché<br>
**Décision :** A07 reste ouverte pour les essais fournisseur, les appareils réels et la signature de distribution Android.

## 1. Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| `npm test` | 214 tests : 209 réussis, 0 échec, 5 suites PostgreSQL ignorées faute de `TEST_DATABASE_URL` locale |
| `npm audit --audit-level=high` | aucune vulnérabilité élevée dans les dépendances npm |
| `npm run build` | build Vite de production réussi |
| `android/gradlew testDebugUnitTest lint` | tests unitaires Android réussis ; premier lint : 4 erreurs et 25 avertissements ; après correction : 0 erreur et 15 avertissements |
| `android/gradlew assembleDebug` | APK 1.11 (`versionCode 12`) construit, synchronisé avec le build web et copié dans `public/downloads/Secret-Clubhouse.apk` |
| Vérification publique Render antérieure | healthcheck et entrée publique `200`, cache API interdit, en-têtes de sécurité présents, assets identiques au build du SHA CI vert |
| Vérification GitHub | unique administrateur du dépôt, Secret Scanning et protection au push activés ; MFA non observable |

Les cinq tests ignorés exigent une base PostgreSQL locale explicitement identifiée comme base de test. Leur absence ne remet pas en cause la preuve A06 déjà établie, mais cette exécution ne constitue pas un nouveau rejeu PostgreSQL.

## 2. Constats corrigés

### A07-2026-07-25-01 — rotation VAPID non continue — élevé

Avant correction, une seule paire était chargée et les souscriptions ne portaient pas d’identifiant de paire. Une rotation pouvait interrompre les notifications existantes.

Correction vérifiée :

- keyring VAPID actif/précédent fourni uniquement par les secrets Render en production ;
- empreinte publique stable enregistrée avec chaque souscription ;
- choix de la paire par souscription et repli limité aux erreurs d’authentification VAPID ;
- détection côté navigateur de la nouvelle clé et recréation de la souscription ;
- démarrage fermé si une paire déclarée est absente ou mal formée ;
- tests unitaires de chargement, repli, expiration et association client.

Reste à faire : exercice réel avec une ancienne et une nouvelle paire et réception via les fournisseurs navigateur. Le constat de code est corrigé ; l’exercice appartient encore à A04/A07.

### A07-2026-07-25-02 — appels Telecom non bornés à Android 8 — élevé

Android lint a détecté trois appels réservés à l’API 26 alors que le minimum est l’API 24. Le quatrième échec concernait l’échappement du chemin SDK local.

Correction vérifiée :

- les appels `ConnectionService` autogérés sont désormais isolés derrière des contrôles directs `SDK_INT >= 26` ;
- Android 7 conserve l’interface de notification d’appel sans exécuter les API Telecom indisponibles ;
- les attributs d’écran verrouillé inutiles dans le manifeste sont retirés, le code conservant son repli compatible ;
- les permissions sont replacées avant l’application ;
- le fichier local SDK est correctement échappé ;
- le second lint termine avec `BUILD SUCCESSFUL`, 0 erreur.

### A07-2026-07-25-03 — preuve ambiguë du commit Render — modéré

La comparaison d’assets permettait seulement une inférence. Le healthcheck expose maintenant le SHA complet validé fourni par Render, et le vérificateur `production:verify` exige la correspondance du SHA, HTTPS, `no-store`, `X-Request-ID` et les assets versionnés.

Ce mécanisme ne révèle aucun secret et ne remplace pas les captures privées A08.

### A07-2026-07-25-04 — sauvegardes Android insuffisamment explicites — modéré

`allowBackup=false` était présent, mais Android 12 recommande des règles distinctes de sauvegarde et de transfert.

Correction vérifiée :

- règles `fullBackupContent` pour les anciennes versions ;
- règles `dataExtractionRules` pour Android 12 et versions suivantes ;
- exclusion de tous les domaines racine, fichiers, bases, préférences et stockage externe ;
- test automatisé empêchant leur retrait accidentel.

### A07-2026-07-25-05 — APK public signé avec l’identité Android de test — élevé, ouvert

La version 1.11 (`versionCode 12`) est publiée dans `public/downloads/Secret-Clubhouse.apk` et proposée uniquement depuis le groupe parent « Compte et application ». Elle conserve l’identité de signature de test des APK 1.6 à 1.10 afin de rester installable comme mise à jour sur les appareils du prototype. Le flux `mobile:sync` retire l’APK public du build web avant la copie Capacitor afin qu’un paquet Android n’embarque jamais le paquet de téléchargement précédent.

Cette identité n’est pas une signature de distribution maîtrisée : sa clé n’offre pas le niveau de protection attendu pour une diffusion de production. Avant toute utilisation par des enfants réels, il faut choisir et protéger une identité de signature de distribution, organiser la migration ou la réinstallation des appareils de test, vérifier l’absence de secret embarqué, puis refaire les essais de mise à jour et d’intégrité. Le constat reste ouvert et empêche la clôture d’A07.

## 3. Avertissements Android résiduels

Les quinze avertissements restants ne sont ni critiques ni élevés :

- mise à jour corrective Gradle disponible ;
- ressources Capacitor générées ou historiques détectées comme inutilisées ;
- variantes du splash screen ayant des densités incohérentes ou dupliquées.

Ils doivent être traités lors d’un chantier de nettoyage visuel/natif, mais ne permettent pas à eux seuls un accès aux données, un contournement d’autorisation ou l’activation d’une API absente.

## 4. Périmètre non encore testé

A07 ne peut pas être fermée sans :

1. appel audio et vidéo réel entre deux comptes autorisés et deux appareils/réseaux distincts, avec preuve du relais TURN lorsque nécessaire ;
2. notification Web Push générique reçue sur les versions Chrome et Edge Windows réellement supportées, application fermée ;
3. notification FCM générique reçue sur un Android verrouillé, puis suppression/révocation du jeton testée ;
4. alerte APNs et appel PushKit reçus sur un iPhone verrouillé, avec acceptation et refus depuis l’écran d’appel ;
5. arrêt immédiat de chaque sonnerie après acceptation, refus, annulation et timeout ;
6. validation des binaires signés de distribution, sans secret embarqué ;
7. résultat de la CI incluant le lint Android sur le SHA finalement déployé.

Les essais utilisent seulement des comptes et contenus synthétiques. Tant qu’ils ne sont pas consignés, aucun enfant réel n’est autorisé et A07 reste `open`.
