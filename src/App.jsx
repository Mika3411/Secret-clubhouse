import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Bell,
  Brain,
  CaretRight,
  ChatCircleDots,
  Check,
  CheckCircle,
  Checks,
  Clock,
  Copy,
  DotsThree,
  DownloadSimple,
  Eye,
  EyeSlash,
  FlagPennant,
  GameController,
  GearSix,
  House,
  IdentificationCard,
  Lightning,
  LockKey,
  LockKeyOpen,
  Microphone,
  MicrophoneSlash,
  PaperPlaneTilt,
  PencilSimple,
  PuzzlePiece,
  Phone,
  PhoneDisconnect,
  Plus,
  QrCode,
  Shield,
  ShieldCheck,
  SignOut,
  Smiley,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  Star,
  Timer,
  Trash,
  Trophy,
  UserCircle,
  UserPlus,
  UsersThree,
  VideoCamera,
  VideoCameraSlash,
  Waveform,
  WaveSine,
  X,
} from "@phosphor-icons/react";
import { createLocalWebRtcSession, createRemoteAudioPlaceholder, createRemoteVideoPlaceholder, getChannelPolicy, openCameraStream, openMicrophoneStream, stopMediaStream } from "./webrtc";
import { api, clearToken, getToken } from "./api";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import PhaserMemoryGame from "./PhaserMemoryGame";
import ConnectFourGame from "./ConnectFourGame";

const rememberedParentEmailKey = "secret-clubhouse-parent-email";
const familyInviteQueryKeys = ["familyInvite", "family-invite", "invite"];

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

const defaultSafetySettings = { media: true };

const defaultCommunicationSchedule = {
  enabled: true,
  messages: { enabled: true, start: "07:30", end: "20:30" },
  calls: { enabled: true, start: "08:00", end: "19:30" },
  video: { enabled: false, start: "09:00", end: "18:30" },
  autoReply: { enabled: true, message: "Je suis en mode calme pour le moment. Je te répondrai pendant mes horaires autorisés." },
};

const cloneSafetySettings = (settings = defaultSafetySettings) => ({ ...defaultSafetySettings, ...settings });

const cloneCommunicationSchedule = (schedule = defaultCommunicationSchedule) => ({
  ...defaultCommunicationSchedule,
  ...schedule,
  messages: { ...defaultCommunicationSchedule.messages, ...schedule.messages },
  calls: { ...defaultCommunicationSchedule.calls, ...schedule.calls },
  video: { ...defaultCommunicationSchedule.video, ...schedule.video },
  autoReply: { ...defaultCommunicationSchedule.autoReply, ...schedule.autoReply },
});

const clubhouseActivities = [
  {
    id: "color-hunt",
    type: "challenge",
    featured: true,
    title: "La chasse aux couleurs",
    description: "Trouve cinq objets de couleurs différentes autour de toi.",
    duration: 5,
    reward: 25,
    Icon: Sparkle,
    tone: "mint",
    steps: ["Choisis cinq couleurs", "Trouve un objet pour chaque couleur", "Raconte ta meilleure trouvaille à un ami"],
  },
  {
    id: "one-line-drawing",
    type: "challenge",
    title: "Dessin en un trait",
    description: "Dessine un animal sans lever ton crayon.",
    duration: 4,
    reward: 20,
    Icon: PencilSimple,
    tone: "violet",
    steps: ["Choisis ton animal", "Pose ton crayon et ne le lève plus", "Ajoute un nom rigolo à ton dessin"],
  },
  {
    id: "mystery-mime",
    type: "challenge",
    title: "Le mime mystère",
    description: "Fais deviner une activité sans prononcer un mot.",
    duration: 6,
    reward: 30,
    Icon: UsersThree,
    tone: "coral",
    steps: ["Choisis une activité secrète", "Mime-la pendant trente secondes", "Laisse les autres proposer une réponse"],
  },
  {
    id: "connect-four",
    type: "game",
    variant: "connect-four",
    title: "Puissance 4 à deux",
    description: "Invite un contact approuvé et joue chacun ton tour.",
    duration: 8,
    reward: 40,
    Icon: UsersThree,
    tone: "blue",
  },
  {
    id: "memory-pairs",
    type: "game",
    variant: "memory",
    title: "Memory des symboles",
    description: "Retourne les cartes et retrouve les six paires.",
    duration: 4,
    reward: 30,
    Icon: GameController,
    tone: "violet",
  },
  {
    id: "nature-quiz",
    type: "game",
    title: "Quiz des animaux",
    description: "Teste tes connaissances avec trois nouvelles questions à chaque partie.",
    duration: 3,
    reward: 20,
    Icon: Brain,
    tone: "sun",
    questions: [
      { prompt: "Quel animal dort debout ?", answers: ["Le cheval", "Le dauphin", "Le lapin"], correct: 0 },
      { prompt: "Quel animal peut changer de couleur ?", answers: ["Le panda", "Le caméléon", "La loutre"], correct: 1 },
      { prompt: "Quel animal est le plus grand ?", answers: ["L’éléphant", "La baleine bleue", "La girafe"], correct: 1 },
      { prompt: "Quel animal construit des barrages ?", answers: ["Le castor", "Le renard", "Le koala"], correct: 0 },
      { prompt: "Quel animal porte son bébé dans une poche ?", answers: ["Le kangourou", "Le zèbre", "Le phoque"], correct: 0 },
      { prompt: "Quel animal a huit bras ?", answers: ["Le crabe", "La pieuvre", "L’étoile de mer"], correct: 1 },
      { prompt: "Quel oiseau ne peut pas voler ?", answers: ["Le moineau", "Le manchot", "L’hirondelle"], correct: 1 },
      { prompt: "Quel animal possède une trompe ?", answers: ["L’éléphant", "L’hippopotame", "Le rhinocéros"], correct: 0 },
      { prompt: "Quel animal fabrique du miel ?", answers: ["La fourmi", "L’abeille", "La coccinelle"], correct: 1 },
      { prompt: "Quel animal est couvert de piquants ?", answers: ["Le hérisson", "La taupe", "Le hamster"], correct: 0 },
      { prompt: "Quel animal vit dans une ruche ?", answers: ["Le papillon", "L’abeille", "La libellule"], correct: 1 },
      { prompt: "Quel animal a un très long cou ?", answers: ["La girafe", "Le lion", "Le gorille"], correct: 0 },
    ],
  },
  {
    id: "odd-one-out",
    type: "game",
    title: "Trouve l’intrus",
    description: "Observe bien et choisis l’élément qui ne va pas avec les autres.",
    duration: 3,
    reward: 20,
    Icon: PuzzlePiece,
    tone: "blue",
    questions: [
      { prompt: "Quel mot n’est pas une couleur ?", answers: ["Violet", "Banane", "Menthe"], correct: 1 },
      { prompt: "Lequel ne vole pas ?", answers: ["Papillon", "Aigle", "Dauphin"], correct: 2 },
      { prompt: "Lequel n’est pas un sport ?", answers: ["Basket", "Piano", "Natation"], correct: 1 },
      { prompt: "Lequel n’est pas un fruit ?", answers: ["Pomme", "Carotte", "Poire"], correct: 1 },
      { prompt: "Lequel ne vit pas dans l’eau ?", answers: ["Dauphin", "Requin", "Écureuil"], correct: 2 },
      { prompt: "Lequel n’est pas un instrument ?", answers: ["Guitare", "Trompette", "Trottinette"], correct: 2 },
      { prompt: "Lequel n’est pas un vêtement ?", answers: ["Bonnet", "Nuage", "Manteau"], correct: 1 },
      { prompt: "Lequel n’est pas un moyen de transport ?", answers: ["Train", "Vélo", "Canapé"], correct: 2 },
      { prompt: "Lequel n’est pas une saison ?", answers: ["Printemps", "Mercredi", "Automne"], correct: 1 },
      { prompt: "Lequel n’est pas une forme ?", answers: ["Triangle", "Cercle", "Chocolat"], correct: 2 },
      { prompt: "Lequel ne pousse pas dans un jardin ?", answers: ["Tomate", "Tulipe", "Téléphone"], correct: 2 },
      { prompt: "Lequel n’est pas dans l’espace ?", answers: ["Planète", "Étoile", "Bicyclette"], correct: 2 },
    ],
  },
];

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

const formatServerMessageTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Maintenant";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
};

const mapServerMessage = (message, accountId, directionOverride = null) => {
  const mediaType = message.mediaType ?? message.media_type ?? "";
  const mediaName = message.mediaName ?? message.media_name ?? "";
  const createdAt = message.createdAt ?? message.created_at;
  const senderId = message.senderId ?? message.sender_id;
  const direction = directionOverride ?? (senderId === accountId ? "sent" : "received");
  if (mediaType.startsWith("audio/")) {
    const durationMatch = mediaName.match(/-(\d{1,3})s(?:\.|$)/i);
    return {
      id: message.id,
      direction,
      type: "audio",
      mediaType,
      name: mediaName,
      duration: durationMatch ? Math.min(120, Number(durationMatch[1])) : 0,
      time: formatServerMessageTime(createdAt),
      status: "received",
    };
  }
  if (mediaType.startsWith("image/") || mediaType.startsWith("video/")) {
    return {
      id: message.id,
      direction,
      type: mediaType.startsWith("video/") ? "video" : "image",
      mediaType,
      name: mediaName,
      time: formatServerMessageTime(createdAt),
      status: "received",
    };
  }
  const text = String(message.text ?? message.body ?? "").trim();
  if (!text) return null;
  return {
    id: message.id,
    direction,
    type: "text",
    text,
    time: formatServerMessageTime(createdAt),
    status: "received",
  };
};

const appendUniqueMessages = (currentMessages, incomingMessages) => {
  const existingIds = new Set(currentMessages.map((message) => message.id));
  return [...currentMessages, ...incomingMessages.filter((message) => !existingIds.has(message.id))];
};

const mapServerConversation = (conversation, account) => {
  const messages = (Array.isArray(conversation.messages) ? conversation.messages : [])
    .map((message) => mapServerMessage(message, account.id))
    .filter(Boolean);
  const latest = messages[messages.length - 1];
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
    isFamily,
    isHouseholdParent,
    serverBacked: true,
    relation: isFamily ? (account.role === "parent" ? "Mon enfant" : "Mon parent") : isHouseholdParent ? "Parent de ma famille" : "Parent d’un contact",
    initials,
    preview: latestPreview ?? (isFamily || isHouseholdParent ? "Commencez votre conversation familiale." : "Nouvelle conversation"),
    time: latest?.time ?? "Maintenant",
    unread: 0,
    messages,
    ActivityIcon: ChatCircleDots,
    received: messages.filter((message) => message.direction === "received" && message.type === "text").map((message) => message.text),
    sent: messages.filter((message) => message.direction === "sent" && message.type === "text").at(-1)?.text ?? "",
  };
};

async function copyContactId(contactId) {
  try {
    await navigator.clipboard.writeText(contactId);
  } catch {
    // Le statut visuel reste utile dans ce prototype, même sans permission presse-papiers.
  }
}

function Avatar({ person, size = "medium", online = null }) {
  return (
    <span className={`avatar avatar--${size} avatar--tone-${person.color ?? "default"}`}>
      {person.avatar ? <AvatarIllustration avatar={person.avatar} name={person.name} /> : person.image ? <img src={person.image} alt={`Avatar de ${person.name}`} /> : <span className="avatar__fallback" role="img" aria-label={`Avatar de ${person.name}`}>{person.name.slice(0, 1)}</span>}
      {online !== null && <span className={`online-dot ${online ? "is-online" : "is-offline"}`} aria-label={online ? "En ligne" : "Hors ligne"} title={online ? "En ligne" : "Hors ligne"} />}
    </span>
  );
}

const defaultAvatar = { hair: "bob", hairColor: "brown", face: "smile", skin: "warm", outfit: "mint" };
const avatarPalette = {
  skin: { light: "#f9d8c2", porcelain: "#f4cdb5", warm: "#eeb992", peach: "#dfa47d", tan: "#c98960", olive: "#b87955", caramel: "#a96d48", brown: "#925a3b", deep: "#704634", ebony: "#4d3028" },
  hairColor: { brown: "#6b3f2a", black: "#201b2c", blond: "#e8b94f", ginger: "#bd5b35", violet: "#6650c7", chestnut: "#8b4a38", pink: "#d86f9d", blue: "#436fc4", teal: "#278f8a", silver: "#aaa9bc" },
  outfit: { mint: "#69e4c3", violet: "#8c75e7", coral: "#ff8d83", sun: "#f5c451", blue: "#63b7e8", rose: "#e783ae", teal: "#42bdb2", navy: "#45478f", lilac: "#b99ae9", orange: "#ee9854" },
};

