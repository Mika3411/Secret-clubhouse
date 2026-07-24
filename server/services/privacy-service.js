import { publicHttpError } from "../http-errors.js";
import { decryptMessageContent } from "../encryption/message-content.js";

export const privacyRequestTypes = new Set([
  "access",
  "rectification",
  "erasure",
  "restriction",
  "objection",
]);

const safeDate = (value) => value ? new Date(value).toISOString() : null;

export function serializePrivacyRequest(row) {
  return {
    id: row.id,
    type: row.request_type,
    status: row.status,
    details: row.details,
    response: row.response_text ?? null,
    responseActor: row.response_actor ?? null,
    subject: {
      id: row.subject_account_id ?? null,
      name: row.subject_display_name,
      role: row.subject_role,
    },
    createdAt: safeDate(row.created_at),
    acknowledgedAt: safeDate(row.acknowledged_at),
    dueAt: safeDate(row.due_at),
    respondedAt: safeDate(row.responded_at),
    completedAt: safeDate(row.completed_at),
    restrictionAppliedAt: safeDate(row.restriction_applied_at),
    restrictionLiftedAt: safeDate(row.restriction_lifted_at),
    backupExpiresAt: safeDate(row.backup_expires_at),
    overdue: !["completed", "rejected", "cancelled"].includes(row.status)
      && new Date(row.due_at).getTime() < Date.now(),
  };
}

export async function resolvePrivacySubject(executor, requesterId, requestedSubjectId = null, { lock = false } = {}) {
  const subjectId = requestedSubjectId || requesterId;
  const result = await executor.query(
    `select subject.*,
       requester.role as requester_role,
       requester.email as requester_email,
       requester.contact_id as requester_contact_id,
       coalesce(requester_membership.family_id,requester_child.family_id) as requester_family_id,
       coalesce(subject_membership.family_id,subject_child.family_id) as subject_family_id
     from accounts requester
     join accounts subject on subject.id=$2
     left join family_memberships requester_membership on requester_membership.parent_id=requester.id
     left join family_children requester_child on requester_child.child_id=requester.id
     left join family_memberships subject_membership on subject_membership.parent_id=subject.id
     left join family_children subject_child on subject_child.child_id=subject.id
     where requester.id=$1
       and (
         subject.id=requester.id
         or (
           requester.role='parent'
           and subject.role='child'
           and requester_membership.family_id=subject_child.family_id
         )
       )
     ${lock ? "for key share of requester,subject" : ""}`,
    [requesterId, subjectId],
  );
  return result.rows[0] ?? null;
}

