export const aipdVersion = "1.0";
export const aipdAssessmentDate = "2026-07-23";

export const aipdRiskScale = Object.freeze({
  severity: Object.freeze({
    1: "Impact limité et réversible sans aide particulière.",
    2: "Difficultés réelles mais temporaires ou facilement réparables.",
    3: "Atteinte importante nécessitant une aide, une réparation ou une protection.",
    4: "Atteinte grave ou durable à la sécurité, à la dignité ou aux droits d’un enfant.",
  }),
  likelihood: Object.freeze({
    1: "Peu vraisemblable.",
    2: "Possible.",
    3: "Vraisemblable.",
    4: "Très vraisemblable ou déjà observé sans mesure.",
  }),
  levels: Object.freeze({
    low: "1 à 4",
    moderate: "5 à 8",
    high: "9 à 16",
  }),
});

export function aipdRiskScore({ severity, likelihood }) {
  return severity * likelihood;
}

export function aipdRiskLevel(rating) {
  const score = aipdRiskScore(rating);
  if (score >= 9) return "high";
  if (score >= 5) return "moderate";
  return "low";
}

export const aipdHighRiskCriteria = Object.freeze([
  Object.freeze({
    id: "vulnerable-data-subjects",
    label: "Personnes vulnérables",
    applicable: true,
    evidence: "Le service est destiné aux enfants de 6 à 13 ans.",
  }),
  Object.freeze({
    id: "highly-personal-data",
    label: "Données hautement personnelles",
    applicable: true,
    evidence: "Les conversations, photos, vidéos, messages vocaux et appels sont privés.",
  }),
  Object.freeze({
    id: "systematic-monitoring",
    label: "Surveillance ou suivi régulier",
    applicable: true,
    evidence: "Présence, activité, horaires, accusés de réception et interactions sont suivis pour fournir et sécuriser le service.",
  }),
  Object.freeze({
    id: "innovative-technology",
    label: "Usage innovant ou combinaison de technologies",
    applicable: true,
    evidence: "Clients mobiles enfants, Web Push/APNs/FCM, WebRTC, CallKit et Android Telecom sont combinés.",
  }),
]);

export const aipdActions = Object.freeze([
  Object.freeze({
    id: "A01",
    title: "Valider formellement l’AIPD",
    owner: "Responsable du traitement",
    deadline: "Avant toute ouverture en production à des enfants",
    status: "open",
    acceptance: "Décision datée et signée, avis du DPO s’il est désigné, risques acceptés et budget des mesures approuvé.",
  }),
  Object.freeze({
    id: "A02",
    title: "Recueillir le point de vue des personnes concernées",
    owner: "Responsable du traitement",
    deadline: "Avant validation de l’AIPD",
    status: "open",
    acceptance: "Compte rendu d’une consultation adaptée de parents et d’enfants de 6 à 13 ans, ou justification documentée de son absence.",
  }),
  Object.freeze({
    id: "A03",
    title: "Constituer le dossier sous-traitants et transferts",
    owner: "Responsable du traitement",
    deadline: "Avant mise en production",
    status: "open",
    acceptance: "Toutes les actions bloquantes de docs/registre-sous-traitants-et-transferts.md sont fermées avec DPA, localisation effective, accès support, sauvegardes, liste des sous-traitants ultérieurs, mécanisme de transfert et analyse signée pour Render, Cloudflare, Apple, Google et les services Web Push retenus.",
  }),
  Object.freeze({
    id: "A04",
    title: "Formaliser l’administration et le cycle de vie des clés",
    owner: "Responsable sécurité / exploitation",
    deadline: "Avant mise en production",
    status: "open",
    acceptance: "Administrateurs nommés, MFA, moindre privilège, revue trimestrielle, séparation des secrets, rotation et restauration avec anciennes clés testées et consignées.",
  }),
  Object.freeze({
    id: "A05",
    title: "Tester la réponse aux incidents et violations",
    owner: "Responsable du traitement",
    deadline: "Avant mise en production puis chaque année",
    status: "open",
    acceptance: "Procédure de qualification, confinement, preuve, information des familles et notification CNIL sous 72 heures testée lors d’un exercice.",
  }),
  Object.freeze({
    id: "A06",
    title: "Tester purge, effacement et restauration",
    owner: "Exploitation",
    deadline: "Avant mise en production puis chaque trimestre",
    status: "open",
    acceptance: "Tests PostgreSQL complets réussis sur une base proche de la production, y compris tombstones, purge, export, restauration et absence de réapparition d’un compte effacé.",
  }),
  Object.freeze({
    id: "A07",
    title: "Réaliser un test de sécurité indépendant",
    owner: "Responsable sécurité / prestataire indépendant",
    deadline: "Avant mise en production puis après changement majeur",
    status: "open",
    acceptance: "API, autorisations horizontales, comptes enfants, upload, WebRTC, push, applications natives et dépendances testés ; aucune anomalie critique ou élevée non corrigée.",
  }),
  Object.freeze({
    id: "A08",
    title: "Établir la preuve de configuration de production",
    owner: "Exploitation",
    deadline: "À chaque déploiement",
    status: "open",
    acceptance: "Revue des variables, transports, sessions, clés, sauvegardes, alertes, Cron Job, journaux et résultats CI archivée sans valeur secrète.",
  }),
]);

