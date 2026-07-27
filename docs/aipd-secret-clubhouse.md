# Analyse d’impact relative à la protection des données (AIPD)

**Traitement :** Secret Clubhouse — service familial privé de communication et d’activités pour enfants de 6 à 13 ans
**Version :** 1.26<br>
**Date d’évaluation :** 27 juillet 2026
**Responsable du traitement :** Mickael Thorez, éditeur individuel non professionnel
**Contact RGPD :** `contact@secret-clubhouse.fr`
**État :** réévaluation fondée sur les preuves disponibles, non validée par le responsable du traitement

Ce dossier applique la méthode CNIL : contexte, respect des principes fondamentaux, étude des risques sur les droits et libertés, mesures et validation. Il doit être conservé avec ses preuves. Il ne remplace ni l’avis d’un DPO lorsqu’un DPO est désigné, ni une consultation préalable de la CNIL lorsqu’un risque résiduel élevé ne peut pas être réduit.

## 1. Décision et statut

> **PRODUCTION BLOQUÉE**

La condition demandée d’une clôture vérifiée de `A02` à `A08` n’est pas satisfaite. `A05` et `A06` disposent de preuves permettant de retenir leur clôture avec les réserves décrites ci-dessous. `A07`, auparavant fermée pour le seul périmètre web sans RTC ni notifications actives, est rouverte par l’activation contrôlée de TURN, Web Push, FCM et APNs puis par la distribution publique de l’APK Android du prototype. `A02`, `A03`, `A04`, `A07` et `A08` restent ouvertes. L’AIPD n’est donc pas formellement approuvée et les risques `R01`, `R06`, `R08` et `R10` restent élevés. `R02` est ramené à un niveau modéré par les contrôles de révocation parentale décrits ci-dessous ; cette baisse ne vaut pas validation de la production.

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
- invitation et authentification des proches autorisés, avec vérification 14+ limitée à la catégorie générique « Autre proche » — sœur, frère, cousine, cousin ou autre personne de confiance ;
- maintien de la session web et persistance locale du jeton d’authentification dans les clients Android/iOS ;
- création, gestion, pause et suppression des profils enfants ;
- identifiants privés, QR et approbation des contacts ;
- conversations parent-enfant, parent-parent et enfant-contact ;
- messages texte, vocaux, photos, images et vidéos ;
- accusés de réception, présence et indicateurs de saisie ;
- appels audio/vidéo et signalisation WebRTC ;
- notifications Web Push, APNs et FCM ;
- règles parentales, horaires et activité générale ;
- Clubhouse, catalogue rotatif, défi quotidien, progression privée, série protégée, récompenses d’apparence et jeux multijoueurs ;
- tableau interne séparant des nombres agrégés d’un annuaire de support familial limité aux données de compte, avec accès administrateur nominatif, journalisation et suspension/réactivation des accès ;
- sécurité, journaux, sauvegardes, conservation et purge ;
- information, consentement facultatif aux notifications et exercice des droits.

### Hors périmètre

- publicité, vente de données, géolocalisation précise, profil public, recherche publique, analyse publicitaire et reconnaissance biométrique : ces traitements ne doivent pas exister ;
- outils internes futurs, prestataires non encore choisis ou nouvelles finalités : ils exigent une mise à jour préalable de cette AIPD ;
- contenu d’un flux WebRTC : il transite entre les participants ou par un relais TURN, mais Secret Clubhouse ne l’enregistre pas.

### Sources de preuve

Cette version repose notamment sur :

- `server/db.js` pour le schéma PostgreSQL et les dépendances de suppression ;
- `server/services/admin-analytics-service.js`, `server/services/admin-family-service.js`, `server/policies/platform-admin.js` et leurs tests pour l’agrégation, l’annuaire de support minimisé, la protection des comptes administrateurs, la révocation des sessions et l’accès nominatif ;
- `server/parental-policy.js` et les contrôles de routes de `server/index.js` pour l’application serveur des règles ;
- `server/auth-sessions.js`, `server/account-session-management.test.js` et `server/login-protection.js` pour l’inventaire parent des sessions, leur révocation ciblée ou globale, la révocation sur changement de mot de passe et la limitation de connexion ;
- `src/api.js`, `src/PublicApp.jsx`, `src/App.jsx`, `server/api-client-session.test.js`, `android/app/src/main/java/fr/secretclubhouse/app/auth/NativeSessionMemoryPlugin.java`, `android/app/src/main/AndroidManifest.xml` et `ios/App/App/NativeSessionMemoryPlugin.swift` pour la conservation, la restauration et l’effacement du jeton natif, ainsi que le comportement hors ligne ;
- `server/services/presence-service.js`, `src/presence.js` et leurs tests pour la distinction entre premier plan, veille joignable, session non joignable et déconnexion, ainsi que le blocage serveur des appels ;
- `server/content-encryption.js` et `server/message-content.js` pour le chiffrement applicatif ;
- `server/notification-privacy.js` et `server/legal-compliance.js` pour la minimisation push et le consentement ;
- `server/privacy-service.js`, `docs/data-subject-rights.md` et `server/reapply-erasure-tombstones.js` pour les droits ;
- `server/retention.js`, `server/retention-policy.js`, `docs/data-retention.md` et `render.yaml` pour les durées ;
- `docs/incident-response.md`, `docs/registre-violations.md` et le dossier `docs/exercices/a05-2026-07-23-*` pour la réponse aux violations et la preuve de l’exercice A05 ;
- `docs/a06-validation-postgresql-2026-07-23.md` et les tests PostgreSQL associés pour la clôture technique A06 ;
- `docs/registre-sous-traitants-et-transferts.md` pour l’état ouvert d’A03 et les preuves privées attendues ;
- `docs/registre-bases-legales.md`, `src/privacy-policy.js` et `src/legal-framework.js` pour les finalités, bases légales et informations fournies.
- `docs/a02-protocole-consultation.md` pour le protocole vierge préparatoire de l’action `A02`.
- `docs/a04-procedure-gestion-acces-et-cles.md`, `docs/a04-checklist-preuves.md`, `docs/a04-github-public-verification-2026-07-25.md` et `.audit/2026-07-23-a04-access-key-audit/audit.md` pour l’audit et la préparation de l’action `A04`.
- `docs/a07-evaluation-securite-2026-07-23.md` comme preuve historique du périmètre restreint, `docs/a07-evaluation-securite-2026-07-25.md` pour la nouvelle évaluation locale, et les revues D2 à D5 pour les activations TURN, Web Push, FCM et APNs ; `A07` est rouverte.
- `docs/a08-checklist-configuration-production-2026-07-23.md` comme constat privé historique et `docs/a08-verification-publique-2026-07-25.md` pour la provenance et la disponibilité publiques ; `A08` reste ouverte.
- `docs/a08-checklist-configuration-production-2026-07-23.md` et `.audit/2026-07-23-a08-production-config-audit/evidence-index.md` pour la comparaison expurgée entre le Blueprint et Render réellement déployé.
- `docs/production-deblocage-minimal.md` pour les seules interventions privées ou humaines encore nécessaires au périmètre web restreint.

