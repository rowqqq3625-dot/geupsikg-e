import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchoolSearch, type SchoolCandidate } from "@/components/school-search";
import { UtensilsCrossed } from "lucide-react";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<SchoolCandidate | null>(null);
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState("");

  if (isAuthenticated) return <Redirect to="/dashboard" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen bg-white flex items-center justify-center px-4" data-testid="page-login">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F5F5F7] mb-6">
            <UtensilsCrossed className="w-8 h-8 text-[#1D1D1F]" />
          </div>
          <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight" data-testid="text-login-title">
            급식E 로그인
          </h1>
          <p className="text-[15px] text-[#86868B] mt-2">학교 정보로 시작하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <SchoolSearch selected={selectedSchool} onSelect={setSelectedSchool} />

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#1D1D1F]">학년</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger data-testid="select-grade" className="h-12 rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[15px]">
                  <SelectValue placeholder="학년" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((g) => (
                    <SelectItem key={g} value={String(g)}>{g}학년</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#1D1D1F]">반</Label>
              <Select value={classNum} onValueChange={setClassNum}>
                <SelectTrigger data-testid="select-class" className="h-12 rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[15px]">
                  <SelectValue placeholder="반" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((c) => (
                    <SelectItem key={c} value={String(c)}>{c}반</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#1D1D1F]">학번</Label>
              <Input
                data-testid="input-student-number"
                type="number"
                placeholder="번호"
                min={1}
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="h-12 rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[15px] placeholder:text-[#86868B]"
              />
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-red-500" data-testid="text-login-error">{error}</p>
          )}

          <Button
            type="submit"
            data-testid="button-login"
            disabled={login.isPending}
            className="w-full h-12 rounded-xl bg-[#0071E3] text-white text-[15px] font-medium"
          >
            {login.isPending ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <p className="text-center text-[13px] text-[#86868B] mt-8">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-[#0071E3] font-medium" data-testid="link-signup">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
