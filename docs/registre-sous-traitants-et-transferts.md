# Registre des sous-traitants et des transferts

Version du 23 juillet 2026 — responsable du suivi : responsable du traitement de Secret Clubhouse.

Ce registre couvre les fournisseurs qui peuvent recevoir des données personnelles pour héberger le service, établir les appels ou remettre les notifications. Il complète le registre des bases légales, l’AIPD et la politique de conservation. Il ne remplace ni les contrats signés ni l’analyse juridique finale du responsable du traitement.

## Règle d’activation

Un fournisseur ou une fonctionnalité dépendant d’un fournisseur ne peut être considéré comme prêt pour la production que lorsque les cinq preuves suivantes sont archivées dans le dossier contractuel privé :

1. contrat principal et, lorsqu’il agit pour le compte de Secret Clubhouse, accord de sous-traitance conforme à l’article 28 du RGPD ;
2. version, date d’acceptation, identité du titulaire du compte et périmètre exact du service ;
3. liste datée des sous-traitants ultérieurs et abonnement à leurs notifications de changement ;
4. localisation réelle du traitement, sauvegardes, accès support et suppression en fin de contrat ;
5. mécanisme du chapitre V pour chaque transfert hors EEE et analyse d’impact du transfert validée.

Le consentement de l’utilisateur aux notifications est une base d’activation de la fonctionnalité. Il n’est pas, à lui seul, une garantie de transfert international.

Les contrats, captures du tableau de bord, pièces d’identité du titulaire et secrets ne doivent pas être commités dans ce dépôt. Le dépôt conserve seulement le registre, les liens publics et la liste des preuves attendues.

## Cartographie synthétique