const risk = ({
  id,
  title,
  fearedEvent,
  threats,
  impacts,
  initial,
  existingMeasures,
  residual,
  actionIds,
}) => Object.freeze({
  id,
  title,
  fearedEvent,
  threats: Object.freeze(threats),
  impacts: Object.freeze(impacts),
  initial: Object.freeze(initial),
  existingMeasures: Object.freeze(existingMeasures),
  residual: Object.freeze(residual),
  actionIds: Object.freeze(actionIds),
});

export const aipdRisks = Object.freeze([
  risk({
    id: "R01",
    title: "Divulgation de conversations ou de médias",
    fearedEvent: "Une personne non autorisée accède au contenu privé d’un enfant.",
    threats: ["Compromission d’un compte ou d’une session", "Erreur d’autorisation horizontale", "Accès privilégié ou fuite de sauvegarde", "Compromission d’une clé applicative"],
    impacts: ["Atteinte à l’intimité et à la dignité", "Harcèlement, chantage ou exposition d’images", "Perte de confiance et détresse de l’enfant"],
    initial: { severity: 4, likelihood: 4 },
    existingMeasures: ["Conversations limitées aux participants autorisés", "Sessions opaques révocables et cookie web HttpOnly", "AES-256-GCM applicatif avec contexte authentifié", "Base PostgreSQL privée Render", "Contenu des conversations enfant-ami masqué aux parents non participants"],
    residual: { severity: 4, likelihood: 3 },
    actionIds: ["A04", "A07", "A08"],
  }),
  risk({
    id: "R02",
    title: "Usurpation ou prise de contrôle d’un compte",
    fearedEvent: "Un tiers agit comme un enfant ou un parent et contacte ses relations.",
    threats: ["Mot de passe deviné ou réutilisé", "Vol d’un appareil ou d’une session", "Tentatives automatisées"],
    impacts: ["Contact trompeur ou manipulation", "Modification des protections", "Accès aux données et perte de contrôle du compte"],
    initial: { severity: 4, likelihood: 3 },
    existingMeasures: ["Hash bcrypt des mots de passe", "Limitation persistante des connexions par identité et IP", "Sessions valables 12 heures en production et révocables", "Vérification du mot de passe actuel pour les opérations sensibles"],
    residual: { severity: 4, likelihood: 2 },
    actionIds: ["A07", "A08"],
  }),
  risk({
    id: "R03",
    title: "Contact indésirable, manipulation ou harcèlement",
    fearedEvent: "Un enfant est approché, sollicité ou harcelé par un contact non souhaité.",
    threats: ["Partage d’un identifiant privé", "Acceptation erronée d’une demande", "Compte autorisé devenu malveillant", "Usage abusif des messages, appels ou jeux"],
    impacts: ["Atteinte à la sécurité et au bien-être", "Harcèlement ou prédation", "Sollicitations répétées hors contexte familial"],
    initial: { severity: 4, likelihood: 3 },
    existingMeasures: ["Aucun annuaire ni recherche publique", "Identifiant opaque exact", "Approbation parentale avant une relation externe", "Contrôles serveur pour messages, médias, appels et jeux", "Pause, horaires et réponse neutre hors horaires"],
    residual: { severity: 4, likelihood: 2 },
    actionIds: ["A02", "A05", "A07"],
  }),
  risk({
    id: "R04",
    title: "Surveillance disproportionnée de l’enfant",
    fearedEvent: "Les métadonnées d’activité permettent de suivre ou d’inférer excessivement les habitudes d’un enfant.",
    threats: ["Collecte trop fine ou conservation trop longue", "Présentation trop détaillée aux adultes", "Détournement de la présence et des accusés de lecture"],
    impacts: ["Atteinte à la vie privée et à l’autonomie", "Pression familiale ou sociale", "Profil comportemental involontaire"],
    initial: { severity: 3, likelihood: 3 },
    existingMeasures: ["Présence limitée au compte, à la famille et aux contacts approuvés", "Présence hors ligne après 75 secondes et purgée sous 24 heures", "Tableau parent limité aux alertes et à l’activité générale", "Aucun contenu enfant-ami exposé au parent"],
    residual: { severity: 3, likelihood: 2 },
    actionIds: ["A02", "A06"],
  }),
  risk({
    id: "R05",
    title: "Exposition par une notification",
    fearedEvent: "Un écran verrouillé ou un fournisseur push révèle une information privée.",
    threats: ["Aperçu visible sur un appareil partagé", "Journalisation d’une charge push", "Jeton envoyé sans consentement valide"],
    impacts: ["Révélation d’une relation ou d’un échange", "Atteinte à la confidentialité familiale", "Traçage technique indu"],
    initial: { severity: 3, likelihood: 3 },
    existingMeasures: ["Libellés génériques sans texte, nom de fichier, nom d’enfant ou de contact", "Jetons opaques", "Consentement facultatif, révocable et conjoint pour les moins de 15 ans", "Suppression des jetons lors du retrait"],
    residual: { severity: 2, likelihood: 2 },
    actionIds: ["A03", "A07"],
  }),
  risk({
    id: "R06",
    title: "Exposition liée aux appels WebRTC",
    fearedEvent: "Un appel divulgue une adresse réseau, active un média sans intention ou contourne une règle parentale.",
    threats: ["Mauvaise négociation ICE/TURN", "Permission caméra ou microphone mal comprise", "Signal réutilisé", "Contrôle d’horaire uniquement côté client"],
    impacts: ["Atteinte à l’intimité physique ou sonore", "Localisation approximative par adresse IP", "Appel indésirable ou anxiogène"],
    initial: { severity: 4, likelihood: 3 },
    existingMeasures: ["Participants authentifiés et approuvés", "Règles parentales vérifiées par l’API", "Payloads offre/réponse/ICE chiffrés avant PostgreSQL", "Permission média demandée à l’usage", "Signaux purgés sous 24 heures", "Relais TURN temporaire lorsqu’il est configuré", "Aucun enregistrement applicatif du flux"],
    residual: { severity: 3, likelihood: 2 },
    actionIds: ["A03", "A07", "A08"],
  }),
  risk({
    id: "R07",
    title: "Conservation, effacement ou restauration incorrects",
    fearedEvent: "Une donnée persiste au-delà de sa durée ou réapparaît après une suppression.",
    threats: ["Échec du Cron Job", "Nouvelle table oubliée", "Restauration d’une sauvegarde antérieure", "Suppression en cascade incomplète"],
    impacts: ["Perte de maîtrise et exercice des droits inefficace", "Exposition prolongée de contenus d’enfants", "Réapparition d’un compte supprimé"],
    initial: { severity: 4, likelihood: 3 },
    existingMeasures: ["Échéances PostgreSQL explicites", "Purge quotidienne transactionnelle et tracée", "Suppression en cascade", "Tombstones d’effacement à réappliquer avant restauration", "Registre de demandes avec échéance à un mois"],
    residual: { severity: 4, likelihood: 2 },
    actionIds: ["A06", "A08"],
  }),
  risk({
    id: "R08",
    title: "Transfert ou sous-traitance insuffisamment maîtrisé",
    fearedEvent: "Des données d’enfants sont traitées dans un pays tiers ou par un sous-traitant sans garantie effective démontrée.",
    threats: ["Ressource Render existante potentiellement en Oregon ou accès support hors EEE", "Réseau mondial TURN et statut du STUN public", "Services Apple, Google ou Web Push", "Modification d’un sous-traitant ou de ses conditions"],
    impacts: ["Accès étranger non proportionné", "Recours plus difficile", "Perte de contrôle sur les destinataires et les durées"],
    initial: { severity: 4, likelihood: 3 },
    existingMeasures: ["Registre opérationnel par fournisseur et par flux", "Francfort imposé aux nouvelles ressources Render", "Minimisation des charges push", "Chiffrement de transport et chiffrement applicatif du stockage", "DPA et mécanismes de transfert annoncés par les fournisseurs"],
    residual: { severity: 4, likelihood: 3 },
    actionIds: ["A03", "A01"],
  }),
  risk({
    id: "R09",
    title: "Indisponibilité ou perte de données",
    fearedEvent: "Le service ou les données nécessaires à la sécurité familiale deviennent indisponibles ou incohérents.",
    threats: ["Incident Render/PostgreSQL", "Migration défectueuse", "Saturation mémoire ou disque", "Erreur de restauration"],
    impacts: ["Perte de messages et d’éléments de preuve", "Impossibilité de joindre un parent", "Règles de sécurité indisponibles"],
    initial: { severity: 3, likelihood: 3 },
    existingMeasures: ["Sauvegardes PostgreSQL limitées dans le temps", "Uploads bornés et temporaires sur disque", "Transactions pour opérations relationnelles", "Build et tests automatisés"],
    residual: { severity: 3, likelihood: 2 },
    actionIds: ["A05", "A06", "A08"],
  }),
  risk({
    id: "R10",
    title: "Erreur, abus interne ou journalisation excessive",
    fearedEvent: "Une personne disposant d’un accès d’exploitation consulte, modifie ou copie des données sans nécessité.",
    threats: ["Privilèges trop larges", "Secret partagé", "Absence de revue des accès", "Données personnelles dans des journaux"],
    impacts: ["Divulgation massive", "Altération des protections ou des preuves", "Impossibilité d’attribuer une action"],
    initial: { severity: 4, likelihood: 3 },
    existingMeasures: ["Erreurs publiques génériques avec identifiant de corrélation", "Journaux de sécurité minimisés", "Secrets séparés dans Render", "Contenus chiffrés en base"],
    residual: { severity: 4, likelihood: 3 },
    actionIds: ["A04", "A05", "A07", "A08"],
  }),
]);

export const aipdDecision = Object.freeze({
  status: "blocked",
  productionApproved: false,
  reason: "L’AIPD technique est constituée, mais les risques résiduels R01, R08 et R10 restent élevés tant que les preuves organisationnelles, contractuelles et indépendantes ne sont pas closes.",
  priorConsultationRule: "Si un risque élevé subsiste malgré les mesures complémentaires, le responsable du traitement doit consulter la CNIL avant de commencer ou poursuivre le traitement concerné.",
});
