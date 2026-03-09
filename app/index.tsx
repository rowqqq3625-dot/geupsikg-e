import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { getLastRoute, getOrCreateInstallId } from "@/lib/session-manager";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const [resumeRoute, setResumeRoute] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      await getOrCreateInstallId();
      if (isAuthenticated) {
        const lastRoute = await getLastRoute();
        if (lastRoute && lastRoute !== "/" && lastRoute !== "/index") {
          setResumeRoute(lastRoute);
        }
      }
      setChecked(true);
    })();
  }, [isAuthenticated]);

  if (isLoading || !checked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F7" }}>
        <ActivityIndicator size="large" color="#0071E3" />
      </View>
    );
  }

  if (isAuthenticated && resumeRoute) {
    return <Redirect href={resumeRoute as any} />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
