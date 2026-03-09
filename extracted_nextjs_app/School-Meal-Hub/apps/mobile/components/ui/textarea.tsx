import React, { useState } from "react";
import { TextInput, StyleSheet, View } from "react-native";

interface TextareaProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  numberOfLines?: number;
  testID?: string;
  style?: object;
  editable?: boolean;
}

export function Textarea({
  value,
  onChangeText,
  placeholder,
  maxLength,
  numberOfLines = 4,
  testID,
  style,
  editable = true,
}: TextareaProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#86868B"
      maxLength={maxLength}
      multiline
      numberOfLines={numberOfLines}
      editable={editable}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.base,
        focused && styles.focused,
        { height: numberOfLines * 24 + 24 },
        style,
      ]}
      textAlignVertical="top"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2D2D7",
    backgroundColor: "#F5F5F7",
    padding: 12,
    fontSize: 14,
    color: "#1D1D1F",
  },
  focused: {
    borderColor: "#0071E3",
    backgroundColor: "#FFFFFF",
  },
});
