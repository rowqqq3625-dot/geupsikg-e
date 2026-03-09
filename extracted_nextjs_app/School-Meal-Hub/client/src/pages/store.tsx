import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShoppingBag, ClipboardList, Coins, Tag, Package, Gift, Star, AlertCircle, CheckCircle, Clock, XCircle, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { StoreItem, Redemption } from "@shared/schema";

type RedemptionWithItem = Redemption & { itemName: string; itemCategory: string };

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  "실물": <Package className="w-4 h-4" />,
  "쿠폰": <Tag className="w-4 h-4" />,
  "특권": <Star className="w-4 h-4" />,
  "식권": <Gift className="w-4 h-4" />,
  "기타": <ShoppingBag className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  "실물": "bg-blue-50 text-blue-700 border-blue-200",
  "쿠폰": "bg-orange-50 text-orange-700 border-orange-200",
  "특권": "bg-purple-50 text-purple-700 border-purple-200",
  "식권": "bg-green-50 text-green-700 border-green-200",
  "기타": "bg-gray-50 text-gray-700 border-gray-200",
};

const STATUS_CONFIG: Record<string, { label: string; icon: JSX.Element; color: string }> = {
  REQUESTED: { label: "접수됨", icon: <Clock className="w-3.5 h-3.5" />, color: "text-yellow-600 bg-yellow-50" },
  APPROVED: { label: "승인됨", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-blue-600 bg-blue-50" },
  READY: { label: "수령 가능", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-green-600 bg-green-50" },
  COMPLETED: { label: "수령 완료", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-gray-500 bg-gray-50" },
  CANCELLED: { label: "취소됨", icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-500 bg-red-50" },
};

function ConfirmModal({ item, onConfirm, onCancel, isPending }: {
  item: StoreItem;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">포인트 교환 신청</h3>
        <p className="text-sm text-gray-500 mb-5">아래 상품으로 교환을 신청하시겠어요?</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">상품명</span>
            <span className="font-medium text-gray-900">{item.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">차감 포인트</span>
            <span className="font-semibold text-blue-600">{item.pricePoints.toLocaleString()}P</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-5 text-center">교환 후 급식실에서 담당 선생님께 확인받으세요.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending} data-testid="button-cancel-redeem">
            취소
          </Button>
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={onConfirm} disabled={isPending} data-testid="button-confirm-redeem">
            {isPending ? "처리 중…" : "교환 신청"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StorePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);

  const { data: meData } = useQuery<{ ok: boolean; user: { points: number } }>({
    queryKey: ["/api/me"],
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ ok: boolean; items: StoreItem[] }>({
    queryKey: ["/api/store/items"],
  });

  const { data: redemptionsData, isLoading: redemptionsLoading } = useQuery<{ ok: boolean; redemptions: RedemptionWithItem[] }>({
    queryKey: ["/api/store/me/redemptions"],
  });

  const redeemMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest("POST", "/api/store/redeem", { itemId, quantity: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/me/redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setSelectedItem(null);
      toast({ title: "교환 신청 완료", description: "담당 선생님께 확인 후 수령하실 수 있습니다." });
    },
    onError: (error: any) => {
      setSelectedItem(null);
      const message = error?.message ?? "교환에 실패했습니다.";
      toast({ title: "교환 실패", description: message, variant: "destructive" });
    },
  });

  const myPoints = meData?.user?.points ?? 0;
  const items = itemsData?.items ?? [];
  const redemptions = redemptionsData?.redemptions ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {selectedItem && (
        <ConfirmModal
          item={selectedItem}
          onConfirm={() => redeemMutation.mutate(selectedItem.id)}
          onCancel={() => setSelectedItem(null)}
          isPending={redeemMutation.isPending}
        />
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">포인트 스토어</h1>
            <p className="text-xs text-gray-400">내 포인트로 교환하세요</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5">
            <Coins className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700" data-testid="text-my-points">{myPoints.toLocaleString()}P</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">
        <Tabs defaultValue="items">
          <TabsList className="w-full mb-5 bg-gray-100 rounded-xl p-1">
            <TabsTrigger value="items" className="flex-1 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg" data-testid="tab-items">
              <ShoppingBag className="w-4 h-4" />
              상품 목록
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg" data-testid="tab-history">
              <ClipboardList className="w-4 h-4" />
              교환 내역
              {redemptions.filter(r => r.status === "READY").length > 0 && (
                <span className="ml-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {redemptions.filter(r => r.status === "READY").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 상품 목록 탭 */}
          <TabsContent value="items">
            {itemsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="아직 등록된 상품이 없어요" description="선생님이 상품을 등록하면 여기에 표시됩니다." />
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const canAfford = myPoints >= item.pricePoints;
                  const outOfStock = item.stock !== null && item.stock === 0;
                  return (
                    <Card key={item.id} className={`border rounded-2xl shadow-none transition-all ${outOfStock ? "opacity-60" : "hover:border-gray-300"}`} data-testid={`card-item-${item.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                            {CATEGORY_ICONS[item.category] ?? <ShoppingBag className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-gray-900 text-sm leading-snug">{item.name}</h3>
                              <span className={`text-xs border rounded-full px-2 py-0.5 flex items-center gap-1 flex-shrink-0 ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS["기타"]}`}>
                                {CATEGORY_ICONS[item.category]}
                                {item.category}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-blue-600">{item.pricePoints.toLocaleString()}P</span>
                                {item.stock !== null && (
                                  <span className="text-xs text-gray-400">재고 {item.stock}개</span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                disabled={!canAfford || outOfStock}
                                onClick={() => setSelectedItem(item)}
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
                                data-testid={`button-redeem-${item.id}`}
                              >
                                {outOfStock ? "품절" : !canAfford ? "포인트 부족" : "교환하기"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* 교환 내역 탭 */}
          <TabsContent value="history">
            {redemptionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
              </div>
            ) : redemptions.length === 0 ? (
              <EmptyState icon={ClipboardList} title="교환 내역이 없어요" description="상품을 교환하면 내역이 표시됩니다." />
            ) : (
              <div className="space-y-3">
                {redemptions.map((r) => {
                  const status = STATUS_CONFIG[r.status] ?? STATUS_CONFIG["REQUESTED"];
                  return (
                    <Card key={r.id} className="border rounded-2xl shadow-none" data-testid={`card-redemption-${r.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                                {status.icon}
                                {status.label}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">{r.itemName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {r.pointsSpent.toLocaleString()}P · {new Date(r.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                            </p>
                            {r.adminNote && (
                              <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">{r.adminNote}</p>
                            )}
                          </div>
                        </div>
                        {r.status === "READY" && (
                          <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <p className="text-xs text-green-700 font-medium">급식실 담당 선생님께 확인받으세요!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
