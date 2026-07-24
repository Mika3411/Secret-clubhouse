import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Anchor } from "@phosphor-icons/react/Anchor";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { Check } from "@phosphor-icons/react/Check";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Clock } from "@phosphor-icons/react/Clock";
import { GameController } from "@phosphor-icons/react/GameController";
import { GridFour } from "@phosphor-icons/react/GridFour";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { Microphone } from "@phosphor-icons/react/Microphone";
import { MicrophoneSlash } from "@phosphor-icons/react/MicrophoneSlash";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Phone } from "@phosphor-icons/react/Phone";
import { PhoneDisconnect } from "@phosphor-icons/react/PhoneDisconnect";
import { Plus } from "@phosphor-icons/react/Plus";
import { Shield } from "@phosphor-icons/react/Shield";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Smiley } from "@phosphor-icons/react/Smiley";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/SpeakerSlash";
import { UserCircle } from "@phosphor-icons/react/UserCircle";
import { UserPlus } from "@phosphor-icons/react/UserPlus";
import { VideoCamera } from "@phosphor-icons/react/VideoCamera";
import { VideoCameraSlash } from "@phosphor-icons/react/VideoCameraSlash";
import { X } from "@phosphor-icons/react/X";
import { api } from "../api";
import { createWebRtcSession, getChannelPolicy, openCameraStream, openMicrophoneStream, stopMediaStream } from "../webrtc";
import { clearContactRequestFromUrl, formatServerMessageTime } from "../app-core";
import "../styles/conversations.css";
import { endNativeSystemCall } from "../native-notifications";
import { Avatar, ParentModeNavigation } from "./AuthenticatedShared";
import {
  ConversationMediaMessage,
  ConversationVoiceMessage,
  MessageStatus,
  VoiceMessage,
  VoiceRecorder,
} from "./conversations/media/ConversationMedia";

function useConversationBottom(conversationId, latestItemKey) {
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !conversationId) return undefined;

    const scrollToLatest = () => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };

    scrollToLatest();
    const animationFrame = window.requestAnimationFrame(scrollToLatest);
    const settledLayoutTimer = window.setTimeout(scrollToLatest, 180);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(settledLayoutTimer);
    };
  }, [conversationId, latestItemKey]);

  return scrollContainerRef;
}

export const conversationGameOptions = [
  {
    id: "connect_four",
    title: "Puissance 4",
    description: "Aligne quatre jetons avant ton adversaire.",
    Icon: GameController,
  },
  {
    id: "tic_tac_toe",
    title: "Morpion",
    description: "Aligne trois symboles sur une grille de neuf cases.",
    Icon: GridFour,
  },
  {
    id: "naval_battle",
    title: "Bataille navale",
    description: "Repère la flotte adverse sur une grille 5 × 5.",
    Icon: Anchor,
  },
];

export const conversationGameById = Object.fromEntries(
  conversationGameOptions.map((game) => [game.id, game]),
);

export const normalizeConversationGame = (game) => ({
  ...game,
  id: game.id,
  gameType: game.gameType ?? game.game_type ?? "connect_four",
  status: game.status ?? "pending",
  playerOneId: game.playerOneId ?? game.player_one_id,
  playerTwoId: game.playerTwoId ?? game.player_two_id,
  playerOneName: game.playerOneName ?? game.player_one_name ?? "",
  playerTwoName: game.playerTwoName ?? game.player_two_name ?? "",
  playerOneContactId: game.playerOneContactId ?? game.player_one_contact_id ?? "",
  playerTwoContactId: game.playerTwoContactId ?? game.player_two_contact_id ?? "",
  currentPlayerId: game.currentPlayerId ?? game.current_player_id ?? null,
  winnerId: game.winnerId ?? game.winner_id ?? null,
  createdAt: game.createdAt ?? game.created_at ?? new Date().toISOString(),
  updatedAt: game.updatedAt ?? game.updated_at ?? game.createdAt ?? game.created_at ?? new Date().toISOString(),
});

export const isGameWithContact = (game, contactId) => (
  game.playerOneContactId === contactId || game.playerTwoContactId === contactId
);

export function useConversationGameInvites({ contactId, enabled, inviteGame }) {
  const [games, setGames] = useState([]);
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const actionLockRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    setGames([]);
    setActionError("");
    if (!enabled || !contactId) return () => { isActive = false; };

    const refresh = async () => {
      try {
        const result = await api.games();
        if (!isActive) return;
        const nextGames = (result.games ?? [])
          .map(normalizeConversationGame)
          .filter((game) => isGameWithContact(game, contactId));
        setGames(nextGames);
      } catch {
        // Messaging remains usable if the game list cannot be refreshed.
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, [contactId, enabled]);

  const sendInvitation = async (gameType) => {
    if (actionLockRef.current) throw new Error("Une invitation est déjà en cours d’envoi.");
    if (games.some((game) => game.gameType === gameType && game.status === "pending")) {
      throw new Error(`Une invitation à ${conversationGameById[gameType]?.title ?? "ce jeu"} est déjà en attente.`);
    }
    actionLockRef.current = true;
    setBusyAction("invite");
    setActionError("");
    try {
      const result = inviteGame
        ? await inviteGame(contactId, gameType)
        : await api.inviteGame(contactId, gameType);
      const game = normalizeConversationGame(result.game ?? result);
      setGames((current) => [game, ...current.filter((item) => item.id !== game.id)]);
      return game;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      actionLockRef.current = false;
      setBusyAction("");
    }
  };

  const respondToInvitation = async (game, action) => {
    if (actionLockRef.current) return null;
    actionLockRef.current = true;
    setBusyAction(`${action}:${game.id}`);
    setActionError("");
    try {
      const result = await api.respondToGame(game.id, action);
      const updated = normalizeConversationGame(result.game ?? result);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
      return updated;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      actionLockRef.current = false;
      setBusyAction("");
    }
  };

  const visibleGames = useMemo(() => [...games]
    .sort((first, second) => new Date(first.updatedAt).getTime() - new Date(second.updatedAt).getTime())
    .slice(-3), [games]);

  return {
    games: visibleGames,
    actionError,
    busyAction,
    clearActionError: () => setActionError(""),
    sendInvitation,
    respondToInvitation,
  };
}

export function ConversationGameInviteDialog({ contactName, relation, parent = false, onClose, onSend }) {
  const [selectedGameType, setSelectedGameType] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isSending) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSending, onClose]);

  const submitInvitation = async (event) => {
    event.preventDefault();
    if (!selectedGameType || isSending) return;
    setIsSending(true);
    setError("");
    try {
      await onSend(selectedGameType);
      onClose();
    } catch (requestError) {
      setError(requestError.message || "L’invitation n’a pas pu être envoyée.");
      setIsSending(false);
    }
  };

  return createPortal((
    <div className="conversation-game-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSending) onClose();
    }}>
      <section className={`conversation-game-dialog ${parent ? "conversation-game-dialog--parent" : ""}`} role="dialog" aria-modal="true" aria-labelledby="conversation-game-title">
        <button type="button" className="conversation-game-dialog__close" onClick={onClose} disabled={isSending} aria-label="Fermer le choix du jeu"><X size={21} weight="bold" /></button>
        <div className="conversation-game-dialog__heading">
          <span><GameController size={30} weight="fill" /></span>
          <div><small>Invitation privée</small><h2 id="conversation-game-title">Inviter {contactName} à jouer</h2></div>
        </div>
        <div className="conversation-game-dialog__target">
          <ShieldCheck size={19} weight="fill" />
          <span><strong>{contactName}</strong><small>{relation || "Contact autorisé"} · destinataire verrouillé</small></span>
          <CheckCircle size={19} weight="fill" />
        </div>
        <form onSubmit={submitInvitation}>
          <fieldset>
            <legend>Choisis un jeu</legend>
            <div className="conversation-game-options">
              {conversationGameOptions.map(({ id, title, description, Icon }) => (
                <button type="button" key={id} className={selectedGameType === id ? "is-selected" : ""} onClick={() => { setSelectedGameType(id); setError(""); }} aria-pressed={selectedGameType === id}>
                  <span><Icon size={23} weight="fill" /></span>
                  <span><strong>{title}</strong><small>{description}</small></span>
                  <span className="conversation-game-option__check">{selectedGameType === id && <Check size={15} weight="bold" />}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p className="conversation-game-dialog__error" role="alert">{error}</p>}
          <button type="submit" className="conversation-game-dialog__send" disabled={!selectedGameType || isSending}>
            <PaperPlaneTilt size={19} weight="fill" />
            {isSending ? "Envoi de l’invitation…" : "Envoyer l’invitation"}
          </button>
        </form>
        <p className="conversation-game-dialog__privacy"><LockKey size={15} weight="fill" /> La partie reste privée dans Secret Clubhouse.</p>
      </section>
    </div>
  ), document.body);
}

