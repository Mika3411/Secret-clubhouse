export const maximumConversationContactAliasLength = 32;

export function normalizeConversationContactAlias(value) {
  if (typeof value !== "string") {
    return { error: "Choisis un petit nom avec du texte." };
  }
  const alias = value
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
  if (!alias) return { alias: null };
  const hasControlCharacter = Array.from(alias).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (
    Array.from(alias).length > maximumConversationContactAliasLength
    || hasControlCharacter
  ) {
    return { error: `Choisis un petit nom de ${maximumConversationContactAliasLength} caractères maximum.` };
  }
  return { alias };
}
