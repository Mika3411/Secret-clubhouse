import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Anchor } from "@phosphor-icons/react/Anchor";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { Check } from "@phosphor-icons/react/Check";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Checks } from "@phosphor-icons/react/Checks";
import { GameController } from "@phosphor-icons/react/GameController";
import { GridFour } from "@phosphor-icons/react/GridFour";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { X } from "@phosphor-icons/react/X";
import { api } from "./api";
import { splitMessageLinks } from "./message-links";
import {
  TypingIndicator,
  useTypingIndicator,
} from "./features/conversations/thread/TypingIndicator";

const GAME_TYPES = {
  connect_four: {
    id: "connect_four",
    title: "Puissance 4",
    shortTitle: "Puissance 4",
    description: "Aligne quatre jetons avant ton adversaire.",
    columns: 7,
    rows: 6,
    boardSize: 42,
    playLabel: "à Puissance 4",
  },
  tic_tac_toe: {
    id: "tic_tac_toe",
    title: "Morpion",
    shortTitle: "Morpion",
    description: "Aligne trois symboles sur une grille de neuf cases.",
    columns: 3,
    rows: 3,
    boardSize: 9,
    playLabel: "au Morpion",
  },
  naval_battle: {
    id: "naval_battle",
    title: "Bataille navale",
    shortTitle: "Bataille navale",
    description: "Repère la flotte adverse sur une grille 5 × 5.",
    columns: 5,
    rows: 5,
    boardSize: 25,
    playLabel: "à la Bataille navale",
  },
};

const DEFAULT_GAME_TYPE = "connect_four";

function normalizeGameType(value) {
  return Object.hasOwn(GAME_TYPES, value) ? value : DEFAULT_GAME_TYPE;
}

function emptyBoard(gameType) {
  return Array(GAME_TYPES[normalizeGameType(gameType)].boardSize).fill(0);
}

function normalizeCellIndex(value, size = 5) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed < size * size ? parsed : null;
}

function normalizeCellList(value, size = 5) {
  const cells = [];
  const visit = (item) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (item && typeof item === "object") {
      const nested = item.cells ?? item.positions ?? item.position;
      if (nested !== undefined) {
        visit(nested);
        return;
      }
      visit(item.cell ?? item.index);
      return;
    }
    const index = normalizeCellIndex(item, size);
    if (index !== null) cells.push(index);
  };
  visit(value);
  return [...new Set(cells)];
}

function normalizeShotResult(value) {
  if (value === true) return "hit";
  if (value === false) return "miss";
  const normalized = String(value ?? "").toLowerCase();
  if (["hit", "sunk", "touché", "touche", "coulé", "coule"].includes(normalized)) return "hit";
  if (["miss", "water", "raté", "rate", "eau"].includes(normalized)) return "miss";
  return "";
}

function normalizeShotList(value, size = 5) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((shot) => {
    const cell = normalizeCellIndex(
      shot && typeof shot === "object"
        ? shot.cell ?? shot.index ?? shot.position
        : shot,
      size,
    );
    if (cell === null) return [];
    return [{
      cell,
      result: normalizeShotResult(
        shot && typeof shot === "object" ? shot.result ?? shot.hit : "",
      ),
    }];
  });
}

