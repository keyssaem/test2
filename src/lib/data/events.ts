import { EventEmitter } from "node:events";

/**
 * memory 모드용 실시간 알림. 학생 기록이 바뀌면 학급 id로 신호를 보내고,
 * 교사 대시보드의 SSE 연결이 이를 받아 화면을 새로 고친다.
 * (supabase 모드는 Supabase Realtime 이 같은 역할을 한다.)
 */
const g = globalThis as unknown as { __pqBus?: EventEmitter };
const bus = (g.__pqBus ??= new EventEmitter().setMaxListeners(200));

export function emitClassChange(classId: string) {
  bus.emit(`class:${classId}`);
}

export function onClassChange(classId: string, fn: () => void): () => void {
  bus.on(`class:${classId}`, fn);
  return () => bus.off(`class:${classId}`, fn);
}
