# Déblocage minimal de la production

**Périmètre préparé :** web/API/PostgreSQL uniquement<br>
**Fonctions exclues :** WebRTC, Web Push, FCM, APNs, canal RGPD à jeton partagé et distribution APK/AAB/IPA<br>
**État :** préparation technique terminée dans le dépôt ; aucune autorisation de production

Ce document ne contient aucune preuve privée et ne doit recevoir ni contrat, ni capture de compte, ni secret. Les pièces restent dans un coffre privé ; Git conserve seulement leur référence opaque, leur date et leur conclusion.

## 1. A02 — une décision personnelle

Mickael Thorez doit choisir et signer l’une des deux voies prévues dans `docs/a02-protocole-consultation.md` :

- consultation adaptée avec compte rendu anonymisé ; ou
- décision circonstanciée expliquant pourquoi une consultation directe n’est pas appropriée, avec les sources alternatives réellement examinées.

Le choix et la signature ne peuvent pas être automatisés.

## 2. A03 — un seul fournisseur actif à qualifier

Pour le périmètre minimal, D2 à D5 seront fermés par la preuve Render des trois drapeaux désactivés. Le seul dossier contractuel actif restant est D1 Render.

Références privées exactes à fournir pour D1 :

1. référence du compte/workspace et identité du titulaire ;
2. référence, version et date d’acceptation du DPA réellement applicable ;
3. service web, PostgreSQL et Cron réels, avec région Frankfurt ;
4. plan PostgreSQL et durée réelle des sauvegardes ;
5. liste Render des sous-traitants ultérieurs applicable à la date de décision ;
6. possibilité d’accès support, pays concernés et durée des journaux/support ;
7. mécanisme de transfert applicable à l’entité et au service — DPF valide ou CCT avec AITD ;
8. décision datée « activer Render pour le périmètre web restreint ».

Les fichiers originaux, captures et contrats restent hors Git.

## 3. A04 — accès et clés réellement actifs

Pièces privées minimales :

1. liste nominative des comptes privilégiés Render et GitHub, rôle et nécessité ;
2. état de l’authentification adaptée au risque, sans enregistrer le facteur ou les codes ;
3. confirmation du moindre privilège et absence de compte partagé ;
4. référence privée de la sauvegarde/récupération de `CONTENT_ENCRYPTION_KEY` et `JWT_SECRET`, jamais leurs valeurs ;
5. résultat d’un essai représentatif de récupération/rotation des clés sur données synthétiques ;
6. résultat de révocation d’un accès ou jeton temporaire représentatif.

Cloudflare, VAPID, Firebase, Apple et `PRIVACY_ADMIN_TOKEN` sont `N/A` seulement après vérification des drapeaux fermés sur Render réel.

## 4. A08 — déploiement réel

La checklist `docs/a08-checklist-configuration-production-2026-07-23.md` doit constater :

- service, PostgreSQL et Cron réellement à Frankfurt ;
- déploiement réussi de la version évaluée ;
- transport PostgreSQL privé ;
- session mesurée à 12 heures ;
- chiffrement applicatif et démarrage fermé ;
- quatre drapeaux sensibles à `false` et routes correspondantes refusées ;
- absence de distribution du fichier de débogage ;
- purge Cron réussie ;
- restauration isolée réussie avec rejeu des tombstones ;
- journaux et détection d’incident documentés sans secret.

## 5. Dernière décision

Après fermeture de A02, A03, A04 et A08 :

1. recalculer R01 à R10 à partir de la version réellement servie ;
2. si un risque élevé subsiste, consulter la CNIL avant le traitement concerné ;
3. seulement en l’absence de preuve manquante et de risque élevé non traité, présenter la décision A01 à Mickael Thorez pour date et signature.
