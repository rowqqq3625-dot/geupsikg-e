import React, { useState } from "react";
import {
  View, Text, StyleSheet, Platform, Pressable, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SchoolSearch, type SchoolCandidate } from "@/components/school-search";
import { ALLERGY_OPTIONS } from "@/lib/shared/constants";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

const CLASS_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1).map((c) => ({
  value: String(c),
  label: `${c}반`,
}));

function getGradeOptions(schoolType: string | undefined) {
  const max = schoolType === "초등학교" ? 6 : 3;
  return Array.from({ length: max }, (_, i) => i + 1).map((g) => ({
    value: String(g),
    label: `${g}학년`,
  }));
}

const ALLERGY_EMOJI: Record<string, string> = {
  "1": "🥚", "2": "🥛", "3": "🌾", "4": "🥜",
  "5": "🫘", "6": "🍞", "7": "🐟", "8": "🦀",
  "9": "🦐", "10": "🥩", "11": "🍑", "12": "🍅",
  "13": "🍷", "14": "🌰", "15": "🍗", "16": "🐄",
  "17": "🦑", "18": "🐚",
};

const SHORT_LABELS: Record<string, string> = {
  "1": "계란", "2": "우유", "3": "메밀", "4": "땅콩",
  "5": "대두", "6": "밀", "7": "고등어", "8": "게",
  "9": "새우", "10": "돼지고기", "11": "복숭아", "12": "토마토",
  "13": "아황산", "14": "호두", "15": "닭고기", "16": "쇠고기",
  "17": "오징어", "18": "조개류",
};

const webTop = Platform.OS === "web" ? 67 : 0;

