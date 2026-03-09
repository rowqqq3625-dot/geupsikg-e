import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Redirect, Link } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, ExternalLink, ShieldCheck } from "lucide-react";

type SubmissionStatus = "PENDING" | "AUTO_APPROVED" | "APPROVED" | "REJECTED";

type PendingItem = {
  id: string;
  userId: string;
  schoolId: string;
  date: string;
  imageUrl: string;
  status: SubmissionStatus;
  aiScore: number | null;
  pointsAwarded: number;
  reviewNote: string | null;
  studentNumber: number;
  createdAt: string;
};

type ListResponse = { ok: boolean; submissions: PendingItem[] };

const POINT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function ReviewModal({
  item,
  onClose,
  onDone,
}: {
  item: PendingItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [selectedPoints, setSelectedPoints] = useState<number>(100);

  const reviewMutation = useMutation({
    mutationFn: async ({ act, pts }: { act: "APPROVE" | "REJECT"; pts?: number }) => {
      const res = await apiRequest("POST", `/api/admin/cleanplate/${item.id}/review`, {
        action: act,
        note: note.trim() || null,
        ...(act === "APPROVE" ? { points: pts } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cleanplate"] });
      onDone();
    },
  });

  const aiEatenPct = item.aiScore !== null ? Math.round(item.aiScore * 100) : null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="px-6 pt-6 pb-4 border-b border-[#F5F5F7]">
          <h3 className="text-[17px] font-semibold text-[#1D1D1F]">인증 검토</h3>
          <p className="text-[13px] text-[#86868B] mt-1">
            {item.date} · {item.studentNumber}번
            {aiEatenPct !== null && (
              <span className="ml-2 text-[#0071E3]">AI 추정 섭취율: {aiEatenPct}%</span>
            )}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* 이미지 미리보기 */}
          <div className="rounded-xl overflow-hidden bg-[#F5F5F7] aspect-video max-h-48">
            <img
              src={item.imageUrl}
              alt="제출 사진"
              className="w-full h-full object-cover"
              data-testid="img-admin-preview"
            />
          </div>

          <a
            href={item.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[13px] text-[#0071E3]"
            data-testid="link-full-image"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            원본 이미지 보기
          </a>

          {/* 포인트 선택 (승인 시) */}
          <div>
            <p className="text-[13px] font-medium text-[#86868B] mb-2">
              승인 포인트 선택
              <span className="ml-2 text-[11px] text-[#86868B]">10점 단위</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POINT_OPTIONS.map((pt) => (
                <button
                  key={pt}
                  data-testid={`btn-points-${pt}`}
                  onClick={() => setSelectedPoints(pt)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                    selectedPoints === pt
                      ? "bg-[#0071E3] text-white border-[#0071E3]"
                      : "bg-[#F5F5F7] text-[#1D1D1F] border-[#D2D2D7] hover:border-[#0071E3]"
                  }`}
                >
                  {pt}P
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#86868B] mb-2">검토 노트 (선택)</p>
            <Textarea
              data-testid="input-review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="학생에게 전달할 메모를 입력하세요..."
              className="rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[14px] resize-none"
              rows={2}
              maxLength={500}
            />
          </div>

          {reviewMutation.isError && (
            <p className="text-[13px] text-red-500" data-testid="text-review-error">
              처리에 실패했습니다. 다시 시도해주세요.
            </p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2.5">
          <Button
            data-testid="button-reject"
            disabled={reviewMutation.isPending}
            variant="outline"
            onClick={() => reviewMutation.mutate({ act: "REJECT" })}
            className="flex-1 h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            반려
          </Button>
          <Button
            data-testid="button-approve"
            disabled={reviewMutation.isPending}
            onClick={() => reviewMutation.mutate({ act: "APPROVE", pts: selectedPoints })}
            className="flex-1 h-12 rounded-xl bg-[#0071E3] text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            승인 (+{selectedPoints}P)
          </Button>
        </div>

        <div className="px-6 pb-5">
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full h-10 rounded-xl text-[#86868B] text-[14px]"
          >
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCleanplatePage() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);

  const { data, isLoading: listLoading } = useQuery<ListResponse>({
    queryKey: ["/api/admin/cleanplate"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cleanplate?status=PENDING", { credentials: "include" });
      return res.json();
    },
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7]">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!isAdmin) return <Redirect to="/dashboard" />;

  const submissions = data?.submissions ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F7]" data-testid="page-admin-cleanplate">
      {selectedItem && (
        <ReviewModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDone={() => setSelectedItem(null)}
        />
      )}

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
            <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
            <div>
              <h1 className="text-[15px] font-semibold text-[#1D1D1F]">관리자 · 클린플레이트 검토</h1>
              <p className="text-[12px] text-[#86868B]">{user?.schoolName}</p>
            </div>
          </div>
          <span className="text-[12px] text-[#86868B] flex-shrink-0">
            대기 {submissions.length}건
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        <Card className="border-0 rounded-2xl bg-white">
          <CardHeader className="pb-2">
            <h2 className="text-[15px] font-semibold text-[#1D1D1F]">대기중 인증</h2>
          </CardHeader>
          <CardContent className="pt-0">
            {listLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
                <p className="text-[14px] text-[#86868B]">검토 대기 중인 인증이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F7]">
                {submissions.map((item, i) => (
                  <div
                    key={item.id}
                    data-testid={`row-pending-${i}`}
                    className="py-3.5 flex items-center gap-3"
                  >
                    {/* 썸네일 */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F5F5F7] flex-shrink-0">
                      <img
                        src={item.imageUrl}
                        alt="제출 사진"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{item.date}</p>
                      <p className="text-[12px] text-[#86868B]">
                        {item.studentNumber}번
                        {item.aiScore !== null && (
                          <span className="ml-2 text-[#0071E3]">
                            AI {(item.aiScore * 100).toFixed(0)}점
                          </span>
                        )}
                      </p>
                    </div>

                    <Button
                      data-testid={`button-review-${i}`}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedItem(item)}
                      className="rounded-xl border-[#D2D2D7] text-[13px] flex-shrink-0"
                    >
                      검토
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center py-4">
          <p className="text-[11px] text-[#86868B]">30초마다 자동 갱신 · 승인 시 선택 포인트 지급 (10~100P)</p>
        </div>
      </main>
    </div>
  );
}
