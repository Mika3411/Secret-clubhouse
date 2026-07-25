# Registre simplifié des sous-traitants et transferts

Version regroupée mise à jour le 25 juillet 2026 — responsable du suivi : Mickael Thorez.

Ce registre couvre les cinq familles de fournisseurs utilisées ou prévues par Secret Clubhouse. Il complète l’AIPD, le registre des bases légales et la politique de conservation.

## 1. Statut de l’action A03

**A03 reste ouverte.**

L’audit public est terminé, mais les preuves privées d’acceptation des contrats, de configuration des comptes et de décision sur les transferts ne sont pas encore vérifiées. Les anciennes 56 micro-preuves et 11 fiches séparées sont remplacées par **cinq dossiers de preuve** :

| Dossier | Périmètre | Statut |
|---|---|---|
| D1 | Render et Render Postgres | Ouvert |
| D2 | Cloudflare STUN/TURN | Activation prototype contrôlée ; dossier privé et validation finale requis |
| D3 | Web Push selon le navigateur | Activation prototype contrôlée ; matrice fournisseurs à compléter |
| D4 | Firebase Cloud Messaging Android | Activation prototype contrôlée ; dossier privé et test réel requis |
| D5 | Apple APNs et PushKit | Activation prototype contrôlée ; dossier privé et test réel requis |

Ce regroupement simplifie la preuve sans supprimer les obligations. Un dossier peut être fermé soit avec les garanties nécessaires, soit avec une décision vérifiable de désactiver le flux concerné en production.

Pour tout fournisseur actif agissant comme sous-traitant, le contrat applicable doit satisfaire aux exigences de l’article 28 du RGPD.

Le Blueprint du 24 juillet 2026 prépare `RTC_ENABLED=true`, `WEB_PUSH_ENABLED=true` et `NATIVE_PUSH_ENABLED=true`, avec les secrets TURN, VAPID, FCM et APNs conservés exclusivement dans Render. Le serveur échoue fermé si le relais TURN, la paire VAPID ou la configuration native requise manque ou est incomplète. Ces activations sont limitées aux essais contrôlés du prototype sans enfant réel : D2 à D5, A03, A04, A07 et A08 restent ouverts jusqu’aux preuves privées, aux tests réels, à l’évaluation de sécurité du périmètre actif et à la validation finale.

## 2. Preuve minimale commune

Chaque dossier privé contient un seul index daté regroupant :

1. **Compte et contrat** — titulaire, service utilisé, contrat/DPA applicable, version et date d’acceptation.
2. **Configuration réelle** — produit activé, région ou réseau, sauvegardes, support et durée pertinente.
3. **Chaîne de traitement** — données, finalité, rôle RGPD, sous-traitants ultérieurs et pays connus.
4. **Transfert et décision** — DPF lorsqu’il couvre réellement l’entité et le service, ou CCT et analyse d’impact du transfert (AITD) lorsque nécessaire ; conclusion « activer », « limiter » ou « désactiver ».
5. **Suivi** — responsable, emplacement privé et modalité documentée de surveillance des changements pertinents.

Les contrats, captures, justificatifs d’identité, tickets et décisions signées sont conservés dans un dossier privé chiffré. Git ne contient ni secret, ni jeton, ni point de terminaison Push complet, ni capture sensible.

## 3. Cartographie consolidée