| Prestataire ou service | Qualification à confirmer | Données et finalité | Localisation et sauvegardes | Accès support et sous-traitants ultérieurs | Contrat et transfert | État au 23/07/2026 |
| --- | --- | --- | --- | --- | --- | --- |
| Render Services, Inc., y compris Render Postgres | Sous-traitant principal. PostgreSQL est ici le logiciel et l’offre managée de Render, pas une société destinataire séparée. | Comptes, familles, profils enfants, contacts, conversations, messages et médias chiffrés par l’application, jeux, présence, signaux et métadonnées d’appel, journaux, jetons et registres RGPD. Hébergement de l’application, de l’API et de la base. | Le Blueprint impose Francfort aux nouvelles ressources. Une ressource existante ne change pas de région : service, base et Cron doivent être contrôlés dans le tableau de bord. À défaut de preuve, l’Oregon reste l’hypothèse conservatrice. Les sauvegardes Render Postgres payantes ont une fenêtre de restauration dépendant du plan ; les exports logiques sont conservés sept jours. | Personnel habilité et prestataires d’infrastructure ou de support prévus par le DPA. Render publie notamment AWS, GCP, Cloudflare et ClickHouse comme sous-traitants autorisés et annonce les ajouts au moins dix jours avant accès. S’abonner aux mises à jour. | DPA Render, cadre de protection des données UE–États-Unis lorsqu’applicable, sinon CCT module 2. Archiver la version acceptée, le compte, la région réelle et l’analyse d’impact. | **À clôturer :** prouver l’acceptation du DPA et la région réelle ; migrer vers Francfort si les ressources actives sont encore en Oregon. |
| Cloudflare, Inc. — STUN/TURN Realtime | Sous-traitant pour le service TURN contracté ; le statut du STUN public utilisé sans compte doit être confirmé par Cloudflare. | Adresses IP, ports, temps de session, identifiant technique de clé et métriques de trafic. En TURN, relais de paquets WebRTC chiffrés ; Cloudflare indique ne pas pouvoir lire le média chiffré de bout en bout par WebRTC. Identifiants TURN générés pour une heure dans le code. | Réseau mondial en anycast, point de présence généralement proche du client ; aucune résidence EEE exclusive n’est supposée. Pas de sauvegarde de contenu d’appel côté application. La durée des métriques Cloudflare doit être obtenue pour le plan retenu. | Le DPA prévoit des prestataires de centres de données, d’ingénierie et de support. La liste est publiée et les changements sont annoncés trente jours avant traitement. S’abonner aux mises à jour. | DPA Cloudflare avec CCT pour les transferts restreints. L’applicabilité au compte Realtime et au STUN public doit être confirmée et archivée. | **Bloquant :** l’usage par défaut de `stun.cloudflare.com` est présent, mais aucune preuve de DPA lié au compte ni de qualification du STUN public n’est dans le dépôt. |
| Service Web Push choisi par le navigateur | Le fournisseur est imposé ou limité par l’agent utilisateur. Selon le scénario, il peut être sous-traitant, destinataire autonome ou composant du service du terminal ; cette qualification doit être validée par navigateur. | Point de terminaison unique, clés de souscription, adresse IP, horaires, fréquence et taille des messages. La charge utile est chiffrée selon Web Push et contient seulement des identifiants opaques et un texte générique. Le service peut conserver temporairement un message pendant que le terminal est hors ligne. | Dépend du navigateur et du service Push sélectionné ; aucune région EEE ne peut être promise par Secret Clubhouse. La souscription locale expire côté application après 180 jours sans renouvellement et est supprimée au retrait du consentement. | Secret Clubhouse n’a pas nécessairement de compte direct, d’accès support contractuel ni de droit d’opposition aux sous-traitants du service choisi par le navigateur. Inventorier au minimum Chrome/Edge, Firefox et Safari pour les clients réellement supportés. | Le chiffrement du protocole réduit l’exposition du contenu, mais ne remplace ni l’article 28 lorsqu’il s’applique, ni le chapitre V. Obtenir une analyse juridique documentée par famille de navigateur ou désactiver Web Push dans le périmètre non couvert. | **Bloquant :** fournisseur, rôle, DPA et mécanisme de transfert non maîtrisés de façon uniforme. |
| Google LLC — Firebase Cloud Messaging (FCM) | Sous-traitant lorsqu’il traite les données client conformément aux conditions Firebase ; Google traite séparément certaines données de service selon ses propres finalités. | Jeton d’appareil, Firebase installation ID, nom du package, métadonnées techniques et charge utile minimale pour remettre les notifications Android. | FCM est un service mondial sans choix de région annoncé. Google indique conserver l’installation ID jusqu’à suppression par API, puis supprimer les systèmes actifs et sauvegardes sous 180 jours. Secret Clubhouse expire aussi son jeton PostgreSQL après 180 jours sans renouvellement. | Accès limité aux employés ayant un besoin professionnel, journalisé et protégé par authentification forte selon Firebase. Liste de sous-traitants publiée ; préavis d’au moins trente jours, avec mécanisme d’objection prévu par les conditions. | Conditions de traitement Firebase intégrant les CCT et une solution de transfert ; DPF pour une entité américaine certifiée. Archiver l’acceptation du projet Firebase, la liste des sous-traitants et l’analyse d’impact. | **À clôturer :** aucune preuve d’acceptation du DPA Firebase ni de configuration de notification des sous-traitants n’est dans le dépôt. |
| Apple Inc. — Apple Push Notification service (APNs et PushKit) | Le contrat Apple Developer encadre APNs, mais aucune annexe publique explicitement qualifiée d’accord de sous-traitance article 28 n’a été identifiée dans la revue. Le rôle exact d’Apple doit être confirmé par écrit ou par conseil juridique. | Jeton d’appareil, topic/bundle ID, identifiants opaques d’appel ou conversation, données techniques et libellé générique. Apple peut collecter des informations techniques et diagnostiques sur l’usage d’APNs. | Infrastructure Apple, sans résidence EEE garantie identifiée pour APNs. Les notifications ne doivent contenir aucune information sensible ou confidentielle ; Secret Clubhouse envoie un texte neutre et fixe une expiration courte. La durée de conservation Apple doit être obtenue. | Les conditions publiques examinées ne donnent pas à Secret Clubhouse une liste APNs spécifique de sous-traitants ultérieurs ni un mécanisme d’objection équivalent aux DPA Render, Cloudflare ou Firebase. | Apple Developer Program License Agreement et annexe APNs. Obtenir la qualification RGPD, les clauses article 28 si Apple est sous-traitant, le mécanisme de transfert et les durées. | **Bloquant :** la seule acceptation des conditions Apple Developer ne prouve pas encore toutes les garanties demandées pour ce traitement. |

