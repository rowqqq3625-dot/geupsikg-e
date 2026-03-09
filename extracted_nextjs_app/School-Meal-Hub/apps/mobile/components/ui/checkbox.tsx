import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  testID?: string;
}

export function Checkbox({ checked, onCheckedChange, label, testID }: CheckboxProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onCheckedChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#D2D2D7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: "#0071E3",
    borderColor: "#0071E3",
  },
  label: {
    fontSize: 13,
    color: "#1D1D1F",
  },
});