| Dossier | Rôle et données | Cadre public connu | Point restant à prouver | Décision actuelle |
|---|---|---|---|---|
| D1 — Render Services, Inc. | Sous-traitant pour l’hébergement de l’application, PostgreSQL, sauvegardes et journaux. Données familiales, contenus applicativement chiffrés et métadonnées | [DPA Render](https://render.com/dpa), CCT intégrées et DPF lorsqu’applicable. Le Blueprint cible Francfort, mais les opérations et sous-traitants peuvent impliquer les États-Unis | DPA réellement applicable au compte, titulaire, région réelle du service/de la base/du Cron, plan de sauvegarde, accès support et fiche DPF datée | **Ouvert. Hébergement non validé** |
| D2 — Cloudflare | TURN agit comme sous-traitant réseau. STUN/TURN voit notamment IP, ports, horaires et volumes ; le média WebRTC reste chiffré | [DPA Cloudflare](https://www.cloudflare.com/cloudflare-customer-dpa/), CCT intégrées, accord Self-Serve incorporant le DPA et revue publique datée dans `docs/d2-cloudflare-turn-review-2026-07-24.md` | Preuve privée du compte et de la date contractuelle, liste des sous-traitants archivée, durées Realtime, accès support, décision de transfert et validation humaine | **Activation prototype contrôlée ; dossier ouvert** |
| D3 — Web Push | Service Push imposé par le navigateur ; endpoint, IP, horaires, taille et charge générique minimisée | Standards Web Push, keyring VAPID versionné dans Render et revue technique `docs/d3-web-push-review-2026-07-24.md` | Rotation/réception réelle et matrice des navigateurs supportés, fournisseurs observés, contrats, pays, transferts et rétention | **Activation prototype contrôlée ; dossier ouvert** |
| D4 — Firebase/FCM | Google traite le jeton FCM, l’installation ID, le package et des métadonnées pour remettre les notifications Android | [Conditions de traitement Firebase](https://firebase.google.com/terms/data-processing-terms), CCT et DPF lorsqu’applicables ; revue technique datée dans `docs/d4-d5-native-push-review-2026-07-24.md` | Compte, conditions applicables, sous-traitants, suppression réelle d’un jeton et d’une installation, pays, transfert et essai sur appareil verrouillé | **Activation prototype contrôlée ; dossier ouvert** |
| D5 — Apple Push Notification service (APNs)/PushKit | Apple reçoit jetons, topics, identifiants opaques et métadonnées techniques pour alertes et appels iOS | [Apple Developer Program License Agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) et annexe APNs ; revue technique datée dans `docs/d4-d5-native-push-review-2026-07-24.md` | Accord applicable, rôle, pays, rétention, sous-traitants, transfert et essais APNs/PushKit sur appareil verrouillé | **Activation prototype contrôlée ; dossier ouvert** |

## 4. Dossier D1 — Render

Pièces regroupées attendues :

- PDF du DPA accessible depuis le Document Center et preuve du compte auquel il s’applique ;
- capture expurgée du titulaire du workspace ;
- captures datées du service web, de PostgreSQL et du Cron montrant leur région réelle ;
- plan PostgreSQL, fenêtre de sauvegarde et procédure de restauration ;
- liste datée des sous-traitants Render et moyen documenté de détecter leurs changements ;
- fiche DPF Render datée et vérification du périmètre non-RH ;
- décision consolidée couvrant hébergement, support, sauvegardes et fin de contrat.

Le réglage `region: frankfurt` de `render.yaml` ne prouve pas la région d’une ressource existante. A08 a observé des ressources encore en Oregon ; D1 ne peut donc pas être fermé sur le seul Blueprint.

## 5. Dossier D2 — Cloudflare STUN/TURN

La revue publique et technique du 24 juillet 2026 est consignée dans `docs/d2-cloudflare-turn-review-2026-07-24.md`. Elle confirme le rôle de sous-traitant prévu par l’accord Self-Serve et le DPA, les CCT, les données techniques annoncées par Realtime TURN et les mesures de minimisation du prototype. Le responsable a confirmé séparément la création de l’application TURN et le stockage des deux secrets dans Render, sans les communiquer.

Pièces regroupées attendues :

- compte, plan et produit Realtime utilisés ;
- DPA applicable au compte et liste datée des sous-traitants ;
- conditions fournisseur, documentation ou réponse écrite suffisamment fiable pour établir si `stun:stun.cloudflare.com:3478` est couvert ;
- pays, durées des métriques et journaux, accès support et suppression ;
- fiche DPF Cloudflare datée ou CCT/AITD applicable ;
- décision unique distinguant TURN contractuel et STUN public.

L’activation actuelle reste limitée aux essais contrôlés sans enfant réel. Avant une production réelle, les pièces privées ci-dessus et la décision de transfert doivent être achevées ; sinon les appels doivent être désactivés.

## 6. Dossier D3 — Web Push

La revue technique du 24 juillet 2026 est consignée dans `docs/d3-web-push-review-2026-07-24.md`. Le responsable a confirmé la paire VAPID dans Render et l’activation du drapeau, sans communiquer la clé privée. Le 25 juillet, le dépôt ajoute l’identification des paires par souscription, la conservation transitoire des anciennes paires et le réabonnement automatique. Ces preuves préparent les essais mais ne ferment pas D3.

Une seule matrice remplace les anciennes fiches par route :

| Navigateur/OS | Service Push attendu | Preuve à conserver | Décision |
|---|---|---|---|
| Chrome | FCM | Documentation, endpoint observé sous forme expurgée, rôle et transfert | À décider |
| Edge Windows | WNS ou service intégré | Documentation et route réellement observée | À décider |
| Firefox | Mozilla Autopush | Documentation, pays, rétention et instrument applicable | À décider |
| Safari/web app Apple | Apple Push | Documentation, pays, rétention et instrument applicable | À décider |

La matrice doit indiquer les versions effectivement supportées. Toute combinaison non documentée est désactivée. Le consentement de l’utilisateur et le chiffrement Web Push ne remplacent pas l’analyse du fournisseur.

## 7. Dossier D4 — Firebase/FCM

La revue technique du 24 juillet 2026 est consignée dans `docs/d4-d5-native-push-review-2026-07-24.md`. Le responsable a montré les noms de variables FCM/APNs masquées dans Render et confirmé l’activation du drapeau natif, sans communiquer aucun secret. Le fichier Firebase client local correspond au package attendu et reste hors Git. Ces éléments permettent les essais contrôlés mais ne ferment pas D4.

Pièces regroupées attendues :

- projet Firebase expurgé, titulaire et entité contractante ;
- conditions Firebase applicables et date d’acceptation ;
- liste datée des sous-traitants ;
- fiche DPF Google LLC datée, ou CCT et AITD applicables ;
- test de suppression d’un jeton FCM et d’un Firebase installation ID ;
- décision consolidée sur les notifications Android.

## 8. Dossier D5 — Apple APNs et PushKit

La même revue consigne la présence expurgée des variables APNs attendues et l’activation contrôlée. Elle ne prouve ni la validité des identifiants, ni une livraison APNs/PushKit réelle, ni l’accord applicable au compte Apple ; D5 reste ouvert.

Pièces regroupées attendues :

- compte Apple Developer expurgé et statut actif ;
- accord accepté téléchargé depuis Membership ou App Store Connect ;
- qualification documentée du rôle d’Apple pour APNs et PushKit, appuyée par les conditions applicables ou, si elles ne permettent pas de conclure, par une réponse Apple ou un avis juridique ;
- pays, rétention, diagnostics, support et sous-traitants connus ;
- mécanisme de transfert applicable ;
- décision consolidée couvrant alertes APNs et appels PushKit.

Une politique de confidentialité Apple ou l’accord public non rattaché au compte ne suffit pas à prouver l’accord réellement applicable.

## 9. Décisions de transfert regroupées

| Dossier | Flux couverts | Mesures existantes | Risque et condition de fermeture |
|---|---|---|---|
| D1 | Application, PostgreSQL, journaux, sauvegardes et support Render | Francfort demandé, réseau privé, TLS, chiffrement applicatif des contenus, hachage des mots de passe et sessions | Risque élevé tant que région, compte, support et mécanisme ne sont pas prouvés |
| D2 | STUN et TURN WebRTC | DTLS-SRTP pour le média, identifiants TURN courts générés côté Render, signalisation applicativement chiffrée, aucune identité applicative envoyée au relais | Activation limitée aux essais du prototype ; production réelle interdite tant que le dossier privé et la décision de transfert ne sont pas validés |
| D3 | Web Push Chrome, Edge, Firefox et Safari | Texte générique, TTL court, consentement conjoint révocable, aucune identité ou contenu de message dans la charge | Activation limitée aux essais ; décision obligatoire par navigateur et désactivation si le cadre ne peut pas être démontré |
| D4 | FCM Android natif | HTTPS, payload générique, jetons opaques et suppression des jetons invalides | Activation limitée aux essais ; acceptation conditionnée au compte, aux conditions, au transfert, au test de suppression et à la livraison réelle |
| D5 | APNs et PushKit iOS | TLS/HTTP2, payload générique, TTL court ou nul pour les appels | Activation limitée aux essais ; risque juridique élevé tant que rôle, transfert et fonctionnement réel ne sont pas qualifiés |

Une décision d’adéquation DPF effectivement applicable dispense d’AITD fondée sur l’article 46 pour le transfert couvert. Si le DPF ne couvre pas l’entité, le service ou cesse de s’appliquer, les CCT et l’analyse complémentaire requise doivent être documentées.

## 10. Recontrôles

| Contrôle | Échéance maximale |
|---|---|
| Microsoft DPF pour WNS | 5 septembre 2026 |
| Google DPF pour FCM/Web Push | 13 septembre 2026 |
| Cloudflare DPF pour Realtime | 23 septembre 2026 |
| Render DPF | 12 octobre 2026 |

Ces dates sont des échéances de recontrôle, pas des dates de conformité automatique.

## 11. Clôture de A03

| Dossier | Condition de fermeture | État |
|---|---|---|
| D1 | Index privé complet et décision Render datée | Ouvert |
| D2 | Index privé complet et décision de transfert pour l’activation RTC ; à défaut `RTC_ENABLED=false` réellement déployé | Activation prototype contrôlée ; ouvert |
| D3 | Matrice signée pour les navigateurs activés ; à défaut `WEB_PUSH_ENABLED=false` réellement déployé | Activation prototype contrôlée ; ouvert |
| D4 | Index privé complet et essais FCM Android réussis ; à défaut `NATIVE_PUSH_ENABLED=false` réellement déployé sans FCM | Activation prototype contrôlée ; ouvert |
| D5 | Index privé complet et essais APNs/PushKit réussis ; à défaut `NATIVE_PUSH_ENABLED=false` réellement déployé sans distribution iOS | Activation prototype contrôlée ; ouvert |

A03 est clôturable uniquement lorsque les cinq dossiers sont fermés, ou lorsque les fonctions correspondant à un dossier non validé sont techniquement désactivées en production et que cette limitation est prouvée. Chaque décision porte une date, identifie son auteur et prévoit une surveillance des changements proportionnée au risque.
