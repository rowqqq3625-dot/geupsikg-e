import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { router, Stack } from "expo-router";
import { Trophy, ArrowLeft, Medal } from "lucide-react-native";
import { getQueryFn } from "@/lib/query-client";

type RankItem = { rank: number; label: string; points: number; isMe: boolean };
type RankingData = { ok: boolean; scope: string; myPoints: number; ranking: RankItem[] };

const MEDAL_COLORS = ["#FACC15", "#94A3B8", "#B45309"];

function MedalIcon({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <Medal size={16} color={MEDAL_COLORS[rank - 1]} />;
  }
  return <Text style={styles.rankText}>{rank}</Text>;
}

export default function RankingPage() {
  const { user, isAuthenticated } = useAuth();
  const [scope, setScope] = useState<"class" | "school">("class");

  const { data, isLoading: rankLoading, refetch } = useQuery<RankingData>({
    queryKey: ["/api/ranking", { scope }],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isAuthenticated,
  });

  const ranking = data?.ranking ?? [];
  const myEntry = ranking.find((r) => r.isMe);

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
            <ArrowLeft size={20} color="#86868B" />
          </Pressable>
          <View style={styles.titleContainer}>
            <Trophy size={20} color="#FACC15" />
            <Text style={styles.title}>포인트 랭킹</Text>
          </View>
        </View>
      </header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={rankLoading && !!data} onRefresh={refetch} />
        }
      >
        {/* 범위 선택 */}
        <View style={styles.scopeToggle} testID="scope-toggle">
          <Pressable
            onPress={() => setScope("class")}
            style={[styles.scopeButton, scope === "class" && styles.scopeButtonActive]}
            testID="button-scope-class"
          >
            <Text style={[styles.scopeButtonText, scope === "class" && styles.scopeButtonTextActive]}>
              {user?.grade}학년 {user?.classNum}반
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope("school")}
            style={[styles.scopeButton, scope === "school" && styles.scopeButtonActive]}
            testID="button-scope-school"
          >
            <Text style={[styles.scopeButtonText, scope === "school" && styles.scopeButtonTextActive]}>
              전교 랭킹
            </Text>
          </Pressable>
        </View>

        {/* 내 순위 요약 */}
        {myEntry && (
          <View style={styles.myRankCard} testID="my-rank-summary">
            <View>
              <Text style={styles.myRankLabel}>내 순위</Text>
              <Text style={styles.myRankValue}>{myEntry.rank}위</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.myRankLabel}>포인트</Text>
              <Text style={styles.myRankValue}>{myEntry.points}P</Text>
            </View>
          </View>
        )}

        {/* 랭킹 리스트 */}
        <View style={styles.rankingCard} testID="ranking-table">
          {rankLoading && !data ? (
            <View style={{ padding: 16 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height={48} style={{ marginBottom: 12, width: "100%" }} />
              ))}
            </View>
          ) : ranking.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Trophy size={40} color="#D2D2D7" />
              <Text style={styles.emptyText}>아직 랭킹 데이터가 없습니다.</Text>
              <Text style={styles.emptySubText}>급식 평가를 남기면 포인트가 적립됩니다!</Text>
            </View>
          ) : (
            <View>
              {ranking.map((item, index) => (
                <View
                  key={item.rank}
                  testID={`rank-row-${item.rank}`}
                  style={[
                    styles.rankRow,
                    item.isMe && styles.rankRowMe,
                    index === 0 && { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
                    index === ranking.length - 1 && { borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.medalContainer}>
                    <MedalIcon rank={item.rank} />
                  </View>
                  <View style={styles.labelContainer}>
                    <Text
                      numberOfLines={1}
                      style={[styles.rankLabel, item.isMe && styles.textPrimary]}
                    >
                      {item.label}
                      {item.isMe && <Text style={styles.meTag}> (나)</Text>}
                    </Text>
                  </View>
                  <Text style={[styles.pointsText, item.isMe && styles.textPrimary]}>
                    {item.points}P
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footerNote}>
          매일 급식 평가 시 30P 적립 · 개인정보는 최소한으로만 표시됩니다
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
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1D1D1F",
    marginLeft: 8,
  },
  scrollContent: {
    maxWidth: 672,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  scopeToggle: {
    backgroundColor: "#E8E8ED",
    padding: 4,
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 16,
  },
  scopeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  scopeButtonActive: {
    backgroundColor: "#FFFFFF",
  },
  scopeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#86868B",
  },
  scopeButtonTextActive: {
    color: "#1D1D1F",
  },
  myRankCard: {
    backgroundColor: "#0071E3",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "between",
    alignItems: "center",
    marginBottom: 16,
  },
  myRankLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 2,
  },
  myRankValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rankingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
  },
  emptyContainer: {
    padding: 40,
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
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  rankRowMe: {
    backgroundColor: "#F0F8FF",
  },
  medalContainer: {
    width: 24,
    alignItems: "center",
    marginRight: 16,
  },
  rankText: {
    fontSize: 12,
    color: "#86868B",
    fontWeight: "500",
    width: 16,
    textAlign: "center",
  },
  labelContainer: {
    flex: 1,
  },
  rankLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D1D1F",
  },
  meTag: {
    fontSize: 11,
    fontWeight: "400",
    color: "#0071E3",
  },
  pointsText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  textPrimary: {
    color: "#0071E3",
  },
  footerNote: {
    textAlign: "center",
    fontSize: 11,
    color: "#86868B",
    paddingVertical: 16,
  },
});
