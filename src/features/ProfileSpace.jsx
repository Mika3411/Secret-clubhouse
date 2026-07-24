import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { Check } from "@phosphor-icons/react/Check";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Copy } from "@phosphor-icons/react/Copy";
import { DownloadSimple } from "@phosphor-icons/react/DownloadSimple";
import { GearSix } from "@phosphor-icons/react/GearSix";
import { IdentificationCard } from "@phosphor-icons/react/IdentificationCard";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Shield } from "@phosphor-icons/react/Shield";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { Trash } from "@phosphor-icons/react/Trash";
import { X } from "@phosphor-icons/react/X";
import { api } from "../api";
import { Avatar, AvatarIllustration, copyContactId, defaultAvatar } from "./AuthenticatedShared";
import { PushNotificationButton } from "./NotificationSettings";
import "../styles/profile.css";

export const privacyRightLabels = {
  access: "Accéder à mes données",
  rectification: "Faire corriger une donnée",
  erasure: "Demander l’effacement",
  restriction: "Limiter l’utilisation",
  objection: "M’opposer à une utilisation",
};

export const privacyStatusLabels = {
  submitted: "Reçue",
  in_review: "En cours",
  completed: "Terminée",
  rejected: "Refus motivé",
  cancelled: "Annulée",
};

