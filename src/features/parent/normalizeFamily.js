export function normalizeFamily(payload, currentParent = {}) {
  const family = payload?.family ?? payload ?? {};
  const currentRole = family.role ?? family.currentRole ?? family.current_role ?? "coparent";
  const members = (family.members ?? []).map((member) => ({
    ...member,
    id: member.id ?? member.accountId ?? member.account_id,
    name: member.name ?? member.displayName ?? member.display_name ?? "Parent",
    contactId: member.contactId ?? member.contact_id ?? "",
    role: member.role ?? member.membershipRole ?? member.membership_role ?? "coparent",
    isCurrent: member.isCurrent ?? member.is_current ?? member.id === currentParent.id,
  }));
  const pendingInvitations = family.pendingInvitations ?? family.pending_invitations ?? family.invitations ?? [];
  return { ...family, role: currentRole, members, pendingInvitations };
}
