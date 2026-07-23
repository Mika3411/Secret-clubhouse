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

Render fournit automatiquement une URL HTTPS en `onrender.com`. `DATABASE_URL`, `JWT_SECRET` et la clé dédiée `CONTENT_ENCRYPTION_KEY` sont configurés par le Blueprint. Les secrets TURN et VAPID doivent être renseignés dans Render. Pour valider le Blueprint avec la CLI Render avant le déploiement :

```bash
render blueprints validate render.yaml
```

Documentation officielle : [Blueprints Render](https://render.com/docs/infrastructure-as-code) et [spécification `render.yaml`](https://render.com/docs/blueprint-spec).

## Sécurité des données et des sessions

- L’API chiffre le texte des messages, le nom et le type des médias, leurs octets, ainsi que les offres, réponses et candidats ICE WebRTC avant l’écriture dans PostgreSQL. Les enveloppes AES-256-GCM sont versionnées, authentifient leur contexte et portent un identifiant de clé pour permettre la rotation. Le service Render déchiffre le contenu seulement après avoir autorisé le participant : il s’agit d’un chiffrement applicatif, pas d’un chiffrement de bout en bout.
- En production web, le jeton opaque n’est jamais rendu accessible à JavaScript : il reste dans le cookie `__Host-sc_session`, `Secure`, `HttpOnly` et `SameSite=Lax`. Le client natif conserve son secret Bearer uniquement dans la mémoire du module ; il disparaît avec le runtime WebView et n’entre ni dans `sessionStorage` ni dans `localStorage`. Les requêtes web incluent le cookie sans Bearer, les requêtes natives omettent les cookies et présentent l’en-tête client natif avec le Bearer, et le serveur vérifie cette correspondance avec le `client_type` enregistré. PostgreSQL ne conserve que le hash SHA-256 révocable du jeton ; la validité par défaut et celle du Blueprint sont de 12 heures.
- `DATABASE_TRANSPORT=render-private` impose l’URL PostgreSQL interne de Render. Une base externe doit utiliser `DATABASE_TRANSPORT=tls`, la vérification du certificat (`rejectUnauthorized: true`) et, si nécessaire, une CA de confiance ; les paramètres de l’URL ne peuvent pas désactiver cette politique.
- Les charges Web Push, APNs et FCM contiennent des identifiants opaques de routage et des libellés génériques. Elles n’incluent jamais le texte d’un message, le nom d’un fichier, le nom d’un enfant ou celui d’un contact ; un appel entrant affiche le libellé neutre « Contact autorisé ».
- Le gestionnaire central n’expose que les erreurs 4xx explicitement déclarées comme publiques. Une erreur inattendue devient `Erreur interne.` ; chaque réponse porte `X-Request-ID`, et le JSON du gestionnaire d’erreurs répète cet identifiant dans `requestId` pour permettre la corrélation avec les journaux serveur sans divulguer de détail interne.

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

## États persistants

Chaque message possède des accusés PostgreSQL par destinataire. La récupération authentifiée du message enregistre sa réception ; l’ouverture de la conversation enregistre sa lecture. Le client affiche uniquement les états `envoyé`, `reçu` ou `vu` renvoyés par l’API.

Le catalogue de récompenses Clubhouse est défini côté serveur. PostgreSQL conserve, séparément pour chaque enfant, les activités terminées, le nombre de relectures, les étoiles attribuées et les jours actifs utilisés pour la série quotidienne. Une activité peut être rejouée, mais ses étoiles ne sont attribuées qu’une fois.

## Appels WebRTC

Les appels audio et vidéo relient deux comptes authentifiés distincts. Le service Render :

- vérifie que les deux comptes appartiennent à la conversation et applique les règles parentales ;
- persiste l’état de l’appel et échange les offres, réponses et candidats ICE dans PostgreSQL ;
- expose l’appel entrant avec acceptation, refus, annulation, expiration et raccrochage ;
- crée une seule réponse automatique neutre lors d’un refus ;
- fournit STUN par défaut et des identifiants TURN temporaires lorsqu’un couple `RTC_TURN_KEY_ID` / `RTC_TURN_API_TOKEN` est configuré.

Pour un autre service TURN, configurez `RTC_TURN_URLS`, `RTC_TURN_USERNAME` et `RTC_TURN_CREDENTIAL`. `RTC_ICE_SERVERS_JSON` permet aussi de fournir directement un tableau `iceServers`. Ne placez jamais la clé API TURN dans le client.

Références : [signalisation WebRTC et candidats ICE](https://developer.mozilla.org/docs/Web/API/WebRTC_API/Signaling_and_video_calling) et [identifiants TURN temporaires Cloudflare](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
