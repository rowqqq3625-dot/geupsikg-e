import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, ShieldCheck, Utensils } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";

type BuddyStatus =
  | { ok: true; state: "IDLE" }
  | { ok: true; state: "WAITING"; preference: "LESS" | "MORE" }
  | { ok: true; state: "MATCHED"; matchId: string };

export default function BuddyPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<BuddyStatus>({
    queryKey: ["/api/buddy/status"],
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      return d.state === "WAITING" ? 3000 : false;
    },
  });

  const joinMutation = useMutation({
    mutationFn: (preference: "LESS" | "MORE") =>
      apiRequest("POST", "/api/buddy/join", { preference }),
    onSuccess: async (res) => {
      const json = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/status"] });
      if (json.state === "MATCHED" && json.matchId) {
        navigate(`/buddy/match/${json.matchId}`);
      }
    },
    onError: async (err: any) => {
      let msg = "참가에 실패했습니다.";
      try {
        const json = await err.response?.json();
        msg = json?.error?.message ?? msg;
      } catch {}
      toast({ title: "오류", description: msg, variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/buddy/leave", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/status"] });
      toast({ title: "취소됨", description: "매칭 대기를 취소했습니다." });
    },
  });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;

  const state = data?.state ?? "IDLE";

  if (isLoading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* 헤더 */}
        <button
          data-testid="btn-back"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          대시보드
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Utensils className="w-7 h-7 text-orange-500" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 tracking-tight">
            급식메이트
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          급식을 너무 많이 받았거나 적게 받은 친구와 연결돼요
        </p>

        {/* 상태: 미참여 */}
        {state === "IDLE" && (
          <div className="space-y-6">
            {/* 안전 배지 */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <ShieldCheck className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">익명·안전 매칭</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  같은 학교·학년 내에서만 연결되며, 이름과 학번은 서로 동의해야만 공개돼요.
                </p>
              </div>
            </div>

            {/* 매칭 참가 버튼 */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                오늘 급식이 어때요?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  data-testid="btn-join-less"
                  variant="outline"
                  size="lg"
                  className="h-24 flex-col gap-2 rounded-2xl border-2 text-base font-medium hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all"
                  onClick={() => joinMutation.mutate("LESS")}
                  disabled={joinMutation.isPending}
                >
                  {joinMutation.isPending && joinMutation.variables === "LESS" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="text-2xl">😔</span>
                  )}
                  <span>적게 먹을래요</span>
                </Button>
                <Button
                  data-testid="btn-join-more"
                  variant="outline"
                  size="lg"
                  className="h-24 flex-col gap-2 rounded-2xl border-2 text-base font-medium hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950 transition-all"
                  onClick={() => joinMutation.mutate("MORE")}
                  disabled={joinMutation.isPending}
                >
                  {joinMutation.isPending && joinMutation.variables === "MORE" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="text-2xl">😋</span>
                  )}
                  <span>많이 먹을래요</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-center">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-400">매칭 성공 시 +100P 지급</p>
            </div>
          </div>
        )}

        {/* 상태: 대기중 */}
        {state === "WAITING" && (
          <div className="space-y-6 text-center">
            <Card className="rounded-3xl border-0 bg-white dark:bg-gray-900 shadow-sm">
              <CardContent className="py-10 px-8">
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">
                  매칭 중이에요…
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  같은 학교·학년 내에서 상대를 찾고 있어요.
                  <br />
                  잠시만 기다려주세요.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  {data?.state === "WAITING"
                    ? data.preference === "LESS"
                      ? "적게 먹을래요로 대기 중"
                      : "많이 먹을래요로 대기 중"
                    : ""}
                </p>
              </CardContent>
            </Card>

            <Button
              data-testid="btn-cancel-queue"
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-500"
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
            >
              {leaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              매칭 취소하기
            </Button>
          </div>
        )}

        {/* 상태: 매칭됨 */}
        {state === "MATCHED" && data?.state === "MATCHED" && (
          <div className="space-y-6 text-center">
            <Card className="rounded-3xl border-0 bg-white dark:bg-gray-900 shadow-sm">
              <CardContent className="py-10 px-8">
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center text-3xl">
                    🎉
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">
                  매칭 완료!
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  익명 학생과 연결됐어요.
                  <br />
                  채팅으로 인사해보세요.
                </p>
              </CardContent>
            </Card>

            <Button
              data-testid="btn-go-chat"
              size="lg"
              className="w-full rounded-2xl h-12 text-base font-medium"
              onClick={() => navigate(`/buddy/match/${data.matchId}`)}
            >
              채팅 시작하기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
