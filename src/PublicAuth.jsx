import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Eye } from "@phosphor-icons/react/Eye";
import { EyeSlash } from "@phosphor-icons/react/EyeSlash";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { LockKeyOpen } from "@phosphor-icons/react/LockKeyOpen";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Smiley } from "@phosphor-icons/react/Smiley";
import { Star } from "@phosphor-icons/react/Star";
import { UserPlus } from "@phosphor-icons/react/UserPlus";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { WaveSine } from "@phosphor-icons/react/WaveSine";
import { Brand } from "./Brand";
import { childUsernameMaxLength, isValidChildUsername, normalizeChildUsername } from "./child-username";
import { isLegalNoticePath, legalNoticeRoute, privacyAudienceFromPath, privacyRoutes } from "./legal-routes";
import { legalDocumentVersions, registrationLegalEvidence } from "./legal-versions";

export const rememberedParentEmailKey = "secret-clubhouse-parent-email";

const lazyNamed = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));
const loadLegalModals = () => import("./features/LegalModals");
const TermsModal = lazyNamed(loadLegalModals, "TermsModal");
const PrivacyPolicyModal = lazyNamed(loadLegalModals, "PrivacyPolicyModal");
const LegalNoticeModal = lazyNamed(loadLegalModals, "LegalNoticeModal");

