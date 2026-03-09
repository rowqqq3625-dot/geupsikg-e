"use no memo";
import React, { useEffect, useRef } from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { View, ActivityIndicator } from "react-native";
import { usePathname } from "expo-router";
import { saveLastRoute } from "@/lib/session-manager";

export default function AppLayout() {
  const { isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname && pathname !== prevPath.current) {
      prevPath.current = pathname;
      saveLastRoute(pathname);
    }
  }, [pathname]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F7" }}>
        <ActivityIndicator size="large" color="#0071E3" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