Les contrôles indiqués comme existants sont des contrôles présents dans le dépôt. Leur configuration effective en production doit encore être prouvée par `A08`.

## 4. Acteurs, responsabilités et destinataires

| Acteur | Rôle | Données ou fonction |
|---|---|---|
| Mickael Thorez | Responsable du traitement | Détermine les finalités et moyens, valide l’AIPD et traite les droits. |
| Parents et co-parents | Utilisateurs adultes | Gèrent la famille, les protections et les contacts ; ne voient pas les conversations enfant-ami auxquelles ils ne participent pas. |
| Proches autorisés | Utilisateurs à accès limité | Communiquent uniquement avec les enfants et par les fonctions choisis par chaque famille, sans gestion familiale. La catégorie « Autre proche » est réservée aux personnes de 14 ans ou plus. |
| Enfants de 6 à 13 ans | Personnes concernées et utilisateurs | Communiquent avec des membres autorisés et utilisent les activités privées. |
| Administrateur de plateforme nommé | Personne habilitée | Consulte les agrégats et, pour la sécurité ou le support, l’identité familiale, les identifiants privés, états et dates de compte ; peut suspendre ou réactiver un compte non administrateur. Aucun compte par défaut, contenu de communication, mot de passe, jeton ou secret ; chaque lecture et action est journalisée. |
| Render Services, Inc. | Sous-traitant d’hébergement | Service Node.js, offre PostgreSQL managée, sauvegardes et journaux techniques. Le Blueprint cible Francfort pour les nouvelles ressources ; une ressource existante reste supposée en Oregon jusqu’à vérification ou migration. |
| Cloudflare ou fournisseur TURN configuré | Sous-traitant réseau à confirmer | STUN et, si configuré, relais TURN temporaire ; adresses IP, ports, horaires, métriques et trafic WebRTC chiffré de bout en bout. Le statut contractuel du STUN public par défaut reste à confirmer. |
| Apple APNs | Qualification contractuelle à confirmer pour l’activation contrôlée iOS | Jeton technique et charge minimale générique ; aucune annexe article 28 propre à APNs n’a été identifiée dans la revue publique. |
| Google FCM | Sous-traitant de notification pour l’activation contrôlée Android | Jeton technique, Firebase installation ID, métadonnées de service et charge minimale générique sur une infrastructure mondiale. |
| Fournisseur Web Push du navigateur | Sous-traitant ou destinataire technique selon le navigateur | Endpoint, clés techniques et charge minimale générique. |

Le dossier contractuel et de transfert de chacun doit être vérifié et archivé au titre de `A03`. Le registre opérationnel et l’analyse préliminaire par flux se trouvent dans `docs/registre-sous-traitants-et-transferts.md`. Aucun développeur, opérateur ou prestataire supplémentaire ne doit recevoir d’accès sans instruction écrite, confidentialité, moindre privilège et traçabilité.

## 5. Description systématique du traitement

### 5.1 Parcours et flux

1. Un adulte reçoit l’information de confidentialité, crée un compte parent et une famille, puis crée un profil enfant. Le parent principal peut ensuite inviter un co-parent ou un proche autorisé. Un grand-parent, un oncle, une tante, un parrain ou une marraine ne fournit pas de date de naissance. Pour la seule catégorie générique « Autre proche » — par exemple une grande sœur ou une cousine — l’invité fournit sa date de naissance ; l’API l’évalue uniquement pendant la requête, refuse l’accès sous 14 ans et oriente la personne vers un profil enfant géré par un parent. La date complète n’est pas enregistrée : PostgreSQL conserve uniquement le résultat positif par l’horodatage de vérification. Une vérification déjà attachée au compte n’est pas répétée lors d’une invitation par une autre famille.
2. L’API Render authentifie le parent par e-mail ou l’enfant par son nom d’utilisateur privé globalement unique. L’identifiant de contact n’est jamais accepté pour la connexion. Une session opaque est remise au client ; PostgreSQL n’en conserve que l’empreinte SHA-256 révocable, un identifiant d’installation opaque non affiché, un libellé général d’appareil, la date de création, la dernière activité et l’échéance. Sur le web, le secret reste dans un cookie `__Host-` HttpOnly. Sur mobile, il est conservé localement dans un élément Keychain iOS non synchronisable et non migrable vers un autre appareil, ou dans des préférences Android chiffrées par AES-GCM avec une clé non exportable de l’Android Keystore ; la sauvegarde de l’application Android est désactivée. Le jeton iOS `ThisDeviceOnly` peut toutefois être restauré sur le même appareil depuis sa propre sauvegarde. Le parent voit uniquement le libellé et les dates de ses sessions : jamais le hash, le jeton ou l’identifiant d’installation.
3. Les profils possèdent un identifiant de contact opaque distinct du nom d’utilisateur. Il sert uniquement au QR et au routage d’une demande exacte, qui ne crée une relation externe qu’après approbation parentale.
4. Pour un message, l’API contrôle la session, la participation, le statut du profil, l’horaire dans le fuseau parental IANA configuré et, pour un média visuel, l’autorisation de partage. Ce même fuseau est joint au planning renvoyé au client afin que l’interface n’utilise jamais implicitement l’heure locale du téléphone. Avant persistance, chaque fichier temporaire est identifié par ses octets ; le MIME déclaré doit correspondre au format détecté et un message vocal est refusé si sa durée mesurée dépasse deux minutes ou ne peut pas être établie.
5. Le texte, le nom et le type du média, ses octets, ainsi que les offres, réponses et candidats ICE WebRTC sont chiffrés par l’application Render avec AES-256-GCM avant PostgreSQL. Render peut déchiffrer après autorisation : ce n’est pas un chiffrement de bout en bout.
6. Un appel utilise Render/PostgreSQL pour l’état et la signalisation chiffrée ; le média utilise WebRTC directement ou un relais TURN. Caméra et microphone sont demandés à l’usage.
7. Si les notifications facultatives sont valablement activées, Render transmet une charge générique au fournisseur push. Le contenu et les noms n’y figurent pas.
8. Lorsque le canal est explicitement activé, un parent inscrit dans `platform_administrators` peut lire à `/administration` des comptes agrégés calculés depuis les dates et événements déjà nécessaires au service. Une section séparée de support peut rechercher une famille et renvoyer uniquement les noms, e-mails parentaux, rôles familiaux, noms d’utilisateur et identifiants de contact privés, âges, états, dates d’activité et motifs de suspension. Elle ne sélectionne aucun mot de passe, conversation, message, média, contact extérieur, jeton push ou secret. Une suspension révoque les sessions actives, les comptes administrateurs sont protégés, et les lectures et actions sont journalisées.
9. Les échéances sont inscrites en base et un Cron Job quotidien purge les données. Un effacement crée une consigne temporaire à réappliquer avant toute restauration.

