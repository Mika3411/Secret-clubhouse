import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";

export const clearContactRequestFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  params.delete("contact");
  params.delete("requester");
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
};

export const defaultSafetySettings = { media: true };

export const defaultCommunicationSchedule = {
  enabled: true,
  messages: { enabled: true, start: "07:30", end: "20:30" },
  calls: { enabled: true, start: "08:00", end: "19:30" },
  video: { enabled: false, start: "09:00", end: "18:30" },
  autoReply: { enabled: true, message: "Je ne peux pas répondre pour le moment." },
};

export const cloneSafetySettings = (settings = defaultSafetySettings) => ({ ...defaultSafetySettings, ...settings });

export const cloneCommunicationSchedule = (schedule = defaultCommunicationSchedule) => ({
  ...defaultCommunicationSchedule,
  ...schedule,
  messages: { ...defaultCommunicationSchedule.messages, ...schedule.messages },
  calls: { ...defaultCommunicationSchedule.calls, ...schedule.calls },
  video: { ...defaultCommunicationSchedule.video, ...schedule.video },
  autoReply: { ...defaultCommunicationSchedule.autoReply, ...schedule.autoReply },
});

export const formatServerMessageTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Maintenant";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
};

export const mapServerMessage = (message, accountId, directionOverride = null) => {
  const mediaType = message.mediaType ?? message.media_type ?? "";
  const mediaName = message.mediaName ?? message.media_name ?? "";
  const createdAt = message.createdAt ?? message.created_at;
  const senderId = message.senderId ?? message.sender_id;
  const messageKind = message.messageKind ?? message.message_kind ?? "user";
  const direction = directionOverride ?? (senderId === accountId ? "sent" : "received");
  const status = direction === "sent"
    ? message.deliveryStatus ?? message.delivery_status ?? "sent"
    : null;
  const baseMessage = {
    id: message.id,
    direction,
    messageKind,
    createdAt,
    syncVersion: String(message.syncVersion ?? message.sync_version ?? "0"),
    time: formatServerMessageTime(createdAt),
    status,
  };
  if (mediaType.startsWith("audio/")) {
    const durationMatch = mediaName.match(/-(\d{1,3})s(?:\.|$)/i);
    return {
      ...baseMessage,
      type: "audio",
      mediaType,
      name: mediaName,
      duration: durationMatch ? Math.min(120, Number(durationMatch[1])) : 0,
    };
  }
  if (mediaType.startsWith("image/") || mediaType.startsWith("video/")) {
    return {
      ...baseMessage,
      type: mediaType.startsWith("video/") ? "video" : "image",
      mediaType,
      name: mediaName,
    };
  }
  const text = String(message.text ?? message.body ?? "").trim();
  if (!text) return null;
  return {
    ...baseMessage,
    type: "text",
    text,
  };
};

export const mergeConversationMessages = (currentMessages = [], incomingMessages = []) => {
  const orderedIds = [];
  const byId = new Map();
  [...currentMessages, ...incomingMessages].forEach((message) => {
    if (!message?.id) return;
    if (!byId.has(message.id)) orderedIds.push(message.id);
    byId.set(message.id, { ...(byId.get(message.id) ?? {}), ...message });
  });
  const originalOrder = new Map(orderedIds.map((id, index) => [id, index]));
  return [...byId.values()].sort((left, right) => {
    const leftTime = new Date(left.createdAt ?? "").getTime();
    const rightTime = new Date(right.createdAt ?? "").getTime();
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0);
  });
};

export const appendUniqueMessages = mergeConversationMessages;

export const mapServerConversation = (conversation, account) => {
  const hasEmbeddedMessages = Array.isArray(conversation.messages);
  const messages = (hasEmbeddedMessages ? conversation.messages : [])
    .map((message) => mapServerMessage(message, account.id))
    .filter(Boolean);
  const summaryLatest = conversation.latest_message ?? conversation.latestMessage;
  const latest = summaryLatest
    ? mapServerMessage(summaryLatest, account.id)
    : messages[messages.length - 1];
  const latestPreview = latest?.type === "video" ? "Vidéo" : latest?.type === "image" ? "Photo" : latest?.type === "audio" ? "Message vocal" : latest?.text;
  const initials = String(conversation.name ?? "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const isFamily = conversation.kind === "child" && (
    (account.role === "parent" && conversation.contact_role === "child")
    || (account.role === "child" && conversation.contact_role === "parent")
  );
  const isHouseholdParent = conversation.kind === "parent" && conversation.contact_role === "parent" && Boolean(conversation.is_family_member);
  return {
    id: conversation.id,
    name: conversation.name,
    contactId: conversation.contact_id,
    contactRole: conversation.contact_role,
    contactStatus: conversation.contact_status ?? "active",
    schedule: cloneCommunicationSchedule(conversation.communication_schedule ?? defaultCommunicationSchedule),
    isFamily,
    isHouseholdParent,
    serverBacked: true,
    relation: isFamily ? (account.role === "parent" ? "Mon enfant" : "Mon parent") : isHouseholdParent ? "Parent de ma famille" : "Parent d’un contact",
    initials,
    preview: latestPreview ?? (isFamily || isHouseholdParent ? "Commencez votre conversation familiale." : "Nouvelle conversation"),
    time: latest?.time ?? "Maintenant",
    unread: Number(conversation.unread_count ?? conversation.unreadCount ?? 0),
    messages,
    messagesLoaded: hasEmbeddedMessages,
    messagesLoading: false,
    messagesError: "",
    messageCursor: null,
    hasMoreMessages: false,
    ActivityIcon: ChatCircleDots,
    received: messages.filter((message) => message.direction === "received" && message.type === "text").map((message) => message.text),
    sent: messages.filter((message) => message.direction === "sent" && message.type === "text").at(-1)?.text ?? "",
  };
};
