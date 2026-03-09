import { QueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@gipsige/shared";

export { apiRequest, getQueryFn };

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
