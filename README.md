# Secret Clubhouse

Application mobile et tablette d'une messagerie sécurisée destinée aux enfants de 6 à 13 ans. Le client React/Vite et l’API Node.js sont servis ensemble par Render ; PostgreSQL conserve les comptes, conversations, messages, appels et signaux WebRTC.

## Développement local

Prérequis : Node.js 24 (la version Render est fixée dans `.node-version`).

```bash
npm ci
npm run dev
```

Contrôles statiques locaux :

```bash
npm run lint
npm run typecheck
```

Le lint couvre les sources React, Node et partagées. Le contrôle TypeScript reste non destructif : `tsconfig.typecheck.json` applique `strict` et `checkJs` à un premier ensemble de modules JavaScript/JSDoc, à étendre progressivement sans convertir les fichiers existants.

Vérifier la version de production :

```bash
npm run build
npm run preview
```

## Client iOS

La cible Capacitor se trouve dans `ios/App/App.xcodeproj`. La synchronisation reconstruit le client web, copie les ressources natives, normalise les chemins Swift Package générés sous Windows et vérifie la configuration APNs/VoIP, le manifeste de confidentialité et l’identité visuelle :

```bash
npm run mobile:sync:ios
```

Sur macOS avec Xcode installé, le build non signé pour le simulateur se lance avec :

```bash
npm run mobile:build:ios
```

Capacitor 8 exige Xcode 26 ou une version ultérieure. La compilation locale nécessite donc un Mac, mais la publication TestFlight peut être entièrement réalisée sur le runner macOS de GitHub Actions.

### Publication TestFlight

Le workflow GitHub Actions **Publier sur TestFlight** se lance manuellement depuis `main`. Il construit l’application sur `macos-26`, installe temporairement le certificat et le profil App Store chiffrés dans les secrets GitHub, signe l’archive, puis l’envoie directement dans App Store Connect. Les fichiers de signature ne sont jamais versionnés et sont supprimés du runner après le job. Les identifiants sont limités à l’environnement GitHub `testflight`.

Variables de l’environnement :

- `APPLE_TEAM_ID`
- `APPSTORE_API_KEY_ID`
- `APPSTORE_ISSUER_ID`

Secrets de l’environnement :

- `APPSTORE_API_PRIVATE_KEY` : contenu privé du fichier `AuthKey_….p8`
- `APPLE_DISTRIBUTION_CERTIFICATE_BASE64` : certificat `.p12` encodé en Base64
- `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD` : mot de passe du `.p12`
- `APPLE_PROVISIONING_PROFILE_BASE64` : profil App Store `.mobileprovision` encodé en Base64

La clé App Store Connect conserve le rôle **Gestionnaire d’apps** : elle sert uniquement à vérifier la fiche et téléverser le build. La signature reste locale au runner, comme pour le workflow Ma Voix, et ne requiert pas une clé API Admin. Après le premier envoi, Apple traite l’archive avant de l’afficher dans TestFlight.

Avant le premier lancement, une fiche d’app doit exister dans **App Store Connect > Apps** avec le Bundle ID `fr.secretclubhouse.app`. Le workflow vérifie automatiquement cette fiche et les droits de la clé API avant de compiler.

## Déploiement avec Render Blueprint

Le fichier `render.yaml` décrit le service web Node.js, la base PostgreSQL, le build Vite, le déploiement automatique à chaque commit, les variables de production et le Cron Job quotidien de purge. Les trois ressources sont fixées à `frankfurt` pour toute nouvelle création. Render ne changeant pas la région d’une ressource existante, la région du service, de la base et du Cron déjà déployés doit être vérifiée séparément dans le tableau de bord et migrée si nécessaire.

1. Pousser ce dossier dans un dépôt GitHub, GitLab ou Bitbucket.
2. Dans le tableau de bord Render, choisir **New > Blueprint**.
3. Connecter le dépôt et conserver le chemin Blueprint par défaut : `render.yaml`.
4. Vérifier le service `secret-clubhouse`, puis lancer **Deploy Blueprint**.

Render fournit automatiquement une URL HTTPS en `onrender.com`. `DATABASE_URL`, `JWT_SECRET` et la clé dédiée `CONTENT_ENCRYPTION_KEY` sont configurés par le Blueprint. Le prototype active WebRTC, Web Push, FCM et APNs uniquement avec les secrets TURN, VAPID, Firebase et Apple conservés dans Render ; le serveur échoue fermé si la configuration requise manque ou est incomplète. Le canal d’administration RGPD partagé reste explicitement fermé. Pour valider le Blueprint avec la CLI Render avant le déploiement :

