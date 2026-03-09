import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/shared/api-client";
import { queryClient } from "@/lib/query-client";
import { router } from "expo-router";
import { getOrCreateInstallId, saveLastRoute, clearLastRoute } from "@/lib/session-manager";
import { clearCookies } from "@/lib/shared/api-client";
import { useEffect, useRef } from "react";
import type { AuthUser } from "@/lib/shared/types";

type SessionResumeResponse = {
  ok: true;
  status: "authenticated" | "guest";
  user: AuthUser | null;
};

type ApiMeResponse = { ok: true; user: AuthUser };

export function useAuth() {
  const deviceRegistered = useRef(false);

  const { data: sessionData, isLoading: sessionLoading } = useQuery<SessionResumeResponse | null>({
    queryKey: ["/api/session/resume"],
    queryFn: async () => {
      if (!deviceRegistered.current) {
        try {
          const installId = await getOrCreateInstallId();
          await apiRequest("POST", "/api/device/register", {
            installId,
            platform: typeof navigator !== "undefined" ? "web" : "mobile",
          });
          deviceRegistered.current = true;
        } catch {}
      }

      try {
        const res = await apiRequest("GET", "/api/session/resume");
        return res.json();
      } catch {
        return { ok: true, status: "guest" as const, user: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: meData, isLoading: meLoading } = useQuery<ApiMeResponse | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: sessionData?.status !== "authenticated",
  });

  const user = sessionData?.status === "authenticated" ? sessionData.user : meData?.user ?? null;
  const isLoading = sessionLoading || (sessionData?.status !== "authenticated" && meLoading);

  useEffect(() => {
    getOrCreateInstallId().catch(() => {});
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (payload: {
      officeCode: string;
      schoolCode: string;
      grade: number;
      classNum: number;
      studentNumber: number;
    }) => {
      const res = await apiRequest("POST", "/api/auth/login", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session/resume"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      router.replace("/(app)/dashboard");
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (payload: {
      officeCode: string;
      schoolCode: string;
      schoolName: string;
      grade: number;
      classNum: number;
      studentNumber: number;
      heightCm?: number | null;
      weightKg?: number | null;
      allergies?: string[] | null;
    }) => {
      const res = await apiRequest("POST", "/api/auth/signup", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session/resume"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      router.replace("/(app)/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
      await clearCookies();
      await clearLastRoute();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/session/resume"], null);
      queryClient.setQueryData(["/api/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/session/resume"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      router.replace("/(auth)/login");
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "ADMIN",
    login: loginMutation,
    signup: signupMutation,
    logout: logoutMutation,
  };
}
