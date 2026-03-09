import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@gipsige/shared";
import { queryClient } from "@/lib/query-client";
import { router } from "expo-router";
import type { AuthUser } from "@gipsige/shared";

type ApiMeResponse = { ok: true; user: AuthUser };

export function useAuth() {
  const { data, isLoading } = useQuery<ApiMeResponse | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const user = data?.user ?? null;

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
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      router.replace("/(app)/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/me"], null);
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
