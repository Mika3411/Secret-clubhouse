import { useEffect, useRef } from "react";

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

export default function PhaserMemoryGame({ onComplete }) {
  const hostRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let game;
    let cancelled = false;

    import("phaser").then(({ default: Phaser }) => {
      if (cancelled || !hostRef.current) return;

      class MemoryScene extends Phaser.Scene {
        create() {
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

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: 300,
        height: 350,
        transparent: true,
        scene: MemoryScene,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true, pixelArt: false },
        audio: { noAudio: true },
      });
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  return <div className="phaser-memory-game" ref={hostRef} aria-label="Jeu de Memory, retrouve les six paires" />;
}
