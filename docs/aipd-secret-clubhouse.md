# Analyse d’impact relative à la protection des données (AIPD)

**Traitement :** Secret Clubhouse — service familial privé de communication et d’activités pour enfants de 6 à 13 ans
**Version :** 1.11<br>
**Date d’évaluation :** 24 juillet 2026
**Responsable du traitement :** Mickael Thorez, éditeur individuel non professionnel
**Contact RGPD :** `contact@secret-clubhouse.fr`
**État :** réévaluation fondée sur les preuves disponibles, non validée par le responsable du traitement

Ce dossier applique la méthode CNIL : contexte, respect des principes fondamentaux, étude des risques sur les droits et libertés, mesures et validation. Il doit être conservé avec ses preuves. Il ne remplace ni l’avis d’un DPO lorsqu’un DPO est désigné, ni une consultation préalable de la CNIL lorsqu’un risque résiduel élevé ne peut pas être réduit.

## 1. Décision et statut

> **PRODUCTION BLOQUÉE**

La condition demandée d’une clôture vérifiée de `A02` à `A08` n’est pas satisfaite. `A05`, `A06` et `A07` disposent désormais de preuves permettant de retenir leur clôture, avec les réserves et restrictions décrites ci-dessous. `A02`, `A03`, `A04` et `A08` restent ouvertes. L’AIPD n’est donc pas formellement approuvée et les risques `R01`, `R02`, `R06`, `R08` et `R10` restent élevés.

Avant l’ouverture à des enfants réels, le responsable doit :

1. fermer avec des preuves réelles `A02`, `A03`, `A04` et `A08` ;
2. rejouer les contrôles échus de `A05` et `A06` si leur date de réexamen est atteinte ;
3. recalculer les vraisemblances résiduelles sur la configuration effectivement déployée ;
4. si un risque élevé subsiste après toutes les mesures réalisables, consulter préalablement la CNIL avant le traitement concerné ;
5. présenter seulement ensuite une nouvelle décision de validation à Mickael Thorez.

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
- Clubhouse, catalogue rotatif, défi quotidien, progression privée, série protégée, récompenses d’apparence et jeux multijoueurs ;
- tableau interne d’adoption et d’usage limité à des nombres agrégés, avec accès administrateur nominatif et journalisé ;
- sécurité, journaux, sauvegardes, conservation et purge ;
- information, consentement facultatif aux notifications et exercice des droits.

### Hors périmètre

- publicité, vente de données, géolocalisation précise, profil public, recherche publique, analyse publicitaire et reconnaissance biométrique : ces traitements ne doivent pas exister ;
- outils internes futurs, prestataires non encore choisis ou nouvelles finalités : ils exigent une mise à jour préalable de cette AIPD ;
- contenu d’un flux WebRTC : il transite entre les participants ou par un relais TURN, mais Secret Clubhouse ne l’enregistre pas.

### Sources de preuve

Cette version repose notamment sur :

- `server/db.js` pour le schéma PostgreSQL et les dépendances de suppression ;
- `server/services/admin-analytics-service.js`, `server/policies/platform-admin.js` et leurs tests pour l’agrégation, l’exclusion de la famille administratrice et l’accès nominatif ;
- `server/parental-policy.js` et les contrôles de routes de `server/index.js` pour l’application serveur des règles ;
- `server/auth-sessions.js` et `server/login-protection.js` pour les sessions et la limitation de connexion ;
- `server/content-encryption.js` et `server/message-content.js` pour le chiffrement applicatif ;
- `server/notification-privacy.js` et `server/legal-compliance.js` pour la minimisation push et le consentement ;
- `server/privacy-service.js`, `docs/data-subject-rights.md` et `server/reapply-erasure-tombstones.js` pour les droits ;
- `server/retention.js`, `server/retention-policy.js`, `docs/data-retention.md` et `render.yaml` pour les durées ;
- `docs/incident-response.md`, `docs/registre-violations.md` et le dossier `docs/exercices/a05-2026-07-23-*` pour la réponse aux violations et la preuve de l’exercice A05 ;
- `docs/a06-validation-postgresql-2026-07-23.md` et les tests PostgreSQL associés pour la clôture technique A06 ;
- `docs/registre-sous-traitants-et-transferts.md` pour l’état ouvert d’A03 et les preuves privées attendues ;
- `docs/registre-bases-legales.md`, `src/privacy-policy.js` et `src/legal-framework.js` pour les finalités, bases légales et informations fournies.
- `docs/a02-protocole-consultation.md` pour le protocole vierge préparatoire de l’action `A02`.
- `docs/a04-procedure-gestion-acces-et-cles.md`, `docs/a04-checklist-preuves.md` et `.audit/2026-07-23-a04-access-key-audit/audit.md` pour l’audit et la préparation de l’action `A04`.
- `docs/a07-evaluation-securite-2026-07-23.md` et les tests de garde des routes, drapeaux de production et conteneurs natifs pour la clôture restreinte de `A07`.
- `docs/a08-checklist-configuration-production-2026-07-23.md` et `.audit/2026-07-23-a08-production-config-audit/evidence-index.md` pour la comparaison expurgée entre le Blueprint et Render réellement déployé.
- `docs/production-deblocage-minimal.md` pour les seules interventions privées ou humaines encore nécessaires au périmètre web restreint.

