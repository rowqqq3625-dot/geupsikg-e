import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MoreVertical, Send, Loader2, ShieldAlert, UserX, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRef, useEffect, useState } from "react";
import { Redirect } from "wouter";

type MatchDetail = {
  ok: true;
  match: {
    id: string;
    status: string;
    myRole: "LESS" | "MORE";
    opponentId: string;
    opponentDisplay: string;
    revealed: boolean;
    pointsAwarded: number;
    createdAt: string;
    completedAt: string | null;
  };
  revealState: {
    myRequest: { id: string; status: string } | null;
    theirRequest: { id: string; status: string } | null;
  };
};

type MessagesData = {
  ok: true;
  messages: { id: string; body: string; isMine: boolean; createdAt: string }[];
  cursor: string | null;
};

const REASON_LABELS: Record<string, string> = {
  HARASSMENT: "괴롭힘·욕설",
  SPAM: "스팸·도배",
  PRIVACY: "개인정보 요구",
  INAPPROPRIATE: "부적절한 내용",
  OTHER: "기타",
};

export default function BuddyMatchPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [inputText, setInputText] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("HARASSMENT");
  const [reportDetail, setReportDetail] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: matchData, isLoading: matchLoading } = useQuery<MatchDetail>({
    queryKey: ["/api/buddy/match", id],
    queryFn: () => fetch(`/api/buddy/match/${id}`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      return d.match?.status === "ACTIVE" ? 5000 : false;
    },
  });

  const { data: messagesData } = useQuery<MessagesData>({
    queryKey: ["/api/buddy/match", id, "messages"],
    queryFn: () => fetch(`/api/buddy/match/${id}/messages`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: (query) => {
      const d = matchData;
      if (!d) return false;
      return d.match?.status === "ACTIVE" ? 3000 : false;
    },
    enabled: !!matchData,
  });

  useEffect(() => {
    if (messagesData?.messages) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesData?.messages?.length]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => apiRequest("POST", `/api/buddy/match/${id}/messages`, { body }),
    onSuccess: () => {
      setInputText("");
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/match", id, "messages"] });
    },
    onError: async (err: any) => {
      let msg = "메시지 전송에 실패했습니다.";
      try {
        const json = await err.response?.json();
        msg = json?.error?.message ?? msg;
      } catch {}
      toast({ title: "오류", description: msg, variant: "destructive" });
    },
  });

  const revealRequestMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/buddy/match/${id}/reveal/request`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/match", id] });
      toast({ title: "요청 전송", description: "학번 공개 요청을 보냈습니다." });
    },
  });

  const revealRespondMutation = useMutation({
    mutationFn: ({ action, consentId }: { action: "ACCEPT" | "REJECT"; consentId: string }) =>
      apiRequest("POST", `/api/buddy/match/${id}/reveal/respond`, { action, consentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/match", id] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/buddy/match/${id}/complete`, {}),
    onSuccess: async (res) => {
      const json = await res.json();
      setShowCompleteModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/match", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "매칭 완료!",
        description: `+${json.pointsEach}P가 지급됐습니다. 수고했어요!`,
      });
    },
  });

  const blockMutation = useMutation({
    mutationFn: (blockedUserId: string) => apiRequest("POST", "/api/block", { blockedUserId }),
    onSuccess: () => {
      toast({ title: "차단 완료", description: "상대방을 차단했습니다." });
      navigate("/buddy");
    },
  });

  const reportMutation = useMutation({
    mutationFn: ({ reportedUserId, reason, detail }: { reportedUserId: string; reason: string; detail?: string }) =>
      apiRequest("POST", "/api/report", { reportedUserId, matchId: id, reason, detail }),
    onSuccess: () => {
      setShowReportModal(false);
      toast({ title: "신고 접수", description: "신고가 접수됐습니다. 검토 후 처리됩니다." });
    },
  });

  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;

  if (matchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!matchData?.match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500">매칭 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const match = matchData.match;
  const revealState = matchData.revealState;
  const messages = messagesData?.messages ?? [];
  const isActive = match.status === "ACTIVE";

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canRequestReveal = !revealState.myRequest;
  const hasPendingTheirReveal = revealState.theirRequest?.status === "PENDING";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button
          data-testid="btn-back"
          onClick={() => navigate("/buddy")}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <p data-testid="text-opponent-name" className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {match.opponentDisplay}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {match.status === "ACTIVE" ? "대화 중" : match.status === "COMPLETED" ? "완료됨" : "취소됨"}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="btn-menu" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isActive && canRequestReveal && (
              <DropdownMenuItem
                data-testid="menu-reveal"
                onClick={() => revealRequestMutation.mutate()}
                disabled={revealRequestMutation.isPending}
              >
                학번 공개 요청
              </DropdownMenuItem>
            )}
            {isActive && (
              <DropdownMenuItem
                data-testid="menu-complete"
                onClick={() => setShowCompleteModal(true)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                매칭 완료
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              data-testid="menu-report"
              onClick={() => setShowReportModal(true)}
              className="text-orange-600 dark:text-orange-400"
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              신고하기
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="menu-block"
              className="text-red-600 dark:text-red-400"
              onClick={() => {
                if (confirm("상대방을 차단하면 대화가 종료됩니다. 계속할까요?")) {
                  blockMutation.mutate(match.opponentId);
                }
              }}
            >
              <UserX className="w-4 h-4 mr-2" />
              차단하기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 학번 공개 요청 배너 */}
      {hasPendingTheirReveal && revealState.theirRequest && (
        <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-100 dark:border-blue-900 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-blue-700 dark:text-blue-300">상대방이 학번 공개를 요청했어요</p>
          <div className="flex gap-2">
            <Button
              data-testid="btn-reveal-accept"
              size="sm"
              variant="outline"
              className="text-xs h-7 border-blue-300"
              onClick={() => revealRespondMutation.mutate({ action: "ACCEPT", consentId: revealState.theirRequest!.id })}
            >
              동의
            </Button>
            <Button
              data-testid="btn-reveal-reject"
              size="sm"
              variant="ghost"
              className="text-xs h-7 text-gray-500"
              onClick={() => revealRespondMutation.mutate({ action: "REJECT", consentId: revealState.theirRequest!.id })}
            >
              거절
            </Button>
          </div>
        </div>
      )}

      {/* 학번 공개 요청 상태 */}
      {revealState.myRequest && revealState.myRequest.status === "PENDING" && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-100 dark:border-yellow-900 px-4 py-2">
          <p className="text-xs text-yellow-700 dark:text-yellow-300 text-center">
            학번 공개 요청을 보냈어요. 상대방의 응답을 기다리고 있어요.
          </p>
        </div>
      )}

      {/* 완료된 매칭 배너 */}
      {match.status === "COMPLETED" && (
        <div className="bg-green-50 dark:bg-green-950 border-b border-green-100 dark:border-green-900 px-4 py-3 text-center">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            🎉 매칭이 완료됐어요! +{match.pointsAwarded}P 획득
          </p>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* 안내 문구 */}
        <div className="text-center py-2">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            연락처·개인정보 공유는 권장하지 않아요.
          </p>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">아직 메시지가 없어요. 먼저 인사해보세요!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`msg-${msg.id}`}
            className={`flex ${msg.isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.isMine
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-br-md"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-md"
              }`}
            >
              {msg.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      {isActive ? (
        <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
          <div className="flex gap-2 items-end">
            <Input
              data-testid="input-message"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요…"
              className="flex-1 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 resize-none"
              maxLength={300}
              disabled={sendMutation.isPending}
            />
            <Button
              data-testid="btn-send"
              size="icon"
              className="rounded-xl h-10 w-10 shrink-0"
              onClick={handleSend}
              disabled={!inputText.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-4 text-center">
          <p className="text-sm text-gray-400">
            {match.status === "COMPLETED" ? "매칭이 완료됐습니다." : "매칭이 종료됐습니다."}
          </p>
          <Button
            data-testid="btn-go-home"
            variant="ghost"
            size="sm"
            className="mt-2 text-gray-500"
            onClick={() => navigate("/buddy")}
          >
            새 매칭 찾기
          </Button>
        </div>
      )}

      {/* 완료 확인 모달 */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>매칭을 완료할까요?</DialogTitle>
            <DialogDescription>
              완료하면 양쪽 모두에게 +100P가 지급됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
              취소
            </Button>
            <Button
              data-testid="btn-confirm-complete"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              완료하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 신고 모달 */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>신고하기</DialogTitle>
            <DialogDescription>
              신고 내용은 관리자에게 전달됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={reportReason} onValueChange={setReportReason}>
              <SelectTrigger data-testid="select-report-reason" className="rounded-xl">
                <SelectValue placeholder="신고 사유 선택" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              data-testid="input-report-detail"
              placeholder="상세 내용 (선택)"
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value)}
              maxLength={300}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReportModal(false)}>
              취소
            </Button>
            <Button
              data-testid="btn-submit-report"
              variant="destructive"
              onClick={() => reportMutation.mutate({
                reportedUserId: match.opponentId,
                reason: reportReason,
                detail: reportDetail || undefined,
              })}
              disabled={reportMutation.isPending}
            >
              {reportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              신고하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