function normalizeNavalBoard(value) {
  const board = value && !Array.isArray(value) && typeof value === "object" ? value : {};
  const requestedSize = Number(board.size ?? board.boardSize ?? board.board_size);
  const size = Number.isInteger(requestedSize) && requestedSize >= 4 && requestedSize <= 8
    ? requestedSize
    : 5;
  const ownFleet = normalizeCellList(
    board.ownFleet ?? board.own_fleet ?? board.ownShips ?? board.own_ships,
    size,
  );
  const ownIncomingShots = normalizeShotList(
    board.incomingShots
      ?? board.incoming_shots
      ?? board.ownIncomingShots
      ?? board.own_incoming_shots
      ?? board.opponentShots
      ?? board.opponent_shots,
    size,
  ).map((shot) => ({
    ...shot,
    result: shot.result || (ownFleet.includes(shot.cell) ? "hit" : "miss"),
  }));
  const shots = normalizeShotList(board.shots ?? board.outgoingShots ?? board.outgoing_shots, size);
  const outgoingHitCells = new Set(
    Array.isArray(board.opponentHits ?? board.opponent_hits)
      ? normalizeCellList(board.opponentHits ?? board.opponent_hits, size)
      : [],
  );

  return {
    size,
    ownFleet,
    ownIncomingShots,
    shots: shots.map((shot) => ({
      ...shot,
      result: shot.result || (outgoingHitCells.has(shot.cell) ? "hit" : ""),
    })),
    ownHits: board.ownHits ?? board.own_hits,
    opponentHits: board.opponentHits ?? board.opponent_hits,
    hitsScored: board.hitsScored ?? board.hits_scored,
    damageTaken: board.damageTaken ?? board.damage_taken,
    fleetSegments: board.fleetSegments ?? board.fleet_segments,
    ownRemaining: board.ownRemaining ?? board.own_remaining,
    opponentRemaining: board.opponentRemaining ?? board.opponent_remaining,
  };
}

function normalizeGame(game) {
  const gameType = normalizeGameType(game.gameType ?? game.game_type);
  const expectedSize = GAME_TYPES[gameType].boardSize;
  const board = gameType === "naval_battle"
    ? normalizeNavalBoard(game.board)
    : Array.isArray(game.board) ? game.board.slice(0, expectedSize) : [];

  return {
    ...game,
    gameType,
    playerOneId: game.playerOneId ?? game.player_one_id,
    playerTwoId: game.playerTwoId ?? game.player_two_id,
    playerOneName: game.playerOneName ?? game.player_one_name,
    playerTwoName: game.playerTwoName ?? game.player_two_name,
    currentPlayerId: game.currentPlayerId ?? game.current_player_id,
    winnerId: game.winnerId ?? game.winner_id,
    invitedBy: game.invitedBy ?? game.invited_by,
    conversationId: game.conversationId ?? game.conversation_id ?? null,
    board: gameType === "naval_battle"
      ? board
      : [...board, ...emptyBoard(gameType).slice(board.length)],
  };
}

function gridCoordinate(index, size) {
  return `${String.fromCharCode(65 + (index % size))}${Math.floor(index / size) + 1}`;
}

function gameStatusLabel(game, accountId, opponentName) {
  if (game.status === "pending") {
    return game.playerTwoId === accountId
      ? `${game.playerOneName || opponentName} t’invite à jouer`
      : `Invitation envoyée à ${opponentName}`;
  }
  if (game.status === "declined") return `${opponentName} a refusé l’invitation`;
  if (game.status === "cancelled") return "Partie arrêtée";
  if (game.status === "completed") {
    if (!game.winnerId) return "Match nul";
    return game.winnerId === accountId ? "Bravo, tu as gagné !" : `${opponentName} a gagné`;
  }
  return game.currentPlayerId === accountId ? "À toi de jouer" : `Au tour de ${opponentName}`;
}

function mergeGameConversationMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => {
    if (message?.id) byId.set(message.id, { ...byId.get(message.id), ...message });
  });
  return [...byId.values()]
    .sort((first, second) => {
      const timestampDifference = new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
      return timestampDifference || String(first.id).localeCompare(String(second.id));
    })
    .slice(-40);
}

function GameMessageText({ text }) {
  return splitMessageLinks(text).map((part, index) => part.type === "link"
    ? (
      <a
        href={part.href}
        key={`game-message-link-${index}`}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
      >
        {part.value}
      </a>
      )
    : <span key={`game-message-text-${index}`}>{part.value}</span>);
}

function gameMessageContent(message) {
  if (message.text) return message.text;
  const mediaType = String(message.mediaType ?? "");
  if (mediaType.startsWith("image/")) return "Photo";
  if (mediaType.startsWith("video/")) return "Vidéo";
  if (mediaType.startsWith("audio/")) return "Message vocal";
  return "Message supprimé";
}

