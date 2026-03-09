import { QueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn, getApiUrl } from "@/lib/shared/api-client";

export { apiRequest, getQueryFn, getApiUrl };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
