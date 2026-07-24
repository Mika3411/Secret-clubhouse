import { useEffect, useMemo, useRef, useState } from "react";
import { Anchor } from "@phosphor-icons/react/Anchor";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { GameController } from "@phosphor-icons/react/GameController";
import { GridFour } from "@phosphor-icons/react/GridFour";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { X } from "@phosphor-icons/react/X";
import { api } from "./api";

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
  if (game.status === "completed") {
    if (!game.winnerId) return "Match nul";
    return game.winnerId === accountId ? "Bravo, tu as gagné !" : `${opponentName} a gagné`;
  }
  return game.currentPlayerId === accountId ? "À toi de jouer" : `Au tour de ${opponentName}`;
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

export default function ConnectFourGame({ child, onComplete }) {
  const [games, setGames] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedGameType, setSelectedGameType] = useState(DEFAULT_GAME_TYPE);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [activeGameId, setActiveGameId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const awardedRef = useRef(new Set());

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
    if (
      activeGame?.status === "completed"
      && activeGame.winnerId === child.id
      && !awardedRef.current.has(activeGame.id)
    ) {
      awardedRef.current.add(activeGame.id);
      onComplete?.();
    }
  }, [activeGame, child.id, onComplete]);

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
  };

  const invite = async () => {
    const contact = contacts.find((item) => item.contactId === selectedContactId);
    if (!contact) return;
    setBusy(true);
    setError("");
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

        {error && <p className="game-error" role="alert">{error}</p>}
      </div>
    );
  }

  const gameType = GAME_TYPES[activeGame.gameType];
  const myTurn = activeGame.status === "active" && activeGame.currentPlayerId === child.id;
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
        <NavalBattleBoards
          board={activeGame.board}
          myTurn={myTurn}
          busy={busy}
          onPlayMove={playMove}
        />
      ) : (
        <>
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
        </>
      )}

      {error && <p className="game-error" role="alert">{error}</p>}
      <button
        type="button"
        className="game-back-lobby multiplayer-game__back"
        onClick={() => {
          setSelectedGameType(activeGame.gameType);
          setActiveGameId(null);
          setError("");
        }}
      >
        Voir les invitations et parties
      </button>
    </div>
  );
}
