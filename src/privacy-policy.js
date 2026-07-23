import { legalBasisRegister, legalDocumentVersions, notificationConsentCopy } from "./legal-framework.js";

const env = import.meta.env ?? {};

export const privacyController = Object.freeze({
  name: env.VITE_PRIVACY_CONTROLLER_NAME || "Mickael Thorez",
  capacity: "Éditeur particulier non professionnel de Secret Clubhouse",
  email: env.VITE_PRIVACY_CONTACT_EMAIL || "contact@secret-clubhouse.fr",
  dpo: null,
});

export const privacyRoutes = Object.freeze({
  parent: "/confidentialite",
  child: "/confidentialite-enfants",
});

export function privacyAudienceFromPath(pathname) {
  if (pathname === privacyRoutes.parent) return "parent";
  if (pathname === privacyRoutes.child) return "child";
  return null;
}

export const privacyPolicyVersion = legalDocumentVersions.privacy.label;

export const parentPrivacyPolicy = Object.freeze({
  summary: [
    "Secret Clubhouse est un service familial privé : aucun profil public, aucune publicité et aucune vente de données.",
    "Le parent crée les profils enfants, approuve les contacts et règle les protections. Le tableau de bord parent n’affiche pas le contenu des conversations entre enfants.",
    "Le serveur chiffre le texte, le nom, le type et les octets des médias, ainsi que les offres, réponses et candidats ICE des appels, en AES-256-GCM avant leur écriture dans PostgreSQL. Il les déchiffre seulement après l’autorisation du participant ; il ne s’agit pas d’un chiffrement de bout en bout.",
    "Le Blueprint demande désormais la région Render de Francfort pour toute nouvelle ressource. Comme Render ne déplace pas une ressource existante, l’instance de production créée auparavant reste déclarée par prudence comme susceptible d’être en Oregon jusqu’à vérification ou migration. Les accès support, sauvegardes et sous-traitants ultérieurs peuvent aussi entraîner des traitements hors EEE.",
  ],
  dataCategories: [
    {
      title: "Parents et co-parents",
      text: "Prénom ou nom d’usage, adresse e-mail, mot de passe sous forme de hash, identifiant privé, rôle dans la famille, invitations et dates de création ou d’action.",
    },
    {
      title: "Enfants",
      text: "Prénom ou pseudonyme, âge, nom d’utilisateur privé, mot de passe sous forme de hash, identifiant privé, avatar, état actif ou en pause, réglages de sécurité et horaires définis par le parent.",
    },
    {
      title: "Communications et activités",
      text: "Relations et demandes de contact, participants aux conversations, messages, photos, vidéos, messages vocaux, états de réception, invitations et parties multijoueurs, métadonnées et signaux techniques des appels. Le contenu, les métadonnées descriptives des messages et médias, ainsi que les offres, réponses et candidats ICE WebRTC sont chiffrés par l’API avant leur stockage PostgreSQL.",
    },
    {
      title: "Données techniques et de sécurité",
      text: "Session web placée dans un cookie sécurisé, HttpOnly et inaccessible à JavaScript ; session native temporaire limitée à la session de l’application ; seul un hash de session révocable est conservé dans PostgreSQL. S’ajoutent l’adresse e-mail parent mémorisée localement, la présence récente, l’indicateur de saisie, les abonnements de notification, le type d’appareil et le hash irréversible de l’adresse IP utilisé pour limiter les tentatives de connexion.",
    },
    {
      title: "Caméra et microphone",
      text: "Ils sont activés seulement après une action et une autorisation de l’utilisateur. Les flux d’appel WebRTC ne sont pas enregistrés par Secret Clubhouse ; ils circulent directement entre les participants ou temporairement par un relais TURN si nécessaire.",
    },
  ],
  purposes: legalBasisRegister.map((entry) => ({
    id: entry.id,
    subjects: entry.subjects,
    purpose: entry.purpose,
    legalBasis: `${entry.basisLabel} — ${entry.basisCode}. ${entry.justification}`,
    optional: entry.optional,
  })),
  consentExplanation: [
    "La création du compte et le service principal ne reposent pas sur le consentement : les traitements nécessaires sont fondés sur le contrat conclu avec le parent ou sur les intérêts légitimes précisément indiqués dans le tableau.",
    `Les notifications sont facultatives et reposent sur un consentement séparé. ${notificationConsentCopy.systemPermission}`,
    "Pour un enfant de moins de 15 ans, Secret Clubhouse exige l’accord conjoint de l’enfant dans son profil et d’un parent dans l’espace protégé. Le retrait de l’un ou de l’autre désactive le traitement et supprime les jetons de notification.",
  ],
  recipients: [
    "Chaque message, média ou appel est accessible uniquement à son auteur, aux participants autorisés de la conversation et aux systèmes techniques nécessaires à son acheminement.",
    "Les parents et co-parents autorisés accèdent aux profils, contacts, réglages et alertes de sécurité de leur famille. Ils ne voient pas dans le tableau de bord le contenu des conversations de leurs enfants avec leurs amis.",
    "L’éditeur et les personnes strictement habilitées peuvent intervenir lorsque cela est nécessaire à la sécurité, au support ou à l’exercice d’un droit.",
    "Les autorités administratives ou judiciaires reçoivent uniquement les données dont la communication est légalement exigée.",
    "Aucune donnée n’est vendue, louée, utilisée pour de la publicité ciblée ou communiquée à un annuaire public.",
  ],
  processors: [
    {
      name: "Render Services, Inc.",
      role: "Hébergement de l’application, de l’API et de l’offre PostgreSQL managée, y compris ses sauvegardes techniques et journaux d’infrastructure. PostgreSQL est ici un logiciel et un service Render, pas un second sous-traitant contractuel.",
      location: "Francfort est imposé aux nouvelles ressources. La région des ressources de production existantes doit être vérifiée dans Render ; à défaut de preuve ou de migration, l’Oregon reste l’hypothèse conservatrice.",
      url: "https://render.com/dpa",
      label: "DPA de Render",
    },
    {
      name: "Cloudflare, Inc.",
      role: "Serveur STUN et, seulement lorsque configuré ou nécessaire, relais TURN temporaire pour établir les appels audio ou vidéo. Cloudflare peut alors traiter des adresses IP et du trafic chiffré de transport.",
      location: "Réseau mondial, avec transferts possibles hors Espace économique européen.",
      url: "https://www.cloudflare.com/cloudflare-customer-dpa/",
      label: "DPA de Cloudflare",
    },
    {
      name: "Service Web Push choisi par le navigateur",
      role: "Lorsque l’utilisateur active les notifications web, le navigateur choisit son service de remise. Celui-ci reçoit le point de terminaison, les métadonnées de remise et une charge utile chiffrée contenant uniquement des identifiants opaques et un libellé générique.",
      location: "Selon le navigateur et le terminal, y compris hors Espace économique européen. Secret Clubhouse ne choisit pas toujours ce service et ne peut pas promettre une région déterminée.",
      url: "https://www.w3.org/TR/push-api/",
      label: "Architecture Web Push",
    },
    {
      name: "Google LLC — Firebase Cloud Messaging",
      role: "Remise facultative des notifications de l’application Android. FCM reçoit un identifiant d’installation ou jeton d’appareil et une charge utile minimale ; jamais le texte du message, le nom du fichier, le nom de l’enfant ou celui du contact.",
      location: "Service mondial : Google peut traiter les données dans les pays où Google ou ses sous-traitants disposent d’installations.",
      url: "https://firebase.google.com/terms/data-processing-terms",
      label: "Conditions de traitement Firebase",
    },
    {
      name: "Apple Inc. — Apple Push Notification service",
      role: "Remise facultative des notifications et signaux d’appel de l’application iOS. APNs reçoit un jeton d’appareil et une charge utile minimale ; jamais le texte du message, le nom du fichier, le nom de l’enfant ou celui du contact.",
      location: "Infrastructure Apple pouvant impliquer des traitements hors Espace économique européen.",
      url: "https://developer.apple.com/support/terms/",
      label: "Contrats Apple Developer",
    },
  ],
  transfers: [
    "Le Blueprint impose Francfort aux nouvelles ressources Render. Ce réglage ne déplace pas les ressources existantes : tant que leur région n’est pas vérifiée dans le tableau de bord ou qu’une migration n’est pas achevée, un hébergement principal en Oregon reste possible et est traité comme un transfert vers les États-Unis.",
    "Le DPA Render prévoit le cadre de protection des données UE–États-Unis lorsqu’il s’applique et, à défaut, les clauses contractuelles types de la Commission européenne. Le DPA Cloudflare et les conditions Firebase prévoient également des clauses contractuelles types pour les transferts concernés. L’applicabilité de chaque contrat, ses annexes et son acceptation par le titulaire du compte doivent être archivées.",
    "Cloudflare TURN fonctionne sur un réseau mondial ; FCM est un service mondial ; APNs et le service Web Push choisi par le navigateur peuvent aussi traiter hors EEE. Les notifications sont facultatives, chiffrées pendant leur remise et limitées à un jeton, des identifiants opaques et un texte générique. Le consentement aux notifications ne remplace pas la garantie requise pour un transfert international.",
    "Le statut exact d’Apple pour APNs et des services Web Push imposés par les navigateurs doit être confirmé contractuellement avant leur activation générale : les conditions publiques consultées ne suffisent pas, à elles seules, à prouver un accord de sous-traitance conforme à l’article 28 pour chaque scénario.",
    "Une copie des garanties applicables ou des informations complémentaires peut être demandée à contact@secret-clubhouse.fr. Certaines parties pourront être occultées pour protéger les mesures de sécurité et les secrets d’affaires.",
  ],
  retention: [
    {
      data: "Comptes parent, famille, profils enfants et réglages",
      duration: "Pendant l’utilisation du service, puis au maximum 2 ans après la dernière activité de l’ensemble de la famille. Une connexion ou un heartbeat renouvelle ce délai. Un profil enfant supprimé par le parent est effacé immédiatement avec ses données associées.",
    },
    {
      data: "Messages et médias",
      duration: "Les messages texte ou automatiques sans fichier sont supprimés après 365 jours. Les photos, images, vidéos, messages vocaux et autres médias binaires sont supprimés après 90 jours.",
    },
    {
      data: "Appels, présence et saisie",
      duration: "Les offres, réponses et candidats techniques WebRTC sont supprimés après 24 heures. Les métadonnées d’un appel terminé sont supprimées après 90 jours. Une présence est supprimée après 24 heures, bien que l’affichage passe hors ligne après 75 secondes ; la saisie expire après 6 secondes.",
    },
    {
      data: "Invitations et demandes de contact",
      duration: "Une invitation de co-parent est utilisable 7 jours, puis sa trace est supprimée 90 jours après son acceptation, sa révocation ou son expiration. Une demande de contact expire après 30 jours et sa trace est supprimée après 180 jours.",
    },
    {
      data: "Jeux multijoueurs",
      duration: "Une invitation sans réponse expire après 30 jours. Une partie acceptée, refusée ou terminée est supprimée 180 jours après la dernière action.",
    },
    {
      data: "Progression Clubhouse",
      duration: "Les activités terminées, étoiles, relectures et jours de série sont conservés pendant la durée de vie du profil enfant afin de restituer sa progression privée. Ils sont supprimés immédiatement avec ce profil, ou avec la famille après 2 ans d’inactivité.",
    },
    {
      data: "Sécurité et limitation des connexions",
      duration: "Une session expire après 12 heures en production ; son hash est refusé immédiatement à l’expiration ou à la révocation, puis supprimé par la purge quotidienne (une session révoquée devient supprimable après 24 heures). Les compteurs de limitation sont supprimés au plus tard 48 heures après leur dernière mise à jour ; le hash d’identité est aussi effacé après une connexion réussie. Les événements du journal de sécurité sont supprimés après 365 jours et ne contiennent ni adresse e-mail ni adresse IP en clair.",
    },
    {
      data: "Notifications",
      duration: "Les abonnements Web Push et jetons natifs sont supprimés après 180 jours sans réenregistrement, immédiatement lors du retrait du consentement par l’utilisateur ou le parent, ou lors de la suppression du compte.",
    },
    {
      data: "Preuves contractuelles, information et consentements",
      duration: "Les événements minimaux — identifiants internes, action, finalité, base légale, version et date — sont conservés au maximum 5 ans afin d’établir le contrat, l’information fournie ou le consentement et son retrait. Ils ne contiennent ni mot de passe, ni adresse IP, ni contenu de message.",
    },
    {
      data: "Demandes d’exercice des droits",
      duration: "La demande, son échéance, ses étapes et la réponse sont conservées au maximum 5 ans pour démontrer son traitement. Après un effacement, seuls les éléments minimaux nécessaires à cette preuve restent dans ce registre.",
    },
    {
      data: "Sauvegardes PostgreSQL Render",
      duration: "Render conserve la restauration point dans le temps 3 jours sur un espace Hobby ou 7 jours sur un espace Pro ou supérieur, et les exports logiques 7 jours. Une consigne d’effacement temporaire est conservée 30 jours et doit être réappliquée avant toute remise en service d’une base restaurée.",
    },
    {
      data: "Journaux techniques Render",
      duration: "Selon la durée du plan et de la configuration Render en vigueur, uniquement le temps nécessaire au diagnostic, à la sécurité et au respect d’une obligation. La durée précise applicable peut être demandée au contact RGPD.",
    },
  ],
  rights: [
    "Accéder aux données et en recevoir une copie.",
    "Faire rectifier une donnée inexacte ou incomplète.",
    "Demander l’effacement, notamment lorsque les données ne sont plus nécessaires.",
    "Demander la limitation temporaire d’un traitement.",
    "Recevoir les données fournies dans un format portable lorsque ce droit s’applique.",
    "S’opposer, pour des raisons tenant à la situation de la personne, aux traitements fondés sur l’intérêt légitime.",
    "Retirer à tout moment un consentement, sans remettre en cause le traitement déjà effectué.",
  ],
});

