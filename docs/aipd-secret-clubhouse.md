# Analyse d’impact relative à la protection des données (AIPD)

**Traitement :** Secret Clubhouse — service familial privé de communication et d’activités pour enfants de 6 à 13 ans
**Version :** 1.0
**Date d’évaluation :** 23 juillet 2026
**Responsable du traitement :** Mickael Thorez, éditeur individuel non professionnel
**Contact RGPD :** `contact@secret-clubhouse.fr`
**État :** projet complet sur le plan technique, à valider par le responsable du traitement

Ce dossier applique la méthode CNIL : contexte, respect des principes fondamentaux, étude des risques sur les droits et libertés, mesures et validation. Il doit être conservé avec ses preuves. Il ne remplace ni l’avis d’un DPO lorsqu’un DPO est désigné, ni une consultation préalable de la CNIL lorsqu’un risque résiduel élevé ne peut pas être réduit.

## 1. Décision et statut

> **PRODUCTION BLOQUÉE**

L’AIPD est obligatoire et a été constituée à partir du code et de la documentation du 23 juillet 2026. Elle n’est pas encore formellement approuvée. Les risques `R01`, `R08` et `R10` restent provisoirement élevés en l’absence de preuves closes sur l’administration des secrets, les transferts et sous-traitants, le test de sécurité indépendant et la gouvernance de production.

Avant l’ouverture à des enfants réels, le responsable doit :

1. fermer les actions `A01` à `A08` et joindre les preuves ;
2. réévaluer les vraisemblances résiduelles ;
3. signer la décision de validation ;
4. si un risque élevé subsiste malgré les mesures, demander une consultation préalable de la CNIL avant le traitement concerné.

La présence d’un dossier dans le dépôt ne vaut donc pas autorisation de mise en production.

## 2. Pourquoi l’AIPD est obligatoire

Les lignes directrices reprises par la CNIL indiquent qu’une AIPD est normalement nécessaire dès que deux critères de risque élevé sont réunis. Secret Clubhouse en cumule au moins quatre :

| Critère | Application à Secret Clubhouse |
|---|---|
| Personnes vulnérables | Le public principal est composé d’enfants de 6 à 13 ans. |
| Données hautement personnelles | Conversations privées, photos, vidéos, messages vocaux et contexte des appels. |
| Surveillance ou suivi régulier | Présence, activité, horaires, accusés reçu/vu, demandes de contact et interactions. |
| Usage innovant ou combinaison de technologies | Application web et clients Capacitor, Web Push/APNs/FCM, WebRTC, CallKit et Android Telecom. |

L’échelle, les critères, les risques et les actions sont également consignés sous forme testable dans `server/aipd-register.js`.

## 3. Méthode, périmètre et hypothèses

### Périmètre inclus

- inscription et authentification des parents et co-parents ;
- création, gestion, pause et suppression des profils enfants ;
- identifiants privés, QR et approbation des contacts ;
- conversations parent-enfant, parent-parent et enfant-contact ;
- messages texte, vocaux, photos, images et vidéos ;
- accusés de réception, présence et indicateurs de saisie ;
- appels audio/vidéo et signalisation WebRTC ;
- notifications Web Push, APNs et FCM ;
- règles parentales, horaires et activité générale ;
- Clubhouse, progression privée et jeux multijoueurs ;
- sécurité, journaux, sauvegardes, conservation et purge ;
- information, consentement facultatif aux notifications et exercice des droits.

### Hors périmètre

- publicité, vente de données, géolocalisation précise, profil public, recherche publique, analyse publicitaire et reconnaissance biométrique : ces traitements ne doivent pas exister ;
- outils internes futurs, prestataires non encore choisis ou nouvelles finalités : ils exigent une mise à jour préalable de cette AIPD ;
- contenu d’un flux WebRTC : il transite entre les participants ou par un relais TURN, mais Secret Clubhouse ne l’enregistre pas.

### Sources de preuve

Cette version repose notamment sur :

