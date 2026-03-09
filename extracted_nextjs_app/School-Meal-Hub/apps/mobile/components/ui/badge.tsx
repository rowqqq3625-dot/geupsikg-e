import React from "react";
import { View, Text, StyleSheet } from "react-native";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: object;
  textStyle?: object;
  testID?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
  default:     { bg: "#0071E3", text: "#FFFFFF" },
  secondary:   { bg: "#F5F5F7", text: "#86868B" },
  destructive: { bg: "#FFF1F2", text: "#BE123C" },
  outline:     { bg: "transparent", text: "#1D1D1F", border: "#D2D2D7" },
};

export function Badge({ children, variant = "default", style, textStyle, testID }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? "transparent",
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: v.text }, textStyle]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
