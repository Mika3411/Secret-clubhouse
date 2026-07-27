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
  const trustedAdults = (family.trustedAdults ?? family.trusted_adults ?? []).map((adult) => ({
    ...adult,
    id: adult.id ?? adult.accountId ?? adult.account_id,
    name: adult.name ?? adult.displayName ?? adult.display_name ?? "Proche",
    contactId: adult.contactId ?? adult.contact_id ?? "",
    relationshipType: adult.relationshipType ?? adult.relationship_type ?? "family_friend",
    relationshipLabel: adult.relationshipLabel ?? adult.relationship_label ?? "Autre proche",
    children: (adult.children ?? []).map((child) => ({
      ...child,
      id: child.id ?? child.childId ?? child.child_id,
      name: child.name ?? child.displayName ?? child.display_name ?? "Enfant",
      permissions: child.permissions ?? {},
    })),
  }));
  const pendingInvitations = (family.pendingInvitations ?? family.pending_invitations ?? family.invitations ?? []).map((invitation) => ({
    ...invitation,
    role: invitation.role ?? invitation.invitationRole ?? invitation.invitation_role ?? "coparent",
    relationshipType: invitation.relationshipType ?? invitation.relationship_type ?? null,
    relationshipLabel: invitation.relationshipLabel ?? invitation.relationship_label ?? null,
    children: invitation.children ?? [],
    permissions: invitation.permissions ?? {},
  }));
  const families = (family.families ?? []).map((item) => ({
    ...item,
    id: item.id ?? item.familyId ?? item.family_id,
    name: item.name ?? item.familyName ?? item.family_name ?? "Famille",
    relationshipType: item.relationshipType ?? item.relationship_type ?? "family_friend",
    relationshipLabel: item.relationshipLabel ?? item.relationship_label ?? "Autre proche",
    children: (item.children ?? []).map((child) => ({
      ...child,
      id: child.id ?? child.childId ?? child.child_id,
      name: child.name ?? child.displayName ?? child.display_name ?? "Enfant",
      permissions: child.permissions ?? {},
    })),
  }));
  const accessibleChildren = (family.accessibleChildren ?? family.accessible_children ?? []).map((child) => ({
    ...child,
    familyId: child.familyId ?? child.family_id ?? null,
    familyName: child.familyName ?? child.family_name ?? "",
    relationshipType: child.relationshipType ?? child.relationship_type ?? null,
    relationshipLabel: child.relationshipLabel ?? child.relationship_label ?? null,
  }));
  return { ...family, role: currentRole, members, trustedAdults, pendingInvitations, families, accessibleChildren };
}
