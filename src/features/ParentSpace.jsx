import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Bell } from "@phosphor-icons/react/Bell";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { Check } from "@phosphor-icons/react/Check";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Clock } from "@phosphor-icons/react/Clock";
import { Copy } from "@phosphor-icons/react/Copy";
import { DeviceMobile } from "@phosphor-icons/react/DeviceMobile";
import { GameController } from "@phosphor-icons/react/GameController";
import { GearSix } from "@phosphor-icons/react/GearSix";
import { IdentificationCard } from "@phosphor-icons/react/IdentificationCard";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Phone } from "@phosphor-icons/react/Phone";
import { Plus } from "@phosphor-icons/react/Plus";
import { Shield } from "@phosphor-icons/react/Shield";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { Trash } from "@phosphor-icons/react/Trash";
import { UserCircle } from "@phosphor-icons/react/UserCircle";
import { UserPlus } from "@phosphor-icons/react/UserPlus";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { VideoCamera } from "@phosphor-icons/react/VideoCamera";
import { X } from "@phosphor-icons/react/X";
import { defaultCommunicationSchedule } from "../app-core";
import { childUsernameMaxLength, normalizeChildUsername } from "../child-username";
import { Avatar, ParentModeNavigation, copyContactId } from "./AuthenticatedShared";
import { ChildNotificationConsentSetting, PushNotificationButton } from "./NotificationSettings";
import "../styles/parent.css";

export function ParentPasswordModal({ onClose, onSave }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const submitPassword = async (event) => {
    event.preventDefault();
    if (currentPassword.length < 8) {
      setError("Saisissez votre mot de passe actuel.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("Le nouveau mot de passe doit contenir entre 8 et 128 caractères.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choisissez un mot de passe différent de l’ancien.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onSave({ currentPassword, newPassword });
      setIsComplete(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onClose}>
      <section className="parent-password-modal" role="dialog" aria-modal="true" aria-labelledby="parent-password-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer" disabled={isSaving}><X size={21} weight="bold" /></button>
        {isComplete ? <div className="parent-password-success"><span><CheckCircle size={36} weight="fill" /></span><h2 id="parent-password-title">Mot de passe modifié</h2><p>Votre nouveau mot de passe est actif. Votre session actuelle reste ouverte.</p><button type="button" className="primary-button" onClick={onClose}>Terminer</button></div> : <>
          <div className="parent-password-heading"><span><LockKey size={28} weight="fill" /></span><div><small>Sécurité du compte parent</small><h2 id="parent-password-title">Modifier le mot de passe</h2><p>Confirmez d’abord votre mot de passe actuel.</p></div></div>
          <form className="parent-password-form" onSubmit={submitPassword}>
            <label><span>Mot de passe actuel</span><span className="parent-password-field"><input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }} autoComplete="current-password" placeholder="Votre mot de passe actuel" autoFocus /><button type="button" onClick={() => setShowCurrentPassword((current) => !current)} aria-label={showCurrentPassword ? "Masquer le mot de passe actuel" : "Afficher le mot de passe actuel"}>{showCurrentPassword ? <EyeSlash size={19} weight="bold" /> : <Eye size={19} weight="bold" />}</button></span></label>
            <label><span>Nouveau mot de passe</span><span className="parent-password-field"><input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(""); }} autoComplete="new-password" placeholder="8 caractères minimum" maxLength={128} /><button type="button" onClick={() => setShowNewPassword((current) => !current)} aria-label={showNewPassword ? "Masquer le nouveau mot de passe" : "Afficher le nouveau mot de passe"}>{showNewPassword ? <EyeSlash size={19} weight="bold" /> : <Eye size={19} weight="bold" />}</button></span></label>
            <label><span>Confirmer le nouveau mot de passe</span><input type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} autoComplete="new-password" placeholder="Retapez le nouveau mot de passe" maxLength={128} /></label>
            <div className="password-security-note"><ShieldCheck size={17} weight="fill" /><span>Le mot de passe est protégé de façon sécurisée et n’est jamais affiché aux enfants.</span></div>
            {error && <p className="parent-password-error" role="alert">{error}</p>}
            <div className="parent-password-actions"><button type="button" onClick={onClose} disabled={isSaving}>Annuler</button><button type="submit" disabled={isSaving}>{isSaving ? "Enregistrement…" : "Modifier le mot de passe"}</button></div>
          </form>
        </>}
      </section>
    </div>
  );
}

export function FamilyInviteAcceptanceModal({ invitation, parent, onAccept, onUseAnotherAccount, onDismiss }) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");
  const emailMatches = !invitation.email || invitation.email.toLowerCase() === String(parent.email ?? "").toLowerCase();

  const accept = async () => {
    setIsAccepting(true);
    setError("");
    try {
      await onAccept();
    } catch (acceptError) {
      setError(acceptError.message || "Impossible d’accepter cette invitation.");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="family-invite-acceptance" role="dialog" aria-modal="true" aria-labelledby="family-invite-acceptance-title">
        <button type="button" className="modal-close" onClick={onDismiss} aria-label="Fermer" disabled={isAccepting}><X size={21} weight="bold" /></button>
        <span className="family-invite-acceptance__icon"><UsersThree size={34} weight="fill" /></span>
        <small>Invitation de co-parent</small>
        <h2 id="family-invite-acceptance-title">Rejoindre {invitation.familyName}</h2>
        <p><strong>{invitation.invitedByName}</strong> souhaite vous donner accès aux mêmes profils enfant et réglages familiaux.</p>
        <div className={`family-invite-account ${emailMatches ? "" : "has-error"}`}><UserCircle size={23} weight="fill" /><span><strong>{parent.name}</strong><small>{parent.email}</small></span>{emailMatches ? <CheckCircle size={19} weight="fill" /> : <X size={18} weight="bold" />}</div>
        {!emailMatches && <p className="family-invite-error" role="alert">Cette invitation est destinée à {invitation.email}. Utilisez le compte correspondant.</p>}
        {error && <p className="family-invite-error" role="alert">{error}</p>}
        <div className="family-invite-acceptance__actions">
          <button type="button" onClick={onUseAnotherAccount} disabled={isAccepting}>Utiliser un autre compte</button>
          <button type="button" onClick={accept} disabled={!emailMatches || isAccepting}><CheckCircle size={18} weight="fill" /> {isAccepting ? "Acceptation…" : "Accepter l’invitation"}</button>
        </div>
      </section>
    </div>
  );
}

