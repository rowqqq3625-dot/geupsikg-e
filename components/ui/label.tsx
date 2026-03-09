import React from "react";
import { Text, StyleSheet } from "react-native";

interface LabelProps {
  children: React.ReactNode;
  style?: object;
}

export function Label({ children, style }: LabelProps) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#1D1D1F",
    marginBottom: 6,
  },
});
