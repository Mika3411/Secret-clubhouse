# Rapport de validation A06 — PostgreSQL de test

**Date d’exécution :** 23 juillet 2026<br>
**Heure de fin :** 22:00 CEST (Europe/Paris)<br>
**Auteur de la preuve :** Codex — exécution automatisée de validation<br>
**Périmètre :** A06, purge, droits, effacement, tombstones et restauration<br>
**Résultat final :** **RÉUSSI — A06 peut être clôturée**

## 1. Règles de sécurité et données utilisées

La validation a utilisé exclusivement la variable d’entrée `TEST_DATABASE_URL`. Sa valeur n’est pas reproduite dans ce rapport. Elle désignait la base locale isolée `a06_validation_test`, sur `127.0.0.1:55432`.

Le garde-fou `server/test-database-safety.js` :

- refuse l’exécution si `TEST_DATABASE_URL` est absente ;
- refuse `NODE_ENV=production` ;
- refuse tout hôte autre que `localhost`, `127.0.0.1` ou `::1` ;
- exige un nom de base contenant explicitement `test` ;
- refuse qu’une variable `DATABASE_URL`, `SOURCE_DATABASE_URL` ou `RECOVERY_DATABASE_URL` soit déjà définie ;
- ne fournit l’alias interne attendu par les modules applicatifs qu’après ces contrôles, avec exactement la valeur validée de `TEST_DATABASE_URL`.

Aucune connexion à la production, aucun service Render, aucun compte réel et aucune donnée personnelle réelle n’ont été utilisés. Les familles, enfants, messages, adresses `example.test`, jetons et contenus sentinelles ont tous été générés pour le test. La base restaurée dérivée et le fichier de sauvegarde temporaire ont été supprimés par le teardown du scénario.

## 2. Environnement

| Élément | Valeur vérifiée |
|---|---|
| PostgreSQL | 18.4, instance locale isolée |
| Base | `a06_validation_test` |
| Fuseau PostgreSQL | `Europe/Paris` |
| Schéma | schéma applicatif créé par `initializeDatabase()` |
| Code applicatif | mêmes services Node.js, SQL, routes et moteur de purge que l’application |
| Node.js | 24.14.1 |
| npm | 11.11.0 |
| Révision de départ | `03a91f8` ; changements de validation présents dans l’arbre de travail |
| Sauvegarde | `pg_dump` au format custom, puis `pg_restore` vers une base locale dérivée |

Cette configuration est proche de la production par le moteur PostgreSQL, le schéma, les contraintes, les transactions et le code exécuté. Elle ne prouve pas l’état du service Render, de son ordonnanceur ni de ses sauvegardes gérées : ces points restent dans A08.

## 3. Commandes exécutées

Les chemins temporaires et la valeur de connexion sont volontairement masqués.

```powershell
$env:TEST_DATABASE_URL = "[masquée — PostgreSQL local isolé]"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:SOURCE_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:RECOVERY_DATABASE_URL -ErrorAction SilentlyContinue

node --test server/retention.test.js server/test-database-safety.test.js `
  server/security-hardening.test.js server/aipd-register.test.js

node --test server/retention.integration.test.js
node --test server/privacy-rights.integration.test.js
node --test server/a06-lifecycle.integration.test.js
npm run retention:test-purge
```

Le scénario de cycle de vie a en outre lancé, sans autre URL fournie par l’environnement :

```powershell
pg_dump "$env:TEST_DATABASE_URL" --format=custom --no-owner --no-privileges `
  --file "<temp>\a06-before-erasure.dump"

pg_restore --dbname "<base locale dérivée de TEST_DATABASE_URL>" `
  --no-owner --no-privileges "<temp>\a06-before-erasure.dump"