export async function createPrivacyRequest(executor, {
  requesterId,
  subjectId = null,
  requestType,
  details,
}) {
  if (!privacyRequestTypes.has(requestType)) return null;
  const subject = await resolvePrivacySubject(executor, requesterId, subjectId, { lock: true });
  if (!subject) return null;

  const duplicate = await executor.query(
    `select id
     from privacy_requests
     where requester_account_id=$1
       and subject_account_id=$2
       and request_type=$3
       and status in ('submitted','in_review')
     limit 1`,
    [requesterId, subject.id, requestType],
  );
  if (duplicate.rowCount) {
    throw publicHttpError(409, "Une demande identique est déjà en cours.");
  }

  const inserted = await executor.query(
    `insert into privacy_requests(
       requester_account_id,subject_account_id,family_id,
       requester_email,requester_contact_id,subject_display_name,subject_role,
       request_type,details
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [
      requesterId,
      subject.id,
      subject.subject_family_id,
      subject.requester_email,
      subject.requester_contact_id,
      subject.display_name,
      subject.role,
      requestType,
      details,
    ],
  );
  const request = inserted.rows[0];
  await executor.query(
    `insert into privacy_request_events(request_id,actor_type,event_type,note)
     values($1,'requester','submitted',$2),($1,'system','acknowledged','Accusé de réception immédiat ; réponse attendue sous un mois.')`,
    [request.id, details],
  );
  return request;
}

export async function listPrivacyRequests(executor, accountId) {
  const result = await executor.query(
    `select *
     from privacy_requests
     where requester_account_id=$1 or subject_account_id=$1
     order by created_at desc`,
    [accountId],
  );
  return result.rows.map(serializePrivacyRequest);
}

export async function createReadablePrivacyExport(executor, {
  requesterId,
  subjectId = null,
  controllerEmail,
  decryptContent = decryptMessageContent,
}) {
  const subject = await resolvePrivacySubject(executor, requesterId, subjectId);
  if (!subject) return null;
  const canReadAllAuthoredContent = requesterId === subject.id;

  const [
    familyResult,
    relationshipsResult,
    contactRequestsResult,
    messagesResult,
    activitiesResult,
    clubhouseDailyResult,
    gamesResult,
    callsResult,
    notificationsResult,
    requestsResult,
  ] = await Promise.all([
    executor.query(
      `select family.id,family.name,membership.role as parent_role
       from families family
       left join family_memberships membership on membership.family_id=family.id and membership.parent_id=$1
       where family.id=$2`,
      [subject.id, subject.subject_family_id],
    ),
    executor.query(
      `select relationship.created_at,relationship.conversation_id,
        other.display_name as contact_name,other.contact_id,other.role as contact_role
       from contact_relationships relationship
       join accounts other on other.id=case
         when relationship.account_one_id=$1 then relationship.account_two_id
         else relationship.account_one_id
       end
       where relationship.account_one_id=$1 or relationship.account_two_id=$1
       order by relationship.created_at`,
      [subject.id],
    ),
    executor.query(
      `select request.id,request.status,request.created_at,request.updated_at,request.resolved_at,
        case when request.requester_id=$1 then 'sent' else 'received' end as direction,
        other.display_name as contact_name,other.contact_id
       from contact_requests request
       join accounts other on other.id=case
         when request.requester_id=$1 then request.target_account_id
         else request.requester_id
       end
       where request.requester_id=$1 or request.target_account_id=$1
       order by request.created_at`,
      [subject.id],
    ),
    executor.query(
      `select
        message.id,message.conversation_id,message.sender_id,
        message.body,message.media_name,message.media_type,
        message.body_ciphertext,message.media_name_ciphertext,
        message.media_type_ciphertext,
        message.content_encryption_version,message.content_encryption_key_id,
        message.message_kind,message.created_at,message.expires_at,
        exists(
          select 1 from conversation_members requester_member
          where requester_member.conversation_id=message.conversation_id
            and requester_member.account_id=$2
        ) as requester_is_member
       from messages message
       where message.sender_id=$1
       order by message.created_at`,
      [subject.id, requesterId],
    ),
    subject.role === "child"
      ? executor.query(
          `select progress.activity_id,progress.first_completed_at,progress.last_completed_at,
            progress.completion_count,progress.awarded_stars,
            activity.unlock_id,unlock.kind as unlock_kind,unlock.label as unlock_label,
            appearance.unlock_id=activity.unlock_id as reward_is_equipped
           from clubhouse_activity_progress progress
           left join clubhouse_activities activity on activity.id=progress.activity_id
           left join clubhouse_unlocks unlock on unlock.id=activity.unlock_id
           left join clubhouse_appearance appearance on appearance.child_id=progress.child_id
           where progress.child_id=$1
           order by progress.first_completed_at`,
          [subject.id],
        )
      : Promise.resolve({ rows: [] }),
    subject.role === "child"
      ? executor.query(
          `select activity.activity_date::text as activity_date,
            challenge.activity_id as completed_daily_challenge_id
           from clubhouse_daily_activity activity
           left join clubhouse_daily_challenges challenge
             on challenge.child_id=activity.child_id
             and challenge.challenge_date=activity.activity_date
           where activity.child_id=$1
           order by activity.activity_date`,
          [subject.id],
        )
      : Promise.resolve({ rows: [] }),
    executor.query(
      `select game.id,game.game_type,game.status,game.created_at,game.updated_at,
        opponent.display_name as opponent_name,opponent.contact_id as opponent_contact_id,
        game.winner_id=$1 as subject_won
       from game_sessions game
       join accounts opponent on opponent.id=case
         when game.player_one_id=$1 then game.player_two_id else game.player_one_id
       end
       where game.player_one_id=$1 or game.player_two_id=$1
       order by game.created_at`,
      [subject.id],
    ),
    executor.query(
      `select call.id,call.call_type,call.status,call.created_at,call.answered_at,call.ended_at,
        other.display_name as contact_name,other.contact_id
       from call_sessions call
       join accounts other on other.id=case when call.caller_id=$1 then call.callee_id else call.caller_id end
       where call.caller_id=$1 or call.callee_id=$1
       order by call.created_at`,
      [subject.id],
    ),
    executor.query(
      `select 'web_push' as registration_type,created_at,updated_at,expires_at,null::text as platform,null::text as token_kind
       from push_subscriptions where account_id=$1
       union all
       select 'native_push',created_at,updated_at,expires_at,platform,token_kind
       from native_push_tokens where account_id=$1
       order by created_at`,
      [subject.id],
    ),
    executor.query(
      `select * from privacy_requests
       where requester_account_id=$1 or subject_account_id=$1
       order by created_at`,
      [subject.id],
    ),
  ]);

  const messages = messagesResult.rows.map((message) => {
    const contentVisible = canReadAllAuthoredContent || message.requester_is_member;
    const content = contentVisible ? decryptContent(message) : null;
    return {
      id: message.id,
      conversationId: message.conversation_id,
      kind: message.message_kind,
      createdAt: safeDate(message.created_at),
      expiresAt: safeDate(message.expires_at),
      content: content?.body ?? null,
      media: (message.media_type || message.media_type_ciphertext)
        ? {
            type: contentVisible ? content?.mediaType ?? null : null,
            name: contentVisible ? content?.mediaName ?? null : null,
            note: contentVisible
              ? "Le fichier peut être téléchargé depuis la conversation tant qu’il n’a pas expiré."
              : "Le contenu est masqué car le parent ne participe pas à cette conversation.",
          }
        : null,
      contentWithheld: !contentVisible,
    };
  });

  return {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    controller: {
      name: "Secret Clubhouse",
      privacyContact: controllerEmail,
    },
    scope: {
      requestedBy: requesterId,
      subjectId: subject.id,
      childExportRequestedByParent: subject.role === "child" && requesterId !== subject.id,
      privacyRule: "Les contenus d’une conversation enfant–ami sont masqués au parent qui n’y participe pas.",
    },
    account: {
      id: subject.id,
      role: subject.role,
      name: subject.display_name,
      email: subject.email,
      contactId: subject.contact_id,
      username: subject.username,
      age: subject.age === null ? null : Number(subject.age),
      avatar: subject.avatar_config,
      status: subject.status,
      safetySettings: subject.safety_settings,
      communicationSchedule: subject.communication_schedule,
      createdAt: safeDate(subject.created_at),
      lastActivityAt: safeDate(subject.last_activity_at),
      processingRestrictedAt: safeDate(subject.processing_restricted_at),
    },
    family: familyResult.rows[0] ?? null,
    approvedContacts: relationshipsResult.rows,
    contactRequests: contactRequestsResult.rows,
    authoredMessages: messages,
    clubhouseProgress: activitiesResult.rows,
    clubhouseDailyActivity: clubhouseDailyResult.rows,
    games: gamesResult.rows,
    calls: callsResult.rows,
    notificationRegistrations: notificationsResult.rows,
    rightsRequests: requestsResult.rows.map(serializePrivacyRequest),
  };
}
