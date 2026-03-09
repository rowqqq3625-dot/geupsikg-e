import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";
import { router } from "expo-router";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  XCircle,
  UploadCloud,
  Loader2,
  ShieldAlert,
} from "lucide-react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as ImagePicker from "expo-image-picker";
import { BASE_URL } from "@/lib/shared";

type SubmissionStatus = "PENDING" | "AUTO_APPROVED" | "APPROVED" | "REJECTED";

type Submission = {
  id: string;
  status: SubmissionStatus;
  imageUrl: string;
  date: string;
  aiScore: number | null;
  pointsAwarded: number;
  createdAt: string;
};

type TodayResponse = {
  ok: boolean;
  submissions: Submission[];
  count: number;
  limit: number;
  canSubmit: boolean;
  nextSubmitAt: string | null;
};

type HistoryResponse = { ok: boolean; history: Submission[] };

type UploadResponse = {
  ok: boolean;
  submission: Submission;
  verdict: "APPROVE" | "PARTIAL" | "REJECT" | "REJECT_UNTOUCHED" | "REVIEW";
  eatenPercent: number;
  pointsDelta: number;
  newPoints: number;
  detail?: string;
};

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: "검토중", variant: "secondary" },
    AUTO_APPROVED: { label: "자동 승인 ✓", variant: "default" },
    APPROVED: { label: "승인 ✓", variant: "default" },
    REJECTED: { label: "미승인", variant: "destructive" },
  };
  const { label, variant } = map[status];
  
  const customStyles = status === "PENDING" ? { backgroundColor: "#FEFCE8", color: "#A16207", borderColor: "#FEF08A" } :
                      status === "AUTO_APPROVED" || status === "APPROVED" ? { backgroundColor: "#F0FDF4", color: "#15803D", borderColor: "#BBF7D0" } :
                      { backgroundColor: "#FEF2F2", color: "#DC2626", borderColor: "#FECACA" };

  return (
    <Badge 
      variant={variant} 
      style={{ 
        backgroundColor: customStyles.backgroundColor, 
        borderColor: customStyles.borderColor, 
        borderWidth: 1 
      }}
      textStyle={{ color: customStyles.color }}
    >
      {label}
    </Badge>
  );
}

function StatusIcon({ status }: { status: SubmissionStatus }) {
  if (status === "AUTO_APPROVED" || status === "APPROVED")
    return <CheckCircle2 size={20} color="#22C55E" />;
  if (status === "REJECTED") return <XCircle size={20} color="#F87171" />;
  return <Clock size={20} color="#EAB308" />;
}

