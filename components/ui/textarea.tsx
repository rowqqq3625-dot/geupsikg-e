import React, { useState } from "react";
import { TextInput, View, StyleSheet, TextInputProps } from "react-native";

interface TextareaProps extends Omit<TextInputProps, "style"> {
  style?: object;
  testID?: string;
}

export function Textarea({ style, testID, ...props }: TextareaProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, focused && styles.focused, style]}>
      <TextInput
        testID={testID}
        style={styles.input}
        placeholderTextColor="#86868B"
        multiline
        textAlignVertical="top"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2D2D7",
    backgroundColor: "#F5F5F7",
    padding: 12,
  },
  focused: {
    borderColor: "#0071E3",
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1D1D1F",
    lineHeight: 22,
  },
});