## Fiches de contrôle

### Render et Render Postgres

Liens de référence :

- DPA : https://render.com/dpa
- régions : https://render.com/docs/regions
- sauvegardes PostgreSQL : https://render.com/docs/postgresql-backups
- sécurité et sous-traitants : https://render.com/security

Preuves à archiver :

- PDF ou capture datée du DPA applicable et identité du titulaire du workspace ;
- capture du service web, du Cron et de la base montrant chacun `Frankfurt` ;
- si une ressource est encore en Oregon : plan de migration, date, test de restauration, bascule et suppression vérifiée de l’ancienne instance après expiration des sauvegardes ;
- plan Render actif et fenêtre exacte de restauration ;
- liste des exports logiques téléchargés, lieu de stockage, chiffrement, accès et date de purge ;
- abonnement aux changements de sous-traitants et registre des objections ;
- procédure d’autorisation d’un accès support, ticket, personne ayant autorisé l’accès, données visibles, début, fin et révocation.

Le code utilise la connexion privée Render (`DATABASE_TRANSPORT=render-private`) et chiffre au niveau applicatif le contenu des messages et médias avant PostgreSQL. Les métadonnées de compte nécessaires au fonctionnement restent cependant lisibles par l’infrastructure : le choix de Francfort et les garanties contractuelles restent nécessaires.

### Cloudflare STUN/TURN

Liens de référence :

- DPA : https://www.cloudflare.com/cloudflare-customer-dpa/
- sous-traitants : https://www.cloudflare.com/gdpr/subprocessors/
- service et régions : https://developers.cloudflare.com/realtime/turn/
- données accessibles avec WebRTC : https://developers.cloudflare.com/realtime/turn/faq/

Preuves à archiver :

- compte Cloudflare et produit Realtime effectivement souscrit ;
- DPA applicable au compte et confirmation écrite que le STUN public `stun.cloudflare.com` entre dans son périmètre, ou remplacement par un STUN/TURN contractuellement couvert ;
- liste datée des sous-traitants, abonnement aux changements et procédure d’opposition ;
- réponse Cloudflare sur la rétention des métriques TURN, journaux, tickets support et sauvegardes éventuelles ;
- analyse d’impact prenant en compte le réseau mondial et les accès depuis les États-Unis ;
- preuve que les identifiants TURN sont temporaires et qu’aucun identifiant enfant lisible n’est utilisé comme `customIdentifier`.

Le média WebRTC est chiffré entre les participants avant le relais TURN. Cloudflare voit néanmoins les adresses IP, ports, volumes, localisation du centre de données et horaires de session.

### Web Push

Lien de référence : https://www.w3.org/TR/push-api/

Le protocole prévoit qu’une souscription est créée entre le navigateur et un service Push. Le navigateur peut limiter le choix du service. La charge utile est chiffrée, mais le service voit encore les horaires, fréquences et tailles et peut mettre un message en attente lorsque le terminal est hors ligne.

Contrôles obligatoires :

- conserver le consentement séparé de l’enfant et du parent et supprimer la souscription dès son retrait ;
- maintenir `privacySafeNotificationPayload` : aucun texte de conversation, nom, média, horaire privé ou motif de refus ;
- tester les points de terminaison effectivement obtenus avec les navigateurs supportés sans enregistrer leur valeur complète dans les journaux ;
- documenter pour chacun l’entité, le rôle, les pays, la conservation, le contrat applicable et le mécanisme du chapitre V ;
- si ce cadre ne peut pas être démontré, ne pas activer Web Push pour ce navigateur.

### Firebase Cloud Messaging

Liens de référence :

- conditions de traitement : https://firebase.google.com/terms/data-processing-terms
- sous-traitants : https://firebase.google.com/terms/subprocessors
- localisation, données et conservation : https://firebase.google.com/support/privacy/

