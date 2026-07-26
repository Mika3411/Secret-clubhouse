export const childUsernameMinLength = 3;
export const childUsernameMaxLength = 18;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPrivateContactId(value) {
  return /^SC-\d{3}-\d{3}-\d{3}$/iu.test(String(value ?? "").trim());
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeChildUsername(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, childUsernameMaxLength);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidChildUsername(value) {
  const normalized = normalizeChildUsername(value);
  return normalized.length >= childUsernameMinLength
    && normalized.length <= childUsernameMaxLength
    && /^[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(normalized);
}
