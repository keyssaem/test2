import { randomUUID } from "node:crypto";
import type { AttemptRecord, ClassInfo, Progress, Student } from "@/lib/game/types";
import { emitClassChange } from "./events";
import type { GameRepo, TeacherRepo } from "./repo";

export const LOCAL_TEACHER_ID = "local-teacher";
export const DEMO_CLASS: ClassInfo = {
  id: "demo-class",
  teacherId: LOCAL_TEACHER_ID,
  name: "체험 학급",
  joinCode: "DEMO01",
  isPaused: false,
};

export type MemoryRepo = GameRepo & TeacherRepo & { classes: Map<string, ClassInfo> };

/** 서버 메모리에만 저장 (재시작하면 사라짐). 체험·개발·테스트용. */
export function createMemoryRepo(seed: ClassInfo[] = [DEMO_CLASS]): MemoryRepo {
  const classes = new Map(seed.map((c) => [c.id, { ...c }]));
  const students = new Map<string, Student>();
  const progress = new Map<string, Progress>();
  let attempts: AttemptRecord[] = [];

  const owned = (teacherId: string, classId: string) => {
    const c = classes.get(classId);
    return c && c.teacherId === teacherId ? c : null;
  };

  return {
    classes,

    // ── 학생 쪽 ──
    async findClassByCode(code) {
      const c = [...classes.values()].find((x) => x.joinCode === code.toUpperCase());
      return c ? { ...c } : null;
    },
    async getClass(id) {
      const c = classes.get(id);
      return c ? { ...c } : null;
    },
    async upsertStudent(classId, number, nickname) {
      const existing = [...students.values()].find((s) => s.classId === classId && s.number === number);
      if (existing) {
        existing.nickname = nickname;
        emitClassChange(classId);
        return { ...existing };
      }
      const s: Student = { id: randomUUID(), classId, number, nickname };
      students.set(s.id, s);
      emitClassChange(classId);
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
      emitClassChange(p.classId);
    },
    async addAttempt(a) {
      attempts.push({ ...a });
      emitClassChange(a.classId);
    },
    async listAttempts(studentId, imageId) {
      return attempts.filter((a) => a.studentId === studentId && a.imageId === imageId).map((a) => ({ ...a }));
    },

    // ── 교사 쪽 ──
    async listClasses(teacherId) {
      return [...classes.values()].filter((c) => c.teacherId === teacherId).map((c) => ({ ...c }));
    },
    async createClass(teacherId, name, joinCode) {
      if ([...classes.values()].some((c) => c.joinCode === joinCode)) throw new Error("JOIN_CODE_TAKEN");
      const c: ClassInfo = { id: randomUUID(), teacherId, name, joinCode, isPaused: false };
      classes.set(c.id, c);
      return { ...c };
    },
    async getOwnedClass(teacherId, classId) {
      const c = owned(teacherId, classId);
      return c ? { ...c } : null;
    },
    async setPaused(teacherId, classId, paused) {
      const c = owned(teacherId, classId);
      if (!c) return null;
      c.isPaused = paused;
      emitClassChange(classId);
      return { ...c };
    },
    async loadClassData(teacherId, classId) {
      const c = owned(teacherId, classId);
      if (!c) return null;
      return {
        cls: { ...c },
        students: [...students.values()].filter((s) => s.classId === classId).map((s) => ({ ...s })),
        progress: [...progress.values()].filter((p) => p.classId === classId).map((p) => ({ ...p })),
        // 같은 시각이면 나중에 들어온 것이 앞에 오도록, 뒤집은 뒤 안정 정렬
        attempts: attempts
          .filter((a) => a.classId === classId)
          .reverse()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((a) => ({ ...a })),
      };
    },
    async deleteClass(teacherId, classId) {
      if (!owned(teacherId, classId)) return false;
      classes.delete(classId);
      for (const [id, s] of students) if (s.classId === classId) students.delete(id);
      for (const [id, p] of progress) if (p.classId === classId) progress.delete(id);
      attempts = attempts.filter((a) => a.classId !== classId);
      emitClassChange(classId);
      return true;
    },
  };
}
