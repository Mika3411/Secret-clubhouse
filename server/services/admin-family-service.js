const ADMIN_FAMILY_STATUSES = new Set(["all", "active", "suspended"]);
const ADMIN_ACCOUNT_STATUSES = new Set(["active", "suspended"]);

export const ADMIN_FAMILY_PAGE_SIZE = 20;
export const ADMIN_FAMILY_MAX_PAGE_SIZE = 50;

const normalizeInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const escapeLikePattern = (value) => value.replace(/[\\%_]/gu, "\\$&");

export function normalizeAdminFamilyQuery(query = {}) {
  const search = String(query.search ?? "").trim().slice(0, 80);
  const requestedStatus = String(query.status ?? "all").trim().toLowerCase();
  return {
    search,
    searchPattern: search ? `%${escapeLikePattern(search)}%` : null,
    status: ADMIN_FAMILY_STATUSES.has(requestedStatus) ? requestedStatus : "all",
    page: normalizeInteger(query.page, 1, 1, 10_000),
    pageSize: normalizeInteger(
      query.pageSize,
      ADMIN_FAMILY_PAGE_SIZE,
      1,
      ADMIN_FAMILY_MAX_PAGE_SIZE,
    ),
  };
}

const familyMatchesFiltersSql = `
  (
    $1::text is null
    or family.name ilike $1 escape '\\'
    or exists(
      select 1
      from family_memberships membership
      join accounts parent on parent.id=membership.parent_id
      where membership.family_id=family.id
        and (
          parent.display_name ilike $1 escape '\\'
          or parent.email ilike $1 escape '\\'
          or parent.contact_id ilike $1 escape '\\'
        )
    )
    or exists(
      select 1
      from family_children family_child
      join accounts child on child.id=family_child.child_id
      where family_child.family_id=family.id
        and (
          child.display_name ilike $1 escape '\\'
          or child.username ilike $1 escape '\\'
          or child.contact_id ilike $1 escape '\\'
        )
    )
  )
  and (
    $2='all'
    or (
      $2='suspended'
      and (
        exists(
          select 1
          from family_memberships membership
          join accounts parent on parent.id=membership.parent_id
          where membership.family_id=family.id
            and parent.admin_suspended_at is not null
        )
        or exists(
          select 1
          from family_children family_child
          join accounts child on child.id=family_child.child_id
          where family_child.family_id=family.id
            and child.admin_suspended_at is not null
        )
      )
    )
    or (
      $2='active'
      and not exists(
        select 1
        from family_memberships membership
        join accounts parent on parent.id=membership.parent_id
        where membership.family_id=family.id
          and parent.admin_suspended_at is not null
      )
      and not exists(
        select 1
        from family_children family_child
        join accounts child on child.id=family_child.child_id
        where family_child.family_id=family.id
          and child.admin_suspended_at is not null
      )
    )
  )
`;

export const ADMIN_FAMILY_COUNT_SQL = `
  select count(*)::integer as total
  from families family
  where ${familyMatchesFiltersSql}
`;

export const ADMIN_FAMILY_LIST_SQL = `
  select
    family.id,
    family.name,
    family.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',parent.id,
          'name',parent.display_name,
          'email',parent.email,
          'contactId',parent.contact_id,
          'familyRole',membership.role,
          'createdAt',parent.created_at,
          'lastActivityAt',parent.last_activity_at,
          'processingRestrictedAt',parent.processing_restricted_at,
          'suspendedAt',parent.admin_suspended_at,
          'suspensionReason',parent.admin_suspension_reason,
          'protectedAdministrator',(administrator.account_id is not null)
        )
        order by (membership.role='primary') desc,membership.joined_at,parent.id
      )
      from family_memberships membership
      join accounts parent on parent.id=membership.parent_id
      left join platform_administrators administrator on administrator.account_id=parent.id
      where membership.family_id=family.id
    ),'[]'::jsonb) as parents,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',child.id,
          'name',child.display_name,
          'username',child.username,
          'contactId',child.contact_id,
          'age',child.age,
          'profileStatus',child.status,
          'createdAt',child.created_at,
          'lastActivityAt',child.last_activity_at,
          'processingRestrictedAt',child.processing_restricted_at,
          'suspendedAt',child.admin_suspended_at,
          'suspensionReason',child.admin_suspension_reason
        )
        order by family_child.added_at,child.id
      )
      from family_children family_child
      join accounts child on child.id=family_child.child_id
      where family_child.family_id=family.id
    ),'[]'::jsonb) as children,
    (
      select count(*)::integer
      from family_parent_invitations invitation
      where invitation.family_id=family.id
        and invitation.status='pending'
        and invitation.expires_at>now()
    ) as pending_invitations
  from families family
  where ${familyMatchesFiltersSql}
  order by family.created_at desc,family.id desc
  limit $3 offset $4
`;

const normalizeDateValue = (value) => value ?? null;

export function serializeAdminAccount(account = {}, role) {
  const suspendedAt = normalizeDateValue(account.suspendedAt ?? account.suspended_at);
  const restrictedAt = normalizeDateValue(
    account.processingRestrictedAt ?? account.processing_restricted_at,
  );
  return {
    id: account.id,
    role,
    name: account.name ?? account.display_name ?? "",
    email: role === "parent" ? account.email ?? null : null,
    username: role === "child" ? account.username ?? null : null,
    contactId: account.contactId ?? account.contact_id ?? null,
    familyRole: role === "parent" ? account.familyRole ?? account.family_role ?? null : null,
    age: role === "child" ? Number(account.age) || null : null,
    profileStatus: role === "child"
      ? account.profileStatus ?? account.profile_status ?? "active"
      : null,
    accountStatus: suspendedAt ? "suspended" : "active",
    suspendedAt,
    suspensionReason: suspendedAt
      ? account.suspensionReason ?? account.suspension_reason ?? ""
      : "",
    processingRestrictedAt: restrictedAt,
    protectedAdministrator: role === "parent"
      ? Boolean(account.protectedAdministrator ?? account.protected_administrator)
      : false,
    createdAt: normalizeDateValue(account.createdAt ?? account.created_at),
    lastActivityAt: normalizeDateValue(account.lastActivityAt ?? account.last_activity_at),
  };
}

