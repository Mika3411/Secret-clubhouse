import { useEffect, useRef } from "react";
import { Copyright } from "@phosphor-icons/react/Copyright";
import { EnvelopeSimple } from "@phosphor-icons/react/EnvelopeSimple";
import { HardDrives } from "@phosphor-icons/react/HardDrives";
import { IdentificationCard } from "@phosphor-icons/react/IdentificationCard";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { X } from "@phosphor-icons/react/X";
import {
  legalHost,
  legalNoticeSections,
  legalNoticeVersion,
  legalPublisher,
} from "./legal-notice.js";

const sectionIcons = [IdentificationCard, ShieldCheck, Copyright, ShieldCheck];

export default function LegalNoticeModal({ onClose }) {
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
    <div className="terms-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="terms-modal legal-notice-modal" role="dialog" aria-modal="true" aria-labelledby="legal-notice-title">
        <header className="terms-modal__header">
          <div><span>Informations légales</span><h2 id="legal-notice-title">Mentions légales</h2><small>Version du {legalNoticeVersion}</small></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Fermer les mentions légales"><X size={21} weight="bold" /></button>
        </header>
        <div className="terms-modal__content legal-notice-content">
          <aside><IdentificationCard size={21} weight="fill" /><span><strong>{legalPublisher.name}</strong> Éditeur particulier non professionnel de Secret Clubhouse. Service gratuit.</span></aside>

          {legalNoticeSections.map((section, index) => {
            const Icon = sectionIcons[index] ?? ShieldCheck;
            return (
              <article key={section.title} className="legal-notice-section">
                <h3><Icon size={19} weight="fill" /> {section.title}</h3>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </article>
            );
          })}

          <article className="legal-notice-section legal-host-card">
            <h3><HardDrives size={19} weight="fill" /> Hébergement</h3>
            <p><strong>{legalHost.name}</strong><br />{legalHost.address}</p>
            <p>Téléphone : <a href={`tel:${legalHost.phoneHref}`}>{legalHost.phoneDisplay}</a><br />E-mail juridique : <a href={`mailto:${legalHost.email}`}>{legalHost.email}</a></p>
            <p><a href={legalHost.termsUrl} target="_blank" rel="noreferrer">Informations officielles de Render</a></p>
          </article>

          <article className="legal-notice-section legal-contact-card">
            <h3><EnvelopeSimple size={19} weight="fill" /> Contacter l’éditeur</h3>
            <p>Pour toute question concernant Secret Clubhouse : <a href={`mailto:${legalPublisher.email}`}>{legalPublisher.email}</a>.</p>
          </article>
        </div>
        <footer><button className="primary-button" type="button" onClick={onClose}>Fermer</button></footer>
      </section>
    </div>
  );
}
