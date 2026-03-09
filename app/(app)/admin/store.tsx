import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal, Platform,
} from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/query-client";
import { router } from "expo-router";
import {
  ArrowLeft, ShoppingBag, Package, Tag, Star, Gift, Pencil,
  CheckCircle, XCircle, Clock, Plus,
} from "lucide-react-native";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORY_COLORS, STATUS_CONFIG } from "@/lib/shared/constants";
import type { StoreItem, RedemptionWithItem } from "@/lib/shared/types";

const CATEGORY_ICONS: Record<string, any> = {
  "실물": Package, "쿠폰": Tag, "특권": Star, "식권": Gift, "기타": ShoppingBag,
};
const CATEGORY_OPTIONS = [
  { value: "실물", label: "실물" }, { value: "쿠폰", label: "쿠폰" },
  { value: "특권", label: "특권" }, { value: "식권", label: "식권" }, { value: "기타", label: "기타" },
];
const STATUS_OPTIONS = [
  { value: "APPROVED", label: "승인" }, { value: "READY", label: "수령 가능" },
  { value: "COMPLETED", label: "수령 완료" }, { value: "CANCELLED", label: "취소" },
];

type RedemptionAdmin = RedemptionWithItem & { studentNumber: number; grade: number; classNum: number };

export default function AdminStorePage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("requests");
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | undefined>(undefined);
  const [processModal, setProcessModal] = useState<RedemptionAdmin | null>(null);
  const [processStatus, setProcessStatus] = useState("APPROVED");
  const [processNote, setProcessNote] = useState("");
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("실물");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formLimit, setFormLimit] = useState("");

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ ok: boolean; items: StoreItem[] }>({
    queryKey: ["/api/admin/store/items"],
    enabled: !!isAdmin,
  });

  const { data: redemptionsData, isLoading: redemptionsLoading } = useQuery<{ ok: boolean; redemptions: RedemptionAdmin[] }>({
    queryKey: ["/api/admin/store/redemptions"],
    enabled: !!isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        name: formName, description: formDesc || null, category: formCategory,
        pricePoints: parseInt(formPrice), stock: formStock ? parseInt(formStock) : null,
        perUserDailyLimit: formLimit ? parseInt(formLimit) : null,
      };
      if (editingItem) {
        return apiRequest("PUT", `/api/admin/store/items/${editingItem.id}`, body);
      }
      return apiRequest("POST", "/api/admin/store/items", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/items"] });
      setShowItemForm(false);
      resetForm();
      toast({ title: editingItem ? "상품 수정 완료" : "상품 등록 완료" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      if (!processModal) return;
      return apiRequest("POST", `/api/admin/store/redemptions/${processModal.id}/process`, {
        status: processStatus, adminNote: processNote || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/redemptions"] });
      setProcessModal(null);
      setProcessNote("");
      toast({ title: "처리 완료" });
    },
  });

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormCategory("실물");
    setFormPrice(""); setFormStock(""); setFormLimit(""); setEditingItem(undefined);
  };

  const openEditForm = (item: StoreItem) => {
    setEditingItem(item);
    setFormName(item.name); setFormDesc(item.description || "");
    setFormCategory(item.category); setFormPrice(String(item.pricePoints));
    setFormStock(item.stock !== null ? String(item.stock) : "");
    setFormLimit(item.perUserDailyLimit !== null ? String(item.perUserDailyLimit) : "");
    setShowItemForm(true);
  };

  const items = itemsData?.items ?? [];
  const redemptions = redemptionsData?.redemptions ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/dashboard")} style={styles.backBtn}>
          <ArrowLeft size={20} color="#1D1D1F" />
        </Pressable>
        <Text style={styles.headerTitle}>포인트 스토어 관리</Text>
        <Pressable onPress={() => { resetForm(); setShowItemForm(true); }} style={styles.backBtn}>
          <Plus size={20} color="#0071E3" />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="requests">교환 요청</TabsTrigger>
            <TabsTrigger value="items">상품 관리</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {redemptionsLoading ? (
                <View style={{ gap: 12 }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={80} borderRadius={16} />)}</View>
              ) : redemptions.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="교환 요청이 없어요" description="학생들이 상품을 교환하면 여기에 표시됩니다." />
              ) : (
                <View style={{ gap: 12 }}>
                  {redemptions.map((r) => {
                    const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG["REQUESTED"];
                    return (
                      <Card key={r.id}>
                        <CardContent style={{ paddingTop: 16 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <Badge style={{ backgroundColor: sc.bg }} textStyle={{ color: sc.text }}>{sc.label}</Badge>
                              </View>
                              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1D1D1F" }}>{r.itemName}</Text>
                              <Text style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>
                                {r.grade}학년 {r.classNum}반 {r.studentNumber}번 · {r.pointsSpent.toLocaleString()}P
                              </Text>
                            </View>
                            {(r.status === "REQUESTED" || r.status === "APPROVED") && (
                              <Button size="sm" onPress={() => { setProcessModal(r); setProcessStatus("APPROVED"); }}>처리</Button>
                            )}
                          </View>
                        </CardContent>
                      </Card>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </TabsContent>

          <TabsContent value="items">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {itemsLoading ? (
                <View style={{ gap: 12 }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={80} borderRadius={16} />)}</View>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="등록된 상품이 없어요"
                  description="첫 상품을 등록해 학생들에게 교환 혜택을 제공하세요."
                  actionLabel="상품 등록하기"
                  onAction={() => { resetForm(); setShowItemForm(true); }}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {items.map((item) => {
                    const IconComp = CATEGORY_ICONS[item.category] ?? ShoppingBag;
                    const cc = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS["기타"];
                    return (
                      <Card key={item.id} style={!item.isActive ? { opacity: 0.6 } : undefined}>
                        <CardContent style={{ paddingTop: 16 }}>
                          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cc.bg, alignItems: "center", justifyContent: "center" }}>
                              <IconComp size={18} color={cc.text} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1D1D1F" }}>{item.name}</Text>
                              <Text style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>
                                {item.pricePoints.toLocaleString()}P · {item.category}
                                {item.stock !== null ? ` · 재고 ${item.stock}` : " · 무제한"}
                              </Text>
                            </View>
                            <Pressable onPress={() => openEditForm(item)} style={{ padding: 8 }}>
                              <Pencil size={16} color="#86868B" />
                            </Pressable>
                          </View>
                        </CardContent>
                      </Card>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>

      <Modal visible={showItemForm} transparent animationType="fade" onRequestClose={() => setShowItemForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? "상품 수정" : "상품 등록"}</Text>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 12, padding: 20 }}>
              <Input placeholder="상품명" value={formName} onChangeText={setFormName} />
              <Textarea placeholder="설명 (선택)" value={formDesc} onChangeText={setFormDesc} />
              <Select value={formCategory} onValueChange={setFormCategory} options={CATEGORY_OPTIONS} placeholder="카테고리" />
              <Input placeholder="가격 (포인트)" keyboardType="number-pad" value={formPrice} onChangeText={setFormPrice} />
              <Input placeholder="재고 수량 (비워두면 무제한)" keyboardType="number-pad" value={formStock} onChangeText={setFormStock} />
              <Input placeholder="1인 일일 한도 (비워두면 무제한)" keyboardType="number-pad" value={formLimit} onChangeText={setFormLimit} />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button variant="outline" style={{ flex: 1 }} onPress={() => { setShowItemForm(false); resetForm(); }}>취소</Button>
              <Button style={{ flex: 1 }} onPress={() => createMutation.mutate()} loading={createMutation.isPending}>
                {editingItem ? "수정" : "등록"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!processModal} transparent animationType="fade" onRequestClose={() => setProcessModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>교환 요청 처리</Text>
            <View style={{ padding: 20, gap: 12 }}>
              <Select value={processStatus} onValueChange={setProcessStatus} options={STATUS_OPTIONS} placeholder="상태" />
              <Textarea placeholder="관리자 메모 (선택)" value={processNote} onChangeText={setProcessNote} />
            </View>
            <View style={styles.modalFooter}>
              <Button variant="outline" style={{ flex: 1 }} onPress={() => setProcessModal(null)}>취소</Button>
              <Button style={{ flex: 1 }} onPress={() => processMutation.mutate()} loading={processMutation.isPending}>처리</Button>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF", borderRadius: 20, width: "100%", maxHeight: "85%", overflow: "hidden",
  },
  modalTitle: { fontSize: 17, fontWeight: "600" as const, color: "#1D1D1F", padding: 20, paddingBottom: 0 },
  modalFooter: { flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: "#F5F5F7" },
});
