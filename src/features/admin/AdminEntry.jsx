import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { Buildings } from "@phosphor-icons/react/Buildings";
import { CalendarCheck } from "@phosphor-icons/react/CalendarCheck";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { HouseLine } from "@phosphor-icons/react/HouseLine";
import { IdentificationCard } from "@phosphor-icons/react/IdentificationCard";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { PauseCircle } from "@phosphor-icons/react/PauseCircle";
import { PlayCircle } from "@phosphor-icons/react/PlayCircle";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { UserCircle } from "@phosphor-icons/react/UserCircle";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { WarningCircle } from "@phosphor-icons/react/WarningCircle";
import { api, clearToken } from "../../api";
import { Brand } from "../../Brand";
import "../../styles/admin.css";

const previewAnalytics = {
  generatedAt: new Date().toISOString(),
  scope: { aggregateOnly: true, administratorsExcluded: true, contentIncluded: false },
  families: {
    total: 64,
    withChildren: 42,
    new7Days: 11,
    new30Days: 64,
    active7Days: 31,
    active30Days: 49,
  },
  users: {
    total: 110,
    parents: 68,
    children: 42,
    active7Days: 48,
    active30Days: 81,
  },
  retention30Days: {
    eligibleFamilies: 0,
    returnedFamilies: 0,
    rate: null,
    nextCohortMaturesAt: new Date(Date.now() + 24 * 86_400_000).toISOString(),
  },
  usage: [
    { label: "Sessions ouvertes", last7Days: 92, last30Days: 247, perActiveFamily7: 3, perActiveFamily30: 5, perDay30: 8.2 },
    { label: "Messages envoyés", last7Days: 186, last30Days: 528, perActiveFamily7: 6, perActiveFamily30: 10.8, perDay30: 17.6 },
    { label: "Journées Clubhouse actives", last7Days: 44, last30Days: 131, perActiveFamily7: 1.4, perActiveFamily30: 2.7, perDay30: 4.4 },
    { label: "Parties multijoueurs lancées", last7Days: 18, last30Days: 47, perActiveFamily7: 0.6, perActiveFamily30: 1, perDay30: 1.6 },
    { label: "Appels lancés", last7Days: 9, last30Days: 22, perActiveFamily7: 0.3, perActiveFamily30: 0.4, perDay30: 0.7 },
  ],
};

const previewFamilies = {
  families: [
    {
      id: "preview-family-1",
      name: "Famille Martin",
      createdAt: "2026-06-18T09:30:00.000Z",
      accountStatus: "active",
      pendingInvitations: 0,
      parents: [
        {
          id: "preview-parent-1",
          role: "parent",
          name: "Camille Martin",
          email: "camille.martin@exemple.fr",
          contactId: "SC-128-642-915",
          familyRole: "primary",
          accountStatus: "active",
          protectedAdministrator: false,
          processingRestrictedAt: null,
          createdAt: "2026-06-18T09:30:00.000Z",
          lastActivityAt: "2026-07-25T08:45:00.000Z",
        },
        {
          id: "preview-parent-2",
          role: "parent",
          name: "Alex Martin",
          email: "alex.martin@exemple.fr",
          contactId: "SC-482-573-106",
          familyRole: "coparent",
          accountStatus: "active",
          protectedAdministrator: false,
          processingRestrictedAt: null,
          createdAt: "2026-06-19T12:00:00.000Z",
          lastActivityAt: "2026-07-24T19:12:00.000Z",
        },
      ],
      children: [
        {
          id: "preview-child-1",
          role: "child",
          name: "Lina",
          username: "lina.club",
          contactId: "SC-286-413-759",
          age: 9,
          profileStatus: "active",
          accountStatus: "active",
          processingRestrictedAt: null,
          createdAt: "2026-06-18T10:15:00.000Z",
          lastActivityAt: "2026-07-25T08:40:00.000Z",
        },
        {
          id: "preview-child-2",
          role: "child",
          name: "Noé",
          username: "noe.club",
          contactId: "SC-731-268-504",
          age: 12,
          profileStatus: "paused",
          accountStatus: "active",
          processingRestrictedAt: null,
          createdAt: "2026-06-18T10:18:00.000Z",
          lastActivityAt: "2026-07-22T17:26:00.000Z",
        },
      ],
    },
    {
      id: "preview-family-2",
      name: "Famille Diallo",
      createdAt: "2026-07-02T14:20:00.000Z",
      accountStatus: "suspended",
      pendingInvitations: 1,
      parents: [
        {
          id: "preview-parent-3",
          role: "parent",
          name: "Sarah Diallo",
          email: "sarah.diallo@exemple.fr",
          contactId: "SC-910-347-682",
          familyRole: "primary",
          accountStatus: "active",
          protectedAdministrator: false,
          processingRestrictedAt: null,
          createdAt: "2026-07-02T14:20:00.000Z",
          lastActivityAt: "2026-07-24T18:05:00.000Z",
        },
      ],
      children: [
        {
          id: "preview-child-3",
          role: "child",
          name: "Yanis",
          username: "yanis.club",
          contactId: "SC-561-209-438",
          age: 10,
          profileStatus: "active",
          accountStatus: "suspended",
          suspendedAt: "2026-07-24T11:00:00.000Z",
          suspensionReason: "Vérification du compte",
          processingRestrictedAt: null,
          createdAt: "2026-07-02T14:36:00.000Z",
          lastActivityAt: "2026-07-24T10:52:00.000Z",
        },
      ],
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 2,
    totalPages: 1,
  },
  filters: {
    search: "",
    status: "all",
  },
};

const formatInteger = (value) => new Intl.NumberFormat("fr-FR").format(Number(value) || 0);
const formatDecimal = (value) => new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
}).format(Number(value) || 0);

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
};

