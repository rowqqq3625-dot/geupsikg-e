import React, { useState, useCallback, useRef } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { Search, MapPin, X } from "lucide-react-native";
import { apiRequest } from "@/lib/shared/api-client";

export type SchoolCandidate = {
  name: string;
  officeCode: string;
  schoolCode: string;
  address: string;
  schoolType: "초등학교" | "중학교" | "고등학교" | "기타";
};

interface SchoolSearchProps {
  selected: SchoolCandidate | null;
  onSelect: (school: SchoolCandidate | null) => void;
}

export function SchoolSearch({ selected, onSelect }: SchoolSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await apiRequest("GET", `/api/schools/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  };

  if (selected) {
    return (
      <View style={styles.selectedContainer}>
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedName}>{selected.name}</Text>
          <Text style={styles.selectedAddress}>{selected.address}</Text>
        </View>
        <Pressable onPress={() => onSelect(null)} style={styles.clearBtn}>
          <X size={18} color="#86868B" />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.label}>학교 검색</Text>
      <View style={styles.inputContainer}>
        <Search size={18} color="#86868B" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.input}
          placeholder="학교명을 입력하세요"
          placeholderTextColor="#86868B"
          value={query}
          onChangeText={handleChangeText}
          autoCorrect={false}
          testID="input-school-search"
        />
        {loading && <ActivityIndicator size="small" color="#0071E3" style={{ marginRight: 12 }} />}
      </View>

      {searched && results.length > 0 && (
        <View style={styles.resultsContainer}>
          {results.slice(0, 5).map((school, idx) => (
            <Pressable
              key={`${school.schoolCode}-${idx}`}
              style={styles.resultItem}
              onPress={() => {
                onSelect(school);
                setQuery("");
                setResults([]);
                setSearched(false);
              }}
              testID={`school-result-${idx}`}
            >
              <MapPin size={16} color="#0071E3" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.resultName}>{school.name}</Text>
                <Text style={styles.resultAddress}>{school.address}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {searched && !loading && results.length === 0 && query.length >= 2 && (
        <Text style={styles.noResults}>검색 결과가 없습니다</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#1D1D1F",
    marginBottom: 6,
  },
  inputContainer: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2D2D7",
    backgroundColor: "#F5F5F7",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 15,
    color: "#1D1D1F",
    height: "100%",
  },
  resultsContainer: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  resultItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  resultName: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#1D1D1F",
  },
  resultAddress: {
    fontSize: 12,
    color: "#86868B",
    marginTop: 2,
  },
  noResults: {
    fontSize: 13,
    color: "#86868B",
    textAlign: "center",
    marginTop: 12,
  },
  selectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#1D4ED8",
  },
  selectedAddress: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