- `server/db.js` pour le schéma PostgreSQL et les dépendances de suppression ;
- `server/parental-policy.js` et les contrôles de routes de `server/index.js` pour l’application serveur des règles ;
- `server/auth-sessions.js` et `server/login-protection.js` pour les sessions et la limitation de connexion ;
- `server/content-encryption.js` et `server/message-content.js` pour le chiffrement applicatif ;
- `server/notification-privacy.js` et `server/legal-compliance.js` pour la minimisation push et le consentement ;
- `server/privacy-service.js`, `docs/data-subject-rights.md` et `server/reapply-erasure-tombstones.js` pour les droits ;
- `server/retention.js`, `server/retention-policy.js`, `docs/data-retention.md` et `render.yaml` pour les durées ;
- `docs/registre-bases-legales.md`, `src/privacy-policy.js` et `src/legal-framework.js` pour les finalités, bases légales et informations fournies.

Les contrôles indiqués comme existants sont des contrôles présents dans le dépôt. Leur configuration effective en production doit encore être prouvée par `A08`.

## 4. Acteurs, responsabilités et destinataires

| Acteur | Rôle | Données ou fonction |
|---|---|---|
| Mickael Thorez | Responsable du traitement | Détermine les finalités et moyens, valide l’AIPD et traite les droits. |
| Parents et co-parents | Utilisateurs adultes | Gèrent la famille, les protections et les contacts ; ne voient pas les conversations enfant-ami auxquelles ils ne participent pas. |
| Enfants de 6 à 13 ans | Personnes concernées et utilisateurs | Communiquent avec des membres autorisés et utilisent les activités privées. |
| Render Services, Inc. | Sous-traitant d’hébergement | Service Node.js, offre PostgreSQL managée, sauvegardes et journaux techniques. Le Blueprint cible Francfort pour les nouvelles ressources ; une ressource existante reste supposée en Oregon jusqu’à vérification ou migration. |
| Cloudflare ou fournisseur TURN configuré | Sous-traitant réseau à confirmer | STUN et, si configuré, relais TURN temporaire ; adresses IP, ports, horaires, métriques et trafic WebRTC chiffré de bout en bout. Le statut contractuel du STUN public par défaut reste à confirmer. |
| Apple APNs | Qualification contractuelle à confirmer si iOS activé | Jeton technique et charge minimale générique ; aucune annexe article 28 propre à APNs n’a été identifiée dans la revue publique. |
| Google FCM | Sous-traitant de notification si Android activé | Jeton technique, Firebase installation ID, métadonnées de service et charge minimale générique sur une infrastructure mondiale. |
| Fournisseur Web Push du navigateur | Sous-traitant ou destinataire technique selon le navigateur | Endpoint, clés techniques et charge minimale générique. |

Le dossier contractuel et de transfert de chacun doit être vérifié et archivé au titre de `A03`. Le registre opérationnel et l’analyse préliminaire par flux se trouvent dans `docs/registre-sous-traitants-et-transferts.md`. Aucun développeur, opérateur ou prestataire supplémentaire ne doit recevoir d’accès sans instruction écrite, confidentialité, moindre privilège et traçabilité.

## 5. Description systématique du traitement

### 5.1 Parcours et flux

1. Un adulte reçoit l’information de confidentialité, crée un compte parent et une famille, puis crée un profil enfant.
2. L’API Render authentifie le compte. Une session opaque est remise au client ; PostgreSQL n’en conserve que l’empreinte révocable.
3. Les profils possèdent un identifiant de contact opaque. Une relation externe n’est créée qu’après demande exacte et approbation parentale.
4. Pour un message, l’API contrôle la session, la participation, le statut du profil, l’horaire et, pour un média visuel, l’autorisation de partage.
5. Le texte, le nom et le type du média, ses octets, ainsi que les offres, réponses et candidats ICE WebRTC sont chiffrés par l’application Render avec AES-256-GCM avant PostgreSQL. Render peut déchiffrer après autorisation : ce n’est pas un chiffrement de bout en bout.
6. Un appel utilise Render/PostgreSQL pour l’état et la signalisation chiffrée ; le média utilise WebRTC directement ou un relais TURN. Caméra et microphone sont demandés à l’usage.
7. Si les notifications facultatives sont valablement activées, Render transmet une charge générique au fournisseur push. Le contenu et les noms n’y figurent pas.
8. Les échéances sont inscrites en base et un Cron Job quotidien purge les données. Un effacement crée une consigne temporaire à réappliquer avant toute restauration.

