import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle2, X } from "lucide-react";

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/schools/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, selected]);

  const handleSelect = (school: SchoolCandidate) => {
    onSelect(school);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="space-y-2 relative">
      <Label className="text-[13px] font-medium text-[#1D1D1F]">
        {label} <span className="text-red-400">*</span>
      </Label>

      {selected ? (
        <div className="flex items-center gap-2 px-3 py-3 bg-[#F0F8FF] border border-[#0071E3]/30 rounded-xl" data-testid="selected-school">
          <CheckCircle2 className="w-4 h-4 text-[#0071E3] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-[#1D1D1F] truncate">{selected.name}</p>
            <p className="text-[12px] text-[#86868B] truncate">{selected.address}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="w-6 h-6 flex items-center justify-center rounded-full text-[#86868B]"
            data-testid="button-clear-school"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
          <Input
            data-testid="input-school-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="학교명을 입력하세요"
            className="pl-9 h-12 rounded-xl border-[#D2D2D7] bg-[#F5F5F7] text-[15px] placeholder:text-[#86868B]"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86868B]">검색 중...</span>
          )}
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#D2D2D7] rounded-xl divide-y divide-[#F5F5F7]" data-testid="school-search-results">
          {results.map((school, idx) => (
            <button
              key={idx}
              type="button"
              data-testid={`school-result-${idx}`}
              onClick={() => handleSelect(school)}
              className="w-full text-left px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
            >
              <p className="text-[14px] font-medium text-[#1D1D1F]">{school.name}</p>
              <p className="text-[12px] text-[#86868B] mt-0.5">{school.address}</p>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length > 0 && !loading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#D2D2D7] rounded-xl px-4 py-3">
          <p className="text-[13px] text-[#86868B]">검색 결과가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
