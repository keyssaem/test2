import type { Metadata } from "next";
import PlayScreen from "./play-screen";

export const metadata: Metadata = { title: "프롬프트 퀘스트 · 게임" };

export default function PlayPage() {
  return <PlayScreen />;
}
