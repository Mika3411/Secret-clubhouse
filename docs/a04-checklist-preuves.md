# A04 — Checklist de preuves

**GABARIT VIERGE — ce document n’est ni une preuve ni un exercice réalisé.**<br>
**Statut initial : A04 ouverte. Ne cocher qu’après observation réelle et pièce archivée.**

Cette checklist accompagne `docs/a04-procedure-gestion-acces-et-cles.md`. Les pièces originales sont conservées dans un coffre restreint hors de ce dépôt public. Aucune valeur secrète, code MFA, code de récupération, adresse privée, jeton, endpoint push ou donnée d’enfant n’est inscrit ici.

## A. Identification de la revue

| Champ | Valeur à renseigner |
|---|---|
| Référence | `A04-AAAA-TNN` |
| Type | `revue / rotation / récupération / révocation / incident / changement matériel` |
| Début et fin | `[date, heure, fuseau]` |
| Environnement | `[production / préproduction représentative]` |
| Commit et version | `[SHA et version]` |
| Exécutant nominatif | `[nom et fonction]` |
| Relecteur, si désigné | `[nom et fonction / non applicable]` |
| Approbateur | `[nom et fonction]` |
| Coffre de preuves | `[référence restreinte]` |
| Données utilisées | `☐ uniquement canaris synthétiques  ☐ autre, justification` |

## B. Accès privilégiés et authentification

Pour chaque fournisseur actif, joindre une liste datée des membres et rôles ainsi qu’une preuve expurgée de l’authentification adaptée au risque. Pour un service désactivé, joindre seulement la preuve technique de désactivation et inscrire `N/A`.

| Fournisseur | Actif ? | Liste nominative | Rôles justifiés | Authentification adaptée | Pièce | Résultat |
|---|---:|---:|---:|---:|---|---|
| Render | `[oui/non]` | ☐/N/A | ☐/N/A | ☐/N/A | `[ID]` | `[PASS/FAIL/N/A]` |
| GitHub | `[oui/non]` | ☐/N/A | ☐/N/A | ☐/N/A | `[ID]` | `[PASS/FAIL/N/A]` |
| Cloudflare | `[oui/non]` | ☐/N/A | ☐/N/A | ☐/N/A | `[ID]` | `[PASS/FAIL/N/A]` |
| Firebase / Google Cloud | `[oui/non]` | ☐/N/A | ☐/N/A | ☐/N/A | `[ID]` | `[PASS/FAIL/N/A]` |
| Apple Developer / App Store Connect | `[oui/non]` | ☐/N/A | ☐/N/A | ☐/N/A | `[ID]` | `[PASS/FAIL/N/A]` |
| Coffre de secrets / sauvegardes | `[oui/non]` | ☐/N/A | ☐/N/A | ☐/N/A | `[ID]` | `[PASS/FAIL/N/A]` |

Contrôles :

- [ ] aucun compte humain partagé ;
- [ ] chaque compte possède un propriétaire et une fonction ;
- [ ] un moyen de récupération proportionné existe pour les comptes critiques, sans exposer ses secrets dans les preuves ;
- [ ] aucun ancien membre ou invité en attente injustifié ;
- [ ] les sessions et applications tierces ont été revues.

## C. Moindre privilège

- [ ] Render : seuls les administrateurs nécessaires voient les membres, secrets, connexions et Shell ;
- [ ] Render : production protégée et Cron limité à ses variables nécessaires ;
- [ ] GitHub : propriétaire, administrateurs, collaborateurs, deploy keys, Apps, PAT et clés SSH revus ;
- [ ] GitHub : `main` protégée et contrôles CI obligatoires ;
- [ ] GitHub Actions : permission par défaut en lecture seule confirmée ;
- [ ] Cloudflare : super-administrateurs minimaux et jeton TURN limité au produit/compte requis ;
- [ ] Firebase : rôles de base Owner/Editor supprimés lorsqu’ils ne sont pas indispensables ;
- [ ] FCM : compte de service limité à l’envoi nécessaire ;
- [ ] Apple : `Account Holder` unique, rôles Admin/App Manager/Developer justifiés ;
- [ ] accès au coffre et aux sauvegardes revus séparément ;
- [ ] toute exception possède propriétaire, motif et date d’expiration.

| Écart | Risque | Responsable | Échéance | Pièce de fermeture |
|---|---|---|---|---|
| `[à renseigner]` | `[à renseigner]` | `[nom]` | `[date]` | `[ID]` |

## D. Séparation des secrets

