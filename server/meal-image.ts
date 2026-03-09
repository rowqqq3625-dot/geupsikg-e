import path from "path";
import crypto from "crypto";
import { mkdirSync, writeFileSync, readFileSync } from "fs";

const API_URL = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const TRAY_IMAGE_PATH = path.resolve(process.cwd(), "server/assets/meal-tray.jpg");

function parseMenuItems(menuText: string): string[] {
  return menuText
    .replace(/\*/g, "")
    .split(/[·,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildSlotAssignment(items: string[]): string {
  const slots: string[] = [];
  let riceItem = "";
  let soupItem = "";
  const sides: string[] = [];

  for (const item of items) {
    if (!riceItem && /밥|라이스|볶음밥|비빔밥|덮밥|잡곡|현미|카레/.test(item)) {
      riceItem = item;
    } else if (!soupItem && /국|탕|찌개|스프|죽|미역|된장/.test(item)) {
      soupItem = item;
    } else {
      sides.push(item);
    }
  }

  if (!riceItem && sides.length > 0) riceItem = sides.shift()!;
  if (!soupItem && sides.length > 0) soupItem = sides.shift()!;

  slots.push(`하단 왼쪽 큰 사각 칸: ${riceItem || items[0] || "밥"}`);
  slots.push(`하단 오른쪽 둥근 칸: ${soupItem || items[1] || "국"}`);

  const topSlotNames = ["상단 왼쪽 칸", "상단 가운데 칸", "상단 오른쪽 칸"];
  for (let i = 0; i < topSlotNames.length; i++) {
    if (i < sides.length) {
      slots.push(`${topSlotNames[i]}: ${sides[i]}`);
    }
  }

  if (sides.length > 3) {
    const extra = sides.slice(3).join(", ");
    slots.push(`남은 반찬(빈 칸에 추가): ${extra}`);
  }

  return slots.join("\n");
}

export async function generateMealImage(menuText: string): Promise<string | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn("[MealImage] DASHSCOPE_API_KEY 없음 → 건너뜀");
    return null;
  }

  const items = parseMenuItems(menuText);
  if (items.length === 0) {
    console.warn("[MealImage] 메뉴 항목 없음 → 건너뜀");
    return null;
  }

  console.log("[MealImage] 이미지 생성 시작:", menuText.slice(0, 80));

  const result = await tryEditWithTray(menuText, apiKey);
  if (result) return result;

  console.log("[MealImage] 편집 실패 → 텍스트 전용 생성으로 전환");
  return await tryTextGenerate(menuText, apiKey);
}

async function tryEditWithTray(menuText: string, apiKey: string): Promise<string | null> {
  let trayBase64: string;
  try {
    const buf = readFileSync(TRAY_IMAGE_PATH);
    trayBase64 = `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    console.warn("[MealImage] 식판 이미지 파일 없음:", TRAY_IMAGE_PATH);
    return null;
  }

  const items = parseMenuItems(menuText);
  const slotAssignment = buildSlotAssignment(items);

  const editPrompt =
    `Edit this empty stainless steel Korean school meal tray photo. ` +
    `Fill each compartment with today's school lunch menu items, making the food look photorealistic as if actually served.\n\n` +
    `Today's menu: ${items.join(", ")}\n\n` +
    `Place each dish in the corresponding compartment:\n${slotAssignment}\n\n` +
    `Requirements:\n` +
    `- Each food item must be clearly identifiable and accurately represent the actual Korean dish\n` +
    `- Food should look freshly served with realistic textures, colors, and portions appropriate for a school lunch\n` +
    `- Maintain the original tray's metallic surface, lighting, and top-down camera angle\n` +
    `- Rice should have visible grains, soup should have liquid with ingredients floating, side dishes should show authentic Korean preparation\n` +
    `- The overall image should look like an actual photograph taken in a school cafeteria, not an illustration`;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-image-2.0",
        input: {
          messages: [{
            role: "user",
            content: [
              { image: trayBase64 },
              { text: editPrompt },
            ],
          }],
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[MealImage] 편집 API 오류:", res.status, errText.slice(0, 300));
      return null;
    }

    const data = await res.json();
    return await extractAndSaveImage(data, "edit");
  } catch (e) {
    console.error("[MealImage] tryEditWithTray 오류:", e);
    return null;
  }
}

async function tryTextGenerate(menuText: string, apiKey: string): Promise<string | null> {
  const items = parseMenuItems(menuText);
  const slotAssignment = buildSlotAssignment(items);

  const prompt =
    `Generate a photorealistic top-down photograph of a Korean school lunch on a 5-compartment stainless steel meal tray.\n\n` +
    `Today's menu: ${items.join(", ")}\n\n` +
    `Compartment layout:\n${slotAssignment}\n\n` +
    `The tray has 3 small rectangular compartments on top and 2 large compartments on the bottom (left: square, right: round).\n` +
    `Each dish must be clearly identifiable as the specific Korean food item listed.\n` +
    `Style: overhead cafeteria photo, natural lighting, realistic food textures and colors.`;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-image-2.0",
        input: {
          messages: [{
            role: "user",
            content: [{ text: prompt }],
          }],
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[MealImage] 텍스트 생성 API 오류:", res.status, errText.slice(0, 300));
      return null;
    }

    const data = await res.json();
    return await extractAndSaveImage(data, "gen");
  } catch (e) {
    console.error("[MealImage] tryTextGenerate 오류:", e);
    return null;
  }
}

async function extractAndSaveImage(data: Record<string, unknown>, tag: string): Promise<string | null> {
  try {
    const output = data?.output as Record<string, unknown> | undefined;
    const choices = output?.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message as Record<string, unknown> | undefined;
    const content = message?.content as Array<Record<string, string>> | undefined;

    if (!content || !Array.isArray(content)) {
      console.warn(`[MealImage][${tag}] 응답에 content 없음:`, JSON.stringify(data).slice(0, 300));
      return null;
    }

    const imageEntry = content.find((c) => c.image);
    if (!imageEntry?.image) {
      console.warn(`[MealImage][${tag}] 이미지 URL 없음:`, JSON.stringify(content).slice(0, 300));
      return null;
    }

    const imageUrl = imageEntry.image;
    console.log(`[MealImage][${tag}] 이미지 URL 수신:`, imageUrl.slice(0, 80));
    const savedPath = await downloadAndSave(imageUrl);
    console.log(`[MealImage][${tag}] 저장 결과:`, savedPath);
    return savedPath;
  } catch (e) {
    console.error(`[MealImage][${tag}] 파싱 오류:`, e);
    return null;
  }
}

async function downloadAndSave(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      console.error("[MealImage] 다운로드 실패:", res.status);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    mkdirSync(uploadsDir, { recursive: true });
    const filename = `meal-${crypto.randomUUID()}.png`;
    writeFileSync(path.join(uploadsDir, filename), buffer);
    console.log("[MealImage] 이미지 저장 완료:", filename, `(${buffer.length} bytes)`);
    return `/uploads/${filename}`;
  } catch (e) {
    console.error("[MealImage] 다운로드 오류:", e);
    return null;
  }
}
