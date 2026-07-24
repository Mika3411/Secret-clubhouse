# A04 — Procédure de gestion des accès privilégiés et du cycle de vie des clés

**Version :** 1.0<br>
**Date :** 23 juillet 2026<br>
**Propriétaire :** Responsable sécurité / exploitation<br>
**Périmètre :** Render, GitHub, Cloudflare, Firebase/Google Cloud, Apple Developer/App Store Connect, PostgreSQL et secrets applicatifs de Secret Clubhouse<br>
**Statut A04 :** **OUVERT — aucun exercice réel complet n’est encore consigné**

Cette procédure ne contient jamais de mot de passe, clé privée, jeton, code MFA, code de récupération, contenu de variable secrète ou donnée personnelle d’enfant. Une capture qui révèle une adresse personnelle, un jeton, une valeur de variable ou un code de récupération doit être expurgée avant archivage.

## 1. Règle de clôture

La rédaction de cette procédure, un contrôle du dépôt, un test unitaire, un scénario sur papier ou une checklist remplie sans pièce externe ne ferment pas `A04`.

`A04` peut passer de `open` à `closed` uniquement lorsque les éléments suivants sont présents pour les fournisseurs et secrets réellement actifs :

1. un registre daté des accès privilégiés nominatifs, de leur rôle et de leur nécessité ;
2. une preuve d’authentification adaptée au risque — MFA pour les comptes privilégiés exposés ou lorsque le fournisseur l’impose — sans révéler le facteur ;
3. une revue du moindre privilège et de la séparation des secrets ;
4. un essai documenté, sur un environnement représentatif sans donnée d’enfant, des procédures de rotation ou remplacement, récupération et révocation applicables ;
5. un rapport daté indiquant le résultat, les écarts et la décision humaine ;
6. aucune anomalie critique ou élevée non traitée.

Un fournisseur ou canal techniquement désactivé est noté « non applicable » avec une preuve de désactivation ; il n’a pas à être créé, activé ou testé uniquement pour fermer `A04`. Le RGPD n’impose ici ni cadence trimestrielle, ni nombre fixe d’administrateurs, ni vérificateur distinct, ni prestataire externe. Ces modalités peuvent être retenues comme mesures internes si le risque ou l’organisation le justifie.

Le Blueprint cible ferme désormais RTC, Web Push, APNs/FCM et l’administration RGPD partagée. Il ne demande aucun de leurs secrets. Après constat de ces drapeaux sur Render réel, Cloudflare, Firebase, Apple, VAPID et `PRIVACY_ADMIN_TOKEN` pourront être inscrits `N/A` pour le périmètre minimal. Les seules preuves d’accès fournisseur encore attendues seront alors Render et GitHub, plus le coffre réellement utilisé pour les clés générées.

La décision de clôture est humaine. Elle est inscrite dans `server/aipd-register.js` et `docs/aipd-secret-clubhouse.md` seulement après vérification des pièces avec la checklist `docs/a04-checklist-preuves.md`.

## 2. Responsabilités et comptes

| Fonction | Responsabilité | Privilège maximal normal |
|---|---|---|
| Responsable du traitement | Accepte le risque et la clôture A04 | Lecture des preuves ; pas d’accès quotidien aux secrets si inutile |
| Responsable sécurité / exploitation | Exécute les rotations, revues et révocations | Administration limitée aux fournisseurs nécessaires |
| Vérificateur | Contrôle les preuves et le résultat de l’exercice | Lecture seule, sans valeur secrète |
| Administrateur de secours | Récupération en cas de perte du compte principal | Compte nominatif dormant, MFA fort, usage journalisé |
| Service Render | Consomme les secrets d’exécution | Accès machine uniquement aux secrets nécessaires au service |

Socle nécessaire :

- un compte humain correspond à une seule personne identifiable ;
- aucun compte partagé de type `admin@`, aucun facteur MFA partagé et aucun code de récupération dans une boîte mail collective ;
- les automatisations utilisent un compte de service ou un jeton dédié, jamais le jeton personnel d’un administrateur ;
- le départ ou le changement de fonction d’une personne déclenche immédiatement la procédure de révocation du § 8.

Le jeton statique `PRIVACY_ADMIN_TOKEN` pris en charge par l’API ne constitue pas un compte nominatif. Le périmètre cible impose `PRIVACY_ADMIN_ENABLED=false` et ne demande plus ce secret. Une preuve Render de cette désactivation suffit pour le classer `N/A`. Toute réactivation exige d’abord une authentification d’administrateur nominative et traçable ou une mesure compensatoire formellement acceptée et testée.

