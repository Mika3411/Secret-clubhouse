import { useEffect, useMemo, useRef, useState } from "react";

const CARD_SYMBOLS = ["★", "●", "▲", "◆", "♥", "✦"];
const CARD_COLORS = [0xffd66b, 0x76e2c3, 0xff8fb5, 0x8fb8ff, 0xb69cff, 0xffa873];

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function CompatibleMemoryGame({ onComplete }) {
  const deck = useMemo(() => shuffle(CARD_SYMBOLS.flatMap((symbol, pairIndex) => [
    { id: `${pairIndex}-a`, symbol, pairIndex },
    { id: `${pairIndex}-b`, symbol, pairIndex },
  ])), []);
  const [openCards, setOpenCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const completionSentRef = useRef(false);
  const closeCardsTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(closeCardsTimerRef.current), []);

  useEffect(() => {
    if (matchedPairs.length !== CARD_SYMBOLS.length || completionSentRef.current) return undefined;
    completionSentRef.current = true;
    const completionTimer = window.setTimeout(() => onComplete?.(), 350);
    return () => window.clearTimeout(completionTimer);
  }, [matchedPairs, onComplete]);

  const revealCard = (index) => {
    const card = deck[index];
    if (locked || openCards.includes(index) || matchedPairs.includes(card.pairIndex)) return;
    const nextOpenCards = [...openCards, index];
    setOpenCards(nextOpenCards);
    if (nextOpenCards.length < 2) return;

    setMoves((current) => current + 1);
    const [firstIndex, secondIndex] = nextOpenCards;
    if (deck[firstIndex].pairIndex === deck[secondIndex].pairIndex) {
      setMatchedPairs((current) => [...current, card.pairIndex]);
      setOpenCards([]);
      return;
    }

    setLocked(true);
    closeCardsTimerRef.current = window.setTimeout(() => {
      setOpenCards([]);
      setLocked(false);
    }, 650);
  };

  return (
    <div className="compatible-memory" aria-label="Jeu de Memory, retrouve les six paires">
      <strong>Retrouve les 6 paires</strong>
      <span>{matchedPairs.length} paire{matchedPairs.length > 1 ? "s" : ""} · {moves} essai{moves > 1 ? "s" : ""}</span>
      <div className="compatible-memory__grid">
        {deck.map((card, index) => {
          const isVisible = openCards.includes(index) || matchedPairs.includes(card.pairIndex);
          return (
            <button
              type="button"
              key={card.id}
              className={`${isVisible ? "is-visible" : ""} ${matchedPairs.includes(card.pairIndex) ? "is-matched" : ""}`}
              onClick={() => revealCard(index)}
              disabled={locked || matchedPairs.includes(card.pairIndex)}
              aria-label={isVisible ? `Carte ${card.symbol}` : "Carte cachée"}
              aria-pressed={isVisible}
              style={isVisible ? { "--memory-card-color": `#${CARD_COLORS[card.pairIndex].toString(16).padStart(6, "0")}` } : undefined}
            >
              <span>{isVisible ? card.symbol : "?"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PhaserMemoryGame({ onComplete }) {
  const hostRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let game;
    let cancelled = false;
    let fallbackTimer;

    const useCompatibleGame = () => {
      if (cancelled) return;
      game?.destroy(true);
      game = undefined;
      setStatus("fallback");
    };

    import("phaser/dist/phaser-arcade-physics.min.js").then((phaserModule) => {
      const Phaser = phaserModule.default ?? phaserModule.Phaser ?? window.Phaser;
      if (!Phaser) {
        useCompatibleGame();
        return;
      }
      if (cancelled || !hostRef.current) return;

      class MemoryScene extends Phaser.Scene {
        create() {
          if (cancelled) return;
          this.cameras.main.setBackgroundColor("#f7f4ff");
          this.add.text(150, 23, "Retrouve les 6 paires", {
            fontFamily: "Nunito, sans-serif",
            fontSize: "18px",
            fontStyle: "bold",
            color: "#120966",
          }).setOrigin(0.5);

          this.moves = 0;
          this.matchedPairs = 0;
          this.openCards = [];
          this.locked = false;
          this.statusText = this.add.text(150, 52, "0 paire · 0 essai", {
            fontFamily: "Nunito, sans-serif",
            fontSize: "12px",
            color: "#716b80",
          }).setOrigin(0.5);

          const deck = shuffle(CARD_SYMBOLS.flatMap((symbol, pairIndex) => [
            { symbol, pairIndex },
            { symbol, pairIndex },
          ]));

          deck.forEach((card, index) => {
            const column = index % 4;
            const row = Math.floor(index / 4);
            this.createCard(45 + column * 70, 102 + row * 78, card);
          });
          window.clearTimeout(fallbackTimer);
          setStatus("ready");
        }

        createCard(x, y, data) {
          const container = this.add.container(x, y);
          const face = this.add.rectangle(0, 0, 58, 66, CARD_COLORS[data.pairIndex], 1).setStrokeStyle(2, 0xffffff);
          const symbol = this.add.text(0, 1, data.symbol, {
            fontFamily: "Arial, sans-serif",
            fontSize: "30px",
            fontStyle: "bold",
            color: "#120966",
          }).setOrigin(0.5);
          const cover = this.add.rectangle(0, 0, 58, 66, 0x6549ce, 1).setStrokeStyle(2, 0xffffff);
          const question = this.add.text(0, 0, "?", {
            fontFamily: "Nunito, sans-serif",
            fontSize: "25px",
            fontStyle: "bold",
            color: "#dffff5",
          }).setOrigin(0.5);

          container.add([face, symbol, cover, question]);
          container.setSize(58, 66).setInteractive({ useHandCursor: true });
          container.cardData = data;
          container.cover = cover;
          container.question = question;
          container.isOpen = false;
          container.isMatched = false;
          container.on("pointerdown", () => this.revealCard(container));
        }

        revealCard(card) {
          if (this.locked || card.isOpen || card.isMatched) return;
          card.isOpen = true;
          card.cover.setVisible(false);
          card.question.setVisible(false);
          this.tweens.add({ targets: card, scaleX: 1.06, scaleY: 1.06, duration: 90, yoyo: true });
          this.openCards.push(card);
          if (this.openCards.length !== 2) return;

          this.moves += 1;
          const [first, second] = this.openCards;
          if (first.cardData.pairIndex === second.cardData.pairIndex) {
            first.isMatched = true;
            second.isMatched = true;
            this.openCards = [];
            this.matchedPairs += 1;
            this.statusText.setText(`${this.matchedPairs} paire${this.matchedPairs > 1 ? "s" : ""} · ${this.moves} essai${this.moves > 1 ? "s" : ""}`);
            if (this.matchedPairs === CARD_SYMBOLS.length) {
              this.time.delayedCall(350, () => onCompleteRef.current?.());
            }
            return;
          }

          this.locked = true;
          this.time.delayedCall(650, () => {
            [first, second].forEach((openCard) => {
              openCard.isOpen = false;
              openCard.cover.setVisible(true);
              openCard.question.setVisible(true);
            });
            this.openCards = [];
            this.locked = false;
            this.statusText.setText(`${this.matchedPairs} paire${this.matchedPairs > 1 ? "s" : ""} · ${this.moves} essai${this.moves > 1 ? "s" : ""}`);
          });
        }
      }

      try {
        game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: hostRef.current,
          width: 300,
          height: 350,
          transparent: false,
          backgroundColor: "#f7f4ff",
          scene: MemoryScene,
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          render: { antialias: true, pixelArt: false, roundPixels: true },
          audio: { noAudio: true },
        });
      } catch {
        useCompatibleGame();
      }
    }).catch(useCompatibleGame);

    fallbackTimer = window.setTimeout(useCompatibleGame, 7000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      game?.destroy(true);
    };
  }, []);

  return (
    <div className={`phaser-memory-game phaser-memory-game--${status}`}>
      {status !== "fallback" && <div className="phaser-memory-game__host" ref={hostRef} aria-label="Jeu de Memory, retrouve les six paires" />}
      {status === "loading" && <div className="phaser-memory-game__loading" role="status"><span /><strong>Préparation du jeu…</strong></div>}
      {status === "fallback" && <CompatibleMemoryGame onComplete={onComplete} />}
    </div>
  );
}
