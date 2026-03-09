import fs from "fs";
import path from "path";

export type AIVerdict = "APPROVE" | "PARTIAL" | "REJECT_UNTOUCHED" | "REVIEW";

export interface AIAnalysisResult {
  score: number;          // 0.0~1.0 (eatenPercent / 100)
  eatenPercent: number;   // 0~100, 먹은 비율
  points: number;         // 실제 지급할 포인트 (0, 10, 20, ..., 100)
  verdict: AIVerdict;
  details: {
    eatenPercent: number;
    confidence: number;
    reason: string;
  };
}

const MODEL = "qwen3-vl-flash-2026-01-22";

const BASE_URL = (process.env.DASHSCOPE_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");

const PROMPT = `당신은 학교 급식 잔반 판정 AI입니다.
사진을 분석하여 학생이 급식을 얼마나 먹었는지 정확히 판단하세요.

반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "eatenPercent": <0~100 정수, 먹은 비율. 0=전혀 안 먹음/배식받은 그대로, 100=완전히 다 먹음>,
  "confidence": <0.0~1.0, 판정 신뢰도>,
  "reason": "<판정 근거를 한 문장으로>"
}

판정 기준:
- eatenPercent 0~4: 음식을 전혀 먹지 않고 그대로 반환 → 반환 처리 (포인트 없음)
- eatenPercent 5~84: 일부 섭취 → 먹은 비율에 따라 10점 단위 포인트 지급
- eatenPercent 85~100: 거의 다 먹음 → 최대 포인트 지급

주의사항:
- 급식 식판이 아닌 사진이면 eatenPercent를 0으로, reason에 "급식 사진이 아닙니다." 기록
- 아직 먹기 전 배식 상태와 다 먹은 상태를 명확히 구분하세요
- 잔반(남은 음식)이 많을수록 eatenPercent가 낮습니다
- 국물만 남은 경우 eatenPercent를 높게 평가하세요`;

function computePoints(eatenPercent: number): number {
  if (eatenPercent < 5) return 0;
  if (eatenPercent >= 85) return 100;
  return Math.max(10, Math.round(eatenPercent / 10) * 10);
}

function computeVerdict(eatenPercent: number, confidence: number): AIVerdict {
  if (confidence < 0.4) return "REVIEW"; // 신뢰도 낮으면 관리자 검토
  if (eatenPercent < 5) return "REJECT_UNTOUCHED";
  if (eatenPercent >= 85) return "APPROVE";
  return "PARTIAL";
}

async function buildImageContent(imageUrl: string): Promise<{ type: "image_url"; image_url: { url: string } }> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return { type: "image_url", image_url: { url: imageUrl } };
  }

  const filePath = imageUrl.startsWith("/uploads/")
    ? path.resolve(process.cwd(), "uploads", path.basename(imageUrl))
    : path.resolve(process.cwd(), imageUrl.replace(/^\//, ""));

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "") || "jpeg";
  const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const mime = mimeMap[ext] ?? "image/jpeg";
  const base64 = buffer.toString("base64");
  return { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } };
}

function parseMockFallback(imageUrl: string): AIAnalysisResult {
  const seed = imageUrl.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  let eatenPercent: number;
  if (rand < 0.5) eatenPercent = Math.round(85 + rand / 0.5 * 15); // 85~100
  else if (rand < 0.75) eatenPercent = Math.round(30 + (rand - 0.5) / 0.25 * 55); // 30~84
  else if (rand < 0.9) eatenPercent = Math.round((rand - 0.75) / 0.15 * 30); // 0~29
  else eatenPercent = 0; // untouched

  eatenPercent = Math.min(100, Math.max(0, eatenPercent));
  const confidence = 0.5;
  const verdict = computeVerdict(eatenPercent, confidence);
  const points = computePoints(eatenPercent);

  return {
    score: eatenPercent / 100,
    eatenPercent,
    points,
    verdict,
    details: {
      eatenPercent,
      confidence,
      reason: "[Mock 폴백] API 호출 실패로 임시 판정됩니다.",
    },
  };
}

export async function analyzeCleanPlate(imageUrl: string): Promise<AIAnalysisResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn("[CleanPlate AI] DASHSCOPE_API_KEY 미설정 — Mock 폴백 사용");
    return parseMockFallback(imageUrl);
  }

  let imageContent: { type: "image_url"; image_url: { url: string } };
  try {
    imageContent = await buildImageContent(imageUrl);
  } catch (err) {
    console.error("[CleanPlate AI] 이미지 읽기 실패:", err);
    return parseMockFallback(imageUrl);
  }

  const body = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          imageContent,
          { type: "text", text: PROMPT },
        ],
      },
    ],
    enable_thinking: false,
    max_tokens: 256,
    temperature: 0.1,
  };

  let raw = "";
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[CleanPlate AI] API 오류 ${res.status}:`, errText);
      return parseMockFallback(imageUrl);
    }

    const json = await res.json() as {
      choices: { message: { content: string } }[];
    };

    raw = json.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[CleanPlate AI] API 호출 실패:", err);
    return parseMockFallback(imageUrl);
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[CleanPlate AI] JSON 파싱 실패. 모델 응답:", raw);
    return parseMockFallback(imageUrl);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      eatenPercent?: number;
      confidence?: number;
      reason?: string;
    };

    const eatenPercent = Math.min(100, Math.max(0, Math.round(Number(parsed.eatenPercent ?? 0))));
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.8)));
    const reason = String(parsed.reason ?? "");

    const verdict = computeVerdict(eatenPercent, confidence);
    const points = computePoints(eatenPercent);

    console.log(`[CleanPlate AI] 판정 완료 — eatenPercent: ${eatenPercent}%, verdict: ${verdict}, points: ${points}P, reason: ${reason}`);

    return {
      score: Math.round(eatenPercent) / 100,
      eatenPercent,
      points,
      verdict,
      details: {
        eatenPercent,
        confidence: Math.round(confidence * 100) / 100,
        reason,
      },
    };
  } catch (err) {
    console.error("[CleanPlate AI] JSON 파싱 예외:", err, "원문:", raw);
    return parseMockFallback(imageUrl);
  }
}
