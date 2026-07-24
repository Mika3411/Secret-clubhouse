import { lazy, Suspense, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Copy } from "@phosphor-icons/react/Copy";
import { IdentificationCard } from "@phosphor-icons/react/IdentificationCard";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { QrCode } from "@phosphor-icons/react/QrCode";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { UserPlus } from "@phosphor-icons/react/UserPlus";
import { X } from "@phosphor-icons/react/X";
import { copyContactId } from "./AuthenticatedShared";
import { createContactQrUrl } from "../public-app-url";
import "../styles/qr-modal.css";

const QrCodeGraphic = lazy(() => import("./QrCodeGraphic").then((module) => ({ default: module.QrCodeGraphic })));

export function QrModal({ child, onClose, onRequestAdd }) {
  const [idCopied, setIdCopied] = useState(false);
  const [mode, setMode] = useState("add");
  const [contactId, setContactId] = useState("");
  const [error, setError] = useState("");
  const contactUrl = createContactQrUrl({
    contactId: child.contactId,
    publicAppUrl: import.meta.env?.VITE_PUBLIC_APP_URL,
    browserOrigin: window.location.origin,
    native: Capacitor.isNativePlatform(),
  });

  const copyId = async () => {
    await copyContactId(child.contactId);
    setIdCopied(true);
  };

  const continueWithParent = (event) => {
    event.preventDefault();
    const normalizedId = contactId.trim().toUpperCase();
    if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(normalizedId)) {
      setError("Saisis un identifiant au format SC-123-456-789.");
      return;
    }
    if (normalizedId === child.contactId) {
      setError("Choisis l’identifiant d’un autre enfant.");
      return;
    }
    onRequestAdd(normalizedId);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="qr-modal-tabs" role="tablist" aria-label="Ajouter un ami">
          <button type="button" role="tab" aria-selected={mode === "add"} className={mode === "add" ? "is-active" : ""} onClick={() => setMode("add")}><UserPlus size={17} weight="bold" /> Ajouter</button>
          <button type="button" role="tab" aria-selected={mode === "share"} className={mode === "share" ? "is-active" : ""} onClick={() => setMode("share")}><QrCode size={17} weight="bold" /> Mon QR</button>
        </div>
        {mode === "add" ? <>
          <span className="add-friend-modal-icon"><UserPlus size={31} weight="fill" /></span>
          <h2 id="qr-title">Ajouter un ami</h2>
          <p>Saisis l’identifiant affiché sur son QR code. Ton parent terminera la demande.</p>
          <form className="child-add-friend-form" onSubmit={continueWithParent}>
            <label htmlFor="friend-contact-id">Identifiant de ton ami</label>
            <input id="friend-contact-id" value={contactId} onChange={(event) => { setContactId(event.target.value.toUpperCase().slice(0, 14)); setError(""); }} placeholder="SC-123-456-789" autoComplete="off" autoFocus />
            {error && <p className="child-add-friend-error" role="alert">{error}</p>}
            <div className="approval-steps"><span><ShieldCheck size={17} weight="fill" /> Aucun ami n’est ajouté sans l’accord du parent</span></div>
            <button className="primary-button" type="submit"><LockKey size={18} weight="fill" /> Continuer avec mon parent</button>
          </form>
        </> : <>
          {contactUrl ? (
            <div className="real-contact-qr" aria-label={`QR code de contact de ${child.name}`}>
              <Suspense fallback={<span className="session-restoring__spinner" role="status" aria-label="Création du QR code" />}>
                <QrCodeGraphic value={contactUrl} childName={child.name} contactId={child.contactId} />
              </Suspense>
            </div>
          ) : <p className="child-add-friend-error" role="alert">Le QR code est temporairement indisponible.</p>}
          <h2 id="qr-title">Identifiant de {child.name}</h2>
          <p>Présente ce QR code ou cet identifiant avec l’aide de ton parent.</p>
          <button type="button" className={`qr-contact-id ${idCopied ? "is-copied" : ""}`} onClick={copyId}><IdentificationCard size={18} weight="fill" /><span>{idCopied ? "Identifiant copié !" : child.contactId}</span>{idCopied ? <CheckCircle size={18} weight="fill" /> : <Copy size={17} weight="bold" />}</button>
          <div className="approval-steps">
            <span><CheckCircle size={17} weight="fill" /> L’identifiant cible un seul compte</span>
            <span><ShieldCheck size={17} weight="fill" /> Le parent approuve la demande</span>
          </div>
          <button className="primary-button" type="button" onClick={onClose}>J’ai compris</button>
        </>}
      </section>
    </div>
  );
}