### 5.2 Catégories de personnes et données

| Catégorie | Données nécessaires |
|---|---|
| Parents/co-parents | E-mail, nom affiché, hash du mot de passe, identifiant opaque, rôle familial, sessions, préférences et preuves légales. |
| Enfants | Nom d’usage, âge, identifiant opaque, nom d’utilisateur privé, hash du mot de passe, avatar, famille, état du profil et préférences. |
| Relations | Demandes et approbations de contact, participants aux conversations, invitations et état des jeux. |
| Communications | Texte, médias, message vocal, type et nom de fichier, expéditeur, conversation, horodatages, reçu/vu, saisie temporaire. |
| Appels | Participants, type audio/vidéo, état, horaires, signaux WebRTC, jetons techniques d’action native. |
| Sécurité et exploitation | Empreintes de session, compteurs de tentatives, IP pseudonymisée ou dérivée pour la limitation, identifiants de requête, événements de sécurité, erreurs techniques minimisées. |
| Notifications | Endpoint ou jeton APNs/FCM, clés techniques, appareil, consentements et date d’activité. |
| Droits et conformité | Versions d’information, déclarations et consentements, demandes, réponses, chronologie et consignes d’effacement. |

Ne sont pas nécessaires : numéro de téléphone de l’enfant, carnet d’adresses, adresse postale, position GPS, école, publicité, analyse marketing et profil public. Ils ne doivent pas être collectés.

### 5.3 Durées

La matrice complète et ses points de départ figurent dans `docs/data-retention.md`. Les maxima principaux sont :

- sessions : 12 heures de validité en production ;
- présence et signaux WebRTC : 24 heures ;
- messages texte : 365 jours ;
- médias et métadonnées d’appel : 90 jours ;
- jetons push : 180 jours depuis leur dernier enregistrement ;
- comptes/familles inactifs : 730 jours ;
- sauvegardes PostgreSQL : 3 à 7 jours selon le plan Render ;
- demandes de droits et preuves légales : 5 ans lorsque cette preuve est nécessaire.

## 6. Finalités et bases légales

Le détail et le test de mise en balance figurent dans `docs/registre-bases-legales.md`.

| Finalité | Base principale | Condition ou garantie |
|---|---|---|
| Compte parent et administration familiale | Contrat, art. 6(1)(b) | Données nécessaires au service demandé par l’adulte. |
| Profil enfant, communications et protections | Intérêt légitime, art. 6(1)(f) | Service fermé, intérêt supérieur de l’enfant, contacts approuvés, opposition et minimisation. |
| Communications des adultes | Contrat, art. 6(1)(b) | Acheminement demandé par l’adulte. |
| Sécurité, prévention des abus et règles familiales | Intérêt légitime, art. 6(1)(f) | Mise en balance documentée, accès restreint et durées limitées. |
| Notifications facultatives | Consentement, art. 6(1)(a) | Consentement séparé et révocable ; accord conjoint parent-enfant sous 15 ans. |
| Demandes de droits | Obligation légale, art. 6(1)(c) | Registre limité aux éléments nécessaires à la réponse et à la preuve. |

La permission caméra, microphone ou notification du système d’exploitation est une permission technique ; elle ne modifie pas la base légale et ne constitue pas, seule, un consentement RGPD.

## 7. Information, participation et droits

