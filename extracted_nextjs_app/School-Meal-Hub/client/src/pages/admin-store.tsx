import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Package, Tag, Star, Gift, ShoppingBag, Pencil, Trash2, ClipboardList, CheckCircle, Clock, XCircle, MoreHorizontal, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { StoreItem, Redemption } from "@shared/schema";

type RedemptionWithStudent = Redemption & { itemName: string; studentNumber: number; grade: number; classNum: number };

const itemFormSchema = z.object({
  name: z.string().min(1, "상품명은 필수입니다").max(100),
  description: z.string().max(300).optional(),
  category: z.enum(["실물", "쿠폰", "특권", "식권", "기타"]),
  pricePoints: z.number().int().min(1),
  stock: z.number().int().min(0).optional().nullable(),
  perUserDailyLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean(),
});
type ItemFormValues = z.infer<typeof itemFormSchema>;

const CATEGORY_OPTIONS = ["실물", "쿠폰", "특권", "식권", "기타"] as const;
const CATEGORY_ICONS: Record<string, JSX.Element> = {
  "실물": <Package className="w-4 h-4" />,
  "쿠폰": <Tag className="w-4 h-4" />,
  "특권": <Star className="w-4 h-4" />,
  "식권": <Gift className="w-4 h-4" />,
  "기타": <ShoppingBag className="w-4 h-4" />,
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "접수됨", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  APPROVED: { label: "승인됨", color: "bg-blue-50 text-blue-700 border-blue-200" },
  READY: { label: "수령 가능", color: "bg-green-50 text-green-700 border-green-200" },
  COMPLETED: { label: "수령 완료", color: "bg-gray-50 text-gray-500 border-gray-200" },
  CANCELLED: { label: "취소됨", color: "bg-red-50 text-red-600 border-red-200" },
};

const PROCESS_OPTIONS = [
  { value: "APPROVED", label: "승인" },
  { value: "READY", label: "수령 준비" },
  { value: "COMPLETED", label: "수령 완료" },
  { value: "CANCELLED", label: "취소" },
];

