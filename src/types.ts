// 게임 상태와 문제 데이터의 공통 타입을 정의합니다.
export type TileType = "start" | "gate" | "quest" | "bonus" | "vacation" | "hazard" | "finish";

export type GamePhase = "setup" | "ready" | "playing" | "finished";

export type ChallengeKind = "gate" | "quest" | "bonus" | "hazard";

export interface BoardTile {
  id: string;
  label: string;
  type: TileType;
  x: number;
  y: number;
  gateId?: string;
}

export interface QuizQuestion {
  number: number;
  question: string;
  options: string[];
  answer: string;
  answer_full?: string;
  explanation: string;
}

export interface GateQuestionGroup {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

export interface QuestionBank {
  gates: GateQuestionGroup[];
}

export interface Player {
  id: string;
  name: string;
  color: string;
  coins: number;
  correct: number;
  wrong: number;
  position: number;
  skipNext: boolean;
  status: "active" | "finished";
  rank?: number;
}

export interface ActiveChallenge {
  kind: ChallengeKind;
  playerId: string;
  tileId: string;
  gateId?: string;
  question?: QuizQuestion;
  startedAt?: number;
  remaining: number;
  answered: boolean;
  isCorrect?: boolean;
  selectedAnswer?: string;
  coinDelta?: number;
  manualAwardedPlayerId?: string;
  manualAwardMessage?: string;
  showCardBack: boolean;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  turnOrder: string[];
  currentTurnIndex: number;
  finishCount: number;
  lastGateQuestions: Record<string, number>;
  usedQuestQuestions: number[];
  activeChallenge?: ActiveChallenge;
  message: string;
}
