import { useEffect, useRef } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react/ArrowSquareOut";
import { Backpack } from "@phosphor-icons/react/Backpack";
import { Clock } from "@phosphor-icons/react/Clock";
import { Database } from "@phosphor-icons/react/Database";
import { EnvelopeSimple } from "@phosphor-icons/react/EnvelopeSimple";
import { Eye } from "@phosphor-icons/react/Eye";
import { GlobeHemisphereWest } from "@phosphor-icons/react/GlobeHemisphereWest";
import { HandHeart } from "@phosphor-icons/react/HandHeart";
import { ListChecks } from "@phosphor-icons/react/ListChecks";
import { Scales } from "@phosphor-icons/react/Scales";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { UserCircle } from "@phosphor-icons/react/UserCircle";
import { X } from "@phosphor-icons/react/X";
import {
  childPrivacyCards,
  parentPrivacyPolicy,
  privacyComplaint,
  privacyController,
  privacyPolicyVersion,
} from "./privacy-policy";

const childIcons = {
  person: UserCircle,
  backpack: Backpack,
  sparkle: Sparkle,
  eye: Eye,
  globe: GlobeHemisphereWest,
  clock: Clock,
  hand: HandHeart,
};

function ExternalLink({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer">{children} <ArrowSquareOut size={13} weight="bold" aria-hidden="true" /></a>;
}

function ParentPrivacyPolicy() {
  return (
    <div className="privacy-policy privacy-policy--parent">
      <section className="privacy-controller" aria-labelledby="privacy-controller-title">
        <span><ShieldCheck size={27} weight="fill" aria-hidden="true" /></span>
        <div>
          <h3 id="privacy-controller-title">Responsable du traitement</h3>
          <p><strong>{privacyController.name}</strong>, {privacyController.capacity}.</p>
          <p>Contact RGPD : <a href={`mailto:${privacyController.email}`}>{privacyController.email}</a>. Aucun délégué à la protection des données n’est désigné à ce jour ; cette adresse est le point de contact pour toute question ou demande.</p>
        </div>
      </section>

      <section aria-labelledby="privacy-summary-title">
        <div className="privacy-section-title"><ListChecks size={22} weight="fill" /><div><span>L’essentiel</span><h3 id="privacy-summary-title">Ce qu’il faut savoir d’abord</h3></div></div>
        <ul className="privacy-summary-list">{parentPrivacyPolicy.summary.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section aria-labelledby="privacy-data-title">
        <div className="privacy-section-title"><Database size={22} weight="fill" /><div><span>Données traitées</span><h3 id="privacy-data-title">Quelles informations utilisons-nous ?</h3></div></div>
        <p>Les données viennent du parent ou du co-parent, de l’enfant lorsqu’il utilise son profil, des autres participants lorsqu’ils communiquent, et du terminal pour les informations techniques nécessaires.</p>
        <div className="privacy-data-grid">
          {parentPrivacyPolicy.dataCategories.map((category) => <article key={category.title}><h4>{category.title}</h4><p>{category.text}</p></article>)}
        </div>
      </section>

      <section aria-labelledby="privacy-purpose-title">
        <div className="privacy-section-title"><Scales size={22} weight="fill" /><div><span>Finalités et bases légales</span><h3 id="privacy-purpose-title">Pourquoi et sur quel fondement ?</h3></div></div>
        <div className="privacy-table-wrap">
          <table>
            <thead><tr><th>Personnes concernées</th><th>Ce que nous faisons</th><th>Base légale</th></tr></thead>
            <tbody>{parentPrivacyPolicy.purposes.map((row) => <tr key={row.id}><td>{row.subjects}</td><td>{row.purpose}{row.optional && <small className="privacy-optional-badge">Facultatif</small>}</td><td>{row.legalBasis}</td></tr>)}</tbody>
          </table>
        </div>
        <aside><strong>Aucune décision automatisée.</strong> Secret Clubhouse ne réalise ni profilage publicitaire ni décision produisant un effet juridique uniquement par un algorithme. Les restrictions du profil enfant viennent des choix du parent et de règles de sécurité explicites.</aside>
      </section>

      <section aria-labelledby="privacy-consent-title">
        <div className="privacy-section-title"><HandHeart size={22} weight="fill" /><div><span>Consentement</span><h3 id="privacy-consent-title">Ce qui demande vraiment votre accord</h3></div></div>
        <ul>{parentPrivacyPolicy.consentExplanation.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section aria-labelledby="privacy-required-title">
        <div className="privacy-section-title"><ShieldCheck size={22} weight="fill" /><div><span>Obligatoire ou facultatif</span><h3 id="privacy-required-title">Que se passe-t-il si une donnée manque ?</h3></div></div>
        <p>L’e-mail du parent, son mot de passe et les informations minimales d’un profil enfant sont nécessaires pour créer et sécuriser la famille. Sans eux, le compte ou la fonction demandée ne peut pas fonctionner. Les notifications, l’accès au microphone, la caméra, l’envoi de médias, l’avatar détaillé et les invitations de co-parent sont facultatifs. Les refuser désactive seulement la fonction concernée.</p>
      </section>

      <section aria-labelledby="privacy-recipient-title">
        <div className="privacy-section-title"><Eye size={22} weight="fill" /><div><span>Destinataires</span><h3 id="privacy-recipient-title">Qui peut recevoir les données ?</h3></div></div>
        <ul>{parentPrivacyPolicy.recipients.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section aria-labelledby="privacy-processor-title">
        <div className="privacy-section-title"><Database size={22} weight="fill" /><div><span>Sous-traitants</span><h3 id="privacy-processor-title">Quels prestataires techniques ?</h3></div></div>
        <div className="privacy-processor-list">
          {parentPrivacyPolicy.processors.map((processor) => <article key={processor.name}>
            <h4>{processor.name}</h4>
            <p>{processor.role}</p>
            <small>{processor.location}</small>
            {processor.url && <ExternalLink href={processor.url}>{processor.label}</ExternalLink>}
          </article>)}
        </div>
      </section>

      <section aria-labelledby="privacy-transfer-title">
        <div className="privacy-section-title"><GlobeHemisphereWest size={22} weight="fill" /><div><span>Transferts hors EEE</span><h3 id="privacy-transfer-title">Où les données sont-elles hébergées ?</h3></div></div>
        {parentPrivacyPolicy.transfers.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>

      <section aria-labelledby="privacy-retention-title">
        <div className="privacy-section-title"><Clock size={22} weight="fill" /><div><span>Durées</span><h3 id="privacy-retention-title">Combien de temps conservons-nous ?</h3></div></div>
        <div className="privacy-table-wrap">
          <table>
            <thead><tr><th>Données</th><th>Durée ou critère</th></tr></thead>
            <tbody>{parentPrivacyPolicy.retention.map((row) => <tr key={row.data}><td>{row.data}</td><td>{row.duration}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="privacy-rights-title">
        <div className="privacy-section-title"><HandHeart size={22} weight="fill" /><div><span>Vos droits</span><h3 id="privacy-rights-title">Comment garder la maîtrise ?</h3></div></div>
        <ul>{parentPrivacyPolicy.rights.map((right) => <li key={right}>{right}</li>)}</ul>
        <div className="privacy-contact-card">
          <EnvelopeSimple size={25} weight="fill" aria-hidden="true" />
          <p>Utilisez « Données et droits RGPD » dans l’espace protégé pour télécharger un export, déposer une demande et suivre son échéance, ou écrivez à <a href={`mailto:${privacyController.email}?subject=Demande%20RGPD%20Secret%20Clubhouse`}>{privacyController.email}</a>. Ne transmettez jamais le mot de passe par e-mail. Une preuve d’identité ne sera demandée qu’en cas de doute raisonnable. Chaque demande reçoit immédiatement une date limite et une réponse sous un mois.</p>
        </div>
      </section>

      <section aria-labelledby="privacy-child-rights-title">
        <div className="privacy-section-title"><UserCircle size={22} weight="fill" /><div><span>Enfants</span><h3 id="privacy-child-rights-title">Des droits qui appartiennent aussi à l’enfant</h3></div></div>
        <p>L’enfant peut ouvrir « Mes données et mes droits » dans son propre profil, télécharger ses données et déposer lui-même une demande avec des mots adaptés à son âge. Il peut aussi demander l’aide de son parent. Le parent peut gérer ou supprimer son profil depuis l’espace protégé. En cas de demandes différentes, l’intérêt supérieur et le niveau de compréhension de l’enfant sont pris en compte. Une version courte et illustrée est disponible dans l’onglet « Pour les enfants ».</p>
      </section>

      <section aria-labelledby="privacy-local-title">
        <div className="privacy-section-title"><ShieldCheck size={22} weight="fill" /><div><span>Terminal et sécurité</span><h3 id="privacy-local-title">Stockage local et protection</h3></div></div>
        <p>Le navigateur ou l’application conserve localement le jeton de session et, pour faciliter la connexion, l’e-mail parent. Secret Clubhouse n’ajoute aucun traceur publicitaire ou outil de mesure d’audience tiers. Les mots de passe sont hashés, les accès API sont authentifiés et les relations de contact sont vérifiées côté serveur. Aucun service ne peut toutefois promettre un risque zéro.</p>
      </section>

      <section aria-labelledby="privacy-complaint-title">
        <div className="privacy-section-title"><Scales size={22} weight="fill" /><div><span>Réclamation</span><h3 id="privacy-complaint-title">Contacter la CNIL</h3></div></div>
        <p>{privacyComplaint.text}</p>
        <ExternalLink href={privacyComplaint.url}>Adresser une plainte à la CNIL</ExternalLink>
      </section>

      <section aria-labelledby="privacy-update-title">
        <div className="privacy-section-title"><Clock size={22} weight="fill" /><div><span>Mises à jour</span><h3 id="privacy-update-title">Si cette politique change</h3></div></div>
        <p>La date de version est affichée en haut. Toute modification importante concernant une nouvelle finalité, un destinataire, un transfert ou l’exercice des droits sera signalée de manière visible avant son application lorsque la réglementation l’exige.</p>
      </section>
    </div>
  );
}

function ChildPrivacyPolicy({ onShowParent }) {
  return (
    <div className="privacy-policy privacy-policy--child">
      <div className="child-privacy-intro">
        <span><ShieldCheck size={34} weight="fill" /></span>
        <div><h3>Ta vie privée compte vraiment</h3><p>Les données, ce sont des informations sur toi. Voici ce que Secret Clubhouse en fait, avec des mots simples.</p></div>
      </div>
      <div className="child-privacy-grid">
        {childPrivacyCards.map((card) => {
          const Icon = childIcons[card.icon] ?? ShieldCheck;
          return <article key={card.title}><span><Icon size={27} weight="fill" aria-hidden="true" /></span><div><h4>{card.title}</h4><p>{card.text}</p></div></article>;
        })}
      </div>
      <aside className="child-privacy-help">
        <HandHeart size={28} weight="fill" />
        <div><strong>Quelque chose n’est pas clair ?</strong><p>Tu as le droit de demander. Parle à ton parent ou à un adulte de confiance. Tu peux aussi lire la version complète avec lui.</p><button type="button" onClick={onShowParent}>Lire la version pour les parents</button></div>
      </aside>
      <p className="child-privacy-cnil">La CNIL est une autorité qui aide à protéger les données. <ExternalLink href={privacyComplaint.url}>Découvrir comment lui écrire</ExternalLink>.</p>
    </div>
  );
}

export default function PrivacyPolicyModal({ audience, onAudienceChange, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="privacy-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`privacy-modal privacy-modal--${audience}`} role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <header className="privacy-modal__header">
          <div><span>Vie privée</span><h2 id="privacy-title">{audience === "child" ? "Tes données, simplement" : "Politique de confidentialité"}</h2><small>Version du {privacyPolicyVersion}</small></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Fermer la politique de confidentialité"><X size={22} weight="bold" /></button>
        </header>
        <nav className="privacy-audience-tabs" aria-label="Choisir la version de la politique">
          <button type="button" className={audience === "parent" ? "is-active" : ""} aria-pressed={audience === "parent"} onClick={() => onAudienceChange("parent")}><ShieldCheck size={18} weight="fill" /> Pour les parents</button>
          <button type="button" className={audience === "child" ? "is-active" : ""} aria-pressed={audience === "child"} onClick={() => onAudienceChange("child")}><Sparkle size={18} weight="fill" /> Pour les enfants</button>
        </nav>
        <div className="privacy-modal__content">
          {audience === "child"
            ? <ChildPrivacyPolicy onShowParent={() => onAudienceChange("parent")} />
            : <ParentPrivacyPolicy />}
        </div>
        <footer><button className="primary-button" type="button" onClick={onClose}>J’ai compris</button></footer>
      </section>
    </div>
  );
}