## 3. Matrice d’accès minimale

### Render

- Activer l’exigence 2FA du workspace.
- Réserver `Admin` à l’administration du workspace et des membres.
- Utiliser `Developer`, `Contributor` ou `Viewer` selon le besoin ; un compte qui ne doit ni voir les variables ni ouvrir un shell ne reçoit pas un rôle qui le permet.
- Placer la production dans un environnement protégé.
- Inventorier les clés API, clés SSH, accès Shell, intégrations Git et webhooks.
- Le service web reçoit les secrets d’exécution ; le Cron de rétention ne reçoit que la connexion PostgreSQL et les variables strictement requises.

Références : [connexion et exigence 2FA Render](https://render.com/docs/login-settings), [membres et rôles Render](https://render.com/docs/team-members), [journaux d’audit Render](https://render.com/docs/audit-logs).

### GitHub

- Héberger le dépôt dans une organisation lorsque plusieurs administrateurs ou une continuité de propriété sont nécessaires.
- Exiger le MFA pour les membres de l’organisation et conserver au moins deux méthodes de récupération par administrateur.
- Réserver `Admin` aux personnes qui administrent réellement le dépôt ; préférer `Maintain`, `Write`, `Triage` ou `Read`.
- Protéger `main` par une règle exigeant les contrôles CI et empêchant le contournement non justifié.
- Examiner les GitHub Apps, deploy keys, clés SSH, PAT, environnements Actions et secrets Actions.
- Conserver `permissions: contents: read` comme permission par défaut des workflows et n’élever qu’au niveau d’un job qui en a besoin.

Le dépôt actuel appartient à un compte personnel. Le propriétaire d’un dépôt personnel ne peut pas être révoqué comme un simple membre : un exercice complet de révocation du propriétaire exige d’abord une organisation ou un transfert de propriété. Un collaborateur temporaire peut être utilisé pour tester la révocation des autres rôles.

Références : [gestion des personnes ayant accès à un dépôt](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-teams-and-people-with-access-to-your-repository), [configuration du MFA GitHub](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication).

### Cloudflare

- Activer l’obligation 2FA pour tous les membres et utiliser au moins deux facteurs, dont un facteur résistant au hameçonnage pour les super-administrateurs.
- Limiter `Super Administrator` aux personnes chargées des membres et jetons de compte.
- Restreindre les autres personnes à la zone, au produit Realtime/TURN ou à la ressource utile.
- Utiliser un jeton de compte dédié à Secret Clubhouse, avec permissions et ressources minimales, jamais la clé API globale.
- Donner au jeton TURN un nom, un propriétaire, une date de création, une date de revue et une procédure de révocation.

Références : [MFA Cloudflare](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/), [gestion et révocation des membres](https://developers.cloudflare.com/fundamentals/manage-members/manage/), [portée des rôles](https://developers.cloudflare.com/fundamentals/manage-members/scope/), [création d’un jeton limité](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

### Firebase / Google Cloud

- Chaque personne utilise son propre compte Google avec validation en deux étapes ; les clés de sécurité ou passkeys sont privilégiées.
- Examiner la stratégie IAM du projet et supprimer les rôles de base `Owner` ou `Editor` non indispensables.
- Le compte de service FCM ne reçoit que les permissions nécessaires à l’envoi FCM.
- Les clés de compte de service ont un identifiant, un propriétaire, une date de création et une date de suppression.
- Une clé téléchargée n’est jamais placée dans le dépôt, une image mobile, un fichier `google-services.json` contenant un secret serveur ou un poste non géré.

Références : [IAM Firebase](https://firebase.google.com/docs/projects/iam/overview), [bonnes pratiques des clés de comptes de service](https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys), [exigence MFA Google Cloud](https://docs.cloud.google.com/docs/authentication/mfa-requirement).

### Apple Developer / App Store Connect

- Chaque administrateur utilise un Apple Account personnel avec MFA.
- Conserver un seul `Account Holder` ; attribuer `Admin`, `App Manager` ou `Developer` selon le besoin réel.
- Une clé APNs est créée par une personne habilitée, limitée au service nécessaire, nommée et inventoriée.
- Le fichier privé téléchargeable une seule fois est transféré directement vers le coffre de secrets, sans copie dans le dépôt ou dans une messagerie.
- Une clé APNs révoquée n’est pas récupérable ; l’ancienne clé reste active pendant le test de la nouvelle, puis est révoquée seulement après validation.

Références : [MFA des comptes Apple Developer](https://developer.apple.com/help/account/access/sign-in-to-your-developer-account/), [création d’une clé de service](https://developer.apple.com/help/account/keys/create-a-private-key/), [révocation d’une clé](https://developer.apple.com/help/account/keys/revoke-edit-and-download-keys/).

## 4. Séparation et emplacement des secrets

| Secret ou identifiant | Emplacement autorisé | Interdictions | Cible interne de revue ou rotation |
|---|---|---|---|
| `CONTENT_ENCRYPTION_KEY` | Secret d’exécution Render du service web ; copie de secours chiffrée à accès restreint | PostgreSQL, GitHub, client, logs, ticket | 12 mois et événement déclencheur |
| `CONTENT_ENCRYPTION_PREVIOUS_KEYS` | Secret Render temporaire et coffre de récupération | Valeur dans une preuve ou un dépôt | Retrait après migration et expiration des sauvegardes éligibles |
| `JWT_SECRET` | Secret Render distinct | Réutilisation comme clé de contenu ou jeton de service | 180 jours et événement déclencheur |
| Paire VAPID | Secrets Render versionnés | Clé privée dans PostgreSQL ou le dépôt | 12 mois après prise en charge du rollover |
| Compte de service FCM | Un seul format Render choisi, brut **ou** base64 | Configurer simultanément deux copies, dépôt, APK | 90 jours et événement déclencheur |
| Clé privée APNs | Un seul format Render choisi, brut **ou** base64 | Dépôt, IPA, poste non géré | 180 jours et événement déclencheur |
| Jeton Cloudflare TURN | Secret Render dédié et limité | Clé API globale, client WebRTC, logs | 90 jours et événement déclencheur |
| `PRIVACY_ADMIN_TOKEN` transitoire | Secret Render distinct | Partage non tracé, capture, URL | 90 jours, départ d’un détenteur et remplacement prioritaire |

Les environnements développement, préproduction et production utilisent des valeurs différentes. La compromission d’un environnement ne doit permettre ni déchiffrement ni administration d’un autre.

Le dépôt est public : les preuves détaillées, captures de membres, adresses de comptes, codes de récupération et exports d’audit restent dans un coffre de preuve restreint hors du dépôt. Le dépôt ne conserve que l’identifiant opaque de la pièce, sa date, son auteur, son empreinte SHA-256 et une conclusion expurgée.

Les durées ci-dessous sont des objectifs internes ajustables selon les capacités du fournisseur, l’usage et le risque ; elles ne constituent pas des échéances légales automatiques.

## 5. Revue des accès

La revue a lieu avant la production, après tout incident ou changement d’équipe ou de périmètre, puis à un intervalle justifié par le risque. Une fréquence trimestrielle peut être choisie comme objectif interne, mais n’est pas une condition légale automatique de clôture.

Pour chaque fournisseur :

1. exporter ou capturer la liste complète des membres et rôles ;
2. vérifier l’identité réelle, le responsable hiérarchique et la justification de chaque accès ;
3. vérifier l’état MFA sans enregistrer le facteur lui-même ;
4. lister les sessions actives, applications autorisées, clés API, clés SSH, PAT, comptes de service et clés de push ;
5. relever uniquement l’identifiant, le rôle, la portée, les dates de création/dernier usage/expiration et le propriétaire ;
6. révoquer tout accès sans justification ou inactif ;
7. comparer avec la revue précédente et expliquer chaque ajout, suppression ou élévation ;
8. dater la revue et identifier la personne qui en assume la conclusion.

Une revue « aucun changement » exige quand même un nouvel export ou une nouvelle capture datée.

## 6. Rotation de `CONTENT_ENCRYPTION_KEY`

### Préconditions

- fenêtre de changement approuvée, deux opérateurs et plan de retour arrière ;
- sauvegarde PostgreSQL datée ou clone isolé de préproduction ;
- ancienne clé encore disponible dans le coffre ;
- métriques et journaux accessibles sans contenu privé ;
- requêtes de contrôle prêtes ; elles ne renvoient que des identifiants de clé et des comptes de lignes ;
- aucun secret copié dans un terminal enregistré, un ticket, une capture ou un message.

### Exécution

1. Générer une nouvelle valeur aléatoire dans le coffre approuvé.
2. Ajouter la clé actuellement active, ainsi que toute clé encore nécessaire à une sauvegarde éligible, dans `CONTENT_ENCRYPTION_PREVIOUS_KEYS`.
3. Définir la nouvelle valeur dans `CONTENT_ENCRYPTION_KEY` au cours du même changement Render.
4. Déployer. Le service doit migrer les messages, médias et signaux avant d’écouter ; une clé absente ou une enveloppe incohérente doit faire échouer le démarrage.
5. Attendre la fin du déploiement roulant et le second passage de migration.
6. Vérifier la lecture et l’écriture d’un message, d’un média synthétique et d’un signal WebRTC synthétique.
7. Contrôler que toutes les lignes vivantes portent l’identifiant actif :

```sql
select content_encryption_key_id, count(*)
from messages
group by content_encryption_key_id
order by content_encryption_key_id;

select content_encryption_key_id, count(*)
from call_signals
group by content_encryption_key_id
order by content_encryption_key_id;
```

8. Conserver les anciennes clés jusqu’à ce que toutes les lignes vivantes soient migrées **et** que la dernière sauvegarde pouvant contenir une ancienne enveloppe soit expirée.
9. Retirer une ancienne clé lors d’un second changement, jamais pendant le premier.

### Exercice de récupération obligatoire

1. Restaurer une sauvegarde réellement créée avant ou pendant la rotation dans une base isolée sans donnée d’enfant, ou dans un clone préalablement pseudonymisé et autorisé.
2. Démarrer la version de production avec la clé active et l’ensemble minimal d’anciennes clés.
3. Vérifier le démarrage, la migration, la lecture de canaris synthétiques et le rechiffrement sous la clé active.
4. Dans une seconde copie jetable, omettre volontairement l’ancienne clé requise et vérifier que le service échoue fermé avant d’écouter.
5. Détruire la base d’exercice selon sa durée de conservation et consigner l’heure et la preuve de destruction.

Un test unitaire avec des chaînes de test ne remplace pas cet exercice.

## 7. Rotation des autres clés

### `JWT_SECRET`

Le code actuel n’utilise pas ce secret pour signer les sessions : les sessions sont des valeurs opaques hachées dans PostgreSQL. `JWT_SECRET` sert à produire les HMAC des identités et adresses de limitation de connexion.

Conséquences :

- une rotation ne déconnecte pas les sessions existantes ;
- les compteurs créés avec l’ancienne valeur ne sont plus retrouvés avec la nouvelle et expirent au plus tard sous 48 heures ;
- une rotation d’urgence doit être accompagnée d’une limitation temporaire au bord, d’une surveillance des échecs de connexion et d’un test HTTP réel ;
- l’ancienne valeur reste disponible dans le coffre uniquement pendant la fenêtre de retour arrière, puis est détruite.

La variable devrait être renommée ou séparée en une future clé `LOGIN_RATE_LIMIT_HMAC_KEY` versionnée afin d’éviter de la confondre avec un secret JWT.

### VAPID / Web Push

**Blocage actuel : ne pas déclarer une rotation VAPID réussie.**

Une souscription Web Push est liée à la clé publique d’application. Le code actuel :

- charge une seule paire VAPID ;
- peut générer et stocker la clé privée dans `application_settings` PostgreSQL si Render n’en fournit pas ;
- ne stocke aucun identifiant de clé avec `push_subscriptions` ;
- réutilise côté client une souscription existante sans vérifier la clé serveur.

Une rotation silencieuse casserait donc les souscriptions existantes. Avant l’exercice A04, il faut :

1. interdire en production le repli qui stocke la clé privée VAPID dans PostgreSQL ;
2. versionner plusieurs paires VAPID pendant la transition ;
3. associer chaque souscription à son identifiant de paire ;
4. signer chaque envoi avec la paire correspondant à la souscription ;
5. faire détecter au client le changement de clé, se désabonner puis se réabonner après le consentement déjà valide ;
6. mesurer les souscriptions anciennes, nouvelles, renouvelées et en échec ;
7. supprimer les anciennes souscriptions et la paire précédente seulement après la période de transition.

En cas de compromission avant cette correction, désactiver Web Push et ouvrir la procédure d’incident ; ne pas générer automatiquement une nouvelle paire en prétendant que la continuité est assurée.

Référence normative : [RFC 8292, restriction d’une souscription à la clé VAPID](https://datatracker.ietf.org/doc/html/rfc8292#section-4).

### FCM

1. Créer une nouvelle clé pour le compte de service FCM existant, ou un nouveau compte de service minimal si la portée actuelle est excessive.
2. Enregistrer seulement l’identifiant de clé et les dates dans l’inventaire.
3. Remplacer la valeur Render choisie (`FCM_SERVICE_ACCOUNT_JSON` **ou** sa variante base64).
4. Déployer et remettre une notification générique réelle à un appareil Android de test.
5. Vérifier les journaux fournisseur et applicatifs sans jeton d’appareil.
6. Garder l’ancienne clé active pendant la fenêtre de retour arrière approuvée.
7. Désactiver, puis supprimer l’ancienne clé après validation ; tester que l’ancienne ne fonctionne plus.

### APNs

1. Créer une nouvelle clé APNs et transférer le fichier privé directement dans le coffre.
2. Remplacer `APNS_KEY_ID` et la valeur privée Render choisie dans le même changement.
3. Déployer et remettre une alerte générique puis un appel de test à un appareil iOS de test.
4. Garder l’ancienne clé active pendant la fenêtre de retour arrière.
5. Révoquer l’ancienne clé seulement après validation ; vérifier que la clé révoquée ne peut plus être utilisée.

Une clé Apple révoquée ne peut pas être réactivée. Le retour arrière doit donc être testé avant révocation.

### Cloudflare TURN et canal RGPD

Le jeton TURN et `PRIVACY_ADMIN_TOKEN` suivent un changement créer–déployer–tester–révoquer. Le jeton Cloudflare est limité au compte et au produit nécessaires. Pour le canal RGPD, toute rotation doit préserver la capacité de traiter les demandes à échéance sans créer un accès partagé durable.

## 8. Révocation d’un administrateur

### Déclenchement

Départ, perte de matériel, changement de fonction, compte suspect, exercice planifié ou accès devenu inutile.

### Ordre d’exécution

1. Ouvrir un dossier `A04-REV-AAAA-NNN`, identifier l’opérateur et l’approbateur.
2. Vérifier qu’un second administrateur nominatif et son MFA fonctionnent.
3. Suspendre ou retirer la personne de Render, GitHub, Cloudflare, Firebase/Google et Apple.
4. Révoquer ses sessions actives, applications OAuth, PAT, clés SSH, clés API personnelles, passkeys ou appareils de confiance liés au périmètre, selon le fournisseur.
5. Révoquer l’accès aux coffres, au gestionnaire de mots de passe, à la messagerie de sécurité et aux sauvegardes.
6. Inventorier les secrets que la personne pouvait voir ou exporter.
7. Faire tourner en priorité les secrets réellement exposés à son rôle ; ne pas faire une rotation aveugle qui empêcherait la récupération des données.
8. Vérifier depuis une session distincte que l’ancien compte ne peut plus modifier la production, lire les secrets ou pousser sur `main`.
9. Pour un dépôt public, ne pas considérer la lecture publique du code comme un échec de révocation ; vérifier les actions privilégiées.
10. Exporter les journaux d’audit avant expiration de leur rétention.
11. Faire signer le résultat par le vérificateur.

### Exercice réel

Utiliser un compte temporaire nominatif contrôlé par une personne réelle, protégé par MFA, avec un rôle limité et une date d’expiration. Il doit effectuer une action bénigne autorisée, être révoqué, puis tenter de répéter cette action et recevoir un refus réel. Les captures ne montrent aucun secret ni donnée d’enfant.

## 9. Gestion des preuves

Chaque pièce porte :

- un identifiant opaque ;
- le fournisseur et le contrôle couvert ;
- l’auteur, le vérificateur, la date, l’heure et le fuseau ;
- la période couverte ;
- l’identifiant du projet, workspace, équipe ou ressource, sans valeur secrète ;
- une empreinte SHA-256 du fichier original ;
- l’emplacement du coffre restreint ;
- la date de suppression prévue ;
- le résultat `PASS`, `FAIL`, `N/A justifié` ou `À corriger`.

Les preuves détaillées ne sont pas stockées dans ce dépôt public. La checklist expurgée peut être conservée ici, mais elle ne contient ni e-mail personnel non déjà public, ni identifiant de téléphone, ni clé, ni valeur de variable, ni endpoint push.

## 10. Critères d’arrêt

Arrêter immédiatement une rotation ou une révocation si :

- la seconde identité d’administration ne fonctionne pas ;
- une ancienne clé nécessaire à une sauvegarde est introuvable ;
- une migration ne peut pas déchiffrer une enveloppe ;
- une valeur secrète apparaît dans un journal, une capture ou un ticket ;
- un canal push ne peut plus servir les anciennes inscriptions et aucun mode de transition n’existe ;
- la portée exacte d’un jeton ou d’un rôle n’est pas connue ;
- une restauration exige d’utiliser des données d’enfant sans autorisation et isolation adaptées.

L’arrêt est un résultat valide de l’exercice, mais il maintient `A04` ouverte.
