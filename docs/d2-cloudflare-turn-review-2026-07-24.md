# D2 — Revue préparatoire de Cloudflare Realtime TURN

**Date :** 24 juillet 2026  
**Périmètre :** activation contrôlée des appels WebRTC du prototype Secret Clubhouse  
**Responsable déclaré du compte :** Mickael Thorez  
**Décision :** activation technique autorisée pour des essais contrôlés sans enfant réel ; D2, A03, A04, A07 et A08 restent ouverts avant toute production réelle.

## 1. Configuration constatée

Le responsable du compte a confirmé le 24 juillet 2026 :

- la création d’une application Cloudflare Realtime TURN ;
- l’enregistrement de `RTC_TURN_KEY_ID` et `RTC_TURN_API_TOKEN` dans les secrets du service Render ;
- l’absence de partage de ces deux valeurs dans le dépôt ou dans la conversation de travail.

Le Blueprint déclare uniquement les noms des secrets avec `sync: false`. Le serveur génère des identifiants TURN temporaires côté Render et ne transmet jamais le jeton Cloudflare durable au client. En production, le démarrage échoue si `RTC_ENABLED=true` sans une configuration TURN complète.

## 2. Contrat et rôle

Revue publique effectuée le 24 juillet 2026 :

- [Self-Serve Subscription Agreement](https://www.cloudflare.com/fr-fr/terms/) : Cloudflare agit comme sous-traitant lorsque le contenu client contient des données personnelles européennes et incorpore le DPA par référence ;
- [Cloudflare Customer DPA, version 6.4 du 3 avril 2026](https://www.cloudflare.com/cloudflare-customer-dpa/) : le DPA fait partie du contrat principal et couvre Cloudflare comme sous-traitant pour la fourniture des services ;
- [liste des sous-traitants Cloudflare](https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/) : liste publique revue, avec mécanisme d’information préalable prévu par le DPA.

La preuve privée de l’identité exacte du titulaire du compte, de la date contractuelle applicable et de l’autorité de la personne ayant accepté les conditions doit rester archivée hors Git. Cette revue publique ne remplace pas cette pièce.

## 3. Données et minimisation

Selon la [FAQ Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/faq/), Cloudflare traite pour le relais les adresses IP, ports et horaires de session nécessaires. Avec WebRTC, le média est chiffré entre les participants par DTLS-SRTP et Cloudflare relaie des paquets qu’il ne peut pas déchiffrer.

Secret Clubhouse :

- ne place aucun nom, identifiant de contact, message ou nom de fichier dans les paramètres TURN ;
- conserve la signalisation dans PostgreSQL sous enveloppe AES-256-GCM après autorisation des participants ;
- délivre des identifiants TURN temporaires depuis Render ;
- supprime les signaux WebRTC après 24 heures et les métadonnées d’appel après 90 jours ;
- interdit les appels hors relation autorisée ou hors règles parentales.

## 4. Transferts

Cloudflare Realtime TURN utilise un réseau mondial. Le DPA Cloudflare inclut les clauses contractuelles types de la Commission européenne pour les transferts concernés et prévoit des garanties supplémentaires ainsi qu’un régime de sous-traitants. Les mesures techniques propres au flux sont le chiffrement DTLS-SRTP, les identifiants TURN courts, la minimisation des métadonnées et l’absence de contenu applicatif dans les paramètres du relais.

Cette revue ne clôt pas encore l’analyse de transfert : la preuve privée du contrat réellement applicable, la version archivée de la liste des sous-traitants, la durée exacte des métriques et journaux Realtime, les modalités d’accès support et la décision finale du responsable du traitement restent à joindre au dossier D2.

## 5. Limites et suites obligatoires

- Aucun enfant réel ne doit utiliser le périmètre activé tant que l’AIPD reste bloquée.
- `A07` est rouverte : le rapport du 23 juillet ne couvrait que le web/API avec RTC désactivé.
- `A04` doit vérifier les accès Cloudflare et Render, l’authentification, le moindre privilège, la rotation et la révocation du jeton TURN.
- `A08` doit relier un déploiement réel, son SHA, ses tests et les variables expurgées.
- `D2` reste ouvert tant que les pièces privées et la décision de transfert ne sont pas complètes.

Cette fiche n’inclut aucune clé, aucun jeton, aucune URL d’administration privée et aucune donnée d’enfant.
