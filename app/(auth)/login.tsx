import React, { useState } from "react";
import {
  View, Text, StyleSheet, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SchoolSearch, type SchoolCandidate } from "@/components/school-search";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

const webTop = Platform.OS === "web" ? 67 : 0;

function getGradeOptions(schoolType: string | undefined) {
  const max = schoolType === "초등학교" ? 6 : 3;
  return Array.from({ length: max }, (_, i) => i + 1).map((g) => ({
    value: String(g),
    label: `${g}학년`,
  }));
}

const CLASS_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1).map((c) => ({
  value: String(c),
  label: `${c}반`,
}));

export default function LoginPage() {
  const { login } = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<SchoolCandidate | null>(null);
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState("");

  const gradeOptions = getGradeOptions(selectedSchool?.schoolType);

  const handleSchoolSelect = (school: SchoolCandidate | null) => {
    setSelectedSchool(school);
    setGrade("");
  };

  const handleSubmit = async () => {
    setError("");
    if (!selectedSchool) { setError("학교를 검색해서 선택해 주세요."); return; }
    if (!grade || !classNum || !studentNumber) { setError("학년, 반, 번호를 모두 입력해 주세요."); return; }

    try {
      await login.mutateAsync({
        officeCode: selectedSchool.officeCode,
        schoolCode: selectedSchool.schoolCode,
        grade: parseInt(grade),
        classNum: parseInt(classNum),
        studentNumber: parseInt(studentNumber),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("401") || msg.includes("SCHOOL_NOT_FOUND") || msg.includes("USER_NOT_FOUND")) {
        setError("등록된 정보가 없어요. 먼저 회원가입을 해주세요!");
      } else {
        setError("로그인에 실패했어요. 다시 시도해 주세요.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="page-login">
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scroll, { paddingTop: (webTop || 0) + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title} testID="text-login-title">다시 만나요!</Text>
          <Text style={styles.subtitle}>학교와 학번으로 바로 시작해요</Text>
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

          {!!error && (
            <Text style={styles.error} testID="text-login-error">{error}</Text>
          )}

          <Button
            testID="button-login"
            onPress={handleSubmit}
            loading={login.isPending}
            disabled={login.isPending}
            style={styles.submitBtn}
          >
            {login.isPending ? "로그인 중..." : "로그인"}
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>처음 오셨나요? </Text>
          <Link href="/(auth)/signup" testID="link-signup">
            <Text style={styles.footerLink}>회원가입 하기</Text>
          </Link>
        </View>
      </KeyboardAwareScrollViewCompat>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  headerSection: { alignItems: "center", marginBottom: 36, marginTop: 20 },
  emoji: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#1D1D1F", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 15, color: "#86868B", marginTop: 8, fontFamily: "Inter_400Regular" },
  form: { gap: 14 },
  grid3: { flexDirection: "row" as const, gap: 10 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#1D1D1F", marginBottom: 6 },
  error: { fontSize: 13, color: "#EF4444", textAlign: "center", fontFamily: "Inter_400Regular" },
  submitBtn: { height: 52, borderRadius: 14, marginTop: 4 },
  footer: { flexDirection: "row" as const, justifyContent: "center" as const, marginTop: 28 },
  footerText: { fontSize: 13, color: "#86868B", fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 13, color: "#0071E3", fontFamily: "Inter_600SemiBold" },
});