function AdminLoading() {
  return (
    <main className="admin-shell admin-shell--centered">
      <section className="admin-status-card" role="status" aria-live="polite">
        <span className="admin-spinner" aria-hidden="true" />
        <strong>Ouverture du tableau de bord…</strong>
        <small>Vérification de votre accès nominatif.</small>
      </section>
    </main>
  );
}

function AdministrationLogin({ onLogin, busy, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    onLogin({ email: email.trim().toLowerCase(), password });
  };

  return (
    <main className="admin-shell admin-shell--login">
      <div className="admin-login-brand"><Brand /></div>
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <span className="admin-login-card__icon" aria-hidden="true"><LockKey size={28} weight="fill" /></span>
        <p className="admin-eyebrow">Accès nominatif</p>
        <h1 id="admin-login-title">Administration</h1>
        <p>Connectez-vous avec le compte parent explicitement autorisé pour consulter les statistiques agrégées.</p>
        <form onSubmit={submit}>
          <label>
            Adresse e-mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="administrateur@exemple.fr"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Votre mot de passe"
              required
            />
          </label>
          {error && <p className="admin-form-error" role="alert"><WarningCircle size={18} weight="fill" />{error}</p>}
          <button type="submit" className="admin-primary-button" disabled={busy}>
            <LockKey size={18} weight="fill" />
            {busy ? "Vérification…" : "Ouvrir l’administration"}
          </button>
        </form>
        <small className="admin-login-card__note">Aucun compte administrateur par défaut n’est créé.</small>
      </section>
    </main>
  );
}

