# Secret Clubhouse

Prototype mobile et tablette d'une messagerie sécurisée destinée aux enfants de 6 à 13 ans. L'application actuelle est un frontend React/Vite et se déploie comme site statique sur Render.

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

Le fichier `render.yaml` décrit entièrement le service statique : installation reproductible, build Vite, publication de `dist`, redirection des routes vers l'application, déploiement automatique à chaque commit et en-têtes de sécurité.

1. Pousser ce dossier dans un dépôt GitHub, GitLab ou Bitbucket.
2. Dans le tableau de bord Render, choisir **New > Blueprint**.
3. Connecter le dépôt et conserver le chemin Blueprint par défaut : `render.yaml`.
4. Vérifier le service `secret-clubhouse`, puis lancer **Deploy Blueprint**.

Aucune variable d'environnement ni aucun secret n'est nécessaire pour ce prototype. Render fournit automatiquement une URL HTTPS en `onrender.com`. Pour valider le Blueprint avec la CLI Render avant le déploiement :

```bash
render blueprints validate render.yaml
```

Documentation officielle : [Blueprints Render](https://render.com/docs/infrastructure-as-code), [spécification `render.yaml`](https://render.com/docs/blueprint-spec) et [sites statiques](https://render.com/docs/static-sites).

## Limite actuelle importante

Le prototype n'est pas encore une messagerie réelle : les profils et conversations sont des données de démonstration, et les nouveaux messages restent uniquement dans la mémoire du navigateur.

Les appels audio et vidéo utilisent réellement `getUserMedia` et `RTCPeerConnection`. Les boutons de démonstration établissent deux pairs WebRTC locaux afin de pouvoir vérifier les flux, l’état de connexion, les commandes micro/caméra/haut-parleur et le raccrochage sans second appareil. Pour relier deux appareils en production, il faudra ajouter :

- un serveur de signalisation authentifié pour échanger les offres, réponses et candidats ICE ;
- des serveurs STUN/TURN, avec identifiants TURN temporaires ;
- une vérification serveur du contact approuvé et des règles parentales avant chaque appel ;
- les appels entrants, notifications, refus, expiration et journal d’alertes de sécurité.

Un produit destiné aux enfants devra aussi ajouter un backend, une base de données, l'authentification parent/enfant, la modération, le signalement, le consentement parental et une validation juridique adaptée aux pays de lancement. La politique `Content-Security-Policy` de `render.yaml` devra alors autoriser explicitement les domaines de l’API, du service de signalisation et du TURN.

La réponse automatique du mode calme est simulée dans l’interface pour les messages ainsi que les tentatives d’appel audio ou visio refusées. En production, elle devra être créée côté serveur avec un type `auto_reply`, une clé d’idempotence par conversation et plage calme, et une règle interdisant toute réponse automatique à un message déjà marqué `auto_reply`. Cela évite les doublons et les boucles entre deux comptes indisponibles.
