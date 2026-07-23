import { Capacitor } from "@capacitor/core";

const LEGACY_TOKEN_KEY = "secret-clubhouse-session";
const API_ORIGIN = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const isNativeClient = Capacitor.isNativePlatform();
let nativeSessionToken = null;

function removeLegacyStoredToken() {
  for (const storageName of ["sessionStorage", "localStorage"]) {
    try {
      globalThis[storageName]?.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // Une ancienne zone de stockage indisponible ne doit pas bloquer l’application.
    }
  }
}

export const hasNativeSession = () => isNativeClient && nativeSessionToken !== null;

export const clearToken = () => {
  nativeSessionToken = null;
  removeLegacyStoredToken();
};

const storeToken = (token) => {
  if (!isNativeClient) return;
  if (typeof token !== "string" || !token.trim()) throw new Error("Session native invalide.");
  nativeSessionToken = token;
};

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (isNativeClient && nativeSessionToken) {
    headers.set("Authorization", `Bearer ${nativeSessionToken}`);
  }
  if (isNativeClient) headers.set("X-Secret-Clubhouse-Client", "native");
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_ORIGIN}/api${path}`, {
    ...options,
    headers,
    credentials: isNativeClient ? "omit" : "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) clearToken();
    if (response.status === 423 && payload.processingRestricted && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("secret-clubhouse:processing-restricted", { detail: payload }));
    }
    const error = new Error(payload.error || "Le serveur est indisponible.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (payload.token) storeToken(payload.token);
  return payload;
}

// Supprime sans le relire tout secret laissé par une ancienne version.
removeLegacyStoredToken();

export const api = {
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  registerWithFamilyInvite: (data) => request("/auth/register-with-invite", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearToken();
    }
  },
  me: () => request("/me"),
  privacyContact: () => request("/privacy/contact"),
  privacyRequests: () => request("/privacy/requests"),
  submitPrivacyRequest: (data) => request("/privacy/requests", { method: "POST", body: JSON.stringify(data) }),
  privacyExport: (subjectId) => request(`/privacy/export?subjectId=${encodeURIComponent(subjectId)}`),
  deleteParentAccount: (data) => request("/account", { method: "DELETE", body: JSON.stringify(data) }),
  deleteFamily: (data) => request("/family", { method: "DELETE", body: JSON.stringify(data) }),
  family: () => request("/family"),
  familyInvitation: (token) => request("/family/invitations/preview", { method: "POST", body: JSON.stringify({ token }) }),
  inviteFamilyParent: (email) => request("/family/invitations", { method: "POST", body: JSON.stringify({ email }) }),
  acceptFamilyInvitation: (token) => request("/family/invitations/accept", { method: "POST", body: JSON.stringify({ token }) }),
  revokeFamilyInvitation: (invitationId) => request(`/family/invitations/${encodeURIComponent(invitationId)}`, { method: "DELETE" }),
  removeFamilyParent: (accountId) => request(`/family/members/${encodeURIComponent(accountId)}`, { method: "DELETE" }),
  updateParentPassword: (data) => request("/account/password", { method: "PATCH", body: JSON.stringify(data) }),
  updateAvatar: (avatar) => request("/account/avatar", { method: "PATCH", body: JSON.stringify({ avatar }) }),
  clubhouse: () => request("/clubhouse"),
  completeClubhouseActivity: (activityId) => request(`/clubhouse/activities/${encodeURIComponent(activityId)}/complete`, { method: "POST" }),
  children: () => request("/children"),
  createChild: (data) => request("/children", { method: "POST", body: JSON.stringify(data) }),
  updateChild: (childId, data) => request(`/children/${encodeURIComponent(childId)}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteChild: (childId) => request(`/children/${encodeURIComponent(childId)}`, { method: "DELETE" }),
  heartbeat: () => request("/presence/heartbeat", { method: "POST" }),
  presence: (contactIds) => request(`/presence?contactIds=${encodeURIComponent(contactIds.join(","))}`),
  notificationConsent: () => request("/privacy/notification-consent"),
  setNotificationConsent: (agreed) => request("/privacy/notification-consent", {
    method: "PUT",
    body: JSON.stringify({ agreed }),
  }),
  childNotificationConsent: (childId) => request(`/children/${encodeURIComponent(childId)}/privacy/notification-consent`),
  setChildNotificationConsent: (childId, agreed) => request(`/children/${encodeURIComponent(childId)}/privacy/notification-consent`, {
    method: "PUT",
    body: JSON.stringify({ agreed }),
  }),
  pushPublicKey: () => request("/push/public-key"),
  subscribePush: (subscription) => request("/push/subscribe", { method: "POST", body: JSON.stringify({ subscription }) }),
  unsubscribePush: (endpoint) => request("/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  saveNativePushToken: (token, details = {}) => request("/push/native-token", {
    method: "POST",
    body: JSON.stringify({
      token,
      ...(typeof details === "string" ? { platform: details } : details),
    }),
  }),
  nativePushStatus: (deviceId) => request(`/push/native-token?deviceId=${encodeURIComponent(deviceId)}`),
  deleteNativePushToken: (details = {}) => request("/push/native-token", {
    method: "DELETE",
    body: JSON.stringify(details),
  }),
  conversations: () => request("/conversations"),
  openFamilyConversation: (contactId) => request("/family-conversations", { method: "POST", body: JSON.stringify({ contactId }) }),
  contactRequests: () => request("/contact-requests"),
  addContact: (contactId, requesterContactId = "") => request("/contact-requests", {
    method: "POST",
    body: JSON.stringify({ contactId, ...(requesterContactId ? { requesterContactId } : {}) }),
  }),
  respondToContactRequest: (requestId, action) => request(`/contact-requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  }),
  games: () => request("/games"),
  gameContacts: () => request("/game-contacts"),
  inviteGame: (contactId, gameType = "connect_four") => request("/games", { method: "POST", body: JSON.stringify({ contactId, gameType }) }),
  respondToGame: (gameId, action) => request(`/games/${encodeURIComponent(gameId)}`, { method: "PATCH", body: JSON.stringify({ action }) }),
  playGameMove: (gameId, move) => request(`/games/${encodeURIComponent(gameId)}/moves`, { method: "POST", body: JSON.stringify({ move }) }),
  sendMessage: (conversationId, text) => request(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  markConversationRead: (conversationId) => request(`/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }),
  calls: () => request("/calls"),
  startCall: (conversationId, callType) => request(`/conversations/${encodeURIComponent(conversationId)}/calls`, { method: "POST", body: JSON.stringify({ callType }) }),
  call: (callId, afterSignal = 0) => request(`/calls/${encodeURIComponent(callId)}?afterSignal=${encodeURIComponent(afterSignal)}`),
  sendCallSignal: (callId, signalType, payload) => request(`/calls/${encodeURIComponent(callId)}/signals`, { method: "POST", body: JSON.stringify({ signalType, payload }) }),
  respondToCall: (callId, action) => request(`/calls/${encodeURIComponent(callId)}`, { method: "PATCH", body: JSON.stringify({ action }) }),
  typing: (conversationId) => request(`/conversations/${encodeURIComponent(conversationId)}/typing`),
  setTyping: (conversationId, active) => request(`/conversations/${encodeURIComponent(conversationId)}/typing`, { method: "POST", body: JSON.stringify({ active }) }),
  sendMedia: (conversationId, files) => { const body = new FormData(); files.forEach((file) => body.append("media", file)); return request(`/conversations/${conversationId}/media`, { method: "POST", body }); },
  media: async (messageId) => {
    const headers = new Headers();
    if (isNativeClient && nativeSessionToken) {
      headers.set("Authorization", `Bearer ${nativeSessionToken}`);
    }
    if (isNativeClient) {
      headers.set("X-Secret-Clubhouse-Client", "native");
    }
    const response = await fetch(`${API_ORIGIN}/api/media/${messageId}`, {
      headers,
      credentials: isNativeClient ? "omit" : "include",
    });
    if (!response.ok) {
      if (response.status === 401) clearToken();
      throw new Error("Média indisponible.");
    }
    return URL.createObjectURL(await response.blob());
  },
};
