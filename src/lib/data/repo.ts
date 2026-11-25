import type { AttemptRecord, ClassInfo, Progress, Student } from "@/lib/game/types";

/** 학생 쪽 저장소. 메모리(체험·테스트)와 Supabase(service_role, 서버 전용) 구현이 있다. */
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

export type ClassData = {
  cls: ClassInfo;
  students: Student[];
  progress: Progress[];
  attempts: AttemptRecord[]; // 최신순
};

/**
 * 교사 쪽 저장소. 모든 메서드는 teacherId 가 그 학급의 주인일 때만 동작한다.
 * (supabase 모드에서는 교사 로그인 세션 + RLS 가 같은 규칙을 DB에서 한 번 더 강제한다.)
 */
export interface TeacherRepo {
  listClasses(teacherId: string): Promise<ClassInfo[]>;
  createClass(teacherId: string, name: string, joinCode: string): Promise<ClassInfo>;
  getOwnedClass(teacherId: string, classId: string): Promise<ClassInfo | null>;
  setPaused(teacherId: string, classId: string, paused: boolean): Promise<ClassInfo | null>;
  loadClassData(teacherId: string, classId: string): Promise<ClassData | null>;
  deleteClass(teacherId: string, classId: string): Promise<boolean>;
}