Les contrôles indiqués comme existants sont des contrôles présents dans le dépôt. Leur configuration effective en production doit encore être prouvée par `A08`.

## 4. Acteurs, responsabilités et destinataires

| Acteur | Rôle | Données ou fonction |
|---|---|---|
| Mickael Thorez | Responsable du traitement | Détermine les finalités et moyens, valide l’AIPD et traite les droits. |
| Parents et co-parents | Utilisateurs adultes | Gèrent la famille, les protections et les contacts ; ne voient pas les conversations enfant-ami auxquelles ils ne participent pas. |
| Enfants de 6 à 13 ans | Personnes concernées et utilisateurs | Communiquent avec des membres autorisés et utilisent les activités privées. |
| Administrateur de plateforme nommé | Personne habilitée | Consulte uniquement des agrégats d’adoption et d’usage ; aucun compte par défaut, détail individuel ou contenu privé ; chaque lecture est journalisée. |
| Render Services, Inc. | Sous-traitant d’hébergement | Service Node.js, offre PostgreSQL managée, sauvegardes et journaux techniques. Le Blueprint cible Francfort pour les nouvelles ressources ; une ressource existante reste supposée en Oregon jusqu’à vérification ou migration. |
| Cloudflare ou fournisseur TURN configuré | Sous-traitant réseau à confirmer | STUN et, si configuré, relais TURN temporaire ; adresses IP, ports, horaires, métriques et trafic WebRTC chiffré de bout en bout. Le statut contractuel du STUN public par défaut reste à confirmer. |
| Apple APNs | Qualification contractuelle à confirmer si iOS activé | Jeton technique et charge minimale générique ; aucune annexe article 28 propre à APNs n’a été identifiée dans la revue publique. |
| Google FCM | Sous-traitant de notification si Android activé | Jeton technique, Firebase installation ID, métadonnées de service et charge minimale générique sur une infrastructure mondiale. |
| Fournisseur Web Push du navigateur | Sous-traitant ou destinataire technique selon le navigateur | Endpoint, clés techniques et charge minimale générique. |

Le dossier contractuel et de transfert de chacun doit être vérifié et archivé au titre de `A03`. Le registre opérationnel et l’analyse préliminaire par flux se trouvent dans `docs/registre-sous-traitants-et-transferts.md`. Aucun développeur, opérateur ou prestataire supplémentaire ne doit recevoir d’accès sans instruction écrite, confidentialité, moindre privilège et traçabilité.

## 5. Description systématique du traitement

### 5.1 Parcours et flux

