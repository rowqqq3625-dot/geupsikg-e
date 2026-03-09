import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { WifiOff } from "lucide-react-native";

export function OfflineBanner() {
  return (
    <View style={styles.banner} testID="banner-offline">
      <WifiOff size={14} color="#CA8A04" style={{ marginRight: 6 }} />
      <Text style={styles.text}>오프라인 · 마지막 데이터를 표시합니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FEFCE8",
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
    color: "#A16207",
  },
});