function AvatarIllustration({ avatar = defaultAvatar, name = "Mon avatar" }) {
  const config = { ...defaultAvatar, ...avatar };
  const skin = avatarPalette.skin[config.skin];
  const hair = avatarPalette.hairColor[config.hairColor];
  const outfit = avatarPalette.outfit[config.outfit];
  return (
    <svg className="avatar-illustration" viewBox="0 0 120 120" role="img" aria-label={`Avatar personnalisé de ${name}`}>
      <circle cx="60" cy="60" r="60" fill="#d9d0ff" />
      <path d="M17 120c4-25 20-38 43-38s39 13 43 38" fill={outfit} />
      <path d="M39 80h42v20c-12 9-30 9-42 0z" fill={skin} />
      <ellipse cx="60" cy="54" rx="31" ry="35" fill={skin} />
      {config.hair === "short" && <path d="M30 48c0-28 18-38 34-36 19 2 28 18 26 39-8-14-21-18-35-16-10 2-18 7-25 13z" fill={hair} />}
      {config.hair === "bob" && <path d="M27 55c-2-28 13-45 34-45 23 0 37 17 34 48l-9 19-5-32c-15-13-30-10-44 1l-4 31z" fill={hair} />}
      {config.hair === "curly" && <g fill={hair}><circle cx="37" cy="30" r="14"/><circle cx="53" cy="21" r="15"/><circle cx="70" cy="22" r="15"/><circle cx="84" cy="34" r="14"/><circle cx="31" cy="48" r="12"/><circle cx="89" cy="50" r="12"/></g>}
      {config.hair === "spiky" && <path d="M29 49l5-27 9 9 5-21 12 15 12-18 4 22 15-9-3 32c-16-18-42-20-59-3z" fill={hair} />}
      {config.hair === "bun" && <><circle cx="61" cy="13" r="15" fill={hair}/><path d="M29 51c0-27 14-40 32-40s31 14 31 40c-17-18-43-18-63 0z" fill={hair}/></>}
      {config.hair === "long" && <path d="M26 55c-2-29 13-46 35-46 23 0 37 18 34 49l-5 35-12-8 3-42c-14-11-29-9-42 2l3 40-12 8z" fill={hair}/>}
      {config.hair === "braids" && <><path d="M29 50c0-26 14-40 32-40s31 14 31 40c-18-17-43-17-63 0z" fill={hair}/><path d="M31 48q-9 20 2 42M89 48q9 20-2 42" fill="none" stroke={hair} strokeWidth="8" strokeLinecap="round" strokeDasharray="5 3"/></>}
      {config.hair === "afro" && <g fill={hair}><circle cx="29" cy="43" r="17"/><circle cx="36" cy="25" r="18"/><circle cx="54" cy="15" r="18"/><circle cx="74" cy="17" r="18"/><circle cx="89" cy="32" r="18"/><circle cx="91" cy="51" r="15"/></g>}
      {config.hair === "ponytail" && <><circle cx="91" cy="31" r="17" fill={hair}/><path d="M29 51c0-27 14-41 32-41s31 14 31 41c-18-17-43-17-63 0z" fill={hair}/></>}
      {config.hair === "waves" && <path d="M27 58c-3-31 12-49 34-49 24 0 39 19 35 51-5-10-10-15-16-19-4 7-10 9-16 2-6 7-13 7-18 0-6 4-11 9-19 15z" fill={hair}/>}
      {!["happy", "laugh", "wink", "surprised", "star"].includes(config.face) && <><circle cx="48" cy="55" r="3.2" fill="#171044"/><circle cx="72" cy="55" r="3.2" fill="#171044"/></>}
      {config.face === "smile" && <path d="M50 69q10 9 20 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/>}
      {config.face === "happy" && <><path d="M45 55q3-5 6 0M69 55q3-5 6 0" fill="none" stroke="#171044" strokeWidth="3" strokeLinecap="round"/><path d="M49 68q11 13 22 0" fill="#fff" stroke="#8d4150" strokeWidth="2"/></>}
      {config.face === "calm" && <path d="M52 70q8 3 16 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/>}
      {config.face === "freckles" && <><path d="M50 69q10 8 20 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/><g fill="#a8634f"><circle cx="40" cy="64" r="1.4"/><circle cx="45" cy="66" r="1.2"/><circle cx="80" cy="64" r="1.4"/><circle cx="75" cy="66" r="1.2"/></g></>}
      {config.face === "wink" && <><circle cx="48" cy="55" r="3.2" fill="#171044"/><path d="M68 55q4 3 8 0M50 69q10 8 20 0" fill="none" stroke="#171044" strokeWidth="3" strokeLinecap="round"/></>}
      {config.face === "laugh" && <><path d="M44 55q4-6 8 0M68 55q4-6 8 0" fill="none" stroke="#171044" strokeWidth="3" strokeLinecap="round"/><path d="M48 68q12 17 24 0z" fill="#8d4150"/></>}
      {config.face === "surprised" && <><circle cx="48" cy="55" r="3.2" fill="#171044"/><circle cx="72" cy="55" r="3.2" fill="#171044"/><circle cx="60" cy="72" r="5" fill="none" stroke="#8d4150" strokeWidth="3"/></>}
      {config.face === "shy" && <><path d="M52 70q8 5 16 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/><circle cx="40" cy="66" r="5" fill="#e9969d" opacity=".55"/><circle cx="80" cy="66" r="5" fill="#e9969d" opacity=".55"/></>}
      {config.face === "star" && <><path d="M48 49l2 4 5 .5-4 3 1 5-4-2-4 2 1-5-4-3 5-.5zM72 49l2 4 5 .5-4 3 1 5-4-2-4 2 1-5-4-3 5-.5z" fill="#392b82"/><path d="M49 68q11 13 22 0" fill="#fff" stroke="#8d4150" strokeWidth="2"/></>}
      {config.face === "confident" && <><path d="M43 49l10-2M67 47l10 2M51 70q9 7 18 0" fill="none" stroke="#171044" strokeWidth="2.5" strokeLinecap="round"/></>}
      <path d="M60 58l-2 6h4" fill="none" stroke="#b87962" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M43 93l17 12 17-12" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="Secret Clubhouse">
      <span className="brand-mark" aria-hidden="true">
        <FlagPennant size={43} weight="fill" />
        <House className="brand-mark__house" size={10} weight="fill" />
      </span>
      <span>Secret<br />Clubhouse</span>
    </div>
  );
}

function AuthScreen({ onLogin, onRegister, onChildLogin, hasFamilyInvite = false, familyInvitation, familyInvitationError, isFamilyInvitationLoading = false, onDismissFamilyInvite }) {
  const [audience, setAudience] = useState("parent");
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => localStorage.getItem(rememberedParentEmailKey) ?? "");
  const [childContactId, setChildContactId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!familyInvitation?.email) return;
    setAudience("parent");
    setEmail(familyInvitation.email);
  }, [familyInvitation?.email]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  const changeAudience = (nextAudience) => {
    if (hasFamilyInvite) return;
    setAudience(nextAudience);
    setMode("login");
    setPassword("");
    setError("");
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    if (audience === "child") {
      const cleanContactId = childContactId.trim().toUpperCase();
      if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(cleanContactId) || password.length < 6) {
        setError("Saisis ton identifiant unique au format SC-000-000-000 et ton mot de passe.");
        return;
      }
      if (!await onChildLogin(cleanContactId, password)) {
        setError("Identifiant ou mot de passe incorrect.");
      }
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@") || password.length < 8) {
      setError("Saisissez une adresse e-mail valide et un mot de passe de 8 caractères minimum.");
      return;
    }
    if (mode === "register") {
      if (name.trim().length < 2 || !consent) {
        setError("Indiquez votre prénom et confirmez que vous êtes le parent ou responsable légal.");
        return;
      }
      try {
        await onRegister({ name: name.trim(), email: cleanEmail, password });
      } catch (authError) {
        setError(authError.message);
      }
      return;
    }
    try {
      await onLogin({ email: cleanEmail, password });
    } catch (authError) {
      setError(authError.message);
    }
  };

  return (
    <section className="auth-screen" aria-labelledby="auth-title">
      <div className="auth-screen__decor" aria-hidden="true"><Star size={38} weight="fill" /><Lightning size={48} weight="fill" /><WaveSine size={38} weight="bold" /></div>
      <header className="auth-header"><Brand /><span><ShieldCheck size={16} weight="fill" /> Pensé pour les familles</span></header>
      <div className="auth-layout">
        <div className="auth-intro">
          <span className="auth-kicker">Messagerie 6–13 ans</span>
          <h1 id="auth-title">Des amis choisis.<br />Des parents rassurés.</h1>
          <p>Créez les profils de vos enfants et approuvez chaque contact, sans numéro de téléphone.</p>
          <div className="auth-trust"><span><CheckCircle size={17} weight="fill" /> Identifiants privés</span><span><ShieldCheck size={17} weight="fill" /> Contacts approuvés</span></div>
        </div>

        <div className="auth-card">
          {hasFamilyInvite && <div className={`family-invite-auth-note ${familyInvitationError ? "has-error" : ""}`} role="status">
            <span><UsersThree size={22} weight="fill" /></span>
            <div>
              <strong>{isFamilyInvitationLoading ? "Vérification de l’invitation…" : familyInvitationError ? "Cette invitation n’est plus disponible" : `${familyInvitation.invitedByName} vous invite comme co-parent`}</strong>
              <small>{isFamilyInvitationLoading ? "Un instant, nous vérifions le lien sécurisé." : familyInvitationError || `Connectez-vous ou créez votre compte ${familyInvitation.email ? `avec ${familyInvitation.email}` : "parent"}.`}</small>
            </div>
            {familyInvitationError && <button type="button" onClick={onDismissFamilyInvite}>Continuer sans invitation</button>}
          </div>}

          {!hasFamilyInvite && <div className="auth-role-tabs" role="tablist" aria-label="Choisir son espace">
            <button type="button" role="tab" aria-selected={audience === "parent"} className={audience === "parent" ? "is-active" : ""} onClick={() => changeAudience("parent")}><ShieldCheck size={17} weight="fill" /> Parent</button>
            <button type="button" role="tab" aria-selected={audience === "child"} className={audience === "child" ? "is-active" : ""} onClick={() => changeAudience("child")}><Smiley size={17} weight="fill" /> Enfant</button>
          </div>}

          {audience === "parent" && <div className="auth-tabs" role="tablist" aria-label="Accès au compte parent">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")}>Connexion</button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => changeMode("register")}>Inscription</button>
          </div>}

          <form className="auth-form" onSubmit={submitAuth}>
            <div className="auth-form__heading"><span className="auth-lock">{audience === "child" ? <Smiley size={23} weight="fill" /> : <LockKey size={22} weight="fill" />}</span><div><h2>{audience === "child" ? "Salut !" : hasFamilyInvite ? mode === "login" ? "Accepter avec mon compte" : "Créer mon accès co-parent" : mode === "login" ? "Ravi de vous revoir" : "Créer le compte parent"}</h2><p>{audience === "child" ? "Entre dans ton Clubhouse." : hasFamilyInvite ? "Chaque adulte garde ses propres identifiants." : mode === "login" ? "Accédez à votre espace familial." : "Commencez par les informations de l’adulte."}</p></div></div>
            {audience === "parent" && mode === "register" && <label className="auth-field"><span>Prénom du parent</span><input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} autoComplete="given-name" placeholder="Marie" /></label>}
            {audience === "parent" ? <label className="auth-field"><span>Adresse e-mail</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" placeholder="parent@exemple.fr" readOnly={Boolean(familyInvitation?.email)} /></label> : <label className="auth-field"><span>Ton identifiant unique</span><input value={childContactId} onChange={(event) => { setChildContactId(event.target.value.toUpperCase().slice(0, 14)); setError(""); }} autoComplete="username" autoCapitalize="characters" spellCheck="false" placeholder="SC-123-456-789" /></label>}
            <label className="auth-field"><span>Mot de passe</span><span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="6 caractères minimum" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>{showPassword ? <EyeSlash size={21} weight="bold" /> : <Eye size={21} weight="bold" />}</button></span></label>
            {audience === "parent" && mode === "register" && (
              <label className="auth-consent"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setError(""); }} /><span>Je confirme être le parent ou le responsable légal des enfants que j’ajouterai.</span></label>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={isFamilyInvitationLoading || Boolean(familyInvitationError)}>{audience === "child" || mode === "login" ? <LockKeyOpen size={19} weight="fill" /> : <UserPlus size={19} weight="fill" />}{audience === "child" ? "Entrer dans mon espace" : hasFamilyInvite ? mode === "login" ? "Se connecter et accepter" : "Créer et rejoindre la famille" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
          </form>

          <p className="auth-legal"><LockKey size={13} weight="fill" /> Les comptes réels sont protégés et enregistrés sur le serveur familial. <button type="button" onClick={() => setIsTermsOpen(true)}>CGV</button></p>
        </div>
      </div>
      {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} />}
    </section>
  );
}

function TermsModal({ onClose }) {
  return (
    <div className="terms-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <header className="terms-modal__header">
          <div><span>Informations légales</span><h2 id="terms-title">Conditions générales de vente</h2><small>Version du 22 juillet 2026</small></div>
          <button type="button" onClick={onClose} aria-label="Fermer les conditions générales de vente"><X size={21} weight="bold" /></button>
        </header>
        <div className="terms-modal__content">
          <aside><ShieldCheck size={20} weight="fill" /><span><strong>Document provisoire</strong> Ces CGV doivent être complétées avec l’identité de l’éditeur, les tarifs définitifs et validées par un professionnel du droit avant commercialisation.</span></aside>

          <article><h3>1. Éditeur et champ d’application</h3><p>Secret Clubhouse est un service familial de communication destiné aux enfants de 6 à 13 ans sous le contrôle de leurs responsables légaux. L’identité, l’adresse, le numéro d’immatriculation et les coordonnées définitives de l’éditeur seront ajoutés avant la mise en production.</p></article>
          <article><h3>2. Acceptation</h3><p>La création d’un compte parent et toute commande éventuelle supposent l’acceptation des présentes conditions par un adulte disposant de l’autorité nécessaire. Un enfant ne peut ni créer seul un compte familial ni effectuer un achat.</p></article>
          <article><h3>3. Comptes et sécurité</h3><p>Le parent crée et administre les profils enfants, approuve les contacts et règle les autorisations. Les identifiants sont personnels et doivent rester confidentiels. Toute utilisation suspecte doit être signalée sans délai à l’éditeur.</p></article>
          <article><h3>4. Services proposés</h3><p>Le service peut proposer la messagerie, les messages vocaux, les appels audio et vidéo, le partage de médias autorisé par le parent et des activités privées. Leur disponibilité dépend du réseau, du terminal et des autorisations du système.</p></article>
          <article><h3>5. Prix et paiement</h3><p>Le prototype présenté est gratuit et ne constitue pas une offre commerciale. Si une formule payante est proposée ultérieurement, son prix toutes taxes comprises, sa durée, son renouvellement et les moyens de paiement seront affichés clairement avant toute validation.</p></article>
          <article><h3>6. Droit de rétractation</h3><p>Lorsque la réglementation applicable le prévoit, le consommateur dispose du délai légal de rétractation. Pour un contenu ou service numérique commencé immédiatement, un accord exprès et les conséquences sur ce droit seront recueillis avant l’exécution.</p></article>
          <article><h3>7. Disponibilité et responsabilité</h3><p>L’éditeur met en œuvre des moyens raisonnables pour assurer le fonctionnement du service, sans garantir une disponibilité permanente. Les parents restent responsables de la configuration des profils, du choix des contacts et de l’usage du service par leurs enfants.</p></article>
          <article><h3>8. Données personnelles</h3><p>Les données sont traitées pour fournir et sécuriser le service. Les modalités détaillées, durées de conservation et droits des personnes devront figurer dans une politique de confidentialité distincte, accessible avant l’inscription.</p></article>
          <article><h3>9. Suspension et résiliation</h3><p>Le parent peut cesser d’utiliser le service et demander la suppression de son compte. L’éditeur peut suspendre un compte en cas de fraude, de risque pour un enfant, de violation des règles ou d’obligation légale, selon une procédure proportionnée.</p></article>
          <article><h3>10. Droit applicable et réclamations</h3><p>Les coordonnées du service client, le médiateur de la consommation compétent et les règles de règlement des litiges seront précisés selon le pays d’établissement de l’éditeur et le lieu de résidence du consommateur.</p></article>
        </div>
        <footer><button className="primary-button" type="button" onClick={onClose}>Fermer</button></footer>
      </section>
    </div>
  );
}

function Hero({ child, onQr }) {
  return (
    <header className="hero">
      <div className="hero__decor" aria-hidden="true">
        <WaveSine className="decor decor--wave" size={32} weight="bold" />
        <Star className="decor decor--star" size={34} weight="fill" />
        <Lightning className="decor decor--bolt" size={42} weight="fill" />
        <Star className="decor decor--outline-star" size={38} weight="bold" />
      </div>
      <Brand />
      <div className="hero__main">
        <Avatar person={child} size="hero" />
        <div className="hero__copy">
          <h1>Salut, {child.name} !</h1>
          <p>C’est parti pour de belles discussions ?</p>
          <div className="secure-note">
            <ShieldCheck size={28} weight="fill" aria-hidden="true" />
            <span><strong>Espace sécurisé</strong><small>Tous tes contacts sont approuvés par un parent.</small></span>
          </div>
        </div>
        <button className="qr-action" type="button" onClick={onQr} aria-label="Ajouter un ami avec un QR code">
          <span className="qr-action__icon"><QrCode size={35} weight="bold" aria-hidden="true" /></span>
          <span>Ajouter<br />un ami</span>
        </button>
      </div>
    </header>
  );
}

function FriendsStrip({ approvedFriends, onOpenFriend }) {
  return (
    <section className="friends-strip" aria-labelledby="friends-title">
      <div className="section-title-row">
        <h2 id="friends-title">Tes amis approuvés</h2>
        <button type="button" className="text-button" onClick={() => approvedFriends[0] && onOpenFriend(approvedFriends[0])} disabled={approvedFriends.length === 0}>
          Voir tout <CaretRight size={17} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className="friend-list">
        {approvedFriends.length === 0 && <div className="empty-friends"><ShieldCheck size={22} weight="fill" /><span>Les amis approuvés apparaîtront ici.</span></div>}
        {approvedFriends.map((friend) => (
          <button key={friend.id} type="button" className="friend-chip" onClick={() => onOpenFriend(friend)}>
            <Avatar person={friend} size="friend" online={Boolean(friend.online)} />
            <span>{friend.name}<small>{friend.online ? "En ligne" : "Hors ligne"}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ConversationList({ availableConversations, onOpen }) {
  return (
    <section className="conversation-section" aria-labelledby="recent-title">
      <div className="conversation-heading">
        <span className="heading-icon"><ChatCircleDots size={22} weight="fill" aria-hidden="true" /></span>
        <h2 id="recent-title">Conversations récentes</h2>
      </div>
      <div className="conversation-list">
        {availableConversations.length === 0 && (
          <div className="empty-conversations">
            <UserPlus size={30} weight="fill" />
            <strong>Aucune conversation pour le moment</strong>
            <span>Un parent doit d’abord approuver un ami.</span>
          </div>
        )}
        {availableConversations.map((conversation) => {
          const ActivityIcon = conversation.ActivityIcon;
          return (
            <button key={conversation.id} type="button" className="conversation-row" onClick={() => onOpen(conversation)}>
              <Avatar person={conversation} size="list" online={Boolean(conversation.online)} />
              <span className="conversation-copy">
                <strong>{conversation.name}</strong>
                <span className="preview-text">{conversation.preview} <ActivityIcon size={16} weight="fill" aria-hidden="true" /></span>
              </span>
              <span className="conversation-meta">
                <time>{conversation.time}</time>
                <CaretRight size={17} weight="bold" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HomeScreen({ child, approvedFriends, availableConversations, onQr, onOpenConversation }) {
  const openFriend = (friend) => {
    const matchingConversation = availableConversations.find((item) => item.id === friend.id || item.contactId === friend.contactId);
    if (matchingConversation) onOpenConversation(matchingConversation);
  };

  return (
    <div className="home-screen">
      <Hero child={child} onQr={onQr} />
      <FriendsStrip approvedFriends={approvedFriends} onOpenFriend={openFriend} />
      <ConversationList availableConversations={availableConversations} onOpen={onOpenConversation} />
    </div>
  );
}

function formatCallDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function MessageStatus({ status = "received" }) {
  const isSeen = status === "seen";
  const StatusIcon = isSeen ? Checks : Check;
  const label = isSeen ? "Vu" : "Reçu";
  return <span className={`message-status message-status--${status}`} role="img" aria-label={label} title={label}><StatusIcon size={15} weight="bold" /></span>;
}

function ConversationMediaMessage({ message, parent = false }) {
  const [mediaUrl, setMediaUrl] = useState(message.url ?? "");
  const [loadError, setLoadError] = useState("");
  const isReceived = message.direction === "received";
  const isVideo = message.type === "video";

  useEffect(() => {
    if (message.url) {
      setMediaUrl(message.url);
      setLoadError("");
      return undefined;
    }
    let isCurrent = true;
    let objectUrl = "";
    setMediaUrl("");
    setLoadError("");
    api.media(message.id)
      .then((url) => {
        objectUrl = url;
        if (isCurrent) setMediaUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || "Média indisponible.");
      });
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.id, message.url]);

  const className = parent
    ? `parent-media-message ${isReceived ? "parent-media-message--received" : ""}`
    : `media-message ${isReceived ? "media-message--received" : ""}`;
  const placeholderClassName = parent ? "parent-media-message__placeholder" : "media-message__placeholder";
  const description = `${isVideo ? "Vidéo" : "Photo"} ${isReceived ? "reçue" : "envoyée"}`;

  return (
    <figure className={className}>
      {mediaUrl ? (
        isVideo
          ? <video src={mediaUrl} controls playsInline aria-label={`${description} : ${message.name || "vidéo"}`} />
          : <img src={mediaUrl} alt={`${description} : ${message.name || "photo"}`} />
      ) : (
        <div className={`${placeholderClassName} ${loadError ? "has-error" : ""}`} role={loadError ? "alert" : "status"}>
          {loadError || `Chargement de la ${isVideo ? "vidéo" : "photo"}…`}
        </div>
      )}
      <figcaption>
        <span>{description}{message.time ? ` · ${message.time}` : ""}</span>
        {!isReceived && <MessageStatus status={message.status ?? "received"} />}
      </figcaption>
    </figure>
  );
}

function ConversationVoiceMessage({ message, parent = false }) {
  const [mediaUrl, setMediaUrl] = useState(message.url ?? "");
  const [loadError, setLoadError] = useState("");
  const isReceived = message.direction === "received";

  useEffect(() => {
    if (message.url) {
      setMediaUrl(message.url);
      setLoadError("");
      return undefined;
    }
    let isCurrent = true;
    let objectUrl = "";
    setMediaUrl("");
    setLoadError("");
    api.media(message.id)
      .then((url) => {
        objectUrl = url;
        if (isCurrent) setMediaUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || "Message vocal indisponible.");
      });
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.id, message.url]);

  if (!mediaUrl) {
    return <div className={`voice-message-loading ${parent ? "voice-message-loading--parent" : ""} ${isReceived ? "is-received" : ""}`} role={loadError ? "alert" : "status"}>{loadError || "Chargement du message vocal…"}</div>;
  }

  return (
    <div className={`conversation-voice-message ${parent ? "conversation-voice-message--parent" : ""} ${isReceived ? "is-received" : "is-sent"}`}>
      <VoiceMessage url={mediaUrl} duration={message.duration} status={isReceived ? null : message.status ?? "received"} parent={parent} />
      {message.time && <time>{message.time}</time>}
    </div>
  );
}

function useTypingIndicator(conversationId, enabled) {
  const [typingName, setTypingName] = useState(null);
  const lastSignalRef = useRef(0);
  const stopTimerRef = useRef(null);

  const stopTyping = () => {
    if (!enabled || !conversationId) return;
    window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    lastSignalRef.current = 0;
    void api.setTyping(conversationId, false).catch(() => {});
  };

  const notifyTyping = () => {
    if (!enabled || !conversationId) return;
    const now = Date.now();
    if (now - lastSignalRef.current > 2000) {
      lastSignalRef.current = now;
      void api.setTyping(conversationId, true).catch(() => {});
    }
    window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(stopTyping, 3500);
  };

  useEffect(() => {
    if (!enabled || !conversationId) {
      setTypingName(null);
      return undefined;
    }
    let active = true;
    const refresh = async () => {
      try {
        const result = await api.typing(conversationId);
        if (active) setTypingName(result.typing ? result.name : null);
      } catch {
        if (active) setTypingName(null);
      }
    };
    void refresh();
    const pollTimer = window.setInterval(refresh, 1500);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.clearTimeout(stopTimerRef.current);
      void api.setTyping(conversationId, false).catch(() => {});
    };
  }, [conversationId, enabled]);

  return { typingName, notifyTyping, stopTyping };
}

function TypingIndicator({ name }) {
  if (!name) return null;
  return <div className="typing-indicator" role="status" aria-live="polite"><span aria-hidden="true"><i /><i /><i /></span><small>{name} est en train d’écrire…</small></div>;
}

function PushNotificationButton() {
  const native = Capacitor.isNativePlatform();
  const isWindowsWeb = !native && /Windows/i.test(navigator.userAgent);
  const supported = native || ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  const [status, setStatus] = useState(supported ? "checking" : "unsupported");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return;
    if (native) {
      PushNotifications.checkPermissions().then(({ receive }) => setStatus(receive === "granted" ? "enabled" : receive === "denied" ? "denied" : "disabled"));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then(async (registration) => {
        await registration.update().catch(() => {});
        return registration.pushManager.getSubscription();
      })
      .then(async (subscription) => {
        if (subscription) await api.subscribePush(subscription.toJSON());
        setStatus(subscription ? "enabled" : Notification.permission === "denied" ? "denied" : "disabled");
      })
      .catch(() => setStatus("unsupported"));
  }, [native, supported]);

  const togglePush = async () => {
    setError("");
    try {
      if (native) {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted") { setStatus("denied"); return; }
        const platform = Capacitor.getPlatform();
        const registration = await new Promise((resolve, reject) => {
          const registered = PushNotifications.addListener("registration", (token) => { registered.then((handle) => handle.remove()); resolve(token); });
          const failed = PushNotifications.addListener("registrationError", (registrationError) => { failed.then((handle) => handle.remove()); reject(new Error(registrationError.error)); });
          PushNotifications.register();
        });
        await api.saveNativePushToken(registration.value, platform);
        setStatus("enabled");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await api.unsubscribePush(current.endpoint);
        await current.unsubscribe();
        setStatus("disabled");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }
      const { publicKey } = await api.pushPublicKey();
      const padding = "=".repeat((4 - publicKey.length % 4) % 4);
      const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const applicationServerKey = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await api.subscribePush(subscription.toJSON());
      setStatus("enabled");
    } catch (pushError) {
      setError(pushError.message || "Impossible d’activer les notifications.");
    }
  };

  const statusText = status === "enabled"
    ? isWindowsWeb ? "Activées dans Windows, même lorsque l’application est fermée" : "Activées même lorsque l’application est fermée"
    : status === "denied"
      ? isWindowsWeb ? "Bloquées dans les paramètres de notifications Windows ou du navigateur" : "Bloquées dans les réglages du téléphone"
      : status === "unsupported"
        ? "Non disponibles sur ce navigateur"
        : isWindowsWeb ? "Recevoir les messages et demandes dans Windows" : "Recevoir les nouveaux messages en veille";

  return (
    <div className="push-setting">
      <button type="button" onClick={togglePush} disabled={status === "checking" || status === "unsupported" || status === "denied"}>
        <Bell size={20} weight="fill" />
        <span><strong>{isWindowsWeb ? "Notifications Windows" : "Notifications et son système"}</strong><small>{statusText}</small></span>
        <span className={`toggle ${status === "enabled" ? "is-on" : ""}`} aria-hidden="true"><span /></span>
      </button>
      {error && <small className="push-setting__error" role="alert">{error}</small>}
      {/iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches && <small className="push-setting__hint">Sur iPhone/iPad, ajoutez d’abord Secret Clubhouse à l’écran d’accueil.</small>}
    </div>
  );
}

function formatVoiceDuration(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function VoiceMessage({ url, duration, status, parent = false, preview = false }) {
  return (
    <div className={`voice-message ${parent ? "voice-message--parent" : ""} ${preview ? "voice-message--preview" : ""}`}>
      <span className="voice-message__icon" aria-hidden="true"><Waveform size={22} weight="fill" /></span>
      <div className="voice-message__player">
        <audio src={url} controls preload="metadata" aria-label={preview ? "Écouter l’aperçu du message vocal" : "Lire le message vocal envoyé"} />
        <small>{preview ? "Aperçu" : "Message vocal"} · {formatVoiceDuration(duration)}</small>
      </div>
      {status && <MessageStatus status={status} />}
    </div>
  );
}

function VoiceRecorder({ disabled = false, onSend, parent = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const discardRef = useRef(false);
  const previewUrlRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
  };

  useEffect(() => () => {
    discardRef.current = true;
    clearTimer();
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    releaseMicrophone();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const startRecording = async () => {
    if (disabled || isRecording) return;
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      setError("L’enregistrement audio n’est pas disponible sur cet appareil.");
      return;
    }

    try {
      clearPreview();
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => window.MediaRecorder.isTypeSupported?.(type));
      const recorder = supportedType ? new window.MediaRecorder(stream, { mimeType: supportedType }) : new window.MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearTimer();
        releaseMicrophone();
        setIsRecording(false);
        const duration = Math.max(1, Math.min(120, Math.round((Date.now() - startedAtRef.current) / 1000)));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm" });
        if (discardRef.current || !blob.size) {
          setElapsed(0);
          return;
        }
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreview({ blob, url, duration });
        setElapsed(duration);
      };

      recorder.start(250);
      setElapsed(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        const seconds = Math.min(120, Math.floor((Date.now() - startedAtRef.current) / 1000));
        setElapsed(seconds);
        if (seconds >= 120 && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch (recordingError) {
      clearTimer();
      releaseMicrophone();
      setIsRecording(false);
      setError(recordingError?.name === "NotAllowedError"
        ? "Autorise le micro pour enregistrer un message vocal."
        : "Impossible d’utiliser le micro pour le moment.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state !== "recording") return;
    discardRef.current = false;
    recorderRef.current.stop();
  };

  const cancelRecording = () => {
    discardRef.current = true;
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else releaseMicrophone();
    setIsRecording(false);
    setElapsed(0);
    clearPreview();
    setError("");
  };

  const sendRecording = async () => {
    if (!preview || isSending) return;
    setError("");
    setIsSending(true);
    try {
      await onSend(preview.blob, preview.duration);
      clearPreview();
      setElapsed(0);
    } catch (sendError) {
      setError(sendError?.message || "Le message vocal n’a pas pu être envoyé.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`voice-recorder-slot ${parent ? "voice-recorder-slot--parent" : ""}`}>
      <button
        type="button"
        className={`voice-record-button ${isRecording ? "is-recording" : ""}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        aria-label={isRecording ? "Arrêter l’enregistrement vocal" : "Enregistrer un message vocal"}
        aria-pressed={isRecording}
      >
        <Microphone size={20} weight="fill" />
      </button>
      {isRecording && (
        <div className="voice-recorder-panel voice-recorder-panel--recording" role="status" aria-live="polite">
          <span className="voice-recorder-pulse" aria-hidden="true" />
          <span><strong>Enregistrement</strong><small>{formatVoiceDuration(elapsed)} / 2:00</small></span>
          <button type="button" className="voice-recorder-cancel" onClick={cancelRecording} aria-label="Annuler l’enregistrement"><X size={18} weight="bold" /></button>
          <button type="button" className="voice-recorder-stop" onClick={stopRecording} aria-label="Terminer l’enregistrement"><span aria-hidden="true" /></button>
        </div>
      )}
      {preview && (
        <div className="voice-recorder-panel voice-recorder-panel--preview">
          <VoiceMessage url={preview.url} duration={preview.duration} parent={parent} preview />
          <button type="button" className="voice-recorder-cancel" onClick={cancelRecording} aria-label="Supprimer le message vocal"><X size={18} weight="bold" /></button>
          <button type="button" className="voice-recorder-send" onClick={sendRecording} aria-label="Envoyer le message vocal" disabled={isSending}><PaperPlaneTilt size={18} weight="fill" /></button>
        </div>
      )}
      {error && <div className="voice-recorder-error" role="alert">{error}</div>}
    </div>
  );
}

function AudioCallScreen({ child, conversation, policy, autoReply, onClose }) {
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const receivedStreamRef = useRef(null);
  const remoteSourceRef = useRef(null);
  const rtcSessionRef = useRef(null);
  const streamCleanupsRef = useRef([]);
  const [phase, setPhase] = useState("ready");
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState("new");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);

  const cleanUpCall = () => {
    rtcSessionRef.current?.close();
    rtcSessionRef.current = null;
    stopMediaStream(localStreamRef.current);
    stopMediaStream(remoteSourceRef.current);
    localStreamRef.current = null;
    receivedStreamRef.current = null;
    remoteSourceRef.current = null;
    streamCleanupsRef.current.forEach((cleanup) => cleanup());
    streamCleanupsRef.current = [];
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  useEffect(() => () => cleanUpCall(), []);

  useEffect(() => {
    if (phase !== "active") return undefined;
    const timer = window.setInterval(() => setDuration((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (remoteAudioRef.current && receivedStreamRef.current) remoteAudioRef.current.srcObject = receivedStreamRef.current;
  }, [phase]);

  const startCall = async () => {
    if (!policy.allowed || phase === "connecting") return;
    cleanUpCall();
    setError("");
    setDuration(0);
    setIsMuted(false);
    setIsSpeakerOff(false);
    setConnectionState("connecting");
    setPhase("connecting");

    try {
      const localSource = { stream: await openMicrophoneStream(), stop: null };
      const remoteSource = await createRemoteAudioPlaceholder();
      localStreamRef.current = localSource.stream;
      remoteSourceRef.current = remoteSource.stream;
      streamCleanupsRef.current.push(remoteSource.stop);

      rtcSessionRef.current = await createLocalWebRtcSession({
        localStream: localSource.stream,
        remoteSourceStream: remoteSource.stream,
        onRemoteStream: (stream) => {
          receivedStreamRef.current = stream;
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
        },
        onStateChange: setConnectionState,
      });
      setPhase("active");
    } catch (callError) {
      cleanUpCall();
      setPhase("error");
      setConnectionState("failed");
      setError(callError?.name === "NotAllowedError"
        ? "Le micro n’a pas été autorisé. Vérifie son autorisation puis réessaie."
        : callError?.message ?? "Impossible de démarrer l’appel audio sur cet appareil.");
    }
  };

  const toggleMicrophone = () => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setIsMuted(nextMuted);
  };

  const toggleSpeaker = () => {
    const nextSpeakerOff = !isSpeakerOff;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = nextSpeakerOff;
    setIsSpeakerOff(nextSpeakerOff);
  };

  const endCall = () => {
    cleanUpCall();
    onClose();
  };

  const isInCall = phase === "connecting" || phase === "active";

  if (!isInCall) {
    return (
      <section className="audio-call-screen audio-call-screen--lobby" aria-label={`Préparer l’appel audio avec ${conversation.name}`}>
        <header className="video-call-topbar">
          <button type="button" className="video-call-back" onClick={onClose} aria-label="Retour à la conversation"><ArrowLeft size={23} weight="bold" /></button>
          <span><ShieldCheck size={17} weight="fill" /> Appel protégé</span>
        </header>
        <div className="audio-lobby-card">
          <div className="audio-lobby-avatar"><Avatar person={conversation} size="hero" online /><span><Phone size={25} weight="fill" /></span></div>
          <small>Contact approuvé</small>
          <h1>Appeler {conversation.name} ?</h1>
          <p>Le micro reste actif uniquement pendant l’appel.</p>
          <div className={`video-policy ${policy.allowed ? "is-allowed" : "is-blocked"}`}>
            {policy.allowed ? <ShieldCheck size={20} weight="fill" /> : <LockKey size={20} weight="fill" />}
            <span><strong>{policy.allowed ? "Autorisé par un parent" : policy.reason}</strong><small>{policy.detail}</small></span>
          </div>
          {!policy.allowed && autoReply?.enabled && autoReply.message.trim() && <div className="call-auto-reply"><ChatCircleDots size={20} weight="fill" /><span><strong>Réponse automatique à l’appelant</strong><p>« {autoReply.message} »</p></span></div>}
          {error && <div className="video-call-error" role="alert"><MicrophoneSlash size={20} weight="fill" /><span>{error}</span></div>}
          <div className="video-lobby-actions">
            <button type="button" className="audio-start-button" onClick={startCall} disabled={!policy.allowed}>
              <Microphone size={21} weight="fill" /> Démarrer avec mon micro
            </button>
          </div>
          <div className="video-privacy-note"><LockKey size={15} weight="fill" /> Aucun numéro de téléphone n’est partagé.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="audio-call-screen audio-call-screen--active" aria-label={`Appel audio avec ${conversation.name}`}>
      <audio ref={remoteAudioRef} autoPlay aria-label={`Audio de ${conversation.name}`} />
      <header className="audio-call-topbar">
        <span className={`connection-dot ${connectionState === "connected" ? "is-connected" : ""}`} />
        <span>{connectionState === "connected" ? "WebRTC connecté" : "Connexion sécurisée…"}</span>
        <strong>{formatCallDuration(duration)}</strong>
      </header>
      <div className="audio-call-center">
        <div className="audio-call-avatar">
          <span className="audio-pulse audio-pulse--one" />
          <span className="audio-pulse audio-pulse--two" />
          <Avatar person={conversation} size="hero" online />
        </div>
        <h1>{conversation.name}</h1>
        <p>En appel avec {child.name}</p>
        <div className="audio-waveform" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <span key={index} style={{ "--wave-index": index }} />)}</div>
      </div>
      <div className="video-call-controls audio-call-controls" aria-label="Contrôles de l’appel audio">
        <button type="button" onClick={toggleMicrophone} className={isMuted ? "is-off" : ""} aria-label={isMuted ? "Réactiver le micro" : "Couper le micro"} aria-pressed={isMuted}>
          {isMuted ? <MicrophoneSlash size={25} weight="fill" /> : <Microphone size={25} weight="fill" />}
          <span>{isMuted ? "Micro coupé" : "Micro"}</span>
        </button>
        <button type="button" onClick={endCall} className="hangup-button" aria-label="Raccrocher">
          <PhoneDisconnect size={27} weight="fill" />
          <span>Raccrocher</span>
        </button>
        <button type="button" onClick={toggleSpeaker} className={isSpeakerOff ? "is-off" : ""} aria-label={isSpeakerOff ? "Réactiver le haut-parleur" : "Couper le haut-parleur"} aria-pressed={isSpeakerOff}>
          {isSpeakerOff ? <SpeakerSlash size={25} weight="fill" /> : <SpeakerHigh size={25} weight="fill" />}
          <span>{isSpeakerOff ? "Son coupé" : "Haut-parleur"}</span>
        </button>
      </div>
    </section>
  );
}

function VideoCallScreen({ child, conversation, policy, autoReply, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const receivedStreamRef = useRef(null);
  const remoteSourceRef = useRef(null);
  const rtcSessionRef = useRef(null);
  const streamCleanupsRef = useRef([]);
  const [phase, setPhase] = useState("ready");
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState("new");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);

  const cleanUpCall = () => {
    rtcSessionRef.current?.close();
    rtcSessionRef.current = null;
    stopMediaStream(localStreamRef.current);
    stopMediaStream(remoteSourceRef.current);
    localStreamRef.current = null;
    receivedStreamRef.current = null;
    remoteSourceRef.current = null;
    streamCleanupsRef.current.forEach((cleanup) => cleanup());
    streamCleanupsRef.current = [];
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  useEffect(() => () => cleanUpCall(), []);

  useEffect(() => {
    if (phase !== "active") return undefined;
    const timer = window.setInterval(() => setDuration((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!isInCall) return;
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && receivedStreamRef.current) remoteVideoRef.current.srcObject = receivedStreamRef.current;
  }, [phase]);

  const startCall = async () => {
    if (!policy.allowed || phase === "connecting") return;
    cleanUpCall();
    setError("");
    setDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setConnectionState("connecting");
    setPhase("connecting");

    try {
      const localStream = await openCameraStream();

      const remotePlaceholder = createRemoteVideoPlaceholder(conversation.name, ["#644bd7", "#62e7c4"]);
      streamCleanupsRef.current.push(remotePlaceholder.stop);
      localStreamRef.current = localStream;
      remoteSourceRef.current = remotePlaceholder.stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      rtcSessionRef.current = await createLocalWebRtcSession({
        localStream,
        remoteSourceStream: remotePlaceholder.stream,
        onRemoteStream: (stream) => {
          receivedStreamRef.current = stream;
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        },
        onStateChange: setConnectionState,
      });
      setPhase("active");
    } catch (callError) {
      cleanUpCall();
      setPhase("error");
      setConnectionState("failed");
      setError(callError?.name === "NotAllowedError"
        ? "La caméra ou le micro n’a pas été autorisé. Vérifie les autorisations puis réessaie."
        : callError?.message ?? "Impossible de démarrer la visio sur cet appareil.");
    }
  };

  const toggleMicrophone = () => {
    const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (!audioTracks.length) return;
    const nextMuted = !isMuted;
    audioTracks.forEach((track) => { track.enabled = !nextMuted; });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
    const nextCameraOff = !isCameraOff;
    videoTracks.forEach((track) => { track.enabled = !nextCameraOff; });
    setIsCameraOff(nextCameraOff);
  };

  const endCall = () => {
    cleanUpCall();
    onClose();
  };

  const hasMicrophone = (localStreamRef.current?.getAudioTracks().length ?? 0) > 0;
  const isInCall = phase === "connecting" || phase === "active";

  if (!isInCall) {
    return (
      <section className="video-call-screen video-call-screen--lobby" aria-label={`Préparer la visio avec ${conversation.name}`}>
        <header className="video-call-topbar">
          <button type="button" className="video-call-back" onClick={onClose} aria-label="Retour à la conversation"><ArrowLeft size={23} weight="bold" /></button>
          <span><ShieldCheck size={17} weight="fill" /> Visio protégée</span>
        </header>
        <div className="video-lobby-card">
          <div className="video-lobby-avatar"><Avatar person={conversation} size="hero" online /><span><VideoCamera size={26} weight="fill" /></span></div>
          <small>Contact approuvé</small>
          <h1>Appeler {conversation.name} en visio ?</h1>
          <p>La caméra et le micro restent actifs uniquement pendant l’appel.</p>
          <div className={`video-policy ${policy.allowed ? "is-allowed" : "is-blocked"}`}>
            {policy.allowed ? <ShieldCheck size={20} weight="fill" /> : <LockKey size={20} weight="fill" />}
            <span><strong>{policy.allowed ? "Autorisé par un parent" : policy.reason}</strong><small>{policy.detail}</small></span>
          </div>
          {!policy.allowed && autoReply?.enabled && autoReply.message.trim() && <div className="call-auto-reply"><ChatCircleDots size={20} weight="fill" /><span><strong>Réponse automatique à l’appelant</strong><p>« {autoReply.message} »</p></span></div>}
          {error && <div className="video-call-error" role="alert"><VideoCameraSlash size={20} weight="fill" /><span>{error}</span></div>}
          <div className="video-lobby-actions">
            <button type="button" className="video-start-button" onClick={startCall} disabled={!policy.allowed}>
              <VideoCamera size={21} weight="fill" /> Démarrer avec ma caméra
            </button>
          </div>
          <div className="video-privacy-note"><LockKey size={15} weight="fill" /> Aucun numéro de téléphone n’est partagé.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="video-call-screen" aria-label={`Visio avec ${conversation.name}`}>
      <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline aria-label={`Vidéo de ${conversation.name}`} />
      <div className="video-call-shade" />
      <header className="video-call-topbar video-call-topbar--active">
        <div><span className={`connection-dot ${connectionState === "connected" ? "is-connected" : ""}`} /><span>{connectionState === "connected" ? "WebRTC connecté" : "Connexion sécurisée…"}</span></div>
        <strong>{formatCallDuration(duration)}</strong>
      </header>
      <div className="video-call-person">
        <strong>{conversation.name}</strong>
        <span>Contact approuvé</span>
      </div>
      <div className={`local-video-wrap ${isCameraOff ? "is-off" : ""}`}>
        <video ref={localVideoRef} className="local-video" autoPlay playsInline muted aria-label={`Aperçu caméra de ${child.name}`} />
        {isCameraOff && <span><VideoCameraSlash size={21} weight="fill" /> Caméra coupée</span>}
        <small>Toi</small>
      </div>
      <div className="video-call-controls" aria-label="Contrôles de l’appel">
        <button type="button" onClick={toggleMicrophone} className={isMuted ? "is-off" : ""} disabled={!hasMicrophone} aria-label={hasMicrophone ? (isMuted ? "Réactiver le micro" : "Couper le micro") : "Micro indisponible"} aria-pressed={isMuted}>
          {isMuted ? <MicrophoneSlash size={25} weight="fill" /> : <Microphone size={25} weight="fill" />}
          <span>{hasMicrophone ? (isMuted ? "Micro coupé" : "Micro") : "Sans micro"}</span>
        </button>
        <button type="button" onClick={endCall} className="hangup-button" aria-label="Raccrocher">
          <PhoneDisconnect size={27} weight="fill" />
          <span>Raccrocher</span>
        </button>
        <button type="button" onClick={toggleCamera} className={isCameraOff ? "is-off" : ""} aria-label={isCameraOff ? "Réactiver la caméra" : "Couper la caméra"} aria-pressed={isCameraOff}>
          {isCameraOff ? <VideoCameraSlash size={25} weight="fill" /> : <VideoCamera size={25} weight="fill" />}
          <span>{isCameraOff ? "Caméra coupée" : "Caméra"}</span>
        </button>
      </div>
    </section>
  );
}

function ChatScreen({ child, conversation, settings, schedule, onBack, onSendMessage, onSendMedia }) {
  const [draft, setDraft] = useState("");
  const [sentMessages, setSentMessages] = useState([]);
  const [mediaError, setMediaError] = useState("");
  const [messageError, setMessageError] = useState("");
  const mediaInputRef = useRef(null);
  const mediaUrlsRef = useRef([]);
  const messagePolicy = getChannelPolicy(schedule, "messages");
  const autoReply = schedule.autoReply ?? defaultCommunicationSchedule.autoReply;
  const autoReplyIsActive = !messagePolicy.allowed && autoReply.enabled && autoReply.message.trim();
  const nextMessageTime = schedule.messages.start.replace(":", " h ");
  const { typingName, notifyTyping, stopTyping } = useTypingIndicator(conversation.id, Boolean(conversation.serverBacked));

  useEffect(() => () => {
    mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!sentMessages.some((message) => message.status === "received")) return undefined;
    const seenTimer = window.setTimeout(() => {
      setSentMessages((current) => current.map((message) => message.status === "received" ? { ...message, status: "seen" } : message));
    }, 1400);
    return () => window.clearTimeout(seenTimer);
  }, [sentMessages]);

  const sendMessage = async () => {
    if (!messagePolicy.allowed) return;
    const message = draft.trim();
    if (!message) return;
    setMessageError("");
    try {
      const sent = await onSendMessage?.(conversation.id, message);
      if (!conversation.serverBacked) {
        setSentMessages((current) => [...current, { id: sent?.id ?? `message-${Date.now()}`, type: "text", text: message, status: "received" }]);
      }
      setDraft("");
      stopTyping();
    } catch (error) {
      setMessageError(error.message);
    }
  };

  const sendMedia = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!settings.media || !messagePolicy.allowed || !files.length) return;
    const supportedFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    const oversizedFile = supportedFiles.find((file) => file.size > 25 * 1024 * 1024);
    if (oversizedFile) {
      setMediaError("Chaque photo ou vidéo doit faire moins de 25 Mo.");
      return;
    }
    if (!supportedFiles.length) {
      setMediaError("Choisis une image, une photo ou une vidéo.");
      return;
    }
    try {
      if (conversation.serverBacked) {
        await onSendMedia?.(conversation.id, supportedFiles);
      } else {
        const mediaMessages = supportedFiles.map((file, index) => {
          const url = URL.createObjectURL(file);
          mediaUrlsRef.current.push(url);
          return { id: `media-${Date.now()}-${index}`, direction: "sent", type: file.type.startsWith("video/") ? "video" : "image", url, name: file.name, status: "received" };
        });
        setSentMessages((current) => [...current, ...mediaMessages]);
      }
      setMediaError("");
    } catch (error) {
      setMediaError(error.message || "La photo n’a pas pu être envoyée.");
    }
  };

  const sendVoiceMessage = async (blob, duration) => {
    if (!messagePolicy.allowed) return;
    const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `message-vocal-${duration}s.${extension}`, { type: blob.type || "audio/webm" });
    await onSendMedia?.(conversation.id, [file]);
  };

  return (
    <section className="chat-screen" aria-label={`Conversation avec ${conversation.name}`}>
      <header className="chat-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux conversations">
          <ArrowLeft size={23} weight="bold" />
        </button>
        <Avatar person={conversation} size="chat" online />
        <div className="chat-header__copy">
          <strong>{conversation.name}</strong>
          <span><ShieldCheck size={13} weight="fill" /> {conversation.isFamily ? "Ton parent" : "Contact approuvé"}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Plus d’options">
          <DotsThree size={23} weight="bold" />
        </button>
      </header>

      <div className="chat-body" aria-live="polite">
        <div className="chat-day">Aujourd’hui</div>
        {!messagePolicy.allowed && (
          <div className="chat-quiet-banner" role="status"><Clock size={18} weight="fill" /><span><strong>Mode calme actif</strong><small>{autoReplyIsActive ? `${conversation.name} reçoit automatiquement un message.` : `Les messages seront disponibles à ${nextMessageTime}.`}</small></span></div>
        )}
        {conversation.serverBacked ? conversation.messages.map((message) => message.type === "audio"
          ? <ConversationVoiceMessage key={message.id} message={message} />
          : message.type === "image" || message.type === "video"
            ? <ConversationMediaMessage key={message.id} message={message} />
            : <p className={`bubble bubble--${message.direction}`} key={message.id}>{message.text}{message.direction === "sent" && <MessageStatus status={message.status ?? "received"} />}</p>) : <>
          {conversation.received.map((message) => <p className="bubble bubble--received" key={message}>{message}</p>)}
          {conversation.sent && <p className="bubble bubble--sent">{conversation.sent}<MessageStatus status="seen" /></p>}
        </>}
        {sentMessages.map((message) => {
          if (message.type === "text") return <p className="bubble bubble--sent" key={message.id}>{message.text}<MessageStatus status={message.status} /></p>;
          if (message.type === "audio") return <VoiceMessage key={message.id} url={message.url} duration={message.duration} status={message.status} />;
          return <ConversationMediaMessage key={message.id} message={message} />;
        })}
        {autoReplyIsActive && (
          <div className="automatic-reply-group">
            <span><Clock size={13} weight="fill" /> Réponse automatique envoyée</span>
            <p className="bubble bubble--sent bubble--automatic"><span>{autoReply.message}</span><small>Automatique</small><MessageStatus status="received" /></p>
          </div>
        )}
        <TypingIndicator name={typingName} />
        <div className="safety-reminder"><LockKey size={16} weight="fill" /> {conversation.isFamily ? "Cette discussion familiale reste entre toi et ton parent." : "Cette discussion reste entre amis approuvés."}</div>
      </div>

      {messageError && <div className="media-error" role="alert">{messageError}</div>}
      {mediaError && <div className="media-error" role="alert">{mediaError}</div>}

      <form className={`composer ${messagePolicy.allowed ? "" : "is-quiet"}`} onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
        <input ref={mediaInputRef} className="sr-only" type="file" accept="image/*,video/*" multiple onChange={sendMedia} disabled={!messagePolicy.allowed || !settings.media} />
        <button type="button" className={`composer__control ${settings.media ? "" : "is-restricted"}`} aria-label={settings.media ? "Ajouter des photos ou vidéos" : "Photos et vidéos désactivées par un parent"} title={settings.media ? "Ajouter des photos ou vidéos" : "Désactivé par un parent"} onClick={() => mediaInputRef.current?.click()} disabled={!messagePolicy.allowed || !settings.media}><Plus size={22} weight="bold" /></button>
        <label className="composer__field">
          <span className="sr-only">Écris un message</span>
          <input value={draft} onChange={(event) => { setDraft(event.target.value); if (event.target.value.trim()) notifyTyping(); else stopTyping(); }} placeholder={messagePolicy.allowed ? "Écris un message…" : `Disponible à ${nextMessageTime}`} disabled={!messagePolicy.allowed} />
          {messagePolicy.allowed ? <Smiley size={21} aria-hidden="true" /> : <Clock size={20} aria-hidden="true" />}
        </label>
        <VoiceRecorder disabled={!messagePolicy.allowed} onSend={sendVoiceMessage} />
        <button type="submit" className="send-button" aria-label="Envoyer le message" disabled={!messagePolicy.allowed}><PaperPlaneTilt size={21} weight="fill" /></button>
      </form>
    </section>
  );
}

function ClubhouseScreen({ child }) {
  const [filter, setFilter] = useState("all");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [phase, setPhase] = useState("intro");
  const [completedActivities, setCompletedActivities] = useState(() => new Set());
  const [stars, setStars] = useState(120);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [rewardEarned, setRewardEarned] = useState(false);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const questionDecksRef = useRef({});
  const featuredActivity = clubhouseActivities.find((activity) => activity.featured);
  const visibleActivities = clubhouseActivities.filter((activity) => !activity.featured && (filter === "all" || activity.type === filter));
  const currentQuestion = sessionQuestions[questionIndex] ?? null;
  const progress = Math.round((completedActivities.size / clubhouseActivities.length) * 100);

  useEffect(() => {
    if (phase !== "active" || selectedActivity?.type !== "challenge") return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, selectedActivity]);

  const openActivity = (activity) => {
    if (activity.type === "game" && activity.questions) {
      let deck = questionDecksRef.current[activity.id] ?? [];
      if (deck.length < 3) {
        const previousLastPrompt = deck.at(-1)?.prompt;
        deck = [...activity.questions]
          .sort(() => Math.random() - 0.5)
          .sort((first) => first.prompt === previousLastPrompt ? 1 : 0);
      }
      const nextQuestions = deck.slice(0, 3);
      questionDecksRef.current[activity.id] = deck.slice(3);
      setSessionQuestions(nextQuestions);
    } else {
      setSessionQuestions([]);
    }
    setSelectedActivity(activity);
    setPhase("intro");
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setRewardEarned(false);
    setSecondsLeft(activity.duration * 60);
  };

  const closeActivity = () => {
    setSelectedActivity(null);
    setPhase("intro");
  };

  const startActivity = () => {
    setPhase("active");
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setSecondsLeft(selectedActivity.duration * 60);
  };

  const completeActivity = () => {
    const alreadyCompleted = completedActivities.has(selectedActivity.id);
    setRewardEarned(!alreadyCompleted);
    if (!alreadyCompleted) {
      setCompletedActivities((current) => new Set([...current, selectedActivity.id]));
      setStars((current) => current + selectedActivity.reward);
    }
    setPhase("complete");
  };

  const selectQuizAnswer = (answerIndex) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
  };

  const continueQuiz = () => {
    if (selectedAnswer !== currentQuestion.correct) {
      setSelectedAnswer(null);
      return;
    }
    if (questionIndex >= sessionQuestions.length - 1) {
      completeActivity();
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedAnswer(null);
  };

  const formattedTimer = `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  return (
    <section className="clubhouse-screen" aria-labelledby="clubhouse-title">
      <header className="clubhouse-header">
        <span className="clubhouse-header__icon"><House size={25} weight="fill" /></span>
        <div><span>Ton espace entre amis</span><h1 id="clubhouse-title">Le Clubhouse</h1></div>
        <span className="clubhouse-stars" aria-label={`${stars} étoiles`}><Star size={18} weight="fill" /> {stars}</span>
      </header>

      <div className="clubhouse-content">
        <section className="clubhouse-welcome" aria-label="Progression du Clubhouse">
          <div><span>Salut {child.name} !</span><strong>Prête pour une nouvelle mission ?</strong></div>
          <div className="clubhouse-streak"><Lightning size={17} weight="fill" /><span><strong>3 jours</strong><small>de suite</small></span></div>
          <div className="clubhouse-progress"><span style={{ width: `${Math.max(8, progress)}%` }} /><small>{completedActivities.size}/{clubhouseActivities.length} activités terminées</small></div>
        </section>

        <button type="button" className="clubhouse-featured" onClick={() => openActivity(featuredActivity)}>
          <span className="clubhouse-featured__badge">Défi du jour</span>
          <span className="clubhouse-featured__icon"><featuredActivity.Icon size={32} weight="fill" /></span>
          <span className="clubhouse-featured__copy"><strong>{featuredActivity.title}</strong><small>{featuredActivity.description}</small><span><Timer size={14} weight="bold" /> {featuredActivity.duration} min <Star size={14} weight="fill" /> +{featuredActivity.reward}</span></span>
          {completedActivities.has(featuredActivity.id) ? <CheckCircle className="clubhouse-featured__arrow is-complete" size={25} weight="fill" /> : <CaretRight className="clubhouse-featured__arrow" size={23} weight="bold" />}
        </button>

        <div className="clubhouse-section-title"><div><span>À toi de jouer</span><h2>Défis et mini-jeux</h2></div><GameController size={25} weight="fill" /></div>

        <div className="clubhouse-filters" role="tablist" aria-label="Filtrer les activités">
          {[{ id: "all", label: "Tout" }, { id: "challenge", label: "Défis" }, { id: "game", label: "Jeux" }].map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>

        <div className="clubhouse-grid">
          {visibleActivities.map((activity) => {
            const ActivityIcon = activity.Icon;
            const isComplete = completedActivities.has(activity.id);
            return (
              <button type="button" className={`clubhouse-card clubhouse-card--${activity.tone}`} key={activity.id} onClick={() => openActivity(activity)}>
                <span className="clubhouse-card__top"><span className="clubhouse-card__icon"><ActivityIcon size={25} weight="fill" /></span><span className="clubhouse-card__type">{activity.type === "game" ? "Mini-jeu" : "Défi"}</span>{isComplete && <CheckCircle size={20} weight="fill" aria-label="Terminé" />}</span>
                <strong>{activity.title}</strong>
                <small>{activity.description}</small>
                <span className="clubhouse-card__meta"><span><Timer size={13} weight="bold" /> {activity.duration} min</span><span><Star size={13} weight="fill" /> +{activity.reward}</span></span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedActivity && (
        <div className="clubhouse-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeActivity(); }}>
          <section className="clubhouse-modal" role="dialog" aria-modal="true" aria-labelledby="clubhouse-activity-title">
            <button type="button" className="clubhouse-modal__close" onClick={closeActivity} aria-label="Fermer l’activité"><X size={21} weight="bold" /></button>
            {phase === "complete" ? (
              <div className="clubhouse-complete" role="status">
                <span><Trophy size={42} weight="fill" /></span>
                <small>Mission terminée</small>
                <h2 id="clubhouse-activity-title">Bravo, {child.name} !</h2>
                <p>{rewardEarned ? `Tu gagnes ${selectedActivity.reward} nouvelles étoiles.` : "Tu avais déjà gagné les étoiles de cette activité, mais tu peux la rejouer quand tu veux."}</p>
                <div><Star size={22} weight="fill" /><strong>{stars}</strong><span>étoiles au total</span></div>
                <button type="button" className="clubhouse-modal__primary" onClick={closeActivity}>Continuer</button>
              </div>
            ) : (
              <>
                <div className={`clubhouse-modal__hero clubhouse-modal__hero--${selectedActivity.tone}`}>
                  <span><selectedActivity.Icon size={34} weight="fill" /></span>
                  <div><small>{selectedActivity.type === "game" ? "Mini-jeu" : "Défi créatif"}</small><h2 id="clubhouse-activity-title">{selectedActivity.title}</h2></div>
                </div>

                {phase === "intro" && (
                  <div className="clubhouse-modal__intro">
                    <p>{selectedActivity.description}</p>
                    <div className="clubhouse-modal__facts"><span><Timer size={18} weight="fill" /><strong>{selectedActivity.duration} min</strong><small>durée</small></span><span><Star size={18} weight="fill" /><strong>+{selectedActivity.reward}</strong><small>étoiles</small></span><span><ShieldCheck size={18} weight="fill" /><strong>Privé</strong><small>rien n’est publié</small></span></div>
                    <button type="button" className="clubhouse-modal__primary" onClick={startActivity}><Sparkle size={18} weight="fill" /> Commencer</button>
                  </div>
                )}

                {phase === "active" && selectedActivity.type === "challenge" && (
                  <div className="clubhouse-challenge">
                    <div className="clubhouse-timer"><Timer size={20} weight="fill" /><span><small>Temps restant</small><strong>{formattedTimer}</strong></span></div>
                    <ol>{selectedActivity.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
                    <button type="button" className="clubhouse-modal__primary" onClick={completeActivity}><CheckCircle size={19} weight="fill" /> J’ai terminé</button>
                  </div>
                )}

                {phase === "active" && selectedActivity.type === "game" && currentQuestion && (
                  <div className="clubhouse-quiz">
                    <span className="clubhouse-quiz__progress">Question {questionIndex + 1} sur {sessionQuestions.length}</span>
                    <h3>{currentQuestion.prompt}</h3>
                    <div>{currentQuestion.answers.map((answer, index) => {
                      const isSelected = selectedAnswer === index;
                      const isCorrect = selectedAnswer !== null && index === currentQuestion.correct;
                      return <button key={answer} type="button" className={`${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""}`} onClick={() => selectQuizAnswer(index)} disabled={selectedAnswer !== null}>{answer}{isCorrect && <CheckCircle size={18} weight="fill" />}</button>;
                    })}</div>
                    {selectedAnswer !== null && <p className={selectedAnswer === currentQuestion.correct ? "is-correct" : "is-wrong"}>{selectedAnswer === currentQuestion.correct ? "Bien joué !" : "Presque ! Essaie encore."}</p>}
                    {selectedAnswer !== null && <button type="button" className="clubhouse-modal__primary" onClick={continueQuiz}>{selectedAnswer === currentQuestion.correct ? (questionIndex === sessionQuestions.length - 1 ? "Voir mon résultat" : "Question suivante") : "Réessayer"}<CaretRight size={18} weight="bold" /></button>}
                  </div>
                )}

                {phase === "active" && selectedActivity.variant === "memory" && (
                  <div className="clubhouse-memory"><PhaserMemoryGame onComplete={completeActivity} /><p><ShieldCheck size={15} weight="fill" /> Le jeu reste entièrement dans Secret Clubhouse.</p></div>
                )}

                {phase === "active" && selectedActivity.variant === "connect-four" && (
                  <ConnectFourGame child={child} onComplete={completeActivity} />
                )}
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function ProfileScreen({ child, onOpenPreferences, onLogout }) {
  const [idCopied, setIdCopied] = useState(false);

  const copyOwnId = async () => {
    await copyContactId(child.contactId);
    setIdCopied(true);
  };

  return (
    <section className="feature-screen profile-screen">
      <Avatar person={child} size="hero" />
      <span className="eyebrow">Mon espace</span>
      <h1>{child.name}</h1>
      <span className="child-username">@{child.username}</span>
      <button type="button" className={`child-contact-id ${idCopied ? "is-copied" : ""}`} onClick={copyOwnId}>
        <span><IdentificationCard size={22} weight="fill" /></span>
        <span><strong>Mon identifiant de contact</strong><small>{idCopied ? "Identifiant copié !" : child.contactId}</small></span>
        {idCopied ? <CheckCircle size={20} weight="fill" /> : <Copy size={19} weight="bold" />}
      </button>
      <div className="parent-card">
        <ShieldCheck size={28} weight="fill" />
        <div><strong>Compte protégé</strong><span>Géré par un parent</span></div>
      </div>
      <PushNotificationButton />
      <button type="button" className="secondary-button" onClick={onOpenPreferences}><GearSix size={19} weight="bold" /> Mes préférences</button>
      <button type="button" className="child-logout-button" onClick={onLogout}><SignOut size={18} weight="bold" /> Se déconnecter</button>
    </section>
  );
}

const avatarChoices = [
  { key: "hair", label: "Coiffure", choices: [{ id: "short", label: "Courte" }, { id: "bob", label: "Carré" }, { id: "curly", label: "Boucles" }, { id: "spiky", label: "Pics" }, { id: "bun", label: "Chignon" }, { id: "long", label: "Longue" }, { id: "braids", label: "Tresses" }, { id: "afro", label: "Afro" }, { id: "ponytail", label: "Queue" }, { id: "waves", label: "Vagues" }] },
  { key: "hairColor", label: "Cheveux", choices: [{ id: "brown", label: "Brun" }, { id: "black", label: "Noir" }, { id: "blond", label: "Blond" }, { id: "ginger", label: "Roux" }, { id: "violet", label: "Violet" }, { id: "chestnut", label: "Châtain" }, { id: "pink", label: "Rose" }, { id: "blue", label: "Bleu" }, { id: "teal", label: "Turquoise" }, { id: "silver", label: "Argent" }] },
  { key: "face", label: "Visage", choices: [{ id: "smile", label: "Sourire" }, { id: "happy", label: "Joyeux" }, { id: "calm", label: "Calme" }, { id: "freckles", label: "Taches" }, { id: "wink", label: "Clin d’œil" }, { id: "laugh", label: "Rire" }, { id: "surprised", label: "Surpris" }, { id: "shy", label: "Timide" }, { id: "star", label: "Étoiles" }, { id: "confident", label: "Confiant" }] },
  { key: "skin", label: "Peau", choices: [{ id: "light", label: "Très claire" }, { id: "porcelain", label: "Porcelaine" }, { id: "warm", label: "Claire" }, { id: "peach", label: "Pêche" }, { id: "tan", label: "Dorée" }, { id: "olive", label: "Olive" }, { id: "caramel", label: "Caramel" }, { id: "brown", label: "Brune" }, { id: "deep", label: "Foncée" }, { id: "ebony", label: "Ébène" }] },
  { key: "outfit", label: "Vêtements", choices: [{ id: "mint", label: "Menthe" }, { id: "violet", label: "Violet" }, { id: "coral", label: "Corail" }, { id: "sun", label: "Soleil" }, { id: "blue", label: "Bleu" }, { id: "rose", label: "Rose" }, { id: "teal", label: "Turquoise" }, { id: "navy", label: "Indigo" }, { id: "lilac", label: "Lilas" }, { id: "orange", label: "Orange" }] },
];

function AvatarPreferencesScreen({ child, onBack, onSave }) {
  const [draft, setDraft] = useState({ ...defaultAvatar, ...(child.avatar ?? {}) });
  const [activeCategory, setActiveCategory] = useState("hair");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const category = avatarChoices.find((item) => item.key === activeCategory);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      onBack();
    } catch (saveError) {
      setError(saveError.message || "Impossible d’enregistrer l’avatar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="avatar-maker-screen">
      <header className="feature-header avatar-maker-header">
        <button type="button" onClick={onBack} aria-label="Retour"><ArrowLeft size={22} weight="bold" /></button>
        <div><span className="eyebrow">Mes préférences</span><h1>Mon avatar</h1></div>
        <span className="avatar-maker-header__sparkle"><Sparkle size={20} weight="fill" /></span>
      </header>
      <div className="avatar-maker-preview">
        <span className="avatar-maker-preview__halo" aria-hidden="true" />
        <Avatar person={{ ...child, image: null, avatar: draft }} size="maker" />
        <strong>Crée un avatar qui te ressemble</strong>
        <small>Tu peux le modifier quand tu veux.</small>
      </div>
      <div className="avatar-maker-tabs" role="tablist" aria-label="Parties de l’avatar">
        {avatarChoices.map((item) => <button key={item.key} type="button" role="tab" aria-selected={activeCategory === item.key} className={activeCategory === item.key ? "is-active" : ""} onClick={() => setActiveCategory(item.key)}>{item.label}</button>)}
      </div>
      <section className="avatar-maker-options" aria-label={category.label}>
        <h2>Choisis : {category.label.toLowerCase()}</h2>
        <div>
          {category.choices.map((choice) => (
            <button key={choice.id} type="button" className={`${draft[category.key] === choice.id ? "is-selected" : ""} avatar-choice avatar-choice--${category.key}`} onClick={() => setDraft((current) => ({ ...current, [category.key]: choice.id }))} aria-pressed={draft[category.key] === choice.id}>
              <span className={`avatar-choice__sample avatar-choice__sample--${choice.id}`} aria-hidden="true">{["hair", "face"].includes(category.key) ? <AvatarIllustration avatar={{ ...draft, [category.key]: choice.id }} name="" /> : null}</span>
              <small>{choice.label}</small>
              {draft[category.key] === choice.id && <CheckCircle size={17} weight="fill" />}
            </button>
          ))}
        </div>
      </section>
      {error && <p className="avatar-maker-error" role="alert">{error}</p>}
      <button type="button" className="avatar-maker-save" onClick={save} disabled={saving}><Check size={20} weight="bold" /> {saving ? "Enregistrement…" : "Enregistrer mon avatar"}</button>
    </section>
  );
}

function ParentPasswordModal({ onClose, onSave }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const submitPassword = async (event) => {
    event.preventDefault();
    if (currentPassword.length < 8) {
      setError("Saisissez votre mot de passe actuel.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("Le nouveau mot de passe doit contenir entre 8 et 128 caractères.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choisissez un mot de passe différent de l’ancien.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onSave({ currentPassword, newPassword });
      setIsComplete(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onClose}>
      <section className="parent-password-modal" role="dialog" aria-modal="true" aria-labelledby="parent-password-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer" disabled={isSaving}><X size={21} weight="bold" /></button>
        {isComplete ? <div className="parent-password-success"><span><CheckCircle size={36} weight="fill" /></span><h2 id="parent-password-title">Mot de passe modifié</h2><p>Votre nouveau mot de passe est actif. Votre session actuelle reste ouverte.</p><button type="button" className="primary-button" onClick={onClose}>Terminer</button></div> : <>
          <div className="parent-password-heading"><span><LockKey size={28} weight="fill" /></span><div><small>Sécurité du compte parent</small><h2 id="parent-password-title">Modifier le mot de passe</h2><p>Confirmez d’abord votre mot de passe actuel.</p></div></div>
          <form className="parent-password-form" onSubmit={submitPassword}>
            <label><span>Mot de passe actuel</span><span className="parent-password-field"><input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }} autoComplete="current-password" placeholder="Votre mot de passe actuel" autoFocus /><button type="button" onClick={() => setShowCurrentPassword((current) => !current)} aria-label={showCurrentPassword ? "Masquer le mot de passe actuel" : "Afficher le mot de passe actuel"}>{showCurrentPassword ? <EyeSlash size={19} weight="bold" /> : <Eye size={19} weight="bold" />}</button></span></label>
            <label><span>Nouveau mot de passe</span><span className="parent-password-field"><input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(""); }} autoComplete="new-password" placeholder="8 caractères minimum" maxLength={128} /><button type="button" onClick={() => setShowNewPassword((current) => !current)} aria-label={showNewPassword ? "Masquer le nouveau mot de passe" : "Afficher le nouveau mot de passe"}>{showNewPassword ? <EyeSlash size={19} weight="bold" /> : <Eye size={19} weight="bold" />}</button></span></label>
            <label><span>Confirmer le nouveau mot de passe</span><input type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} autoComplete="new-password" placeholder="Retapez le nouveau mot de passe" maxLength={128} /></label>
            <div className="password-security-note"><ShieldCheck size={17} weight="fill" /><span>Le mot de passe est protégé de façon sécurisée et n’est jamais affiché aux enfants.</span></div>
            {error && <p className="parent-password-error" role="alert">{error}</p>}
            <div className="parent-password-actions"><button type="button" onClick={onClose} disabled={isSaving}>Annuler</button><button type="submit" disabled={isSaving}>{isSaving ? "Enregistrement…" : "Modifier le mot de passe"}</button></div>
          </form>
        </>}
      </section>
    </div>
  );
}

function FamilyInviteAcceptanceModal({ invitation, parent, onAccept, onUseAnotherAccount, onDismiss }) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");
  const emailMatches = !invitation.email || invitation.email.toLowerCase() === String(parent.email ?? "").toLowerCase();

  const accept = async () => {
    setIsAccepting(true);
    setError("");
    try {
      await onAccept();
    } catch (acceptError) {
      setError(acceptError.message || "Impossible d’accepter cette invitation.");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="family-invite-acceptance" role="dialog" aria-modal="true" aria-labelledby="family-invite-acceptance-title">
        <button type="button" className="modal-close" onClick={onDismiss} aria-label="Fermer" disabled={isAccepting}><X size={21} weight="bold" /></button>
        <span className="family-invite-acceptance__icon"><UsersThree size={34} weight="fill" /></span>
        <small>Invitation de co-parent</small>
        <h2 id="family-invite-acceptance-title">Rejoindre {invitation.familyName}</h2>
        <p><strong>{invitation.invitedByName}</strong> souhaite vous donner accès aux mêmes profils enfant et réglages familiaux.</p>
        <div className={`family-invite-account ${emailMatches ? "" : "has-error"}`}><UserCircle size={23} weight="fill" /><span><strong>{parent.name}</strong><small>{parent.email}</small></span>{emailMatches ? <CheckCircle size={19} weight="fill" /> : <X size={18} weight="bold" />}</div>
        {!emailMatches && <p className="family-invite-error" role="alert">Cette invitation est destinée à {invitation.email}. Utilisez le compte correspondant.</p>}
        {error && <p className="family-invite-error" role="alert">{error}</p>}
        <div className="family-invite-acceptance__actions">
          <button type="button" onClick={onUseAnotherAccount} disabled={isAccepting}>Utiliser un autre compte</button>
          <button type="button" onClick={accept} disabled={!emailMatches || isAccepting}><CheckCircle size={18} weight="fill" /> {isAccepting ? "Acceptation…" : "Accepter l’invitation"}</button>
        </div>
      </section>
    </div>
  );
}

function FamilyInviteErrorModal({ message, onDismiss }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onDismiss}>
      <section className="family-invite-acceptance" role="dialog" aria-modal="true" aria-labelledby="family-invite-error-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onDismiss} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <span className="family-invite-acceptance__icon family-invite-acceptance__icon--error"><X size={30} weight="bold" /></span>
        <small>Invitation indisponible</small>
        <h2 id="family-invite-error-title">Ce lien ne peut plus être utilisé</h2>
        <p>{message}</p>
        <button type="button" className="primary-button family-parents-close" onClick={onDismiss}>Revenir à ma famille</button>
      </section>
    </div>
  );
}

function FamilyParentsModal({ family, currentParent, onClose, onInvite, onRevoke, onRemove }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [createdInvitation, setCreatedInvitation] = useState(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const isPrimary = family?.role === "primary";
  const members = family?.members ?? [];
  const invitations = family?.pendingInvitations ?? [];

  const inviteParent = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Saisissez l’adresse e-mail valide du co-parent.");
      return;
    }
    setBusyAction("invite");
    setError("");
    try {
      const result = await onInvite(cleanEmail);
      const invitation = result?.invitation ?? result;
      setCreatedInvitation(invitation);
      setEmail("");
    } catch (inviteError) {
      setError(inviteError.message || "Impossible de créer l’invitation.");
    } finally {
      setBusyAction("");
    }
  };

  const copyInvitationLink = async (invitation) => {
    const link = invitation?.link ?? invitation?.inviteUrl ?? invitation?.invite_url;
    if (!link) {
      setError("Le lien secret n’est affiché qu’au moment de créer l’invitation. Révoquez-la et créez-en une nouvelle si nécessaire.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInvitationId(invitation.id ?? "new");
    } catch {
      setError("Le presse-papiers est indisponible. Sélectionnez et copiez le lien manuellement.");
    }
  };

  const revokeInvitation = async (invitationId) => {
    setBusyAction(`revoke-${invitationId}`);
    setError("");
    try {
      await onRevoke(invitationId);
      if (createdInvitation?.id === invitationId) setCreatedInvitation(null);
    } catch (revokeError) {
      setError(revokeError.message || "Impossible de révoquer cette invitation.");
    } finally {
      setBusyAction("");
    }
  };

  const removeParent = async (member) => {
    if (confirmRemoveId !== member.id) {
      setConfirmRemoveId(member.id);
      return;
    }
    setBusyAction(`remove-${member.id}`);
    setError("");
    try {
      await onRemove(member.id);
      setConfirmRemoveId(null);
    } catch (removeError) {
      setError(removeError.message || "Impossible de retirer ce co-parent.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={busyAction ? undefined : onClose}>
      <section className="family-parents-modal" role="dialog" aria-modal="true" aria-labelledby="family-parents-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer" disabled={Boolean(busyAction)}><X size={21} weight="bold" /></button>
        <div className="family-parents-heading"><span><UsersThree size={29} weight="fill" /></span><div><small>Accès adultes protégés</small><h2 id="family-parents-title">Parents de la famille</h2><p>Chaque parent utilise son propre compte.</p></div></div>

        <div className="family-role-note"><ShieldCheck size={18} weight="fill" /><span><strong>{isPrimary ? "Vous êtes le parent principal" : "Vous êtes co-parent"}</strong><small>{isPrimary ? "Vous contrôlez les invitations, les retraits et les suppressions définitives." : "Vous pouvez gérer les profils et leurs règles, sans supprimer la famille."}</small></span></div>

        <div className="family-parent-list">
          {members.map((member) => {
            const isCurrent = member.isCurrent || member.id === currentParent.id;
            const canRemove = isPrimary && member.role === "coparent" && !isCurrent;
            return <article className="family-parent-card" key={member.id}>
              <span className={`family-parent-avatar ${member.role === "primary" ? "is-primary" : ""}`}><UserCircle size={27} weight="fill" /></span>
              <div><strong>{member.name}{isCurrent ? " · vous" : ""}</strong><small>{member.email}</small><span>{member.role === "primary" ? "Parent principal" : "Co-parent"}</span></div>
              {canRemove ? <button type="button" className={confirmRemoveId === member.id ? "is-confirming" : ""} onClick={() => removeParent(member)} disabled={busyAction === `remove-${member.id}`} aria-label={`Retirer ${member.name}`}><Trash size={16} weight="bold" /><span>{busyAction === `remove-${member.id}` ? "Retrait…" : confirmRemoveId === member.id ? "Confirmer" : "Retirer"}</span></button> : <ShieldCheck size={19} weight="fill" />}
            </article>;
          })}
        </div>

        {isPrimary && <form className="family-invite-form" onSubmit={inviteParent}>
          <div><span><UserPlus size={20} weight="fill" /></span><div><strong>Inviter un co-parent</strong><small>Le lien expire et fonctionne seulement avec cette adresse e-mail.</small></div></div>
          <label htmlFor="coparent-email">Adresse e-mail</label>
          <div className="family-invite-field"><input id="coparent-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="coparent@exemple.fr" autoComplete="email" disabled={busyAction === "invite"} /><button type="submit" disabled={busyAction === "invite"}><UserPlus size={17} weight="bold" /> {busyAction === "invite" ? "Création…" : "Inviter"}</button></div>
        </form>}

        {createdInvitation?.link && <div className="family-created-invite" role="status"><CheckCircle size={19} weight="fill" /><span><strong>Invitation prête pour {createdInvitation.email}</strong><small>Copiez ce lien maintenant : le secret ne sera plus affiché ensuite.</small><code>{createdInvitation.link}</code></span><button type="button" onClick={() => copyInvitationLink(createdInvitation)}>{copiedInvitationId === createdInvitation.id ? <CheckCircle size={17} weight="fill" /> : <Copy size={17} weight="bold" />}{copiedInvitationId === createdInvitation.id ? "Copié" : "Copier"}</button></div>}

        {invitations.length > 0 && <section className="family-pending-invites" aria-labelledby="pending-family-invites-title"><h3 id="pending-family-invites-title">Invitations en attente</h3>{invitations.map((invitation) => <article key={invitation.id}><span><strong>{invitation.email}</strong><small>Expire le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(invitation.expiresAt))}</small></span>{isPrimary && <button type="button" onClick={() => revokeInvitation(invitation.id)} disabled={busyAction === `revoke-${invitation.id}`}><X size={15} weight="bold" /> {busyAction === `revoke-${invitation.id}` ? "Révocation…" : "Révoquer"}</button>}</article>)}</section>}

        {error && <p className="family-invite-error" role="alert">{error}</p>}
        <button type="button" className="primary-button family-parents-close" onClick={onClose} disabled={Boolean(busyAction)}>Terminer</button>
      </section>
    </div>
  );
}

function PausedChildScreen({ child, onParentLogin }) {
  return (
    <section className="feature-screen paused-child-screen" aria-labelledby="paused-child-title">
      <span className="paused-lock"><LockKey size={38} weight="fill" /></span>
      <span className="eyebrow">Compte en pause</span>
      <h1 id="paused-child-title">À bientôt, {child.name}</h1>
      <p>Un parent a temporairement mis ce profil en pause.</p>
      <button className="primary-button" type="button" onClick={onParentLogin}><ShieldCheck size={19} weight="fill" /> Connexion parent</button>
    </section>
  );
}

function NoChildScreen({ onOpenParent }) {
  return (
    <section className="feature-screen paused-child-screen" aria-labelledby="no-child-title">
      <span className="paused-lock"><UserPlus size={38} weight="fill" /></span>
      <span className="eyebrow">Espace familial</span>
      <h1 id="no-child-title">Aucun profil enfant</h1>
      <p>Ajoutez un enfant depuis l’espace parent pour commencer.</p>
      <button className="primary-button" type="button" onClick={onOpenParent}><ShieldCheck size={19} weight="fill" /> Ouvrir l’espace parent</button>
    </section>
  );
}

function SafetyToggle({ icon: Icon, title, detail, checked, onChange }) {
  return (
    <button className="safety-setting" type="button" role="switch" aria-checked={checked} onClick={onChange}>
      <span className="setting-icon"><Icon size={20} weight="fill" /></span>
      <span className="setting-copy"><strong>{title}</strong><small>{detail}</small></span>
      <span className={`toggle ${checked ? "is-on" : ""}`} aria-hidden="true"><span /></span>
    </button>
  );
}

function ChildProfilesPanel({ children, activeChildId, onSelectChild, onAddChild }) {
  return (
    <section className="children-panel" aria-labelledby="children-title">
      <div className="children-panel__heading">
        <div><span>Famille</span><h2 id="children-title">Mes enfants</h2></div>
        <button type="button" className="add-child-button" onClick={onAddChild}><Plus size={18} weight="bold" /> Ajouter</button>
      </div>
      <div className="child-profile-list">
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            className={`child-profile-chip ${activeChildId === child.id ? "is-selected" : ""}`}
            onClick={() => onSelectChild(child.id)}
            aria-pressed={activeChildId === child.id}
          >
            <Avatar person={child} size="child-tab" />
            <span><strong>{child.name}</strong><small>{child.age} ans · {child.status === "active" ? "Actif" : "En pause"}</small></span>
            {activeChildId === child.id && <CheckCircle size={18} weight="fill" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </section>
  );
}

function formatScheduleTime(value) {
  const [hours, minutes] = value.split(":");
  return `${Number(hours)} h ${minutes}`;
}

function ParentGamesScreen({ parent, onBack }) {
  return (
    <section className="parent-games-screen" aria-labelledby="parent-games-title">
      <header className="parent-messages-header">
        <button type="button" className="parent-back-button" onClick={onBack} aria-label="Retour au tableau de bord parent"><ArrowLeft size={22} weight="bold" /></button>
        <div><span>Mode parent</span><h1 id="parent-games-title">Jeux en famille</h1></div>
        <span className="parent-games-screen__icon"><GameController size={25} weight="fill" /></span>
      </header>
      <div className="parent-games-screen__content">
        <div className="parent-games-intro"><ShieldCheck size={20} weight="fill" /><span><strong>Un espace de jeu privé</strong><small>Jouez avec vos enfants, vos co-parents et vos contacts approuvés.</small></span></div>
        <ConnectFourGame child={parent} />
      </div>
    </section>
  );
}

function ParentDashboard({ parentName, family, children, child, onSelectChild, onAddChild, onEditChild, onMessageChild, settings, onToggleSetting, schedule, unreadMessages, onOpenMessages, onOpenGames, onOpenFamilyParents, onOpenContactIds, onOpenPassword, onEditSchedule, onLogout }) {
  const scheduleDetail = schedule.enabled ? `Messages ${formatScheduleTime(schedule.messages.start)}–${formatScheduleTime(schedule.messages.end)}` : "Planification désactivée";

  return (
    <section className="parent-dashboard" aria-labelledby="parent-dashboard-title">
      <header className="parent-topbar">
        <div>
          <span className="parent-topbar__eyebrow"><ShieldCheck size={15} weight="fill" /> Mode parent</span>
          <h1 id="parent-dashboard-title">Bonjour, {parentName}</h1>
        </div>
        <div className="parent-topbar__actions">
          <button type="button" className="parent-message-button" onClick={onOpenMessages} aria-label={`Ouvrir la messagerie parentale${unreadMessages ? `, ${unreadMessages} messages non lus` : ""}`}><ChatCircleDots size={21} weight="fill" />{unreadMessages > 0 && <span>{unreadMessages}</span>}</button>
          <span className="parent-avatar" aria-label={`Profil de ${parentName}`} role="img"><UserCircle size={30} weight="fill" /></span>
          <button type="button" className="parent-logout-button" onClick={onLogout}><SignOut size={19} weight="bold" /><span>Déconnexion</span></button>
        </div>
      </header>

      <div className="parent-content">
        <ChildProfilesPanel children={children} activeChildId={child?.id} onSelectChild={onSelectChild} onAddChild={onAddChild} />

        <button type="button" className="parent-messages-entry" onClick={onOpenMessages}>
          <span className="parent-messages-entry__icon"><ChatCircleDots size={24} weight="fill" /></span>
          <span><strong>Famille et parents</strong><small>Échangez avec l’autre parent, vos enfants et les parents de leurs contacts.</small></span>
          {unreadMessages > 0 ? <span className="parent-message-count">{unreadMessages}</span> : <CheckCircle size={20} weight="fill" />}
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>

        <button type="button" className="parent-games-entry" onClick={onOpenGames}>
          <span className="parent-games-entry__icon"><GameController size={24} weight="fill" /></span>
          <span><strong>Jeux en famille</strong><small>Acceptez une invitation ou lancez une partie avec vos enfants.</small></span>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>

        <button type="button" className="family-parents-entry" onClick={onOpenFamilyParents}>
          <span><UsersThree size={23} weight="fill" /></span>
          <span><strong>Parents de la famille</strong><small>{family?.role === "primary" ? "Invitez et gérez les co-parents autorisés." : "Consultez les adultes autorisés de la famille."}</small></span>
          <span className="family-parents-count">{family?.members?.length ?? 1}{family?.pendingInvitations?.length ? <small>+{family.pendingInvitations.length}</small> : null}</span>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>

        <button type="button" className="family-ids-entry" onClick={onOpenContactIds}>
          <span><IdentificationCard size={23} weight="fill" /></span>
          <span><strong>Identifiants de contact</strong><small>Un numéro unique et non réutilisable par membre.</small></span>
          <span className="family-ids-count">{children.length + (family?.members?.length ?? 1)}</span>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>

        <button type="button" className="parent-password-entry" onClick={onOpenPassword}>
          <span><LockKey size={22} weight="fill" /></span>
          <span><strong>Mot de passe parent</strong><small>Modifier vos informations de connexion.</small></span>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>

        <a className="parent-apk-entry" href="/downloads/Secret-Clubhouse.apk" download="Secret-Clubhouse.apk">
          <span><DownloadSimple size={23} weight="bold" /></span>
          <span><strong>Installer sur Android</strong><small>Télécharger l’application Secret Clubhouse · APK · 12,7 Mo</small></span>
          <span className="parent-apk-badge">APK</span>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </a>

        {!child && (
          <section className="empty-family-card" aria-labelledby="empty-family-title">
            <span><UserPlus size={34} weight="fill" /></span>
            <div><span>Première étape</span><h2 id="empty-family-title">Ajoutez votre premier enfant</h2><p>Créez un identifiant privé adapté aux 6–13 ans. Aucun numéro de téléphone ne sera demandé.</p></div>
            <button className="primary-button" type="button" onClick={onAddChild}><Plus size={18} weight="bold" /> Créer un profil enfant</button>
          </section>
        )}

        {child && <>

        <section className={`child-overview ${child.status === "paused" ? "is-paused" : ""}`} aria-label={`Compte enfant de ${child.name}`}>
          <Avatar person={child} size="parent-child" />
          <div><span>Profil sélectionné</span><strong>{child.name}</strong><small>@{child.username} · ID {child.contactId} · {child.age} ans · {child.status === "active" ? "Compte actif" : "Compte en pause"}</small></div>
          <div className="child-overview__actions">
            <button type="button" className="child-message-action" onClick={onMessageChild} aria-label={`Écrire à ${child.name}`} title={`Écrire à ${child.name}`}><ChatCircleDots size={20} weight="fill" /></button>
            <button type="button" className="child-edit-button" onClick={onEditChild} aria-label={`Modifier le profil de ${child.name}`} title="Modifier le profil"><PencilSimple size={19} weight="bold" /></button>
          </div>
        </section>

        <div className="parent-stats" aria-label="Résumé du compte">
          <div><UsersThree size={22} weight="fill" /><strong>0</strong><span>amis</span></div>
          <div><UserPlus size={22} weight="fill" /><strong>0</strong><span>demande</span></div>
          <div><Shield size={22} weight="fill" /><strong>3</strong><span>protections</span></div>
        </div>

        <section className="parent-section" aria-labelledby="requests-title">
          <div className="parent-section__title">
            <div><span className="section-icon section-icon--mint"><UserPlus size={19} weight="fill" /></span><div><h2 id="requests-title">Demandes d’amis</h2><p>Vous décidez qui peut parler à {child.name}.</p></div></div>
          </div>
          <div className="request-empty"><CheckCircle size={20} weight="fill" /><div><strong>Aucune demande en attente</strong><span>Les nouvelles invitations apparaîtront ici.</span></div></div>
        </section>

        <section className="parent-section" aria-labelledby="safety-title">
          <div className="parent-section__title">
            <div><span className="section-icon section-icon--violet"><ShieldCheck size={19} weight="fill" /></span><div><h2 id="safety-title">Règles de sécurité</h2><p>Réglages appliqués au compte de {child.name}.</p></div></div>
          </div>
          <div className="settings-list">
            <SafetyToggle icon={PencilSimple} title="Photos, images et vidéos" detail="Autoriser l’envoi entre amis approuvés" checked={settings.media} onChange={() => onToggleSetting("media")} />
            <button className="safety-setting schedule-setting" type="button" onClick={onEditSchedule} aria-label={`Gérer les horaires de ${child.name}`}>
              <span className="setting-icon"><Clock size={20} weight="fill" /></span>
              <span className="setting-copy"><strong>Mode calme</strong><small>{scheduleDetail}</small></span>
              <span className="schedule-setting__tail" aria-hidden="true"><span className={`toggle ${schedule.enabled ? "is-on" : ""}`}><span /></span><CaretRight size={16} weight="bold" /></span>
            </button>
          </div>
        </section>

        <section className="parent-section parent-activity" aria-labelledby="activity-title">
          <div className="parent-section__title">
            <div><span className="section-icon section-icon--sun"><Bell size={19} weight="fill" /></span><div><h2 id="activity-title">Activité récente</h2><p>Un résumé qui respecte ses conversations.</p></div></div>
          </div>
          <div className="activity-row"><CheckCircle size={19} weight="fill" /><span><strong>Aucun signalement</strong><small>Ces 7 derniers jours</small></span></div>
          <div className="privacy-note"><LockKey size={16} weight="fill" /> Le contenu des messages reste privé. Vous voyez uniquement les alertes de sécurité.</div>
        </section>

        </>}

        <PushNotificationButton />
      </div>
    </section>
  );
}

function ParentMessagesScreen({ parentName, familyChildren, threads, selectedThreadId, onSelectThread, onBack, onSend, onSendMedia, onOpenFamilyConversation, initialContactId = "", onContactHandled }) {
  const [draft, setDraft] = useState("");
  const [mediaByThread, setMediaByThread] = useState({});
  const [mediaError, setMediaError] = useState("");
  const [isAddingContact, setIsAddingContact] = useState(Boolean(initialContactId));
  const [contactId, setContactId] = useState(initialContactId);
  const [contactFeedback, setContactFeedback] = useState(null);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [messageError, setMessageError] = useState("");
  const parentMediaInputRef = useRef(null);
  const parentMediaUrlsRef = useRef([]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const { typingName, notifyTyping, stopTyping } = useTypingIndicator(selectedThread?.id, Boolean(selectedThread?.serverBacked));

  const submitContact = async (event) => {
    event.preventDefault();
    const normalizedId = contactId.trim().toUpperCase();
    if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(normalizedId)) {
      setContactFeedback({ type: "error", text: "Utilisez le format SC-123-456-789." });
      return;
    }
    setIsSubmittingContact(true);
    setContactFeedback(null);
    try {
      const familyChild = familyChildren.find((child) => child.contactId === normalizedId);
      if (familyChild) {
        await onOpenFamilyConversation(normalizedId);
        setContactId("");
        setIsAddingContact(false);
        if (window.location.search) window.history.replaceState({}, "", window.location.pathname);
        onContactHandled?.();
        return;
      }
      await api.addContact(normalizedId);
      setContactFeedback({ type: "success", text: "Demande envoyée au parent du contact." });
      setContactId("");
      if (window.location.search) window.history.replaceState({}, "", window.location.pathname);
      onContactHandled?.();
    } catch (error) {
      setContactFeedback({ type: "error", text: error.message });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  useEffect(() => () => parentMediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const submitMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !selectedThread) return;
    setMessageError("");
    try {
      await onSend(selectedThread.id, message);
      setDraft("");
      stopTyping();
    } catch (error) {
      setMessageError(error.message);
    }
  };

  const sendParentMedia = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedThread || !files.length) return;
    const supportedFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (supportedFiles.some((file) => file.size > 25 * 1024 * 1024)) {
      setMediaError("Chaque photo ou vidéo doit faire moins de 25 Mo.");
      return;
    }
    if (!supportedFiles.length) {
      setMediaError("Choisissez une image, une photo ou une vidéo.");
      return;
    }
    try {
      if (selectedThread.serverBacked) {
        await onSendMedia(selectedThread.id, supportedFiles);
      } else {
        const media = supportedFiles.map((file) => {
          const url = URL.createObjectURL(file);
          parentMediaUrlsRef.current.push(url);
          return { id: `parent-media-${Date.now()}-${file.name}`, direction: "sent", type: file.type.startsWith("video/") ? "video" : "image", url, name: file.name, status: "received" };
        });
        setMediaByThread((current) => ({ ...current, [selectedThread.id]: [...(current[selectedThread.id] ?? []), ...media] }));
      }
      setMediaError("");
    } catch (error) {
      setMediaError(error.message || "La photo n’a pas pu être envoyée.");
    }
  };

  const sendParentVoice = async (blob, duration) => {
    if (!selectedThread) return;
    const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `message-vocal-${duration}s.${extension}`, { type: blob.type || "audio/webm" });
    await onSendMedia(selectedThread.id, [file]);
  };

  if (selectedThread) {
    return (
      <section className="parent-messages-screen parent-thread-screen" aria-label={`Conversation parentale avec ${selectedThread.name}`}>
        <header className="parent-messages-header parent-thread-header">
          <button type="button" className="parent-back-button" onClick={() => onSelectThread(null)} aria-label="Retour aux conversations parentales"><ArrowLeft size={22} weight="bold" /></button>
          <span className="parent-contact-avatar" aria-hidden="true">{selectedThread.initials}</span>
          <div><strong>{selectedThread.name}</strong><small>{selectedThread.isFamily ? "Mon enfant · Conversation familiale" : selectedThread.isHouseholdParent ? "Parent de la famille · Discussion privée" : `${selectedThread.relation} · Contact adulte`}</small></div>
        </header>
        <div className="parent-thread-safety"><ShieldCheck size={17} weight="fill" /><span>{selectedThread.isFamily ? `Discussion familiale directe avec ${selectedThread.name}.` : selectedThread.isHouseholdParent ? "Discussion privée entre les parents de votre famille." : "Discussion entre adultes, séparée de la messagerie des enfants."}</span></div>
        <div className="parent-thread-messages" aria-live="polite">
          <span className="parent-thread-day">Aujourd’hui</span>
          {selectedThread.messages.map((message) => message.type === "audio"
            ? <ConversationVoiceMessage key={message.id} message={message} parent />
            : message.type === "image" || message.type === "video"
              ? <ConversationMediaMessage key={message.id} message={message} parent />
              : <div className={`parent-message-bubble parent-message-bubble--${message.direction}`} key={message.id}>
                  <p>{message.text}</p><span className="parent-message-meta"><time>{message.time}</time>{message.direction === "sent" && <MessageStatus status={message.status ?? "seen"} />}</span>
                </div>)}
          {(mediaByThread[selectedThread.id] ?? []).map((media) => media.type === "audio"
            ? <VoiceMessage key={media.id} url={media.url} duration={media.duration} status={media.status} parent />
            : <ConversationMediaMessage key={media.id} message={media} parent />)}
          <TypingIndicator name={typingName} />
        </div>
        {messageError && <div className="parent-media-error" role="alert">{messageError}</div>}
        {mediaError && <div className="parent-media-error" role="alert">{mediaError}</div>}
        <form className="parent-message-composer" onSubmit={submitMessage}>
          <input ref={parentMediaInputRef} className="sr-only" type="file" accept="image/*,video/*" multiple onChange={sendParentMedia} />
          <button type="button" className="parent-media-button" onClick={() => parentMediaInputRef.current?.click()} aria-label="Ajouter des photos ou vidéos"><Plus size={21} weight="bold" /></button>
          <label><span className="sr-only">Écrire un message à {selectedThread.name}</span><input value={draft} onChange={(event) => { setDraft(event.target.value); if (event.target.value.trim()) notifyTyping(); else stopTyping(); }} placeholder="Votre message…" /></label>
          <VoiceRecorder onSend={sendParentVoice} parent />
          <button type="submit" disabled={!draft.trim()} aria-label="Envoyer le message"><PaperPlaneTilt size={21} weight="fill" /></button>
        </form>
      </section>
    );
  }

  return (
    <section className="parent-messages-screen" aria-labelledby="parent-messages-title">
      <header className="parent-messages-header">
        <button type="button" className="parent-back-button" onClick={onBack} aria-label="Retour au tableau de bord parent"><ArrowLeft size={22} weight="bold" /></button>
        <div><span>Mode parent</span><h1 id="parent-messages-title">Messagerie parentale</h1></div>
        <span className="parent-avatar" aria-label={`Profil de ${parentName}`} role="img"><UserCircle size={28} weight="fill" /></span>
      </header>

      <div className="parent-messages-content">
        <div className="parent-inbox-intro"><span><LockKey size={21} weight="fill" /></span><div><strong>Votre messagerie protégée</strong><p>Parlez à l’autre parent de la famille, à vos enfants ou aux parents de leurs contacts, sans voir les discussions entre enfants.</p></div></div>
        <div className="parent-inbox-title"><div><h2>Conversations</h2><span>{threads.length} contact{threads.length > 1 ? "s" : ""}</span></div><button type="button" className="parent-add-contact" onClick={() => { setIsAddingContact(true); setContactFeedback(null); }}><UserPlus size={18} weight="bold" /><span>Ajouter un contact</span></button></div>
        <div className="parent-thread-list">
          {threads.map((thread) => (
            <button type="button" className="parent-thread-row" key={thread.id} onClick={() => onSelectThread(thread.id)} aria-label={`Ouvrir la conversation avec ${thread.name}`}>
              <span className="parent-contact-avatar" aria-hidden="true">{thread.initials}</span>
              <span className="parent-thread-row__copy"><span><strong>{thread.name}</strong><small>{thread.time}</small></span><em>{thread.relation}</em><p>{thread.preview}</p></span>
              {thread.unread > 0 ? <span className="parent-thread-unread">{thread.unread}</span> : <CaretRight size={18} weight="bold" aria-hidden="true" />}
            </button>
          ))}
          {threads.length === 0 && <div className="parent-inbox-empty"><ChatCircleDots size={31} weight="fill" /><strong>Aucune conversation</strong><span>Invitez un co-parent, écrivez à l’un de vos enfants ou ajoutez le parent d’un contact.</span></div>}
        </div>
      </div>
      {isAddingContact && <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsAddingContact(false)}>
        <section className="add-contact-modal" role="dialog" aria-modal="true" aria-labelledby="add-contact-title" onMouseDown={(event) => event.stopPropagation()}>
          <span className="add-contact-icon"><UserPlus size={27} weight="fill" /></span>
          <h2 id="add-contact-title">Ajouter un contact</h2>
          <p>Un enfant de votre famille s’ouvre directement. Pour un contact extérieur, son parent devra approuver la demande.</p>
          <form onSubmit={submitContact}>
            <label htmlFor="new-contact-id">Identifiant du contact</label>
            <input id="new-contact-id" value={contactId} onChange={(event) => { setContactId(event.target.value.toUpperCase().slice(0, 14)); setContactFeedback(null); }} placeholder="SC-123-456-789" autoComplete="off" autoFocus />
            {contactFeedback && <div className={`contact-feedback contact-feedback--${contactFeedback.type}`} role="status">{contactFeedback.type === "success" ? <CheckCircle size={17} weight="fill" /> : <Shield size={17} weight="fill" />}<span>{contactFeedback.text}</span></div>}
            <div className="add-contact-actions"><button type="button" onClick={() => setIsAddingContact(false)}>Annuler</button><button type="submit" disabled={isSubmittingContact}>{isSubmittingContact ? "Ouverture…" : "Continuer"}</button></div>
          </form>
        </section>
      </div>}
    </section>
  );
}

function toUsername(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 18);
}

function ChildAccountModal({ child, canDelete = true, onClose, onSave, onDelete }) {
  const isEditing = Boolean(child);
  const [name, setName] = useState(child?.name ?? "");
  const [age, setAge] = useState(child?.age ?? 8);
  const [username, setUsername] = useState(child?.username ?? "");
  const [usernameEdited, setUsernameEdited] = useState(isEditing);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [color, setColor] = useState(child?.color ?? "mint");
  const [isActive, setIsActive] = useState(child?.status !== "paused");
  const [error, setError] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const avatarColors = ["mint", "violet", "sun", "coral"];

  const updateName = (value) => {
    setName(value.slice(0, 24));
    if (!usernameEdited) setUsername(toUsername(value));
    setError("");
  };

  const submitChild = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUsername = toUsername(username);
    const numericAge = Number(age);
    if (cleanName.length < 2 || cleanUsername.length < 3 || numericAge < 6 || numericAge > 13) {
      setError("Vérifiez le prénom, l’âge et l’identifiant.");
      return;
    }
    if ((!isEditing && password.length < 6) || (isEditing && password.length > 0 && password.length < 6)) {
      setError("Le mot de passe enfant doit contenir au moins 6 caractères.");
      return;
    }
    try {
      await onSave({
        ...child,
        name: cleanName,
        age: numericAge,
        username: cleanUsername,
        password: password || child?.password,
        image: child?.image ?? null,
        color,
        status: isActive ? "active" : "paused",
      });
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const deleteChildAccount = async () => {
    if (deleteConfirmation !== "SUPPRIMER") {
      setError("Tapez SUPPRIMER pour confirmer la suppression définitive.");
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await onDelete(child.id);
    } catch (deleteError) {
      setError(deleteError.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="child-account-modal" onSubmit={submitChild} onMouseDown={(event) => event.stopPropagation()} aria-labelledby="child-modal-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="child-modal-heading">
          <Avatar person={{ name: name || "?", image: child?.image ?? null, color }} size="child-form" />
          <div><span>Compte sans numéro de téléphone</span><h2 id="child-modal-title">{isEditing ? `Modifier ${child.name}` : "Créer un compte enfant"}</h2></div>
        </div>

        <div className="child-form-grid">
          <label className="form-field"><span>Prénom</span><input value={name} onChange={(event) => updateName(event.target.value)} placeholder="Ex. Jules" autoFocus /></label>
          <label className="form-field"><span>Âge</span><select value={age} onChange={(event) => setAge(event.target.value)}>{Array.from({ length: 8 }, (_, index) => index + 6).map((value) => <option key={value} value={value}>{value} ans</option>)}</select></label>
          <label className="form-field form-field--full"><span>Pseudo d’affichage</span><div className="username-field"><span>@</span><input value={username} onChange={(event) => { setUsername(event.target.value); setUsernameEdited(true); setError(""); }} placeholder="jules.club" /></div><small>Le pseudo sert uniquement à l’affichage. La connexion et les contacts utilisent le numéro unique généré séparément.</small></label>
          <label className="form-field form-field--full"><span>{isEditing ? "Nouveau mot de passe enfant" : "Mot de passe enfant"}</span><div className="child-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" placeholder={isEditing ? "Laisser vide pour ne pas le changer" : "6 caractères minimum"} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Masquer le mot de passe enfant" : "Afficher le mot de passe enfant"}>{showPassword ? "Masquer" : "Afficher"}</button></div><small>{isEditing ? "Laissez ce champ vide pour conserver le mot de passe actuel." : "Transmettez-le uniquement à votre enfant."}</small></label>
        </div>

        {!child?.image && (
          <fieldset className="avatar-colors"><legend>Couleur de l’avatar</legend><div>{avatarColors.map((item) => <button key={item} type="button" className={`avatar-color avatar-color--${item} ${color === item ? "is-selected" : ""}`} onClick={() => setColor(item)} aria-label={`Couleur ${item}`} aria-pressed={color === item}><span>{(name || "?").slice(0, 1).toUpperCase()}</span></button>)}</div></fieldset>
        )}

        {isEditing && (
          <button className="account-status-setting" type="button" role="switch" aria-checked={isActive} onClick={() => setIsActive((current) => !current)}>
            <span><strong>Compte actif</strong><small>{isActive ? "L’enfant peut utiliser son espace." : "Le profil affichera un écran de pause."}</small></span>
            <span className={`toggle ${isActive ? "is-on" : ""}`} aria-hidden="true"><span /></span>
          </button>
        )}

        {isEditing && canDelete && !isConfirmingDelete && (
          <button className="delete-child-trigger" type="button" onClick={() => { setIsConfirmingDelete(true); setError(""); }}><Trash size={17} weight="bold" /> Supprimer ce compte enfant</button>
        )}

        {isEditing && canDelete && isConfirmingDelete && (
          <section className="delete-child-confirmation" aria-labelledby="delete-child-title">
            <div><Trash size={20} weight="fill" /><span><strong id="delete-child-title">Supprimer définitivement {child.name} ?</strong><small>Son compte, ses contacts et toutes ses conversations seront supprimés. Cette action est irréversible.</small></span></div>
            <label htmlFor="delete-child-confirmation"><span>Tapez <strong>SUPPRIMER</strong> pour confirmer</span><input id="delete-child-confirmation" value={deleteConfirmation} onChange={(event) => { setDeleteConfirmation(event.target.value.toUpperCase()); setError(""); }} autoComplete="off" disabled={isDeleting} /></label>
            <div><button type="button" onClick={() => { setIsConfirmingDelete(false); setDeleteConfirmation(""); setError(""); }} disabled={isDeleting}>Garder le compte</button><button type="button" onClick={deleteChildAccount} disabled={deleteConfirmation !== "SUPPRIMER" || isDeleting}>{isDeleting ? "Suppression…" : "Supprimer définitivement"}</button></div>
          </section>
        )}

        {error && <p className="child-form-error" role="alert">{error}</p>}
        <div className="child-modal-actions">
          <button type="button" className="decline-button" onClick={onClose}>Annuler</button>
          <button type="submit" className="primary-button" disabled={isDeleting}><CheckCircle size={18} weight="fill" /> {isEditing ? "Enregistrer" : "Créer le compte"}</button>
        </div>
      </form>
    </div>
  );
}

function ContactIdsModal({ parent, family, children, onClose }) {
  const [copiedMemberId, setCopiedMemberId] = useState(null);
  const parents = family?.members?.length ? family.members : [{ id: parent.id ?? "parent", name: parent.name, contactId: parent.contactId, role: "primary" }];
  const members = [
    ...parents.map((member) => ({ ...member, roleLabel: member.role === "primary" ? "Parent principal" : "Co-parent", isParent: true })),
    ...children.map((child) => ({ ...child, roleLabel: `Compte enfant · ${child.age} ans` })),
  ];

  const copyMemberId = async (member) => {
    await copyContactId(member.contactId);
    setCopiedMemberId(member.id);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="contact-ids-modal" role="dialog" aria-modal="true" aria-labelledby="contact-ids-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="contact-ids-heading"><span><IdentificationCard size={28} weight="fill" /></span><div><small>{family?.name ?? `Famille de ${parent.name}`}</small><h2 id="contact-ids-title">Identifiants de contact</h2><p>Un numéro opaque et unique pour chaque membre.</p></div></div>
        <div className="contact-id-safety"><ShieldCheck size={18} weight="fill" /><span>Seul ce numéro exact cible un compte. Le pseudo n’est jamais utilisé pour démarrer une discussion.</span></div>
        <div className="contact-member-list">
          {members.map((member) => (
            <article className="contact-member-card" key={member.id}>
              {member.isParent ? <span className="contact-parent-avatar"><UserCircle size={29} weight="fill" /></span> : <Avatar person={member} size="child-tab" />}
              <div className="contact-member-copy"><strong>{member.name}</strong><small>{member.roleLabel}</small><span>ID {member.contactId}</span></div>
              <button type="button" className={copiedMemberId === member.id ? "is-copied" : ""} onClick={() => copyMemberId(member)} aria-label={`Copier l’identifiant de ${member.name}`}>{copiedMemberId === member.id ? <CheckCircle size={18} weight="fill" /> : <Copy size={18} weight="bold" />}<span>{copiedMemberId === member.id ? "Copié" : "Copier"}</span></button>
            </article>
          ))}
        </div>
        <button className="primary-button contact-ids-close" type="button" onClick={onClose}>Terminer</button>
      </section>
    </div>
  );
}

function ScheduleModal({ childName, schedule, onClose, onSave }) {
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    ...schedule,
    messages: { ...schedule.messages },
    calls: { ...schedule.calls },
    video: { ...schedule.video },
    autoReply: { ...defaultCommunicationSchedule.autoReply, ...schedule.autoReply },
  });
  const channels = [
    { key: "messages", title: "Messages", detail: "Envoi et notifications", Icon: ChatCircleDots },
    { key: "calls", title: "Appels audio", detail: "Appels entre amis approuvés", Icon: Phone },
    { key: "video", title: "Appels visio", detail: "Caméra avec contacts approuvés", Icon: VideoCamera },
  ];

  const updateChannel = (key, values) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...values } }));
  };

  const copyMessageHours = () => {
    setDraft((current) => ({
      ...current,
      calls: { ...current.calls, start: current.messages.start, end: current.messages.end },
      video: { ...current.video, start: current.messages.start, end: current.messages.end },
    }));
  };

  const saveSchedule = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const scheduleWithCurrentTimes = ["messages", "calls", "video"].reduce(
      (current, key) => ({
        ...current,
        [key]: {
          ...current[key],
          start: formData.get(`${key}-start`) || current[key].start,
          end: formData.get(`${key}-end`) || current[key].end,
        },
      }),
      draft,
    );
    try {
      await onSave(scheduleWithCurrentTimes);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="schedule-modal" onSubmit={saveSchedule} onMouseDown={(event) => event.stopPropagation()} aria-labelledby="schedule-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="schedule-modal__heading"><span><Clock size={27} weight="fill" /></span><div><small>Règles de {childName}</small><h2 id="schedule-title">Horaires autorisés</h2><p>Définissez quand les échanges sont disponibles.</p></div></div>

        <button className="schedule-master" type="button" role="switch" aria-checked={draft.enabled} onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}>
          <span><strong>Planification active</strong><small>Les règles s’appliquent tous les jours.</small></span>
          <span className={`toggle ${draft.enabled ? "is-on" : ""}`} aria-hidden="true"><span /></span>
        </button>

        <div className={`schedule-channels ${draft.enabled ? "" : "is-disabled"}`}>
          {channels.map(({ key, title, detail, Icon }) => (
            <section className="schedule-channel" key={key} aria-label={title}>
              <div className="schedule-channel__heading">
                <span className="schedule-channel__icon"><Icon size={19} weight="fill" /></span>
                <span className="schedule-channel__copy"><strong>{title}</strong><small>{detail}</small></span>
                <button type="button" className="schedule-channel__switch" role="switch" aria-checked={draft[key].enabled} aria-label={`${title} autorisés`} onClick={() => updateChannel(key, { enabled: !draft[key].enabled })} disabled={!draft.enabled}>
                  <span className={`toggle ${draft[key].enabled ? "is-on" : ""}`} aria-hidden="true"><span /></span>
                </button>
              </div>
              <div className="time-range">
                <label><span>À partir de</span><input type="time" name={`${key}-start`} aria-label={`Début ${title}`} value={draft[key].start} onChange={(event) => updateChannel(key, { start: event.target.value })} disabled={!draft.enabled || !draft[key].enabled} /></label>
                <span className="time-range__arrow">→</span>
                <label><span>Jusqu’à</span><input type="time" name={`${key}-end`} aria-label={`Fin ${title}`} value={draft[key].end} onChange={(event) => updateChannel(key, { end: event.target.value })} disabled={!draft.enabled || !draft[key].enabled} /></label>
              </div>
            </section>
          ))}
        </div>

        <section className={`auto-reply-setting ${draft.enabled ? "" : "is-disabled"}`} aria-label="Réponse automatique hors horaires">
          <div className="auto-reply-setting__heading">
            <span className="schedule-channel__icon"><ChatCircleDots size={19} weight="fill" /></span>
            <span className="schedule-channel__copy"><strong>Réponse automatique</strong><small>Messages et appels refusés pendant le mode calme</small></span>
            <button type="button" className="schedule-channel__switch" role="switch" aria-checked={draft.autoReply.enabled} aria-label="Réponse automatique activée" onClick={() => setDraft((current) => ({ ...current, autoReply: { ...current.autoReply, enabled: !current.autoReply.enabled } }))} disabled={!draft.enabled}>
              <span className={`toggle ${draft.autoReply.enabled ? "is-on" : ""}`} aria-hidden="true"><span /></span>
            </button>
          </div>
          <label className="auto-reply-message"><span>Message envoyé</span><textarea value={draft.autoReply.message} onChange={(event) => setDraft((current) => ({ ...current, autoReply: { ...current.autoReply, message: event.target.value.slice(0, 140) } }))} maxLength={140} rows={3} aria-label="Message automatique" disabled={!draft.enabled || !draft.autoReply.enabled} /><small>{draft.autoReply.message.length}/140</small></label>
          <div className="auto-reply-preview"><span>Automatique</span><p>{draft.autoReply.message || "Aucun message renseigné."}</p></div>
        </section>

        <button className="copy-hours-button" type="button" onClick={copyMessageHours} disabled={!draft.enabled}><Clock size={16} weight="bold" /> Utiliser l’horaire des messages pour tout</button>
        <div className="schedule-note"><ShieldCheck size={17} weight="fill" /><span>En dehors de ces horaires, les messages attendent et les appels audio ou visio sont refusés. Le contact reçoit cette réponse automatique.</span></div>
        {error && <p className="child-form-error" role="alert">{error}</p>}
        <div className="child-modal-actions"><button type="button" className="decline-button" onClick={onClose}>Annuler</button><button type="submit" className="primary-button"><CheckCircle size={18} weight="fill" /> Enregistrer</button></div>
      </form>
    </div>
  );
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

function QrModal({ child, onClose, onRequestAdd }) {
  const [idCopied, setIdCopied] = useState(false);
  const [mode, setMode] = useState("add");
  const [contactId, setContactId] = useState("");
  const [error, setError] = useState("");
  const contactUrl = `${window.location.origin}/?contact=${encodeURIComponent(child.contactId)}`;

  const copyId = async () => {
    await copyContactId(child.contactId);
    setIdCopied(true);
  };

  const continueWithParent = (event) => {
    event.preventDefault();
    const normalizedId = contactId.trim().toUpperCase();
    if (!/^SC-\d{3}-\d{3}-\d{3}$/.test(normalizedId)) {
      setError("Saisis un identifiant au format SC-123-456-789.");
      return;
    }
    if (normalizedId === child.contactId) {
      setError("Choisis l’identifiant d’un autre enfant.");
      return;
    }
    onRequestAdd(normalizedId);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="qr-modal-tabs" role="tablist" aria-label="Ajouter un ami">
          <button type="button" role="tab" aria-selected={mode === "add"} className={mode === "add" ? "is-active" : ""} onClick={() => setMode("add")}><UserPlus size={17} weight="bold" /> Ajouter</button>
          <button type="button" role="tab" aria-selected={mode === "share"} className={mode === "share" ? "is-active" : ""} onClick={() => setMode("share")}><QrCode size={17} weight="bold" /> Mon QR</button>
        </div>
        {mode === "add" ? <>
          <span className="add-friend-modal-icon"><UserPlus size={31} weight="fill" /></span>
          <h2 id="qr-title">Ajouter un ami</h2>
          <p>Saisis l’identifiant affiché sur son QR code. Ton parent terminera la demande.</p>
          <form className="child-add-friend-form" onSubmit={continueWithParent}>
            <label htmlFor="friend-contact-id">Identifiant de ton ami</label>
            <input id="friend-contact-id" value={contactId} onChange={(event) => { setContactId(event.target.value.toUpperCase().slice(0, 14)); setError(""); }} placeholder="SC-123-456-789" autoComplete="off" autoFocus />
            {error && <p className="child-add-friend-error" role="alert">{error}</p>}
            <div className="approval-steps"><span><ShieldCheck size={17} weight="fill" /> Aucun ami n’est ajouté sans l’accord du parent</span></div>
            <button className="primary-button" type="submit"><LockKey size={18} weight="fill" /> Continuer avec mon parent</button>
          </form>
        </> : <>
          <div className="real-contact-qr" aria-label={`QR code de contact de ${child.name}`}>
            <QRCodeSVG value={contactUrl} size={132} level="H" marginSize={2} bgColor="#ffffff" fgColor="#120966" title={`Ajouter ${child.name} avec l’identifiant ${child.contactId}`} />
          </div>
          <h2 id="qr-title">Identifiant de {child.name}</h2>
          <p>Présente ce QR code ou cet identifiant avec l’aide de ton parent.</p>
          <button type="button" className={`qr-contact-id ${idCopied ? "is-copied" : ""}`} onClick={copyId}><IdentificationCard size={18} weight="fill" /><span>{idCopied ? "Identifiant copié !" : child.contactId}</span>{idCopied ? <CheckCircle size={18} weight="fill" /> : <Copy size={17} weight="bold" />}</button>
          <div className="approval-steps">
            <span><CheckCircle size={17} weight="fill" /> L’identifiant cible un seul compte</span>
            <span><ShieldCheck size={17} weight="fill" /> Le parent approuve la demande</span>
          </div>
          <button className="primary-button" type="button" onClick={onClose}>J’ai compris</button>
        </>}
      </section>
    </div>
  );
}

export function App() {
  const dragScrollRef = useMouseDragScroll();
  const [session, setSession] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(() => Boolean(getToken()));
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
  const [isAvatarPreferencesOpen, setIsAvatarPreferencesOpen] = useState(false);
  const [parentThreads, setParentThreads] = useState([]);
  const [serverConversations, setServerConversations] = useState([]);
  const [selectedParentThreadId, setSelectedParentThreadId] = useState(null);
  const [presenceByContactId, setPresenceByContactId] = useState({});
  const [pendingContactId, setPendingContactId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("contact")?.trim().toUpperCase() ?? "";
    return /^SC-\d{3}-\d{3}-\d{3}$/.test(value) ? value : "";
  });
  const activeChild = children.find((child) => child.id === activeChildId) ?? children[0] ?? null;
  const activeSettings = activeChild ? settingsByChild[activeChild.id] ?? defaultSafetySettings : defaultSafetySettings;
  const activeSchedule = activeChild ? schedulesByChild[activeChild.id] ?? defaultCommunicationSchedule : defaultCommunicationSchedule;
  const parentUnreadMessages = parentThreads.reduce((total, thread) => total + thread.unread, 0);

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
    if (!getToken()) {
      setIsRestoringSession(false);
      return;
    }
    api.me()
      .then(({ account }) => {
        if (account.role === "child" && familyInviteToken) {
          clearToken();
          return undefined;
        }
        return account.role === "child" ? openChildSession(account) : openAuthenticatedSession(account);
      })
      .catch(() => clearToken())
      .finally(() => setIsRestoringSession(false));
  }, []);

  useEffect(() => {
    if (session?.role === "parent" && pendingContactId) {
      setSelectedParentThreadId(null);
      setParentView("messages");
    }
  }, [pendingContactId, session]);

  const requestFriendWithParent = (contactId) => {
    setPendingContactId(contactId);
    window.history.replaceState({}, "", `${window.location.pathname}?contact=${encodeURIComponent(contactId)}`);
    setIsQrOpen(false);
    setSelectedConversation(null);
    if (session?.role === "parent") {
      setSelectedParentThreadId(null);
      setParentView("messages");
      return;
    }
    clearToken();
    setSession(null);
    setParentView(null);
  };

  useEffect(() => {
    if (!session || !getToken()) return undefined;
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
  }, [session, parentThreads, serverConversations]);

  const applyFamilyChildren = (familyChildren) => {
    setChildren(familyChildren);
    setActiveChildId(familyChildren[0]?.id ?? null);
    setSettingsByChild(Object.fromEntries(familyChildren.map((child) => [child.id, cloneSafetySettings(child.settings)])));
    setSchedulesByChild(Object.fromEntries(familyChildren.map((child) => [child.id, cloneCommunicationSchedule(child.schedule)])));
    setParentThreads([]);
    setServerConversations([]);
    setPresenceByContactId({});
  };

  const applyServerConversations = (account, conversationsPayload) => {
    const mapped = conversationsPayload.map((conversation) => mapServerConversation(conversation, account));
    if (account.role === "parent") {
      setParentThreads(mapped);
    } else {
      setServerConversations(mapped);
      setSelectedConversation((current) => current ? mapped.find((conversation) => conversation.id === current.id) ?? current : null);
    }
    return mapped;
  };

  const openAuthenticatedSession = async (parent) => {
    const parentWithId = { ...parent, contactId: parent.contactId ?? "" };
    applyFamilyChildren([]);
    const [childrenData, conversationData, familyData] = await Promise.all([api.children(), api.conversations(), api.family()]);
    applyFamilyChildren(childrenData.children);
    applyServerConversations({ ...parentWithId, role: "parent" }, conversationData.conversations);
    setFamily(normalizeFamily(familyData, parentWithId));
    setFamilyOwner(parentWithId);
    setSession({ ...parentWithId, role: "parent" });
    setParentView("dashboard");
    setSelectedConversation(null);
  };

  const openChildSession = async (child) => {
    applyFamilyChildren([child]);
    const conversationData = await api.conversations();
    applyServerConversations({ ...child, role: "child" }, conversationData.conversations);
    setFamilyOwner({ name: "Compte parent", email: "", contactId: "" });
    setSession({ ...child, role: "child", childId: child.id });
    setActiveChildId(child.id);
    setParentView(null);
    setSelectedConversation(null);
    setActiveTab("conversations");
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
      clearToken();
      throw error;
    }
  };

  const registerParent = async (parent) => {
    const { account } = familyInviteToken
      ? await api.registerWithFamilyInvite({ token: familyInviteToken, name: parent.name, password: parent.password })
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

  const loginChild = async (contactId, password) => {
    try {
      const { account } = await api.login({ contactId, password });
      if (account.role !== "child") return false;
      await openChildSession(account);
      return true;
    } catch {
      return false;
    }
  };

  const logoutParent = () => {
    clearToken();
    setSession(null);
    setFamilyOwner({ name: "", email: "", contactId: "" });
    setFamily(null);
    setChildren([]);
    setActiveChildId(null);
    setSettingsByChild({});
    setSchedulesByChild({});
    setParentThreads([]);
    setServerConversations([]);
    setParentView(null);
    setChildModal(null);
    setScheduleModalChildId(null);
    setIsContactIdsOpen(false);
    setIsParentPasswordOpen(false);
    setIsFamilyParentsOpen(false);
    setIsAvatarPreferencesOpen(false);
    setSelectedParentThreadId(null);
    setSelectedConversation(null);
    setActiveTab("conversations");
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
    setChildren((current) => childData.id
      ? current.map((item) => item.id === savedChild.id ? savedChild : item)
      : [...current, savedChild]);
    setActiveChildId(savedChild.id);
    setSettingsByChild((current) => ({ ...current, [savedChild.id]: cloneSafetySettings(savedChild.settings) }));
    setSchedulesByChild((current) => ({ ...current, [savedChild.id]: cloneCommunicationSchedule(savedChild.schedule) }));
    setChildModal(null);
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
    applyServerConversations(session, conversationData.conversations);
    setSelectedParentThreadId(conversation.id);
    setParentView("messages");
    return conversation.id;
  };

  const openParentThread = (threadId) => {
    setSelectedParentThreadId(threadId);
    if (!threadId) return;
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, unread: 0 } : thread));
  };

  const sendParentMessage = async (threadId, text) => {
    const result = await api.sendMessage(threadId, text);
    const messageId = result.message.id;
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? {
      ...thread,
      preview: text,
      time: "À l’instant",
      messages: [...thread.messages, { id: messageId, direction: "sent", type: "text", text, time: "Maintenant", status: "received" }],
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
    const nextMessage = { id: message.id, direction: "sent", type: "text", text, time: formatServerMessageTime(message.created_at), status: "received" };
    setServerConversations((current) => current.map((conversation) => conversation.id === conversationId ? {
      ...conversation,
      preview: text,
      time: "À l’instant",
      messages: [...conversation.messages, nextMessage],
    } : conversation));
    setSelectedConversation((current) => current?.id === conversationId ? {
      ...current,
      preview: text,
      time: "À l’instant",
      messages: [...current.messages, nextMessage],
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
    if (!session || !getToken()) return undefined;
    const refreshConversations = async () => {
      try {
        const result = await api.conversations();
        applyServerConversations(session, result.conversations);
      } catch {
        // La prochaine synchronisation reprendra après une coupure réseau.
      }
    };
    const timer = window.setInterval(refreshConversations, 15000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.role]);

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
      setSelectedParentThreadId(null);
      setParentView("dashboard");
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
      return <ParentMessagesScreen parentName={familyOwner.name} familyChildren={children} threads={parentThreads} selectedThreadId={selectedParentThreadId} onSelectThread={openParentThread} onBack={() => { setSelectedParentThreadId(null); setParentView("dashboard"); }} onSend={sendParentMessage} onSendMedia={sendParentMedia} onOpenFamilyConversation={openFamilyConversation} initialContactId={pendingContactId} onContactHandled={() => setPendingContactId("")} />;
    }
    if (parentView === "games") {
      return <ParentGamesScreen parent={familyOwner} onBack={() => setParentView("dashboard")} />;
    }
    if (parentView === "dashboard") {
      return (
        <ParentDashboard
          parentName={familyOwner.name}
          family={family}
          children={children}
          child={activeChild}
          onSelectChild={setActiveChildId}
          onAddChild={() => setChildModal({ mode: "create" })}
          onEditChild={() => setChildModal({ mode: "edit", childId: activeChild.id })}
          onMessageChild={() => activeChild && void openFamilyConversation(activeChild.contactId)}
          settings={activeSettings}
          onToggleSetting={(key) => activeChild && void toggleChildSetting(activeChild.id, key)}
          schedule={activeSchedule}
          unreadMessages={parentUnreadMessages}
          onOpenMessages={() => { setSelectedParentThreadId(null); setParentView("messages"); }}
          onOpenGames={() => setParentView("games")}
          onOpenFamilyParents={() => setIsFamilyParentsOpen(true)}
          onOpenContactIds={() => setIsContactIdsOpen(true)}
          onOpenPassword={() => setIsParentPasswordOpen(true)}
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
      return <ChatScreen child={activeChild} conversation={selectedConversation} settings={activeSettings} schedule={activeSchedule} onBack={() => setSelectedConversation(null)} onSendMessage={sendChildMessage} onSendMedia={sendChildMedia} />;
    }
    if (activeTab === "clubhouse") {
      return <ClubhouseScreen child={activeChild} />;
    }
    if (isAvatarPreferencesOpen) return <AvatarPreferencesScreen child={activeChild} onBack={() => setIsAvatarPreferencesOpen(false)} onSave={saveAvatar} />;
    if (activeTab === "profile") return <ProfileScreen child={activeChild} onOpenPreferences={() => setIsAvatarPreferencesOpen(true)} onLogout={logoutParent} />;
    const availableConversations = serverConversations.map((conversation) => ({ ...conversation, online: presenceByContactId[conversation.contactId] ?? false }));
    const approvedFriends = availableConversations.filter((conversation) => !conversation.isFamily && conversation.contactRole !== "parent");
    return <HomeScreen child={activeChild} approvedFriends={approvedFriends} availableConversations={availableConversations} onQr={() => setIsQrOpen(true)} onOpenConversation={setSelectedConversation} />;
  }, [activeChild, activeSchedule, activeSettings, activeTab, children, family, familyInvitation, familyInvitationError, familyInviteToken, familyOwner, isAvatarPreferencesOpen, isFamilyInvitationLoading, isRestoringSession, parentThreads, parentUnreadMessages, parentView, presenceByContactId, selectedConversation, selectedParentThreadId, serverConversations, session]);

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
        <div className={`screen-scroll ${activeTab === "profile" && session && !parentView ? "screen-scroll--profile" : ""} ${!session || selectedConversation || parentView || isAvatarPreferencesOpen || activeChild?.status === "paused" || !activeChild ? "screen-scroll--full" : ""}`}>{screen}</div>
        {session && !selectedConversation && !parentView && !isAvatarPreferencesOpen && activeChild?.status === "active" && <BottomNavigation active={activeTab} onChange={changeTab} />}
        {isQrOpen && activeChild && <QrModal child={activeChild} onClose={() => setIsQrOpen(false)} onRequestAdd={requestFriendWithParent} />}
        {session && isContactIdsOpen && <ContactIdsModal parent={familyOwner} family={family} children={children} onClose={() => setIsContactIdsOpen(false)} />}
        {session?.role === "parent" && isParentPasswordOpen && <ParentPasswordModal onClose={() => setIsParentPasswordOpen(false)} onSave={changeParentPassword} />}
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
      </div>
    </main>
  );
}