export function DataRightsModal({ account, family, children = [], onClose, onDeleted }) {
  const isChild = account.role === "child";
  const subjects = isChild
    ? [account]
    : [account, ...children];
  const [subjectId, setSubjectId] = useState(account.id);
  const [requestType, setRequestType] = useState("access");
  const [details, setDetails] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const isPrimaryParent = !isChild && family?.role === "primary";
  const deletionPhrase = isPrimaryParent ? "SUPPRIMER MA FAMILLE" : "SUPPRIMER MON COMPTE";

  const refresh = async () => {
    const payload = await api.privacyRequests();
    setRequests(payload.requests ?? []);
  };

  useEffect(() => {
    let current = true;
    refresh()
      .catch((loadError) => { if (current) setError(loadError.message || "Impossible de charger vos demandes."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  const submitRequest = async (event) => {
    event.preventDefault();
    setBusy("request");
    setError("");
    setNotice("");
    try {
      const payload = await api.submitPrivacyRequest({ subjectId, type: requestType, details });
      setDetails("");
      setNotice(payload.acknowledgement);
      await refresh();
    } catch (submitError) {
      setError(submitError.message || "La demande n’a pas pu être enregistrée.");
    } finally {
      setBusy("");
    }
  };

  const downloadExport = async () => {
    setBusy("export");
    setError("");
    setNotice("");
    try {
      const payload = await api.privacyExport(subjectId);
      const subject = subjects.find((item) => item.id === subjectId) ?? account;
      const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `secret-clubhouse-donnees-${String(subject.name || subject.role).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      setNotice("L’export lisible a été téléchargé sur cet appareil.");
    } catch (exportError) {
      setError(exportError.message || "L’export n’a pas pu être préparé.");
    } finally {
      setBusy("");
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    if (confirmation !== deletionPhrase) return;
    setBusy("delete");
    setError("");
    try {
      const payload = { confirmation, currentPassword: password };
      if (isPrimaryParent) await api.deleteFamily(payload);
      else await api.deleteParentAccount(payload);
      onDeleted();
    } catch (deleteError) {
      setError(deleteError.message || "La suppression n’a pas pu être effectuée.");
      setBusy("");
    }
  };

  return createPortal((
    <div className="modal-backdrop data-rights-backdrop" role="presentation">
      <section className="data-rights-modal" role="dialog" aria-modal="true" aria-labelledby="data-rights-title">
        <header>
          <span className="data-rights-modal__icon"><ShieldCheck size={25} weight="fill" /></span>
          <div><small>{isChild ? "Tes informations" : "Espace protégé"}</small><h2 id="data-rights-title">{isChild ? "Mes données et mes droits" : "Données et droits RGPD"}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        </header>

        <div className="data-rights-modal__body">
          <p className="data-rights-intro">{isChild
            ? "Tes droits sont aussi les tiens. Tu peux faire une demande ici, seul ou avec l’aide de ton parent, avec des mots simples."
            : "Téléchargez les données lisibles de votre compte ou d’un enfant, puis suivez chaque demande jusqu’à sa réponse sous un mois."}</p>
          {account.processingRestrictedAt && <p className="data-rights-restriction"><LockKey size={17} weight="fill" /> L’utilisation de ce compte est limitée. Les fonctions ordinaires restent bloquées ; vos droits, l’export et la suppression restent disponibles.</p>}

          <label className="data-rights-field">
            <span>Personne concernée</span>
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.id === account.id ? `${subject.name} (moi)` : subject.name}</option>)}
            </select>
          </label>

          <button type="button" className="data-rights-export" onClick={downloadExport} disabled={Boolean(busy)}>
            <DownloadSimple size={20} weight="bold" />
            <span><strong>{busy === "export" ? "Préparation…" : "Télécharger les données lisibles"}</strong><small>Compte, contacts, messages envoyés, jeux, appels et réglages · JSON</small></span>
          </button>
          {!isChild && <p className="data-rights-privacy-note"><LockKey size={16} weight="fill" /> Les messages enfant–ami restent masqués si le parent ne participe pas à la conversation.</p>}

          <form className="data-rights-form" onSubmit={submitRequest}>
            <h3>Faire une demande</h3>
            <label className="data-rights-field">
              <span>Mon droit</span>
              <select value={requestType} onChange={(event) => setRequestType(event.target.value)}>
                {Object.entries(privacyRightLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="data-rights-field">
              <span>{isChild ? "Explique ce que tu souhaites" : "Précisez votre demande"}</span>
              <textarea value={details} onChange={(event) => setDetails(event.target.value.slice(0, 2000))} minLength={10} maxLength={2000} required placeholder={isChild ? "Par exemple : je veux corriger mon prénom…" : "Décrivez la donnée ou le traitement concerné…"} />
              <small>{details.length}/2 000</small>
            </label>
            <button type="submit" className="primary-button" disabled={Boolean(busy) || details.trim().length < 10}><PaperPlaneTilt size={18} weight="fill" /> {busy === "request" ? "Enregistrement…" : "Envoyer ma demande"}</button>
          </form>

          {(notice || error) && <p className={`data-rights-feedback ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</p>}

          <section className="data-rights-followup" aria-labelledby="data-rights-followup-title">
            <h3 id="data-rights-followup-title">Suivi de mes demandes</h3>
            {loading && <p>Chargement…</p>}
            {!loading && requests.length === 0 && <p>Aucune demande enregistrée.</p>}
            {requests.map((request) => (
              <article key={request.id}>
                <span className={`data-rights-status data-rights-status--${request.status}`}>{privacyStatusLabels[request.status] ?? request.status}</span>
                <strong>{privacyRightLabels[request.type] ?? request.type} · {request.subject.name}</strong>
                <small>Reçue le {new Date(request.createdAt).toLocaleDateString("fr-FR")} · réponse avant le {new Date(request.dueAt).toLocaleDateString("fr-FR")}</small>
                {request.response && <p>{request.response}</p>}
              </article>
            ))}
          </section>

          <aside className="data-rights-contact">
            <Shield size={19} weight="fill" />
            <span><strong>Besoin d’aide ou d’un autre format ?</strong><small>Écrivez au contact RGPD. Une réponse est suivie sous un mois.</small></span>
            <a href="mailto:contact@secret-clubhouse.fr">contact@secret-clubhouse.fr</a>
          </aside>

          {!isChild && (
            <form className="data-rights-delete" onSubmit={deleteAccount}>
              <h3>{isPrimaryParent ? "Supprimer toute la famille" : "Supprimer mon compte parent"}</h3>
              <p>{isPrimaryParent
                ? "Cette action supprime définitivement tous les parents, enfants, conversations, médias, contacts, appels et jeux de la famille."
                : "Votre compte disparaîtra sans supprimer les autres membres ni les données de la famille."} Les sauvegardes expirent sous sept jours et l’effacement est réappliqué en cas de restauration.</p>
              <label className="data-rights-field"><span>Mot de passe actuel</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
              <label className="data-rights-field"><span>Recopiez {deletionPhrase}</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
              <button type="submit" disabled={Boolean(busy) || password.length < 8 || confirmation !== deletionPhrase}><Trash size={18} weight="bold" /> {busy === "delete" ? "Suppression…" : "Supprimer définitivement"}</button>
            </form>
          )}
        </div>
      </section>
    </div>
  ), document.body);
}

export function ProfileScreen({ child, features, onOpenPreferences, onOpenDataRights, onLogout }) {
  const [idCopied, setIdCopied] = useState(false);

  const copyOwnId = async () => {
    await copyContactId(child.contactId);
    setIdCopied(true);
  };

  return (
    <section className="feature-screen profile-screen">
      <Avatar person={child} size="hero" />
      <span className="eyebrow">Mon espace</span>
      <h1>{child.name}</h1>
      <span className="child-username">@{child.username}</span>
      <button type="button" className="profile-primary-action" onClick={onOpenPreferences}>
        <span><GearSix size={22} weight="fill" /></span>
        <span><strong>Modifier mon avatar</strong><small>Coiffure, visage, couleurs et tenue</small></span>
        <CaretRight size={20} weight="bold" />
      </button>
      <button type="button" className={`child-contact-id ${idCopied ? "is-copied" : ""}`} onClick={copyOwnId}>
        <span><IdentificationCard size={22} weight="fill" /></span>
        <span><strong>Mon identifiant de contact</strong><small>{idCopied ? "Identifiant copié !" : child.contactId}</small></span>
        {idCopied ? <CheckCircle size={20} weight="fill" /> : <Copy size={19} weight="bold" />}
      </button>
      <div className="parent-card">
        <ShieldCheck size={28} weight="fill" />
        <div><strong>Compte protégé</strong><span>Géré par un parent</span></div>
      </div>
      <PushNotificationButton features={features} />
      <button type="button" className="secondary-button child-data-rights-button" onClick={onOpenDataRights}><ShieldCheck size={19} weight="fill" /> Mes données et mes droits</button>
      <button type="button" className="child-logout-button" onClick={onLogout}><SignOut size={18} weight="bold" /> Se déconnecter</button>
    </section>
  );
}

export const avatarChoices = [
  { key: "hair", label: "Coiffure", choices: [{ id: "short", label: "Courte" }, { id: "bob", label: "Carré" }, { id: "curly", label: "Boucles" }, { id: "spiky", label: "Pics" }, { id: "bun", label: "Chignon" }, { id: "long", label: "Longue" }, { id: "braids", label: "Tresses" }, { id: "afro", label: "Afro" }, { id: "ponytail", label: "Queue" }, { id: "waves", label: "Vagues" }] },
  { key: "hairColor", label: "Cheveux", choices: [{ id: "brown", label: "Brun" }, { id: "black", label: "Noir" }, { id: "blond", label: "Blond" }, { id: "ginger", label: "Roux" }, { id: "violet", label: "Violet" }, { id: "chestnut", label: "Châtain" }, { id: "pink", label: "Rose" }, { id: "blue", label: "Bleu" }, { id: "teal", label: "Turquoise" }, { id: "silver", label: "Argent" }] },
  { key: "face", label: "Visage", choices: [{ id: "smile", label: "Sourire" }, { id: "happy", label: "Joyeux" }, { id: "calm", label: "Calme" }, { id: "freckles", label: "Taches" }, { id: "wink", label: "Clin d’œil" }, { id: "laugh", label: "Rire" }, { id: "surprised", label: "Surpris" }, { id: "shy", label: "Timide" }, { id: "star", label: "Étoiles" }, { id: "confident", label: "Confiant" }] },
  { key: "skin", label: "Peau", choices: [{ id: "light", label: "Très claire" }, { id: "porcelain", label: "Porcelaine" }, { id: "warm", label: "Claire" }, { id: "peach", label: "Pêche" }, { id: "tan", label: "Dorée" }, { id: "olive", label: "Olive" }, { id: "caramel", label: "Caramel" }, { id: "brown", label: "Brune" }, { id: "deep", label: "Foncée" }, { id: "ebony", label: "Ébène" }] },
  { key: "outfit", label: "Vêtements", choices: [{ id: "mint", label: "Menthe" }, { id: "violet", label: "Violet" }, { id: "coral", label: "Corail" }, { id: "sun", label: "Soleil" }, { id: "blue", label: "Bleu" }, { id: "rose", label: "Rose" }, { id: "teal", label: "Turquoise" }, { id: "navy", label: "Indigo" }, { id: "lilac", label: "Lilas" }, { id: "orange", label: "Orange" }] },
];

export function AvatarPreferencesScreen({ child, onBack, onSave }) {
  const [draft, setDraft] = useState({ ...defaultAvatar, ...(child.avatar ?? {}) });
  const [activeCategory, setActiveCategory] = useState("hair");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const category = avatarChoices.find((item) => item.key === activeCategory);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      onBack();
    } catch {
      setError("Ton avatar n’a pas encore pu être enregistré. Réessaie dans un moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="avatar-maker-screen">
      <header className="feature-header avatar-maker-header">
        <button type="button" onClick={onBack} aria-label="Retour"><ArrowLeft size={22} weight="bold" /></button>
        <div><span className="eyebrow">Mes préférences</span><h1>Mon avatar</h1></div>
        <span className="avatar-maker-header__sparkle"><Sparkle size={20} weight="fill" /></span>
      </header>
      <div className="avatar-maker-preview">
        <span className="avatar-maker-preview__halo" aria-hidden="true" />
        <Avatar person={{ ...child, image: null, avatar: draft }} size="maker" />
        <strong>Crée un avatar qui te ressemble</strong>
        <small>Tu peux le modifier quand tu veux.</small>
      </div>
      <div className="avatar-maker-tabs" role="tablist" aria-label="Parties de l’avatar">
        {avatarChoices.map((item) => <button key={item.key} type="button" role="tab" aria-selected={activeCategory === item.key} className={activeCategory === item.key ? "is-active" : ""} onClick={() => setActiveCategory(item.key)}>{item.label}</button>)}
      </div>
      <section className="avatar-maker-options" aria-label={category.label}>
        <h2>Choisis : {category.label.toLowerCase()}</h2>
        <div>
          {category.choices.map((choice) => (
            <button key={choice.id} type="button" className={`${draft[category.key] === choice.id ? "is-selected" : ""} avatar-choice avatar-choice--${category.key}`} onClick={() => setDraft((current) => ({ ...current, [category.key]: choice.id }))} aria-pressed={draft[category.key] === choice.id}>
              <span className={`avatar-choice__sample avatar-choice__sample--${choice.id}`} aria-hidden="true">{["hair", "face"].includes(category.key) ? <AvatarIllustration avatar={{ ...draft, [category.key]: choice.id }} name="" /> : null}</span>
              <small>{choice.label}</small>
              {draft[category.key] === choice.id && <CheckCircle size={17} weight="fill" />}
            </button>
          ))}
        </div>
      </section>
      {error && <p className="avatar-maker-error" role="alert">{error}</p>}
      <button type="button" className="avatar-maker-save" onClick={save} disabled={saving}><Check size={20} weight="bold" /> {saving ? "Enregistrement…" : "Enregistrer mon avatar"}</button>
    </section>
  );
}
