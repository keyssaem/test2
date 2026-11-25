import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttemptRecord, ClassInfo, Progress, Student } from "@/lib/game/types";
import type { GameRepo } from "./repo";

export type ClassRow = { id: string; teacher_id: string; name: string; join_code: string; is_paused: boolean };
export type StudentRow = { id: string; class_id: string; number: number; nickname: string };
export type ProgressRow = {
  student_id: string;
  class_id: string;
  current_level: number;
  image_index: number;
  attempts_left: number;
  level_passed: number;
  passed_count: number;
  best_score: number;
  last_prompt: string | null;
  status: Progress["status"];
  updated_at: string;
};
export type AttemptRow = {
  id: string;
  student_id: string;
  class_id: string;
  image_id: string;
  prompt: string;
  score: number;
  feedback: string;
  passed: boolean;
  flagged: boolean;
  created_at: string;
};

export const CLASS_COLUMNS = "id,teacher_id,name,join_code,is_paused";
export const toClass = (r: ClassRow): ClassInfo => ({ id: r.id, teacherId: r.teacher_id, name: r.name, joinCode: r.join_code, isPaused: r.is_paused });
export const toStudent = (r: StudentRow): Student => ({ id: r.id, classId: r.class_id, number: r.number, nickname: r.nickname });

/** service_role 클라이언트로 동작. 호출 전에 학생 세션 검증이 끝나 있어야 한다. */
export function createSupabaseRepo(db: SupabaseClient): GameRepo {
  return {
    async findClassByCode(code) {
      const row = check(await db.from("classes").select(CLASS_COLUMNS).eq("join_code", code.toUpperCase()).maybeSingle<ClassRow>());
      return row ? toClass(row) : null;
    },
    async getClass(id) {
      const row = check(await db.from("classes").select(CLASS_COLUMNS).eq("id", id).maybeSingle<ClassRow>());
      return row ? toClass(row) : null;
    },
    async upsertStudent(classId, number, nickname) {
      const row = check(
        await db
          .from("students")
          .upsert({ class_id: classId, number, nickname }, { onConflict: "class_id,number" })
          .select("id,class_id,number,nickname")
          .single<StudentRow>(),
      );
      if (!row) throw new Error("DB 오류: 학생을 저장하지 못했습니다.");
      return toStudent(row);
    },
    async getStudent(id) {
      const row = check(await db.from("students").select("id,class_id,number,nickname").eq("id", id).maybeSingle<StudentRow>());
      return row ? toStudent(row) : null;
    },
    async getProgress(studentId) {
      const r = check(await db.from("student_progress").select("*").eq("student_id", studentId).maybeSingle<ProgressRow>());
      return r ? toProgress(r) : null;
    },
    async saveProgress(p) {
      const row: ProgressRow = {
        student_id: p.studentId,
        class_id: p.classId,
        current_level: p.levelId,
        image_index: p.imageIndex,
        attempts_left: p.attemptsLeft,
        level_passed: p.levelPassed,
        passed_count: p.passedCount,
        best_score: p.bestScore,
        last_prompt: p.lastPrompt,
        status: p.status,
        updated_at: p.updatedAt,
      };
      check(await db.from("student_progress").upsert(row));
    },
    async addAttempt(a) {
      const row: AttemptRow = {
        id: a.id,
        student_id: a.studentId,
        class_id: a.classId,
        image_id: a.imageId,
        prompt: a.prompt,
        score: a.score,
        feedback: a.feedback,
        passed: a.passed,
        flagged: a.flagged,
        created_at: a.createdAt,
      };
      check(await db.from("attempts").insert(row));
    },
    async listAttempts(studentId, imageId) {
      const rows = check(
        await db.from("attempts").select("*").eq("student_id", studentId).eq("image_id", imageId).order("created_at").returns<AttemptRow[]>(),
      );
      return (rows ?? []).map(toAttempt);
    },
  };
}

export const toProgress = (r: ProgressRow): Progress => ({
  studentId: r.student_id,
  classId: r.class_id,
  levelId: r.current_level,
  imageIndex: r.image_index,
  attemptsLeft: r.attempts_left,
  levelPassed: r.level_passed,
  passedCount: r.passed_count,
  bestScore: r.best_score,
  lastPrompt: r.last_prompt,
  status: r.status,
  updatedAt: r.updated_at,
});

export const toAttempt = (r: AttemptRow): AttemptRecord => ({
  id: r.id,
  studentId: r.student_id,
  classId: r.class_id,
  imageId: r.image_id,
  prompt: r.prompt,
  score: r.score,
  feedback: r.feedback,
  passed: r.passed,
  flagged: r.flagged,
  createdAt: r.created_at,
});

export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`DB 오류: ${res.error.message}`);
  return res.data;
}
