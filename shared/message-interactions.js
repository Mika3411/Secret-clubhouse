export const messageReactionOptions = Object.freeze([
  Object.freeze({ code: "heart", emoji: "❤️", label: "J’adore" }),
  Object.freeze({ code: "thumbs_up", emoji: "👍", label: "J’aime" }),
  Object.freeze({ code: "laugh", emoji: "😂", label: "Ça me fait rire" }),
  Object.freeze({ code: "wow", emoji: "😮", label: "Waouh" }),
  Object.freeze({ code: "sad", emoji: "😢", label: "Ça me rend triste" }),
  Object.freeze({ code: "clap", emoji: "👏", label: "Bravo" }),
]);

const reactionByCode = new Map(messageReactionOptions.map((reaction) => [reaction.code, reaction]));

export function normalizeMessageReactionCode(value) {
  const code = String(value ?? "").trim().toLowerCase();
  return reactionByCode.has(code) ? code : null;
}

export function getMessageReactionOption(code) {
  return reactionByCode.get(normalizeMessageReactionCode(code)) ?? null;
}

export function describeMessageContent(message, maxLength = 96) {
  if (!message) return "Message d’origine";
  const text = String(message.text ?? "").trim();
  if (text) return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  if (message.type === "image") return "Photo";
  if (message.type === "video") return "Vidéo";
  if (message.type === "audio") return "Message vocal";
  return "Message d’origine";
}
