# A07 — Évaluation de sécurité du périmètre web restreint

**Date :** 23 juillet 2026<br>
**Évaluateur :** Codex — revue de code, configuration et essais automatisés locaux<br>
**Périmètre autorisé par cette évaluation :** client web, API Render et PostgreSQL, sans WebRTC, Web Push, APNs, FCM, binaire APK/IPA public ni canal d’administration RGPD partagé<br>
**Décision :** **A07 fermée pour ce seul périmètre restreint**

Cette évaluation ne constitue ni une preuve de configuration Render (`A08`), ni une preuve d’accès fournisseur (`A04`), ni une acceptation contractuelle (`A03`). Elle ne contient aucun secret, jeton, URL PostgreSQL privée, capture ou donnée personnelle.

## 1. Limitation technique vérifiée

Le périmètre cible de `render.yaml` fixe à `false` :

- `RTC_ENABLED` ;
- `WEB_PUSH_ENABLED` ;
- `NATIVE_PUSH_ENABLED` ;
- `PRIVACY_ADMIN_ENABLED`.

Le serveur refuse les routes correspondantes avec un statut `503`. Il ne fournit aucun STUN/TURN par défaut en production, ne génère pas de paire VAPID de production et le Blueprint ne demande aucun secret Cloudflare, FCM, APNs, VAPID ou d’administration RGPD. La suppression des abonnements et jetons existants reste accessible à leur propriétaire.

Ces exclusions ne seront effectives en production qu’après preuve du déploiement réel au titre de `A08`.

## 2. Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| Suite serveur complète `npm test` | **134 réussis, 0 échec, 5 ignorés** faute de variable PostgreSQL dans cette exécution |
| Rejeu PostgreSQL isolé des cinq suites d’intégration | **9 réussis, 0 échec, 0 ignoré** |
| Audit des dépendances `npm audit --audit-level=high` | **0 vulnérabilité** |
| Contrôle de toutes les déclarations de routes `/api` | Toutes sont authentifiées ou classées explicitement comme publiques/spécialement protégées |
| Sessions web et natives | Cookie web `Secure`/`HttpOnly`/`SameSite=Lax`, Bearer natif en mémoire, hash SHA-256 en base, transport lié au type de session |
| Autorisations horizontales | Adhésion aux conversations, familles, jeux, demandes et médias vérifiée dans les gardes et requêtes ; rejeux PostgreSQL contact/droits réussis |
| Messages, médias et signalisation | AES-256-GCM versionné, contexte authentifié, migration avant écoute et échec fermé |
| Uploads | `Content-Length` obligatoire, requête totale limitée à 30 Mio, six fichiers maximum, disque temporaire et suppression en `finally`/gestionnaire d’erreur |
| Politiques enfant | Pause, horaires et partage de médias revérifiés côté serveur |
| Erreurs et journaux | Erreurs inattendues génériques, `X-Request-ID`, absence de contenu personnel dans les preuves de sécurité/purge |
| Android/iOS statique | Sauvegarde Android et HTTP en clair interdits ; aucune exception ATS iOS autorisant le trafic non chiffré |
| Build web `npm run build` | **Réussi**, 4 589 modules transformés ; avertissement non bloquant sur la taille de deux bundles |

Le lint Android n’a pas pu être exécuté sur ce poste, car aucun chemin Android SDK n’est configuré. Ce point ne bloque pas le périmètre web : aucune version APK/AAB/IPA n’est distribuée. Il redevient obligatoire avant toute publication native.

## 3. Constats et corrections

| ID | Niveau initial | Constat | Correction | État |
|---|---|---|---|---|
| A07-F01 | Élevé | Une route publique et l’espace parent distribuaient `Secret-Clubhouse-debug.apk` comme application installable | Route et lien supprimés ; test de non-régression ajouté ; les extensions APK/AAB/IPA sont ignorées pour les nouveaux artefacts | **Fermé** |
| A07-F02 | Élevé | STUN Cloudflare et la génération VAPID pouvaient activer un fournisseur sans décision contractuelle | Drapeaux explicites fermés par défaut en production, aucun STUN par défaut, VAPID de production exigé seulement après activation | **Fermé** |
| A07-F03 | Modéré | L’enveloppe HTTP pouvait atteindre 31 Mio alors que la limite annoncée était 30 Mio | Limite totale ramenée à 30 Mio, avant Multer | **Fermé** |
| A07-F04 | Modéré | Android autorisait la sauvegarde applicative et n’interdisait pas explicitement le trafic en clair | `allowBackup=false` et `usesCleartextTraffic=false` | **Fermé** |

Aucun constat critique ou élevé ne reste ouvert dans le périmètre web restreint évalué.

## 4. Condition de réouverture

`A07` repasse automatiquement à `open` avant :

- toute valeur `true` de `RTC_ENABLED`, `WEB_PUSH_ENABLED`, `NATIVE_PUSH_ENABLED` ou `PRIVACY_ADMIN_ENABLED` ;
- toute distribution APK, AAB ou IPA ;
- tout changement matériel des autorisations, sessions, chiffrement, upload, droits, conservation ou schéma PostgreSQL ;
- toute correction d’un constat critique ou élevé découverte ultérieurement.

Une activation fournisseur exige également la fermeture de son dossier `A03`, les preuves d’accès `A04` et une nouvelle preuve de déploiement `A08`.
