import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import webpush from "web-push";
import { initializeDatabase, pool } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 10000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET est requis");
let pushEnabled = false;
let vapidPublicKey = "";

async function initializeWebPush() {
  let keys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
    : null;

  if (!keys) {
    const generatedKeys = webpush.generateVAPIDKeys();
    await pool.query(
      `insert into application_settings(setting_key,setting_value)
       values('web_push_vapid_keys',$1::jsonb)
       on conflict(setting_key) do nothing`,
      [JSON.stringify(generatedKeys)],
    );
    const stored = await pool.query("select setting_value from application_settings where setting_key='web_push_vapid_keys'");
    keys = stored.rows[0]?.setting_value ?? generatedKeys;
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contact@secret-clubhouse.fr",
      keys.publicKey,
      keys.privateKey,
    );
    vapidPublicKey = keys.publicKey;
    pushEnabled = true;
  } catch (error) {
    console.warn(`Notifications push désactivées : configuration VAPID invalide (${error.message}).`);
  }
}

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
  });
  next();
});
app.use(express.json({ limit: "1mb" }));

const demoChildContactId = "SC-482-917-305";
const makeContactId = () => {
  let contactId;
  do {
    contactId = `SC-${Array.from({ length: 3 }, () => crypto.randomInt(100, 1000)).join("-")}`;
  } while (contactId === demoChildContactId);
  return contactId;
};
const signSession = (account) => jwt.sign({ sub: account.id, role: account.role }, jwtSecret, { expiresIn: "7d", issuer: "secret-clubhouse" });
const childColors = new Set(["mint", "violet", "sun", "coral"]);
const childStatuses = new Set(["active", "paused"]);
const avatarOptions = {
  hair: new Set(["short", "bob", "curly", "spiky", "bun", "long", "braids", "afro", "ponytail", "waves"]),
  hairColor: new Set(["brown", "black", "blond", "ginger", "violet", "chestnut", "pink", "blue", "teal", "silver"]),
  face: new Set(["smile", "happy", "calm", "freckles", "wink", "laugh", "surprised", "shy", "star", "confident"]),
  skin: new Set(["light", "porcelain", "warm", "peach", "tan", "olive", "caramel", "brown", "deep", "ebony"]),
  outfit: new Set(["mint", "violet", "coral", "sun", "blue", "rose", "teal", "navy", "lilac", "orange"]),
};
const defaultAvatarConfig = { hair: "bob", hairColor: "brown", face: "smile", skin: "warm", outfit: "mint" };

function normalizeAvatarConfig(value, fallback = defaultAvatarConfig) {
  const current = { ...defaultAvatarConfig, ...(fallback ?? {}) };
  return Object.fromEntries(Object.entries(avatarOptions).map(([key, allowed]) => {
    const candidate = String(value?.[key] ?? current[key]);
    return [key, allowed.has(candidate) ? candidate : current[key]];
  }));
}
const defaultSafetySettings = { media: true };
const defaultCommunicationSchedule = {
  enabled: true,
  messages: { enabled: true, start: "07:30", end: "20:30" },
  calls: { enabled: true, start: "08:00", end: "19:30" },
  video: { enabled: false, start: "09:00", end: "18:30" },
  autoReply: { enabled: true, message: "Je suis en mode calme pour le moment. Je te répondrai pendant mes horaires autorisés." },
};

const normalizeUsername = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ".")
  .replace(/^\.|\.$/g, "")
  .slice(0, 18);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invitationTokenPattern = /^[A-Za-z0-9_-]{40,128}$/;
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const hashInvitationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const makeInvitationToken = () => crypto.randomBytes(32).toString("base64url");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getParentFamilyMembership(parentId, executor = pool) {
  const result = await executor.query(
    `select f.id as family_id,f.name,fm.role,fm.joined_at
     from family_memberships fm join families f on f.id=fm.family_id
     where fm.parent_id=$1`,
    [parentId],
  );
  return result.rows[0] ?? null;
}

async function serializeFamilyForParent(parentId, executor = pool) {
  const membership = await getParentFamilyMembership(parentId, executor);
  if (!membership) return null;
  await executor.query(
    "update family_parent_invitations set status='expired' where family_id=$1 and status='pending' and expires_at<=now()",
    [membership.family_id],
  );
  const [membersResult, invitationsResult] = await Promise.all([
    executor.query(
      `select a.id,a.display_name,a.email,a.contact_id,fm.role,fm.joined_at
       from family_memberships fm join accounts a on a.id=fm.parent_id
       where fm.family_id=$1
       order by case fm.role when 'primary' then 0 else 1 end,fm.joined_at,a.display_name`,
      [membership.family_id],
    ),
    executor.query(
      `select i.id,i.email,i.expires_at,i.created_at,i.invited_by,a.display_name as invited_by_name
       from family_parent_invitations i left join accounts a on a.id=i.invited_by
       where i.family_id=$1 and i.status='pending' and i.expires_at>now()
       order by i.created_at desc`,
      [membership.family_id],
    ),
  ]);
  return {
    id: membership.family_id,
    name: membership.name,
    role: membership.role,
    members: membersResult.rows.map((member) => ({
      id: member.id,
      name: member.display_name,
      email: member.email,
      contactId: member.contact_id,
      role: member.role,
      joinedAt: member.joined_at,
    })),
    pendingInvitations: invitationsResult.rows.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
      invitedBy: invitation.invited_by ? { id: invitation.invited_by, name: invitation.invited_by_name } : null,
    })),
  };
}

async function getInvitationByToken(token, executor = pool, forUpdate = false) {
  const normalizedToken = String(token ?? "").trim();
  if (!invitationTokenPattern.test(normalizedToken)) return null;
  const result = await executor.query(
    `select i.*,f.name as family_name,a.display_name as inviter_name
     from family_parent_invitations i
     join families f on f.id=i.family_id
     left join accounts a on a.id=i.invited_by
     where i.token_hash=$1${forUpdate ? " for update of i" : ""}`,
    [hashInvitationToken(normalizedToken)],
  );
  return result.rows[0] ?? null;
}

function invitationLink(req, token) {
  const configuredBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  const base = configuredBase || `${req.protocol}://${req.get("host")}`;
  return `${base.replace(/\/$/, "")}/#familyInvite=${encodeURIComponent(token)}`;
}