export function FamilyInviteErrorModal({ message, onDismiss }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onDismiss}>
      <section className="family-invite-acceptance" role="dialog" aria-modal="true" aria-labelledby="family-invite-error-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onDismiss} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <span className="family-invite-acceptance__icon family-invite-acceptance__icon--error"><X size={30} weight="bold" /></span>
        <small>Invitation indisponible</small>
        <h2 id="family-invite-error-title">Ce lien ne peut plus être utilisé</h2>
        <p>{message}</p>
        <button type="button" className="primary-button family-parents-close" onClick={onDismiss}>Revenir à ma famille</button>
      </section>
    </div>
  );
}

export function FamilyParentsModal({ family, currentParent, onClose, onInvite, onRevoke, onRemove }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [createdInvitation, setCreatedInvitation] = useState(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const isPrimary = family?.role === "primary";
  const members = family?.members ?? [];
  const invitations = family?.pendingInvitations ?? [];

  const inviteParent = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Saisissez l’adresse e-mail valide du co-parent.");
      return;
    }
    setBusyAction("invite");
    setError("");
    try {
      const result = await onInvite(cleanEmail);
      const invitation = result?.invitation ?? result;
      setCreatedInvitation(invitation);
      setEmail("");
    } catch (inviteError) {
      setError(inviteError.message || "Impossible de créer l’invitation.");
    } finally {
      setBusyAction("");
    }
  };

  const copyInvitationLink = async (invitation) => {
    const link = invitation?.link ?? invitation?.inviteUrl ?? invitation?.invite_url;
    if (!link) {
      setError("Le lien secret n’est affiché qu’au moment de créer l’invitation. Révoquez-la et créez-en une nouvelle si nécessaire.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInvitationId(invitation.id ?? "new");
    } catch {
      setError("Le presse-papiers est indisponible. Sélectionnez et copiez le lien manuellement.");
    }
  };

  const revokeInvitation = async (invitationId) => {
    setBusyAction(`revoke-${invitationId}`);
    setError("");
    try {
      await onRevoke(invitationId);
      if (createdInvitation?.id === invitationId) setCreatedInvitation(null);
    } catch (revokeError) {
      setError(revokeError.message || "Impossible de révoquer cette invitation.");
    } finally {
      setBusyAction("");
    }
  };

  const removeParent = async (member) => {
    if (confirmRemoveId !== member.id) {
      setConfirmRemoveId(member.id);
      return;
    }
    setBusyAction(`remove-${member.id}`);
    setError("");
    try {
      await onRemove(member.id);
      setConfirmRemoveId(null);
    } catch (removeError) {
      setError(removeError.message || "Impossible de retirer ce co-parent.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={busyAction ? undefined : onClose}>
      <section className="family-parents-modal" role="dialog" aria-modal="true" aria-labelledby="family-parents-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer" disabled={Boolean(busyAction)}><X size={21} weight="bold" /></button>
        <div className="family-parents-heading"><span><UsersThree size={29} weight="fill" /></span><div><small>Accès adultes protégés</small><h2 id="family-parents-title">Parents de la famille</h2><p>Chaque parent utilise son propre compte.</p></div></div>

        <div className="family-role-note"><ShieldCheck size={18} weight="fill" /><span><strong>{isPrimary ? "Vous êtes le parent principal" : "Vous êtes co-parent"}</strong><small>{isPrimary ? "Vous contrôlez les invitations, les retraits et les suppressions définitives." : "Vous pouvez gérer les profils et leurs règles, sans supprimer la famille."}</small></span></div>

        <div className="family-parent-list">
          {members.map((member) => {
            const isCurrent = member.isCurrent || member.id === currentParent.id;
            const canRemove = isPrimary && member.role === "coparent" && !isCurrent;
            return <article className="family-parent-card" key={member.id}>
              <span className={`family-parent-avatar ${member.role === "primary" ? "is-primary" : ""}`}><UserCircle size={27} weight="fill" /></span>
              <div><strong>{member.name}{isCurrent ? " · vous" : ""}</strong><small>{member.email}</small><span>{member.role === "primary" ? "Parent principal" : "Co-parent"}</span></div>
              {canRemove ? <button type="button" className={confirmRemoveId === member.id ? "is-confirming" : ""} onClick={() => removeParent(member)} disabled={busyAction === `remove-${member.id}`} aria-label={`Retirer ${member.name}`}><Trash size={16} weight="bold" /><span>{busyAction === `remove-${member.id}` ? "Retrait…" : confirmRemoveId === member.id ? "Confirmer" : "Retirer"}</span></button> : <ShieldCheck size={19} weight="fill" />}
            </article>;
          })}
        </div>

        {isPrimary && <form className="family-invite-form" onSubmit={inviteParent}>
          <div><span><UserPlus size={20} weight="fill" /></span><div><strong>Inviter un co-parent</strong><small>Le lien expire et fonctionne seulement avec cette adresse e-mail.</small></div></div>
          <label htmlFor="coparent-email">Adresse e-mail</label>
          <div className="family-invite-field"><input id="coparent-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="coparent@exemple.fr" autoComplete="email" disabled={busyAction === "invite"} /><button type="submit" disabled={busyAction === "invite"}><UserPlus size={17} weight="bold" /> {busyAction === "invite" ? "Création…" : "Inviter"}</button></div>
        </form>}

        {createdInvitation?.link && <div className="family-created-invite" role="status"><CheckCircle size={19} weight="fill" /><span><strong>Invitation prête pour {createdInvitation.email}</strong><small>Copiez ce lien maintenant : le secret ne sera plus affiché ensuite.</small><code>{createdInvitation.link}</code></span><button type="button" onClick={() => copyInvitationLink(createdInvitation)}>{copiedInvitationId === createdInvitation.id ? <CheckCircle size={17} weight="fill" /> : <Copy size={17} weight="bold" />}{copiedInvitationId === createdInvitation.id ? "Copié" : "Copier"}</button></div>}

        {invitations.length > 0 && <section className="family-pending-invites" aria-labelledby="pending-family-invites-title"><h3 id="pending-family-invites-title">Invitations en attente</h3>{invitations.map((invitation) => <article key={invitation.id}><span><strong>{invitation.email}</strong><small>Expire le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(invitation.expiresAt))}</small></span>{isPrimary && <button type="button" onClick={() => revokeInvitation(invitation.id)} disabled={busyAction === `revoke-${invitation.id}`}><X size={15} weight="bold" /> {busyAction === `revoke-${invitation.id}` ? "Révocation…" : "Révoquer"}</button>}</article>)}</section>}

        {error && <p className="family-invite-error" role="alert">{error}</p>}
        <button type="button" className="primary-button family-parents-close" onClick={onClose} disabled={Boolean(busyAction)}>Terminer</button>
      </section>
    </div>
  );
}

