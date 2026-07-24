# Compte rendu de l’exercice A05 — fuite fictive de messages d’enfants

**Référence :** `SIM-A05-2026-07-23`<br>
**Date :** 23 juillet 2026<br>
**Créneau simulé :** 09:00–16:30 CEST (`UTC+02:00`)<br>
**Type :** exercice sur table, sans connexion à la production et sans envoi externe<br>
**Statut final :** terminé avec corrections vérifiées<br>
**Prochaine répétition :** au plus tard le 23 juillet 2027, et après tout changement matériel de l’architecture

## 1. Règles et participants

L’exercice a été exécuté par jeu de rôles documentaire. Il ne prétend pas qu’une équipe humaine d’astreinte ou un prestataire externe était présent. Tous les participants ci-dessous sont des rôles fictifs, sans nom, adresse, compte ou donnée réelle :

| Identifiant fictif | Rôle joué | Livrable observé |
|---|---|---|
| `EX-RT` | Responsable du traitement | Décisions CNIL, personnes concernées et clôture |
| `EX-PI` | Pilote d’incident | Priorités, confinement et rétablissement |
| `EX-SEC` | Sécurité/exploitation | Portée, preuve, correctif et surveillance |
| `EX-PRIV` | Référent vie privée | Qualification, registre et échéance de 72 h |
| `EX-COM` | Communication/support | Modèles parent et enfant |
| `EX-SCR` | Scribe/observateur | Chronologie, défauts, preuves et critères |

L’exercice n’a utilisé que le scénario et les valeurs synthétiques du manifeste `docs/exercices/a05-2026-07-23-manifest.json`. Aucun log, compte, message, média, enfant, parent, adresse, jeton, clé ou service réel n’a été interrogé.

## 2. Scénario injecté

À 09:00 CEST, une alerte synthétique signale qu’une session adulte fictive a lu plusieurs conversations ne lui appartenant pas. À 09:08, la corrélation de requêtes fictives confirme une régression d’autorisation horizontale sur une route de lecture :

- 12 messages texte entièrement synthétiques ;
- 3 profils enfants fictifs ;
- 2 familles fictives ;
- une session adulte fictive non autorisée ;
- aucune image, vidéo, voix, donnée d’authentification, clé ou charge WebRTC ;
- accès supposé effectué par l’application Render après déchiffrement autorisé par le processus.

Le dernier point empêche de considérer le chiffrement PostgreSQL comme une mesure rendant les messages incompréhensibles pour ce scénario.

## 3. Objectifs et critères

| Objectif | Critère observable | Résultat |
|---|---|---|
| Détecter | Dossier ouvert et signal qualifié en moins de 15 minutes | Atteint : 8 minutes |
| Fixer `T0` | Fait déclencheur, décideur et échéance de 72 h consignés | Atteint : `T0` 09:08, échéance 26 juillet 09:08 |
| Qualifier | Nature, portée, catégories et risque évalués du point de vue des enfants | Atteint : confidentialité, score 12, risque élevé |
| Confiner | Session révoquée et chemin de lecture fermé en moins de 30 minutes | Atteint : 22 minutes |
| Préserver | Preuves minimisées et absence de contenu de message | Atteint par manifeste et registre synthétiques |
| Décider CNIL | Décision et brouillon initial avant `T0 + 72 h` | Atteint : 11:30 le jour même |
| Informer | Deux communications claires, parent et enfant | Atteint après correction `EX-A05-03` |
| Rétablir | Autorisations négatives validées avant reprise | Atteint dans la simulation à 13:30 |
| Corriger | Chaque défaut a propriétaire, échéance, état et preuve | Atteint après corrections documentaires et test automatisé |

## 4. Chronologie de confinement

