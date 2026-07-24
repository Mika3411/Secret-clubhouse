export const defaultParentalTimeZone = "Europe/Paris";

export function minutesInTimeZone(now = new Date(), timeZone = defaultParentalTimeZone) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hours = Number(parts.find((part) => part.type === "hour")?.value);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error("Impossible de déterminer l’heure des règles parentales.");
  }
  return hours * 60 + minutes;
}
