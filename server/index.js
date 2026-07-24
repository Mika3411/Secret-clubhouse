import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import webpush from "web-push";
import { applyApiNoStoreCache, mountProductionAssets } from "./production-cache.js";
import { initializeDatabase, pool } from "./repositories/database.js";
import {
  clearSuccessfulLogin,
  consumeRegistrationIpAttempt,
  createLoginScopeKeys,
  createRegistrationIpScopeKey,
  getActiveLoginBlock,
  loginRetryAfterSeconds,
  pruneLoginRateLimits,
  recordLoginFailure,
} from "./login-protection.js";
import { evaluateChildPolicy } from "./policies/parental-policy.js";
import { writeSecurityEvent } from "./security-log.js";
import {
  assertActiveNotificationConsent,
  getNotificationConsent,
  recordRegistrationLegalEvents,
  setGuardianNotificationConsent,
  setSubjectNotificationConsent,
  validateRegistrationLegalEvidence,
} from "./legal-compliance.js";
import {
  createPrivacyRequest,
  createReadablePrivacyExport,
  listPrivacyRequests,
  privacyRequestTypes,
  resolvePrivacySubject,
  serializePrivacyRequest,
} from "./services/privacy-service.js";
import { getAdminAnalytics } from "./services/admin-analytics-service.js";
import {
  createNativePushService,
  createOpaqueCallActionToken,
  hashCallActionToken,
  normalizeNativeTokenRegistration,
} from "./notifications/native-push.js";
import { PublicHttpError, safeHttpErrorResponse } from "./http-errors.js";
import { privacySafeNotificationPayload } from "./notifications/notification-privacy.js";
import { retentionPolicy } from "./retention/policy.js";
import { buildClubhouseState } from "./clubhouse-progress.js";
import {
  authenticateSessionRequest,
  createAuthSession,
  logoutAuthSession,
  setSessionCookie,
} from "./auth-sessions.js";
import { getContentCipher } from "./encryption/content-encryption.js";
import {
  decryptMessageContent,
  encryptMessageContent,
} from "./encryption/message-content.js";
import { migrateLegacyMessageContent } from "./message-encryption-migration.js";
import { decryptCallSignal, encryptCallSignal } from "./encryption/call-signal-content.js";
import { migrateLegacyCallSignals } from "./call-signal-encryption-migration.js";
import {
  assertProductionFeatureConfiguration,
  resolveFeatureFlag,
  resolveProductionFeatures,
} from "./production-features.js";
import {
  conversationSyncPageSize,
  decodeMessagePageCursor,
  encodeMessagePageCursor,
  normalizeConversationMessageIds,
  normalizeConversationSyncCursor,
  normalizeMessagePageLimit,
} from "./conversation-sync.js";
import {
  isValidChildUsername,
  normalizeChildUsername,
} from "../src/child-username.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import {
  MediaValidationError,
  validateUploadedMediaFiles,
} from "./media-validation.js";
import { isAllowedDuringPrivacyRestriction } from "./privacy-restriction.js";
import {
  authorizePlatformAdministrator,
  configuredPlatformAdminEmails,
} from "./policies/platform-admin.js";
import { defaultParentalTimeZone } from "../src/policy-time.js";

const app = express();
const port = Number(process.env.PORT || 10000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET est requis");
const parentalTimeZone = process.env.PARENTAL_TIME_ZONE || defaultParentalTimeZone;
const callTimeoutSeconds = Math.max(20, Math.min(120, Number(process.env.RTC_CALL_TIMEOUT_SECONDS) || 45));
const webPushTimeoutMs = Math.max(2_000, Math.min(15_000, Number(process.env.WEB_PUSH_TIMEOUT_MS) || 6_000));
const neutralCallReply = String(process.env.RTC_NEUTRAL_DECLINE_MESSAGE || "Je ne peux pas répondre pour le moment.").trim().slice(0, 240);
const privacyContactEmail = String(process.env.PRIVACY_CONTACT_EMAIL || "contact@secret-clubhouse.fr").trim().toLowerCase();
const privacyAdminToken = String(process.env.PRIVACY_ADMIN_TOKEN || "");
const productionFeatures = resolveProductionFeatures(process.env);
assertProductionFeatureConfiguration(productionFeatures, process.env);
const adminAnalyticsEnabled = resolveFeatureFlag(process.env, "ADMIN_ANALYTICS_ENABLED");
const platformAdminEmails = configuredPlatformAdminEmails(process.env);
const invalidLoginPasswordHash = "$2b$12$YoNVhfH0Ezc9Sc/m1jloOu2rXeLxQwenmlqLzPmOOqpV4ztVtWWju";
let pushEnabled = false;
let vapidPublicKey = "";
let nativePushService = null;

function parseRtcIceServers() {
  if (process.env.RTC_ICE_SERVERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.RTC_ICE_SERVERS_JSON);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (error) {
      console.warn(`Configuration RTC_ICE_SERVERS_JSON ignorée : ${error.message}.`);
    }
  }

  const defaultStunUrls = process.env.NODE_ENV === "production" ? "" : "stun:stun.cloudflare.com:3478";
  const stunUrls = String(process.env.RTC_STUN_URLS || defaultStunUrls)
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.startsWith("stun:") || url.startsWith("stuns:"));
  const turnUrls = String(process.env.RTC_TURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.startsWith("turn:") || url.startsWith("turns:"));
  const iceServers = stunUrls.length ? [{ urls: stunUrls }] : [];
  if (turnUrls.length && process.env.RTC_TURN_USERNAME && process.env.RTC_TURN_CREDENTIAL) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.RTC_TURN_USERNAME,
      credential: process.env.RTC_TURN_CREDENTIAL,
    });
  }
  return iceServers;
}

const fallbackRtcIceServers = parseRtcIceServers();
let managedTurnCache = null;

async function getRtcIceServers() {
  if (!productionFeatures.rtc) return [];
  const keyId = process.env.RTC_TURN_KEY_ID;
  const apiToken = process.env.RTC_TURN_API_TOKEN;
  if (!keyId || !apiToken) return fallbackRtcIceServers;
  if (managedTurnCache?.expiresAt > Date.now()) return managedTurnCache.iceServers;

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 3600 }),
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.iceServers) || !payload.iceServers.length) throw new Error("réponse ICE vide");
    managedTurnCache = {
      iceServers: payload.iceServers,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    return managedTurnCache.iceServers;
  } catch (error) {
    console.warn(`Identifiants TURN temporaires indisponibles, repli STUN/TURN statique : ${error.message}.`);
    managedTurnCache = {
      iceServers: fallbackRtcIceServers,
      expiresAt: Date.now() + 60 * 1000,
    };
    return managedTurnCache.iceServers;
  }
}

