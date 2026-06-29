// 게이트폴리 게임의 화면과 진행 규칙을 관리합니다.
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Coins, Flag, Play, RefreshCw, RotateCcw, Shuffle, Trophy } from "lucide-react";
import { boardTiles, finishIndex, gateImageById } from "./board";
import { clearSavedGame, loadSavedGame, saveGame } from "./storage";
import {
  findGateGroup,
  loadQuestionBanks,
  normalizeAnswer,
  pickGateQuestion,
  pickQuestQuestion
} from "./questions";
import type { ActiveChallenge, ChallengeKind, GameState, Player, QuestionBank, QuizQuestion } from "./types";

const playerColors = [
  "#e84a5f",
  "#2f80ed",
  "#27ae60",
  "#f2994a",
  "#9b51e0",
  "#00a6a6",
  "#eb5757",
  "#6fcf97",
  "#f2c94c",
  "#56ccf2"
];

const initialState: GameState = {
  phase: "setup",
  players: [],
  turnOrder: [],
  currentTurnIndex: 0,
  finishCount: 0,
  lastGateQuestions: {},
  usedQuestQuestions: [],
  message: "참여 인원과 닉네임을 입력하세요."
};

function createPlayers(names: string[]): Player[] {
  return names.map((name, index) => ({
    id: crypto.randomUUID(),
    name,
    color: playerColors[index],
    coins: 3,
    correct: 0,
    wrong: 0,
    position: 0,
    skipNext: false,
    status: "active"
  }));
}

function shuffleIds(ids: string[]) {
  return [...ids].sort(() => Math.random() - 0.5);
}

function getCurrentPlayer(state: GameState) {
  const activeOrder = state.turnOrder.filter((id) => state.players.some((player) => player.id === id && player.status === "active"));
  if (activeOrder.length === 0) {
    return undefined;
  }
  const id = activeOrder[state.currentTurnIndex % activeOrder.length];
  return state.players.find((player) => player.id === id);
}

function getRewardByTime(remaining: number) {
  if (remaining >= 20) {
    return 3;
  }
  if (remaining >= 10) {
    return 2;
  }
  return 1;
}

function getChallengeTitle(challenge: ActiveChallenge) {
  if (challenge.kind === "gate") {
    return `${challenge.gateId ?? ""} 게이트 문제`.trim();
  }
  if (challenge.kind === "bonus") {
    return "보너스 문제";
  }
  if (challenge.kind === "hazard") {
    return "장애 문제";
  }
  return "퀘스트 문제";
}

function getQuestionImage(kind: ChallengeKind) {
  return kind === "gate" ? "/img/gate_question_bg.png" : "/img/quest_question_bg.png";
}

function canRetryUntilCorrect(kind: ChallengeKind) {
  return kind === "gate" || kind === "quest" || kind === "hazard";
}

function getVisibleTileLabel(label: string) {
  return label.startsWith("퀘스트") ? "퀘스트" : label;
}

function updatePlayer(players: Player[], playerId: string, updater: (player: Player) => Player) {
  return players.map((player) => (player.id === playerId ? updater(player) : player));
}

function getNextTurnIndex(state: GameState, actorId: string) {
  const activeOrder = state.turnOrder.filter((id) => state.players.some((player) => player.id === id && player.status === "active"));
  if (activeOrder.length === 0) {
    return 0;
  }

  const actorOrderIndex = state.turnOrder.indexOf(actorId);
  const nextActiveId = state.turnOrder.slice(actorOrderIndex + 1).find((id) => activeOrder.includes(id)) ?? activeOrder[0];
  return Math.max(0, activeOrder.indexOf(nextActiveId));
}

function advanceTurn(state: GameState, actorId: string): GameState {
  const activePlayers = state.players.filter((player) => player.status === "active");
  if (activePlayers.length <= 1 && state.phase !== "finished") {
    return {
      ...state,
      phase: "finished",
      activeChallenge: undefined,
      message: "게임이 종료되었습니다. 결과를 확인하세요."
    };
  }

  return {
    ...state,
    currentTurnIndex: getNextTurnIndex(state, actorId),
    activeChallenge: undefined
  };
}