export function ConversationGameInviteCard({ game, contactId, contactName, parent = false, busyAction, onRespond, onOpenGames }) {
  const [error, setError] = useState("");
  const gameDetails = conversationGameById[game.gameType] ?? conversationGameById.connect_four;
  const GameIcon = gameDetails.Icon;
  const direction = game.playerTwoContactId === contactId ? "sent" : "received";
  const isReceivedInvitation = game.status === "pending" && direction === "received";
  const isBusy = busyAction.endsWith(`:${game.id}`);
  const statusCopy = game.status === "pending"
    ? direction === "sent"
      ? "Invitation envoyée · en attente de réponse"
      : parent ? `${contactName} vous invite à jouer` : `${contactName} t’invite à jouer`
    : game.status === "active"
      ? "Partie acceptée · prête à continuer"
      : game.status === "declined"
        ? "Invitation refusée"
        : game.winnerId ? "Partie terminée" : "Match nul";

  const respond = async (action) => {
    setError("");
    try {
      await onRespond(game, action);
    } catch (requestError) {
      setError(requestError.message || "Cette invitation n’est plus disponible.");
    }
  };

  return (
    <article className={`conversation-game-card conversation-game-card--${direction} ${parent ? "conversation-game-card--parent" : ""}`}>
      <span className="conversation-game-card__icon"><GameIcon size={25} weight="fill" /></span>
      <div className="conversation-game-card__copy">
        <small>Invitation à jouer</small>
        <strong>{gameDetails.title}</strong>
        <span>{statusCopy}</span>
      </div>
      {isReceivedInvitation && (
        <div className="conversation-game-card__actions">
          <button type="button" className="is-secondary" onClick={() => void respond("decline")} disabled={isBusy}>Refuser</button>
          <button type="button" onClick={() => void respond("accept")} disabled={isBusy}>{isBusy ? "Réponse…" : "Accepter"}</button>
        </div>
      )}
      {game.status === "active" && <button type="button" className="conversation-game-card__open" onClick={() => onOpenGames?.(game)}><GameController size={17} weight="fill" /> Jouer</button>}
      <span className="conversation-game-card__meta"><Clock size={12} weight="fill" /> {formatServerMessageTime(game.createdAt)}</span>
      {error && <p className="conversation-game-card__error" role="alert">{error}</p>}
    </article>
  );
}

