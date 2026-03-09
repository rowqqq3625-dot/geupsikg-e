import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Redirect, Link } from "wouter";
import { ArrowLeft, Camera, CheckCircle2, Clock, XCircle, UploadCloud, Loader2, ShieldAlert } from "lucide-react";

type SubmissionStatus = "PENDING" | "AUTO_APPROVED" | "APPROVED" | "REJECTED";

type Submission = {
  id: string;
  status: SubmissionStatus;
  imageUrl: string;
  date: string;
  aiScore: number | null;
  pointsAwarded: number;
  createdAt: string;
};

type TodayResponse = {
  ok: boolean;
  submissions: Submission[];
  count: number;
  limit: number;
  canSubmit: boolean;
  nextSubmitAt: string | null;
};

type HistoryResponse = { ok: boolean; history: Submission[] };
type UploadResponse = {
  ok: boolean;
  submission: Submission;
  verdict: "APPROVE" | "PARTIAL" | "REJECT_UNTOUCHED" | "REVIEW";
  eatenPercent: number;
  pointsDelta: number;
  newPoints: number;
};

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { label: string; className: string }> = {
    PENDING:        { label: "검토중",       className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    AUTO_APPROVED:  { label: "자동 승인 ✓",  className: "bg-green-50 text-green-700 border-green-200" },
    APPROVED:       { label: "승인 ✓",       className: "bg-green-50 text-green-700 border-green-200" },
    REJECTED:       { label: "미승인",       className: "bg-red-50 text-red-600 border-red-200" },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-medium border ${className}`}>
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: SubmissionStatus }) {
  if (status === "AUTO_APPROVED" || status === "APPROVED") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === "REJECTED") return <XCircle className="w-5 h-5 text-red-400" />;
  return <Clock className="w-5 h-5 text-yellow-500" />;
}

function CooldownTimer({ nextSubmitAt }: { nextSubmitAt: string }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(nextSubmitAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/today"] });
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [nextSubmitAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl" data-testid="text-cooldown">
      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
      <p className="text-[13px] text-amber-700">
        다음 인증까지 <span className="font-semibold tabular-nums">{mins}분 {String(secs).padStart(2, "0")}초</span> 남았습니다.
      </p>
    </div>
  );
}

function CleanPlateSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

export default function CleanPlatePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ pointsDelta: number; newPoints: number; status: SubmissionStatus; verdict?: string; eatenPercent?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: todayData, isLoading: todayLoading } = useQuery<TodayResponse>({
    queryKey: ["/api/cleanplate/today"],
    enabled: isAuthenticated,
    refetchInterval: (q) => {
      const data = q.state.data;
      return data?.nextSubmitAt ? 5000 : false;
    },
  });

  const { data: historyData } = useQuery<HistoryResponse>({
    queryKey: ["/api/cleanplate/history"],
    queryFn: async () => {
      const res = await fetch("/api/cleanplate/history?days=7", { credentials: "include" });
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/cleanplate/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const err = new Error(json.error?.message ?? "업로드 실패");
        (err as any).code = json.error?.code;
        throw err;
      }
      return json as UploadResponse;
    },
    onSuccess: (data) => {
      setUploadError(null);
      setUploadResult({ pointsDelta: data.pointsDelta, newPoints: data.newPoints, status: data.submission.status, verdict: data.verdict, eatenPercent: data.eatenPercent });
      queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "업로드에 실패했습니다.";
      const code = (err as any)?.code as string | undefined;
      setUploadError(msg);
      // 부정행위 감지 시: DB에 쿨타임 기록이 저장됐으므로 today 캐시 갱신
      if (code === "DUPLICATE_IMAGE") {
        queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/today"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/history"] });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7]">
        <div className="max-w-2xl mx-auto px-4 py-8"><CleanPlateSkeleton /></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;

  const today = new Date().toISOString().split("T")[0];
  const todaySubmissions = todayData?.submissions ?? [];
  const count = todayData?.count ?? 0;
  const limit = todayData?.limit ?? 2;
  const canSubmit = todayData?.canSubmit ?? true;
  const nextSubmitAt = todayData?.nextSubmitAt ?? null;
  const history = historyData?.history ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]" data-testid="page-cleanplate">
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
          <div className="flex-1">
            <h1 className="text-[15px] font-semibold text-[#1D1D1F]">클린플레이트 인증</h1>
            <p className="text-[12px] text-[#86868B]">잔반 없이 다 먹으면 +100P</p>
          </div>
          {/* 일일 진행 뱃지 */}
          {!todayLoading && (
            <div
              data-testid="text-daily-progress"
              className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold tabular-nums ${
                count >= limit
                  ? "bg-green-50 text-green-700"
                  : "bg-[#F5F5F7] text-[#1D1D1F]"
              }`}
            >
              {count}/{limit} 완료
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* 오늘 인증 카드 */}
        <Card className="border-0 rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center gap-2.5 pb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Camera className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1D1D1F]">오늘 인증</h2>
              <p className="text-[12px] text-[#86868B]">{today} · 하루 최대 {limit}회</p>
            </div>
          </CardHeader>

          <CardContent className="pt-0 space-y-3">
            {todayLoading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : (
              <>
                {/* 제출된 인증 목록 */}
                {todaySubmissions.length > 0 && (
                  <div className="space-y-3">
                    {todaySubmissions.map((s, i) => (
                      <div key={s.id} data-testid={`card-submission-today-${i}`} className="space-y-2">
                        <div className="relative overflow-hidden rounded-xl bg-[#F5F5F7] aspect-video max-h-44">
                          <img
                            src={s.imageUrl}
                            alt={`${i + 1}번째 클린플레이트 사진`}
                            className="w-full h-full object-cover"
                            data-testid={`img-cleanplate-${i}`}
                          />
                          <span className="absolute top-2 left-2 bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-lg">
                            {i + 1}번째 인증
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusIcon status={s.status} />
                            <StatusBadge status={s.status} />
                          </div>
                          {(s.status === "AUTO_APPROVED" || s.status === "APPROVED") && (
                            <span className="text-[13px] font-semibold text-green-600" data-testid={`text-points-${i}`}>
                              +{s.pointsAwarded}P 적립
                            </span>
                          )}
                        </div>
                        {s.status === "PENDING" && (
                          <p className="text-[12px] text-[#86868B] bg-yellow-50 rounded-xl p-2.5">
                            관리자 검토 중입니다. 승인되면 포인트가 적립됩니다.
                          </p>
                        )}
                        {s.status === "REJECTED" && (
                          <p className="text-[12px] text-red-500 bg-red-50 rounded-xl p-2.5">
                            인증이 반려되었습니다.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 업로드 직후 결과 */}
                {uploadResult && (
                  <div className={`p-3 rounded-xl ${uploadResult.status === "AUTO_APPROVED" ? "bg-blue-50" : uploadResult.verdict === "REJECT_UNTOUCHED" ? "bg-orange-50" : uploadResult.status === "REJECTED" ? "bg-red-50" : "bg-yellow-50"}`}>
                    {uploadResult.status === "AUTO_APPROVED" && uploadResult.verdict === "APPROVE" ? (
                      <p className="text-[13px] text-[#0071E3] font-medium">
                        🎉 완식 인증! +{uploadResult.pointsDelta}P → 총 {uploadResult.newPoints}P
                      </p>
                    ) : uploadResult.status === "AUTO_APPROVED" && uploadResult.verdict === "PARTIAL" ? (
                      <div>
                        <p className="text-[13px] text-[#0071E3] font-medium">
                          ✅ 부분 섭취 인증! +{uploadResult.pointsDelta}P → 총 {uploadResult.newPoints}P
                        </p>
                        <p className="text-[12px] text-[#0071E3]/70 mt-0.5">
                          AI 판정 섭취율 약 {uploadResult.eatenPercent}% · 10점 단위 지급
                        </p>
                      </div>
                    ) : uploadResult.verdict === "REJECT_UNTOUCHED" ? (
                      <div>
                        <p className="text-[13px] text-orange-600 font-medium">반환 처리됐습니다.</p>
                        <p className="text-[12px] text-orange-500 mt-0.5">음식을 먹은 뒤 사진을 다시 찍어 올려주세요!</p>
                      </div>
                    ) : uploadResult.status === "REJECTED" ? (
                      <p className="text-[13px] text-red-500">인증이 반려됐습니다. 재도전해보세요!</p>
                    ) : (
                      <p className="text-[13px] text-[#86868B]">사진이 제출됐습니다. 관리자 검토 후 포인트가 적립됩니다.</p>
                    )}
                  </div>
                )}

                {/* 업로드 UI or 차단 메시지 */}
                {count >= limit ? (
                  /* 일일 한도 완료 */
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl" data-testid="text-limit-reached">
                    <ShieldAlert className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-[13px] text-green-700 font-medium">
                      오늘 인증을 모두 완료했습니다! 내일 다시 도전하세요.
                    </p>
                  </div>
                ) : nextSubmitAt ? (
                  /* 쿨다운 중 */
                  <CooldownTimer nextSubmitAt={nextSubmitAt} />
                ) : (
                  /* 업로드 가능 */
                  <div className="space-y-3">
                    <div
                      onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
                      data-testid="button-upload-area"
                      className={`border-2 border-dashed border-[#D2D2D7] rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                        uploadMutation.isPending ? "opacity-60 cursor-not-allowed" : "hover:border-[#0071E3] hover:bg-blue-50/30"
                      }`}
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="w-10 h-10 text-[#0071E3] animate-spin" />
                          <p className="text-[14px] font-medium text-[#1D1D1F]">업로드 중...</p>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-10 h-10 text-[#86868B]" />
                          <div className="text-center">
                            <p className="text-[14px] font-medium text-[#1D1D1F]">
                              {count === 0 ? "첫 번째 사진 업로드" : "두 번째 사진 업로드"}
                            </p>
                            <p className="text-[12px] text-[#86868B] mt-1">빈 식판 사진을 찍어 올려주세요</p>
                            <p className="text-[11px] text-[#86868B] mt-0.5">JPEG · PNG · WEBP · 최대 5MB</p>
                          </div>
                        </>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      data-testid="input-file-upload"
                      onChange={handleFileChange}
                    />

                    {uploadError && (
                      <p className="text-[13px] text-red-500" data-testid="text-upload-error">
                        {uploadError}
                      </p>
                    )}

                    <Button
                      data-testid="button-trigger-upload"
                      disabled={uploadMutation.isPending}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-12 rounded-xl bg-[#0071E3] text-white text-[15px] font-medium"
                    >
                      {uploadMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />업로드 중...</>
                      ) : (
                        <><Camera className="w-4 h-4 mr-2" />사진 선택하기</>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 부정행위 방지 안내 */}
        <Card className="border-0 rounded-2xl bg-[#FFF9F0]">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[13px] font-medium text-[#1D1D1F]">인증 정책</p>
                <ul className="text-[12px] text-[#86868B] space-y-0.5 list-none">
                  <li>· 하루 최대 2회 인증 가능</li>
                  <li>· 잔반 감지 시 즉시 재도전 가능 (쿨타임 없음)</li>
                  <li>· 승인 완료 후 30분 쿨타임 적용</li>
                  <li>· 동일 사진 재업로드 시 부정행위로 간주 → 쿨타임 + 횟수 차감</li>
                  <li>· AI 판정 후 관리자 검토 진행</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 최근 7일 기록 */}
        <Card className="border-0 rounded-2xl bg-white">
          <CardHeader className="pb-3">
            <h2 className="text-[15px] font-semibold text-[#1D1D1F]">최근 기록</h2>
          </CardHeader>
          <CardContent className="pt-0">
            {history.length === 0 ? (
              <p className="text-[13px] text-[#86868B] text-center py-4">최근 7일 기록이 없습니다.</p>
            ) : (
              <div className="divide-y divide-[#F5F5F7]">
                {history.map((item, i) => (
                  <div
                    key={item.id}
                    data-testid={`row-history-${i}`}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{item.date}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="text-right">
                      {(item.status === "AUTO_APPROVED" || item.status === "APPROVED") ? (
                        <span className="text-[13px] font-semibold text-green-600">+{item.pointsAwarded}P</span>
                      ) : item.status === "REJECTED" ? (
                        <span className="text-[13px] text-[#86868B]">0P</span>
                      ) : (
                        <span className="text-[13px] text-yellow-600">검토중</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
