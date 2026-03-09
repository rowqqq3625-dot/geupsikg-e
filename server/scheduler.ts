/**
 * 급식 데이터 자동 갱신 스케줄러
 * - 매일 자정(KST, UTC+9)에 "활성 학교"(이용자 1명 이상)만 급식 정보 NEIS API 갱신
 * - 갱신 후 각 학교별 급식판 이미지 1회 생성
 * - 이용자가 없는 학교는 갱신 대상에서 자동 제외
 */

import { storage } from "./storage";
import { fetchMealByDate } from "./neis";
import { generateMealImage } from "./dashscope";
import type { School } from "./schema";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getTodayKST(): string {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  return now.toISOString().split("T")[0];
}

function getMsUntilMidnightKST(): number {
  const nowUtcMs = Date.now();
  const nowKstMs = nowUtcMs + KST_OFFSET_MS;
  const kstDate = new Date(nowKstMs);

  const midnightKst = new Date(kstDate);
  midnightKst.setUTCHours(0, 0, 0, 0);
  midnightKst.setUTCDate(midnightKst.getUTCDate() + 1);

  return midnightKst.getTime() - nowKstMs;
}

async function refreshActiveSchoolMeals(dateStr: string): Promise<void> {
  const activeSchools = await storage.getActiveSchools();
  console.log(`[Scheduler] 급식 갱신 시작: ${dateStr} (활성 학교 ${activeSchools.length}개)`);

  for (const school of activeSchools) {
    await refreshSingleSchool(school, dateStr);
  }

  console.log(`[Scheduler] 급식 갱신 완료: ${dateStr}`);
}

export async function refreshSingleSchool(school: School, dateStr: string): Promise<void> {
  try {
    const result = await fetchMealByDate(school.officeCode, school.schoolCode, dateStr);
    const cached = await storage.saveMealCache(school.id, dateStr, result.menuText, result.raw ?? null);
    console.log(`[Scheduler] 급식 캐시 저장: ${school.name} (${dateStr}) → ${result.menuText.slice(0, 40)}`);

    if (cached && result.menuText && !cached.mealImageUrl) {
      console.log(`[Scheduler] 이미지 생성 시작: ${school.name}`);
      generateMealImage(result.menuText)
        .then(async (imageUrl) => {
          if (imageUrl) {
            await storage.updateMealImageUrl(school.id, dateStr, imageUrl);
            console.log(`[Scheduler] 이미지 저장 완료: ${school.name} → ${imageUrl}`);
          }
        })
        .catch((e) => {
          console.error(`[Scheduler] 이미지 생성 오류 (${school.name}):`, e);
        });

      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error(`[Scheduler] 학교 처리 오류 (${school.name}):`, e);
  }
}

async function runMidnightJob(): Promise<void> {
  const today = getTodayKST();
  await refreshActiveSchoolMeals(today);
  scheduleNextMidnightJob();
}

function scheduleNextMidnightJob(): void {
  const ms = getMsUntilMidnightKST();
  const nextMidnight = new Date(Date.now() + ms);
  console.log(`[Scheduler] 다음 급식 갱신 예약: ${nextMidnight.toISOString()} (약 ${Math.round(ms / 3600000)}시간 후)`);
  setTimeout(() => {
    runMidnightJob().catch((e) => {
      console.error("[Scheduler] 자정 작업 오류:", e);
      scheduleNextMidnightJob();
    });
  }, ms);
}

export async function startScheduler(): Promise<void> {
  console.log("[Scheduler] 스케줄러 시작");

  const today = getTodayKST();
  const activeSchools = await storage.getActiveSchools();
  console.log(`[Scheduler] 활성 학교 수: ${activeSchools.length}`);

  const uncachedSchools = await Promise.all(
    activeSchools.map(async (school) => {
      const cached = await storage.getMealCache(school.id, today);
      return { school, cached };
    })
  );

  const needsRefresh = uncachedSchools.filter(({ cached }) => !cached || !cached.menuText);

  if (needsRefresh.length > 0) {
    console.log(`[Scheduler] 미캐시 활성 학교 ${needsRefresh.length}개 즉시 갱신`);
    for (const { school } of needsRefresh) {
      await refreshSingleSchool(school, today);
    }
  } else {
    console.log(`[Scheduler] 오늘(${today}) 활성 학교 급식 캐시 모두 존재 → 갱신 건너뜀`);

    for (const { school, cached } of uncachedSchools) {
      if (cached && cached.menuText && !cached.mealImageUrl) {
        console.log(`[Scheduler] 이미지 없는 학교 재생성: ${school.name}`);
        generateMealImage(cached.menuText)
          .then(async (imageUrl) => {
            if (imageUrl) {
              await storage.updateMealImageUrl(school.id, today, imageUrl);
              console.log(`[Scheduler] 이미지 저장 완료: ${school.name} → ${imageUrl}`);
            }
          })
          .catch((e) => console.error(`[Scheduler] 이미지 오류 (${school.name}):`, e));
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  scheduleNextMidnightJob();
}