### 5.2 Catégories de personnes et données

| Catégorie | Données nécessaires |
|---|---|
| Parents/co-parents | E-mail, nom affiché, hash du mot de passe, identifiant opaque, rôle familial, sessions, préférences et preuves légales. |
| Proches autorisés | E-mail, nom affiché, hash du mot de passe, identifiant opaque, relation déclarée par chaque famille, enfants et fonctions autorisés ; résultat positif « âge vérifié » et date de vérification uniquement pour la catégorie « Autre proche ». La date de naissance utilisée pendant le contrôle n’est pas enregistrée. |
| Enfants | Nom d’usage, âge, identifiant opaque, nom d’utilisateur privé, hash du mot de passe, avatar, famille, état du profil et préférences. |
| Relations | Demandes et approbations de contact, participants aux conversations, invitations et état des jeux. |
| Communications | Texte, médias, message vocal, type et nom de fichier, expéditeur, conversation, horodatages, reçu/vu, référence de réponse, indicateur de transfert, codes et compteurs de réaction, saisie temporaire. |
| Appels | Participants, type audio/vidéo, état, horaires, signaux WebRTC, jetons techniques d’action native. |
| Sécurité et exploitation | Empreintes de session, identifiants d’installation opaques non affichés, libellés généraux d’appareil, dates de connexion et de dernière activité, compteurs de tentatives, IP pseudonymisée ou dérivée pour la limitation, identifiants de requête, événements de sécurité, erreurs techniques minimisées. |
| Authentification locale des clients | Jeton opaque Bearer complet conservé uniquement sur l’appareil mobile : Keychain iOS `ThisDeviceOnly`, non synchronisable et non migrable vers un autre appareil mais restaurable sur le même appareil depuis sa sauvegarde ; ciphertext et IV dans les préférences privées Android, avec clé AES-GCM non exportable dans l’Android Keystore et sauvegarde applicative désactivée. L’e-mail parent peut séparément rester dans le stockage JavaScript pour préremplir le formulaire ; aucun mot de passe, profil complet, message ou média n’est mis en cache pour un usage hors ligne. |
| Notifications | Endpoint ou jeton APNs/FCM, clés techniques, appareil, consentements et date d’activité. |
| Clubhouse | Activités terminées et rejouées, étoiles, jours actifs, défi quotidien réussi, récompenses débloquées et décoration choisie. |
| Pilotage agrégé | Comptages de familles et de comptes, dates de création et de dernière activité, sessions ouvertes et volumes d’événements fonctionnels par fenêtre de 7 ou 30 jours ; aucun détail individuel n’est exposé par l’API d’administration. |
| Support et gestion des accès | Nom de famille, noms et e-mails parentaux, rôles familiaux, noms d’usage, âges et noms d’utilisateur privés des enfants, identifiants de contact opaques, état et dates des comptes, limitation éventuelle et motif interne de suspension ; aucun contenu ou secret d’authentification. |
| Droits et conformité | Versions d’information, déclarations et consentements, demandes, réponses, chronologie et consignes d’effacement. |

Ne sont pas nécessaires : numéro de téléphone de l’enfant, carnet d’adresses, adresse postale, position GPS, école, publicité, analyse marketing et profil public. Ils ne doivent pas être collectés.

### 5.3 Durées

La matrice complète et ses points de départ figurent dans `docs/data-retention.md`. Les maxima principaux sont :

- sessions et métadonnées minimales d’appareil : fenêtre glissante de 30 jours sans activité authentifiée, renouvelée au plus une fois par jour, sans coupure fixe après 12 heures ; le jeton natif lié à l’appareil survit à la fermeture jusqu’à l’expiration, la révocation ou la déconnexion. Android exclut ses données applicatives des sauvegardes ; l’élément Keychain iOS ne migre pas vers un autre appareil mais peut être restauré sur le même appareil depuis sa sauvegarde ;
- présence et signaux WebRTC : 24 heures ;
- messages texte : 365 jours ;
- médias et métadonnées d’appel : 90 jours ;
- jetons push : 180 jours depuis leur dernier enregistrement ;
- comptes/familles inactifs : 730 jours ;
- résultat positif « âge vérifié » et date de vérification d’un « Autre proche » : durée de vie de son compte, puis suppression avec celui-ci au plus tard après 730 jours d’inactivité ; la date de naissance n’est jamais persistée ;
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
| Support et gestion administrative des comptes | Intérêt légitime, art. 6(1)(f) | Données de compte minimisées, contenus et secrets exclus, comptes administrateurs protégés, suspension réversible avec révocation des sessions et journalisation. |
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
- Les états reçu/vu, la présence courte et la saisie éphémère fournissent les fonctions explicites de communication ; ils ne servent pas au profilage. La présence ne publie aucun horodatage exact : elle distingue seulement l’usage récent au premier plan, une session joignable en veille grâce à une route de notification valide, une session authentifiée mais non joignable et une session réellement déconnectée.
- La signalisation WebRTC est nécessaire à un appel, mais le contenu audio/vidéo n’est pas enregistré.
- Les jetons push ne sont nécessaires que lorsque l’utilisateur choisit la fonction facultative.
- La conservation locale d’un seul jeton opaque est nécessaire au choix produit de ne pas redemander les identifiants après une fermeture ou une coupure réseau. Elle ne rend aucun contenu disponible hors ligne et n’empêche jamais la révocation serveur.

### 8.2 Alternatives moins intrusives retenues

