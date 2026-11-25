"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** 교사 대시보드(브라우저)용. anon 키만 사용하며 RLS의 보호를 받는다. */
export function createSupabaseBrowserClient() {
  const env = publicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
