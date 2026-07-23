import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Basketball,
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
  Lightbulb,
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
import { createDemoAudioStream, createDemoVideoStream, createLocalWebRtcSession, getChannelPolicy, openCameraStream, openMicrophoneStream, stopMediaStream } from "./webrtc";
import { api, clearToken, getToken } from "./api";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import PhaserMemoryGame from "./PhaserMemoryGame";
import ConnectFourGame from "./ConnectFourGame";

const friends = [
  { id: "leo", name: "Léo", contactId: "SC-214-680-531", image: "/avatars/leo.png" },
  { id: "ines", name: "Inès", contactId: "SC-317-492-604", image: "/avatars/ines.png" },
  { id: "noah", name: "Noah", contactId: "SC-421-835-726", image: "/avatars/noah.png" },
  { id: "maya", name: "Maya", contactId: "SC-536-147-892", image: "/avatars/maya.png" },
  { id: "tom", name: "Tom", contactId: "SC-648-259-413", image: "/avatars/tom.png" },
];

const pendingFriend = { id: "chloe", name: "Chloé", contactId: "SC-759-361-248", image: null };
const demoChildContactId = "SC-482-917-305";
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

const initialChildren = [
  {
    id: "emma",
    name: "Emma",
    age: 9,
    username: "emma.club",
    password: "Emma2026!",
    contactId: demoChildContactId,
    image: "/avatars/emma.png",
    color: "violet",
    status: "active",
  },
];

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

const initialParentThreads = [
  {
    id: "thomas",
    name: "Thomas R.",
    relation: "Parent de Chloé",
    initials: "TR",
    preview: "Merci, je vous envoie son invitation.",
    time: "09:32",
    unread: 2,
    messages: [
      { id: "thomas-1", direction: "received", text: "Bonjour Marie, Chloé aimerait ajouter Emma.", time: "09:28" },
      { id: "thomas-2", direction: "sent", text: "Bonjour Thomas, je vais vérifier avec Emma.", time: "09:30" },
      { id: "thomas-3", direction: "received", text: "Merci, je vous envoie son invitation.", time: "09:32" },
    ],
  },
  {
    id: "sophie",
    name: "Sophie M.",
    relation: "Parent de Léo",
    initials: "SM",
    preview: "Parfait pour samedi à 15 h !",
    time: "Hier",
    unread: 0,
    messages: [
      { id: "sophie-1", direction: "received", text: "Bonjour, Léo est disponible samedi après-midi.", time: "Hier" },
      { id: "sophie-2", direction: "sent", text: "Parfait pour samedi à 15 h !", time: "Hier" },
    ],
  },
];

const cloneParentThreads = () => initialParentThreads.map((thread) => ({
  ...thread,
  messages: thread.messages.map((message) => ({ ...message })),
}));

const formatServerMessageTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Maintenant";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
};

const mapServerConversation = (conversation, account) => {
  const messages = (Array.isArray(conversation.messages) ? conversation.messages : [])
    .filter((message) => message.text)
    .map((message) => ({
      id: message.id,
      direction: message.senderId === account.id ? "sent" : "received",
      text: message.text,
      time: formatServerMessageTime(message.createdAt),
      status: "received",
    }));
  const latest = messages[messages.length - 1];
  const initials = String(conversation.name ?? "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const isFamily = conversation.kind === "child" && (
    (account.role === "parent" && conversation.contact_role === "child")
    || (account.role === "child" && conversation.contact_role === "parent")
  );
  return {
    id: conversation.id,
    name: conversation.name,
    contactId: conversation.contact_id,
    contactRole: conversation.contact_role,
    isFamily,
    serverBacked: true,
    relation: isFamily ? (account.role === "parent" ? "Mon enfant" : "Mon parent") : "Parent d’un contact",
    initials,
    preview: latest?.text ?? (isFamily ? "Commencez votre conversation familiale." : "Nouvelle conversation"),
    time: latest?.time ?? "Maintenant",
    unread: 0,
    messages,
    ActivityIcon: ChatCircleDots,
    received: messages.filter((message) => message.direction === "received").map((message) => message.text),
    sent: messages.filter((message) => message.direction === "sent").at(-1)?.text ?? "",
  };
};

