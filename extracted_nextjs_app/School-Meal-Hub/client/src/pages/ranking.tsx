import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Redirect, Link } from "wouter";
import { Trophy, ArrowLeft, Medal } from "lucide-react";

type RankItem = { rank: number; label: string; points: number; isMe: boolean };
type RankingData = { ok: boolean; scope: string; myPoints: number; ranking: RankItem[] };

const MEDAL_COLORS = ["text-yellow-400", "text-slate-400", "text-amber-700"];

function MedalIcon({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <Medal className={`w-4 h-4 ${MEDAL_COLORS[rank - 1]}`} />;
  }
  return <span className="w-4 text-center text-[12px] text-[#86868B] font-medium">{rank}</span>;
}

export default function RankingPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [scope, setScope] = useState<"class" | "school">("class");

  const { data, isLoading: rankLoading } = useQuery<RankingData>({
    queryKey: ["/api/ranking", scope],
    queryFn: async () => {
      const res = await fetch(`/api/ranking?scope=${scope}`, { credentials: "include" });
      if (res.status === 401) return null as unknown as RankingData;
      if (!res.ok) throw new Error("랭킹 조회 실패");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <Skeleton className="w-64 h-64 rounded-2xl" />
    </div>
  );
  if (!isAuthenticated) return <Redirect to="/login" />;

  const ranking = data?.ranking ?? [];
  const myEntry = ranking.find((r) => r.isMe);

  return (
    <div className="min-h-screen bg-[#F5F5F7]" data-testid="page-ranking">
      <header className="bg-white/90 backdrop-blur-xl border-b border-[#D2D2D7]/50 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl text-[#86868B]" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h1 className="text-[17px] font-semibold text-[#1D1D1F]">포인트 랭킹</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 범위 선택 */}
        <div className="bg-[#E8E8ED] p-1 rounded-xl flex" data-testid="scope-toggle">
          <button
            onClick={() => setScope("class")}
            data-testid="button-scope-class"
            className={`flex-1 py-2 rounded-lg text-[14px] font-medium transition-colors ${
              scope === "class" ? "bg-white text-[#1D1D1F]" : "text-[#86868B]"
            }`}
          >
            {user!.grade}학년 {user!.classNum}반
          </button>
          <button
            onClick={() => setScope("school")}
            data-testid="button-scope-school"
            className={`flex-1 py-2 rounded-lg text-[14px] font-medium transition-colors ${
              scope === "school" ? "bg-white text-[#1D1D1F]" : "text-[#86868B]"
            }`}
          >
            전교 랭킹
          </button>
        </div>

        {/* 내 순위 요약 */}
        {myEntry && (
          <div className="bg-[#0071E3] rounded-2xl p-4 flex items-center justify-between" data-testid="my-rank-summary">
            <div>
              <p className="text-[12px] text-white/70 mb-0.5">내 순위</p>
              <p className="text-[20px] font-bold text-white">{myEntry.rank}위</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-white/70 mb-0.5">포인트</p>
              <p className="text-[20px] font-bold text-white">{myEntry.points}P</p>
            </div>
          </div>
        )}

        {/* 랭킹 테이블 */}
        <div className="bg-white rounded-2xl border-0" data-testid="ranking-table">
          {rankLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : ranking.length === 0 ? (
            <div className="p-10 text-center">
              <Trophy className="w-10 h-10 text-[#D2D2D7] mx-auto mb-3" />
              <p className="text-[14px] text-[#86868B]">아직 랭킹 데이터가 없습니다.</p>
              <p className="text-[13px] text-[#86868B] mt-1">급식 평가를 남기면 포인트가 적립됩니다!</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F5F5F7]">
              {ranking.map((item) => (
                <div
                  key={item.rank}
                  data-testid={`rank-row-${item.rank}`}
                  className={`flex items-center gap-4 px-5 py-4 ${item.isMe ? "bg-[#F0F8FF]" : ""} ${item.rank === 1 ? "rounded-t-2xl" : ""} ${item.rank === ranking[ranking.length - 1].rank ? "rounded-b-2xl" : ""}`}
                >
                  <div className="w-6 flex justify-center flex-shrink-0">
                    <MedalIcon rank={item.rank} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-medium truncate ${item.isMe ? "text-[#0071E3]" : "text-[#1D1D1F]"}`}>
                      {item.label}
                      {item.isMe && <span className="ml-1.5 text-[11px] font-normal text-[#0071E3]">(나)</span>}
                    </p>
                  </div>
                  <p className={`text-[15px] font-semibold flex-shrink-0 tabular-nums ${item.isMe ? "text-[#0071E3]" : "text-[#1D1D1F]"}`}>
                    {item.points}P
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#86868B] py-2">
          매일 급식 평가 시 30P 적립 · 개인정보는 최소한으로만 표시됩니다
        </p>
      </main>
    </div>
  );
}
