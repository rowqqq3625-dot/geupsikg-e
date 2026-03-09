import React, { createContext, useContext, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";

interface TabsContextValue {
  value: string;
  onChange: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  style?: object;
}

export function Tabs({ defaultValue, value, onValueChange, children, style }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value ?? internal;
  const set = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value: current, onChange: set }}>
      <View style={style}>{children}</View>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.list, style]}>
      {children}
    </View>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const active = ctx.value === value;
  return (
    <Pressable
      onPress={() => ctx.onChange(value)}
      style={[styles.trigger, active && styles.triggerActive]}
    >
      <Text style={[styles.triggerText, active && styles.triggerTextActive]}>
        {children}
      </Text>
    </Pressable>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  style?: object;
}

export function TabsContent({ value, children, style }: TabsContentProps) {
  const ctx = useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  list: {
    flexDirection: "row",
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    padding: 3,
  },
  trigger: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  triggerActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#86868B",
  },
  triggerTextActive: {
    color: "#1D1D1F",
    fontWeight: "600",
  },
});