async function acceptFamilyInvitation(token, parentId) {
  const client = await pool.connect();
  let familyId;
  try {
    await client.query("begin");
    const accountResult = await client.query("select id,role,email from accounts where id=$1 for update", [parentId]);
    const account = accountResult.rows[0];
    if (!account || account.role !== "parent") throw httpError(403, "Cette invitation est réservée à un compte parent.");

    const invitation = await getInvitationByToken(token, client, true);
    if (!invitation) throw httpError(404, "Invitation de co-parent introuvable.");
    if (invitation.status !== "pending") throw httpError(410, "Cette invitation a déjà été utilisée ou révoquée.");
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw httpError(410, "Cette invitation de co-parent a expiré.");
    }
    if (normalizeEmail(account.email) !== normalizeEmail(invitation.email)) {
      throw httpError(403, "Connectez-vous avec l’adresse e-mail à laquelle cette invitation a été envoyée.");
    }

    const membershipResult = await client.query(
      `select fm.family_id,fm.role,
        (select count(*)::int from family_memberships members where members.family_id=fm.family_id) as member_count,
        (select count(*)::int from family_children children where children.family_id=fm.family_id) as child_count,
        (select count(*)::int from family_parent_invitations pending
          where pending.family_id=fm.family_id and pending.status='pending' and pending.expires_at>now()) as pending_count
       from family_memberships fm where fm.parent_id=$1 for update`,
      [parentId],
    );
    const currentMembership = membershipResult.rows[0];
    if (currentMembership && currentMembership.family_id !== invitation.family_id) {
      const disposableEmptyFamily = currentMembership.role === "primary"
        && Number(currentMembership.member_count) === 1
        && Number(currentMembership.child_count) === 0
        && Number(currentMembership.pending_count) === 0;
      if (!disposableEmptyFamily) {
        throw httpError(409, "Ce compte parent gère déjà une autre famille et ne peut pas rejoindre celle-ci.");
      }
      await client.query("delete from families where id=$1", [currentMembership.family_id]);
    }

    if (!currentMembership || currentMembership.family_id !== invitation.family_id) {
      await client.query(
        "insert into family_memberships(family_id,parent_id,role) values($1,$2,'coparent')",
        [invitation.family_id, parentId],
      );
    }
    await client.query(
      `update family_parent_invitations
       set status='accepted',accepted_by=$1,accepted_at=now()
       where id=$2 and status='pending'`,
      [parentId, invitation.id],
    );
    familyId = invitation.family_id;
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  const family = await serializeFamilyForParent(parentId);
  if (!family || family.id !== familyId) throw httpError(409, "Le rattachement à la famille n’a pas pu être confirmé.");
  return family;
}

const normalizeChannelSchedule = (value, fallback) => ({
  enabled: typeof value?.enabled === "boolean" ? value.enabled : fallback.enabled,
  start: /^([01]\d|2[0-3]):[0-5]\d$/.test(value?.start) ? value.start : fallback.start,
  end: /^([01]\d|2[0-3]):[0-5]\d$/.test(value?.end) ? value.end : fallback.end,
});

function normalizeSchedule(value = {}, fallback = defaultCommunicationSchedule) {
  const current = {
    ...defaultCommunicationSchedule,
    ...fallback,
    messages: { ...defaultCommunicationSchedule.messages, ...fallback?.messages },
    calls: { ...defaultCommunicationSchedule.calls, ...fallback?.calls },
    video: { ...defaultCommunicationSchedule.video, ...fallback?.video },
    autoReply: { ...defaultCommunicationSchedule.autoReply, ...fallback?.autoReply },
  };
  const message = typeof value?.autoReply?.message === "string"
    ? value.autoReply.message.trim().slice(0, 240)
    : current.autoReply.message;
  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : current.enabled,
    messages: normalizeChannelSchedule(value?.messages, current.messages),
    calls: normalizeChannelSchedule(value?.calls, current.calls),
    video: normalizeChannelSchedule(value?.video, current.video),
    autoReply: {
      enabled: typeof value?.autoReply?.enabled === "boolean" ? value.autoReply.enabled : current.autoReply.enabled,
      message,
    },
  };
}

function normalizeChildProfile(body, current = null) {
  const name = body.name === undefined ? current?.display_name ?? "" : String(body.name).trim().slice(0, 24);
  const age = body.age === undefined ? Number(current?.age) : Number(body.age);
  const username = body.username === undefined ? current?.username ?? "" : normalizeUsername(body.username);
  const color = body.color === undefined ? current?.avatar_color ?? "mint" : String(body.color);
  const status = body.status === undefined ? current?.status ?? "active" : String(body.status);
  const password = body.password === undefined || body.password === null ? "" : String(body.password);
  if (name.length < 2 || !Number.isInteger(age) || age < 6 || age > 13 || username.length < 3) {
    return { error: "Vérifiez le prénom, l’âge et le pseudo de l’enfant." };
  }
  if (!childColors.has(color) || !childStatuses.has(status)) return { error: "Profil enfant invalide." };
  if (!current && password.length < 6) return { error: "Le mot de passe enfant doit contenir au moins 6 caractères." };
  if (current && password.length > 0 && password.length < 6) return { error: "Le nouveau mot de passe doit contenir au moins 6 caractères." };
  return {
    profile: {
      name,
      age,
      username,
      color,
      status,
      password,
      settings: {
        ...defaultSafetySettings,
        ...(current?.safety_settings ?? {}),
        ...(body.settings ?? {}),
        media: typeof body.settings?.media === "boolean" ? body.settings.media : (current?.safety_settings?.media ?? defaultSafetySettings.media),
      },
      schedule: normalizeSchedule(body.schedule, current?.communication_schedule),
    },
  };
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentification requise." });
  try {
    req.auth = jwt.verify(token, jwtSecret, { issuer: "secret-clubhouse" });
    next();
  } catch {
    res.status(401).json({ error: "Session invalide ou expirée." });
  }
}

async function serializeAccount(account) {
  const serialized = { id: account.id, role: account.role, name: account.display_name, email: account.email, contactId: account.contact_id };
  if (account.role !== "child") return serialized;
  return {
    ...serialized,
    parentId: account.parent_id,
    age: Number(account.age),
    username: account.username,
    image: account.avatar_path,
    color: account.avatar_color || "mint",
    avatar: account.avatar_config ? normalizeAvatarConfig(account.avatar_config) : null,
    status: account.status || "active",
    settings: { ...defaultSafetySettings, ...(account.safety_settings ?? {}) },
    schedule: normalizeSchedule({}, account.communication_schedule),
  };
}

app.get("/api/health", async (_req, res) => {
  await pool.query("select 1");
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);
  const displayName = typeof name === "string" ? name.trim().slice(0, 80) : "";
  if (displayName.length < 2 || !isValidEmail(normalizedEmail) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Nom, e-mail et mot de passe de 8 caractères minimum requis." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const accountResult = await client.query(
        "insert into accounts(role,email,contact_id,password_hash,display_name) values('parent',$1,$2,$3,$4) returning *",
        [normalizedEmail, makeContactId(), passwordHash, displayName],
      );
      const account = accountResult.rows[0];
      const familyResult = await client.query(
        "insert into families(name,legacy_owner_id) values($1,$2) returning id",
        [`Famille de ${displayName}`, account.id],
      );
      await client.query(
        "insert into family_memberships(family_id,parent_id,role) values($1,$2,'primary')",
        [familyResult.rows[0].id, account.id],
      );
      await client.query("commit");
      const family = await serializeFamilyForParent(account.id);
      return res.status(201).json({ token: signSession(account), account: await serializeAccount(account), family });
    } catch (error) {
      await client.query("rollback");
      if (error.code === "23505" && error.constraint === "accounts_contact_id_key") continue;
      if (error.code === "23505" && error.constraint === "accounts_email_key") {
        return res.status(409).json({ error: "Cette adresse e-mail est déjà utilisée." });
      }
      throw error;
    } finally {
      client.release();
    }
  }
  return res.status(503).json({ error: "Impossible de générer un identifiant parent unique. Réessayez." });
});

