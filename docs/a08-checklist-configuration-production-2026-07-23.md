# A08 — Checklist expurgée de configuration de production

**Application :** Secret Clubhouse<br>
**Date de revue :** 23 juillet 2026<br>
**Fenêtre de constat :** 21 h 40–21 h 54 CEST<br>
**Réviseur :** Codex, revue assistée en lecture seule<br>
**Périmètre :** workspace Render connecté, dépôt GitHub `Mika3411/Secret-clubhouse` et commit réellement servi<br>
**Décision :** **A08 OUVERTE — configuration de production non conforme et preuves incomplètes**

## 1. Règles de preuve et d’expurgation

- `render.yaml` décrit l’état attendu ; il n’est jamais accepté comme preuve de l’état déployé.
- Les constats Render proviennent des pages réelles Projects, Deploys, Settings, Environment, Logs, PostgreSQL Recovery et Notifications.
- Les valeurs d’environnement sont restées masquées. Aucun bouton d’affichage, export, presse-papiers ou shell révélant une valeur n’a été utilisé.
- Cette pièce ne contient ni valeur de secret, ni URL PostgreSQL, ni identifiant de ressource Render, ni adresse de destinataire d’alerte.
- Les noms de variables, régions, états, horaires, versions, noms de ressources et SHA Git publics sont conservés car ils sont nécessaires à l’audit.
- Les résultats CI ont été lus par l’intégration GitHub en lecture seule pour le SHA affiché comme `Live` dans Render.

## 2. Identification du déploiement réel

| Élément | Constat réel | Résultat |
|---|---|---|
| Branche reliée | `main` | Conforme au dépôt attendu |
| Commit servi (`Live`) | `da04321fd1fbf9fc682557a7f55a7aba7a391ce5` — « Refine parent navigation and conversation media » | Identifié |
| Date du commit servi | 23 juillet 2026 à 16 h 50 CEST | Identifié |
| Tête GitHub lors de la revue | `03a91f82a15a61e08459cf6566a769f18a259b22` | Écart : la production est en retard |
| Derniers déploiements | `a49897c…` puis `03a91f8…` en échec ; `da04321…` reste servi | Non conforme |
| Cause visible du dernier échec | démarrage refusé parce que `DATABASE_TRANSPORT` est absent en production | Bloquant |

Références de constat : `RDR-A08-01` (page Deploys), `RDR-A08-02` (Application logs), `GHA-A08-01` (commit Git), `GIT-A08-04` (inspection du contenu public du commit servi).

## 3. Comparaison entre l’attendu et la configuration réellement déployée

