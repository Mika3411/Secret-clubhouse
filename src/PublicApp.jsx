import { lazy, Suspense, useEffect, useState } from "react";
import { api, clearToken } from "./api";
import { AuthScreen, rememberedParentEmailKey } from "./PublicAuth";

const AuthenticatedApp = lazy(() => import("./App").then((module) => ({ default: module.App })));
const AdminEntry = lazy(() => import("./features/admin/AdminEntry"));
const familyInviteQueryKeys = ["familyInvite", "family-invite", "invite"];

const readFamilyInviteToken = () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return familyInviteQueryKeys
    .flatMap((key) => [hashParams.get(key)?.trim(), params.get(key)?.trim()])
    .find(Boolean) ?? "";
};

const clearFamilyInviteFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  familyInviteQueryKeys.forEach((key) => params.delete(key));
  familyInviteQueryKeys.forEach((key) => hashParams.delete(key));
  const query = params.toString();
  const hash = hashParams.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`);
};

const normalizeFamilyInvitation = (payload) => {
  const invitation = payload?.invitation ?? payload ?? {};
  return {
    ...invitation,
    id: invitation.id,
    email: invitation.email ?? "",
    familyName: invitation.familyName ?? invitation.family_name ?? "cette famille",
    invitedByName: invitation.invitedByName ?? invitation.inviterName ?? invitation.invited_by_name ?? invitation.invitedBy?.name ?? "un parent",
    expiresAt: invitation.expiresAt ?? invitation.expires_at,
  };
};

function SessionLoading() {
  return (
    <section className="session-restoring" role="status" aria-live="polite">
      <span className="session-restoring__spinner" aria-hidden="true" />
      <strong>Ouverture de votre Clubhouse…</strong>
      <small>Votre connexion est restaurée.</small>
    </section>
  );
}

function SessionUnavailable({ onRetry }) {
  return (
    <section className="session-restoring" role="alert">
      <span className="session-restoring__status" aria-hidden="true">↻</span>
      <strong>La connexion fait une petite pause</strong>
      <small>Votre session est toujours là. Vérifiez votre connexion puis réessayez.</small>
      <button type="button" className="primary-button session-restoring__retry" onClick={onRetry}>
        Réessayer
      </button>
    </section>
  );
}

function FamilyPublicApp() {
  const [account, setAccount] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [sessionRestoreError, setSessionRestoreError] = useState("");
  const [isInitialRegistration, setIsInitialRegistration] = useState(false);
  const [familyInviteToken, setFamilyInviteToken] = useState(() => readFamilyInviteToken());
  const [familyInvitation, setFamilyInvitation] = useState(null);
  const [familyInvitationError, setFamilyInvitationError] = useState("");
  const [isFamilyInvitationLoading, setIsFamilyInvitationLoading] = useState(() => Boolean(readFamilyInviteToken()));

  useEffect(() => {
    if (!familyInviteToken) {
      setFamilyInvitation(null);
      setFamilyInvitationError("");
      setIsFamilyInvitationLoading(false);
      return;
    }
    let isCurrent = true;
    setIsFamilyInvitationLoading(true);
    setFamilyInvitationError("");
    api.familyInvitation(familyInviteToken)
      .then((payload) => {
        if (isCurrent) setFamilyInvitation(normalizeFamilyInvitation(payload));
      })
      .catch((error) => {
        if (!isCurrent) return;
        setFamilyInvitation(null);
        setFamilyInvitationError(error.message || "Ce lien d’invitation est invalide ou expiré.");
      })
      .finally(() => {
        if (isCurrent) setIsFamilyInvitationLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [familyInviteToken]);

  const restoreSession = () => {
    setIsRestoringSession(true);
    setSessionRestoreError("");
    return api.me()
      .then(async ({ account: restoredAccount }) => {
        if (restoredAccount.role === "child" && familyInviteToken) {
          await api.logout().catch(() => clearToken());
          return;
        }
        setAccount(restoredAccount);
      })
      .catch((error) => {
        if (error?.status !== 401) {
          setSessionRestoreError(error?.message || "Le serveur ne répond pas pour le moment.");
        }
      })
      .finally(() => setIsRestoringSession(false));
  };

  useEffect(() => {
    void restoreSession();
  }, []);

  const dismissFamilyInvitation = () => {
    clearFamilyInviteFromUrl();
    setFamilyInviteToken("");
    setFamilyInvitation(null);
    setFamilyInvitationError("");
  };

  const loginParent = async (credentials) => {
    const { account: authenticatedAccount } = await api.login(credentials);
    try {
      if (familyInviteToken) await api.acceptFamilyInvitation(familyInviteToken);
      localStorage.setItem(rememberedParentEmailKey, credentials.email.trim().toLowerCase());
      if (familyInviteToken) dismissFamilyInvitation();
      setAccount(authenticatedAccount);
    } catch (error) {
      await api.logout().catch(() => clearToken());
      throw error;
    }
  };

  const registerParent = async (parent) => {
    const hasFamilyInvite = Boolean(familyInviteToken);
    const { account: registeredAccount } = hasFamilyInvite
      ? await api.registerWithFamilyInvite({
          token: familyInviteToken,
          name: parent.name,
          password: parent.password,
          legal: parent.legal,
        })
      : await api.register(parent);
    localStorage.setItem(rememberedParentEmailKey, parent.email.trim().toLowerCase());
    if (hasFamilyInvite) dismissFamilyInvitation();
    setIsInitialRegistration(!hasFamilyInvite);
    setAccount(registeredAccount);
  };

  const loginChild = async (username, password) => {
    try {
      const { account: authenticatedAccount } = await api.login({ username, password });
      if (authenticatedAccount.role !== "child") return false;
      setAccount(authenticatedAccount);
      return true;
    } catch {
      return false;
    }
  };

  if (account) {
    return (
      <Suspense fallback={<main className="app-stage"><div className="mobile-prototype"><div className="screen-scroll screen-scroll--full"><SessionLoading /></div></div></main>}>
        <AuthenticatedApp key={account.id} initialAccount={account} initialRegistration={isInitialRegistration} />
      </Suspense>
    );
  }

  return (
    <main className="app-stage">
      <div className="mobile-prototype">
        <div className="screen-scroll screen-scroll--full">
          {isRestoringSession
            ? <SessionLoading />
            : sessionRestoreError
              ? <SessionUnavailable onRetry={restoreSession} />
            : <AuthScreen
                onLogin={loginParent}
                onRegister={registerParent}
                onChildLogin={loginChild}
                hasFamilyInvite={Boolean(familyInviteToken)}
                familyInvitation={familyInvitation}
                familyInvitationError={familyInvitationError}
                isFamilyInvitationLoading={isFamilyInvitationLoading}
                onDismissFamilyInvite={dismissFamilyInvitation}
              />}
        </div>
      </div>
    </main>
  );
}

export function PublicApp() {
  if (window.location.pathname.replace(/\/+$/u, "") === "/administration") {
    return (
      <Suspense fallback={<SessionLoading />}>
        <AdminEntry />
      </Suspense>
    );
  }
  return <FamilyPublicApp />;
}