function ItemFormModal({ editItem, onClose }: { editItem?: StoreItem; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: editItem ? {
      name: editItem.name,
      description: editItem.description ?? "",
      category: editItem.category as any,
      pricePoints: editItem.pricePoints,
      stock: editItem.stock,
      perUserDailyLimit: editItem.perUserDailyLimit,
      isActive: editItem.isActive,
    } : {
      name: "",
      description: "",
      category: "기타",
      pricePoints: 100,
      stock: null,
      perUserDailyLimit: null,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ItemFormValues) => apiRequest("POST", "/api/admin/store/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/items"] });
      toast({ title: "상품 등록 완료" });
      onClose();
    },
    onError: () => toast({ title: "등록 실패", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ItemFormValues) => apiRequest("PATCH", `/api/admin/store/items/${editItem!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/items"] });
      toast({ title: "상품 수정 완료" });
      onClose();
    },
    onError: () => toast({ title: "수정 실패", variant: "destructive" }),
  });

  const onSubmit = (data: ItemFormValues) => {
    const payload = { ...data, stock: data.stock ?? null, perUserDailyLimit: data.perUserDailyLimit ?? null };
    if (editItem) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{editItem ? "상품 수정" : "상품 등록"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" data-testid="button-close-form">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>상품명 <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="예: 매점 쿠폰 1,000원" {...field} data-testid="input-item-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>설명</FormLabel>
                <FormControl>
                  <Textarea placeholder="상품 설명 (선택)" className="resize-none" rows={2} {...field} data-testid="input-item-description" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>분류 <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="pricePoints" render={({ field }) => (
                <FormItem>
                  <FormLabel>교환 포인트 <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={1}
                      {...field}
                      onChange={e => field.onChange(Number(e.target.value))}
                      data-testid="input-price-points"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>재고 수량</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={0} placeholder="비워두면 무제한"
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      data-testid="input-stock"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="perUserDailyLimit" render={({ field }) => (
                <FormItem>
                  <FormLabel>1인 일일 한도</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={1} placeholder="비워두면 무제한"
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      data-testid="input-daily-limit"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <FormLabel className="text-sm font-medium">상품 활성화</FormLabel>
                    <p className="text-xs text-gray-400 mt-0.5">비활성화 시 학생에게 노출되지 않아요</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-active" />
                  </FormControl>
                </div>
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
                취소
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isPending} data-testid="button-submit-item">
                {isPending ? "저장 중…" : editItem ? "수정 저장" : "상품 등록"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

function ProcessModal({ redemption, onClose }: { redemption: RedemptionWithStudent; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("APPROVED");
  const [note, setNote] = useState("");

  const processMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/store/redemptions/${redemption.id}/process`, { status, adminNote: note || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/redemptions"] });
      toast({ title: "처리 완료" });
      onClose();
    },
    onError: () => toast({ title: "처리 실패", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">교환 요청 처리</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">학생</span>
            <span className="font-medium">{redemption.grade}학년 {redemption.classNum}반 {redemption.studentNumber}번</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">상품</span>
            <span className="font-medium">{redemption.itemName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">차감 포인트</span>
            <span className="font-semibold text-blue-600">{redemption.pointsSpent.toLocaleString()}P</span>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">처리 상태</label>
            <div className="grid grid-cols-2 gap-2">
              {PROCESS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`text-sm py-2 px-3 rounded-xl border transition-colors ${status === opt.value ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  data-testid={`button-status-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">메모 (선택)</label>
            <Textarea
              placeholder="학생에게 전달할 메모"
              rows={2}
              className="resize-none"
              value={note}
              onChange={e => setNote(e.target.value)}
              data-testid="input-admin-note"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={processMutation.isPending}>취소</Button>
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => processMutation.mutate()} disabled={processMutation.isPending} data-testid="button-process-confirm">
            {processMutation.isPending ? "처리 중…" : "처리 완료"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStorePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | undefined>();
  const [processingRedemption, setProcessingRedemption] = useState<RedemptionWithStudent | undefined>();
  const [redemptionFilter, setRedemptionFilter] = useState("REQUESTED");

  const { data: meData } = useQuery<{ ok: boolean; user: { role: string } }>({ queryKey: ["/api/me"] });
  const isAdmin = meData?.user?.role === "ADMIN";

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ ok: boolean; items: StoreItem[] }>({
    queryKey: ["/api/admin/store/items"],
    enabled: isAdmin,
  });

  const { data: redemptionsData, isLoading: redemptionsLoading } = useQuery<{ ok: boolean; redemptions: RedemptionWithStudent[] }>({
    queryKey: ["/api/admin/store/redemptions", redemptionFilter],
    queryFn: () => fetch(`/api/admin/store/redemptions?status=${redemptionFilter}`, { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/store/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/items"] });
      toast({ title: "상품이 비활성화되었습니다" });
    },
    onError: () => toast({ title: "처리 실패", variant: "destructive" }),
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">관리자 권한이 필요합니다.</p>
          <Button onClick={() => navigate("/dashboard")}>돌아가기</Button>
        </div>
      </div>
    );
  }

  const items = itemsData?.items ?? [];
  const redemptions = redemptionsData?.redemptions ?? [];

  const pendingCount = items.filter(i => i.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {showItemForm && (
        <ItemFormModal editItem={editingItem} onClose={() => { setShowItemForm(false); setEditingItem(undefined); }} />
      )}
      {processingRedemption && (
        <ProcessModal redemption={processingRedemption} onClose={() => setProcessingRedemption(undefined)} />
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">포인트 스토어 관리</h1>
            <p className="text-xs text-gray-400">상품 등록 및 교환 요청 처리</p>
          </div>
          <Button
            size="sm"
            className="ml-auto bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1.5"
            onClick={() => { setEditingItem(undefined); setShowItemForm(true); }}
            data-testid="button-new-item"
          >
            <Plus className="w-3.5 h-3.5" />
            상품 등록
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <Tabs defaultValue="items">
          <TabsList className="w-full mb-5 bg-gray-100 rounded-xl p-1">
            <TabsTrigger value="items" className="flex-1 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg" data-testid="tab-admin-items">
              <Package className="w-4 h-4" />
              상품 관리
              <span className="text-xs text-gray-400">({items.length})</span>
            </TabsTrigger>
            <TabsTrigger value="redemptions" className="flex-1 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg" data-testid="tab-admin-redemptions">
              <ClipboardList className="w-4 h-4" />
              교환 요청
              {redemptions.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{redemptions.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 상품 관리 탭 */}
          <TabsContent value="items">
            {itemsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="등록된 상품이 없어요"
                description="첫 상품을 등록해 학생들에게 교환 혜택을 제공하세요."
                actionLabel="첫 상품 등록하기"
                onAction={() => { setEditingItem(undefined); setShowItemForm(true); }}
              />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <Card key={item.id} className={`border rounded-2xl shadow-none ${!item.isActive ? "opacity-60" : ""}`} data-testid={`card-admin-item-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                          {CATEGORY_ICONS[item.category] ?? <ShoppingBag className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                {!item.isActive && (
                                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">비활성</span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                <span className="font-semibold text-blue-600">{item.pricePoints.toLocaleString()}P</span>
                                <span>{item.category}</span>
                                {item.stock !== null ? <span>재고 {item.stock}개</span> : <span>무제한</span>}
                                {item.perUserDailyLimit !== null && <span>1인 {item.perUserDailyLimit}개/일</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                                onClick={() => { setEditingItem(item); setShowItemForm(true); }}
                                data-testid={`button-edit-${item.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {item.isActive && (
                                <button
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                                  onClick={() => { if (confirm(`"${item.name}" 상품을 비활성화하시겠어요?`)) deactivateMutation.mutate(item.id); }}
                                  data-testid={`button-deactivate-${item.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 교환 요청 탭 */}
          <TabsContent value="redemptions">
            {/* 필터 */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {["REQUESTED", "APPROVED", "READY", "COMPLETED", "CANCELLED"].map(s => (
                <button
                  key={s}
                  onClick={() => setRedemptionFilter(s)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${redemptionFilter === s ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  data-testid={`filter-${s}`}
                >
                  {STATUS_CONFIG[s]?.label ?? s}
                </button>
              ))}
            </div>

            {redemptionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
              </div>
            ) : redemptions.length === 0 ? (
              <EmptyState icon={ClipboardList} title="해당 상태의 교환 요청이 없어요" />
            ) : (
              <div className="space-y-3">
                {redemptions.map((r) => {
                  const status = STATUS_CONFIG[r.status];
                  return (
                    <Card key={r.id} className="border rounded-2xl shadow-none" data-testid={`card-redemption-admin-${r.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${status?.color ?? ""}`}>
                                {status?.label}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(r.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{r.itemName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {r.grade}학년 {r.classNum}반 {r.studentNumber}번 · {r.pointsSpent.toLocaleString()}P
                            </p>
                            {r.adminNote && (
                              <p className="text-xs text-gray-400 mt-1 bg-gray-50 rounded-lg px-2 py-1">{r.adminNote}</p>
                            )}
                          </div>
                          {(r.status === "REQUESTED" || r.status === "APPROVED") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-shrink-0 h-8 text-xs"
                              onClick={() => setProcessingRedemption(r)}
                              data-testid={`button-process-${r.id}`}
                            >
                              처리
                            </Button>
                          )}
                        </div>
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
