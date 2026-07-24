import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { GearSix } from "@phosphor-icons/react/GearSix";
import { House } from "@phosphor-icons/react/House";
import { api, clearToken, hasNativeSession } from "./api";
import { AuthScreen, rememberedParentEmailKey } from "./PublicAuth";
import {
  appendUniqueMessages,
  cloneCommunicationSchedule,
  cloneSafetySettings,
  defaultCommunicationSchedule,
  defaultSafetySettings,
  mapServerConversation,
  mapServerMessage,
  mergeConversationMessages,
} from "./app-core";
import {
  Capacitor,
  getNativeInstallationId,
  nativeApnsEnvironmentKey,
  nativeInstallationKey,
  nativePushOptInKey,
  nativeTokenDetails,
  NativeCallNotifications,
  PushNotifications,
} from "./native-notifications";
import "./styles/authenticated.css";

const lazyNamed = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));
const loadConversationsSpace = () => import("./features/ConversationsSpace");
const loadConversationList = () => import("./features/conversations/list/ConversationListScreen");
const loadClubhouseSpace = () => import("./features/ClubhouseSpace");
const loadProfileSpace = () => import("./features/ProfileSpace");
const loadParentSpace = () => import("./features/ParentSpace");

const HomeScreen = lazyNamed(loadConversationList, "HomeScreen");
const ChatScreen = lazyNamed(loadConversationsSpace, "ChatScreen");
const ParentMessagesScreen = lazyNamed(loadConversationsSpace, "ParentMessagesScreen");
const RealtimeCallScreen = lazyNamed(loadConversationsSpace, "RealtimeCallScreen");
const ClubhouseScreen = lazyNamed(loadClubhouseSpace, "ClubhouseScreen");
const ParentGamesScreen = lazyNamed(loadClubhouseSpace, "ParentGamesScreen");
const ProfileScreen = lazyNamed(loadProfileSpace, "ProfileScreen");
const AvatarPreferencesScreen = lazyNamed(loadProfileSpace, "AvatarPreferencesScreen");
const DataRightsModal = lazyNamed(loadProfileSpace, "DataRightsModal");
const ParentDashboard = lazyNamed(loadParentSpace, "ParentDashboard");
const NoChildScreen = lazyNamed(loadParentSpace, "NoChildScreen");
const PausedChildScreen = lazyNamed(loadParentSpace, "PausedChildScreen");
const ParentPasswordModal = lazyNamed(loadParentSpace, "ParentPasswordModal");
const FamilyInviteAcceptanceModal = lazyNamed(loadParentSpace, "FamilyInviteAcceptanceModal");
const FamilyInviteErrorModal = lazyNamed(loadParentSpace, "FamilyInviteErrorModal");
const FamilyParentsModal = lazyNamed(loadParentSpace, "FamilyParentsModal");
const ChildAccountModal = lazyNamed(loadParentSpace, "ChildAccountModal");
const ContactIdsModal = lazyNamed(loadParentSpace, "ContactIdsModal");
const ScheduleModal = lazyNamed(loadParentSpace, "ScheduleModal");
const QrModal = lazyNamed(() => import("./features/QrModal"), "QrModal");


const familyInviteQueryKeys = ["familyInvite", "family-invite", "invite"];

function FeatureLoading({ label = "Chargement de votre espace…" }) {
  return (
    <section className="session-restoring" role="status" aria-live="polite">
      <span className="session-restoring__spinner" aria-hidden="true" />
      <strong>{label}</strong>
    </section>
  );
}



const readFamilyInviteToken = () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return familyInviteQueryKeys
    .flatMap((key) => [hashParams.get(key)?.trim(), params.get(key)?.trim()])
    .find(Boolean) ?? "";
};

const clearFamilyInviteFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  familyInviteQueryKeys.forEach((key) => params.delete(key));
  familyInviteQueryKeys.forEach((key) => hashParams.delete(key));
  const query = params.toString();
  const hash = hashParams.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`);
};


const normalizeFamily = (payload, currentParent = {}) => {
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
};

const normalizeFamilyInvitation = (payload) => {
  const invitation = payload?.invitation ?? payload ?? {};
  return {
    ...invitation,
    id: invitation.id,
    email: invitation.email ?? "",
    familyName: invitation.familyName ?? invitation.family_name ?? "cette famille",
    invitedByName: invitation.invitedByName ?? invitation.inviterName ?? invitation.invited_by_name ?? invitation.invitedBy?.name ?? "un parent",
    expiresAt: invitation.expiresAt ?? invitation.expires_at,
  };
};











function useMouseDragScroll() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let gesture = null;
    let suppressClick = false;

    const scrollableAncestors = (target) => {
      const elements = [];
      let element = target instanceof Element ? target : null;
      while (element && root.contains(element)) {
        const style = window.getComputedStyle(element);
        const canScrollX = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
        const canScrollY = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
        if (canScrollX || canScrollY) elements.push({ element, canScrollX, canScrollY });
        if (element === root) break;
        element = element.parentElement;
      }
      return elements;
    };

    const onPointerDown = (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      const candidates = scrollableAncestors(event.target);
      if (!candidates.length) return;
      gesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, candidates, scroller: null, scrollLeft: 0, scrollTop: 0 };
      suppressClick = false;
    };

    const onPointerMove = (event) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;

      if (!gesture.scroller) {
        if (Math.hypot(dx, dy) < 5) return;
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const match = gesture.candidates.find((candidate) => horizontal ? candidate.canScrollX : candidate.canScrollY)
          ?? gesture.candidates.find((candidate) => candidate.canScrollX || candidate.canScrollY);
        if (!match) return;
        gesture.scroller = match.element;
        gesture.scrollLeft = match.element.scrollLeft;
        gesture.scrollTop = match.element.scrollTop;
        match.element.setPointerCapture(event.pointerId);
        match.element.classList.add("is-mouse-dragging");
        suppressClick = true;
      }

      event.preventDefault();
      gesture.scroller.scrollLeft = gesture.scrollLeft - dx;
      gesture.scroller.scrollTop = gesture.scrollTop - dy;
    };

    const finishGesture = (event) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      gesture.scroller?.classList.remove("is-mouse-dragging");
      gesture = null;
    };

    const onClick = (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerup", finishGesture);
    root.addEventListener("pointercancel", finishGesture);
    root.addEventListener("click", onClick, true);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", finishGesture);
      root.removeEventListener("pointercancel", finishGesture);
      root.removeEventListener("click", onClick, true);
    };
  }, []);

  return rootRef;
}




















































































function BottomNavigation({ active, onChange }) {
  const items = [
    { id: "conversations", label: "Conversations", Icon: ChatCircleDots },
    { id: "clubhouse", label: "Clubhouse", Icon: House },
    { id: "profile", label: "Mon espace", Icon: GearSix },
  ];
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map(({ id, label, Icon }) => (
        <button key={id} type="button" className={active === id ? "is-active" : ""} onClick={() => onChange(id)} aria-current={active === id ? "page" : undefined}>
          <Icon size={25} weight={active === id ? "fill" : "bold"} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}



export function App({ initialAccount = null, initialRegistration = false }) {
  const dragScrollRef = useMouseDragScroll();
  const [session, setSession] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [familyOwner, setFamilyOwner] = useState({ name: "", email: "", contactId: "" });
  const [family, setFamily] = useState(null);
  const [isFamilyParentsOpen, setIsFamilyParentsOpen] = useState(false);
  const [familyInviteToken, setFamilyInviteToken] = useState(() => readFamilyInviteToken());
  const [familyInvitation, setFamilyInvitation] = useState(null);
  const [familyInvitationError, setFamilyInvitationError] = useState("");
  const [isFamilyInvitationLoading, setIsFamilyInvitationLoading] = useState(() => Boolean(readFamilyInviteToken()));
  const [activeTab, setActiveTab] = useState("conversations");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [parentView, setParentView] = useState(null);
  const [children, setChildren] = useState([]);
  const [activeChildId, setActiveChildId] = useState(null);
  const [settingsByChild, setSettingsByChild] = useState({});
  const [schedulesByChild, setSchedulesByChild] = useState({});
  const [childModal, setChildModal] = useState(null);
  const [scheduleModalChildId, setScheduleModalChildId] = useState(null);
  const [isContactIdsOpen, setIsContactIdsOpen] = useState(false);
  const [isParentPasswordOpen, setIsParentPasswordOpen] = useState(false);
  const [isDataRightsOpen, setIsDataRightsOpen] = useState(false);
  const [isAvatarPreferencesOpen, setIsAvatarPreferencesOpen] = useState(false);
  const [parentThreads, setParentThreads] = useState([]);
  const [serverConversations, setServerConversations] = useState([]);
  const [familyConversationSyncError, setFamilyConversationSyncError] = useState("");
  const [contactRequests, setContactRequests] = useState([]);
  const [contactRelationships, setContactRelationships] = useState([]);
  const [contactRequestBusyId, setContactRequestBusyId] = useState("");
  const [contactRequestError, setContactRequestError] = useState("");
  const [selectedParentThreadId, setSelectedParentThreadId] = useState(null);
  const [presenceByContactId, setPresenceByContactId] = useState({});
  const [callOverlay, setCallOverlay] = useState(null);
  const callOverlayRef = useRef(null);
  const conversationSyncCursorRef = useRef("0");
  const conversationSyncInFlightRef = useRef(false);
  const conversationMessageLoadsRef = useRef(new Set());
  const openConversationIdRef = useRef("");
  const nativeContextRef = useRef({ session: null, parentThreads: [], serverConversations: [] });
  const [pendingContactId, setPendingContactId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("contact")?.trim().toUpperCase() ?? "";
    return /^SC-\d{3}-\d{3}-\d{3}$/.test(value) ? value : "";
  });
  const [pendingRequesterContactId, setPendingRequesterContactId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("requester")?.trim().toUpperCase() ?? "";
    return /^SC-\d{3}-\d{3}-\d{3}$/.test(value) ? value : "";
  });
  const activeChild = children.find((child) => child.id === activeChildId) ?? children[0] ?? null;
  const activeSettings = activeChild ? settingsByChild[activeChild.id] ?? defaultSafetySettings : defaultSafetySettings;
  const activeSchedule = activeChild ? schedulesByChild[activeChild.id] ?? defaultCommunicationSchedule : defaultCommunicationSchedule;
  const parentUnreadMessages = parentThreads.reduce((total, thread) => total + thread.unread, 0);
  nativeContextRef.current = { session, parentThreads, serverConversations };

  useEffect(() => {
    callOverlayRef.current = callOverlay;
  }, [callOverlay]);

  useEffect(() => {
    if (!session) setCallOverlay(null);
  }, [session]);

  useEffect(() => {
    const openRightsForRestriction = () => setIsDataRightsOpen(true);
    window.addEventListener("secret-clubhouse:processing-restricted", openRightsForRestriction);
    return () => window.removeEventListener("secret-clubhouse:processing-restricted", openRightsForRestriction);
  }, []);

  useEffect(() => {
    if (!familyInviteToken) {
      setFamilyInvitation(null);
      setFamilyInvitationError("");
      setIsFamilyInvitationLoading(false);
      return;
    }
    let isCurrent = true;
    setIsFamilyInvitationLoading(true);
    setFamilyInvitationError("");
    api.familyInvitation(familyInviteToken)
      .then((payload) => { if (isCurrent) setFamilyInvitation(normalizeFamilyInvitation(payload)); })
      .catch((error) => {
        if (!isCurrent) return;
        setFamilyInvitation(null);
        setFamilyInvitationError(error.message || "Ce lien d’invitation est invalide ou expiré.");
      })
      .finally(() => { if (isCurrent) setIsFamilyInvitationLoading(false); });
    return () => { isCurrent = false; };
  }, [familyInviteToken]);

  useEffect(() => {
    (initialAccount ? Promise.resolve({ account: initialAccount }) : api.me())
      .then(({ account }) => {
        if (account.role === "child" && familyInviteToken) {
          return api.logout().catch(() => clearToken());
        }
        if (account.role === "child") return openChildSession(account);
        return openAuthenticatedSession(account).then(() => {
          if (initialRegistration) setChildModal({ mode: "create" });
        });
      })
      .catch(() => clearToken())
      .finally(() => setIsRestoringSession(false));
  }, []);

  useEffect(() => {
    if (!session || !pendingContactId) return;
    if (session.role === "parent") {
      setSelectedParentThreadId(null);
      setParentView("messages");
      return;
    }
    const requesterContactId = activeChild?.contactId || session.contactId || "";
    if (!requesterContactId) return;
    setPendingRequesterContactId(requesterContactId);
    const params = new URLSearchParams(window.location.search);
    params.set("contact", pendingContactId);
    params.set("requester", requesterContactId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    void api.logout().catch(() => clearToken());
    setSession(null);
    setParentView(null);
    setSelectedConversation(null);
  }, [activeChild?.contactId, pendingContactId, session]);

  const requestFriendWithParent = (contactId) => {
    const requesterContactId = activeChild?.contactId ?? "";
    setPendingContactId(contactId);
    setPendingRequesterContactId(requesterContactId);
    const params = new URLSearchParams();
    params.set("contact", contactId);
    if (requesterContactId) params.set("requester", requesterContactId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    setIsQrOpen(false);
    setSelectedConversation(null);
    if (session?.role === "parent") {
      setSelectedParentThreadId(null);
      setParentView("messages");
      return;
    }
    void api.logout().catch(() => clearToken());
    setSession(null);
    setParentView(null);
  };

  useEffect(() => {
    if (!session) return undefined;
    if (session.role === "child" && activeChild?.status !== "active") return undefined;
    const contactIds = [...parentThreads, ...serverConversations].map((contact) => contact.contactId).filter(Boolean);
    const refreshPresence = async () => {
      try {
        await api.heartbeat();
        const result = await api.presence(contactIds);
        setPresenceByContactId(result.presence);
      } catch {
        // Une coupure réseau ne déconnecte pas immédiatement l’utilisateur.
      }
    };
    refreshPresence();
    const timer = window.setInterval(refreshPresence, 30000);
    return () => window.clearInterval(timer);
  }, [activeChild?.status, session, parentThreads, serverConversations]);

  const applyFamilyChildren = (familyChildren) => {
    setChildren(familyChildren);
    setActiveChildId(familyChildren[0]?.id ?? null);
    setSettingsByChild(Object.fromEntries(familyChildren.map((child) => [child.id, cloneSafetySettings(child.settings)])));
    setSchedulesByChild(Object.fromEntries(familyChildren.map((child) => [child.id, cloneCommunicationSchedule(child.schedule)])));
    setParentThreads([]);
    setServerConversations([]);
    setPresenceByContactId({});
    conversationSyncCursorRef.current = "0";
  };

  const mergeConversationSummary = (current, summary) => current ? {
    ...summary,
    messages: current.messages,
    messagesLoaded: current.messagesLoaded,
    messagesLoading: current.messagesLoading,
    messagesError: current.messagesError,
    messageCursor: current.messageCursor,
    hasMoreMessages: current.hasMoreMessages,
    received: current.received,
    sent: current.sent,
  } : summary;

  const applyServerConversations = (account, conversationsPayload, syncCursor = null) => {
    const mapped = conversationsPayload.map((conversation) => mapServerConversation(conversation, account));
    const mergeSummaries = (current) => mapped.map((summary) => (
      mergeConversationSummary(current.find((conversation) => conversation.id === summary.id), summary)
    ));
    if (syncCursor !== null
      && syncCursor !== undefined
      && conversationSyncCursorRef.current === "0") {
      conversationSyncCursorRef.current = String(syncCursor);
    }
    if (account.role === "parent") {
      setParentThreads(mergeSummaries);
    } else {
      setServerConversations(mergeSummaries);
      setSelectedConversation((current) => {
        if (!current) return null;
        const summary = mapped.find((conversation) => conversation.id === current.id);
        return summary ? mergeConversationSummary(current, summary) : current;
      });
    }
    return mapped;
  };

  const updateConversationState = (conversationId, updater) => {
    const updateList = (current) => current.map((conversation) => (
      conversation.id === conversationId ? updater(conversation) : conversation
    ));
    setParentThreads(updateList);
    setServerConversations(updateList);
    setSelectedConversation((current) => current?.id === conversationId ? updater(current) : current);
  };

  const applyConversationMessages = (messagesPayload) => {
    if (!session || !Array.isArray(messagesPayload) || !messagesPayload.length) return;
    const messagesByConversation = new Map();
    messagesPayload.forEach((message) => {
      const conversationId = message.conversationId ?? message.conversation_id;
      const mapped = mapServerMessage(message, session.id);
      if (!conversationId || !mapped) return;
      const messages = messagesByConversation.get(conversationId) ?? [];
      messages.push(mapped);
      messagesByConversation.set(conversationId, messages);
    });
    messagesByConversation.forEach((messages, conversationId) => {
      updateConversationState(conversationId, (conversation) => ({
        ...conversation,
        messages: mergeConversationMessages(conversation.messages, messages),
      }));
    });
  };

  const loadConversationMessages = async (conversationId, { older = false } = {}) => {
    if (!session) return;
    const conversation = [...parentThreads, ...serverConversations]
      .find((item) => item.id === conversationId)
      ?? (selectedConversation?.id === conversationId ? selectedConversation : null);
    if (!conversation
      || conversation.messagesLoading
      || conversationMessageLoadsRef.current.has(conversationId)
      || (older && !conversation.hasMoreMessages)) return;
    conversationMessageLoadsRef.current.add(conversationId);
    updateConversationState(conversationId, (current) => ({
      ...current,
      messagesLoading: true,
      messagesError: "",
    }));
    try {
      const payload = await api.conversationMessages(conversationId, {
        before: older ? conversation.messageCursor : "",
      });
      const mappedMessages = payload.messages
        .map((message) => mapServerMessage(message, session.id))
        .filter(Boolean);
      updateConversationState(conversationId, (current) => ({
        ...current,
        messages: mergeConversationMessages(current.messages, mappedMessages),
        messagesLoaded: true,
        messagesLoading: false,
        messagesError: "",
        messageCursor: payload.pageInfo?.nextCursor ?? null,
        hasMoreMessages: Boolean(payload.pageInfo?.hasMore),
      }));
      const incomingMessageIds = payload.messages
        .filter((message) => (message.senderId ?? message.sender_id) !== session.id)
        .map((message) => message.id);
      if (incomingMessageIds.length) {
        void api.markConversationRead(conversationId, incomingMessageIds).catch(() => undefined);
      }
    } catch (error) {
      updateConversationState(conversationId, (current) => ({
        ...current,
        messagesLoading: false,
        messagesError: error.message || "Les messages sont temporairement indisponibles.",
      }));
    } finally {
      conversationMessageLoadsRef.current.delete(conversationId);
    }
  };

  const applyContactRequestPayload = (payload) => {
    setContactRequests(Array.isArray(payload?.requests) ? payload.requests : []);
    setContactRelationships(Array.isArray(payload?.contacts) ? payload.contacts : []);
  };

  const refreshContactRequests = async () => {
    const payload = await api.contactRequests();
    applyContactRequestPayload(payload);
    setContactRequestError("");
    return payload;
  };

  const synchronizeConversationState = async () => {
    if (!session || conversationSyncInFlightRef.current) return;
    conversationSyncInFlightRef.current = true;
    try {
      let hasMore = false;
      do {
        const result = await api.syncConversations(conversationSyncCursorRef.current);
        applyServerConversations(session, result.conversations);
        applyConversationMessages(result.messages);
        const openConversationId = openConversationIdRef.current;
        const visibleIncomingIds = openConversationId
          ? result.messages
            .filter((message) => (
              (message.conversationId ?? message.conversation_id) === openConversationId
              && (message.senderId ?? message.sender_id) !== session.id
            ))
            .map((message) => message.id)
          : [];
        if (visibleIncomingIds.length) {
          await api.markConversationRead(openConversationId, visibleIncomingIds);
        }
        conversationSyncCursorRef.current = String(result.cursor);
        hasMore = result.hasMore === true;
      } while (hasMore);
    } catch {
      // La synchronisation périodique reprendra si la connexion vient de tomber.
    } finally {
      conversationSyncInFlightRef.current = false;
    }
  };

  const openConversationForReceipts = session?.role === "parent"
    ? parentThreads.find((thread) => thread.id === selectedParentThreadId) ?? null
    : selectedConversation;
  openConversationIdRef.current = openConversationForReceipts?.id ?? "";
  const latestIncomingMessageId = openConversationForReceipts?.messages
    ?.filter((message) => message.direction === "received")
    .at(-1)?.id ?? "";

  useEffect(() => {
    if (!session || !openConversationForReceipts?.serverBacked) return undefined;
    if (!openConversationForReceipts.messagesLoaded
      && !openConversationForReceipts.messagesLoading
      && !openConversationForReceipts.messagesError) {
      void loadConversationMessages(openConversationForReceipts.id);
    }
    return undefined;
  }, [
    openConversationForReceipts?.id,
    openConversationForReceipts?.messagesLoaded,
    openConversationForReceipts?.messagesLoading,
    openConversationForReceipts?.messagesError,
    session?.id,
  ]);

  useEffect(() => {
    if (!session || !openConversationForReceipts?.serverBacked || !latestIncomingMessageId) return undefined;
    let isCurrent = true;
    api.markConversationRead(openConversationForReceipts.id, [latestIncomingMessageId])
      .then(() => {
        if (isCurrent) return synchronizeConversationState();
        return undefined;
      })
      .catch(() => {
        // L’accusé sera repris lors de la prochaine synchronisation.
      });
    return () => {
      isCurrent = false;
    };
  }, [latestIncomingMessageId, openConversationForReceipts?.id, session?.id]);

  const openRealtimeCall = (conversation, callType, policy = null) => {
    if (session?.features?.rtc !== true) return;
    setCallOverlay({
      key: `outgoing-${conversation.id}-${callType}-${Date.now()}`,
      direction: "outgoing",
      conversation,
      callType,
      policy,
      call: null,
    });
  };

  const closeRealtimeCall = () => setCallOverlay(null);

  const syncFamilyConversations = async (familyChildren, initialConversationData = null) => {
    let conversationData = initialConversationData ?? await api.conversations();
    const findMissingChildren = () => {
      const familyConversationIds = new Set(conversationData.conversations
        .filter((conversation) => conversation.kind === "child" && conversation.contact_role === "child")
        .map((conversation) => conversation.contact_id));
      return familyChildren.filter((child) => !familyConversationIds.has(child.contactId));
    };

    let missingChildren = findMissingChildren();
    if (missingChildren.length) {
      await Promise.allSettled(missingChildren.map((child) => api.openFamilyConversation(child.contactId)));
      try {
        conversationData = await api.conversations();
      } catch {
        setFamilyConversationSyncError("Certaines conversations familiales sont temporairement indisponibles.");
        return conversationData;
      }
      missingChildren = findMissingChildren();
    }
    setFamilyConversationSyncError(missingChildren.length
      ? `Conversation temporairement indisponible avec ${missingChildren.map((child) => child.name).join(", ")}.`
      : "");
    return conversationData;
  };

  const openAuthenticatedSession = async (parent) => {
    const parentWithId = { ...parent, contactId: parent.contactId ?? "" };
    applyFamilyChildren([]);
    if (parentWithId.processingRestrictedAt) {
      setFamily(null);
      setFamilyOwner(parentWithId);
      setSession({ ...parentWithId, role: "parent" });
      setParentView("management");
      setSelectedConversation(null);
      setIsDataRightsOpen(true);
      return;
    }
    const [childrenData, familyData, contactRequestOutcome] = await Promise.all([
      api.children(),
      api.family(),
      api.contactRequests()
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: null, error })),
    ]);
    const conversationData = await syncFamilyConversations(childrenData.children);
    applyFamilyChildren(childrenData.children);
    applyServerConversations(
      { ...parentWithId, role: "parent" },
      conversationData.conversations,
      conversationData.syncCursor,
    );
    if (contactRequestOutcome.data) {
      applyContactRequestPayload(contactRequestOutcome.data);
      setContactRequestError("");
    } else {
      applyContactRequestPayload({ requests: [], contacts: [] });
      setContactRequestError(contactRequestOutcome.error?.message || "Les demandes de contact sont temporairement indisponibles.");
    }
    setFamily(normalizeFamily(familyData, parentWithId));
    setFamilyOwner(parentWithId);
    setSession({ ...parentWithId, role: "parent" });
    setParentView("dashboard");
    setSelectedConversation(null);
  };

  const openChildSession = async (child) => {
    applyFamilyChildren([child]);
    const conversationData = child.status === "paused" || child.processingRestrictedAt
      ? { conversations: [], syncCursor: "0" }
      : await api.conversations();
    applyServerConversations(
      { ...child, role: "child" },
      conversationData.conversations,
      conversationData.syncCursor,
    );
    setFamilyOwner({ name: "Compte parent", email: "", contactId: "" });
    setSession({ ...child, role: "child", childId: child.id });
    setActiveChildId(child.id);
    setParentView(null);
    setSelectedConversation(null);
    setActiveTab(child.processingRestrictedAt ? "profile" : "conversations");
    if (child.processingRestrictedAt) setIsDataRightsOpen(true);
  };

  const loginParent = async (credentials) => {
    const { account } = await api.login(credentials);
    try {
      if (familyInviteToken) await api.acceptFamilyInvitation(familyInviteToken);
      localStorage.setItem(rememberedParentEmailKey, credentials.email.trim().toLowerCase());
      await openAuthenticatedSession(account);
      if (familyInviteToken) {
        clearFamilyInviteFromUrl();
        setFamilyInviteToken("");
        setFamilyInvitation(null);
      }
    } catch (error) {
      await api.logout().catch(() => clearToken());
      throw error;
    }
  };

  const registerParent = async (parent) => {
    const { account } = familyInviteToken
      ? await api.registerWithFamilyInvite({
          token: familyInviteToken,
          name: parent.name,
          password: parent.password,
          legal: parent.legal,
        })
      : await api.register(parent);
    localStorage.setItem(rememberedParentEmailKey, parent.email.trim().toLowerCase());
    await openAuthenticatedSession(account);
    if (familyInviteToken) {
      clearFamilyInviteFromUrl();
      setFamilyInviteToken("");
      setFamilyInvitation(null);
    } else {
      setChildModal({ mode: "create" });
    }
  };

  const loginChild = async (username, password) => {
    const { account } = await api.login({ username, password });
    if (account.role !== "child") {
      await api.logout().catch(() => undefined);
      const invalidCredentialsError = new Error("Identifiants incorrects.");
      invalidCredentialsError.status = 401;
      throw invalidCredentialsError;
    }
    await openChildSession(account);
    return true;
  };

  const logoutParent = () => {
    if (Capacitor.isNativePlatform() && hasNativeSession()) {
      void (async () => {
        await Promise.allSettled([
          api.deleteNativePushToken({ deviceId: getNativeInstallationId() }),
          PushNotifications.unregister(),
        ]);
        await NativeCallNotifications.clearPendingState().catch(() => undefined);
        await api.logout().catch(() => clearToken());
      })();
      localStorage.setItem(nativePushOptInKey, "false");
    } else {
      void api.logout().catch(() => clearToken());
    }
    setSession(null);
    setFamilyOwner({ name: "", email: "", contactId: "" });
    setFamily(null);
    setChildren([]);
    setActiveChildId(null);
    setSettingsByChild({});
    setSchedulesByChild({});
    setParentThreads([]);
    setServerConversations([]);
    conversationSyncCursorRef.current = "0";
    setFamilyConversationSyncError("");
    setContactRequests([]);
    setContactRelationships([]);
    setContactRequestBusyId("");
    setContactRequestError("");
    setParentView(null);
    setChildModal(null);
    setScheduleModalChildId(null);
    setIsContactIdsOpen(false);
    setIsParentPasswordOpen(false);
    setIsDataRightsOpen(false);
    setIsFamilyParentsOpen(false);
    setIsAvatarPreferencesOpen(false);
    setSelectedParentThreadId(null);
    setSelectedConversation(null);
    setActiveTab("conversations");
    setPendingContactId("");
    setPendingRequesterContactId("");
    clearContactRequestFromUrl();
  };

  const dismissFamilyInvitation = () => {
    clearFamilyInviteFromUrl();
    setFamilyInviteToken("");
    setFamilyInvitation(null);
    setFamilyInvitationError("");
  };

  const acceptCurrentFamilyInvitation = async () => {
    if (!familyInviteToken || session?.role !== "parent") throw new Error("Aucune invitation de co-parent à accepter.");
    await api.acceptFamilyInvitation(familyInviteToken);
    clearFamilyInviteFromUrl();
    setFamilyInviteToken("");
    setFamilyInvitation(null);
    await openAuthenticatedSession(session);
  };

  const useAnotherAccountForFamilyInvitation = () => {
    logoutParent();
  };

  const refreshFamily = async () => {
    const familyData = await api.family();
    const normalized = normalizeFamily(familyData, session);
    setFamily(normalized);
    return normalized;
  };

  const inviteFamilyParent = async (email) => {
    const result = await api.inviteFamilyParent(email);
    await refreshFamily();
    return result;
  };

  const revokeFamilyInvitation = async (invitationId) => {
    await api.revokeFamilyInvitation(invitationId);
    await refreshFamily();
  };

  const removeFamilyParent = async (parentId) => {
    await api.removeFamilyParent(parentId);
    await refreshFamily();
  };

  const saveAvatar = async (avatar) => {
    const { child } = await api.updateAvatar(avatar);
    setChildren((current) => current.map((item) => item.id === child.id ? child : item));
    setSession((current) => ({ ...current, ...child, childId: child.id }));
  };

  const changeParentPassword = async ({ currentPassword, newPassword }) => {
    await api.updateParentPassword({ currentPassword, newPassword });
  };

  const saveChild = async (childData) => {
    let uniqueUsername = childData.username;
    let suffix = 2;
    while (children.some((item) => item.id !== childData.id && item.username === uniqueUsername)) {
      uniqueUsername = `${childData.username.slice(0, 15)}${suffix}`;
      suffix += 1;
    }

    const profile = {
      name: childData.name,
      age: childData.age,
      username: uniqueUsername,
      password: childData.password,
      color: childData.color,
      status: childData.status,
    };

    const result = childData.id
      ? await api.updateChild(childData.id, profile)
      : await api.createChild(profile);
    const savedChild = result.child;
    const nextChildren = childData.id
      ? children.map((item) => item.id === savedChild.id ? savedChild : item)
      : [...children, savedChild];
    setChildren(nextChildren);
    setActiveChildId(savedChild.id);
    setSettingsByChild((current) => ({ ...current, [savedChild.id]: cloneSafetySettings(savedChild.settings) }));
    setSchedulesByChild((current) => ({ ...current, [savedChild.id]: cloneCommunicationSchedule(savedChild.schedule) }));
    setChildModal(null);

    try {
      const refreshedConversations = await syncFamilyConversations(nextChildren);
      applyServerConversations(session, refreshedConversations.conversations, refreshedConversations.syncCursor);
    } catch {
      setFamilyConversationSyncError(`Le profil de ${savedChild.name} est enregistré, mais sa conversation est temporairement indisponible.`);
    }
  };

  const retryFamilyConversationSync = async () => {
    try {
      const conversationData = await syncFamilyConversations(children);
      applyServerConversations(session, conversationData.conversations, conversationData.syncCursor);
    } catch {
      setFamilyConversationSyncError("La resynchronisation est indisponible pour le moment. Réessayez plus tard.");
    }
  };

  const deleteChild = async (childId) => {
    const childToDelete = children.find((child) => child.id === childId);
    if (!childToDelete) throw new Error("Ce profil enfant est introuvable.");
    await api.deleteChild(childId);

    const remainingChildren = children.filter((child) => child.id !== childId);
    const removedThreadIds = parentThreads.filter((thread) => thread.contactId === childToDelete.contactId).map((thread) => thread.id);
    setChildren(remainingChildren);
    setActiveChildId((current) => current === childId ? remainingChildren[0]?.id ?? null : current);
    setSettingsByChild((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== childId)));
    setSchedulesByChild((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== childId)));
    setParentThreads((current) => current.filter((thread) => thread.contactId !== childToDelete.contactId));
    setServerConversations((current) => current.filter((conversation) => conversation.contactId !== childToDelete.contactId));
    setSelectedParentThreadId((current) => removedThreadIds.includes(current) ? null : current);
    setSelectedConversation((current) => current?.contactId === childToDelete.contactId ? null : current);
    setScheduleModalChildId((current) => current === childId ? null : current);
    setChildModal(null);
  };

  const toggleChildSetting = async (childId, key) => {
    const previousSettings = cloneSafetySettings(settingsByChild[childId]);
    const nextSettings = { ...previousSettings, [key]: !previousSettings[key] };
    setSettingsByChild((current) => ({ ...current, [childId]: nextSettings }));
    try {
      const { child } = await api.updateChild(childId, { settings: nextSettings });
      setSettingsByChild((current) => ({ ...current, [childId]: cloneSafetySettings(child.settings) }));
    } catch {
      setSettingsByChild((current) => ({ ...current, [childId]: previousSettings }));
    }
  };

  const saveChildSchedule = async (childId, schedule) => {
    const nextSchedule = cloneCommunicationSchedule(schedule);
    const { child } = await api.updateChild(childId, { schedule: nextSchedule });
    setSchedulesByChild((current) => ({ ...current, [childId]: cloneCommunicationSchedule(child.schedule) }));
    setScheduleModalChildId(null);
  };

  const openFamilyConversation = async (contactId) => {
    const familyChild = children.find((child) => child.contactId === contactId);
    if (!familyChild) throw new Error("Cet enfant n’appartient pas à votre famille.");

    const { conversation } = await api.openFamilyConversation(contactId);
    const conversationData = await api.conversations();
    applyServerConversations(session, conversationData.conversations, conversationData.syncCursor);
    setSelectedParentThreadId(conversation.id);
    setParentView("messages");
    return conversation.id;
  };

  const openParentThread = (threadId) => {
    setSelectedParentThreadId(threadId);
    if (!threadId) return;
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, unread: 0 } : thread));
  };

  const respondToContactRequest = async (requestId, action) => {
    setContactRequestBusyId(requestId);
    setContactRequestError("");
    try {
      const result = await api.respondToContactRequest(requestId, action);
      setContactRequests((current) => current.map((request) => request.id === requestId ? {
        ...request,
        status: result.request.status,
        conversationId: result.request.conversationId,
        resolvedAt: result.request.resolvedAt,
      } : request));
      const [requestRefresh, conversationRefresh] = await Promise.allSettled([
        api.contactRequests(),
        api.conversations(),
      ]);
      if (requestRefresh.status === "fulfilled") applyContactRequestPayload(requestRefresh.value);
      if (conversationRefresh.status === "fulfilled") {
        applyServerConversations(
          session,
          conversationRefresh.value.conversations,
          conversationRefresh.value.syncCursor,
        );
      }
      if (requestRefresh.status === "rejected" || conversationRefresh.status === "rejected") {
        setContactRequestError("La réponse est enregistrée. L’affichage complet se resynchronisera automatiquement.");
      }
    } catch (error) {
      setContactRequestError(error.message || "La demande n’a pas pu être mise à jour.");
      throw error;
    } finally {
      setContactRequestBusyId("");
    }
  };

  const sendParentMessage = async (threadId, text) => {
    const result = await api.sendMessage(threadId, text);
    const nextMessage = mapServerMessage(result.message, session.id, "sent");
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? {
      ...thread,
      preview: text,
      time: "À l’instant",
      messages: mergeConversationMessages(thread.messages, nextMessage ? [nextMessage] : []),
    } : thread));
    return result.message;
  };

  const sendParentMedia = async (threadId, files) => {
    const { messages } = await api.sendMedia(threadId, files);
    const nextMessages = messages
      .map((message) => mapServerMessage(message, session.id, "sent"))
      .filter(Boolean);
    const latest = nextMessages[nextMessages.length - 1];
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? {
      ...thread,
      preview: latest?.type === "video" ? "Vidéo" : latest?.type === "audio" ? "Message vocal" : "Photo",
      time: "À l’instant",
      messages: appendUniqueMessages(thread.messages, nextMessages),
    } : thread));
    return nextMessages;
  };

  const sendChildMessage = async (conversationId, text) => {
    const { message } = await api.sendMessage(conversationId, text);
    const nextMessage = mapServerMessage(message, session.id, "sent");
    setServerConversations((current) => current.map((conversation) => conversation.id === conversationId ? {
      ...conversation,
      preview: text,
      time: "À l’instant",
      messages: mergeConversationMessages(conversation.messages, nextMessage ? [nextMessage] : []),
    } : conversation));
    setSelectedConversation((current) => current?.id === conversationId ? {
      ...current,
      preview: text,
      time: "À l’instant",
      messages: mergeConversationMessages(current.messages, nextMessage ? [nextMessage] : []),
    } : current);
    return message;
  };

  const sendChildMedia = async (conversationId, files) => {
    const { messages } = await api.sendMedia(conversationId, files);
    const nextMessages = messages
      .map((message) => mapServerMessage(message, session.id, "sent"))
      .filter(Boolean);
    const latest = nextMessages[nextMessages.length - 1];
    const preview = latest?.type === "video" ? "Vidéo" : latest?.type === "audio" ? "Message vocal" : "Photo";
    setServerConversations((current) => current.map((conversation) => conversation.id === conversationId ? {
      ...conversation,
      preview,
      time: "À l’instant",
      messages: appendUniqueMessages(conversation.messages, nextMessages),
    } : conversation));
    setSelectedConversation((current) => current?.id === conversationId ? {
      ...current,
      preview,
      time: "À l’instant",
      messages: appendUniqueMessages(current.messages, nextMessages),
    } : current);
    return nextMessages;
  };

  useEffect(() => {
    if (!session) return undefined;
    if (session.role === "child" && activeChild?.status !== "active") return undefined;
    const timer = window.setInterval(synchronizeConversationState, 15000);
    return () => window.clearInterval(timer);
  }, [activeChild?.status, session?.id, session?.role]);

  useEffect(() => {
    if (session?.role !== "parent") return undefined;
    const refresh = async () => {
      try {
        await refreshContactRequests();
      } catch {
        setContactRequestError("Les demandes de contact ne peuvent pas être actualisées pour le moment.");
      }
    };
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.role]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !session || !hasNativeSession() || session.features?.nativePush !== true) return undefined;
    let disposed = false;
    let nativeDeliveryEnabled = false;
    const listenerHandles = [];
    const platform = Capacitor.getPlatform();

    const rememberHandle = async (handlePromise) => {
      const handle = await handlePromise;
      if (disposed) await handle.remove();
      else listenerHandles.push(handle);
    };

    const syncToken = async (tokenPayload) => {
      const token = String(tokenPayload?.token ?? tokenPayload?.value ?? "").trim();
      if (!token || disposed || !nativeDeliveryEnabled) return false;
      const tokenPlatform = tokenPayload?.platform ?? platform;
      if (tokenPayload?.deviceId) localStorage.setItem(nativeInstallationKey, String(tokenPayload.deviceId));
      if (tokenPayload?.environment) localStorage.setItem(nativeApnsEnvironmentKey, String(tokenPayload.environment));
      await api.saveNativePushToken(token, nativeTokenDetails(tokenPlatform, {
        tokenKind: tokenPayload?.tokenKind ?? (tokenPlatform === "ios" ? "apns_alert" : "fcm"),
        ...(tokenPayload?.deviceId ? { deviceId: String(tokenPayload.deviceId) } : {}),
        ...(tokenPayload?.environment ? { environment: tokenPayload.environment } : {}),
        ...(tokenPayload?.topic ? { topic: tokenPayload.topic } : {}),
      }));
      window.dispatchEvent(new Event("secretclubhouse:native-push-synced"));
      return true;
    };

    const normalizeNativePayload = (rawPayload) => {
      const source = rawPayload?.notification?.data
        ?? rawPayload?.data
        ?? rawPayload?.detail
        ?? rawPayload
        ?? {};
      return {
        ...source,
        notificationType: String(source.notificationType ?? source.notification_type ?? source.type ?? "").replaceAll("_", "-"),
        callId: String(source.callId ?? source.call_id ?? ""),
        conversationId: String(source.conversationId ?? source.conversation_id ?? ""),
        action: String(source.action ?? rawPayload?.actionId ?? rawPayload?.action ?? "open").toLowerCase(),
      };
    };

    const openNativeCall = async (payload) => {
      if (!payload.callId) return false;
      const existingOverlay = callOverlayRef.current;
      if (existingOverlay?.call?.id && existingOverlay.call.id !== payload.callId) return true;
      const result = await api.call(payload.callId);
      const incoming = result.call;
      if (incoming.direction !== "incoming") return true;
      if (["decline", "declined", "cancel", "cancelled"].includes(payload.action) || ["declined", "cancelled", "ended", "missed"].includes(incoming.status)) {
        if (existingOverlay?.call?.id === incoming.id) setCallOverlay(null);
        await synchronizeConversationState();
        return true;
      }
      const acceptedNatively = ["accept", "answer"].includes(payload.action) && incoming.status === "accepted";
      if (existingOverlay?.call?.id === incoming.id && incoming.status === "accepted" && !acceptedNatively) {
        return true;
      }
      if (incoming.status !== "ringing" && !acceptedNatively) return true;
      if (existingOverlay?.call?.id === incoming.id) {
        if (acceptedNatively) {
          setCallOverlay((current) => current?.call?.id === incoming.id ? {
            ...current,
            call: incoming,
            initialIceServers: result.iceServers ?? [],
            acceptedNatively: true,
          } : current);
        }
        return true;
      }
      const context = nativeContextRef.current;
      const knownConversation = [...context.parentThreads, ...context.serverConversations]
        .find((conversation) => conversation.id === incoming.conversationId);
      const conversation = knownConversation ?? {
        id: incoming.conversationId,
        name: incoming.peer?.name ?? "Contact autorisé",
        contactId: incoming.peer?.contactId ?? "",
        contactRole: incoming.peer?.role ?? "",
        serverBacked: true,
      };
      setCallOverlay({
        key: `native-${incoming.id}-${acceptedNatively ? "accepted" : "ringing"}`,
        direction: "incoming",
        conversation,
        callType: incoming.callType,
        policy: { allowed: true, detail: "Appel autorisé par le serveur familial." },
        call: incoming,
        initialIceServers: result.iceServers ?? [],
        acceptedNatively,
      });
      return true;
    };

    const openNativeNotification = async (rawPayload, receivedInForeground = false) => {
      const payload = normalizeNativePayload(rawPayload);
      if (payload.notificationType === "incoming-call" || payload.callId) {
        return openNativeCall(payload);
      }
      if (receivedInForeground) return false;

      const context = nativeContextRef.current;
      if (payload.notificationType === "message" && payload.conversationId) {
        let conversations = context.session?.role === "parent" ? context.parentThreads : context.serverConversations;
        let conversation = conversations.find((item) => item.id === payload.conversationId);
        if (!conversation) {
          const latest = await api.conversations();
          conversations = applyServerConversations(
            context.session,
            latest.conversations,
            latest.syncCursor,
          );
          conversation = conversations.find((item) => item.id === payload.conversationId);
        }
        if (!conversation) return false;
        if (context.session?.role === "parent") {
          setSelectedParentThreadId(conversation.id);
          setParentView("messages");
        } else {
          setActiveTab("conversations");
          setSelectedConversation(conversation);
        }
        return true;
      }
      if (payload.notificationType === "contact-request" && context.session?.role === "parent") {
        await refreshContactRequests();
        setSelectedParentThreadId(null);
        setParentView("management");
        return true;
      }
      if (payload.notificationType === "game") {
        if (context.session?.role === "parent") setParentView("games");
        else {
          setSelectedConversation(null);
          setActiveTab("clubhouse");
        }
        return true;
      }
      return false;
    };

    const handleNativeCallEvent = (event) => {
      void openNativeNotification(event)
        .then((handled) => handled ? NativeCallNotifications.clearPendingState().catch(() => undefined) : undefined)
        .catch(() => undefined);
    };
    const handleNativeTokenEvent = (event) => {
      void syncToken(event?.detail ?? event).catch(() => undefined);
    };
    window.addEventListener("secretclubhouse:native-call-action", handleNativeCallEvent);
    window.addEventListener("secretclubhouse:native-push-token", handleNativeTokenEvent);

    void rememberHandle(PushNotifications.addListener("registration", (token) => {
      void syncToken(token).catch(() => undefined);
    }));
    void rememberHandle(PushNotifications.addListener("pushNotificationReceived", (notification) => {
      void openNativeNotification(notification, true).catch(() => undefined);
    }));
    void rememberHandle(PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      void openNativeNotification(action).catch(() => undefined);
    }));

    void (async () => {
      const pendingState = await NativeCallNotifications.getPendingState().catch(() => ({}));
      if (disposed) return;
      if (pendingState.deviceId) localStorage.setItem(nativeInstallationKey, String(pendingState.deviceId));
      if (pendingState.environment) localStorage.setItem(nativeApnsEnvironmentKey, String(pendingState.environment));
      const permission = await PushNotifications.checkPermissions();
      const consentResult = await api.notificationConsent().catch(() => ({ consent: { active: false } }));
      nativeDeliveryEnabled = permission.receive === "granted"
        && localStorage.getItem(nativePushOptInKey) !== "false"
        && consentResult.consent.active;
      if (nativeDeliveryEnabled && pendingState.voipToken) {
        await syncToken({
          token: pendingState.voipToken,
          platform: "ios",
          tokenKind: "apns_voip",
          deviceId: pendingState.deviceId,
          environment: pendingState.environment,
          topic: pendingState.topic,
        }).catch(() => undefined);
      }
      if (nativeDeliveryEnabled && pendingState.fcmToken) {
        await syncToken({ token: pendingState.fcmToken, platform: "android", tokenKind: "fcm" }).catch(() => undefined);
      }
      if (nativeDeliveryEnabled && pendingState.token) {
        await syncToken(pendingState).catch(() => undefined);
      }
      if (nativeDeliveryEnabled && !disposed) await PushNotifications.register();
      if (pendingState.callId) {
        const handled = await openNativeNotification(pendingState).catch(() => false);
        if (handled) await NativeCallNotifications.clearPendingState().catch(() => undefined);
      }
    })();

    return () => {
      disposed = true;
      window.removeEventListener("secretclubhouse:native-call-action", handleNativeCallEvent);
      window.removeEventListener("secretclubhouse:native-push-token", handleNativeTokenEvent);
      listenerHandles.forEach((handle) => { void handle.remove(); });
    };
  }, [session?.features?.nativePush, session?.id, session?.role]);

  useEffect(() => {
    if (!session || session.features?.rtc !== true) return undefined;
    if (session.role === "child" && activeChild?.status !== "active") return undefined;
    let active = true;
    let openingIncomingCall = false;
    const refreshCalls = async () => {
      if (!active || openingIncomingCall || callOverlayRef.current) return;
      try {
        const result = await api.calls();
        const incoming = (result.calls ?? []).find((item) => item.direction === "incoming" && item.status === "ringing");
        if (!incoming || !active || callOverlayRef.current) return;
        openingIncomingCall = true;
        const knownConversation = [...parentThreads, ...serverConversations]
          .find((conversation) => conversation.id === incoming.conversationId);
        const conversation = knownConversation ?? {
          id: incoming.conversationId,
          name: incoming.peer?.name ?? "Contact autorisé",
          contactId: incoming.peer?.contactId ?? "",
          contactRole: incoming.peer?.role ?? "",
          serverBacked: true,
        };
        setCallOverlay({
          key: incoming.id,
          direction: "incoming",
          conversation,
          callType: incoming.callType,
          policy: { allowed: true, detail: "Appel autorisé par le serveur familial." },
          call: incoming,
        });
        const params = new URLSearchParams(window.location.search);
        if (params.get("notification") === "call") {
          params.delete("notification");
          params.delete("call");
          const query = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
        }
      } catch {
        // La sonnerie réapparaîtra à la prochaine synchronisation si le réseau revient.
      } finally {
        openingIncomingCall = false;
      }
    };
    void refreshCalls();
    const timer = window.setInterval(refreshCalls, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeChild?.status, parentThreads, serverConversations, session?.features?.rtc, session?.id, session?.role]);

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const notificationType = params.get("notification");
    if (!notificationType) return;
    let handled = false;

    if (notificationType === "message") {
      const conversationId = params.get("conversation");
      if (session.role === "parent") {
        const thread = parentThreads.find((item) => item.id === conversationId);
        if (!thread) return;
        setSelectedParentThreadId(thread.id);
        setParentView("messages");
        handled = true;
      } else {
        const conversation = serverConversations.find((item) => item.id === conversationId);
        if (!conversation) return;
        setActiveTab("conversations");
        setSelectedConversation(conversation);
        handled = true;
      }
    } else if (notificationType === "contact-request" && session.role === "parent") {
      void refreshContactRequests().catch(() => {
        setContactRequestError("Les demandes de contact ne peuvent pas être actualisées pour le moment.");
      });
      setSelectedParentThreadId(null);
      setParentView("management");
      handled = true;
    } else if (notificationType === "game") {
      if (session.role === "parent") setParentView("games");
      else {
        setSelectedConversation(null);
        setActiveTab("clubhouse");
      }
      handled = true;
    }

    if (handled) {
      params.delete("notification");
      params.delete("conversation");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, [parentThreads, serverConversations, session]);

  const screen = useMemo(() => {
    if (isRestoringSession) {
      return <section className="session-restoring" role="status" aria-live="polite"><span className="session-restoring__spinner" aria-hidden="true" /><strong>Ouverture de votre Clubhouse…</strong><small>Votre connexion est restaurée.</small></section>;
    }
    if (!session) {
      return <AuthScreen onLogin={loginParent} onRegister={registerParent} onChildLogin={loginChild} hasFamilyInvite={Boolean(familyInviteToken)} familyInvitation={familyInvitation} familyInvitationError={familyInvitationError} isFamilyInvitationLoading={isFamilyInvitationLoading} onDismissFamilyInvite={dismissFamilyInvitation} />;
    }
    if (parentView === "messages") {
      return <ParentMessagesScreen parentName={familyOwner.name} parentContactId={familyOwner.contactId} familyChildren={children} threads={parentThreads} selectedThreadId={selectedParentThreadId} onSelectThread={openParentThread} onLoadOlderMessages={(conversationId) => loadConversationMessages(conversationId, { older: true })} onRetryMessages={(conversationId) => loadConversationMessages(conversationId)} onHome={() => { setSelectedParentThreadId(null); setParentView("dashboard"); }} onManagement={() => { setSelectedParentThreadId(null); setParentView("management"); }} onSend={sendParentMessage} onSendMedia={sendParentMedia} onOpenGames={() => { setSelectedParentThreadId(null); setParentView("games"); }} onOpenFamilyConversation={openFamilyConversation} onStartCall={session.features?.rtc === true ? openRealtimeCall : null} onContactRequestCreated={() => refreshContactRequests()} conversationSyncError={familyConversationSyncError} onRetryConversationSync={() => void retryFamilyConversationSync()} initialContactId={pendingContactId} initialRequesterContactId={pendingRequesterContactId} onContactHandled={() => { setPendingContactId(""); setPendingRequesterContactId(""); }} />;
    }
    if (parentView === "games") {
      return <ParentGamesScreen parent={familyOwner} onBack={() => setParentView("dashboard")} />;
    }
    if (parentView === "dashboard" || parentView === "management") {
      return (
        <ParentDashboard
          activeSection={parentView === "management" ? "management" : "home"}
          onChangeSection={(section) => setParentView(section === "management" ? "management" : "dashboard")}
          parentName={familyOwner.name}
          family={family}
          children={children}
          child={activeChild}
          features={session.features}
          onSelectChild={setActiveChildId}
          onAddChild={() => setChildModal({ mode: "create" })}
          onEditChild={() => setChildModal({ mode: "edit", childId: activeChild.id })}
          onMessageChild={() => activeChild && void openFamilyConversation(activeChild.contactId)}
          settings={activeSettings}
          onToggleSetting={(key) => activeChild && void toggleChildSetting(activeChild.id, key)}
          schedule={activeSchedule}
          contactRequests={contactRequests}
          contactRelationships={contactRelationships}
          contactRequestBusyId={contactRequestBusyId}
          contactRequestError={contactRequestError}
          onRespondToContactRequest={(requestId, action) => void respondToContactRequest(requestId, action).catch(() => undefined)}
          onRetryContactRequests={() => void refreshContactRequests().catch(() => {
            setContactRequestError("Les demandes de contact ne peuvent pas être actualisées pour le moment.");
          })}
          unreadMessages={parentUnreadMessages}
          onOpenMessages={() => { setSelectedParentThreadId(null); setParentView("messages"); }}
          onOpenGames={() => setParentView("games")}
          onOpenFamilyParents={() => setIsFamilyParentsOpen(true)}
          onOpenContactIds={() => setIsContactIdsOpen(true)}
          onOpenPassword={() => setIsParentPasswordOpen(true)}
          onOpenDataRights={() => setIsDataRightsOpen(true)}
          onEditSchedule={() => activeChild && setScheduleModalChildId(activeChild.id)}
          onLogout={logoutParent}
        />
      );
    }
    if (!activeChild) {
      return <NoChildScreen onOpenParent={() => setParentView("dashboard")} />;
    }
    if (activeChild.status === "paused") {
      return <PausedChildScreen child={activeChild} onParentLogin={logoutParent} />;
    }
    if (selectedConversation) {
      return <ChatScreen child={activeChild} conversation={selectedConversation} settings={activeSettings} schedule={activeSchedule} onBack={() => setSelectedConversation(null)} onLoadOlderMessages={(conversationId) => loadConversationMessages(conversationId, { older: true })} onRetryMessages={(conversationId) => loadConversationMessages(conversationId)} onSendMessage={sendChildMessage} onSendMedia={sendChildMedia} onOpenGames={() => { setSelectedConversation(null); setActiveTab("clubhouse"); }} onStartCall={session.features?.rtc === true ? openRealtimeCall : null} />;
    }
    if (activeTab === "clubhouse") {
      return <ClubhouseScreen child={activeChild} />;
    }
    if (isAvatarPreferencesOpen) return <AvatarPreferencesScreen child={activeChild} onBack={() => setIsAvatarPreferencesOpen(false)} onSave={saveAvatar} />;
    if (activeTab === "profile") return <ProfileScreen child={activeChild} features={session.features} onOpenPreferences={() => setIsAvatarPreferencesOpen(true)} onOpenDataRights={() => setIsDataRightsOpen(true)} onLogout={logoutParent} />;
    const availableConversations = serverConversations.map((conversation) => ({ ...conversation, online: presenceByContactId[conversation.contactId] ?? false }));
    const approvedFriends = availableConversations.filter((conversation) => !conversation.isFamily && conversation.contactRole !== "parent");
    return <HomeScreen child={activeChild} approvedFriends={approvedFriends} availableConversations={availableConversations} onQr={() => setIsQrOpen(true)} onOpenConversation={setSelectedConversation} />;
  }, [activeChild, activeSchedule, activeSettings, activeTab, children, contactRelationships, contactRequestBusyId, contactRequestError, contactRequests, family, familyConversationSyncError, familyInvitation, familyInvitationError, familyInviteToken, familyOwner, isAvatarPreferencesOpen, isFamilyInvitationLoading, isRestoringSession, parentThreads, parentUnreadMessages, parentView, pendingContactId, pendingRequesterContactId, presenceByContactId, selectedConversation, selectedParentThreadId, serverConversations, session]);

  const changeTab = (tab) => {
    const scrollContainer = dragScrollRef.current?.querySelector(".screen-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
    setSelectedConversation(null);
    setIsAvatarPreferencesOpen(false);
    setActiveTab(tab);
  };

  return (
    <main className="app-stage">
      <div className="mobile-prototype" ref={dragScrollRef}>
        <div className={`screen-scroll ${activeTab === "profile" && session && !parentView ? "screen-scroll--profile" : ""} ${!session || selectedConversation || parentView || isAvatarPreferencesOpen || activeChild?.status === "paused" || !activeChild ? "screen-scroll--full" : ""}`}>
          <Suspense fallback={<FeatureLoading />}>{screen}</Suspense>
        </div>
        {session && !selectedConversation && !parentView && !isAvatarPreferencesOpen && activeChild?.status === "active" && <BottomNavigation active={activeTab} onChange={changeTab} />}
        <Suspense fallback={null}>
          {session && callOverlay && <div className="realtime-call-layer">
            <RealtimeCallScreen
              key={callOverlay.key}
              account={{ ...session, name: session.name || familyOwner.name || "Vous" }}
              conversation={callOverlay.conversation}
              callType={callOverlay.callType}
              direction={callOverlay.direction}
              initialCall={callOverlay.call}
              initialIceServers={callOverlay.initialIceServers}
              acceptedNatively={callOverlay.acceptedNatively}
              policy={callOverlay.policy}
              onConversationRefresh={synchronizeConversationState}
              onClose={closeRealtimeCall}
            />
          </div>}
          {isQrOpen && activeChild && <QrModal child={activeChild} onClose={() => setIsQrOpen(false)} onRequestAdd={requestFriendWithParent} />}
          {session && isContactIdsOpen && <ContactIdsModal parent={familyOwner} family={family} children={children} onClose={() => setIsContactIdsOpen(false)} />}
          {session?.role === "parent" && isParentPasswordOpen && <ParentPasswordModal onClose={() => setIsParentPasswordOpen(false)} onSave={changeParentPassword} />}
          {session && isDataRightsOpen && <DataRightsModal account={session.role === "child" ? activeChild : session} family={family} children={children} onClose={() => setIsDataRightsOpen(false)} onDeleted={logoutParent} />}
          {session?.role === "parent" && isFamilyParentsOpen && family && <FamilyParentsModal family={family} currentParent={session} onClose={() => setIsFamilyParentsOpen(false)} onInvite={inviteFamilyParent} onRevoke={revokeFamilyInvitation} onRemove={removeFamilyParent} />}
          {session && childModal && (
            <ChildAccountModal
              key={`${childModal.mode}-${childModal.childId ?? "new"}`}
              child={childModal.mode === "edit" ? children.find((child) => child.id === childModal.childId) : null}
              canDelete={family?.role === "primary"}
              onClose={() => setChildModal(null)}
              onSave={saveChild}
              onDelete={deleteChild}
            />
          )}
          {session && scheduleModalChildId && (
            <ScheduleModal
              key={`schedule-${scheduleModalChildId}`}
              childName={children.find((child) => child.id === scheduleModalChildId)?.name ?? "cet enfant"}
              schedule={schedulesByChild[scheduleModalChildId] ?? defaultCommunicationSchedule}
              onClose={() => setScheduleModalChildId(null)}
              onSave={(schedule) => saveChildSchedule(scheduleModalChildId, schedule)}
            />
          )}
          {session?.role === "parent" && familyInvitation && familyInviteToken && !isFamilyInvitationLoading && <FamilyInviteAcceptanceModal invitation={familyInvitation} parent={session} onAccept={acceptCurrentFamilyInvitation} onUseAnotherAccount={useAnotherAccountForFamilyInvitation} onDismiss={dismissFamilyInvitation} />}
          {session?.role === "parent" && familyInviteToken && familyInvitationError && !isFamilyInvitationLoading && <FamilyInviteErrorModal message={familyInvitationError} onDismiss={dismissFamilyInvitation} />}
        </Suspense>
      </div>
    </main>
  );
}