export function PausedChildScreen({ child, onParentLogin }) {
  return (
    <section className="feature-screen paused-child-screen" aria-labelledby="paused-child-title">
      <span className="paused-lock"><LockKey size={38} weight="fill" /></span>
      <span className="eyebrow">Compte en pause</span>
      <h1 id="paused-child-title">À bientôt, {child.name}</h1>
      <p>Un parent a temporairement mis ce profil en pause.</p>
      <button className="primary-button" type="button" onClick={onParentLogin}><ShieldCheck size={19} weight="fill" /> Connexion parent</button>
    </section>
  );
}

export function NoChildScreen({ onOpenParent }) {
  return (
    <section className="feature-screen paused-child-screen" aria-labelledby="no-child-title">
      <span className="paused-lock"><UserPlus size={38} weight="fill" /></span>
      <span className="eyebrow">Espace familial</span>
      <h1 id="no-child-title">Aucun profil enfant</h1>
      <p>Ajoutez un enfant depuis l’espace parent pour commencer.</p>
      <button className="primary-button" type="button" onClick={onOpenParent}><ShieldCheck size={19} weight="fill" /> Ouvrir l’espace parent</button>
    </section>
  );
}

export function SafetyToggle({ icon: Icon, title, detail, checked, onChange }) {
  return (
    <button className="safety-setting" type="button" role="switch" aria-checked={checked} onClick={onChange}>
      <span className="setting-icon"><Icon size={20} weight="fill" /></span>
      <span className="setting-copy"><strong>{title}</strong><small>{detail}</small></span>
      <span className={`toggle ${checked ? "is-on" : ""}`} aria-hidden="true"><span /></span>
    </button>
  );
}