- pas de numéro de téléphone enfant, synchronisation du carnet d’adresses, annuaire ou lien public ;
- pas de message ni nom dans les notifications ;
- pas de contenu des conversations enfant-ami dans le tableau parent ;
- annuaire de support limité aux informations de compte nécessaires, séparé des conversations, médias, relations extérieures, jetons et secrets ;
- date de naissance d’un « Autre proche » évaluée uniquement en mémoire pendant la requête, sans colonne PostgreSQL, journalisation, export ni conservation après le contrôle ;
- présence visible uniquement par la personne elle-même, sa famille ou ses contacts approuvés, sans heure exacte ni historique individuel ;
- permission caméra et microphone seulement au moment de l’usage ;
- données temps réel rapidement expirées ;
- aucun mot de passe, profil, message ou média mis en cache pour restaurer la session : seul le jeton opaque est conservé dans le coffre du système ;
- suppression automatique et export direct ;
- aucune publicité, vente de données ou analyse comportementale.

### 8.3 Limites et arbitrages

Le chiffrement applicatif protège PostgreSQL et les sauvegardes, mais Render détient la clé active et peut déchiffrer après contrôle d’accès. Le service n’est donc pas « de bout en bout ». Cette capacité doit rester limitée au processus applicatif, avec secrets séparés, administrateurs nommés et rotation testée.

Le suivi de présence et des accusés crée une attente sociale. L’interface doit rester neutre, ne pas produire de statistiques individuelles détaillées pour le parent et respecter les durées prévues. Elle ne doit pas présenter une application suspendue ou un téléphone en veille comme une déconnexion lorsque la session et la route de notification restent valides ; inversement, elle ne doit pas promettre un appel lorsque aucun appareil n’est joignable.

La persistance du jeton mobile améliore la continuité, mais permet à une personne qui prend le contrôle d’un appareil déjà déverrouillé d’utiliser la session jusqu’à sa révocation ou son expiration. Le chiffrement local protège surtout contre l’extraction hors appareil ; il ne constitue ni une seconde authentification ni une protection contre l’usage d’une application déjà ouverte. Aucun verrou biométrique ou code local propre à Secret Clubhouse n’est actuellement imposé. En réponse, un parent authentifié depuis n’importe quel autre appareil peut voir ses sessions, en révoquer une ou toutes les autres, changer son mot de passe — ce qui révoque toutes les autres sessions parent —, changer le mot de passe d’un enfant — ce qui révoque toutes les sessions de cet enfant —, ou demander les suppressions que son rôle autorise. La déconnexion explicite efface le coffre local, une réponse serveur `401` ou une suspension efface la copie lors du prochain échange, et une panne réseau ne doit jamais être interprétée comme une révocation.

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
- liste parentale des sessions limitée au libellé général, à la date de connexion et à la dernière activité, sans secret ni identifiant d’installation affiché ;
- révocation parentale d’une session précise ou de toutes les autres ; changement du mot de passe parent révoquant transactionnellement toutes les autres sessions et changement du mot de passe enfant révoquant transactionnellement toutes les sessions de l’enfant ;
- cookie web de production `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax` ;
- fenêtre glissante de 30 jours renouvelée au plus une fois par jour sur activité authentifiée ; une panne réseau ne modifie ni le hash ni l’échéance côté serveur ;
- jeton mobile absent de `localStorage` et `sessionStorage` ; restauration iOS par Keychain `AfterFirstUnlockThisDeviceOnly`, et restauration Android depuis un ciphertext AES-GCM dont la clé reste non exportable dans l’Android Keystore ;
- sauvegarde Android désactivée ; l’élément Keychain iOS ne se synchronise pas et ne migre pas vers un autre appareil, mais la possibilité de restauration sur le même appareil est explicitement retenue ;
- effacement du coffre mobile lors d’une déconnexion explicite et après rejet authentifié ou suspension confirmée par le serveur ; une erreur de transport ne l’efface pas et le retour en ligne relance le chargement ;
- limitation persistante des tentatives par identité et par IP ;
- connexion enfant limitée au nom d’utilisateur privé ; l’identifiant de contact partagé par QR ne peut ni authentifier ni incrémenter le compteur de blocage de cet enfant ;
- autorisation serveur par famille, relation approuvée et participation à la conversation ;
- administration réservée à un compte parent nominativement inscrit en base, sans identifiant ni mot de passe administrateur partagé ; comptes administrateurs protégés contre la suspension et sessions du compte ciblé révoquées ;
- présence inaccessible par simple identifiant arbitraire.
- état « En ligne » limité à un signal au premier plan de moins de 75 secondes ; état de veille joignable limité à une session active et une route Web Push/APNs/FCM encore valide ; l’API bloque la création d’un appel si le destinataire n’est pas joignable.

### Confidentialité, intégrité et minimisation

- AES-256-GCM applicatif versionné pour texte, types, noms, octets de médias et payloads de signalisation WebRTC ;
- données d’authentification liées au message dans le chiffrement pour détecter une substitution ;
- PostgreSQL sur le réseau privé Render ou TLS strict pour une base externe ;
- notifications génériques sans contenu ni nom ;
- erreurs inattendues génériques, corrélées par identifiant de requête ;
- statistiques d’exploitation calculées en PostgreSQL et limitées à des agrégats, avec exclusion de la famille administratrice ; annuaire individuel séparé et paginé, limité aux données de compte utiles, sans conversation, contenu, mot de passe, contact extérieur, jeton push ou secret, avec lecture et action journalisées ;
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
| R02 | Usurpation ou prise de contrôle d’un compte | 4×3=12 | bcrypt, limitation, session opaque révocable, fenêtre glissante de 30 jours, coffre natif lié à l’appareil, inventaire des sessions, révocation ciblée ou globale et révocation sur changement de mot de passe parent ou enfant | 4×2=8 | Modéré | A07, A08 |
| R03 | Contact indésirable, manipulation ou harcèlement | 4×3=12 | Identifiant opaque, approbation, règles API | 4×2=8 | Modéré | A02, A05, A07 |
| R04 | Surveillance disproportionnée de l’enfant | 3×3=9 | Visibilité restreinte, données éphémères, pas de contenu parent, statistiques agrégées ; annuaire support limité aux données de compte et sans comportement détaillé ni contenu | 3×2=6 | Modéré | A02, A06, A07 |
| R05 | Exposition par notification | 3×3=9 | Libellé générique, consentement conjoint, jeton opaque, consentement bloqué sous restriction RGPD | 2×3=6 | Modéré | A03, A07 |
| R06 | Exposition liée à WebRTC | 4×3=12 | Autorisation, signalisation chiffrée, permissions à l’usage, purge, TURN | 3×3=9 | Élevé | A03, A07, A08 |
| R07 | Conservation ou restauration incorrecte | 4×3=12 | Purge, échéances, tombstones, registre de droits | 4×2=8 | Modéré | A06, A08 |
| R08 | Transfert ou sous-traitance insuffisamment maîtrisé | 4×3=12 | Registre par flux, Francfort pour les nouvelles ressources, minimisation, chiffrement, contrats annoncés | 4×3=12 | Élevé | A03, A01 |
| R09 | Indisponibilité ou perte de données | 3×3=9 | Sauvegardes, transactions, uploads bornés, tests | 3×2=6 | Modéré | A05, A06, A08 |
| R10 | Erreur, abus interne ou journalisation excessive | 4×3=12 | Erreurs minimisées, secrets Render, chiffrement | 4×3=12 | Élevé | A04, A05, A07, A08 |