function createUniqueContactId(existingIds = []) {
  let contactId;
  do {
    const digits = String(Math.floor(100000000 + Math.random() * 900000000));
    contactId = `SC-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  } while (existingIds.includes(contactId));
  return contactId;
}

async function copyContactId(contactId) {
  try {
    await navigator.clipboard.writeText(contactId);
  } catch {
    // Le statut visuel reste utile dans ce prototype, même sans permission presse-papiers.
  }
}

const conversations = [
  {
    ...friends[0],
    preview: "Tu veux jouer ce soir ?",
    time: "09:41",
    ActivityIcon: GameController,
    received: ["Coucou Emma !", "Tu veux jouer ce soir ?"],
    sent: "Oui, après mes devoirs !",
  },
  {
    ...friends[1],
    preview: "Regarde ce dessin que j’ai fait !",
    time: "Hier",
    ActivityIcon: PencilSimple,
    received: ["J’ai fini mon dessin !", "Je te le montre demain."],
    sent: "Il va être trop beau !",
  },
  {
    ...friends[2],
    preview: "Merci pour ton aide !",
    time: "Hier",
    ActivityIcon: Sparkle,
    received: ["Merci pour ton aide !"],
    sent: "Avec plaisir Noah !",
  },
  {
    ...friends[3],
    preview: "On se voit à l’entraînement !",
    time: "Mardi",
    ActivityIcon: Basketball,
    received: ["On se voit à l’entraînement !"],
    sent: "Oui, à 17 h !",
  },
  {
    ...friends[4],
    preview: "J’ai trouvé une idée trop cool",
    time: "Lundi",
    ActivityIcon: Lightbulb,
    received: ["J’ai trouvé une idée trop cool."],
    sent: "Raconte-moi !",
  },
];

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

function AuthScreen({ onLogin, onRegister, onDemo, onChildLogin, onChildDemo, hasFamilyInvite = false, familyInvitation, familyInvitationError, isFamilyInvitationLoading = false, onDismissFamilyInvite }) {
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
            {audience === "parent" ? <label className="auth-field"><span>Adresse e-mail</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" placeholder="parent@exemple.fr" readOnly={Boolean(familyInvitation?.email)} /></label> : <label className="auth-field"><span>Ton identifiant unique</span><input value={childContactId} onChange={(event) => { setChildContactId(event.target.value.toUpperCase().slice(0, 14)); setError(""); }} autoComplete="username" autoCapitalize="characters" spellCheck="false" placeholder="SC-482-917-305" /></label>}
            <label className="auth-field"><span>Mot de passe</span><span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="6 caractères minimum" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>{showPassword ? <EyeSlash size={21} weight="bold" /> : <Eye size={21} weight="bold" />}</button></span></label>
            {audience === "parent" && mode === "register" && (
              <label className="auth-consent"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setError(""); }} /><span>Je confirme être le parent ou le responsable légal des enfants que j’ajouterai.</span></label>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={isFamilyInvitationLoading || Boolean(familyInvitationError)}>{audience === "child" || mode === "login" ? <LockKeyOpen size={19} weight="fill" /> : <UserPlus size={19} weight="fill" />}{audience === "child" ? "Entrer dans mon espace" : hasFamilyInvite ? mode === "login" ? "Se connecter et accepter" : "Créer et rejoindre la famille" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
          </form>

          {!hasFamilyInvite && <><div className="auth-separator"><span>ou</span></div>
          <button className="demo-account-button" type="button" onClick={audience === "child" ? onChildDemo : onDemo}><Sparkle size={20} weight="fill" /><span><strong>{audience === "child" ? "Tester comme Emma" : "Tester avec un faux compte"}</strong><small>{audience === "child" ? "ID SC-482-917-305 · compte enfant démo" : "Aucune donnée réelle nécessaire"}</small></span><CaretRight size={18} weight="bold" /></button></>}
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
    const matchingConversation = conversations.find((item) => item.id === friend.id);
    onOpenConversation(matchingConversation ?? {
      ...friend,
      preview: "Vous êtes maintenant amies !",
      time: "Maintenant",
      ActivityIcon: Sparkle,
      received: [`Coucou ${child.name} ! On peut enfin discuter ici.`],
      sent: "Bienvenue dans mon Clubhouse !",
    });
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

const sendWorkerCommand = (worker, message, timeout = 1000) => new Promise((resolve) => {
  if (!worker) {
    resolve(null);
    return;
  }
  const channel = new MessageChannel();
  let settled = false;
  const finish = (value) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    channel.port1.close();
    resolve(value);
  };
  const timer = window.setTimeout(() => finish(null), timeout);
  channel.port1.onmessage = (event) => finish(event.data);
  try {
    worker.postMessage(message, [channel.port2]);
  } catch {
    finish(null);
  }
});

const waitForCurrentPushWorker = async (registration) => {
  await registration.update().catch(() => {});
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    registration = await navigator.serviceWorker.getRegistration("/") ?? registration;
    if (registration.waiting) {
      try {
        registration.waiting.postMessage({ type: "secret-clubhouse:activate-update" });
      } catch {}
    }
    const workers = [...new Set([registration.active, navigator.serviceWorker.controller].filter(Boolean))];
    for (const worker of workers) {
      const response = await sendWorkerCommand(worker, { type: "secret-clubhouse:get-worker-capabilities" }, 500);
      if (response?.protocolVersion >= 1 && response.capabilities?.includes("push-diagnostics")) return worker;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return registration.active ?? navigator.serviceWorker.controller ?? null;
};

function PushNotificationButton({ isDemo = false }) {
  const native = Capacitor.isNativePlatform();
  const isWindowsWeb = !native && /Windows/i.test(navigator.userAgent);
  const supported = native || ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  const [status, setStatus] = useState(supported ? "checking" : "unsupported");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isTesting, setIsTesting] = useState(false);

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
        if (subscription && !isDemo) await api.subscribePush(subscription.toJSON());
        const demoEnabled = isDemo && sessionStorage.getItem("secret-clubhouse-demo-push") === "enabled";
        setStatus(subscription || demoEnabled ? "enabled" : Notification.permission === "denied" ? "denied" : "disabled");
      })
      .catch(() => setStatus("unsupported"));
  }, [isDemo, native, supported]);

  const togglePush = async () => {
    setError("");
    setFeedback("");
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
      if (current || (isDemo && status === "enabled")) {
        if (current && !isDemo) await api.unsubscribePush(current.endpoint);
        if (current) await current.unsubscribe();
        sessionStorage.removeItem("secret-clubhouse-demo-push");
        setStatus("disabled");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }
      if (isDemo) {
        sessionStorage.setItem("secret-clubhouse-demo-push", "enabled");
        setStatus("enabled");
        setFeedback("Mode démo : les alertes sont testées uniquement sur cet appareil.");
        return;
      }
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

  const testNotification = async () => {
    setError("");
    setFeedback("");
    setIsTesting(true);
    try {
      if (Notification.permission !== "granted") {
        setStatus(Notification.permission === "denied" ? "denied" : "disabled");
        throw new Error("Les notifications ne sont pas autorisées dans ce navigateur.");
      }
      const registration = await navigator.serviceWorker.ready;
      if (!isDemo) await waitForCurrentPushWorker(registration);
      if (isDemo) {
        const tag = "secret-clubhouse-demo-test";
        const previousNotifications = await registration.getNotifications({ tag });
        previousNotifications.forEach((notification) => notification.close());
        await registration.showNotification("Secret Clubhouse est prêt", {
          body: "Voici votre notification de test Secret Clubhouse.",
          tag,
          renotify: true,
          requireInteraction: true,
          silent: false,
          data: { notificationType: "test", url: "/?notification=test" },
        });
        const registeredNotifications = await registration.getNotifications({ tag });
        if (!registeredNotifications.length) throw new Error("Microsoft Edge n’a pas enregistré la notification persistante.");
      } else {
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          setStatus("disabled");
          throw new Error("Cet Edge n’est plus abonné. Réactivez les notifications puis recommencez.");
        }
        const waitForPushDiagnostic = ({ requestId, acceptParseError = false }) => {
          let cancel = () => {};
          let startTimeout = () => {};
          const promise = new Promise((resolve) => {
            let settled = false;
            let timer = null;
            const finish = (value) => {
              if (settled) return;
              settled = true;
              cancel();
              resolve(value);
            };
            const onMessage = (event) => {
              const message = event.data;
              if (message?.type !== "secret-clubhouse:push-diagnostic" || message.stage === "received") return;
              const matchesRequest = message.requestId === requestId;
              const matchesUncorrelatedParseError = acceptParseError && message.stage === "parse-error" && message.requestId === null && message.hasPayload === true;
              if (!matchesRequest && !matchesUncorrelatedParseError) return;
              finish(message);
            };
            cancel = () => {
              if (timer) window.clearTimeout(timer);
              navigator.serviceWorker.removeEventListener("message", onMessage);
            };
            startTimeout = () => {
              if (!settled && !timer) timer = window.setTimeout(() => finish(null), 15000);
            };
            navigator.serviceWorker.addEventListener("message", onMessage);
          });
          return { promise, cancel, startTimeout };
        };
        const describeDiagnosticError = (diagnostic) => diagnostic?.stage === "parse-error"
          ? "Edge a reçu le test, mais n’a pas pu lire son contenu chiffré."
          : `Edge a reçu le test, mais Windows n’a pas pu créer la notification${diagnostic?.errorMessage ? ` : ${diagnostic.errorMessage}` : "."}`;

        const requestId = crypto.randomUUID();
        const encryptedWaiter = waitForPushDiagnostic({ requestId, acceptParseError: true });
        let encryptedResult;
        try {
          encryptedResult = await api.testPush(subscription.endpoint, requestId, "encrypted");
          if (!encryptedResult?.accepted) throw new Error("Le service de notification n’a pas accepté le test pour cet Edge.");
          encryptedWaiter.startTimeout();
          const encryptedDiagnostic = await encryptedWaiter.promise;
          if (encryptedDiagnostic?.stage === "shown") {
            setFeedback(`Notification créée par Edge (service worker ${encryptedDiagnostic.workerVersion}). Vérifiez la bannière ou le centre de notifications.`);
            return;
          }
          if (encryptedDiagnostic) throw new Error(describeDiagnosticError(encryptedDiagnostic));
        } finally {
          encryptedWaiter.cancel();
        }

        const transport = encryptedResult?.transportStatus ? ` (HTTP ${encryptedResult.transportStatus})` : "";
        const provider = encryptedResult?.providerStatus ? `, statut WNS ${encryptedResult.providerStatus}` : "";
        throw new Error(`WNS a accepté le test${transport}${provider}, mais le client Windows d’Edge ne l’a pas transmis à l’application.`);
      }
      setFeedback(isDemo
        ? "Notification persistante créée dans Edge. Vérifiez la bannière ou le centre de notifications."
        : "Test Web Push remis à cet Edge. Vérifiez la bannière ou le centre de notifications.");
    } catch (pushError) {
      setError(pushError.message || "La notification de test n’a pas pu être envoyée.");
    } finally {
      setIsTesting(false);
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
      {isWindowsWeb && status === "enabled" && <div className="push-setting__test-row"><button type="button" onClick={testNotification} disabled={isTesting}><Bell size={15} weight="fill" />{isTesting ? "Envoi…" : "Tester dans Windows"}</button></div>}
      {error && <small className="push-setting__error" role="alert">{error}</small>}
      {feedback && <small className="push-setting__feedback" role="status">{feedback}</small>}
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

  const sendRecording = () => {
    if (!preview) return;
    onSend(preview.blob, preview.duration);
    clearPreview();
    setElapsed(0);
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
          <button type="button" className="voice-recorder-send" onClick={sendRecording} aria-label="Envoyer le message vocal"><PaperPlaneTilt size={18} weight="fill" /></button>
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
  const demoCleanupsRef = useRef([]);
  const [phase, setPhase] = useState("ready");
  const [mode, setMode] = useState(null);
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
    demoCleanupsRef.current.forEach((cleanup) => cleanup());
    demoCleanupsRef.current = [];
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

  const startCall = async (selectedMode) => {
    if (!policy.allowed || phase === "connecting") return;
    cleanUpCall();
    setMode(selectedMode);
    setError("");
    setDuration(0);
    setIsMuted(false);
    setIsSpeakerOff(false);
    setConnectionState("connecting");
    setPhase("connecting");

    try {
      const localSource = selectedMode === "microphone" ? { stream: await openMicrophoneStream(), stop: null } : await createDemoAudioStream();
      const remoteSource = await createDemoAudioStream();
      localStreamRef.current = localSource.stream;
      remoteSourceRef.current = remoteSource.stream;
      if (localSource.stop) demoCleanupsRef.current.push(localSource.stop);
      demoCleanupsRef.current.push(remoteSource.stop);

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
        ? "Le micro n’a pas été autorisé. Tu peux réessayer ou ouvrir la démo sans micro."
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
            <button type="button" className="audio-start-button" onClick={() => startCall("microphone")} disabled={!policy.allowed}>
              <Microphone size={21} weight="fill" /> Démarrer avec mon micro
            </button>
            <button type="button" className="audio-demo-button" onClick={() => startCall("demo")} disabled={!policy.allowed}>
              <Waveform size={20} weight="bold" /> Tester la démo WebRTC
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
        <p>{mode === "demo" ? "Démo locale WebRTC" : `En appel avec ${child.name}`}</p>
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
  const demoCleanupsRef = useRef([]);
  const [phase, setPhase] = useState("ready");
  const [mode, setMode] = useState(null);
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
    demoCleanupsRef.current.forEach((cleanup) => cleanup());
    demoCleanupsRef.current = [];
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

  const startCall = async (selectedMode) => {
    if (!policy.allowed || phase === "connecting") return;
    cleanUpCall();
    setMode(selectedMode);
    setError("");
    setDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setConnectionState("connecting");
    setPhase("connecting");

    try {
      let localStream;
      if (selectedMode === "camera") {
        localStream = await openCameraStream();
      } else {
        const localDemo = createDemoVideoStream(child.name, ["#111359", "#7062e8"]);
        localStream = localDemo.stream;
        demoCleanupsRef.current.push(localDemo.stop);
      }

      const remoteDemo = createDemoVideoStream(conversation.name, ["#644bd7", "#62e7c4"]);
      demoCleanupsRef.current.push(remoteDemo.stop);
      localStreamRef.current = localStream;
      remoteSourceRef.current = remoteDemo.stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      rtcSessionRef.current = await createLocalWebRtcSession({
        localStream,
        remoteSourceStream: remoteDemo.stream,
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
        ? "La caméra ou le micro n’a pas été autorisé. Tu peux réessayer ou ouvrir la démo sans caméra."
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
            <button type="button" className="video-start-button" onClick={() => startCall("camera")} disabled={!policy.allowed}>
              <VideoCamera size={21} weight="fill" /> Démarrer avec ma caméra
            </button>
            <button type="button" className="video-demo-button" onClick={() => startCall("demo")} disabled={!policy.allowed}>
              <WaveSine size={20} weight="bold" /> Tester la démo WebRTC
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
        <span>{mode === "demo" ? "Démo locale WebRTC" : "Contact approuvé"}</span>
      </div>
      <div className={`local-video-wrap ${isCameraOff ? "is-off" : ""} ${mode === "demo" ? "is-demo" : ""}`}>
        <video ref={localVideoRef} className="local-video" autoPlay playsInline muted aria-label={`Aperçu caméra de ${child.name}`} />
        {isCameraOff && <span><VideoCameraSlash size={21} weight="fill" /> Caméra coupée</span>}
        <small>Toi</small>
      </div>
      <div className="video-call-controls" aria-label="Contrôles de l’appel">
        <button type="button" onClick={toggleMicrophone} className={isMuted ? "is-off" : ""} disabled={!hasMicrophone} aria-label={hasMicrophone ? (isMuted ? "Réactiver le micro" : "Couper le micro") : "Micro indisponible dans la démo"} aria-pressed={isMuted}>
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

function ChatScreen({ child, conversation, settings, schedule, onBack, onSendMessage }) {
  const [draft, setDraft] = useState("");
  const [sentMessages, setSentMessages] = useState([]);
  const [mediaError, setMediaError] = useState("");
  const [messageError, setMessageError] = useState("");
  const mediaInputRef = useRef(null);
  const mediaUrlsRef = useRef([]);
  const [isAudioCallOpen, setIsAudioCallOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const audioPolicy = getChannelPolicy(schedule, "calls");
  const videoPolicy = getChannelPolicy(schedule, "video");
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

  const sendMedia = (event) => {
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
    const mediaMessages = supportedFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      mediaUrlsRef.current.push(url);
      return { id: `media-${Date.now()}-${index}`, type: file.type.startsWith("video/") ? "video" : "image", url, name: file.name, status: "received" };
    });
    setMediaError("");
    setSentMessages((current) => [...current, ...mediaMessages]);
  };

  const sendVoiceMessage = (blob, duration) => {
    if (!messagePolicy.allowed) return;
    const url = URL.createObjectURL(blob);
    mediaUrlsRef.current.push(url);
    setSentMessages((current) => [...current, { id: `voice-${Date.now()}`, type: "audio", url, duration, status: "received" }]);
  };

  if (isVideoCallOpen) {
    return <VideoCallScreen child={child} conversation={conversation} policy={videoPolicy} autoReply={autoReply} onClose={() => setIsVideoCallOpen(false)} />;
  }

  if (isAudioCallOpen) {
    return <AudioCallScreen child={child} conversation={conversation} policy={audioPolicy} autoReply={autoReply} onClose={() => setIsAudioCallOpen(false)} />;
  }

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
        <button className={`icon-button audio-call-button ${audioPolicy.allowed ? "" : "is-restricted"}`} type="button" onClick={() => setIsAudioCallOpen(true)} aria-label={`Appeler ${conversation.name}`} title={audioPolicy.allowed ? "Appel audio" : audioPolicy.reason}>
          <Phone size={21} weight="bold" />
        </button>
        <button className={`icon-button video-call-button ${videoPolicy.allowed ? "" : "is-restricted"}`} type="button" onClick={() => setIsVideoCallOpen(true)} aria-label={`Lancer une visio avec ${conversation.name}`} title={videoPolicy.allowed ? "Appel visio" : videoPolicy.reason}>
          <VideoCamera size={22} weight="fill" />
        </button>
        <button className="icon-button" type="button" aria-label="Plus d’options">
          <DotsThree size={23} weight="bold" />
        </button>
      </header>

      <div className="chat-body" aria-live="polite">
        <div className="chat-day">Aujourd’hui</div>
        {!messagePolicy.allowed && (
          <div className="chat-quiet-banner" role="status"><Clock size={18} weight="fill" /><span><strong>Mode calme actif</strong><small>{autoReplyIsActive ? `${conversation.name} reçoit automatiquement un message.` : `Les messages seront disponibles à ${nextMessageTime}.`}</small></span></div>
        )}
        {conversation.serverBacked ? conversation.messages.map((message) => (
          <p className={`bubble bubble--${message.direction}`} key={message.id}>{message.text}{message.direction === "sent" && <MessageStatus status={message.status ?? "received"} />}</p>
        )) : <>
          {conversation.received.map((message) => <p className="bubble bubble--received" key={message}>{message}</p>)}
          {conversation.sent && <p className="bubble bubble--sent">{conversation.sent}<MessageStatus status="seen" /></p>}
        </>}
        {sentMessages.map((message) => {
          if (message.type === "text") return <p className="bubble bubble--sent" key={message.id}>{message.text}<MessageStatus status={message.status} /></p>;
          if (message.type === "audio") return <VoiceMessage key={message.id} url={message.url} duration={message.duration} status={message.status} />;
          return (
            <figure className="media-message" key={message.id}>
              {message.type === "video"
                ? <video src={message.url} controls playsInline aria-label={`Vidéo envoyée : ${message.name}`} />
                : <img src={message.url} alt={`Image envoyée : ${message.name}`} />}
              <figcaption><span>{message.type === "video" ? "Vidéo" : "Photo"} envoyée</span><MessageStatus status={message.status} /></figcaption>
            </figure>
          );
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

function ClubhouseScreen({ child, contacts, isDemo }) {
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
                  <ConnectFourGame child={child} contacts={contacts} isDemo={isDemo} onComplete={completeActivity} />
                )}
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function ProfileScreen({ child, isDemo, onOpenParent, onOpenPreferences, onLogout }) {
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
      <PushNotificationButton isDemo={isDemo} />
      <button type="button" className="parent-access-button" onClick={onOpenParent}>
        <LockKey size={20} weight="fill" />
        <span><strong>Espace parent</strong><small>Contacts et sécurité</small></span>
        <CaretRight size={19} weight="bold" />
      </button>
      <button type="button" className="secondary-button" onClick={onOpenPreferences}><GearSix size={19} weight="bold" /> Mes préférences</button>
      <button type="button" className="child-logout-button" onClick={onLogout}><SignOut size={18} weight="bold" /> Se déconnecter</button>
    </section>
  );
}

function ParentAccessScreen({ parentName, onBack, onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const updatePin = (value) => {
    setPin(value.replace(/\D/g, "").slice(0, 4));
    setError("");
  };

  const submitPin = (event) => {
    event.preventDefault();
    if (pin === "2468") {
      onUnlock();
      return;
    }
    setError("Ce code n’est pas correct. Réessaie.");
    setPin("");
  };

  return (
    <section className="parent-gate" aria-labelledby="parent-gate-title">
      <header className="parent-gate__header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retour à l’espace enfant">
          <ArrowLeft size={23} weight="bold" />
        </button>
        <Brand />
      </header>
      <form className="parent-gate__card" onSubmit={submitPin}>
        <span className="parent-lock" aria-hidden="true"><LockKey size={38} weight="fill" /></span>
        <span className="parent-kicker">Accès réservé aux adultes</span>
        <h1 id="parent-gate-title">Bonjour, {parentName}</h1>
        <p>Saisissez votre code parent pour gérer les profils de votre famille.</p>
        <label className="pin-label" htmlFor="parent-pin">Code parent à 4 chiffres</label>
        <input
          id="parent-pin"
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={4}
          value={pin}
          onChange={(event) => updatePin(event.target.value)}
          aria-describedby={error ? "pin-error" : "pin-demo"}
          aria-invalid={Boolean(error)}
          autoFocus
        />
        {error ? <p className="pin-error" id="pin-error" role="alert">{error}</p> : <p className="pin-demo" id="pin-demo">Pour tester le prototype : <strong>2468</strong></p>}
        <button className="primary-button parent-unlock" type="submit" disabled={pin.length !== 4}>
          <LockKeyOpen size={20} weight="fill" /> Ouvrir l’espace parent
        </button>
        <button className="parent-help" type="button" onClick={() => setShowHelp((current) => !current)}>Code oublié ?</button>
        {showHelp && <p className="parent-help-message" role="status">Dans la version finale, la récupération passera par l’adresse e-mail vérifiée du parent.</p>}
      </form>
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

function ParentPasswordModal({ isDemo, onClose, onSave }) {
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
            <label><span>Mot de passe actuel</span><span className="parent-password-field"><input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }} autoComplete="current-password" placeholder={isDemo ? "Pour la démo : demo2026" : "Votre mot de passe actuel"} autoFocus /><button type="button" onClick={() => setShowCurrentPassword((current) => !current)} aria-label={showCurrentPassword ? "Masquer le mot de passe actuel" : "Afficher le mot de passe actuel"}>{showCurrentPassword ? <EyeSlash size={19} weight="bold" /> : <Eye size={19} weight="bold" />}</button></span>{isDemo && <small>Faux compte : utilisez <strong>demo2026</strong>.</small>}</label>
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

function FamilyParentsModal({ family, currentParent, isDemo, onClose, onInvite, onRevoke, onRemove }) {
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
        {isDemo && <p className="family-demo-note"><Sparkle size={16} weight="fill" /> Les changements restent dans ce faux compte de démonstration.</p>}
        <button type="button" className="primary-button family-parents-close" onClick={onClose} disabled={Boolean(busyAction)}>Terminer</button>
      </section>
    </div>
  );
}

function PausedChildScreen({ child, onOpenParent }) {
  return (
    <section className="feature-screen paused-child-screen" aria-labelledby="paused-child-title">
      <span className="paused-lock"><LockKey size={38} weight="fill" /></span>
      <span className="eyebrow">Compte en pause</span>
      <h1 id="paused-child-title">À bientôt, {child.name}</h1>
      <p>Un parent a temporairement mis ce profil en pause.</p>
      <button className="primary-button" type="button" onClick={onOpenParent}><ShieldCheck size={19} weight="fill" /> Accès parent</button>
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

function ParentGamesScreen({ parent, children, isDemo, onBack }) {
  const demoContacts = children.map((child) => ({ id: child.id, name: child.name, contactId: child.contactId, role: "child" }));
  return (
    <section className="parent-games-screen" aria-labelledby="parent-games-title">
      <header className="parent-messages-header">
        <button type="button" className="parent-back-button" onClick={onBack} aria-label="Retour au tableau de bord parent"><ArrowLeft size={22} weight="bold" /></button>
        <div><span>Mode parent</span><h1 id="parent-games-title">Jeux en famille</h1></div>
        <span className="parent-games-screen__icon"><GameController size={25} weight="fill" /></span>
      </header>
      <div className="parent-games-screen__content">
        <div className="parent-games-intro"><ShieldCheck size={20} weight="fill" /><span><strong>Un espace de jeu privé</strong><small>Jouez avec vos enfants, vos co-parents et vos contacts approuvés.</small></span></div>
        <ConnectFourGame child={parent} contacts={demoContacts} isDemo={isDemo} />
      </div>
    </section>
  );
}

function ParentDashboard({ parentName, family, children, child, isDemo, requestStatus, onSelectChild, onAddChild, onEditChild, onMessageChild, onApproveRequest, onDeclineRequest, settings, onToggleSetting, schedule, unreadMessages, onOpenMessages, onOpenGames, onOpenFamilyParents, onOpenContactIds, onOpenPassword, onEditSchedule, onExit, onLogout }) {
  const baseFriendsCount = isDemo ? friends.length : 0;
  const approvedCount = requestStatus === "approved" ? baseFriendsCount + 1 : baseFriendsCount;
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
          <span><strong>Famille et parents</strong><small>Échangez avec vos enfants et les parents de leurs contacts.</small></span>
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
          <div><UsersThree size={22} weight="fill" /><strong>{approvedCount}</strong><span>amis</span></div>
          <div className={requestStatus === "pending" ? "has-alert" : ""}><UserPlus size={22} weight="fill" /><strong>{requestStatus === "pending" ? 1 : 0}</strong><span>demande</span></div>
          <div><Shield size={22} weight="fill" /><strong>3</strong><span>protections</span></div>
        </div>

        <section className="parent-section" aria-labelledby="requests-title">
          <div className="parent-section__title">
            <div><span className="section-icon section-icon--mint"><UserPlus size={19} weight="fill" /></span><div><h2 id="requests-title">Demandes d’amis</h2><p>Vous décidez qui peut parler à {child.name}.</p></div></div>
            {requestStatus === "pending" && <span className="status-pill">1 nouvelle</span>}
          </div>

          {requestStatus === "pending" && (
            <article className="friend-request">
              <span className="request-avatar" aria-hidden="true">C</span>
              <div className="request-copy"><strong>Chloé</strong><span>ID {pendingFriend.contactId}</span><small>Invitation QR · Parent : Thomas R.</small></div>
              <div className="request-actions">
                <button type="button" className="approve-button" onClick={onApproveRequest}><CheckCircle size={18} weight="fill" /> Accepter</button>
                <button type="button" className="decline-button" onClick={onDeclineRequest}><X size={17} weight="bold" aria-hidden="true" /> Refuser</button>
              </div>
            </article>
          )}

          {(requestStatus === "approved" || requestStatus === "declined") && (
            <div className={`request-result request-result--${requestStatus}`} role="status">
              {requestStatus === "approved" ? <CheckCircle size={22} weight="fill" /> : <X size={20} weight="bold" />}
              <div><strong>{requestStatus === "approved" ? "Chloé est maintenant approuvée" : "Demande refusée"}</strong><span>{requestStatus === "approved" ? `${child.name} peut désormais discuter avec elle.` : "Chloé n’a pas été ajoutée aux contacts."}</span></div>
            </div>
          )}
          {requestStatus === "none" && (
            <div className="request-empty"><CheckCircle size={20} weight="fill" /><div><strong>Aucune demande en attente</strong><span>Les nouvelles invitations apparaîtront ici.</span></div></div>
          )}
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

        <PushNotificationButton isDemo={isDemo} />
        {child ? <button className="parent-exit" type="button" onClick={onExit}><SignOut size={19} weight="bold" /> Quitter le mode parent</button> : <button className="parent-exit" type="button" onClick={onLogout}><ArrowLeft size={19} weight="bold" /> Revenir à l’accueil</button>}
      </div>
    </section>
  );
}

function ParentMessagesScreen({ parentName, familyChildren, threads, selectedThreadId, onSelectThread, onBack, onSend, onOpenFamilyConversation, isDemo, initialContactId = "", onContactHandled }) {
  const [draft, setDraft] = useState("");
  const [mediaByThread, setMediaByThread] = useState({});
  const [mediaError, setMediaError] = useState("");
  const [callMode, setCallMode] = useState(null);
  const [isAddingContact, setIsAddingContact] = useState(Boolean(initialContactId));
  const [contactId, setContactId] = useState(initialContactId);
  const [contactFeedback, setContactFeedback] = useState(null);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [messageError, setMessageError] = useState("");
  const parentMediaInputRef = useRef(null);
  const parentMediaUrlsRef = useRef([]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const { typingName, notifyTyping, stopTyping } = useTypingIndicator(selectedThread?.id, Boolean(selectedThread && !isDemo && selectedThread.serverBacked));

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
      if (!isDemo) await api.addContact(normalizedId);
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

  const sendParentMedia = (event) => {
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
    const media = supportedFiles.map((file) => {
      const url = URL.createObjectURL(file);
      parentMediaUrlsRef.current.push(url);
      return { id: `parent-media-${Date.now()}-${file.name}`, type: file.type.startsWith("video/") ? "video" : "image", url, name: file.name, status: "received" };
    });
    setMediaByThread((current) => ({ ...current, [selectedThread.id]: [...(current[selectedThread.id] ?? []), ...media] }));
    const sentMediaIds = new Set(media.map((item) => item.id));
    window.setTimeout(() => setMediaByThread((current) => ({ ...current, [selectedThread.id]: (current[selectedThread.id] ?? []).map((item) => sentMediaIds.has(item.id) ? { ...item, status: "seen" } : item) })), 1400);
    setMediaError("");
  };

  const sendParentVoice = (blob, duration) => {
    if (!selectedThread) return;
    const url = URL.createObjectURL(blob);
    parentMediaUrlsRef.current.push(url);
    const voice = { id: `parent-voice-${Date.now()}`, type: "audio", url, duration, status: "received" };
    setMediaByThread((current) => ({ ...current, [selectedThread.id]: [...(current[selectedThread.id] ?? []), voice] }));
    window.setTimeout(() => setMediaByThread((current) => ({
      ...current,
      [selectedThread.id]: (current[selectedThread.id] ?? []).map((item) => item.id === voice.id ? { ...item, status: "seen" } : item),
    })), 1400);
  };

  if (selectedThread && callMode === "audio") {
    return <AudioCallScreen child={{ name: parentName }} conversation={selectedThread} policy={{ allowed: true, reason: "", detail: selectedThread.isFamily ? "Conversation familiale sécurisée." : "Contact adulte vérifié." }} autoReply={{ enabled: false, message: "" }} onClose={() => setCallMode(null)} />;
  }

  if (selectedThread && callMode === "video") {
    return <VideoCallScreen child={{ name: parentName }} conversation={selectedThread} policy={{ allowed: true, reason: "", detail: selectedThread.isFamily ? "Conversation familiale sécurisée." : "Contact adulte vérifié." }} autoReply={{ enabled: false, message: "" }} onClose={() => setCallMode(null)} />;
  }

  if (selectedThread) {
    return (
      <section className="parent-messages-screen parent-thread-screen" aria-label={`Conversation parentale avec ${selectedThread.name}`}>
        <header className="parent-messages-header parent-thread-header">
          <button type="button" className="parent-back-button" onClick={() => onSelectThread(null)} aria-label="Retour aux conversations parentales"><ArrowLeft size={22} weight="bold" /></button>
          <span className="parent-contact-avatar" aria-hidden="true">{selectedThread.initials}</span>
          <div><strong>{selectedThread.name}</strong><small>{selectedThread.isFamily ? "Mon enfant · Conversation familiale" : `${selectedThread.relation} · Contact adulte`}</small></div>
          <button type="button" className="parent-thread-call" onClick={() => setCallMode("audio")} aria-label={`Appeler ${selectedThread.name}`}><Phone size={19} weight="fill" /></button>
          <button type="button" className="parent-thread-call" onClick={() => setCallMode("video")} aria-label={`Lancer une visio avec ${selectedThread.name}`}><VideoCamera size={20} weight="fill" /></button>
        </header>
        <div className="parent-thread-safety"><ShieldCheck size={17} weight="fill" /><span>{selectedThread.isFamily ? `Discussion familiale directe avec ${selectedThread.name}.` : "Discussion entre adultes, séparée de la messagerie des enfants."}</span></div>
        <div className="parent-thread-messages" aria-live="polite">
          <span className="parent-thread-day">Aujourd’hui</span>
          {selectedThread.messages.map((message) => (
            <div className={`parent-message-bubble parent-message-bubble--${message.direction}`} key={message.id}>
              <p>{message.text}</p><span className="parent-message-meta"><time>{message.time}</time>{message.direction === "sent" && <MessageStatus status={message.status ?? "seen"} />}</span>
            </div>
          ))}
          {(mediaByThread[selectedThread.id] ?? []).map((media) => media.type === "audio"
            ? <VoiceMessage key={media.id} url={media.url} duration={media.duration} status={media.status} parent />
            : (
              <figure className="parent-media-message" key={media.id}>
                {media.type === "video" ? <video src={media.url} controls playsInline aria-label={`Vidéo envoyée : ${media.name}`} /> : <img src={media.url} alt={`Image envoyée : ${media.name}`} />}
                <figcaption><span>{media.type === "video" ? "Vidéo" : "Photo"} envoyée · Maintenant</span><MessageStatus status={media.status} /></figcaption>
              </figure>
            ))}
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
        <div className="parent-inbox-intro"><span><LockKey size={21} weight="fill" /></span><div><strong>Votre messagerie protégée</strong><p>Parlez directement à vos enfants ou aux parents de leurs contacts, sans voir leurs discussions entre amis.</p></div></div>
        <div className="parent-inbox-title"><div><h2>Conversations</h2><span>{threads.length} contact{threads.length > 1 ? "s" : ""}</span></div><button type="button" className="parent-add-contact" onClick={() => { setIsAddingContact(true); setContactFeedback(null); }}><UserPlus size={18} weight="bold" /><span>Ajouter un contact</span></button></div>
        <div className="parent-thread-list">
          {threads.map((thread) => (
            <button type="button" className="parent-thread-row" key={thread.id} onClick={() => onSelectThread(thread.id)} aria-label={`Ouvrir la conversation avec ${thread.name}`}>
              <span className="parent-contact-avatar" aria-hidden="true">{thread.initials}</span>
              <span className="parent-thread-row__copy"><span><strong>{thread.name}</strong><small>{thread.time}</small></span><em>{thread.relation}</em><p>{thread.preview}</p></span>
              {thread.unread > 0 ? <span className="parent-thread-unread">{thread.unread}</span> : <CaretRight size={18} weight="bold" aria-hidden="true" />}
            </button>
          ))}
          {threads.length === 0 && <div className="parent-inbox-empty"><ChatCircleDots size={31} weight="fill" /><strong>Aucune conversation</strong><span>Écrivez à l’un de vos enfants ou ajoutez le parent d’un contact.</span></div>}
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
  const [requestStatuses, setRequestStatuses] = useState({});
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
  const activeRequestStatus = activeChild ? requestStatuses[activeChild.id] ?? "none" : "none";
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
      setParentView("access");
      return;
    }
    clearToken();
    setSession(null);
    setParentView(null);
  };

  useEffect(() => {
    if (!session || !getToken()) return undefined;
    const demoContacts = session.demo ? [...friends, pendingFriend] : [];
    const contactIds = [...demoContacts, ...parentThreads].map((contact) => contact.contactId).filter(Boolean);
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
  }, [session, parentThreads]);

  const applyFamilyChildren = (familyChildren) => {
    setChildren(familyChildren);
    setActiveChildId(familyChildren[0]?.id ?? null);
    setRequestStatuses(Object.fromEntries(familyChildren.map((child) => [child.id, "none"])));
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
    if (!parent.demo) {
      applyFamilyChildren([]);
      const [childrenData, conversationData, familyData] = await Promise.all([api.children(), api.conversations(), api.family()]);
      applyFamilyChildren(childrenData.children.filter((child) => child.contactId !== demoChildContactId));
      applyServerConversations({ ...parentWithId, role: "parent" }, conversationData.conversations);
      setFamily(normalizeFamily(familyData, parentWithId));
    }
    setFamilyOwner(parentWithId);
    setSession({ ...parentWithId, role: "parent" });
    setParentView("dashboard");
    setSelectedConversation(null);
  };

  const openChildSession = async (child) => {
    applyFamilyChildren([child]);
    if (!child.demo) {
      const conversationData = await api.conversations();
      applyServerConversations({ ...child, role: "child" }, conversationData.conversations);
    }
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

  const restoreDemoFamily = () => {
    setChildren(initialChildren.map((child) => ({ ...child })));
    setActiveChildId("emma");
    setRequestStatuses({ emma: "pending" });
    setSettingsByChild({ emma: cloneSafetySettings() });
    setSchedulesByChild({ emma: cloneCommunicationSchedule({ ...defaultCommunicationSchedule, calls: { ...defaultCommunicationSchedule.calls, enabled: true, start: "00:00", end: "23:59" }, video: { ...defaultCommunicationSchedule.video, enabled: true, start: "00:00", end: "23:59" } }) });
    setParentThreads(cloneParentThreads());
    setServerConversations([]);
    const demoParent = { id: "demo-parent", name: "Marie", email: "marie@demo.club", contactId: "SC-105-284-639" };
    setFamilyOwner(demoParent);
    setFamily({
      id: "demo-family",
      name: "Famille de Marie",
      role: "primary",
      members: [
        { ...demoParent, role: "primary", isCurrent: true },
        { id: "demo-coparent", name: "Alex", email: "alex@demo.club", contactId: "SC-193-406-852", role: "coparent", isCurrent: false },
      ],
      pendingInvitations: [],
    });
  };

  const openDemoAccount = () => {
    restoreDemoFamily();
    void openAuthenticatedSession({ id: "demo-parent", name: "Marie", email: "marie@demo.club", contactId: "SC-105-284-639", demo: true });
  };

  const loginChild = async (contactId, password) => {
    try {
      const { account } = await api.login({ contactId, password });
      if (account.role !== "child" || account.contactId === demoChildContactId) return false;
      await openChildSession(account);
      return true;
    } catch {
      return false;
    }
  };

  const openDemoChildAccount = () => {
    restoreDemoFamily();
    setSession({ name: "Emma", role: "child", childId: "emma", demo: true });
    setParentView(null);
    setSelectedConversation(null);
    setActiveTab("conversations");
  };

  const logoutParent = () => {
    clearToken();
    setSession(null);
    setFamilyOwner({ name: "", email: "", contactId: "" });
    setFamily(null);
    setChildren([]);
    setActiveChildId(null);
    setRequestStatuses({});
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
    if (session?.demo) return family;
    const familyData = await api.family();
    const normalized = normalizeFamily(familyData, session);
    setFamily(normalized);
    return normalized;
  };

  const inviteFamilyParent = async (email) => {
    if (session?.demo) {
      const id = `demo-invite-${Date.now()}`;
      const token = `demo_${crypto.randomUUID().replace(/-/g, "")}_${Date.now()}`;
      const invitation = { id, email, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), link: `${window.location.origin}${window.location.pathname}#familyInvite=${token}` };
      setFamily((current) => ({ ...current, pendingInvitations: [invitation, ...(current?.pendingInvitations ?? [])] }));
      return { invitation };
    }
    const result = await api.inviteFamilyParent(email);
    await refreshFamily();
    return result;
  };

  const revokeFamilyInvitation = async (invitationId) => {
    if (session?.demo) {
      setFamily((current) => ({ ...current, pendingInvitations: (current?.pendingInvitations ?? []).filter((invitation) => invitation.id !== invitationId) }));
      return;
    }
    await api.revokeFamilyInvitation(invitationId);
    await refreshFamily();
  };

  const removeFamilyParent = async (parentId) => {
    if (session?.demo) {
      setFamily((current) => ({ ...current, members: (current?.members ?? []).filter((member) => member.id !== parentId) }));
      return;
    }
    await api.removeFamilyParent(parentId);
    await refreshFamily();
  };

  const saveAvatar = async (avatar) => {
    if (session?.demo) {
      setChildren((current) => current.map((child) => child.id === activeChild.id ? { ...child, avatar, image: null } : child));
      return;
    }
    const { child } = await api.updateAvatar(avatar);
    setChildren((current) => current.map((item) => item.id === child.id ? child : item));
    setSession((current) => ({ ...current, ...child, childId: child.id }));
  };

  const changeParentPassword = async ({ currentPassword, newPassword }) => {
    if (session?.demo) {
      if (currentPassword !== "demo2026") throw new Error("Pour le faux compte, le mot de passe actuel est demo2026.");
      return;
    }
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

    if (session?.demo) {
      if (childData.id) {
        setChildren((current) => current.map((item) => item.id === childData.id ? { ...item, ...childData, username: uniqueUsername } : item));
      } else {
        const id = `child-${Date.now()}`;
        const reservedIds = [familyOwner.contactId, ...friends.map((friend) => friend.contactId), pendingFriend.contactId, ...children.map((child) => child.contactId).filter(Boolean)];
        const createdChild = { ...childData, id, username: uniqueUsername, contactId: childData.contactId ?? createUniqueContactId(reservedIds) };
        setChildren((current) => [...current, createdChild]);
        setActiveChildId(id);
        setRequestStatuses((current) => ({ ...current, [id]: "none" }));
        setSettingsByChild((current) => ({ ...current, [id]: cloneSafetySettings() }));
        setSchedulesByChild((current) => ({ ...current, [id]: cloneCommunicationSchedule() }));
      }
    } else {
      const result = childData.id
        ? await api.updateChild(childData.id, profile)
        : await api.createChild(profile);
      const savedChild = result.child;
      setChildren((current) => childData.id
        ? current.map((item) => item.id === savedChild.id ? savedChild : item)
        : [...current, savedChild]);
      setActiveChildId(savedChild.id);
      setRequestStatuses((current) => ({ ...current, [savedChild.id]: current[savedChild.id] ?? "none" }));
      setSettingsByChild((current) => ({ ...current, [savedChild.id]: cloneSafetySettings(savedChild.settings) }));
      setSchedulesByChild((current) => ({ ...current, [savedChild.id]: cloneCommunicationSchedule(savedChild.schedule) }));
    }
    setChildModal(null);
  };

  const deleteChild = async (childId) => {
    const childToDelete = children.find((child) => child.id === childId);
    if (!childToDelete) throw new Error("Ce profil enfant est introuvable.");
    if (!session?.demo) await api.deleteChild(childId);

    const remainingChildren = children.filter((child) => child.id !== childId);
    const removedThreadIds = parentThreads.filter((thread) => thread.contactId === childToDelete.contactId).map((thread) => thread.id);
    setChildren(remainingChildren);
    setActiveChildId((current) => current === childId ? remainingChildren[0]?.id ?? null : current);
    setRequestStatuses((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== childId)));
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
    if (session?.demo) return;
    try {
      const { child } = await api.updateChild(childId, { settings: nextSettings });
      setSettingsByChild((current) => ({ ...current, [childId]: cloneSafetySettings(child.settings) }));
    } catch {
      setSettingsByChild((current) => ({ ...current, [childId]: previousSettings }));
    }
  };

  const saveChildSchedule = async (childId, schedule) => {
    const nextSchedule = cloneCommunicationSchedule(schedule);
    if (!session?.demo) {
      const { child } = await api.updateChild(childId, { schedule: nextSchedule });
      setSchedulesByChild((current) => ({ ...current, [childId]: cloneCommunicationSchedule(child.schedule) }));
    } else {
      setSchedulesByChild((current) => ({ ...current, [childId]: nextSchedule }));
    }
    setScheduleModalChildId(null);
  };

  const openFamilyConversation = async (contactId) => {
    const familyChild = children.find((child) => child.contactId === contactId);
    if (!familyChild) throw new Error("Cet enfant n’appartient pas à votre famille.");

    if (session?.demo) {
      const threadId = `family-${familyChild.id}`;
      setParentThreads((current) => current.some((thread) => thread.id === threadId) ? current : [{
        id: threadId,
        name: familyChild.name,
        contactId: familyChild.contactId,
        contactRole: "child",
        isFamily: true,
        relation: "Mon enfant",
        initials: familyChild.name.slice(0, 1).toUpperCase(),
        preview: "Commencez votre conversation familiale.",
        time: "Maintenant",
        unread: 0,
        messages: [],
      }, ...current]);
      setSelectedParentThreadId(threadId);
      setParentView("messages");
      return threadId;
    }

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
    const result = session?.demo ? null : await api.sendMessage(threadId, text);
    const messageId = result?.message?.id ?? `parent-message-${Date.now()}`;
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? {
      ...thread,
      preview: text,
      time: "À l’instant",
      messages: [...thread.messages, { id: messageId, direction: "sent", text, time: "Maintenant", status: "received" }],
    } : thread));
    if (session?.demo) {
      window.setTimeout(() => setParentThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, messages: thread.messages.map((message) => message.id === messageId ? { ...message, status: "seen" } : message) } : thread)), 1400);
    }
    return result?.message;
  };

  const sendChildMessage = async (conversationId, text) => {
    if (session?.demo) return null;
    const { message } = await api.sendMessage(conversationId, text);
    const nextMessage = { id: message.id, direction: "sent", text, time: formatServerMessageTime(message.created_at), status: "received" };
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

  useEffect(() => {
    if (!session || session.demo || !getToken()) return undefined;
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
  }, [session?.id, session?.role, session?.demo]);

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const notificationType = params.get("notification");
    if (!notificationType) return;
    let handled = notificationType === "test";

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
      return <AuthScreen onLogin={loginParent} onRegister={registerParent} onDemo={openDemoAccount} onChildLogin={loginChild} onChildDemo={openDemoChildAccount} hasFamilyInvite={Boolean(familyInviteToken)} familyInvitation={familyInvitation} familyInvitationError={familyInvitationError} isFamilyInvitationLoading={isFamilyInvitationLoading} onDismissFamilyInvite={dismissFamilyInvitation} />;
    }
    if (parentView === "access") {
      return <ParentAccessScreen parentName={familyOwner.name} onBack={() => setParentView(null)} onUnlock={() => setParentView("dashboard")} />;
    }
    if (parentView === "messages") {
      return <ParentMessagesScreen parentName={familyOwner.name} familyChildren={children} threads={parentThreads} selectedThreadId={selectedParentThreadId} onSelectThread={openParentThread} onBack={() => { setSelectedParentThreadId(null); setParentView("dashboard"); }} onSend={sendParentMessage} onOpenFamilyConversation={openFamilyConversation} isDemo={Boolean(session.demo)} initialContactId={pendingContactId} onContactHandled={() => setPendingContactId("")} />;
    }
    if (parentView === "games") {
      return <ParentGamesScreen parent={familyOwner} children={children} isDemo={Boolean(session.demo)} onBack={() => setParentView("dashboard")} />;
    }
    if (parentView === "dashboard") {
      return (
        <ParentDashboard
          parentName={familyOwner.name}
          family={family}
          children={children}
          child={activeChild}
          isDemo={Boolean(session.demo)}
          requestStatus={activeRequestStatus}
          onSelectChild={setActiveChildId}
          onAddChild={() => setChildModal({ mode: "create" })}
          onEditChild={() => setChildModal({ mode: "edit", childId: activeChild.id })}
          onMessageChild={() => activeChild && void openFamilyConversation(activeChild.contactId)}
          onApproveRequest={() => activeChild && setRequestStatuses((current) => ({ ...current, [activeChild.id]: "approved" }))}
          onDeclineRequest={() => activeChild && setRequestStatuses((current) => ({ ...current, [activeChild.id]: "declined" }))}
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
          onExit={() => setParentView(null)}
          onLogout={logoutParent}
        />
      );
    }
    if (!activeChild) {
      return <NoChildScreen onOpenParent={() => setParentView("dashboard")} />;
    }
    if (activeChild.status === "paused") {
      return <PausedChildScreen child={activeChild} onOpenParent={() => setParentView("access")} />;
    }
    if (selectedConversation) {
      return <ChatScreen child={activeChild} conversation={selectedConversation} settings={activeSettings} schedule={activeSchedule} onBack={() => setSelectedConversation(null)} onSendMessage={sendChildMessage} />;
    }
    if (activeTab === "clubhouse") {
      const demoAdult = familyOwner.contactId ? [{ id: familyOwner.id ?? "demo-parent", name: familyOwner.name || "Mon parent", contactId: familyOwner.contactId, role: "parent" }] : [];
      const gameContacts = session?.demo ? [...demoAdult, ...friends.map((friend) => ({ ...friend, role: "child" }))] : [];
      return <ClubhouseScreen child={activeChild} contacts={gameContacts} isDemo={Boolean(session?.demo)} />;
    }
    if (isAvatarPreferencesOpen) return <AvatarPreferencesScreen child={activeChild} onBack={() => setIsAvatarPreferencesOpen(false)} onSave={saveAvatar} />;
    if (activeTab === "profile") return <ProfileScreen child={activeChild} isDemo={Boolean(session?.demo)} onOpenParent={() => setParentView("access")} onOpenPreferences={() => setIsAvatarPreferencesOpen(true)} onLogout={logoutParent} />;
    const baseFriends = session?.demo ? friends : [];
    const approvedFriends = (session?.demo && activeRequestStatus === "approved" ? [...baseFriends, pendingFriend] : baseFriends).map((friend) => ({ ...friend, online: presenceByContactId[friend.contactId] ?? false }));
    const availableConversations = session?.demo ? approvedFriends.map((friend) => conversations.find((item) => item.id === friend.id) ?? {
      ...friend,
      preview: "Vous êtes maintenant amis !",
      time: "Maintenant",
      ActivityIcon: Sparkle,
      received: [`Coucou ${activeChild.name} ! On peut enfin discuter ici.`],
      sent: "Bienvenue dans mon Clubhouse !",
    }) : serverConversations;
    return <HomeScreen child={activeChild} approvedFriends={approvedFriends} availableConversations={availableConversations} onQr={() => setIsQrOpen(true)} onOpenConversation={setSelectedConversation} />;
  }, [activeChild, activeRequestStatus, activeSchedule, activeSettings, activeTab, children, family, familyInvitation, familyInvitationError, familyInviteToken, familyOwner, isAvatarPreferencesOpen, isFamilyInvitationLoading, isRestoringSession, parentThreads, parentUnreadMessages, parentView, presenceByContactId, selectedConversation, selectedParentThreadId, serverConversations, session]);

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
        {session?.role === "parent" && isParentPasswordOpen && <ParentPasswordModal isDemo={Boolean(session.demo)} onClose={() => setIsParentPasswordOpen(false)} onSave={changeParentPassword} />}
        {session?.role === "parent" && isFamilyParentsOpen && family && <FamilyParentsModal family={family} currentParent={session} isDemo={Boolean(session.demo)} onClose={() => setIsFamilyParentsOpen(false)} onInvite={inviteFamilyParent} onRevoke={revokeFamilyInvitation} onRemove={removeFamilyParent} />}
        {session && childModal && (
          <ChildAccountModal
            key={`${childModal.mode}-${childModal.childId ?? "new"}`}
            child={childModal.mode === "edit" ? children.find((child) => child.id === childModal.childId) : null}
            canDelete={Boolean(session.demo) || family?.role === "primary"}
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
