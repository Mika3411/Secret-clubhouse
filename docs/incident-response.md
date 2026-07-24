# Procédure de réponse aux incidents et violations de données

**Service :** Secret Clubhouse<br>
**Propriétaire :** responsable du traitement<br>
**Version :** 1.0<br>
**Date d’effet :** 23 juillet 2026<br>
**Réexamen :** après chaque incident matériel et au moins annuellement<br>
**Périmètre :** service Render, PostgreSQL, clients web et Capacitor, WebRTC, Web Push, APNs et FCM

Cette procédure couvre les incidents de sécurité et les violations de données à caractère personnel. Elle ne permet jamais d’utiliser des données réelles dans un exercice. Un exercice emploie uniquement des identifiants, comptes, messages, journaux et volumes synthétiques clairement marqués `SIMULATION`.

## 1. Rôles et déclenchement

Une même personne peut tenir plusieurs rôles dans une petite structure, mais chaque rôle et chaque décision doivent être consignés.

| Rôle | Responsabilité |
|---|---|
| Responsable du traitement (`RT`) | Décision finale de notification, moyens, relation CNIL et clôture. |
| Pilote d’incident (`PI`) | Chronologie, priorités, points de situation et journal des décisions. |
| Sécurité/exploitation (`SEC`) | Détection, preuve, confinement, éradication et rétablissement. |
| Référent vie privée (`PRIV`) | Qualification de la violation, risque pour les personnes, registre et notification. |
| Communication/support (`COM`) | Messages aux familles et enfants, canal de réponse et suivi. |
| Scribe (`SCR`) | Horodatage, sources, hypothèses, décisions, actions et preuves. |

Toute personne ou tout sous-traitant qui soupçonne une perte, une altération, une destruction, une divulgation ou un accès non autorisé ouvre immédiatement un dossier `INC-AAAA-NNN`, prévient `PI` et conserve le signalement original. Il ne faut pas attendre d’avoir identifié la cause.

## 2. Détection

### 2.1 Sources à surveiller

- hausse anormale des réponses `401`, `403`, `404`, `429` ou `5xx` et des lectures de conversations ;
- accès répétés à plusieurs conversations par une même session, un même compte ou une même adresse réseau pseudonymisée ;
- échec d’un contrôle de participation, de famille, de relation approuvée, d’horaire ou de permission média ;
- déchiffrements inhabituels, échec d’authentification AES-GCM ou identifiant de clé inconnu ;
- création, élévation ou usage anormal d’un accès Render/PostgreSQL ;
- export, requête, volume sortant, sauvegarde ou journalisation atypique ;
- alerte Render, PostgreSQL, APNs, FCM, fournisseur Web Push ou TURN ;
- signalement d’un parent, d’un enfant, d’un chercheur, d’un prestataire ou d’une autorité ;
- perte d’appareil, compromission de compte, secret exposé ou dépendance vulnérable exploitée.

Les alertes et journaux ne doivent pas contenir le texte des messages, les noms d’enfants, les noms de fichiers média, les jetons, les mots de passe, les clés ou les charges WebRTC. Le dossier d’incident utilise des identifiants de requête, des identifiants internes pseudonymisés et des agrégats.

### 2.2 Vérification initiale — quinze premières minutes

1. Ouvrir le dossier et noter l’heure du premier signal.
2. Nommer `PI`, `SEC`, `PRIV` et `SCR`.
3. Préserver le signalement original et les identifiants de requête associés.
4. Vérifier si l’événement touche la confidentialité, l’intégrité ou la disponibilité.
5. Chercher si des données personnelles ont réellement ou vraisemblablement été compromises.
6. Distinguer fait, hypothèse et inconnue ; ne pas attribuer l’incident à un auteur sans preuve.
7. Si une violation est raisonnablement certaine, fixer `T0` sans attendre de connaître le volume final.

## 3. Qualification

### 3.1 Incident de sécurité ou violation

Il y a violation de données dès qu’une atteinte accidentelle ou illicite affecte la destruction, la perte, l’altération, la divulgation non autorisée ou l’accès non autorisé à des données personnelles. Une tentative bloquée sans compromission démontrée reste un incident de sécurité, mais sa décision et les éléments disponibles sont conservés.

Qualifier séparément :

- **confidentialité** : lecture, copie, transmission ou déchiffrement non autorisé ;
- **intégrité** : modification, ajout ou suppression non autorisé ;
- **disponibilité** : perte ou indisponibilité empêchant l’usage légitime ;
- catégories de personnes, en distinguant enfants, parents et tiers ;
- catégories de données, quantité approximative de personnes et d’enregistrements ;
- données lisibles ou rendues incompréhensibles ; une donnée chiffrée n’est protectrice que si la clé et le chemin de déchiffrement sont restés hors d’atteinte ;
- durée, étendue, destinataire probable, possibilité de copie et caractère réversible ;
- conséquences vraisemblables : détresse, humiliation, harcèlement, chantage, usurpation, contact indésirable, discrimination, perte de contrôle ou atteinte à la sécurité physique.

