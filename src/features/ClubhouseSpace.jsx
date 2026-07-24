import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { BookOpen } from "@phosphor-icons/react/BookOpen";
import { Brain } from "@phosphor-icons/react/Brain";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Crown } from "@phosphor-icons/react/Crown";
import { Flag } from "@phosphor-icons/react/Flag";
import { GameController } from "@phosphor-icons/react/GameController";
import { Gift } from "@phosphor-icons/react/Gift";
import { Handshake } from "@phosphor-icons/react/Handshake";
import { Heart } from "@phosphor-icons/react/Heart";
import { House } from "@phosphor-icons/react/House";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { MusicNotes } from "@phosphor-icons/react/MusicNotes";
import { PaintBrush } from "@phosphor-icons/react/PaintBrush";
import { Palette } from "@phosphor-icons/react/Palette";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { PuzzlePiece } from "@phosphor-icons/react/PuzzlePiece";
import { Scissors } from "@phosphor-icons/react/Scissors";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { Star } from "@phosphor-icons/react/Star";
import { Timer } from "@phosphor-icons/react/Timer";
import { Trophy } from "@phosphor-icons/react/Trophy";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { X } from "@phosphor-icons/react/X";
import { api } from "../api";
import PhaserMemoryGame from "../PhaserMemoryGame";
import ConnectFourGame from "../ConnectFourGame";
import "../styles/clubhouse.css";

