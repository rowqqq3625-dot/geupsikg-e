import React from "react";
import { View, Text, StyleSheet } from "react-native";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: object;
  textStyle?: object;
}

const VARIANTS: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
  default:     { bg: "#0071E3", text: "#FFFFFF" },
  secondary:   { bg: "#F5F5F7", text: "#86868B" },
  destructive: { bg: "#FEE2E2", text: "#DC2626" },
  outline:     { bg: "transparent", text: "#1D1D1F", border: "#D2D2D7" },
};

export function Badge({ children, variant = "default", style, textStyle }: BadgeProps) {
  const v = VARIANTS[variant];
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? "transparent",
        },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.text, { color: v.text }, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
});