### 3.2 Point de départ des 72 heures

`T0` est l’instant où le responsable du traitement est raisonnablement certain qu’un incident de sécurité a compromis des données personnelles. Le scribe consigne :

- l’heure du premier signal ;
- l’heure et les faits qui rendent la violation raisonnablement certaine ;
- le décideur ayant fixé `T0` ;
- l’échéance exacte `T0 + 72 heures`, en UTC et en heure de Paris ;
- tout motif de retard si cette échéance n’est pas tenue.

Une investigation courte peut précéder `T0` lorsqu’il n’est pas encore possible d’établir une compromission, mais elle ne doit pas servir à repousser artificiellement l’échéance.

### 3.3 Évaluation du risque pour les personnes

Pour chaque conséquence plausible, coter la gravité et la probabilité de 1 à 4. La qualification retient la combinaison la plus défavorable raisonnablement étayée, pas une moyenne.

| Score | Niveau | Conséquence réglementaire minimale |
|---:|---|---|
| 1 à 4 | A priori faible | Registre interne ; absence de notification uniquement si l’analyse contextuelle conclut à l’absence de risque vraisemblable. |
| 5 à 8 | Risque | Registre et notification CNIL dans les meilleurs délais, si possible sous 72 heures. |
| 9 à 16 | Risque élevé | Registre, notification CNIL et information des personnes concernées dans les meilleurs délais, sauf exception RGPD documentée. |

Ce barème est un outil interne de triage, pas un seuil juridique automatique. Le contexte, notamment l’âge, la nature d’un message ou la possibilité de contacter l’enfant, peut imposer une qualification supérieure au score brut. Toute absence de notification exige une motivation factuelle indépendante du seul score.

Facteurs aggravants propres à Secret Clubhouse :

- personne concernée âgée de 6 à 13 ans ou autre personne vulnérable ;
- contenu de conversation, voix, image, vidéo, relation, présence ou horaire ;
- contenu intime, conflictuel, humiliant ou permettant un contact hors service ;
- exposition à un contact non approuvé, au public ou à un auteur malveillant ;
- volume, durée, impossibilité d’identifier les destinataires ou de reprendre les copies ;
- compromission d’une clé, d’un compte privilégié ou du chemin de déchiffrement Render ;
- risque cumulé pour plusieurs membres d’une même famille.

Facteurs atténuants à prouver :

- données effectivement incompréhensibles pour le destinataire et clé non compromise ;
- accès bloqué avant lecture ou copie ;
- destinataire fiable ayant confirmé la suppression sans avoir utilisé les données ;
- portée très limitée et mesures immédiates supprimant la possibilité de matérialisation.

L’âge ne réduit jamais automatiquement la gravité. Pour des messages lisibles d’enfants divulgués à un tiers non autorisé, la présomption interne est `risque élevé` tant qu’une analyse motivée ne démontre pas le contraire.

## 4. Confinement et conservation de la preuve

### 4.1 Ordre de confinement

1. Révoquer la session, le jeton, le compte ou l’accès privilégié compromis.
2. Fermer le chemin d’accès : règle serveur, route, déploiement, secret, clé ou permission.
3. Si la portée reste inconnue, désactiver temporairement la fonction exposée plutôt que laisser continuer la fuite.
4. Geler les déploiements non liés et noter la version, le commit et la configuration concernés sans recopier de secret.
5. Préserver avant rotation les éléments nécessaires à l’attribution et à la portée, sauf si ce délai accroît le dommage.
6. Faire tourner les secrets ou clés compromis, en conservant de manière sécurisée les anciennes clés nécessaires aux données encore vivantes jusqu’à migration contrôlée.
7. Vérifier les autres chemins partageant la même autorisation, le même secret ou la même dépendance.
8. Déployer la correction avec tests d’autorisation négatifs et surveillance renforcée.
9. Ne rétablir qu’après validation conjointe `PI` + `SEC`, puis surveiller une fenêtre définie.

Une compromission via le processus Render autorisé à déchiffrer n’est pas neutralisée par le seul chiffrement applicatif de PostgreSQL. Il faut alors supposer le contenu lisible jusqu’à preuve contraire.

### 4.2 Dossier de preuve minimal

Le scribe conserve dans un emplacement restreint :

