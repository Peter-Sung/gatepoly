// 게임판 이미지 위에 표시할 이동 경로와 칸 좌표를 정의합니다.
import type { BoardTile } from "./types";

export const BOARD_WIDTH = 986;
export const BOARD_HEIGHT = 974;

export const gateImageById: Record<string, string> = {
  R0: "/img/R0.png",
  R1: "/img/R1.png",
  D1: "/img/D1.png",
  "D2 Pre": "/img/D2_Pre.png",
  D2: "/img/D2.png",
  "Q Gate": "/img/Q.png",
  D3: "/img/D3.png",
  O1: "/img/O1.png",
  O2: "/img/O2.png",
  R2: "/img/R2.png"
};

export const boardTiles: BoardTile[] = [
  { id: "start", label: "시작", type: "start", x: 91, y: 91.2 },
  { id: "R0", label: "R0", type: "gate", gateId: "R0", x: 74.6, y: 91.2 },
  { id: "R1", label: "R1", type: "gate", gateId: "R1", x: 58.3, y: 91.2 },
  { id: "quest-1", label: "퀘스트(1)", type: "quest", x: 42, y: 91.2 },
  { id: "D1", label: "D1", type: "gate", gateId: "D1", x: 25.7, y: 91.2 },
  { id: "bonus", label: "보너스", type: "bonus", x: 9.3, y: 91.2 },
  { id: "D2 Pre", label: "D2 Pre", type: "gate", gateId: "D2 Pre", x: 9.3, y: 74.6 },
  { id: "D2", label: "D2", type: "gate", gateId: "D2", x: 9.3, y: 58.1 },
  { id: "quest-2", label: "퀘스트(2)", type: "quest", x: 9.3, y: 41.6 },
  { id: "Q Gate", label: "Q Gate", type: "gate", gateId: "Q Gate", x: 9.3, y: 25.1 },
  { id: "vacation", label: "연차휴가", type: "vacation", x: 9.3, y: 8.7 },
  { id: "quest-3", label: "퀘스트(3)", type: "quest", x: 25.7, y: 8.7 },
  { id: "D3", label: "D3", type: "gate", gateId: "D3", x: 42, y: 8.7 },
  { id: "quest-4", label: "퀘스트(4)", type: "quest", x: 58.3, y: 8.7 },
  { id: "O1", label: "O1", type: "gate", gateId: "O1", x: 74.6, y: 8.7 },
  { id: "hazard", label: "장애", type: "hazard", x: 91, y: 8.7 },
  { id: "O2", label: "O2", type: "gate", gateId: "O2", x: 91, y: 25.1 },
  { id: "quest-5", label: "퀘스트(5)", type: "quest", x: 91, y: 41.6 },
  { id: "R2", label: "R2", type: "gate", gateId: "R2", x: 91, y: 58.1 },
  { id: "finish", label: "승리", type: "finish", x: 91, y: 74.6 }
];

export const finishIndex = boardTiles.length - 1;
