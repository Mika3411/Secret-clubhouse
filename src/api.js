const TOKEN_KEY = "secret-clubhouse-session";
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_ORIGIN}/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Le serveur est indisponible.");
  if (payload.token) sessionStorage.setItem(TOKEN_KEY, payload.token);
  return payload;
}

export const api = {
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => request("/me"),
  updateParentPassword: (data) => request("/account/password", { method: "PATCH", body: JSON.stringify(data) }),
  updateAvatar: (avatar) => request("/account/avatar", { method: "PATCH", body: JSON.stringify({ avatar }) }),
  children: () => request("/children"),
  createChild: (data) => request("/children", { method: "POST", body: JSON.stringify(data) }),
  updateChild: (childId, data) => request(`/children/${encodeURIComponent(childId)}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteChild: (childId) => request(`/children/${encodeURIComponent(childId)}`, { method: "DELETE" }),
  heartbeat: () => request("/presence/heartbeat", { method: "POST" }),
  presence: (contactIds) => request(`/presence?contactIds=${encodeURIComponent(contactIds.join(","))}`),
  pushPublicKey: () => request("/push/public-key"),
  subscribePush: (subscription) => request("/push/subscribe", { method: "POST", body: JSON.stringify({ subscription }) }),
  unsubscribePush: (endpoint) => request("/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  saveNativePushToken: (token, platform) => request("/push/native-token", { method: "POST", body: JSON.stringify({ token, platform }) }),
  conversations: () => request("/conversations"),
  openFamilyConversation: (contactId) => request("/family-conversations", { method: "POST", body: JSON.stringify({ contactId }) }),
  addContact: (contactId) => request("/contact-requests", { method: "POST", body: JSON.stringify({ contactId }) }),
  games: () => request("/games"),
  inviteGame: (contactId) => request("/games", { method: "POST", body: JSON.stringify({ contactId }) }),
  respondToGame: (gameId, action) => request(`/games/${encodeURIComponent(gameId)}`, { method: "PATCH", body: JSON.stringify({ action }) }),
  playGameMove: (gameId, column) => request(`/games/${encodeURIComponent(gameId)}/moves`, { method: "POST", body: JSON.stringify({ column }) }),
  sendMessage: (conversationId, text) => request(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  sendMedia: (conversationId, files) => { const body = new FormData(); files.forEach((file) => body.append("media", file)); return request(`/conversations/${conversationId}/media`, { method: "POST", body }); },
  media: async (messageId) => { const response = await fetch(`${API_ORIGIN}/api/media/${messageId}`, { headers: { Authorization: `Bearer ${getToken()}` } }); if (!response.ok) throw new Error("Média indisponible."); return URL.createObjectURL(await response.blob()); },
};
