import React, { useState } from "react";
import { View, Text, Pressable, Modal, FlatList, StyleSheet, Platform, SafeAreaView } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  testID?: string;
  style?: object;
}

export function Select({ value, onValueChange, options, placeholder = "선택", testID, style }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={[styles.trigger, style]}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={16} color="#86868B" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                onPress={() => { onValueChange(item.value); setOpen(false); }}
              >
                <Text style={[styles.optionText, item.value === value && styles.optionSelected]}>
                  {item.label}
                </Text>
                {item.value === value && <Check size={16} color="#0071E3" />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2D2D7",
    backgroundColor: "#F5F5F7",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  triggerText: {
    fontSize: 15,
    color: "#1D1D1F",
  },
  placeholder: {
    color: "#86868B",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D2D2D7",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F5F5F7",
  },
  optionText: {
    fontSize: 16,
    color: "#1D1D1F",
  },
  optionSelected: {
    color: "#0071E3",
    fontWeight: "600",
  },
});