- Une politique complète destinée aux parents est disponible avant inscription à `/confidentialite`.
- Une version courte et illustrée destinée aux enfants est disponible à `/confidentialite-enfants`.
- L’enfant peut exercer ses droits directement ou avec l’aide d’un parent.
- L’interface permet l’export et le dépôt suivi de demandes d’accès, rectification, effacement, limitation et opposition.
- Une limitation active bloque les traitements ordinaires tout en conservant l’accès aux droits et à la suppression.
- Les demandes ont une échéance à un mois et une chronologie.
- La suppression active et la restauration sont encadrées par des consignes d’effacement temporaires.

Le point de vue de parents et d’enfants n’a pas encore été recueilli pour cette AIPD. `A02` est donc ouvert. La consultation doit employer des scénarios concrets et un langage adapté, sans exposer de donnée réelle : notification sur écran verrouillé, présence, visibilité parentale, demandes de contact, suppression et appel vidéo.

## 8. Nécessité et proportionnalité

### 8.1 Adéquation aux finalités

- Un compte et une famille sont nécessaires pour réserver la gestion aux adultes autorisés.
- Un identifiant opaque permet l’ajout ciblé sans annuaire public ni téléphone.
- La liste des participants est nécessaire pour acheminer une communication et en contrôler l’accès.
- Les règles, horaires et statuts sont nécessaires pour appliquer les choix parentaux côté serveur.
- Les états reçu/vu, la présence courte et la saisie éphémère fournissent les fonctions explicites de communication ; ils ne servent pas au profilage.
- La signalisation WebRTC est nécessaire à un appel, mais le contenu audio/vidéo n’est pas enregistré.
- Les jetons push ne sont nécessaires que lorsque l’utilisateur choisit la fonction facultative.

### 8.2 Alternatives moins intrusives retenues

- pas de numéro de téléphone enfant, synchronisation du carnet d’adresses, annuaire ou lien public ;
- pas de message ni nom dans les notifications ;
- pas de contenu des conversations enfant-ami dans le tableau parent ;
- présence visible uniquement par la personne elle-même, sa famille ou ses contacts approuvés ;
- permission caméra et microphone seulement au moment de l’usage ;
- données temps réel rapidement expirées ;
- suppression automatique et export direct ;
- aucune publicité, vente de données ou analyse comportementale.

### 8.3 Limites et arbitrages

Le chiffrement applicatif protège PostgreSQL et les sauvegardes, mais Render détient la clé active et peut déchiffrer après contrôle d’accès. Le service n’est donc pas « de bout en bout ». Cette capacité doit rester limitée au processus applicatif, avec secrets séparés, administrateurs nommés et rotation testée.

Le suivi de présence et des accusés crée une attente sociale. L’interface doit rester neutre, ne pas produire de statistiques individuelles détaillées pour le parent et respecter les durées prévues.

Les transferts hors EEE ne peuvent pas être justifiés par la seule mention contractuelle d’un fournisseur. La localisation, le mécanisme de transfert et les mesures supplémentaires doivent être vérifiés avant production.

## 9. Mesures existantes

### Organisation et gouvernance

- registre des bases légales et politique de conservation ;
- informations parent et enfant séparées ;
- canal de droits, échéances et historique ;
- aucune finalité publicitaire ou de recherche publique ;
- tests applicatifs et contrôle de dépendances dans la CI.

### Accès et authentification

- mots de passe hachés avec bcrypt ;
- sessions aléatoires opaques, empreinte SHA-256 en base, révocation et expiration ;
- cookie web de production `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax` ;
- limitation persistante des tentatives par identité et par IP ;
- autorisation serveur par famille, relation approuvée et participation à la conversation ;
- présence inaccessible par simple identifiant arbitraire.

### Confidentialité, intégrité et minimisation

- AES-256-GCM applicatif versionné pour texte, types, noms, octets de médias et payloads de signalisation WebRTC ;
- données d’authentification liées au message dans le chiffrement pour détecter une substitution ;
- PostgreSQL sur le réseau privé Render ou TLS strict pour une base externe ;
- notifications génériques sans contenu ni nom ;
- erreurs inattendues génériques, corrélées par identifiant de requête ;
- upload borné à 30 Mo par requête, fichiers temporaires sur disque, un seul média lu en mémoire à la fois et nettoyage en fin de requête.

