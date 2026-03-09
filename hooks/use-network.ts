import { useState, useEffect } from "react";
import { Platform } from "react-native";
import * as Network from "expo-network";

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    let mounted = true;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) setIsOnline(state.isConnected ?? true);
      } catch {
        if (mounted) setIsOnline(true);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { isOnline };
}
