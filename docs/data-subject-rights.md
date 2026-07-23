# Procédure d’exercice des droits

Version applicable : 23 juillet 2026.

Secret Clubhouse permet l’exercice des droits depuis l’interface authentifiée et par e-mail à `contact@secret-clubhouse.fr`. Le parcours intégré est disponible au parent dans « Gestion → Données et droits RGPD » et à l’enfant dans « Profil → Mes données et mes droits ». L’enfant peut agir directement ou avec l’aide d’un parent.

## Actions immédiates

- L’export JSON lisible couvre le compte, la famille, les contacts, demandes de contact, messages écrits par la personne, progression Clubhouse, jeux, appels, inscriptions de notification et demandes RGPD. Il exclut les hashes de mot de passe, jetons, endpoints et secrets.
- Lorsqu’un parent exporte les données d’un enfant, le contenu d’une conversation enfant–ami est masqué si ce parent n’est pas lui-même participant.
- Le parent principal peut supprimer toute sa famille après contrôle du mot de passe et saisie de `SUPPRIMER MA FAMILLE`.
- Un co-parent peut supprimer uniquement son propre compte après contrôle du mot de passe et saisie de `SUPPRIMER MON COMPTE`.
- Le parent principal peut supprimer un enfant depuis sa gestion de profil. Un enfant peut aussi déposer sa propre demande d’effacement, qui est examinée en tenant compte de son âge et de son intérêt supérieur.

## Registre et délai

Toute demande d’accès, rectification, effacement, limitation ou opposition crée une ligne `privacy_requests` et une chronologie `privacy_request_events`. Elle reçoit immédiatement :

- un accusé de réception ;
- une date de réception ;
- une échéance à un mois ;
- un statut visible : reçue, en cours, terminée, refus motivé ou annulée ;
- la réponse finale et sa date.

Le Cron Job quotidien compte les demandes ouvertes en retard. Il échoue lorsqu’au moins une échéance est dépassée afin de déclencher une alerte Render. Le registre est conservé cinq ans au maximum, uniquement pour prouver le traitement de la demande.

Le responsable habilité consulte et traite le registre avec `X-Privacy-Admin-Token` sur `/api/privacy/admin/requests`. La variable `PRIVACY_ADMIN_TOKEN` doit être un secret Render distinct des sessions utilisateur. Aucun mot de passe utilisateur ne doit être demandé par e-mail.

Une demande d’effacement ne peut pas être clôturée tant que le compte concerné existe encore. Pour un enfant, le responsable peut envoyer `executeErasure: true` avec le statut `completed` : l’API efface alors le profil et crée sa consigne de restauration dans la même transaction. Pour un parent, la suppression protégée du compte ou de la famille doit d’abord être effectuée avec son mot de passe et sa confirmation explicite.

## Limitation et opposition

Le responsable peut appliquer une limitation à la suite d’une demande de limitation ou d’opposition. PostgreSQL porte la date et le motif sur le compte. Tant que la limitation est active, l’API refuse avec le statut HTTP 423 les conversations, médias, présence, appels, jeux, notifications et mutations de profil. Seuls restent disponibles l’identification du compte, l’export, le suivi des droits et la suppression.

La limitation peut être levée seulement par une action tracée du responsable. Son application et sa levée apparaissent dans la chronologie de la demande.

## Effacement et sauvegardes

Chaque suppression explicite crée avant l’effacement actif une consigne `erasure_tombstones` contenant les seuls identifiants internes à supprimer, une échéance de sauvegarde à sept jours et une expiration à trente jours. La suppression retire les conversations concernées, les comptes et leurs données en cascade. Le registre minimal de la demande reste conservé selon la durée ci-dessus.

Une restauration Render crée une base distincte. Avant sa remise en service :

1. garder la base active accessible en lecture pour ses consignes d’effacement ;
2. définir `SOURCE_DATABASE_URL` vers la base active et `RECOVERY_DATABASE_URL` vers la base restaurée ; conserver `DATABASE_TRANSPORT=render-private` pour deux URL privées Render, ou définir séparément `SOURCE_DATABASE_TRANSPORT` et `RECOVERY_DATABASE_TRANSPORT` ;
3. exécuter `npm run privacy:reapply-erasure` ;
4. exécuter la purge de conservation sur la base restaurée ;
5. autoriser la bascule uniquement si les deux commandes terminent avec succès.

Le script réapplique toutes les consignes encore valides dans une transaction PostgreSQL et supprime les familles devenues vides. Cette étape empêche qu’un compte ou profil déjà effacé réapparaisse après restauration.

## Références

- [CNIL — Répondre à une demande de droit d’accès](https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces)
- [CNIL — Règlement européen, chapitre III : droits des personnes](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3)
- [CNIL — Encourager les mineurs à exercer leurs droits](https://www.cnil.fr/fr/recommandation-2-encourager-les-mineurs-exercer-leurs-droits)
- [CNIL — Sécuriser les sauvegardes](https://www.cnil.fr/fr/securite-sauvegarder)
