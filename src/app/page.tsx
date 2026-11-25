import JoinForm from "./join-form";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="text-center space-y-3">
        <p className="text-violet-soft text-sm tracking-widest">SAY WHAT YOU SEE · 한국어</p>
        <h1 className="title-shadow text-4xl sm:text-6xl font-bold text-orange">프롬프트 퀘스트</h1>
        <p className="text-base sm:text-lg">그림을 보고, 보이는 대로 말해 보아요!</p>
      </header>

      <JoinForm />

      <ul className="text-sm text-violet-soft space-y-1 text-center">
        <li>★ 레벨 5개 · 그림마다 기회 3번</li>
        <li>★ 실명 대신 별명을 써요 (개인정보 보호)</li>
      </ul>
    </main>
  );
}
