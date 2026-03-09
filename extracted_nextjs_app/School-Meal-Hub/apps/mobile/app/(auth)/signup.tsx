import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { UtensilsCrossed } from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SchoolSearch, type SchoolCandidate } from "@/components/school-search";
import { ALLERGY_OPTIONS } from "@gipsige/shared";

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: `${g}학년` }));
const CLASS_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1).map((c) => ({
  value: String(c),
  label: `${c}반`,
}));

export default function SignupPage() {
  const { signup } = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<SchoolCandidate | null>(null);
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [error, setError] = useState("");

  const toggleAllergy = (id: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (!selectedSchool) { setError("학교를 검색하여 선택해주세요."); return; }
    if (!grade || !classNum || !studentNumber) { setError("학년, 반, 학번을 모두 입력해주세요."); return; }

    try {
      await signup.mutateAsync({
        officeCode: selectedSchool.officeCode,
        schoolCode: selectedSchool.schoolCode,
        schoolName: selectedSchool.name,
        grade: parseInt(grade),
        classNum: parseInt(classNum),
        studentNumber: parseInt(studentNumber),
        heightCm: heightCm ? parseInt(heightCm) : null,
        weightKg: weightKg ? parseInt(weightKg) : null,
        allergies: selectedAllergies.length > 0 ? selectedAllergies : null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("409")) {
        setError("이미 등록된 학생 정보입니다. 로그인을 시도해주세요.");
      } else {
        setError("회원가입에 실패했습니다. 다시 시도해주세요.");
      }
    }
  };

  const allergyRows: (typeof ALLERGY_OPTIONS[number])[][] = [];
  for (let i = 0; i < ALLERGY_OPTIONS.length; i += 3) {
    allergyRows.push(ALLERGY_OPTIONS.slice(i, i + 3) as unknown as (typeof ALLERGY_OPTIONS[number])[]);
  }

  return (
    <SafeAreaView style={styles.safe} testID="page-signup">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.center}>
            <View style={styles.iconBox}>
              <UtensilsCrossed size={32} color="#1D1D1F" />
            </View>
            <Text style={styles.title} testID="text-signup-title">급식E 가입</Text>
            <Text style={styles.subtitle}>학교 정보를 입력해주세요</Text>
          </View>

          <View style={styles.form}>
            <SchoolSearch selected={selectedSchool} onSelect={setSelectedSchool} />

            <View style={styles.grid3}>
              <View style={{ flex: 1 }}>
                <Label style={styles.fieldLabel}>학년 <Text style={styles.req}>*</Text></Label>
                <Select
                  value={grade}
                  onValueChange={setGrade}
                  options={GRADE_OPTIONS}
                  placeholder="학년"
                  testID="select-grade"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={styles.fieldLabel}>반 <Text style={styles.req}>*</Text></Label>
                <Select
                  value={classNum}
                  onValueChange={setClassNum}
                  options={CLASS_OPTIONS}
                  placeholder="반"
                  testID="select-class"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={styles.fieldLabel}>학번 <Text style={styles.req}>*</Text></Label>
                <Input
                  testID="input-student-number"
                  keyboardType="number-pad"
                  placeholder="번호"
                  value={studentNumber}
                  onChangeText={setStudentNumber}
                />
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>건강 정보 <Text style={styles.optional}>(선택)</Text></Text>
            <View style={styles.grid2}>
              <View style={{ flex: 1 }}>
                <Label style={styles.fieldLabel}>키 (cm)</Label>
                <Input
                  testID="input-height"
                  keyboardType="number-pad"
                  placeholder="예: 145"
                  value={heightCm}
                  onChangeText={setHeightCm}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={styles.fieldLabel}>몸무게 (kg)</Label>
                <Input
                  testID="input-weight"
                  keyboardType="number-pad"
                  placeholder="예: 38"
                  value={weightKg}
                  onChangeText={setWeightKg}
                />
              </View>
            </View>

            <Text style={styles.sectionLabel}>
              알레르기 <Text style={styles.optional}>(선택, 해당하는 것 모두 선택)</Text>
            </Text>
            {allergyRows.map((row, ri) => (
              <View key={ri} style={styles.allergyRow}>
                {row.map((allergy) => (
                  <View key={allergy.id} style={styles.allergyItem}>
                    <Checkbox
                      checked={selectedAllergies.includes(allergy.id)}
                      onCheckedChange={() => toggleAllergy(allergy.id)}
                      label={allergy.label}
                      testID={`checkbox-allergy-${allergy.id}`}
                    />
                  </View>
                ))}
              </View>
            ))}

            {!!error && (
              <Text style={styles.error} testID="text-signup-error">{error}</Text>
            )}

            <Button
              testID="button-signup"
              onPress={handleSubmit}
              loading={signup.isPending}
              disabled={signup.isPending}
              style={styles.submitBtn}
            >
              {signup.isPending ? "가입 중..." : "회원가입"}
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>이미 계정이 있으신가요? </Text>
            <Link href="/(auth)/login" testID="link-login">
              <Text style={styles.footerLink}>로그인</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, padding: 24 },
  center: { alignItems: "center", marginBottom: 40, paddingTop: 20 },
  iconBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: "#F5F5F7", alignItems: "center", justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: "600", color: "#1D1D1F", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "#86868B", marginTop: 8 },
  form: { gap: 12 },
  grid3: { flexDirection: "row", gap: 10 },
  grid2: { flexDirection: "row", gap: 10 },
  fieldLabel: { marginBottom: 6 },
  req: { color: "#F87171" },
  divider: { height: 1, backgroundColor: "#F5F5F7", marginVertical: 4 },
  sectionLabel: { fontSize: 13, fontWeight: "500", color: "#1D1D1F", marginTop: 4 },
  optional: { fontWeight: "400", color: "#86868B" },
  allergyRow: { flexDirection: "row", gap: 8 },
  allergyItem: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#D2D2D7", backgroundColor: "#F5F5F7",
  },
  error: { fontSize: 13, color: "#EF4444" },
  submitBtn: { height: 48, borderRadius: 12, marginTop: 8 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24, paddingBottom: 20 },
  footerText: { fontSize: 13, color: "#86868B" },
  footerLink: { fontSize: 13, color: "#0071E3", fontWeight: "500" },
});