export function serializeAdminFamily(row = {}) {
  const parents = Array.isArray(row.parents) ? row.parents : [];
  const children = Array.isArray(row.children) ? row.children : [];
  const serializedParents = parents.map((account) => serializeAdminAccount(account, "parent"));
  const serializedChildren = children.map((account) => serializeAdminAccount(account, "child"));
  return {
    id: row.id,
    name: row.name ?? "Famille",
    createdAt: normalizeDateValue(row.created_at ?? row.createdAt),
    accountStatus: [...serializedParents, ...serializedChildren]
      .some((account) => account.accountStatus === "suspended")
      ? "suspended"
      : "active",
    parents: serializedParents,
    children: serializedChildren,
    pendingInvitations: Number(row.pending_invitations ?? row.pendingInvitations) || 0,
  };
}

export async function listAdminFamilies(executor, query = {}) {
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("Un exécuteur PostgreSQL est requis.");
  }
  const normalized = normalizeAdminFamilyQuery(query);
  const filterParams = [normalized.searchPattern, normalized.status];
  const offset = (normalized.page - 1) * normalized.pageSize;
  const [countResult, listResult] = await Promise.all([
    executor.query(ADMIN_FAMILY_COUNT_SQL, filterParams),
    executor.query(ADMIN_FAMILY_LIST_SQL, [
      ...filterParams,
      normalized.pageSize,
      offset,
    ]),
  ]);
  const total = Number(countResult.rows?.[0]?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / normalized.pageSize));
  return {
    families: (listResult.rows ?? []).map(serializeAdminFamily),
    pagination: {
      page: Math.min(normalized.page, totalPages),
      pageSize: normalized.pageSize,
      total,
      totalPages,
    },
    filters: {
      search: normalized.search,
      status: normalized.status,
    },
  };
}

export function normalizeAdminAccountStatusChange(body = {}) {
  const status = String(body.status ?? "").trim().toLowerCase();
  if (!ADMIN_ACCOUNT_STATUSES.has(status)) {
    return { valid: false, error: "Statut de compte invalide." };
  }
  const reason = String(body.reason ?? "").trim().replace(/\s+/gu, " ").slice(0, 240);
  if (status === "suspended" && reason.length < 3) {
    return { valid: false, error: "Indiquez brièvement la raison de la suspension." };
  }
  return { valid: true, value: { status, reason } };
}

export async function updateAdminAccountStatus(executor, {
  administratorId,
  accountId,
  status,
  reason = "",
}) {
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("Un exécuteur PostgreSQL est requis.");
  }
  const targetResult = await executor.query(
    `select
       account.id,
       account.role,
       account.admin_suspended_at,
       administrator.account_id is not null as protected_administrator
     from accounts account
     left join platform_administrators administrator on administrator.account_id=account.id
     where account.id=$1
     for update of account`,
    [accountId],
  );
  const target = targetResult.rows?.[0];
  if (!target) return { found: false };
  if (target.id === administratorId || target.protected_administrator) {
    return { found: true, protected: true };
  }

  const suspended = status === "suspended";
  const updateResult = await executor.query(
    `update accounts
     set admin_suspended_at=case when $2::boolean then coalesce(admin_suspended_at,now()) else null end,
         admin_suspension_reason=case when $2::boolean then $3 else null end,
         admin_suspended_by=case when $2::boolean then $4::uuid else null end
     where id=$1
     returning id,role,admin_suspended_at,admin_suspension_reason`,
    [accountId, suspended, reason || null, administratorId],
  );

  let revokedSessions = 0;
  if (suspended) {
    const sessionsResult = await executor.query(
      `update auth_sessions
       set revoked_at=coalesce(revoked_at,now()),
           revoked_reason=coalesce(revoked_reason,'administrative_suspension')
       where account_id=$1 and revoked_at is null`,
      [accountId],
    );
    revokedSessions = Number(sessionsResult.rowCount) || 0;
    const callsResult = await executor.query(
      `update call_sessions
       set status=case when status='ringing' then 'cancelled' else 'ended' end,
           ended_at=coalesce(ended_at,now()),
           updated_at=now()
       where (caller_id=$1 or callee_id=$1)
         and status in ('ringing','accepted')
       returning id`,
      [accountId],
    );
    const callIds = (callsResult.rows ?? []).map((call) => call.id).filter(Boolean);
    if (callIds.length) {
      await executor.query("delete from call_signals where call_id=any($1::uuid[])", [callIds]);
    }
    await executor.query("delete from presence where account_id=$1", [accountId]);
  }

  const updated = updateResult.rows?.[0] ?? {};
  return {
    found: true,
    protected: false,
    account: {
      id: updated.id ?? accountId,
      role: updated.role ?? target.role,
      accountStatus: updated.admin_suspended_at ? "suspended" : "active",
      suspendedAt: updated.admin_suspended_at ?? null,
      suspensionReason: updated.admin_suspension_reason ?? "",
    },
    revokedSessions,
  };
}