export default function SignupPage() {
  const { signup } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSchool, setSelectedSchool] = useState<SchoolCandidate | null>(null);
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [error, setError] = useState("");

  const gradeOptions = getGradeOptions(selectedSchool?.schoolType);

  const handleSchoolSelect = (school: SchoolCandidate | null) => {
    setSelectedSchool(school);
    setGrade("");
  };

  const toggleAllergy = (id: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleNextStep = () => {
    setError("");
    if (!selectedSchool) { setError("학교를 검색해서 선택해 주세요."); return; }
    if (!grade) { setError("학년을 선택해 주세요."); return; }
    if (!classNum) { setError("반을 선택해 주세요."); return; }
    if (!studentNumber) { setError("학번을 입력해 주세요."); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedSchool) return;
    try {
      await signup.mutateAsync({
        officeCode: selectedSchool.officeCode,
        schoolCode: selectedSchool.schoolCode,
        schoolName: selectedSchool.name,
        grade: parseInt(grade),
        classNum: parseInt(classNum),
        studentNumber: parseInt(studentNumber),
        allergies: selectedAllergies.length > 0 ? selectedAllergies : null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("409")) {
        setStep(1);
        setError("이미 가입된 정보예요. 로그인을 해보세요!");
      } else {
        setError("가입에 실패했어요. 다시 시도해 주세요.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="page-signup">
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scroll, { paddingTop: webTop || styles.scroll.paddingTop }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 진행 표시 */}
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, step === 1 && styles.progressDotActive]} />
          <View style={styles.progressLine} />
          <View style={[styles.progressDot, step === 2 && styles.progressDotActive]} />
        </View>
        <Text style={styles.stepLabel}>{step === 1 ? "1단계 · 학교 정보" : "2단계 · 알레르기"}</Text>

        {step === 1 ? (
          <>
            <View style={styles.headerSection}>
              <Text style={styles.emoji}>🏫</Text>
              <Text style={styles.title}>내 학교 찾기</Text>
              <Text style={styles.subtitle}>학교와 학년·반·번호를 알려주세요</Text>
            </View>

            <View style={styles.form}>
              <SchoolSearch selected={selectedSchool} onSelect={handleSchoolSelect} />

              <View style={styles.grid3}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>학년</Text>
                  <Select
                    value={grade}
                    onValueChange={setGrade}
                    options={gradeOptions}
                    placeholder="학년"
                    testID="select-grade"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>반</Text>
                  <Select
                    value={classNum}
                    onValueChange={setClassNum}
                    options={CLASS_OPTIONS}
                    placeholder="반"
                    testID="select-class"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>번호</Text>
                  <Input
                    testID="input-student-number"
                    keyboardType="number-pad"
                    placeholder="번호"
                    value={studentNumber}
                    onChangeText={setStudentNumber}
                  />
                </View>
              </View>

              {!!error && <Text style={styles.error} testID="text-signup-error">{error}</Text>}

              <Button
                testID="button-next"
                onPress={handleNextStep}
                style={styles.submitBtn}
              >
                다음 →
              </Button>
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerSection}>
              <Text style={styles.emoji}>🚫</Text>
              <Text style={styles.title}>못 먹는 음식이 있나요?</Text>
              <Text style={styles.subtitle}>해당하는 알레르기를 선택해 주세요{"\n"}오늘 급식에서 바로 경고해 드려요!</Text>
            </View>

            <View style={styles.allergyGrid}>
              {ALLERGY_OPTIONS.map((allergy) => {
                const isSelected = selectedAllergies.includes(allergy.id);
                return (
                  <Pressable
                    key={allergy.id}
                    style={[styles.allergyChip, isSelected && styles.allergyChipActive]}
                    onPress={() => toggleAllergy(allergy.id)}
                    testID={`chip-allergy-${allergy.id}`}
                  >
                    <Text style={styles.allergyEmoji}>{ALLERGY_EMOJI[allergy.id] ?? "⚠️"}</Text>
                    <Text style={[styles.allergyLabel, isSelected && styles.allergyLabelActive]}>
                      {SHORT_LABELS[allergy.id] ?? allergy.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedAllergies.length > 0 && (
              <Text style={styles.selectedCount}>{selectedAllergies.length}개 선택됨</Text>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button
              testID="button-signup"
              onPress={handleSubmit}
              loading={signup.isPending}
              disabled={signup.isPending}
              style={styles.submitBtn}
            >
              {signup.isPending ? "가입 중..." : "가입 완료!"}
            </Button>
            <Pressable onPress={handleSubmit} style={styles.skipBtn}>
              <Text style={styles.skipText}>알레르기 없어요 (건너뛰기)</Text>
            </Pressable>
            <Pressable onPress={() => { setStep(1); setError(""); }} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← 이전으로</Text>
            </Pressable>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>이미 계정이 있나요? </Text>
          <Link href="/(auth)/login" testID="link-login">
            <Text style={styles.footerLink}>로그인</Text>
          </Link>
        </View>
      </KeyboardAwareScrollViewCompat>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 20 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E5E7EB" },
  progressDotActive: { backgroundColor: "#0071E3", width: 12, height: 12, borderRadius: 6 },
  progressLine: { width: 40, height: 2, backgroundColor: "#E5E7EB", marginHorizontal: 8 },
  stepLabel: { textAlign: "center", fontSize: 12, color: "#86868B", marginBottom: 24, fontFamily: "Inter_500Medium" },
  headerSection: { alignItems: "center", marginBottom: 32 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#1D1D1F", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#86868B", marginTop: 8, textAlign: "center", lineHeight: 20, fontFamily: "Inter_400Regular" },
  form: { gap: 14 },
  grid3: { flexDirection: "row" as const, gap: 10 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#1D1D1F", marginBottom: 6 },
  allergyGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10, marginBottom: 16 },
  allergyChip: {
    width: "30%",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  allergyChipActive: { borderColor: "#0071E3", backgroundColor: "#EFF6FF" },
  allergyEmoji: { fontSize: 22 },
  allergyLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6B7280", textAlign: "center" },
  allergyLabelActive: { color: "#0071E3" },
  selectedCount: { textAlign: "center", fontSize: 13, color: "#0071E3", fontFamily: "Inter_500Medium", marginBottom: 8 },
  error: { fontSize: 13, color: "#EF4444", textAlign: "center", fontFamily: "Inter_400Regular" },
  submitBtn: { height: 52, borderRadius: 14, marginTop: 4 },
  skipBtn: { alignItems: "center", paddingVertical: 12 },
  skipText: { fontSize: 14, color: "#86868B", fontFamily: "Inter_400Regular" },
  backBtn: { alignItems: "center", paddingVertical: 8 },
  backBtnText: { fontSize: 13, color: "#6B7280", fontFamily: "Inter_400Regular" },
  footer: { flexDirection: "row" as const, justifyContent: "center" as const, marginTop: 28, paddingBottom: 20 },
  footerText: { fontSize: 13, color: "#86868B", fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 13, color: "#0071E3", fontFamily: "Inter_600SemiBold" },
});