export function ChildProfilesPanel({ children, activeChildId, onSelectChild, onAddChild }) {
  return (
    <section className="children-panel" aria-labelledby="children-title" data-profile-count={children.length}>
      <div className="children-panel__heading">
        <div><span>Famille</span><h2 id="children-title">Mes enfants</h2></div>
        <button type="button" className="add-child-button" onClick={onAddChild}><Plus size={18} weight="bold" /> Ajouter</button>
      </div>
      <div className={`child-profile-list child-profile-list--count-${Math.min(children.length, 4)}`}>
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            className={`child-profile-chip ${activeChildId === child.id ? "is-selected" : ""}`}
            onClick={() => onSelectChild(child.id)}
            aria-pressed={activeChildId === child.id}
          >
            <Avatar person={child} size="child-tab" />
            <span><strong>{child.name}</strong><small>{child.age} ans · {child.status === "active" ? "Actif" : "En pause"}</small></span>
            {activeChildId === child.id && <CheckCircle size={18} weight="fill" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </section>
  );
}

export function formatScheduleTime(value) {
  const [hours, minutes] = value.split(":");
  return `${Number(hours)} h ${minutes}`;
}

export function ParentDashboard({ activeSection, onChangeSection, parentName, family, children, child, features, onSelectChild, onAddChild, onEditChild, onMessageChild, settings, onToggleSetting, schedule, contactRequests = [], contactRelationships = [], contactRequestBusyId = "", contactRequestError = "", onRespondToContactRequest, onRetryContactRequests, unreadMessages, onOpenMessages, onOpenGames, onOpenFamilyParents, onOpenContactIds, onOpenPassword, onOpenDataRights, onEditSchedule, onLogout }) {
  const notificationsEnabled = Capacitor.isNativePlatform()
    ? features?.nativePush === true
    : features?.webPush === true;
  const scheduleDetail = schedule.enabled ? `Messages ${formatScheduleTime(schedule.messages.start)}–${formatScheduleTime(schedule.messages.end)}` : "Planification désactivée";
  const isHome = activeSection === "home";
  const pendingRequests = contactRequests.filter((request) => request.status === "pending");
  const selectedChildRequests = child
    ? pendingRequests.filter((request) => request.requester.id === child.id || request.target.id === child.id)
    : [];
  const selectedChildContacts = child
    ? contactRelationships.filter((relationship) => relationship.account.id === child.id)
    : [];

  return (
    <section className="parent-dashboard" aria-labelledby="parent-dashboard-title">
      <header className="parent-topbar">
        <div>
          <span className="parent-topbar__eyebrow"><ShieldCheck size={15} weight="fill" /> Mode parent</span>
          <h1 id="parent-dashboard-title">{isHome ? `Bonjour, ${parentName}` : "Gestion de la famille"}</h1>
        </div>
        <div className="parent-topbar__actions">
          <span className="parent-avatar" aria-label={`Profil de ${parentName}`} role="img"><UserCircle size={30} weight="fill" /></span>
          <button type="button" className="parent-logout-button" onClick={onLogout}><SignOut size={19} weight="bold" /><span>Déconnexion</span></button>
        </div>
      </header>
      <div className={`parent-content parent-content--${activeSection}`}>
        {isHome && <>
        {!child && (
          <section className="empty-family-card" aria-labelledby="empty-family-title">
            <span><UserPlus size={34} weight="fill" /></span>
            <div><span>Première étape</span><h2 id="empty-family-title">Ajoutez votre premier enfant</h2><p>Créez un identifiant privé adapté aux 6–13 ans. Aucun numéro de téléphone ne sera demandé.</p></div>
            <button className="primary-button" type="button" onClick={onAddChild}><Plus size={18} weight="bold" /> Créer un profil enfant</button>
          </section>
        )}

        {child && pendingRequests.length > 0 && (
          <section className="parent-attention-card" aria-labelledby="parent-attention-title">
            <span className="parent-attention-card__icon"><Bell size={24} weight="fill" /></span>
            <div>
              <small>Votre attention</small>
              <h2 id="parent-attention-title">{pendingRequests.length} demande{pendingRequests.length > 1 ? "s" : ""} à vérifier</h2>
              <p>{selectedChildRequests.length > 0 ? `${selectedChildRequests.length} concerne${selectedChildRequests.length > 1 ? "nt" : ""} ${child.name}.` : "Une autre personne de la famille est concernée."}</p>
            </div>
            <button type="button" onClick={() => onChangeSection("management")}>Examiner <CaretRight size={17} weight="bold" /></button>
          </section>
        )}

        {child && pendingRequests.length === 0 && (
          <section className="parent-all-clear" aria-label="État de la famille">
            <span><CheckCircle size={22} weight="fill" /></span>
            <div><strong>Tout va bien</strong><small>Aucune demande ni alerte n’attend votre réponse.</small></div>
          </section>
        )}

        {child && <>
        <section className={`child-overview ${child.status === "paused" ? "is-paused" : ""}`} aria-label={`Compte enfant de ${child.name}`}>
          <Avatar person={child} size="parent-child" />
          <div><span>Enfant actuellement sélectionné</span><strong>{child.name}</strong><small>@{child.username} · {child.age} ans · {child.status === "active" ? "Compte actif" : "Compte en pause"}</small></div>
          <div className="child-overview__actions">
            <button type="button" className="child-message-action" onClick={onMessageChild} aria-label={`Écrire à ${child.name}`} title={`Écrire à ${child.name}`}><ChatCircleDots size={20} weight="fill" /></button>
            <button type="button" className="child-edit-button" onClick={onEditChild} aria-label={`Modifier le profil de ${child.name}`} title="Modifier le profil"><PencilSimple size={19} weight="bold" /></button>
          </div>
        </section>

        <section className="parent-protection-summary" aria-labelledby="parent-protection-title">
          <div className="parent-protection-summary__heading">
            <span className="section-icon section-icon--violet"><ShieldCheck size={20} weight="fill" /></span>
            <div><small>État des protections</small><h2 id="parent-protection-title">Protections de {child.name}</h2></div>
            <strong className={child.status === "active" ? "is-safe" : "is-paused"}>{child.status === "active" ? "Actives" : "En pause"}</strong>
          </div>
          <div className="parent-protection-summary__items">
            <span><Shield size={18} weight="fill" /><strong>Contacts</strong><small>{selectedChildContacts.length} approuvé{selectedChildContacts.length > 1 ? "s" : ""}</small></span>
            <span><Clock size={18} weight="fill" /><strong>Mode calme</strong><small>{schedule.enabled ? `${formatScheduleTime(schedule.messages.start)}–${formatScheduleTime(schedule.messages.end)}` : "À configurer"}</small></span>
            <span><DeviceMobile size={18} weight="fill" /><strong>Médias</strong><small>{settings.media ? "Autorisés" : "Bloqués"}</small></span>
          </div>
          <button type="button" onClick={onEditSchedule}><Clock size={17} weight="fill" /> Ajuster les horaires</button>
        </section>
        </>}

        {child && <section className="parent-section parent-activity" aria-labelledby="activity-title">
          <div className="parent-section__title">
            <div><span className="section-icon section-icon--sun"><Bell size={19} weight="fill" /></span><div><h2 id="activity-title">Activité récente</h2><p>Un résumé qui respecte ses conversations.</p></div></div>
          </div>
          <div className="activity-row"><CheckCircle size={19} weight="fill" /><span><strong>Aucun signalement</strong><small>Ces 7 derniers jours</small></span></div>
          <div className="activity-row"><UsersThree size={19} weight="fill" /><span><strong>{selectedChildContacts.length} contact{selectedChildContacts.length > 1 ? "s" : ""} approuvé{selectedChildContacts.length > 1 ? "s" : ""}</strong><small>Relations autorisées pour {child.name}</small></span></div>
          <div className="privacy-note"><LockKey size={16} weight="fill" /> Le contenu des messages reste privé. Vous voyez uniquement les alertes de sécurité.</div>
        </section>}

        {child && <section className="parent-now" aria-labelledby="parent-now-title">
          <div className="parent-now__heading"><span>Que puis-je faire maintenant ?</span><h2 id="parent-now-title">Actions utiles</h2></div>
          <div className="parent-now__actions">
            <button type="button" onClick={child.status === "active" ? onMessageChild : onEditChild}>
              <span><ChatCircleDots size={21} weight="fill" /></span>
              <strong>{child.status === "active" ? `Écrire à ${child.name}` : `Réactiver ${child.name}`}</strong>
              <small>{child.status === "active" ? "Conversation familiale directe" : "Ouvrir les réglages du profil"}</small>
              <CaretRight size={17} weight="bold" />
            </button>
            {unreadMessages > 0 ? (
              <button type="button" onClick={onOpenMessages}>
                <span><Bell size={21} weight="fill" /></span>
                <strong>Lire {unreadMessages} nouveau{unreadMessages > 1 ? "x" : ""} message{unreadMessages > 1 ? "s" : ""}</strong>
                <small>Dans votre messagerie parentale</small>
                <CaretRight size={17} weight="bold" />
              </button>
            ) : (
              <button type="button" onClick={onOpenGames}>
                <span><GameController size={21} weight="fill" /></span>
                <strong>Jouer ensemble</strong>
                <small>Puissance 4, Morpion ou Bataille navale</small>
                <CaretRight size={17} weight="bold" />
              </button>
            )}
          </div>
        </section>}
        </>}

        {!isHome && <>
        <div className="parent-section-intro">
          <span><GearSix size={22} weight="fill" /></span>
          <div><strong>Tout gérer au même endroit</strong><small>Profils, contacts, sécurité et compte parent.</small></div>
        </div>

        <ChildProfilesPanel children={children} activeChildId={child?.id} onSelectChild={onSelectChild} onAddChild={onAddChild} />

        {!child && (
          <section className="empty-family-card" aria-labelledby="empty-family-management-title">
            <span><UserPlus size={34} weight="fill" /></span>
            <div><span>Première étape</span><h2 id="empty-family-management-title">Ajoutez votre premier enfant</h2><p>Créez un identifiant privé adapté aux 6–13 ans. Aucun numéro de téléphone ne sera demandé.</p></div>
            <button className="primary-button" type="button" onClick={onAddChild}><Plus size={18} weight="bold" /> Créer un profil enfant</button>
          </section>
        )}

        <div className="parent-management-grid">
          <div className="parent-management-column">
            <section className="parent-section" aria-labelledby="requests-title">
              <div className="parent-section__title">
                <div><span className="section-icon section-icon--mint"><UserPlus size={19} weight="fill" /></span><div><h2 id="requests-title">Demandes d’amis</h2><p>Approuvez les contacts de votre famille.</p></div></div>
                {pendingRequests.length > 0 && <span className="status-pill">{pendingRequests.length}</span>}
              </div>
              {contactRequestError && <div className="request-sync-error" role="alert"><Shield size={17} weight="fill" /><span>{contactRequestError}</span><button type="button" onClick={onRetryContactRequests}>Réessayer</button></div>}
              {pendingRequests.map((request) => {
                const isIncoming = request.direction === "incoming";
                const displayedContact = isIncoming ? request.requester : request.target;
                const familyProfile = isIncoming ? request.target : request.requester;
                const isBusy = contactRequestBusyId === request.id;
                return (
                  <article className="friend-request" key={request.id}>
                    <span className="request-avatar" aria-hidden="true">{displayedContact.name?.trim().charAt(0).toUpperCase() || "?"}</span>
                    <div className="request-copy">
                      <strong>{displayedContact.name}</strong>
                      <span>{displayedContact.contactId}</span>
                      <small>{isIncoming ? `Demande pour ${familyProfile.name}` : `Envoyée pour ${familyProfile.name}`}</small>
                    </div>
                    {isIncoming && request.canRespond
                      ? <div className="request-actions">
                          <button type="button" className="decline-button" disabled={isBusy} onClick={() => onRespondToContactRequest(request.id, "decline")}><X size={16} weight="bold" /> Refuser</button>
                          <button type="button" className="approve-button" disabled={isBusy} onClick={() => onRespondToContactRequest(request.id, "accept")}><Check size={16} weight="bold" /> {isBusy ? "Traitement…" : "Accepter"}</button>
                        </div>
                      : <div className="request-pending-note"><Clock size={15} weight="fill" /> En attente de l’autre famille</div>}
                  </article>
                );
              })}
              {pendingRequests.length === 0 && !contactRequestError && <div className="request-empty"><CheckCircle size={20} weight="fill" /><div><strong>Aucune demande en attente</strong><span>Les nouvelles invitations apparaîtront ici.</span></div></div>}
            </section>

            {child && <section className="parent-section" aria-labelledby="safety-title">
              <div className="parent-section__title">
                <div><span className="section-icon section-icon--violet"><ShieldCheck size={19} weight="fill" /></span><div><h2 id="safety-title">Protections de {child.name}</h2><p>L’essentiel d’abord, les réglages fins à la demande.</p></div></div>
              </div>

              <div className="parent-safety-status-grid" aria-label={`État des protections de ${child.name}`}>
                <span><Clock size={18} weight="fill" /><strong>Mode calme</strong><small>{schedule.enabled ? "Planifié" : "Non planifié"}</small></span>
                <span><PencilSimple size={18} weight="fill" /><strong>Médias</strong><small>{settings.media ? "Autorisés" : "Bloqués"}</small></span>
                <span><Bell size={18} weight="fill" /><strong>Alertes</strong><small>{notificationsEnabled ? "Disponibles" : "Indisponibles"}</small></span>
              </div>

              <button className="parent-schedule-detail-entry" type="button" onClick={onEditSchedule} aria-label={`Ouvrir les horaires détaillés de ${child.name}`}>
                <span className="setting-icon"><Clock size={20} weight="fill" /></span>
                <span><strong>Horaires des messages et appels</strong><small>{scheduleDetail} · audio et vidéo réglables séparément</small></span>
                <CaretRight size={17} weight="bold" aria-hidden="true" />
              </button>

              <details className="parent-settings-disclosure">
                <summary>
                  <span><GearSix size={18} weight="fill" /></span>
                  <span><strong>Autres réglages</strong><small>Médias et notifications de {child.name}</small></span>
                  <CaretRight size={17} weight="bold" aria-hidden="true" />
                </summary>
                <div className="settings-list">
                  <SafetyToggle icon={PencilSimple} title="Photos, images et vidéos" detail="Autoriser l’envoi entre contacts approuvés" checked={settings.media} onChange={() => onToggleSetting("media")} />
                  {notificationsEnabled && <ChildNotificationConsentSetting child={child} />}
                </div>
              </details>
            </section>}
          </div>

          <div className="parent-management-column">
            <button type="button" className="family-parents-entry" onClick={onOpenFamilyParents}>
              <span><UsersThree size={23} weight="fill" /></span>
              <span><strong>Parents de la famille</strong><small>{family?.role === "primary" ? "Invitez et gérez les co-parents autorisés." : "Consultez les adultes autorisés de la famille."}</small></span>
              <span className="family-parents-count">{family?.members?.length ?? 1}{family?.pendingInvitations?.length ? <small>+{family.pendingInvitations.length}</small> : null}</span>
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>

            <button type="button" className="family-ids-entry" onClick={onOpenContactIds}>
              <span><IdentificationCard size={23} weight="fill" /></span>
              <span><strong>Identifiants de contact</strong><small>Un numéro unique et non réutilisable par membre.</small></span>
              <span className="family-ids-count">{children.length + (family?.members?.length ?? 1)}</span>
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>

            <section className="parent-account-app-panel" aria-labelledby="parent-account-app-title">
              <div className="parent-account-app-panel__title">
                <span><DeviceMobile size={20} weight="fill" /></span>
                <div><h2 id="parent-account-app-title">Compte et application</h2><p>Connexion, droits et installation de Secret Clubhouse.</p></div>
              </div>

              <button type="button" className="parent-password-entry" onClick={onOpenPassword}>
                <span><LockKey size={22} weight="fill" /></span>
                <span><strong>Mot de passe parent</strong><small>Modifier vos informations de connexion.</small></span>
                <CaretRight size={18} weight="bold" aria-hidden="true" />
              </button>

              <button type="button" className="parent-data-rights-entry" onClick={onOpenDataRights}>
                <span><ShieldCheck size={22} weight="fill" /></span>
                <span><strong>Données et droits RGPD</strong><small>Exporter, corriger, limiter, s’opposer ou supprimer.</small></span>
                <CaretRight size={18} weight="bold" aria-hidden="true" />
              </button>

              <PushNotificationButton features={features} />
            </section>
          </div>
        </div>
        </>}
      </div>
      <ParentModeNavigation
        active={activeSection}
        unreadMessages={unreadMessages}
        onHome={() => onChangeSection("home")}
        onManagement={() => onChangeSection("management")}
        onConversations={onOpenMessages}
      />
    </section>
  );
}

export function toUsername(value) {
  return normalizeChildUsername(value);
}

export function ChildAccountModal({ child, canDelete = true, onClose, onSave, onDelete }) {
  const isEditing = Boolean(child);
  const [name, setName] = useState(child?.name ?? "");
  const [age, setAge] = useState(child?.age ?? 8);
  const [username, setUsername] = useState(child?.username ?? "");
  const [usernameEdited, setUsernameEdited] = useState(isEditing);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [color, setColor] = useState(child?.color ?? "mint");
  const [isActive, setIsActive] = useState(child?.status !== "paused");
  const [error, setError] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const avatarColors = ["mint", "violet", "sun", "coral"];

  const updateName = (value) => {
    setName(value.slice(0, 24));
    if (!usernameEdited) setUsername(toUsername(value));
    setError("");
  };

  const submitChild = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUsername = toUsername(username);
    const numericAge = Number(age);
    if (cleanName.length < 2 || cleanUsername.length < 3 || numericAge < 6 || numericAge > 13) {
      setError("Vérifiez le prénom, l’âge et l’identifiant.");
      return;
    }
    if ((!isEditing && password.length < 6) || (isEditing && password.length > 0 && password.length < 6)) {
      setError("Le mot de passe enfant doit contenir au moins 6 caractères.");
      return;
    }
    try {
      await onSave({
        ...child,
        name: cleanName,
        age: numericAge,
        username: cleanUsername,
        password: password || child?.password,
        image: child?.image ?? null,
        color,
        status: isActive ? "active" : "paused",
      });
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const deleteChildAccount = async () => {
    if (deleteConfirmation !== "SUPPRIMER") {
      setError("Tapez SUPPRIMER pour confirmer la suppression définitive.");
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await onDelete(child.id);
    } catch (deleteError) {
      setError(deleteError.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="child-account-modal" onSubmit={submitChild} onMouseDown={(event) => event.stopPropagation()} aria-labelledby="child-modal-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="child-modal-heading">
          <Avatar person={{ name: name || "?", image: child?.image ?? null, color }} size="child-form" />
          <div><span>Compte sans numéro de téléphone</span><h2 id="child-modal-title">{isEditing ? `Modifier ${child.name}` : "Créer un compte enfant"}</h2></div>
        </div>

        <div className="child-form-grid">
          <label className="form-field"><span>Prénom</span><input value={name} onChange={(event) => updateName(event.target.value)} placeholder="Ex. Jules" autoFocus /></label>
          <label className="form-field"><span>Âge</span><select value={age} onChange={(event) => setAge(event.target.value)}>{Array.from({ length: 8 }, (_, index) => index + 6).map((value) => <option key={value} value={value}>{value} ans</option>)}</select></label>
          <label className="form-field form-field--full"><span>Pseudo privé de connexion</span><div className="username-field"><span>@</span><input value={username} onChange={(event) => { setUsername(event.target.value); setUsernameEdited(true); setError(""); }} maxLength={childUsernameMaxLength} autoComplete="off" autoCapitalize="none" spellCheck="false" placeholder="jules.club" /></div><small>Votre enfant l’utilise avec son mot de passe pour se connecter. Il n’apparaît jamais dans son QR et ne sert pas à ajouter un contact.</small></label>
          <label className="form-field form-field--full"><span>{isEditing ? "Nouveau mot de passe enfant" : "Mot de passe enfant"}</span><div className="child-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" placeholder={isEditing ? "Laisser vide pour ne pas le changer" : "6 caractères minimum"} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Masquer le mot de passe enfant" : "Afficher le mot de passe enfant"}>{showPassword ? "Masquer" : "Afficher"}</button></div><small>{isEditing ? "Laissez ce champ vide pour conserver le mot de passe actuel." : "Transmettez-le uniquement à votre enfant."}</small></label>
        </div>

        {!child?.image && (
          <fieldset className="avatar-colors"><legend>Couleur de l’avatar</legend><div>{avatarColors.map((item) => <button key={item} type="button" className={`avatar-color avatar-color--${item} ${color === item ? "is-selected" : ""}`} onClick={() => setColor(item)} aria-label={`Couleur ${item}`} aria-pressed={color === item}><span>{(name || "?").slice(0, 1).toUpperCase()}</span></button>)}</div></fieldset>
        )}

        {isEditing && (
          <button className="account-status-setting" type="button" role="switch" aria-checked={isActive} onClick={() => setIsActive((current) => !current)}>
            <span><strong>Compte actif</strong><small>{isActive ? "L’enfant peut utiliser son espace." : "Le profil affichera un écran de pause."}</small></span>
            <span className={`toggle ${isActive ? "is-on" : ""}`} aria-hidden="true"><span /></span>
          </button>
        )}

        {isEditing && canDelete && !isConfirmingDelete && (
          <button className="delete-child-trigger" type="button" onClick={() => { setIsConfirmingDelete(true); setError(""); }}><Trash size={17} weight="bold" /> Supprimer ce compte enfant</button>
        )}

        {isEditing && canDelete && isConfirmingDelete && (
          <section className="delete-child-confirmation" aria-labelledby="delete-child-title">
            <div><Trash size={20} weight="fill" /><span><strong id="delete-child-title">Supprimer définitivement {child.name} ?</strong><small>Son compte, ses contacts et toutes ses conversations seront supprimés. Cette action est irréversible.</small></span></div>
            <label htmlFor="delete-child-confirmation"><span>Tapez <strong>SUPPRIMER</strong> pour confirmer</span><input id="delete-child-confirmation" value={deleteConfirmation} onChange={(event) => { setDeleteConfirmation(event.target.value.toUpperCase()); setError(""); }} autoComplete="off" disabled={isDeleting} /></label>
            <div><button type="button" onClick={() => { setIsConfirmingDelete(false); setDeleteConfirmation(""); setError(""); }} disabled={isDeleting}>Garder le compte</button><button type="button" onClick={deleteChildAccount} disabled={deleteConfirmation !== "SUPPRIMER" || isDeleting}>{isDeleting ? "Suppression…" : "Supprimer définitivement"}</button></div>
          </section>
        )}

        {error && <p className="child-form-error" role="alert">{error}</p>}
        <div className="child-modal-actions">
          <button type="button" className="decline-button" onClick={onClose}>Annuler</button>
          <button type="submit" className="primary-button" disabled={isDeleting}><CheckCircle size={18} weight="fill" /> {isEditing ? "Enregistrer" : "Créer le compte"}</button>
        </div>
      </form>
    </div>
  );
}

export function ContactIdsModal({ parent, family, children, onClose }) {
  const [copiedMemberId, setCopiedMemberId] = useState(null);
  const parents = family?.members?.length ? family.members : [{ id: parent.id ?? "parent", name: parent.name, contactId: parent.contactId, role: "primary" }];
  const members = [
    ...parents.map((member) => ({ ...member, roleLabel: member.role === "primary" ? "Parent principal" : "Co-parent", isParent: true })),
    ...children.map((child) => ({ ...child, roleLabel: `Compte enfant · ${child.age} ans` })),
  ];

  const copyMemberId = async (member) => {
    await copyContactId(member.contactId);
    setCopiedMemberId(member.id);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="contact-ids-modal" role="dialog" aria-modal="true" aria-labelledby="contact-ids-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="contact-ids-heading"><span><IdentificationCard size={28} weight="fill" /></span><div><small>{family?.name ?? `Famille de ${parent.name}`}</small><h2 id="contact-ids-title">Identifiants de contact</h2><p>Un numéro opaque et unique pour chaque membre.</p></div></div>
        <div className="contact-id-safety"><ShieldCheck size={18} weight="fill" /><span>Seul ce numéro exact cible un compte. Le pseudo n’est jamais utilisé pour démarrer une discussion.</span></div>
        <div className="contact-member-list">
          {members.map((member) => (
            <article className="contact-member-card" key={member.id}>
              {member.isParent ? <span className="contact-parent-avatar"><UserCircle size={29} weight="fill" /></span> : <Avatar person={member} size="child-tab" />}
              <div className="contact-member-copy"><strong>{member.name}</strong><small>{member.roleLabel}</small><span>ID {member.contactId}</span></div>
              <button type="button" className={copiedMemberId === member.id ? "is-copied" : ""} onClick={() => copyMemberId(member)} aria-label={`Copier l’identifiant de ${member.name}`}>{copiedMemberId === member.id ? <CheckCircle size={18} weight="fill" /> : <Copy size={18} weight="bold" />}<span>{copiedMemberId === member.id ? "Copié" : "Copier"}</span></button>
            </article>
          ))}
        </div>
        <button className="primary-button contact-ids-close" type="button" onClick={onClose}>Terminer</button>
      </section>
    </div>
  );
}

export function ScheduleModal({ childName, schedule, onClose, onSave }) {
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    ...schedule,
    messages: { ...schedule.messages },
    calls: { ...schedule.calls },
    video: { ...schedule.video },
    autoReply: { ...defaultCommunicationSchedule.autoReply, ...schedule.autoReply },
  });
  const channels = [
    { key: "messages", title: "Messages", detail: "Envoi et notifications", Icon: ChatCircleDots },
    { key: "calls", title: "Appels audio", detail: "Appels entre amis approuvés", Icon: Phone },
    { key: "video", title: "Appels visio", detail: "Caméra avec contacts approuvés", Icon: VideoCamera },
  ];
  const scheduleTimeZone = schedule.timeZone || "Europe/Paris";
  const scheduleTimeZoneLabel = scheduleTimeZone === "Europe/Paris"
    ? "l’heure de Paris"
    : `le fuseau ${scheduleTimeZone}`;

  const updateChannel = (key, values) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...values } }));
  };

  const copyMessageHours = () => {
    setDraft((current) => ({
      ...current,
      calls: { ...current.calls, start: current.messages.start, end: current.messages.end },
      video: { ...current.video, start: current.messages.start, end: current.messages.end },
    }));
  };

  const saveSchedule = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const scheduleWithCurrentTimes = ["messages", "calls", "video"].reduce(
      (current, key) => ({
        ...current,
        [key]: {
          ...current[key],
          start: formData.get(`${key}-start`) || current[key].start,
          end: formData.get(`${key}-end`) || current[key].end,
        },
      }),
      draft,
    );
    try {
      await onSave(scheduleWithCurrentTimes);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="schedule-modal" onSubmit={saveSchedule} onMouseDown={(event) => event.stopPropagation()} aria-labelledby="schedule-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="schedule-modal__heading"><span><Clock size={27} weight="fill" /></span><div><small>Règles de {childName}</small><h2 id="schedule-title">Horaires autorisés</h2><p>Définissez quand les échanges sont disponibles.</p></div></div>

        <button className="schedule-master" type="button" role="switch" aria-checked={draft.enabled} onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}>
          <span><strong>Planification active</strong><small>Les règles s’appliquent tous les jours.</small></span>
          <span className={`toggle ${draft.enabled ? "is-on" : ""}`} aria-hidden="true"><span /></span>
        </button>

        <div className={`schedule-channels ${draft.enabled ? "" : "is-disabled"}`}>
          {channels.map(({ key, title, detail, Icon }) => (
            <section className="schedule-channel" key={key} aria-label={title}>
              <div className="schedule-channel__heading">
                <span className="schedule-channel__icon"><Icon size={19} weight="fill" /></span>
                <span className="schedule-channel__copy"><strong>{title}</strong><small>{detail}</small></span>
                <button type="button" className="schedule-channel__switch" role="switch" aria-checked={draft[key].enabled} aria-label={`${title} autorisés`} onClick={() => updateChannel(key, { enabled: !draft[key].enabled })} disabled={!draft.enabled}>
                  <span className={`toggle ${draft[key].enabled ? "is-on" : ""}`} aria-hidden="true"><span /></span>
                </button>
              </div>
              <div className="time-range">
                <label><span>À partir de</span><input type="time" name={`${key}-start`} aria-label={`Début ${title}`} value={draft[key].start} onChange={(event) => updateChannel(key, { start: event.target.value })} disabled={!draft.enabled || !draft[key].enabled} /></label>
                <span className="time-range__arrow">→</span>
                <label><span>Jusqu’à</span><input type="time" name={`${key}-end`} aria-label={`Fin ${title}`} value={draft[key].end} onChange={(event) => updateChannel(key, { end: event.target.value })} disabled={!draft.enabled || !draft[key].enabled} /></label>
              </div>
            </section>
          ))}
        </div>

        <section className={`auto-reply-setting ${draft.enabled ? "" : "is-disabled"}`} aria-label="Réponse automatique hors horaires">
          <div className="auto-reply-setting__heading">
            <span className="schedule-channel__icon"><ChatCircleDots size={19} weight="fill" /></span>
            <span className="schedule-channel__copy"><strong>Réponse automatique</strong><small>Messages et appels refusés pendant le mode calme</small></span>
            <button type="button" className="schedule-channel__switch" role="switch" aria-checked={draft.autoReply.enabled} aria-label="Réponse automatique activée" onClick={() => setDraft((current) => ({ ...current, autoReply: { ...current.autoReply, enabled: !current.autoReply.enabled } }))} disabled={!draft.enabled}>
              <span className={`toggle ${draft.autoReply.enabled ? "is-on" : ""}`} aria-hidden="true"><span /></span>
            </button>
          </div>
          <label className="auto-reply-message"><span>Message envoyé</span><textarea value={draft.autoReply.message} onChange={(event) => setDraft((current) => ({ ...current, autoReply: { ...current.autoReply, message: event.target.value.slice(0, 140) } }))} maxLength={140} rows={3} aria-label="Message automatique" disabled={!draft.enabled || !draft.autoReply.enabled} /><small>{draft.autoReply.message.length}/140</small></label>
          <div className="auto-reply-preview"><span>Automatique</span><p>{draft.autoReply.message || "Aucun message renseigné."}</p></div>
        </section>

        <button className="copy-hours-button" type="button" onClick={copyMessageHours} disabled={!draft.enabled}><Clock size={16} weight="bold" /> Utiliser l’horaire des messages pour tout</button>
        <div className="schedule-note"><Clock size={17} weight="fill" /><span>Ces horaires suivent {scheduleTimeZoneLabel}, même si le téléphone voyage.</span></div>
        <div className="schedule-note"><ShieldCheck size={17} weight="fill" /><span>En dehors de ces horaires, les messages attendent et les appels audio ou visio sont refusés. Le contact reçoit cette réponse automatique.</span></div>
        {error && <p className="child-form-error" role="alert">{error}</p>}
        <div className="child-modal-actions"><button type="button" className="decline-button" onClick={onClose}>Annuler</button><button type="submit" className="primary-button"><CheckCircle size={18} weight="fill" /> Enregistrer</button></div>
      </form>
    </div>
  );
}
