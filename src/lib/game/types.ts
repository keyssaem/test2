export type ClassInfo = {
  id: string;
  name: string;
  joinCode: string;
  isPaused: boolean;
};

export type Student = {
  id: string;
  classId: string;
  number: number;
  nickname: string;
};

export type ProgressStatus = "playing" | "stuck" | "done";

export type Progress = {
  studentId: string;
  classId: string;
  levelId: number;
  imageIndex: number;
  attemptsLeft: number;
  levelPassed: number; // 현재 레벨에서 통과한 그림 수
  passedCount: number; // 전체 통과한 그림 수
  bestScore: number; // 현재 그림 최고 점수
  lastPrompt: string | null;
  status: ProgressStatus;
  updatedAt: string;
};

export type AttemptRecord = {
  id: string;
  studentId: string;
  classId: string;
  imageId: string;
  prompt: string;
  score: number;
  feedback: string;
  passed: boolean;
  flagged: boolean;
  createdAt: string;
};

export type ScoreResult = {
  matched: string[]; // 맞힌 rubric id
  tip?: string; // AI가 준 한 줄 팁
  inappropriate?: boolean;
  source: "claude" | "keyword";
};