### Enfants et communications

- enfants créés uniquement par un parent authentifié ;
- demande externe ciblée puis approbation parentale ;
- pause, horaires, média et appels appliqués par l’API ;
- permissions caméra/microphone à l’usage ;
- aucun enregistrement du média WebRTC ;
- parents non participants exclus du contenu des conversations enfant-ami.

### Conservation et droits

- échéances explicites en base ;
- purge quotidienne transactionnelle et journalisée ;
- sauvegardes à fenêtre courte ;
- tombstones empêchant la réapparition après restauration ;
- export minimisé et demandes d’exercice suivies.

## 10. Analyse des risques

Échelle : gravité et vraisemblance sont cotées de 1 à 4. Le score est leur produit : faible `1–4`, modéré `5–8`, élevé `9–16`. La gravité est évaluée du point de vue de l’enfant, pas de l’entreprise. Le résiduel est provisoire tant que les actions et la configuration de production ne sont pas prouvées.

| ID | Événement redouté | Initial | Mesures principales | Résiduel | Niveau | Actions |
|---|---|---:|---|---:|---|---|
| R01 | Accès non autorisé aux conversations ou médias | 4×4=16 | Autorisations, sessions, chiffrement applicatif, base privée | 4×3=12 | Élevé | A04, A07, A08 |
| R02 | Usurpation ou prise de contrôle d’un compte | 4×3=12 | bcrypt, limitation, session révocable 12 h | 4×2=8 | Modéré | A07, A08 |
| R03 | Contact indésirable, manipulation ou harcèlement | 4×3=12 | Identifiant opaque, approbation, règles API | 4×2=8 | Modéré | A02, A05, A07 |
| R04 | Surveillance disproportionnée de l’enfant | 3×3=9 | Visibilité restreinte, données éphémères, pas de contenu parent | 3×2=6 | Modéré | A02, A06 |
| R05 | Exposition par notification | 3×3=9 | Libellé générique, consentement conjoint, jeton opaque | 2×2=4 | Faible | A03, A07 |
| R06 | Exposition liée à WebRTC | 4×3=12 | Autorisation, signalisation chiffrée, permissions à l’usage, purge, TURN | 3×2=6 | Modéré | A03, A07, A08 |
| R07 | Conservation ou restauration incorrecte | 4×3=12 | Purge, échéances, tombstones, registre de droits | 4×2=8 | Modéré | A06, A08 |
| R08 | Transfert ou sous-traitance insuffisamment maîtrisé | 4×3=12 | Registre par flux, Francfort pour les nouvelles ressources, minimisation, chiffrement, contrats annoncés | 4×3=12 | Élevé | A03, A01 |
| R09 | Indisponibilité ou perte de données | 3×3=9 | Sauvegardes, transactions, uploads bornés, tests | 3×2=6 | Modéré | A05, A06, A08 |
| R10 | Erreur, abus interne ou journalisation excessive | 4×3=12 | Erreurs minimisées, secrets Render, chiffrement | 4×3=12 | Élevé | A04, A05, A07, A08 |

Les scénarios détaillés — menaces, impacts, contrôles et liens d’action — sont la source structurée `server/aipd-register.js`. Toute modification d’un score doit être motivée dans l’historique de validation et accompagnée d’une preuve.

## 11. Plan d’actions

