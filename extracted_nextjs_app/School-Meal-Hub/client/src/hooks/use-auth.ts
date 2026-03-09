import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";

export type AuthUser = {
  id: string;
  schoolId: string;
  schoolName: string;
  officeCode: string;
  schoolCode: string;
  grade: number;
  classNum: number;
  studentNumber: number;
  heightCm: number | null;
  weightKg: number | null;
  allergies: string[];
  points: number;
  role: "USER" | "ADMIN";
};

type ApiMeResponse = { ok: true; user: AuthUser };

export function useAuth() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<ApiMeResponse | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const user = data?.user ?? null;

  const loginMutation = useMutation({
    mutationFn: async (payload: { officeCode: string; schoolCode: string; grade: number; classNum: number; studentNumber: number }) => {
      const res = await apiRequest("POST", "/api/auth/login", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setLocation("/dashboard");
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
      setLocation("/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setLocation("/login");
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
