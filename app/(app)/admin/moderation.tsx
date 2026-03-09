import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, ShieldAlert, Clock, Loader2 } from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const ACTION_VARIANTS: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  WARN: "outline",
  SUSPEND_MATCHING_7D: "secondary",
  SUSPEND_ACCOUNT_7D: "destructive",
  BAN: "destructive",
};

export default function AdminModerationScreen() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedAction, setSelectedAction] = useState("WARN");
  const [actionNote, setActionNote] = useState("");

  const { data, isLoading } = useQuery<{ ok: true; reports: Report[] }>({
    queryKey: ["/api/admin/reports"],
    enabled: isAdmin,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      reportId,
      action,
      note,
      targetUserId,
    }: {
      reportId: string;
      action: string;
      note?: string;
      targetUserId: string;
    }) => {
      const res = await apiRequest("POST", `/api/admin/reports/${reportId}/action`, {
        action,
        note,
        targetUserId,
      });
      if (!res.ok) throw new Error("Failed to process report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      setSelectedReport(null);
      setActionNote("");
      toast({ title: "조치 완료", description: "신고에 대한 조치가 처리됐습니다." });
    },
    // onError handled by global query client or manually if needed
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "처리에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text>접근 권한이 없습니다.</Text>
          <Button onPress={() => router.replace("/(app)/dashboard")} style={{ marginTop: 16 }}>
            대시보드로 돌아가기
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const reports = data?.reports ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/dashboard")}
          style={styles.backButton}
          testID="button-back"
        >
          <ArrowLeft size={20} color="#86868B" />
          <Text style={styles.backText}>대시보드</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <ShieldAlert size={28} color="#EF4444" />
          <Text style={styles.title}>신고 관리</Text>
        </View>
        <Text style={styles.subtitle}>처리 대기 중인 신고 목록입니다.</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0071E3" />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>처리 대기 중인 신고가 없습니다.</Text>
          </View>
        ) : (
          reports.map((report) => (
            <Pressable
              key={report.id}
              testID={`report-card-${report.id}`}
              onPress={() => {
                setSelectedReport(report);
                setSelectedAction("WARN");
                setActionNote("");
              }}
              style={({ pressed }) => [
                styles.reportCard,
                pressed && styles.reportCardPressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <Badge variant="outline">
                    {REASON_LABELS[report.reason] ?? report.reason}
                  </Badge>
                  <Text style={styles.reportedInfo}>
                    {report.reportedStudentNum}번 학생 신고됨
                  </Text>
                </View>
                <View style={styles.dateRow}>
                  <Clock size={12} color="#86868B" />
                  <Text style={styles.dateText}>
                    {new Date(report.createdAt).toLocaleDateString("ko-KR")}
                  </Text>
                </View>
              </View>

              {report.detail && (
                <Text style={styles.reportDetail} numberOfLines={1}>
                  {report.detail}
                </Text>
              )}

              <Text style={styles.reporterInfo}>
                신고자: {report.reporterStudentNum}번 학생
                {report.matchId ? " · Food Buddy 채팅에서" : ""}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* 조치 모달 */}
      <Modal
        visible={!!selectedReport}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>신고 처리</Text>
            
            {selectedReport && (
              <View style={styles.reportSummary}>
                <Text style={styles.summaryText}>
                  <Text style={styles.bold}>{selectedReport.reportedStudentNum}번 학생</Text>에 대한
                  신고 사유: {REASON_LABELS[selectedReport.reason]}
                </Text>
                {selectedReport.detail && (
                  <Text style={styles.summaryDetail}>"{selectedReport.detail}"</Text>
                )}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>조치 선택</Text>
              <Select
                value={selectedAction}
                onValueChange={setSelectedAction}
                options={ACTION_OPTIONS}
                testID="select-action"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>관리자 메모 (선택)</Text>
              <Input
                placeholder="메모를 입력하세요"
                value={actionNote}
                onChangeText={setActionNote}
                maxLength={500}
                testID="input-action-note"
              />
            </View>

            <View style={styles.modalFooter}>
              <Button
                variant="outline"
                onPress={() => setSelectedReport(null)}
                style={styles.footerBtn}
              >
                취소
              </Button>
              <Button
                variant={ACTION_VARIANTS[selectedAction] ?? "default"}
                loading={actionMutation.isPending}
                onPress={() => {
                  if (!selectedReport) return;
                  actionMutation.mutate({
                    reportId: selectedReport.id,
                    action: selectedAction,
                    note: actionNote || undefined,
                    targetUserId: selectedReport.reportedUserId,
                  });
                }}
                style={styles.footerBtn}
                testID="btn-submit-action"
              >
                {ACTION_LABELS[selectedAction]} 처리
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
    backgroundColor: "#F5F5F7",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D2D2D7",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#86868B",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1D1D1F",
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#86868B",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  emptyText: {
    color: "#86868B",
    fontSize: 15,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  reportCardPressed: {
    borderColor: "#D2D2D7",
    backgroundColor: "#FAFAFA",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  reportedInfo: {
    fontSize: 12,
    color: "#86868B",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: "#86868B",
  },
  reportDetail: {
    fontSize: 14,
    color: "#424245",
    marginBottom: 8,
  },
  reporterInfo: {
    fontSize: 12,
    color: "#86868B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1D1D1F",
    marginBottom: 16,
  },
  reportSummary: {
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 14,
    color: "#1D1D1F",
    lineHeight: 20,
  },
  bold: {
    fontWeight: "600",
  },
  summaryDetail: {
    fontSize: 13,
    color: "#86868B",
    marginTop: 4,
    fontStyle: "italic",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 6,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  footerBtn: {
    flex: 1,
  },
});
