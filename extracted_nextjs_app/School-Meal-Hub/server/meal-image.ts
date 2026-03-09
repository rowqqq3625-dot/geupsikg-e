import fs from "fs";
import path from "path";

const DASHSCOPE_BASE = "https://dashscope-intl.aliyuncs.com/api/v1";

const TRAY_IMAGE_PATH = path.resolve(
  process.cwd(),
  "attached_assets/_____1120e1ef29_1772709115175.jpeg"
);

function getTrayBase64(): string | null {
  try {
    const buf = fs.readFileSync(TRAY_IMAGE_PATH);
    return buf.toString("base64");
  } catch {
    console.warn("[MealImage] 급식판 레퍼런스 이미지를 읽을 수 없습니다:", TRAY_IMAGE_PATH);
    return null;
  }
}

/**
 * 메뉴 텍스트를 파싱. ·으로만 분리하고 쉼표는 유지 (예: "브로콜리,초고추장")
 */
function parseMenuItems(menuText: string): string[] {
  return menuText
    .split("·")
    .map((s) => s.replace(/\([^)]*\)/g, "").trim())
    .filter(Boolean);
}

export async function generateMealImage(menuText: string): Promise<string | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn("[MealImage] DASHSCOPE_API_KEY 미설정 — 이미지 생성 건너뜀");
    return null;
  }

  const menuItems = parseMenuItems(menuText);
  if (menuItems.length === 0) return null;

  const trayB64 = getTrayBase64();
  if (trayB64) {
    return generateWithTrayReference(apiKey, menuItems, trayB64);
  }
  return generateTextOnly(apiKey, menuItems);
}

/** ─── 레퍼런스 이미지 사용 (메인 경로) ─────────────────────────────── */
async function generateWithTrayReference(
  apiKey: string,
  menuItems: string[],
  trayB64: string
): Promise<string | null> {
  const prompt = buildEditPrompt(menuItems);

  const body = {
    model: "qwen-image-2.0",
    input: {
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: `data:image/jpeg;base64,${trayB64}` },
            { type: "text", text: prompt },
          ],
        },
      ],
    },
    parameters: { size: "1280*960" },
  };

  return callApi(apiKey, body);
}

/** ─── 텍스트 전용 fallback ──────────────────────────────────────────── */
async function generateTextOnly(apiKey: string, menuItems: string[]): Promise<string | null> {
  const allItems = menuItems.join(", ");
  const prompt = [
    `Top-down aerial photo of a complete Korean school cafeteria stainless steel meal tray (식판) with all compartments filled.`,
    `Every single menu item is plated: ${allItems}.`,
    `Photorealistic food photography. The entire tray is fully visible. No text. No people.`,
  ].join(" ");

  const body = {
    model: "qwen-image-2.0",
    input: {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    },
    parameters: { size: "1280*960" },
  };

  return callApi(apiKey, body);
}