- [ ] valeurs différentes entre développement, préproduction et production ;
- [ ] `CONTENT_ENCRYPTION_KEY` distincte de `JWT_SECRET` ;
- [ ] clés VAPID distinctes de FCM, APNs, TURN et du canal RGPD ;
- [ ] aucune clé privée VAPID de production dans PostgreSQL ;
- [ ] une seule variante FCM configurée : brute ou base64 ;
- [ ] une seule variante APNs configurée : brute ou base64 ;
- [ ] aucun secret dans GitHub, le code, l’historique, l’APK, l’IPA, les logs, tickets ou captures ;
- [ ] analyse automatique des secrets exécutée sur le dépôt et l’historique ;
- [ ] coffre, journaux d’accès et sauvegarde du coffre vérifiés ;
- [ ] détenteurs du canal transitoire `PRIVACY_ADMIN_TOKEN` identifiés ;
- [ ] remplacement du canal partagé par une administration nominative planifié ou réalisé.

| Secret | Emplacement attendu confirmé | Identifiant/version non secret | Dernière rotation | Prochaine échéance | Pièce |
|---|---:|---|---|---|---|
| Contenu actif | ☐ | `[key id]` | `[date]` | `[date]` | `[ID]` |
| Anciennes clés de contenu | ☐ | `[nombre uniquement]` | `[date]` | `[retrait prévu]` | `[ID]` |
| HMAC de limitation (`JWT_SECRET`) | ☐ | `[version interne]` | `[date]` | `[date]` | `[ID]` |
| VAPID | ☐ | `[key id/public fingerprint]` | `[date]` | `[date]` | `[ID]` |
| FCM | ☐ | `[private_key_id]` | `[date]` | `[date]` | `[ID]` |
| APNs | ☐ | `[APNS_KEY_ID]` | `[date]` | `[date]` | `[ID]` |
| TURN | ☐ | `[token id]` | `[date]` | `[date]` | `[ID]` |
| Canal RGPD | ☐ | `[version interne]` | `[date]` | `[date]` | `[ID]` |

## E. Exercice réel de rotation et récupération

### E1. Clé de contenu

- [ ] sauvegarde ou clone réellement créé avant rotation ;
- [ ] canaris synthétiques écrits sous l’ancienne clé ;
- [ ] ancienne clé ajoutée au trousseau avant activation de la nouvelle ;
- [ ] nouvelle clé activée sans l’afficher dans la preuve ;
- [ ] migration de démarrage terminée avant disponibilité ;
- [ ] second passage après déploiement roulant vérifié ;
- [ ] message, média et signal synthétiques lus puis écrits ;
- [ ] comptes PostgreSQL par identifiant de clé archivés ;
- [ ] sauvegarde restaurée dans un environnement isolé ;
- [ ] canaris de la sauvegarde déchiffrés avec l’ancienne clé ;
- [ ] canaris rechiffrés avec la clé active ;
- [ ] absence volontaire d’une ancienne clé testée sur une copie jetable et échec fermé observé ;
- [ ] ancienne clé maintenue jusqu’à expiration des sauvegardes éligibles ;
- [ ] copie d’exercice détruite et destruction prouvée.

| Mesure | Attendu | Observé | Pièce | Résultat |
|---|---|---|---|---|
| Disponibilité avant/après | Conforme au budget | `[mesure]` | `[ID]` | `[PASS/FAIL]` |
| Lignes sous ancienne clé après migration | `0` pour les lignes vivantes | `[nombre]` | `[ID]` | `[PASS/FAIL]` |
| Restauration canari message | Lisible | `[oui/non]` | `[ID]` | `[PASS/FAIL]` |
| Restauration canari média | Intègre | `[oui/non]` | `[ID]` | `[PASS/FAIL]` |
| Restauration canari WebRTC | Intègre | `[oui/non]` | `[ID]` | `[PASS/FAIL]` |
| Démarrage sans ancienne clé requise | Refus avant écoute | `[observé]` | `[ID]` | `[PASS/FAIL]` |

### E2. `JWT_SECRET`

- [ ] protection temporaire contre le contournement des compteurs prévue ;
- [ ] rotation réelle effectuée ;
- [ ] sessions web et natives existantes toujours valides comme attendu ;
- [ ] limitation d’identité et d’IP testée par requêtes HTTP ;
- [ ] échecs et `Retry-After` observés ;
- [ ] ancienne valeur détruite après la fenêtre de retour arrière ;
- [ ] aucune valeur dans les journaux.

### E3. VAPID

À remplir seulement si Web Push est activé ; sinon joindre la preuve de désactivation et inscrire `N/A`.

- [ ] repli PostgreSQL de production supprimé ;
- [ ] identifiant de paire enregistré par souscription ;
- [ ] ancienne et nouvelle paires servies pendant la transition ;
- [ ] ancienne souscription reçoit une notification réelle avec l’ancienne paire ;
- [ ] nouvelle souscription reçoit une notification réelle avec la nouvelle paire ;
- [ ] client réabonné après changement de clé ;
- [ ] ancienne paire retirée après disparition/expiration des souscriptions correspondantes ;
- [ ] échecs 4xx du service Push surveillés ;
- [ ] toute condition applicable manquante est consignée comme écart ; un défaut critique ou élevé non traité maintient `A04` ouverte.

