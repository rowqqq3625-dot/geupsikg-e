/**
 * NEIS (나이스) 급식 API 유틸리티
 * 환경변수 NEIS_API_KEY 없으면 Mock 데이터 반환
 */

const NEIS_BASE = "https://open.neis.go.kr/hub";

export interface SchoolCandidate {
  name: string;
  officeCode: string;
  schoolCode: string;
  address: string;
}

export interface MealResult {
  menuText: string;
  source: "neis" | "mock";
  raw?: unknown;
}

// ─── 학교 검색 ────────────────────────────────────────────────────
export async function searchSchoolsByName(query: string): Promise<SchoolCandidate[]> {
  const apiKey = process.env.NEIS_API_KEY;

  if (!apiKey) {
    return getMockSchools(query);
  }

  try {
    const params = new URLSearchParams({
      KEY: apiKey,
      Type: "json",
      pIndex: "1",
      pSize: "10",
      SCHUL_NM: query,
    });

    const res = await fetch(`${NEIS_BASE}/schoolInfo?${params}`);
    if (!res.ok) throw new Error("NEIS 학교 검색 실패");

    const data = await res.json();
    const rows = data?.schoolInfo?.[1]?.row ?? [];

    return rows.map((row: Record<string, string>) => ({
      name: row.SCHUL_NM,
      officeCode: row.ATPT_OFCDC_SC_CODE,
      schoolCode: row.SD_SCHUL_CODE,
      address: row.ORG_RDNMA ?? "",
    }));
  } catch (err) {
    console.error("[NEIS] 학교 검색 오류:", err);
    return getMockSchools(query);
  }
}

// ─── 급식 조회 ────────────────────────────────────────────────────
export async function fetchMealByDate(
  officeCode: string,
  schoolCode: string,
  dateStr: string
): Promise<MealResult> {
  const apiKey = process.env.NEIS_API_KEY;

  if (!apiKey) {
    return getMockMeal();
  }

  try {
    const params = new URLSearchParams({
      KEY: apiKey,
      Type: "json",
      pIndex: "1",
      pSize: "5",
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      MLSV_YMD: dateStr.replace(/-/g, ""),
    });

    const res = await fetch(`${NEIS_BASE}/mealServiceDietInfo?${params}`);
    if (!res.ok) throw new Error("NEIS 급식 조회 실패");

    const data = await res.json();
    const rows = data?.mealServiceDietInfo?.[1]?.row ?? [];

    if (rows.length === 0) {
      return getMockMeal();
    }

    const row = rows[0];
    const rawMenu: string = row.DDISH_NM ?? "";
    const menuText = rawMenu
      .split("<br/>")
      .map((item: string) => item.replace(/\s*\([\d.]+\)\s*/g, "").trim())
      .filter(Boolean)
      .join(" · ");

    return { menuText, source: "neis", raw: row };
  } catch (err) {
    console.error("[NEIS] 급식 조회 오류:", err);
    return getMockMeal();
  }
}

// ─── Mock 데이터 ──────────────────────────────────────────────────
function getMockSchools(query: string): SchoolCandidate[] {
  return [
    {
      name: `${query}초등학교`,
      officeCode: "B10",
      schoolCode: "7010083",
      address: "서울특별시 강남구",
    },
    {
      name: `${query}중학교`,
      officeCode: "B10",
      schoolCode: "7010084",
      address: "서울특별시 서초구",
    },
    {
      name: `${query}고등학교`,
      officeCode: "C10",
      schoolCode: "9290001",
      address: "경기도 수원시",
    },
  ];
}

function getMockMeal(): MealResult {
  const menus = [
    "잡곡밥 · 김치찌개 · 계란말이 · 시금치나물 · 배추김치 · 요구르트",
    "현미밥 · 된장국 · 제육볶음 · 콩나물무침 · 깍두기 · 사과",
    "흰쌀밥 · 미역국 · 고등어조림 · 감자조림 · 열무김치 · 귤",
    "보리밥 · 순두부찌개 · 닭갈비 · 도라지무침 · 배추김치 · 바나나",
  ];
  const today = new Date().getDay();
  return {
    menuText: menus[today % menus.length],
    source: "mock",
  };
}