export function formatCallDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function useTypingIndicator(conversationId, enabled) {
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

export function TypingIndicator({ name }) {
  if (!name) return null;
  return <div className="typing-indicator" role="status" aria-live="polite"><span aria-hidden="true"><i /><i /><i /></span><small>{name} est en train d’écrire…</small></div>;
}

export function AudioCallScreen({ child, conversation, policy, autoReply, onClose }) {
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
      throw new Error("Utilisez le flux d’appel serveur depuis une conversation authentifiée.");
    } catch (callError) {
      cleanUpCall();
      setPhase("error");
      setConnectionState("failed");
      setError(callError?.name === "NotAllowedError"
        ? "Le micro est fermé pour le moment. Demande de l’aide à un adulte, puis réessaie."
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
            <span><strong>{policy.allowed ? "Tu peux appeler maintenant" : policy.reason}</strong><small>{policy.detail}</small></span>
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

export function VideoCallScreen({ child, conversation, policy, autoReply, onClose }) {
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
      throw new Error("Utilisez le flux d’appel serveur depuis une conversation authentifiée.");
    } catch (callError) {
      cleanUpCall();
      setPhase("error");
      setConnectionState("failed");
      setError(callError?.name === "NotAllowedError"
        ? "La caméra ou le micro est fermé pour le moment. Demande de l’aide à un adulte, puis réessaie."
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
            <span><strong>{policy.allowed ? "Tu peux appeler maintenant" : policy.reason}</strong><small>{policy.detail}</small></span>
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

export function RealtimeCallScreen({
  account,
  conversation,
  callType,
  direction = "outgoing",
  initialCall = null,
  initialIceServers = [],
  acceptedNatively = false,
  policy,
  onClose,
  onConversationRefresh,
}) {
  const isVideo = callType === "video";
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const rtcSessionRef = useRef(null);
  const callRef = useRef(initialCall);
  const lastSignalIdRef = useRef("0");
  const processingSignalsRef = useRef(false);
  const acceptedOfferRef = useRef(false);
  const acceptedAnswerRef = useRef(false);
  const closedExplicitlyRef = useRef(false);
  const nativeResumeStartedRef = useRef(false);
  const acceptedNativelyRef = useRef(acceptedNatively);
  const [call, setCall] = useState(initialCall);
  const [phase, setPhase] = useState(direction === "incoming" ? (acceptedNatively ? "requesting-media" : "incoming") : "ready");
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState("new");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const effectivePolicy = policy ?? { allowed: true, detail: "Tout est prêt." };
  acceptedNativelyRef.current = acceptedNatively;

  const releaseMedia = () => {
    rtcSessionRef.current?.close();
    rtcSessionRef.current = null;
    stopMediaStream(localStreamRef.current);
    stopMediaStream(remoteStreamRef.current);
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  const updateCall = (nextCall) => {
    callRef.current = nextCall;
    setCall(nextCall);
  };

  const attachStreams = () => {
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && remoteStreamRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
    if (remoteAudioRef.current && remoteStreamRef.current) remoteAudioRef.current.srcObject = remoteStreamRef.current;
  };

  const openLocalStream = () => isVideo ? openCameraStream() : openMicrophoneStream();

  const createPeer = (localStream, iceServers, callId) => {
    const session = createWebRtcSession({
      localStream,
      iceServers,
      onIceCandidate: (candidate) => api.sendCallSignal(callId, "ice", candidate),
      onRemoteStream: (stream) => {
        remoteStreamRef.current = stream;
        attachStreams();
      },
      onStateChange: (state) => {
        setConnectionState(state);
        if (state === "connected") setPhase("active");
        if (state === "failed") {
          setError("La connexion WebRTC a échoué. Vérifiez le réseau ou la configuration TURN.");
          setPhase("error");
        }
      },
    });
    rtcSessionRef.current = session;
    return session;
  };

  useEffect(() => {
    if (!acceptedNatively || initialCall?.status !== "accepted") return;
    callRef.current = initialCall;
    setCall(initialCall);
  }, [acceptedNatively, initialCall]);

  useEffect(() => {
    if (!acceptedNatively || direction !== "incoming" || nativeResumeStartedRef.current) return undefined;
    nativeResumeStartedRef.current = true;
    let active = true;
    const resumeAcceptedCall = async () => {
      try {
        if (!callRef.current || callRef.current.status !== "accepted") throw new Error("Cet appel n’est plus actif.");
        setPhase("requesting-media");
        const localStream = await openLocalStream();
        if (!active) {
          stopMediaStream(localStream);
          return;
        }
        localStreamRef.current = localStream;
        createPeer(localStream, initialIceServers, callRef.current.id);
        setConnectionState("connecting");
        setPhase("connecting");
        attachStreams();
      } catch (callError) {
        releaseMedia();
        if (callRef.current?.status === "accepted") {
          void endNativeSystemCall(callRef.current.id, "ended");
          try {
            const ended = await api.respondToCall(callRef.current.id, "hangup");
            updateCall(ended.call);
            closedExplicitlyRef.current = true;
          } catch {
            // Le serveur ou l’autre participant a peut-être déjà terminé l’appel.
          }
        }
        if (!active) return;
        setPhase("error");
        setError(callError?.name === "NotAllowedError"
          ? `${isVideo ? "La caméra ou le micro est fermé" : "Le micro est fermé"} pour le moment. L’appel a été terminé.`
          : callError?.message ?? "Impossible de reprendre l’appel accepté.");
      }
    };
    void resumeAcceptedCall();
    return () => { active = false; };
  }, [acceptedNatively]);

  useEffect(() => {
    attachStreams();
  }, [phase]);

  useEffect(() => {
    if (phase !== "active") return undefined;
    const timer = window.setInterval(() => setDuration((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => () => {
    const currentCall = callRef.current;
    if (!closedExplicitlyRef.current && currentCall && ["ringing", "accepted"].includes(currentCall.status)) {
      void api.respondToCall(currentCall.id, "hangup").catch(() => undefined);
      void endNativeSystemCall(currentCall.id, "ended");
    }
    releaseMedia();
  }, []);

  const processSignals = async (signals) => {
    const session = rtcSessionRef.current;
    if (!session) return;
    for (const signal of signals) {
      if (signal.signalType === "offer" && direction === "incoming" && !acceptedOfferRef.current) {
        const answer = await session.acceptOffer(signal.payload);
        acceptedOfferRef.current = true;
        await api.sendCallSignal(callRef.current.id, "answer", answer);
      } else if (signal.signalType === "answer" && direction === "outgoing" && !acceptedAnswerRef.current) {
        await session.acceptAnswer(signal.payload);
        acceptedAnswerRef.current = true;
      } else if (signal.signalType === "ice") {
        await session.addRemoteCandidate(signal.payload);
      }
      lastSignalIdRef.current = String(signal.id);
    }
  };

  useEffect(() => {
    if (!call?.id || !["incoming", "outgoing-ringing", "connecting", "active"].includes(phase)) return undefined;
    let active = true;
    const refresh = async () => {
      if (!active || processingSignalsRef.current) return;
      processingSignalsRef.current = true;
      try {
        const result = await api.call(call.id, lastSignalIdRef.current);
        if (!active) return;
        updateCall(result.call);
        await processSignals(result.signals ?? []);
        if (result.call.status === "accepted" && phase === "outgoing-ringing") setPhase("connecting");
        if (result.call.status === "accepted" && direction === "incoming" && phase === "incoming" && !acceptedNativelyRef.current) {
          closedExplicitlyRef.current = true;
          releaseMedia();
          setPhase("answered-elsewhere");
        } else if (result.call.status === "declined") {
          releaseMedia();
          void endNativeSystemCall(result.call.id, "declined");
          setPhase("declined");
          void onConversationRefresh?.();
        } else if (result.call.status === "cancelled") {
          releaseMedia();
          void endNativeSystemCall(result.call.id, "cancelled");
          setPhase("cancelled");
        } else if (result.call.status === "missed") {
          releaseMedia();
          void endNativeSystemCall(result.call.id, "missed");
          setPhase("missed");
        } else if (result.call.status === "ended") {
          releaseMedia();
          void endNativeSystemCall(result.call.id, "ended");
          setPhase("ended");
        }
      } catch (refreshError) {
        if (active && refreshError.status !== 404) setError(refreshError.message);
      } finally {
        processingSignalsRef.current = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 750);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [call?.id, phase]);

  const startOutgoingCall = async () => {
    if (!effectivePolicy.allowed || phase !== "ready") return;
    setError("");
    setPhase("requesting-media");
    try {
      const localStream = await openLocalStream();
      localStreamRef.current = localStream;
      const result = await api.startCall(conversation.id, callType);
      updateCall(result.call);
      const session = createPeer(localStream, result.iceServers, result.call.id);
      const offer = await session.createOffer();
      await api.sendCallSignal(result.call.id, "offer", offer);
      setConnectionState("connecting");
      setPhase("outgoing-ringing");
      attachStreams();
    } catch (callError) {
      releaseMedia();
      setPhase("error");
      setError(callError?.name === "NotAllowedError"
        ? `${isVideo ? "La caméra ou le micro est fermé" : "Le micro est fermé"} pour le moment. Demande de l’aide à un adulte, puis réessaie.`
        : callError?.message ?? "Impossible de démarrer l’appel.");
      if (callError?.payload?.autoReplySent) void onConversationRefresh?.();
    }
  };

  const acceptIncomingCall = async () => {
    if (!callRef.current || phase !== "incoming") return;
    setError("");
    setPhase("requesting-media");
    try {
      const localStream = await openLocalStream();
      localStreamRef.current = localStream;
      const result = await api.respondToCall(callRef.current.id, "accept");
      updateCall(result.call);
      createPeer(localStream, result.iceServers, result.call.id);
      setConnectionState("connecting");
      setPhase("connecting");
      attachStreams();
    } catch (callError) {
      releaseMedia();
      if (callRef.current?.status === "ringing") {
        try {
          const declined = await api.respondToCall(callRef.current.id, "decline");
          updateCall(declined.call);
          closedExplicitlyRef.current = true;
          void onConversationRefresh?.();
        } catch {
          // L’appel peut avoir expiré ou avoir déjà été annulé par l’appelant.
        }
      }
      setPhase("error");
      setError(callError?.name === "NotAllowedError"
        ? `${isVideo ? "La caméra ou le micro est fermé" : "Le micro est fermé"} pour le moment. L’appel n’a pas pu commencer.`
        : callError?.message ?? "Impossible d’accepter l’appel.");
    }
  };

  const declineIncomingCall = async () => {
    if (!callRef.current) return;
    setPhase("responding");
    void endNativeSystemCall(callRef.current.id, "declined");
    try {
      await api.respondToCall(callRef.current.id, "decline");
      closedExplicitlyRef.current = true;
      await onConversationRefresh?.();
      onClose();
    } catch (callError) {
      setError(callError.message);
      setPhase("incoming");
    }
  };

  const finishCall = async () => {
    const currentCall = callRef.current;
    setPhase("ending");
    if (currentCall) void endNativeSystemCall(currentCall.id, "ended");
    try {
      if (currentCall && ["ringing", "accepted"].includes(currentCall.status)) {
        await api.respondToCall(currentCall.id, "hangup");
      }
    } catch {
      // La fermeture locale doit rester immédiate même si le réseau vient de tomber.
    }
    closedExplicitlyRef.current = true;
    releaseMedia();
    await onConversationRefresh?.();
    onClose();
  };

  const closeTerminalState = async () => {
    closedExplicitlyRef.current = true;
    releaseMedia();
    await onConversationRefresh?.();
    onClose();
  };

  const toggleMicrophone = () => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    const nextCameraOff = !isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !nextCameraOff; });
    setIsCameraOff(nextCameraOff);
  };

  const toggleSpeaker = () => {
    const nextSpeakerOff = !isSpeakerOff;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = nextSpeakerOff;
    setIsSpeakerOff(nextSpeakerOff);
  };

  const terminalCopy = {
    declined: ["Appel refusé", `${conversation.name} ne peut pas répondre pour le moment.`],
    "answered-elsewhere": ["Appel pris sur un autre appareil", "La sonnerie a été arrêtée ici."],
    cancelled: ["Appel annulé", "L’appel a été annulé avant la connexion."],
    missed: ["Pas de réponse", `${conversation.name} n’a pas répondu à temps.`],
    ended: ["Appel terminé", `La conversation avec ${conversation.name} est terminée.`],
    error: ["Appel impossible", error || "La connexion n’a pas pu être établie."],
  };
  const isTerminal = Boolean(terminalCopy[phase]);
  const isPreparing = phase === "requesting-media";
  const isIncoming = direction === "incoming" && (phase === "incoming" || phase === "responding" || isPreparing);
  const isLive = ["outgoing-ringing", "connecting", "active", "ending"].includes(phase);
  const connectionLabel = phase === "outgoing-ringing"
    ? `Appel de ${conversation.name}…`
    : phase === "active" || connectionState === "connected"
      ? "WebRTC connecté"
      : "Connexion sécurisée…";

  if (!isLive) {
    const [terminalTitle, terminalDetail] = terminalCopy[phase] ?? [];
    return (
      <section className={`${isVideo ? "video" : "audio"}-call-screen ${isVideo ? "video" : "audio"}-call-screen--lobby`} aria-label={isIncoming ? `Appel entrant de ${conversation.name}` : `Préparer l’appel avec ${conversation.name}`}>
        <header className="video-call-topbar">
          {!isIncoming && <button type="button" className="video-call-back" onClick={isTerminal ? closeTerminalState : onClose} aria-label="Retour à la conversation"><ArrowLeft size={23} weight="bold" /></button>}
          <span><ShieldCheck size={17} weight="fill" /> {isIncoming ? "Appel entrant privé" : "Appel protégé"}</span>
        </header>
        <div className={isVideo ? "video-lobby-card" : "audio-lobby-card"}>
          <div className={isVideo ? "video-lobby-avatar" : "audio-lobby-avatar"}><Avatar person={conversation} size="hero" online /><span>{isVideo ? <VideoCamera size={26} weight="fill" /> : <Phone size={25} weight="fill" />}</span></div>
          <small>{isIncoming ? "Contact autorisé" : "Conversation privée"}</small>
          <h1>{isTerminal ? terminalTitle : isIncoming ? `${conversation.name} vous appelle` : `Appeler ${conversation.name} ?`}</h1>
          <p>{isTerminal ? terminalDetail : isIncoming ? `${isVideo ? "Appel vidéo" : "Appel audio"} — choisis accepter ou refuser.` : "Secret Clubhouse vérifie que tout est prêt avant la sonnerie."}</p>
          {!isIncoming && !isTerminal && <div className={`video-policy ${effectivePolicy.allowed ? "is-allowed" : "is-blocked"}`}>
            {effectivePolicy.allowed ? <ShieldCheck size={20} weight="fill" /> : <LockKey size={20} weight="fill" />}
            <span><strong>{effectivePolicy.allowed ? "Tout est prêt" : effectivePolicy.reason}</strong><small>{effectivePolicy.detail}</small></span>
          </div>}
          {error && !isTerminal && <div className="video-call-error" role="alert">{isVideo ? <VideoCameraSlash size={20} weight="fill" /> : <MicrophoneSlash size={20} weight="fill" />}<span>{error}</span></div>}
          <div className={`video-lobby-actions ${isIncoming ? "video-lobby-actions--incoming" : ""}`}>
            {isIncoming ? <>
              <button type="button" className="call-decline-button" onClick={declineIncomingCall} disabled={phase === "responding" || isPreparing}><PhoneDisconnect size={22} weight="fill" /> Refuser</button>
              <button type="button" className={isVideo ? "video-start-button" : "audio-start-button"} onClick={acceptIncomingCall} disabled={phase === "responding" || isPreparing}>{isVideo ? <VideoCamera size={21} weight="fill" /> : <Phone size={21} weight="fill" />}{isPreparing ? "Préparation…" : "Accepter"}</button>
            </> : isTerminal
              ? <button type="button" className={isVideo ? "video-start-button" : "audio-start-button"} onClick={closeTerminalState}>Retour à la conversation</button>
              : <button type="button" className={isVideo ? "video-start-button" : "audio-start-button"} onClick={startOutgoingCall} disabled={!effectivePolicy.allowed || isPreparing}>{isVideo ? <VideoCamera size={21} weight="fill" /> : <Phone size={21} weight="fill" />}{isPreparing ? "Préparation…" : isVideo ? "Appeler en visio" : "Appeler en audio"}</button>}
          </div>
          <div className="video-privacy-note"><LockKey size={15} weight="fill" /> Cet appel reste privé dans Secret Clubhouse.</div>
        </div>
      </section>
    );
  }

  if (!isVideo) {
    return (
      <section className="audio-call-screen audio-call-screen--active" aria-label={`Appel audio avec ${conversation.name}`}>
        <audio ref={remoteAudioRef} autoPlay aria-label={`Audio de ${conversation.name}`} />
        <header className="audio-call-topbar"><span className={`connection-dot ${connectionState === "connected" ? "is-connected" : ""}`} /><span>{connectionLabel}</span><strong>{formatCallDuration(duration)}</strong></header>
        <div className="audio-call-center">
          <div className="audio-call-avatar"><span className="audio-pulse audio-pulse--one" /><span className="audio-pulse audio-pulse--two" /><Avatar person={conversation} size="hero" online /></div>
          <h1>{conversation.name}</h1>
          <p>{phase === "outgoing-ringing" ? "En attente de sa réponse" : `En appel avec ${account.name}`}</p>
          <div className="audio-waveform" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <span key={index} style={{ "--wave-index": index }} />)}</div>
        </div>
        <div className="video-call-controls audio-call-controls" aria-label="Contrôles de l’appel audio">
          <button type="button" onClick={toggleMicrophone} className={isMuted ? "is-off" : ""} aria-label={isMuted ? "Réactiver le micro" : "Couper le micro"} aria-pressed={isMuted}>{isMuted ? <MicrophoneSlash size={25} weight="fill" /> : <Microphone size={25} weight="fill" />}<span>{isMuted ? "Micro coupé" : "Micro"}</span></button>
          <button type="button" onClick={finishCall} className="hangup-button" aria-label="Raccrocher"><PhoneDisconnect size={27} weight="fill" /><span>{phase === "outgoing-ringing" ? "Annuler" : "Raccrocher"}</span></button>
          <button type="button" onClick={toggleSpeaker} className={isSpeakerOff ? "is-off" : ""} aria-label={isSpeakerOff ? "Réactiver le haut-parleur" : "Couper le haut-parleur"} aria-pressed={isSpeakerOff}>{isSpeakerOff ? <SpeakerSlash size={25} weight="fill" /> : <SpeakerHigh size={25} weight="fill" />}<span>{isSpeakerOff ? "Son coupé" : "Haut-parleur"}</span></button>
        </div>
      </section>
    );
  }

  return (
    <section className="video-call-screen" aria-label={`Visio avec ${conversation.name}`}>
      <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline aria-label={`Vidéo de ${conversation.name}`} />
      <div className="video-call-shade" />
      <header className="video-call-topbar video-call-topbar--active"><div><span className={`connection-dot ${connectionState === "connected" ? "is-connected" : ""}`} /><span>{connectionLabel}</span></div><strong>{formatCallDuration(duration)}</strong></header>
      <div className="video-call-person"><strong>{conversation.name}</strong><span>{phase === "outgoing-ringing" ? "En attente de sa réponse" : "Contact autorisé"}</span></div>
      <div className={`local-video-wrap ${isCameraOff ? "is-off" : ""}`}><video ref={localVideoRef} className="local-video" autoPlay playsInline muted aria-label={`Aperçu caméra de ${account.name}`} />{isCameraOff && <span><VideoCameraSlash size={21} weight="fill" /> Caméra coupée</span>}<small>Vous</small></div>
      <div className="video-call-controls" aria-label="Contrôles de l’appel">
        <button type="button" onClick={toggleMicrophone} className={isMuted ? "is-off" : ""} aria-label={isMuted ? "Réactiver le micro" : "Couper le micro"} aria-pressed={isMuted}>{isMuted ? <MicrophoneSlash size={25} weight="fill" /> : <Microphone size={25} weight="fill" />}<span>{isMuted ? "Micro coupé" : "Micro"}</span></button>
        <button type="button" onClick={finishCall} className="hangup-button" aria-label="Raccrocher"><PhoneDisconnect size={27} weight="fill" /><span>{phase === "outgoing-ringing" ? "Annuler" : "Raccrocher"}</span></button>
        <button type="button" onClick={toggleCamera} className={isCameraOff ? "is-off" : ""} aria-label={isCameraOff ? "Réactiver la caméra" : "Couper la caméra"} aria-pressed={isCameraOff}>{isCameraOff ? <VideoCameraSlash size={25} weight="fill" /> : <VideoCamera size={25} weight="fill" />}<span>{isCameraOff ? "Caméra coupée" : "Caméra"}</span></button>
      </div>
    </section>
  );
}

export function ChatScreen({ child, conversation, settings, schedule, onBack, onLoadOlderMessages, onRetryMessages, onSendMessage, onSendMedia, onInviteGame, onOpenGames, onStartCall }) {
  const [draft, setDraft] = useState("");
  const [sentMessages, setSentMessages] = useState([]);
  const [mediaError, setMediaError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [isGameInviteOpen, setIsGameInviteOpen] = useState(false);
  const mediaInputRef = useRef(null);
  const mediaUrlsRef = useRef([]);
  const messagePolicy = getChannelPolicy(schedule, "messages");
  const audioCallPolicy = getChannelPolicy(schedule, "calls");
  const videoCallPolicy = getChannelPolicy(schedule, "video");
  const nextMessageTime = schedule.messages.start.endsWith(":00")
    ? `${schedule.messages.start.slice(0, 2).replace(/^0/, "")} h`
    : schedule.messages.start.replace(/^0/, "").replace(":", " h ");
  const { typingName, notifyTyping, stopTyping } = useTypingIndicator(conversation.id, Boolean(conversation.serverBacked));
  const canInviteToGame = Boolean(conversation.contactId && (conversation.serverBacked || onInviteGame));
  const canCall = Boolean(conversation.serverBacked && onStartCall);
  const {
    games: conversationGames,
    busyAction: gameBusyAction,
    sendInvitation: sendGameInvitation,
    respondToInvitation: respondToGameInvitation,
  } = useConversationGameInvites({
    contactId: conversation.contactId,
    enabled: Boolean(conversation.serverBacked),
    inviteGame: onInviteGame,
  });
  const latestMessage = conversation.serverBacked
    ? conversation.messages.at(-1)
    : sentMessages.at(-1);
  const latestConversationItemKey = [
    latestMessage?.id ?? "",
    conversation.serverBacked ? "server" : conversation.received.length,
    conversation.serverBacked ? 0 : Number(Boolean(conversation.sent)),
    sentMessages.length,
    conversationGames.at(-1)?.updatedAt ?? conversationGames.at(-1)?.id ?? "",
  ].join(":");
  const chatBodyRef = useConversationBottom(conversation.id, latestConversationItemKey);

  useEffect(() => () => {
    mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const sendMessage = async () => {
    if (!messagePolicy.allowed) return;
    const message = draft.trim();
    if (!message) return;
    setMessageError("");
    try {
      const sent = await onSendMessage?.(conversation.id, message);
      if (!conversation.serverBacked) {
        setSentMessages((current) => [...current, { id: sent?.id ?? `message-${Date.now()}`, type: "text", text: message, status: "sent" }]);
      }
      setDraft("");
      stopTyping();
    } catch (error) {
      setMessageError(error?.status === 403 || error?.status === 409 || error?.status === 423
        ? `${messagePolicy.reason} ${messagePolicy.detail}`
        : "Ton message n’est pas parti. Vérifie ta connexion, puis réessaie.");
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
          return { id: `media-${Date.now()}-${index}`, direction: "sent", type: file.type.startsWith("video/") ? "video" : "image", url, name: file.name, status: "sent" };
        });
        setSentMessages((current) => [...current, ...mediaMessages]);
      }
      setMediaError("");
    } catch (error) {
      setMediaError(error?.status === 403 || error?.status === 409 || error?.status === 423
        ? `${messagePolicy.reason} ${messagePolicy.detail}`
        : "Ta photo ou ta vidéo n’est pas partie. Vérifie ta connexion, puis réessaie.");
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
        <div className="conversation-actions">
          {canCall && <button className={`icon-button audio-call-button ${audioCallPolicy.allowed ? "" : "is-restricted"}`} type="button" onClick={() => onStartCall(conversation, "audio", audioCallPolicy)} disabled={!audioCallPolicy.allowed} aria-label={`Appeler ${conversation.name} en audio`}><Phone size={21} weight="fill" /></button>}
          {canCall && <button className={`icon-button video-call-button ${videoCallPolicy.allowed ? "" : "is-restricted"}`} type="button" onClick={() => onStartCall(conversation, "video", videoCallPolicy)} disabled={!videoCallPolicy.allowed} aria-label={`Appeler ${conversation.name} en vidéo`}><VideoCamera size={21} weight="fill" /></button>}
          {canInviteToGame && <button className="chat-game-button" type="button" onClick={() => setIsGameInviteOpen(true)} aria-label={`Inviter ${conversation.name} à jouer`}><GameController size={20} weight="fill" /><span>Jouer</span></button>}
        </div>
      </header>

      <div ref={chatBodyRef} className="chat-body" aria-live="polite">
        <div className="message-history-controls">
          {conversation.hasMoreMessages && <button type="button" onClick={() => onLoadOlderMessages?.(conversation.id)} disabled={conversation.messagesLoading}>{conversation.messagesLoading ? "Chargement…" : "Afficher les messages précédents"}</button>}
          {conversation.messagesLoading && !conversation.messagesLoaded && <span role="status">Chargement des messages…</span>}
          {conversation.messagesError && <span role="alert">{conversation.messagesError} <button type="button" onClick={() => onRetryMessages?.(conversation.id)}>Réessayer</button></span>}
        </div>
        <div className="chat-day">Aujourd’hui</div>
        {!messagePolicy.allowed && (
          <div className="chat-quiet-banner" role="status"><Clock size={18} weight="fill" /><span><strong>{messagePolicy.reason}</strong><small>{messagePolicy.detail}</small></span></div>
        )}
        {conversation.serverBacked ? conversation.messages.map((message) => message.type === "audio"
          ? <ConversationVoiceMessage key={message.id} message={message} />
          : message.type === "image" || message.type === "video"
            ? <ConversationMediaMessage key={message.id} message={message} />
            : <p className={`bubble bubble--${message.direction} ${message.messageKind === "automatic" ? "bubble--automatic" : ""}`} key={message.id}><span>{message.text}</span>{message.messageKind === "automatic" && <small>Automatique</small>}{message.direction === "sent" && <MessageStatus status={message.status ?? "sent"} />}</p>) : <>
          {conversation.received.map((message) => <p className="bubble bubble--received" key={message}>{message}</p>)}
          {conversation.sent && <p className="bubble bubble--sent">{conversation.sent}<MessageStatus status="sent" /></p>}
        </>}
        {sentMessages.map((message) => {
          if (message.type === "text") return <p className="bubble bubble--sent" key={message.id}>{message.text}<MessageStatus status={message.status} /></p>;
          if (message.type === "audio") return <VoiceMessage key={message.id} url={message.url} duration={message.duration} status={message.status} />;
          return <ConversationMediaMessage key={message.id} message={message} />;
        })}
        {conversationGames.map((game) => <ConversationGameInviteCard key={game.id} game={game} contactId={conversation.contactId} contactName={conversation.name} busyAction={gameBusyAction} onRespond={respondToGameInvitation} onOpenGames={onOpenGames} />)}
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
      {isGameInviteOpen && <ConversationGameInviteDialog contactName={conversation.name} relation={conversation.isFamily ? "Membre de ta famille" : "Contact approuvé"} onClose={() => setIsGameInviteOpen(false)} onSend={sendGameInvitation} />}
    </section>
  );
}

export function ParentMessagesScreen({ parentName, parentContactId = "", familyChildren, threads, selectedThreadId, onSelectThread, onLoadOlderMessages, onRetryMessages, onHome, onManagement, onSend, onSendMedia, onInviteGame, onOpenGames, onOpenFamilyConversation, onStartCall, onContactRequestCreated, conversationSyncError = "", onRetryConversationSync, initialContactId = "", initialRequesterContactId = "", onContactHandled }) {
  const availableRequesterIds = [parentContactId, ...familyChildren.map((child) => child.contactId)].filter(Boolean);
  const requesterProfileMismatch = Boolean(
    initialContactId
    && initialRequesterContactId
    && !availableRequesterIds.includes(initialRequesterContactId),
  );
  const initialRequester = initialContactId
    ? availableRequesterIds.includes(initialRequesterContactId) ? initialRequesterContactId : ""
    : parentContactId;
  const [draft, setDraft] = useState("");
  const [mediaByThread, setMediaByThread] = useState({});
  const [mediaError, setMediaError] = useState("");
  const [isGameInviteOpen, setIsGameInviteOpen] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(Boolean(initialContactId));
  const [contactId, setContactId] = useState(initialContactId);
  const [requesterContactId, setRequesterContactId] = useState(initialRequester);
  const [contactFeedback, setContactFeedback] = useState(null);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [messageError, setMessageError] = useState("");
  const parentMediaInputRef = useRef(null);
  const parentMediaUrlsRef = useRef([]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const { typingName, notifyTyping, stopTyping } = useTypingIndicator(selectedThread?.id, Boolean(selectedThread?.serverBacked));
  const canInviteToGame = Boolean(selectedThread?.contactId && (selectedThread.serverBacked || onInviteGame));
  const {
    games: conversationGames,
    busyAction: gameBusyAction,
    sendInvitation: sendGameInvitation,
    respondToInvitation: respondToGameInvitation,
  } = useConversationGameInvites({
    contactId: selectedThread?.contactId ?? "",
    enabled: Boolean(selectedThread?.serverBacked),
    inviteGame: onInviteGame,
  });
  const latestParentMessage = selectedThread?.messages?.at(-1);
  const latestParentConversationItemKey = [
    latestParentMessage?.id ?? "",
    selectedThread ? (mediaByThread[selectedThread.id] ?? []).length : 0,
    conversationGames.at(-1)?.updatedAt ?? conversationGames.at(-1)?.id ?? "",
  ].join(":");
  const parentThreadMessagesRef = useConversationBottom(
    selectedThread?.id ?? "",
    latestParentConversationItemKey,
  );

  useEffect(() => setIsGameInviteOpen(false), [selectedThreadId]);
  useEffect(() => {
    if (!initialContactId) return;
    setContactId(initialContactId);
    setRequesterContactId(availableRequesterIds.includes(initialRequesterContactId) ? initialRequesterContactId : "");
    setContactFeedback(null);
    setIsAddingContact(true);
  }, [familyChildren, initialContactId, initialRequesterContactId, parentContactId, requesterProfileMismatch]);

  useEffect(() => {
    if (requesterProfileMismatch) return;
    if (availableRequesterIds.includes(requesterContactId)) return;
    setRequesterContactId(initialContactId ? "" : parentContactId || "");
  }, [familyChildren, initialContactId, parentContactId, requesterContactId, requesterProfileMismatch]);

  const closeContactModal = () => {
    setIsAddingContact(false);
    setContactFeedback(null);
    if (initialContactId) {
      clearContactRequestFromUrl();
      onContactHandled?.();
    }
  };

  const submitContact = async (event) => {
    event.preventDefault();
    const normalizedId = contactId.trim().toUpperCase();
    if (requesterProfileMismatch) {
      setContactFeedback({ type: "error", text: "Connectez un parent de la famille du profil qui a lancé cette demande." });
      return;
    }
    if (!requesterContactId) {
      setContactFeedback({ type: "error", text: "Choisissez le membre de votre famille qui souhaite ajouter ce contact." });
      return;
    }
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
        clearContactRequestFromUrl();
        onContactHandled?.();
        return;
      }
      await api.addContact(normalizedId, requesterContactId);
      await Promise.resolve(onContactRequestCreated?.()).catch(() => undefined);
      setContactFeedback({ type: "success", text: "Demande envoyée au parent du contact." });
      setContactId("");
      clearContactRequestFromUrl();
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
          return { id: `parent-media-${Date.now()}-${file.name}`, direction: "sent", type: file.type.startsWith("video/") ? "video" : "image", url, name: file.name, status: "sent" };
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

  return (
    <section className={`parent-messages-screen parent-messages-workspace${selectedThread ? " has-selected-thread" : ""}`} aria-labelledby="parent-messages-title">
      <header className="parent-messages-header">
        <span className="parent-messages-header__shield"><ShieldCheck size={22} weight="fill" /></span>
        <div><span>Mode parent</span><h1 id="parent-messages-title">Messagerie parentale</h1></div>
        <span className="parent-avatar" aria-label={`Profil de ${parentName}`} role="img"><UserCircle size={28} weight="fill" /></span>
      </header>
      <div className="parent-inbox-layout">
        <aside className="parent-messages-content parent-inbox-master" aria-label="Liste des conversations parentales">
          <div className="parent-inbox-intro"><span><LockKey size={21} weight="fill" /></span><div><strong>Votre messagerie protégée</strong><p>Parlez à votre famille et aux parents autorisés, sans voir les discussions entre enfants.</p></div></div>
          {conversationSyncError && <div className="family-conversation-warning" role="alert"><Shield size={18} weight="fill" /><span>{conversationSyncError}</span><button type="button" onClick={onRetryConversationSync}>Réessayer</button></div>}
          <div className="parent-inbox-title"><div><h2>Conversations</h2><span>{threads.length} contact{threads.length > 1 ? "s" : ""}</span></div><button type="button" className="parent-add-contact" onClick={() => { setRequesterContactId(parentContactId || familyChildren[0]?.contactId || ""); setIsAddingContact(true); setContactFeedback(null); }}><UserPlus size={18} weight="bold" /><span>Ajouter</span></button></div>
          <div className="parent-thread-list">
            {threads.map((thread) => (
              <button type="button" className={`parent-thread-row${selectedThread?.id === thread.id ? " is-selected" : ""}`} key={thread.id} onClick={() => onSelectThread(thread.id)} aria-label={`Ouvrir la conversation avec ${thread.name}`} aria-current={selectedThread?.id === thread.id ? "true" : undefined}>
                <span className="parent-contact-avatar" aria-hidden="true">{thread.initials}</span>
                <span className="parent-thread-row__copy"><span><strong>{thread.name}</strong><small>{thread.time}</small></span><em>{thread.relation}</em><p>{thread.preview}</p></span>
                {thread.unread > 0 ? <span className="parent-thread-unread">{thread.unread}</span> : <CaretRight size={18} weight="bold" aria-hidden="true" />}
              </button>
            ))}
            {threads.length === 0 && <div className="parent-inbox-empty"><ChatCircleDots size={31} weight="fill" /><strong>Aucune conversation</strong><span>Écrivez à l’un de vos enfants ou ajoutez un contact.</span></div>}
          </div>
        </aside>

        <section className={`parent-thread-detail parent-thread-screen${selectedThread ? " has-thread" : ""}`} aria-label={selectedThread ? `Conversation parentale avec ${selectedThread.name}` : "Aucune conversation sélectionnée"}>
          {selectedThread ? <>
            <header className="parent-thread-header">
              <button type="button" className="parent-back-button" onClick={() => onSelectThread(null)} aria-label="Retour aux conversations parentales"><ArrowLeft size={22} weight="bold" /></button>
              <span className="parent-contact-avatar" aria-hidden="true">{selectedThread.initials}</span>
              <div><strong>{selectedThread.name}</strong><small>{selectedThread.isFamily ? "Mon enfant · Conversation familiale" : selectedThread.isHouseholdParent ? "Parent de la famille · Discussion privée" : `${selectedThread.relation} · Contact adulte`}</small></div>
              <div className="conversation-actions conversation-actions--parent">
                {onStartCall && <button type="button" className="icon-button audio-call-button" onClick={() => onStartCall(selectedThread, "audio")} aria-label={`Appeler ${selectedThread.name} en audio`}><Phone size={20} weight="fill" /></button>}
                {onStartCall && <button type="button" className="icon-button video-call-button" onClick={() => onStartCall(selectedThread, "video")} aria-label={`Appeler ${selectedThread.name} en vidéo`}><VideoCamera size={20} weight="fill" /></button>}
                {canInviteToGame && <button type="button" className="parent-thread-game-button" onClick={() => setIsGameInviteOpen(true)} aria-label={`Inviter ${selectedThread.name} à jouer`}><GameController size={19} weight="fill" /><span>Jouer</span></button>}
              </div>
            </header>
            <div className="parent-thread-safety"><ShieldCheck size={17} weight="fill" /><span>{selectedThread.isFamily ? `Discussion familiale directe avec ${selectedThread.name}.` : selectedThread.isHouseholdParent ? "Discussion privée entre les parents de votre famille." : "Discussion entre adultes, séparée de la messagerie des enfants."}</span></div>
            <div ref={parentThreadMessagesRef} className="parent-thread-messages" aria-live="polite">
              <div className="message-history-controls message-history-controls--parent">
                {selectedThread.hasMoreMessages && <button type="button" onClick={() => onLoadOlderMessages?.(selectedThread.id)} disabled={selectedThread.messagesLoading}>{selectedThread.messagesLoading ? "Chargement…" : "Afficher les messages précédents"}</button>}
                {selectedThread.messagesLoading && !selectedThread.messagesLoaded && <span role="status">Chargement des messages…</span>}
                {selectedThread.messagesError && <span role="alert">{selectedThread.messagesError} <button type="button" onClick={() => onRetryMessages?.(selectedThread.id)}>Réessayer</button></span>}
              </div>
              <span className="parent-thread-day">Aujourd’hui</span>
              {selectedThread.messages.map((message) => message.type === "audio"
                ? <ConversationVoiceMessage key={message.id} message={message} parent />
                : message.type === "image" || message.type === "video"
                  ? <ConversationMediaMessage key={message.id} message={message} parent />
                  : <div className={`parent-message-bubble parent-message-bubble--${message.direction} ${message.messageKind === "automatic" ? "is-automatic" : ""}`} key={message.id}>
                      <p>{message.text}</p><span className="parent-message-meta">{message.messageKind === "automatic" && <em>Automatique</em>}<time>{message.time}</time>{message.direction === "sent" && <MessageStatus status={message.status ?? "sent"} />}</span>
                    </div>)}
              {(mediaByThread[selectedThread.id] ?? []).map((media) => media.type === "audio"
                ? <VoiceMessage key={media.id} url={media.url} duration={media.duration} status={media.status} parent />
                : <ConversationMediaMessage key={media.id} message={media} parent />)}
              {conversationGames.map((game) => <ConversationGameInviteCard key={game.id} game={game} contactId={selectedThread.contactId} contactName={selectedThread.name} parent busyAction={gameBusyAction} onRespond={respondToGameInvitation} onOpenGames={onOpenGames} />)}
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
            {isGameInviteOpen && <ConversationGameInviteDialog contactName={selectedThread.name} relation={selectedThread.isFamily ? "Votre enfant" : selectedThread.isHouseholdParent ? "Parent de votre famille" : "Contact adulte autorisé"} parent onClose={() => setIsGameInviteOpen(false)} onSend={sendGameInvitation} />}
          </> : (
            <div className="parent-thread-placeholder">
              <span><ChatCircleDots size={34} weight="fill" /></span>
              <strong>Choisissez une conversation</strong>
              <p>Les échanges s’ouvriront ici tout en gardant votre liste à portée de main.</p>
            </div>
          )}
        </section>
      </div>
      <ParentModeNavigation active="conversations" unreadMessages={threads.reduce((total, thread) => total + (thread.unread ?? 0), 0)} onHome={onHome} onManagement={onManagement} onConversations={() => {}} />
      {isAddingContact && <div className="modal-backdrop" role="presentation" onMouseDown={closeContactModal}>
        <section className="add-contact-modal" role="dialog" aria-modal="true" aria-labelledby="add-contact-title" onMouseDown={(event) => event.stopPropagation()}>
          <span className="add-contact-icon"><UserPlus size={27} weight="fill" /></span>
          <h2 id="add-contact-title">Ajouter un contact</h2>
          <p>Un enfant de votre famille s’ouvre directement. Pour un contact extérieur, son parent devra approuver la demande.</p>
          <form onSubmit={submitContact}>
            <label htmlFor="contact-requester-id">Ajouter pour</label>
            <select id="contact-requester-id" value={requesterContactId} disabled={requesterProfileMismatch} onChange={(event) => { setRequesterContactId(event.target.value); setContactFeedback(null); }}>
              <option value="" disabled>Choisir un profil</option>
              <option value={parentContactId}>{parentName} · parent</option>
              {familyChildren.map((child) => <option key={child.id} value={child.contactId}>{child.name} · enfant</option>)}
            </select>
            <label htmlFor="new-contact-id">Identifiant du contact</label>
            <input id="new-contact-id" value={contactId} onChange={(event) => { setContactId(event.target.value.toUpperCase().slice(0, 14)); setContactFeedback(null); }} placeholder="SC-123-456-789" autoComplete="off" autoFocus />
            {requesterProfileMismatch && <div className="contact-feedback contact-feedback--error" role="alert"><Shield size={17} weight="fill" /><span>Connectez un parent de la famille du profil qui a lancé cette demande.</span></div>}
            {!requesterProfileMismatch && contactFeedback && <div className={`contact-feedback contact-feedback--${contactFeedback.type}`} role="status">{contactFeedback.type === "success" ? <CheckCircle size={17} weight="fill" /> : <Shield size={17} weight="fill" />}<span>{contactFeedback.text}</span></div>}
            <div className="add-contact-actions"><button type="button" onClick={closeContactModal}>Annuler</button><button type="submit" disabled={isSubmittingContact || requesterProfileMismatch}>{isSubmittingContact ? "Ouverture…" : "Continuer"}</button></div>
          </form>
        </section>
      </div>}
    </section>
  );
}
