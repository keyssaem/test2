import { randomUUID } from "node:crypto";
import type { AttemptRecord, ClassInfo, Progress, Student } from "@/lib/game/types";
import type { GameRepo } from "./repo";

export const DEMO_CLASS: ClassInfo = { id: "demo-class", name: "체험 학급", joinCode: "DEMO01", isPaused: false };

/** 서버 메모리에만 저장 (재시작하면 사라짐). 체험·개발·테스트용. */
export function createMemoryRepo(seed: ClassInfo[] = [DEMO_CLASS]): GameRepo & { classes: Map<string, ClassInfo> } {
  const classes = new Map(seed.map((c) => [c.id, { ...c }]));
  const students = new Map<string, Student>();
  const progress = new Map<string, Progress>();
  const attempts: AttemptRecord[] = [];

  return {
    classes,
    async findClassByCode(code) {
      return [...classes.values()].find((c) => c.joinCode === code.toUpperCase()) ?? null;
    },
    async getClass(id) {
      return classes.get(id) ?? null;
    },
    async upsertStudent(classId, number, nickname) {
      const existing = [...students.values()].find((s) => s.classId === classId && s.number === number);
      if (existing) {
        existing.nickname = nickname;
        return { ...existing };
      }
      const s: Student = { id: randomUUID(), classId, number, nickname };
      students.set(s.id, s);
      return { ...s };
    },
    async getStudent(id) {
      const s = students.get(id);
      return s ? { ...s } : null;
    },
    async getProgress(studentId) {
      const p = progress.get(studentId);
      return p ? { ...p } : null;
    },
    async saveProgress(p) {
      progress.set(p.studentId, { ...p });
    },
    async addAttempt(a) {
      attempts.push({ ...a });
    },
    async listAttempts(studentId, imageId) {
      return attempts.filter((a) => a.studentId === studentId && a.imageId === imageId).map((a) => ({ ...a }));
    },
  };
}
