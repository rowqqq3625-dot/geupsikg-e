import React from "react";
import { Switch as RNSwitch, StyleSheet, View } from "react-native";

interface SwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}

export function SwitchToggle({ value, onValueChange, disabled }: SwitchProps) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: "#D2D2D7", true: "#34C759" }}
      thumbColor="#FFFFFF"
    />
  );
}