Preuves à archiver :

- projet, entité contractante et titulaire du compte ;
- version et date d’acceptation des conditions Firebase ;
- capture du courriel de notification des sous-traitants ;
- liste datée des sous-traitants et contrôle de la certification DPF de l’entité importatrice ;
- résultat de l’analyse d’impact et décision d’accepter le traitement mondial ;
- test de suppression d’un Firebase installation ID et preuve de purge du jeton PostgreSQL.

### Apple Push Notification service

Liens de référence :

- contrats Apple Developer : https://developer.apple.com/support/terms/
- conditions APNs : https://developer.apple.com/support/terms/apple-developer-program-license-agreement/

Preuves à obtenir et archiver avant activation générale :

- version anglaise acceptée dans le compte Apple Developer, date et titulaire ;
- réponse d’Apple ou avis juridique sur le rôle d’Apple pour APNs et PushKit ;
- si Apple est sous-traitant : clauses conformes à l’article 28, sous-traitants ultérieurs, assistance aux droits, incident, suppression et audit ;
- pays de traitement, durée de rétention du jeton, de la notification en attente, des diagnostics et des tickets support ;
- mécanisme de transfert applicable et analyse d’impact ;
- validation que toutes les charges utiles restent génériques et excluent les données sensibles ou confidentielles.

## Analyse d’impact des transferts

La CNIL demande une analyse d’impact du transfert lorsqu’un transfert hors EEE repose sur un outil de l’article 46, notamment les clauses contractuelles types. La présente section est un pré-remplissage technique ; le responsable du traitement doit compléter l’analyse juridique du pays tiers avec l’assistance de l’importateur, la dater et la signer.

| Flux | Outil annoncé | Mesures supplémentaires déjà présentes | Risque résiduel et décision |
| --- | --- | --- | --- |
| Render vers les États-Unis pour une ressource en Oregon, un accès support ou un sous-traitant américain | DPF lorsque l’entité et le transfert sont couverts ; sinon CCT module 2 intégrées au DPA | Région cible Francfort, réseau privé service-base, TLS, chiffrement applicatif AES-256-GCM des messages et médias, mots de passe et sessions hachés, accès applicatifs contrôlés, rétention et tombstones de restauration | Données d’enfants et métadonnées relationnelles toujours lisibles : risque élevé sans preuve de région, contrat, importateur et mesures. **Ne pas clôturer avant migration/validation.** |
| Cloudflare Realtime mondial | CCT intégrées au DPA pour les transferts restreints | Média WebRTC chiffré de bout en bout par DTLS-SRTP, identifiants TURN d’une heure, absence d’enregistrement applicatif des appels | IP, ports, temps et volumes restent visibles ; statut du STUN public et conservation non prouvés. **Non accepté à ce stade.** |
| Web Push choisi par le navigateur | Variable et non démontré | Chiffrement Web Push, texte générique, identifiants opaques, consentement révocable, expiration PostgreSQL | Fournisseur et pays non maîtrisés, métadonnées visibles. **Non accepté sans matrice par navigateur ou désactivation ciblée.** |
| FCM mondial | Conditions Firebase, CCT et éventuellement DPF selon l’entité certifiée | Payload générique, transport HTTPS, chiffrement FCM en transit et au repos annoncé, expiration locale et suppression du jeton invalide | Métadonnées, installation ID et accès mondial restent possibles. **Acceptation conditionnée aux preuves contractuelles et à la validation de l’analyse.** |
| APNs mondial | Contrat Apple Developer ; outil du chapitre V non encore identifié pour ce scénario | Payload générique, HTTPS/HTTP2, expiration immédiate des appels entrants ou courte pour les autres alertes, retrait du jeton invalide | Qualification, pays, conservation et garanties article 28 non établis. **Non accepté à ce stade.** |

Pour chaque ligne, le dossier privé doit contenir : description précise du transfert, catégories de personnes et données, fréquence, importateur, pays, lois et pratiques pertinentes, possibilité d’accès public, expérience documentée du fournisseur, mesures techniques/contractuelles/organisationnelles, conclusion et date de réexamen.

