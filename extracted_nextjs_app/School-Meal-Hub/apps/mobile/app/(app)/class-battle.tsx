import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, RefreshControl, Alert } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { router, Stack } from "expo-router";
import { ArrowLeft, Swords, Crown, ChevronLeft, ChevronRight } from "lucide-react-native";

type Standing = {
  classNum: number;
  totalPoints: number;
  submissionCount: number;
  participantCount: number;
  rank: number;
  isMyClass: boolean;
};

type Award = {
  id: string;
  month: string;
  grade: number;
  winnerClassNum: number;
  totalCleanplatePoints: number;
  bonusPoints: number;
  studentCount: number;
  createdAt: string;
};

type BattleData = {
  ok: boolean;
  month: string;
  grade: number;
  myClassNum: number;
  standings: Standing[];
  monthAward: Award | null;
  recentAwards: Award[];
};

function getRankEmoji(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function getMonthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ClassBattlePage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [awardError, setAwardError] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isCurrentMonth = selectedMonth === currentMonth;

  const { data, isLoading: battleLoading, refetch } = useQuery<BattleData>({
    queryKey: ["/api/class-battle", { month: selectedMonth }],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isAuthenticated,
    refetchInterval: isCurrentMonth ? 60_000 : false,
  });

  const awardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/class-battle/award", {
        grade: data?.grade ?? user?.grade,
        month: selectedMonth,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "지급에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: () => {
      setAwardError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/class-battle"] });
      Alert.alert("지급 완료", "우승 포인트가 성공적으로 지급되었습니다.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "지급에 실패했습니다.";
      setAwardError(msg);
    },
  });

  const standings = data?.standings ?? [];
  const myStanding = standings.find((s) => s.isMyClass);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <header style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            testID="button-back"
          >
            <ArrowLeft size={18} color="#1D1D1F" />
          </Pressable>
          <View style={styles.titleContainer}>
            <Swords size={16} color="#A855F7" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.title}>급식 대항전</Text>
              <Text style={styles.subtitle}>{user?.grade}학년 · 월별 클린플레이트 경쟁</Text>
            </View>
          </View>
        </View>
      </header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={battleLoading && !!data} onRefresh={refetch} />
        }
      >
        {/* 월 선택 */}
        <View style={styles.monthSelector} testID="month-selector">
          <Pressable
            onPress={() => setSelectedMonth((m) => addMonths(m, -1))}
            style={styles.monthButton}
            testID="button-prev-month"
          >
            <ChevronLeft size={20} color="#1D1D1F" />
          </Pressable>
          <View style={styles.monthLabelContainer}>
            <Text style={styles.monthLabel}>{getMonthLabel(selectedMonth)}</Text>
            {isCurrentMonth && <Text style={styles.currentMonthTag}>진행 중</Text>}
          </View>
          <Pressable
            onPress={() => {
              const next = addMonths(selectedMonth, 1);
              if (next <= currentMonth) setSelectedMonth(next);
            }}
            disabled={selectedMonth >= currentMonth}
            style={[styles.monthButton, selectedMonth >= currentMonth && { opacity: 0.3 }]}
            testID="button-next-month"
          >
            <ChevronRight size={20} color="#1D1D1F" />
          </Pressable>
        </View>

        {/* 내 반 요약 */}
        {myStanding && (
          <View style={styles.myClassCard} testID="my-class-summary">
            <View>
              <Text style={styles.myClassLabel}>우리 반 순위</Text>
              <Text style={styles.myClassValue}>{myStanding.rank}위</Text>
              <Text style={styles.myClassSub}>{user?.classNum}반</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.myClassLabel}>클린플레이트 점수</Text>
              <Text style={styles.myClassValue}>{myStanding.totalPoints}P</Text>
              <Text style={styles.myClassSub}>{myStanding.submissionCount}회 제출</Text>
            </View>
          </View>
        )}

        {/* 이달 수상 뱃지 */}
        {data?.monthAward && (
          <View style={styles.awardBanner} testID="month-award-banner">
            <Crown size={24} color="#EAB308" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.awardBannerTitle}>
                {getMonthLabel(selectedMonth)} 우승: {data.monthAward.winnerClassNum}반
              </Text>
              <Text style={styles.awardBannerText}>
                +{data.monthAward.bonusPoints}P 지급 완료 · {data.monthAward.studentCount}명 수혜
              </Text>
            </View>
          </View>
        )}

        {/* 순위표 */}
        <Card style={styles.standingsCard} testID="standings-table">
          <CardHeader>
            <Text style={styles.cardTitle}>반별 순위</Text>
            <Text style={styles.cardDesc}>승인된 클린플레이트 포인트 합산</Text>
          </CardHeader>
          <CardContent>
            {battleLoading && !data ? (
              <View style={{ gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={56} borderRadius={12} style={{ width: "100%" }} />
                ))}
              </View>
            ) : standings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Swords size={40} color="#D2D2D7" />
                <Text style={styles.emptyText}>{getMonthLabel(selectedMonth)} 참여 기록이 없습니다.</Text>
                <Text style={styles.emptySubText}>클린플레이트를 인증하면 반 점수가 올라가요!</Text>
              </View>
            ) : (
              <View>
                {standings.map((s, index) => (
                  <View
                    key={s.classNum}
                    testID={`row-standing-${s.classNum}`}
                    style={[
                      styles.standingRow,
                      s.isMyClass && styles.standingRowMy,
                      index === standings.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.rankBadgeContainer}>
                      {getRankEmoji(s.rank) ? (
                        <Text style={{ fontSize: 18 }}>{getRankEmoji(s.rank)}</Text>
                      ) : (
                        <Text style={styles.rankNumText}>{s.rank}</Text>
                      )}
                    </View>
                    <View style={styles.classInfoContainer}>
                      <Text style={[styles.classText, s.isMyClass && styles.textPrimary]}>
                        {s.classNum}반
                        {s.isMyClass && <Text style={styles.myClassTag}> (우리 반)</Text>}
                      </Text>
                      <Text style={styles.classSubText}>
                        {s.submissionCount}회 제출 · {s.participantCount}명 참여
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.pointsText, s.isMyClass && styles.textPrimary]}>
                        {s.totalPoints}P
                      </Text>
                      {s.rank === 1 && isCurrentMonth && !data?.monthAward && (
                        <Text style={styles.rankOneText}>현재 1위!</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* 규칙 안내 */}
        <Card style={styles.rulesCard}>
          <CardContent style={{ paddingTop: 16 }}>
            <Text style={styles.rulesTitle}>🏆 급식 대항전 규칙</Text>
            <View style={styles.rulesList}>
              <Text style={styles.rulesItem}>· 매월 말 클린플레이트 포인트를 가장 많이 모은 반이 우승</Text>
              <Text style={styles.rulesItem}>· 우승 반 학생 전원에게 +200P 보너스 지급</Text>
              <Text style={styles.rulesItem}>· 잔반이 적을수록, 제출 횟수가 많을수록 유리</Text>
              <Text style={styles.rulesItem}>· AI가 섭취량을 판단하여 10점 단위로 포인트 지급</Text>
            </View>
          </CardContent>
        </Card>

        {/* 최근 수상 기록 */}
        {(data?.recentAwards ?? []).length > 0 && (
          <Card style={styles.standingsCard}>
            <CardHeader>
              <Text style={styles.cardTitle}>수상 기록</Text>
            </CardHeader>
            <CardContent>
              <View>
                {(data?.recentAwards ?? []).map((award, index) => (
                  <View
                    key={award.id}
                    testID={`row-award-${award.month}`}
                    style={[
                      styles.awardRow,
                      index === data!.recentAwards.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View>
                      <Text style={styles.awardMonth}>{getMonthLabel(award.month)}</Text>
                      <Text style={styles.awardInfo}>{award.winnerClassNum}반 우승 · {award.studentCount}명</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.awardPoints}>+{award.bonusPoints}P</Text>
                      <Text style={styles.awardSubPoints}>{award.totalCleanplatePoints}P 획득</Text>
                    </View>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* 관리자: 우승 포인트 지급 */}
        {isAdmin && (
          <Card style={styles.standingsCard}>
            <CardContent style={{ paddingTop: 16, gap: 12 }}>
              <Text style={styles.adminTitle}>관리자 · 우승 포인트 지급</Text>
              {data?.monthAward ? (
                <Text style={styles.adminSuccessText}>{getMonthLabel(selectedMonth)} 포인트가 이미 지급됐습니다.</Text>
              ) : (
                <>
                  <Text style={styles.adminDescText}>
                    {getMonthLabel(selectedMonth)} {user?.grade}학년 대항전 우승 반에 +200P를 지급합니다.
                    {standings.length > 0 && (
                      <Text> 현재 1위: {standings[0].classNum}반 ({standings[0].totalPoints}P)</Text>
                    )}
                  </Text>
                  {awardError && (
                    <Text style={styles.errorText} testID="text-award-error">{awardError}</Text>
                  )}
                  <Button
                    testID="button-award"
                    onPress={() => {
                      Alert.alert(
                        "포인트 지급",
                        `${getMonthLabel(selectedMonth)} 우승 반에 포인트를 지급하시겠습니까?`,
                        [
                          { text: "취소", style: "cancel" },
                          { text: "지급", onPress: () => awardMutation.mutate() }
                        ]
                      );
                    }}
                    disabled={awardMutation.isPending || standings.length === 0}
                    style={{ backgroundColor: "#EAB308" }}
                    textStyle={{ color: "#FFFFFF" }}
                    loading={awardMutation.isPending}
                  >
                    🏆 우승 포인트 지급
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Text style={styles.footerNote}>
          급식 대항전 · 매월 클린플레이트 포인트 합산 · 우승 반 전원 +200P
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  header: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(210, 210, 215, 0.5)",
  },
  headerContent: {
    maxWidth: 672,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F5F5F7",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  subtitle: {
    fontSize: 12,
    color: "#86868B",
  },
  scrollContent: {
    maxWidth: 672,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  monthLabelContainer: {
    alignItems: "center",
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  currentMonthTag: {
    fontSize: 11,
    color: "#0071E3",
    fontWeight: "500",
  },
  myClassCard: {
    backgroundColor: "#0071E3",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  myClassLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 2,
  },
  myClassValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  myClassSub: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  awardBanner: {
    backgroundColor: "#FEFCE8",
    borderWidth: 1,
    borderColor: "#FEF08A",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  awardBannerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  awardBannerText: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 2,
  },
  standingsCard: {
    borderWidth: 0,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  cardDesc: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#86868B",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    color: "#86868B",
    marginTop: 4,
  },
  standingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  standingRowMy: {
    backgroundColor: "#EFF6FF",
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  rankBadgeContainer: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumText: {
    fontSize: 12,
    color: "#86868B",
    fontWeight: "500",
  },
  classInfoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  classText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  myClassTag: {
    fontSize: 11,
    fontWeight: "400",
  },
  classSubText: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 1,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  rankOneText: {
    fontSize: 10,
    color: "#CA8A04",
    fontWeight: "500",
    marginTop: 2,
  },
  textPrimary: {
    color: "#0071E3",
  },
  rulesCard: {
    borderWidth: 0,
    borderRadius: 16,
    backgroundColor: "#F0F8FF",
    marginBottom: 16,
  },
  rulesTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 8,
  },
  rulesList: {
    gap: 4,
  },
  rulesItem: {
    fontSize: 12,
    color: "#86868B",
  },
  awardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  awardMonth: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D1D1F",
  },
  awardInfo: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 2,
  },
  awardPoints: {
    fontSize: 14,
    fontWeight: "600",
    color: "#CA8A04",
  },
  awardSubPoints: {
    fontSize: 11,
    color: "#86868B",
    marginTop: 1,
  },
  adminTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  adminSuccessText: {
    fontSize: 12,
    color: "#16A34A",
  },
  adminDescText: {
    fontSize: 12,
    color: "#86868B",
    lineHeight: 18,
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
  },
  footerNote: {
    textAlign: "center",
    fontSize: 11,
    color: "#86868B",
    paddingVertical: 16,
  },
});