1. Un adulte reçoit l’information de confidentialité, crée un compte parent et une famille, puis crée un profil enfant.
2. L’API Render authentifie le parent par e-mail ou l’enfant par son nom d’utilisateur privé globalement unique. L’identifiant de contact n’est jamais accepté pour la connexion. Une session opaque est remise au client ; PostgreSQL n’en conserve que l’empreinte révocable.
3. Les profils possèdent un identifiant de contact opaque distinct du nom d’utilisateur. Il sert uniquement au QR et au routage d’une demande exacte, qui ne crée une relation externe qu’après approbation parentale.
4. Pour un message, l’API contrôle la session, la participation, le statut du profil, l’horaire dans le fuseau parental IANA configuré et, pour un média visuel, l’autorisation de partage. Ce même fuseau est joint au planning renvoyé au client afin que l’interface n’utilise jamais implicitement l’heure locale du téléphone. Avant persistance, chaque fichier temporaire est identifié par ses octets ; le MIME déclaré doit correspondre au format détecté et un message vocal est refusé si sa durée mesurée dépasse deux minutes ou ne peut pas être établie.
5. Le texte, le nom et le type du média, ses octets, ainsi que les offres, réponses et candidats ICE WebRTC sont chiffrés par l’application Render avec AES-256-GCM avant PostgreSQL. Render peut déchiffrer après autorisation : ce n’est pas un chiffrement de bout en bout.
6. Un appel utilise Render/PostgreSQL pour l’état et la signalisation chiffrée ; le média utilise WebRTC directement ou un relais TURN. Caméra et microphone sont demandés à l’usage.
7. Si les notifications facultatives sont valablement activées, Render transmet une charge générique au fournisseur push. Le contenu et les noms n’y figurent pas.
8. Lorsque le canal est explicitement activé, un parent inscrit dans `platform_administrators` peut lire à `/administration` des comptes agrégés calculés depuis les dates et événements déjà nécessaires au service. L’API exclut les administrateurs et leur famille et ne renvoie aucun nom, identifiant, contact, message, média ou ligne individuelle.
9. Les échéances sont inscrites en base et un Cron Job quotidien purge les données. Un effacement crée une consigne temporaire à réappliquer avant toute restauration.

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
| Clubhouse | Activités terminées et rejouées, étoiles, jours actifs, défi quotidien réussi, récompenses débloquées et décoration choisie. |
| Pilotage agrégé | Comptages de familles et de comptes, dates de création et de dernière activité, sessions ouvertes et volumes d’événements fonctionnels par fenêtre de 7 ou 30 jours ; aucun détail individuel n’est exposé par l’API d’administration. |
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
| Pilotage agrégé du service | Intérêt légitime, art. 6(1)(f) | Réutilisation minimale des dates et événements existants, agrégats seulement, exclusion de l’administrateur, accès nominatif et journalisé. |
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

Le point de vue de parents et d’enfants n’a pas encore été recueilli et aucune décision signée n’explique pourquoi cette consultation ne serait pas appropriée dans le contexte précis de Secret Clubhouse. `A02` reste donc ouverte. L’article 35(9) n’impose la consultation que « le cas échéant » : le protocole de `docs/a02-protocole-consultation.md` permet soit une consultation adaptée et minimisée, soit la formalisation d’une décision circonstanciée fondée sur des éléments alternatifs réellement examinés. Le gabarit vierge ne ferme pas l’action.

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
- connexion enfant limitée au nom d’utilisateur privé ; l’identifiant de contact partagé par QR ne peut ni authentifier ni incrémenter le compteur de blocage de cet enfant ;
- autorisation serveur par famille, relation approuvée et participation à la conversation ;
- administration des agrégats réservée à un compte parent nominativement inscrit en base, sans identifiant ni mot de passe administrateur partagé ;
- présence inaccessible par simple identifiant arbitraire.

### Confidentialité, intégrité et minimisation

- AES-256-GCM applicatif versionné pour texte, types, noms, octets de médias et payloads de signalisation WebRTC ;
- données d’authentification liées au message dans le chiffrement pour détecter une substitution ;
- PostgreSQL sur le réseau privé Render ou TLS strict pour une base externe ;
- notifications génériques sans contenu ni nom ;
- erreurs inattendues génériques, corrélées par identifiant de requête ;
- statistiques d’exploitation calculées en PostgreSQL et limitées à des agrégats ; aucun nom, identifiant, relation, conversation ou contenu n’est sélectionné, et la famille administratrice est exclue ;
- upload borné à 30 Mo par requête, fichiers temporaires sur disque, un seul média lu en mémoire à la fois et nettoyage en fin de requête ;
- analyse média dans un worker à durée bornée avant chiffrement : signature binaire, cohérence du MIME et durée vocale issue des octets, y compris les horodatages de blocs WebM et les durées d’échantillons/fragments MP4 lorsque MediaRecorder n’écrit pas de durée globale fiable.

### Enfants et communications

- enfants créés uniquement par un parent authentifié ;
- demande externe ciblée puis approbation parentale ;
- pause, horaires, média et appels appliqués par l’API ;
- fuseau parental IANA envoyé avec chaque planning et utilisé par React pour les états et horaires affichés, y compris lorsque le téléphone voyage ;
- permissions caméra/microphone à l’usage ;
- jetons d’action d’appel natifs envoyés uniquement à l’origine HTTPS API configurée, au port correspondant et sous `/api/native/calls/`, avec revalidation avant chaque requête iOS et Android ;
- aucun enregistrement du média WebRTC ;
- parents non participants exclus du contenu des conversations enfant-ami.

### Conservation et droits

