# Revue d’activation FCM et APNs — 24 juillet 2026

## Périmètre observé

Cette revue consigne l’activation contrôlée des notifications natives Android et iOS du prototype Secret Clubhouse.

Le responsable a montré une vue expurgée de la configuration Render contenant les noms de variables suivants, sans communiquer leurs valeurs :

- `FCM_SERVICE_ACCOUNT_JSON_BASE64` ;
- `APNS_TEAM_ID` ;
- `APNS_KEY_ID` ;
- `APNS_PRIVATE_KEY_BASE64` ;
- `APNS_BUNDLE_ID` ;
- `APNS_ENVIRONMENT` ;
- `APNS_VOIP_TOPIC`.

Il a ensuite confirmé `NATIVE_PUSH_ENABLED=true` et le redéploiement. Le fichier Firebase client local correspond au package Android `fr.secretclubhouse.app` et reste exclu de Git. Le compte de service FCM et la clé privée APNs restent exclusivement dans les secrets Render et ne sont jamais intégrés à l’APK, à l’IPA ou au dépôt.

## Garde-fous techniques

- Le démarrage de production échoue si le drapeau natif est actif sans configuration FCM ou APNs complète.
- Une configuration fournisseur partielle ou illisible fait également échouer le démarrage.
- Les charges utilisent seulement des libellés génériques et des identifiants opaques de routage.
- Les jetons ne sont enregistrés qu’après le consentement serveur requis, conjoint pour un enfant de moins de 15 ans.
- Les jetons expirent après 180 jours et les jetons invalidés par le fournisseur sont désactivés ou supprimés.
- Les actions d’appel natives utilisent un jeton court, limité à l’origine HTTPS Secret Clubhouse et au chemin `/api/native/calls/`.

## Limites de la preuve

La présence des variables masquées et un démarrage sain ne prouvent pas :

- une livraison FCM réelle vers un appareil Android verrouillé ;
- une livraison APNs et PushKit réelle vers un iPhone verrouillé ;
- l’acceptation et l’applicabilité des contrats Google et Apple au compte utilisé ;
- les pays, sous-traitants, durées et mécanismes de transfert applicables ;
- la rotation, la récupération et la révocation réelles des identifiants fournisseur ;
- la distribution d’un APK/AAB ou d’une IPA signé de production.

L’activation reste donc limitée à des essais contrôlés sans donnée ni compte d’enfant réel. Les dossiers `D4` et `D5`, ainsi que les actions `A03`, `A04`, `A07` et `A08`, restent ouverts.

## Prochaine preuve attendue

Conserver hors Git un relevé daté et expurgé comprenant :

1. les journaux Render confirmant `FCM actif, APNs actif` pour le SHA réellement servi ;
2. un envoi et une suppression de jeton réussis sur un appareil Android de test ;
3. un envoi d’alerte et un appel PushKit réussis sur un iPhone de test ;
4. les pièces contractuelles et décisions de transfert des dossiers D4 et D5 ;
5. un exercice de rotation ou révocation représentatif des identifiants FCM et APNs.