function App() {
  const [state, setState] = useState<GameState>(() => loadSavedGame() ?? initialState);
  const autoSkippedPlayerRef = useRef<string | null>(null);
  const [playerCount, setPlayerCount] = useState(Math.max(2, state.players.length || 2));
  const [names, setNames] = useState<string[]>(state.players.length ? state.players.map((player) => player.name) : ["", ""]);
  const [gateBank, setGateBank] = useState<QuestionBank | null>(null);
  const [questBank, setQuestBank] = useState<QuestionBank | null>(null);
  const [dataError, setDataError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [selectedGateImage, setSelectedGateImage] = useState<string | null>(null);
  const [vacationNotice, setVacationNotice] = useState("");
  const [gameNotice, setGameNotice] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const currentPlayer = useMemo(() => getCurrentPlayer(state), [state]);
  const finishedPlayers = [...state.players].filter((player) => player.status === "finished").sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  useEffect(() => {
    loadQuestionBanks()
      .then(({ gateBank: loadedGateBank, questBank: loadedQuestBank }) => {
        setGateBank(loadedGateBank);
        setQuestBank(loadedQuestBank);
      })
      .catch((error: unknown) => {
        setDataError(error instanceof Error ? error.message : "문제 데이터를 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    if (state.phase === "finished" && state.message === "게임이 종료되었습니다. 결과를 확인하세요.") {
      setGameNotice("게임이 종료 되었습니다. 게임 결과를 확인하세요.");
    }
  }, [state.phase, state.message]);

  useEffect(() => {
    if (state.phase !== "playing" || state.activeChallenge || !currentPlayer?.skipNext) {
      return;
    }

    if (autoSkippedPlayerRef.current === currentPlayer.id) {
      return;
    }

    autoSkippedPlayerRef.current = currentPlayer.id;
    setVacationNotice("연차휴가로 이번 턴을 쉽니다. 다음 플레이어에게 순서가 넘어 갑니다.");
    setState((current) =>
      advanceTurn({
        ...current,
        players: updatePlayer(current.players, currentPlayer.id, (player) => ({ ...player, skipNext: false })),
        message: `${currentPlayer.name}님은 연차휴가로 이번 턴을 쉽니다.`
      }, currentPlayer.id)
    );
  }, [state.phase, state.activeChallenge, currentPlayer?.id, currentPlayer?.skipNext]);

  useEffect(() => {
    if (!state.activeChallenge?.startedAt || state.activeChallenge.answered) {
      return;
    }

    const timer = window.setInterval(() => {
      setState((current) => {
        const challenge = current.activeChallenge;
        if (!challenge?.startedAt || challenge.answered) {
          return current;
        }

        const remaining = Math.max(0, 30 - Math.floor((Date.now() - challenge.startedAt) / 1000));
        if (remaining > 0) {
          return { ...current, activeChallenge: { ...challenge, remaining } };
        }

        return applyAnswer(current, "", true);
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [state.activeChallenge?.startedAt, state.activeChallenge?.answered]);

  function handlePlayerCountChange(count: number) {
    setPlayerCount(count);
    setNames((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
    setSetupError("");
  }

  function preparePlayers() {
    const trimmedNames = names.map((name) => name.trim());
    if (trimmedNames.some((name) => !name)) {
      setSetupError("모든 닉네임을 입력해야 합니다.");
      return;
    }

    const players = createPlayers(trimmedNames);
    setSetupError("");
    setState({
      ...initialState,
      phase: "ready",
      players,
      turnOrder: players.map((player) => player.id),
      message: "순서정하기 버튼을 눌러 플레이 순서를 정하세요."
    });
  }

  function shuffleOrder() {
    setState((current) => ({
      ...current,
      turnOrder: shuffleIds(current.players.map((player) => player.id)),
      message: "순서가 정해졌습니다. 게임을 시작하세요."
    }));
  }

  function startGame() {
    setState((current) => ({
      ...current,
      phase: "playing",
      currentTurnIndex: 0,
      message: "첫 번째 플레이어가 주사위 값을 선택하세요."
    }));
  }

  function moveCurrentPlayer(steps: number) {
    if (!currentPlayer || state.activeChallenge || state.phase !== "playing") {
      return;
    }

    const targetPosition = currentPlayer.position + steps;
    const reachedFinish = targetPosition >= finishIndex;
    const nextPosition = reachedFinish ? finishIndex : targetPosition;
    const tile = boardTiles[nextPosition];

    setState((current) => {
      const movedPlayers = updatePlayer(current.players, currentPlayer.id, (player) => ({
        ...player,
        position: nextPosition
      }));

      const movedState = { ...current, players: movedPlayers };

      if (reachedFinish || tile.type === "finish") {
        const nextRank = current.finishCount + 1;
        const rankReward = nextRank === 1 ? 3 : nextRank === 2 ? 2 : nextRank === 3 ? 1 : 0;
        const players = updatePlayer(movedPlayers, currentPlayer.id, (player) => ({
          ...player,
          status: "finished",
          rank: nextRank,
          coins: player.coins + rankReward
        }));
        setGameNotice(`${nextRank}등으로 완주하셨습니다. 코인 ${rankReward}개를 지급합니다.`);

        return advanceTurn({
          ...movedState,
          players,
          finishCount: nextRank,
          message: `${currentPlayer.name}님이 ${nextRank}등으로 승리했습니다. 코인 ${rankReward}개를 받았습니다.`
        }, currentPlayer.id);
      }

      if (tile.type === "vacation") {
        setVacationNotice(`${currentPlayer.name}님이 연차휴가 칸에 도착했습니다. 다음 턴을 한 번 쉽니다.`);
        return advanceTurn({
          ...movedState,
          players: updatePlayer(movedPlayers, currentPlayer.id, (player) => ({ ...player, skipNext: true })),
          message: `${currentPlayer.name}님은 연차휴가 칸에 도착했습니다. 다음 턴을 한 번 쉽니다.`
        }, currentPlayer.id);
      }

      if (tile.type === "gate" || tile.type === "quest" || tile.type === "bonus" || tile.type === "hazard") {
        return {
          ...movedState,
          activeChallenge: {
            kind: tile.type === "gate" ? "gate" : tile.type,
            playerId: currentPlayer.id,
            tileId: tile.id,
            gateId: tile.gateId,
            remaining: 30,
            answered: false,
            selectedAnswers: [],
            showCardBack: true
          },
          message: `${currentPlayer.name}님이 ${getVisibleTileLabel(tile.label)} 칸에 도착했습니다. 카드 뒷면을 클릭하세요.`
        };
      }

      return advanceTurn({
        ...movedState,
        message: `${currentPlayer.name}님이 ${tile.label} 칸으로 이동했습니다.`
      }, currentPlayer.id);
    });
  }

  function revealQuestion() {
    if (!state.activeChallenge || !gateBank || !questBank) {
      return;
    }

    setState((current) => {
      const challenge = current.activeChallenge;
      if (!challenge) {
        return current;
      }

      let question: QuizQuestion;
      let lastGateQuestions = current.lastGateQuestions;
      let usedQuestQuestions = current.usedQuestQuestions;

      if (challenge.kind === "gate" && challenge.gateId) {
        const group = findGateGroup(gateBank, challenge.gateId);
        if (!group) {
          return { ...current, message: `${challenge.gateId} 문제를 찾지 못했습니다.` };
        }
        question = pickGateQuestion(group, current.lastGateQuestions[challenge.gateId]);
        lastGateQuestions = { ...current.lastGateQuestions, [challenge.gateId]: question.number };
      } else {
        const picked = pickQuestQuestion(questBank, current.usedQuestQuestions);
        question = picked.question;
        usedQuestQuestions = picked.nextUsed;
      }

      return {
        ...current,
        lastGateQuestions,
        usedQuestQuestions,
        activeChallenge: {
          ...challenge,
          question,
          startedAt: Date.now(),
          remaining: 30,
          showCardBack: false
        },
        message: "30초 안에 정답을 선택하세요."
      };
    });
  }

  function applyAnswer(current: GameState, selectedAnswer: string, timeout = false): GameState {
    const challenge = current.activeChallenge;
    if (!challenge || !challenge.question) {
      return current;
    }

    const followUpAttempt = challenge.answered && challenge.needsManualAward && !challenge.isCorrect && canRetryUntilCorrect(challenge.kind);
    if (challenge.answered && !followUpAttempt) {
      return current;
    }

    const isCorrect = !timeout && normalizeAnswer(selectedAnswer) === normalizeAnswer(challenge.question.answer);
    const selectedAnswers = selectedAnswer ? [...(challenge.selectedAnswers ?? []), selectedAnswer] : challenge.selectedAnswers ?? [];

    if (followUpAttempt) {
      return {
        ...current,
        activeChallenge: {
          ...challenge,
          selectedAnswer,
          selectedAnswers,
          isCorrect,
          feedbackMessage: isCorrect ? undefined : "오답입니다. 다른 보기를 선택하세요.",
          suppressCoinMessage: true
        },
        message: isCorrect ? "정답입니다." : "오답입니다. 다른 보기를 선택하세요."
      };
    }

    let coinDelta = 0;

    if (isCorrect) {
      const baseReward = getRewardByTime(challenge.remaining);
      coinDelta = challenge.kind === "bonus" ? baseReward * 2 : challenge.kind === "hazard" ? 0 : baseReward;
    } else if (challenge.kind === "hazard") {
      coinDelta = -3;
    } else if (challenge.kind === "bonus") {
      coinDelta = 0;
    } else {
      coinDelta = -2;
    }

    const players = updatePlayer(current.players, challenge.playerId, (player) => ({
      ...player,
      coins: player.coins + coinDelta,
      correct: player.correct + (isCorrect ? 1 : 0),
      wrong: player.wrong + (isCorrect ? 0 : 1)
    }));

    return {
      ...current,
      players,
      activeChallenge: {
        ...challenge,
        remaining: timeout ? 0 : challenge.remaining,
        answered: true,
        isCorrect,
        selectedAnswer,
        selectedAnswers,
        feedbackMessage: undefined,
        needsManualAward: challenge.needsManualAward || (!isCorrect && challenge.kind !== "bonus"),
        suppressCoinMessage: false,
        coinDelta
      },
      message: isCorrect ? "정답입니다. 코인 처리가 완료되었습니다." : "오답 또는 시간초과입니다. 코인 처리가 완료되었습니다."
    };
  }

  function answerQuestion(answer: string) {
    setState((current) => applyAnswer(current, answer));
  }

  function manualAward(playerId: string) {
    setState((current) => {
      const challenge = current.activeChallenge;
      if (!challenge) {
        return current;
      }

      if (challenge.manualAwardedPlayerId) {
        return {
          ...current,
          activeChallenge: {
            ...challenge,
            manualAwardMessage: "이미 지급되었습니다."
          },
          message: "이미 지급되었습니다."
        };
      }

      const awardedPlayer = current.players.find((player) => player.id === playerId);
      const awardMessage = `${awardedPlayer?.name ?? "선택한 플레이어"}에게 코인 1개가 지급되었습니다.`;

      return {
        ...current,
        players: updatePlayer(current.players, playerId, (player) => ({ ...player, coins: player.coins + 1 })),
        activeChallenge: {
          ...challenge,
          manualAwardedPlayerId: playerId,
          manualAwardMessage: awardMessage
        },
        message: awardMessage
      };
    });
  }

  function closeChallenge() {
    setState((current) => {
      const actorId = current.activeChallenge?.playerId;
      if (!actorId) {
        return current;
      }

      return advanceTurn({ ...current, message: "다음 플레이어가 주사위 값을 선택하세요." }, actorId);
    });
  }

  function endGameAndReset() {
    clearSavedGame();
    setState(initialState);
    setPlayerCount(2);
    setNames(["", ""]);
    setSetupError("");
    setSelectedGateImage(null);
    setVacationNotice("");
    setGameNotice("");
    setShowResetConfirm(false);
  }

  function confirmResetGame() {
    endGameAndReset();
  }

  function restartSamePlayers() {
    const players = createPlayers(state.players.map((player) => player.name));
    setState({
      ...initialState,
      phase: "ready",
      players,
      turnOrder: players.map((player) => player.id),
      message: "같은 참여자로 다시 시작합니다. 순서를 정하세요."
    });
  }

  return (
    <main className="app-shell">
      <section className="game-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">U+ 서비스 생산 시스템</p>
            <h1>Gatepoly</h1>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">
              <Coins size={18} />
              <span>{state.message}</span>
            </div>
            <button className="reset-button" onClick={() => setShowResetConfirm(true)}>
              <RotateCcw size={18} />
              게임 초기화
            </button>
          </div>
        </header>

        {dataError ? <div className="alert">{dataError}</div> : null}

        <div className="workspace">
          <section className="board-panel" aria-label="게임판">
            <img className="board-image" src="/img/game_board.png" alt="게이트폴리 게임판" />
            {boardTiles.filter((tile) => tile.gateId).map((tile) => (
              <button
                key={tile.id}
                className={`tile-hit tile-${tile.type}`}
                style={{ left: `${tile.x}%`, top: `${tile.y}%` }}
                onClick={() => tile.gateId && setSelectedGateImage(gateImageById[tile.gateId])}
                title={tile.label}
                aria-label={tile.label}
              />
            ))}
            {state.players.map((player) => {
              const tile = boardTiles[player.position] ?? boardTiles[0];
              const sameTilePlayers = state.players.filter((item) => item.position === player.position);
              const offsetIndex = sameTilePlayers.findIndex((item) => item.id === player.id);
              const offsetX = (offsetIndex % 3) * 28 - 28;
              const offsetY = Math.floor(offsetIndex / 3) * 28 - 14;

              return (
                <div
                  key={player.id}
                  className={`player-token ${player.status === "finished" ? "finished-token" : ""}`}
                  style={{
                    left: `calc(${tile.x}% + ${offsetX}px)`,
                    top: `calc(${tile.y}% + ${offsetY}px)`,
                    background: player.color
                  }}
                  title={player.name}
                >
                  {player.name.slice(0, 2)}
                </div>
              );
            })}
          </section>

          <aside className="side-panel">
            {state.phase === "setup" ? (
              <SetupPanel
                playerCount={playerCount}
                names={names}
                setupError={setupError}
                onCountChange={handlePlayerCountChange}
                onNameChange={(index, value) => {
                  setSetupError("");
                  setNames((current) => current.map((name, itemIndex) => (itemIndex === index ? value : name)));
                }}
                onSubmit={preparePlayers}
              />
            ) : null}

            {state.phase === "ready" ? (
              <ReadyPanel state={state} onShuffle={shuffleOrder} onStart={startGame} />
            ) : null}

            {state.phase === "playing" ? (
              <TurnPanel
                currentPlayer={currentPlayer}
                activeChallenge={state.activeChallenge}
                onMove={moveCurrentPlayer}
              />
            ) : null}

            {state.phase === "finished" ? (
              <ResultPanel players={state.players} onReset={endGameAndReset} onRestart={restartSamePlayers} />
            ) : null}

            <PlayerBoard players={state.players} />
          </aside>
        </div>
      </section>

      <footer className="app-footer">© Better AX begins with Work Innovation CoE. All rights reserved.</footer>

      {state.activeChallenge ? (
        <ChallengeModal
          challenge={state.activeChallenge}
          players={state.players}
          onReveal={revealQuestion}
          onAnswer={answerQuestion}
          onManualAward={manualAward}
          onClose={closeChallenge}
        />
      ) : null}

      {selectedGateImage ? (
        <div className="modal-backdrop" onClick={() => setSelectedGateImage(null)}>
          <div className="gate-card-modal" onClick={(event) => event.stopPropagation()}>
            <img src={selectedGateImage} alt="게이트 설명 카드" />
            <button onClick={() => setSelectedGateImage(null)}>닫기</button>
          </div>
        </div>
      ) : null}

      {vacationNotice ? (
        <div className="modal-backdrop" onClick={() => setVacationNotice("")}>
          <div className="notice-modal" onClick={(event) => event.stopPropagation()}>
            <h2>연차휴가</h2>
            <p>{vacationNotice}</p>
            <button className="primary-button" onClick={() => setVacationNotice("")}>확인</button>
          </div>
        </div>
      ) : null}

      {showResetConfirm ? (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div className="confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h2>게임 초기화</h2>
            <p>정말 게임을 초기화 하시겠습니까? 게임의 모든 정보가 삭제 됩니다.</p>
            <div className="button-row">
              <button onClick={() => setShowResetConfirm(false)}>취소</button>
              <button className="danger-button" onClick={confirmResetGame}>확인</button>
            </div>
          </div>
        </div>
      ) : null}

      {gameNotice ? (
        <div className="modal-backdrop" onClick={() => setGameNotice("")}>
          <div className="notice-modal" onClick={(event) => event.stopPropagation()}>
            <h2>안내</h2>
            <p>{gameNotice}</p>
            <button className="primary-button" onClick={() => setGameNotice("")}>확인</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SetupPanel({
  playerCount,
  names,
  setupError,
  onCountChange,
  onNameChange,
  onSubmit
}: {
  playerCount: number;
  names: string[];
  setupError: string;
  onCountChange: (count: number) => void;
  onNameChange: (index: number, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="control-section">
      <h2>참여자 설정</h2>
      <label className="field">
        참여 인원
        <select value={playerCount} onChange={(event) => onCountChange(Number(event.target.value))}>
          {Array.from({ length: 9 }, (_, index) => index + 2).map((count) => (
            <option key={count} value={count}>
              {count}명
            </option>
          ))}
        </select>
      </label>
      <div className="name-grid">
        {names.map((name, index) => (
          <label className="field" key={index}>
            {index + 1}번 닉네임
            <input required value={name} onChange={(event) => onNameChange(index, event.target.value)} placeholder={`플레이어 ${index + 1}`} />
          </label>
        ))}
      </div>
      {setupError ? <p className="form-error">{setupError}</p> : null}
      <button className="primary-button" onClick={onSubmit}>
        <BadgeCheck size={18} />
        저장하고 코인 지급
      </button>
    </section>
  );
}

function ReadyPanel({ state, onShuffle, onStart }: { state: GameState; onShuffle: () => void; onStart: () => void }) {
  return (
    <section className="control-section">
      <h2>게임 준비</h2>
      <ol className="order-list">
        {state.turnOrder.map((playerId, index) => {
          const player = state.players.find((item) => item.id === playerId);
          return (
            <li key={playerId}>
              <span>{index + 1}</span>
              {player?.name}
            </li>
          );
        })}
      </ol>
      <div className="button-row">
        <button onClick={onShuffle}>
          <Shuffle size={18} />
          순서정하기
        </button>
        <button className="primary-button" onClick={onStart}>
          <Play size={18} />
          시작
        </button>
      </div>
    </section>
  );
}

function TurnPanel({
  currentPlayer,
  activeChallenge,
  onMove
}: {
  currentPlayer?: Player;
  activeChallenge?: ActiveChallenge;
  onMove: (steps: number) => void;
}) {
  if (!currentPlayer) {
    return null;
  }

  return (
    <section className="control-section">
      <h2>이번 순서</h2>
      <div className="current-player" style={{ borderColor: currentPlayer.color }}>
        <span style={{ background: currentPlayer.color }} />
        <strong>{currentPlayer.name}</strong>
        <em>보유코인 {currentPlayer.coins}개</em>
      </div>
      {currentPlayer.skipNext ? <p className="hint">연차휴가로 이번 턴을 쉽니다.</p> : <p className="hint">주사위 결과를 선택하세요.</p>}
      <div className="dice-buttons">
        {[1, 2, 3].map((value) => (
          <button key={value} disabled={Boolean(activeChallenge)} onClick={() => onMove(value)}>
            {value}
          </button>
        ))}
      </div>
    </section>
  );
}

function PlayerBoard({
  players
}: {
  players: Player[];
}) {
  const sortedPlayers = [...players].sort((a, b) => b.coins - a.coins);

  return (
    <section className="player-board">
      <h2>게임 참여자</h2>
      <div className="player-list">
        {sortedPlayers.map((player) => (
          <div className={`player-row score-rank-${sortedPlayers.indexOf(player) + 1}`} key={player.id}>
            <div className="player-main">
              <div className="player-name-group">
                <span className="color-dot" style={{ background: player.color }} />
                <strong>
                  <span className="score-rank-badge">{sortedPlayers.indexOf(player) + 1}</span>
                  {player.name}
                </strong>
              </div>
              {player.rank ? <span className="finish-mark"><Flag size={14} /> 완주 {player.rank}등</span> : null}
            </div>
            <div className="player-metrics">
              <span className="metric-pill coin-pill">보유코인 {player.coins}개</span>
              <span className="metric-pill">정답 {player.correct}</span>
              <span className="metric-pill">오답 {player.wrong}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChallengeModal({
  challenge,
  players,
  onReveal,
  onAnswer,
  onManualAward,
  onClose
}: {
  challenge: ActiveChallenge;
  players: Player[];
  onReveal: () => void;
  onAnswer: (answer: string) => void;
  onManualAward: (playerId: string) => void;
  onClose: () => void;
}) {
  const player = players.find((item) => item.id === challenge.playerId);
  const otherPlayers = players.filter((item) => item.id !== challenge.playerId && item.status === "active");
  const showManualAward = challenge.answered && Boolean(challenge.needsManualAward) && challenge.kind !== "bonus";
  const canContinueChoosingOptions = challenge.answered && Boolean(challenge.needsManualAward) && !challenge.isCorrect && canRetryUntilCorrect(challenge.kind);

  return (
    <div className="modal-backdrop">
      <section className={`question-modal ${showManualAward ? "" : "question-modal-single"}`}>
        <div className="question-main">
          <header className="question-header">
            <div>
              <p>{player?.name}</p>
              <h2>{getChallengeTitle(challenge)}</h2>
            </div>
            <div className="timer">{challenge.remaining}초</div>
          </header>

          {challenge.showCardBack ? (
            <button className="card-back-button" onClick={onReveal}>
              <img src={getQuestionImage(challenge.kind)} alt="문제 카드 뒷면" />
              <span>카드 클릭</span>
            </button>
          ) : null}

          {!challenge.showCardBack && challenge.question ? (
            <div className="question-card">
              <p className="question-text">{challenge.question.question}</p>
              <div className="option-list">
                {challenge.question.options.map((option) => {
                  const isAnswerOption = normalizeAnswer(option) === normalizeAnswer(challenge.question!.answer);
                  const wasSelectedOption = (challenge.selectedAnswers ?? []).some(
                    (answer) => normalizeAnswer(option) === normalizeAnswer(answer)
                  );
                  const showCorrectOption = challenge.answered && (challenge.isCorrect || Boolean(challenge.manualAwardedPlayerId));
                  const showWrongOption = wasSelectedOption && !isAnswerOption;
                  const optionClassName = [
                    showCorrectOption && isAnswerOption ? "correct-option" : "",
                    showWrongOption ? "wrong-option" : ""
                  ].filter(Boolean).join(" ");

                  return (
                    <button
                      key={option}
                      className={optionClassName}
                      disabled={(!canContinueChoosingOptions && challenge.answered) || (wasSelectedOption && !isAnswerOption)}
                      onClick={() => onAnswer(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {challenge.feedbackMessage && !challenge.answered ? (
                <div className="answer-result wrong">
                  <strong>{challenge.feedbackMessage}</strong>
                </div>
              ) : null}

              {challenge.answered ? (
                <div className={challenge.isCorrect ? "answer-result correct" : "answer-result wrong"}>
                  <strong>{challenge.feedbackMessage ?? (challenge.isCorrect ? "정답입니다." : "오답 또는 시간초과입니다.")}</strong>
                  {!challenge.suppressCoinMessage ? <span>{formatCoinDelta(challenge.coinDelta ?? 0)}</span> : null}
                  {challenge.isCorrect ? <p>{challenge.question.explanation}</p> : null}
                  {!canContinueChoosingOptions ? <button className="primary-button" onClick={onClose}>다음 플레이어</button> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {showManualAward ? (
          <aside className="manual-award">
            <h3>정답 플레이어 선택</h3>
            {challenge.manualAwardMessage ? <p className="award-message">{challenge.manualAwardMessage}</p> : null}
            <div>
              {otherPlayers.map((item) => (
                <button
                  key={item.id}
                  className={challenge.manualAwardedPlayerId === item.id ? "awarded-player" : ""}
                  onClick={() => onManualAward(item.id)}
                >
                  {item.name} +1
                </button>
              ))}
            </div>
          </aside>
        ) : null}
      </section>
    </div>
  );
}

function formatCoinDelta(delta: number) {
  if (delta > 0) {
    return `코인 ${delta}개를 받았습니다.`;
  }
  if (delta < 0) {
    return `코인 ${Math.abs(delta)}개를 반납했습니다.`;
  }
  return "코인 변화가 없습니다.";
}

function ResultPanel({
  players,
  onReset,
  onRestart
}: {
  players: Player[];
  onReset: () => void;
  onRestart: () => void;
}) {
  const sorted = [...players].sort((a, b) => b.coins - a.coins);

  return (
    <section className="control-section">
      <h2>게임 결과</h2>
      <div className="result-list">
        {sorted.map((player, index) => (
          <div className={`result-row score-rank-${index + 1}`} key={player.id}>
            <div className="result-main">
              <Trophy size={18} />
              <strong>{index + 1}위 {player.name}</strong>
              <span className="metric-pill coin-pill">보유코인 {player.coins}개</span>
            </div>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button onClick={onReset}>
          <RefreshCw size={18} />
          게임 종료
        </button>
        <button className="primary-button" onClick={onRestart}>
          <Play size={18} />
          재시작
        </button>
      </div>
    </section>
  );
}

export default App;
