import React from "react";
import { View, Text, SafeAreaView, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, ShieldCheck, Utensils, Loader2 } from "lucide-react-native";

type BuddyStatus =
  | { ok: true; state: "IDLE" }
  | { ok: true; state: "WAITING"; preference: "LESS" | "MORE" }
  | { ok: true; state: "MATCHED"; matchId: string };

export default function BuddyPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
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
    mutationFn: async (preference: "LESS" | "MORE") => {
      const res = await apiRequest("POST", "/api/buddy/join", { preference });
      return res.json();
    },
    onSuccess: (json) => {
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/status"] });
      if (json.state === "MATCHED" && json.matchId) {
        router.push(`/buddy/match/${json.matchId}`);
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

  if (authLoading || (isLoading && !data)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0071E3" />
      </View>
    );
  }

  const state = data?.state ?? "IDLE";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 헤더 */}
        <Pressable
          testID="btn-back"
          onPress={() => router.replace("/dashboard")}
          style={styles.backButton}
        >
          <ArrowLeft size={16} color="#86868B" />
          <Text style={styles.backText}>대시보드</Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Utensils size={28} color="#F97316" />
          <Text style={styles.title}>급식메이트</Text>
        </View>
        <Text style={styles.subtitle}>
          급식을 너무 많이 받았거나 적게 받은 친구와 연결돼요
        </Text>

        {/* 상태: 미참여 */}
        {state === "IDLE" && (
          <View style={styles.idleContainer}>
            {/* 안전 배지 */}
            <View style={styles.infoBox}>
              <ShieldCheck size={20} color="#22C55E" style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>익명·안전 매칭</Text>
                <Text style={styles.infoDescription}>
                  같은 학교·학년 내에서만 연결되며, 이름과 학번은 서로 동의해야만 공개돼요.
                </Text>
              </View>
            </View>

            {/* 매칭 참가 버튼 */}
            <View style={styles.selectionContainer}>
              <Text style={styles.selectionPrompt}>오늘 급식이 어때요?</Text>
              <View style={styles.buttonGrid}>
                <Button
                  testID="btn-join-less"
                  variant="outline"
                  style={styles.joinButton}
                  onPress={() => joinMutation.mutate("LESS")}
                  disabled={joinMutation.isPending}
                >
                  <View style={styles.buttonContent}>
                    {joinMutation.isPending && joinMutation.variables === "LESS" ? (
                      <ActivityIndicator size="small" color="#0071E3" />
                    ) : (
                      <Text style={styles.emoji}>😔</Text>
                    )}
                    <Text style={styles.buttonLabel}>적게 먹을래요</Text>
                  </View>
                </Button>
                <Button
                  testID="btn-join-more"
                  variant="outline"
                  style={styles.joinButton}
                  onPress={() => joinMutation.mutate("MORE")}
                  disabled={joinMutation.isPending}
                >
                  <View style={styles.buttonContent}>
                    {joinMutation.isPending && joinMutation.variables === "MORE" ? (
                      <ActivityIndicator size="small" color="#0071E3" />
                    ) : (
                      <Text style={styles.emoji}>😋</Text>
                    )}
                    <Text style={styles.buttonLabel}>많이 먹을래요</Text>
                  </View>
                </Button>
              </View>
            </View>

            <View style={styles.rewardInfo}>
              <Users size={16} color="#86868B" />
              <Text style={styles.rewardText}>매칭 성공 시 +100P 지급</Text>
            </View>
          </View>
        )}

        {/* 상태: 대기중 */}
        {state === "WAITING" && (
          <View style={styles.waitingContainer}>
            <Card style={styles.waitingCard}>
              <CardContent style={styles.waitingCardContent}>
                <View style={styles.loaderCircle}>
                  <ActivityIndicator size="large" color="#F97316" />
                </View>
                <Text style={styles.waitingTitle}>매칭 중이에요…</Text>
                <Text style={styles.waitingDescription}>
                  같은 학교·학년 내에서 상대를 찾고 있어요.{"\n"}
                  잠시만 기다려주세요.
                </Text>
                <Text style={styles.preferenceText}>
                  {data?.state === "WAITING"
                    ? data.preference === "LESS"
                      ? "적게 먹을래요로 대기 중"
                      : "많이 먹을래요로 대기 중"
                    : ""}
                </Text>
              </CardContent>
            </Card>

            <Button
              testID="btn-cancel-queue"
              variant="ghost"
              size="sm"
              onPress={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
            >
              <View style={styles.cancelButtonContent}>
                {leaveMutation.isPending && <ActivityIndicator size="small" color="#86868B" style={{ marginRight: 4 }} />}
                <Text style={styles.cancelButtonText}>매칭 취소하기</Text>
              </View>
            </Button>
          </View>
        )}

        {/* 상태: 매칭됨 */}
        {state === "MATCHED" && data?.state === "MATCHED" && (
          <View style={styles.matchedContainer}>
            <Card style={styles.matchedCard}>
              <CardContent style={styles.matchedCardContent}>
                <View style={styles.successBadge}>
                  <Text style={styles.successEmoji}>🎉</Text>
                </View>
                <Text style={styles.matchedTitle}>매칭 완료!</Text>
                <Text style={styles.matchedDescription}>
                  익명 학생과 연결됐어요.{"\n"}
                  채팅으로 인사해보세요.
                </Text>
              </CardContent>
            </Card>

            <Button
              testID="btn-go-chat"
              size="lg"
              style={styles.chatButton}
              onPress={() => router.push(`/buddy/match/${data.matchId}`)}
            >
              채팅 시작하기
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F7",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  backText: {
    fontSize: 14,
    color: "#86868B",
    marginLeft: 4,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1D1D1F",
    marginLeft: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#86868B",
    marginBottom: 40,
    lineHeight: 20,
  },
  idleContainer: {
    gap: 24,
  },
  infoBox: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E8ED",
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  infoDescription: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 2,
    lineHeight: 18,
  },
  selectionContainer: {
    gap: 12,
  },
  selectionPrompt: {
    fontSize: 14,
    fontWeight: "600",
    color: "#48484A",
    textAlign: "center",
  },
  buttonGrid: {
    flexDirection: "row",
    gap: 12,
  },
  joinButton: {
    flex: 1,
    height: 96,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
  },
  buttonContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emoji: {
    fontSize: 24,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  rewardInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  rewardText: {
    fontSize: 12,
    color: "#86868B",
  },
  waitingContainer: {
    alignItems: "center",
    gap: 24,
  },
  waitingCard: {
    width: "100%",
    borderRadius: 32,
    borderWidth: 0,
    elevation: 2,
  },
  waitingCardContent: {
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  loaderCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 8,
  },
  waitingDescription: {
    fontSize: 14,
    color: "#86868B",
    textAlign: "center",
    lineHeight: 20,
  },
  preferenceText: {
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 12,
  },
  cancelButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    color: "#86868B",
  },
  matchedContainer: {
    alignItems: "center",
    gap: 24,
  },
  matchedCard: {
    width: "100%",
    borderRadius: 32,
    borderWidth: 0,
    elevation: 2,
  },
  matchedCardContent: {
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successEmoji: {
    fontSize: 32,
  },
  matchedTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 8,
  },
  matchedDescription: {
    fontSize: 14,
    color: "#86868B",
    textAlign: "center",
    lineHeight: 20,
  },
  chatButton: {
    width: "100%",
    borderRadius: 16,
    height: 52,
  },
});