| Heure CEST | Temps depuis signal | Événement, décision ou action simulée | Propriétaire |
|---|---:|---|---|
| 09:00 | `+00:00` | Alerte synthétique : volume inhabituel de lectures inter-conversations. Dossier ouvert. | `EX-SCR` |
| 09:04 | `+00:04` | Les identifiants de requête fictifs relient les lectures à une seule session adulte fictive. | `EX-SEC` |
| 09:08 | `+00:08` | Accès non autorisé à des données personnelles synthétiques raisonnablement certain. `T0` fixé ; échéance au 26 juillet 09:08 CEST. | `EX-PRIV`, `EX-RT` |
| 09:10 | `+00:10` | Niveau interne critique déclaré ; gel simulé des déploiements non liés. | `EX-PI` |
| 09:13 | `+00:13` | Session fictive révoquée ; recherche de sessions liées. | `EX-SEC` |
| 09:17 | `+00:17` | Route de lecture placée en indisponibilité contrôlée dans le scénario. | `EX-SEC` |
| 09:22 | `+00:22` | Règle serveur fictive bloque toute lecture sans participation ; confinement initial atteint. | `EX-SEC` |
| 09:35 | `+00:35` | Portée provisoire : 3 enfants, 2 familles, 12 messages, aucun média ou secret. | `EX-SEC`, `EX-SCR` |
| 09:50 | `+00:50` | Qualification : gravité 4, probabilité 3, score 12, risque élevé. | `EX-PRIV` |
| 10:05 | `+01:05` | Décision de notifier la CNIL et d’informer familles et enfants dans le scénario. | `EX-RT` |
| 10:40 | `+01:40` | Tests fictifs d’autorisation : participant autorisé accepté ; autre famille, autre conversation et parent non participant refusés. | `EX-SEC` |
| 11:00 | `+02:00` | Fenêtre de surveillance synthétique sans nouvel accès anormal. | `EX-SEC` |
| 11:30 | `+02:30` | Brouillon CNIL initial complet produit, marqué « exercice — ne pas envoyer ». | `EX-PRIV` |
| 12:15 | `+03:15` | Messages parent et enfant prêts, sans contenu privé ni attribution spéculative. | `EX-COM` |
| 13:30 | `+04:30` | Rétablissement simulé autorisé par `EX-PI` et `EX-SEC`. | `EX-PI`, `EX-SEC` |
| 15:00 | `+06:00` | Revue des objectifs : quatre défauts de procédure relevés. | `EX-SCR` |
| 16:30 | `+07:30` | Corrections intégrées et contrôles automatisés définis ; exercice clos. | `EX-RT` |

## 5. Qualification et décisions

### Nature et conséquences

La violation fictive affecte la confidentialité. Les messages sont supposés lisibles par une session non participante via le processus applicatif. Les conséquences plausibles sont une atteinte à l’intimité, une détresse, un harcèlement, un chantage ou un contact indésirable. Aucune conséquence n’a réellement eu lieu.

La gravité est `4/4` car les personnes sont des enfants et les communications privées pourraient provoquer une atteinte grave ou durable. La probabilité est `3/4` car le tiers fictif a eu accès au contenu lisible et la suppression de toute copie ne peut pas être garantie. Score `12/16`, donc risque élevé.

### CNIL

Dans le scénario, la violation est susceptible d’engendrer un risque : la notification CNIL est requise. `T0` est le 23 juillet 2026 à 09:08 CEST ; l’échéance est le 26 juillet 2026 à 09:08 CEST. Une notification initiale, même provisoire, doit partir avant cette échéance, puis être complétée sans retard indu.

Le brouillon a été déclaré prêt à 11:30 CEST, soit 2 h 22 après `T0`. Il n’a pas été saisi dans le téléservice CNIL et n’a pas été envoyé, car il s’agit d’un exercice.

### Familles et enfants

Le seuil de risque élevé est atteint. Les deux familles fictivement concernées et chacun des trois enfants fictifs devraient être informés dans les meilleurs délais :

- détail opérationnel et gestes de protection dans l’espace parent protégé et par e-mail vérifié ;
- version courte directement accessible à l’enfant après authentification ;
- push générique indiquant seulement qu’une information de sécurité est disponible, si le consentement push est valide ;
- canal de réponse humain et rubrique « Données et droits ».

Aucune exception de l’article 34(3) n’est applicable dans le scénario : le contenu était lisible via l’application, le risque élevé peut encore se matérialiser et les personnes concernées sont identifiables.

## 6. Brouillons de communication remplis

### Parent — exercice, ne pas envoyer

**Objet : Information de sécurité concernant votre famille Secret Clubhouse**

Bonjour,

Le 23 juillet 2026 à 09:08 CEST, nous avons constaté qu’un accès non autorisé avait concerné des messages texte liés à un profil enfant de votre famille fictive. L’accès fictif a été possible pendant une courte période. Aucun contenu privé n’est reproduit dans ce message.

Cette situation pourrait porter atteinte à la vie privée de l’enfant ou permettre une sollicitation indésirable. Dans le scénario, nous avons révoqué la session concernée, fermé le chemin d’accès, vérifié la portée et renforcé le contrôle qui sépare les conversations.