app.post("/api/auth/register-with-invite", async (req, res) => {
  const token = String(req.body?.token ?? "").trim();
  const displayName = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
  const password = req.body?.password;
  const requestedEmail = req.body?.email === undefined ? "" : normalizeEmail(req.body.email);
  if (!invitationTokenPattern.test(token) || displayName.length < 2 || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Invitation, nom et mot de passe de 8 caractères minimum requis." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const invitation = await getInvitationByToken(token, client, true);
      if (!invitation) throw httpError(404, "Invitation de co-parent introuvable.");
      if (invitation.status !== "pending") throw httpError(410, "Cette invitation a déjà été utilisée ou révoquée.");
      if (new Date(invitation.expires_at).getTime() <= Date.now()) throw httpError(410, "Cette invitation de co-parent a expiré.");
      const invitationEmail = normalizeEmail(invitation.email);
      if (requestedEmail && requestedEmail !== invitationEmail) {
        throw httpError(403, "Cette invitation est liée à une autre adresse e-mail.");
      }

      const accountResult = await client.query(
        "insert into accounts(role,email,contact_id,password_hash,display_name) values('parent',$1,$2,$3,$4) returning *",
        [invitationEmail, makeContactId(), passwordHash, displayName],
      );
      const account = accountResult.rows[0];
      await client.query(
        "insert into family_memberships(family_id,parent_id,role) values($1,$2,'coparent')",
        [invitation.family_id, account.id],
      );
      const accepted = await client.query(
        `update family_parent_invitations
         set status='accepted',accepted_by=$1,accepted_at=now()
         where id=$2 and status='pending' returning id`,
        [account.id, invitation.id],
      );
      if (!accepted.rowCount) throw httpError(410, "Cette invitation n’est plus disponible.");
      await client.query("commit");
      const family = await serializeFamilyForParent(account.id);
      return res.status(201).json({ token: signSession(account), account: await serializeAccount(account), family });
    } catch (error) {
      await client.query("rollback");
      if (error.code === "23505" && error.constraint === "accounts_contact_id_key") continue;
      if (error.code === "23505" && error.constraint === "accounts_email_key") {
        return res.status(409).json({ error: "Un compte parent existe déjà avec cette adresse. Connectez-vous pour accepter l’invitation." });
      }
      throw error;
    } finally {
      client.release();
    }
  }
  return res.status(503).json({ error: "Impossible de générer un identifiant parent unique. Réessayez." });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, contactId, password } = req.body ?? {};
  const normalizedContactId = String(contactId ?? "").trim().toUpperCase();
  const result = email
    ? await pool.query("select * from accounts where role='parent' and email=$1", [String(email).trim().toLowerCase()])
    : normalizedContactId === demoChildContactId
      ? { rows: [] }
      : await pool.query("select * from accounts where role='child' and contact_id=$1", [normalizedContactId]);
  const account = result.rows[0];
  if (!account || !await bcrypt.compare(String(password ?? ""), account.password_hash)) return res.status(401).json({ error: "Identifiants incorrects." });
  res.json({ token: signSession(account), account: await serializeAccount(account) });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const result = await pool.query("select * from accounts where id=$1", [req.auth.sub]);
  if (!result.rows[0]) return res.status(404).json({ error: "Compte introuvable." });
  res.json({ account: await serializeAccount(result.rows[0]) });
});

app.patch("/api/account/password", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul le compte parent peut modifier ce mot de passe." });
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (currentPassword.length < 8 || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir entre 8 et 128 caractères." });
  }
  const result = await pool.query("select password_hash from accounts where id=$1 and role='parent'", [req.auth.sub]);
  const account = result.rows[0];
  if (!account || !await bcrypt.compare(currentPassword, account.password_hash)) {
    return res.status(401).json({ error: "Le mot de passe actuel est incorrect." });
  }
  if (await bcrypt.compare(newPassword, account.password_hash)) {
    return res.status(400).json({ error: "Choisissez un nouveau mot de passe différent de l’ancien." });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query("update accounts set password_hash=$1 where id=$2 and role='parent'", [passwordHash, req.auth.sub]);
  return res.status(204).end();
});

app.get("/api/family", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Accès réservé au compte parent." });
  const family = await serializeFamilyForParent(req.auth.sub);
  if (!family) return res.status(404).json({ error: "Ce compte parent n’est rattaché à aucune famille." });
  return res.json({ family });
});

app.post("/api/family/invitations/preview", async (req, res) => {
  res.set({ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" });
  const token = String(req.body?.token ?? "").trim();
  if (!invitationTokenPattern.test(token)) return res.status(400).json({ error: "Lien d’invitation invalide." });
  const invitation = await getInvitationByToken(token);
  if (!invitation) return res.status(404).json({ error: "Invitation de co-parent introuvable." });
  if (invitation.status !== "pending") return res.status(410).json({ error: "Cette invitation a déjà été utilisée ou révoquée." });
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await pool.query(
      "update family_parent_invitations set status='expired' where id=$1 and status='pending' and expires_at<=now()",
      [invitation.id],
    );
    return res.status(410).json({ error: "Cette invitation de co-parent a expiré." });
  }
  return res.json({
    invitation: {
      id: invitation.id,
      email: normalizeEmail(invitation.email),
      familyName: invitation.family_name,
      invitedByName: invitation.inviter_name || "Un parent",
      expiresAt: invitation.expires_at,
    },
  });
});

app.post("/api/family/invitations", requireAuth, async (req, res) => {
  res.set({ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" });
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul le parent principal peut inviter un co-parent." });
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return res.status(400).json({ error: "Saisissez une adresse e-mail valide." });

  const token = makeInvitationToken();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const membershipResult = await client.query(
      "select family_id,role from family_memberships where parent_id=$1 for update",
      [req.auth.sub],
    );
    const membership = membershipResult.rows[0];
    if (!membership) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
    if (membership.role !== "primary") throw httpError(403, "Seul le parent principal peut inviter un co-parent.");

    await client.query(
      "update family_parent_invitations set status='expired' where family_id=$1 and status='pending' and expires_at<=now()",
      [membership.family_id],
    );
    const existingMember = await client.query(
      `select 1 from family_memberships fm
       join accounts a on a.id=fm.parent_id
       where fm.family_id=$1 and lower(a.email)=lower($2)`,
      [membership.family_id, email],
    );
    if (existingMember.rowCount) throw httpError(409, "Cette personne fait déjà partie de la famille.");

    const invitationResult = await client.query(
      `insert into family_parent_invitations(family_id,email,token_hash,invited_by,expires_at)
       values($1,$2,$3,$4,now()+interval '7 days')
       returning id,email,expires_at,created_at`,
      [membership.family_id, email, hashInvitationToken(token), req.auth.sub],
    );
    await client.query("commit");
    const invitation = invitationResult.rows[0];
    return res.status(201).json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
        link: invitationLink(req, token),
      },
    });
  } catch (error) {
    await client.query("rollback");
    if (error.code === "23505" && error.constraint === "family_parent_invitations_pending_email_idx") {
      return res.status(409).json({ error: "Une invitation en attente existe déjà pour cette adresse e-mail." });
    }
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/family/invitations/:id", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul le parent principal peut révoquer une invitation." });
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: "Identifiant d’invitation invalide." });
  const membership = await getParentFamilyMembership(req.auth.sub);
  if (!membership) return res.status(404).json({ error: "Ce compte parent n’est rattaché à aucune famille." });
  if (membership.role !== "primary") return res.status(403).json({ error: "Seul le parent principal peut révoquer une invitation." });
  const result = await pool.query(
    `update family_parent_invitations
     set status='revoked',revoked_at=now()
     where id=$1 and family_id=$2 and status='pending' returning id`,
    [req.params.id, membership.family_id],
  );
  if (!result.rowCount) return res.status(404).json({ error: "Invitation en attente introuvable dans votre famille." });
  return res.status(204).end();
});

