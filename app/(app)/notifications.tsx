import React from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Platform,
} from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/query-client";
import { router } from "expo-router";
import { ArrowLeft, Bell, BellOff, Check, CheckCheck } from "lucide-react-native";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Notification } from "@/lib/shared/types";

type NotificationsResponse = { ok: boolean; notifications: Notification[] };

const TYPE_COLORS: Record<string, string> = {
  BUDDY: "#8B5CF6",
  CLEANPLATE: "#22C55E",
  STORE: "#F59E0B",
  BATTLE: "#EF4444",
  SYSTEM: "#0071E3",
  ADMIN: "#DC2626",
};

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications"],
    enabled: !!isAuthenticated,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/read-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/dashboard")} style={styles.backBtn}>
          <ArrowLeft size={20} color="#1D1D1F" />
        </Pressable>
        <Text style={styles.headerTitle}>알림</Text>
        {unreadCount > 0 ? (
          <Pressable
            onPress={() => markAllReadMutation.mutate()}
            style={styles.backBtn}
          >
            <CheckCheck size={20} color="#0071E3" />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={72} borderRadius={16} />
            ))}
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="알림이 없어요"
            description="새로운 알림이 오면 여기에 표시됩니다."
          />
        ) : (
          <View style={{ gap: 8 }}>
            {notifications.map((n) => {
              const dotColor = TYPE_COLORS[n.type] ?? "#86868B";
              return (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    if (!n.isRead) markReadMutation.mutate(n.id);
                  }}
                >
                  <Card style={!n.isRead ? styles.unreadCard : undefined}>
                    <CardContent style={{ paddingTop: 14, paddingBottom: 14 }}>
                      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                        {!n.isRead && (
                          <View style={[styles.dot, { backgroundColor: dotColor }]} />
                        )}
                        <View style={{ flex: 1, marginLeft: n.isRead ? 16 : 0 }}>
                          <Text style={[styles.notifTitle, !n.isRead && { fontWeight: "600" as const }]}>
                            {n.title}
                          </Text>
                          <Text style={styles.notifBody}>{n.body}</Text>
                          <Text style={styles.notifTime}>
                            {new Date(n.createdAt).toLocaleDateString("ko-KR", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </Text>
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  unreadCard: { borderLeftWidth: 3, borderLeftColor: "#0071E3" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifTitle: { fontSize: 14, color: "#1D1D1F", marginBottom: 2 },
  notifBody: { fontSize: 13, color: "#48484A", lineHeight: 18 },
  notifTime: { fontSize: 11, color: "#86868B", marginTop: 4 },
});