Les scénarios détaillés — menaces, impacts, contrôles et liens d’action — sont la source structurée `server/aipd-register.js`. Toute modification d’un score doit être motivée dans l’historique de validation et accompagnée d’une preuve.

### 10.1 Vérification de la clôture de A02 à A08

| Action | État vérifié au 25/07/2026 | Preuves contrôlées | Conclusion |
|---|---|---|---|
| A02 | **Ouverte** | `docs/a02-protocole-consultation.md` se déclare vierge ; aucune consultation réelle et aucune décision signée établissant qu’elle ne serait pas appropriée ne sont référencées | Le protocole est un gabarit ; aucune des deux voies de clôture prévues par l’article 35(9) n’est prouvée |
| A03 | **Ouverte** | `docs/registre-sous-traitants-et-transferts.md` regroupe les preuves en cinq dossiers ; D2 à D5 documentent les activations contrôlées TURN, Web Push, FCM et APNs | D2 à D5 attendent leurs pièces privées, essais réels et décisions de transfert ; D1 Render reste dépourvu de dossier privé vérifié |
| A04 | **Ouverte** | Procédure et audit A04 ; contrôle GitHub expurgé ; support technique de rotation VAPID ; checklist fournisseur non validée | GitHub ne compte qu’un administrateur nominatif et la continuité VAPID est implémentée, mais MFA, accès Render/Cloudflare/Google/Apple et essais réels de récupération, rotation et révocation ne sont pas prouvés |
| A05 | **Fermée avec réserve** | Procédure, registre, exercice `SIM-A05-2026-07-23`, manifeste et cinq contrôles automatisés réussis lors du rejeu | L’exercice synthétique couvre le contrôle préparatoire ; le 23/07/2027 est un objectif interne de revue, pas une échéance légale fixe |
| A06 | **Fermée avec réserve** | Rapport A06 et nouveau rejeu sur PostgreSQL 18.4 local neuf : purge 1/1, droits 1/1, cycle complet 5/5 et commande de purge réussis | La date du 23/10/2026 est un objectif interne fondé sur le risque, non une périodicité légale. A06 ne prouve pas Render |
| A07 | **Rouverte** | Rapports historiques ; tests du transport de session et des coffres natifs ; suite Node, audit npm, build web, compilation et APK Android | Le coffre Android compile et les contrôles statiques vérifient les choix iOS, mais aucun essai sur appareils réels ne couvre encore fermeture/réouverture, restauration, perte réseau, révocation distante ou appareil volé ; les essais RTC/push et la signature Android de distribution restent aussi nécessaires |
| A08 | **Ouverte** | Checklist privée historique du 23 juillet ; vérification publique du 25 juillet ; healthcheck avec provenance SHA et vérificateur automatisé | Le service public et la CI concordent, mais une nouvelle revue privée Render doit encore prouver régions, variables, transport, sessions, sauvegardes, restauration, Cron, alertes et journaux |

**Conclusion de vérification :** la prémisse « A02 à A08 clôturées » est fausse. Aucun score ci-dessous ne peut être présenté comme un score définitif après clôture complète.

### 10.2 Recalcul des vraisemblances résiduelles

| Risque | Preuves vérifiées | Vraisemblance précédente → actuelle | Explication | Résiduel actuel |
|---|---|---:|---|---|
| R01 | Contrôles d’autorisation, session et chiffrement évalués ; A07 rouverte ; A04 et A08 ouvertes | 3 → 3 | Les défauts locaux élevés du périmètre historique ont été corrigés, mais le périmètre RTC et notifications actif, les accès privilégiés, la récupération des clés et le déploiement conforme ne sont pas prouvés. Aucune baisse n’est justifiée | 4×3=12 — **Élevé** |
| R02 | Limitation, cookie/Bearer, renouvellement glissant, coffres mobiles, inventaire et révocation parentale évalués ; A07 et A08 ouvertes | 3 → 2 | Le parent peut désormais se connecter depuis un autre appareil, reconnaître les sessions par un libellé général et leurs dates, révoquer une session précise ou toutes les autres, puis changer son mot de passe en conservant seulement la session courante. Un changement du mot de passe enfant révoque toutes les sessions de cet enfant. Ces opérations sont contrôlées par le compte et réalisées côté Render/PostgreSQL ; les tests HTTP vérifient l’absence d’exposition des secrets et les transactions de révocation. La vraisemblance devient « possible » plutôt que « vraisemblable ». Elle n’est pas nulle : un tiers peut agir avant la réaction du parent sur un appareil déjà déverrouillé, et les scénarios réels de vol, de restauration et de révocation hors ligne restent à exécuter dans A07 | 4×2=8 — **Modéré** |
| R03 | Approbation parentale, règles serveur et gardes des routes évaluées ; A05 fermée, A02/A07 ouvertes | 2 → 2 | Les barrières réduisent le scénario à « possible », mais A02 n’a suivi aucune de ses deux voies de décision et le nouveau périmètre RTC/notifications reste à évaluer ; une baisse à 1 n’est pas justifiée | 4×2=8 — **Modéré** |
| R04 | Restrictions de présence et exports vérifiés ; annuaire support limité aux informations de compte et sans contenu ; A06 fermée ; A02/A07 ouvertes | 2 → 2 | La vue n’ajoute pas d’événement comportemental, mais elle rend des identités et états individuels accessibles à un administrateur ; la minimisation et la journalisation sont codées sans encore disposer d’une évaluation réelle du nouveau périmètre ni d’une consultation appropriée | 3×2=6 — **Modéré** |
| R05 | Web Push, FCM et APNs activés pour essais ; A03, A07 et A08 ouvertes | 3 → 3 | Les charges sont génériques et le consentement conjoint est imposé, mais les contrats, pays, durées, fournisseurs navigateur et livraisons natives réelles ne sont pas encore documentés | 2×3=6 — **Modéré** |
| R06 | RTC préparé avec TURN ; A03, A07 et A08 ouvertes | 3 → 3 | Les secrets TURN sont déclarés hors Git et un garde-fou échoue fermé, mais le contrat privé, la décision de transfert, la rotation et l’évaluation du déploiement actif ne sont pas clos | 3×3=9 — **Élevé** |
| R07 | A06 rejouée sur une base neuve avec restauration et tombstones ; A08 ouverte | 2 → 2 | A06 confirme la logique locale et empêche une hausse ; le Cron et une restauration depuis une sauvegarde Render ne sont toujours pas prouvés sur l’état actuel | 4×2=8 — **Modéré** |
| R08 | Registre A03 regroupé en cinq dossiers, tous ouverts ; dernière observation privée Render historique en Oregon | 3 → 3 | Le Blueprint cible Francfort, mais aucune nouvelle capture du service, de PostgreSQL et du Cron ne prouve une migration des ressources existantes ; aucun dossier contractuel complet ni décision de transfert datée ne permet une baisse | 4×3=12 — **Élevé** |
| R09 | A05 et A06 fermées ; transaction, purge et restauration locale vérifiées ; A08 ouverte | 2 → 2 | Les contrôles locaux réduisent le risque, mais sauvegarde, alerte, Cron et restauration gérés par Render restent non testés | 3×2=6 — **Modéré** |
| R10 | Erreurs, routes et journaux évalués ; GitHub partiellement contrôlé ; VAPID versionné ; A04/A07/A08 ouvertes | 3 → 3 | L’unique administrateur GitHub et les mécanismes de rotation VAPID sont documentés, mais MFA, accès des autres fournisseurs et exercices réels de rotation, récupération et révocation ne sont pas prouvés | 4×3=12 — **Élevé** |

