-- ════════════════════════════════════════════════════════════════
-- 프롬프트 퀘스트 — 초기 스키마 + RLS
-- 원칙
--   1) 학생 실명·이메일·사진을 저장하지 않는다 (번호 + 별명만).
--   2) 모든 테이블에 RLS를 켠다. 정책이 없으면 기본 거부.
--   3) 학생은 Supabase 계정이 없다. 학생 쓰기는 서버(service_role)가
--      서명된 학생 세션을 검증한 뒤에만 수행한다.
--   4) 교사는 자기 학급 데이터만 읽고 지울 수 있다.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── 학급 ────────────────────────────────────────────────────────
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  join_code   text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  is_paused   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index classes_teacher_idx on public.classes (teacher_id);

-- ── 학생 (개인정보 최소화: 번호 + 별명) ─────────────────────────
create table public.students (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  number      int  not null check (number between 1 and 60),
  nickname    text not null check (char_length(nickname) between 1 and 12),
  created_at  timestamptz not null default now(),
  unique (class_id, number)
);

-- ── 레벨 ────────────────────────────────────────────────────────
-- 목표 그림과 정답 프롬프트·채점 요소는 DB가 아니라 서버 코드(src/content/levels.ts)에 있다.
-- (클라이언트가 DB로 정답을 읽어 갈 경로 자체가 없음)
create table public.levels (
  id              int primary key,
  title           text not null,
  description     text not null,
  pass_threshold  int  not null check (pass_threshold between 0 and 100),
  max_attempts    int  not null default 3 check (max_attempts between 1 and 10)
);

-- ── 시도 기록 ───────────────────────────────────────────────────
create table public.attempts (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  image_id    text not null check (char_length(image_id) <= 40),
  prompt      text not null check (char_length(prompt) between 1 and 100),
  score       int  check (score between 0 and 100),
  feedback    text,
  passed      boolean not null default false,
  flagged     boolean not null default false, -- 부적절 입력 알림
  created_at  timestamptz not null default now()
);
create index attempts_class_idx on public.attempts (class_id, created_at desc);
create index attempts_student_idx on public.attempts (student_id, created_at desc);

-- ── 학생 진행 상황 (대시보드 카드 1장 = 1행) ────────────────────
create table public.student_progress (
  student_id     uuid primary key references public.students(id) on delete cascade,
  class_id       uuid not null references public.classes(id) on delete cascade,
  current_level  int  not null default 1 references public.levels(id),
  image_index    int  not null default 0,
  attempts_left  int  not null default 3,
  level_passed   int  not null default 0,
  passed_count   int  not null default 0,
  best_score     int  not null default 0,
  last_prompt    text check (char_length(last_prompt) <= 100),
  status         text not null default 'playing' check (status in ('playing','stuck','done')),
  updated_at     timestamptz not null default now()
);
create index progress_class_idx on public.student_progress (class_id);

-- ════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════
alter table public.classes          enable row level security;
alter table public.students         enable row level security;
alter table public.levels           enable row level security;
alter table public.attempts         enable row level security;
alter table public.student_progress enable row level security;

-- 교사가 이 학급의 주인인지
create or replace function public.owns_class(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.classes c where c.id = cid and c.teacher_id = auth.uid());
$$;
revoke all on function public.owns_class(uuid) from public;
grant execute on function public.owns_class(uuid) to authenticated;

-- classes: 교사 본인 것만 CRUD
create policy classes_select_own on public.classes for select to authenticated using (teacher_id = auth.uid());
create policy classes_insert_own on public.classes for insert to authenticated with check (teacher_id = auth.uid());
create policy classes_update_own on public.classes for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy classes_delete_own on public.classes for delete to authenticated using (teacher_id = auth.uid());

-- students / attempts / progress: 교사는 자기 학급만 읽기·삭제 (쓰기는 서버만)
create policy students_select_teacher on public.students for select to authenticated using (public.owns_class(class_id));
create policy students_delete_teacher on public.students for delete to authenticated using (public.owns_class(class_id));

create policy attempts_select_teacher on public.attempts for select to authenticated using (public.owns_class(class_id));
create policy attempts_delete_teacher on public.attempts for delete to authenticated using (public.owns_class(class_id));

create policy progress_select_teacher on public.student_progress for select to authenticated using (public.owns_class(class_id));
create policy progress_delete_teacher on public.student_progress for delete to authenticated using (public.owns_class(class_id));

-- levels: 로그인 교사는 읽기만
create policy levels_select_auth on public.levels for select to authenticated using (true);

-- anon(비로그인) 역할에는 어떤 테이블 권한도 주지 않는다
revoke all on all tables in schema public from anon;

-- ════════════════════════════════════════════════════════════════
-- Realtime: 교사 대시보드가 구독할 테이블 (RLS가 그대로 적용됨)
-- ════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.student_progress;
alter publication supabase_realtime add table public.attempts;

-- ════════════════════════════════════════════════════════════════
-- 기본 레벨
-- ════════════════════════════════════════════════════════════════
insert into public.levels (id, title, description, pass_threshold) values
  (1, '사물과 색깔',   '하나의 사물과 그 색깔을 말해요. 예) 빨간 사과', 60),
  (2, '사물과 장소',   '무엇이 어디에 있는지 말해요. 예) 모래사장 위 노란 공', 65),
  (3, '위치 관계',     '여러 사물의 위·아래·옆을 말해요.', 70),
  (4, '행동과 감정',   '누가 무엇을 어떤 기분으로 하는지 말해요.', 75),
  (5, '분위기와 화풍', '시간·날씨·그림 스타일까지 말해요. 예) 수채화, 해 질 녘', 80);