```

## 4. Résultats des commandes

| Commande | Résultat final |
|---|---|
| Tests unitaires, registre, sécurité et garde-fou | **16/16 réussis**, 0 échec |
| Purge PostgreSQL intégrée | **1/1 réussi**, 0 échec |
| Droits RGPD intégrés existants | **1/1 réussi**, 0 échec |
| Cycle A06 complet | **5/5 réussis**, 0 échec |
| Commande réelle du Cron, `npm run retention:test-purge` | code retour **0**, événement `retention.completed` |
| Suite finale séquentielle réunissant tous les contrôles ci-dessus | **25/25 réussis**, 0 échec, 0 test ignoré |

Sortie enregistrée de la commande réelle de purge :

```json
{
  "event": "retention.completed",
  "startedAt": "2026-07-23T20:07:24.214Z",
  "counts": {
    "expiredFamilyInvitations": 0,
    "expiredContactRequests": 0,
    "expiredCalls": 0,
    "typingStates": 1,
    "callSignals": 0,
    "nativeCallActionTokens": 0,
    "presence": 0,
    "pushSubscriptions": 0,
    "nativePushTokens": 0,
    "authSessions": 0,
    "messages": 0,
    "callSessions": 0,
    "familyInvitations": 0,
    "contactRequests": 0,
    "games": 0,
    "loginRateLimits": 0,
    "securityEvents": 0,
    "legalEvents": 0,
    "privacyRequests": 0,
    "erasureTombstones": 0,
    "retentionRuns": 0,
    "inactiveAccounts": 0,
    "inactiveFamilies": 0,
    "orphanConversations": 0
  },
  "overduePrivacyRequests": 0
}
```

Cette sortie ne contient que l’événement, l’horodatage et des compteurs.

## 5. Toutes les durées de conservation et d’expiration

Les valeurs ont été vérifiées dans `retentionPolicy`, dans les échéances PostgreSQL produites par le schéma et, pour les suppressions, avec des lignes placées au-delà de l’échéance puis purgées par le moteur réel.

| Catégorie | Durée vérifiée | Résultat |
|---|---:|---|
| Compte/famille inactive | 730 jours | échéance créée ; comptes et famille expirés purgés |
| Session d’authentification | 12 heures | échéance créée ; session expirée purgée |
| Session révoquée | purge après 24 heures | session révoquée à 25 h purgée |
| Limiteur de connexion | 48 heures | ligne à 3 jours purgée |
| Appel en attente | 45 secondes | échéance PostgreSQL vérifiée |
| Appel accepté sans fin | 24 heures maximum | appel expiré rendu terminal |
| Signal WebRTC | 24 heures | échéance vérifiée ; signal expiré purgé |
| Contrôle d’action d’appel native | 2 heures | échéance vérifiée |
| Jeton d’action d’appel native | purge 24 h après la fin du contrôle, 26 h maximum | jeton expiré purgé |
| Métadonnées d’appel terminal | 90 jours | échéance vérifiée ; appel à 91 jours purgé |
| Présence | 24 heures | échéance vérifiée ; présence expirée purgée |
| Indicateur de saisie | 6 secondes | échéance vérifiée ; état expiré purgé |
| Message texte | 365 jours | échéance vérifiée ; message à 366 jours purgé |
| Média et événement d’appel | 90 jours | échéances vérifiées ; média à 91 jours purgé |
| Souscription Web Push | 180 jours | échéance vérifiée ; souscription expirée purgée |
| Jeton APNs/FCM | 180 jours | échéance vérifiée ; jeton expiré purgé |
| Invitation coparent en attente | 7 jours | échéance vérifiée ; passage à `expired` testé |
| Enregistrement d’invitation résolue | 90 jours | enregistrement ancien purgé |
| Demande de contact en attente | 30 jours | échéance vérifiée ; passage à `expired` testé |
| Enregistrement de demande de contact | 180 jours après résolution, soit jusqu’à 210 jours pour une demande expirée | échéance et purge vérifiées |
| Invitation de jeu en attente | 30 jours | échéance vérifiée ; session ancienne purgée |
| Jeu actif ou terminal | 180 jours | échéance vérifiée |
| Journal de sécurité | 365 jours | échéance vérifiée ; ligne expirée purgée |
| Événement juridique | 5 ans, 1 825 jours de référence | échéance vérifiée ; ligne expirée purgée |
| Échéance de réponse RGPD | 1 mois | date limite vérifiée |
| Dossier de demande RGPD | 5 ans, 1 825 jours de référence | échéance vérifiée ; dossier expiré purgé |
| Tombstone d’effacement | 30 jours | échéance vérifiée ; tombstone expiré purgé |
| Fenêtre de sauvegarde portée par le tombstone | 7 jours | échéance `backup_expires_at` vérifiée |
| Journal d’exécution de purge | 365 jours | échéance vérifiée ; exécution expirée purgée |

Les tolérances des assertions tiennent compte des mois calendaires, des années bissextiles et du changement d’heure Europe/Paris ; elles ne changent aucune valeur de politique.

## 6. Cron de purge

Le contrôle statique a vérifié dans `render.yaml` :

- ressource `secret-clubhouse-retention` ;
- planification quotidienne `17 3 * * *`, soit 03:17 UTC ;
- commande `npm run retention:purge`.

La commande équivalente protégée pour le test, `npm run retention:test-purge`, a exécuté le même module `server/run-retention.js` et le même moteur transactionnel `purgeExpiredData` sur `TEST_DATABASE_URL`. La transaction prend un verrou consultatif, journalise uniquement les compteurs et effectue un rollback si une requête échoue.

Le déclenchement par l’ordonnanceur Render réel n’a pas été utilisé et n’est pas déduit de `render.yaml`. Sa preuve reste une exigence distincte d’A08.

## 7. Suppression, droits, tombstones et restauration

| Scénario | Contrôle effectué | Résultat |
|---|---|---|
| Suppression d’un enfant | appel de la route protégée par le parent ; vérification des comptes, rattachements, conversations, messages, présence, push et progression | **Réussi** ; toutes les lignes de l’enfant ont disparu, le frère ou la sœur est resté |
| Suppression d’une famille | mot de passe courant et confirmation destructive ; vérification famille, parent et enfant | **Réussi** ; famille et comptes supprimés |
| Demandes RGPD | création de `access`, `rectification`, `erasure`, `restriction`, `objection` et de leurs événements | **Réussi**, 5 types sur 5 |
| Restriction | application puis levée par la route d’administration RGPD | **Réussi** |
| Export parent d’un enfant | vérification qu’un message enfant-ami synthétique est masqué | **Réussi**, contenu non exposé |
| Export de l’enfant | vérification de son propre contenu et de ses demandes | **Réussi** |
| Tombstones | un tombstone enfant et un tombstone famille, échéances 7/30 jours | **Réussi**, 2 tombstones présents |
| Sauvegarde | `pg_dump` avant effacement | **Réussi** |
| Restauration | `pg_restore` dans une base locale dérivée | **Réussi** |
| Preuve du risque de réapparition | comptes supprimés retrouvés dans la copie restaurée avant rejeu | **Réussi**, précondition démontrée |
| Rejeu des tombstones | suppression transactionnelle des identifiants enfant/famille restaurés | **Réussi** |
| Absence de réapparition | comptes, famille et message sentinelle absents après rejeu ; témoins conservés | **Réussi** |

## 8. Journalisation sans contenu personnel

Une tentative de connexion synthétique a utilisé une adresse sentinelle. La ligne `security_events` obtenue :

- ne contenait ni l’adresse, ni l’adresse IP en clair ;
- contenait uniquement des condensats hexadécimaux SHA-256 de 64 caractères ;
- avait un objet `metadata` vide.

Le journal `retention_runs` et la sortie du Cron ne contenaient que des compteurs. Les sentinelles de contenu, noms de médias, noms d’enfants et identifiants de contact n’y figuraient pas.

## 9. Anomalies rencontrées

### Anomalies produit résiduelles

**Aucune** dans le périmètre A06 exécuté.

### Anomalies du harnais, corrigées puis retestées

| ID | Observation | Correction et résultat |
|---|---|---|
| A06-H01 | une session synthétique était créée avec une expiration antérieure à sa création | dates rendues cohérentes ; contrainte PostgreSQL puis purge validées |
| A06-H02 | le premier scénario attendait la suppression immédiate d’un appel juste devenu terminal | séparation du passage terminal à 24 h et de la purge des métadonnées à 90 jours |
| A06-H03 | des noms d’utilisateur longs devenaient identiques après normalisation | suffixe unique conservé dans la longueur autorisée |
| A06-H04 | 180 jours calendaires traversant le changement d’heure différaient d’une heure écoulée | assertion calendaire avec tolérance DST documentée |
| A06-H05 | les identités synthétiques fixes entraient en collision lors d’une relance | suffixe aléatoire par exécution ; relance complète réussie |
| A06-H06 | un condensat de jeton d’appel synthétique fixe entrait en collision lors d’une relance | condensat unique par exécution ; relance complète 5/5 réussie |
| A06-H07 | une suite combinée comptait aussi un indicateur de saisie expiré laissé par le scénario précédent | teardown ciblé sur les identifiants synthétiques de l’exécution ; suite séquentielle complète rejouée |
| A06-H08 | l’adresse sentinelle fixe a atteint le seuil persistant de cinq échecs de connexion lors des relances | adresse `example.test` unique par exécution ; le `429` observé confirmait le fonctionnement attendu du limiteur |

Une commande de préparation trop longue a également dépassé le délai du lanceur ; l’initialisation et le démarrage ont été séparés, puis la disponibilité PostgreSQL a été contrôlée avant les tests. Aucune requête applicative n’avait été lancée au moment de ce dépassement.

## 10. Conclusion et conditions de maintien

Tous les scénarios demandés ont réussi sur la base PostgreSQL de test isolée :

- toutes les durées et toutes les catégories de purge ;
- commande et transaction du Cron ;
- suppression enfant et famille ;
- exports et cinq demandes RGPD ;
- tombstones ;
- sauvegarde et restauration ;
- absence de réapparition après rejeu ;
- journaux sans contenu personnel.

A06 est donc clôturable au 23 juillet 2026 sur cette preuve. La prochaine validation trimestrielle est fixée au **23 octobre 2026**, et doit être rejouée après toute modification matérielle du schéma, de la purge, des exports, de l’effacement ou de la restauration.

Cette clôture ne ferme pas A08 : la région Render réelle, le Cron effectivement provisionné, la politique du fournisseur de sauvegarde et une restauration depuis une sauvegarde Render doivent encore être prouvés séparément.
