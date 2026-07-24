import { legalDocumentVersions, registrationLegalEvidence } from "./legal-versions.js";

export { legalDocumentVersions, registrationLegalEvidence };

export const registrationLegalStatements = Object.freeze({
  terms: "J’accepte les conditions d’utilisation de Secret Clubhouse.",
  parentalAuthority: "Je confirme être le parent ou le responsable légal des enfants que j’ajouterai.",
  privacyNotice: "La politique de confidentialité a été mise à disposition avant l’inscription.",
});

export const notificationConsentCopy = Object.freeze({
  parent: "J’accepte que Secret Clubhouse utilise un jeton technique pour m’envoyer les notifications facultatives que j’active.",
  child: "Je suis d’accord pour recevoir les notifications de Secret Clubhouse sur cet appareil. Mon parent doit aussi être d’accord.",
  guardian: "J’autorise les notifications facultatives pour ce profil enfant. L’enfant doit également donner son accord sur son appareil.",
  systemPermission: "L’autorisation du téléphone ou du navigateur est une permission technique distincte : elle ne vaut pas consentement RGPD.",
});

export const legalBasisRegister = Object.freeze([
  Object.freeze({
    id: "parent-account-contract",
    subjects: "Parents et co-parents",
    purpose: "Créer le compte adulte, gérer la famille et fournir les fonctions expressément demandées.",
    basisCode: "RGPD, article 6 § 1 b)",
    basisLabel: "Exécution du contrat",
    justification: "Ces données sont objectivement nécessaires pour ouvrir, authentifier et administrer le service familial convenu avec l’adulte.",
    optional: false,
  }),
  Object.freeze({
    id: "child-family-service",
    subjects: "Enfants de 6 à 13 ans",
    purpose: "Créer un profil privé, le rattacher à sa famille et appliquer les protections choisies par le responsable légal.",
    basisCode: "RGPD, article 6 § 1 f)",
    basisLabel: "Intérêt légitime",
    justification: "Fournir un espace familial fermé tout en protégeant l’intérêt supérieur de l’enfant ; la mise en balance et les garanties sont documentées.",
    optional: false,
  }),
  Object.freeze({
    id: "adult-communications-contract",
    subjects: "Parents et co-parents",
    purpose: "Acheminer les messages, médias, appels privés et parties multijoueurs demandés par un adulte.",
    basisCode: "RGPD, article 6 § 1 b)",
    basisLabel: "Exécution du contrat",
    justification: "Le traitement est déclenché par l’adulte et nécessaire à la fonction de communication qu’il choisit d’utiliser.",
    optional: false,
  }),
  Object.freeze({
    id: "child-communications-legitimate-interest",
    subjects: "Enfants de 6 à 13 ans",
    purpose: "Acheminer les échanges privés initiés par l’enfant avec des contacts préalablement approuvés.",
    basisCode: "RGPD, article 6 § 1 f)",
    basisLabel: "Intérêt légitime",
    justification: "Permettre une communication adaptée aux mineurs dans un cercle fermé, avec contrôle parental, horaires et restrictions serveur.",
    optional: false,
  }),
  Object.freeze({
    id: "realtime-media",
    subjects: "Participants aux appels",
    purpose: "Activer temporairement caméra et microphone lorsqu’un participant lance ou accepte un appel.",
    basisCode: "RGPD, article 6 § 1 b) pour l’adulte ; article 6 § 1 f) pour l’enfant",
    basisLabel: "Contrat pour l’adulte ; intérêt légitime pour l’enfant",
    justification: "Le flux est nécessaire à l’appel expressément demandé, n’est pas enregistré par Secret Clubhouse et reste soumis aux contacts approuvés et aux règles parentales. La permission du système est uniquement une autorisation technique.",
    optional: false,
  }),
  Object.freeze({
    id: "family-safety",
    subjects: "Tous les membres de la famille",
    purpose: "Appliquer les horaires, pauses, autorisations de médias, approbations de contacts et alertes de sécurité.",
    basisCode: "RGPD, article 6 § 1 f)",
    basisLabel: "Intérêt légitime",
    justification: "Prévenir les échanges non autorisés et réduire les risques pour les enfants avec des mesures limitées et prévisibles.",
    optional: false,
  }),
  Object.freeze({
    id: "service-security",
    subjects: "Tous les utilisateurs",
    purpose: "Authentifier les comptes, limiter les tentatives de connexion, prévenir les abus et assurer la sécurité technique.",
    basisCode: "RGPD, article 6 § 1 f)",
    basisLabel: "Intérêt légitime",
    justification: "Protéger les comptes, les conversations privées et le service contre la fraude et les accès non autorisés.",
    optional: false,
  }),
  Object.freeze({
    id: "service-analytics",
    subjects: "Familles et utilisateurs",
    purpose: "Mesurer sous forme agrégée l’adoption, le retour à 30 jours et la fréquence d’utilisation afin de piloter et améliorer le service.",
    basisCode: "RGPD, article 6 § 1 f)",
    basisLabel: "Intérêt légitime",
    justification: "Les calculs réutilisent uniquement des dates et catégories déjà nécessaires au service, excluent les administrateurs et ne révèlent aucun nom, identifiant, contenu, contact ou comportement individuel.",
    optional: false,
  }),
  Object.freeze({
    id: "optional-notifications",
    subjects: "Utilisateur de l’appareil et, pour un enfant de moins de 15 ans, son responsable légal",
    purpose: "Conserver un jeton push et envoyer les notifications facultatives activées sur un appareil.",
    basisCode: "RGPD, article 6 § 1 a) ; loi Informatique et Libertés, article 45 pour les moins de 15 ans",
    basisLabel: "Consentement distinct et révocable",
    justification: "L’accord est recueilli dans l’application avant la permission technique du système. Pour un enfant, le traitement ne devient actif qu’après l’accord conjoint de l’enfant et du parent.",
    optional: true,
  }),
  Object.freeze({
    id: "legal-requests",
    subjects: "Demandeurs et comptes concernés",
    purpose: "Répondre aux demandes de droits et aux demandes légalement fondées des autorités.",
    basisCode: "RGPD, article 6 § 1 c)",
    basisLabel: "Obligation légale",
    justification: "Traiter les demandes imposées par le RGPD ou par une autre règle applicable et conserver la preuve strictement nécessaire.",
    optional: false,
  }),
]);