- signalement original, chronologie et identifiants de requête ;
- version, commit, configuration pertinente expurgée et état des accès ;
- requêtes ou journaux minimisés établissant qui, quand, quoi et combien ;
- liste pseudonymisée des comptes et familles potentiellement concernés ;
- catégories et nombres approximatifs de personnes et d’enregistrements ;
- décisions de qualification, notification, information et rétablissement ;
- correctif, tests, résultat de déploiement et surveillance ;
- communications envoyées, destinataires, horodatage et accusés techniques ;
- export de notification CNIL et compléments éventuels ;
- empreintes SHA-256 des artefacts figés.

L’accès à la preuve est journalisé et limité. Le contenu d’un message n’est copié que s’il est strictement nécessaire pour évaluer un dommage concret ; il est alors isolé, chiffré, minimisé et assorti d’une durée de conservation.

## 5. Notification CNIL

### 5.1 Critères de décision

Notifier la CNIL lorsque la violation est susceptible d’engendrer un risque pour les droits et libertés. Ne pas notifier seulement lorsqu’elle n’est vraisemblablement pas susceptible d’engendrer un tel risque, avec justification écrite dans le registre.

La notification :

- part dans les meilleurs délais et, si possible, au plus tard à `T0 + 72 heures` ;
- peut être initiale et incomplète, puis complétée sans retard indu ;
- explique le retard si le délai est dépassé ;
- utilise le téléservice CNIL ; pendant un exercice, seul un brouillon hors téléservice est produit ;
- contient au minimum la nature de la violation, les catégories et volumes approximatifs de personnes et d’enregistrements, le point de contact, les conséquences probables et les mesures prises ou proposées.

Checklist de décision :

- [ ] violation raisonnablement certaine et `T0` fixé ;
- [ ] données personnelles concernées ;
- [ ] personnes, catégories, volumes et période estimés ;
- [ ] confidentialité, intégrité et disponibilité évaluées ;
- [ ] gravité et probabilité évaluées du point de vue de l’enfant ;
- [ ] effet du chiffrement démontré, sans supposer qu’il protège un accès applicatif autorisé ;
- [ ] décision CNIL motivée, datée et signée par `RT` ;
- [ ] notification initiale prête avant l’échéance, même si la portée reste provisoire ;
- [ ] date de complément et propriétaire fixés.

## 6. Information des familles et des enfants

### 6.1 Quand informer

Informer directement les personnes concernées dans les meilleurs délais lorsque la violation est susceptible d’engendrer un risque élevé. Pour un enfant :

- adresser une version enfant claire, brève et adaptée à son âge ;
- fournir en parallèle au parent ou co-parent autorisé les détails permettant de protéger l’enfant ;
- ne pas cacher à l’enfant l’existence de la violation, sauf décision individualisée et motivée nécessaire à sa protection ;
- offrir un canal humain et permettre à l’enfant d’être accompagné ;
- éviter de reproduire le message divulgué ou de nommer un autre enfant.

Ne pas envoyer une notification de violation aux familles non affectées. Un message général de disponibilité du service peut être publié séparément, sans laisser entendre qu’elles sont concernées.

### 6.2 Exceptions à documenter

L’information individuelle peut ne pas être requise si :

1. les données sont rendues incompréhensibles pour toute personne non autorisée, par exemple par un chiffrement approprié dont la clé et le chemin de déchiffrement n’ont pas été compromis ;
2. des mesures ultérieures garantissent que le risque élevé n’est plus susceptible de se matérialiser ;
3. l’information individuelle exigerait des efforts disproportionnés ; une communication publique ou mesure équivalente aussi efficace est alors nécessaire.

Chaque exception fait l’objet d’une décision `RT` + `PRIV` datée, factuelle et réévaluée si de nouveaux éléments apparaissent.

### 6.3 Contenu et canaux

La communication indique en termes clairs et simples :

- ce qui s’est passé et quand, sans spéculation ;
- les catégories de données concernées, sans recopier le contenu ;
- les conséquences possibles ;
- ce qui a été fait pour arrêter et réduire le risque ;
- les gestes utiles, proportionnés et non alarmistes ;
- le point de contact et la manière d’exercer ses droits ;
- la date d’une prochaine mise à jour si des éléments manquent.

Canal principal : e-mail vérifié du parent, puis avis dans l’espace parent protégé. La version enfant apparaît après authentification dans l’espace de l’enfant, avec possibilité de la relire avec un adulte. Aucun contenu privé, nom d’enfant ou détail de violation n’est placé dans une notification push ou sur écran verrouillé.

## 7. Modèles de communication neutres

Les champs entre crochets doivent être complétés avec des faits établis. Supprimer tout champ inutile.