function gameMessageTime(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function GameMessageDelivery({ status }) {
  if (!status) return null;
  const seen = status === "seen";
  const label = seen ? "Vu" : status === "received" ? "Reçu" : "Envoyé";
  return (
    <span className={`game-chat__delivery is-${status}`} aria-label={label} title={label}>
      {seen ? <Checks size={13} weight="bold" aria-hidden="true" /> : <Check size={13} weight="bold" aria-hidden="true" />}
    </span>
  );
}

function GameConversationPanel({ conversationId, accountId, opponentName }) {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const syncCursorRef = useRef("0");
  const messagesRef = useRef(null);
  const { typingName, notifyTyping, stopTyping } = useTypingIndicator(
    conversationId,
    Boolean(conversationId && isOpen),
  );

  const markLoadedMessagesSeen = useCallback((loadedMessages) => {
    const receivedIds = loadedMessages
      .filter((message) => message.senderId !== accountId)
      .map((message) => message.id);
    if (receivedIds.length) {
      void api.markConversationRead(conversationId, receivedIds).catch(() => undefined);
    }
  }, [accountId, conversationId]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setError("");
    setIsReady(false);
    syncCursorRef.current = "0";
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !isOpen) return undefined;
    let active = true;
    setIsLoading(true);
    setError("");
    void Promise.all([
      api.conversations(),
      api.conversationMessages(conversationId, { limit: 40 }),
    ]).then(([conversationResult, messageResult]) => {
      if (!active) return;
      const loadedMessages = messageResult.messages ?? [];
      syncCursorRef.current = String(conversationResult.syncCursor ?? "0");
      setMessages(loadedMessages);
      setIsReady(true);
      markLoadedMessagesSeen(loadedMessages);
    }).catch(() => {
      if (!active) return;
      setError("La discussion se reconnecte. Tes messages ne sont pas perdus.");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [conversationId, isOpen, markLoadedMessagesSeen]);

  useEffect(() => {
    if (!conversationId || !isOpen || !isReady) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const result = await api.syncConversations(syncCursorRef.current);
        if (!active) return;
        syncCursorRef.current = String(result.cursor ?? syncCursorRef.current);
        const changedMessages = (result.messages ?? [])
          .filter((message) => message.conversationId === conversationId);
        if (changedMessages.length) {
          setMessages((current) => mergeGameConversationMessages(current, changedMessages));
          markLoadedMessagesSeen(changedMessages);
        }
        setError("");
      } catch {
        if (active) setError("La discussion se reconnecte. Tu peux continuer à jouer.");
      }
    };
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [conversationId, isOpen, isReady, markLoadedMessagesSeen]);

  useEffect(() => {
    if (!isOpen || !messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [isOpen, messages, typingName]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!conversationId || !text || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const result = await api.sendMessage(conversationId, text);
      setMessages((current) => mergeGameConversationMessages(current, [result.message]));
      setDraft("");
      stopTyping();
    } catch (sendError) {
      setError([403, 409, 423].includes(sendError?.status)
        ? "La discussion fait une petite pause pour le moment."
        : "Ton message n’est pas parti. Vérifie ta connexion, puis réessaie.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className={`game-chat ${isOpen ? "is-open" : ""}`} aria-label={`Discussion avec ${opponentName}`}>
      <button
        type="button"
        className="game-chat__toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="game-chat__icon"><ChatCircleDots size={21} weight="fill" aria-hidden="true" /></span>
        <span>
          <strong>Parler avec {opponentName}</strong>
          <small>{isOpen ? "La discussion reste ouverte pendant la partie" : "Ouvrir la discussion"}</small>
        </span>
        <CaretDown size={18} weight="bold" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="game-chat__panel">
          <p className="game-chat__privacy"><LockKey size={14} weight="fill" aria-hidden="true" /> Conversation privée et protégée</p>
          <div className="game-chat__messages" ref={messagesRef} aria-live="polite">
            {isLoading && !messages.length && <p className="game-chat__empty" role="status">Ouverture de la discussion…</p>}
            {!isLoading && !messages.length && !error && (
              <p className="game-chat__empty">Vous pouvez parler de la partie ici.</p>
            )}
            {messages.map((message) => {
              const sent = message.senderId === accountId;
              const content = gameMessageContent(message);
              return (
                <article className={`game-chat__message ${sent ? "is-sent" : "is-received"}`} key={message.id}>
                  <p><GameMessageText text={content} /></p>
                  <small>
                    {gameMessageTime(message.createdAt)}
                    {sent && <GameMessageDelivery status={message.deliveryStatus} />}
                  </small>
                </article>
              );
            })}
            <TypingIndicator name={typingName} />
          </div>
          {error && <p className="game-chat__error" role="status">{error}</p>}
          <form className="game-chat__composer" onSubmit={sendMessage}>
            <input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (event.target.value.trim()) notifyTyping();
                else stopTyping();
              }}
              maxLength={4000}
              placeholder="Écris pendant la partie…"
              aria-label={`Écrire à ${opponentName}`}
              disabled={!conversationId || isSending}
            />
            <button
              type="submit"
              aria-label="Envoyer le message"
              disabled={!conversationId || !draft.trim() || isSending}
            >
              <PaperPlaneTilt size={19} weight="fill" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function NavalBattleBoards({ board, myTurn, busy, onPlayMove }) {
  const size = board?.size || 5;
  const cells = Array.from({ length: size * size }, (_, index) => index);
  const ownFleet = new Set(board?.ownFleet ?? []);
  const shots = new Map((board?.shots ?? []).map((shot) => [shot.cell, shot]));
  const incomingShots = new Map(
    (board?.ownIncomingShots ?? []).map((shot) => [shot.cell, shot]),
  );
  const hitsScored = Number.isFinite(Number(board?.hitsScored))
    ? Number(board.hitsScored)
    : [...shots.values()].filter((shot) => shot.result === "hit").length;
  const damageTaken = Number.isFinite(Number(board?.damageTaken))
    ? Number(board.damageTaken)
    : [...incomingShots.values()].filter((shot) => shot.result === "hit").length;
  const fleetSegments = Number.isFinite(Number(board?.fleetSegments))
    ? Number(board.fleetSegments)
    : ownFleet.size;

  return (
    <div className="naval-battle" aria-label="Plateau de Bataille navale">
      <section className="naval-battle__zone" aria-labelledby="naval-target-title">
        <div className="naval-battle__zone-heading">
          <span>
            <strong id="naval-target-title">Eaux adverses</strong>
            <small>{myTurn ? "Choisis une case pour tirer" : "Attends ton tour"}</small>
          </span>
          <em>{hitsScored}/{fleetSegments || "?"} touché{hitsScored === 1 ? "" : "s"}</em>
        </div>
        <div
          className="naval-grid naval-grid--target"
          role="grid"
          aria-label="Grille de tir sur la flotte adverse"
          style={{ "--naval-size": size }}
        >
          {cells.map((index) => {
            const shot = shots.get(index);
            const result = shot?.result;
            const coordinate = gridCoordinate(index, size);
            const resultLabel = result === "hit"
              ? "touché"
              : result === "miss" ? "à l’eau" : shot ? "tir enregistré" : "";
            return (
              <button
                key={index}
                type="button"
                role="gridcell"
                className={`naval-cell naval-cell--target${result ? ` is-${result}` : ""}${shot ? " is-shot" : ""}`}
                onClick={() => onPlayMove(index)}
                disabled={!myTurn || busy || Boolean(shot)}
                aria-label={shot ? `${coordinate} : ${resultLabel}` : `Tirer en ${coordinate}`}
              >
                <small aria-hidden="true">{coordinate}</small>
                <span aria-hidden="true">{result === "hit" ? "×" : result === "miss" ? "•" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="naval-battle__zone naval-battle__zone--own" aria-labelledby="naval-fleet-title">
        <div className="naval-battle__zone-heading">
          <span>
            <strong id="naval-fleet-title">Ta flotte</strong>
            <small>Cette grille reste secrète pour ton adversaire</small>
          </span>
          <em>{damageTaken}/{fleetSegments || "?"} touché{damageTaken === 1 ? "" : "s"}</em>
        </div>
        <div
          className="naval-grid naval-grid--fleet"
          role="grid"
          aria-label="Position et état de ta flotte"
          style={{ "--naval-size": size }}
        >
          {cells.map((index) => {
            const shot = incomingShots.get(index);
            const hasShip = ownFleet.has(index);
            const result = shot?.result || (shot ? (hasShip ? "hit" : "miss") : "");
            const coordinate = gridCoordinate(index, size);
            const state = result === "hit"
              ? "navire touché"
              : result === "miss" ? "tir adverse à l’eau" : hasShip ? "navire intact" : "eau";
            return (
              <div
                key={index}
                role="gridcell"
                className={`naval-cell naval-cell--fleet${hasShip ? " has-ship" : ""}${result ? ` is-${result}` : ""}`}
                aria-label={`${coordinate} : ${state}`}
              >
                <small aria-hidden="true">{coordinate}</small>
                <span aria-hidden="true">{result === "hit" ? "×" : result === "miss" ? "•" : hasShip ? "■" : ""}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="naval-battle__legend" aria-label="Légende">
        <span><i className="is-ship" aria-hidden="true" /> Navire</span>
        <span><i className="is-hit" aria-hidden="true">×</i> Touché</span>
        <span><i className="is-miss" aria-hidden="true">•</i> À l’eau</span>
      </div>
    </div>
  );
}

export default function ConnectFourGame({
  child,
  initialGame = null,
  onComplete,
  onExitToConversation,
  onConversationChange,
}) {
  const launchGame = initialGame?.id ? normalizeGame(initialGame) : null;
  const [games, setGames] = useState(() => launchGame ? [launchGame] : []);
  const [contacts, setContacts] = useState([]);
  const [selectedGameType, setSelectedGameType] = useState(() => launchGame?.gameType ?? DEFAULT_GAME_TYPE);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [activeGameId, setActiveGameId] = useState(() => launchGame?.status === "active" ? launchGame.id : null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const awardedRef = useRef(new Set());
  const openedGameIdRef = useRef(launchGame?.id ?? "");

  const gamesForSelectedType = useMemo(
    () => games.filter((game) => game.gameType === selectedGameType),
    [games, selectedGameType],
  );
  const activeGame = games.find((game) => game.id === activeGameId) ?? null;
  const pendingInvites = gamesForSelectedType.filter(
    (game) => game.status === "pending" && game.playerTwoId === child.id,
  );
  const openGames = gamesForSelectedType.filter(
    (game) => game.status === "active" || (game.status === "pending" && game.playerOneId === child.id),
  );

  const refreshGames = async () => {
    try {
      const result = await api.games();
      setGames((result.games ?? []).map(normalizeGame));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const refreshContacts = async () => {
    try {
      const result = await api.gameContacts();
      const nextContacts = result.contacts ?? [];
      setContacts(nextContacts);
      setSelectedContactId((current) => (
        nextContacts.some((contact) => contact.contactId === current)
          ? current
          : nextContacts[0]?.contactId ?? ""
      ));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    void refreshGames();
    void refreshContacts();
    const timer = window.setInterval(() => void refreshGames(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!initialGame?.id || openedGameIdRef.current === initialGame.id) return;
    const game = normalizeGame(initialGame);
    openedGameIdRef.current = game.id;
    setGames((current) => [game, ...current.filter((item) => item.id !== game.id)]);
    setSelectedGameType(game.gameType);
    setActiveGameId(game.status === "active" ? game.id : null);
    setError("");
    setNotice("");
    setIsConfirmingStop(false);
  }, [initialGame]);

  useEffect(() => {
    if (
      activeGame?.status === "completed"
      && activeGame.winnerId === child.id
      && !awardedRef.current.has(activeGame.id)
    ) {
      awardedRef.current.add(activeGame.id);
      onComplete?.();
    }
  }, [activeGame, child.id, onComplete]);

  useEffect(() => {
    if (activeGame?.status !== "cancelled") return;
    if (activeGame.conversationId && onExitToConversation) {
      onExitToConversation(activeGame.conversationId);
      return;
    }
    setSelectedGameType(activeGame.gameType);
    setActiveGameId(null);
    setIsConfirmingStop(false);
    setNotice("La partie est arrêtée pour vous deux.");
  }, [activeGame, onExitToConversation]);

  useEffect(() => {
    onConversationChange?.(activeGame?.conversationId ?? "");
  }, [activeGame?.conversationId, onConversationChange]);

  const opponentName = useMemo(() => {
    if (!activeGame) return "ton adversaire";
    return activeGame.playerOneId === child.id
      ? activeGame.playerTwoName || "ton adversaire"
      : activeGame.playerOneName || "ton adversaire";
  }, [activeGame, child.id]);

  const selectGameType = (gameType) => {
    setSelectedGameType(gameType);
    setActiveGameId(null);
    setError("");
    setNotice("");
    setIsConfirmingStop(false);
  };

  const invite = async () => {
    const contact = contacts.find((item) => item.contactId === selectedContactId);
    if (!contact) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.inviteGame(contact.contactId, selectedGameType);
      const game = normalizeGame(result.game);
      setGames((current) => [game, ...current.filter((item) => item.id !== game.id)]);
      setActiveGameId(game.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (game, action) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.respondToGame(game.id, action);
      const updated = normalizeGame(result.game);
      setGames((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (action === "accept") setActiveGameId(updated.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const stopGame = async () => {
    if (!activeGame || !["pending", "active"].includes(activeGame.status) || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.stopGame(activeGame.id);
      const updated = normalizeGame(result.game);
      setGames((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.conversationId && onExitToConversation) {
        onExitToConversation(updated.conversationId);
        return;
      }
      setSelectedGameType(updated.gameType);
      setActiveGameId(null);
      setIsConfirmingStop(false);
      setNotice("La partie est arrêtée pour vous deux.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const playMove = async (move) => {
    if (
      !activeGame
      || activeGame.status !== "active"
      || activeGame.currentPlayerId !== child.id
      || busy
    ) return;

    setBusy(true);
    setError("");
    try {
      const result = await api.playGameMove(activeGame.id, move);
      const updated = normalizeGame(result.game);
      setGames((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const gameTypePicker = (
    <div className="multiplayer-game-picker" role="group" aria-label="Choisir un jeu">
      {Object.values(GAME_TYPES).map((gameType) => {
        const invitationCount = games.filter(
          (game) => game.gameType === gameType.id
            && game.status === "pending"
            && game.playerTwoId === child.id,
        ).length;
        const invitationLabel = invitationCount
          ? `, ${invitationCount} invitation${invitationCount > 1 ? "s" : ""}`
          : "";
        return (
          <button
            key={gameType.id}
            type="button"
            className={`multiplayer-game-picker__option ${selectedGameType === gameType.id ? "is-selected" : ""}`}
            onClick={() => selectGameType(gameType.id)}
            aria-label={`${gameType.title}${invitationLabel}`}
            aria-pressed={selectedGameType === gameType.id}
          >
            {gameType.id === "connect_four" && (
              <GameController size={21} weight="fill" aria-hidden="true" />
            )}
            {gameType.id === "tic_tac_toe" && (
              <GridFour size={21} weight="fill" aria-hidden="true" />
            )}
            {gameType.id === "naval_battle" && (
              <Anchor size={21} weight="fill" aria-hidden="true" />
            )}
            <span><strong>{gameType.title}</strong><small>{gameType.description}</small></span>
            {invitationCount > 0 && <em aria-hidden="true">{invitationCount}</em>}
          </button>
        );
      })}
    </div>
  );

  if (!activeGame) {
    const selectedGame = GAME_TYPES[selectedGameType];
    return (
      <div className="connect-four-lobby multiplayer-hub">
        <span className="connect-four-lobby__icon multiplayer-hub__icon">
          <GameController size={32} weight="fill" aria-hidden="true" />
        </span>
        <h3>Joue à plusieurs</h3>
        <p>Choisis un jeu, puis invite un contact approuvé ou un membre de ta famille.</p>

        {gameTypePicker}

        {pendingInvites.length > 0 && (
          <section className="multiplayer-game-list" aria-labelledby="multiplayer-invitations-title">
            <h4 id="multiplayer-invitations-title">Invitations · {selectedGame.shortTitle}</h4>
            {pendingInvites.map((game) => (
              <div className="game-invite multiplayer-game-card" key={game.id}>
                <span>
                  <strong>{game.playerOneName}</strong>
                  <small>t’invite à jouer {selectedGame.playLabel}</small>
                </span>
                <button
                  type="button"
                  onClick={() => respond(game, "decline")}
                  disabled={busy}
                  aria-label={`Refuser l’invitation de ${game.playerOneName}`}
                >
                  <X size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => respond(game, "accept")}
                  disabled={busy}
                  aria-label={`Accepter l’invitation de ${game.playerOneName}`}
                >
                  <CheckCircle size={18} weight="fill" aria-hidden="true" />
                </button>
              </div>
            ))}
          </section>
        )}

        {openGames.length > 0 && (
          <section className="multiplayer-game-list" aria-labelledby="multiplayer-open-games-title">
            <h4 id="multiplayer-open-games-title">Parties à reprendre · {selectedGame.shortTitle}</h4>
            {openGames.map((game) => {
              const opponent = game.playerOneId === child.id ? game.playerTwoName : game.playerOneName;
              return (
                <button
                  className="multiplayer-resume-card"
                  key={game.id}
                  type="button"
                  onClick={() => setActiveGameId(game.id)}
                >
                  <span>
                    <strong>{opponent || "Adversaire"}</strong>
                    <small>{gameStatusLabel(game, child.id, opponent || "ton adversaire")}</small>
                  </span>
                  <span>Reprendre</span>
                </button>
              );
            })}
          </section>
        )}

        <section className="multiplayer-invite-panel" aria-labelledby="multiplayer-opponent-title">
          <h4 id="multiplayer-opponent-title">Nouvelle partie de {selectedGame.shortTitle}</h4>
          <div className="game-contact-picker multiplayer-contact-picker">
            {contacts.map((contact) => (
              <button
                key={contact.contactId}
                type="button"
                className={selectedContactId === contact.contactId ? "is-selected" : ""}
                onClick={() => setSelectedContactId(contact.contactId)}
                aria-pressed={selectedContactId === contact.contactId}
              >
                <span>{contact.name}</span>
                {contact.role === "parent" && <small>Adulte</small>}
              </button>
            ))}
          </div>
          {contacts.length ? (
            <button
              className="clubhouse-modal__primary"
              type="button"
              onClick={invite}
              disabled={busy || !selectedContactId}
            >
              <PaperPlaneTilt size={18} weight="fill" aria-hidden="true" />
              {busy ? "Invitation…" : `Inviter ${selectedGame.playLabel}`}
            </button>
          ) : (
            <p className="game-empty-contacts">
              <ShieldCheck size={17} weight="fill" aria-hidden="true" />
              Ajoute un contact approuvé ou demande à un adulte de rejoindre ta famille.
            </p>
          )}
        </section>

        {notice && <p className="game-notice" role="status">{notice}</p>}
        {error && <p className="game-error" role="alert">{error}</p>}
      </div>
    );
  }

  const gameType = GAME_TYPES[activeGame.gameType];
  const canReturnToConversation = Boolean(activeGame.conversationId && onExitToConversation);
  const myTurn = activeGame.status === "active" && activeGame.currentPlayerId === child.id;
  const canStopGame = ["pending", "active"].includes(activeGame.status);
  const playerOneLabel = activeGame.playerOneId === child.id
    ? `${activeGame.playerOneName || child.name} (toi)`
    : activeGame.playerOneName;
  const playerTwoLabel = activeGame.playerTwoId === child.id
    ? `${activeGame.playerTwoName || child.name} (toi)`
    : activeGame.playerTwoName;

  return (
    <div className={`connect-four-game multiplayer-game multiplayer-game--${activeGame.gameType}`}>
      <div className="connect-four-status multiplayer-game__status" role="status" aria-live="polite">
        <small>{gameType.title}</small>
        <strong>{child.name} contre {opponentName}</strong>
        <span>{gameStatusLabel(activeGame, child.id, opponentName)}</span>
      </div>

      {activeGame.gameType === "naval_battle" ? (
        <div className="multiplayer-game__play-area">
          <div className="multiplayer-game__board-area">
            <NavalBattleBoards
              board={activeGame.board}
              myTurn={myTurn}
              busy={busy}
              onPlayMove={playMove}
            />
          </div>
          <GameConversationPanel
            conversationId={activeGame.conversationId}
            accountId={child.id}
            opponentName={opponentName}
          />
        </div>
      ) : (
        <div className="multiplayer-game__play-area">
          <div className="multiplayer-game__board-area">
            <div
              className={`connect-four-board multiplayer-board multiplayer-board--${activeGame.gameType}`}
              role="grid"
              aria-label={`Grille de ${gameType.title}`}
              style={{ "--game-columns": gameType.columns, "--game-rows": gameType.rows }}
            >
              {activeGame.board.map((cell, index) => {
                const column = index % gameType.columns;
                const move = activeGame.gameType === "connect_four" ? column : index;
                const columnIsFull = activeGame.gameType === "connect_four" && Boolean(activeGame.board[column]);
                const occupied = Boolean(cell);
                const disabled = !myTurn || busy || columnIsFull || (activeGame.gameType === "tic_tac_toe" && occupied);
                const cellLabel = occupied
                  ? `Case occupée par ${cell === 1 ? playerOneLabel : playerTwoLabel}`
                  : activeGame.gameType === "connect_four"
                    ? `Jouer dans la colonne ${column + 1}`
                    : `Jouer dans la case ${index + 1}`;

                return (
                  <button
                    key={index}
                    type="button"
                    role="gridcell"
                    className={`connect-four-cell multiplayer-board__cell player-${cell}`}
                    onClick={() => playMove(move)}
                    disabled={disabled}
                    aria-label={cellLabel}
                  >
                    <span aria-hidden="true">
                      {activeGame.gameType === "tic_tac_toe" && occupied ? (cell === 1 ? "×" : "○") : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="connect-four-legend multiplayer-game__legend" aria-label="Joueurs">
              <span><i className="player-one" aria-hidden="true" /> {playerOneLabel}</span>
              <span><i className="player-two" aria-hidden="true" /> {playerTwoLabel}</span>
            </div>
          </div>

          <GameConversationPanel
            conversationId={activeGame.conversationId}
            accountId={child.id}
            opponentName={opponentName}
          />
        </div>
      )}

      {error && <p className="game-error" role="alert">{error}</p>}
      {isConfirmingStop && canStopGame ? (
        <section className="multiplayer-stop-confirmation" aria-labelledby="multiplayer-stop-title">
          <div>
            <strong id="multiplayer-stop-title">Arrêter cette partie ?</strong>
            <small>
              {activeGame.status === "pending"
                ? "L’invitation sera annulée pour vous deux."
                : "Elle ne pourra plus être reprise, et aucun gagnant ne sera choisi."}
            </small>
          </div>
          <div>
            <button type="button" onClick={() => setIsConfirmingStop(false)} disabled={busy}>Garder la partie</button>
            <button type="button" onClick={() => void stopGame()} disabled={busy}>{busy ? "Arrêt…" : "Oui, arrêter"}</button>
          </div>
        </section>
      ) : (
        <div className="multiplayer-game__footer-actions">
          <button
            type="button"
            className="game-back-lobby multiplayer-game__back"
            onClick={() => {
              if (canReturnToConversation) {
                onExitToConversation(activeGame.conversationId);
                return;
              }
              setSelectedGameType(activeGame.gameType);
              setActiveGameId(null);
              setError("");
              setNotice("");
            }}
          >
            {canReturnToConversation ? `Retour à la conversation avec ${opponentName}` : "Voir les invitations et parties"}
          </button>
          {canStopGame && (
            <button
              type="button"
              className="multiplayer-game__stop"
              onClick={() => {
                setIsConfirmingStop(true);
                setError("");
              }}
            >
              <X size={16} weight="bold" aria-hidden="true" />
              Arrêter la partie
            </button>
          )}
        </div>
      )}
    </div>
  );
}