async function initializeWebPush() {
  if (!productionFeatures.webPush) {
    pushEnabled = false;
    vapidPublicKey = "";
    console.log("Web Push désactivé par WEB_PUSH_ENABLED.");
    return;
  }
  let keys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
    : null;

  if (!keys) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("WEB_PUSH_ENABLED=true exige VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY en production.");
    }
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
app.set("trust proxy", 1);
app.use((req, res, next) => {
  const suppliedRequestId = String(req.get("X-Request-ID") || "");
  req.requestId = /^[A-Za-z0-9_-]{8,80}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
  res.set({
    "X-Request-ID": req.requestId,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
  });
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use("/api", applyApiNoStoreCache);

const legacyReservedContactId = "SC-482-917-305";
const makeContactId = () => {
  let contactId;
  do {
    contactId = `SC-${Array.from({ length: 3 }, () => crypto.randomInt(100, 1000)).join("-")}`;
  } while (contactId === legacyReservedContactId);
  return contactId;
};
const nativeSessionClientHeader = "x-secret-clubhouse-client";
const isNativeSessionClient = (req) => String(req.get(nativeSessionClientHeader) || "").toLowerCase() === "native";

async function createSessionForRequest(executor, req, accountId) {
  return createAuthSession(executor, {
    accountId,
    clientType: isNativeSessionClient(req) ? "native" : "web",
  });
}

function attachSessionToResponse(req, res, createdSession) {
  if (isNativeSessionClient(req)) return createdSession.token;
  setSessionCookie(res, createdSession.token, {
    production: process.env.NODE_ENV === "production",
    ttlSeconds: createdSession.ttlSeconds,
  });
  return null;
}

function authenticatedPayload(req, res, createdSession, payload) {
  const nativeToken = attachSessionToResponse(req, res, createdSession);
  return {
    ...payload,
    ...(nativeToken ? { token: nativeToken } : {}),
  };
}
function sendLoginRateLimit(res, blockedUntil) {
  const retryAfter = loginRetryAfterSeconds(blockedUntil);
  res.set({
    "Cache-Control": "no-store",
    "Retry-After": String(retryAfter),
  });
  return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
}

async function enforceRegistrationIpLimit(req, res, flow) {
  const registrationScope = createRegistrationIpScopeKey({
    clientAddress: req.ip || req.socket?.remoteAddress,
    secret: jwtSecret,
  });
  const blockedUntil = await consumeRegistrationIpAttempt(pool, registrationScope);
  if (!blockedUntil) return false;
  await writeSecurityEvent(pool, {
    eventType: "auth.registration",
    outcome: "blocked",
    ipHash: registrationScope.ipHash,
    metadata: { flow },
  });
  sendLoginRateLimit(res, blockedUntil);
  return true;
}

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
  autoReply: { enabled: true, message: "Je ne peux pas répondre pour le moment." },
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invitationTokenPattern = /^[A-Za-z0-9_-]{40,128}$/;
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const hashInvitationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const makeInvitationToken = () => crypto.randomBytes(32).toString("base64url");

function httpError(statusCode, message) {
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
    return new PublicHttpError(statusCode, message);
  }
  const internalError = new Error(message);
  internalError.statusCode = statusCode;
  return internalError;
}

async function insertEncryptedAutomaticMessage(executor, conversationId, senderId, body) {
  const id = crypto.randomUUID();
  const encrypted = encryptMessageContent({
    id,
    conversationId,
    senderId,
    body,
  });
  await executor.query(
    `insert into messages(
       id,conversation_id,sender_id,body_ciphertext,
       content_encryption_version,content_encryption_key_id,message_kind
     ) values($1,$2,$3,$4,$5,$6,'automatic')`,
    [
      id,
      conversationId,
      senderId,
      encrypted.bodyCiphertext,
      encrypted.encryptionVersion,
      encrypted.encryptionKeyId,
    ],
  );
  return id;
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

async function repairFamilyChildrenForAccount(accountId, executor = null) {
  const client = executor ?? await pool.connect();
  const ownsTransaction = !executor;
  try {
    if (ownsTransaction) await client.query("begin");

    // accounts.parent_id is the legacy ownership source of truth. Lock every
    // candidate owner's current membership so a concurrent co-parent removal
    // cannot change the family boundary while an orphaned link is repaired.
    const ownersResult = await client.query(
      `select owner.family_id,owner.parent_id
       from family_memberships owner
       where owner.parent_id=(
         select child.parent_id from accounts child where child.id=$1 and child.role='child'
       )
       or exists(
         select 1 from family_memberships current
         where current.parent_id=$1 and current.family_id=owner.family_id
       )
       order by owner.parent_id
       for key share of owner`,
      [accountId],
    );
    if (!ownersResult.rowCount) {
      if (ownsTransaction) await client.query("commit");
      return;
    }

    const ownerIds = ownersResult.rows.map((owner) => owner.parent_id);
    const familyIds = ownersResult.rows.map((owner) => owner.family_id);
    const childrenResult = await client.query(
      `select child.id,child.created_at,owner.family_id
       from accounts child
       join unnest($1::uuid[],$2::uuid[]) owner(parent_id,family_id)
         on owner.parent_id=child.parent_id
       left join family_children existing on existing.child_id=child.id
       where child.role='child' and existing.child_id is null
       for key share of child`,
      [ownerIds, familyIds],
    );
    if (childrenResult.rowCount) {
      const childIds = childrenResult.rows.map((child) => child.id);
      const expectedFamilyIds = childrenResult.rows.map((child) => child.family_id);
      const addedDates = childrenResult.rows.map((child) => child.created_at);
      await client.query(
        `insert into family_children(family_id,child_id,added_at)
         select family_id,child_id,added_at
         from unnest($1::uuid[],$2::uuid[],$3::timestamptz[]) repaired(child_id,family_id,added_at)
         on conflict(child_id) do nothing`,
        [childIds, expectedFamilyIds, addedDates],
      );
      const confirmedResult = await client.query(
        "select child_id,family_id from family_children where child_id=any($1::uuid[])",
        [childIds],
      );
      const confirmedFamilies = new Map(confirmedResult.rows.map((row) => [row.child_id, row.family_id]));
      if (childrenResult.rows.some((child) => confirmedFamilies.get(child.id) !== child.family_id)) {
        throw httpError(409, "Le rattachement familial d’un compte enfant est incohérent.");
      }
    }

    if (ownsTransaction) await client.query("commit");
  } catch (error) {
    if (ownsTransaction) await client.query("rollback");
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
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

function validateAvailableRegistrationInvitation(invitation, requestedEmail = "") {
  if (!invitation) throw httpError(404, "Invitation de co-parent introuvable.");
  if (invitation.status !== "pending") throw httpError(410, "Cette invitation a déjà été utilisée ou révoquée.");
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    throw httpError(410, "Cette invitation de co-parent a expiré.");
  }
  const invitationEmail = normalizeEmail(invitation.email);
  if (requestedEmail && requestedEmail !== invitationEmail) {
    throw httpError(403, "Cette invitation est liée à une autre adresse e-mail.");
  }
  return invitationEmail;
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

    const legacyChildrenResult = await client.query(
      `select child.id
       from accounts child
       where child.role='child' and child.parent_id=$1
         and not exists(select 1 from family_children linked where linked.child_id=child.id)
       for key share of child`,
      [parentId],
    );
    await repairFamilyChildrenForAccount(parentId, client);
    const membershipResult = await client.query(
      `select fm.family_id,fm.role,
        (select count(*)::int from family_memberships members where members.family_id=fm.family_id) as member_count,
        (select count(*)::int from family_children children where children.family_id=fm.family_id) as child_count,
        (select count(*)::int from accounts legacy_child
          where legacy_child.role='child' and legacy_child.parent_id=fm.parent_id
            and not exists(select 1 from family_children linked where linked.child_id=legacy_child.id)) as legacy_child_count,
        (select count(*)::int from family_parent_invitations pending
          where pending.family_id=fm.family_id and pending.status='pending' and pending.expires_at>now()) as pending_count
       from family_memberships fm where fm.parent_id=$1 for update`,
      [parentId],
    );
    const currentMembership = membershipResult.rows[0];
    if (!currentMembership && legacyChildrenResult.rowCount) {
      throw httpError(409, "Ce compte parent possède déjà des profils enfants et ne peut pas rejoindre une autre famille.");
    }
    if (currentMembership && currentMembership.family_id !== invitation.family_id) {
      const disposableEmptyFamily = currentMembership.role === "primary"
        && Number(currentMembership.member_count) === 1
        && Number(currentMembership.child_count) === 0
        && Number(currentMembership.legacy_child_count) === 0
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
    await provisionHouseholdParentConversations(client, parentId);
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

function serializeCommunicationSchedule(schedule) {
  return {
    ...normalizeSchedule({}, schedule),
    timeZone: parentalTimeZone,
  };
}

function normalizeChildProfile(body, current = null) {
  const name = body.name === undefined ? current?.display_name ?? "" : String(body.name).trim().slice(0, 24);
  const age = body.age === undefined ? Number(current?.age) : Number(body.age);
  const username = body.username === undefined ? current?.username ?? "" : normalizeChildUsername(body.username);
  const color = body.color === undefined ? current?.avatar_color ?? "mint" : String(body.color);
  const status = body.status === undefined ? current?.status ?? "active" : String(body.status);
  const password = body.password === undefined || body.password === null ? "" : String(body.password);
  if (name.length < 2 || !Number.isInteger(age) || age < 6 || age > 13 || !isValidChildUsername(username)) {
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

const parentalPolicyColumns = "account.id,account.display_name,account.status,account.safety_settings,account.communication_schedule";

function normalizePolicyChild(child) {
  return {
    ...child,
    safety_settings: { ...defaultSafetySettings, ...(child.safety_settings ?? {}) },
    communication_schedule: normalizeSchedule({}, child.communication_schedule),
  };
}

function assertChildPolicies(children, options = {}) {
  for (const rawChild of children) {
    const decision = evaluateChildPolicy(normalizePolicyChild(rawChild), {
      ...options,
      timeZone: parentalTimeZone,
    });
    if (!decision.allowed) throw httpError(403, decision.reason);
  }
}

async function getChildPoliciesForAccounts(accountIds, executor = pool, lock = false) {
  const uniqueIds = [...new Set(accountIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  const result = await executor.query(
    `select ${parentalPolicyColumns}
     from accounts account
     where account.role='child' and account.id=any($1::uuid[])
     order by account.id
     ${lock ? "for no key update of account" : ""}`,
    [uniqueIds],
  );
  return result.rows;
}

async function getConversationChildPolicies(conversationId, executor = pool, lock = false) {
  const result = await executor.query(
    `select ${parentalPolicyColumns}
     from conversation_members member
     join accounts account on account.id=member.account_id and account.role='child'
     where member.conversation_id=$1
     order by account.id
     ${lock ? "for no key update of account" : ""}`,
    [conversationId],
  );
  return result.rows;
}

async function assertAccountsActive(accountIds, executor = pool, lock = false) {
  const children = await getChildPoliciesForAccounts(accountIds, executor, lock);
  assertChildPolicies(children);
}

async function assertConversationPolicy(conversationId, options = {}, executor = pool, lock = false) {
  const children = await getConversationChildPolicies(conversationId, executor, lock);
  assertChildPolicies(children, options);
  return children;
}

async function requireActiveChild(req, res, next) {
  if (req.auth.role !== "child") return next();
  try {
    await assertAccountsActive([req.auth.sub]);
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireAuth(req, res, next) {
  try {
    const session = await authenticateSessionRequest(pool, req, {
      production: process.env.NODE_ENV === "production",
      expectedClientType: isNativeSessionClient(req) ? "native" : "web",
    });
    if (!session) return res.status(401).json({ error: "Session invalide ou expirée." });
    if (session.transport === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const fetchSite = String(req.get("Sec-Fetch-Site") || "").toLowerCase();
      const origin = String(req.get("Origin") || "");
      const expectedOrigin = `${req.protocol}://${req.get("host")}`;
      if (fetchSite === "cross-site" || (origin && origin !== expectedOrigin)) {
        return res.status(403).json({ error: "Requête intersite refusée." });
      }
    }
    req.auth = {
      sub: session.accountId,
      role: session.role,
      sessionId: session.id,
      sessionTransport: session.transport,
    };
    const accountResult = await pool.query(
      "select processing_restricted_at,processing_restriction_reason from accounts where id=$1",
      [req.auth.sub],
    );
    const account = accountResult.rows[0];
    if (!account) return res.status(401).json({ error: "Ce compte n’existe plus." });
    req.privacyRestriction = account.processing_restricted_at ? {
      appliedAt: account.processing_restricted_at,
      reason: account.processing_restriction_reason,
    } : null;
    const isAllowedDuringRestriction = isAllowedDuringPrivacyRestriction(req.method, req.path);
    if (req.privacyRestriction && !isAllowedDuringRestriction) {
      return res.status(423).json({
        error: "Le traitement de ce compte est limité. Seuls vos droits, l’export et la suppression restent disponibles.",
        processingRestricted: true,
        restriction: req.privacyRestriction,
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requirePlatformAdministrator(req, res, next) {
  try {
    if (!adminAnalyticsEnabled) {
      return res.status(404).json({ error: "Cette fonctionnalité n’est pas disponible." });
    }
    const administrator = await authorizePlatformAdministrator(pool, req.auth.sub, {
      configuredEmails: platformAdminEmails,
    });
    if (!administrator) {
      await writeSecurityEvent(pool, {
        accountId: req.auth.sub,
        eventType: "admin.analytics.access",
        outcome: "blocked",
        metadata: { requestId: req.requestId ?? null },
      });
      return res.status(403).json({ error: "Cet espace est réservé à l’administrateur autorisé." });
    }
    req.platformAdministrator = administrator;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function serializeAccount(account) {
  const serialized = {
    id: account.id,
    role: account.role,
    name: account.display_name,
    email: account.email,
    contactId: account.contact_id,
    processingRestrictedAt: account.processing_restricted_at ?? null,
    processingRestrictionReason: account.processing_restriction_reason ?? null,
    features: {
      rtc: productionFeatures.rtc,
      webPush: productionFeatures.webPush,
      nativePush: productionFeatures.nativePush,
    },
  };
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
    schedule: serializeCommunicationSchedule(account.communication_schedule),
  };
}

function privacyAdminAuthorized(req) {
  if (!productionFeatures.privacyAdministration) return false;
  if (!privacyAdminToken) return false;
  const provided = String(req.get("X-Privacy-Admin-Token") || "");
  if (!provided || provided.length !== privacyAdminToken.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(privacyAdminToken));
}

async function verifyParentPassword(executor, parentId, password) {
  const result = await executor.query(
    "select password_hash from accounts where id=$1 and role='parent' for update",
    [parentId],
  );
  return Boolean(result.rows[0] && await bcrypt.compare(String(password || ""), result.rows[0].password_hash));
}

async function recordCompletedErasure(executor, {
  requesterId,
  subjectId,
  familyId,
  accountIds,
  details,
}) {
  const accounts = await executor.query(
    `select id,role,display_name,email,contact_id
     from accounts
     where id=any($1::uuid[])`,
    [accountIds],
  );
  const requester = accounts.rows.find((account) => account.id === requesterId);
  const subject = accounts.rows.find((account) => account.id === subjectId) ?? requester ?? accounts.rows[0];
  if (!subject) throw httpError(404, "Compte à supprimer introuvable.");

  const backupExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const response = "Les données actives ont été supprimées. Les sauvegardes arrivent à expiration sous sept jours et toute restauration doit réappliquer cette suppression avant remise en service.";
  const requestResult = await executor.query(
    `insert into privacy_requests(
       requester_account_id,subject_account_id,family_id,
       requester_email,requester_contact_id,subject_display_name,subject_role,
       request_type,status,details,response_text,response_actor,
       responded_at,completed_at,backup_expires_at
     ) values($1,$2,$3,$4,$5,$6,$7,'erasure','completed',$8,$9,'automatique',now(),now(),$10)
     returning id`,
    [
      requesterId,
      subjectId,
      familyId,
      requester?.email ?? null,
      requester?.contact_id ?? null,
      subject.display_name,
      subject.role,
      details,
      response,
      backupExpiresAt,
    ],
  );
  await executor.query(
    `insert into privacy_request_events(request_id,actor_type,event_type,note)
     values
       ($1,'requester','submitted',$2),
       ($1,'system','acknowledged','Demande traitée immédiatement.'),
       ($1,'system','completed',$3)`,
    [requestResult.rows[0].id, details, response],
  );
  await executor.query(
    `insert into erasure_tombstones(privacy_request_id,family_id,account_ids,backup_expires_at)
     values($1,$2,$3::uuid[],$4)`,
    [requestResult.rows[0].id, familyId, accountIds, backupExpiresAt],
  );
  await executor.query(
    "delete from legal_events where subject_account_id=any($1::uuid[]) or actor_account_id=any($1::uuid[])",
    [accountIds],
  );
  return requestResult.rows[0].id;
}

registerSystemRoutes(app, { pool, privacyContactEmail });

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);
  const displayName = typeof name === "string" ? name.trim().slice(0, 80) : "";
  if (displayName.length < 2 || !isValidEmail(normalizedEmail) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Nom, e-mail et mot de passe de 8 caractères minimum requis." });
  }
  const legalEvidence = validateRegistrationLegalEvidence(req.body?.legal);
  if (!legalEvidence.valid) return res.status(400).json({ error: legalEvidence.error });
  if (await enforceRegistrationIpLimit(req, res, "primary_parent")) return;

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
      await recordRegistrationLegalEvents(client, account.id, legalEvidence.value);
      const createdSession = await createSessionForRequest(client, req, account.id);
      await client.query("commit");
      const family = await serializeFamilyForParent(account.id);
      return res.status(201).json(authenticatedPayload(req, res, createdSession, {
        account: await serializeAccount(account),
        family,
      }));
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
  const legalEvidence = validateRegistrationLegalEvidence(req.body?.legal);
  if (!legalEvidence.valid) return res.status(400).json({ error: legalEvidence.error });
  if (await enforceRegistrationIpLimit(req, res, "invited_coparent")) return;

  const invitationPreview = await getInvitationByToken(token);
  validateAvailableRegistrationInvitation(invitationPreview, requestedEmail);
  const passwordHash = await bcrypt.hash(password, 12);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const invitation = await getInvitationByToken(token, client, true);
      const invitationEmail = validateAvailableRegistrationInvitation(invitation, requestedEmail);

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
      await recordRegistrationLegalEvents(client, account.id, legalEvidence.value);
      await provisionHouseholdParentConversations(client, account.id);
      const createdSession = await createSessionForRequest(client, req, account.id);
      await client.query("commit");
      const family = await serializeFamilyForParent(account.id);
      return res.status(201).json(authenticatedPayload(req, res, createdSession, {
        account: await serializeAccount(account),
        family,
      }));
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
  const { email, username, password } = req.body ?? {};
  res.set("Cache-Control", "no-store");
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeChildUsername(username);
  const loginScopeKeys = createLoginScopeKeys({
    email: normalizedEmail,
    username: normalizedUsername,
    clientAddress: req.ip || req.socket?.remoteAddress,
    secret: jwtSecret,
  });
  const existingBlock = await getActiveLoginBlock(pool, loginScopeKeys);
  if (existingBlock) {
    await writeSecurityEvent(pool, {
      eventType: "auth.login",
      outcome: "blocked",
      ...loginScopeKeys,
    });
    return sendLoginRateLimit(res, existingBlock);
  }

  const result = normalizedEmail
    ? await pool.query("select * from accounts where role='parent' and email=$1", [normalizedEmail])
    : isValidChildUsername(normalizedUsername)
      ? await pool.query("select * from accounts where role='child' and lower(username)=$1", [normalizedUsername])
      : { rows: [] };
  const account = result.rows[0];
  const submittedPassword = typeof password === "string" && password.length <= 128 ? password : "";
  const passwordMatches = await bcrypt.compare(submittedPassword, account?.password_hash ?? invalidLoginPasswordHash);
  if (!account || !passwordMatches) {
    const newBlock = await recordLoginFailure(pool, loginScopeKeys);
    await writeSecurityEvent(pool, {
      accountId: account?.id ?? null,
      eventType: "auth.login",
      outcome: newBlock ? "blocked" : "failure",
      ...loginScopeKeys,
    });
    if (newBlock) return sendLoginRateLimit(res, newBlock);
    return res.status(401).json({ error: "Identifiants incorrects." });
  }
  await clearSuccessfulLogin(pool, loginScopeKeys);
  await pool.query("update accounts set last_activity_at=now() where id=$1", [account.id]);
  await writeSecurityEvent(pool, {
    accountId: account.id,
    eventType: "auth.login",
    outcome: "success",
    ...loginScopeKeys,
  });
  const createdSession = await createSessionForRequest(pool, req, account.id);
  return res.json(authenticatedPayload(req, res, createdSession, {
    account: await serializeAccount(account),
  }));
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await logoutAuthSession(pool, req, res, {
    production: process.env.NODE_ENV === "production",
    expectedClientType: isNativeSessionClient(req) ? "native" : "web",
    reason: "logout",
  });
  res.set("Cache-Control", "no-store");
  res.status(204).end();
});

app.get("/api/me", requireAuth, async (req, res) => {
  const result = await pool.query("select * from accounts where id=$1", [req.auth.sub]);
  if (!result.rows[0]) return res.status(404).json({ error: "Compte introuvable." });
  res.json({ account: await serializeAccount(result.rows[0]) });
});

app.get("/api/admin/analytics", requireAuth, requirePlatformAdministrator, async (req, res) => {
  const analytics = await getAdminAnalytics(pool);
  await writeSecurityEvent(pool, {
    accountId: req.auth.sub,
    eventType: "admin.analytics.read",
    outcome: "success",
    metadata: {
      requestId: req.requestId ?? null,
      aggregateOnly: true,
    },
  });
  res.set("Cache-Control", "private, no-store, max-age=0");
  res.json({ analytics });
});

app.get("/api/privacy/requests", requireAuth, async (req, res) => {
  res.set({ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" });
  res.json({
    requests: await listPrivacyRequests(pool, req.auth.sub),
    contactEmail: privacyContactEmail,
  });
});

app.post("/api/privacy/requests", requireAuth, async (req, res) => {
  const requestType = String(req.body?.type ?? "");
  const subjectId = req.body?.subjectId ? String(req.body.subjectId) : req.auth.sub;
  const details = String(req.body?.details ?? "").trim();
  if (!privacyRequestTypes.has(requestType)) {
    return res.status(400).json({ error: "Type de demande invalide." });
  }
  if (!uuidPattern.test(subjectId)) return res.status(400).json({ error: "Personne concernée invalide." });
  if (details.length < 10 || details.length > 2000) {
    return res.status(400).json({ error: "Décrivez votre demande en 10 à 2 000 caractères." });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const request = await createPrivacyRequest(client, {
      requesterId: req.auth.sub,
      subjectId,
      requestType,
      details,
    });
    if (!request) throw httpError(403, "Vous ne pouvez pas exercer de droits pour ce compte.");
    await client.query("commit");
    res.status(201).json({
      request: serializePrivacyRequest(request),
      acknowledgement: "Votre demande est enregistrée. Une réponse vous sera apportée sous un mois.",
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/privacy/export", requireAuth, async (req, res) => {
  const subjectId = req.query.subjectId ? String(req.query.subjectId) : req.auth.sub;
  if (!uuidPattern.test(subjectId)) return res.status(400).json({ error: "Personne concernée invalide." });
  const exportData = await createReadablePrivacyExport(pool, {
    requesterId: req.auth.sub,
    subjectId,
    controllerEmail: privacyContactEmail,
  });
  if (!exportData) return res.status(403).json({ error: "Vous ne pouvez pas exporter les données de ce compte." });
  res.set({
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Content-Disposition": `attachment; filename="secret-clubhouse-donnees-${subjectId}.json"`,
  });
  return res.json(exportData);
});

app.get("/api/privacy/admin/requests", async (req, res) => {
  if (!privacyAdminAuthorized(req)) {
    const configured = productionFeatures.privacyAdministration && Boolean(privacyAdminToken);
    return res.status(configured ? 401 : 503).json({
      error: configured ? "Accès au registre refusé." : "Le canal de traitement RGPD n’est pas activé.",
    });
  }
  const result = await pool.query(
    `select request.*,
       coalesce(json_agg(
         json_build_object(
           'actorType',event.actor_type,
           'eventType',event.event_type,
           'note',event.note,
           'createdAt',event.created_at
         ) order by event.created_at
       ) filter (where event.id is not null),'[]'::json) as events
     from privacy_requests request
     left join privacy_request_events event on event.request_id=request.id
     group by request.id
     order by
       case when request.status in ('submitted','in_review') then request.due_at end asc nulls last,
       request.created_at desc`,
  );
  res.set({ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" });
  return res.json({
    requests: result.rows.map((row) => ({ ...serializePrivacyRequest(row), events: row.events })),
    overdueCount: result.rows.filter((row) => serializePrivacyRequest(row).overdue).length,
    contactEmail: privacyContactEmail,
  });
});

app.patch("/api/privacy/admin/requests/:id", async (req, res) => {
  if (!privacyAdminAuthorized(req)) {
    const configured = productionFeatures.privacyAdministration && Boolean(privacyAdminToken);
    return res.status(configured ? 401 : 503).json({
      error: configured ? "Accès au registre refusé." : "Le canal de traitement RGPD n’est pas activé.",
    });
  }
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: "Demande invalide." });
  const status = String(req.body?.status ?? "");
  const allowedStatuses = new Set(["in_review", "completed", "rejected", "cancelled"]);
  if (!allowedStatuses.has(status)) return res.status(400).json({ error: "Statut invalide." });
  const responseText = String(req.body?.response ?? "").trim();
  if (["completed", "rejected"].includes(status) && responseText.length < 10) {
    return res.status(400).json({ error: "Une réponse motivée est requise pour clôturer la demande." });
  }
  const applyRestriction = req.body?.applyRestriction === true;
  const liftRestriction = req.body?.liftRestriction === true;
  const executeErasure = req.body?.executeErasure === true;
  if (applyRestriction && liftRestriction) {
    return res.status(400).json({ error: "La limitation ne peut pas être appliquée et levée simultanément." });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const existingResult = await client.query(
      "select * from privacy_requests where id=$1 for update",
      [req.params.id],
    );
    const existing = existingResult.rows[0];
    if (!existing) throw httpError(404, "Demande introuvable.");
    if (["completed", "rejected", "cancelled"].includes(existing.status)) {
      throw httpError(409, "Cette demande est déjà clôturée.");
    }
    if (applyRestriction && !["restriction", "objection"].includes(existing.request_type)) {
      throw httpError(400, "La limitation ne peut être appliquée que pour une demande de limitation ou d’opposition.");
    }
    if ((applyRestriction || liftRestriction) && !existing.subject_account_id) {
      throw httpError(409, "Le compte concerné n’est plus actif.");
    }
    if (executeErasure && (existing.request_type !== "erasure" || existing.subject_role !== "child")) {
      throw httpError(400, "L’effacement administratif direct est réservé au profil enfant concerné par cette demande.");
    }
    if (executeErasure && status !== "completed") {
      throw httpError(400, "L’effacement administratif doit clôturer la demande.");
    }
    if (status === "completed" && existing.request_type === "erasure" && existing.subject_account_id && !executeErasure) {
      throw httpError(409, "Le compte est encore actif. Exécutez l’effacement du profil enfant ou utilisez la suppression protégée du compte parent avant de clôturer.");
    }

    if (executeErasure) {
      const subjectResult = await client.query(
        "select id from accounts where id=$1 and role='child' for update",
        [existing.subject_account_id],
      );
      if (!subjectResult.rows[0]) throw httpError(409, "Le profil enfant n’est plus actif.");
      const backupExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await client.query(
        `insert into erasure_tombstones(privacy_request_id,family_id,account_ids,backup_expires_at)
         values($1,$2,array[$3]::uuid[],$4)`,
        [existing.id, existing.family_id, existing.subject_account_id, backupExpiresAt],
      );
      await client.query(
        "delete from legal_events where subject_account_id=$1 or actor_account_id=$1",
        [existing.subject_account_id],
      );
      await client.query(
        "delete from conversations where id in (select conversation_id from conversation_members where account_id=$1)",
        [existing.subject_account_id],
      );
      await client.query("delete from accounts where id=$1", [existing.subject_account_id]);
      await client.query(
        "update privacy_requests set backup_expires_at=$2 where id=$1",
        [existing.id, backupExpiresAt],
      );
    }

    if (applyRestriction) {
      await client.query(
        `update accounts
         set processing_restricted_at=coalesce(processing_restricted_at,now()),
             processing_restriction_reason=$2
         where id=$1`,
        [existing.subject_account_id, responseText || existing.details],
      );
      await client.query(
        `update privacy_requests set restriction_applied_at=coalesce(restriction_applied_at,now()) where id=$1`,
        [existing.id],
      );
      await client.query(
        `insert into privacy_request_events(request_id,actor_type,event_type,note)
         values($1,'controller','restriction_applied',$2)`,
        [existing.id, responseText || "Limitation appliquée."],
      );
    }
    if (liftRestriction) {
      await client.query(
        `update accounts
         set processing_restricted_at=null,processing_restriction_reason=null
         where id=$1`,
        [existing.subject_account_id],
      );
      await client.query(
        `update privacy_requests set restriction_lifted_at=now() where id=$1`,
        [existing.id],
      );
      await client.query(
        `insert into privacy_request_events(request_id,actor_type,event_type,note)
         values($1,'controller','restriction_lifted',$2)`,
        [existing.id, responseText || "Limitation levée."],
      );
    }

    const updatedResult = await client.query(
      `update privacy_requests
       set status=$2,
           response_text=case when $3='' then response_text else $3 end,
           response_actor='responsable RGPD',
           responded_at=case when $2 in ('completed','rejected') then now() else responded_at end,
           completed_at=case when $2='completed' then now() else completed_at end
       where id=$1
       returning *`,
      [existing.id, status, responseText],
    );
    await client.query(
      `insert into privacy_request_events(request_id,actor_type,event_type,note)
       values($1,'controller',$2,$3)`,
      [existing.id, status, responseText || null],
    );
    await client.query("commit");
    return res.json({ request: serializePrivacyRequest(updatedResult.rows[0]) });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/account", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Cette action est réservée au compte parent." });
  if (String(req.body?.confirmation ?? "") !== "SUPPRIMER MON COMPTE") {
    return res.status(400).json({ error: "Recopiez exactement « SUPPRIMER MON COMPTE »." });
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (!await verifyParentPassword(client, req.auth.sub, req.body?.currentPassword)) {
      throw httpError(401, "Le mot de passe actuel est incorrect.");
    }
    const membershipResult = await client.query(
      `select membership.family_id,membership.role,
        (select count(*) from family_memberships other where other.family_id=membership.family_id) as parent_count,
        (select count(*) from family_children child where child.family_id=membership.family_id) as child_count
       from family_memberships membership
       where membership.parent_id=$1
       for update`,
      [req.auth.sub],
    );
    const membership = membershipResult.rows[0];
    if (!membership) throw httpError(404, "Famille introuvable.");
    if (membership.role === "primary" && (Number(membership.parent_count) > 1 || Number(membership.child_count) > 0)) {
      throw httpError(409, "Le parent principal doit supprimer toute la famille, ou retirer d’abord les autres profils.");
    }

    await recordCompletedErasure(client, {
      requesterId: req.auth.sub,
      subjectId: req.auth.sub,
      familyId: membership.family_id,
      accountIds: [req.auth.sub],
      details: "Suppression définitive du compte parent demandée depuis l’espace protégé.",
    });
    await client.query(
      "delete from conversations where id in (select conversation_id from conversation_members where account_id=$1)",
      [req.auth.sub],
    );
    await client.query("delete from accounts where id=$1", [req.auth.sub]);
    if (membership.role === "primary") {
      await client.query("delete from families where id=$1", [membership.family_id]);
    }
    await client.query("commit");
    return res.status(204).end();
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/family", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Cette action est réservée au compte parent." });
  if (String(req.body?.confirmation ?? "") !== "SUPPRIMER MA FAMILLE") {
    return res.status(400).json({ error: "Recopiez exactement « SUPPRIMER MA FAMILLE »." });
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (!await verifyParentPassword(client, req.auth.sub, req.body?.currentPassword)) {
      throw httpError(401, "Le mot de passe actuel est incorrect.");
    }
    const familyResult = await client.query(
      `select family.id
       from families family
       join family_memberships membership on membership.family_id=family.id
       where membership.parent_id=$1 and membership.role='primary'
       for update of family`,
      [req.auth.sub],
    );
    const family = familyResult.rows[0];
    if (!family) throw httpError(403, "Seul le parent principal peut supprimer définitivement la famille.");
    const accountsResult = await client.query(
      `select parent_id as id from family_memberships where family_id=$1
       union
       select child_id from family_children where family_id=$1`,
      [family.id],
    );
    const accountIds = accountsResult.rows.map((row) => row.id);
    await recordCompletedErasure(client, {
      requesterId: req.auth.sub,
      subjectId: req.auth.sub,
      familyId: family.id,
      accountIds,
      details: "Suppression définitive de la famille et de tous ses profils demandée depuis l’espace protégé.",
    });
    await client.query(
      "delete from conversations where id in (select conversation_id from conversation_members where account_id=any($1::uuid[]))",
      [accountIds],
    );
    await client.query("delete from families where id=$1", [family.id]);
    await client.query("delete from accounts where id=any($1::uuid[])", [accountIds]);
    await client.query("commit");
    return res.status(204).end();
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
    if (req.params.id === req.auth.sub) throw httpError(400, "Le parent principal ne peut pas se retirer lui-même.");
    const membershipsResult = await client.query(
      `select family_id,parent_id,role
       from family_memberships
       where parent_id=any($1::uuid[])
       order by parent_id
       for update`,
      [[req.auth.sub, req.params.id]],
    );
    const requester = membershipsResult.rows.find((membership) => membership.parent_id === req.auth.sub);
    if (!requester) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
    if (requester.role !== "primary") throw httpError(403, "Seul le parent principal peut retirer un co-parent.");
    const target = membershipsResult.rows.find((membership) => membership.parent_id === req.params.id);
    if (!target || target.family_id !== requester.family_id) throw httpError(404, "Co-parent introuvable dans votre famille.");
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
      `delete from family_parent_conversations
       where family_id=$1 and (parent_one_id=$2 or parent_two_id=$2)`,
      [requester.family_id, req.params.id],
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
  await repairFamilyChildrenForAccount(req.auth.sub);
  const result = await pool.query(
    `select child.*
     from family_memberships membership
     join family_children family_child on family_child.family_id=membership.family_id
     join accounts child on child.id=family_child.child_id and child.role='child'
     where membership.parent_id=$1 and child.contact_id<>$2
     order by family_child.added_at,child.display_name`,
    [req.auth.sub, legacyReservedContactId],
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
      await client.query(
        "select id from accounts where id=$1 and role='parent' for update",
        [req.auth.sub],
      );
      const membershipResult = await client.query(
        `select mine.family_id,primary_member.parent_id as primary_parent_id
         from family_memberships mine
         join family_memberships primary_member on primary_member.family_id=mine.family_id and primary_member.role='primary'
         where mine.parent_id=$1`,
        [req.auth.sub],
      );
      const membership = membershipResult.rows[0];
      if (!membership) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
      const lockedMemberships = await client.query(
        `select parent_id,role
         from family_memberships
         where family_id=$1 and parent_id=any($2::uuid[])
         order by parent_id
         for share`,
        [membership.family_id, [...new Set([req.auth.sub, membership.primary_parent_id])]],
      );
      const requesterMembership = lockedMemberships.rows.find((member) => member.parent_id === req.auth.sub);
      const primaryMembership = lockedMemberships.rows.find((member) => member.parent_id === membership.primary_parent_id && member.role === "primary");
      if (!requesterMembership || !primaryMembership) {
        throw httpError(409, "La composition de cette famille a changé. Réessayez.");
      }
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
        "insert into family_children(family_id,child_id) values($1,$2) on conflict(child_id) do nothing",
        [membership.family_id, result.rows[0].id],
      );
      const childFamilyResult = await client.query(
        "select family_id from family_children where child_id=$1 for share",
        [result.rows[0].id],
      );
      if (childFamilyResult.rows[0]?.family_id !== membership.family_id) {
        throw httpError(409, "Le profil enfant n’a pas pu être rattaché à cette famille.");
      }
      await client.query("commit");
      return res.status(201).json({ child: await serializeAccount(result.rows[0]) });
    } catch (error) {
      await client.query("rollback");
      if (error.code === "23505" && error.constraint === "accounts_contact_id_key") continue;
      if (error.code === "23505") return res.status(409).json({ error: "Ce pseudo privé est déjà utilisé. Choisissez-en un autre." });
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
    [req.params.id, req.auth.sub, legacyReservedContactId],
  );
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Profil enfant introuvable dans votre famille." });
  const normalized = normalizeChildProfile(req.body ?? {}, existing);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const { profile } = normalized;
  const passwordHash = profile.password ? await bcrypt.hash(profile.password, 12) : existing.password_hash;
  const client = await pool.connect();
  let updatedChild = null;
  let terminatedCalls = [];
  try {
    await client.query("begin");
    const result = await client.query(
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
    updatedChild = result.rows[0];
    if (!updatedChild) throw httpError(404, "Profil enfant introuvable dans votre famille.");
    if (profile.status === "paused") {
      const callsResult = await client.query(
        `update call_sessions
         set status=case when status='ringing' then 'cancelled' else 'ended' end,
             ended_at=coalesce(ended_at,now()),
             updated_at=now()
         where $1 in (caller_id,callee_id)
           and status in ('ringing','accepted')
         returning id,conversation_id,caller_id,callee_id,call_type,status,
           expires_at,answered_at,ended_at,updated_at`,
        [req.params.id],
      );
      terminatedCalls = callsResult.rows;
      await client.query(
        `delete from call_signals signal
         using call_sessions call
         where signal.call_id=call.id
           and $1 in (call.caller_id,call.callee_id)`,
        [req.params.id],
      );
      await client.query("delete from presence where account_id=$1", [req.params.id]);
      await client.query("delete from typing_states where account_id=$1", [req.params.id]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error.code === "23505") return res.status(409).json({ error: "Ce pseudo privé est déjà utilisé. Choisissez-en un autre." });
    throw error;
  } finally {
    client.release();
  }
  await Promise.allSettled(terminatedCalls.map((call) => notifyNativeCallState(call)));
  res.json({ child: await serializeAccount(updatedChild) });
});

app.patch("/api/account/avatar", requireAuth, requireActiveChild, async (req, res) => {
  if (req.auth.role !== "child") return res.status(403).json({ error: "L’avatar appartient au profil enfant." });
  const currentResult = await pool.query("select * from accounts where id=$1 and role='child'", [req.auth.sub]);
  const current = currentResult.rows[0];
  if (!current) return res.status(404).json({ error: "Profil enfant introuvable." });
  const avatar = normalizeAvatarConfig(req.body?.avatar, current.avatar_config);
  const result = await pool.query("update accounts set avatar_config=$1::jsonb where id=$2 and role='child' and status='active' returning *", [JSON.stringify(avatar), req.auth.sub]);
  if (!result.rowCount) return res.status(403).json({ error: "Ce profil enfant est en pause." });
  res.json({ child: await serializeAccount(result.rows[0]) });
});

async function serializeClubhouseState(childId, executor = pool) {
  const [catalogResult, progressResult, dailyResult, dailyChallengeResult, appearanceResult, todayResult] = await Promise.all([
    executor.query(
      `select activity.id,activity.reward,activity.kind,activity.rotation_rank,
              activity.fixed_catalog,activity.daily_eligible,activity.unlock_id,
              unlock.kind as unlock_kind,unlock.label as unlock_label,unlock.accent as unlock_accent
       from clubhouse_activities activity
       left join clubhouse_unlocks unlock on unlock.id=activity.unlock_id
       where activity.active=true
       order by activity.kind,activity.rotation_rank,activity.id`,
    ),
    executor.query(
      `select activity_id,first_completed_at,last_completed_at,completion_count,awarded_stars
       from clubhouse_activity_progress
       where child_id=$1
       order by first_completed_at`,
      [childId],
    ),
    executor.query(
      `select activity_date::text as activity_date
       from clubhouse_daily_activity
       where child_id=$1
       order by activity_date desc`,
      [childId],
    ),
    executor.query(
      `select challenge_date::text as challenge_date,activity_id
       from clubhouse_daily_challenges
       where child_id=$1
       order by challenge_date desc
       limit 40`,
      [childId],
    ),
    executor.query(
      "select unlock_id from clubhouse_appearance where child_id=$1",
      [childId],
    ),
    executor.query(
      "select (now() at time zone $1)::date::text as today",
      [parentalTimeZone],
    ),
  ]);
  return buildClubhouseState({
    catalogRows: catalogResult.rows,
    progressRows: progressResult.rows,
    activityDates: dailyResult.rows.map((row) => row.activity_date),
    dailyChallengeRows: dailyChallengeResult.rows,
    appearanceRow: appearanceResult.rows[0] ?? null,
    today: todayResult.rows[0].today,
  });
}

app.get("/api/clubhouse", requireAuth, requireActiveChild, async (req, res) => {
  if (req.auth.role !== "child") return res.status(403).json({ error: "La progression Clubhouse appartient au profil enfant." });
  res.json({ clubhouse: await serializeClubhouseState(req.auth.sub) });
});

app.post("/api/clubhouse/activities/:activityId/complete", requireAuth, requireActiveChild, async (req, res) => {
  if (req.auth.role !== "child") return res.status(403).json({ error: "Seul un enfant peut terminer une activité." });
  const activityId = String(req.params.activityId ?? "").trim();
  if (!/^[a-z0-9-]{3,64}$/.test(activityId)) return res.status(400).json({ error: "Activité invalide." });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const childResult = await client.query(
      "select id from accounts where id=$1 and role='child' and status='active' for update",
      [req.auth.sub],
    );
    if (!childResult.rowCount) throw httpError(403, "Ce profil enfant est en pause.");
    const activityResult = await client.query(
      `select activity.id,activity.reward,activity.unlock_id,
              unlock.kind as unlock_kind,unlock.label as unlock_label,unlock.accent as unlock_accent
       from clubhouse_activities activity
       left join clubhouse_unlocks unlock on unlock.id=activity.unlock_id
       where activity.id=$1 and activity.active=true
       for share of activity`,
      [activityId],
    );
    const activity = activityResult.rows[0];
    if (!activity) throw httpError(404, "Cette activité Clubhouse n’existe pas.");

    const existingResult = await client.query(
      `select activity_id
       from clubhouse_activity_progress
       where child_id=$1 and activity_id=$2
       for update`,
      [req.auth.sub, activityId],
    );
    const rewardEarned = !existingResult.rowCount;
    if (rewardEarned) {
      await client.query(
        `insert into clubhouse_activity_progress(child_id,activity_id,awarded_stars)
         values($1,$2,$3)`,
        [req.auth.sub, activityId, Number(activity.reward)],
      );
    } else {
      await client.query(
        `update clubhouse_activity_progress
         set last_completed_at=now(),completion_count=completion_count+1
         where child_id=$1 and activity_id=$2`,
        [req.auth.sub, activityId],
      );
    }
    await client.query(
      `insert into clubhouse_daily_activity(child_id,activity_date)
       values($1,(now() at time zone $2)::date)
       on conflict(child_id,activity_date) do nothing`,
      [req.auth.sub, parentalTimeZone],
    );
    let clubhouse = await serializeClubhouseState(req.auth.sub, client);
    if (clubhouse.dailyChallenge?.activityId === activityId) {
      await client.query(
        `insert into clubhouse_daily_challenges(child_id,challenge_date,activity_id)
         values($1,(now() at time zone $2)::date,$3)
         on conflict(child_id,challenge_date) do update
           set activity_id=excluded.activity_id,completed_at=now()`,
        [req.auth.sub, parentalTimeZone, activityId],
      );
      clubhouse = await serializeClubhouseState(req.auth.sub, client);
    }
    await client.query("commit");
    res.json({
      rewardEarned,
      reward: rewardEarned ? Number(activity.reward) : 0,
      unlockEarned: rewardEarned && activity.unlock_id
        ? {
            id: activity.unlock_id,
            kind: activity.unlock_kind,
            label: activity.unlock_label,
            accent: activity.unlock_accent,
          }
        : null,
      clubhouse,
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.patch("/api/clubhouse/appearance", requireAuth, requireActiveChild, async (req, res) => {
  if (req.auth.role !== "child") return res.status(403).json({ error: "L’apparence du Clubhouse appartient au profil enfant." });
  const unlockId = String(req.body?.unlockId ?? "").trim();
  if (!/^[a-z0-9-]{3,64}$/.test(unlockId)) return res.status(400).json({ error: "Récompense invalide." });

  const ownedResult = await pool.query(
    `select unlock.id
     from clubhouse_unlocks unlock
     join clubhouse_activities activity on activity.unlock_id=unlock.id
     join clubhouse_activity_progress progress
       on progress.activity_id=activity.id and progress.child_id=$1
     where unlock.id=$2
     limit 1`,
    [req.auth.sub, unlockId],
  );
  if (!ownedResult.rowCount) return res.status(403).json({ error: "Cette récompense n’est pas encore débloquée." });

  await pool.query(
    `insert into clubhouse_appearance(child_id,unlock_id)
     values($1,$2)
     on conflict(child_id) do update set unlock_id=excluded.unlock_id,updated_at=now()`,
    [req.auth.sub, unlockId],
  );
  res.json({ clubhouse: await serializeClubhouseState(req.auth.sub) });
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
      [req.params.id, membership.family_id, legacyReservedContactId],
    );
    if (!childResult.rows[0]) {
      throw httpError(404, "Profil enfant introuvable dans votre famille.");
    }

    await recordCompletedErasure(client, {
      requesterId: req.auth.sub,
      subjectId: req.params.id,
      familyId: membership.family_id,
      accountIds: [req.params.id],
      details: "Suppression définitive du profil enfant demandée par le parent principal.",
    });
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

app.post("/api/presence/heartbeat", requireAuth, requireActiveChild, async (req, res) => {
  const result = await pool.query(
    `with active_account as (
       update accounts
       set last_activity_at=now()
       where id=$1 and (role<>'child' or status='active')
       returning id
     )
     insert into presence(account_id,last_seen,expires_at)
     select id,now(),now()+interval '24 hours' from active_account
     on conflict(account_id) do update
       set last_seen=excluded.last_seen,expires_at=excluded.expires_at`,
    [req.auth.sub],
  );
  if (!result.rowCount) return res.status(403).json({ error: "Ce profil enfant est en pause." });
  res.status(204).end();
});

app.get("/api/presence", requireAuth, requireActiveChild, async (req, res) => {
  const contactIds = String(req.query.contactIds ?? "").split(",").map((value) => value.trim()).filter((value) => /^SC-\d{3}-\d{3}-\d{3}$/.test(value)).slice(0, 100);
  if (!contactIds.length) return res.json({ presence: {} });
  const result = await pool.query(
    `with requester_families as (
       select family_id from family_memberships where parent_id=$2
       union
       select family_id from family_children where child_id=$2
     ),
     authorized_accounts as (
       select $2::uuid as account_id
       union
       select case
         when relationship.account_one_id=$2 then relationship.account_two_id
         else relationship.account_one_id
       end
       from contact_relationships relationship
       where relationship.account_one_id=$2 or relationship.account_two_id=$2
       union
       select membership.parent_id
       from family_memberships membership
       join requester_families using(family_id)
       union
       select child.child_id
       from family_children child
       join requester_families using(family_id)
     )
     select account.contact_id,presence.last_seen > now() - interval '75 seconds' as online
     from accounts account
     join authorized_accounts authorized on authorized.account_id=account.id
     left join presence on presence.account_id=account.id
     where account.contact_id=any($1::text[])`,
    [contactIds, req.auth.sub],
  );
  res.json({ presence: Object.fromEntries(result.rows.map((row) => [row.contact_id, Boolean(row.online)])) });
});

app.get("/api/privacy/notification-consent", requireAuth, async (req, res) => {
  const consent = await getNotificationConsent(pool, req.auth.sub);
  if (!consent) return res.status(404).json({ error: "Compte introuvable." });
  res.json({ consent });
});

app.put("/api/privacy/notification-consent", requireAuth, requireActiveChild, async (req, res) => {
  if (typeof req.body?.agreed !== "boolean") {
    return res.status(400).json({ error: "Choisissez d’accepter ou de refuser les notifications." });
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const consent = await setSubjectNotificationConsent(client, {
      subjectAccountId: req.auth.sub,
      agreed: req.body.agreed,
    });
    await client.query("commit");
    res.json({ consent });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/children/:id/privacy/notification-consent", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Accès réservé au compte parent." });
  const authorized = await pool.query(
    `select child.id
     from accounts child
     join family_children family_child on family_child.child_id=child.id
     join family_memberships membership on membership.family_id=family_child.family_id
     where membership.parent_id=$1 and child.id=$2 and child.role='child'`,
    [req.auth.sub, req.params.id],
  );
  if (!authorized.rowCount) return res.status(404).json({ error: "Profil enfant introuvable dans votre famille." });
  const consent = await getNotificationConsent(pool, req.params.id);
  res.json({ consent });
});

app.put("/api/children/:id/privacy/notification-consent", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Accès réservé au compte parent." });
  if (typeof req.body?.agreed !== "boolean") {
    return res.status(400).json({ error: "Choisissez d’accepter ou de refuser les notifications." });
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const authorized = await client.query(
      `select child.id
       from accounts child
       join family_children family_child on family_child.child_id=child.id
       join family_memberships membership on membership.family_id=family_child.family_id
       where membership.parent_id=$1 and child.id=$2 and child.role='child'
       for update of child`,
      [req.auth.sub, req.params.id],
    );
    if (!authorized.rowCount) throw httpError(404, "Profil enfant introuvable dans votre famille.");
    const consent = await setGuardianNotificationConsent(client, {
      subjectAccountId: req.params.id,
      guardianAccountId: req.auth.sub,
      agreed: req.body.agreed,
    });
    await client.query("commit");
    res.json({ consent });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/push/public-key", requireAuth, (_req, res) => {
  if (!pushEnabled) return res.status(503).json({ error: "Les notifications push ne sont pas encore configurées." });
  res.json({ publicKey: vapidPublicKey });
});

app.post("/api/push/subscribe", requireAuth, requireActiveChild, async (req, res) => {
  if (!productionFeatures.webPush || !pushEnabled) {
    return res.status(503).json({ error: "Web Push n’est pas activé." });
  }
  const subscription = req.body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return res.status(400).json({ error: "Abonnement push invalide." });
  await assertActiveNotificationConsent(pool, req.auth.sub);
  await pool.query(
    `insert into push_subscriptions(account_id,endpoint,subscription,updated_at,expires_at)
     values($1,$2,$3::jsonb,now(),now()+interval '180 days')
     on conflict(endpoint) do update
       set account_id=excluded.account_id,
           subscription=excluded.subscription,
           updated_at=excluded.updated_at,
           expires_at=excluded.expires_at`,
    [req.auth.sub, subscription.endpoint, JSON.stringify(subscription)],
  );
  res.status(204).end();
});

app.delete("/api/push/subscribe", requireAuth, async (req, res) => {
  if (req.body?.endpoint) await pool.query("delete from push_subscriptions where account_id=$1 and endpoint=$2", [req.auth.sub, req.body.endpoint]);
  res.status(204).end();
});

app.post("/api/push/native-token", requireAuth, requireActiveChild, async (req, res) => {
  if (!productionFeatures.nativePush) {
    return res.status(503).json({ error: "Les notifications natives ne sont pas activées." });
  }
  let registration;
  try {
    registration = normalizeNativeTokenRegistration(req.body, process.env);
  } catch {
    return res.status(400).json({ error: "Inscription de notification mobile invalide." });
  }
  await assertActiveNotificationConsent(pool, req.auth.sub);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtext($1),hashtext($2))",
      [req.auth.sub, registration.deviceId],
    );
    await client.query(
      `delete from native_push_tokens
       where account_id=$1 and device_id=$2 and token_kind=$3 and token<>$4`,
      [req.auth.sub, registration.deviceId, registration.tokenKind, registration.token],
    );
    await client.query(
      `insert into native_push_tokens(
         account_id,platform,device_id,token_kind,token,environment,topic,
         enabled,created_at,updated_at,expires_at,last_failure_at,last_error_code
       )
       values($1,$2,$3,$4,$5,$6,$7,true,now(),now(),now()+interval '180 days',null,null)
       on conflict(token) do update
         set account_id=excluded.account_id,
             platform=excluded.platform,
             device_id=excluded.device_id,
             token_kind=excluded.token_kind,
             environment=excluded.environment,
             topic=excluded.topic,
             enabled=true,
             last_success_at=null,
             updated_at=now(),
             expires_at=now()+interval '180 days',
             last_failure_at=null,
             last_error_code=null`,
      [
        req.auth.sub,
        registration.platform,
        registration.deviceId,
        registration.tokenKind,
        registration.token,
        registration.environment,
        registration.topic,
      ],
    );
    await client.query("commit");
    return res.status(204).end();
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/push/native-token", requireAuth, async (req, res) => {
  const deviceId = String(req.query.deviceId ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(deviceId)) return res.status(400).json({ error: "Identifiant d’installation invalide." });
  const result = await pool.query(
    `select token_kind
     from native_push_tokens
     where account_id=$1 and device_id=$2 and enabled=true and expires_at>now()
     order by token_kind`,
    [req.auth.sub, deviceId],
  );
  res.json({
    registered: result.rowCount > 0,
    tokenKinds: result.rows.map((row) => row.token_kind),
  });
});

app.delete("/api/push/native-token", requireAuth, async (req, res) => {
  const deviceId = String(req.body?.deviceId ?? "").trim();
  const token = String(req.body?.token ?? "").trim();
  if (!deviceId && !token) return res.status(400).json({ error: "Installation ou jeton mobile requis." });
  if (deviceId && !/^[A-Za-z0-9._:-]{8,200}$/.test(deviceId)) return res.status(400).json({ error: "Identifiant d’installation invalide." });
  if (token && (token.length < 20 || token.length > 4096 || /\s/.test(token))) return res.status(400).json({ error: "Jeton mobile invalide." });
  const result = deviceId
    ? await pool.query(
        "delete from native_push_tokens where account_id=$1 and device_id=$2 returning id",
        [req.auth.sub, deviceId],
      )
    : await pool.query(
        "delete from native_push_tokens where account_id=$1 and token=$2 returning id",
        [req.auth.sub, token],
      );
  res.json({ removed: result.rowCount });
});

async function deliverWebPush(rows, payload) {
  if (!pushEnabled) return 0;
  const {
    callActionToken: _callActionToken,
    callActionUrl: _callActionUrl,
    respondUrl: _respondUrl,
    acceptUrl: _acceptUrl,
    declineUrl: _declineUrl,
    hangupUrl: _hangupUrl,
    statusUrl: _statusUrl,
    ...webPayload
  } = payload;
  const results = await Promise.all(rows.map(async (row) => {
    try {
      const ttl = payload.notificationType === "incoming-call" ? callTimeoutSeconds : 3600;
      await webpush.sendNotification(row.subscription, JSON.stringify(webPayload), {
        TTL: ttl,
        urgency: "high",
        timeout: webPushTimeoutMs,
      });
      return true;
    }
    catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await pool.query("delete from push_subscriptions where id=$1", [row.id]);
      else console.error("Échec push", error.statusCode || error.message);
      return false;
    }
  }));
  return results.filter(Boolean).length;
}

async function notifyNativeAccounts(accountIds, payload) {
  if (!nativePushService || !accountIds.length) return 0;
  return nativePushService.deliverToAccounts(
    accountIds,
    privacySafeNotificationPayload(payload),
  );
}

async function settleNotificationDeliveries(deliveries) {
  const results = await Promise.allSettled(deliveries);
  let delivered = 0;
  for (const result of results) {
    if (result.status === "fulfilled") delivered += Number(result.value) || 0;
    else console.error("Échec d’un canal de notification", result.reason?.message || result.reason);
  }
  return delivered;
}

async function notifyAccounts(accountIds, payload) {
  const uniqueIds = [...new Set(accountIds.filter(Boolean))];
  if (!uniqueIds.length) return 0;
  const safePayload = privacySafeNotificationPayload(payload);
  const webDelivery = pushEnabled
    ? pool.query(
        `select subscription.id,subscription.subscription
         from push_subscriptions subscription
         join accounts account on account.id=subscription.account_id
         join account_consent_preferences consent
           on consent.subject_account_id=account.id and consent.purpose='notifications'
         where subscription.account_id=any($1::uuid[]) and subscription.expires_at>now()
           and consent.subject_agreed_at is not null
           and (account.role<>'child' or account.age>=15 or consent.guardian_agreed_at is not null)`,
        [uniqueIds],
      ).then((result) => deliverWebPush(result.rows, safePayload))
    : Promise.resolve(0);
  return settleNotificationDeliveries([
    webDelivery,
    notifyNativeAccounts(uniqueIds, safePayload),
  ]);
}

async function notifyConversation(conversationId, senderId, payload) {
  const safePayload = privacySafeNotificationPayload(payload);
  const webDelivery = pushEnabled
    ? pool.query(
        `select subscription.id,subscription.subscription
         from push_subscriptions subscription
         join conversation_members member on member.account_id=subscription.account_id
         join accounts account on account.id=subscription.account_id
         join account_consent_preferences consent
           on consent.subject_account_id=account.id and consent.purpose='notifications'
         where member.conversation_id=$1 and member.account_id<>$2 and subscription.expires_at>now()
           and consent.subject_agreed_at is not null
           and (account.role<>'child' or account.age>=15 or consent.guardian_agreed_at is not null)`,
        [conversationId, senderId],
      ).then((result) => deliverWebPush(result.rows, safePayload))
    : Promise.resolve(0);
  const nativeDelivery = nativePushService
    ? nativePushService.deliverToConversation(conversationId, senderId, safePayload)
    : Promise.resolve(0);
  return settleNotificationDeliveries([webDelivery, nativeDelivery]);
}

app.post("/api/family-conversations", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut ouvrir une conversation familiale." });
  const contactId = String(req.body?.contactId ?? "").trim().toUpperCase();
  if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(contactId) || contactId === legacyReservedContactId) {
    return res.status(400).json({ error: "Identifiant enfant invalide." });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await repairFamilyChildrenForAccount(req.auth.sub, client);
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
  await repairFamilyChildrenForAccount(accountId);
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

async function provisionHouseholdParentConversations(executor, accountId) {
  const pairs = await executor.query(
    `select mine.family_id, mine.parent_id as current_parent_id, other.parent_id as other_parent_id
     from family_memberships mine
     join family_memberships other on other.family_id=mine.family_id and other.parent_id<>mine.parent_id
     where mine.parent_id=$1
     for key share of mine,other`,
    [accountId],
  );
  if (!pairs.rowCount) return;
  const canonicalPairs = pairs.rows
    .map((pair) => ({ ...pair, parentIds: [pair.current_parent_id, pair.other_parent_id].sort() }))
    .sort((left, right) => `${left.family_id}:${left.parentIds.join(":")}`.localeCompare(`${right.family_id}:${right.parentIds.join(":")}`));
  for (const pair of canonicalPairs) {
    const [parentOneId, parentTwoId] = pair.parentIds;
    await executor.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", [pair.family_id, `${parentOneId}:${parentTwoId}`]);
    const existing = await executor.query(
      `select conversation_id from family_parent_conversations
       where family_id=$1 and parent_one_id=$2 and parent_two_id=$3`,
      [pair.family_id, parentOneId, parentTwoId],
    );
    let conversationId = existing.rows[0]?.conversation_id;
    if (!conversationId) {
      const conversation = await executor.query("insert into conversations(kind) values('parent') returning id");
      conversationId = conversation.rows[0].id;
      await executor.query(
        `insert into family_parent_conversations(family_id,parent_one_id,parent_two_id,conversation_id)
         values($1,$2,$3,$4)`,
        [pair.family_id, parentOneId, parentTwoId, conversationId],
      );
    }
    await executor.query(
      `insert into conversation_members(conversation_id,account_id) values($1,$2),($1,$3)
       on conflict(conversation_id,account_id) do nothing`,
      [conversationId, parentOneId, parentTwoId],
    );
  }
}

async function ensureHouseholdParentConversations(accountId) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await provisionHouseholdParentConversations(client, accountId);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function serializeConversationMessage(message) {
  const content = decryptMessageContent(message);
  return {
    id: message.id,
    conversationId: message.conversation_id ?? message.conversationId,
    senderId: message.sender_id ?? message.senderId,
    text: content.body,
    mediaName: content.mediaName,
    mediaType: content.mediaType,
    messageKind: message.message_kind ?? message.messageKind ?? "user",
    createdAt: message.created_at ?? message.createdAt,
    deliveryStatus: message.delivery_status ?? message.deliveryStatus ?? null,
    syncVersion: String(message.sync_version ?? message.syncVersion ?? "0"),
  };
}

async function currentConversationSyncCursor(executor = pool) {
  const result = await executor.query("select last_value::text as cursor from message_sync_version_seq");
  return normalizeConversationSyncCursor(result.rows[0]?.cursor) ?? "0";
}

async function listConversationSummaries(accountId, executor = pool) {
  const result = await executor.query(`
    select c.id, c.kind, a.display_name as name, a.contact_id, a.role as contact_role,
      a.status as contact_status, a.communication_schedule,
      (
        select count(*)::int
        from message_receipts unread_receipt
        join messages unread_message on unread_message.id=unread_receipt.message_id
        where unread_receipt.recipient_id=$1
          and unread_receipt.seen_at is null
          and unread_message.conversation_id=c.id
      ) as unread_count,
      exists(
        select 1 from family_parent_conversations family_parent
        where family_parent.conversation_id=c.id and family_parent.family_id in (
          select family_id from family_memberships where parent_id=$1
        )
      ) as is_family_member,
      latest_message.payload as latest_message,
      latest_message.created_at as latest_message_at
    from conversation_members mine
    join conversations c on c.id=mine.conversation_id
    join conversation_members other on other.conversation_id=c.id and other.account_id<>mine.account_id
    join accounts a on a.id=other.account_id
    left join lateral (
      select latest.created_at, json_build_object(
        'id',latest.id,
        'conversationId',latest.conversation_id,
        'senderId',latest.sender_id,
        'text',latest.body,
        'mediaName',latest.media_name,
        'mediaType',latest.media_type,
        'bodyCiphertext',latest.body_ciphertext,
        'mediaNameCiphertext',latest.media_name_ciphertext,
        'mediaTypeCiphertext',latest.media_type_ciphertext,
        'contentEncryptionVersion',latest.content_encryption_version,
        'contentEncryptionKeyId',latest.content_encryption_key_id,
        'messageKind',latest.message_kind,
        'createdAt',latest.created_at,
        'syncVersion',latest.sync_version,
        'deliveryStatus',case
          when latest.sender_id<>$1 then null
          else coalesce((
            select case
              when count(*)=0 then 'sent'
              when bool_and(receipt.seen_at is not null) then 'seen'
              when bool_and(receipt.received_at is not null) then 'received'
              else 'sent'
            end
            from message_receipts receipt
            where receipt.message_id=latest.id
          ),'sent')
        end
      ) as payload
      from messages latest
      where latest.conversation_id=c.id
      order by latest.created_at desc,latest.id desc
      limit 1
    ) latest_message on true
    where mine.account_id=$1
      and (
        not exists(select 1 from family_parent_conversations family_parent where family_parent.conversation_id=c.id)
        or exists(
          select 1 from family_parent_conversations family_parent
          join family_memberships active_membership on active_membership.family_id=family_parent.family_id and active_membership.parent_id=$1
          where family_parent.conversation_id=c.id
            and $1 in (family_parent.parent_one_id,family_parent.parent_two_id)
        )
      )
    order by latest_message.created_at desc nulls last,c.id`, [accountId]);
  return result.rows.map((conversation) => ({
    ...conversation,
    communication_schedule: serializeCommunicationSchedule(conversation.communication_schedule),
    latest_message: conversation.latest_message
      ? serializeConversationMessage(conversation.latest_message)
      : null,
  }));
}

async function markMessagesReceived(accountId, messageIds, executor = pool) {
  if (!messageIds.length) return;
  await executor.query(
    `update message_receipts
     set received_at=coalesce(received_at,clock_timestamp())
     where recipient_id=$1
       and message_id=any($2::uuid[])
       and received_at is null`,
    [accountId, messageIds],
  );
}

app.get("/api/conversations", requireAuth, requireActiveChild, async (req, res) => {
  await ensureFamilyConversations(req.auth.sub);
  if (req.auth.role === "parent") await ensureHouseholdParentConversations(req.auth.sub);
  const syncCursor = await currentConversationSyncCursor();
  const conversations = await listConversationSummaries(req.auth.sub);
  res.json({ conversations, syncCursor });
});

app.get("/api/conversations/sync", requireAuth, requireActiveChild, async (req, res) => {
  const cursor = normalizeConversationSyncCursor(req.query.cursor);
  if (cursor === null) throw httpError(400, "Curseur de synchronisation invalide.");
  const watermark = await currentConversationSyncCursor();
  const result = await pool.query(`
    select message.id,message.conversation_id,message.sender_id,
      message.body,message.media_name,message.media_type,
      message.body_ciphertext,message.media_name_ciphertext,message.media_type_ciphertext,
      message.content_encryption_version,message.content_encryption_key_id,
      message.message_kind,message.created_at,message.sync_version,
      case
        when message.sender_id<>$1 then null
        else coalesce((
          select case
            when count(*)=0 then 'sent'
            when bool_and(receipt.seen_at is not null) then 'seen'
            when bool_and(receipt.received_at is not null) then 'received'
            else 'sent'
          end
          from message_receipts receipt
          where receipt.message_id=message.id
        ),'sent')
      end as delivery_status
    from conversation_members mine
    join messages message on message.conversation_id=mine.conversation_id
    where mine.account_id=$1
      and message.sync_version>$2::bigint
      and message.sync_version<=$3::bigint
      and (
        not exists(select 1 from family_parent_conversations family_parent where family_parent.conversation_id=message.conversation_id)
        or exists(
          select 1 from family_parent_conversations family_parent
          join family_memberships active_membership on active_membership.family_id=family_parent.family_id and active_membership.parent_id=$1
          where family_parent.conversation_id=message.conversation_id
            and $1 in (family_parent.parent_one_id,family_parent.parent_two_id)
        )
      )
    order by message.sync_version,message.id
    limit $4`, [req.auth.sub, cursor, watermark, conversationSyncPageSize + 1]);
  const hasMore = result.rows.length > conversationSyncPageSize;
  const changedRows = result.rows.slice(0, conversationSyncPageSize);
  await markMessagesReceived(req.auth.sub, changedRows.map((message) => message.id));
  const nextCursor = hasMore
    ? String(changedRows.at(-1)?.sync_version ?? cursor)
    : watermark;
  const conversations = await listConversationSummaries(req.auth.sub);
  res.json({
    conversations,
    messages: changedRows.map(serializeConversationMessage),
    cursor: nextCursor,
    hasMore,
  });
});

app.get("/api/conversations/:id/messages", requireAuth, requireActiveChild, async (req, res) => {
  const limit = normalizeMessagePageLimit(req.query.limit);
  if (limit === null) throw httpError(400, "Limite de messages invalide.");
  const pageCursor = decodeMessagePageCursor(req.query.before);
  if (pageCursor === false) throw httpError(400, "Curseur de pagination invalide.");
  if (!await isConversationMember(req.auth.sub, req.params.id)) {
    throw httpError(403, "Conversation non autorisée.");
  }
  const result = await pool.query(`
    select message.id,message.conversation_id,message.sender_id,
      message.body,message.media_name,message.media_type,
      message.body_ciphertext,message.media_name_ciphertext,message.media_type_ciphertext,
      message.content_encryption_version,message.content_encryption_key_id,
      message.message_kind,message.created_at,message.sync_version,
      case
        when message.sender_id<>$1 then null
        else coalesce((
          select case
            when count(*)=0 then 'sent'
            when bool_and(receipt.seen_at is not null) then 'seen'
            when bool_and(receipt.received_at is not null) then 'received'
            else 'sent'
          end
          from message_receipts receipt
          where receipt.message_id=message.id
        ),'sent')
      end as delivery_status
    from messages message
    where message.conversation_id=$2
      and (
        $3::timestamptz is null
        or (message.created_at,message.id)<($3::timestamptz,$4::uuid)
      )
    order by message.created_at desc,message.id desc
    limit $5`, [
    req.auth.sub,
    req.params.id,
    pageCursor?.createdAt ?? null,
    pageCursor?.id ?? null,
    limit + 1,
  ]);
  const hasMore = result.rows.length > limit;
  const pageRows = result.rows.slice(0, limit);
  await markMessagesReceived(req.auth.sub, pageRows.map((message) => message.id));
  const messages = pageRows.reverse().map(serializeConversationMessage);
  const oldest = messages[0];
  res.json({
    messages,
    pageInfo: {
      hasMore,
      nextCursor: hasMore && oldest
        ? encodeMessagePageCursor({ createdAt: oldest.createdAt, id: oldest.id })
        : null,
    },
  });
});

app.post("/api/conversations/:id/read", requireAuth, requireActiveChild, async (req, res) => {
  if (!await isConversationMember(req.auth.sub, req.params.id)) {
    return res.status(403).json({ error: "Conversation non autorisée." });
  }
  const messageIds = normalizeConversationMessageIds(req.body?.messageIds);
  if (messageIds === null) throw httpError(400, "Liste de messages lus invalide.");
  if (!messageIds.length) return res.json({ seenCount: 0 });
  const result = await pool.query(
    `update message_receipts receipt
     set received_at=coalesce(receipt.received_at,now()),
         seen_at=coalesce(receipt.seen_at,now())
     from messages message
     where receipt.message_id=message.id
       and receipt.recipient_id=$1
       and message.conversation_id=$2
       and message.id=any($3::uuid[])
       and receipt.seen_at is null`,
    [req.auth.sub, req.params.id, messageIds],
  );
  res.json({ seenCount: result.rowCount });
});

const serializeContactRequest = (row) => ({
  id: row.id,
  direction: row.direction,
  kind: row.requester_role === "child" && row.target_role === "child" ? "child_friend" : "adult_contact",
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  resolvedAt: row.resolved_at,
  conversationId: row.conversation_id,
  canRespond: Boolean(row.can_respond),
  requester: {
    id: row.requester_id,
    name: row.requester_name,
    contactId: row.requester_contact_id,
    role: row.requester_role,
    age: row.requester_age === null ? null : Number(row.requester_age),
  },
  target: {
    id: row.target_account_id,
    name: row.target_name,
    contactId: row.target_contact_id,
    role: row.target_role,
    age: row.target_age === null ? null : Number(row.target_age),
  },
  requestedBy: {
    id: row.requested_by_parent_id,
    name: row.requested_by_name,
  },
});

async function getVisibleContactRequests(parentId, executor = pool) {
  const membership = await getParentFamilyMembership(parentId, executor);
  if (!membership) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
  const result = await executor.query(
    `with managed_accounts as (
       select parent_id as account_id from family_memberships where family_id=$2
       union
       select child_id as account_id from family_children where family_id=$2
     )
     select request.*,requester.display_name as requester_name,requester.contact_id as requester_contact_id,
       requester.role as requester_role,requester.age as requester_age,
       target.display_name as target_name,target.contact_id as target_contact_id,
       target.role as target_role,target.age as target_age,
       requested_by.display_name as requested_by_name,
       case when request.target_account_id in (select account_id from managed_accounts) then 'incoming' else 'outgoing' end as direction,
       (
         request.status='pending'
         and (
           request.target_account_id=$1
           or exists(
             select 1 from family_children target_child
             join family_memberships responder on responder.family_id=target_child.family_id
             where target_child.child_id=request.target_account_id and responder.parent_id=$1
           )
         )
       ) as can_respond
     from contact_requests request
     join accounts requester on requester.id=request.requester_id
     join accounts target on target.id=request.target_account_id
     join accounts requested_by on requested_by.id=request.requested_by_parent_id
     where request.requester_id in (select account_id from managed_accounts)
       or request.target_account_id in (select account_id from managed_accounts)
     order by (request.status='pending') desc,request.updated_at desc,request.created_at desc`,
    [parentId, membership.family_id],
  );
  return result.rows.map(serializeContactRequest);
}

async function getVisibleContactRelationships(parentId, executor = pool) {
  const membership = await getParentFamilyMembership(parentId, executor);
  if (!membership) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
  const result = await executor.query(
    `with managed_accounts as (
       select parent_id as account_id from family_memberships where family_id=$1
       union
       select child_id as account_id from family_children where family_id=$1
     )
     select relationship.conversation_id,relationship.created_at,
       mine.id as account_id,mine.display_name as account_name,mine.contact_id as account_contact_id,mine.role as account_role,
       contact.id as contact_id,contact.display_name as contact_name,contact.contact_id as contact_contact_id,contact.role as contact_role
     from contact_relationships relationship
     join accounts mine on mine.id=case
       when relationship.account_one_id in (select account_id from managed_accounts) then relationship.account_one_id
       else relationship.account_two_id
     end
     join accounts contact on contact.id=case when mine.id=relationship.account_one_id then relationship.account_two_id else relationship.account_one_id end
     where relationship.account_one_id in (select account_id from managed_accounts)
       or relationship.account_two_id in (select account_id from managed_accounts)
     order by relationship.created_at desc`,
    [membership.family_id],
  );
  return result.rows.map((row) => ({
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    account: { id: row.account_id, name: row.account_name, contactId: row.account_contact_id, role: row.account_role },
    contact: { id: row.contact_id, name: row.contact_name, contactId: row.contact_contact_id, role: row.contact_role },
  }));
}

app.get("/api/contact-requests", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Accès réservé au compte parent." });
  await repairFamilyChildrenForAccount(req.auth.sub);
  const [requests, contacts] = await Promise.all([
    getVisibleContactRequests(req.auth.sub),
    getVisibleContactRelationships(req.auth.sub),
  ]);
  res.json({ requests, contacts });
});

app.post("/api/contact-requests", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Seul un parent peut ajouter un contact." });
  const contactId = String(req.body?.contactId ?? "").trim().toUpperCase();
  const requesterContactId = String(req.body?.requesterContactId ?? "").trim().toUpperCase();
  if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(contactId)) return res.status(400).json({ error: "Saisissez un identifiant au format SC-123-456-789." });
  if (requesterContactId && !/^SC-\d{3}-\d{3}-\d{3}$/.test(requesterContactId)) {
    return res.status(400).json({ error: "Le profil demandeur est invalide." });
  }
  if (contactId === legacyReservedContactId) return res.status(404).json({ error: "Aucun compte ne correspond à cet identifiant." });

  const client = await pool.connect();
  try {
    await client.query("begin");
    await repairFamilyChildrenForAccount(req.auth.sub, client);
    const requesterMembership = await getParentFamilyMembership(req.auth.sub, client);
    if (!requesterMembership) throw httpError(404, "Ce compte parent n’est rattaché à aucune famille.");
    const requesterResult = await client.query(
      `select account.id,account.role,account.display_name,account.contact_id,account.status
       from accounts account
       where account.contact_id=coalesce(nullif($2,''),(select contact_id from accounts where id=$1))
         and (
           account.id=$1
           or exists(
             select 1 from family_children child
             where child.family_id=$3 and child.child_id=account.id
           )
         )
       for share of account`,
      [req.auth.sub, requesterContactId, requesterMembership.family_id],
    );
    const requester = requesterResult.rows[0];
    if (!requester) throw httpError(403, "Choisissez votre compte parent ou un enfant de votre famille.");
    const targetResult = await client.query(
      `select target.id,target.role,target.display_name,target.contact_id,target.status,
        child_family.family_id as child_family_id,child_primary.parent_id as child_primary_parent_id,
        parent_membership.family_id as parent_family_id
       from accounts target
       left join family_children child_family on child_family.child_id=target.id and target.role='child'
       left join family_memberships child_primary on child_primary.family_id=child_family.family_id and child_primary.role='primary'
       left join family_memberships parent_membership on parent_membership.parent_id=target.id and target.role='parent'
       where target.contact_id=$1
       for share of target`,
      [contactId],
    );
    const target = targetResult.rows[0];
    if (!target) throw httpError(404, "Aucun compte ne correspond à cet identifiant.");
    if (target.id === requester.id) throw httpError(400, "Vous ne pouvez pas vous ajouter vous-même.");
    const targetFamilyId = target.role === "child" ? target.child_family_id : target.parent_family_id;
    if (targetFamilyId === requesterMembership.family_id) throw httpError(400, "Cet identifiant appartient déjà à votre famille.");
    if (requester.role !== target.role) {
      throw httpError(400, requester.role === "child"
        ? "Un profil enfant peut uniquement ajouter un autre enfant."
        : "Pour ajouter un enfant, choisissez d’abord le profil enfant concerné.");
    }
    if ((requester.role === "child" && requester.status !== "active") || (target.role === "child" && target.status !== "active")) {
      throw httpError(409, "Un des profils enfants est actuellement en pause.");
    }
    const recipientParentId = target.role === "child" ? target.child_primary_parent_id : target.id;
    if (!recipientParentId) throw httpError(409, "La famille de ce contact n’a pas de parent principal disponible.");
    const pair = [requester.id, target.id].sort();
    const existingRelationship = await client.query(
      "select 1 from contact_relationships where account_one_id=$1 and account_two_id=$2",
      pair,
    );
    if (existingRelationship.rowCount) throw httpError(409, "Ce contact est déjà approuvé.");
    const existingPending = await client.query(
      `select 1 from contact_requests
       where status='pending'
         and least(requester_id,target_account_id)=least($1::uuid,$2::uuid)
         and greatest(requester_id,target_account_id)=greatest($1::uuid,$2::uuid)`,
      [requester.id, target.id],
    );
    if (existingPending.rowCount) throw httpError(409, "Une demande est déjà en attente entre ces contacts.");
    const result = await client.query(
      `insert into contact_requests(requester_id,requested_by_parent_id,target_account_id,recipient_parent_id)
       values($1,$2,$3,$4) returning id,status,created_at,updated_at`,
      [requester.id, req.auth.sub, target.id, recipientParentId],
    );
    await client.query("commit");
    try {
      const recipientIds = target.role === "child"
        ? (await pool.query("select parent_id from family_memberships where family_id=$1", [targetFamilyId])).rows.map((row) => row.parent_id)
        : [target.id];
      await notifyAccounts(recipientIds, {
        title: "Nouvelle demande de contact",
        body: `${requester.display_name} attend votre approbation dans l’espace parent.`,
        notificationType: "contact-request",
        tag: `contact-request-${result.rows[0].id}`,
        url: "/?notification=contact-request",
      });
    } catch (notificationError) {
      console.error("Échec de notification de demande de contact", notificationError);
    }
    res.status(201).json({
      request: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      },
      requester: { name: requester.display_name, contactId: requester.contact_id, role: requester.role },
      contact: { name: target.display_name, contactId, role: target.role },
    });
  } catch (error) {
    await client.query("rollback");
    if (error.code === "23505") return res.status(409).json({ error: "Une demande est déjà en attente entre ces contacts." });
    throw error;
  } finally {
    client.release();
  }
});

async function ensureApprovedContactConversation(firstAccountId, secondAccountId, conversationKind, approvedRequestId, executor) {
  const pair = [firstAccountId, secondAccountId].sort();
  await executor.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", pair);
  const existingRelationship = await executor.query(
    `select conversation_id
     from contact_relationships
     where account_one_id=$1 and account_two_id=$2
     for update`,
    pair,
  );
  if (existingRelationship.rowCount) return existingRelationship.rows[0].conversation_id;

  const existingConversation = await executor.query(
    `select conversation.id
     from conversations conversation
     where conversation.kind=$3
       and exists(
         select 1 from conversation_members member
         where member.conversation_id=conversation.id and member.account_id=$1
       )
       and exists(
         select 1 from conversation_members member
         where member.conversation_id=conversation.id and member.account_id=$2
       )
       and (
         select count(*) from conversation_members member
         where member.conversation_id=conversation.id
       )=2
     order by conversation.created_at
     limit 1
     for update of conversation`,
    [pair[0], pair[1], conversationKind],
  );
  let conversationId = existingConversation.rows[0]?.id;
  if (!conversationId) {
    const conversation = await executor.query(
      "insert into conversations(kind) values($1) returning id",
      [conversationKind],
    );
    conversationId = conversation.rows[0].id;
    await executor.query(
      `insert into conversation_members(conversation_id,account_id)
       values($1,$2),($1,$3)`,
      [conversationId, pair[0], pair[1]],
    );
  }
  await executor.query(
    `insert into contact_relationships(account_one_id,account_two_id,conversation_id,approved_request_id)
     values($1,$2,$3,$4)
     on conflict(account_one_id,account_two_id) do nothing`,
    [pair[0], pair[1], conversationId, approvedRequestId],
  );
  const confirmedRelationship = await executor.query(
    `select conversation_id
     from contact_relationships
     where account_one_id=$1 and account_two_id=$2`,
    pair,
  );
  if (!confirmedRelationship.rowCount) throw httpError(409, "La relation de contact n’a pas pu être créée.");
  return confirmedRelationship.rows[0].conversation_id;
}

app.patch("/api/contact-requests/:requestId", requireAuth, async (req, res) => {
  if (req.auth.role !== "parent") return res.status(403).json({ error: "Accès réservé au compte parent." });
  if (!uuidPattern.test(req.params.requestId)) return res.status(404).json({ error: "Demande introuvable." });
  const rawAction = String(req.body?.action ?? "").trim().toLowerCase();
  const action = rawAction === "approve" ? "accept" : rawAction;
  if (!["accept", "decline"].includes(action)) {
    return res.status(400).json({ error: "Choisissez d’accepter ou de refuser la demande." });
  }

  const client = await pool.connect();
  const notifications = [];
  let responsePayload = null;
  try {
    await client.query("begin");
    await repairFamilyChildrenForAccount(req.auth.sub, client);
    const responderMembership = await getParentFamilyMembership(req.auth.sub, client);
    if (!responderMembership) throw httpError(404, "Demande introuvable.");

    const requestResult = await client.query(
      `select request.*,
        requester.display_name as requester_name,requester.contact_id as requester_contact_id,
        requester.role as requester_role,requester.status as requester_status,
        target.display_name as target_name,target.contact_id as target_contact_id,
        target.role as target_role,target.status as target_status,
        requester_child.family_id as requester_child_family_id,
        requester_parent.family_id as requester_parent_family_id,
        target_child.family_id as target_child_family_id,
        target_parent.family_id as target_parent_family_id,
        requested_by.family_id as requested_by_family_id
       from contact_requests request
       join accounts requester on requester.id=request.requester_id
       join accounts target on target.id=request.target_account_id
       left join family_children requester_child on requester_child.child_id=requester.id and requester.role='child'
       left join family_memberships requester_parent on requester_parent.parent_id=requester.id and requester.role='parent'
       left join family_children target_child on target_child.child_id=target.id and target.role='child'
       left join family_memberships target_parent on target_parent.parent_id=target.id and target.role='parent'
       left join family_memberships requested_by on requested_by.parent_id=request.requested_by_parent_id
       where request.id=$1
       for update of request`,
      [req.params.requestId],
    );
    const contactRequest = requestResult.rows[0];
    if (!contactRequest) throw httpError(404, "Demande introuvable.");

    const lockedAccounts = await client.query(
      `select id,status
       from accounts
       where id=any($1::uuid[])
       order by id
       for share`,
      [[contactRequest.requester_id, contactRequest.target_account_id].sort()],
    );
    if (lockedAccounts.rowCount !== 2) throw httpError(404, "Demande introuvable.");
    const childAccountIds = [
      contactRequest.requester_role === "child" ? contactRequest.requester_id : null,
      contactRequest.target_role === "child" ? contactRequest.target_account_id : null,
    ].filter(Boolean).sort();
    const parentAccountIds = [...new Set([
      req.auth.sub,
      contactRequest.requested_by_parent_id,
      contactRequest.requester_role === "parent" ? contactRequest.requester_id : null,
      contactRequest.target_role === "parent" ? contactRequest.target_account_id : null,
    ].filter(Boolean))].sort();
    const [lockedChildFamilies, lockedParentMemberships] = await Promise.all([
      client.query(
        `select child_id,family_id
         from family_children
         where child_id=any($1::uuid[])
         order by child_id
         for share`,
        [childAccountIds],
      ),
      client.query(
        `select parent_id,family_id
         from family_memberships
         where parent_id=any($1::uuid[])
         order by parent_id
         for share`,
        [parentAccountIds],
      ),
    ]);
    const accountStatusById = new Map(lockedAccounts.rows.map((account) => [account.id, account.status]));
    const childFamilyById = new Map(lockedChildFamilies.rows.map((membership) => [membership.child_id, membership.family_id]));
    const parentFamilyById = new Map(lockedParentMemberships.rows.map((membership) => [membership.parent_id, membership.family_id]));
    contactRequest.requester_status = accountStatusById.get(contactRequest.requester_id);
    contactRequest.target_status = accountStatusById.get(contactRequest.target_account_id);
    contactRequest.requester_child_family_id = childFamilyById.get(contactRequest.requester_id) ?? null;
    contactRequest.target_child_family_id = childFamilyById.get(contactRequest.target_account_id) ?? null;
    contactRequest.requester_parent_family_id = parentFamilyById.get(contactRequest.requester_id) ?? null;
    contactRequest.target_parent_family_id = parentFamilyById.get(contactRequest.target_account_id) ?? null;
    contactRequest.requested_by_family_id = parentFamilyById.get(contactRequest.requested_by_parent_id) ?? null;
    const lockedResponderFamilyId = parentFamilyById.get(req.auth.sub);
    const targetFamilyId = contactRequest.target_role === "child"
      ? contactRequest.target_child_family_id
      : contactRequest.target_parent_family_id;
    const canRespond = Boolean(lockedResponderFamilyId) && (
      (contactRequest.target_role === "parent" && contactRequest.target_account_id === req.auth.sub)
      || (contactRequest.target_role === "child" && targetFamilyId === lockedResponderFamilyId)
    );
    if (!canRespond) throw httpError(404, "Demande introuvable.");

    const desiredStatus = action === "accept" ? "approved" : "declined";
    if (contactRequest.status !== "pending") {
      if (contactRequest.status !== desiredStatus) {
        throw httpError(409, "Cette demande a déjà reçu une autre réponse.");
      }
      await client.query("commit");
      return res.json({
        request: {
          id: contactRequest.id,
          status: contactRequest.status,
          conversationId: contactRequest.conversation_id,
          resolvedAt: contactRequest.resolved_at,
        },
      });
    }

    if (action === "decline") {
      const declined = await client.query(
        `update contact_requests
         set status='declined',conversation_id=null,resolved_by=$2,resolved_at=now(),updated_at=now()
         where id=$1
         returning id,status,conversation_id,resolved_at,updated_at`,
        [contactRequest.id, req.auth.sub],
      );
      responsePayload = declined.rows[0];
      notifications.push({
        accountIds: [...new Set([contactRequest.requester_id, contactRequest.requested_by_parent_id])],
        title: "Demande de contact refusée",
        body: `${contactRequest.target_name} n’a pas accepté la demande de contact.`,
      });
    } else {
      if (contactRequest.requester_role !== contactRequest.target_role) {
        throw httpError(409, "Cette ancienne demande doit être recréée depuis le profil concerné.");
      }
      if (
        (contactRequest.requester_role === "child" && contactRequest.requester_status !== "active")
        || (contactRequest.target_role === "child" && contactRequest.target_status !== "active")
      ) {
        throw httpError(409, "Un des profils enfants est actuellement en pause.");
      }

      const requesterFamilyId = contactRequest.requester_role === "child"
        ? contactRequest.requester_child_family_id
        : contactRequest.requester_parent_family_id;
      if (!requesterFamilyId || !targetFamilyId || requesterFamilyId === targetFamilyId) {
        throw httpError(409, "La situation familiale de cette demande a changé.");
      }
      if (contactRequest.requested_by_family_id !== requesterFamilyId) {
        throw httpError(409, "Le parent à l’origine de cette demande n’est plus autorisé.");
      }
      if (contactRequest.requester_role === "parent" && contactRequest.requested_by_parent_id !== contactRequest.requester_id) {
        throw httpError(409, "Cette demande adulte doit être recréée par son auteur.");
      }

      const conversationKind = contactRequest.requester_role === "child" ? "child" : "parent";
      const conversationId = await ensureApprovedContactConversation(
        contactRequest.requester_id,
        contactRequest.target_account_id,
        conversationKind,
        contactRequest.id,
        client,
      );
      const parentConversationId = contactRequest.requester_role === "child"
        ? await ensureApprovedContactConversation(
            contactRequest.requested_by_parent_id,
            req.auth.sub,
            "parent",
            null,
            client,
          )
        : conversationId;

      const approved = await client.query(
        `update contact_requests
         set status='approved',conversation_id=$2,resolved_by=$3,resolved_at=now(),updated_at=now()
         where id=$1
         returning id,status,conversation_id,resolved_at,updated_at`,
        [contactRequest.id, conversationId, req.auth.sub],
      );
      responsePayload = approved.rows[0];
      notifications.push({
        accountIds: [contactRequest.requester_id],
        title: "Contact approuvé",
        body: `${contactRequest.target_name} a accepté la demande. La conversation est disponible.`,
        conversationId,
      });
      if (contactRequest.requester_role === "child") {
        notifications.push({
          accountIds: [contactRequest.requested_by_parent_id],
          title: "Demande de contact approuvée",
          body: `La demande pour ${contactRequest.target_name} est acceptée. Vous pouvez échanger avec le parent qui l’a approuvée.`,
          conversationId: parentConversationId,
        });
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  for (const notification of notifications) {
    try {
      await notifyAccounts(notification.accountIds.filter((accountId) => accountId !== req.auth.sub), {
        title: notification.title,
        body: notification.body,
        notificationType: notification.conversationId ? "message" : "contact-request",
        conversationId: notification.conversationId,
        tag: notification.conversationId
          ? `conversation-${notification.conversationId}`
          : `contact-request-${responsePayload.id}`,
        url: notification.conversationId
          ? `/?notification=message&conversation=${encodeURIComponent(notification.conversationId)}`
          : "/?notification=contact-request",
      });
    } catch (notificationError) {
      console.error("Échec de notification de réponse à une demande de contact", notificationError);
    }
  }
  return res.json({
    request: {
      id: responsePayload.id,
      status: responsePayload.status,
      conversationId: responsePayload.conversation_id,
      resolvedAt: responsePayload.resolved_at,
      updatedAt: responsePayload.updated_at,
    },
  });
});

const emptyConnectFourBoard = () => Array(42).fill(0);
const emptyTicTacToeBoard = () => Array(9).fill(0);
const navalBattleGridSize = 5;
const navalBattleShipLengths = [3, 2, 2];
const supportedGameTypes = new Set(["connect_four", "tic_tac_toe", "naval_battle"]);
const gameNames = {
  connect_four: "Puissance 4",
  tic_tac_toe: "Morpion",
  naval_battle: "Bataille navale",
};

const navalShipCandidates = (length, occupied) => {
  const candidates = [];
  for (let row = 0; row < navalBattleGridSize; row += 1) {
    for (let column = 0; column < navalBattleGridSize; column += 1) {
      if (column + length <= navalBattleGridSize) {
        const horizontal = Array.from(
          { length },
          (_, offset) => row * navalBattleGridSize + column + offset,
        );
        if (horizontal.every((cell) => !occupied.has(cell))) candidates.push(horizontal);
      }
      if (row + length <= navalBattleGridSize) {
        const vertical = Array.from(
          { length },
          (_, offset) => (row + offset) * navalBattleGridSize + column,
        );
        if (vertical.every((cell) => !occupied.has(cell))) candidates.push(vertical);
      }
    }
  }
  return candidates;
};

const generateNavalFleet = () => {
  const occupied = new Set();
  const fleet = [];
  for (const length of navalBattleShipLengths) {
    const candidates = navalShipCandidates(length, occupied);
    if (!candidates.length) throw new Error("Impossible de générer la flotte de bataille navale.");
    const ship = candidates[crypto.randomInt(0, candidates.length)];
    fleet.push(ship);
    ship.forEach((cell) => occupied.add(cell));
  }
  return fleet;
};

const emptyNavalBattleBoard = () => ({
  size: navalBattleGridSize,
  fleets: {
    1: generateNavalFleet(),
    2: generateNavalFleet(),
  },
  shots: {
    1: [],
    2: [],
  },
});

const emptyBoardForGame = (gameType) => {
  if (gameType === "tic_tac_toe") return emptyTicTacToeBoard();
  if (gameType === "naval_battle") return emptyNavalBattleBoard();
  return emptyConnectFourBoard();
};

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

const ticTacToeWinner = (board) => {
  const winningLines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [first, second, third] of winningLines) {
    if (board[first] && board[first] === board[second] && board[first] === board[third]) {
      return board[first];
    }
  }
  return 0;
};

const gameWinner = (gameType, board) => {
  if (gameType === "tic_tac_toe") return ticTacToeWinner(board);
  if (gameType === "connect_four") return connectFourWinner(board);
  return 0;
};

const isValidNavalShip = (ship, expectedLength) => {
  if (!Array.isArray(ship)
    || ship.length !== expectedLength
    || !ship.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < navalBattleGridSize ** 2)
    || new Set(ship).size !== ship.length) return false;
  const sorted = [...ship].sort((first, second) => first - second);
  const sameRow = sorted.every((cell) => Math.floor(cell / navalBattleGridSize) === Math.floor(sorted[0] / navalBattleGridSize));
  const horizontal = sameRow && sorted.every((cell, index) => cell === sorted[0] + index);
  const vertical = sorted.every((cell, index) => cell === sorted[0] + index * navalBattleGridSize);
  return horizontal || vertical;
};

const isValidNavalFleet = (fleet) => {
  if (!Array.isArray(fleet) || fleet.length !== navalBattleShipLengths.length) return false;
  const lengths = fleet.map((ship) => ship?.length).sort((first, second) => second - first);
  const expectedLengths = [...navalBattleShipLengths].sort((first, second) => second - first);
  if (!lengths.every((length, index) => length === expectedLengths[index])) return false;
  if (!fleet.every((ship) => isValidNavalShip(ship, ship.length))) return false;
  const cells = fleet.flat();
  return new Set(cells).size === cells.length;
};

const isValidNavalShots = (shots) => Array.isArray(shots)
  && shots.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < navalBattleGridSize ** 2)
  && new Set(shots).size === shots.length;

const isValidNavalBattleBoard = (board) => Boolean(
  board
  && !Array.isArray(board)
  && board.size === navalBattleGridSize
  && isValidNavalFleet(board.fleets?.["1"])
  && isValidNavalFleet(board.fleets?.["2"])
  && isValidNavalShots(board.shots?.["1"])
  && isValidNavalShots(board.shots?.["2"]),
);

const isValidGameBoard = (gameType, board) => {
  if (gameType === "naval_battle") return isValidNavalBattleBoard(board);
  const expectedLength = gameType === "tic_tac_toe" ? 9 : 42;
  return Array.isArray(board)
    && board.length === expectedLength
    && board.every((cell) => cell === 0 || cell === 1 || cell === 2);
};

const navalShotResults = (shots, targetFleet) => {
  const targetCells = new Set(targetFleet.flat());
  return shots.map((cell) => ({ cell, result: targetCells.has(cell) ? "hit" : "miss" }));
};

const serializeGameForViewer = (game, viewerId) => {
  if (game.game_type !== "naval_battle") return game;
  const viewerNumber = viewerId === game.player_one_id ? 1 : viewerId === game.player_two_id ? 2 : 0;
  if (!viewerNumber || !isValidNavalBattleBoard(game.board)) {
    return { ...game, board: null };
  }
  const opponentNumber = viewerNumber === 1 ? 2 : 1;
  const ownFleet = game.board.fleets[String(viewerNumber)];
  const opponentFleet = game.board.fleets[String(opponentNumber)];
  const ownShots = game.board.shots[String(viewerNumber)];
  const opponentShots = game.board.shots[String(opponentNumber)];
  const incomingShotResults = navalShotResults(opponentShots, ownFleet);
  const shotResults = navalShotResults(ownShots, opponentFleet);
  return {
    ...game,
    board: {
      size: navalBattleGridSize,
      ownFleet: ownFleet.map((cells) => ({
        cells: [...cells],
        hits: cells.filter((cell) => opponentShots.includes(cell)),
      })),
      incomingShots: incomingShotResults,
      shots: shotResults,
      hitsScored: shotResults.filter((shot) => shot.result === "hit").length,
      damageTaken: incomingShotResults.filter((shot) => shot.result === "hit").length,
      fleetSegments: navalBattleShipLengths.reduce((total, length) => total + length, 0),
    },
  };
};

const gameSelect = `select g.*, p1.display_name as player_one_name, p1.contact_id as player_one_contact_id,
  p1.role as player_one_role, p2.display_name as player_two_name, p2.contact_id as player_two_contact_id, p2.role as player_two_role
  from game_sessions g join accounts p1 on p1.id=g.player_one_id join accounts p2 on p2.id=g.player_two_id`;

const currentGameRelationship = `(
  exists(select 1 from contact_relationships relationship
    where relationship.account_one_id=least(g.player_one_id,g.player_two_id)
      and relationship.account_two_id=greatest(g.player_one_id,g.player_two_id))
  or exists(select 1 from family_memberships parent join family_children child using(family_id)
    where (parent.parent_id=g.player_one_id and child.child_id=g.player_two_id)
      or (parent.parent_id=g.player_two_id and child.child_id=g.player_one_id))
  or exists(select 1 from family_memberships mine join family_memberships other using(family_id)
    where mine.parent_id=g.player_one_id and other.parent_id=g.player_two_id)
  or exists(select 1 from family_children mine join family_children other using(family_id)
    where mine.child_id=g.player_one_id and other.child_id=g.player_two_id)
)`;

async function canPlayTogether(accountId, opponentId, executor = pool) {
  const result = await executor.query(`select 1 where
    exists(select 1 from contact_relationships relationship
      where relationship.account_one_id=least($1::uuid,$2::uuid)
        and relationship.account_two_id=greatest($1::uuid,$2::uuid))
    or exists(select 1 from family_memberships parent join family_children child using(family_id)
      where (parent.parent_id=$1 and child.child_id=$2) or (parent.parent_id=$2 and child.child_id=$1))
    or exists(select 1 from family_memberships mine join family_memberships other using(family_id)
      where mine.parent_id=$1 and other.parent_id=$2)
    or exists(select 1 from family_children mine join family_children other using(family_id)
      where mine.child_id=$1 and other.child_id=$2)`, [accountId, opponentId]);
  return Boolean(result.rowCount);
}

app.get("/api/game-contacts", requireAuth, requireActiveChild, async (req, res) => {
  const result = await pool.query(`select distinct account.id,account.role,account.display_name,account.contact_id
    from accounts account where account.id<>$1 and (
      exists(select 1 from contact_relationships relationship
        where relationship.account_one_id=least($1::uuid,account.id)
          and relationship.account_two_id=greatest($1::uuid,account.id))
      or exists(select 1 from family_memberships parent join family_children child using(family_id)
        where (parent.parent_id=$1 and child.child_id=account.id) or (parent.parent_id=account.id and child.child_id=$1))
      or exists(select 1 from family_memberships mine join family_memberships other using(family_id)
        where mine.parent_id=$1 and other.parent_id=account.id)
      or exists(select 1 from family_children mine join family_children other using(family_id)
        where mine.child_id=$1 and other.child_id=account.id)
    ) order by account.role desc,account.display_name`, [req.auth.sub]);
  res.json({ contacts: result.rows.map((row) => ({ id: row.id, role: row.role, name: row.display_name, contactId: row.contact_id })) });
});

app.get("/api/games", requireAuth, requireActiveChild, async (req, res) => {
  const participantFilter = "(g.player_one_id=$1 or g.player_two_id=$1)";
  const [openGames, recentGames] = await Promise.all([
    pool.query(
      `${gameSelect} where ${participantFilter} and g.status in ('pending','active')
       and ${currentGameRelationship} order by g.updated_at desc`,
      [req.auth.sub],
    ),
    pool.query(
      `${gameSelect} where ${participantFilter} and g.status in ('declined','completed')
       and ${currentGameRelationship} order by g.updated_at desc limit 20`,
      [req.auth.sub],
    ),
  ]);
  res.json({ games: [...openGames.rows, ...recentGames.rows].map((game) => serializeGameForViewer(game, req.auth.sub)) });
});

app.post("/api/games", requireAuth, requireActiveChild, async (req, res) => {
  const contactId = String(req.body?.contactId ?? "").trim().toUpperCase();
  const gameType = String(req.body?.gameType ?? "connect_four").trim().toLowerCase();
  if (!supportedGameTypes.has(gameType)) return res.status(400).json({ error: "Type de jeu invalide." });
  const client = await pool.connect();
  let opponent;
  let game;
  let inviterName = "Un ami";
  try {
    await client.query("begin");
    const opponentResult = await client.query("select id,role from accounts where contact_id=$1", [contactId]);
    opponent = opponentResult.rows[0];
    if (!opponent || opponent.id === req.auth.sub) throw httpError(404, "Contact introuvable.");
    await assertAccountsActive([req.auth.sub, opponent.id], client, true);
    if (!await canPlayTogether(req.auth.sub, opponent.id, client)) {
      throw httpError(403, "Ce contact doit appartenir à votre famille ou être approuvé avant de jouer.");
    }
    const result = await client.query(`insert into game_sessions(game_type,player_one_id,player_two_id,invited_by,board)
      values($1,$2,$3,$2,$4::jsonb) returning id`, [gameType, req.auth.sub, opponent.id, JSON.stringify(emptyBoardForGame(gameType))]);
    game = await client.query(`${gameSelect} where g.id=$1`, [result.rows[0].id]);
    const inviter = await client.query("select display_name from accounts where id=$1", [req.auth.sub]);
    inviterName = inviter.rows[0]?.display_name || "Un ami";
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  await notifyAccounts([opponent.id], {
    title: "Invitation à jouer",
    body: `${inviterName} t’invite pour une partie de ${gameNames[gameType]}.`,
    notificationType: "game",
    tag: `game-${game.rows[0].id}`,
    url: "/?notification=game",
  });
  res.status(201).json({ game: serializeGameForViewer(game.rows[0], req.auth.sub) });
});

app.patch("/api/games/:gameId", requireAuth, async (req, res) => {
  const action = req.body?.action;
  if (!["accept", "decline"].includes(action)) return res.status(400).json({ error: "Action de partie invalide." });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const gameResult = await client.query(
      "select * from game_sessions where id=$1 and player_two_id=$2 for update",
      [req.params.gameId, req.auth.sub],
    );
    const game = gameResult.rows[0];
    if (!game || game.status !== "pending") {
      await client.query("rollback");
      return res.status(409).json({ error: "Cette invitation n’est plus disponible." });
    }
    if (action === "accept") {
      await assertAccountsActive([game.player_one_id, game.player_two_id], client, true);
    }
    if (!await canPlayTogether(game.player_one_id, game.player_two_id, client)) {
      await client.query("rollback");
      return res.status(403).json({ error: "Cette invitation n’est plus autorisée." });
    }
    const status = action === "accept" ? "active" : "declined";
    const currentPlayerId = action === "accept" ? game.player_one_id : null;
    await client.query(
      "update game_sessions set status=$1,current_player_id=$2,updated_at=now() where id=$3",
      [status, currentPlayerId, game.id],
    );
    const updated = await client.query(`${gameSelect} where g.id=$1`, [game.id]);
    await client.query("commit");
    return res.json({ game: serializeGameForViewer(updated.rows[0], req.auth.sub) });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

app.post("/api/games/:gameId/moves", requireAuth, async (req, res) => {
  const client = await pool.connect();
  let nextPlayerId = null;
  let gameType = null;
  let playerName = "Un ami";
  let committed = false;
  try {
    await client.query("begin");
    const result = await client.query("select * from game_sessions where id=$1 for update", [req.params.gameId]);
    const game = result.rows[0];
    if (!game || ![game.player_one_id, game.player_two_id].includes(req.auth.sub)) { await client.query("rollback"); return res.status(404).json({ error: "Partie introuvable." }); }
    if (game.status !== "active" || game.current_player_id !== req.auth.sub) { await client.query("rollback"); return res.status(409).json({ error: "Ce n’est pas votre tour." }); }
    await assertAccountsActive([game.player_one_id, game.player_two_id], client, true);
    if (!await canPlayTogether(game.player_one_id, game.player_two_id, client)) {
      await client.query("rollback");
      return res.status(403).json({ error: "Cette partie n’est plus autorisée." });
    }
    if (!supportedGameTypes.has(game.game_type) || !isValidGameBoard(game.game_type, game.board)) {
      await client.query("rollback");
      return res.status(409).json({ error: "L’état de cette partie est invalide." });
    }

    gameType = game.game_type;
    const move = req.body?.move ?? (gameType === "connect_four" ? req.body?.column : undefined);
    const maximumMove = gameType === "naval_battle" ? 24 : gameType === "tic_tac_toe" ? 8 : 6;
    if (!Number.isInteger(move) || move < 0 || move > maximumMove) {
      await client.query("rollback");
      return res.status(400).json({ error: gameType === "connect_four" ? "Colonne invalide." : "Case invalide." });
    }

    const board = gameType === "naval_battle"
      ? {
        ...game.board,
        fleets: {
          1: game.board.fleets["1"].map((ship) => [...ship]),
          2: game.board.fleets["2"].map((ship) => [...ship]),
        },
        shots: {
          1: [...game.board.shots["1"]],
          2: [...game.board.shots["2"]],
        },
      }
      : [...game.board];
    let targetIndex = move;
    if (gameType === "connect_four") {
      targetIndex = -1;
      for (let row = 5; row >= 0; row -= 1) {
        if (!board[row * 7 + move]) {
          targetIndex = row * 7 + move;
          break;
        }
      }
      if (targetIndex < 0) {
        await client.query("rollback");
        return res.status(409).json({ error: "Cette colonne est pleine." });
      }
    } else if (gameType === "tic_tac_toe" && board[targetIndex]) {
      await client.query("rollback");
      return res.status(409).json({ error: "Cette case est déjà occupée." });
    }

    const playerValue = req.auth.sub === game.player_one_id ? 1 : 2;
    let winnerId = null;
    let status = "active";
    if (gameType === "naval_battle") {
      const navalBoard = board;
      const playerShots = navalBoard.shots[String(playerValue)];
      if (playerShots.includes(move)) {
        await client.query("rollback");
        return res.status(409).json({ error: "Vous avez déjà visé cette case." });
      }
      playerShots.push(move);
      const opponentValue = playerValue === 1 ? 2 : 1;
      const opponentFleetCells = navalBoard.fleets[String(opponentValue)].flat();
      if (opponentFleetCells.every((cell) => playerShots.includes(cell))) {
        winnerId = req.auth.sub;
        status = "completed";
      }
    } else {
      board[targetIndex] = playerValue;
      const winnerValue = gameWinner(gameType, board);
      const isDraw = !winnerValue && board.every(Boolean);
      winnerId = winnerValue === 1 ? game.player_one_id : winnerValue === 2 ? game.player_two_id : null;
      status = winnerValue || isDraw ? "completed" : "active";
    }
    nextPlayerId = status === "active" ? (req.auth.sub === game.player_one_id ? game.player_two_id : game.player_one_id) : null;
    const player = await client.query("select display_name from accounts where id=$1", [req.auth.sub]);
    playerName = player.rows[0]?.display_name || "Un ami";
    await client.query("update game_sessions set board=$1::jsonb,status=$2,current_player_id=$3,winner_id=$4,updated_at=now() where id=$5", [JSON.stringify(board), status, nextPlayerId, winnerId, game.id]);
    await client.query("commit");
    committed = true;
    const updated = await pool.query(`${gameSelect} where g.id=$1`, [game.id]);
    if (nextPlayerId) {
      await notifyAccounts([nextPlayerId], {
        title: "À toi de jouer",
        body: `${playerName} vient de jouer dans votre partie de ${gameNames[gameType]}.`,
        notificationType: "game",
        tag: `game-${game.id}`,
        url: "/?notification=game",
      });
    }
    res.json({ game: serializeGameForViewer(updated.rows[0], req.auth.sub) });
  } catch (error) {
    if (!committed) await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

async function isConversationMember(accountId, conversationId, executor = pool) {
  const result = await executor.query(
    `select 1 from conversation_members member
     where member.account_id=$1 and member.conversation_id=$2
       and (
         not exists(select 1 from family_parent_conversations family_parent where family_parent.conversation_id=member.conversation_id)
         or exists(
           select 1 from family_parent_conversations family_parent
           join family_memberships active_membership on active_membership.family_id=family_parent.family_id and active_membership.parent_id=$1
           where family_parent.conversation_id=member.conversation_id
             and $1 in (family_parent.parent_one_id,family_parent.parent_two_id)
         )
       )`,
    [accountId, conversationId],
  );
  return result.rowCount === 1;
}

const callSelect = `
  select call.*,
    caller.display_name as caller_name,caller.contact_id as caller_contact_id,caller.role as caller_role,
    callee.display_name as callee_name,callee.contact_id as callee_contact_id,callee.role as callee_role
  from call_sessions call
  join accounts caller on caller.id=call.caller_id
  join accounts callee on callee.id=call.callee_id`;

const terminalCallStatuses = new Set(["declined", "cancelled", "ended", "missed"]);

function serializeCall(call, viewerId) {
  const outgoing = call.caller_id === viewerId;
  return {
    id: call.id,
    conversationId: call.conversation_id,
    callType: call.call_type,
    status: call.status,
    direction: outgoing ? "outgoing" : "incoming",
    peer: {
      name: outgoing ? call.callee_name : call.caller_name,
      contactId: outgoing ? call.callee_contact_id : call.caller_contact_id,
      role: outgoing ? call.callee_role : call.caller_role,
    },
    expiresAt: call.expires_at,
    answeredAt: call.answered_at,
    endedAt: call.ended_at,
    createdAt: call.created_at,
    updatedAt: call.updated_at,
  };
}

function requestPublicOrigin(req) {
  const configuredOrigin = String(process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "").trim();
  if (process.env.NODE_ENV === "production" && !configuredOrigin) {
    throw httpError(503, "PUBLIC_APP_URL doit être configurée en production.");
  }
  const candidate = configuredOrigin || `${req.protocol}://${req.get("host")}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocole invalide");
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error("HTTPS requis");
    }
    return url.origin;
  } catch {
    throw httpError(503, "L’URL publique du service n’est pas configurée.");
  }
}

function nativeCallActionUrls(req, callId) {
  const origin = requestPublicOrigin(req);
  const encodedCallId = encodeURIComponent(callId);
  const respondUrl = `${origin}/api/native/calls/${encodedCallId}/respond`;
  return {
    callActionUrl: respondUrl,
    respondUrl,
    acceptUrl: `${respondUrl}/accept`,
    declineUrl: `${respondUrl}/decline`,
    hangupUrl: `${respondUrl}/hangup`,
    statusUrl: `${origin}/api/native/calls/${encodedCallId}/status`,
  };
}

function readNativeCallActionToken(req) {
  const token = String(
    req.get("x-call-action-token")
    || req.body?.actionToken
    || "",
  ).trim();
  return /^nca_[A-Za-z0-9_-]{40,100}$/.test(token) ? token : "";
}

function serializeNativeCallStatus(call) {
  return {
    id: call.id,
    conversationId: call.conversation_id,
    callType: call.call_type,
    status: call.status,
    expiresAt: call.expires_at,
    answeredAt: call.answered_at,
    endedAt: call.ended_at,
    updatedAt: call.updated_at,
  };
}

async function notifyNativeCallState(call) {
  if (!call) return 0;
  return notifyNativeAccounts([call.caller_id, call.callee_id], {
    notificationType: "call-state",
    callId: call.id,
    conversationId: call.conversation_id,
    callType: call.call_type,
    status: call.status,
    expiresAt: new Date(call.expires_at).toISOString(),
  });
}

async function expireStaleCalls(executor = pool) {
  const result = await executor.query(
    `update call_sessions
     set status='missed',ended_at=coalesce(ended_at,now()),updated_at=now()
     where status='ringing' and expires_at<=now()
     returning id,conversation_id,caller_id,callee_id,call_type,status,expires_at,answered_at,ended_at,updated_at`,
  );
  if (executor === pool) {
    await Promise.allSettled(result.rows.map((call) => notifyNativeCallState(call)));
  }
  return result.rows;
}

async function getCallRow(callId, executor = pool, lock = false) {
  const result = await executor.query(
    `${callSelect} where call.id=$1 ${lock ? "for update of call" : ""}`,
    [callId],
  );
  return result.rows[0] ?? null;
}

function callPolicyForAccount(account, channel) {
  if (account.role !== "child") return { allowed: true };
  return evaluateChildPolicy(normalizePolicyChild(account), {
    channel,
    timeZone: parentalTimeZone,
  });
}

function validateCallSignal(signalType, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (JSON.stringify(payload).length > 262144) return false;
  if (signalType === "offer" || signalType === "answer") {
    return payload.type === signalType
      && typeof payload.sdp === "string"
      && payload.sdp.length > 0
      && payload.sdp.length <= 200000;
  }
  return signalType === "ice"
    && typeof payload.candidate === "string"
    && payload.candidate.length > 0
    && payload.candidate.length <= 8192;
}

function requireRtcFeature(_req, res, next) {
  if (!productionFeatures.rtc) {
    return res.status(503).json({ error: "Les appels audio et vidéo ne sont pas activés." });
  }
  return next();
}

app.use("/api/calls", requireRtcFeature);
app.use("/api/conversations/:id/calls", requireRtcFeature);
app.use("/api/native/calls", requireRtcFeature);

app.get("/api/calls", requireAuth, requireActiveChild, async (req, res) => {
  await expireStaleCalls();
  const result = await pool.query(
    `${callSelect}
     where $1 in (call.caller_id,call.callee_id)
       and (
         call.status in ('ringing','accepted')
         or call.updated_at>now()-interval '2 minutes'
       )
     order by call.updated_at desc
     limit 20`,
    [req.auth.sub],
  );
  res.json({
    calls: result.rows.map((call) => serializeCall(call, req.auth.sub)),
    iceServers: await getRtcIceServers(),
    callTimeoutSeconds,
  });
});

app.post("/api/conversations/:id/calls", requireAuth, requireActiveChild, async (req, res) => {
  const callType = String(req.body?.callType ?? "");
  if (!["audio", "video"].includes(callType)) return res.status(400).json({ error: "Type d’appel invalide." });
  if (!await isConversationMember(req.auth.sub, req.params.id)) return res.status(403).json({ error: "Conversation non autorisée." });

  const client = await pool.connect();
  let createdCall = null;
  let callActionToken = "";
  let actionUrls = null;
  let expiredCalls = [];
  try {
    await client.query("begin");
    expiredCalls = await expireStaleCalls(client);
    const participantsResult = await client.query(
      `select account.id,account.role,account.display_name,account.contact_id,account.status,
        account.safety_settings,account.communication_schedule
       from conversation_members member
       join accounts account on account.id=member.account_id
       where member.conversation_id=$1
       order by account.id
       for no key update of account`,
      [req.params.id],
    );
    if (participantsResult.rowCount !== 2) throw httpError(409, "Cette conversation ne permet pas un appel privé à deux.");
    const caller = participantsResult.rows.find((account) => account.id === req.auth.sub);
    const callee = participantsResult.rows.find((account) => account.id !== req.auth.sub);
    if (!caller || !callee) throw httpError(403, "Conversation non autorisée.");

    const channel = callType === "video" ? "video" : "calls";
    const callerPolicy = callPolicyForAccount(caller, channel);
    if (!callerPolicy.allowed) throw httpError(403, callerPolicy.reason);
    const calleePolicy = callPolicyForAccount(callee, channel);
    if (!calleePolicy.allowed) {
      const schedule = normalizePolicyChild(callee).communication_schedule;
      const shouldReply = schedule.autoReply?.enabled !== false && Boolean(neutralCallReply);
      if (shouldReply) {
        await insertEncryptedAutomaticMessage(
          client,
          req.params.id,
          callee.id,
          neutralCallReply,
        );
      }
      await client.query("commit");
      await Promise.allSettled(expiredCalls.map((expiredCall) => notifyNativeCallState(expiredCall)));
      if (shouldReply) {
        await notifyAccounts([caller.id], {
          title: callee.display_name,
          body: neutralCallReply,
          notificationType: "message",
          conversationId: req.params.id,
          tag: `conversation-${req.params.id}`,
          url: `/?notification=message&conversation=${encodeURIComponent(req.params.id)}`,
        });
      }
      return res.status(409).json({ error: calleePolicy.reason, autoReplySent: shouldReply });
    }

    const participantIds = [caller.id, callee.id].sort();
    await client.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", participantIds);
    const openCall = await client.query(
      `select id from call_sessions
       where status in ('ringing','accepted')
         and (caller_id=any($1::uuid[]) or callee_id=any($1::uuid[]))
       limit 1`,
      [participantIds],
    );
    if (openCall.rowCount) throw httpError(409, "Un appel est déjà en cours pour l’un des participants.");

    const inserted = await client.query(
      `insert into call_sessions(conversation_id,caller_id,callee_id,call_type,expires_at)
       values($1,$2,$3,$4,now()+$5*interval '1 second')
       returning id`,
      [req.params.id, caller.id, callee.id, callType, callTimeoutSeconds],
    );
    createdCall = await getCallRow(inserted.rows[0].id, client);
    callActionToken = createOpaqueCallActionToken();
    actionUrls = nativeCallActionUrls(req, createdCall.id);
    await client.query(
      `insert into native_call_action_tokens(
         call_id,account_id,token_hash,expires_at,control_expires_at
       )
       values($1,$2,$3,$4,now()+interval '2 hours')`,
      [
        createdCall.id,
        callee.id,
        hashCallActionToken(callActionToken),
        createdCall.expires_at,
      ],
    );
    await client.query("commit");

    await Promise.allSettled(expiredCalls.map((expiredCall) => notifyNativeCallState(expiredCall)));
    await notifyAccounts([callee.id], {
      title: `${caller.display_name} vous appelle`,
      body: callType === "video" ? "Appel vidéo entrant" : "Appel audio entrant",
      notificationType: "incoming-call",
      conversationId: req.params.id,
      callId: createdCall.id,
      callType,
      callerName: caller.display_name,
      expiresAt: new Date(createdCall.expires_at).toISOString(),
      callActionToken,
      ...actionUrls,
      tag: `call-${createdCall.id}`,
      url: `/?notification=call&call=${encodeURIComponent(createdCall.id)}`,
    });
    return res.status(201).json({
      call: serializeCall(createdCall, req.auth.sub),
      iceServers: await getRtcIceServers(),
      callTimeoutSeconds,
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/native/calls/:callId/status", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!uuidPattern.test(req.params.callId)) return res.status(404).json({ error: "Appel introuvable." });
  const actionToken = readNativeCallActionToken(req);
  if (!actionToken) return res.status(401).json({ error: "Jeton d’action requis." });
  await expireStaleCalls();
  const result = await pool.query(
    `select call.id,call.conversation_id,call.caller_id,call.callee_id,call.call_type,
       call.status,call.expires_at,call.answered_at,call.ended_at,call.updated_at,
       action.control_expires_at
     from native_call_action_tokens action
     join call_sessions call on call.id=action.call_id
     where action.call_id=$1 and action.token_hash=$2`,
    [req.params.callId, hashCallActionToken(actionToken)],
  );
  const call = result.rows[0];
  if (!call) return res.status(404).json({ error: "Appel introuvable." });
  if (new Date(call.control_expires_at).getTime() <= Date.now()) {
    return res.status(410).json({ error: "Le contrôle natif de cet appel a expiré." });
  }
  res.json({ call: serializeNativeCallStatus(call), serverTime: new Date().toISOString() });
});

async function respondToNativeCall(req, res) {
  res.set("Cache-Control", "no-store");
  const action = String(req.params.nativeAction || req.body?.action || "").trim();
  if (!["accept", "decline", "hangup"].includes(action)) return res.status(400).json({ error: "Action d’appel native invalide." });
  if (!uuidPattern.test(req.params.callId)) return res.status(404).json({ error: "Appel introuvable." });
  const actionToken = readNativeCallActionToken(req);
  if (!actionToken) return res.status(401).json({ error: "Jeton d’action requis." });

  const client = await pool.connect();
  let committed = false;
  let call = null;
  let idempotent = false;
  let stateChanged = false;
  let sendDeclineMessageNotification = false;
  let expiredWhileRinging = false;
  try {
    await client.query("begin");
    const actionResult = await client.query(
      `select call_id,account_id,expires_at,control_expires_at,accepted_at,
         consumed_action,consumed_at
       from native_call_action_tokens
       where call_id=$1 and token_hash=$2
       for update`,
      [req.params.callId, hashCallActionToken(actionToken)],
    );
    const actionGrant = actionResult.rows[0];
    if (!actionGrant) throw httpError(404, "Appel introuvable.");
    if (new Date(actionGrant.control_expires_at).getTime() <= Date.now()) {
      throw httpError(410, "Le contrôle natif de cet appel a expiré.");
    }

    call = await getCallRow(req.params.callId, client);
    if (!call || call.callee_id !== actionGrant.account_id) throw httpError(404, "Appel introuvable.");
    if (action === "accept"
      && call.status === "ringing"
      && new Date(call.expires_at).getTime() > Date.now()) {
      await assertConversationPolicy(
        call.conversation_id,
        { channel: call.call_type === "video" ? "video" : "calls" },
        client,
        true,
      );
    }
    call = await getCallRow(req.params.callId, client, true);
    if (!call || call.callee_id !== actionGrant.account_id) throw httpError(404, "Appel introuvable.");

    if (actionGrant.consumed_action) {
      const replayMatches = actionGrant.consumed_action === action
        && ((action === "decline" && call.status === "declined") || (action === "hangup" && call.status === "ended"));
      if (!replayMatches) throw httpError(409, "Ce jeton d’appel a déjà été consommé.");
      idempotent = true;
    } else if (action === "accept") {
      if (call.status === "accepted") {
        idempotent = true;
        await client.query(
          "update native_call_action_tokens set accepted_at=coalesce(accepted_at,now()) where call_id=$1",
          [call.id],
        );
      } else if (call.status !== "ringing") {
        throw httpError(409, "Cet appel ne peut plus être accepté.");
      } else if (new Date(call.expires_at).getTime() <= Date.now()) {
        await client.query(
          "update call_sessions set status='missed',ended_at=now(),updated_at=now() where id=$1",
          [call.id],
        );
        call = await getCallRow(call.id, client);
        expiredWhileRinging = true;
        stateChanged = true;
      } else {
        await client.query(
          "update call_sessions set status='accepted',answered_at=now(),updated_at=now() where id=$1",
          [call.id],
        );
        await client.query(
          "update native_call_action_tokens set accepted_at=coalesce(accepted_at,now()) where call_id=$1",
          [call.id],
        );
        call = await getCallRow(call.id, client);
        stateChanged = true;
      }
    } else if (action === "decline") {
      if (call.status === "declined") {
        idempotent = true;
        await client.query(
          `update native_call_action_tokens
           set consumed_action='decline',consumed_at=coalesce(consumed_at,now())
           where call_id=$1`,
          [call.id],
        );
      } else if (call.status !== "ringing") {
        throw httpError(409, "Cet appel ne peut plus être refusé.");
      } else if (new Date(call.expires_at).getTime() <= Date.now()) {
        await client.query(
          "update call_sessions set status='missed',ended_at=now(),updated_at=now() where id=$1",
          [call.id],
        );
        call = await getCallRow(call.id, client);
        expiredWhileRinging = true;
        stateChanged = true;
      } else {
        await client.query(
          "update call_sessions set status='declined',ended_at=now(),updated_at=now() where id=$1",
          [call.id],
        );
        await insertEncryptedAutomaticMessage(
          client,
          call.conversation_id,
          call.callee_id,
          neutralCallReply,
        );
        await client.query(
          `update native_call_action_tokens
           set consumed_action='decline',consumed_at=now()
           where call_id=$1`,
          [call.id],
        );
        call = await getCallRow(call.id, client);
        stateChanged = true;
        sendDeclineMessageNotification = true;
      }
    } else if (call.status === "ended") {
      idempotent = true;
      await client.query(
        `update native_call_action_tokens
         set accepted_at=coalesce(accepted_at,call_session.answered_at,now()),
             consumed_action='hangup',
             consumed_at=coalesce(consumed_at,now())
         from call_sessions call_session
         where native_call_action_tokens.call_id=call_session.id
           and native_call_action_tokens.call_id=$1`,
        [call.id],
      );
    } else if (call.status !== "accepted") {
      throw httpError(409, "Seul un appel accepté peut être raccroché depuis l’interface native.");
    } else {
      await client.query(
        "update call_sessions set status='ended',ended_at=now(),updated_at=now() where id=$1",
        [call.id],
      );
      await client.query(
        `update native_call_action_tokens
         set accepted_at=coalesce(accepted_at,now()),consumed_action='hangup',consumed_at=now()
         where call_id=$1`,
        [call.id],
      );
      call = await getCallRow(call.id, client);
      stateChanged = true;
    }

    await client.query("commit");
    committed = true;
  } catch (error) {
    if (!committed) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (stateChanged) await Promise.allSettled([notifyNativeCallState(call)]);
  if (sendDeclineMessageNotification) {
    await notifyAccounts([call.caller_id], {
      title: "Appel refusé",
      body: neutralCallReply,
      notificationType: "message",
      conversationId: call.conversation_id,
      tag: `conversation-${call.conversation_id}`,
      url: `/?notification=message&conversation=${encodeURIComponent(call.conversation_id)}`,
    });
  }
  if (expiredWhileRinging) {
    return res.status(409).json({ error: "Cet appel a expiré.", call: serializeNativeCallStatus(call) });
  }
  return res.json({ call: serializeNativeCallStatus(call), idempotent });
}

app.post("/api/native/calls/:callId/respond", respondToNativeCall);
app.post("/api/native/calls/:callId/respond/:nativeAction", respondToNativeCall);

app.get("/api/calls/:callId", requireAuth, requireActiveChild, async (req, res) => {
  await expireStaleCalls();
  const call = await getCallRow(req.params.callId);
  if (!call) return res.status(404).json({ error: "Appel introuvable." });
  if (![call.caller_id, call.callee_id].includes(req.auth.sub)) return res.status(403).json({ error: "Appel non autorisé." });
  const rawAfterSignal = String(req.query.afterSignal ?? "0");
  const afterSignal = /^\d+$/.test(rawAfterSignal) ? rawAfterSignal : "0";
  const signals = await pool.query(
    `select
       id,encryption_context_id,call_id,sender_id,recipient_id,signal_type,
       payload,payload_ciphertext,content_encryption_version,
       content_encryption_key_id,created_at
     from call_signals
     where call_id=$1 and recipient_id=$2 and id>$3::bigint
     order by id
     limit 200`,
    [call.id, req.auth.sub, afterSignal],
  );
  res.json({
    call: serializeCall(call, req.auth.sub),
    signals: signals.rows.map((signal) => {
      const decrypted = decryptCallSignal(signal);
      return {
        id: signal.id,
        signalType: signal.signal_type,
        payload: decrypted.payload,
        createdAt: signal.created_at,
      };
    }),
    iceServers: await getRtcIceServers(),
    callTimeoutSeconds,
  });
});

app.post("/api/calls/:callId/signals", requireAuth, requireActiveChild, async (req, res) => {
  const signalType = String(req.body?.signalType ?? "");
  const payload = req.body?.payload;
  if (!["offer", "answer", "ice"].includes(signalType) || !validateCallSignal(signalType, payload)) {
    return res.status(400).json({ error: "Signal WebRTC invalide." });
  }
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("begin");
    let call = await getCallRow(req.params.callId, client);
    if (!call) throw httpError(404, "Appel introuvable.");
    if (![call.caller_id, call.callee_id].includes(req.auth.sub)) throw httpError(403, "Appel non autorisé.");
    if (terminalCallStatuses.has(call.status)) throw httpError(409, "Cet appel est terminé.");
    if (signalType === "offer" && req.auth.sub !== call.caller_id) throw httpError(403, "Seul l’appelant peut envoyer l’offre.");
    if (signalType === "answer" && req.auth.sub !== call.callee_id) throw httpError(403, "Seul le destinataire peut répondre à l’offre.");
    if (signalType === "answer" && call.status !== "accepted") throw httpError(409, "L’appel doit être accepté avant la réponse WebRTC.");

    await assertConversationPolicy(
      call.conversation_id,
      { channel: call.call_type === "video" ? "video" : "calls" },
      client,
      true,
    );

    call = await getCallRow(req.params.callId, client, true);
    if (!call) throw httpError(404, "Appel introuvable.");
    if (![call.caller_id, call.callee_id].includes(req.auth.sub)) throw httpError(403, "Appel non autorisé.");
    if (terminalCallStatuses.has(call.status)) throw httpError(409, "Cet appel est terminé.");
    if (signalType === "offer" && req.auth.sub !== call.caller_id) throw httpError(403, "Seul l’appelant peut envoyer l’offre.");
    if (signalType === "answer" && req.auth.sub !== call.callee_id) throw httpError(403, "Seul le destinataire peut répondre à l’offre.");
    if (signalType === "answer" && call.status !== "accepted") throw httpError(409, "L’appel doit être accepté avant la réponse WebRTC.");

    const recipientId = req.auth.sub === call.caller_id ? call.callee_id : call.caller_id;
    const encryptionContextId = crypto.randomUUID();
    const encryptedSignal = encryptCallSignal({
      contextId: encryptionContextId,
      callId: call.id,
      senderId: req.auth.sub,
      recipientId,
      signalType,
      payload,
    });
    const result = await client.query(
      `insert into call_signals(
         encryption_context_id,call_id,sender_id,recipient_id,signal_type,
         payload_ciphertext,content_encryption_version,content_encryption_key_id
       )
       values($1,$2,$3,$4,$5,$6,$7,$8)
       returning id,created_at`,
      [
        encryptionContextId,
        call.id,
        req.auth.sub,
        recipientId,
        signalType,
        encryptedSignal.payloadCiphertext,
        encryptedSignal.encryptionVersion,
        encryptedSignal.encryptionKeyId,
      ],
    );
    await client.query("commit");
    committed = true;
    return res.status(201).json({
      signal: {
        id: result.rows[0].id,
        signalType,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    if (!committed) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});

app.patch("/api/calls/:callId", requireAuth, async (req, res) => {
  const action = String(req.body?.action ?? "");
  if (!["accept", "decline", "cancel", "hangup"].includes(action)) return res.status(400).json({ error: "Action d’appel invalide." });
  const client = await pool.connect();
  let notify = null;
  try {
    await client.query("begin");
    let call = await getCallRow(req.params.callId, client);
    if (!call) throw httpError(404, "Appel introuvable.");
    if (![call.caller_id, call.callee_id].includes(req.auth.sub)) throw httpError(403, "Appel non autorisé.");
    if (action === "accept"
      && call.status === "ringing"
      && new Date(call.expires_at).getTime() > Date.now()) {
      await assertConversationPolicy(
        call.conversation_id,
        { channel: call.call_type === "video" ? "video" : "calls" },
        client,
        true,
      );
    }
    call = await getCallRow(req.params.callId, client, true);
    if (!call) throw httpError(404, "Appel introuvable.");
    if (![call.caller_id, call.callee_id].includes(req.auth.sub)) throw httpError(403, "Appel non autorisé.");
    if (call.status === "ringing" && new Date(call.expires_at).getTime() <= Date.now()) {
      await client.query(
        "update call_sessions set status='missed',ended_at=now(),updated_at=now() where id=$1",
        [call.id],
      );
      call = await getCallRow(call.id, client);
      await client.query("commit");
      await Promise.allSettled([notifyNativeCallState(call)]);
      return res.status(409).json({ error: "Cet appel a expiré.", call: serializeCall(call, req.auth.sub) });
    }

    if (action === "accept") {
      if (req.auth.sub !== call.callee_id || call.status !== "ringing") throw httpError(409, "Cet appel ne peut plus être accepté.");
      await client.query(
        "update call_sessions set status='accepted',answered_at=now(),updated_at=now() where id=$1",
        [call.id],
      );
    } else if (action === "decline") {
      if (req.auth.sub !== call.callee_id || call.status !== "ringing") throw httpError(409, "Cet appel ne peut plus être refusé.");
      await client.query(
        "update call_sessions set status='declined',ended_at=now(),updated_at=now() where id=$1",
        [call.id],
      );
      await insertEncryptedAutomaticMessage(
        client,
        call.conversation_id,
        call.callee_id,
        neutralCallReply,
      );
      notify = {
        accountId: call.caller_id,
        title: "Appel refusé",
        body: neutralCallReply,
        conversationId: call.conversation_id,
      };
    } else if (action === "cancel") {
      if (req.auth.sub !== call.caller_id || call.status !== "ringing") throw httpError(409, "Cet appel ne peut plus être annulé.");
      await client.query(
        "update call_sessions set status='cancelled',ended_at=now(),updated_at=now() where id=$1",
        [call.id],
      );
    } else {
      if (!["ringing", "accepted"].includes(call.status)) throw httpError(409, "Cet appel est déjà terminé.");
      const status = call.status === "ringing" ? "cancelled" : "ended";
      await client.query(
        "update call_sessions set status=$2,ended_at=now(),updated_at=now() where id=$1",
        [call.id, status],
      );
    }

    call = await getCallRow(call.id, client);
    await client.query("commit");
    await Promise.allSettled([notifyNativeCallState(call)]);
    if (notify) {
      await notifyAccounts([notify.accountId], {
        title: notify.title,
        body: notify.body,
        notificationType: "message",
        conversationId: notify.conversationId,
        tag: `conversation-${notify.conversationId}`,
        url: `/?notification=message&conversation=${encodeURIComponent(notify.conversationId)}`,
      });
    }
    res.json({ call: serializeCall(call, req.auth.sub), iceServers: await getRtcIceServers() });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});

async function requireConversationMessagingAccess(req, res, next) {
  try {
    if (!await isConversationMember(req.auth.sub, req.params.id)) {
      return res.status(403).json({ error: "Conversation non autorisée." });
    }
    req.conversationChildPolicies = await assertConversationPolicy(req.params.id, { channel: "messages" });
    return next();
  } catch (error) {
    return next(error);
  }
}

app.get("/api/conversations/:id/typing", requireAuth, requireActiveChild, async (req, res) => {
  if (!await isConversationMember(req.auth.sub, req.params.id)) return res.status(403).json({ error: "Conversation non autorisée." });
  await pool.query("delete from typing_states where conversation_id=$1 and expires_at<=now()", [req.params.id]);
  const result = await pool.query(`select a.display_name from typing_states t join accounts a on a.id=t.account_id
    where t.conversation_id=$1 and t.account_id<>$2 and t.expires_at>now() limit 1`, [req.params.id, req.auth.sub]);
  res.json({ typing: Boolean(result.rowCount), name: result.rows[0]?.display_name ?? null });
});

app.post("/api/conversations/:id/typing", requireAuth, requireActiveChild, requireConversationMessagingAccess, async (req, res) => {
  if (req.body?.active === true) {
    await pool.query(`insert into typing_states(conversation_id,account_id,expires_at)
      values($1,$2,now()+$3*interval '1 second')
      on conflict(conversation_id,account_id) do update set expires_at=excluded.expires_at`,
    [req.params.id, req.auth.sub, retentionPolicy.typingStateSeconds]);
  } else {
    await pool.query("delete from typing_states where conversation_id=$1 and account_id=$2", [req.params.id, req.auth.sub]);
  }
  res.status(204).end();
});

app.post("/api/conversations/:id/messages", requireAuth, requireActiveChild, requireConversationMessagingAccess, async (req, res) => {
  const body = String(req.body?.text ?? "").trim();
  if (!body || body.length > 4000) return res.status(400).json({ error: "Message vide ou trop long." });
  const client = await pool.connect();
  let message;
  try {
    await client.query("begin");
    if (!await isConversationMember(req.auth.sub, req.params.id, client)) throw httpError(403, "Conversation non autorisée.");
    await assertConversationPolicy(req.params.id, { channel: "messages" }, client, true);
    const id = crypto.randomUUID();
    const encrypted = encryptMessageContent({
      id,
      conversationId: req.params.id,
      senderId: req.auth.sub,
      body,
    });
    const result = await client.query(
      `insert into messages(
         id,conversation_id,sender_id,body_ciphertext,
         content_encryption_version,content_encryption_key_id
       ) values($1,$2,$3,$4,$5,$6)
       returning id,created_at`,
      [
        id,
        req.params.id,
        req.auth.sub,
        encrypted.bodyCiphertext,
        encrypted.encryptionVersion,
        encrypted.encryptionKeyId,
      ],
    );
    message = { ...result.rows[0], body };
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  await notifyConversation(req.params.id, req.auth.sub, {
    title: "Secret Clubhouse",
    body: "Nouveau message.",
    notificationType: "message",
    conversationId: req.params.id,
    tag: `conversation-${req.params.id}`,
    url: `/?notification=message&conversation=${encodeURIComponent(req.params.id)}`,
  });
  res.status(201).json({ message });
});

const supportedAudioTypes = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac", "audio/x-m4a"]);
const maxMediaFileBytes = 25 * 1024 * 1024;
const maxMediaPayloadBytes = 30 * 1024 * 1024;
const maxMediaRequestBytes = 30 * 1024 * 1024;
const mediaUploadDirectory = path.join(os.tmpdir(), "secret-clubhouse-uploads");

function requireBoundedMediaRequest(req, _res, next) {
  const rawContentLength = req.headers["content-length"];
  if (typeof rawContentLength !== "string") {
    return next(httpError(411, "La taille de l’envoi doit être indiquée."));
  }
  const contentLength = Number(rawContentLength);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    return next(httpError(400, "Taille d’envoi invalide."));
  }
  if (contentLength > maxMediaRequestBytes) {
    return next(httpError(413, "L’envoi de médias est limité à 30 Mo au total."));
  }
  return next();
}

async function removeUploadedFiles(files = []) {
  await Promise.allSettled(
    files
      .map((file) => file?.path)
      .filter(Boolean)
      .map((filePath) => fs.rm(filePath, { force: true })),
  );
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(mediaUploadDirectory, { recursive: true })
        .then(() => callback(null, mediaUploadDirectory))
        .catch(callback);
    },
    filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
  }),
  limits: {
    fileSize: maxMediaFileBytes,
    files: 6,
    fields: 0,
    parts: 6,
    headerPairs: 64,
  },
  fileFilter: (req, file, callback) => {
    const supported = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/") || supportedAudioTypes.has(file.mimetype);
    if (!supported) return callback(httpError(415, "Format de média non pris en charge."));
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      try {
        assertChildPolicies(req.conversationChildPolicies ?? [], { requiresVisualMedia: true });
      } catch (error) {
        return callback(error);
      }
    }
    return callback(null, true);
  },
});
app.post("/api/conversations/:id/media", requireAuth, requireActiveChild, requireConversationMessagingAccess, requireBoundedMediaRequest, upload.array("media", 6), async (req, res) => {
  const receivedFiles = req.files ?? [];
  try {
    let files;
    try {
      files = await validateUploadedMediaFiles(receivedFiles);
    } catch (error) {
      if (error instanceof MediaValidationError) throw httpError(error.statusCode, error.message);
      throw error;
    }
    if (!files.length) return res.status(400).json({ error: "Photo, vidéo ou message vocal requis." });
    const totalMediaBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalMediaBytes > maxMediaPayloadBytes) {
      return res.status(413).json({ error: "L’envoi de médias est limité à 30 Mo au total." });
    }
    const requiresVisualMedia = files.some((file) => file.kind === "image" || file.kind === "video");
    const client = await pool.connect();
    const inserted = [];
    try {
      await client.query("begin");
      if (!await isConversationMember(req.auth.sub, req.params.id, client)) throw httpError(403, "Conversation non autorisée.");
      await assertConversationPolicy(req.params.id, { channel: "messages", requiresVisualMedia }, client, true);
      for (const file of files) {
        let mediaData;
        let encryptedMediaData;
        try {
          mediaData = await fs.readFile(file.path);
          const id = crypto.randomUUID();
          const encrypted = encryptMessageContent({
            id,
            conversationId: req.params.id,
            senderId: req.auth.sub,
            mediaName: file.originalname,
            mediaType: file.mimetype,
            mediaData,
          });
          encryptedMediaData = encrypted.mediaCiphertext;
          const result = await client.query(
            `insert into messages(
               id,conversation_id,sender_id,
               media_name_ciphertext,media_type_ciphertext,media_ciphertext,
               content_encryption_version,content_encryption_key_id
             ) values($1,$2,$3,$4,$5,$6,$7,$8)
             returning id,created_at`,
            [
              id,
              req.params.id,
              req.auth.sub,
              encrypted.mediaNameCiphertext,
              encrypted.mediaTypeCiphertext,
              encrypted.mediaCiphertext,
              encrypted.encryptionVersion,
              encrypted.encryptionKeyId,
            ],
          );
          inserted.push({
            ...result.rows[0],
            media_name: file.originalname,
            media_type: file.mimetype,
          });
        } finally {
          encryptedMediaData?.fill(0);
          encryptedMediaData = null;
          mediaData?.fill(0);
          mediaData = null;
        }
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    await notifyConversation(req.params.id, req.auth.sub, {
      title: "Secret Clubhouse",
      body: "Nouveau message.",
      notificationType: "message",
      conversationId: req.params.id,
      tag: `conversation-${req.params.id}`,
      url: `/?notification=message&conversation=${encodeURIComponent(req.params.id)}`,
    });
    return res.status(201).json({ messages: inserted });
  } finally {
    await removeUploadedFiles(receivedFiles);
  }
});

app.get("/api/media/:messageId", requireAuth, requireActiveChild, async (req, res) => {
  const result = await pool.query(
    `select
       message.id,message.conversation_id,message.sender_id,
       message.media_data,message.media_type,message.media_name,
       message.body_ciphertext,message.media_name_ciphertext,
       message.media_type_ciphertext,message.media_ciphertext,
       message.content_encryption_version,message.content_encryption_key_id
     from messages message
     join conversation_members member on member.conversation_id=message.conversation_id and member.account_id=$2
     where message.id=$1
       and (
         not exists(select 1 from family_parent_conversations family_parent where family_parent.conversation_id=message.conversation_id)
         or exists(
           select 1 from family_parent_conversations family_parent
           join family_memberships active_membership on active_membership.family_id=family_parent.family_id and active_membership.parent_id=$2
           where family_parent.conversation_id=message.conversation_id
             and $2 in (family_parent.parent_one_id,family_parent.parent_two_id)
         )
       )`,
    [req.params.messageId, req.auth.sub],
  );
  const media = result.rows[0];
  if (!media) return res.status(404).json({ error: "Média introuvable." });
  const content = decryptMessageContent(media);
  if (!content.mediaData) return res.status(404).json({ error: "Média introuvable." });
  let cleared = false;
  const clearMediaBuffer = () => {
    if (cleared) return;
    cleared = true;
    content.mediaData.fill(0);
  };
  res.once("finish", clearMediaBuffer);
  res.once("close", clearMediaBuffer);
  res.set({
    "Content-Type": content.mediaType,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(content.mediaName)}`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(content.mediaData);
});

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
mountProductionAssets(app, { distPath: path.join(root, "dist") });
app.use(async (error, req, res, _next) => {
  await removeUploadedFiles(req.files ?? []);
  const response = safeHttpErrorResponse(error, {
    multerError: error instanceof multer.MulterError,
  });
  console.error(
    `[${req.requestId || "sans-id"}] ${req.method} ${req.originalUrl} -> ${response.statusCode}`,
    error,
  );
  res.status(response.statusCode).json({
    error: response.message,
    requestId: req.requestId || null,
  });
});

export { app };

export async function startServer() {
  const contentCipher = getContentCipher();
  await initializeDatabase();
  // Le service ne devient joignable qu'après chiffrement de tout contenu
  // legacy encore conservé. Une clé manquante ou une enveloppe incohérente
  // fait échouer le démarrage au lieu de laisser une instance partiellement
  // migrée répondre avec un healthcheck vert.
  await migrateLegacyMessageContent(pool, {
    cipher: contentCipher,
    logger: console,
  });
  await migrateLegacyCallSignals(pool, {
    cipher: contentCipher,
    logger: console,
  });
  nativePushService = productionFeatures.nativePush
    ? createNativePushService({ pool, env: process.env, logger: console })
    : null;
  console.log(nativePushService
    ? `Notifications natives : FCM ${nativePushService.capabilities.fcm ? "actif" : "non configuré"}, APNs ${nativePushService.capabilities.apns ? "actif" : "non configuré"}.`
    : "Notifications natives désactivées par NATIVE_PUSH_ENABLED.");
  await initializeWebPush();
  const server = app.listen(port, "0.0.0.0", () => console.log(`Secret Clubhouse écoute sur ${port}`));
  let contentMigrationPromise = null;
  const runContentEncryptionMigration = () => {
    if (contentMigrationPromise) return contentMigrationPromise;
    contentMigrationPromise = (async () => {
      await migrateLegacyMessageContent(pool, {
        cipher: contentCipher,
        logger: console,
      });
      await migrateLegacyCallSignals(pool, {
        cipher: contentCipher,
        logger: console,
      });
    })().finally(() => {
      contentMigrationPromise = null;
    });
    return contentMigrationPromise;
  };
  const failClosedAfterMigrationError = (error) => {
    console.error("Migration du chiffrement applicatif impossible ; arrêt de sécurité.", error);
    server.close();
    setImmediate(() => {
      throw error;
    });
  };
  const postDeployContentMigration = setTimeout(() => {
    runContentEncryptionMigration().catch(failClosedAfterMigrationError);
  }, 30_000);
  const recurringContentMigration = setInterval(() => {
    runContentEncryptionMigration().catch(failClosedAfterMigrationError);
  }, 6 * 60 * 60 * 1000);
  const loginRateLimitCleanup = setInterval(() => {
    pruneLoginRateLimits(pool).catch((error) => console.error("Nettoyage des limitations de connexion impossible.", error));
  }, 6 * 60 * 60 * 1000);
  const staleCallCleanup = setInterval(() => {
    expireStaleCalls().catch((error) => console.error("Expiration des appels natifs impossible.", error));
  }, 2_000);
  const nativeActionCleanup = setInterval(() => {
    pool.query(
      "delete from native_call_action_tokens where control_expires_at<now()-interval '1 day'",
    ).catch((error) => console.error("Nettoyage des jetons d’appel natifs impossible.", error));
  }, 60 * 60 * 1000);
  loginRateLimitCleanup.unref();
  staleCallCleanup.unref();
  nativeActionCleanup.unref();
  postDeployContentMigration.unref();
  recurringContentMigration.unref();
  server.on("close", () => {
    clearTimeout(postDeployContentMigration);
    clearInterval(recurringContentMigration);
    clearInterval(loginRateLimitCleanup);
    clearInterval(staleCallCleanup);
    clearInterval(nativeActionCleanup);
  });
  return server;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) await startServer();