| ID | Mesure à fermer | Responsable | Échéance | Preuve d’acceptation |
|---|---|---|---|---|
| A01 | Validation formelle de l’AIPD | Responsable du traitement | Avant utilisateurs réels | Décision datée/signée, avis DPO si désigné, budget et risques acceptés. |
| A02 | Consultation adaptée de parents et enfants | Responsable du traitement | Avant validation | Compte rendu anonymisé ou justification écrite de l’absence de consultation. |
| A03 | Dossier sous-traitants et transferts | Responsable du traitement | Avant production | Actions bloquantes du registre fermées ; DPA, région réelle, accès support, sauvegardes, sous-traitants ultérieurs, DPF/CCT et analyses d’impact signées pour chaque flux. |
| A04 | Administration et cycle de vie des clés | Sécurité/exploitation | Avant production | MFA, administrateurs nommés, moindre privilège, revue, rotation et récupération testées. |
| A05 | Réponse aux incidents et violations | Responsable du traitement | Avant production puis annuel | Procédure et exercice incluant qualification, confinement, familles et CNIL sous 72 h. |
| A06 | Purge, droits, effacement et restauration | Exploitation | Avant production puis trimestriel | Test PostgreSQL proche production avec rapports et absence de réapparition. |
| A07 | Test de sécurité indépendant | Prestataire indépendant | Avant production puis changement majeur | Aucun constat critique/élevé ouvert sur API, mobile, upload, WebRTC et push. |
| A08 | Preuve de configuration de production | Exploitation | Chaque déploiement | Checklist sans secret : variables, réseau, clés, alertes, sauvegardes, Cron et CI. |

Une action n’est « fermée » qu’avec une pièce datée, un auteur et un résultat vérifiable. La seule présence d’une option dans `render.yaml` ne prouve pas sa valeur effective.

## 12. Validation formelle

Cette section doit être complétée par une personne réelle. Aucun champ ci-dessous ne doit être prérempli ou signé automatiquement.

| Validation | Décision à renseigner |
|---|---|
| Responsable du traitement | Nom, décision, date et signature |
| DPO, si désigné | Avis, réserves, date et identité |
| Sécurité/exploitation | Preuves A04 à A08, date et identité |
| Point de vue des personnes | Référence du compte rendu A02 ou justification |
| Risques résiduels | Acceptés, à réduire, ou soumis à consultation préalable CNIL |
| Autorisation de production | Oui/non, périmètre et conditions |

Décision actuelle : **non validée — production bloquée**.

Si les actions réduisent tous les risques sous le niveau élevé, le responsable peut documenter son acceptation motivée. Si un risque élevé reste présent et que sa réduction n’est pas possible, la consultation préalable de la CNIL est obligatoire avant le traitement concerné.

## 13. Réexamen

L’AIPD est revue au minimum chaque année et avant :

- une nouvelle catégorie de données, finalité ou destinataire ;
- une modification de la tranche d’âge ou une ouverture publique ;
- un nouveau fournisseur, une nouvelle région ou un nouveau transfert ;
- une fonction d’IA, modération automatisée, analyse de contenu ou recommandation ;
- une modification du chiffrement, des clés, des sessions ou des autorisations ;
- un nouveau canal mobile, appareil connecté ou usage de capteurs ;
- une augmentation sensible du volume, de la durée ou de la population ;
- un incident, une violation, un signalement grave ou un résultat d’audit ;
- une évolution réglementaire ou une demande de la CNIL.

Le réexamen compare le code, la configuration réellement déployée, les contrats, les journaux d’incident, les retours enfants/parents et les tests. Il incrémente la version, date la décision et conserve l’ancienne version.

## 14. Références

- [CNIL — Ce qu’il faut savoir sur l’analyse d’impact relative à la protection des données](https://www.cnil.fr/fr/ce-quil-faut-savoir-sur-lanalyse-dimpact-relative-la-protection-des-donnees-aipd)
- [CNIL — Outil PIA et guides méthodologiques](https://www.cnil.fr/fr/outil-pia-telechargez-et-installez-le-logiciel-de-la-cnil)
- [G29/CEPD — Lignes directrices concernant l’AIPD (WP248 rév.01)](https://www.cnil.fr/sites/default/files/atoms/files/wp248_rev.01_fr.pdf)
- [CNIL — Liste des traitements pour lesquels une AIPD est requise](https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-aipd-requise.pdf)
