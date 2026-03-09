import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ArrowLeft,
  ShoppingBag,
  ClipboardList,
  Coins,
  Tag,
  Package,
  Gift,
  Star,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react-native";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CATEGORY_COLORS, STATUS_CONFIG } from "@/lib/shared";
import type { StoreItem, RedemptionWithItem } from "@/lib/shared";

const CATEGORY_ICONS: Record<string, any> = {
  "실물": Package,
  "쿠폰": Tag,
  "특권": Star,
  "식권": Gift,
  "기타": ShoppingBag,
};

function ConfirmModal({
  item,
  onConfirm,
  onCancel,
  isPending,
}: {
  item: StoreItem;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>포인트 교환 신청</Text>
          <Text style={styles.modalDescription}>
            아래 상품으로 교환을 신청하시겠어요?
          </Text>

          <View style={styles.modalInfoBox}>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>상품명</Text>
              <Text style={styles.modalInfoValue}>{item.name}</Text>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>차감 포인트</Text>
              <Text style={styles.modalInfoPrice}>
                {item.pricePoints.toLocaleString()}P
              </Text>
            </View>
          </View>

          <Text style={styles.modalNotice}>
            교환 후 급식실에서 담당 선생님께 확인받으세요.
          </Text>

          <View style={styles.modalButtons}>
            <Button
              variant="outline"
              style={{ flex: 1 }}
              onPress={onCancel}
              disabled={isPending}
              testID="button-cancel-redeem"
            >
              취소
            </Button>
            <Button
              style={{ flex: 1 }}
              onPress={onConfirm}
              disabled={isPending}
              loading={isPending}
              testID="button-confirm-redeem"
            >
              교환 신청
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function StorePage() {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);

  const { data: meData } = useQuery<{ ok: boolean; user: { points: number } }>({
    queryKey: ["/api/me"],
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{
    ok: boolean;
    items: StoreItem[];
  }>({
    queryKey: ["/api/store/items"],
  });

  const { data: redemptionsData, isLoading: redemptionsLoading } = useQuery<{
    ok: boolean;
    redemptions: RedemptionWithItem[];
  }>({
    queryKey: ["/api/store/me/redemptions"],
  });

  const redeemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", "/api/store/redeem", {
        itemId,
        quantity: 1,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "교환에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/me/redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setSelectedItem(null);
      toast({
        title: "교환 신청 완료",
        description: "담당 선생님께 확인 후 수령하실 수 있습니다.",
      });
    },
    onError: (error: any) => {
      setSelectedItem(null);
      toast({
        title: "교환 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const myPoints = meData?.user?.points ?? 0;
  const items = itemsData?.items ?? [];
  const redemptions = redemptionsData?.redemptions ?? [];

  const readyCount = redemptions.filter((r) => r.status === "READY").length;

  return (
    <SafeAreaView style={styles.container}>
      {selectedItem && (
        <ConfirmModal
          item={selectedItem}
          onConfirm={() => redeemMutation.mutate(selectedItem.id)}
          onCancel={() => setSelectedItem(null)}
          isPending={redeemMutation.isPending}
        />
      )}

      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/dashboard")}
          style={styles.backButton}
          testID="button-back"
        >
          <ArrowLeft size={20} color="#666" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>포인트 스토어</Text>
          <Text style={styles.headerSubtitle}>내 포인트로 교환하세요</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Coins size={14} color="#0071E3" />
          <Text style={styles.pointsText} testID="text-my-points">
            {myPoints.toLocaleString()}P
          </Text>
        </View>
      </View>

      <Tabs defaultValue="items" style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <TabsList style={styles.tabsList}>
            <TabsTrigger value="items">
              <View style={styles.tabTriggerInner}>
                <ShoppingBag size={16} color="#666" />
                <Text style={{ marginLeft: 6 }}>상품 목록</Text>
              </View>
            </TabsTrigger>
            <TabsTrigger value="history">
              <View style={styles.tabTriggerInner}>
                <ClipboardList size={16} color="#666" />
                <Text style={{ marginLeft: 6 }}>교환 내역</Text>
                {readyCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>{readyCount}</Text>
                  </View>
                )}
              </View>
            </TabsTrigger>
          </TabsList>
        </View>

        <TabsContent value="items" style={{ flex: 1 }}>
          {itemsLoading ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={110} style={{ marginBottom: 12 }} />
              ))}
            </ScrollView>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="아직 등록된 상품이 없어요"
              description="선생님이 상품을 등록하면 여기에 표시됩니다."
            />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.scrollContent}
              renderItem={({ item }) => {
                const canAfford = myPoints >= item.pricePoints;
                const outOfStock = item.stock !== null && item.stock === 0;
                const Icon = CATEGORY_ICONS[item.category] || ShoppingBag;
                const colors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS["기타"];

                return (
                  <Card
                    style={[
                      styles.itemCard,
                      outOfStock && { opacity: 0.6 }
                    ]}
                    testID={`card-item-${item.id}`}
                  >
                    <CardContent style={styles.itemCardContent}>
                      <View style={styles.itemIconBox}>
                        <Icon size={20} color="#666" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Badge
                            style={{
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                              borderWidth: 1,
                            }}
                            textStyle={{ color: colors.text }}
                          >
                            <Icon size={10} color={colors.text} style={{marginRight: 4}} />
                            {item.category}
                          </Badge>
                        </View>

                        {item.description && (
                          <Text style={styles.itemDescription} numberOfLines={2}>
                            {item.description}
                          </Text>
                        )}

                        <View style={styles.itemFooter}>
                          <View style={styles.priceRow}>
                            <Text style={styles.itemPrice}>
                              {item.pricePoints.toLocaleString()}P
                            </Text>
                            {item.stock !== null && (
                              <Text style={styles.itemStock}>
                                재고 {item.stock}개
                              </Text>
                            )}
                          </View>
                          <Button
                            size="sm"
                            disabled={!canAfford || outOfStock}
                            onPress={() => setSelectedItem(item)}
                            variant={(!canAfford || outOfStock) ? "secondary" : "default"}
                            style={styles.redeemButton}
                            testID={`button-redeem-${item.id}`}
                          >
                            {outOfStock
                              ? "품절"
                              : !canAfford
                              ? "포인트 부족"
                              : "교환하기"}
                          </Button>
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                );
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="history" style={{ flex: 1 }}>
          {redemptionsLoading ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={80} style={{ marginBottom: 12 }} />
              ))}
            </ScrollView>
          ) : redemptions.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="교환 내역이 없어요"
              description="상품을 교환하면 내역이 표시됩니다."
            />
          ) : (
            <FlatList
              data={redemptions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.scrollContent}
              renderItem={({ item: r }) => {
                const status = STATUS_CONFIG[r.status] || STATUS_CONFIG["REQUESTED"];
                const StatusIcon = r.status === "REQUESTED" ? Clock : (r.status === "CANCELLED" ? XCircle : CheckCircle);
                const statusIconColor = r.status === "CANCELLED" ? "#EF4444" : (r.status === "REQUESTED" ? "#EAB308" : "#22C55E");

                return (
                  <Card style={styles.historyCard} testID={`card-redemption-${r.id}`}>
                    <CardContent style={{ padding: 16 }}>
                      <View style={styles.historyHeader}>
                        <Badge
                          style={{
                            backgroundColor: status.bg,
                          }}
                          textStyle={{ color: status.text }}
                        >
                          <StatusIcon size={12} color={status.text} style={{marginRight: 4}} />
                          {status.label}
                        </Badge>
                      </View>
                      <Text style={styles.historyItemName}>{r.itemName}</Text>
                      <Text style={styles.historyMeta}>
                        {r.pointsSpent.toLocaleString()}P · {new Date(r.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </Text>
                      {r.adminNote && (
                        <View style={styles.adminNote}>
                          <Text style={styles.adminNoteText}>{r.adminNote}</Text>
                        </View>
                      )}
                      {r.status === "READY" && (
                        <View style={styles.readyBanner}>
                          <CheckCircle size={14} color="#15803D" />
                          <Text style={styles.readyText}>급식실 담당 선생님께 확인받으세요!</Text>
                        </View>
                      )}
                    </CardContent>
                  </Card>
                );
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#86868B",
  },
  pointsBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#D0E7FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0071E3",
    marginLeft: 4,
  },
  tabsList: {
    marginBottom: 0,
  },
  tabTriggerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    backgroundColor: "#22C55E",
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    paddingHorizontal: 4,
  },
  notificationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  itemCard: {
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  itemCardContent: {
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  itemIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F5F5F7",
    alignItems: "center",
    justifyContent: "center",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
    flex: 1,
    marginRight: 8,
  },
  itemDescription: {
    fontSize: 12,
    color: "#86868B",
    marginBottom: 8,
    lineHeight: 16,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0071E3",
    marginRight: 6,
  },
  itemStock: {
    fontSize: 11,
    color: "#86868B",
  },
  redeemButton: {
    height: 32,
    paddingHorizontal: 12,
  },
  historyCard: {
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  historyItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  historyMeta: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 2,
  },
  adminNote: {
    marginTop: 8,
    backgroundColor: "#F5F5F7",
    padding: 8,
    borderRadius: 10,
  },
  adminNoteText: {
    fontSize: 12,
    color: "#4B5563",
  },
  readyBanner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    padding: 10,
    borderRadius: 12,
  },
  readyText: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "600",
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: "100%",
    maxWidth: 340,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1D1D1F",
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: "#86868B",
    marginBottom: 20,
  },
  modalInfoBox: {
    backgroundColor: "#F5F5F7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  modalInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: "#86868B",
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  modalInfoPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0071E3",
  },
  modalNotice: {
    fontSize: 12,
    color: "#86868B",
    textAlign: "center",
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
});
