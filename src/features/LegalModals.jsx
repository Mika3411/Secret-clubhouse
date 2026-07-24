import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { X } from "@phosphor-icons/react/X";
import PrivacyPolicyModal from "../PrivacyPolicyModal";
import LegalNoticeModal from "../LegalNoticeModal";
import { privacyController } from "../privacy-policy";
import { legalDocumentVersions } from "../legal-versions";
import "../styles/legal-modals.css";

export { PrivacyPolicyModal, LegalNoticeModal };

export function TermsModal({ onClose }) {
  return (
    <div className="terms-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <header className="terms-modal__header">
          <div><span>Informations légales</span><h2 id="terms-title">Conditions d’utilisation</h2><small>Version du {legalDocumentVersions.terms.label}</small></div>
          <button type="button" onClick={onClose} aria-label="Fermer les conditions d’utilisation"><X size={21} weight="bold" /></button>
        </header>
        <div className="terms-modal__content">
          <aside><ShieldCheck size={20} weight="fill" /><span><strong>Contrat avec le parent</strong> Ces conditions encadrent le service familial gratuit actuellement proposé. Elles sont acceptées séparément de la politique de confidentialité.</span></aside>

          <article><h3>1. Éditeur et champ d’application</h3><p>Secret Clubhouse est édité par {privacyController.name}, {privacyController.capacity.toLowerCase()}, joignable à {privacyController.email}. Le service familial gratuit est destiné aux enfants de 6 à 13 ans sous le contrôle de leurs responsables légaux.</p></article>
          <article><h3>2. Acceptation</h3><p>La création d’un compte parent suppose l’acceptation des présentes conditions par un adulte disposant de l’autorité nécessaire. Un enfant ne peut pas créer seul un compte familial.</p></article>
          <article><h3>3. Comptes et sécurité</h3><p>Le parent crée et administre les profils enfants, approuve les contacts et règle les autorisations. Les identifiants sont personnels et doivent rester confidentiels. Toute utilisation suspecte doit être signalée sans délai à l’éditeur.</p></article>
          <article><h3>4. Services proposés</h3><p>Le service peut proposer la messagerie, les messages vocaux, les appels audio et vidéo, le partage de médias autorisé par le parent et des activités privées. Leur disponibilité dépend du réseau, du terminal et des autorisations du système.</p></article>
          <article><h3>5. Gratuité</h3><p>Le service est fourni gratuitement, sans abonnement, achat intégré ni publicité. Si une offre payante était proposée un jour, elle ferait l’objet de conditions distinctes et d’une acceptation préalable ; elle ne serait jamais activée automatiquement.</p></article>
          <article><h3>6. Fin d’utilisation</h3><p>Le parent peut cesser d’utiliser le service à tout moment et demander la suppression de son compte depuis l’espace protégé. Aucun engagement financier ni durée minimale ne s’applique.</p></article>
          <article><h3>7. Disponibilité et responsabilité</h3><p>L’éditeur met en œuvre des moyens raisonnables pour assurer le fonctionnement du service, sans garantir une disponibilité permanente. Les parents restent responsables de la configuration des profils, du choix des contacts et de l’usage du service par leurs enfants.</p></article>
          <article><h3>8. Données personnelles</h3><p>Les données sont traitées pour fournir et sécuriser le service selon la politique de confidentialité distincte, disponible en versions parent et enfant depuis l’écran public avant toute inscription.</p></article>
          <article><h3>9. Suspension et résiliation</h3><p>Le parent peut cesser d’utiliser le service et demander la suppression de son compte. L’éditeur peut suspendre un compte en cas de fraude, de risque pour un enfant, de violation des règles ou d’obligation légale, selon une procédure proportionnée.</p></article>
          <article><h3>10. Droit applicable et réclamations</h3><p>Le droit français s’applique. Toute question ou réclamation peut être adressée à {privacyController.email}. L’éditeur agit à titre non professionnel et le service ne donne lieu à aucune transaction commerciale.</p></article>
        </div>
        <footer><button className="primary-button" type="button" onClick={onClose}>Fermer</button></footer>
      </section>
    </div>
  );
}
