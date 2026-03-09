import React, { createContext, useState, useCallback, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react-native";

type ToastVariant = "default" | "destructive" | "success";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDone(toast.id));
  }, []);

  const bgColor = toast.variant === "destructive" ? "#FFF1F2" : toast.variant === "success" ? "#F0FDF4" : "#FFFFFF";
  const borderColor = toast.variant === "destructive" ? "#FECDD3" : toast.variant === "success" ? "#BBF7D0" : "#E5E5EA";
  const textColor = toast.variant === "destructive" ? "#BE123C" : toast.variant === "success" ? "#15803D" : "#1D1D1F";

  const Icon = toast.variant === "destructive" ? XCircle : toast.variant === "success" ? CheckCircle2 : AlertCircle;
  const iconColor = toast.variant === "destructive" ? "#BE123C" : toast.variant === "success" ? "#15803D" : "#86868B";

  return (
    <Animated.View style={[styles.item, { opacity, backgroundColor: bgColor, borderColor }]}>
      <Icon size={16} color={iconColor} style={{ marginRight: 8, marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: textColor }]}>{toast.title}</Text>
        {toast.description ? (
          <Text style={[styles.desc, { color: textColor }]}>{toast.description}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((opts: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, ...opts }]);
  }, []);

  const removeLast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={removeLast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
  desc: {
    fontSize: 12,
    marginTop: 1,
    opacity: 0.8,
  },
});
