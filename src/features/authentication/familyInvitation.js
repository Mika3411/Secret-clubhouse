const familyInviteQueryKeys = ["familyInvite", "family-invite", "invite"];

export function readFamilyInviteToken() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return familyInviteQueryKeys
    .flatMap((key) => [hashParams.get(key)?.trim(), params.get(key)?.trim()])
    .find(Boolean) ?? "";
}

export function clearFamilyInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  familyInviteQueryKeys.forEach((key) => params.delete(key));
  familyInviteQueryKeys.forEach((key) => hashParams.delete(key));
  const query = params.toString();
  const hash = hashParams.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`);
}

export function normalizeFamilyInvitation(payload) {
  const invitation = payload?.invitation ?? payload ?? {};
  return {
    ...invitation,
    id: invitation.id,
    email: invitation.email ?? "",
    familyName: invitation.familyName ?? invitation.family_name ?? "cette famille",
    invitedByName: invitation.invitedByName ?? invitation.inviterName ?? invitation.invited_by_name ?? invitation.invitedBy?.name ?? "un parent",
    expiresAt: invitation.expiresAt ?? invitation.expires_at,
  };
}