```bash
render blueprints validate render.yaml
```

Documentation officielle : [Blueprints Render](https://render.com/docs/infrastructure-as-code) et [spécification `render.yaml`](https://render.com/docs/blueprint-spec).

## Sécurité des données et des sessions

- L’API chiffre le texte des messages, le nom et le type des médias, leurs octets, ainsi que les offres, réponses et candidats ICE WebRTC avant l’écriture dans PostgreSQL. Les enveloppes AES-256-GCM sont versionnées, authentifient leur contexte et portent un identifiant de clé pour permettre la rotation. Le service Render déchiffre le contenu seulement après avoir autorisé le participant : il s’agit d’un chiffrement applicatif, pas d’un chiffrement de bout en bout.
- En production web, le jeton opaque n’est jamais rendu accessible à JavaScript : il reste dans le cookie `__Host-sc_session`, `Secure`, `HttpOnly` et `SameSite=Lax`. Sur iOS, le secret Bearer natif est conservé dans un élément Keychain `ThisDeviceOnly` non synchronisable et non migrable vers un autre appareil, mais restaurable sur le même appareil depuis sa sauvegarde ; sur Android, il est chiffré par AES-GCM avec une clé non exportable de l’Android Keystore avant son écriture dans les préférences privées de l’application, dont la sauvegarde est désactivée. Le secret peut ainsi restaurer la session après une fermeture complète de l’application sans entrer dans le stockage JavaScript, les journaux ou PostgreSQL en clair. Une coupure réseau ne l’efface pas. Les requêtes web incluent le cookie sans Bearer, les requêtes natives omettent les cookies et présentent l’en-tête client natif avec le Bearer, et le serveur vérifie cette correspondance avec le `client_type` enregistré. PostgreSQL conserve le hash SHA-256 révocable du jeton et les métadonnées minimales nécessaires à la liste parentale des appareils ; le hash et l’identifiant d’installation ne sont jamais affichés. La session n’a plus de coupure fixe après 12 heures : en production, chaque activité authentifiée renouvelle une fenêtre glissante de 30 jours, au plus une fois par jour ; une révocation ou une déconnexion manuelle reste immédiate.
- L’espace parent permet de révoquer une autre session précise ou toutes les autres sessions. Un changement du mot de passe parent conserve la session courante et révoque toutes les autres dans la même transaction ; un changement du mot de passe enfant révoque toutes les sessions de l’enfant.
- `DATABASE_TRANSPORT=render-private` impose l’URL PostgreSQL interne de Render. Sur un runtime Render identifié par `RENDER=true`, cette URL privée sans domaine peut aussi être reconnue automatiquement lorsque la variable manque sur un service existant. Toute autre base doit utiliser `DATABASE_TRANSPORT=tls`, la vérification du certificat (`rejectUnauthorized: true`) et, si nécessaire, une CA de confiance ; les paramètres de l’URL ne peuvent pas désactiver cette politique.
- Les charges Web Push, APNs et FCM contiennent des identifiants opaques de routage et des libellés génériques. Elles n’incluent jamais le texte d’un message, le nom d’un fichier, le nom d’un enfant ou celui d’un contact ; un appel entrant affiche le libellé neutre « Contact autorisé ».
- Le gestionnaire central n’expose que les erreurs 4xx explicitement déclarées comme publiques. Une erreur inattendue devient `Erreur interne.` ; chaque réponse porte `X-Request-ID`, et le JSON du gestionnaire d’erreurs répète cet identifiant dans `requestId` pour permettre la corrélation avec les journaux serveur sans divulguer de détail interne.

### Administration de la plateforme

La route `/administration` sépare la vue d’ensemble agrégée d’un annuaire paginé de support. La vue d’ensemble présente le nombre de familles, les utilisateurs actifs sur 7 et 30 jours, le retour des familles après 30 jours, les sessions ouvertes et les volumes d’activités ; les comptes administrateurs et leur propre famille restent exclus de ces calculs.

L’onglet « Familles et comptes » montre uniquement les informations nécessaires à la gestion des accès : famille, parents et co-parents, enfants, identifiants privés, état et dates d’activité. Il permet de suspendre ou réactiver un compte non administrateur ; la suspension révoque ses sessions. Aucun mot de passe, conversation, message, média, contact extérieur, jeton push ou secret d’authentification n’est sélectionné. Les lectures et actions sont journalisées.

L’accès réutilise une véritable session parent et exige une nomination explicite. Aucun compte ni mot de passe administrateur par défaut n’existe :

1. créer ou conserver un compte parent nominatif ;
2. renseigner son e-mail normalisé dans `PLATFORM_ADMIN_EMAILS` sur Render ;
3. vérifier l’accès, la journalisation et les métriques sur un environnement contrôlé ;
4. définir `ADMIN_ANALYTICS_ENABLED=true` seulement après cette vérification.

Au premier accès autorisé, PostgreSQL inscrit le compte dans `platform_administrators`. Chaque lecture est consignée dans `security_events` avec l’identifiant de requête et sans contenu utilisateur. Le Blueprint conserve la fonctionnalité désactivée par défaut ; toute activation réelle doit être ajoutée aux preuves A04 et A08.

### Activation contrôlée des fournisseurs

En production, tous les drapeaux fournisseur valent `false` par défaut. Le Blueprint du prototype fixe `RTC_ENABLED=true`, `WEB_PUSH_ENABLED=true` et `NATIVE_PUSH_ENABLED=true`, avec les secrets TURN, VAPID, FCM et APNs exclusivement dans Render ; `PRIVACY_ADMIN_ENABLED` et `ADMIN_ANALYTICS_ENABLED` restent à `false`. Une valeur ambiguë, RTC sans relais TURN complet, Web Push sans paire VAPID ou notifications natives sans fournisseur complet fait échouer la configuration.

Un flux destiné à une production réelle ne peut être activé qu’après fermeture de son dossier dans `docs/registre-sous-traitants-et-transferts.md` :

- WebRTC : conserver `RTC_TURN_KEY_ID` et `RTC_TURN_API_TOKEN` uniquement dans Render ; toute production réelle reste bloquée tant que D2, A03, A04, A07 et A08 ne sont pas validés ;
- Web Push : conserver `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et, pendant une rotation, `VAPID_PREVIOUS_KEYS` uniquement dans Render ; toute production réelle reste bloquée tant que D3, A03, A04, A07 et A08 ne sont pas validés ;
- Android/iOS : les configurations FCM et APNs sont déclarées comme secrets Render et le drapeau natif est actif pour les essais contrôlés ; toute utilisation par des enfants réels reste bloquée tant que D4, D5, A03, A04, A07 et A08 ne sont pas validés ;
- administration des demandes RGPD : le canal historique à jeton partagé reste désactivé tant qu’il n’est pas remplacé par un accès nominatif et traçable.

Ne jamais ajouter ces valeurs dans Git ou dans une capture d’audit.

Pour faire tourner la clé de contenu, conserver d’abord l’ancienne valeur dans le tableau JSON `CONTENT_ENCRYPTION_PREVIOUS_KEYS`, puis définir la nouvelle valeur dans `CONTENT_ENCRYPTION_KEY`. Avant d’accepter du trafic, le serveur relit et rechiffre les anciennes lignes avec la clé active, puis répète ce contrôle après un déploiement roulant. Une incohérence ou une clé manquante fait échouer le démarrage. Une ancienne clé ne doit être retirée qu’après vérification de la migration et expiration des sauvegardes qui peuvent encore contenir des enveloppes créées avec elle.

Pour faire tourner VAPID sans perdre les abonnements existants, placer d’abord la paire active dans le tableau JSON `VAPID_PREVIOUS_KEYS`, puis remplacer `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`. PostgreSQL associe chaque souscription à l’empreinte non secrète de sa paire ; le serveur essaie la paire correspondante et le client se réabonne automatiquement à la nouvelle clé. Retirer une ancienne paire seulement lorsque les souscriptions correspondantes ont disparu ou expiré. Le repli qui génère une clé privée dans PostgreSQL reste limité au développement.

Après un déploiement, relier la version publique au SHA Git attendu avec :

```bash
npm run production:verify -- https://secret-clubhouse.onrender.com <sha-git-complet>
```

Le contrôle exige HTTPS, un healthcheck non caché avec `X-Request-ID`, le SHA complet fourni par Render et des ressources JS/CSS versionnées accessibles. Il complète la preuve A08 mais ne remplace pas la vérification privée des régions, secrets, sauvegardes, Cron et journaux.

## Conservation des données

Les comptes inactifs, messages, médias, signaux d’appel, présences, notifications, invitations, parties et journaux ont une échéance PostgreSQL explicite. Le job `secret-clubhouse-retention` lance chaque jour une purge transactionnelle avec :

```bash
npm run retention:purge
```

Les durées, leur justification et la procédure de contrôle sont décrites dans [docs/data-retention.md](docs/data-retention.md).

## Sous-traitants et transferts internationaux

Le registre opérationnel, les flux, les mécanismes de transfert, les exigences de l’article 28, les accès support, les sauvegardes et les preuves à archiver sont décrits dans [docs/registre-sous-traitants-et-transferts.md](docs/registre-sous-traitants-et-transferts.md).

Le registre distingue Render PostgreSQL, qui fait partie du service managé Render, des prestataires séparés Cloudflare, Google/Firebase et Apple. Il traite aussi le Web Push comme un service choisi par le navigateur, dont le fournisseur et le cadre contractuel ne sont pas toujours maîtrisés par l’application. L’activation générale reste bloquée tant que les statuts contractuels explicitement marqués « à clôturer » dans le registre ne disposent pas de preuves datées.

## AIPD et décision de production

L’analyse d’impact complète est tenue dans [docs/aipd-secret-clubhouse.md](docs/aipd-secret-clubhouse.md). Le registre testable des critères, risques résiduels et actions se trouve dans `server/aipd-register.js`.

Le traitement d’enfants, de conversations et médias privés, le suivi régulier nécessaire au service et la combinaison de technologies mobiles, push et WebRTC rendent l’AIPD obligatoire. Son état courant est **production bloquée** tant que les actions organisationnelles, contractuelles et de sécurité `A01` à `A08` ne sont pas closes et que le responsable du traitement n’a pas signé la décision. Si un risque élevé subsiste malgré ces mesures, une consultation préalable de la CNIL est requise.

L’action `A04` reste ouverte. Sa [procédure d’administration et de rotation](docs/a04-procedure-gestion-acces-et-cles.md), sa [checklist de preuves](docs/a04-checklist-preuves.md) et l’[audit du 23 juillet 2026](.audit/2026-07-23-a04-access-key-audit/audit.md) distinguent les contrôles du dépôt des preuves fournisseurs. Aucun test automatisé ou gabarit ne remplace l’exercice réel de rotation, récupération avec anciennes clés et révocation exigé avant clôture.

L’action `A07` a été rouverte le 24 juillet 2026 par l’activation contrôlée de RTC, Web Push, FCM et APNs. Le [rapport du 23 juillet](docs/a07-evaluation-securite-2026-07-23.md) reste une preuve historique du périmètre restreint ; les revues [TURN](docs/d2-cloudflare-turn-review-2026-07-24.md), [Web Push](docs/d3-web-push-review-2026-07-24.md) et [notifications natives](docs/d4-d5-native-push-review-2026-07-24.md) documentent la préparation fournisseur sans autoriser l’usage par des enfants réels.

## États persistants

Chaque message possède des accusés PostgreSQL par destinataire. La récupération authentifiée du message enregistre sa réception ; l’ouverture de la conversation enregistre sa lecture. Le client affiche uniquement les états `envoyé`, `reçu` ou `vu` renvoyés par l’API.

Le catalogue de récompenses Clubhouse est défini côté serveur. PostgreSQL conserve, séparément pour chaque enfant, les activités terminées, le nombre de relectures, les étoiles attribuées et les jours actifs utilisés pour la série quotidienne. Une activité peut être rejouée, mais ses étoiles ne sont attribuées qu’une fois.

## Appels WebRTC

Les appels audio et vidéo relient deux comptes authentifiés distincts. Le service Render :

- vérifie que les deux comptes appartiennent à la conversation et applique les règles parentales ;
- persiste l’état de l’appel et échange les offres, réponses et candidats ICE dans PostgreSQL ;
- expose l’appel entrant avec acceptation, refus, annulation, expiration et raccrochage ;
- crée une seule réponse automatique neutre lors d’un refus ;
- ne fournit aucun serveur STUN/TURN par défaut en production et refuse toutes les routes d’appel tant que `RTC_ENABLED` n’est pas explicitement activé ;
- fournit des identifiants TURN temporaires lorsqu’un couple `RTC_TURN_KEY_ID` / `RTC_TURN_API_TOKEN` est configuré après qualification du fournisseur.

Pour un autre service TURN, configurez `RTC_TURN_URLS`, `RTC_TURN_USERNAME` et `RTC_TURN_CREDENTIAL`. `RTC_ICE_SERVERS_JSON` permet aussi de fournir directement un tableau `iceServers`. Ne placez jamais la clé API TURN dans le client.

Références : [signalisation WebRTC et candidats ICE](https://developer.mozilla.org/docs/Web/API/WebRTC_API/Signaling_and_video_calling) et [identifiants TURN temporaires Cloudflare](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
