import type { NextRequest } from "next/server";
import { onClassChange } from "@/lib/data/events";
import { errorResponse } from "@/lib/game/http";
import { GameError } from "@/lib/game/service";
import { serverEnv } from "@/lib/server-env";
import { notFound, requireTeacher } from "@/lib/teacher/http";

export const dynamic = "force-dynamic";

/**
 * memory 모드 실시간 알림 (Server-Sent Events).
 * 내용은 보내지 않고 "바뀌었음" 신호만 보낸다 → 화면이 스냅샷을 다시 받아 온다.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (serverEnv().DATA_BACKEND !== "memory") throw new GameError("BAD_INPUT", "supabase 모드는 Realtime 을 사용합니다.", 404);
    const { id } = await ctx.params;
    const { teacher, repo } = await requireTeacher(req);
    if (!(await repo.getOwnedClass(teacher.id, id))) notFound();

    const enc = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string) => {
          try {
            controller.enqueue(enc.encode(`event: ${event}\ndata: {}\n\n`));
          } catch {
            cleanup();
          }
        };
        let timer: ReturnType<typeof setTimeout> | undefined;
        // 여러 변경을 0.3초 단위로 묶어서 보냄
        const off = onClassChange(id, () => {
          if (!timer) timer = setTimeout(() => ((timer = undefined), send("change")), 300);
        });
        const ping = setInterval(() => send("ping"), 25_000);
        cleanup = () => {
          off();
          clearInterval(ping);
          if (timer) clearTimeout(timer);
        };
        req.signal.addEventListener("abort", () => {
          cleanup();
          try {
            controller.close();
          } catch {}
        });
        send("ready");
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