| Contrôle | Attendu dans le `render.yaml` revu | Configuration réelle constatée | État |
|---|---|---|---|
| Région du service web | Frankfurt | Oregon (US West) | **Échec** |
| Région PostgreSQL | Frankfurt | Oregon (US West) | **Échec** |
| Région du Cron | Frankfurt | aucune ressource `secret-clubhouse-retention` trouvée | **Échec** |
| Ressources Secret Clubhouse | service, PostgreSQL et Cron quotidien | filtre `secret-clubhouse` : deux ressources seulement, service et PostgreSQL | **Échec** |
| Transport PostgreSQL | `DATABASE_TRANSPORT=render-private` et URL interne | clé `DATABASE_TRANSPORT` absente ; `DATABASE_URL` présente mais son routage n’a pas été révélé ; le dernier démarrage échoue fermé | **Non prouvé / échec** |
| Sessions | `AUTH_SESSION_TTL_SECONDS=43200`, soit 12 h | variable absente ; le commit servi signe des JWT avec `expiresIn: "7d"` | **Échec : 168 h au lieu de 12 h** |
| Chiffrement du contenu | `CONTENT_ENCRYPTION_KEY` et enveloppes AES-256-GCM versionnées | variable absente et modules de chiffrement non présents dans le commit servi | **Échec critique** |
| Anciennes clés | `CONTENT_ENCRYPTION_PREVIOUS_KEYS` conservée pendant migration et sauvegardes éligibles | nom de variable absent ; aucune preuve d’ancienne clé ou de récupération | **Échec** |
| Sauvegardes PostgreSQL | sauvegarde Render bornée et restauration vérifiable | récupération point-in-time disponible sur les trois derniers jours ; passage à sept jours proposé avec un workspace Pro | **Partiel** |
| Exercice de restauration | restauration isolée, tombstones rejouées, purge relancée et contrôle de non-réapparition | aucune restauration achevée ou preuve d’exercice trouvée | **Échec** |
| Cron quotidien | `secret-clubhouse-retention`, `17 3 * * *`, Frankfurt | ressource absente ; aucun dernier run ni journal de purge | **Échec** |
| Alertes | destination et événements prouvés | destination e-mail configurée ; préférence globale « Only failure notifications » | **Partiel** |
| Test d’alerte | réception datée d’une alerte de panne du service et du Cron | aucune preuve de réception ou d’acquittement | **Échec** |
| Journaux | journaux applicatifs disponibles, expurgés et conservés selon une durée décidée | journaux Render disponibles et utiles pour la panne ; bannière indiquant que des journaux récents peuvent manquer après l’échec | **Partiel** |
| Rétention des journaux | durée effective, export éventuel et suppression documentés | durée effective et éventuel archivage externe non prouvés dans la configuration inspectée | **Non prouvé** |
| CI du commit servi | tests, audit npm élevé et build verts pour le SHA réellement déployé | aucun statut combiné et aucune exécution de workflow retournés pour `da04321…` ; le commit ne contient pas le workflow `quality.yml` | **Échec** |

Références de constat : `RDR-A08-03` (liste filtrée des ressources), `RDR-A08-04` (Settings du service), `RDR-A08-05` (Environment, valeurs masquées), `RDR-A08-06` (Info PostgreSQL), `RDR-A08-07` (Recovery PostgreSQL), `RDR-A08-08` (Notifications), `GHA-A08-02` (statuts du commit), `GHA-A08-03` (workflows du commit).

## 4. Inventaire expurgé des variables réellement visibles

La page Environment du service contient exactement les noms suivants ; toutes les valeurs sont restées masquées :

- [x] `DATABASE_URL`
- [x] `JWT_SECRET`
- [x] `NODE_ENV`
- [x] `VAPID_PRIVATE_KEY`
- [x] `VAPID_PUBLIC_KEY`
- [x] `VAPID_SUBJECT`

Variables bloquantes absentes de la configuration réellement affichée :

- [ ] `DATABASE_TRANSPORT`
- [ ] `CONTENT_ENCRYPTION_KEY`
- [ ] `CONTENT_ENCRYPTION_PREVIOUS_KEYS`
- [ ] `AUTH_SESSION_TTL_SECONDS`

Les autres noms introduits par le `render.yaml` actuel — horaires, TURN, APNs, FCM, URL publique et administration RGPD — n’apparaissent pas non plus dans l’inventaire réel. Leur nécessité dépend de la fonction activée, mais leur simple déclaration dans le Blueprint ne vaut pas déploiement.

## 5. Sauvegarde et restauration

- [x] PostgreSQL affiche une fonction de récupération point-in-time.
- [x] La fenêtre réelle affichée est de trois jours.
- [x] La fonction d’export logique existe dans l’interface.
- [ ] Un export récent, chiffré, inventorié et supprimé dans le délai applicable est prouvé.
- [ ] Une restauration a été lancée vers une instance isolée.
- [ ] Les tombstones d’effacement ont été rejouées avant validation.
- [ ] Le Cron de purge a été exécuté sur la base restaurée.
- [ ] L’absence de réapparition d’un compte effacé a été vérifiée.
- [ ] La destruction de l’instance de restauration a été consignée.

La présence du bouton « Restore database » n’est pas une preuve de restauration réussie. Ce contrôle reste également pertinent pour A06.