/** ─── 프롬프트 빌더 ─────────────────────────────────────────────────── */
function buildEditPrompt(items: string[]): string {
  // 밥·국·반찬 자동 분류
  const riceIdx = items.findIndex((m) => /밥|쌀|현미|보리|잡곡/.test(m));
  const soupIdx = items.findIndex((m) => /국|탕|찌개|스프|죽|된장|미역|뭇/.test(m));

  const riceItem = riceIdx >= 0 ? items[riceIdx] : null;
  const soupItem = soupIdx >= 0 ? items[soupIdx] : null;
  const sideItems = items.filter((_, i) => i !== riceIdx && i !== soupIdx);

  // 상단 3칸에 반찬 배정 (최대 3개, 남은 건 오버플로우)
  const slot = (arr: string[], i: number) => arr[i] ?? null;
  const side1 = slot(sideItems, 0);
  const side2 = slot(sideItems, 1);
  const side3 = slot(sideItems, 2);
  const overflow = sideItems.slice(3); // 4번째 반찬 이상

  // 각 칸 설명
  const compartments: string[] = [];

  if (riceItem) {
    compartments.push(
      `[LARGE BOTTOM-LEFT COMPARTMENT — 밥칸]: Fill completely with "${riceItem}". ` +
      `Steamed glistening mixed-grain rice, slightly mounded and fluffy, filling the entire compartment.`
    );
  }
  if (soupItem) {
    compartments.push(
      `[ROUND BOWL BOTTOM-RIGHT — 국칸]: Fill with "${soupItem}". ` +
      `Hot soup with visible broth, floating solid ingredients, subtle steam rising.`
    );
  }
  if (side1) {
    compartments.push(
      `[TOP-LEFT SMALL COMPARTMENT — 반찬1칸]: Fill with "${side1}". ` +
      describeFood(side1)
    );
  }
  if (side2) {
    compartments.push(
      `[TOP-CENTER COMPARTMENT — 반찬2칸]: Fill with "${side2}". ` +
      describeFood(side2)
    );
  }
  if (side3) {
    compartments.push(
      `[TOP-RIGHT SMALL COMPARTMENT — 반찬3칸]: Fill with "${side3}". ` +
      describeFood(side3)
    );
  }
  if (overflow.length > 0) {
    compartments.push(
      `Additionally include "${overflow.join('", "')}" naturally arranged alongside other items in the tray — ` +
      `place them in any available space or arrange them on top of compatible compartments as a real cafeteria would.`
    );
  }

  return [
    `You are editing this photo of an empty Korean school cafeteria stainless steel meal tray (식판).`,
    `CRITICAL REQUIREMENT: You MUST fill EVERY SINGLE compartment with the specified food. No compartment can be left empty.`,
    `CRITICAL REQUIREMENT: ALL menu items listed below must visibly appear in the final image — do not omit any item.`,
    ``,
    `Compartment assignments (follow exactly):`,
    compartments.map((c, i) => `${i + 1}. ${c}`).join(" "),
    ``,
    `Visual quality requirements:`,
    `- Keep the original stainless steel tray structure, viewpoint, and lighting EXACTLY as in the reference photo.`,
    `- Food must look like authentic Korean school cafeteria (급식) food — hyper-realistic, not illustrated.`,
    `- Portion sizes should match real Korean school lunch servings.`,
    `- Hot dishes should show slight steam or condensation.`,
    `- Kimchi must be vivid red-orange. Rice must look white/grain. Soups must show liquid broth.`,
    `- Dessert/fruit items must be clearly identifiable and placed naturally.`,
    `- The ENTIRE tray must be fully visible and uncropped in the frame.`,
    `- NO text, NO watermarks, NO labels, NO cutlery.`,
    `- Final result must look like an actual photograph taken in a Korean school cafeteria.`,
  ].join(" ");
}

/** 음식 이름에서 간단한 시각 묘사 생성 */
function describeFood(item: string): string {
  if (/김치/.test(item)) return "Vivid red-orange fermented cabbage kimchi, moist and glossy.";
  if (/브로콜리|초고추장/.test(item)) return "Bright green steamed broccoli florets with red chili paste dip on the side.";
  if (/볶음|닭|불|어깨/.test(item)) return "Stir-fried dish with glistening sauce, caramelized edges, and tender protein pieces.";
  if (/전|오꼬노미|부침/.test(item)) return "Golden-brown pan-fried savory pancake, crispy edges, cut into portions.";
  if (/떡|찹쌀|딸기|경단/.test(item)) return "Soft chewy rice cake (tteok), plump and smooth with visible filling or coating. Dessert appearance.";
  if (/나물|시금치|콩나물/.test(item)) return "Seasoned Korean vegetable side dish (namul), lightly dressed with sesame.";
  if (/조림|장/.test(item)) return "Braised item in savory-sweet soy sauce, glossy and rich colored.";
  if (/과일|귤|사과|포도|바나나/.test(item)) return "Fresh fruit, bright natural colors, whole or sliced.";
  return "Authentic Korean cafeteria side dish, colorful and appetizing, filling the compartment naturally.";
}

/** ─── API 호출 공통 ──────────────────────────────────────────────────── */
async function callApi(apiKey: string, body: object): Promise<string | null> {
  try {
    const res = await fetch(
      `${DASHSCOPE_BASE}/services/aigc/multimodal-generation/generation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[MealImage] API 오류 ${res.status}:`, errText);
      return null;
    }

    const json = (await res.json()) as {
      output?: {
        choices?: { message?: { content?: { image?: string }[] } }[];
      };
    };

    const imageUrl = json.output?.choices?.[0]?.message?.content?.[0]?.image;
    if (imageUrl) {
      console.log(`[MealImage] 이미지 생성 완료: ${imageUrl.slice(0, 80)}…`);
      return imageUrl;
    }

    console.error("[MealImage] 이미지 URL 없음:", JSON.stringify(json).slice(0, 200));
    return null;
  } catch (err) {
    console.error("[MealImage] API 호출 실패:", err);
    return null;
  }
}
