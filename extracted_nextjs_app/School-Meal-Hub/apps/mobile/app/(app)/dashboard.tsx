import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ALLERGY_OPTIONS } from "@gipsige/shared";
import { useNetwork } from "@/hooks/use-network";
import { OfflineBanner } from "@/components/offline-banner";
import { router, Link } from "expo-router";
import {
  UtensilsCrossed,
  Star,
  Clock,
  Users,
  LogOut,
  MessageSquare,
  Trophy,
  TrendingUp,
  X,
  CheckCircle2,
  Camera,
  ShieldCheck,
  Bell,
  ShieldAlert,
  Swords,
  ShoppingBag,
} from "lucide-react-native";

const { width } = Dimensions.get("window");

type MealData = {
  ok: boolean;
  date: string;
  menuText: string;
  source: "cache" | "neis" | "mock";
  mealImageUrl?: string | null;
};

type FeedbackResponse = { ok: boolean; feedbackId: string; newPoints: number };

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          style={styles.starButton}
        >
          <Star
            size={32}
            fill={star <= value ? "#FACC15" : "transparent"}
            color={star <= value ? "#FACC15" : "#D2D2D7"}
          />
        </Pressable>
      ))}
    </View>
  );
}

function FeedbackModal({
  date,
  visible,
  onClose,
  onSuccess,
}: {
  date: string;
  visible: boolean;
  onClose: () => void;
  onSuccess: (newPoints: number) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feedback", {
        date,
        rating,
        comment: comment.trim() || null,
      });
      return res.json() as Promise<FeedbackResponse>;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      onSuccess(data.newPoints);
    },
  });

  const handleClose = () => {
    setRating(0);
    setComment("");
    setSubmitted(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {submitted ? (
            <View style={styles.successContent}>
              <CheckCircle2 size={48} color="#0071E3" style={{ marginBottom: 16 }} />
              <Text style={styles.successTitle}>평가 완료!</Text>
              <Text style={styles.successSub}>+30 포인트 적립되었습니다.</Text>
              <Button onPress={handleClose} style={{ width: "100%" }}>
                확인
              </Button>
            </View>
          ) : (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>오늘 급식 평가</Text>
                <Pressable onPress={handleClose} testID="button-close-modal">
                  <X size={20} color="#86868B" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody} bounces={false}>
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.inputLabel}>맛 평가 (1~5점)</Text>
                  <StarRating value={rating} onChange={setRating} />
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.inputLabel}>건의사항 (선택)</Text>
                  <Textarea
                    testID="input-feedback-comment"
                    value={comment}
                    onChangeText={setComment}
                    placeholder="오늘 급식에 대한 의견을 남겨주세요..."
                    maxLength={500}
                    numberOfLines={3}
                  />
                  <Text style={styles.charCount}>{comment.length}/500</Text>
                </View>

                {feedbackMutation.isError && (
                  <Text style={styles.errorText} testID="text-feedback-error">
                    {feedbackMutation.error instanceof Error &&
                    feedbackMutation.error.message.includes("409")
                      ? "오늘 평가는 이미 제출했습니다."
                      : "제출에 실패했습니다."}
                  </Text>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  testID="button-submit-feedback"
                  disabled={rating === 0 || feedbackMutation.isPending}
                  onPress={() => feedbackMutation.mutate()}
                  style={{ width: "100%" }}
                  loading={feedbackMutation.isPending}
                >
                  평가 제출 (+30P)
                </Button>
                {rating === 0 && (
                  <Text style={styles.footerNote}>별점을 선택해주세요</Text>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function DashboardSkeleton() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Skeleton width={180} height={24} />
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={200} style={{ marginBottom: 16 }} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated, isAdmin, logout } = useAuth();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number | null>(null);
  const { isOnline } = useNetwork();

  useEffect(() => {
    if (isOnline) {
      queryClient.invalidateQueries();
    }
  }, [isOnline]);

  const { data: mealData } = useQuery<MealData>({
    queryKey: ["/api/meals/today"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });

  const { data: notifData } = useQuery<{ ok: true; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    queryFn: () =>
      apiRequest("GET", "/api/notifications?limit=1").then((r) => r.json()),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (!isAuthenticated) return null; // Hook handles redirect

  const displayPoints = currentPoints ?? user!.points;
  const today = new Date().toISOString().split("T")[0];
  const todayKr = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const userLabel = `${user!.schoolName} · ${user!.grade}학년 ${user!.classNum}반 · ${
    user!.studentNumber
  }번`;

  const menuItems = mealData?.menuText ? mealData.menuText.split(" · ") : [];
  const userAllergyIds = user!.allergies ?? [];
  const ALLERGY_NEIS_MAP: Record<string, string[]> = {
    "1": ["난류", "계란"],
    "2": ["우유"],
    "3": ["메밀"],
    "4": ["땅콩"],
    "5": ["대두", "콩"],
    "6": ["밀"],
    "7": ["고등어"],
    "8": ["게"],
    "9": ["새우"],
    "10": ["돼지"],
    "11": ["복숭아"],
    "12": ["토마토"],
    "13": ["아황산"],
    "14": ["호두"],
    "15": ["닭고기"],
    "16": ["쇠고기"],
    "17": ["오징어"],
    "18": ["조개"],
  };

  const matchedAllergies = userAllergyIds
    .filter((id) => {
      const keywords = ALLERGY_NEIS_MAP[id] ?? [];
      return menuItems.some((item) => keywords.some((kw) => item.includes(kw)));
    })
    .map((id) => ALLERGY_OPTIONS.find((o) => o.id === id)?.label ?? id);

  const congestionInfo = (() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const totalMins = h * 60 + m;
    const t = (hh: number, mm: number) => hh * 60 + mm;
    if (totalMins >= t(12, 0) && totalMins < t(12, 20)) {
      return {
        statusLabel: "매우 혼잡",
        badgeVariant: "destructive" as const,
        badgeStyle: { backgroundColor: "#FEF2F2" },
        textStyle: { color: "#B91C1C" },
        waitTime: "약 25분",
        bestTime: "12:30",
      };
    } else if (
      (totalMins >= t(11, 30) && totalMins < t(12, 0)) ||
      (totalMins >= t(12, 20) && totalMins < t(13, 0))
    ) {
      return {
        statusLabel: "혼잡 예상",
        badgeVariant: "secondary" as const,
        badgeStyle: { backgroundColor: "#FFF7ED" },
        textStyle: { color: "#C2410C" },
        waitTime: "약 15분",
        bestTime: "12:30",
      };
    } else if (totalMins >= t(13, 0) && totalMins < t(13, 30)) {
      return {
        statusLabel: "약간 여유",
        badgeVariant: "secondary" as const,
        badgeStyle: { backgroundColor: "#FEFCE8" },
        textStyle: { color: "#A16207" },
        waitTime: "약 8분",
        bestTime: "13:15",
      };
    } else {
      return {
        statusLabel: "여유 있어요",
        badgeVariant: "secondary" as const,
        badgeStyle: { backgroundColor: "#F0FDF4" },
        textStyle: { color: "#15803D" },
        waitTime: "약 3분",
        bestTime: "12:15",
      };
    }
  })();

  return (
    <SafeAreaView style={styles.container} testID="page-dashboard">
      <FeedbackModal
        date={today}
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={(pts) => {
          setCurrentPoints(pts);
          setShowFeedbackModal(false);
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        }}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <UtensilsCrossed size={16} color="#1D1D1F" />
          </View>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1} testID="text-user-identity">
              {userLabel}
            </Text>
            <Text style={styles.headerSubtitle}>{todayKr}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            testID="btn-notifications"
            onPress={() => router.push("/(app)/notifications")}
            style={styles.notifButton}
          >
            <Bell size={18} color="#86868B" />
            {notifData && notifData.unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {notifData.unreadCount > 9 ? "9+" : notifData.unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Button
            variant="ghost"
            size="sm"
            testID="button-logout"
            onPress={() => logout.mutate()}
            textStyle={{ color: "#86868B" }}
          >
            <LogOut size={16} color="#86868B" style={{ marginRight: 4 }} />
            로그아웃
          </Button>
        </View>
      </View>

      {!isOnline && <OfflineBanner />}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 오늘의 급식 카드 */}
        <Card style={styles.card} testID="card-meals">
          <CardHeader style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: "#FFF7ED" }]}>
                <UtensilsCrossed size={16} color="#F97316" />
              </View>
              <View>
                <Text style={styles.cardTitle}>오늘의 급식</Text>
                <Text style={styles.cardSubtitle}>
                  {mealData?.source === "neis"
                    ? "NEIS 실데이터"
                    : mealData?.source === "cache"
                    ? "캐시"
                    : "기본 메뉴"}
                </Text>
              </View>
            </View>
            {mealData?.source === "mock" && (
              <Badge variant="secondary" style={{ backgroundColor: "#F5F5F7" }}>
                샘플
              </Badge>
            )}
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {mealData ? (
              <>
                {mealData.mealImageUrl ? (
                  <View style={styles.mealImageContainer} testID="img-meal-preview-container">
                    <Image
                      source={{ uri: mealData.mealImageUrl }}
                      style={styles.mealImage}
                      resizeMode="contain"
                      testID="img-meal-preview"
                    />
                  </View>
                ) : (
                  <View style={styles.mealImagePlaceholder} testID="img-meal-placeholder">
                    <UtensilsCrossed size={32} color="#C7C7CC" />
                    <Text style={styles.placeholderText}>AI 급식 이미지 생성 중…</Text>
                  </View>
                )}

                <View style={styles.menuTags}>
                  {menuItems.map((item, i) => (
                    <View key={i} style={styles.menuTag} testID={`text-menu-item-${i}`}>
                      <Text style={styles.menuTagText}>{item}</Text>
                    </View>
                  ))}
                </View>

                {matchedAllergies.length > 0 ? (
                  <View style={styles.allergyWarning}>
                    <Text style={styles.warningLabel}>알레르기 주의:</Text>
                    <View style={styles.allergyBadges}>
                      {matchedAllergies.map((a, i) => (
                        <Badge key={i} variant="destructive" style={{ marginRight: 4 }}>
                          {a}
                        </Badge>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.safeInfo}>
                    <Text style={styles.safeText}>
                      오늘 급식에 해당하는 알레르기 항목이 없습니다.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View>
                <Skeleton height={200} style={{ marginBottom: 12 }} />
                <Skeleton height={20} width="80%" style={{ marginBottom: 8 }} />
                <Skeleton height={20} width="60%" />
              </View>
            )}
          </CardContent>
        </Card>

        {/* 포인트 카드 */}
        <Card style={styles.card} testID="card-points">
          <CardHeader style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: "#FEFCE8" }]}>
                <Star size={16} color="#EAB308" />
              </View>
              <View>
                <Text style={styles.cardTitle}>내 포인트</Text>
                <Text style={styles.cardSubtitle}>평가·참여로 포인트 적립</Text>
              </View>
            </View>
            <Text style={styles.pointsText} testID="text-points">
              {displayPoints}P
            </Text>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            <View style={styles.grid2}>
              <Pressable
                testID="button-feedback"
                onPress={() => setShowFeedbackModal(true)}
                style={({ pressed }) => [
                  styles.gridItem,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <MessageSquare size={20} color="#0071E3" />
                <Text style={styles.itemTitle}>평가 및 건의</Text>
                <Text style={styles.itemSubText}>+30P</Text>
              </Pressable>
              <Pressable
                testID="button-ranking"
                onPress={() => router.push("/(app)/ranking")}
                style={({ pressed }) => [
                  styles.gridItem,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Trophy size={20} color="#0071E3" />
                <Text style={styles.itemTitle}>랭킹 보기</Text>
                <Text style={styles.itemSubText}>반/학교</Text>
              </Pressable>
            </View>
            <Button
              variant="outline"
              testID="button-cleanplate"
              onPress={() => router.push("/(app)/cleanplate")}
              style={styles.actionButton}
            >
              <Camera size={20} color="#16A34A" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>잔반제로 도전하기</Text>
              <Text style={styles.actionButtonSub}>+100P</Text>
            </Button>
            <Button
              variant="outline"
              testID="button-store"
              onPress={() => router.push("/(app)/store")}
              style={[styles.actionButton, styles.storeButton]}
            >
              <ShoppingBag size={20} color="#3B82F6" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>포인트 스토어</Text>
              <Text style={styles.actionButtonSub}>포인트로 교환</Text>
            </Button>
          </CardContent>
        </Card>

        {/* 급식실 현황 카드 */}
        <Card style={styles.card} testID="card-congestion">
          <CardHeader style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: "#EFF6FF" }]}>
                <Clock size={16} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.cardTitle}>급식실 현황</Text>
                <Text style={styles.cardSubtitle}>최적 입장 시간 안내</Text>
              </View>
            </View>
            <Badge
              variant={congestionInfo.badgeVariant}
              style={congestionInfo.badgeStyle}
              textStyle={congestionInfo.textStyle}
              testID="badge-congestion-status"
            >
              {congestionInfo.statusLabel}
            </Badge>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            <View style={styles.statusBox}>
              <View>
                <Text style={styles.statusLabel}>예상 대기시간</Text>
                <Text style={styles.statusSub}>시간대 기반 예측</Text>
              </View>
              <Text style={styles.statusValue} testID="text-wait-time">
                {congestionInfo.waitTime}
              </Text>
            </View>
            <View style={[styles.statusBox, { backgroundColor: "#EFF6FF" }]}>
              <View>
                <Text style={styles.statusLabel}>추천 입장 시간</Text>
                <Text style={styles.statusSub}>혼잡 최소 시간대</Text>
              </View>
              <View style={styles.bestTimeRow}>
                <TrendingUp size={14} color="#0071E3" />
                <Text style={styles.bestTimeText}>{congestionInfo.bestTime}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 바로가기 */}
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>바로가기</Text>
        </View>
        <View style={styles.grid2}>
          <Pressable
            testID="button-buddy-quicklink"
            onPress={() => router.push("/(app)/buddy")}
            style={({ pressed }) => [
              styles.gridItem,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Users size={20} color="#A855F7" />
            <Text style={styles.itemTitle}>급식메이트</Text>
            <Text style={styles.itemSubText}>+100P</Text>
          </Pressable>
          <Pressable
            testID="button-class-battle-quicklink"
            onPress={() => router.push("/(app)/class-battle")}
            style={({ pressed }) => [
              styles.gridItem,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Swords size={20} color="#EAB308" />
            <Text style={styles.itemTitle}>급식 대항전</Text>
            <Text style={styles.itemSubText}>반 순위 보기</Text>
          </Pressable>
        </View>

        {isAdmin && (
          <View style={{ marginTop: 24, marginBottom: 40 }}>
            <Text style={styles.adminSectionTitle}>관리자 메뉴</Text>
            <Button
              variant="outline"
              testID="button-admin-cleanplate"
              onPress={() => router.push("/(app)/admin/cleanplate")}
              style={styles.adminButton}
            >
              <ShieldCheck size={16} color="#0071E3" style={{ marginRight: 8 }} />
              <Text style={styles.adminButtonText}>클린플레이트 검토</Text>
            </Button>
            <Button
              variant="outline"
              testID="button-admin-moderation"
              onPress={() => router.push("/(app)/admin/moderation")}
              style={styles.adminButton}
            >
              <ShieldAlert size={16} color="#0071E3" style={{ marginRight: 8 }} />
              <Text style={styles.adminButtonText}>신고 모더레이션</Text>
            </Button>
            <Button
              variant="outline"
              testID="button-admin-store"
              onPress={() => router.push("/(app)/admin/store")}
              style={styles.adminButton}
            >
              <ShoppingBag size={16} color="#0071E3" style={{ marginRight: 8 }} />
              <Text style={styles.adminButtonText}>스토어 관리</Text>
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
  header: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(210, 210, 215, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#F5F5F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#86868B",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notifButton: {
    padding: 8,
    borderRadius: 11,
    marginRight: 4,
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#86868B",
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  mealImageContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  mealImage: {
    width: "100%",
    height: "100%",
  },
  mealImagePlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 8,
  },
  menuTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  menuTag: {
    backgroundColor: "#F5F5F7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  menuTagText: {
    fontSize: 13,
    color: "#1D1D1F",
  },
  allergyWarning: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  warningLabel: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
    marginRight: 8,
  },
  allergyBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  safeInfo: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 12,
  },
  safeText: {
    fontSize: 12,
    color: "#15803D",
  },
  pointsText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  grid2: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  gridItem: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2D2D7",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1D1D1F",
    marginTop: 6,
  },
  itemSubText: {
    fontSize: 11,
    color: "#86868B",
    marginTop: 2,
  },
  actionButton: {
    width: "100%",
    height: 52,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  actionButtonSub: {
    fontSize: 11,
    color: "#86868B",
    marginLeft: 8,
  },
  storeButton: {
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
    marginBottom: 0,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F7",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  statusSub: {
    fontSize: 12,
    color: "#86868B",
  },
  statusValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  bestTimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bestTimeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0071E3",
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  adminSectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#86868B",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  adminButton: {
    marginBottom: 8,
    height: 48,
    justifyContent: "center",
  },
  adminButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  modalBody: {
    padding: 20,
  },
  starContainer: {
    flexDirection: "row",
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#86868B",
    marginBottom: 12,
  },
  charCount: {
    fontSize: 11,
    color: "#86868B",
    textAlign: "right",
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: "#EF4444",
    marginTop: 8,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerNote: {
    fontSize: 12,
    color: "#86868B",
    textAlign: "center",
    marginTop: 8,
  },
  successContent: {
    padding: 32,
    alignItems: "center",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: "#86868B",
    marginBottom: 24,
  },
});
