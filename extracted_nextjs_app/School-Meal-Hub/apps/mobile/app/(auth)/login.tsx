import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { UtensilsCrossed } from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SchoolSearch, type SchoolCandidate } from "@/components/school-search";

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: `${g}학년` }));
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

  const handleSubmit = async () => {
    setError("");
    if (!selectedSchool) { setError("학교를 검색하여 선택해주세요."); return; }
    if (!grade || !classNum || !studentNumber) { setError("학년, 반, 학번을 모두 입력해주세요."); return; }

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
      if (msg.includes("401")) {
        setError("해당 학생 정보를 찾을 수 없습니다. 먼저 회원가입을 해주세요.");
      } else {
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="page-login">
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
            <Text style={styles.title} testID="text-login-title">급식E 로그인</Text>
            <Text style={styles.subtitle}>학교 정보로 시작하세요</Text>
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
            <Text style={styles.footerText}>계정이 없으신가요? </Text>
            <Link href="/(auth)/signup" testID="link-signup">
              <Text style={styles.footerLink}>회원가입</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  center: { alignItems: "center", marginBottom: 40 },
  iconBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: "#F5F5F7", alignItems: "center", justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: "600", color: "#1D1D1F", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "#86868B", marginTop: 8 },
  form: { gap: 16 },
  grid3: { flexDirection: "row", gap: 10 },
  fieldLabel: { marginBottom: 6 },
  req: { color: "#F87171" },
  error: { fontSize: 13, color: "#EF4444" },
  submitBtn: { height: 48, borderRadius: 12, marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { fontSize: 13, color: "#86868B" },
  footerLink: { fontSize: 13, color: "#0071E3", fontWeight: "500" },
});
