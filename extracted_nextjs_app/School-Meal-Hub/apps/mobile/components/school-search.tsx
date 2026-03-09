import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Pressable, ActivityIndicator,
} from "react-native";
import { Search, CheckCircle2, X } from "lucide-react-native";
import { BASE_URL } from "@gipsige/shared";

export type SchoolCandidate = {
  name: string;
  officeCode: string;
  schoolCode: string;
  address: string;
};

interface SchoolSearchProps {
  selected: SchoolCandidate | null;
  onSelect: (school: SchoolCandidate | null) => void;
  label?: string;
}

export function SchoolSearch({ selected, onSelect, label = "학교 검색" }: SchoolSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim() || selected) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${BASE_URL}/api/schools/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [selected]);

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleSelect = (school: SchoolCandidate) => {
    onSelect(school);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label} <Text style={styles.required}>*</Text>
      </Text>

      {selected ? (
        <View style={styles.selectedBox} testID="selected-school">
          <CheckCircle2 size={16} color="#0071E3" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName} numberOfLines={1}>{selected.name}</Text>
            <Text style={styles.selectedAddress} numberOfLines={1}>{selected.address}</Text>
          </View>
          <TouchableOpacity onPress={handleClear} testID="button-clear-school" style={styles.clearBtn}>
            <X size={14} color="#86868B" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputWrap}>
          <Search size={16} color="#86868B" style={styles.searchIcon} />
          <TextInput
            testID="input-school-search"
            value={query}
            onChangeText={(t) => { setQuery(t); search(t); }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="학교명을 입력하세요"
            placeholderTextColor="#86868B"
            style={styles.input}
          />
          {loading && <ActivityIndicator size="small" color="#86868B" style={{ marginRight: 10 }} />}
        </View>
      )}

      {open && results.length > 0 && (
        <View style={styles.dropdown} testID="school-search-results">
          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <Pressable
                testID={`school-result-${index}`}
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [styles.resultItem, pressed && { backgroundColor: "#F5F5F7" }]}
              >
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultAddr}>{item.address}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}

      {open && results.length === 0 && query.length > 0 && !loading && (
        <View style={styles.dropdown}>
          <Text style={styles.noResult}>검색 결과가 없습니다.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative" },
  label: { fontSize: 13, fontWeight: "500", color: "#1D1D1F", marginBottom: 6 },
  required: { color: "#F87171" },
  selectedBox: {
    flexDirection: "row", alignItems: "center",
    padding: 12, backgroundColor: "#F0F8FF",
    borderWidth: 1, borderColor: "rgba(0,113,227,0.3)", borderRadius: 12,
  },
  selectedName: { fontSize: 14, fontWeight: "500", color: "#1D1D1F" },
  selectedAddress: { fontSize: 12, color: "#86868B", marginTop: 2 },
  clearBtn: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  inputWrap: {
    height: 48, borderRadius: 12, borderWidth: 1,
    borderColor: "#D2D2D7", backgroundColor: "#F5F5F7",
    flexDirection: "row", alignItems: "center",
  },
  searchIcon: { marginLeft: 12 },
  input: {
    flex: 1, marginHorizontal: 8,
    fontSize: 15, color: "#1D1D1F",
  },
  dropdown: {
    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
    marginTop: 4, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#D2D2D7", borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  resultItem: { paddingHorizontal: 16, paddingVertical: 12 },
  resultName: { fontSize: 14, fontWeight: "500", color: "#1D1D1F" },
  resultAddr: { fontSize: 12, color: "#86868B", marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#F5F5F7" },
  noResult: { fontSize: 13, color: "#86868B", padding: 16 },
});
