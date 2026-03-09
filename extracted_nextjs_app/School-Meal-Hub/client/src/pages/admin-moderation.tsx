import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, ShieldAlert, Clock } from "lucide-react";
import { useLocation, Redirect } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Report = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  matchId: string | null;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reporterStudentNum: number;
  reportedStudentNum: number;
  schoolId: string;
};

const REASON_LABELS: Record<string, string> = {
  HARASSMENT: "괴롭힘·욕설",
  SPAM: "스팸·도배",
  PRIVACY: "개인정보 요구",
  INAPPROPRIATE: "부적절한 내용",
  OTHER: "기타",
};

const ACTION_LABELS: Record<string, string> = {
  WARN: "경고",
  SUSPEND_MATCHING_7D: "매칭 7일 정지",
  SUSPEND_ACCOUNT_7D: "계정 7일 정지",
  BAN: "영구 차단",
};

const ACTION_VARIANTS: Record<string, "destructive" | "outline" | "secondary" | "default"> = {
  WARN: "outline",
  SUSPEND_MATCHING_7D: "secondary",
  SUSPEND_ACCOUNT_7D: "destructive",
  BAN: "destructive",
};

export default function AdminModerationPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedAction, setSelectedAction] = useState("WARN");
  const [actionNote, setActionNote] = useState("");

  const { data, isLoading } = useQuery<{ ok: true; reports: Report[] }>({
    queryKey: ["/api/admin/reports"],
    queryFn: () => fetch("/api/admin/reports", { credentials: "include" }).then((r) => r.json()),
    enabled: !!user && user.role === "ADMIN",
  });

  const actionMutation = useMutation({
    mutationFn: ({ reportId, action, note, targetUserId }: {
      reportId: string; action: string; note?: string; targetUserId: string;
    }) =>
      apiRequest("POST", `/api/admin/reports/${reportId}/action`, { action, note, targetUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      setSelectedReport(null);
      setActionNote("");
      toast({ title: "조치 완료", description: "신고에 대한 조치가 처리됐습니다." });
    },
    onError: async (err: any) => {
      let msg = "처리에 실패했습니다.";
      try {
        const json = await err.response?.json();
        msg = json?.error?.message ?? msg;
      } catch {}
      toast({ title: "오류", description: msg, variant: "destructive" });
    },
  });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role !== "ADMIN") return <Redirect to="/dashboard" />;

  const reports = data?.reports ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
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
          <ShieldAlert className="w-7 h-7 text-red-500" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 tracking-tight">
            신고 관리
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          처리 대기 중인 신고 목록입니다.
        </p>

        {/* 신고 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">처리 대기 중인 신고가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                data-testid={`report-card-${report.id}`}
                onClick={() => {
                  setSelectedReport(report);
                  setSelectedAction("WARN");
                  setActionNote("");
                }}
                className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-5 py-4 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {REASON_LABELS[report.reason] ?? report.reason}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {report.reportedStudentNum}번 학생 신고됨
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {new Date(report.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                {report.detail && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{report.detail}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  신고자: {report.reporterStudentNum}번 학생
                  {report.matchId ? " · Food Buddy 채팅에서" : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 조치 모달 */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>신고 처리</DialogTitle>
            <DialogDescription>
              {selectedReport && (
                <>
                  <span className="font-medium">{selectedReport.reportedStudentNum}번 학생</span>에 대한
                  신고 사유: {REASON_LABELS[selectedReport.reason]}
                  {selectedReport.detail && (
                    <>
                      <br />
                      <span className="text-gray-500">"{selectedReport.detail}"</span>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger data-testid="select-action" className="rounded-xl">
                <SelectValue placeholder="조치 선택" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              data-testid="input-action-note"
              placeholder="관리자 메모 (선택)"
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              maxLength={500}
              className="rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              취소
            </Button>
            <Button
              data-testid="btn-submit-action"
              variant={ACTION_VARIANTS[selectedAction] ?? "default"}
              disabled={actionMutation.isPending}
              onClick={() => {
                if (!selectedReport) return;
                actionMutation.mutate({
                  reportId: selectedReport.id,
                  action: selectedAction,
                  note: actionNote || undefined,
                  targetUserId: selectedReport.reportedUserId,
                });
              }}
            >
              {actionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {ACTION_LABELS[selectedAction]} 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