function CooldownTimer({ nextSubmitAt }: { nextSubmitAt: string }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(nextSubmitAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/today"] });
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [nextSubmitAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <View style={styles.cooldownContainer}>
      <Clock size={16} color="#F59E0B" style={{ marginRight: 8 }} />
      <Text style={styles.cooldownText}>
        다음 인증까지 <Text style={{ fontWeight: "600" }}>{mins}분 {String(secs).padStart(2, "0")}초</Text> 남았습니다.
      </Text>
    </View>
  );
}

export default function CleanPlateScreen() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    pointsDelta: number;
    newPoints: number;
    status: SubmissionStatus;
    verdict?: string;
    eatenPercent?: number;
    detail?: string;
  } | null>(null);

  const { data: todayData, isLoading: todayLoading } = useQuery<TodayResponse>({
    queryKey: ["/api/cleanplate/today"],
    enabled: isAuthenticated,
    refetchInterval: (q) => {
      const data = q.state.data as TodayResponse | undefined;
      return data?.nextSubmitAt ? 5000 : false;
    },
  });

  const { data: historyData } = useQuery<HistoryResponse>({
    queryKey: ["/api/cleanplate/history"],
    enabled: isAuthenticated,
  });

  const uploadMutation = useMutation({
    mutationFn: async (uri: string) => {
      const formData = new FormData();
      const filename = uri.split("/").pop() ?? "photo.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "png" ? "image/png"
        : ext === "webp" ? "image/webp"
        : "image/jpeg";

      if (Platform.OS === "web") {
        // 웹: blob/data URI → Blob → File로 변환
        const blob = await fetch(uri).then((r) => r.blob());
        const file = new File([blob], filename, { type: mimeType });
        formData.append("file", file);
      } else {
        // 네이티브(iOS/Android): RN FormData 파일 객체 방식
        // @ts-ignore — RN의 FormData는 { uri, name, type } 객체를 파일로 인식
        formData.append("file", { uri, name: filename, type: mimeType });
      }

      let res: Response;
      try {
        res = await apiRequest("POST", "/api/cleanplate/upload", formData);
      } catch (rawErr) {
        // apiRequest가 throwIfResNotOk로 던진 에러에서 code 추출
        const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr);
        const jsonStart = errMsg.indexOf("{");
        let code: string | undefined;
        let message = "업로드에 실패했습니다.";
        if (jsonStart !== -1) {
          try {
            const parsed = JSON.parse(errMsg.slice(jsonStart));
            code = parsed?.error?.code;
            message = parsed?.error?.message ?? message;
          } catch {}
        }
        const err = new Error(message);
        (err as any).code = code;
        throw err;
      }

      const json = await res.json();
      if (!json.ok) {
        const err = new Error(json.error?.message ?? "업로드 실패");
        (err as any).code = json.error?.code;
        throw err;
      }
      return json as UploadResponse;
    },
    onSuccess: (data) => {
      setUploadError(null);
      setUploadResult({
        pointsDelta: data.pointsDelta,
        newPoints: data.newPoints,
        status: data.submission.status,
        verdict: data.verdict,
        eatenPercent: data.eatenPercent,
        detail: data.detail,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "업로드에 실패했습니다.";
      const code = (err as any)?.code as string | undefined;
      setUploadError(msg);
      if (code === "DUPLICATE_IMAGE") {
        queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/today"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cleanplate/history"] });
      }
    },
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setUploadError("갤러리 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploadError(null);
      uploadMutation.mutate(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setUploadError("카메라 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploadError(null);
      uploadMutation.mutate(result.assets[0].uri);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ padding: 16 }}>
          <Skeleton height={200} style={{ marginBottom: 16 }} />
          <Skeleton height={120} />
        </View>
      </SafeAreaView>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const todaySubmissions = todayData?.submissions ?? [];
  const count = todayData?.count ?? 0;
  const limit = todayData?.limit ?? 2;
  const nextSubmitAt = todayData?.nextSubmitAt ?? null;
  const history = historyData?.history ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/dashboard")}
            style={styles.backButton}
            testID="button-back"
          >
            <ArrowLeft size={20} color="#1D1D1F" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>클린플레이트 인증</Text>
            <Text style={styles.headerSubtitle}>잔반 없이 다 먹으면 +100P</Text>
          </View>
          {!todayLoading && (
            <View
              style={[
                styles.progressBadge,
                count >= limit && styles.progressBadgeComplete,
              ]}
              testID="text-daily-progress"
            >
              <Text
                style={[
                  styles.progressBadgeText,
                  count >= limit && styles.progressBadgeTextComplete,
                ]}
              >
                {count}/{limit} 완료
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 오늘 인증 카드 */}
        <Card style={styles.card}>
          <CardHeader style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Camera size={16} color="#16A34A" />
            </View>
            <View>
              <Text style={styles.cardTitle}>오늘 인증</Text>
              <Text style={styles.cardSubtitle}>
                {today} · 하루 최대 {limit}회
              </Text>
            </View>
          </CardHeader>

          <CardContent style={styles.cardContent}>
            {todayLoading ? (
              <Skeleton height={128} />
            ) : (
              <View style={{ gap: 12 }}>
                {todaySubmissions.map((s, i) => (
                  <View key={s.id} style={{ gap: 8 }} testID={`card-submission-today-${i}`}>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: s.imageUrl.startsWith("http") ? s.imageUrl : `${BASE_URL}${s.imageUrl}` }}
                        style={styles.submissionImage}
                        testID={`img-cleanplate-${i}`}
                      />
                      <View style={styles.imageOverlay}>
                        <Text style={styles.imageOverlayText}>{i + 1}번째 인증</Text>
                      </View>
                    </View>
                    <View style={styles.submissionInfo}>
                      <View style={styles.statusRow}>
                        <StatusIcon status={s.status} />
                        <StatusBadge status={s.status} />
                      </View>
                      {(s.status === "AUTO_APPROVED" || s.status === "APPROVED") && (
                        <Text style={styles.pointsText} testID={`text-points-${i}`}>
                          +{s.pointsAwarded}P 적립
                        </Text>
                      )}
                    </View>
                    {s.status === "PENDING" && (
                      <View style={styles.pendingInfo}>
                        <Text style={styles.pendingText}>
                          관리자 검토 중입니다. 승인되면 포인트가 적립됩니다.
                        </Text>
                      </View>
                    )}
                    {s.status === "REJECTED" && (
                      <View style={styles.rejectedInfo}>
                        <Text style={styles.rejectedText}>인증이 반려되었습니다.</Text>
                      </View>
                    )}
                  </View>
                ))}

                {uploadResult && (
                  <View
                    style={[
                      styles.resultContainer,
                      uploadResult.status === "AUTO_APPROVED"
                        ? styles.resultContainerApproved
                        : uploadResult.verdict === "REJECT_UNTOUCHED"
                        ? styles.resultContainerUntouched
                        : uploadResult.status === "REJECTED"
                        ? styles.resultContainerRejected
                        : styles.resultContainerPending,
                    ]}
                  >
                    {uploadResult.status === "AUTO_APPROVED" &&
                    uploadResult.verdict === "APPROVE" ? (
                      <View>
                        <Text style={styles.resultTextApproved}>
                          🎉 완식 인증! +{uploadResult.pointsDelta}P → 총{" "}
                          {uploadResult.newPoints}P
                        </Text>
                        {!!uploadResult.detail && (
                          <Text style={styles.resultTextApprovedSub}>
                            AI 분석: {uploadResult.detail}
                          </Text>
                        )}
                      </View>
                    ) : uploadResult.status === "AUTO_APPROVED" &&
                      uploadResult.verdict === "PARTIAL" ? (
                      <View>
                        <Text style={styles.resultTextApproved}>
                          ✅ 부분 섭취 인증! +{uploadResult.pointsDelta}P → 총{" "}
                          {uploadResult.newPoints}P
                        </Text>
                        <Text style={styles.resultTextApprovedSub}>
                          AI 판정 섭취율 약 {uploadResult.eatenPercent}%
                        </Text>
                      </View>
                    ) : uploadResult.verdict === "REJECT" ||
                      uploadResult.verdict === "REJECT_UNTOUCHED" ||
                      uploadResult.status === "REJECTED" ? (
                      <View>
                        <Text style={styles.resultTextRejected}>
                          잔반이 남아있습니다. 재도전해보세요!
                        </Text>
                        {!!uploadResult.detail && (
                          <Text style={styles.resultTextRejectedSub}>
                            AI 분석: {uploadResult.detail}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.resultTextPending}>
                        사진이 제출됐습니다. 관리자 검토 후 포인트가 적립됩니다.
                      </Text>
                    )}
                  </View>
                )}

                {count >= limit ? (
                  <View style={styles.limitReached} testID="text-limit-reached">
                    <ShieldAlert size={16} color="#16A34A" />
                    <Text style={styles.limitReachedText}>
                      오늘 인증을 모두 완료했습니다! 내일 다시 도전하세요.
                    </Text>
                  </View>
                ) : nextSubmitAt ? (
                  <CooldownTimer nextSubmitAt={nextSubmitAt} />
                ) : (
                  <View style={{ gap: 12 }}>
                    <Pressable
                      onPress={() => !uploadMutation.isPending && pickImage()}
                      style={[
                        styles.uploadArea,
                        uploadMutation.isPending && styles.uploadAreaDisabled,
                      ]}
                      testID="button-upload-area"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <ActivityIndicator size="large" color="#0071E3" />
                          <Text style={styles.uploadAreaTitle}>AI 분석 중...</Text>
                          <Text style={styles.uploadAreaSubtitle}>식판 사진을 분석하고 있어요</Text>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={40} color="#86868B" />
                          <View style={{ alignItems: "center" }}>
                            <Text style={styles.uploadAreaTitle}>
                              {count === 0 ? "첫 번째 사진 업로드" : "두 번째 사진 업로드"}
                            </Text>
                            <Text style={styles.uploadAreaSubtitle}>
                              빈 식판 사진을 찍어 올려주세요
                            </Text>
                            <Text style={styles.uploadAreaDetail}>
                              JPEG · PNG · WEBP · 최대 5MB
                            </Text>
                          </View>
                        </>
                      )}
                    </Pressable>

                    {uploadError && (
                      <Text style={styles.errorText} testID="text-upload-error">
                        {uploadError}
                      </Text>
                    )}

                    <View style={{ gap: 8 }}>
                      <Button
                        onPress={takePhoto}
                        disabled={uploadMutation.isPending}
                        testID="button-take-photo"
                      >
                        <Camera size={18} color="white" style={{ marginRight: 8 }} />
                        <Text style={{ color: "white", fontWeight: "600" }}>카메라로 촬영하기</Text>
                      </Button>
                      <Button
                        variant="outline"
                        onPress={pickImage}
                        disabled={uploadMutation.isPending}
                        testID="button-trigger-upload"
                      >
                        <UploadCloud size={18} color="#1D1D1F" style={{ marginRight: 8 }} />
                        <Text style={{ fontWeight: "600" }}>갤러리에서 선택하기</Text>
                      </Button>
                    </View>
                  </View>
                )}
              </View>
            )}
          </CardContent>
        </Card>

        {/* 인증 정책 카드 */}
        <Card style={[styles.card, { backgroundColor: "#FFF9F0" }]}>
          <CardContent style={{ paddingVertical: 16 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ShieldAlert size={16} color="#F59E0B" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.policyTitle}>인증 정책</Text>
                <View style={{ gap: 2 }}>
                  <Text style={styles.policyItem}>· 하루 최대 2회 인증 가능</Text>
                  <Text style={styles.policyItem}>· 잔반 감지 시 즉시 재도전 가능 (쿨타임 없음)</Text>
                  <Text style={styles.policyItem}>· 승인 완료 후 30분 쿨타임 적용</Text>
                  <Text style={styles.policyItem}>· 동일 사진 재업로드 시 부정행위로 간주 → 쿨타임 + 횟수 차감</Text>
                  <Text style={styles.policyItem}>· AI 판정 후 관리자 검토 진행</Text>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 최근 7일 기록 */}
        <Card style={styles.card}>
          <CardHeader>
            <Text style={styles.cardTitle}>최근 기록</Text>
          </CardHeader>
          <CardContent style={{ paddingTop: 0 }}>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>최근 7일 기록이 없습니다.</Text>
            ) : (
              <View style={styles.historyList}>
                {history.map((item, i) => (
                  <View
                    key={item.id}
                    style={[
                      styles.historyItem,
                      i === history.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    testID={`row-history-${i}`}
                  >
                    <View>
                      <Text style={styles.historyDate}>{item.date}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {item.status === "AUTO_APPROVED" || item.status === "APPROVED" ? (
                        <Text style={styles.historyPoints}>+{item.pointsAwarded}P</Text>
                      ) : item.status === "REJECTED" ? (
                        <Text style={styles.historyNoPoints}>0P</Text>
                      ) : (
                        <Text style={styles.historyPending}>검토중</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
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
    marginHorizontal: "auto",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F5F5F7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#86868B",
  },
  progressBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#F5F5F7",
  },
  progressBadgeComplete: {
    backgroundColor: "#F0FDF4",
  },
  progressBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  progressBadgeTextComplete: {
    color: "#15803D",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    maxWidth: 672,
    alignSelf: "center",
    width: "100%",
  },
  card: {
    borderWidth: 0,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
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
    paddingTop: 0,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 12,
    backgroundColor: "#F5F5F7",
    aspectRatio: 16 / 9,
    overflow: "hidden",
  },
  submissionImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  imageOverlayText: {
    color: "#FFFFFF",
    fontSize: 11,
  },
  submissionInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
  },
  pendingInfo: {
    backgroundColor: "#FEFCE8",
    borderRadius: 12,
    padding: 10,
  },
  pendingText: {
    fontSize: 12,
    color: "#86868B",
  },
  rejectedInfo: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 10,
  },
  rejectedText: {
    fontSize: 12,
    color: "#DC2626",
  },
  resultContainer: {
    padding: 12,
    borderRadius: 12,
  },
  resultContainerApproved: {
    backgroundColor: "#EFF6FF",
  },
  resultContainerUntouched: {
    backgroundColor: "#FFF7ED",
  },
  resultContainerRejected: {
    backgroundColor: "#FEF2F2",
  },
  resultContainerPending: {
    backgroundColor: "#FEFCE8",
  },
  resultTextApproved: {
    fontSize: 13,
    color: "#0071E3",
    fontWeight: "500",
  },
  resultTextApprovedSub: {
    fontSize: 12,
    color: "rgba(0, 113, 227, 0.7)",
    marginTop: 2,
  },
  resultTextUntouched: {
    fontSize: 13,
    color: "#EA580C",
    fontWeight: "500",
  },
  resultTextUntouchedSub: {
    fontSize: 12,
    color: "#F97316",
    marginTop: 2,
  },
  resultTextRejected: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#DC2626",
  },
  resultTextRejectedSub: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 4,
    opacity: 0.8,
  },
  resultTextPending: {
    fontSize: 13,
    color: "#86868B",
  },
  limitReached: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
  },
  limitReachedText: {
    fontSize: 13,
    color: "#15803D",
    fontWeight: "500",
    flex: 1,
  },
  cooldownContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
  },
  cooldownText: {
    fontSize: 13,
    color: "#B45309",
    flex: 1,
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D2D2D7",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  uploadAreaDisabled: {
    opacity: 0.6,
  },
  uploadAreaTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D1D1F",
  },
  uploadAreaSubtitle: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 4,
  },
  uploadAreaDetail: {
    fontSize: 11,
    color: "#86868B",
    marginTop: 2,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    textAlign: "center",
  },
  policyTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1D1D1F",
    marginBottom: 4,
  },
  policyItem: {
    fontSize: 12,
    color: "#86868B",
  },
  emptyText: {
    fontSize: 13,
    color: "#86868B",
    textAlign: "center",
    paddingVertical: 16,
  },
  historyList: {
    borderTopWidth: 1,
    borderTopColor: "#F5F5F7",
  },
  historyItem: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  historyDate: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D1D1F",
    marginBottom: 4,
  },
  historyPoints: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
  },
  historyNoPoints: {
    fontSize: 13,
    color: "#86868B",
  },
  historyPending: {
    fontSize: 13,
    color: "#CA8A04",
  },
});
