import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeacherRepo } from "./repo";
import {
  CLASS_COLUMNS,
  check,
  toAttempt,
  toClass,
  toProgress,
  toStudent,
  type AttemptRow,
  type ClassRow,
  type ProgressRow,
  type StudentRow,
} from "./supabase-repo";

/**
 * 교사 로그인 세션(쿠키)을 가진 클라이언트로 동작한다 → RLS 가 "자기 학급만"을 DB에서 강제.
 * 코드에서도 teacher_id 조건을 함께 걸어 이중으로 막는다.
 */
export function createSupabaseTeacherRepo(db: SupabaseClient): TeacherRepo {
  return {
    async listClasses(teacherId) {
      const rows = check(await db.from("classes").select(CLASS_COLUMNS).eq("teacher_id", teacherId).order("created_at").returns<ClassRow[]>());
      return (rows ?? []).map(toClass);
    },
    async createClass(teacherId, name, joinCode) {
      const res = await db.from("classes").insert({ teacher_id: teacherId, name, join_code: joinCode }).select(CLASS_COLUMNS).single<ClassRow>();
      if (res.error?.code === "23505") throw new Error("JOIN_CODE_TAKEN");
      return toClass(check(res)!);
    },
    async getOwnedClass(teacherId, classId) {
      const row = check(await db.from("classes").select(CLASS_COLUMNS).eq("id", classId).eq("teacher_id", teacherId).maybeSingle<ClassRow>());
      return row ? toClass(row) : null;
    },
    async setPaused(teacherId, classId, paused) {
      const row = check(
        await db.from("classes").update({ is_paused: paused }).eq("id", classId).eq("teacher_id", teacherId).select(CLASS_COLUMNS).maybeSingle<ClassRow>(),
      );
      return row ? toClass(row) : null;
    },
    async loadClassData(teacherId, classId) {
      const cls = await this.getOwnedClass(teacherId, classId);
      if (!cls) return null;
      const [students, progress, attempts] = await Promise.all([
        db.from("students").select("id,class_id,number,nickname").eq("class_id", classId).returns<StudentRow[]>(),
        db.from("student_progress").select("*").eq("class_id", classId).returns<ProgressRow[]>(),
        db.from("attempts").select("*").eq("class_id", classId).order("created_at", { ascending: false }).limit(2000).returns<AttemptRow[]>(),
      ]);
      return {
        cls,
        students: (check(students) ?? []).map(toStudent),
        progress: (check(progress) ?? []).map(toProgress),
        attempts: (check(attempts) ?? []).map(toAttempt),
      };
    },
    async deleteClass(teacherId, classId) {
      const rows = check(await db.from("classes").delete().eq("id", classId).eq("teacher_id", teacherId).select("id"));
      return (rows ?? []).length > 0;
    },
  };
}
