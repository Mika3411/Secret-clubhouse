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
let pushEnabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushEnabled) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contact@secret-clubhouse.fr",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  } catch (error) {
    pushEnabled = false;
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
  if (typeof name !== "string" || name.trim().length < 2 || typeof email !== "string" || !email.includes("@") || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Nom, e-mail et mot de passe de 8 caractères minimum requis." });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "insert into accounts(role,email,contact_id,password_hash,display_name) values('parent',$1,$2,$3,$4) returning *",
      [email.trim().toLowerCase(), makeContactId(), passwordHash, name.trim()],
    );
    const account = result.rows[0];
    res.status(201).json({ token: signSession(account), account: await serializeAccount(account) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Cette adresse e-mail est déjà utilisée." });
    throw error;
  }
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

app.get("/api/children", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Accès réservé au compte parent." });
  const result = await pool.query(
    "select * from accounts where role='child' and parent_id=$1 and contact_id<>$2 order by created_at, display_name",
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
    try {
      const result = await pool.query(
        `insert into accounts(role,contact_id,password_hash,display_name,parent_id,age,username,avatar_color,status,safety_settings,communication_schedule)
         values('child',$1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb) returning *`,
        [
          makeContactId(),
          passwordHash,
          profile.name,
          req.auth.sub,
          profile.age,
          profile.username,
          profile.color,
          profile.status,
          JSON.stringify(profile.settings),
          JSON.stringify(profile.schedule),
        ],
      );
      return res.status(201).json({ child: await serializeAccount(result.rows[0]) });
    } catch (error) {
      if (error.code === "23505" && error.constraint === "accounts_contact_id_key") continue;
      if (error.code === "23505") return res.status(409).json({ error: "Ce pseudo est déjà utilisé dans votre famille." });
      throw error;
    }
  }
  return res.status(503).json({ error: "Impossible de générer un identifiant enfant unique. Réessayez." });
});

app.patch("/api/children/:id", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut modifier un compte enfant." });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: "Identifiant enfant invalide." });
  }
  const existingResult = await pool.query(
    "select * from accounts where id=$1 and role='child' and parent_id=$2 and contact_id<>$3",
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
       safety_settings=$7::jsonb,communication_schedule=$8::jsonb where id=$9 and parent_id=$10 returning *`,
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
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
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

async function notifyConversation(conversationId, senderId, payload) {
  if (!pushEnabled) return;
  const result = await pool.query("select ps.id,ps.subscription from push_subscriptions ps join conversation_members cm on cm.account_id=ps.account_id where cm.conversation_id=$1 and cm.account_id<>$2", [conversationId, senderId]);
  await Promise.all(result.rows.map(async (row) => {
    try { await webpush.sendNotification(row.subscription, JSON.stringify(payload), { TTL: 3600, urgency: "high" }); }
    catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await pool.query("delete from push_subscriptions where id=$1", [row.id]);
      else console.error("Échec push", error.statusCode || error.message);
    }
  }));
}

app.post("/api/family-conversations", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut ouvrir une conversation familiale." });
  const contactId = String(req.body?.contactId ?? "").trim().toUpperCase();
  if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(contactId) || contactId === demoChildContactId) {
    return res.status(400).json({ error: "Identifiant enfant invalide." });
  }
  const childResult = await pool.query(
    "select id,display_name,contact_id from accounts where role='child' and parent_id=$1 and contact_id=$2",
    [req.auth.sub, contactId],
  );
  const child = childResult.rows[0];
  if (!child) return res.status(404).json({ error: "Cet enfant n’appartient pas à votre famille." });

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [child.id]);
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
    }
    await client.query("commit");
    res.status(existing.rowCount ? 200 : 201).json({
      conversation: { id: conversationId, kind: "child", name: child.display_name, contactId: child.contact_id, contactRole: "child", messages: [] },
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/conversations", requireAuth, async (req, res) => {
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
  const targetResult = contactId === demoChildContactId
    ? { rows: [] }
    : await pool.query("select id, parent_id, display_name from accounts where contact_id=$1", [contactId]);
  const target = targetResult.rows[0];
  if (!target) return res.status(404).json({ error: "Aucun compte ne correspond à cet identifiant." });
  const recipientParentId = target.parent_id ?? target.id;
  if (recipientParentId === req.auth.sub) return res.status(400).json({ error: "Cet identifiant appartient déjà à votre famille." });
  try {
    const result = await pool.query(`insert into contact_requests(requester_id,target_account_id,recipient_parent_id)
      values($1,$2,$3) returning id,status,created_at`, [req.auth.sub, target.id, recipientParentId]);
    res.status(201).json({ request: result.rows[0], contact: { name: target.display_name, contactId } });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Une demande existe déjà pour ce contact." });
    throw error;
  }
});

async function isConversationMember(accountId, conversationId) {
  const result = await pool.query("select 1 from conversation_members where account_id=$1 and conversation_id=$2", [accountId, conversationId]);
  return result.rowCount === 1;
}

app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  if (!await isConversationMember(req.auth.sub, req.params.id)) return res.status(403).json({ error: "Conversation non autorisée." });
  const body = String(req.body?.text ?? "").trim();
  if (!body || body.length > 4000) return res.status(400).json({ error: "Message vide ou trop long." });
  const result = await pool.query("insert into messages(conversation_id,sender_id,body) values($1,$2,$3) returning id,body,created_at", [req.params.id, req.auth.sub, body]);
  const sender = await pool.query("select display_name from accounts where id=$1", [req.auth.sub]);
  await notifyConversation(req.params.id, req.auth.sub, { title: sender.rows[0]?.display_name || "Nouveau message", body: body.slice(0, 120), conversationId: req.params.id, tag: `conversation-${req.params.id}` });
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
  await notifyConversation(req.params.id, req.auth.sub, { title: sender.rows[0]?.display_name || "Nouveau média", body: files.some((file) => file.mimetype.startsWith("video/")) ? "Vous a envoyé une vidéo." : "Vous a envoyé une photo.", conversationId: req.params.id, tag: `conversation-${req.params.id}` });
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
  res.status(error instanceof multer.MulterError ? 400 : 500).json({ error: error.message || "Erreur interne." });
});

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));

await initializeDatabase();
app.listen(port, "0.0.0.0", () => console.log(`Secret Clubhouse écoute sur ${port}`));