### E4. FCM et APNs

Remplir séparément chaque canal réellement activé. Un canal désactivé est `N/A` avec preuve technique ; il n’a pas à être activé pour cet exercice.

- [ ] nouvelle clé FCM créée et déployée ;
- [ ] notification FCM générique reçue sur un appareil Android de test ;
- [ ] ancienne clé FCM refusée après désactivation/suppression ;
- [ ] nouvelle clé APNs créée et déployée ;
- [ ] alerte APNs générique reçue sur un appareil iOS de test ;
- [ ] appel PushKit de test reçu sans donnée personnelle ;
- [ ] ancienne clé APNs révoquée après la fenêtre de retour arrière ;
- [ ] ancienne clé APNs refusée après révocation ;
- [ ] jetons d’appareil absents des captures et journaux de preuve.

## F. Exercice réel de révocation

L’exercice porte sur un accès ou jeton représentatif réellement actif. Il n’exige pas de créer puis révoquer un compte sur chaque fournisseur.

| Étape | Heure | Pièce | Résultat |
|---|---|---|---|
| Accès ou jeton représentatif sélectionné | `[heure]` | `[ID]` | `[PASS/FAIL]` |
| Rôle minimal attribué | `[heure]` | `[ID]` | `[PASS/FAIL]` |
| Action bénigne autorisée réalisée | `[heure]` | `[ID]` | `[PASS/FAIL]` |
| Accès ou jeton retiré du fournisseur concerné | `[heure]` | `[ID]` | `[PASS/FAIL]` |
| Sessions, clés et applications personnelles révoquées | `[heure]` | `[ID]` | `[PASS/FAIL]` |
| Nouvelle tentative privilégiée refusée | `[heure]` | `[ID]` | `[PASS/FAIL]` |
| Secrets visibles par l’ancien rôle inventoriés/rotés | `[heure]` | `[ID]` | `[PASS/FAIL]` |
| Journaux d’audit exportés | `[heure]` | `[ID]` | `[PASS/FAIL]` |

## G. Revue périodique fondée sur le risque

- [ ] revue précédente retrouvée et comparée ;
- [ ] exports/captures datés de la période examinée ;
- [ ] toutes les entrées et sorties expliquées ;
- [ ] comptes inactifs supprimés ;
- [ ] rôles excessifs réduits ;
- [ ] clés arrivant à échéance planifiées ;
- [ ] journaux d’audit disponibles pour Render, GitHub, Cloudflare, Google et Apple selon le plan retenu ;
- [ ] écarts ouverts suivis avec responsable et date ;
- [ ] prochaine revue planifiée selon le risque, les changements et les incidents.

| Motif de revue | Date réalisée | Exécutant | Relecteur éventuel | Pièce | Résultat |
|---|---|---|---|---|---|
| Avant production / changement / incident / échéance interne | `[date]` | `[nom]` | `[nom / N/A]` | `[ID]` | `[PASS/FAIL]` |

## H. Décision A04

| Condition | État |
|---|---|
| Accès privilégiés nominatifs pour les services actifs | `[PASS/FAIL/N/A motivé]` |
| Authentification adaptée au risque pour ces accès | `[PASS/FAIL/N/A motivé]` |
| Moindre privilège démontré | `[PASS/FAIL]` |
| Séparation des secrets démontrée | `[PASS/FAIL]` |
| Rotation/remplacement et récupération des secrets actifs testés | `[PASS/FAIL/N/A motivé]` |
| Révocation d’un accès ou jeton représentatif testée | `[PASS/FAIL]` |
| Services inactifs prouvés désactivés | `[PASS/FAIL/N/A]` |
| Revue datée et décision assumée | `[PASS/FAIL]` |
| Aucun écart critique ou élevé non traité | `[PASS/FAIL]` |

**Décision :** `☐ maintenir A04 ouverte` `☐ proposer la clôture`

**Motif :** `[à renseigner]`

**Exécutant :** `[nom, date, signature]`<br>
**Relecteur, si désigné :** `[nom, date, signature / N/A]`<br>
**Responsable du traitement :** `[nom, décision, date, signature]`

La proposition de clôture est interdite si une condition applicable est `FAIL`, non renseignée ou fondée uniquement sur un gabarit. `N/A` exige une preuve de désactivation ou une motivation liée au périmètre. Les tests automatisés peuvent contribuer à la preuve, mais ne remplacent pas l’observation des accès et configurations réels.
