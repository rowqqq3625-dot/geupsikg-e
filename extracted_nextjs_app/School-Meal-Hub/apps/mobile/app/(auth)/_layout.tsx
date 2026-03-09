import React from "react";
import { Stack } from "expo-router";
import { Redirect } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
