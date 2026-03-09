import React, { createContext, useState, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated as RNAnimated, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastType = "success" | "error" | "info";

interface ToastData {
  id: number;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);

  const toast = useCallback(
    (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => {
      const id = ++counter.current;
      const type: ToastType = opts.variant === "destructive" ? "error" : "success";
      setToasts((prev) => [...prev, { id, title: opts.title, description: opts.description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastOverlay toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastOverlay({ toasts }: { toasts: ToastData[] }) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View
      style={[styles.overlay, { top: insets.top + 8 + webTop }]}
      pointerEvents="none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} data={t} />
      ))}
    </View>
  );
}

function ToastItem({ data }: { data: ToastData }) {
  const opacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      RNAnimated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  const bgColor = data.type === "error" ? "#FEE2E2" : data.type === "success" ? "#F0FDF4" : "#EFF6FF";
  const textColor = data.type === "error" ? "#DC2626" : data.type === "success" ? "#16A34A" : "#1D4ED8";

  return (
    <RNAnimated.View style={[styles.toast, { backgroundColor: bgColor, opacity }]}>
      <Text style={[styles.toastTitle, { color: textColor }]}>{data.title}</Text>
      {data.description && <Text style={[styles.toastDesc, { color: textColor }]}>{data.description}</Text>}
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  toastDesc: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
});