app.post("/api/family/invitations/accept", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Cette invitation est réservée à un compte parent." });
  const token = String(req.body?.token ?? "").trim();
  if (!invitationTokenPattern.test(token)) return res.status(400).json({ error: "Lien d’invitation invalide." });
  const family = await acceptFamilyInvitation(token, req.auth.sub);
  return res.json({ family });
});

app.delete("/api/family/members/:id", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul le parent principal peut retirer un co-parent." });
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: "Identifiant parent invalide." });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const requesterResult = await client.query(
      "select family_id,role from family_memberships where parent_id=$1 for update",
      [req.auth.sub],
    );
    const requester = requesterResult.rows[0];
    if (!requester) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
    if (requester.role !== "primary") throw httpError(403, "Seul le parent principal peut retirer un co-parent.");
    if (req.params.id === req.auth.sub) throw httpError(400, "Le parent principal ne peut pas se retirer lui-même.");

    const targetResult = await client.query(
      "select role from family_memberships where family_id=$1 and parent_id=$2 for update",
      [requester.family_id, req.params.id],
    );
    const target = targetResult.rows[0];
    if (!target) throw httpError(404, "Co-parent introuvable dans votre famille.");
    if (target.role !== "coparent") throw httpError(400, "Le parent principal ne peut pas être retiré.");

    await client.query(
      `delete from typing_states ts
       using family_conversations fc,family_children fchild
       where ts.conversation_id=fc.conversation_id
         and fc.parent_id=$1 and fc.child_id=fchild.child_id and fchild.family_id=$2`,
      [req.params.id, requester.family_id],
    );
    await client.query(
      `delete from conversation_members cm
       using family_conversations fc,family_children fchild
       where cm.conversation_id=fc.conversation_id and cm.account_id=$1
         and fc.parent_id=$1 and fc.child_id=fchild.child_id and fchild.family_id=$2`,
      [req.params.id, requester.family_id],
    );
    await client.query(
      `delete from family_conversations fc
       using family_children fchild
       where fc.parent_id=$1 and fc.child_id=fchild.child_id and fchild.family_id=$2`,
      [req.params.id, requester.family_id],
    );
    await client.query(
      "delete from family_memberships where family_id=$1 and parent_id=$2 and role='coparent'",
      [requester.family_id, req.params.id],
    );
    await client.query("commit");
    return res.status(204).end();
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/children", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Accès réservé au compte parent." });
  const result = await pool.query(
    `select child.*
     from family_memberships membership
     join family_children family_child on family_child.family_id=membership.family_id
     join accounts child on child.id=family_child.child_id and child.role='child'
     where membership.parent_id=$1 and child.contact_id<>$2
     order by family_child.added_at,child.display_name`,
    [req.auth.sub, demoChildContactId],
  );
  res.json({ children: await Promise.all(result.rows.map(serializeAccount)) });
});

app.post("/api/children", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut créer un compte enfant." });
  const normalized = normalizeChildProfile(req.body ?? {});
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const { profile } = normalized;
  const passwordHash = await bcrypt.hash(profile.password, 12);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const membershipResult = await client.query(
        `select mine.family_id,primary_member.parent_id as primary_parent_id
         from family_memberships mine
         join family_memberships primary_member on primary_member.family_id=mine.family_id and primary_member.role='primary'
         where mine.parent_id=$1
         for share of mine,primary_member`,
        [req.auth.sub],
      );
      const membership = membershipResult.rows[0];
      if (!membership) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
      const result = await client.query(
        `insert into accounts(role,contact_id,password_hash,display_name,parent_id,age,username,avatar_color,status,safety_settings,communication_schedule)
         values('child',$1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb) returning *`,
        [
          makeContactId(),
          passwordHash,
          profile.name,
          membership.primary_parent_id,
          profile.age,
          profile.username,
          profile.color,
          profile.status,
          JSON.stringify(profile.settings),
          JSON.stringify(profile.schedule),
        ],
      );
      await client.query(
        "insert into family_children(family_id,child_id) values($1,$2)",
        [membership.family_id, result.rows[0].id],
      );
      await client.query("commit");
      return res.status(201).json({ child: await serializeAccount(result.rows[0]) });
    } catch (error) {
      await client.query("rollback");
      if (error.code === "23505" && error.constraint === "accounts_contact_id_key") continue;
      if (error.code === "23505") return res.status(409).json({ error: "Ce pseudo est déjà utilisé dans votre famille." });
      throw error;
    } finally {
      client.release();
    }
  }
  return res.status(503).json({ error: "Impossible de générer un identifiant enfant unique. Réessayez." });
});

