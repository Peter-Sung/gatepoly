// 게임 진행 상태를 브라우저 로컬 스토리지에 저장하고 복원합니다.
import type { GameState } from "./types";

const STORAGE_KEY = "gatepoly-game-state";

export function loadSavedGame(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GameState;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveGame(state: GameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearSavedGame() {
  localStorage.removeItem(STORAGE_KEY);
}
