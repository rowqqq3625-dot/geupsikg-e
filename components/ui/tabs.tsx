"use no memo";
import React, { createContext, useContext, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

const TabsContext = createContext<{ value: string; onChange: (v: string) => void }>({
  value: "",
  onChange: () => {},
});

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  style?: object;
}

export function Tabs({ value: controlledValue, defaultValue = "", onValueChange, children, style }: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolled;
  const onChange = (v: string) => {
    if (!isControlled) setUncontrolled(v);
    onValueChange?.(v);
  };
  const ctx = useMemo(() => ({ value, onChange }), [value]);
  return (
    <TabsContext.Provider value={ctx}>
      <View style={style}>{children}</View>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.list, style]}>{children}</View>;
}

export function TabsTrigger({ value, children, style }: { value: string; children: React.ReactNode; style?: object }) {
  const ctx = useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <Pressable
      onPress={() => ctx.onChange(value)}
      style={[styles.trigger, active && styles.triggerActive, style]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.triggerText, active && styles.triggerTextActive]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function TabsContent({ value, children, style }: { value: string; children: React.ReactNode; style?: object }) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  list: {
    flexDirection: "row",
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  trigger: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  triggerActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#86868B",
  },
  triggerTextActive: {
    color: "#1D1D1F",
    fontWeight: "600" as const,
  },
});
