import { minutesInTimeZone } from "../../src/policy-time.js";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value) {
  if (!timePattern.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export { minutesInTimeZone };

export function isChannelAllowed(schedule, channelKey, options = {}) {
  const channel = schedule?.[channelKey];
  if (!channel) return false;
  if (schedule.enabled === false) return true;
  if (channel.enabled === false) return false;
  const startMinutes = timeToMinutes(channel.start);
  const endMinutes = timeToMinutes(channel.end);
  if (startMinutes === null || endMinutes === null) return false;
  const currentMinutes = Number.isInteger(options.currentMinutes)
    ? options.currentMinutes
    : minutesInTimeZone(options.now, options.timeZone);
  return startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
    : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

export function evaluateChildPolicy(child, options = {}) {
  if (child.status !== "active") {
    return { allowed: false, reason: `Le profil de ${child.display_name || "cet enfant"} est en pause.` };
  }

  if (options.channel && !isChannelAllowed(child.communication_schedule, options.channel, options)) {
    const channelLabel = options.channel === "video"
      ? "Les appels vidéo"
      : options.channel === "calls"
        ? "Les appels audio"
        : "Les messages";
    return { allowed: false, reason: `${channelLabel} ne sont pas autorisés actuellement par les règles parentales.` };
  }

  if (options.requiresVisualMedia && child.safety_settings?.media !== true) {
    return { allowed: false, reason: "Le partage de photos et vidéos est désactivé par un parent." };
  }

  return { allowed: true };
}
