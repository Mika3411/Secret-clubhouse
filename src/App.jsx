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

const friends = [
  { id: "leo", name: "Léo", contactId: "SC-214-680-531", image: "/avatars/leo.png" },
  { id: "ines", name: "Inès", contactId: "SC-317-492-604", image: "/avatars/ines.png" },
  { id: "noah", name: "Noah", contactId: "SC-421-835-726", image: "/avatars/noah.png" },
  { id: "maya", name: "Maya", contactId: "SC-536-147-892", image: "/avatars/maya.png" },
  { id: "tom", name: "Tom", contactId: "SC-648-259-413", image: "/avatars/tom.png" },
];

const pendingFriend = { id: "chloe", name: "Chloé", contactId: "SC-759-361-248", image: null };

const initialChildren = [
  {
    id: "emma",
    name: "Emma",
    age: 9,
    username: "emma.club",
    password: "Emma2026!",
    contactId: "SC-482-917-305",
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
    id: "nature-quiz",
    type: "game",
    title: "Quiz des animaux",
    description: "Teste tes connaissances avec trois questions rapides.",
    duration: 3,
    reward: 20,
    Icon: Brain,
    tone: "sun",
    questions: [
      { prompt: "Quel animal dort debout ?", answers: ["Le cheval", "Le dauphin", "Le lapin"], correct: 0 },
      { prompt: "Quel animal peut changer de couleur ?", answers: ["Le panda", "Le caméléon", "La loutre"], correct: 1 },
      { prompt: "Quel animal est le plus grand ?", answers: ["L’éléphant", "La baleine bleue", "La girafe"], correct: 1 },
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
      {person.image ? <img src={person.image} alt={`Avatar de ${person.name}`} /> : <span className="avatar__fallback" role="img" aria-label={`Avatar de ${person.name}`}>{person.name.slice(0, 1)}</span>}
      {online !== null && <span className={`online-dot ${online ? "is-online" : "is-offline"}`} aria-label={online ? "En ligne" : "Hors ligne"} title={online ? "En ligne" : "Hors ligne"} />}
    </span>
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

function AuthScreen({ onLogin, onRegister, onDemo, onChildLogin, onChildDemo }) {
  const [audience, setAudience] = useState("parent");
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [childContactId, setChildContactId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  const changeAudience = (nextAudience) => {
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
          <div className="auth-role-tabs" role="tablist" aria-label="Choisir son espace">
            <button type="button" role="tab" aria-selected={audience === "parent"} className={audience === "parent" ? "is-active" : ""} onClick={() => changeAudience("parent")}><ShieldCheck size={17} weight="fill" /> Parent</button>
            <button type="button" role="tab" aria-selected={audience === "child"} className={audience === "child" ? "is-active" : ""} onClick={() => changeAudience("child")}><Smiley size={17} weight="fill" /> Enfant</button>
          </div>

          {audience === "parent" && <div className="auth-tabs" role="tablist" aria-label="Accès au compte parent">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")}>Connexion</button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => changeMode("register")}>Inscription</button>
          </div>}

          <form className="auth-form" onSubmit={submitAuth}>
            <div className="auth-form__heading"><span className="auth-lock">{audience === "child" ? <Smiley size={23} weight="fill" /> : <LockKey size={22} weight="fill" />}</span><div><h2>{audience === "child" ? "Salut !" : mode === "login" ? "Ravi de vous revoir" : "Créer le compte parent"}</h2><p>{audience === "child" ? "Entre dans ton Clubhouse." : mode === "login" ? "Accédez à votre espace familial." : "Commencez par les informations de l’adulte."}</p></div></div>
            {audience === "parent" && mode === "register" && <label className="auth-field"><span>Prénom du parent</span><input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} autoComplete="given-name" placeholder="Marie" /></label>}
            {audience === "parent" ? <label className="auth-field"><span>Adresse e-mail</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" placeholder="parent@exemple.fr" /></label> : <label className="auth-field"><span>Ton identifiant unique</span><input value={childContactId} onChange={(event) => { setChildContactId(event.target.value.toUpperCase().slice(0, 14)); setError(""); }} autoComplete="username" autoCapitalize="characters" spellCheck="false" placeholder="SC-482-917-305" /></label>}
            <label className="auth-field"><span>Mot de passe</span><span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="6 caractères minimum" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>{showPassword ? <EyeSlash size={21} weight="bold" /> : <Eye size={21} weight="bold" />}</button></span></label>
            {audience === "parent" && mode === "register" && (
              <label className="auth-consent"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setError(""); }} /><span>Je confirme être le parent ou le responsable légal des enfants que j’ajouterai.</span></label>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit">{audience === "child" || mode === "login" ? <LockKeyOpen size={19} weight="fill" /> : <UserPlus size={19} weight="fill" />}{audience === "child" ? "Entrer dans mon espace" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
          </form>

          <div className="auth-separator"><span>ou</span></div>
          <button className="demo-account-button" type="button" onClick={audience === "child" ? onChildDemo : onDemo}><Sparkle size={20} weight="fill" /><span><strong>{audience === "child" ? "Tester comme Emma" : "Tester avec un faux compte"}</strong><small>{audience === "child" ? "ID SC-482-917-305 · compte enfant démo" : "Aucune donnée réelle nécessaire"}</small></span><CaretRight size={18} weight="bold" /></button>
          <p className="auth-legal"><LockKey size={13} weight="fill" /> Les comptes réels sont protégés et enregistrés sur le serveur familial.</p>
        </div>
      </div>
    </section>
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

function PushNotificationButton() {
  const native = Capacitor.isNativePlatform();
  const supported = native || ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  const [status, setStatus] = useState(supported ? "checking" : "unsupported");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return;
    if (native) {
      PushNotifications.checkPermissions().then(({ receive }) => setStatus(receive === "granted" ? "enabled" : receive === "denied" ? "denied" : "disabled"));
      return;
    }
    navigator.serviceWorker.register("/sw.js").then((registration) => registration.pushManager.getSubscription()).then((subscription) => setStatus(subscription ? "enabled" : Notification.permission === "denied" ? "denied" : "disabled")).catch(() => setStatus("unsupported"));
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

  return (
    <div className="push-setting">
      <button type="button" onClick={togglePush} disabled={status === "checking" || status === "unsupported" || status === "denied"}>
        <Bell size={20} weight="fill" />
        <span><strong>Notifications et son système</strong><small>{status === "enabled" ? "Activées même lorsque l’application est fermée" : status === "denied" ? "Bloquées dans les réglages du téléphone" : status === "unsupported" ? "Non disponibles sur ce navigateur" : "Recevoir les nouveaux messages en veille"}</small></span>
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

function ChatScreen({ child, conversation, settings, schedule, onBack }) {
  const [draft, setDraft] = useState("");
  const [sentMessages, setSentMessages] = useState([]);
  const [mediaError, setMediaError] = useState("");
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

  const sendMessage = () => {
    if (!messagePolicy.allowed) return;
    const message = draft.trim();
    if (!message) return;
    setSentMessages((current) => [...current, { id: `message-${Date.now()}`, type: "text", text: message, status: "received" }]);
    setDraft("");
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
          <span><ShieldCheck size={13} weight="fill" /> Contact approuvé</span>
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
        {conversation.received.map((message) => <p className="bubble bubble--received" key={message}>{message}</p>)}
        <p className="bubble bubble--sent">{conversation.sent}<MessageStatus status="seen" /></p>
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
        <div className="safety-reminder"><LockKey size={16} weight="fill" /> Cette discussion reste entre amis approuvés.</div>
      </div>

      {mediaError && <div className="media-error" role="alert">{mediaError}</div>}

      <form className={`composer ${messagePolicy.allowed ? "" : "is-quiet"}`} onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
        <input ref={mediaInputRef} className="sr-only" type="file" accept="image/*,video/*" multiple onChange={sendMedia} disabled={!messagePolicy.allowed || !settings.media} />
        <button type="button" className={`composer__control ${settings.media ? "" : "is-restricted"}`} aria-label={settings.media ? "Ajouter des photos ou vidéos" : "Photos et vidéos désactivées par un parent"} title={settings.media ? "Ajouter des photos ou vidéos" : "Désactivé par un parent"} onClick={() => mediaInputRef.current?.click()} disabled={!messagePolicy.allowed || !settings.media}><Plus size={22} weight="bold" /></button>
        <label className="composer__field">
          <span className="sr-only">Écris un message</span>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={messagePolicy.allowed ? "Écris un message…" : `Disponible à ${nextMessageTime}`} disabled={!messagePolicy.allowed} />
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
  const featuredActivity = clubhouseActivities.find((activity) => activity.featured);
  const visibleActivities = clubhouseActivities.filter((activity) => !activity.featured && (filter === "all" || activity.type === filter));
  const currentQuestion = selectedActivity?.questions?.[questionIndex] ?? null;
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
    if (questionIndex >= selectedActivity.questions.length - 1) {
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
                    <span className="clubhouse-quiz__progress">Question {questionIndex + 1} sur {selectedActivity.questions.length}</span>
                    <h3>{currentQuestion.prompt}</h3>
                    <div>{currentQuestion.answers.map((answer, index) => {
                      const isSelected = selectedAnswer === index;
                      const isCorrect = selectedAnswer !== null && index === currentQuestion.correct;
                      return <button key={answer} type="button" className={`${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""}`} onClick={() => selectQuizAnswer(index)} disabled={selectedAnswer !== null}>{answer}{isCorrect && <CheckCircle size={18} weight="fill" />}</button>;
                    })}</div>
                    {selectedAnswer !== null && <p className={selectedAnswer === currentQuestion.correct ? "is-correct" : "is-wrong"}>{selectedAnswer === currentQuestion.correct ? "Bien joué !" : "Presque ! Essaie encore."}</p>}
                    {selectedAnswer !== null && <button type="button" className="clubhouse-modal__primary" onClick={continueQuiz}>{selectedAnswer === currentQuestion.correct ? (questionIndex === selectedActivity.questions.length - 1 ? "Voir mon résultat" : "Question suivante") : "Réessayer"}<CaretRight size={18} weight="bold" /></button>}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function ProfileScreen({ child, onOpenParent, onLogout }) {
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
      <button type="button" className="parent-access-button" onClick={onOpenParent}>
        <LockKey size={20} weight="fill" />
        <span><strong>Espace parent</strong><small>Contacts et sécurité</small></span>
        <CaretRight size={19} weight="bold" />
      </button>
      <button type="button" className="secondary-button"><GearSix size={19} weight="bold" /> Mes préférences</button>
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

function ParentDashboard({ parentName, children, child, requestStatus, onSelectChild, onAddChild, onEditChild, onApproveRequest, onDeclineRequest, settings, onToggleSetting, schedule, unreadMessages, onOpenMessages, onOpenContactIds, onEditSchedule, onExit, onLogout }) {
  const baseFriendsCount = child?.id === "emma" ? friends.length : 0;
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
          <span><strong>Messagerie parentale</strong><small>Échangez uniquement avec les parents des contacts.</small></span>
          {unreadMessages > 0 ? <span className="parent-message-count">{unreadMessages}</span> : <CheckCircle size={20} weight="fill" />}
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>

        <button type="button" className="family-ids-entry" onClick={onOpenContactIds}>
          <span><IdentificationCard size={23} weight="fill" /></span>
          <span><strong>Identifiants de contact</strong><small>Un numéro unique et non réutilisable par membre.</small></span>
          <span className="family-ids-count">{children.length + 1}</span>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>

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
          <button type="button" className="child-edit-button" onClick={onEditChild} aria-label={`Modifier le profil de ${child.name}`}><PencilSimple size={19} weight="bold" /></button>
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

        <PushNotificationButton />
        {child ? <button className="parent-exit" type="button" onClick={onExit}><SignOut size={19} weight="bold" /> Quitter le mode parent</button> : <button className="parent-exit" type="button" onClick={onLogout}><ArrowLeft size={19} weight="bold" /> Revenir à l’accueil</button>}
      </div>
    </section>
  );
}

function ParentMessagesScreen({ parentName, threads, selectedThreadId, onSelectThread, onBack, onSend, isDemo, initialContactId = "", onContactHandled }) {
  const [draft, setDraft] = useState("");
  const [mediaByThread, setMediaByThread] = useState({});
  const [mediaError, setMediaError] = useState("");
  const [callMode, setCallMode] = useState(null);
  const [isAddingContact, setIsAddingContact] = useState(Boolean(initialContactId));
  const [contactId, setContactId] = useState(initialContactId);
  const [contactFeedback, setContactFeedback] = useState(null);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const parentMediaInputRef = useRef(null);
  const parentMediaUrlsRef = useRef([]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;

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

  const submitMessage = (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !selectedThread) return;
    onSend(selectedThread.id, message);
    setDraft("");
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
    return <AudioCallScreen child={{ name: parentName }} conversation={selectedThread} policy={{ allowed: true, reason: "", detail: "Contact adulte vérifié." }} autoReply={{ enabled: false, message: "" }} onClose={() => setCallMode(null)} />;
  }

  if (selectedThread && callMode === "video") {
    return <VideoCallScreen child={{ name: parentName }} conversation={selectedThread} policy={{ allowed: true, reason: "", detail: "Contact adulte vérifié." }} autoReply={{ enabled: false, message: "" }} onClose={() => setCallMode(null)} />;
  }

  if (selectedThread) {
    return (
      <section className="parent-messages-screen parent-thread-screen" aria-label={`Conversation parentale avec ${selectedThread.name}`}>
        <header className="parent-messages-header parent-thread-header">
          <button type="button" className="parent-back-button" onClick={() => onSelectThread(null)} aria-label="Retour aux conversations parentales"><ArrowLeft size={22} weight="bold" /></button>
          <span className="parent-contact-avatar" aria-hidden="true">{selectedThread.initials}</span>
          <div><strong>{selectedThread.name}</strong><small>{selectedThread.relation} · Contact adulte</small></div>
          <button type="button" className="parent-thread-call" onClick={() => setCallMode("audio")} aria-label={`Appeler ${selectedThread.name}`}><Phone size={19} weight="fill" /></button>
          <button type="button" className="parent-thread-call" onClick={() => setCallMode("video")} aria-label={`Lancer une visio avec ${selectedThread.name}`}><VideoCamera size={20} weight="fill" /></button>
        </header>
        <div className="parent-thread-safety"><ShieldCheck size={17} weight="fill" /><span>Discussion entre adultes, séparée de la messagerie des enfants.</span></div>
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
        </div>
        {mediaError && <div className="parent-media-error" role="alert">{mediaError}</div>}
        <form className="parent-message-composer" onSubmit={submitMessage}>
          <input ref={parentMediaInputRef} className="sr-only" type="file" accept="image/*,video/*" multiple onChange={sendParentMedia} />
          <button type="button" className="parent-media-button" onClick={() => parentMediaInputRef.current?.click()} aria-label="Ajouter des photos ou vidéos"><Plus size={21} weight="bold" /></button>
          <label><span className="sr-only">Écrire un message à {selectedThread.name}</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Votre message…" /></label>
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
        <div className="parent-inbox-intro"><span><LockKey size={21} weight="fill" /></span><div><strong>Un espace réservé aux adultes</strong><p>Ces messages ne sont jamais mélangés aux conversations de vos enfants.</p></div></div>
        <div className="parent-inbox-title"><div><h2>Conversations</h2><span>{threads.length} contact{threads.length > 1 ? "s" : ""}</span></div><button type="button" className="parent-add-contact" onClick={() => { setIsAddingContact(true); setContactFeedback(null); }}><UserPlus size={18} weight="bold" /><span>Ajouter un contact</span></button></div>
        <div className="parent-thread-list">
          {threads.map((thread) => (
            <button type="button" className="parent-thread-row" key={thread.id} onClick={() => onSelectThread(thread.id)} aria-label={`Ouvrir la conversation avec ${thread.name}`}>
              <span className="parent-contact-avatar" aria-hidden="true">{thread.initials}</span>
              <span className="parent-thread-row__copy"><span><strong>{thread.name}</strong><small>{thread.time}</small></span><em>{thread.relation}</em><p>{thread.preview}</p></span>
              {thread.unread > 0 ? <span className="parent-thread-unread">{thread.unread}</span> : <CaretRight size={18} weight="bold" aria-hidden="true" />}
            </button>
          ))}
          {threads.length === 0 && <div className="parent-inbox-empty"><ChatCircleDots size={31} weight="fill" /><strong>Aucune conversation</strong><span>Les parents des contacts approuvés apparaîtront ici.</span></div>}
        </div>
      </div>
      {isAddingContact && <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsAddingContact(false)}>
        <section className="add-contact-modal" role="dialog" aria-modal="true" aria-labelledby="add-contact-title" onMouseDown={(event) => event.stopPropagation()}>
          <span className="add-contact-icon"><UserPlus size={27} weight="fill" /></span>
          <h2 id="add-contact-title">Ajouter un contact</h2>
          <p>Saisissez son identifiant privé. Son parent devra approuver la demande avant toute discussion.</p>
          <form onSubmit={submitContact}>
            <label htmlFor="new-contact-id">Identifiant du contact</label>
            <input id="new-contact-id" value={contactId} onChange={(event) => { setContactId(event.target.value.toUpperCase().slice(0, 14)); setContactFeedback(null); }} placeholder="SC-123-456-789" autoComplete="off" autoFocus />
            {contactFeedback && <div className={`contact-feedback contact-feedback--${contactFeedback.type}`} role="status">{contactFeedback.type === "success" ? <CheckCircle size={17} weight="fill" /> : <Shield size={17} weight="fill" />}<span>{contactFeedback.text}</span></div>}
            <div className="add-contact-actions"><button type="button" onClick={() => setIsAddingContact(false)}>Annuler</button><button type="submit" disabled={isSubmittingContact}>{isSubmittingContact ? "Envoi…" : "Envoyer la demande"}</button></div>
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

function ChildAccountModal({ child, onClose, onSave }) {
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

        {error && <p className="child-form-error" role="alert">{error}</p>}
        <div className="child-modal-actions">
          <button type="button" className="decline-button" onClick={onClose}>Annuler</button>
          <button type="submit" className="primary-button"><CheckCircle size={18} weight="fill" /> {isEditing ? "Enregistrer" : "Créer le compte"}</button>
        </div>
      </form>
    </div>
  );
}

function ContactIdsModal({ parent, children, onClose }) {
  const [copiedMemberId, setCopiedMemberId] = useState(null);
  const members = [
    { id: "parent", name: parent.name, role: "Compte parent", contactId: parent.contactId, isParent: true },
    ...children.map((child) => ({ ...child, role: `Compte enfant · ${child.age} ans` })),
  ];

  const copyMemberId = async (member) => {
    await copyContactId(member.contactId);
    setCopiedMemberId(member.id);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="contact-ids-modal" role="dialog" aria-modal="true" aria-labelledby="contact-ids-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21} weight="bold" /></button>
        <div className="contact-ids-heading"><span><IdentificationCard size={28} weight="fill" /></span><div><small>Famille de {parent.name}</small><h2 id="contact-ids-title">Identifiants de contact</h2><p>Un numéro opaque et unique pour chaque membre.</p></div></div>
        <div className="contact-id-safety"><ShieldCheck size={18} weight="fill" /><span>Seul ce numéro exact cible un compte. Le pseudo n’est jamais utilisé pour démarrer une discussion.</span></div>
        <div className="contact-member-list">
          {members.map((member) => (
            <article className="contact-member-card" key={member.id}>
              {member.isParent ? <span className="contact-parent-avatar"><UserCircle size={29} weight="fill" /></span> : <Avatar person={member} size="child-tab" />}
              <div className="contact-member-copy"><strong>{member.name}</strong><small>{member.role}</small><span>ID {member.contactId}</span></div>
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
  const [familyOwner, setFamilyOwner] = useState({ name: "", email: "", contactId: "" });
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
  const [parentThreads, setParentThreads] = useState([]);
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
    if (!getToken()) return;
    api.me()
      .then(({ account }) => account.role === "child" ? openChildSession(account) : openAuthenticatedSession(account))
      .catch(() => clearToken());
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
    const contactIds = [...friends, pendingFriend, ...parentThreads].map((contact) => contact.contactId).filter(Boolean);
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
  };

  const openAuthenticatedSession = async (parent) => {
    const parentWithId = { ...parent, contactId: parent.contactId ?? "" };
    if (!parent.demo) {
      const family = await api.children();
      applyFamilyChildren(family.children);
    }
    setFamilyOwner(parentWithId);
    setSession({ ...parentWithId, role: "parent" });
    setParentView("dashboard");
    setSelectedConversation(null);
  };

  const openChildSession = (child) => {
    applyFamilyChildren([child]);
    setFamilyOwner({ name: "Compte parent", email: "", contactId: "" });
    setSession({ name: child.name, role: "child", childId: child.id });
    setActiveChildId(child.id);
    setParentView(null);
    setSelectedConversation(null);
    setActiveTab("conversations");
  };

  const loginParent = async (credentials) => {
    const { account } = await api.login(credentials);
    await openAuthenticatedSession(account);
  };

  const registerParent = async (parent) => {
    const { account } = await api.register(parent);
    await openAuthenticatedSession(account);
    setChildModal({ mode: "create" });
  };

  const restoreDemoFamily = () => {
    setChildren(initialChildren.map((child) => ({ ...child })));
    setActiveChildId("emma");
    setRequestStatuses({ emma: "pending" });
    setSettingsByChild({ emma: cloneSafetySettings() });
    setSchedulesByChild({ emma: cloneCommunicationSchedule({ ...defaultCommunicationSchedule, calls: { ...defaultCommunicationSchedule.calls, enabled: true, start: "00:00", end: "23:59" }, video: { ...defaultCommunicationSchedule.video, enabled: true, start: "00:00", end: "23:59" } }) });
    setParentThreads(cloneParentThreads());
    setFamilyOwner({ name: "Marie", email: "marie@demo.club", contactId: "SC-105-284-639" });
  };

  const openDemoAccount = () => {
    restoreDemoFamily();
    void openAuthenticatedSession({ name: "Marie", email: "marie@demo.club", contactId: "SC-105-284-639", demo: true });
  };

  const loginChild = async (contactId, password) => {
    try {
      const { account } = await api.login({ contactId, password });
      if (account.role !== "child") return false;
      openChildSession(account);
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
    setChildren([]);
    setActiveChildId(null);
    setRequestStatuses({});
    setSettingsByChild({});
    setSchedulesByChild({});
    setParentThreads([]);
    setParentView(null);
    setChildModal(null);
    setScheduleModalChildId(null);
    setIsContactIdsOpen(false);
    setSelectedParentThreadId(null);
    setSelectedConversation(null);
    setActiveTab("conversations");
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

  const openParentThread = (threadId) => {
    setSelectedParentThreadId(threadId);
    if (!threadId) return;
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, unread: 0 } : thread));
  };

  const sendParentMessage = (threadId, text) => {
    const messageId = `parent-message-${Date.now()}`;
    setParentThreads((current) => current.map((thread) => thread.id === threadId ? {
      ...thread,
      preview: text,
      time: "À l’instant",
      messages: [...thread.messages, { id: messageId, direction: "sent", text, time: "Maintenant", status: "received" }],
    } : thread));
    window.setTimeout(() => setParentThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, messages: thread.messages.map((message) => message.id === messageId ? { ...message, status: "seen" } : message) } : thread)), 1400);
  };

  const screen = useMemo(() => {
    if (!session) {
      return <AuthScreen onLogin={loginParent} onRegister={registerParent} onDemo={openDemoAccount} onChildLogin={loginChild} onChildDemo={openDemoChildAccount} />;
    }
    if (parentView === "access") {
      return <ParentAccessScreen parentName={familyOwner.name} onBack={() => setParentView(null)} onUnlock={() => setParentView("dashboard")} />;
    }
    if (parentView === "messages") {
      return <ParentMessagesScreen parentName={familyOwner.name} threads={parentThreads} selectedThreadId={selectedParentThreadId} onSelectThread={openParentThread} onBack={() => { setSelectedParentThreadId(null); setParentView("dashboard"); }} onSend={sendParentMessage} isDemo={Boolean(session.demo)} initialContactId={pendingContactId} onContactHandled={() => setPendingContactId("")} />;
    }
    if (parentView === "dashboard") {
      return (
        <ParentDashboard
          parentName={familyOwner.name}
          children={children}
          child={activeChild}
          requestStatus={activeRequestStatus}
          onSelectChild={setActiveChildId}
          onAddChild={() => setChildModal({ mode: "create" })}
          onEditChild={() => setChildModal({ mode: "edit", childId: activeChild.id })}
          onApproveRequest={() => activeChild && setRequestStatuses((current) => ({ ...current, [activeChild.id]: "approved" }))}
          onDeclineRequest={() => activeChild && setRequestStatuses((current) => ({ ...current, [activeChild.id]: "declined" }))}
          settings={activeSettings}
          onToggleSetting={(key) => activeChild && void toggleChildSetting(activeChild.id, key)}
          schedule={activeSchedule}
          unreadMessages={parentUnreadMessages}
          onOpenMessages={() => { setSelectedParentThreadId(null); setParentView("messages"); }}
          onOpenContactIds={() => setIsContactIdsOpen(true)}
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
      return <ChatScreen child={activeChild} conversation={selectedConversation} settings={activeSettings} schedule={activeSchedule} onBack={() => setSelectedConversation(null)} />;
    }
    if (activeTab === "clubhouse") return <ClubhouseScreen child={activeChild} />;
    if (activeTab === "profile") return <ProfileScreen child={activeChild} onOpenParent={() => setParentView("access")} onLogout={logoutParent} />;
    const baseFriends = activeChild.id === "emma" ? friends : [];
    const approvedFriends = (activeRequestStatus === "approved" ? [...baseFriends, pendingFriend] : baseFriends).map((friend) => ({ ...friend, online: presenceByContactId[friend.contactId] ?? false }));
    const availableConversations = approvedFriends.map((friend) => conversations.find((item) => item.id === friend.id) ?? {
      ...friend,
      preview: "Vous êtes maintenant amis !",
      time: "Maintenant",
      ActivityIcon: Sparkle,
      received: [`Coucou ${activeChild.name} ! On peut enfin discuter ici.`],
      sent: "Bienvenue dans mon Clubhouse !",
    });
    return <HomeScreen child={activeChild} approvedFriends={approvedFriends} availableConversations={availableConversations} onQr={() => setIsQrOpen(true)} onOpenConversation={setSelectedConversation} />;
  }, [activeChild, activeRequestStatus, activeSchedule, activeSettings, activeTab, children, familyOwner, parentThreads, parentUnreadMessages, parentView, presenceByContactId, selectedConversation, selectedParentThreadId, session]);

  const changeTab = (tab) => {
    const scrollContainer = dragScrollRef.current?.querySelector(".screen-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
    setSelectedConversation(null);
    setActiveTab(tab);
  };

  return (
    <main className="app-stage">
      <div className="mobile-prototype" ref={dragScrollRef}>
        <div className={`screen-scroll ${!session || selectedConversation || parentView || activeChild?.status === "paused" || !activeChild ? "screen-scroll--full" : ""}`}>{screen}</div>
        {session && !selectedConversation && !parentView && activeChild?.status === "active" && <BottomNavigation active={activeTab} onChange={changeTab} />}
        {isQrOpen && activeChild && <QrModal child={activeChild} onClose={() => setIsQrOpen(false)} onRequestAdd={requestFriendWithParent} />}
        {session && isContactIdsOpen && <ContactIdsModal parent={familyOwner} children={children} onClose={() => setIsContactIdsOpen(false)} />}
        {session && childModal && (
          <ChildAccountModal
            key={`${childModal.mode}-${childModal.childId ?? "new"}`}
            child={childModal.mode === "edit" ? children.find((child) => child.id === childModal.childId) : null}
            onClose={() => setChildModal(null)}
            onSave={saveChild}
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
      </div>
    </main>
  );
}
