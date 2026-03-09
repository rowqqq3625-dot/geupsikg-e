import React from "react";
import { Switch as RNSwitch, View, Text, StyleSheet } from "react-native";

interface SwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ value, onValueChange, label, disabled }: SwitchProps) {
  return (
    <View style={styles.row}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#D2D2D7", true: "#0071E3" }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#D2D2D7"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
    color: "#1D1D1F",
    flex: 1,
  },
});