- échéances explicites en base ;
- purge quotidienne transactionnelle et journalisée ;
- sauvegardes à fenêtre courte ;
- tombstones empêchant la réapparition après restauration ;
- export minimisé et demandes d’exercice suivies ;
- restriction du traitement appliquée par une liste explicite méthode-chemin limitée au contexte de compte, aux droits, à l’export, au contact vie privée, à la déconnexion et aux suppressions ; aucune exception générique `/api/privacy/*`, notamment pour le consentement de notification.

## 10. Analyse des risques

Échelle : gravité et vraisemblance sont cotées de 1 à 4. Le score est leur produit : faible `1–4`, modéré `5–8`, élevé `9–16`. La gravité est évaluée du point de vue de l’enfant, pas de l’entreprise. Le résiduel est provisoire tant que les actions et la configuration de production ne sont pas prouvées.

| ID | Événement redouté | Initial | Mesures principales | Résiduel | Niveau | Actions |
|---|---|---:|---|---:|---|---|
| R01 | Accès non autorisé aux conversations ou médias | 4×4=16 | Autorisations, sessions, validation binaire/durée des médias, chiffrement applicatif, base privée | 4×3=12 | Élevé | A04, A07, A08 |
| R02 | Usurpation ou prise de contrôle d’un compte | 4×3=12 | bcrypt, limitation, session révocable 12 h | 4×3=12 | Élevé | A07, A08 |
| R03 | Contact indésirable, manipulation ou harcèlement | 4×3=12 | Identifiant opaque, approbation, règles API | 4×2=8 | Modéré | A02, A05, A07 |
| R04 | Surveillance disproportionnée de l’enfant | 3×3=9 | Visibilité restreinte, données éphémères, pas de contenu parent, agrégats administrateur sans détail individuel | 3×2=6 | Modéré | A02, A06 |
| R05 | Exposition par notification | 3×3=9 | Libellé générique, consentement conjoint, jeton opaque, consentement bloqué sous restriction RGPD | 2×3=6 | Modéré | A03, A07 |
| R06 | Exposition liée à WebRTC | 4×3=12 | Autorisation, signalisation chiffrée, permissions à l’usage, purge, TURN | 3×3=9 | Élevé | A03, A07, A08 |
| R07 | Conservation ou restauration incorrecte | 4×3=12 | Purge, échéances, tombstones, registre de droits | 4×2=8 | Modéré | A06, A08 |
| R08 | Transfert ou sous-traitance insuffisamment maîtrisé | 4×3=12 | Registre par flux, Francfort pour les nouvelles ressources, minimisation, chiffrement, contrats annoncés | 4×3=12 | Élevé | A03, A01 |
| R09 | Indisponibilité ou perte de données | 3×3=9 | Sauvegardes, transactions, uploads bornés, tests | 3×2=6 | Modéré | A05, A06, A08 |
| R10 | Erreur, abus interne ou journalisation excessive | 4×3=12 | Erreurs minimisées, secrets Render, chiffrement | 4×3=12 | Élevé | A04, A05, A07, A08 |

Les scénarios détaillés — menaces, impacts, contrôles et liens d’action — sont la source structurée `server/aipd-register.js`. Toute modification d’un score doit être motivée dans l’historique de validation et accompagnée d’une preuve.

### 10.1 Vérification de la clôture de A02 à A08

| Action | État vérifié au 23/07/2026 | Preuves contrôlées | Conclusion |
|---|---|---|---|
| A02 | **Ouverte** | `docs/a02-protocole-consultation.md` se déclare vierge ; aucune consultation réelle et aucune décision signée établissant qu’elle ne serait pas appropriée ne sont référencées | Le protocole est un gabarit ; aucune des deux voies de clôture prévues par l’article 35(9) n’est prouvée |
| A03 | **Ouverte** | `docs/registre-sous-traitants-et-transferts.md` regroupe les preuves en cinq dossiers ; le code et le Blueprint cible ferment maintenant RTC, Web Push, FCM et APNs | La désactivation cible prépare D2 à D5, mais elle n’est pas encore prouvée sur Render réel ; D1 Render reste dépourvu de dossier privé vérifié |
| A04 | **Ouverte** | Procédure et audit A04 ; checklist encore vierge | Pour les services réellement actifs, les accès nominatifs, l’authentification adaptée, le moindre privilège et les essais représentatifs de récupération/révocation ne sont pas prouvés |
| A05 | **Fermée avec réserve** | Procédure, registre, exercice `SIM-A05-2026-07-23`, manifeste et cinq contrôles automatisés réussis lors du rejeu | L’exercice synthétique couvre le contrôle préparatoire ; le 23/07/2027 est un objectif interne de revue, pas une échéance légale fixe |
| A06 | **Fermée avec réserve** | Rapport A06 et nouveau rejeu sur PostgreSQL 18.4 local neuf : purge 1/1, droits 1/1, cycle complet 5/5 et commande de purge réussis | La date du 23/10/2026 est un objectif interne fondé sur le risque, non une périodicité légale. A06 ne prouve pas Render |
| A07 | **Fermée avec restriction** | Rapport A07 ; 132 tests unitaires/HTTP réussis, 9 tests PostgreSQL réels réussis, audit npm sans vulnérabilité, build réussi ; quatre constats corrigés | Fermeture limitée au web/API : RTC, push, administration partagée et distribution native restent désactivés. Leur activation rouvre A07 |
| A08 | **Ouverte** | Checklist Render datée : 9 cases cochées et 29 non cochées ; index de preuves expurgé | Ressources observées en Oregon, Cron absent, déploiement refusé, SHA servi ancien, sessions de 168 h et restauration/alertes non prouvées |