Les risques encore élevés sont `R01`, `R06`, `R08` et `R10`. `R02` devient modéré : les contrôles de révocation réduisent sa vraisemblance de 3 à 2, sans la ramener à zéro. Les hausses historiques de vraisemblance liées à la persistance mobile demeurent documentées dans les versions 1.19 à 1.21 ; la baisse actuelle repose sur les nouvelles routes, transactions et tests, mais A07 et A08 restent ouvertes.

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

La version 1.13 conserve `A07` ouverte à la date du 24 juillet 2026 : le responsable a activé Cloudflare Realtime TURN et Web Push, avec les secrets TURN et VAPID exclusivement dans Render. Le serveur échoue fermé si la configuration fournisseur nécessaire manque. Les revues D2 et D3 établissent la préparation et la minimisation techniques, mais ne remplacent ni les pièces privées, ni les décisions de transfert, ni l’évaluation de sécurité et la preuve du déploiement réel. Aucun enfant réel n’est autorisé sur ce périmètre.

La version 1.14 ajoute l’activation contrôlée de FCM et APNs. Le responsable a montré les noms de variables masqués dans Render et confirmé le drapeau natif, tandis que le dépôt déclare seulement les noms des secrets. Le garde-fou de démarrage refuse désormais l’activation sans fournisseur complet. La revue D4/D5 ne prouve cependant ni la livraison sur appareils verrouillés, ni les contrats, transferts, rotations ou révocations ; les actions et scores restent donc inchangés et aucun enfant réel n’est autorisé.

La version 1.15 ajoute la continuité de rotation VAPID, la provenance publique du SHA Render, une vérification automatisée du déploiement, le contrôle GitHub expurgé et une nouvelle évaluation locale incluant Android. Quatre erreurs de compatibilité Android détectées par lint ont été corrigées ; la CI couvre désormais ce lint. Ces mesures réduisent les lacunes techniques, mais ne remplacent ni les pièces contractuelles et privées, ni les essais fournisseur sur appareils réels, ni les décisions et signatures humaines. Les actions et scores restent donc inchangés.

La version 1.16 distingue l’usage au premier plan, la veille joignable, la session authentifiée mais non joignable et la déconnexion réelle. PostgreSQL conserve séparément les derniers signaux de premier plan et d’arrière-plan dans la même enveloppe de rétention de 24 heures. La joignabilité en veille exige une session active, le consentement de notification applicable et une route Web Push/APNs/FCM valide ; le serveur recontrôle cette disponibilité avant de créer un appel. Cette évolution réduit les faux statuts et appels voués à l’échec sans ajouter de finalité, de destinataire, de prestataire ou de durée de conservation. Les actions et scores restent inchangés.

La version 1.17 publie l’APK Android 1.7 dans les actifs web et restaure son accès exclusivement dans le groupe parent « Compte et application ». Pour rester compatible avec les APK 1.6 et antérieurs déjà installés sur les appareils du prototype, ce paquet conserve l’identité de signature Android de test. Cette distribution entre désormais dans le périmètre actif d’A07 et ajoute un constat élevé ouvert jusqu’à la mise en place d’une identité de signature de distribution protégée, d’une stratégie de migration et d’essais d’intégrité et de mise à jour sur appareils réels. Aucun score ne diminue et l’interdiction d’usage par des enfants réels est maintenue.

Le paquet Android public est ensuite mis à jour en version 1.12 (`versionCode 13`) avec le client web vérifié, le lancement direct des parties multijoueurs acceptées, l’arrêt confirmé d’une partie enregistré pour ses deux participants, l’ouverture sûre des URL `http://` et `https://` et les actions de réponse, copie, transfert et réaction dans les messages enfant ou parent. Après l’arrêt d’une partie, sa carte d’invitation disparaît des conversations des deux participants tandis que l’état technique annulé reste soumis à la rétention des parties. Les autres contenus de message restent du texte et ne sont jamais interprétés comme du HTML. Le code de version supérieur permet à Android de reconnaître réellement cette reconstruction comme une mise à jour des APK 1.6 à 1.11. Cette reconstruction ne modifie ni les finalités, ni les prestataires, ni les transferts, ni les durées de conservation. Elle conserve volontairement l’identité de signature de test pour permettre la mise à jour des appareils du prototype ; le constat A07 relatif à cette identité reste donc élevé et ouvert.

Les conversations enfant et parent prennent désormais en charge les réponses, la copie locale du texte, le transfert explicite vers une autre conversation autorisée et une liste courte de réactions. PostgreSQL conserve avec le message la référence interne de réponse, l’indicateur de transfert et les codes de réaction associés aux comptes participants ; ils suivent la durée de conservation du message. Le serveur vérifie que la réponse vise la même conversation, contrôle l’appartenance et les règles parentales de la destination avant un transfert, puis crée et chiffre une nouvelle copie avec le contexte cryptographique de cette destination. La copie presse-papiers reste uniquement sur l’appareil. Cette évolution n’ajoute ni finalité, ni prestataire, ni transfert international, ni nouvelle durée de conservation.