export const childPrivacyCards = Object.freeze([
  {
    icon: "person",
    title: "Qui s’occupe de tes données ?",
    text: "Secret Clubhouse est géré par Mickael Thorez. Toi ou ton parent pouvez écrire à contact@secret-clubhouse.fr pour poser une question.",
  },
  {
    icon: "backpack",
    title: "Ce que l’application garde",
    text: "Ton prénom ou pseudo, ton âge, ton avatar, ton identifiant secret, tes contacts approuvés, tes messages, tes médias, tes jeux et les réglages choisis par ton parent.",
  },
  {
    icon: "sparkle",
    title: "Pourquoi on les utilise",
    text: "Pour ouvrir ton espace, envoyer ce que tu choisis à la bonne personne, faire marcher les appels et les jeux, et appliquer les protections décidées avec ton parent.",
  },
  {
    icon: "sparkle",
    title: "Tes messages sont verrouillés",
    text: "Avant de ranger un message, une photo ou une vidéo dans la base, le serveur les transforme avec une clé secrète. Il les rouvre seulement pour une personne autorisée dans ta conversation.",
  },
  {
    icon: "hand",
    title: "Les notifications : deux accords",
    text: "Les notifications sont un choix. Tu dis oui dans ton profil et ton parent dit oui dans son espace. Si l’un de vous dit non ou change d’avis, elles sont désactivées.",
  },
  {
    icon: "eye",
    title: "Qui peut voir quoi ?",
    text: "La personne approuvée voit ce que tu lui envoies. Ton parent voit tes contacts, tes protections et les alertes, mais pas le contenu de tes discussions avec tes amis dans son tableau de bord.",
  },
  {
    icon: "globe",
    title: "Où sont gardées les données ?",
    text: "Les nouveaux serveurs sont prévus à Francfort, en Allemagne. L’ancienne installation peut rester aux États-Unis jusqu’à son déplacement. Les appels et notifications peuvent passer par d’autres pays avec seulement les informations techniques nécessaires.",
  },
  {
    icon: "clock",
    title: "Pendant combien de temps ?",
    text: "Ton parent peut supprimer ton profil tout de suite. Sinon, les messages texte restent au plus un an, les photos et vidéos 90 jours, et les petits signaux « en ligne » ou d’appel seulement quelques secondes ou heures. Un compte familial sans activité pendant 2 ans est supprimé.",
  },
  {
    icon: "hand",
    title: "Tes données, tes droits",
    text: "Dans ton profil, ouvre « Mes données et mes droits ». Tu peux voir, récupérer, corriger ou effacer tes données, ou dire non à certains usages. Tu peux le faire toi-même ou avec l’aide d’un adulte de confiance.",
  },
]);

export const privacyComplaint = Object.freeze({
  text: "Si la réponse apportée ne suffit pas, une réclamation peut être adressée à la Commission nationale de l’informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.",
  url: "https://www.cnil.fr/fr/adresser-une-plainte",
});