**Conclusion de vérification :** la prémisse « A02 à A08 clôturées » est fausse. Aucun score ci-dessous ne peut être présenté comme un score définitif après clôture complète.

### 10.2 Recalcul des vraisemblances résiduelles

| Risque | Preuves vérifiées | Vraisemblance précédente → actuelle | Explication | Résiduel actuel |
|---|---|---:|---|---|
| R01 | Contrôles d’autorisation, session et chiffrement évalués ; A07 fermée ; A04 et A08 ouvertes | 3 → 3 | L’évaluation ferme les défauts locaux élevés, mais accès privilégiés, récupération des clés et déploiement conforme ne sont pas prouvés. Aucune baisse n’est encore justifiée | 4×3=12 — **Élevé** |
| R02 | Limitation, cookie/Bearer, révocation et erreurs évalués ; A07 fermée ; A08 ouverte | 2 → 3 | Le code évalué impose 12 h, mais la version observée sur Render sert encore des sessions de 168 h. Tant que cette version n’est pas remplacée et prouvée, la hausse demeure | 4×3=12 — **Élevé** |
| R03 | Approbation parentale, règles serveur et gardes des routes évaluées ; A05/A07 fermées ; A02 ouverte | 2 → 2 | Les barrières réduisent le scénario à « possible », mais A02 n’a suivi aucune de ses deux voies de décision ; une baisse à 1 n’est pas justifiée | 4×2=8 — **Modéré** |
| R04 | Restrictions de présence et exports vérifiés ; tableau administrateur limité à des agrégats ; A06 fermée ; A02 ouverte | 2 → 2 | La nouvelle vue n’ajoute pas d’événement comportemental et ne révèle aucun détail individuel, mais ni consultation appropriée ni décision circonstanciée de ne pas consulter n’est documentée | 3×2=6 — **Modéré** |
| R05 | Push fermé dans le périmètre cible ; A07 fermée ; A03 et A08 ouvertes | 2 → 3 | La désactivation est testée dans le dépôt mais pas encore prouvée sur Render réel ; les routes, durées, sous-traitants et contrats de tout flux futur restent à établir | 2×3=6 — **Modéré** |
| R06 | RTC fermé dans le périmètre cible ; A07 fermée ; A03 et A08 ouvertes | 2 → 3 | La version actuellement observée et sa configuration STUN/TURN ne sont pas remplacées ni prouvées. Le score ne baissera qu’après déploiement vérifié des drapeaux fermés | 3×3=9 — **Élevé** |
| R07 | A06 rejouée sur une base neuve avec restauration et tombstones ; A08 ouverte | 2 → 2 | A06 confirme la logique locale et empêche une hausse ; l’absence de Cron et de restauration Render réels empêche une baisse à 1 | 4×2=8 — **Modéré** |
| R08 | Registre A03 regroupé en cinq dossiers, tous ouverts ; A08 constate l’Oregon | 3 → 3 | Le transfert et les accès hors EEE sont plausibles et observés pour Render ; aucun dossier contractuel complet ni décision de transfert datée ne permet une baisse | 4×3=12 — **Élevé** |
| R09 | A05 et A06 fermées ; transaction, purge et restauration locale vérifiées ; A08 ouverte | 2 → 2 | Les contrôles locaux réduisent le risque, mais sauvegarde, alerte, Cron et restauration gérés par Render restent non testés | 3×2=6 — **Modéré** |
| R10 | Erreurs, routes et journaux évalués ; A05/A07 fermées ; A04 et A08 ouvertes | 3 → 3 | Les accès réels ne sont pas inventoriés et leur revue/révocation n’est pas prouvée ; la fermeture des contrôles locaux ne permet donc pas encore une baisse | 4×3=12 — **Élevé** |