La version 1.19 retire la coupure fixe des sessions après 12 heures. Une session de production active renouvelle désormais une fenêtre glissante de 30 jours, au plus une fois par jour, tandis que la déconnexion manuelle, la suspension administrative et la révocation restent immédiates. Le secret natif demeure exclusivement en mémoire du processus et disparaît lorsque celui-ci se termine. Une session abandonnée expire après 30 jours sans activité puis est supprimée par la purge quotidienne. Cette durée accrue augmente la fenêtre d’exposition d’un cookie web volé : `R02` reste élevé, `A08` doit mesurer le renouvellement et la révocation sur Render réel, et aucune autorisation de production n’en découle.

La version 1.20 remplace la volatilité du secret natif par une persistance chiffrée liée à l’appareil afin de restaurer la session après une fermeture complète. iOS utilise un élément Keychain `ThisDeviceOnly` et Android chiffre le jeton par AES-GCM avec une clé non exportable de l’Android Keystore avant son écriture dans les préférences privées ; les sauvegardes applicatives Android restent désactivées. Une panne réseau ne l’efface pas et le retour en ligne relance le chargement ; une réponse d’authentification invalide, une révocation ou une déconnexion explicite l’efface. Cette persistance accroît le risque sur un appareil déverrouillé volé : `R02` reste élevé et A07 doit couvrir la fermeture/réouverture, la perte réseau, la révocation distante et l’effacement sur appareils réels.

La version 1.21 complète et rectifie l’analyse de la persistance mobile. Elle qualifie le Bearer complet comme donnée d’authentification traitée localement, décrit son flux et son échéance, et distingue les garanties des deux systèmes : Android exclut l’application des sauvegardes ; l’élément Keychain iOS n’est ni synchronisable ni migrable vers un autre appareil, mais peut être restauré sur le même appareil depuis sa sauvegarde. Aucun mot de passe, profil, message ou média n’est mis en cache pour l’usage hors ligne. Les tests automatisés prouvent l’absence de stockage JavaScript, le maintien du jeton lors d’une erreur réseau, l’effacement explicite et le chiffrement attendu ; le build Android réussit. iOS n’a pas été compilé ni essayé sur appareil dans l’environnement Windows, et aucun essai réel ne couvre encore la restauration, un téléphone déverrouillé perdu ou volé, la révocation distante hors ligne puis au retour réseau. A07 reste donc ouverte et le score `R02` reste `4×3=12 — Élevé`.

La version 1.22 ajoute dans l’espace parent la liste minimisée des sessions actives, leur révocation individuelle et l’action « Déconnecter tous les autres appareils ». Le changement du mot de passe parent vérifie l’ancien mot de passe, conserve la session courante et révoque transactionnellement toutes les autres ; le changement du mot de passe enfant révoque transactionnellement toutes les sessions de cet enfant. Les tests HTTP vérifient le rattachement des sessions au compte, la non-exposition des secrets et l’ordre transactionnel. Ces mesures permettent de ramener la vraisemblance de `R02` de 3 à 2, soit `4×2=8 — Modéré`. Le risque n’est pas nul, car un tiers peut agir avant révocation sur un terminal déjà déverrouillé ; les essais sur appareils réels et la preuve Render restent requis par A07 et A08.

La version 1.23 ajoute une notice parent accessible par l’onglet utilitaire « ? » et reconstruit l’APK Android public en version 1.14 (`versionCode 15`) avec le même client vérifié. La notice explique l’approbation des contacts, les protections, la révocation des appareils, les effets des changements de mot de passe et l’accès aux informations de confidentialité ; elle n’ajoute aucune collecte, finalité, durée, catégorie de destinataire ou transfert. Le code de version Android supérieur permet l’installation comme mise à jour du prototype. L’identité de signature de test reste inchangée : le constat A07 correspondant demeure élevé et ouvert, sans autorisation d’usage par des enfants réels.

La version 1.24 formalise les proches autorisés. Les grands-parents, oncles, tantes, parrains et marraines conservent un parcours direct sans date de naissance. La catégorie générique « Autre proche » couvre notamment une sœur, un frère, une cousine ou un cousin plus âgé et exige une date de naissance validée côté serveur afin de bloquer tout compte de personne âgée de 13 ans ou moins, laquelle doit rester dans un profil enfant sous contrôle parental. La date et l’horodatage de vérification suivent la durée de vie du seul compte concerné, figurent dans son export de droits et ne sont pas exposés dans l’annuaire administrateur. Cette mesure réduit le risque qu’un enfant contourne le contrôle parental sans modifier les scores résiduels existants ni fermer les actions encore ouvertes.

La version 1.25 applique une minimisation supplémentaire à ce contrôle. La date de naissance est évaluée uniquement en mémoire dans la requête d’acceptation, puis immédiatement abandonnée ; la colonne PostgreSQL qui la contenait est supprimée par la migration, ce qui efface aussi les éventuelles valeurs antérieures. Le compte conserve seulement le résultat positif « âge vérifié », représenté par son horodatage de vérification et exposé comme tel dans l’export de droits. Cette réduction de données n’ajoute ni finalité, ni destinataire, ni transfert, ni durée et ne modifie pas les scores résiduels.

La version 1.26 synchronise le même client web vérifié dans Android et iOS, porte les deux projets à la version mobile 1.15 (`versionCode` et build local 16), reconstruit l’APK public et déclenche sur `main` l’archive iOS signée par le workflow macOS/TestFlight. Cette reconstruction ne modifie ni les finalités, ni les données, ni les destinataires, ni les transferts, ni les durées. L’APK conserve l’identité de signature de prototype déjà documentée et l’IPA dépend toujours des éléments de signature Apple isolés dans l’environnement GitHub `testflight` ; A07 reste donc ouverte et aucune autorisation d’usage par des enfants réels n’en découle.

### 10.4 Consultation préalable de la CNIL

