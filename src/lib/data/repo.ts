import type { AttemptRecord, ClassInfo, Progress, Student } from "@/lib/game/types";

/** 저장소 인터페이스. 메모리(체험·테스트)와 Supabase(실사용) 두 구현이 있다. */
export interface GameRepo {
  findClassByCode(code: string): Promise<ClassInfo | null>;
  getClass(id: string): Promise<ClassInfo | null>;
  /** 같은 학급·번호면 기존 학생을 돌려주고 별명만 갱신한다 (새로고침·재입장). */
  upsertStudent(classId: string, number: number, nickname: string): Promise<Student>;
  getStudent(id: string): Promise<Student | null>;
  getProgress(studentId: string): Promise<Progress | null>;
  saveProgress(progress: Progress): Promise<void>;
  addAttempt(attempt: AttemptRecord): Promise<void>;
  listAttempts(studentId: string, imageId: string): Promise<AttemptRecord[]>;
}