Expliquez simplement à votre enfant qu’un problème de confidentialité a eu lieu et qu’il n’en est pas responsable. Si une personne le contacte ou si un message l’inquiète, demandez-lui de ne pas répondre et de vous le montrer.

Pour cet exercice, aucun compte réel n’est concerné et aucune action n’est requise. Dans un incident réel, le point de contact et la date de la prochaine mise à jour figureraient ici.

### Enfant — exercice, ne pas afficher

**Un problème de confidentialité a été arrêté**

Dans l’histoire de cet exercice, quelqu’un qui n’en avait pas le droit a pu voir des messages. Ce n’est pas ta faute.

L’accès a été arrêté. Si une personne ou un message t’inquiète, ne réponds pas et parle à un adulte de confiance.

Ce texte sert seulement à vérifier que Secret Clubhouse sait expliquer un problème. Aucun vrai message et aucun vrai compte n’ont été utilisés.

## 7. Défauts et corrections vérifiables

| ID | Défaut observé | Correction appliquée | Propriétaire | Échéance | État | Preuve |
|---|---|---|---|---|---|---|
| `EX-A05-01` | Le point de départ des 72 h n’était pas défini dans le dépôt. | Définition de la « raisonnable certitude », double horodatage et calcul exact de l’échéance. | `EX-PRIV` | 23 juillet 2026 | Fermé | `docs/incident-response.md` § 3.2 et test du manifeste |
| `EX-A05-02` | Le rôle du chiffrement applicatif pouvait être mal interprété lors d’un accès via Render. | Ajout de la règle : un accès par le chemin applicatif de déchiffrement est présumé lisible. | `EX-SEC` | 23 juillet 2026 | Fermé | `docs/incident-response.md` § 4.1 |
| `EX-A05-03` | Aucun modèle distinct destiné directement à l’enfant n’existait. | Modèles parent et enfant, canaux séparés et interdiction de contenu privé dans le push. | `EX-COM` | 23 juillet 2026 | Fermé | `docs/incident-response.md` §§ 6 et 7 |
| `EX-A05-04` | A05 ne disposait d’aucune preuve structurée empêchant une clôture déclarative. | Manifeste JSON, registre d’exercice et test vérifiant date, rôles, résultats, corrections, délai et absence de données réelles. | `EX-SCR` | 23 juillet 2026 | Fermé | `docs/exercices/a05-2026-07-23-manifest.json` et `server/incident-response-evidence.test.js` |

## 8. Résultat et limites

L’exercice est **terminé avec corrections vérifiées**, et non « sans défaut ». Les neuf objectifs ont été observés ; quatre défauts documentaires ont été détectés et fermés dans le dépôt. Le calcul des 72 heures, la présence des rôles, les décisions de notification, les corrections et le marquage synthétique sont contrôlés automatiquement.

Contrôles réellement exécutés le 23 juillet 2026 :

- contrôle ciblé A05 : 5 tests réussis sur 5 ;
- dernière suite complète : 108 tests réussis, 1 contrôle hors périmètre A05 en échec dans l’état concurrent du dépôt, et 4 tests d’intégration PostgreSQL ignorés car `TEST_DATABASE_URL` n’était pas configurée ; les 5 tests A05 restent verts dans cette même exécution ;
- build Vite de production : réussi ;
- aperçu local : HTTP 200, titre « Secret Clubhouse », entrée d’authentification et liens juridiques visibles au format téléphone.

Limites :

- aucun sous-traitant, service Render, base PostgreSQL, canal de notification ou terminal n’a été réellement sollicité ;
- aucun temps humain d’astreinte ou d’approbation n’a été mesuré ;
- la joignabilité réelle du responsable et la capacité d’envoi multi-canal restent à tester dans un exercice organisationnel ;
- la suite globale du dépôt n’est pas entièrement verte en raison d’un contrôle hors périmètre A05, qui ne doit pas être présenté comme une réussite A05 ;
- cet exercice ne ferme ni `A04`, ni `A07`, ni `A08`, et ne lève pas le blocage global de production de l’AIPD.

A05 peut être clôturée pour son critère documentaire et son exercice sur table du 23 juillet 2026. Elle redevient échue au plus tard le 23 juillet 2027 ou après un changement matériel, un incident réel ou un échec de contrôle.
