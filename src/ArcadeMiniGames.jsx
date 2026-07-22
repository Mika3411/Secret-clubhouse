import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Star } from "@phosphor-icons/react";

export function TicTacToeGame({ onComplete }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [status, setStatus] = useState("À toi de jouer");
  const [finished, setFinished] = useState(false);
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = (cells, mark) => lines.some((line) => line.every((index) => cells[index] === mark));

  const play = (index) => {
    if (finished || board[index]) return;
    const next = [...board];
    next[index] = "X";
    if (winner(next, "X")) {
      setBoard(next); setStatus("Tu as gagné !"); setFinished(true); return;
    }
    const empty = next.map((value, position) => value ? null : position).filter((value) => value !== null);
    if (!empty.length) { setBoard(next); setStatus("Égalité, bien joué !"); setFinished(true); return; }
    const winningMove = empty.find((position) => { const test = [...next]; test[position] = "O"; return winner(test, "O"); });
    const blockingMove = empty.find((position) => { const test = [...next]; test[position] = "X"; return winner(test, "X"); });
    const botMove = winningMove ?? blockingMove ?? (empty.includes(4) ? 4 : empty[Math.floor(Math.random() * empty.length)]);
    next[botMove] = "O";
    setBoard(next);
    if (winner(next, "O")) { setStatus("Clubbot gagne cette manche"); setFinished(true); }
    else if (next.every(Boolean)) { setStatus("Égalité, bien joué !"); setFinished(true); }
  };

  return <div className="arcade-game"><div className="arcade-status"><strong>{status}</strong><small>Tu joues avec les croix</small></div><div className="tic-tac-toe" role="grid" aria-label="Grille de morpion">{board.map((value, index) => <button key={index} type="button" role="gridcell" onClick={() => play(index)} aria-label={`Case ${index + 1}${value ? `, ${value}` : ""}`} disabled={Boolean(value) || finished}>{value}</button>)}</div>{finished && <div className="arcade-actions"><button type="button" onClick={() => { setBoard(Array(9).fill(null)); setFinished(false); setStatus("À toi de jouer"); }}>Rejouer</button><button type="button" className="is-primary" onClick={onComplete}><CheckCircle size={18} weight="fill" /> Terminer</button></div>}</div>;
}

const solvedTiles = [1,2,3,4,5,6,7,8,0];
const shuffleTiles = () => {
  const tiles = [...solvedTiles];
  for (let round = 0; round < 80; round += 1) {
    const empty = tiles.indexOf(0);
    const row = Math.floor(empty / 3); const col = empty % 3;
    const moves = [empty - 3, empty + 3, col > 0 ? empty - 1 : -1, col < 2 ? empty + 1 : -1].filter((index) => index >= 0 && index < 9 && Math.abs(Math.floor(index / 3) - row) <= 1);
    const target = moves[Math.floor(Math.random() * moves.length)];
    [tiles[empty], tiles[target]] = [tiles[target], tiles[empty]];
  }
  return tiles.join() === solvedTiles.join() ? shuffleTiles() : tiles;
};

export function SlidingPuzzleGame({ onComplete }) {
  const [tiles, setTiles] = useState(shuffleTiles);
  const [moves, setMoves] = useState(0);
  const solved = tiles.join() === solvedTiles.join();
  const move = (index) => {
    if (solved) return;
    const empty = tiles.indexOf(0); const row = Math.floor(index / 3); const emptyRow = Math.floor(empty / 3);
    const adjacent = Math.abs(index - empty) === 3 || (row === emptyRow && Math.abs(index - empty) === 1);
    if (!adjacent) return;
    const next = [...tiles]; [next[index], next[empty]] = [next[empty], next[index]]; setTiles(next); setMoves((value) => value + 1);
  };
  return <div className="arcade-game"><div className="arcade-status"><strong>{solved ? "Puzzle terminé !" : "Remets les nombres dans l’ordre"}</strong><small>{moves} déplacement{moves > 1 ? "s" : ""}</small></div><div className="sliding-puzzle" role="grid" aria-label="Puzzle coulissant">{tiles.map((tile, index) => tile ? <button key={tile} type="button" role="gridcell" onClick={() => move(index)}>{tile}</button> : <span key="empty" role="gridcell" aria-label="Case vide" />)}</div>{solved && <div className="arcade-actions"><button type="button" onClick={() => { setTiles(shuffleTiles()); setMoves(0); }}>Rejouer</button><button type="button" className="is-primary" onClick={onComplete}><CheckCircle size={18} weight="fill" /> Terminer</button></div>}</div>;
}

