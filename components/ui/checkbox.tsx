import React from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  style?: object;
}

export function Checkbox({ checked, onCheckedChange, disabled, style }: CheckboxProps) {
  return (
    <Pressable
      onPress={() => onCheckedChange(!checked)}
      disabled={disabled}
      style={[
        styles.box,
        checked && styles.checked,
        disabled && styles.disabled,
        style,
      ]}
    >
      {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D2D2D7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checked: {
    backgroundColor: "#0071E3",
    borderColor: "#0071E3",
  },
  disabled: {
    opacity: 0.5,
  },
});