L’[article 36 du RGPD](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4) et la [procédure de soumission de la CNIL](https://www.cnil.fr/fr/services-en-ligne/soumettre-une-analyse-dimpact-relative-la-protection-des-donnees-aipd-la-cnil) imposent une consultation préalable lorsque l’AIPD conclut à un risque résiduel élevé après prise en compte des mesures destinées à l’atténuer.

**Conclusion actuelle :**

- la production est interdite dans l’état présent ;
- la consultation CNIL ne doit pas servir à remplacer les contrats, preuves de configuration, la décision requise par A02 ou les tests encore réalisables ;
- les quatre risques élevés sont encore liés à des mesures et preuves inachevées : la conclusion définitive de l’article 36 est donc différée jusqu’à leur achèvement ;
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
| A07 | Évaluation de sécurité proportionnée | Évaluateur compétent | Avant production puis changement majeur | Évaluation du périmètre réellement actif, incluant les coffres de session Android/iOS sur appareils réels — fermeture, réseau, restauration, migration, révocation, effacement et terminal volé — ainsi que WebRTC/TURN, Web Push, FCM, APNs et binaires publics signés, sans constat critique ou élevé non corrigé | **Rouverte le 24/07/2026** |
| A08 | Preuve de configuration de production | Exploitation | Chaque déploiement | Preuves datées de l’état Render réel, notamment fenêtre glissante de 30 jours et révocation des sessions, et lien non ambigu entre la version servie, les tests et le build par SHA ou provenance équivalente | **Ouverte** |

Une action n’est « fermée » qu’avec une pièce datée, un auteur et un résultat vérifiable. La seule présence d’une option dans `render.yaml` ne prouve pas sa valeur effective.

L’audit A04 reste **ouvert**. Les mécanismes de clé active/précédente pour le contenu et VAPID sont présents et testés avec des données synthétiques. Chaque souscription Web Push porte désormais un identifiant de paire, les anciennes paires sont retenues dans un secret Render transitoire et le client sait se réabonner. La vérification GitHub du 25 juillet constate un unique administrateur et la protection des secrets au push. Elle ne prouve toutefois pas son MFA ; les accès Render, Cloudflare, Google et Apple, la révocation d’un accès représentatif et la récupération réelle des secrets ne sont pas prouvés. Les identifiants FCM et APNs n’ont pas fait l’objet d’un exercice réel de rotation ou révocation.

L’audit A08 reste également **ouvert**. Le constat privé du 23 juillet est désormais historique. Le 25 juillet, le service et son healthcheck répondent, les empreintes JS/CSS publiques correspondent au build local du SHA dont la CI est verte, et la version suivante expose directement le SHA Render validé avec un vérificateur automatisé. Aucune nouvelle observation privée ne prouve cependant les régions, variables, sessions, clés précédentes, sauvegardes, restauration, exécution du Cron, alertes et durée des journaux. Le `render.yaml` reste une cible, pas la preuve de ces valeurs.

### Réouverture de A07

L’évaluation `docs/a07-evaluation-securite-2026-07-23.md` a identifié puis fermé deux constats élevés et deux constats modérés : distribution publique d’un APK de débogage, activation implicite de fournisseurs, dépassement de la limite HTTP de 30 Mio et configuration Android trop permissive. La suite complète réussit 132 tests hors base, les cinq suites PostgreSQL réelles réussissent 9 tests supplémentaires, l’audit npm ne trouve aucune vulnérabilité et le build web réussit.

Cette clôture historique valait uniquement tant que `RTC_ENABLED`, `WEB_PUSH_ENABLED`, `NATIVE_PUSH_ENABLED` et `PRIVACY_ADMIN_ENABLED` restaient à `false` et qu’aucun APK/AAB/IPA n’était distribué. Les activations RTC, Web Push, FCM et APNs, puis la publication initiale de l’APK 1.7 désormais mis à jour en 1.12, rouvrent donc `A07`. Les fiches D2 à D5, les tests de garde, un essai d’appel entre deux comptes, des essais de notification consentie sur appareils verrouillés et une signature Android de distribution protégée sont des entrées de la nouvelle évaluation, mais ne suffisent pas seuls à la fermer.

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
| Date de préparation | 27 juillet 2026 |
| Date d’effet | Aucune tant que Mickael Thorez n’a pas daté et signé la décision |
| Périmètre | Ensemble des traitements listés au § 3 : comptes familiaux et enfants, contacts, communications et médias, présence, WebRTC, notifications, sessions web et coffres mobiles, règles parentales, Clubhouse et jeux, sécurité, conservation, droits, Render/PostgreSQL et fournisseurs réseau/push |
| Décision proposée | **Ne pas valider l’AIPD et ne pas autoriser la production** |
| Motif | La clôture de A02 à A08 n’est pas vérifiée ; A02, A03, A04, A07 et A08 restent ouvertes ; R01, R06, R08 et R10 restent élevés |
| Réserves impératives | Aucun enfant réel ; RTC, Web Push, FCM et APNs sont limités à des essais contrôlés et doivent être désactivés si D2 à D5 ne peuvent pas être validés ; les coffres de session Android/iOS restent à éprouver sur appareils réels pour fermeture/réouverture, sauvegarde/restauration, perte réseau, révocation distante et effacement ; l’administration RGPD partagée, les agrégats administrateur et le nouvel annuaire individuel de support restent désactivés tant que leur périmètre n’est pas évalué ; l’APK public signé avec l’identité Android de test reste limité au prototype jusqu’à migration vers une signature de distribution protégée ; A05 reste un exercice synthétique ; A06 reste une validation locale et non une preuve Render |
| Consultation CNIL | À réexaminer après les mesures encore réalisables. Obligatoire avant le traitement concerné si un risque résiduel élevé subsiste alors, ou si Mickael Thorez conclut qu’il ne peut pas être réduit |
| Prochaine révision | Au plus tard le **5 septembre 2026**, avant la première échéance de recontrôle DPF inscrite dans A03, et plus tôt dès que A02, A03, A04 ou A08 reçoit une nouvelle preuve ou qu’un flux exclu d’A07 est activé |

### Déclaration réservée à Mickael Thorez

> Je soussigné **Mickael Thorez**, responsable du traitement, confirme avoir examiné le périmètre, les preuves, les scores résiduels, les réserves et la conclusion relative à la consultation préalable. Dans l’état documenté par la version 1.26, je maintiens l’interdiction de mise en production de Secret Clubhouse auprès d’enfants réels.

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
- [CNIL — Sécurité des applications mobiles : conception et développement](https://www.cnil.fr/fr/securite-applications-mobiles-conception-et-developpement)
- [CNIL — Les jetons individuels de connexion](https://www.cnil.fr/fr/les-jetons-individuels-de-connexion-ou-token-access)
- [Apple — Restricting keychain item accessibility](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility)
- [Android Developers — Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
