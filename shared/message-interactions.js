/**
 * @typedef {"heart" | "thumbs_up" | "laugh" | "wow" | "sad" | "clap"} MessageReactionCode
 */

/**
 * @typedef {{ code: MessageReactionCode, emoji: string, label: string }} MessageReactionOption
 */

/** @type {readonly Readonly<MessageReactionOption>[]} */
export const messageReactionOptions = Object.freeze([
  Object.freeze({ code: "heart", emoji: "❤️", label: "J’adore" }),
  Object.freeze({ code: "thumbs_up", emoji: "👍", label: "J’aime" }),
  Object.freeze({ code: "laugh", emoji: "😂", label: "Ça me fait rire" }),
  Object.freeze({ code: "wow", emoji: "😮", label: "Waouh" }),
  Object.freeze({ code: "sad", emoji: "😢", label: "Ça me rend triste" }),
  Object.freeze({ code: "clap", emoji: "👏", label: "Bravo" }),
]);

const reactionByCode = new Map(messageReactionOptions.map((reaction) => [reaction.code, reaction]));

/**
 * @param {unknown} value
 * @returns {MessageReactionCode | null}
 */
export function normalizeMessageReactionCode(value) {
  const code = String(value ?? "").trim().toLowerCase();
  return reactionByCode.has(/** @type {MessageReactionCode} */ (code))
    ? /** @type {MessageReactionCode} */ (code)
    : null;
}

/**
 * @param {unknown} code
 * @returns {Readonly<MessageReactionOption> | null}
 */
export function getMessageReactionOption(code) {
  const normalizedCode = normalizeMessageReactionCode(code);
  return normalizedCode ? reactionByCode.get(normalizedCode) ?? null : null;
}

/**
 * @param {{ text?: unknown, type?: unknown } | null | undefined} message
 * @param {number} [maxLength]
 * @returns {string}
 */
export function describeMessageContent(message, maxLength = 96) {
  if (!message) return "Message d’origine";
  const text = String(message.text ?? "").trim();
  if (text) return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  if (message.type === "image") return "Photo";
  if (message.type === "video") return "Vidéo";
  if (message.type === "audio") return "Message vocal";
  return "Message d’origine";
}
