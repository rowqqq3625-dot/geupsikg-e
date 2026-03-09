import React, { useState } from "react";
import { Pressable, Text, ActivityIndicator, StyleSheet, View } from "react-native";

type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary";
type Size = "default" | "sm" | "lg" | "icon";

interface ButtonProps {
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  style?: object;
  textStyle?: object;
  testID?: string;
}

const VARIANTS: Record<Variant, { bg: string; text: string; border?: string; pressedBg: string }> = {
  default:     { bg: "#0071E3", text: "#FFFFFF", pressedBg: "#005BBF" },
  destructive: { bg: "#EF4444", text: "#FFFFFF", pressedBg: "#DC2626" },
  outline:     { bg: "transparent", text: "#1D1D1F", border: "#D2D2D7", pressedBg: "#F5F5F7" },
  ghost:       { bg: "transparent", text: "#86868B", pressedBg: "#F5F5F7" },
  secondary:   { bg: "#F5F5F7", text: "#1D1D1F", pressedBg: "#E8E8ED" },
};

const SIZES: Record<Size, { height: number; paddingH: number; fontSize: number; borderRadius: number }> = {
  default: { height: 44, paddingH: 16, fontSize: 15, borderRadius: 12 },
  sm:      { height: 36, paddingH: 12, fontSize: 13, borderRadius: 8 },
  lg:      { height: 52, paddingH: 20, fontSize: 16, borderRadius: 14 },
  icon:    { height: 36, paddingH: 8,  fontSize: 14, borderRadius: 8 },
};

export function Button({
  children,
  onPress,
  disabled,
  variant = "default",
  size = "default",
  loading,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANTS[variant];
  const s = SIZES[size];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingH,
          borderRadius: s.borderRadius,
          backgroundColor: pressed ? v.pressedBg : v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? "transparent",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={v.text} style={{ marginRight: 6 }} />}
      {typeof children === "string" ? (
        <Text style={[{ fontSize: s.fontSize, color: v.text, fontWeight: "600" }, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
