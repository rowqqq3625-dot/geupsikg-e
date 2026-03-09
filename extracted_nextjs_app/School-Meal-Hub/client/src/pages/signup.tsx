import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchoolSearch, type SchoolCandidate } from "@/components/school-search";
import { ALLERGY_OPTIONS } from "@shared/schema";
import { UtensilsCrossed } from "lucide-react";

export default function SignupPage() {
  const { signup, isAuthenticated } = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<SchoolCandidate | null>(null);
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [error, setError] = useState("");

  if (isAuthenticated) return <Redirect to="/dashboard" />;

  const toggleAllergy = (id: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12" data-testid="page-signup">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F5F5F7] mb-6">
            <UtensilsCrossed className="w-8 h-8 text-[#1D1D1F]" />
          </div>
          <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight" data-testid="text-signup-title">
            급식E 가입
          </h1>
          <p className="text-[15px] text-[#86868B] mt-2">학교 정보를 입력해주세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <SchoolSearch selected={selectedSchool} onSelect={setSelectedSchool} />

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#1D1D1F]">학년 <span className="text-red-400">*</span></Label>
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
              <Label className="text-[13px] font-medium text-[#1D1D1F]">반 <span className="text-red-400">*</span></Label>
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
              <Label className="text-[13px] font-medium text-[#1D1D1F]">학번 <span className="text-red-400">*</span></Label>
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

          <div className="border-t border-[#F5F5F7] pt-4">
            <p className="text-[13px] font-medium text-[#86868B] mb-3">건강 정보 <span className="font-normal">(선택)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#1D1D1F]">키 (cm)</Label>
                <Input
                  data-testid="input-height"
                  type="number"
                  placeholder="예: 145"
                  min={50}
                  max={250}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="h-12 rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[15px] placeholder:text-[#86868B]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#1D1D1F]">몸무게 (kg)</Label>
                <Input
                  data-testid="input-weight"
                  type="number"
                  placeholder="예: 38"
                  min={10}
                  max={200}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="h-12 rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[15px] placeholder:text-[#86868B]"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#1D1D1F] mb-3">알레르기 <span className="font-normal text-[#86868B]">(선택, 해당하는 것 모두 선택)</span></p>
            <div className="grid grid-cols-3 gap-2">
              {ALLERGY_OPTIONS.map((allergy) => (
                <label
                  key={allergy.id}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] cursor-pointer"
                  data-testid={`checkbox-allergy-${allergy.id}`}
                >
                  <Checkbox
                    checked={selectedAllergies.includes(allergy.id)}
                    onCheckedChange={() => toggleAllergy(allergy.id)}
                  />
                  <span className="text-[12px] text-[#1D1D1F] leading-tight">{allergy.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-red-500" data-testid="text-signup-error">{error}</p>
          )}

          <Button
            type="submit"
            data-testid="button-signup"
            disabled={signup.isPending}
            className="w-full h-12 rounded-xl bg-[#0071E3] text-white text-[15px] font-medium"
          >
            {signup.isPending ? "가입 중..." : "회원가입"}
          </Button>
        </form>

        <p className="text-center text-[13px] text-[#86868B] mt-8">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-[#0071E3] font-medium" data-testid="link-login">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
