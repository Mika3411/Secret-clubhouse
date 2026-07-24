# D3 — Revue préparatoire de Web Push

**Date :** 24 juillet 2026
**Périmètre :** notifications Web Push du prototype Secret Clubhouse, notamment Chrome et Edge sous Windows
**Décision :** activation technique autorisée pour des essais contrôlés sans enfant réel ; D3, A03, A04, A07 et A08 restent ouverts avant toute production réelle.

## 1. Configuration constatée

Le responsable du compte a confirmé le 24 juillet 2026 :

- la présence de `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` dans les secrets Render ;
- l’activation de `WEB_PUSH_ENABLED=true` dans le service Render ;
- l’absence de partage de la clé privée VAPID dans Git ou dans la conversation de travail.

Le Blueprint déclare les deux noms de clés avec `sync: false`. En production, le serveur refuse de démarrer avec Web Push actif si la paire VAPID manque. Le client n’affiche le contrôle que lorsque l’API annonce la fonction active et que le navigateur expose réellement Service Worker, Notifications et Push Manager dans un contexte sécurisé.

## 2. Données et finalité

Le service conserve dans PostgreSQL l’endpoint fourni par le navigateur, les clés techniques de l’abonnement, le compte autorisé et l’échéance de conservation. Les charges envoyées sont génériques et ne contiennent ni nom d’enfant, ni nom de contact, ni texte du message, ni nom de fichier.

Web Push sert uniquement à prévenir d’un message, d’une demande de contact, d’une invitation de jeu ou d’un appel entrant. Le navigateur ou le système choisit le service de remise effectif et contrôle l’affichage et le son.

## 3. Consentement et sécurité

- L’autorisation du navigateur est une permission technique, jamais le consentement RGPD.
- Pour un profil enfant, le serveur exige l’accord conjoint de l’enfant et d’un parent authentifié avant d’enregistrer un abonnement.
- Le consentement peut être retiré et l’abonnement supprimé.
- Les souscriptions expirent après 180 jours sans renouvellement.
- Les comptes en pause ou sous restriction de traitement ne peuvent pas inscrire de nouveau jeton.

## 4. Limites et pièces restantes

Le fournisseur de remise dépend du navigateur et du système. La matrice D3 doit encore conserver, pour chaque combinaison réellement supportée, un endpoint expurgé, le fournisseur observé, le contrat ou cadre applicable, les pays, la rétention et la décision de transfert.

Avant toute utilisation par des enfants réels :

- archiver la paire VAPID et sa procédure de rotation sans exposer la clé privée ;
- observer et documenter Chrome et Edge sous Windows sur les versions réellement supportées ;
- compléter la matrice des fournisseurs et transferts ;
- évaluer le périmètre Web Push réellement déployé dans A07 ;
- relier le déploiement, son SHA et ses variables expurgées dans A08.

Cette fiche n’inclut aucune clé privée, aucun endpoint d’utilisateur et aucune donnée d’enfant.
