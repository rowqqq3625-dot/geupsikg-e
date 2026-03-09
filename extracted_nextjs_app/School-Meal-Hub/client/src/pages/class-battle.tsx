import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Redirect, Link } from "wouter";
import { ArrowLeft, Trophy, Swords, Medal, Crown, ChevronLeft, ChevronRight } from "lucide-react";

type Standing = {
  classNum: number;
  totalPoints: number;
  submissionCount: number;
  participantCount: number;
  rank: number;
  isMyClass: boolean;
};

type Award = {
  id: string;
  month: string;
  grade: number;
  winnerClassNum: number;
  totalCleanplatePoints: number;
  bonusPoints: number;
  studentCount: number;
  createdAt: string;
};

type BattleData = {
  ok: boolean;
  month: string;
  grade: number;
  myClassNum: number;
  standings: Standing[];
  monthAward: Award | null;
  recentAwards: Award[];
};

const MEDAL_COLORS = ["text-yellow-400", "text-slate-400", "text-amber-700"];

function getRankEmoji(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function getMonthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ClassBattlePage() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [awardGrade, setAwardGrade] = useState<number | null>(null);
  const [awardError, setAwardError] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isCurrentMonth = selectedMonth === currentMonth;

  const { data, isLoading: battleLoading } = useQuery<BattleData>({
    queryKey: ["/api/class-battle", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/class-battle?month=${selectedMonth}`, { credentials: "include" });
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: isCurrentMonth ? 60_000 : false,
  });

  const awardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/class-battle/award", {
        grade: data?.grade ?? user?.grade,
        month: selectedMonth,
      });
      return res.json();
    },
    onSuccess: () => {
      setAwardError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/class-battle"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "지급에 실패했습니다.";
      setAwardError(msg);
    },
  });

  if (isLoading) return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <Skeleton className="w-64 h-64 rounded-2xl" />
    </div>
  );
  if (!isAuthenticated) return <Redirect to="/login" />;

  const standings = data?.standings ?? [];
  const myStanding = standings.find((s) => s.isMyClass);
  const topClass = standings[0];

  return (
    <div className="min-h-screen bg-[#F5F5F7]" data-testid="page-class-battle">
      <header className="bg-white/90 backdrop-blur-xl border-b border-[#D2D2D7]/50 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard">
            <button
              data-testid="button-back"
              className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center text-[#1D1D1F]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Swords className="w-4 h-4 text-purple-500" />
            <div>
              <h1 className="text-[15px] font-semibold text-[#1D1D1F]">급식 대항전</h1>
              <p className="text-[12px] text-[#86868B]">{user!.grade}학년 · 월별 클린플레이트 경쟁</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 월 선택 */}
        <div className="flex items-center justify-between" data-testid="month-selector">
          <button
            data-testid="button-prev-month"
            onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
            className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-[#1D1D1F]" />
          </button>
          <div className="text-center">
            <p className="text-[17px] font-semibold text-[#1D1D1F]">{getMonthLabel(selectedMonth)}</p>
            {isCurrentMonth && (
              <span className="text-[11px] text-[#0071E3] font-medium">진행 중</span>
            )}
          </div>
          <button
            data-testid="button-next-month"
            onClick={() => setSelectedMonth((m) => {
              const next = addMonths(m, 1);
              return next <= currentMonth ? next : m;
            })}
            className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ${selectedMonth >= currentMonth ? "opacity-30" : ""}`}
            disabled={selectedMonth >= currentMonth}
          >
            <ChevronRight className="w-4 h-4 text-[#1D1D1F]" />
          </button>
        </div>

        {/* 내 반 요약 */}
        {myStanding && (
          <div
            data-testid="my-class-summary"
            className="bg-[#0071E3] rounded-2xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-[12px] text-white/70 mb-0.5">우리 반 순위</p>
              <p className="text-[22px] font-bold text-white">{myStanding.rank}위</p>
              <p className="text-[12px] text-white/80">{user!.classNum}반</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-white/70 mb-0.5">클린플레이트 점수</p>
              <p className="text-[22px] font-bold text-white tabular-nums">{myStanding.totalPoints}P</p>
              <p className="text-[12px] text-white/80">{myStanding.submissionCount}회 제출</p>
            </div>
          </div>
        )}

        {/* 이달 수상 뱃지 */}
        {data?.monthAward && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3" data-testid="month-award-banner">
            <Crown className="w-6 h-6 text-yellow-500 shrink-0" />
            <div>
              <p className="text-[14px] font-semibold text-[#1D1D1F]">
                {getMonthLabel(selectedMonth)} 우승: {data.monthAward.winnerClassNum}반
              </p>
              <p className="text-[12px] text-[#86868B]">
                +{data.monthAward.bonusPoints}P 지급 완료 · {data.monthAward.studentCount}명 수혜
              </p>
            </div>
          </div>
        )}

        {/* 순위표 */}
        <Card className="border-0 rounded-2xl bg-white" data-testid="standings-table">
          <CardHeader className="pb-2">
            <h2 className="text-[15px] font-semibold text-[#1D1D1F]">반별 순위</h2>
            <p className="text-[12px] text-[#86868B]">승인된 클린플레이트 포인트 합산</p>
          </CardHeader>
          <CardContent className="pt-0">
            {battleLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : standings.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <Swords className="w-10 h-10 text-[#D2D2D7]" />
                <p className="text-[14px] text-[#86868B]">{getMonthLabel(selectedMonth)} 참여 기록이 없습니다.</p>
                <p className="text-[13px] text-[#86868B]">클린플레이트를 인증하면 반 점수가 올라가요!</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F7]">
                {standings.map((s) => (
                  <div
                    key={s.classNum}
                    data-testid={`row-standing-${s.classNum}`}
                    className={`flex items-center gap-4 px-2 py-3.5 rounded-xl ${s.isMyClass ? "bg-[#EFF6FF]" : ""}`}
                  >
                    <div className="w-8 flex items-center justify-center text-[15px]">
                      {getRankEmoji(s.rank) ?? (
                        <span className="text-[12px] text-[#86868B] font-medium">{s.rank}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-semibold ${s.isMyClass ? "text-[#0071E3]" : "text-[#1D1D1F]"}`}>
                        {s.classNum}반
                        {s.isMyClass && <span className="ml-1.5 text-[11px] font-normal">(우리 반)</span>}
                      </p>
                      <p className="text-[12px] text-[#86868B]">
                        {s.submissionCount}회 제출 · {s.participantCount}명 참여
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[16px] font-bold tabular-nums ${s.isMyClass ? "text-[#0071E3]" : "text-[#1D1D1F]"}`}>
                        {s.totalPoints}P
                      </p>
                      {s.rank === 1 && isCurrentMonth && !data?.monthAward && (
                        <p className="text-[10px] text-yellow-600 font-medium">현재 1위!</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 안내 */}
        <Card className="border-0 rounded-2xl bg-[#F0F8FF]">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium text-[#1D1D1F]">🏆 급식 대항전 규칙</p>
              <ul className="text-[12px] text-[#86868B] space-y-1">
                <li>· 매월 말 클린플레이트 포인트를 가장 많이 모은 반이 우승</li>
                <li>· 우승 반 학생 전원에게 +{200}P 보너스 지급</li>
                <li>· 잔반이 적을수록, 제출 횟수가 많을수록 유리</li>
                <li>· AI가 섭취량을 판단하여 10점 단위로 포인트 지급</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 최근 수상 기록 */}
        {(data?.recentAwards ?? []).length > 0 && (
          <Card className="border-0 rounded-2xl bg-white">
            <CardHeader className="pb-2">
              <h2 className="text-[15px] font-semibold text-[#1D1D1F]">수상 기록</h2>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-[#F5F5F7]">
                {(data?.recentAwards ?? []).map((award) => (
                  <div key={award.id} className="py-3 flex items-center justify-between" data-testid={`row-award-${award.month}`}>
                    <div>
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{getMonthLabel(award.month)}</p>
                      <p className="text-[12px] text-[#86868B]">{award.winnerClassNum}반 우승 · {award.studentCount}명</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-semibold text-yellow-600">+{award.bonusPoints}P</p>
                      <p className="text-[11px] text-[#86868B]">{award.totalCleanplatePoints}P 획득</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 관리자: 우승 포인트 지급 */}
        {isAdmin && (
          <Card className="border-0 rounded-2xl bg-white">
            <CardContent className="pt-4 pb-4 space-y-3">
              <p className="text-[13px] font-semibold text-[#1D1D1F]">관리자 · 우승 포인트 지급</p>
              {data?.monthAward ? (
                <p className="text-[12px] text-green-600">{getMonthLabel(selectedMonth)} 포인트가 이미 지급됐습니다.</p>
              ) : (
                <>
                  <p className="text-[12px] text-[#86868B]">
                    {getMonthLabel(selectedMonth)} {user!.grade}학년 대항전 우승 반에 +200P를 지급합니다.
                    {standings.length > 0 && <span> 현재 1위: {standings[0].classNum}반 ({standings[0].totalPoints}P)</span>}
                  </p>
                  {awardError && <p className="text-[12px] text-red-500" data-testid="text-award-error">{awardError}</p>}
                  <Button
                    data-testid="button-award"
                    onClick={() => {
                      if (confirm(`${getMonthLabel(selectedMonth)} 우승 반에 포인트를 지급하시겠습니까?`)) {
                        awardMutation.mutate();
                      }
                    }}
                    disabled={awardMutation.isPending || standings.length === 0}
                    className="w-full h-11 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-[14px] font-medium"
                  >
                    {awardMutation.isPending ? "지급 중..." : "🏆 우승 포인트 지급"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-[11px] text-[#86868B] py-2">
          급식 대항전 · 매월 클린플레이트 포인트 합산 · 우승 반 전원 +200P
        </p>
      </main>
    </div>
  );
}