const simonColors = ["mint", "violet", "coral", "sun"];
export function SimonGame({ onComplete }) {
  const [sequence, setSequence] = useState([]);
  const [input, setInput] = useState([]);
  const [lit, setLit] = useState(null);
  const [phase, setPhase] = useState("ready");
  const [round, setRound] = useState(0);
  const timers = useRef([]);
  const clearTimers = () => timers.current.forEach((timer) => window.clearTimeout(timer));
  useEffect(() => clearTimers, []);

  const showSequence = (next) => {
    clearTimers(); setPhase("watch"); setInput([]);
    next.forEach((color, index) => {
      timers.current.push(window.setTimeout(() => setLit(color), 450 + index * 650));
      timers.current.push(window.setTimeout(() => setLit(null), 850 + index * 650));
    });
    timers.current.push(window.setTimeout(() => setPhase("play"), 500 + next.length * 650));
  };
  const nextRound = () => {
    const next = [...sequence, simonColors[Math.floor(Math.random() * simonColors.length)]];
    setSequence(next); setRound(next.length); showSequence(next);
  };
  const press = (color) => {
    if (phase !== "play") return;
    const nextInput = [...input, color]; setInput(nextInput); setLit(color); timers.current.push(window.setTimeout(() => setLit(null), 180));
    if (sequence[nextInput.length - 1] !== color) { setPhase("ready"); setSequence([]); setRound(0); return; }
    if (nextInput.length === sequence.length) {
      if (sequence.length >= 5) { setPhase("won"); return; }
      setPhase("watch"); timers.current.push(window.setTimeout(nextRound, 650));
    }
  };
  return <div className="arcade-game"><div className="arcade-status"><strong>{phase === "ready" ? (round ? "Oups, recommence !" : "Mémorise les lumières") : phase === "watch" ? "Regarde bien…" : phase === "won" ? "Séquence réussie !" : "À ton tour"}</strong><small>Manche {Math.max(round, 1)} sur 5</small></div><div className="simon-board">{simonColors.map((color) => <button key={color} type="button" className={`simon-${color} ${lit === color ? "is-lit" : ""}`} onClick={() => press(color)} disabled={phase !== "play"} aria-label={`Couleur ${color}`} />)}</div>{phase === "ready" && <button type="button" className="arcade-start" onClick={nextRound}>Commencer</button>}{phase === "won" && <div className="arcade-actions"><button type="button" onClick={() => { setSequence([]); setRound(0); setPhase("ready"); }}>Rejouer</button><button type="button" className="is-primary" onClick={onComplete}><CheckCircle size={18} weight="fill" /> Terminer</button></div>}</div>;
}

export function StarCatchGame({ onComplete }) {
  const [active, setActive] = useState(4);
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(20);
  const done = score >= 12 || seconds === 0;
  useEffect(() => {
    if (done) return undefined;
    const targetTimer = window.setInterval(() => setActive(Math.floor(Math.random() * 12)), 620);
    const clockTimer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => { window.clearInterval(targetTimer); window.clearInterval(clockTimer); };
  }, [done]);
  const catchStar = (index) => { if (!done && index === active) { setScore((value) => value + 1); setActive(Math.floor(Math.random() * 12)); } };
  return <div className="arcade-game"><div className="arcade-status"><strong>{score >= 12 ? "Toutes les étoiles sont attrapées !" : seconds === 0 ? "Temps écoulé !" : "Attrape 12 étoiles"}</strong><small>{score}/12 · {seconds} s</small></div><div className="star-catch" aria-label="Terrain d’attrape-étoiles">{Array.from({ length: 12 }, (_, index) => <button key={index} type="button" onClick={() => catchStar(index)} aria-label={index === active ? "Attraper l’étoile" : "Case vide"}>{index === active && <Star size={29} weight="fill" />}</button>)}</div>{done && <div className="arcade-actions"><button type="button" onClick={() => { setScore(0); setSeconds(20); setActive(4); }}>Rejouer</button><button type="button" className="is-primary" onClick={onComplete}><CheckCircle size={18} weight="fill" /> Terminer</button></div>}</div>;
}
