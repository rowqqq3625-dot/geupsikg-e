import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ALLERGY_OPTIONS } from "@shared/schema";
import { Redirect, Link, useLocation } from "wouter";
import { useNetwork } from "@/hooks/use-network";
import {
  UtensilsCrossed,
  Star,
  Clock,
  Users,
  LogOut,
  MessageSquare,
  Trophy,
  TrendingUp,
  X,
  CheckCircle2,
  Camera,
  ShieldCheck,
  Bell,
  ShieldAlert,
  Swords,
  ShoppingBag,
  WifiOff,
} from "lucide-react";

type MealData = { ok: boolean; date: string; menuText: string; source: "cache" | "neis" | "mock"; mealImageUrl?: string | null };
type FeedbackResponse = { ok: boolean; feedbackId: string; newPoints: number };

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-[#D2D2D7]"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function FeedbackModal({
  date,
  onClose,
  onSuccess,
}: {
  date: string;
  onClose: () => void;
  onSuccess: (newPoints: number) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feedback", { date, rating, comment: comment.trim() || null });
      return res.json() as Promise<FeedbackResponse>;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      onSuccess(data.newPoints);
    },
  });

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#0071E3] mx-auto mb-4" />
          <h3 className="text-[18px] font-semibold text-[#1D1D1F] mb-2">평가 완료!</h3>
          <p className="text-[14px] text-[#86868B] mb-6">+30 포인트 적립되었습니다.</p>
          <Button onClick={onClose} className="w-full h-12 rounded-xl bg-[#0071E3] text-white">
            확인
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F5F5F7]">
          <h3 className="text-[17px] font-semibold text-[#1D1D1F]">오늘 급식 평가</h3>
          <button type="button" onClick={onClose} className="text-[#86868B]" data-testid="button-close-modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-[13px] font-medium text-[#86868B] mb-3">맛 평가 (1~5점)</p>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#86868B] mb-2">건의사항 (선택)</p>
            <Textarea
              data-testid="input-feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="오늘 급식에 대한 의견을 남겨주세요..."
              className="rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[14px] resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-[11px] text-[#86868B] mt-1 text-right">{comment.length}/500</p>
          </div>

          {feedbackMutation.isError && (
            <p className="text-[13px] text-red-500" data-testid="text-feedback-error">
              {feedbackMutation.error instanceof Error
                ? feedbackMutation.error.message.includes("409")
                  ? "오늘 평가는 이미 제출했습니다."
                  : "제출에 실패했습니다."
                : "제출에 실패했습니다."}
            </p>
          )}
        </div>

        <div className="px-6 pb-6">
          <Button
            data-testid="button-submit-feedback"
            disabled={rating === 0 || feedbackMutation.isPending}
            onClick={() => feedbackMutation.mutate()}
            className="w-full h-12 rounded-xl bg-[#0071E3] text-white text-[15px] font-medium"
          >
            {feedbackMutation.isPending ? "제출 중..." : "평가 제출 (+30P)"}
          </Button>
          {rating === 0 && (
            <p className="text-[12px] text-[#86868B] text-center mt-2">별점을 선택해주세요</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated, isAdmin, logout } = useAuth();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { isOnline } = useNetwork();

  useEffect(() => {
    if (isOnline) {
      queryClient.invalidateQueries();
    }
  }, [isOnline]);

  const { data: mealData } = useQuery<MealData>({
    queryKey: ["/api/meals/today"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });

  const { data: notifData } = useQuery<{ ok: true; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    queryFn: () => fetch("/api/notifications?limit=1", { credentials: "include" }).then((r) => r.json()),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (!isAuthenticated) return <Redirect to="/login" />;

  const displayPoints = currentPoints ?? user!.points;
  const today = new Date().toISOString().split("T")[0];
  const todayKr = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  const userLabel = `${user!.schoolName} · ${user!.grade}학년 ${user!.classNum}반 · ${user!.studentNumber}번`;

  const menuItems = mealData?.menuText ? mealData.menuText.split(" · ") : [];
  const userAllergyIds = user!.allergies ?? [];
  const ALLERGY_NEIS_MAP: Record<string, string[]> = {
    "1": ["난류", "계란"], "2": ["우유"], "3": ["메밀"], "4": ["땅콩"],
    "5": ["대두", "콩"], "6": ["밀"], "7": ["고등어"], "8": ["게"],
    "9": ["새우"], "10": ["돼지"], "11": ["복숭아"], "12": ["토마토"],
    "13": ["아황산"], "14": ["호두"], "15": ["닭고기"], "16": ["쇠고기"],
    "17": ["오징어"], "18": ["조개"],
  };

  const matchedAllergies = userAllergyIds.filter((id) => {
    const keywords = ALLERGY_NEIS_MAP[id] ?? [];
    return menuItems.some((item) => keywords.some((kw) => item.includes(kw)));
  }).map((id) => ALLERGY_OPTIONS.find((o) => o.id === id)?.label ?? id);

  const congestionInfo = (() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const totalMins = h * 60 + m;
    const t = (hh: number, mm: number) => hh * 60 + mm;
    if (totalMins >= t(12, 0) && totalMins < t(12, 20)) {
      return { statusLabel: "매우 혼잡", badgeClass: "bg-red-50 text-red-700", waitTime: "약 25분", bestTime: "12:30" };
    } else if ((totalMins >= t(11, 30) && totalMins < t(12, 0)) || (totalMins >= t(12, 20) && totalMins < t(13, 0))) {
      return { statusLabel: "혼잡 예상", badgeClass: "bg-orange-50 text-orange-700", waitTime: "약 15분", bestTime: "12:30" };
    } else if (totalMins >= t(13, 0) && totalMins < t(13, 30)) {
      return { statusLabel: "약간 여유", badgeClass: "bg-yellow-50 text-yellow-700", waitTime: "약 8분", bestTime: "13:15" };
    } else {
      return { statusLabel: "여유 있어요", badgeClass: "bg-green-50 text-green-700", waitTime: "약 3분", bestTime: "12:15" };
    }
  })();

  return (
    <div className="min-h-screen bg-[#F5F5F7]" data-testid="page-dashboard">
      {showFeedbackModal && (
        <FeedbackModal
          date={today}
          onClose={() => setShowFeedbackModal(false)}
          onSuccess={(pts) => {
            setCurrentPoints(pts);
            setShowFeedbackModal(false);
            queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          }}
        />
      )}

      <header className="bg-white/90 backdrop-blur-xl border-b border-[#D2D2D7]/50 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-[#1D1D1F]" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#1D1D1F] truncate" data-testid="text-user-identity">
                {userLabel}
              </p>
              <p className="text-[12px] text-[#86868B]">{todayKr}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              data-testid="btn-notifications"
              onClick={() => navigate("/notifications")}
              className="relative p-2 rounded-xl hover:bg-[#F5F5F7] transition-colors"
            >
              <Bell className="w-4 h-4 text-[#86868B]" />
              {notifData && notifData.unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {notifData.unreadCount > 9 ? "9+" : notifData.unreadCount}
                </span>
              )}
            </button>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-logout"
              onClick={() => logout.mutate()}
              className="text-[#86868B] text-[13px] flex-shrink-0"
            >
              <LogOut className="w-4 h-4 mr-1" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* 오프라인 배너 */}
      {!isOnline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 flex items-center gap-2" data-testid="banner-offline">
          <WifiOff className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-xs text-yellow-700 font-medium">오프라인 · 마지막 데이터를 표시합니다</p>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* 오늘의 급식 카드 */}
        <Card className="border-0 rounded-2xl bg-white" data-testid="card-meals">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#1D1D1F]">오늘의 급식</h2>
                <p className="text-[12px] text-[#86868B]">
                  {mealData?.source === "neis" ? "NEIS 실데이터" : mealData?.source === "cache" ? "캐시" : "기본 메뉴"}
                </p>
              </div>
            </div>
            {mealData?.source === "mock" && (
              <Badge variant="secondary" className="text-[11px] bg-[#F5F5F7] text-[#86868B] flex-shrink-0">
                샘플
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {mealData ? (
              <>
                {/* AI 급식 이미지 미리보기 */}
                {mealData.mealImageUrl ? (
                  <div className="rounded-xl overflow-hidden mb-4 w-full bg-[#F5F5F7]" style={{ aspectRatio: "4/3" }} data-testid="img-meal-preview-container">
                    <img
                      src={mealData.mealImageUrl}
                      alt="오늘의 급식 AI 이미지"
                      data-testid="img-meal-preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden mb-4 w-full bg-[#F5F5F7] flex flex-col items-center justify-center gap-2" style={{ aspectRatio: "4/3" }} data-testid="img-meal-placeholder">
                    <UtensilsCrossed className="w-8 h-8 text-[#C7C7CC]" />
                    <p className="text-[12px] text-[#C7C7CC]">AI 급식 이미지 생성 중…</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {menuItems.map((item, i) => (
                    <span key={i} className="inline-block px-3 py-1.5 bg-[#F5F5F7] rounded-lg text-[13px] text-[#1D1D1F]" data-testid={`text-menu-item-${i}`}>
                      {item}
                    </span>
                  ))}
                </div>
                {matchedAllergies.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-red-50 rounded-xl">
                    <span className="text-[12px] text-red-600 font-medium">알레르기 주의:</span>
                    {matchedAllergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-[11px]">{a}</Badge>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 rounded-xl">
                    <p className="text-[12px] text-green-700">오늘 급식에 해당하는 알레르기 항목이 없습니다.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="w-full rounded-xl bg-[#F5F5F7] animate-pulse" style={{ aspectRatio: "4/3" }} />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 포인트 카드 */}
        <Card className="border-0 rounded-2xl bg-white" data-testid="card-points">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#1D1D1F]">내 포인트</h2>
                <p className="text-[12px] text-[#86868B]">평가·참여로 포인트 적립</p>
              </div>
            </div>
            <span className="text-[24px] font-bold text-[#1D1D1F] tabular-nums" data-testid="text-points">
              {displayPoints}P
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                data-testid="button-feedback"
                onClick={() => setShowFeedbackModal(true)}
                className="h-auto py-3 rounded-xl border-[#D2D2D7] flex flex-col items-center gap-1.5"
              >
                <MessageSquare className="w-5 h-5 text-[#0071E3]" />
                <span className="text-[12px] font-medium text-[#1D1D1F]">평가 및 건의</span>
                <span className="text-[11px] text-[#86868B]">+30P</span>
              </Button>
              <Link href="/ranking">
                <Button
                  variant="outline"
                  data-testid="button-ranking"
                  className="w-full h-auto py-3 rounded-xl border-[#D2D2D7] flex flex-col items-center gap-1.5"
                >
                  <Trophy className="w-5 h-5 text-[#0071E3]" />
                  <span className="text-[12px] font-medium text-[#1D1D1F]">랭킹 보기</span>
                  <span className="text-[11px] text-[#86868B]">반/학교</span>
                </Button>
              </Link>
              <Link href="/cleanplate" className="col-span-2">
                <Button
                  variant="outline"
                  data-testid="button-cleanplate"
                  className="w-full h-auto py-3 rounded-xl border-[#D2D2D7] flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5 text-green-600" />
                  <span className="text-[13px] font-medium text-[#1D1D1F]">잔반제로 도전하기</span>
                  <span className="text-[11px] text-[#86868B]">+100P</span>
                </Button>
              </Link>
              <Link href="/store" className="col-span-2">
                <Button
                  variant="outline"
                  data-testid="button-store"
                  className="w-full h-auto py-3 rounded-xl border-[#D2D2D7] flex items-center justify-center gap-2 border-blue-100 bg-blue-50 hover:bg-blue-100"
                >
                  <ShoppingBag className="w-5 h-5 text-blue-500" />
                  <span className="text-[13px] font-medium text-[#1D1D1F]">포인트 스토어</span>
                  <span className="text-[11px] text-[#86868B]">포인트로 교환</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 급식실 현황 카드 */}
        <Card className="border-0 rounded-2xl bg-white" data-testid="card-congestion">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#1D1D1F]">급식실 현황</h2>
                <p className="text-[12px] text-[#86868B]">최적 입장 시간 안내</p>
              </div>
            </div>
            <Badge
              variant="secondary"
              data-testid="badge-congestion-status"
              className={`text-[11px] ${congestionInfo.badgeClass}`}
            >
              {congestionInfo.statusLabel}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between p-3 bg-[#F5F5F7] rounded-xl mb-2.5">
              <div>
                <p className="text-[13px] font-medium text-[#1D1D1F]">예상 대기시간</p>
                <p className="text-[12px] text-[#86868B]">시간대 기반 예측</p>
              </div>
              <span className="text-[20px] font-bold text-[#1D1D1F]" data-testid="text-wait-time">{congestionInfo.waitTime}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div>
                <p className="text-[13px] font-medium text-[#1D1D1F]">추천 입장 시간</p>
                <p className="text-[12px] text-[#86868B]">혼잡 최소 시간대</p>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#0071E3]" />
                <span className="text-[15px] font-semibold text-[#0071E3]">{congestionInfo.bestTime}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 바로가기 — 급식메이트 · 급식 대항전 */}
        <Card className="border-0 rounded-2xl bg-white" data-testid="card-quicklinks">
          <CardHeader className="pb-3">
            <p className="text-[13px] font-semibold text-[#1D1D1F]">바로가기</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/buddy">
                <Button
                  variant="outline"
                  data-testid="button-buddy-quicklink"
                  className="w-full h-auto py-3.5 rounded-xl border-[#D2D2D7] flex flex-col items-center gap-1.5 hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  <Users className="w-5 h-5 text-purple-500" />
                  <span className="text-[12px] font-medium text-[#1D1D1F]">급식메이트</span>
                  <span className="text-[11px] text-[#86868B]">+100P</span>
                </Button>
              </Link>
              <Link href="/class-battle">
                <Button
                  variant="outline"
                  data-testid="button-class-battle-quicklink"
                  className="w-full h-auto py-3.5 rounded-xl border-[#D2D2D7] flex flex-col items-center gap-1.5 hover:border-yellow-300 hover:bg-yellow-50 transition-all"
                >
                  <Swords className="w-5 h-5 text-yellow-500" />
                  <span className="text-[12px] font-medium text-[#1D1D1F]">급식 대항전</span>
                  <span className="text-[11px] text-[#86868B]">반 순위 보기</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-[#86868B] px-1">관리자 메뉴</p>
            <Link href="/admin/cleanplate">
              <Button
                variant="outline"
                data-testid="button-admin-cleanplate"
                className="w-full h-auto py-3 rounded-xl border-[#D2D2D7] flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
                <span className="text-[13px] font-medium text-[#1D1D1F]">클린플레이트 검토</span>
              </Button>
            </Link>
            <Link href="/admin/moderation">
              <Button
                variant="outline"
                data-testid="button-admin-moderation"
                className="w-full h-auto py-3 rounded-xl border-[#D2D2D7] flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span className="text-[13px] font-medium text-[#1D1D1F]">신고 및 모더레이션</span>
              </Button>
            </Link>
            <Link href="/admin/store">
              <Button
                variant="outline"
                data-testid="button-admin-store"
                className="w-full h-auto py-3 rounded-xl border-[#D2D2D7] flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4 text-blue-500" />
                <span className="text-[13px] font-medium text-[#1D1D1F]">포인트 스토어 관리</span>
              </Button>
            </Link>
          </div>
        )}

        <div className="text-center py-3">
          <p className="text-[11px] text-[#86868B]">급식E v7.1 · Ship-ready 품질 보정</p>
        </div>
      </main>
    </div>
  );
}
