# Politique de conservation et de purge

Version applicable : 27 juillet 2026.

Cette politique applique le principe de limitation de la conservation. PostgreSQL porte les échéances utiles dans les colonnes `expires_at`, `retention_until` ou `inactive_after`. Le Cron Job Render `secret-clubhouse-retention` exécute `npm run retention:purge` chaque jour à 03:17 UTC. La purge est transactionnelle, protégée par un verrou PostgreSQL et consignée dans `retention_runs`.

## Durées

| Catégorie | Durée maximale | Départ du délai | Action automatique |
|---|---:|---|---|
| Compte ou famille active | Pendant l’utilisation du service | Dernière activité d’un membre | Aucune purge du compte tant qu’au moins un membre de la famille reste actif ; les autres limites ci-dessous continuent de s’appliquer |
| Compte ou famille inactive | 730 jours | Dernière connexion ou heartbeat du dernier membre actif | Suppression des comptes de la famille et suppression en cascade de leurs données |
| Résultat positif « âge vérifié » et date de vérification 14+ d’un « Autre proche » | Durée de vie du compte de ce proche, puis 730 jours maximum sans activité | Acceptation de la première invitation générique, puis dernière activité du compte | Suppression avec le compte ; la date de naissance utilisée pour le contrôle immédiat n’est jamais enregistrée, et aucun contrôle d’âge n’est demandé aux grands-parents, oncles, tantes, parrains ou marraines |
| Session d’authentification et métadonnées minimales d’appareil | Fenêtre glissante de 30 jours sans activité authentifiée ; renouvellement au plus une fois par jour | Création, dernière activité, expiration ou révocation | Aucune coupure fixe après 12 heures ; une panne réseau ne révoque pas la session ; le jeton mobile chiffré lié à l’appareil survit à la fermeture de l’application jusqu’à expiration, révocation ou déconnexion ; PostgreSQL conserve le hash SHA-256, un identifiant d’installation opaque non affiché, un libellé général d’appareil et les dates nécessaires à la liste parentale, puis supprime la ligne expirée ou rend la ligne révoquée éligible à la purge après 24 heures |
| Message texte ou automatique sans binaire en base | 365 jours | Création | Suppression du message et de ses accusés de réception |
| Photo, image, vidéo, message vocal ou autre média binaire | 90 jours | Création | Suppression du message, du binaire PostgreSQL et de ses accusés de réception |
| Signal WebRTC (offre, réponse, ICE) | 24 heures | Création | Suppression |
| Jeton haché d’action d’appel natif | 26 heures maximum | Création | Contrôle valable 2 heures, puis suppression de la ligne dans les 24 heures |
| Métadonnée d’appel terminé | 90 jours | Dernière mise à jour | Suppression ; un appel accepté sans fin depuis 24 heures est d’abord clôturé |
| Présence technique | 24 heures | Dernier heartbeat | Suppression ; l’interface considère déjà le compte hors ligne après 75 secondes |
| Indicateur de saisie | 6 secondes | Dernière frappe signalée | Suppression dès expiration |
| Abonnement Web Push ou jeton natif APNs/FCM | 180 jours | Dernier enregistrement du jeton | Suppression ; une réactivation renouvelle le délai |
| Invitation d’adulte — co-parent ou proche autorisé | 7 jours d’utilisation, puis 90 jours de trace | Création, puis acceptation, révocation ou expiration | Expiration du lien puis suppression de la trace |
| Demande de contact | 30 jours en attente, puis 180 jours de trace | Création, puis résolution ou expiration | Passage à `expired`, puis suppression |
| Invitation de jeu | 30 jours en attente | Création | Suppression |
| Partie acceptée, refusée ou terminée | 180 jours | Dernière action | Suppression |
| Progression Clubhouse, étoiles, série, défis quotidiens, récompenses et apparence choisie | Durée de vie du profil enfant | Première activité terminée | Suppression en cascade immédiate avec le profil, ou avec la famille après 730 jours d’inactivité |
| Compteur de limitation de connexion | 48 heures | Dernière mise à jour | Suppression ; le compteur d’identité est aussi effacé après une connexion réussie |
| Journal de sécurité applicatif | 365 jours | Événement | Suppression ; les e-mails et adresses IP ne sont pas enregistrés en clair |
| Demande d’exercice des droits | 5 ans | Réception de la demande | Suppression du registre, de la réponse et de sa chronologie |
| Consigne d’effacement pour restauration | 30 jours | Effacement actif | Réapplication sur toute base restaurée ; expiration après la fenêtre maximale de sauvegarde |
| Journal des purges | 365 jours | Exécution | Suppression |
| Sauvegarde PostgreSQL | PITR 3 jours (espace Hobby) ou 7 jours (Pro+), export logique 7 jours | Création du point ou de l’export | Render applique automatiquement sa fenêtre ; aucun export applicatif de longue durée n’est créé |

