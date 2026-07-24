# Secret Clubhouse

Application mobile et tablette d'une messagerie sécurisée destinée aux enfants de 6 à 13 ans. Le client React/Vite et l’API Node.js sont servis ensemble par Render ; PostgreSQL conserve les comptes, conversations, messages, appels et signaux WebRTC.

## Développement local

Prérequis : Node.js 24 (la version Render est fixée dans `.node-version`).

```bash
npm ci
npm run dev
```

Vérifier la version de production :

```bash
npm run build
npm run preview
```

## Déploiement avec Render Blueprint

Le fichier `render.yaml` décrit le service web Node.js, la base PostgreSQL, le build Vite, le déploiement automatique à chaque commit, les variables de production et le Cron Job quotidien de purge. Les trois ressources sont fixées à `frankfurt` pour toute nouvelle création. Render ne changeant pas la région d’une ressource existante, la région du service, de la base et du Cron déjà déployés doit être vérifiée séparément dans le tableau de bord et migrée si nécessaire.

1. Pousser ce dossier dans un dépôt GitHub, GitLab ou Bitbucket.
2. Dans le tableau de bord Render, choisir **New > Blueprint**.
3. Connecter le dépôt et conserver le chemin Blueprint par défaut : `render.yaml`.
4. Vérifier le service `secret-clubhouse`, puis lancer **Deploy Blueprint**.

Render fournit automatiquement une URL HTTPS en `onrender.com`. `DATABASE_URL`, `JWT_SECRET` et la clé dédiée `CONTENT_ENCRYPTION_KEY` sont configurés par le Blueprint. Le prototype peut activer WebRTC et Web Push uniquement avec les secrets TURN et VAPID conservés dans Render ; le serveur échoue fermé s’ils manquent. APNs/FCM et le canal d’administration RGPD partagé restent explicitement fermés. Pour valider le Blueprint avec la CLI Render avant le déploiement :

```bash
render blueprints validate render.yaml
```