function AccessDenied({ onLogout }) {
  return (
    <main className="admin-shell admin-shell--centered">
      <section className="admin-status-card admin-status-card--warning">
        <span><WarningCircle size={30} weight="fill" /></span>
        <p className="admin-eyebrow">Accès protégé</p>
        <h1>Compte non autorisé</h1>
        <p>Cette session est valide, mais elle ne fait pas partie des administrateurs nommés.</p>
        <button type="button" className="admin-secondary-button" onClick={onLogout}>
          <SignOut size={18} weight="bold" /> Utiliser un autre compte
        </button>
      </section>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "violet" }) {
  return (
    <article className={`admin-metric admin-metric--${tone}`}>
      <span className="admin-metric__icon" aria-hidden="true"><Icon size={23} weight="fill" /></span>
      <div>
        <small>{label}</small>
        <strong>{formatInteger(value)}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function RetentionCard({ retention }) {
  const measurable = retention.rate !== null;
  const rate = measurable ? Math.max(0, Math.min(100, Number(retention.rate))) : 0;
  return (
    <article className="admin-panel admin-retention">
      <div className="admin-panel__heading">
        <span className="admin-panel__icon admin-panel__icon--violet"><ChartLineUp size={22} weight="fill" /></span>
        <div><small>Fidélité</small><h2>Retour après 30 jours</h2></div>
      </div>
      <div className="admin-retention__body">
        <div className={`admin-retention__gauge${measurable ? "" : " is-pending"}`} style={{ "--retention": `${rate * 3.6}deg` }}>
          <span><strong>{measurable ? `${formatDecimal(rate)} %` : "—"}</strong><small>{measurable ? "des familles" : "En attente"}</small></span>
        </div>
        <div className="admin-retention__copy">
          {measurable
            ? <>
                <strong>{formatInteger(retention.returnedFamilies)} familles revenues</strong>
                <p>sur {formatInteger(retention.eligibleFamilies)} familles inscrites depuis au moins 30 jours.</p>
              </>
            : <>
                <strong>Pas encore mesurable</strong>
                <p>La première cohorte atteindra 30 jours{retention.nextCohortMaturesAt ? ` le ${formatDate(retention.nextCohortMaturesAt)}` : " prochainement"}.</p>
              </>}
        </div>
      </div>
    </article>
  );
}

function PopulationCard({ users }) {
  const total = Math.max(1, Number(users.total) || 0);
  const parentShare = Math.round(((Number(users.parents) || 0) / total) * 100);
  return (
    <article className="admin-panel admin-population">
      <div className="admin-panel__heading">
        <span className="admin-panel__icon admin-panel__icon--mint"><UsersThree size={22} weight="fill" /></span>
        <div><small>Population</small><h2>Comptes inscrits</h2></div>
      </div>
      <strong className="admin-population__total">{formatInteger(users.total)}</strong>
      <div className="admin-population__bar" aria-label={`${parentShare} % de parents et ${100 - parentShare} % d’enfants`}>
        <span style={{ width: `${parentShare}%` }} />
      </div>
      <div className="admin-population__legend">
        <span><i className="is-parent" /> <strong>{formatInteger(users.parents)}</strong> parents</span>
        <span><i className="is-child" /> <strong>{formatInteger(users.children)}</strong> enfants</span>
      </div>
    </article>
  );
}

function UsageTable({ usage }) {
  return (
    <section className="admin-panel admin-usage" aria-labelledby="admin-usage-title">
      <div className="admin-panel__heading">
        <span className="admin-panel__icon admin-panel__icon--yellow"><Sparkle size={22} weight="fill" /></span>
        <div>
          <small>Engagement agrégé</small>
          <h2 id="admin-usage-title">Fréquence des sessions et activités</h2>
        </div>
      </div>
      <div className="admin-usage__table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Indicateur</th>
              <th scope="col">7 jours</th>
              <th scope="col">30 jours</th>
              <th scope="col">Par famille active</th>
              <th scope="col">Moyenne / jour</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((metric) => (
              <tr key={metric.label}>
                <th scope="row">{metric.label}</th>
                <td>{formatInteger(metric.last7Days)}</td>
                <td>{formatInteger(metric.last30Days)}</td>
                <td>{formatDecimal(metric.perActiveFamily30)}</td>
                <td>{formatDecimal(metric.perDay30)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-usage__definition">
        Une session correspond à une authentification ouverte. Une journée Clubhouse active compte au maximum une fois par enfant et par date.
      </p>
    </section>
  );
}

const accountStatusLabel = (account) => {
  if (account.accountStatus === "suspended") return "Suspendu";
  if (account.processingRestrictedAt) return "Traitement limité";
  if (account.role === "child" && account.profileStatus === "paused") return "En pause parentale";
  return "Actif";
};

const accountStatusClass = (account) => {
  if (account.accountStatus === "suspended") return "is-suspended";
  if (account.processingRestrictedAt) return "is-restricted";
  if (account.role === "child" && account.profileStatus === "paused") return "is-paused";
  return "is-active";
};

function AccountStatusDialog({ account, busy, onCancel, onConfirm }) {
  const nextStatus = account.accountStatus === "suspended" ? "active" : "suspended";
  const [reason, setReason] = useState("");
  const suspending = nextStatus === "suspended";

  const submit = (event) => {
    event.preventDefault();
    onConfirm({
      status: nextStatus,
      reason: suspending ? reason.trim() : "",
    });
  };

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-account-dialog-title">
        <span className={`admin-dialog__icon ${suspending ? "is-warning" : "is-success"}`}>
          {suspending ? <PauseCircle size={28} weight="fill" /> : <PlayCircle size={28} weight="fill" />}
        </span>
        <p className="admin-eyebrow">Gestion du compte</p>
        <h2 id="admin-account-dialog-title">
          {suspending ? `Suspendre le compte de ${account.name} ?` : `Réactiver le compte de ${account.name} ?`}
        </h2>
        <p>
          {suspending
            ? "Toutes les sessions ouvertes seront immédiatement fermées. La personne ne pourra plus se connecter jusqu’à la réactivation."
            : "La personne pourra de nouveau se connecter. Ses anciennes sessions resteront fermées."}
        </p>
        <form onSubmit={submit}>
          {suspending && (
            <label>
              Motif interne de la suspension
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={240}
                rows={3}
                placeholder="Ex. vérification du compte demandée"
                autoFocus
                required
              />
              <small>Visible uniquement dans l’administration.</small>
            </label>
          )}
          <div className="admin-dialog__actions">
            <button type="button" className="admin-secondary-button" onClick={onCancel} disabled={busy}>Annuler</button>
            <button
              type="submit"
              className={`admin-dialog__confirm ${suspending ? "is-danger" : "is-success"}`}
              disabled={busy || (suspending && reason.trim().length < 3)}
            >
              {busy ? "Mise à jour…" : suspending ? "Suspendre le compte" : "Réactiver le compte"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminAccountRow({ account, onManage }) {
  const parent = account.role === "parent";
  const protectedAccount = Boolean(account.protectedAdministrator);
  return (
    <article className="admin-account-row">
      <span className={`admin-account-row__avatar ${parent ? "is-parent" : "is-child"}`} aria-hidden="true">
        {parent ? <UserCircle size={24} weight="fill" /> : <IdentificationCard size={24} weight="fill" />}
      </span>
      <div className="admin-account-row__identity">
        <div>
          <strong>{account.name}</strong>
          <span className={`admin-account-status ${accountStatusClass(account)}`}>{accountStatusLabel(account)}</span>
          {protectedAccount && <span className="admin-account-protected"><ShieldCheck size={13} weight="fill" /> Administrateur</span>}
        </div>
        <p>
          {parent
            ? `${account.familyRole === "primary" ? "Parent principal" : "Co-parent"} · ${account.email}`
            : `${account.age ?? "—"} ans · @${account.username || "sans-identifiant"}`}
        </p>
        <small>
          ID contact {account.contactId || "—"} · Dernière activité {formatDateTime(account.lastActivityAt)}
        </small>
        {account.accountStatus === "suspended" && account.suspensionReason && (
          <small className="admin-account-row__reason">Motif : {account.suspensionReason}</small>
        )}
      </div>
      <div className="admin-account-row__dates">
        <small>Compte créé</small>
        <strong>{formatDateTime(account.createdAt)}</strong>
      </div>
      <button
        type="button"
        className={`admin-account-row__action ${account.accountStatus === "suspended" ? "is-reactivate" : ""}`}
        onClick={() => onManage(account)}
        disabled={protectedAccount}
        title={protectedAccount ? "Ce compte administrateur est protégé." : undefined}
      >
        {account.accountStatus === "suspended"
          ? <><PlayCircle size={17} weight="fill" /> Réactiver</>
          : <><PauseCircle size={17} weight="fill" /> Suspendre</>}
      </button>
    </article>
  );
}

function AdminFamilyCard({ family, onManageAccount }) {
  const accountCount = family.parents.length + family.children.length;
  return (
    <article className="admin-family-card">
      <header className="admin-family-card__header">
        <span className="admin-family-card__icon"><Buildings size={25} weight="fill" /></span>
        <div>
          <div className="admin-family-card__title">
            <h2>{family.name}</h2>
            <span className={`admin-family-status ${family.accountStatus === "suspended" ? "is-suspended" : ""}`}>
              {family.accountStatus === "suspended" ? "Suspension en cours" : "Comptes accessibles"}
            </span>
          </div>
          <p>
            Créée le {formatDateTime(family.createdAt)} · {accountCount} compte{accountCount > 1 ? "s" : ""}
            {family.pendingInvitations ? ` · ${family.pendingInvitations} invitation en attente` : ""}
          </p>
        </div>
      </header>
      <div className="admin-family-card__group">
        <div className="admin-family-card__group-title">
          <strong>Parents et co-parents</strong>
          <span>{family.parents.length}</span>
        </div>
        {family.parents.length
          ? family.parents.map((account) => <AdminAccountRow key={account.id} account={account} onManage={onManageAccount} />)
          : <p className="admin-family-card__empty">Aucun compte parent rattaché.</p>}
      </div>
      <div className="admin-family-card__group">
        <div className="admin-family-card__group-title">
          <strong>Enfants</strong>
          <span>{family.children.length}</span>
        </div>
        {family.children.length
          ? family.children.map((account) => <AdminAccountRow key={account.id} account={account} onManage={onManageAccount} />)
          : <p className="admin-family-card__empty">Aucun profil enfant dans cette famille.</p>}
      </div>
    </article>
  );
}

function FamilyManagement({ previewMode, refreshToken, onBusyChange }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState(previewMode ? previewFamilies : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [managedAccount, setManagedAccount] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadDirectory = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      if (previewMode) {
        const normalizedSearch = search.trim().toLowerCase();
        const filtered = previewFamilies.families.filter((family) => {
          const accounts = [...family.parents, ...family.children];
          const searchMatches = !normalizedSearch || [
            family.name,
            ...accounts.flatMap((account) => [
              account.name,
              account.email,
              account.username,
              account.contactId,
            ]),
          ].some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));
          const statusMatches = status === "all" || family.accountStatus === status;
          return searchMatches && statusMatches;
        });
        setDirectory({
          ...previewFamilies,
          families: filtered,
          pagination: { ...previewFamilies.pagination, total: filtered.length },
          filters: { search, status },
        });
      } else {
        setDirectory(await api.adminFamilies({ search, status, page, pageSize: 20 }));
      }
    } catch (loadError) {
      setError(loadError.message || "Les familles ne peuvent pas être chargées pour le moment.");
    } finally {
      setBusy(false);
    }
  }, [page, previewMode, search, status]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory, refreshToken]);

  useEffect(() => {
    onBusyChange?.(busy || actionBusy);
  }, [actionBusy, busy, onBusyChange]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeStatus = (event) => {
    setPage(1);
    setStatus(event.target.value);
  };

  const updateAccountStatus = async ({ status: nextStatus, reason }) => {
    if (!managedAccount) return;
    setActionBusy(true);
    setError("");
    try {
      if (previewMode) {
        setDirectory((current) => ({
          ...current,
          families: current.families.map((family) => {
            const updateAccounts = (accounts) => accounts.map((account) => (
              account.id === managedAccount.id
                ? {
                    ...account,
                    accountStatus: nextStatus,
                    suspendedAt: nextStatus === "suspended" ? new Date().toISOString() : null,
                    suspensionReason: nextStatus === "suspended" ? reason : "",
                  }
                : account
            ));
            const parents = updateAccounts(family.parents);
            const children = updateAccounts(family.children);
            return {
              ...family,
              parents,
              children,
              accountStatus: [...parents, ...children].some((account) => account.accountStatus === "suspended")
                ? "suspended"
                : "active",
            };
          }),
        }));
      } else {
        await api.updateAdminAccountStatus(managedAccount.id, {
          status: nextStatus,
          reason,
        });
        await loadDirectory();
      }
      setManagedAccount(null);
    } catch (updateError) {
      setError(updateError.message || "Le compte n’a pas pu être mis à jour.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <section className="admin-title admin-title--directory">
        <div>
          <p className="admin-eyebrow">Gestion des comptes</p>
          <h1>Familles et enfants</h1>
          <p>Retrouvez les comptes familiaux, leurs profils enfants et leur état d’accès.</p>
        </div>
        <span className="admin-privacy-badge admin-privacy-badge--individual">
          <LockKey size={18} weight="fill" /> Accès individuel journalisé
        </span>
      </section>

      <section className="admin-directory-toolbar" aria-label="Filtres des familles">
        <form onSubmit={submitSearch}>
          <MagnifyingGlass size={19} weight="bold" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Famille, parent, enfant, e-mail ou identifiant…"
            aria-label="Rechercher une famille ou un compte"
          />
          <button type="submit">Rechercher</button>
        </form>
        <label>
          État
          <select value={status} onChange={changeStatus}>
            <option value="all">Toutes les familles</option>
            <option value="active">Comptes accessibles</option>
            <option value="suspended">Avec une suspension</option>
          </select>
        </label>
      </section>

      {error && <p className="admin-inline-error" role="alert"><WarningCircle size={18} weight="fill" />{error}</p>}

      <section className="admin-directory-summary" aria-live="polite">
        <div>
          <strong>{formatInteger(directory?.pagination?.total ?? 0)}</strong>
          <span>famille{directory?.pagination?.total === 1 ? "" : "s"}</span>
        </div>
        <p>
          Les informations de compte sont visibles ici. Les conversations, messages, médias et mots de passe restent exclus.
        </p>
      </section>

      <section className={`admin-family-list${busy ? " is-loading" : ""}`} aria-busy={busy}>
        {busy && !directory && (
          <div className="admin-directory-loading" role="status">
            <span className="admin-spinner" aria-hidden="true" /> Chargement des familles…
          </div>
        )}
        {!busy && directory?.families?.length === 0 && (
          <div className="admin-directory-empty">
            <MagnifyingGlass size={30} weight="duotone" />
            <strong>Aucune famille trouvée</strong>
            <p>Modifiez la recherche ou le filtre d’état.</p>
          </div>
        )}
        {directory?.families?.map((family) => (
          <AdminFamilyCard key={family.id} family={family} onManageAccount={setManagedAccount} />
        ))}
      </section>

      {directory?.pagination?.totalPages > 1 && (
        <nav className="admin-pagination" aria-label="Pagination des familles">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || busy}>
            <CaretLeft size={17} weight="bold" /> Précédent
          </button>
          <span>Page {directory.pagination.page} sur {directory.pagination.totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(directory.pagination.totalPages, current + 1))} disabled={page >= directory.pagination.totalPages || busy}>
            Suivant <CaretRight size={17} weight="bold" />
          </button>
        </nav>
      )}

      <footer className="admin-data-note admin-data-note--individual">
        <ShieldCheck size={20} weight="fill" />
        <div>
          <strong>Gestion strictement limitée aux comptes</strong>
          <p>Les consultations et les suspensions sont réservées à l’administrateur autorisé et journalisées par le serveur.</p>
        </div>
        <small>Dernière consultation {formatDateTime(new Date().toISOString())}</small>
      </footer>

      {managedAccount && (
        <AccountStatusDialog
          account={managedAccount}
          busy={actionBusy}
          onCancel={() => {
            if (!actionBusy) setManagedAccount(null);
          }}
          onConfirm={updateAccountStatus}
        />
      )}
    </>
  );
}

function AdminDashboard({ account, analytics, busy, error, onRefresh, onLogout, previewMode }) {
  const initialSection = previewMode
    && new URLSearchParams(window.location.search).get("section") === "families"
    ? "families"
    : "overview";
  const [section, setSection] = useState(initialSection);
  const [directoryRefreshToken, setDirectoryRefreshToken] = useState(0);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const refreshCurrentSection = () => {
    if (section === "families") {
      setDirectoryRefreshToken((current) => current + 1);
    } else {
      onRefresh();
    }
  };

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__inner">
          <Brand />
          <div className="admin-header__actions">
            <span className="admin-header__identity"><LockKey size={16} weight="fill" /> Accès administrateur</span>
            <button type="button" onClick={refreshCurrentSection} disabled={busy || directoryBusy} aria-label="Actualiser la section">
              <ArrowClockwise size={19} weight="bold" /> <span>Actualiser</span>
            </button>
            <button type="button" onClick={onLogout} aria-label="Se déconnecter">
              <SignOut size={19} weight="bold" /> <span>Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <div className="admin-content">
        <nav className="admin-section-tabs" aria-label="Sections de l’administration">
          <button
            type="button"
            className={section === "overview" ? "is-active" : ""}
            onClick={() => setSection("overview")}
            aria-current={section === "overview" ? "page" : undefined}
          >
            <ChartLineUp size={19} weight="fill" /> Vue d’ensemble
          </button>
          <button
            type="button"
            className={section === "families" ? "is-active" : ""}
            onClick={() => setSection("families")}
            aria-current={section === "families" ? "page" : undefined}
          >
            <Buildings size={19} weight="fill" /> Familles et comptes
          </button>
        </nav>

        {section === "overview" ? (
          <>
            <section className="admin-title">
              <div>
                <p className="admin-eyebrow">Pilotage du service</p>
                <h1>Vue d’ensemble</h1>
                <p>Une lecture simple de l’adoption et de l’usage, sans exposer les familles.</p>
              </div>
              <span className="admin-privacy-badge"><CheckCircle size={18} weight="fill" /> Données agrégées uniquement</span>
            </section>

            {error && <p className="admin-inline-error" role="alert"><WarningCircle size={18} weight="fill" />{error}</p>}

            <section className="admin-metrics" aria-label="Indicateurs principaux">
              <MetricCard icon={HouseLine} label="Familles" value={analytics.families.total} detail={`${formatInteger(analytics.families.withChildren)} avec au moins un enfant`} tone="violet" />
              <MetricCard icon={CalendarCheck} label="Familles actives · 7 jours" value={analytics.families.active7Days} detail={`${formatInteger(analytics.users.active7Days)} utilisateurs actifs`} tone="mint" />
              <MetricCard icon={UsersThree} label="Familles actives · 30 jours" value={analytics.families.active30Days} detail={`${formatInteger(analytics.users.active30Days)} utilisateurs actifs`} tone="blue" />
              <MetricCard icon={ChartLineUp} label="Nouvelles familles · 30 jours" value={analytics.families.new30Days} detail={`dont ${formatInteger(analytics.families.new7Days)} ces 7 derniers jours`} tone="yellow" />
            </section>

            <section className="admin-secondary-grid">
              <RetentionCard retention={analytics.retention30Days} />
              <PopulationCard users={analytics.users} />
            </section>

            <UsageTable usage={analytics.usage} />

            <footer className="admin-data-note">
              <LockKey size={20} weight="fill" />
              <div>
                <strong>Aucun contenu privé dans ce tableau</strong>
                <p>Les comptes administrateurs et leur famille sont exclus. Aucun nom, identifiant de contact, message ou média n’est transmis.</p>
              </div>
              <small>Actualisé {formatDateTime(analytics.generatedAt)}</small>
            </footer>
          </>
        ) : (
          <FamilyManagement
            previewMode={previewMode}
            refreshToken={directoryRefreshToken}
            onBusyChange={setDirectoryBusy}
          />
        )}
      </div>
      <span className="admin-sr-only">Session de {account?.name ?? "l’administrateur"}</span>
    </main>
  );
}

export default function AdminEntry() {
  const previewMode = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("visualTest") === "admin";
  const [account, setAccount] = useState(previewMode ? { name: "Aperçu" } : null);
  const [analytics, setAnalytics] = useState(previewMode ? previewAnalytics : null);
  const [restoring, setRestoring] = useState(!previewMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (previewMode) {
      setAnalytics({ ...previewAnalytics, generatedAt: new Date().toISOString() });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = await api.adminAnalytics();
      setAnalytics(payload.analytics);
      setAccessDenied(false);
    } catch (loadError) {
      if (loadError.status === 403 || loadError.status === 404) {
        setAccessDenied(true);
      } else {
        setError(loadError.message || "Les statistiques ne peuvent pas être chargées pour le moment.");
      }
    } finally {
      setBusy(false);
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;
    let current = true;
    api.me()
      .then(({ account: restoredAccount }) => {
        if (!current) return;
        setAccount(restoredAccount);
        return loadAnalytics();
      })
      .catch((restoreError) => {
        if (!current) return;
        if (restoreError?.status === 401 || restoreError?.payload?.accountSuspended) {
          void clearToken();
          return;
        }
        setError("Votre session est conservée. Réessayez lorsque la connexion Internet est revenue.");
      })
      .finally(() => {
        if (current) setRestoring(false);
      });
    return () => {
      current = false;
    };
  }, [loadAnalytics, previewMode]);

  const login = async (credentials) => {
    setBusy(true);
    setError("");
    try {
      const { account: authenticatedAccount } = await api.login(credentials);
      if (authenticatedAccount.role !== "parent") {
        await api.logout().catch(() => clearToken());
        setError("L’administration exige un compte adulte autorisé.");
        return;
      }
      setAccount(authenticatedAccount);
      await loadAnalytics();
    } catch (loginError) {
      setError(loginError.message || "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!previewMode) await api.logout().catch(() => clearToken());
    setAccount(null);
    setAnalytics(null);
    setAccessDenied(false);
    setError("");
  };

  const content = useMemo(() => {
    if (restoring) return <AdminLoading />;
    if (!account) return <AdministrationLogin onLogin={login} busy={busy} error={error} />;
    if (accessDenied) return <AccessDenied onLogout={logout} />;
    if (!analytics) return <AdminLoading />;
    return <AdminDashboard account={account} analytics={analytics} busy={busy} error={error} onRefresh={loadAnalytics} onLogout={logout} previewMode={previewMode} />;
  }, [accessDenied, account, analytics, busy, error, loadAnalytics, previewMode, restoring]);

  return content;
}