Les durées sont des maxima opérationnels. Une suppression explicite de profil ou de compte reste immédiate. Une obligation légale ou un litige identifié peut justifier une archive intermédiaire séparée, limitée aux seules données nécessaires, avec une échéance documentée au cas par cas ; la base active ne sert jamais d’archive indéfinie.

## Protection pendant la conservation

- Le texte des messages, le nom et le type des médias, leurs octets, ainsi que les offres, réponses et candidats ICE WebRTC sont chiffrés par l’application avant leur insertion dans PostgreSQL avec des enveloppes AES-256-GCM versionnées, liées à leur contexte et munies d’un identifiant de clé. Le service Render peut les déchiffrer après contrôle des participants autorisés : ce mécanisme protège le stockage mais n’est pas un chiffrement de bout en bout. La purge supprime le contenu chiffré et ses métadonnées aux mêmes échéances que le contenu correspondant.
- La session web de production utilise uniquement un cookie `__Host-`, `Secure`, `HttpOnly` et `SameSite=Lax`, inaccessible à JavaScript. Le secret natif opaque est conservé après fermeture dans un élément Keychain iOS non synchronisable et non migrable vers un autre appareil, mais restaurable sur le même appareil depuis sa sauvegarde, ou dans les préférences Android après chiffrement AES-GCM par une clé non exportable de l’Android Keystore ; la sauvegarde de l’application Android est désactivée. Il n’est écrit dans aucun stockage JavaScript, journal ou dans PostgreSQL en clair. Le client web inclut le cookie sans Bearer, le client natif omet les cookies et présente son en-tête natif avec le Bearer, puis le serveur vérifie que ce transport correspond au `client_type`. PostgreSQL conserve uniquement le hash SHA-256 révocable du jeton et les métadonnées minimales nécessaires à l’inventaire parent ; l’API n’affiche jamais le hash ni l’identifiant d’installation.
- Le lien avec PostgreSQL passe soit par le réseau privé interne de Render, soit par TLS avec vérification du certificat (`rejectUnauthorized: true`) et une CA de confiance lorsqu’elle est nécessaire. La configuration refuse les paramètres d’URL qui affaibliraient ce contrôle.
- Les notifications Web Push, APNs et FCM transmettent seulement des identifiants opaques de routage et un libellé générique. Elles ne transmettent ni texte de message, ni nom de fichier, ni nom d’enfant ou de contact ; un appel entrant utilise « Contact autorisé ».
- Le gestionnaire central ne rend publiques que les erreurs 4xx explicitement prévues. Les erreurs inattendues deviennent `Erreur interne.` ; toutes les réponses portent `X-Request-ID`, et le JSON produit par ce gestionnaire inclut le même `requestId` pour retrouver l’événement dans les journaux sans divulguer l’erreur interne.

## Exploitation et contrôle

- Le Cron Job doit rester relié à la même `DATABASE_URL` que le service web.
- Un échec de purge fait échouer le job Render et n’enregistre pas de succès partiel.
- Le champ JSON `retention_runs.deleted_counts` donne le nombre de lignes supprimées par catégorie sans contenir de donnée utilisateur.
- Toute nouvelle table contenant une donnée personnelle doit déclarer son point de départ, son délai, sa dépendance de suppression et son test avant mise en production.
- Une restauration de sauvegarde ne doit jamais réintroduire des comptes déjà effacés : avant toute bascule, exécuter `SOURCE_DATABASE_URL=<base active> SOURCE_DATABASE_TRANSPORT=<render-private ou tls> RECOVERY_DATABASE_URL=<base restaurée> RECOVERY_DATABASE_TRANSPORT=<render-private ou tls> npm run privacy:reapply-erasure`, avec la CA dédiée si un transport vaut `tls`, puis relancer le job de purge sur la base restaurée. La bascule est interdite si l’une de ces étapes échoue.

## Références

- [CNIL — Les durées de conservation des données](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees)
- [CNIL — Comptes inactifs et délai de deux ans](https://www.cnil.fr/fr/achat-de-contenus-numeriques-quelle-duree-de-conservation-des-comptes-inactifs)
- [CNIL — Tracer les opérations et conserver les journaux de six mois à un an](https://www.cnil.fr/fr/securite-tracer-les-operations)
- [CNIL — Sécuriser les sauvegardes](https://www.cnil.fr/fr/securite-sauvegarder)
- [Render — PostgreSQL backups](https://render.com/docs/postgresql-backups)
- [Render — Cron Jobs](https://render.com/docs/cronjobs)