### 7.1 Message initial au parent ou à la famille concernée

**Objet : Information de sécurité concernant votre famille Secret Clubhouse**

Bonjour,

Le [date] à [heure et fuseau], nous avons constaté qu’un accès non autorisé a concerné [catégories de données] liés à [nombre ou portée] profil(s) de votre famille, pendant la période [période]. Nous n’incluons aucun contenu privé dans ce message.

Les conséquences possibles sont [conséquences concrètes et prudentes]. À ce stade, nous avons [mesures de confinement et de protection]. [Données ou comptes non concernés, uniquement si ce fait est confirmé.]

Nous vous recommandons de [gestes utiles]. Expliquez simplement à votre enfant qu’un problème de confidentialité a eu lieu et qu’il n’en est pas responsable. Une version courte lui est proposée dans son espace.

Vous pouvez nous joindre à [contact] pour toute question ou pour exercer vos droits. Nous vous adresserons une mise à jour au plus tard le [date].

### 7.2 Message adapté à l’enfant

**Titre : Un problème de confidentialité a été arrêté**

Quelqu’un qui n’en avait pas le droit a pu voir [des messages / une autre catégorie simple] dans Secret Clubhouse. Ce n’est pas ta faute.

Nous avons arrêté l’accès et nous vérifions ce qui s’est passé. Tu peux en parler à un adulte de confiance. Si un message ou une personne t’inquiète, ne réponds pas et montre-le à ton parent.

Tu peux relire cette information avec ton parent et nous poser une question depuis la rubrique « Données et droits ».

### 7.3 Mise à jour intermédiaire

**Objet : Mise à jour de sécurité Secret Clubhouse — [référence]**

Depuis notre message du [date], nous avons confirmé [faits nouveaux]. La portée connue est désormais [catégories, période et volumes]. Nous avons ajouté les mesures suivantes : [mesures].

Les recommandations précédentes [restent valables / sont remplacées par : …]. Notre prochaine mise à jour est prévue le [date], ou plus tôt si un élément important est confirmé.

### 7.4 Clôture destinée aux personnes concernées

**Objet : Clôture de l’incident de sécurité Secret Clubhouse — [référence]**

Notre investigation est terminée. Elle confirme [nature et portée, sans contenu privé]. Nous avons corrigé [cause décrite sans détail exploitable] et vérifié [contrôles]. Les mesures durables sont [mesures].

Si vous observez [signaux utiles], contactez-nous à [contact]. Vos droits et notre canal de réponse restent disponibles dans « Données et droits ».

### 7.5 Trame de notification CNIL

> **Brouillon — ne jamais envoyer dans le cadre d’un exercice**

- Responsable du traitement et point de contact : [identité et coordonnées].
- `T0` et échéance des 72 heures : [horodatages et fuseaux].
- Nature : [confidentialité, intégrité, disponibilité ; cause confirmée/provisoire].
- Personnes : [catégories et nombres approximatifs].
- Enregistrements : [catégories, période et nombres approximatifs].
- Conséquences probables : [gravité et probabilité].
- Mesures prises : [confinement, éradication, rétablissement, atténuation].
- Information des personnes : [date, canaux, catégories destinataires ou justification].
- Informations encore inconnues et date du complément : [éléments].
- Motif du retard, si applicable : [motif].

## 8. Rétablissement et retour d’expérience

Le rétablissement exige :

- cause ou chemin d’exposition neutralisé ;
- tests positifs et négatifs des autorisations, y compris séparation entre familles ;
- sessions, accès et secrets compromis révoqués ;
- portée réévaluée après confinement ;
- absence de nouvel accès anormal pendant la fenêtre de surveillance décidée ;
- notification et information décidées, préparées et tracées ;
- propriétaire, échéance et preuve pour chaque correction.

Dans les cinq jours ouvrés, produire un compte rendu sans données personnelles : détection, chronologie, décision, effets, ce qui a fonctionné, défauts, causes, corrections, dates, propriétaires et preuves. Mettre à jour l’AIPD, les tests, la procédure et le registre si nécessaire.

## 9. Références officielles

- [RGPD, articles 33 et 34 — CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4)
- [Violations de données personnelles : les règles à suivre — CNIL](https://www.cnil.fr/fr/violations-de-donnees-personnelles-les-regles-suivre)
- [Sécurité : gérer les incidents et les violations — CNIL](https://www.cnil.fr/fr/securite-gerer-les-incidents-et-les-violations)
- [Information et transparence, notamment envers les enfants — CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence)
- [Lignes directrices WP250 rév.01 sur les violations — G29, reprises par le CEPD](https://www.cnil.fr/sites/cnil/files/atoms/files/wp250rev01_fr.pdf)
