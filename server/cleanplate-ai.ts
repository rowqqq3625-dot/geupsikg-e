const MODEL = "qwen3-vl-flash-2026-01-22";
const BASE = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export interface CleanPlateAnalysis {
  score: number;
  verdict: "CLEAN" | "NOT_CLEAN" | "AUTO";
  detail: string;
  pointsAwarded: number;
}

export async function analyzeCleanPlate(
  imageBuffer: Buffer,
  menuText: string
): Promise<CleanPlateAnalysis> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn("[CleanplateAI] DASHSCOPE_API_KEY 없음 → 기본값 반환");
    return { score: 0.75, verdict: "AUTO", detail: "API 키 미설정", pointsAwarded: 100 };
  }

  const base64 = imageBuffer.toString("base64");

  const prompt =
    `이 사진은 한국 학교 급식 후 식판 사진입니다.\n` +
    `오늘 메뉴: ${menuText}\n\n` +
    `학생이 음식을 얼마나 먹었는지 분석해 주세요.\n` +
    `판정 기준:\n` +
    `- CLEAN: 잔반이 거의 없음 (score 0.8 이상)\n` +
    `- NOT_CLEAN: 음식이 상당히 남아있음 (score 0.5 미만)\n\n` +
    `반드시 아래 JSON 형식으로만 답하세요 (설명 없이):\n` +
    `{"verdict":"CLEAN","score":0.9,"detail":"접시가 깨끗합니다."}`;

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: 256,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[CleanplateAI] API 오류:", errText);
      return { score: 0.75, verdict: "AUTO", detail: "AI 분석 실패", pointsAwarded: 100 };
    }

    const data = await res.json();
    const rawText: string = data?.choices?.[0]?.message?.content ?? "";

    console.log("[CleanplateAI] 응답 원문:", rawText.slice(0, 200));

    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const score = Math.max(0, Math.min(1, Number(parsed.score ?? 0.75)));
      const verdict: "CLEAN" | "NOT_CLEAN" | "AUTO" =
        parsed.verdict === "CLEAN"
          ? "CLEAN"
          : parsed.verdict === "NOT_CLEAN"
          ? "NOT_CLEAN"
          : "AUTO";
      const points = score >= 0.8 ? 100 : score >= 0.5 ? 50 : 0;
      console.log(`[CleanplateAI] 판정: ${verdict}, score: ${score}, 포인트: ${points}`);
      return { score, verdict, detail: parsed.detail ?? "", pointsAwarded: points };
    }

    console.warn("[CleanplateAI] JSON 파싱 실패, 원문:", rawText.slice(0, 100));
  } catch (e) {
    console.error("[CleanplateAI] 오류:", e);
  }

  return { score: 0.75, verdict: "AUTO", detail: "응답 파싱 실패", pointsAwarded: 100 };
}
