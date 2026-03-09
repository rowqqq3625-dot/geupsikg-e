import React, { useState } from "react";
import {
  View, Text, ScrollView, SafeAreaView, StyleSheet, Pressable, Image, Modal, Platform,
} from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/query-client";
import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, XCircle, ExternalLink, ShieldCheck } from "lucide-react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BASE_URL } from "@/lib/shared";

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
  const imageUri = item.imageUrl.startsWith("http") ? item.imageUrl : `${BASE_URL}${item.imageUrl}`;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>인증 검토</Text>
            <Text style={styles.modalSubtitle}>
              {item.date} · {item.studentNumber}번
              {aiEatenPct !== null && (
                <Text style={{ color: "#0071E3" }}> AI 추정 섭취율: {aiEatenPct}%</Text>
              )}
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 400 }}>
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            </View>

            <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={styles.pointsLabel}>포인트 부여</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {POINT_OPTIONS.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setSelectedPoints(p)}
                      style={[styles.pointChip, selectedPoints === p && styles.pointChipSelected]}
                    >
                      <Text style={[styles.pointChipText, selectedPoints === p && styles.pointChipTextSelected]}>
                        {p}P
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Textarea
                placeholder="검토 메모 (선택)"
                value={note}
                onChangeText={setNote}
                style={{ marginBottom: 12 }}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              variant="destructive"
              style={{ flex: 1 }}
              onPress={() => reviewMutation.mutate({ act: "REJECT" })}
              loading={reviewMutation.isPending}
              disabled={reviewMutation.isPending}
            >
              미승인
            </Button>
            <Button
              style={{ flex: 1 }}
              onPress={() => reviewMutation.mutate({ act: "APPROVE", pts: selectedPoints })}
              loading={reviewMutation.isPending}
              disabled={reviewMutation.isPending}
            >
              승인 ({selectedPoints}P)
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AdminCleanPlatePage() {
  const { user, isAdmin } = useAuth();
  const insets = useSafeAreaInsets();
  const [reviewItem, setReviewItem] = useState<PendingItem | null>(null);
  const webTop = Platform.OS === "web" ? 67 : 0;

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/admin/cleanplate"],
    enabled: !!isAdmin,
  });

  const submissions = data?.submissions ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/dashboard")} style={styles.backBtn}>
          <ArrowLeft size={20} color="#1D1D1F" />
        </Pressable>
        <Text style={styles.headerTitle}>클린플레이트 검토</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height={100} borderRadius={16} />)}
          </View>
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="검토할 인증이 없어요"
            description="새 인증이 등록되면 여기에 표시됩니다."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {submissions.map((item) => {
              const aiPct = item.aiScore !== null ? Math.round(item.aiScore * 100) : null;
              return (
                <Card key={item.id}>
                  <CardContent style={{ paddingTop: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#1D1D1F" }}>
                          {item.date} · {item.studentNumber}번
                        </Text>
                        {aiPct !== null && (
                          <Text style={{ fontSize: 12, color: "#0071E3", marginTop: 2 }}>
                            AI: {aiPct}%
                          </Text>
                        )}
                      </View>
                      <Button size="sm" onPress={() => setReviewItem(item)}>
                        검토하기
                      </Button>
                    </View>
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {reviewItem && (
        <ReviewModal
          item={reviewItem}
          onClose={() => setReviewItem(null)}
          onDone={() => setReviewItem(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F7" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#F5F5F7",
  },
  backBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "600" as const, color: "#1D1D1F" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF", borderRadius: 20, width: "100%",
    maxHeight: "85%", overflow: "hidden",
  },
  modalHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F7" },
  modalTitle: { fontSize: 17, fontWeight: "600" as const, color: "#1D1D1F" },
  modalSubtitle: { fontSize: 13, color: "#86868B", marginTop: 4 },
  imageContainer: { marginHorizontal: 20, marginTop: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#F5F5F7" },
  previewImage: { width: "100%", height: 200 },
  pointsLabel: { fontSize: 13, fontWeight: "500" as const, color: "#86868B", marginBottom: 8 },
  pointChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#D2D2D7", backgroundColor: "#F5F5F7" },
  pointChipSelected: { borderColor: "#0071E3", backgroundColor: "#EFF6FF" },
  pointChipText: { fontSize: 13, color: "#1D1D1F" },
  pointChipTextSelected: { color: "#0071E3", fontWeight: "600" as const },
  modalFooter: { flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: "#F5F5F7" },
});
