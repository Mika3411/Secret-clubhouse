export const childUsernameMinLength = 3;
export const childUsernameMaxLength = 18;

export function normalizeChildUsername(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, childUsernameMaxLength);
}

export function isValidChildUsername(value) {
  const normalized = normalizeChildUsername(value);
  return normalized.length >= childUsernameMinLength
    && normalized.length <= childUsernameMaxLength
    && /^[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(normalized);
}
