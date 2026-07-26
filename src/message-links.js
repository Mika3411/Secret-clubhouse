const messageUrlPattern = /https?:\/\/[^\s<>"']+/giu;
const trailingUrlPunctuationPattern = /[.,!?;:]+$/u;

/**
 * @typedef {{ type: "text", value: string } | { type: "link", value: string, href: string }} MessagePart
 */

/**
 * @param {MessagePart[]} parts
 * @param {string} value
 */
function appendText(parts, value) {
  if (!value) return;
  const previousPart = parts.at(-1);
  if (previousPart?.type === "text") {
    previousPart.value += value;
    return;
  }
  parts.push({ type: "text", value });
}

/**
 * @param {unknown} value
 * @returns {MessagePart[]}
 */
export function splitMessageLinks(value) {
  const text = String(value ?? "");
  /** @type {MessagePart[]} */
  const parts = [];
  let cursor = 0;

  for (const match of text.matchAll(messageUrlPattern)) {
    const matchStart = match.index ?? 0;
    const matchedValue = match[0];
    const trailingPunctuation = matchedValue.match(trailingUrlPunctuationPattern)?.[0] ?? "";
    const linkValue = trailingPunctuation
      ? matchedValue.slice(0, -trailingPunctuation.length)
      : matchedValue;

    if (matchStart > cursor) {
      appendText(parts, text.slice(cursor, matchStart));
    }
    if (linkValue) {
      parts.push({ type: "link", value: linkValue, href: linkValue });
    }
    if (trailingPunctuation) {
      appendText(parts, trailingPunctuation);
    }

    cursor = matchStart + matchedValue.length;
  }

  if (cursor < text.length) {
    appendText(parts, text.slice(cursor));
  }
  if (!parts.length && text) {
    appendText(parts, text);
  }

  return parts;
}
