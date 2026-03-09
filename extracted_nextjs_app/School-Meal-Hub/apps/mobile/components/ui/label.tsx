import React from "react";
import { Text, StyleSheet } from "react-native";

interface LabelProps {
  children: React.ReactNode;
  required?: boolean;
  style?: object;
}

export function Label({ children, required, style }: LabelProps) {
  return (
    <Text style={[styles.label, style]}>
      {children}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1D1D1F",
  },
  required: {
    color: "#F87171",
  },
});
