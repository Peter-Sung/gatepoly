// 로컬 JSON 문제 데이터를 불러오고 출제 규칙에 맞는 문제를 고릅니다.
import type { GateQuestionGroup, QuestionBank, QuizQuestion } from "./types";

export async function loadQuestionBanks() {
  const [gateResponse, questResponse] = await Promise.all([
    fetch("/data/gate_question.json"),
    fetch("/data/quest_question.json")
  ]);

  if (!gateResponse.ok || !questResponse.ok) {
    throw new Error("문제 데이터를 불러오지 못했습니다.");
  }

  const gateBank = (await gateResponse.json()) as QuestionBank;
  const questBank = (await questResponse.json()) as QuestionBank;
  return { gateBank, questBank };
}

export function findGateGroup(bank: QuestionBank, gateId: string): GateQuestionGroup | undefined {
  return bank.gates.find((group) => group.id === gateId);
}

export function pickGateQuestion(group: GateQuestionGroup, previousNumber?: number): QuizQuestion {
  const candidates =
    group.questions.length > 1
      ? group.questions.filter((question) => question.number !== previousNumber)
      : group.questions;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function pickQuestQuestion(bank: QuestionBank, usedQuestionNumbers: number[]) {
  const questions = bank.gates.flatMap((group) => group.questions);
  const remaining = questions.filter((question) => !usedQuestionNumbers.includes(question.number));
  const pool = remaining.length > 0 ? remaining : questions;
  const question = pool[Math.floor(Math.random() * pool.length)];
  const nextUsed = remaining.length > 0 ? [...usedQuestionNumbers, question.number] : [question.number];

  return { question, nextUsed };
}

export function normalizeAnswer(answer: string) {
  const match = answer.match(/\((\d+)\)/);
  return match ? match[1] : answer.trim();
}