Les risques encore élevés sont `R01`, `R02`, `R06`, `R08` et `R10`. Les hausses de vraisemblance concernent `R02`, `R05` et `R06`. Aucun score ne diminue, car aucune nouvelle preuve ne ferme les actions dont dépendrait une telle réduction.

### 10.3 Exigences internes retirées ou rendues proportionnelles

La version 1.8 retire les modalités qui n’étaient pas imposées comme telles par le RGPD :

- réponses humaines obligatoires pour fermer A02 : remplacées par les deux voies de l’article 35(9), consultation lorsqu’elle est appropriée ou décision signée et circonstanciée de ne pas consulter ;
- test A07 nécessairement confié à un prestataire indépendant : remplacé par une évaluation compétente, suffisamment séparée et fiable ;
- revues A04 trimestrielles, A05 annuelles et A06 trimestrielles : remplacées par un rythme motivé par le risque, les changements et les incidents ;
- MFA et essais sur les cinq fournisseurs, même inactifs : limités aux accès et services réellement actifs, avec `N/A` prouvé pour les fonctions désactivées ;
- vérificateur distinct, nombre fixe d’administrateurs, abonnement à un canal précis de changement fournisseur et configuration `Essential Contacts` : retirés comme formes internes non obligatoires ;
- forme unique de preuve A08 par CI sur le même SHA et test obligatoire de réception d’alerte : une provenance de déploiement et une preuve de détection équivalentes sont admises.

Ces retraits ne modifient aucun score : ils allègent la forme de la preuve, pas les lacunes substantielles actuellement observées.

La version 1.10 conserve la fermeture de `A07` pour un périmètre web restreint après correction de quatre constats et réussite des contrôles locaux. Elle ajoute au périmètre Clubhouse le catalogue rotatif, le défi quotidien, les jours protégés de la série et les récompenses d’apparence persistées avec le profil enfant. Cette évolution n’ajoute aucun prestataire, suivi public ou finalité commerciale. Elle ne réduit pas encore les scores dépendant de `A04` et `A08`, car le déploiement réellement observé ne correspond pas à la version évaluée.

### 10.4 Consultation préalable de la CNIL

