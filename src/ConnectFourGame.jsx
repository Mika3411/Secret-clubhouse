import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, GameController, PaperPlaneTilt, ShieldCheck, X } from "@phosphor-icons/react";
import { api } from "./api";

const EMPTY_BOARD = Array(42).fill(0);

function normalizeGame(game) {
  return {
    ...game,
    playerOneId: game.playerOneId ?? game.player_one_id,
    playerTwoId: game.playerTwoId ?? game.player_two_id,
    playerOneName: game.playerOneName ?? game.player_one_name,
    playerTwoName: game.playerTwoName ?? game.player_two_name,
    currentPlayerId: game.currentPlayerId ?? game.current_player_id,
    winnerId: game.winnerId ?? game.winner_id,
    invitedBy: game.invitedBy ?? game.invited_by,
    board: Array.isArray(game.board) ? game.board : EMPTY_BOARD,
  };
}

export default function ConnectFourGame({ child, onComplete }) {
  const [games, setGames] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [activeGameId, setActiveGameId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const awardedRef = useRef(new Set());
  const activeGame = games.find((game) => game.id === activeGameId) ?? games.find((game) => game.status === "active") ?? null;
  const pendingInvites = games.filter((game) => game.status === "pending" && game.playerTwoId === child.id);

  const refreshGames = async () => {
    try {
      const result = await api.games();
      setGames(result.games.map(normalizeGame));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const refreshContacts = async () => {
    try {
      const result = await api.gameContacts();
      setContacts(result.contacts);
      setSelectedContactId((current) => result.contacts.some((contact) => contact.contactId === current) ? current : result.contacts[0]?.contactId ?? "");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    refreshGames();
    refreshContacts();
    const timer = window.setInterval(refreshGames, 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeGame?.status === "completed" && activeGame.winnerId === child.id && !awardedRef.current.has(activeGame.id)) {
      awardedRef.current.add(activeGame.id);
      onComplete?.();
    }
  }, [activeGame, child.id, onComplete]);

  const opponentName = useMemo(() => {
    if (!activeGame) return "ton ami";
    return activeGame.playerOneId === child.id ? activeGame.playerTwoName : activeGame.playerOneName;
  }, [activeGame, child.id]);

  const invite = async () => {
    const contact = contacts.find((item) => item.contactId === selectedContactId);
    if (!contact) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.inviteGame(contact.contactId);
      const game = normalizeGame(result.game);
      setGames((current) => [game, ...current]);
      setActiveGameId(game.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (game, action) => {
    setBusy(true);
    try {
      const result = await api.respondToGame(game.id, action);
      const updated = normalizeGame(result.game);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (action === "accept") setActiveGameId(updated.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const playColumn = async (column) => {
    if (!activeGame || activeGame.status !== "active" || activeGame.currentPlayerId !== child.id || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.playGameMove(activeGame.id, column);
      const updated = normalizeGame(result.game);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!activeGame) return <div className="connect-four-lobby">
    <span className="connect-four-lobby__icon"><GameController size={32} weight="fill" /></span>
    <h3>Choisis ton adversaire</h3>
    <p>Choisis un ami ou un adulte autorisé de ta famille.</p>
    {pendingInvites.map((game) => <div className="game-invite" key={game.id}><span><strong>{game.playerOneName}</strong><small>t’invite à jouer</small></span><button type="button" onClick={() => respond(game, "decline")} aria-label={`Refuser l’invitation de ${game.playerOneName}`}><X size={17} /></button><button type="button" onClick={() => respond(game, "accept")} aria-label={`Accepter l’invitation de ${game.playerOneName}`}><CheckCircle size={18} weight="fill" /></button></div>)}
    <div className="game-contact-picker">{contacts.map((contact) => <button key={contact.contactId} type="button" className={selectedContactId === contact.contactId ? "is-selected" : ""} onClick={() => setSelectedContactId(contact.contactId)}><span>{contact.name}</span>{contact.role === "parent" && <small>Adulte</small>}</button>)}</div>
    {contacts.length ? <button className="clubhouse-modal__primary" type="button" onClick={invite} disabled={busy}><PaperPlaneTilt size={18} weight="fill" /> {busy ? "Invitation…" : "Inviter à jouer"}</button> : <p className="game-empty-contacts"><ShieldCheck size={17} weight="fill" /> Ajoute un contact approuvé ou demande à un adulte de rejoindre ta famille.</p>}
    {error && <p className="game-error" role="alert">{error}</p>}
  </div>;

  const myTurn = activeGame.status === "active" && activeGame.currentPlayerId === child.id;
  const waitingInvite = activeGame.status === "pending";
  return <div className="connect-four-game">
    <div className="connect-four-status"><strong>{child.name} contre {opponentName}</strong><span>{waitingInvite ? `Invitation envoyée à ${opponentName}` : activeGame.status === "completed" ? (activeGame.winnerId === child.id ? "Bravo, tu as gagné !" : activeGame.winnerId ? `${opponentName} a gagné` : "Match nul") : myTurn ? "À toi de jouer" : `Au tour de ${opponentName}`}</span></div>
    <div className="connect-four-board" aria-label="Grille de Puissance 4">{activeGame.board.map((cell, index) => <button key={index} type="button" className={`connect-four-cell player-${cell}`} onClick={() => playColumn(index % 7)} disabled={!myTurn || busy || Boolean(activeGame.board[index % 7])} aria-label={`Jouer dans la colonne ${(index % 7) + 1}`}><span /></button>)}</div>
    <div className="connect-four-legend"><span><i className="player-one" /> Toi</span><span><i className="player-two" /> {opponentName}</span></div>
    {error && <p className="game-error" role="alert">{error}</p>}
    <button type="button" className="game-back-lobby" onClick={() => setActiveGameId(null)}>Voir les invitations et parties</button>
  </div>;
}
