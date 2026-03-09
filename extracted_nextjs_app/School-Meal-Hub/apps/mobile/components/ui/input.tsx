import React, { useState } from "react";
import { TextInput, View, StyleSheet, TextInputProps } from "react-native";

interface InputProps extends Omit<TextInputProps, "style"> {
  style?: object;
  testID?: string;
  leftIcon?: React.ReactNode;
}

export function Input({ style, testID, leftIcon, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.container,
        focused && styles.focused,
        style,
      ]}
    >
      {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
      <TextInput
        testID={testID}
        style={[styles.input, leftIcon ? styles.inputWithIcon : null]}
        placeholderTextColor="#86868B"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2D2D7",
    backgroundColor: "#F5F5F7",
    flexDirection: "row",
    alignItems: "center",
  },
  focused: {
    borderColor: "#0071E3",
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#1D1D1F",
    height: "100%",
  },
  iconLeft: {
    paddingLeft: 12,
  },
  inputWithIcon: {
    paddingLeft: 6,
  },
});
