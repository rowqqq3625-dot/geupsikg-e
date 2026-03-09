import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  MoreVertical,
  Send,
  ShieldAlert,
  UserX,
  CheckCircle2,
  X,
} from "lucide-react-native";

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [inputText, setInputText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("HARASSMENT");
  const [reportDetail, setReportDetail] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const { data: matchData, isLoading: matchLoading } = useQuery<MatchDetail>({
    queryKey: ["/api/buddy/match", id],
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      return d.match?.status === "ACTIVE" ? 5000 : false;
    },
  });

  const { data: messagesData } = useQuery<MessagesData>({
    queryKey: ["/api/buddy/match", id, "messages"],
    refetchInterval: () => {
      if (!matchData) return false;
      return matchData.match?.status === "ACTIVE" ? 3000 : false;
    },
    enabled: !!matchData,
  });

  useEffect(() => {
    if (messagesData?.messages?.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messagesData?.messages?.length]);

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/buddy/match/${id}/messages`, { body });
      return res.json();
    },
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
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/buddy/match/${id}/complete`, {});
      return res.json();
    },
    onSuccess: (json) => {
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
      router.replace("/buddy");
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

  if (authLoading || matchLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0071E3" />
      </View>
    );
  }

  if (!matchData?.match) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>매칭 정보를 찾을 수 없습니다.</Text>
      </View>
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

  const canRequestReveal = !revealState.myRequest;
  const hasPendingTheirReveal = revealState.theirRequest?.status === "PENDING";

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          testID="btn-back"
          onPress={() => router.replace("/buddy")}
          style={styles.headerActionButton}
        >
          <ArrowLeft size={20} color="#1D1D1F" />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text testID="text-opponent-name" style={styles.opponentName}>
            {match.opponentDisplay}
          </Text>
          <Text style={styles.matchStatus}>
            {match.status === "ACTIVE" ? "대화 중" : match.status === "COMPLETED" ? "완료됨" : "취소됨"}
          </Text>
        </View>

        <Pressable
          testID="btn-menu"
          onPress={() => setShowMenu(true)}
          style={styles.headerActionButton}
        >
          <MoreVertical size={20} color="#1D1D1F" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* 학번 공개 요청 배너 */}
        {hasPendingTheirReveal && revealState.theirRequest && (
          <View style={styles.bannerReveal}>
            <Text style={styles.bannerRevealText}>상대방이 학번 공개를 요청했어요</Text>
            <View style={styles.bannerActionGroup}>
              <Button
                testID="btn-reveal-accept"
                size="sm"
                variant="outline"
                style={styles.bannerButton}
                onPress={() => revealRespondMutation.mutate({ action: "ACCEPT", consentId: revealState.theirRequest!.id })}
              >
                <Text style={styles.bannerButtonText}>동의</Text>
              </Button>
              <Button
                testID="btn-reveal-reject"
                size="sm"
                variant="ghost"
                style={styles.bannerButton}
                onPress={() => revealRespondMutation.mutate({ action: "REJECT", consentId: revealState.theirRequest!.id })}
              >
                <Text style={styles.bannerButtonTextGhost}>거절</Text>
              </Button>
            </View>
          </View>
        )}

        {/* 학번 공개 요청 상태 */}
        {revealState.myRequest && revealState.myRequest.status === "PENDING" && (
          <View style={styles.bannerStatus}>
            <Text style={styles.bannerStatusText}>
              학번 공개 요청을 보냈어요. 상대방의 응답을 기다리고 있어요.
            </Text>
          </View>
        )}

        {/* 완료된 매칭 배너 */}
        {match.status === "COMPLETED" && (
          <View style={styles.bannerSuccess}>
            <Text style={styles.bannerSuccessText}>
              🎉 매칭이 완료됐어요! +{match.pointsAwarded}P 획득
            </Text>
          </View>
        )}

        {/* 메시지 영역 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View
              testID={`msg-${item.id}`}
              style={[
                styles.messageRow,
                item.isMine ? styles.messageRowMine : styles.messageRowOpponent,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  item.isMine ? styles.messageBubbleMine : styles.messageBubbleOpponent,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    item.isMine ? styles.messageTextMine : styles.messageTextOpponent,
                  ]}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          )}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.guidelineText}>
                연락처·개인정보 공유는 권장하지 않아요.
              </Text>
              {messages.length === 0 && (
                <Text style={styles.emptyText}>아직 메시지가 없어요. 먼저 인사해보세요!</Text>
              )}
            </View>
          }
        />

        {/* 입력창 */}
        {isActive ? (
          <View style={styles.inputArea}>
            <View style={styles.inputContainer}>
              <TextInput
                testID="input-message"
                value={inputText}
                onChangeText={setInputText}
                placeholder="메시지를 입력하세요…"
                placeholderTextColor="#86868B"
                style={styles.textInput}
                maxLength={300}
                editable={!sendMutation.isPending}
              />
              <Pressable
                testID="btn-send"
                onPress={handleSend}
                disabled={!inputText.trim() || sendMutation.isPending}
                style={[
                  styles.sendButton,
                  (!inputText.trim() || sendMutation.isPending) && styles.sendButtonDisabled,
                ]}
              >
                {sendMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.inactiveArea}>
            <Text style={styles.inactiveText}>
              {match.status === "COMPLETED" ? "매칭이 완료됐습니다." : "매칭이 종료됐습니다."}
            </Text>
            <Button
              testID="btn-go-home"
              variant="ghost"
              size="sm"
              onPress={() => router.replace("/buddy")}
            >
              <Text style={styles.newMatchText}>새 매칭 찾기</Text>
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* 액션 시트 (메뉴) */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContent}>
            {isActive && canRequestReveal && (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  revealRequestMutation.mutate();
                }}
              >
                <Text style={styles.menuItemText}>학번 공개 요청</Text>
              </Pressable>
            )}
            {isActive && (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setShowCompleteModal(true);
                }}
              >
                <CheckCircle2 size={18} color="#22C55E" style={{ marginRight: 10 }} />
                <Text style={styles.menuItemText}>매칭 완료</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowReportModal(true);
              }}
            >
              <ShieldAlert size={18} color="#F97316" style={{ marginRight: 10 }} />
              <Text style={[styles.menuItemText, { color: "#F97316" }]}>신고하기</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => {
                setShowMenu(false);
                Alert.alert(
                  "차단하기",
                  "상대방을 차단하면 대화가 종료됩니다. 계속할까요?",
                  [
                    { text: "취소", style: "cancel" },
                    { text: "차단", style: "destructive", onPress: () => blockMutation.mutate(match.opponentId) }
                  ]
                );
              }}
            >
              <UserX size={18} color="#EF4444" style={{ marginRight: 10 }} />
              <Text style={[styles.menuItemText, { color: "#EF4444" }]}>차단하기</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 완료 확인 모달 */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>매칭을 완료할까요?</Text>
            <Text style={styles.dialogDescription}>
              완료하면 양쪽 모두에게 +100P가 지급됩니다.
            </Text>
            <View style={styles.dialogActions}>
              <Button
                variant="outline"
                style={styles.dialogButton}
                onPress={() => setShowCompleteModal(false)}
              >
                취소
              </Button>
              <Button
                testID="btn-confirm-complete"
                style={styles.dialogButton}
                onPress={() => completeMutation.mutate()}
                loading={completeMutation.isPending}
              >
                완료하기
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 신고 모달 */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContent}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>신고하기</Text>
              <Pressable onPress={() => setShowReportModal(false)}>
                <X size={20} color="#86868B" />
              </Pressable>
            </View>
            <Text style={styles.dialogDescription}>
              신고 내용은 관리자에게 전달됩니다.
            </Text>

            <View style={styles.reportForm}>
              {Object.entries(REASON_LABELS).map(([v, l]) => (
                <Pressable
                  key={v}
                  style={[
                    styles.reasonOption,
                    reportReason === v && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setReportReason(v)}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      reportReason === v && styles.reasonTextSelected,
                    ]}
                  >
                    {l}
                  </Text>
                </Pressable>
              ))}

              <Input
                testID="input-report-detail"
                placeholder="상세 내용 (선택)"
                value={reportDetail}
                onChangeText={setReportDetail}
                maxLength={300}
                style={styles.reportInput}
              />
            </View>

            <View style={styles.dialogActions}>
              <Button
                variant="outline"
                style={styles.dialogButton}
                onPress={() => setShowReportModal(false)}
              >
                취소
              </Button>
              <Button
                testID="btn-submit-report"
                variant="destructive"
                style={styles.dialogButton}
                onPress={() => reportMutation.mutate({
                  reportedUserId: match.opponentId,
                  reason: reportReason,
                  detail: reportDetail || undefined,
                })}
                loading={reportMutation.isPending}
              >
                신고하기
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex1: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#86868B",
    fontSize: 15,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  headerActionButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  opponentName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  matchStatus: {
    fontSize: 11,
    color: "#86868B",
    marginTop: 1,
  },
  bannerReveal: {
    backgroundColor: "#F0F7FF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E0EFFF",
  },
  bannerRevealText: {
    fontSize: 13,
    color: "#0071E3",
    fontWeight: "500",
  },
  bannerActionGroup: {
    flexDirection: "row",
    gap: 8,
  },
  bannerButton: {
    height: 32,
    paddingHorizontal: 12,
  },
  bannerButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  bannerButtonTextGhost: {
    fontSize: 12,
    color: "#86868B",
  },
  bannerStatus: {
    backgroundColor: "#FFF9EB",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FFF1CC",
  },
  bannerStatusText: {
    fontSize: 11,
    color: "#B45309",
    textAlign: "center",
  },
  bannerSuccess: {
    backgroundColor: "#F0FDF4",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#DCFCE7",
  },
  bannerSuccessText: {
    fontSize: 13,
    color: "#15803D",
    fontWeight: "600",
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listHeader: {
    marginBottom: 24,
    alignItems: "center",
  },
  guidelineText: {
    fontSize: 12,
    color: "#86868B",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 40,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: "row",
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOpponent: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBubbleMine: {
    backgroundColor: "#1D1D1F",
    borderBottomRightRadius: 4,
  },
  messageBubbleOpponent: {
    backgroundColor: "#F5F5F7",
    borderWidth: 1,
    borderColor: "#E8E8ED",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextMine: {
    color: "#FFFFFF",
  },
  messageTextOpponent: {
    color: "#1D1D1F",
  },
  inputArea: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F7",
    backgroundColor: "#FFFFFF",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#F5F5F7",
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#1D1D1F",
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0071E3",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#D2D2D7",
  },
  inactiveArea: {
    padding: 24,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F5F5F7",
  },
  inactiveText: {
    fontSize: 14,
    color: "#86868B",
    marginBottom: 8,
  },
  newMatchText: {
    fontSize: 14,
    color: "#0071E3",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "flex-end",
  },
  menuContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 16,
    color: "#1D1D1F",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 340,
  },
  dialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  dialogDescription: {
    fontSize: 14,
    color: "#86868B",
    lineHeight: 20,
    marginBottom: 20,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12,
  },
  dialogButton: {
    flex: 1,
  },
  reportForm: {
    marginBottom: 24,
  },
  reasonOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E8ED",
    marginBottom: 8,
  },
  reasonOptionSelected: {
    backgroundColor: "#F0F7FF",
    borderColor: "#0071E3",
  },
  reasonText: {
    fontSize: 14,
    color: "#48484A",
  },
  reasonTextSelected: {
    color: "#0071E3",
    fontWeight: "600",
  },
  reportInput: {
    marginTop: 12,
  },
});
