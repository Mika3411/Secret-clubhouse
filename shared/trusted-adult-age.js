export const trustedAdultMinimumAge = 14;

const birthDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function utcDateParts(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function evaluateTrustedAdultBirthDate(value, now = new Date()) {
  const birthDate = String(value ?? "").trim();
  if (!birthDatePattern.test(birthDate) || !Number.isFinite(now?.getTime?.())) {
    return { valid: false, reason: "invalid" };
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const parsedParts = utcDateParts(parsed);
  if (parsedParts.year !== year || parsedParts.month !== month || parsedParts.day !== day) {
    return { valid: false, reason: "invalid" };
  }

  const today = utcDateParts(now);
  let age = today.year - year;
  if (today.month < month || (today.month === month && today.day < day)) age -= 1;
  if (age < trustedAdultMinimumAge) {
    return { valid: false, reason: "underage" };
  }
  if (age > 120) {
    return { valid: false, reason: "invalid" };
  }
  return { valid: true, reason: null };
}

export function maximumTrustedAdultBirthDate(now = new Date()) {
  const today = utcDateParts(now);
  const maximum = new Date(Date.UTC(
    today.year - trustedAdultMinimumAge,
    today.month - 1,
    today.day,
  ));
  return maximum.toISOString().slice(0, 10);
}