L’[article 36 du RGPD](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4) et la [procédure de soumission de la CNIL](https://www.cnil.fr/fr/services-en-ligne/soumettre-une-analyse-dimpact-relative-la-protection-des-donnees-aipd-la-cnil) imposent une consultation préalable lorsque l’AIPD conclut à un risque résiduel élevé après prise en compte des mesures destinées à l’atténuer.

**Conclusion actuelle :**

- la production est interdite dans l’état présent ;
- la consultation CNIL ne doit pas servir à remplacer les contrats, preuves de configuration, la décision requise par A02 ou les tests encore réalisables ;
- les cinq risques élevés sont encore liés à des mesures et preuves inachevées : la conclusion définitive de l’article 36 est donc différée jusqu’à leur achèvement ;
- si, après fermeture vérifiée de `A02`, `A03`, `A04` et `A08`, un risque conserve un score de 9 à 16, la consultation préalable devient obligatoire avant le traitement concerné ;
- si Mickael Thorez décide qu’un de ces risques ne peut pas être davantage réduit tout en maintenant le traitement envisagé, la consultation devient immédiatement obligatoire avant toute mise en œuvre de ce traitement.

## 11. Plan d’actions

| ID | Mesure à fermer | Responsable | Échéance | Preuve d’acceptation | Statut vérifié |
|---|---|---|---|---|---|
| A01 | Validation formelle de l’AIPD | Responsable du traitement | Avant utilisateurs réels | Décision datée/signée, avis DPO si désigné, budget et risques acceptés | **Ouverte** |
| A02 | Décider et, si approprié, consulter parents et enfants | Responsable du traitement | Avant validation | Consultation adaptée avec compte rendu anonymisé et décisions motivées, ou décision signée et circonstanciée démontrant pourquoi elle n’est pas appropriée et quelles sources alternatives ont été examinées | **Ouverte** |
| A03 | Dossier sous-traitants et transferts | Responsable du traitement | Avant production | Cinq dossiers `D1` à `D5` fermés avec contrat, configuration réelle, chaîne de traitement, transfert, décision et prochaine revue ; sinon flux techniquement désactivé et limitation prouvée | **Ouverte** |
| A04 | Administration et cycle de vie des clés | Sécurité/exploitation | Avant production | Pour les services actifs : accès nominatifs, authentification adaptée au risque, moindre privilège, séparation des secrets et essai représentatif de rotation/remplacement, récupération et révocation ; services inactifs `N/A` avec preuve | **Ouverte** |
| A05 | Réponse aux incidents et violations | Responsable du traitement | Avant production, après incident/changement matériel, puis selon le risque | Procédure, registre et exercice incluant qualification, confinement, familles, enfants et CNIL sous 72 h | **Fermée avec réserve le 23/07/2026 ; objectif interne de revue 23/07/2027** |
| A06 | Purge, droits, effacement et restauration | Exploitation | Avant production, après changement matériel, puis selon le risque | Toutes les durées, purge, droits, suppressions, tombstones et restauration réussis sur PostgreSQL local isolé via `TEST_DATABASE_URL` | **Fermée avec réserve le 23/07/2026 ; objectif interne de revue 23/10/2026** |
| A07 | Évaluation de sécurité proportionnée | Évaluateur compétent | Avant production puis changement majeur | Périmètre web/API évalué, constats élevés corrigés et aucun constat critique/élevé ouvert ; RTC, push, administration partagée et distribution native désactivés | **Fermée avec restriction le 23/07/2026** |
| A08 | Preuve de configuration de production | Exploitation | Chaque déploiement | Preuves datées de l’état Render réel et lien non ambigu entre la version servie, les tests et le build par SHA ou provenance équivalente | **Ouverte** |

Une action n’est « fermée » qu’avec une pièce datée, un auteur et un résultat vérifiable. La seule présence d’une option dans `render.yaml` ne prouve pas sa valeur effective.

L’audit A04 du 23 juillet 2026 conclut à un état **ouvert**. Les mécanismes de clé active/précédente pour le contenu sont présents et testés avec des données synthétiques, mais les accès privilégiés et l’authentification des services actifs, la révocation d’un accès représentatif et la récupération réelle des secrets ne sont pas prouvés. Si Web Push est activé, le rollover VAPID reste bloquant : une seule paire est chargée, les souscriptions ne portent pas d’identifiant de paire et la clé privée peut être conservée dans PostgreSQL en l’absence de variables Render. Si le canal est désactivé, ces contrôles sont `N/A` avec preuve technique. La procédure et la checklist sont des préparatifs, jamais une preuve d’exercice.

L’audit A08 du 23 juillet 2026 conclut également à un état **ouvert**. Render affiche le service web et PostgreSQL en Oregon, aucun Cron Secret Clubhouse, six noms de variables seulement et un dernier déploiement refusé faute de `DATABASE_TRANSPORT`. Le commit réellement servi utilise encore des JWT de sept jours, ne contient pas le chiffrement applicatif versionné ni le workflow CI, et aucune restauration réelle n’est prouvée. La checklist datée conserve les constats expurgés ; le `render.yaml` actuel reste uniquement l’état cible.

### Preuve de clôture A07

L’évaluation `docs/a07-evaluation-securite-2026-07-23.md` a identifié puis fermé deux constats élevés et deux constats modérés : distribution publique d’un APK de débogage, activation implicite de fournisseurs, dépassement de la limite HTTP de 30 Mio et configuration Android trop permissive. La suite complète réussit 132 tests hors base, les cinq suites PostgreSQL réelles réussissent 9 tests supplémentaires, l’audit npm ne trouve aucune vulnérabilité et le build web réussit.

Cette clôture vaut uniquement tant que `RTC_ENABLED`, `WEB_PUSH_ENABLED`, `NATIVE_PUSH_ENABLED` et `PRIVACY_ADMIN_ENABLED` restent à `false` et qu’aucun APK/AAB/IPA n’est distribué. Toute activation ou publication native rouvre automatiquement `A07`.

### Preuve de clôture A05

L’exercice `SIM-A05-2026-07-23` a été exécuté le 23 juillet 2026 par six rôles fictifs déclarés (`EX-RT`, `EX-PI`, `EX-SEC`, `EX-PRIV`, `EX-COM`, `EX-SCR`), sans donnée réelle, connexion de production ni envoi à la CNIL ou aux familles. Il a évalué neuf objectifs, trouvé quatre défauts documentaires et fermé les quatre corrections. Le résultat, les limites et les brouillons neutres sont consignés dans `docs/exercices/a05-2026-07-23-fuite-messages-enfants.md` ; le manifeste `docs/exercices/a05-2026-07-23-manifest.json` et `server/incident-response-evidence.test.js` contrôlent la date, les rôles, le calcul des 72 heures, les décisions, les résultats et les preuves de correction.

Cette clôture couvre le critère d’exercice sur table d’A05. Elle ne démontre pas une mobilisation humaine réelle, un envoi multi-canal ou une interaction avec Render/CNIL et ne ferme aucune autre action. Le 23 juillet 2027 est une date de planification interne, non une périodicité imposée par le RGPD ; A05 est aussi à réexaminer après tout changement matériel ou incident réel.

### Preuve de clôture A06

La validation A06 du 23 juillet 2026 a utilisé exclusivement `TEST_DATABASE_URL` vers PostgreSQL 18.4 local et des données synthétiques. Les garde-fous ont refusé toute variable de production, tout hôte distant et tout nom de base non explicitement marqué comme test. Les tests ont réussi pour toutes les échéances, chaque catégorie de purge, les cinq types de demandes RGPD, les exports parent/enfant, la restriction, la suppression d’un enfant et d’une famille, la création des tombstones, `pg_dump`, `pg_restore`, puis le rejeu des tombstones sans réapparition des personnes effacées. Les journaux contrôlés ne contenaient que des condensats et des compteurs.

Le rapport daté `docs/a06-validation-postgresql-2026-07-23.md` consigne l’environnement, les commandes, les résultats et les anomalies de harnais corrigées. Cette preuve clôt A06. Le 23 octobre 2026 est un objectif interne de réexamen fondé sur le risque, pas une périodicité légale. Elle ne prouve ni le déclenchement du Cron Render réel ni une restauration depuis une sauvegarde gérée par Render ; ces preuves restent exigées par A08.

## 12. Projet de décision finale à signer

> **PROJET NON SIGNÉ — cette trame ne constitue ni une signature, ni une validation, ni une autorisation de production.**

| Élément | Décision préparée |
|---|---|
| Responsable appelé à décider | Mickael Thorez, responsable du traitement |
| Date de préparation | 23 juillet 2026 |
| Date d’effet | Aucune tant que Mickael Thorez n’a pas daté et signé la décision |
| Périmètre | Ensemble des traitements listés au § 3 : comptes familiaux et enfants, contacts, communications et médias, présence, WebRTC, notifications, règles parentales, Clubhouse et jeux, sécurité, conservation, droits, Render/PostgreSQL et fournisseurs réseau/push |
| Décision proposée | **Ne pas valider l’AIPD et ne pas autoriser la production** |
| Motif | La clôture de A02 à A08 n’est pas vérifiée ; A02, A03, A04 et A08 restent ouvertes ; R01, R02, R06, R08 et R10 restent élevés |
| Réserves impératives | Aucun enfant réel ; RTC, Web Push, FCM, APNs, administration RGPD partagée, tableau d’agrégats administrateur et distribution native restent désactivés ; aucun transfert non documenté ; A05 reste un exercice synthétique ; A06 reste une validation locale et non une preuve Render ; A07 est limitée au web/API |
| Consultation CNIL | À réexaminer après les mesures encore réalisables. Obligatoire avant le traitement concerné si un risque résiduel élevé subsiste alors, ou si Mickael Thorez conclut qu’il ne peut pas être réduit |
| Prochaine révision | Au plus tard le **5 septembre 2026**, avant la première échéance de recontrôle DPF inscrite dans A03, et plus tôt dès que A02, A03, A04 ou A08 reçoit une nouvelle preuve ou qu’un flux exclu d’A07 est activé |

### Déclaration réservée à Mickael Thorez

> Je soussigné **Mickael Thorez**, responsable du traitement, confirme avoir examiné le périmètre, les preuves, les scores résiduels, les réserves et la conclusion relative à la consultation préalable. Dans l’état documenté par la version 1.11, je maintiens l’interdiction de mise en production de Secret Clubhouse auprès d’enfants réels.

| Champ à compléter personnellement | Valeur |
|---|---|
| Décision | `☐ Je confirme la non-autorisation de production dans l’état actuel` |
| Réserves ou instructions supplémentaires |  |
| Date de signature |  |
| Signature de Mickael Thorez |  |
| Avis du DPO, si un DPO est désigné | Identité, avis, date et signature à compléter |

La signature de cette décision de blocage ne ferme ni `A01` ni les actions manquantes. Une autorisation future exige une nouvelle réévaluation versionnée ; elle ne doit pas être ajoutée à cette trame tant qu’une preuve manque ou qu’un risque élevé reste non traité.

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