export const clubhouseActivities = [
  {
    id: "color-hunt",
    type: "challenge",
    title: "La chasse aux couleurs",
    description: "Trouve cinq objets de couleurs différentes autour de toi.",
    duration: 5,
    Icon: Sparkle,
    tone: "mint",
    partner: "solo",
    steps: ["Choisis cinq couleurs", "Trouve un objet pour chaque couleur", "Raconte ta meilleure trouvaille à un ami"],
  },
  {
    id: "one-line-drawing",
    type: "challenge",
    title: "Dessin en un trait",
    description: "Dessine un animal sans lever ton crayon.",
    duration: 4,
    Icon: PencilSimple,
    tone: "violet",
    partner: "solo",
    steps: ["Choisis ton animal", "Pose ton crayon et ne le lève plus", "Ajoute un nom rigolo à ton dessin"],
  },
  {
    id: "mystery-mime",
    type: "challenge",
    title: "Le mime mystère",
    description: "Fais deviner une activité sans prononcer un mot.",
    duration: 6,
    Icon: UsersThree,
    tone: "coral",
    partner: "together",
    steps: ["Choisis une activité secrète", "Mime-la pendant trente secondes", "Laisse les autres proposer une réponse"],
  },
  {
    id: "three-word-story",
    type: "challenge",
    title: "L’histoire en trois mots",
    description: "Invente une mini-aventure à partir de trois mots surprises.",
    duration: 7,
    Icon: BookOpen,
    tone: "violet",
    partner: "solo",
    steps: ["Choisis trois mots au hasard", "Imagine un début, un problème et une fin", "Donne un titre à ton aventure"],
  },
  {
    id: "paper-creature",
    type: "challenge",
    title: "Créature de papier",
    description: "Plie et découpe une créature que personne n’a encore vue.",
    duration: 10,
    Icon: Scissors,
    tone: "mint",
    partner: "solo",
    steps: ["Prends une feuille et plie-la", "Découpe une silhouette avec un adulte si besoin", "Ajoute un nom et un super-pouvoir"],
  },
  {
    id: "sound-inventor",
    type: "challenge",
    title: "Inventeur de sons",
    description: "Compose un rythme avec trois objets du quotidien.",
    duration: 6,
    Icon: MusicNotes,
    tone: "blue",
    partner: "solo",
    steps: ["Choisis trois objets qui font des sons différents", "Crée un rythme de dix secondes", "Joue-le deux fois sans t’arrêter"],
  },
  {
    id: "kindness-mission",
    type: "challenge",
    title: "Mission gentillesse",
    description: "Prépare une petite surprise positive pour quelqu’un que tu connais.",
    duration: 8,
    Icon: Heart,
    tone: "sun",
    partner: "together",
    steps: ["Choisis un ami ou un membre de ta famille", "Imagine un mot ou un geste qui lui fera plaisir", "Offre ta surprise sans attendre de récompense"],
  },
  {
    id: "family-time-capsule",
    type: "challenge",
    title: "Capsule de famille",
    description: "Crée avec un parent un souvenir à rouvrir plus tard.",
    duration: 12,
    Icon: Flag,
    tone: "violet",
    partner: "together",
    steps: ["Choisissez ensemble un souvenir de la semaine", "Écrivez ou dessinez-le", "Fixez une date pour le redécouvrir"],
  },
  {
    id: "friend-collage",
    type: "challenge",
    title: "Collage à quatre mains",
    description: "Crée une œuvre avec un ami, chacun son tour.",
    duration: 12,
    Icon: PaintBrush,
    tone: "mint",
    partner: "together",
    steps: ["Choisissez une feuille et deux couleurs chacun", "Ajoutez un élément à tour de rôle", "Trouvez ensemble le titre de l’œuvre"],
  },
  {
    id: "secret-handshake",
    type: "challenge",
    title: "Salut secret",
    description: "Invente un enchaînement rigolo avec un ami ou un parent.",
    duration: 5,
    Icon: Handshake,
    tone: "coral",
    partner: "together",
    steps: ["Choisissez trois gestes simples", "Enchaînez-les lentement", "Réussissez le salut deux fois de suite"],
  },
  {
    id: "cozy-corner",
    type: "challenge",
    title: "Coin douillet",
    description: "Imagine un petit coin calme avec ce que tu as déjà chez toi.",
    duration: 9,
    Icon: House,
    tone: "sun",
    partner: "solo",
    steps: ["Choisis un endroit autorisé", "Ajoute deux objets confortables", "Installe-toi une minute et donne un nom à ce coin"],
  },
  {
    id: "comic-four-panels",
    type: "challenge",
    title: "BD en quatre cases",
    description: "Raconte une aventure complète en seulement quatre dessins.",
    duration: 12,
    Icon: PencilSimple,
    tone: "blue",
    partner: "solo",
    steps: ["Trace quatre cases", "Dessine le héros et son problème", "Termine par une surprise dans la dernière case"],
  },
  {
    id: "multiplayer-games",
    type: "game",
    multiplayer: true,
    variant: "multiplayer",
    title: "Jeux multijoueurs",
    description: "Invite un contact approuvé à Puissance 4, au Morpion ou à la Bataille navale.",
    duration: 8,
    Icon: UsersThree,
    tone: "blue",
    partner: "together",
  },
  {
    id: "memory-pairs",
    type: "game",
    variant: "memory",
    title: "Memory des symboles",
    description: "Retourne les cartes et retrouve les six paires.",
    duration: 4,
    Icon: GameController,
    tone: "violet",
    partner: "solo",
  },
  {
    id: "nature-quiz",
    type: "game",
    title: "Quiz des animaux",
    description: "Teste tes connaissances avec trois nouvelles questions à chaque partie.",
    duration: 3,
    Icon: Brain,
    tone: "sun",
    partner: "solo",
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
    Icon: PuzzlePiece,
    tone: "blue",
    partner: "solo",
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

export const clubhouseActivityById = new Map(clubhouseActivities.map((activity) => [activity.id, activity]));

export const clubhouseCatalogStatusCopy = {
  empty: "Bientôt disponible",
  new: "Tout est à découvrir",
  in_progress: "Continue, tu avances !",
  complete: "Catalogue terminé !",
};

export function ClubhouseScreen({ child }) {
  const [filter, setFilter] = useState("all");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [phase, setPhase] = useState("intro");
  const [clubhouse, setClubhouse] = useState(null);
  const [clubhouseError, setClubhouseError] = useState("");
  const [isClubhouseLoading, setIsClubhouseLoading] = useState(true);
  const [isCompletionSaving, setIsCompletionSaving] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [rewardEarned, setRewardEarned] = useState(false);
  const [awardedReward, setAwardedReward] = useState(0);
  const [unlockEarned, setUnlockEarned] = useState(null);
  const [appearanceSavingId, setAppearanceSavingId] = useState("");
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const questionDecksRef = useRef({});
  const completionPendingRef = useRef(false);
  const currentQuestion = sessionQuestions[questionIndex] ?? null;
  const serverActivityById = useMemo(
    () => new Map((clubhouse?.catalog ?? []).map((activity) => [activity.activityId, activity])),
    [clubhouse?.catalog],
  );
  const availableActivities = useMemo(
    () => (clubhouse?.catalog ?? [])
      .map((serverActivity) => clubhouseActivityById.get(serverActivity.activityId))
      .filter(Boolean),
    [clubhouse?.catalog],
  );
  const dailyChallenge = clubhouse?.dailyChallenge ?? null;
  const featuredActivity = availableActivities.find((activity) => activity.id === dailyChallenge?.activityId);
  const visibleActivities = availableActivities.filter((activity) => (
    filter === "all"
    || (filter === "together" ? activity.partner === "together" : activity.type === filter)
  ));
  const summary = clubhouse?.summary;
  const stars = summary?.totalStars ?? 0;
  const streak = summary?.streak ?? {
    personalDays: summary?.currentStreakDays ?? 0,
    protectedDaysRemaining: 0,
    protectedDaysUsed: 0,
  };
  const unlockedRewards = clubhouse?.unlockedRewards ?? [];
  const equippedReward = clubhouse?.equippedReward ?? null;
  const rotation = clubhouse?.rotation ?? null;
  const catalogProgress = summary?.catalog ?? {
    completedCount: 0,
    totalActivities: 0,
    percent: 0,
    status: "empty",
  };
  const activityProgress = (activityId) => serverActivityById.get(activityId);

  const loadClubhouse = async () => {
    setIsClubhouseLoading(true);
    setClubhouseError("");
    try {
      const result = await api.clubhouse();
      setClubhouse(result.clubhouse);
    } catch {
      setClubhouseError("Le Clubhouse fait une petite pause. Réessaie dans un moment.");
    } finally {
      setIsClubhouseLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    setIsClubhouseLoading(true);
    setClubhouseError("");
    api.clubhouse()
      .then((result) => {
        if (isCurrent) setClubhouse(result.clubhouse);
      })
      .catch(() => {
        if (isCurrent) setClubhouseError("Le Clubhouse fait une petite pause. Réessaie dans un moment.");
      })
      .finally(() => {
        if (isCurrent) setIsClubhouseLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [child.id]);

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
    setAwardedReward(0);
    setUnlockEarned(null);
    setClubhouseError("");
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

  const completeActivity = async () => {
    if (!selectedActivity || completionPendingRef.current) return;
    completionPendingRef.current = true;
    setIsCompletionSaving(true);
    setClubhouseError("");
    try {
      const result = await api.completeClubhouseActivity(selectedActivity.id);
      setClubhouse(result.clubhouse);
      setRewardEarned(Boolean(result.rewardEarned));
      setAwardedReward(Number(result.reward) || 0);
      setUnlockEarned(result.unlockEarned ?? null);
      setPhase("complete");
    } catch {
      setClubhouseError("Ton activité est bien terminée, mais elle n’a pas encore pu être enregistrée. Réessaie dans un moment.");
    } finally {
      completionPendingRef.current = false;
      setIsCompletionSaving(false);
    }
  };

  const equipReward = async (unlockId) => {
    if (!unlockId || appearanceSavingId) return;
    setAppearanceSavingId(unlockId);
    setClubhouseError("");
    try {
      const result = await api.updateClubhouseAppearance(unlockId);
      setClubhouse(result.clubhouse);
    } catch (error) {
      setClubhouseError(error.message || "Cette récompense ne peut pas être installée pour le moment.");
    } finally {
      setAppearanceSavingId("");
    }
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
  const RewardIcon = ({ kind, size = 18 }) => {
    if (kind === "color") return <Palette size={size} weight="fill" />;
    if (kind === "badge") return <Crown size={size} weight="fill" />;
    return <Gift size={size} weight="fill" />;
  };

  if (!clubhouse) {
    return (
      <section className="clubhouse-screen" aria-labelledby="clubhouse-title">
        <header className="clubhouse-header">
          <span className="clubhouse-header__icon"><House size={25} weight="fill" /></span>
          <div><span>Ton espace entre amis</span><h1 id="clubhouse-title">Le Clubhouse</h1></div>
          <span className="clubhouse-stars" aria-label="Total d’étoiles en cours de chargement"><Star size={18} weight="fill" /><span><strong>—</strong><small>au total</small></span></span>
        </header>
        <div className="clubhouse-state" role={clubhouseError ? "alert" : "status"}>
          <House size={30} weight="fill" />
          <strong>{clubhouseError || (isClubhouseLoading ? "Chargement de ta progression…" : "Ta progression est temporairement indisponible.")}</strong>
          {clubhouseError && <button type="button" onClick={loadClubhouse}>Réessayer</button>}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`clubhouse-screen${equippedReward ? " clubhouse-screen--personalized" : ""}`}
      style={equippedReward ? { "--clubhouse-accent": equippedReward.accent } : undefined}
      aria-labelledby="clubhouse-title"
    >
      <header className="clubhouse-header">
        <span className="clubhouse-header__icon"><House size={25} weight="fill" /></span>
        <div><span>Ton espace entre amis</span><h1 id="clubhouse-title">Le Clubhouse</h1></div>
        <span className="clubhouse-stars" aria-label={`${stars} étoiles gagnées depuis toujours`}><Star size={18} weight="fill" /><span><strong>{stars}</strong><small>depuis toujours</small></span></span>
      </header>

      <div className="clubhouse-content">
        {featuredActivity && (() => {
          const featuredProgress = activityProgress(featuredActivity.id);
          return (
            <button type="button" className="clubhouse-featured" onClick={() => openActivity(featuredActivity)}>
              <span className="clubhouse-featured__badge">{dailyChallenge?.completedToday ? "Réussi aujourd’hui" : "Défi du jour"}</span>
              <span className="clubhouse-featured__icon"><featuredActivity.Icon size={32} weight="fill" /></span>
              <span className="clubhouse-featured__copy">
                <strong>{featuredActivity.title}</strong>
                <small>{featuredActivity.description}</small>
                <span className="clubhouse-featured__meta">
                  <span><Timer size={14} weight="bold" /> {featuredActivity.duration} min</span>
                  <span className={dailyChallenge?.completedToday ? "is-earned" : ""}>
                    {dailyChallenge?.completedToday ? <CheckCircle size={14} weight="fill" /> : <Star size={14} weight="fill" />}
                    {dailyChallenge?.completedToday
                      ? "Le rendez-vous est réussi"
                      : featuredProgress?.completed
                        ? "Une nouvelle visite pour ta série"
                        : `${featuredProgress?.reward ?? 0} étoiles à gagner`}
                  </span>
                </span>
              </span>
              <span className={`clubhouse-featured__action${dailyChallenge?.completedToday ? " is-complete" : ""}`}>
                {dailyChallenge?.completedToday ? "Rejouer" : "Commencer"}
                {dailyChallenge?.completedToday ? <CheckCircle size={19} weight="fill" /> : <CaretRight size={18} weight="bold" />}
              </span>
            </button>
          );
        })()}

        <section className="clubhouse-welcome" aria-label="Progression du Clubhouse">
          <div className="clubhouse-welcome__intro">
            <span>Ta progression, {child.name}</span>
            <strong>Chaque activité compte</strong>
            {equippedReward && <small><Sparkle size={13} weight="fill" /> Ton Clubhouse porte {equippedReward.label}</small>}
          </div>
          <div className="clubhouse-summary" role="list" aria-label="Tes repères">
            <div className="clubhouse-summary__catalog" role="listitem">
              <span className="clubhouse-summary__label"><CheckCircle size={15} weight="fill" /> À découvrir</span>
              <strong>{catalogProgress.completedCount} sur {catalogProgress.totalActivities}</strong>
              <small>{clubhouseCatalogStatusCopy[catalogProgress.status] ?? "Progression enregistrée"}</small>
              <span className="clubhouse-progress" aria-label={`${catalogProgress.completedCount} activités terminées sur ${catalogProgress.totalActivities}`}>
                <span style={{ width: `${catalogProgress.percent}%` }} />
              </span>
            </div>
            <div className="clubhouse-streak" role="listitem">
              <span className="clubhouse-summary__label"><Lightning size={15} weight="fill" /> Ma série perso</span>
              <strong>{streak.personalDays} jour{streak.personalDays > 1 ? "s" : ""}</strong>
              <small>
                <ShieldCheck size={13} weight="fill" />
                {streak.protectedDaysRemaining > 0
                  ? `${streak.protectedDaysRemaining} jour${streak.protectedDaysRemaining > 1 ? "s" : ""} protégé${streak.protectedDaysRemaining > 1 ? "s" : ""}`
                  : "Chaque retour compte"}
              </small>
            </div>
          </div>
          {rotation && (
            <span className="clubhouse-rotation">
              <ArrowClockwise size={14} weight="bold" />
              De nouvelles activités arrivent dans {rotation.refreshesInDays} jour{rotation.refreshesInDays > 1 ? "s" : ""}
            </span>
          )}
        </section>

        {clubhouseError && <div className="clubhouse-state clubhouse-state--inline" role="alert"><strong>{clubhouseError}</strong><button type="button" onClick={loadClubhouse}>Resynchroniser</button></div>}

        <section className="clubhouse-collection" aria-labelledby="clubhouse-collection-title">
          <div className="clubhouse-collection__heading">
            <span><Gift size={19} weight="fill" /></span>
            <div>
              <small>Tes trouvailles</small>
              <h2 id="clubhouse-collection-title">Ma collection</h2>
            </div>
            <strong>{unlockedRewards.length}</strong>
          </div>
          {unlockedRewards.length > 0 ? (
            <div className="clubhouse-reward-list" role="list" aria-label="Récompenses débloquées">
              {unlockedRewards.map((reward) => {
                const isEquipped = equippedReward?.id === reward.id;
                return (
                  <button
                    type="button"
                    role="listitem"
                    className={isEquipped ? "is-equipped" : ""}
                    style={{ "--reward-accent": reward.accent }}
                    onClick={() => equipReward(reward.id)}
                    disabled={Boolean(appearanceSavingId)}
                    key={reward.id}
                  >
                    <span><RewardIcon kind={reward.kind} size={20} /></span>
                    <strong>{reward.label}</strong>
                    <small>{appearanceSavingId === reward.id ? "Installation…" : isEquipped ? "Installé" : "Installer"}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="clubhouse-collection__empty">
              <Gift size={22} weight="fill" />
              <span><strong>Ta première surprise t’attend</strong><small>Termine une activité pour la découvrir.</small></span>
            </div>
          )}
        </section>

        <div className="clubhouse-section-title">
          <div><span>Un petit catalogue, plein de surprises</span><h2>Défis et mini-jeux</h2></div>
          <GameController size={25} weight="fill" />
        </div>

        <div className="clubhouse-filters" role="tablist" aria-label="Filtrer les activités">
          {[{ id: "all", label: "Tout" }, { id: "challenge", label: "Défis" }, { id: "game", label: "Mini-jeux" }, { id: "together", label: "À deux" }].map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>

        <div className="clubhouse-grid">
          {visibleActivities.map((activity) => {
            const ActivityIcon = activity.Icon;
            const serverActivity = activityProgress(activity.id);
            const isComplete = serverActivity?.completed;
            const isDaily = dailyChallenge?.activityId === activity.id;
            return (
              <button type="button" className={`clubhouse-card clubhouse-card--${activity.tone}`} key={activity.id} onClick={() => openActivity(activity)}>
                <span className="clubhouse-card__top">
                  <span className="clubhouse-card__icon"><ActivityIcon size={25} weight="fill" /></span>
                  <span className="clubhouse-card__type">
                    {isDaily ? "Défi du jour" : activity.multiplayer ? "Multijoueur" : activity.type === "game" ? "Mini-jeu" : activity.partner === "together" ? "À faire à deux" : "Défi créatif"}
                  </span>
                  {isComplete && <span className="clubhouse-card__done"><CheckCircle size={16} weight="fill" /> Fait</span>}
                </span>
                <strong>{activity.title}</strong>
                <small>{activity.description}</small>
                <span className="clubhouse-card__meta">
                  <span><Timer size={14} weight="bold" /> {activity.duration} min</span>
                  <span className={isComplete ? "is-earned" : ""}>
                    {isComplete ? <CheckCircle size={14} weight="fill" /> : <Star size={14} weight="fill" />}
                    {isComplete ? "Étoiles gagnées" : `${serverActivity?.reward ?? 0} étoiles`}
                  </span>
                </span>
                {serverActivity?.unlock && (
                  <span className={`clubhouse-card__unlock${isComplete ? " is-unlocked" : ""}`}>
                    <RewardIcon kind={serverActivity.unlock.kind} size={15} />
                    <span><small>{isComplete ? "Dans ta collection" : "À débloquer"}</small><strong>{serverActivity.unlock.label}</strong></span>
                  </span>
                )}
                {serverActivity?.replayCount > 0 && <span className="clubhouse-card__replays">Rejouée {serverActivity.replayCount} fois</span>}
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
                <p>{rewardEarned ? `Tu gagnes ${awardedReward} nouvelles étoiles.` : "Tes étoiles sont déjà au chaud, et cette nouvelle partie compte quand même pour ta série."}</p>
                {unlockEarned && (
                  <div className="clubhouse-complete__unlock" style={{ "--reward-accent": unlockEarned.accent }}>
                    <span><RewardIcon kind={unlockEarned.kind} size={24} /></span>
                    <span><small>Nouvelle surprise</small><strong>{unlockEarned.label}</strong></span>
                  </div>
                )}
                <div><Star size={22} weight="fill" /><strong>{stars}</strong><span>étoiles au total</span></div>
                <button type="button" className="clubhouse-modal__primary" onClick={closeActivity}>Continuer</button>
              </div>
            ) : (
              <>
                <div className={`clubhouse-modal__hero clubhouse-modal__hero--${selectedActivity.tone}`}>
                  <span><selectedActivity.Icon size={34} weight="fill" /></span>
                  <div><small>{selectedActivity.multiplayer ? "Multijoueur privé" : selectedActivity.type === "game" ? "Mini-jeu" : "Défi créatif"}</small><h2 id="clubhouse-activity-title">{selectedActivity.title}</h2></div>
                </div>

                {phase === "intro" && (
                  <div className="clubhouse-modal__intro">
                    <p>{selectedActivity.description}</p>
                    <div className="clubhouse-modal__facts">
                      <span><Timer size={18} weight="fill" /><strong>{selectedActivity.duration} min</strong><small>durée estimée</small></span>
                      <span className={activityProgress(selectedActivity.id)?.completed ? "is-earned" : ""}>
                        {activityProgress(selectedActivity.id)?.completed ? <CheckCircle size={18} weight="fill" /> : <Star size={18} weight="fill" />}
                        <strong>{activityProgress(selectedActivity.id)?.completed ? "Déjà gagnée" : `+${activityProgress(selectedActivity.id)?.reward ?? 0}`}</strong>
                        <small>{activityProgress(selectedActivity.id)?.completed ? `${activityProgress(selectedActivity.id)?.reward ?? 0} étoiles · une seule fois` : "étoiles à la 1re réussite"}</small>
                      </span>
                      <span>
                        {selectedActivity.partner === "together" ? <UsersThree size={18} weight="fill" /> : <ShieldCheck size={18} weight="fill" />}
                        <strong>{selectedActivity.partner === "together" ? "À deux" : "Privé"}</strong>
                        <small>{selectedActivity.partner === "together" ? "ami ou parent" : "rien n’est publié"}</small>
                      </span>
                    </div>
                    {activityProgress(selectedActivity.id)?.unlock && (
                      <div
                        className={`clubhouse-modal__unlock${activityProgress(selectedActivity.id)?.completed ? " is-unlocked" : ""}`}
                        style={{ "--reward-accent": activityProgress(selectedActivity.id).unlock.accent }}
                      >
                        <span><RewardIcon kind={activityProgress(selectedActivity.id).unlock.kind} size={21} /></span>
                        <span>
                          <small>{activityProgress(selectedActivity.id)?.completed ? "Déjà dans ta collection" : "Surprise à débloquer"}</small>
                          <strong>{activityProgress(selectedActivity.id).unlock.label}</strong>
                        </span>
                      </div>
                    )}
                    <button type="button" className="clubhouse-modal__primary" onClick={startActivity}><Sparkle size={18} weight="fill" /> Commencer</button>
                  </div>
                )}

                {phase === "active" && selectedActivity.type === "challenge" && (
                  <div className="clubhouse-challenge">
                    <div className="clubhouse-timer"><Timer size={20} weight="fill" /><span><small>Temps restant</small><strong>{formattedTimer}</strong></span></div>
                    <ol>{selectedActivity.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
                    <button type="button" className="clubhouse-modal__primary" onClick={completeActivity} disabled={isCompletionSaving}><CheckCircle size={19} weight="fill" /> {isCompletionSaving ? "Enregistrement…" : "J’ai terminé"}</button>
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

                {phase === "active" && selectedActivity.variant === "multiplayer" && (
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

export function ParentGamesScreen({ parent, onBack }) {
  return (
    <section className="parent-games-screen" aria-labelledby="parent-games-title">
      <header className="parent-messages-header">
        <button type="button" className="parent-back-button" onClick={onBack} aria-label="Retour au tableau de bord parent"><ArrowLeft size={22} weight="bold" /></button>
        <div><span>Mode parent</span><h1 id="parent-games-title">Multijoueur</h1></div>
        <span className="parent-games-screen__icon"><GameController size={25} weight="fill" /></span>
      </header>
      <div className="parent-games-screen__content">
        <div className="parent-games-intro"><ShieldCheck size={20} weight="fill" /><span><strong>Un espace de jeu privé</strong><small>Puissance 4, Morpion et Bataille navale avec vos enfants, vos co-parents et vos contacts approuvés.</small></span></div>
        <ConnectFourGame child={parent} />
      </div>
    </section>
  );
}
