# Registre des bases légales — Secret Clubhouse

Version du 23 juillet 2026.

Ce registre complète la politique de confidentialité publique. Une finalité ne change pas de base légale selon qu’un utilisateur a coché ou non une case : la base est déterminée avant le traitement et réévaluée si la finalité, les données ou les garanties changent.

| Identifiant | Personnes | Finalité | Base légale |
| --- | --- | --- | --- |
| `parent-account-contract` | Parents et co-parents | Créer le compte adulte, administrer la famille et fournir les fonctions demandées | Exécution du contrat, article 6 § 1 b) |
| `child-family-service` | Enfants de 6 à 13 ans | Créer un profil privé et appliquer les protections familiales | Intérêt légitime, article 6 § 1 f) |
| `adult-communications-contract` | Parents et co-parents | Acheminer les communications et parties demandées par l’adulte | Exécution du contrat, article 6 § 1 b) |
| `child-communications-legitimate-interest` | Enfants | Acheminer leurs échanges avec des contacts préalablement approuvés | Intérêt légitime, article 6 § 1 f) |
| `realtime-media` | Participants aux appels | Utiliser temporairement caméra et microphone pendant un appel demandé | Contrat pour l’adulte ; intérêt légitime pour l’enfant |
| `family-safety` | Membres de la famille | Appliquer horaires, pauses, autorisations et contrôles de contacts | Intérêt légitime, article 6 § 1 f) |
| `service-security` | Utilisateurs | Authentifier, limiter les tentatives et prévenir les abus | Intérêt légitime, article 6 § 1 f) |
| `optional-notifications` | Utilisateur de l’appareil et responsable légal d’un enfant | Conserver un jeton push et envoyer les alertes facultatives | Consentement, article 6 § 1 a), avec accord conjoint sous 15 ans |
| `legal-requests` | Demandeurs et comptes concernés | Répondre aux demandes de droits ou d’autorités compétentes | Obligation légale, article 6 § 1 c) |

## Test de mise en balance — service familial des enfants

### 1. Intérêt poursuivi

Fournir aux familles un espace privé de communication adapté aux enfants, sans numéro de téléphone, profil public, publicité, recherche publique ni contact non approuvé. Protéger les comptes, empêcher les échanges non autorisés et appliquer les décisions du responsable légal constituent des intérêts réels, actuels et licites.

### 2. Nécessité

Un identifiant privé, le rattachement à une famille, la liste des contacts approuvés, les règles de sécurité et les données strictement nécessaires à l’acheminement des échanges sont indispensables au fonctionnement fermé du service. Une architecture sans compte enfant ou sans contrôle des relations ne permettrait pas d’offrir la même protection. Les permissions caméra et microphone ne sont demandées qu’au moment d’un appel et les flux ne sont pas enregistrés par Secret Clubhouse.

### 3. Mise en balance avec les droits des enfants

Les enfants sont un public vulnérable et peuvent raisonnablement attendre une forte confidentialité. Les risques principaux sont l’accès indu à une conversation, le contact non souhaité, une surveillance parentale excessive, la conservation trop longue et la sollicitation hors horaires.

Garanties appliquées :

- comptes enfants créés uniquement par un parent authentifié ;
- contacts exacts et opaques, sans annuaire ni recherche publique ;
- approbation parentale avant toute relation externe ;
- règles de médias, horaires et pause imposées aussi par l’API ;
- contenu des conversations entre enfants absent du tableau de bord parent ;
- durées de conservation et purge automatique documentées ;
- absence de publicité, profilage commercial et vente de données ;
- droit d’opposition expliqué dans la politique ;
- version enfant courte et accessible ;
- notifications facultatives exclues de l’intérêt légitime et soumises à un consentement conjoint.

Conclusion : après application de ces garanties, l’intérêt légitime peut être retenu pour les finalités obligatoires listées ci-dessus. Toute extension — géolocalisation, profil public, publicité, analyse comportementale ou nouveau destinataire — impose une nouvelle analyse avant développement.

## Consentement aux notifications

Le consentement est recueilli dans l’application avant la création ou la conservation d’un jeton push. Il est libre, spécifique aux notifications, éclairé, univoque et révocable depuis le même réglage.

Pour un enfant de moins de 15 ans :

1. le parent donne ou refuse son accord depuis l’espace protégé ;
2. l’enfant donne ou refuse son propre accord depuis son profil ;
3. le serveur n’active le traitement que si les deux accords existent ;
4. le retrait de l’un des deux supprime les abonnements et jetons du profil ;
5. la permission du navigateur, d’iOS ou d’Android est demandée seulement après ces accords et reste une permission technique distincte.

Chaque action est horodatée côté serveur avec la version du texte présenté. Les preuves sont limitées à des identifiants internes, au type d’action, à la finalité, à la base légale, à la version et au canal de recueil.