export function AuthScreen({ onLogin, onRegister, onChildLogin, hasFamilyInvite = false, familyInvitation, familyInvitationError, isFamilyInvitationLoading = false, onDismissFamilyInvite }) {
  const [audience, setAudience] = useState("parent");
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => localStorage.getItem(rememberedParentEmailKey) ?? "");
  const [childUsername, setChildUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [privacyAudience, setPrivacyAudience] = useState(() => privacyAudienceFromPath(window.location.pathname));
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState(() => isLegalNoticePath(window.location.pathname));
  const [parentalAuthorityConfirmed, setParentalAuthorityConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [invalidChildFields, setInvalidChildFields] = useState([]);
  const childUsernameRef = useRef(null);
  const passwordRef = useRef(null);
  const privacyReturnUrlRef = useRef(null);
  const legalNoticeReturnUrlRef = useRef(null);

  const clearAuthError = () => {
    setError("");
    setInvalidChildFields([]);
  };

  const showChildAuthError = (message, fields, fieldToFocus) => {
    setError(message);
    setInvalidChildFields(fields);
    window.requestAnimationFrame(() => fieldToFocus.current?.focus());
  };

  useEffect(() => {
    if (!familyInvitation?.email) return;
    setAudience("parent");
    setEmail(familyInvitation.email);
  }, [familyInvitation?.email]);

  useEffect(() => {
    const syncPublicLegalRoute = () => {
      setPrivacyAudience(privacyAudienceFromPath(window.location.pathname));
      setIsLegalNoticeOpen(isLegalNoticePath(window.location.pathname));
    };
    window.addEventListener("popstate", syncPublicLegalRoute);
    return () => window.removeEventListener("popstate", syncPublicLegalRoute);
  }, []);

  const openPrivacy = (nextAudience) => {
    privacyReturnUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState({ privacy: nextAudience }, "", privacyRoutes[nextAudience]);
    setIsLegalNoticeOpen(false);
    setPrivacyAudience(nextAudience);
  };

  const changePrivacyAudience = (nextAudience) => {
    window.history.replaceState({ privacy: nextAudience }, "", privacyRoutes[nextAudience]);
    setPrivacyAudience(nextAudience);
  };

  const closePrivacy = () => {
    const returnUrl = privacyReturnUrlRef.current || "/";
    privacyReturnUrlRef.current = null;
    window.history.replaceState({}, "", returnUrl);
    setPrivacyAudience(null);
  };

  const openLegalNotice = () => {
    legalNoticeReturnUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState({ legalNotice: true }, "", legalNoticeRoute);
    setPrivacyAudience(null);
    setIsLegalNoticeOpen(true);
  };

  const closeLegalNotice = () => {
    const returnUrl = legalNoticeReturnUrlRef.current || "/";
    legalNoticeReturnUrlRef.current = null;
    window.history.replaceState({}, "", returnUrl);
    setIsLegalNoticeOpen(false);
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    clearAuthError();
  };

  const changeAudience = (nextAudience) => {
    if (hasFamilyInvite) return;
    setAudience(nextAudience);
    setMode("login");
    setPassword("");
    clearAuthError();
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    if (audience === "child") {
      const cleanUsername = normalizeChildUsername(childUsername);
      const hasValidUsername = isValidChildUsername(cleanUsername);
      const hasValidPassword = password.length >= 6;
      if (!hasValidUsername || !hasValidPassword) {
        const invalidFields = [
          ...(!hasValidUsername ? ["username"] : []),
          ...(!hasValidPassword ? ["password"] : []),
        ];
        showChildAuthError(
          "Saisis le pseudo privé choisi avec ton parent et ton mot de passe.",
          invalidFields,
          !hasValidUsername ? childUsernameRef : passwordRef,
        );
        return;
      }
      if (!await onChildLogin(cleanUsername, password)) {
        showChildAuthError(
          "Pseudo privé ou mot de passe incorrect.",
          ["username", "password"],
          childUsernameRef,
        );
      }
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@") || password.length < 8) {
      setError("Saisissez une adresse e-mail valide et un mot de passe de 8 caractères minimum.");
      return;
    }
    if (mode === "register") {
      if (name.trim().length < 2 || !parentalAuthorityConfirmed || !termsAccepted) {
        setError("Indiquez votre prénom, acceptez les conditions d’utilisation et confirmez votre autorité parentale.");
        return;
      }
      try {
        await onRegister({
          name: name.trim(),
          email: cleanEmail,
          password,
          legal: registrationLegalEvidence(),
        });
      } catch (authError) {
        setError(authError.message);
      }
      return;
    }
    try {
      await onLogin({ email: cleanEmail, password });
    } catch (authError) {
      setError(authError.message);
    }
  };

  return (
    <section className="auth-screen" aria-labelledby="auth-title">
      <div className="auth-screen__decor" aria-hidden="true"><Star size={38} weight="fill" /><Lightning size={48} weight="fill" /><WaveSine size={38} weight="bold" /></div>
      <header className="auth-header"><Brand /><span><ShieldCheck size={16} weight="fill" /> Pensé pour les familles</span></header>
      <div className="auth-layout">
        <div className="auth-intro">
          <span className="auth-kicker">Messagerie 6–13 ans</span>
          <h1 id="auth-title">Des amis choisis.<br />Des parents rassurés.</h1>
          <p>Créez les profils de vos enfants et approuvez chaque contact, sans numéro de téléphone.</p>
          <div className="auth-trust"><span><CheckCircle size={17} weight="fill" /> Identifiants privés</span><span><ShieldCheck size={17} weight="fill" /> Contacts approuvés</span></div>
        </div>

        <div className="auth-card">
          {hasFamilyInvite && <div className={`family-invite-auth-note ${familyInvitationError ? "has-error" : ""}`} role="status">
            <span><UsersThree size={22} weight="fill" /></span>
            <div>
              <strong>{isFamilyInvitationLoading ? "Vérification de l’invitation…" : familyInvitationError ? "Cette invitation n’est plus disponible" : `${familyInvitation.invitedByName} vous invite comme co-parent`}</strong>
              <small>{isFamilyInvitationLoading ? "Un instant, nous vérifions le lien sécurisé." : familyInvitationError || `Connectez-vous ou créez votre compte ${familyInvitation.email ? `avec ${familyInvitation.email}` : "parent"}.`}</small>
            </div>
            {familyInvitationError && <button type="button" onClick={onDismissFamilyInvite}>Continuer sans invitation</button>}
          </div>}

          {!hasFamilyInvite && <div className="auth-role-tabs" role="tablist" aria-label="Choisir son espace">
            <button type="button" role="tab" aria-selected={audience === "parent"} className={audience === "parent" ? "is-active" : ""} onClick={() => changeAudience("parent")}><ShieldCheck size={17} weight="fill" /> Parent</button>
            <button type="button" role="tab" aria-selected={audience === "child"} className={audience === "child" ? "is-active" : ""} onClick={() => changeAudience("child")}><Smiley size={17} weight="fill" /> Enfant</button>
          </div>}

          {audience === "parent" && <div className="auth-tabs" role="tablist" aria-label="Accès au compte parent">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")}>Connexion</button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => changeMode("register")}>Inscription</button>
          </div>}

          <form className="auth-form" onSubmit={submitAuth}>
            <div className="auth-form__heading"><span className="auth-lock">{audience === "child" ? <Smiley size={23} weight="fill" /> : <LockKey size={22} weight="fill" />}</span><div><h2>{audience === "child" ? "Salut !" : hasFamilyInvite ? mode === "login" ? "Accepter avec mon compte" : "Créer mon accès co-parent" : mode === "login" ? "Ravi de vous revoir" : "Créer le compte parent"}</h2><p>{audience === "child" ? "Entre dans ton Clubhouse." : hasFamilyInvite ? "Chaque adulte garde ses propres identifiants." : mode === "login" ? "Accédez à votre espace familial." : "Commencez par les informations de l’adulte."}</p></div></div>
            {audience === "parent" && mode === "register" && <label className="auth-field"><span>Prénom du parent</span><input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} autoComplete="given-name" placeholder="Marie" /></label>}
            {audience === "parent" ? <label className="auth-field"><span>Adresse e-mail</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" placeholder="parent@exemple.fr" readOnly={Boolean(familyInvitation?.email)} /></label> : <label className="auth-field"><span>Ton pseudo privé</span><input ref={childUsernameRef} value={childUsername} onChange={(event) => { setChildUsername(event.target.value.slice(0, childUsernameMaxLength)); clearAuthError(); }} autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="jules.club" aria-invalid={invalidChildFields.includes("username")} aria-describedby={error ? "auth-error" : undefined} /><small>Il sert seulement à te connecter. Ton QR utilise un autre identifiant.</small></label>}
            <label className="auth-field"><span>Mot de passe</span><span className="auth-password-field"><input ref={audience === "child" ? passwordRef : undefined} type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); clearAuthError(); }} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={audience === "child" ? "6 caractères minimum" : "8 caractères minimum"} minLength={audience === "child" ? 6 : 8} aria-invalid={audience === "child" && invalidChildFields.includes("password")} aria-describedby={audience === "child" && error ? "auth-error" : undefined} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>{showPassword ? <EyeSlash size={21} weight="bold" /> : <Eye size={21} weight="bold" />}</button></span></label>
            {audience === "parent" && mode === "register" && <aside className="auth-data-notice"><ShieldCheck size={20} weight="fill" /><span><strong>Avant l’inscription</strong> Votre e-mail et les profils créés servent à fournir et sécuriser le service familial. L’hébergement Render est situé par défaut aux États-Unis. <button type="button" onClick={() => openPrivacy("parent")}>Lire la politique complète</button></span></aside>}
            {audience === "parent" && mode === "register" && (
              <div className="auth-legal-confirmations">
                <label className="auth-consent"><input type="checkbox" checked={termsAccepted} onChange={(event) => { setTermsAccepted(event.target.checked); setError(""); }} /><span>J’accepte les <button type="button" onClick={(event) => { event.preventDefault(); setIsTermsOpen(true); }}>conditions d’utilisation</button> (version du {legalDocumentVersions.terms.label}). Cette acceptation conclut le contrat de service ; ce n’est pas un consentement RGPD.</span></label>
                <label className="auth-consent"><input type="checkbox" checked={parentalAuthorityConfirmed} onChange={(event) => { setParentalAuthorityConfirmed(event.target.checked); setError(""); }} /><span>Je confirme être le parent ou le responsable légal des enfants que j’ajouterai.</span></label>
              </div>
            )}
            {error && <p className="auth-error" id="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={isFamilyInvitationLoading || Boolean(familyInvitationError)}>{audience === "child" || mode === "login" ? <LockKeyOpen size={19} weight="fill" /> : <UserPlus size={19} weight="fill" />}{audience === "child" ? "Entrer dans mon espace" : hasFamilyInvite ? mode === "login" ? "Se connecter et accepter" : "Créer et rejoindre la famille" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
          </form>

          <div className="auth-legal"><LockKey size={14} weight="fill" /><span>Informations :</span><button type="button" onClick={() => openPrivacy("parent")}>confidentialité parents</button><button type="button" onClick={() => openPrivacy("child")}>confidentialité enfants</button><span aria-hidden="true">•</span><button type="button" onClick={() => setIsTermsOpen(true)}>Conditions d’utilisation</button><span aria-hidden="true">•</span><button type="button" onClick={openLegalNotice}>Mentions légales</button></div>
        </div>
      </div>
      <Suspense fallback={null}>
        {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} />}
        {privacyAudience && <PrivacyPolicyModal audience={privacyAudience} onAudienceChange={changePrivacyAudience} onClose={closePrivacy} />}
        {isLegalNoticeOpen && <LegalNoticeModal onClose={closeLegalNotice} />}
      </Suspense>
    </section>
  );
}
