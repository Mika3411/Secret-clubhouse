const supportedPublicProtocols = new Set(["http:", "https:"]);
const localHostnames = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function createContactQrUrl({
  contactId,
  publicAppUrl,
  browserOrigin,
  native = false,
}) {
  const configuredUrl = String(publicAppUrl ?? "").trim();
  const baseUrl = configuredUrl || (!native ? String(browserOrigin ?? "").trim() : "");
  if (!baseUrl) return "";

  try {
    const url = new URL("/", baseUrl);
    if (!supportedPublicProtocols.has(url.protocol)) return "";
    if (native && (url.protocol !== "https:" || localHostnames.has(url.hostname))) return "";
    url.searchParams.set("contact", String(contactId ?? "").trim().toUpperCase());
    return url.toString();
  } catch {
    return "";
  }
}
