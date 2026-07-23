import { legalDocumentVersions } from "./legal-framework.js";

export const legalNoticeRoute = "/mentions-legales";
export const legalNoticeVersion = legalDocumentVersions.legalNotice.label;

export const legalPublisher = Object.freeze({
  name: "Mickael Thorez",
  status: "Particulier non professionnel",
  publicationDirector: "Mickael Thorez",
  email: "contact@secret-clubhouse.fr",
  servicePrice: "Gratuit",
});

export const legalHost = Object.freeze({
  name: "Render Services, Inc.",
  address: "525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis",
  phoneDisplay: "+1 415 319 8186",
  phoneHref: "+14153198186",
  email: "legal@render.com",
  website: "https://render.com",
  termsUrl: "https://render.com/terms",
});

export const legalNoticeSections = Object.freeze([
  Object.freeze({
    title: "Édition et publication",
    paragraphs: Object.freeze([
      "Secret Clubhouse est édité à titre non professionnel par Mickael Thorez, qui assure également la direction de la publication.",
      "Le service est actuellement proposé gratuitement, sans abonnement, achat intégré ni publicité.",
    ]),
  }),
  Object.freeze({
    title: "Adresse personnelle de l’éditeur",
    paragraphs: Object.freeze([
      "L’éditeur non professionnel choisit de ne pas publier son adresse personnelle, conformément au régime prévu par l’article 1-1 III de la loi du 21 juin 2004 pour la confiance dans l’économie numérique.",
      "Les éléments d’identification complets de l’éditeur doivent être communiqués à l’hébergeur et peuvent être transmis aux autorités judiciaires dans les conditions prévues par la loi.",
    ]),
  }),
  Object.freeze({
    title: "Propriété intellectuelle",
    paragraphs: Object.freeze([
      "La marque, l’identité visuelle, les textes, interfaces, illustrations et éléments logiciels propres à Secret Clubhouse sont protégés par les règles applicables à la propriété intellectuelle.",
      "Toute reproduction ou réutilisation substantielle sans autorisation préalable est interdite, hors exceptions prévues par la loi et composants tiers utilisés conformément à leurs licences.",
    ]),
  }),
  Object.freeze({
    title: "Responsabilité et signalement",
    paragraphs: Object.freeze([
      "L’éditeur veille à l’exactitude des informations publiées et à la sécurité raisonnable du service, sans pouvoir garantir une disponibilité permanente ni l’absence absolue d’erreur.",
      "Une question, un contenu manifestement illicite ou une difficulté de sécurité peut être signalé à l’adresse de contact indiquée ci-dessous.",
    ]),
  }),
]);

export function isLegalNoticePath(pathname) {
  return pathname === legalNoticeRoute;
}
