import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { CalendarCheck } from "@phosphor-icons/react/CalendarCheck";
import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { HouseLine } from "@phosphor-icons/react/HouseLine";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
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

function AdminDashboard({ account, analytics, busy, error, onRefresh, onLogout }) {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__inner">
          <Brand />
          <div className="admin-header__actions">
            <span className="admin-header__identity"><LockKey size={16} weight="fill" /> Accès administrateur</span>
            <button type="button" onClick={onRefresh} disabled={busy} aria-label="Actualiser les statistiques">
              <ArrowClockwise size={19} weight="bold" /> <span>Actualiser</span>
            </button>
            <button type="button" onClick={onLogout} aria-label="Se déconnecter">
              <SignOut size={19} weight="bold" /> <span>Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <div className="admin-content">
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
      .catch(() => clearToken())
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
    return <AdminDashboard account={account} analytics={analytics} busy={busy} error={error} onRefresh={loadAnalytics} onLogout={logout} />;
  }, [accessDenied, account, analytics, busy, error, loadAnalytics, restoring]);

  return content;
}