## 6. CI du commit réellement servi

Commit interrogé : `da04321fd1fbf9fc682557a7f55a7aba7a391ce5`.

- statut GitHub combiné : aucun statut retourné ;
- exécutions GitHub Actions associées : aucune exécution retournée ;
- fichier `.github/workflows/quality.yml` : absent de ce commit ;
- résultat : aucun test, audit de dépendances ou build CI ne peut être attribué au binaire réellement servi.

Le workflow de qualité a été ajouté seulement au commit `a49897c…`, dont le déploiement Render a échoué. Un workflow présent sur une révision plus récente ne couvre pas le commit `Live`.

## 7. Actions correctives avant nouvelle tentative de clôture

Priorité immédiate :

- [ ] migrer explicitement le service et PostgreSQL d’Oregon vers Frankfurt ; ne pas supposer qu’une modification du Blueprint déplace des ressources existantes ;
- [ ] créer le Cron `secret-clubhouse-retention` à Frankfurt et prouver au moins un run quotidien réussi ;
- [ ] configurer `DATABASE_TRANSPORT` et obtenir une attestation expurgée que l’hôte réellement utilisé est interne Render ;
- [ ] configurer une session de 43 200 secondes puis prouver la durée créée côté serveur ;
- [ ] établir un plan de migration des contenus existants avant d’activer `CONTENT_ENCRYPTION_KEY`, conserver les anciennes clés requises et valider le démarrage fermé ;
- [ ] déployer une version contenant le chiffrement, les sessions opaques et les contrôles actuels, puis la relier sans ambiguïté aux tests et au build réussis ;
- [ ] vérifier `RTC_ENABLED=false`, `WEB_PUSH_ENABLED=false`, `NATIVE_PUSH_ENABLED=false` et `PRIVACY_ADMIN_ENABLED=false` sur le service réel ; supprimer les anciennes variables fournisseur devenues inutiles du périmètre minimal ;
- [ ] vérifier que `/downloads/Secret-Clubhouse.apk` n’est plus servi et qu’aucun APK/AAB/IPA de débogage n’est distribué ;
- [ ] exécuter une restauration isolée réelle, rejouer les tombstones et la purge, puis documenter le résultat ;
- [ ] documenter la capacité de détection et d’alerte ; si un essai de réception est réalisé hors production, conserver seulement sa conclusion expurgée ;
- [ ] consigner la durée effective de conservation des journaux Render et tout export externe.

Conditions de clôture :

- [ ] service, PostgreSQL et Cron réellement affichés à Frankfurt ;
- [ ] version `Live` reliée sans ambiguïté aux tests et au build réussis par le SHA Git ou une preuve de provenance équivalente ;
- [ ] toutes les variables obligatoires présentes, valeurs toujours masquées dans la preuve ;
- [ ] session réellement mesurée à 12 h ;
- [ ] chiffrement et anciennes clés validés sur données de test représentatives ;
- [ ] connexion privée attestée sans divulguer l’URL ;
- [ ] quatre drapeaux de fonctions sensibles réellement à `false`, routes correspondantes refusées et aucun secret fournisseur requis ;
- [ ] sauvegarde et restauration réelle réussies ;
- [ ] dernier run Cron réussi ;
- [ ] capacité de détection et d’alerte proportionnée au risque, et journaux/rétention documentés ; un test de réception est recommandé mais n’est pas une forme de preuve imposée ;
- [ ] validation humaine datée par l’exploitation.

## 8. Décision A08

**Ne pas clôturer A08.**

Les écarts de région, l’absence de Cron, la session de sept jours, l’absence de chiffrement applicatif sur la version servie, l’absence de preuve de connexion privée, l’absence d’exercice de restauration et l’absence de preuve reliant la version `Live` à des contrôles réussis sont bloquants. Une nouvelle checklist doit être produite après correction à partir du tableau de bord Render réel et de la version effectivement servie.