## Accès support

Tout accès support à des données personnelles suit cette procédure :

1. ouvrir un ticket sans contenu de conversation ni secret ;
2. décrire la finalité, le périmètre et la durée minimale ;
3. faire autoriser l’accès par le responsable du traitement ;
4. privilégier un identifiant technique, une capture expurgée ou un jeu de données synthétique ;
5. consigner le fournisseur, l’agent si connu, le pays d’accès, les tables ou ressources visibles, l’heure de début et de fin ;
6. révoquer les accès temporaires et secrets partagés ;
7. vérifier la suppression des pièces jointes et exports du ticket ;
8. rattacher le ticket au registre de sécurité si des données réelles ont été exposées.

## Sauvegardes et fin de contrat

- Les sauvegardes Render restent soumises à la politique de conservation et aux tombstones décrits dans `docs/data-retention.md` et `docs/data-subject-rights.md`.
- Tout export logique téléchargé quitte le périmètre de conservation géré par Render : il doit être chiffré, inventorié, limité à sept jours sauf justification distincte et détruit avec preuve.
- Une restauration ne revient jamais directement en production. La purge de rétention et les tombstones d’effacement sont rejoués avant ouverture aux utilisateurs.
- À la fin d’un contrat, demander l’export strictement nécessaire, révoquer les clés, supprimer les ressources, obtenir la confirmation de suppression et attendre la fin documentée des sauvegardes avant clôture.
- Les files d’attente ou jetons FCM, APNs et Web Push doivent être invalidés par l’application et par l’API du fournisseur lorsque celle-ci existe.

## Revue des sous-traitants ultérieurs

Le responsable du traitement :

- s’abonne aux notifications Render, Cloudflare et Firebase ;
- examine chaque ajout avant la date d’effet ;
- vérifie finalité, pays, accès, sécurité, transfert et impact sur l’AIPD ;
- documente l’acceptation, l’opposition ou le remplacement du fournisseur ;
- revoit trimestriellement les listes même en l’absence de notification ;
- met à jour ce registre, la politique publique et l’AIPD à chaque changement matériel.

Render annonce un préavis d’au moins dix jours, Cloudflare trente jours et Firebase au moins trente jours. Ces délais contractuels ne dispensent pas d’une veille interne ni d’une décision documentée.

## Tableau de clôture

| Action | Propriétaire | Échéance | Preuve attendue | Statut |
| --- | --- | --- | --- | --- |
| Vérifier région du service, de la base et du Cron Render | Responsable du traitement | Avant prochaine mise en production | Trois captures datées du tableau de bord | Ouvert |
| Migrer les ressources Render existantes si elles sont hors Francfort | Responsable technique + responsable du traitement | Avant ouverture aux familles | Plan, test, bascule, suppression et expiration sauvegardes | Ouvert |
| Archiver DPA Render et abonnement sous-traitants | Titulaire du workspace | Avant production | DPA daté, compte, notification activée | Ouvert |
| Faire confirmer la couverture Cloudflare Realtime et du STUN public | Titulaire Cloudflare | Avant appels en production | Réponse fournisseur, DPA, liste, rétention | Bloquant |
| Qualifier les services Web Push par navigateur | Responsable du traitement + conseil | Avant Web Push en production | Matrice Chrome/Edge/Firefox/Safari et décision | Bloquant |
| Archiver conditions Firebase et analyse FCM | Titulaire Firebase | Avant FCM en production | Acceptation, liste, DPF/CCT, analyse signée | Ouvert |
| Obtenir la qualification et les garanties APNs | Titulaire Apple Developer + conseil | Avant APNs/PushKit en production | Contrat, réponse/avis, transfert, rétention | Bloquant |
| Signer l’analyse d’impact des transferts | Responsable du traitement | Après réception des pièces fournisseur | Analyse datée et décision par flux | Bloquant |

Une ligne ne passe à « clôturée » qu’avec un emplacement de preuve, une date, un vérificateur et une date de prochaine revue.