app.patch("/api/children/:id", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut modifier un compte enfant." });
  if (!uuidPattern.test(req.params.id)) {
    return res.status(400).json({ error: "Identifiant enfant invalide." });
  }
  const existingResult = await pool.query(
    `select child.*
     from family_memberships membership
     join family_children family_child on family_child.family_id=membership.family_id
     join accounts child on child.id=family_child.child_id and child.role='child'
     where child.id=$1 and membership.parent_id=$2 and child.contact_id<>$3`,
    [req.params.id, req.auth.sub, demoChildContactId],
  );
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Profil enfant introuvable dans votre famille." });
  const normalized = normalizeChildProfile(req.body ?? {}, existing);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const { profile } = normalized;
  const passwordHash = profile.password ? await bcrypt.hash(profile.password, 12) : existing.password_hash;
  try {
    const result = await pool.query(
      `update accounts set password_hash=$1,display_name=$2,age=$3,username=$4,avatar_color=$5,status=$6,
       safety_settings=$7::jsonb,communication_schedule=$8::jsonb
       where id=$9 and role='child' and exists(
         select 1 from family_memberships membership
         join family_children family_child on family_child.family_id=membership.family_id
         where membership.parent_id=$10 and family_child.child_id=accounts.id
       ) returning *`,
      [
        passwordHash,
        profile.name,
        profile.age,
        profile.username,
        profile.color,
        profile.status,
        JSON.stringify(profile.settings),
        JSON.stringify(profile.schedule),
        req.params.id,
        req.auth.sub,
      ],
    );
    res.json({ child: await serializeAccount(result.rows[0]) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ce pseudo est déjà utilisé dans votre famille." });
    throw error;
  }
});

app.patch("/api/account/avatar", requireAuth, async (req, res) => {
  if (req.auth.role !== "child") return res.status(403).json({ error: "L’avatar appartient au profil enfant." });
  const currentResult = await pool.query("select * from accounts where id=$1 and role='child'", [req.auth.sub]);
  const current = currentResult.rows[0];
  if (!current) return res.status(404).json({ error: "Profil enfant introuvable." });
  const avatar = normalizeAvatarConfig(req.body?.avatar, current.avatar_config);
  const result = await pool.query("update accounts set avatar_config=$1::jsonb where id=$2 returning *", [JSON.stringify(avatar), req.auth.sub]);
  res.json({ child: await serializeAccount(result.rows[0]) });
});

app.delete("/api/children/:id", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut supprimer un compte enfant." });
  if (!uuidPattern.test(req.params.id)) {
    return res.status(400).json({ error: "Identifiant enfant invalide." });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const membershipResult = await client.query(
      "select family_id,role from family_memberships where parent_id=$1 for update",
      [req.auth.sub],
    );
    const membership = membershipResult.rows[0];
    if (!membership) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
    if (membership.role !== "primary") throw httpError(403, "Seul le parent principal peut supprimer définitivement un enfant.");
    const childResult = await client.query(
      `select child.id
       from family_children family_child
       join accounts child on child.id=family_child.child_id and child.role='child'
       where child.id=$1 and family_child.family_id=$2 and child.contact_id<>$3
       for update of child`,
      [req.params.id, membership.family_id, demoChildContactId],
    );
    if (!childResult.rows[0]) {
      throw httpError(404, "Profil enfant introuvable dans votre famille.");
    }

    await client.query(
      "delete from conversations where id in (select conversation_id from conversation_members where account_id=$1)",
      [req.params.id],
    );
    await client.query("delete from accounts where id=$1", [req.params.id]);
    await client.query("commit");
    return res.status(204).end();
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.post("/api/presence/heartbeat", requireAuth, async (req, res) => {
  await pool.query("insert into presence(account_id,last_seen) values($1,now()) on conflict(account_id) do update set last_seen=excluded.last_seen", [req.auth.sub]);
  res.status(204).end();
});

app.get("/api/presence", requireAuth, async (req, res) => {
  const contactIds = String(req.query.contactIds ?? "").split(",").map((value) => value.trim()).filter((value) => /^SC-\d{3}-\d{3}-\d{3}$/.test(value)).slice(0, 100);
  if (!contactIds.length) return res.json({ presence: {} });
  const result = await pool.query("select a.contact_id, p.last_seen > now() - interval '75 seconds' as online from accounts a left join presence p on p.account_id=a.id where a.contact_id=any($1::text[])", [contactIds]);
  res.json({ presence: Object.fromEntries(result.rows.map((row) => [row.contact_id, Boolean(row.online)])) });
});

app.get("/api/push/public-key", requireAuth, (_req, res) => {
  if (!pushEnabled) return res.status(503).json({ error: "Les notifications push ne sont pas encore configurées." });
  res.json({ publicKey: vapidPublicKey });
});

app.post("/api/push/subscribe", requireAuth, async (req, res) => {
  const subscription = req.body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return res.status(400).json({ error: "Abonnement push invalide." });
  await pool.query("insert into push_subscriptions(account_id,endpoint,subscription) values($1,$2,$3::jsonb) on conflict(endpoint) do update set account_id=excluded.account_id, subscription=excluded.subscription", [req.auth.sub, subscription.endpoint, JSON.stringify(subscription)]);
  res.status(204).end();
});

app.delete("/api/push/subscribe", requireAuth, async (req, res) => {
  if (req.body?.endpoint) await pool.query("delete from push_subscriptions where account_id=$1 and endpoint=$2", [req.auth.sub, req.body.endpoint]);
  res.status(204).end();
});

app.post("/api/push/native-token", requireAuth, async (req, res) => {
  const { token, platform } = req.body ?? {};
  if (typeof token !== "string" || token.length < 20 || !["ios", "android"].includes(platform)) return res.status(400).json({ error: "Jeton mobile invalide." });
  await pool.query("insert into native_push_tokens(account_id,platform,token) values($1,$2,$3) on conflict(token) do update set account_id=excluded.account_id,platform=excluded.platform,updated_at=now()", [req.auth.sub, platform, token]);
  res.status(204).end();
});

const readPushHeader = (headers, name) => {
  const value = headers?.[name];
  return Array.isArray(value) ? value.join(",") : value || null;
};

const describePushAttempt = (row, response, error = null) => {
  const endpoint = row.subscription?.endpoint || "";
  let endpointHost = "invalid";
  try {
    endpointHost = new URL(endpoint).hostname;
  } catch {}
  const headers = response?.headers ?? error?.headers;
  return {
    subscriptionId: row.id,
    endpointHost,
    endpointHash: crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 12),
    statusCode: response?.statusCode ?? error?.statusCode ?? null,
    providerStatus: readPushHeader(headers, "x-wns-status") ?? readPushHeader(headers, "x-wns-notificationstatus"),
    messageId: readPushHeader(headers, "x-wns-msg-id"),
    debugTrace: readPushHeader(headers, "x-wns-debug-trace"),
    correlationVector: readPushHeader(headers, "ms-cv"),
    providerError: readPushHeader(headers, "x-wns-error-description"),
    error: error?.message ?? null,
  };
};

async function deliverWebPush(rows, payload, diagnostics = null, { ttl = 3600 } = {}) {
  if (!pushEnabled) return 0;
  const results = await Promise.all(rows.map(async (row) => {
    try {
      const wirePayload = payload === null ? undefined : JSON.stringify(payload);
      const response = await webpush.sendNotification(row.subscription, wirePayload, { TTL: ttl, urgency: "high" });
      const diagnostic = describePushAttempt(row, response);
      diagnostics?.push(diagnostic);
      if (diagnostics) console.info("Diagnostic transport Web Push", diagnostic);
      return !["dropped", "channelthrottled"].includes(diagnostic.providerStatus?.toLowerCase());
    }
    catch (error) {
      const diagnostic = describePushAttempt(row, null, error);
      diagnostics?.push(diagnostic);
      if (diagnostics) console.info("Diagnostic transport Web Push", diagnostic);
      if (error.statusCode === 404 || error.statusCode === 410) await pool.query("delete from push_subscriptions where id=$1", [row.id]);
      else console.error("Échec push", error.statusCode || error.message);
      return false;
    }
  }));
  return results.filter(Boolean).length;
}

async function notifyAccounts(accountIds, payload) {
  if (!pushEnabled || !accountIds.length) return 0;
  const result = await pool.query("select id,subscription from push_subscriptions where account_id=any($1::uuid[])", [accountIds]);
  return deliverWebPush(result.rows, payload);
}

async function notifyConversation(conversationId, senderId, payload) {
  if (!pushEnabled) return 0;
  const result = await pool.query("select ps.id,ps.subscription from push_subscriptions ps join conversation_members cm on cm.account_id=ps.account_id where cm.conversation_id=$1 and cm.account_id<>$2", [conversationId, senderId]);
  return deliverWebPush(result.rows, payload);
}

app.post("/api/push/test", requireAuth, async (req, res) => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  const mode = req.body?.mode ?? "encrypted";
  if (!endpoint.startsWith("https://") || endpoint.length > 2048) return res.status(400).json({ error: "Abonnement de test invalide." });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return res.status(400).json({ error: "Identifiant de test invalide." });
  if (mode !== "encrypted") return res.status(400).json({ error: "Mode de test invalide." });
  const subscriptions = await pool.query("select id,subscription from push_subscriptions where account_id=$1 and endpoint=$2", [req.auth.sub, endpoint]);
  if (!subscriptions.rowCount) {
    return res.status(409).json({
      error: "Cet abonnement Edge n’est plus enregistré. Désactivez puis réactivez les notifications.",
      code: "subscription_missing",
      mode,
    });
  }
  const diagnostics = [];
  const encryptedPayload = {
    title: "Secret Clubhouse est prêt",
    body: "Votre notification de test a été envoyée.",
    notificationType: "test",
    tag: "secret-clubhouse-test",
    url: "/?notification=test",
    requestId,
  };
  const accepted = await deliverWebPush(subscriptions.rows, encryptedPayload, diagnostics, { ttl: 30 });
  const transport = diagnostics[0] ?? null;
  if (!accepted) {
    const providerStatus = transport?.providerStatus?.toLowerCase();
    const expired = transport?.statusCode === 404 || transport?.statusCode === 410;
    const error = expired
      ? "L’abonnement de cet Edge a expiré. Désactivez puis réactivez les notifications."
      : providerStatus === "channelthrottled"
        ? "WNS limite temporairement les tests de cet Edge. Patientez quelques minutes avant de recommencer."
        : providerStatus === "dropped"
          ? "WNS a rejeté la notification destinée à cet Edge."
          : "Le service Push a refusé la notification destinée à cet Edge.";
    return res.status(409).json({
      error,
      code: expired ? "subscription_expired" : providerStatus === "channelthrottled" ? "provider_throttled" : "transport_rejected",
      mode,
      transportStatus: transport?.statusCode ?? null,
      providerStatus: transport?.providerStatus ?? null,
    });
  }
  res.json({
    accepted: true,
    mode,
    transportStatus: transport?.statusCode ?? null,
    providerStatus: transport?.providerStatus ?? null,
  });
});

app.post("/api/family-conversations", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut ouvrir une conversation familiale." });
  const contactId = String(req.body?.contactId ?? "").trim().toUpperCase();
  if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(contactId) || contactId === demoChildContactId) {
    return res.status(400).json({ error: "Identifiant enfant invalide." });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const childResult = await client.query(
      `select child.id,child.display_name,child.contact_id
       from family_memberships membership
       join family_children family_child on family_child.family_id=membership.family_id
       join accounts child on child.id=family_child.child_id and child.role='child'
       where membership.parent_id=$1 and child.contact_id=$2
       for share of membership,child`,
      [req.auth.sub, contactId],
    );
    const child = childResult.rows[0];
    if (!child) throw httpError(404, "Cet enfant n’appartient pas à votre famille.");
    await client.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", [req.auth.sub, child.id]);
    const existing = await client.query(
      "select conversation_id from family_conversations where parent_id=$1 and child_id=$2",
      [req.auth.sub, child.id],
    );
    let conversationId = existing.rows[0]?.conversation_id;
    if (!conversationId) {
      const conversation = await client.query("insert into conversations(kind) values('child') returning id");
      conversationId = conversation.rows[0].id;
      await client.query(
        "insert into conversation_members(conversation_id,account_id) values($1,$2),($1,$3)",
        [conversationId, req.auth.sub, child.id],
      );
      await client.query(
        "insert into family_conversations(parent_id,child_id,conversation_id) values($1,$2,$3)",
        [req.auth.sub, child.id, conversationId],
      );
    } else {
      await client.query(
        `insert into conversation_members(conversation_id,account_id) values($1,$2),($1,$3)
         on conflict(conversation_id,account_id) do nothing`,
        [conversationId, req.auth.sub, child.id],
      );
    }
    await client.query("commit");
    return res.status(existing.rowCount ? 200 : 201).json({
      conversation: { id: conversationId, kind: "child", name: child.display_name, contactId: child.contact_id, contactRole: "child", messages: [] },
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

async function ensureFamilyConversations(accountId) {
  const pairs = await pool.query(
    `select membership.parent_id,child.child_id
     from family_memberships membership
     join family_children child on child.family_id=membership.family_id
     where membership.parent_id=$1 or child.child_id=$1`,
    [accountId],
  );
  if (!pairs.rowCount) return;

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const pair of pairs.rows) {
      await client.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", [pair.parent_id, pair.child_id]);
      const existing = await client.query(
        "select conversation_id from family_conversations where parent_id=$1 and child_id=$2",
        [pair.parent_id, pair.child_id],
      );
      let conversationId = existing.rows[0]?.conversation_id;
      if (!conversationId) {
        const conversation = await client.query("insert into conversations(kind) values('child') returning id");
        conversationId = conversation.rows[0].id;
        await client.query(
          "insert into family_conversations(parent_id,child_id,conversation_id) values($1,$2,$3)",
          [pair.parent_id, pair.child_id, conversationId],
        );
      }
      await client.query(
        `insert into conversation_members(conversation_id,account_id) values($1,$2),($1,$3)
         on conflict(conversation_id,account_id) do nothing`,
        [conversationId, pair.parent_id, pair.child_id],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

app.get("/api/conversations", requireAuth, async (req, res) => {
  await ensureFamilyConversations(req.auth.sub);
  const result = await pool.query(`
    select c.id, c.kind, a.display_name as name, a.contact_id, a.role as contact_role,
      coalesce(json_agg(json_build_object('id',m.id,'senderId',m.sender_id,'text',m.body,'mediaName',m.media_name,'mediaType',m.media_type,'createdAt',m.created_at) order by m.created_at) filter (where m.id is not null),'[]') as messages
    from conversation_members mine
    join conversations c on c.id=mine.conversation_id
    join conversation_members other on other.conversation_id=c.id and other.account_id<>mine.account_id
    join accounts a on a.id=other.account_id
    left join messages m on m.conversation_id=c.id
    where mine.account_id=$1
    group by c.id,a.id
    order by max(m.created_at) desc nulls last`, [req.auth.sub]);
  res.json({ conversations: result.rows });
});

app.post("/api/contact-requests", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut ajouter un contact." });
  const contactId = String(req.body?.contactId ?? "").trim().toUpperCase();
  if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(contactId)) return res.status(400).json({ error: "Saisissez un identifiant au format SC-123-456-789." });
  const requesterMembership = await getParentFamilyMembership(req.auth.sub);
  if (!requesterMembership) return res.status(404).json({ error: "Ce compte parent n’est rattaché à aucune famille." });
  const targetResult = contactId === demoChildContactId
    ? { rows: [] }
    : await pool.query(
      `select target.id,target.role,target.display_name,
        child_family.family_id as child_family_id,child_primary.parent_id as child_primary_parent_id,
        parent_membership.family_id as parent_family_id
       from accounts target
       left join family_children child_family on child_family.child_id=target.id and target.role='child'
       left join family_memberships child_primary on child_primary.family_id=child_family.family_id and child_primary.role='primary'
       left join family_memberships parent_membership on parent_membership.parent_id=target.id and target.role='parent'
       where target.contact_id=$1`,
      [contactId],
    );
  const target = targetResult.rows[0];
  if (!target) return res.status(404).json({ error: "Aucun compte ne correspond à cet identifiant." });
  const targetFamilyId = target.role === "child" ? target.child_family_id : target.parent_family_id;
  if (targetFamilyId === requesterMembership.family_id) {
    return res.status(400).json({ error: "Cet identifiant appartient déjà à votre famille." });
  }
  const recipientParentId = target.role === "child" ? target.child_primary_parent_id : target.id;
  if (!recipientParentId) return res.status(409).json({ error: "La famille de ce contact n’a pas de parent principal disponible." });
  try {
    const result = await pool.query(`insert into contact_requests(requester_id,target_account_id,recipient_parent_id)
      values($1,$2,$3) returning id,status,created_at`, [req.auth.sub, target.id, recipientParentId]);
    await notifyAccounts([recipientParentId], {
      title: "Nouvelle demande de contact",
      body: "Une demande attend votre approbation dans l’espace parent.",
      notificationType: "contact-request",
      tag: `contact-request-${result.rows[0].id}`,
      url: "/?notification=contact-request",
    });
    res.status(201).json({ request: result.rows[0], contact: { name: target.display_name, contactId } });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Une demande existe déjà pour ce contact." });
    throw error;
  }
});

const emptyConnectFourBoard = () => Array(42).fill(0);
const connectFourWinner = (board) => {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const value = board[row * 7 + column];
      if (!value) continue;
      for (const [columnStep, rowStep] of directions) {
        let matches = 1;
        for (let offset = 1; offset < 4; offset += 1) {
          const nextColumn = column + columnStep * offset;
          const nextRow = row + rowStep * offset;
          if (nextColumn < 0 || nextColumn >= 7 || nextRow < 0 || nextRow >= 6 || board[nextRow * 7 + nextColumn] !== value) break;
          matches += 1;
        }
        if (matches === 4) return value;
      }
    }
  }
  return 0;
};

const gameSelect = `select g.*, p1.display_name as player_one_name, p1.contact_id as player_one_contact_id,
  p1.role as player_one_role, p2.display_name as player_two_name, p2.contact_id as player_two_contact_id, p2.role as player_two_role
  from game_sessions g join accounts p1 on p1.id=g.player_one_id join accounts p2 on p2.id=g.player_two_id`;

async function canPlayTogether(accountId, opponentId) {
  const result = await pool.query(`select 1 where
    exists(select 1 from conversation_members mine join conversation_members other using(conversation_id)
      where mine.account_id=$1 and other.account_id=$2)
    or exists(select 1 from family_memberships parent join family_children child using(family_id)
      where (parent.parent_id=$1 and child.child_id=$2) or (parent.parent_id=$2 and child.child_id=$1))
    or exists(select 1 from family_memberships mine join family_memberships other using(family_id)
      where mine.parent_id=$1 and other.parent_id=$2)`, [accountId, opponentId]);
  return Boolean(result.rowCount);
}

app.get("/api/game-contacts", requireAuth, async (req, res) => {
  const result = await pool.query(`select distinct account.id,account.role,account.display_name,account.contact_id
    from accounts account where account.id<>$1 and (
      exists(select 1 from conversation_members mine join conversation_members other using(conversation_id)
        where mine.account_id=$1 and other.account_id=account.id)
      or exists(select 1 from family_memberships parent join family_children child using(family_id)
        where (parent.parent_id=$1 and child.child_id=account.id) or (parent.parent_id=account.id and child.child_id=$1))
      or exists(select 1 from family_memberships mine join family_memberships other using(family_id)
        where mine.parent_id=$1 and other.parent_id=account.id)
    ) order by account.role desc,account.display_name`, [req.auth.sub]);
  res.json({ contacts: result.rows.map((row) => ({ id: row.id, role: row.role, name: row.display_name, contactId: row.contact_id })) });
});

app.get("/api/games", requireAuth, async (req, res) => {
  const result = await pool.query(`${gameSelect} where g.player_one_id=$1 or g.player_two_id=$1 order by g.updated_at desc limit 20`, [req.auth.sub]);
  res.json({ games: result.rows });
});

app.post("/api/games", requireAuth, async (req, res) => {
  const contactId = String(req.body?.contactId ?? "").trim().toUpperCase();
  const opponentResult = await pool.query("select id,role from accounts where contact_id=$1", [contactId]);
  const opponent = opponentResult.rows[0];
  if (!opponent || opponent.id === req.auth.sub) return res.status(404).json({ error: "Contact introuvable." });
  if (!await canPlayTogether(req.auth.sub, opponent.id)) return res.status(403).json({ error: "Ce contact doit appartenir à votre famille ou être approuvé avant de jouer." });
  const result = await pool.query(`insert into game_sessions(game_type,player_one_id,player_two_id,invited_by,board)
    values('connect_four',$1,$2,$1,$3::jsonb) returning id`, [req.auth.sub, opponent.id, JSON.stringify(emptyConnectFourBoard())]);
  const game = await pool.query(`${gameSelect} where g.id=$1`, [result.rows[0].id]);
  const inviter = await pool.query("select display_name from accounts where id=$1", [req.auth.sub]);
  await notifyAccounts([opponent.id], {
    title: "Invitation à jouer",
    body: `${inviter.rows[0]?.display_name || "Un ami"} t’invite à jouer à Puissance 4.`,
    notificationType: "game",
    tag: `game-${result.rows[0].id}`,
    url: "/?notification=game",
  });
  res.status(201).json({ game: game.rows[0] });
});

app.patch("/api/games/:gameId", requireAuth, async (req, res) => {
  const action = req.body?.action;
  if (!["accept", "decline"].includes(action)) return res.status(400).json({ error: "Action de partie invalide." });
  const gameResult = await pool.query("select * from game_sessions where id=$1 and player_two_id=$2", [req.params.gameId, req.auth.sub]);
  const game = gameResult.rows[0];
  if (!game || game.status !== "pending") return res.status(409).json({ error: "Cette invitation n’est plus disponible." });
  const status = action === "accept" ? "active" : "declined";
  const currentPlayerId = action === "accept" ? game.player_one_id : null;
  await pool.query("update game_sessions set status=$1,current_player_id=$2,updated_at=now() where id=$3", [status, currentPlayerId, game.id]);
  const updated = await pool.query(`${gameSelect} where g.id=$1`, [game.id]);
  res.json({ game: updated.rows[0] });
});

app.post("/api/games/:gameId/moves", requireAuth, async (req, res) => {
  const column = Number(req.body?.column);
  if (!Number.isInteger(column) || column < 0 || column > 6) return res.status(400).json({ error: "Colonne invalide." });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query("select * from game_sessions where id=$1 for update", [req.params.gameId]);
    const game = result.rows[0];
    if (!game || ![game.player_one_id, game.player_two_id].includes(req.auth.sub)) { await client.query("rollback"); return res.status(404).json({ error: "Partie introuvable." }); }
    if (game.status !== "active" || game.current_player_id !== req.auth.sub) { await client.query("rollback"); return res.status(409).json({ error: "Ce n’est pas votre tour." }); }
    const board = Array.isArray(game.board) ? [...game.board] : emptyConnectFourBoard();
    let targetIndex = -1;
    for (let row = 5; row >= 0; row -= 1) if (!board[row * 7 + column]) { targetIndex = row * 7 + column; break; }
    if (targetIndex < 0) { await client.query("rollback"); return res.status(409).json({ error: "Cette colonne est pleine." }); }
    const playerValue = req.auth.sub === game.player_one_id ? 1 : 2;
    board[targetIndex] = playerValue;
    const winnerValue = connectFourWinner(board);
    const isDraw = !winnerValue && board.every(Boolean);
    const winnerId = winnerValue === 1 ? game.player_one_id : winnerValue === 2 ? game.player_two_id : null;
    const status = winnerValue || isDraw ? "completed" : "active";
    const nextPlayerId = status === "active" ? (req.auth.sub === game.player_one_id ? game.player_two_id : game.player_one_id) : null;
    await client.query("update game_sessions set board=$1::jsonb,status=$2,current_player_id=$3,winner_id=$4,updated_at=now() where id=$5", [JSON.stringify(board), status, nextPlayerId, winnerId, game.id]);
    await client.query("commit");
    const updated = await pool.query(`${gameSelect} where g.id=$1`, [game.id]);
    res.json({ game: updated.rows[0] });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

async function isConversationMember(accountId, conversationId) {
  const result = await pool.query("select 1 from conversation_members where account_id=$1 and conversation_id=$2", [accountId, conversationId]);
  return result.rowCount === 1;
}

app.get("/api/conversations/:id/typing", requireAuth, async (req, res) => {
  if (!await isConversationMember(req.auth.sub, req.params.id)) return res.status(403).json({ error: "Conversation non autorisée." });
  await pool.query("delete from typing_states where conversation_id=$1 and expires_at<=now()", [req.params.id]);
  const result = await pool.query(`select a.display_name from typing_states t join accounts a on a.id=t.account_id
    where t.conversation_id=$1 and t.account_id<>$2 and t.expires_at>now() limit 1`, [req.params.id, req.auth.sub]);
  res.json({ typing: Boolean(result.rowCount), name: result.rows[0]?.display_name ?? null });
});

app.post("/api/conversations/:id/typing", requireAuth, async (req, res) => {
  if (!await isConversationMember(req.auth.sub, req.params.id)) return res.status(403).json({ error: "Conversation non autorisée." });
  if (req.body?.active === true) {
    await pool.query(`insert into typing_states(conversation_id,account_id,expires_at) values($1,$2,now()+interval '6 seconds')
      on conflict(conversation_id,account_id) do update set expires_at=excluded.expires_at`, [req.params.id, req.auth.sub]);
  } else {
    await pool.query("delete from typing_states where conversation_id=$1 and account_id=$2", [req.params.id, req.auth.sub]);
  }
  res.status(204).end();
});

app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  if (!await isConversationMember(req.auth.sub, req.params.id)) return res.status(403).json({ error: "Conversation non autorisée." });
  const body = String(req.body?.text ?? "").trim();
  if (!body || body.length > 4000) return res.status(400).json({ error: "Message vide ou trop long." });
  const result = await pool.query("insert into messages(conversation_id,sender_id,body) values($1,$2,$3) returning id,body,created_at", [req.params.id, req.auth.sub, body]);
  const sender = await pool.query("select display_name from accounts where id=$1", [req.auth.sub]);
  await notifyConversation(req.params.id, req.auth.sub, { title: sender.rows[0]?.display_name || "Nouveau message", body: body.slice(0, 120), notificationType: "message", conversationId: req.params.id, tag: `conversation-${req.params.id}`, url: `/?notification=message&conversation=${encodeURIComponent(req.params.id)}` });
  res.status(201).json({ message: result.rows[0] });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 6 } });
app.post("/api/conversations/:id/media", requireAuth, upload.array("media", 6), async (req, res) => {
  if (!await isConversationMember(req.auth.sub, req.params.id)) return res.status(403).json({ error: "Conversation non autorisée." });
  const files = (req.files ?? []).filter((file) => file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/"));
  if (!files.length) return res.status(400).json({ error: "Photo ou vidéo requise." });
  const inserted = [];
  for (const file of files) {
    const result = await pool.query("insert into messages(conversation_id,sender_id,media_name,media_type,media_data) values($1,$2,$3,$4,$5) returning id,media_name,media_type,created_at", [req.params.id, req.auth.sub, file.originalname, file.mimetype, file.buffer]);
    inserted.push(result.rows[0]);
  }
  const sender = await pool.query("select display_name from accounts where id=$1", [req.auth.sub]);
  await notifyConversation(req.params.id, req.auth.sub, { title: sender.rows[0]?.display_name || "Nouveau média", body: files.some((file) => file.mimetype.startsWith("video/")) ? "Vous a envoyé une vidéo." : "Vous a envoyé une photo.", notificationType: "message", conversationId: req.params.id, tag: `conversation-${req.params.id}`, url: `/?notification=message&conversation=${encodeURIComponent(req.params.id)}` });
  res.status(201).json({ messages: inserted });
});

app.get("/api/media/:messageId", requireAuth, async (req, res) => {
  const result = await pool.query(`select m.media_data,m.media_type,m.media_name from messages m join conversation_members cm on cm.conversation_id=m.conversation_id where m.id=$1 and cm.account_id=$2`, [req.params.messageId, req.auth.sub]);
  const media = result.rows[0];
  if (!media?.media_data) return res.status(404).json({ error: "Média introuvable." });
  res.set({ "Content-Type": media.media_type, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(media.media_name)}`, "Cache-Control": "private, max-age=3600" });
  res.send(media.media_data);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const statusCode = error instanceof multer.MulterError
    ? 400
    : Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;
  res.status(statusCode).json({ error: error.message || "Erreur interne." });
});

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
app.get("/downloads/Secret-Clubhouse.apk", (_req, res) => {
  res.download(path.join(root, "Secret-Clubhouse-debug.apk"), "Secret-Clubhouse.apk");
});
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));

await initializeDatabase();
await initializeWebPush();
app.listen(port, "0.0.0.0", () => console.log(`Secret Clubhouse écoute sur ${port}`));