Documentation officielle : [Blueprints Render](https://render.com/docs/infrastructure-as-code) et [spécification `render.yaml`](https://render.com/docs/blueprint-spec).

## Sécurité des données et des sessions

- L’API chiffre le texte des messages, le nom et le type des médias, leurs octets, ainsi que les offres, réponses et candidats ICE WebRTC avant l’écriture dans PostgreSQL. Les enveloppes AES-256-GCM sont versionnées, authentifient leur contexte et portent un identifiant de clé pour permettre la rotation. Le service Render déchiffre le contenu seulement après avoir autorisé le participant : il s’agit d’un chiffrement applicatif, pas d’un chiffrement de bout en bout.
- En production web, le jeton opaque n’est jamais rendu accessible à JavaScript : il reste dans le cookie `__Host-sc_session`, `Secure`, `HttpOnly` et `SameSite=Lax`. Le client natif conserve son secret Bearer uniquement dans la mémoire du module ; il disparaît avec le runtime WebView et n’entre ni dans `sessionStorage` ni dans `localStorage`. Les requêtes web incluent le cookie sans Bearer, les requêtes natives omettent les cookies et présentent l’en-tête client natif avec le Bearer, et le serveur vérifie cette correspondance avec le `client_type` enregistré. PostgreSQL ne conserve que le hash SHA-256 révocable du jeton ; la validité par défaut et celle du Blueprint sont de 12 heures.
- `DATABASE_TRANSPORT=render-private` impose l’URL PostgreSQL interne de Render. Sur un runtime Render identifié par `RENDER=true`, cette URL privée sans domaine peut aussi être reconnue automatiquement lorsque la variable manque sur un service existant. Toute autre base doit utiliser `DATABASE_TRANSPORT=tls`, la vérification du certificat (`rejectUnauthorized: true`) et, si nécessaire, une CA de confiance ; les paramètres de l’URL ne peuvent pas désactiver cette politique.
- Les charges Web Push, APNs et FCM contiennent des identifiants opaques de routage et des libellés génériques. Elles n’incluent jamais le texte d’un message, le nom d’un fichier, le nom d’un enfant ou celui d’un contact ; un appel entrant affiche le libellé neutre « Contact autorisé ».
- Le gestionnaire central n’expose que les erreurs 4xx explicitement déclarées comme publiques. Une erreur inattendue devient `Erreur interne.` ; chaque réponse porte `X-Request-ID`, et le JSON du gestionnaire d’erreurs répète cet identifiant dans `requestId` pour permettre la corrélation avec les journaux serveur sans divulguer de détail interne.

### Tableau de bord administrateur

La route `/administration` présente uniquement des agrégats : nombre de familles, utilisateurs actifs sur 7 et 30 jours, retour des familles après 30 jours, sessions ouvertes et volumes d’activités. Elle ne renvoie aucun nom, identifiant de contact, conversation, message ou média. Les comptes administrateurs et leur propre famille sont exclus des calculs.

L’accès réutilise une véritable session parent et exige une nomination explicite. Aucun compte ni mot de passe administrateur par défaut n’existe :

1. créer ou conserver un compte parent nominatif ;
2. renseigner son e-mail normalisé dans `PLATFORM_ADMIN_EMAILS` sur Render ;
3. vérifier l’accès, la journalisation et les métriques sur un environnement contrôlé ;
4. définir `ADMIN_ANALYTICS_ENABLED=true` seulement après cette vérification.

Au premier accès autorisé, PostgreSQL inscrit le compte dans `platform_administrators`. Chaque lecture est consignée dans `security_events` avec l’identifiant de requête et sans contenu utilisateur. Le Blueprint conserve la fonctionnalité désactivée par défaut ; toute activation réelle doit être ajoutée aux preuves A04 et A08.

### Activation contrôlée des fournisseurs

En production, tous les drapeaux fournisseur valent `false` par défaut. Le Blueprint du prototype fixe `RTC_ENABLED=true` et `WEB_PUSH_ENABLED=true`, avec les secrets TURN et VAPID exclusivement dans Render ; `NATIVE_PUSH_ENABLED`, `PRIVACY_ADMIN_ENABLED` et `ADMIN_ANALYTICS_ENABLED` restent à `false`. Une valeur ambiguë, RTC sans relais TURN complet ou Web Push sans paire VAPID fait échouer la configuration.

Un flux destiné à une production réelle ne peut être activé qu’après fermeture de son dossier dans `docs/registre-sous-traitants-et-transferts.md` :

- WebRTC : conserver `RTC_TURN_KEY_ID` et `RTC_TURN_API_TOKEN` uniquement dans Render ; toute production réelle reste bloquée tant que D2, A03, A04, A07 et A08 ne sont pas validés ;
- Web Push : conserver `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` uniquement dans Render ; toute production réelle reste bloquée tant que D3, A03, A04, A07 et A08 ne sont pas validés ;
- Android/iOS : ajouter soit la configuration FCM, soit la configuration APNs complète, puis définir `NATIVE_PUSH_ENABLED=true` ;
- administration des demandes RGPD : le canal historique à jeton partagé reste désactivé tant qu’il n’est pas remplacé par un accès nominatif et traçable.

Ne jamais ajouter ces valeurs dans Git ou dans une capture d’audit.

Pour faire tourner la clé de contenu, conserver d’abord l’ancienne valeur dans le tableau JSON `CONTENT_ENCRYPTION_PREVIOUS_KEYS`, puis définir la nouvelle valeur dans `CONTENT_ENCRYPTION_KEY`. Avant d’accepter du trafic, le serveur relit et rechiffre les anciennes lignes avec la clé active, puis répète ce contrôle après un déploiement roulant. Une incohérence ou une clé manquante fait échouer le démarrage. Une ancienne clé ne doit être retirée qu’après vérification de la migration et expiration des sauvegardes qui peuvent encore contenir des enveloppes créées avec elle.

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

L’action `A07` a été rouverte le 24 juillet 2026 par l’activation contrôlée de RTC et Web Push. Le [rapport du 23 juillet](docs/a07-evaluation-securite-2026-07-23.md) reste une preuve historique du périmètre restreint ; les revues [TURN](docs/d2-cloudflare-turn-review-2026-07-24.md) et [Web Push](docs/d3-web-push-review-2026-07-24.md) documentent la préparation fournisseur sans autoriser l’usage par des enfants réels.

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
