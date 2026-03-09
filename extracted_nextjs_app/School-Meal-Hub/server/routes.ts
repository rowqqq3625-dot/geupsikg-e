import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  signupSchema, loginSchema, feedbackSchema, adminReviewSchema,
  buddyJoinSchema, buddyMessageSchema, revealRespondSchema,
  reportSchema, blockSchema, adminActionSchema, classBattleAwardSchema,
  storeItemCreateSchema, storeItemUpdateSchema, storeRedeemSchema, redemptionProcessSchema,
} from "@shared/schema";
import { searchSchoolsByName, fetchMealByDate } from "./neis";
import session from "express-session";
import { pool, db } from "./db";
import { schools } from "@shared/schema";
import { eq } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import { ZodError } from "zod";
import multer from "multer";
import { uploadImage, generateKey } from "./image-storage";
import { analyzeCleanPlate } from "./cleanplate-ai";
import { generateMealImage } from "./meal-image";
import path from "path";
import express from "express";
import crypto from "crypto";
import {
  joinQueue,
  leaveQueue,
  filterContent,
  getOpponentId,
  isParticipant,
  isRevealComplete,
  getAnonymousName,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
} from "./buddy-matching";

const DAILY_LIMIT = 2;
const COOLDOWN_MS = 30 * 60 * 1000; // 30분

// 학교별 이미지 생성 중 잠금 (schoolId_date → Promise)
// 동일 학교·날짜에 대해 최초 1회만 API 호출되도록 보장
const mealImageGenerating = new Map<string, Promise<void>>();

function extractKeywords(menuText: string): string[] {
  return menuText
    .split(/[·,\s]+/)
    .map((s) => s.replace(/\([^)]*\)/g, "").trim())
    .filter((s) => s.length >= 2)
    .map((s) => s.slice(0, 4)); // 앞 4글자로 정규화 (예: "불막창닭어깨살볶음" → "불막창닭")
}

const PgStore = connectPgSimple(session);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일(JPEG, PNG, WEBP)만 업로드 가능합니다."));
    }
  },
});

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "USER" | "ADMIN";
  }
}

function apiError(res: Response, status: number, code: string, message: string, meta?: object) {
  const requestId = res.locals.requestId ?? "unknown";
  return res.status(status).json({ ok: false, error: { code, message, requestId, ...meta } });
}

function apiOk<T extends object>(res: Response, data: T) {
  return res.json({ ok: true, ...data });
}

function parseZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

async function requireAuth(req: Request, res: Response): Promise<{ userId: string; role: "USER" | "ADMIN" } | null> {
  if (!req.session.userId) {
    apiError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return null;
  }
  return { userId: req.session.userId, role: req.session.role ?? "USER" };
}

async function requireAdmin(req: Request, res: Response): Promise<{ userId: string } | null> {
  const auth = await requireAuth(req, res);
  if (!auth) return null;
  if (auth.role !== "ADMIN") {
    apiError(res, 403, "FORBIDDEN", "관리자 권한이 필요합니다.");
    return null;
  }
  return auth;
}

// ─── 인메모리 교환 레이트리밋 ─────────────────────────────────────
const redeemRateLimit = new Map<string, number[]>();
const REDEEM_WINDOW_MS = 10_000; // 10초
const REDEEM_MAX_REQUESTS = 3;   // 최대 3회

function checkRedeemRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (redeemRateLimit.get(userId) ?? []).filter(t => now - t < REDEEM_WINDOW_MS);
  if (timestamps.length >= REDEEM_MAX_REQUESTS) return false;
  timestamps.push(now);
  redeemRateLimit.set(userId, timestamps);
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new PgStore({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  // 업로드 정적 파일 서빙 (로컬 개발 환경)
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // ─── 학교 검색 ────────────────────────────────────────────────────
  app.get("/api/schools/search", async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 1) return apiOk(res, { results: [] });

    try {
      const results = await searchSchoolsByName(q);
      return apiOk(res, { results: results.slice(0, 10) });
    } catch (err) {
      console.error("학교 검색 오류:", err);
      return apiError(res, 500, "SEARCH_FAILED", "학교 검색에 실패했습니다.");
    }
  });

  // ─── 회원가입 ─────────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const data = signupSchema.parse(req.body);

      const school = await storage.upsertSchool({
        name: data.schoolName,
        officeCode: data.officeCode,
        schoolCode: data.schoolCode,
        address: "",
      });

      const existing = await storage.getUserByCredentials(
        school.id, data.grade, data.classNum, data.studentNumber
      );
      if (existing) {
        return apiError(res, 409, "USER_EXISTS", "이미 등록된 학생 정보입니다.");
      }

      const user = await storage.createUser({
        schoolId: school.id,
        grade: data.grade,
        classNum: data.classNum,
        studentNumber: data.studentNumber,
        heightCm: data.heightCm ?? null,
        weightKg: data.weightKg ?? null,
        allergies: data.allergies ?? null,
        points: 0,
      });

      req.session.userId = user.id;
      req.session.role = user.role;
      return res.status(201).json({
        ok: true,
        user: { id: user.id, schoolName: school.name, grade: user.grade, classNum: user.classNum, studentNumber: user.studentNumber, points: user.points, role: user.role },
      });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      console.error("회원가입 오류:", error);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 로그인 ───────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const data = loginSchema.parse(req.body);

      const school = await storage.getSchoolByCode(data.officeCode, data.schoolCode);
      if (!school) {
        return apiError(res, 401, "SCHOOL_NOT_FOUND", "등록된 학교를 찾을 수 없습니다. 회원가입을 먼저 해주세요.");
      }

      const user = await storage.getUserByCredentials(
        school.id, data.grade, data.classNum, data.studentNumber
      );
      if (!user) {
        return apiError(res, 401, "USER_NOT_FOUND", "해당 학생 정보를 찾을 수 없습니다.");
      }

      req.session.userId = user.id;
      req.session.role = user.role;
      return apiOk(res, {
        user: { id: user.id, schoolName: school.name, grade: user.grade, classNum: user.classNum, studentNumber: user.studentNumber, points: user.points, role: user.role },
      });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      console.error("로그인 오류:", error);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 로그아웃 ─────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return apiError(res, 500, "LOGOUT_FAILED", "로그아웃에 실패했습니다.");
      res.clearCookie("connect.sid");
      return apiOk(res, { message: "로그아웃 완료" });
    });
  });

  // ─── 내 정보 ──────────────────────────────────────────────────────
  app.get("/api/me", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");

    const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));

    return apiOk(res, {
      user: {
        id: user.id,
        schoolId: user.schoolId,
        schoolName: school?.name ?? "",
        officeCode: school?.officeCode ?? "",
        schoolCode: school?.schoolCode ?? "",
        grade: user.grade,
        classNum: user.classNum,
        studentNumber: user.studentNumber,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        allergies: user.allergies ?? [],
        points: user.points,
        role: user.role,
      },
    });
  });

  // ─── 오늘 급식 ────────────────────────────────────────────────────
  app.get("/api/meals/today", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");

    const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));
    if (!school) return apiError(res, 404, "SCHOOL_NOT_FOUND", "학교 정보를 찾을 수 없습니다.");

    const today = new Date().toISOString().split("T")[0];

    let cached = await storage.getMealCache(user.schoolId, today);
    let menuText: string;
    let source: string;

    if (cached) {
      menuText = cached.menuText;
      source = "cache";
    } else {
      const result = await fetchMealByDate(school.officeCode, school.schoolCode, today);
      cached = await storage.saveMealCache(user.schoolId, today, result.menuText, result.raw ?? null);
      menuText = result.menuText;
      source = result.source;
    }

    const mealImageUrl = cached?.mealImageUrl ?? null;

    // 이미지가 없으면 백그라운드에서 학교·날짜당 1회만 생성
    if (!mealImageUrl && cached) {
      const lockKey = `${user.schoolId}_${today}`;
      if (!mealImageGenerating.has(lockKey)) {
        const schoolId = user.schoolId;
        const cacheDate = today;
        const menu = menuText;
        const genPromise = (async () => {
          try {
            console.log(`[MealImage] 생성 시작 — 학교: ${schoolId}, 날짜: ${cacheDate}`);
            const imageUrl = await generateMealImage(menu);
            if (imageUrl) {
              await storage.updateMealImageUrl(schoolId, cacheDate, imageUrl);
              console.log(`[MealImage] ${cacheDate} 이미지 캐시 저장 완료 (학교: ${schoolId})`);
            }
          } catch (err) {
            console.error("[MealImage] 백그라운드 생성 실패:", err);
          } finally {
            mealImageGenerating.delete(lockKey);
          }
        })();
        mealImageGenerating.set(lockKey, genPromise);
      } else {
        console.log(`[MealImage] 이미 생성 중 — 학교: ${user.schoolId}, 날짜: ${today} (대기 중인 학생 요청 무시)`);
      }
    }

    // 취향 맞춤 알림 (오늘 이미 보냈으면 건너뜀)
    setImmediate(async () => {
      try {
        const existing = await storage.getUserNotifications(auth.userId);
        const alreadySent = existing.some(
          (n) => n.type === "MEAL_PREFERENCE" && n.createdAt.toISOString().startsWith(today)
        );
        if (!alreadySent) {
          const history = await storage.getMealFeedbackWithMenu(auth.userId, user.schoolId, 60);
          if (history.length >= 2) {
            const todayKeywords = extractKeywords(menuText);
            let likedScore = 0;
            let dislikedScore = 0;
            let likedExample = "";
            let dislikedExample = "";

            for (const h of history) {
              const pastKeywords = extractKeywords(h.menuText);
              const overlap = todayKeywords.filter((k) => pastKeywords.includes(k));
              if (overlap.length === 0) continue;
              if (h.rating >= 4) {
                likedScore += overlap.length * (h.rating - 3);
                if (!likedExample) likedExample = overlap[0];
              } else if (h.rating <= 2) {
                dislikedScore += overlap.length * (3 - h.rating);
                if (!dislikedExample) dislikedExample = overlap[0];
              }
            }

            if (likedScore > dislikedScore && likedScore > 0) {
              await storage.createNotification(
                auth.userId,
                "MEAL_PREFERENCE",
                "오늘 급식, 좋아하실 것 같아요! 😋",
                likedExample
                  ? `이전에 좋아했던 '${likedExample}'(이)가 포함된 메뉴입니다. 맛있게 드세요!`
                  : "지금까지의 평가를 분석한 결과, 오늘 급식이 마음에 드실 것 같아요!",
                "/",
              );
            } else if (dislikedScore > likedScore && dislikedScore > 0) {
              await storage.createNotification(
                auth.userId,
                "MEAL_PREFERENCE",
                "오늘 급식, 취향에 안 맞을 수 있어요 😅",
                dislikedExample
                  ? `이전에 별로였던 '${dislikedExample}'(이)가 포함된 메뉴입니다. 참고하세요!`
                  : "지금까지의 평가를 분석한 결과, 오늘 급식이 취향에 맞지 않을 수 있어요.",
                "/",
              );
            }
          }
        }
      } catch (err) {
        console.error("[MealPreference] 알림 생성 실패:", err);
      }
    });

    return apiOk(res, { date: today, menuText, source, mealImageUrl });
  });

  // ─── 급식 평가 ────────────────────────────────────────────────────
  app.post("/api/feedback", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    try {
      const data = feedbackSchema.parse(req.body);
      const user = await storage.getUser(auth.userId);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");

      const existing = await storage.getUserFeedbackForDate(user.id, data.date);
      if (existing) {
        return apiError(res, 409, "ALREADY_SUBMITTED", "오늘 급식 평가는 이미 제출했습니다.");
      }

      const { feedback, newPoints } = await storage.createFeedbackWithPoints(
        user.id, user.schoolId, data.date, data.rating, data.comment ?? null
      );

      return apiOk(res, { feedbackId: feedback.id, newPoints });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      console.error("피드백 오류:", error);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 랭킹 ─────────────────────────────────────────────────────────
  app.get("/api/ranking", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");

    const scope = req.query.scope === "school" ? "school" : "class";

    if (scope === "class") {
      const rows = await storage.getClassRanking(user.schoolId, user.grade, user.classNum);
      const ranking = rows.map((r, i) => ({
        rank: i + 1,
        label: `${r.studentNumber}번`,
        points: r.points,
        isMe: r.studentNumber === user.studentNumber,
      }));
      return apiOk(res, { scope, myPoints: user.points, ranking });
    } else {
      const rows = await storage.getSchoolRanking(user.schoolId);
      const ranking = rows.map((r, i) => ({
        rank: i + 1,
        label: `${r.grade}학년 ${r.classNum}반 ${r.studentNumber}번`,
        points: r.points,
        isMe: r.grade === user.grade && r.classNum === user.classNum && r.studentNumber === user.studentNumber,
      }));
      return apiOk(res, { scope, myPoints: user.points, ranking });
    }
  });

  // ─── 클린플레이트 업로드 ──────────────────────────────────────────
  app.post("/api/cleanplate/upload", upload.single("file"), async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    try {
      if (!req.file) return apiError(res, 400, "NO_FILE", "이미지 파일이 필요합니다.");

      const user = await storage.getUser(auth.userId);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");

      const date = typeof req.body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
        ? req.body.date
        : new Date().toISOString().split("T")[0];

      const todaySubmissions = await storage.getCleanPlatesByUserAndDate(user.id, date);

      // 일일 한도 초과 차단 (하루 최대 2회)
      if (todaySubmissions.length >= DAILY_LIMIT) {
        return apiError(res, 429, "DAILY_LIMIT_REACHED", `오늘 인증 횟수(${DAILY_LIMIT}회)를 모두 사용했습니다.`);
      }

      // ─ 동일 사진 부정행위 감지 (쿨타임 + 일일 횟수 차감)
      const imageHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
      const duplicateSubmission = todaySubmissions.find((s) => s.imageHash === imageHash);
      if (duplicateSubmission) {
        // DB에 부정행위 기록 저장 (쿨타임 트리거 + 일일 횟수 1회 소모)
        await storage.createFraudCleanPlate({
          userId: user.id,
          schoolId: user.schoolId,
          date,
          imageUrl: duplicateSubmission.imageUrl,
          imageKey: duplicateSubmission.imageKey,
          imageHash,
        });
        const nextSubmitAt = new Date(Date.now() + COOLDOWN_MS).toISOString();
        return apiError(res, 409, "DUPLICATE_IMAGE", "동일한 사진이 감지됐습니다. 부정행위로 간주되어 쿨타임이 적용됩니다.", { nextSubmitAt });
      }

      // ─ 쿨타임 체크: 승인 완료 또는 부정행위 감지 후 30분
      // 잔반으로 인한 일반 반려(REJECTED)는 쿨타임 없이 즉시 재도전 가능
      const cooldownTriggers = todaySubmissions.filter(
        (s) => s.status === "APPROVED" || s.status === "AUTO_APPROVED" || s.reviewNote?.startsWith("FRAUD")
      );
      if (cooldownTriggers.length > 0) {
        const lastAt = new Date(cooldownTriggers[0].createdAt).getTime();
        const elapsed = Date.now() - lastAt;
        if (elapsed < COOLDOWN_MS) {
          const nextSubmitAt = new Date(lastAt + COOLDOWN_MS).toISOString();
          return apiError(res, 429, "COOLDOWN_REQUIRED", `다음 인증은 ${Math.ceil((COOLDOWN_MS - elapsed) / 60000)}분 후에 가능합니다.`, { nextSubmitAt });
        }
      }

      const key = generateKey(user.id, date, req.file.originalname);
      const { url: imageUrl, key: imageKey } = await uploadImage(req.file.buffer, req.file.mimetype, key);

      const submission = await storage.createCleanPlate({
        userId: user.id,
        schoolId: user.schoolId,
        date,
        imageUrl,
        imageKey,
        imageHash,
      });

      // Mock AI 분석 (비동기로 바로 실행)
      const aiResult = await analyzeCleanPlate(imageUrl);

      let finalSubmission = submission;
      let pointsDelta = 0;
      let newPoints = user.points;

      if (aiResult.verdict === "APPROVE") {
        // 완식: 100P 즉시 지급
        const result = await storage.autoApproveCleanPlate(submission.id, aiResult.score, aiResult.details, 100);
        finalSubmission = result.submission;
        pointsDelta = 100;
        newPoints = result.newPoints;
      } else if (aiResult.verdict === "PARTIAL") {
        // 부분 섭취: AI가 계산한 포인트 즉시 지급
        const result = await storage.autoApproveCleanPlate(submission.id, aiResult.score, aiResult.details, aiResult.points);
        finalSubmission = result.submission;
        pointsDelta = aiResult.points;
        newPoints = result.newPoints;
      } else if (aiResult.verdict === "REJECT_UNTOUCHED") {
        // 전부 남김: 즉시 반환 처리 (0P, 쿨타임 없음)
        finalSubmission = await storage.rejectCleanPlate(submission.id, aiResult.score, aiResult.details);
      } else {
        // REVIEW: 신뢰도 낮음 → PENDING 상태로 관리자 검토
        finalSubmission = await storage.updateCleanPlateAiResult(submission.id, aiResult.score, aiResult.details);
      }

      return apiOk(res, {
        submission: {
          id: finalSubmission.id,
          status: finalSubmission.status,
          imageUrl: finalSubmission.imageUrl,
          date: finalSubmission.date,
          aiScore: finalSubmission.aiScore,
          pointsAwarded: finalSubmission.pointsAwarded,
        },
        verdict: aiResult.verdict,
        eatenPercent: aiResult.eatenPercent,
        pointsDelta,
        newPoints,
      });
    } catch (error) {
      console.error("클린플레이트 업로드 오류:", error);
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") return apiError(res, 400, "FILE_TOO_LARGE", "파일 크기는 5MB 이하여야 합니다.");
      }
      if (error instanceof Error && error.message.includes("이미지")) {
        return apiError(res, 400, "INVALID_FILE_TYPE", error.message);
      }
      return apiError(res, 500, "INTERNAL_ERROR", "업로드에 실패했습니다.");
    }
  });

  // ─── 오늘 클린플레이트 상태 ───────────────────────────────────────
  app.get("/api/cleanplate/today", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const today = new Date().toISOString().split("T")[0];
    const submissions = await storage.getCleanPlatesByUserAndDate(auth.userId, today);
    const count = submissions.length;
    const canSubmit = count < DAILY_LIMIT;

    // 쿨타임 계산: 승인(APPROVED/AUTO_APPROVED) 또는 부정행위(FRAUD) 시에만 적용
    // 잔반으로 인한 일반 반려(REJECTED)는 쿨타임 없음
    let nextSubmitAt: string | null = null;
    if (!canSubmit) {
      nextSubmitAt = null; // 일일 한도 초과 — 오늘 불가
    } else {
      const cooldownTriggers = submissions.filter(
        (s) => s.status === "APPROVED" || s.status === "AUTO_APPROVED" || s.reviewNote?.startsWith("FRAUD")
      );
      if (cooldownTriggers.length > 0) {
        const lastAt = new Date(cooldownTriggers[0].createdAt).getTime();
        const next = lastAt + COOLDOWN_MS;
        if (next > Date.now()) {
          nextSubmitAt = new Date(next).toISOString();
        }
      }
    }

    return apiOk(res, {
      submissions,
      count,
      limit: DAILY_LIMIT,
      canSubmit: canSubmit && nextSubmitAt === null,
      nextSubmitAt,
    });
  });

  // ─── 클린플레이트 히스토리 ────────────────────────────────────────
  app.get("/api/cleanplate/history", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const days = Math.min(parseInt(String(req.query.days ?? "7"), 10) || 7, 30);
    const history = await storage.getCleanPlateHistory(auth.userId, days);

    return apiOk(res, { history });
  });

  // ─── 관리자: PENDING 목록 ─────────────────────────────────────────
  app.get("/api/admin/cleanplate", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // DB에서 role 재검증 (세션 캐시 탈취 방어)
    const user = await storage.getUser(admin.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    if (user.role !== "ADMIN") return apiError(res, 403, "FORBIDDEN", "관리자 권한이 필요합니다.");

    const pending = await storage.getPendingCleanPlates(user.schoolId);

    return apiOk(res, { submissions: pending });
  });

  // ─── 관리자: 승인/거절 ────────────────────────────────────────────
  app.post("/api/admin/cleanplate/:id/review", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // DB에서 role 재검증 (세션 캐시 탈취 방어)
    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser || adminUser.role !== "ADMIN") {
      return apiError(res, 403, "FORBIDDEN", "관리자 권한이 필요합니다.");
    }

    try {
      const id = String(req.params.id);
      const data = adminReviewSchema.parse(req.body);

      if (data.action === "APPROVE") {
        const { submission, newPoints } = await storage.adminApproveCleanPlate(id, admin.userId, data.note ?? null, data.points);
        storage.createAuditLog({ schoolId: adminUser.schoolId, actorUserId: admin.userId, action: "CLEANPLATE_REVIEW", targetType: "cleanplate", targetId: id, meta: { action: "APPROVE", points: data.points } }).catch(() => {});
        return apiOk(res, { submission, newPoints, pointsAwarded: submission.pointsAwarded });
      } else {
        const submission = await storage.adminRejectCleanPlate(id, admin.userId, data.note ?? null);
        storage.createAuditLog({ schoolId: adminUser.schoolId, actorUserId: admin.userId, action: "CLEANPLATE_REVIEW", targetType: "cleanplate", targetId: id, meta: { action: "REJECT" } }).catch(() => {});
        return apiOk(res, { submission });
      }
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      console.error("관리자 리뷰 오류:", error);
      return apiError(res, 500, "INTERNAL_ERROR", "처리에 실패했습니다.");
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // Food Buddy 라우트
  // ─────────────────────────────────────────────────────────────────

  // POST /api/buddy/join — 큐 참가 + 즉시 매칭 시도
  app.post("/api/buddy/join", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    try {
      const data = buddyJoinSchema.parse(req.body);
      const user = await storage.getUser(auth.userId);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");

      const result = await joinQueue(auth.userId, user, data.preference, storage);
      return apiOk(res, result);
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      if (error instanceof Error) return apiError(res, 400, "BUDDY_ERROR", error.message);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // POST /api/buddy/leave — 큐 이탈
  app.post("/api/buddy/leave", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    await leaveQueue(auth.userId, storage);
    return apiOk(res, { message: "큐에서 이탈했습니다." });
  });

  // GET /api/buddy/status — 현재 상태 조회
  app.get("/api/buddy/status", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const activeMatch = await storage.getActiveBuddyMatch(auth.userId);
    if (activeMatch) {
      return apiOk(res, { state: "MATCHED", matchId: activeMatch.id });
    }

    const queue = await storage.getBuddyQueue(auth.userId);
    if (queue) {
      return apiOk(res, { state: "WAITING", preference: queue.preference });
    }

    return apiOk(res, { state: "IDLE" });
  });

  // GET /api/buddy/match/:id — 매칭 상세
  app.get("/api/buddy/match/:id", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const match = await storage.getBuddyMatch(String(req.params.id));
    if (!match) return apiError(res, 404, "NOT_FOUND", "매칭을 찾을 수 없습니다.");
    if (!isParticipant(match, auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const opponentId = getOpponentId(match, auth.userId);
    const consents = await storage.getRevealConsents(match.id);
    const revealed = isRevealComplete(consents, auth.userId, opponentId);

    let opponentDisplay = getAnonymousName(match.userLessId === opponentId ? "LESS" : "MORE");
    if (revealed) {
      const opponent = await storage.getUser(opponentId);
      if (opponent) opponentDisplay = `${opponent.studentNumber}번 학생`;
    }

    // 나의 공개 요청 상태
    const myRevealRequest = consents.find((c) => c.requesterId === auth.userId && c.responderId === opponentId);
    const opponentRevealRequest = consents.find((c) => c.requesterId === opponentId && c.responderId === auth.userId);

    return apiOk(res, {
      match: {
        id: match.id,
        status: match.status,
        myRole: match.userLessId === auth.userId ? "LESS" : "MORE",
        opponentId,
        opponentDisplay,
        revealed,
        pointsAwarded: match.pointsAwarded,
        createdAt: match.createdAt,
        completedAt: match.completedAt,
      },
      revealState: {
        myRequest: myRevealRequest ? { id: myRevealRequest.id, status: myRevealRequest.status } : null,
        theirRequest: opponentRevealRequest ? { id: opponentRevealRequest.id, status: opponentRevealRequest.status } : null,
      },
    });
  });

  // GET /api/buddy/match/:id/messages — 메시지 목록
  app.get("/api/buddy/match/:id/messages", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const match = await storage.getBuddyMatch(String(req.params.id));
    if (!match) return apiError(res, 404, "NOT_FOUND", "매칭을 찾을 수 없습니다.");
    if (!isParticipant(match, auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const messages = await storage.getBuddyMessages(match.id, cursor, 30);
    // 오래된 순으로 정렬해서 반환
    const ordered = [...messages].reverse();

    return apiOk(res, { messages: ordered.map((m) => ({
      id: m.id,
      body: m.body,
      isMine: m.senderId === auth.userId,
      createdAt: m.createdAt,
    })), cursor: messages.length === 30 ? messages[messages.length - 1].id : null });
  });

  // POST /api/buddy/match/:id/messages — 메시지 전송
  app.post("/api/buddy/match/:id/messages", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    try {
      const data = buddyMessageSchema.parse(req.body);

      const match = await storage.getBuddyMatch(String(req.params.id));
      if (!match) return apiError(res, 404, "NOT_FOUND", "매칭을 찾을 수 없습니다.");
      if (!isParticipant(match, auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      if (match.status !== "ACTIVE") return apiError(res, 400, "MATCH_NOT_ACTIVE", "활성 상태의 매칭만 메시지를 보낼 수 있습니다.");

      const opponentId = getOpponentId(match, auth.userId);

      // 차단 체크
      const blocked = await storage.isBlocked(auth.userId, opponentId);
      if (blocked) return apiError(res, 403, "BLOCKED", "차단된 사용자와는 대화할 수 없습니다.");

      // 레이트리밋 체크 (10초 내 3개)
      const recentCount = await storage.getRecentMessageCount(match.id, auth.userId, RATE_LIMIT_WINDOW_MS);
      if (recentCount >= RATE_LIMIT_MAX) {
        return apiError(res, 429, "RATE_LIMITED", "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.");
      }

      // 콘텐츠 필터
      if (filterContent(data.body)) {
        return apiError(res, 400, "CONTENT_FILTERED", "연락처나 외부 채널 관련 내용은 보낼 수 없습니다.");
      }

      const msg = await storage.createBuddyMessage(match.id, auth.userId, data.body);

      // 상대에게 알림
      await storage.createNotification(
        opponentId,
        "BUDDY_MESSAGE",
        "새 메시지가 도착했어요",
        data.body.length > 30 ? data.body.slice(0, 30) + "…" : data.body,
        `/buddy/match/${match.id}`,
      );

      return apiOk(res, { message: { id: msg.id, body: msg.body, isMine: true, createdAt: msg.createdAt } });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "메시지 전송에 실패했습니다.");
    }
  });

  // POST /api/buddy/match/:id/reveal/request — 학번 공개 요청
  app.post("/api/buddy/match/:id/reveal/request", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const match = await storage.getBuddyMatch(String(req.params.id));
    if (!match) return apiError(res, 404, "NOT_FOUND", "매칭을 찾을 수 없습니다.");
    if (!isParticipant(match, auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const opponentId = getOpponentId(match, auth.userId);
    const consent = await storage.requestReveal(match.id, auth.userId, opponentId);

    await storage.createNotification(
      opponentId,
      "REVEAL_REQUEST",
      "학번 공개 요청이 왔어요",
      "상대방이 학번을 서로 공개하자고 요청했어요. 동의하시겠어요?",
      `/buddy/match/${match.id}`,
    );

    return apiOk(res, { consent: { id: consent.id, status: consent.status } });
  });

  // POST /api/buddy/match/:id/reveal/respond — 학번 공개 응답
  app.post("/api/buddy/match/:id/reveal/respond", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    try {
      const data = revealRespondSchema.parse(req.body);
      const consentId = typeof req.body.consentId === "string" ? req.body.consentId : "";
      if (!consentId) return apiError(res, 400, "MISSING_CONSENT_ID", "consentId가 필요합니다.");

      const match = await storage.getBuddyMatch(String(req.params.id));
      if (!match) return apiError(res, 404, "NOT_FOUND", "매칭을 찾을 수 없습니다.");
      if (!isParticipant(match, auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

      const consent = await storage.respondReveal(consentId, auth.userId, data.action);

      if (data.action === "ACCEPT") {
        const opponentId = getOpponentId(match, auth.userId);
        await storage.createNotification(
          opponentId,
          "REVEAL_ACCEPTED",
          "학번 공개 요청이 수락됐어요",
          "상대방이 동의했어요. 서로 학번을 확인해보세요.",
          `/buddy/match/${match.id}`,
        );
      }

      return apiOk(res, { consent: { id: consent.id, status: consent.status } });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "처리에 실패했습니다.");
    }
  });

  // POST /api/buddy/match/:id/complete — 매칭 완료
  app.post("/api/buddy/match/:id/complete", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const match = await storage.getBuddyMatch(String(req.params.id));
    if (!match) return apiError(res, 404, "NOT_FOUND", "매칭을 찾을 수 없습니다.");
    if (!isParticipant(match, auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
    if (match.status !== "ACTIVE") return apiError(res, 400, "ALREADY_COMPLETED", "이미 완료된 매칭입니다.");

    const { match: completed, pointsEach } = await storage.completeBuddyMatch(match.id);

    const opponentId = getOpponentId(match, auth.userId);
    await storage.createNotification(
      opponentId,
      "BUDDY_COMPLETE",
      "Food Buddy 매칭 완료!",
      `매칭이 완료됐어요. ${pointsEach}P를 획득했습니다.`,
      `/buddy/match/${match.id}`,
    );
    await storage.createNotification(
      auth.userId,
      "BUDDY_COMPLETE",
      "Food Buddy 매칭 완료!",
      `매칭이 완료됐어요. ${pointsEach}P를 획득했습니다.`,
      `/buddy/match/${match.id}`,
    );

    return apiOk(res, { status: completed.status, pointsEach });
  });

  // ─── 알림 ────────────────────────────────────────────────────────

  // GET /api/notifications
  app.get("/api/notifications", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const [notifs, unreadCount] = await Promise.all([
      storage.getUserNotifications(auth.userId, cursor),
      storage.getUnreadNotificationCount(auth.userId),
    ]);

    return apiOk(res, { notifications: notifs, unreadCount });
  });

  // POST /api/notifications/read
  app.post("/api/notifications/read", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const ids = Array.isArray(req.body.ids) ? req.body.ids as string[] : undefined;
    await storage.markNotificationsRead(auth.userId, ids);
    return apiOk(res, { message: "읽음 처리 완료" });
  });

  // ─── 차단 ────────────────────────────────────────────────────────

  // POST /api/block
  app.post("/api/block", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    try {
      const data = blockSchema.parse(req.body);
      if (data.blockedUserId === auth.userId) {
        return apiError(res, 400, "CANNOT_BLOCK_SELF", "자기 자신을 차단할 수 없습니다.");
      }

      await storage.blockUser(auth.userId, data.blockedUserId);

      // 관련 매칭이 있으면 취소
      const activeMatch = await storage.getActiveBuddyMatch(auth.userId);
      if (activeMatch) {
        const opponentId = getOpponentId(activeMatch, auth.userId);
        if (opponentId === data.blockedUserId) {
          await storage.cancelBuddyMatch(activeMatch.id);
        }
      }

      return apiOk(res, { message: "차단 완료" });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "처리에 실패했습니다.");
    }
  });

  // ─── 신고 ────────────────────────────────────────────────────────

  // POST /api/report
  app.post("/api/report", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    try {
      const data = reportSchema.parse(req.body);
      if (data.reportedUserId === auth.userId) {
        return apiError(res, 400, "CANNOT_REPORT_SELF", "자기 자신을 신고할 수 없습니다.");
      }

      const report = await storage.createReport({
        reporterId: auth.userId,
        reportedUserId: data.reportedUserId,
        matchId: data.matchId,
        messageId: data.messageId,
        reason: data.reason,
        detail: data.detail,
      });

      // 같은 학교 관리자에게 알림 (구현 단순화: 모든 알림을 system으로)
      return apiOk(res, { reportId: report.id, message: "신고가 접수됐습니다." });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "처리에 실패했습니다.");
    }
  });

  // ─── 관리자: 신고 모더레이션 ──────────────────────────────────────

  // GET /api/admin/reports
  app.get("/api/admin/reports", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser || adminUser.role !== "ADMIN") {
      return apiError(res, 403, "FORBIDDEN", "관리자 권한이 필요합니다.");
    }

    const reports = await storage.getOpenReports(adminUser.schoolId);
    return apiOk(res, { reports });
  });

  // POST /api/admin/reports/:id/action
  app.post("/api/admin/reports/:id/action", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser || adminUser.role !== "ADMIN") {
      return apiError(res, 403, "FORBIDDEN", "관리자 권한이 필요합니다.");
    }

    try {
      const data = adminActionSchema.parse(req.body);
      const modAction = await storage.adminActOnReport(
        String(req.params.id),
        admin.userId,
        data.action,
        data.note,
        data.targetUserId,
      );

      await storage.createNotification(
        data.targetUserId,
        "REPORT_REVIEWED",
        "신고 처리 결과",
        `신고에 대한 검토가 완료됐습니다. (${data.action})`,
      );

      storage.createAuditLog({ schoolId: adminUser.schoolId, actorUserId: admin.userId, action: "MODERATION_ACTION", targetType: "report", targetId: String(req.params.id), meta: { action: data.action, targetUserId: data.targetUserId } }).catch(() => {});
      return apiOk(res, { action: modAction });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "처리에 실패했습니다.");
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // 반 대항전 라우트
  // ─────────────────────────────────────────────────────────────────

  // GET /api/class-battle?month=YYYY-MM — 반 대항전 순위
  app.get("/api/class-battle", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");

    const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : new Date().toISOString().slice(0, 7); // YYYY-MM

    try {
      const standings = await storage.getClassBattleStandings(user.schoolId, user.grade, month);
      const awards = await storage.getClassBattleAwards(user.schoolId, user.grade);
      const thisMonthAward = awards.find((a) => a.month === month) ?? null;

      const standingsWithMe = standings.map((s, i) => ({
        ...s,
        rank: i + 1,
        isMyClass: s.classNum === user.classNum,
      }));

      return apiOk(res, {
        month,
        grade: user.grade,
        myClassNum: user.classNum,
        standings: standingsWithMe,
        monthAward: thisMonthAward,
        recentAwards: awards.slice(0, 6),
      });
    } catch (error) {
      return apiError(res, 500, "INTERNAL_ERROR", "순위 조회에 실패했습니다.");
    }
  });

  // POST /api/admin/class-battle/award — 관리자: 반 대항전 우승 포인트 지급
  app.post("/api/admin/class-battle/award", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser || adminUser.role !== "ADMIN") {
      return apiError(res, 403, "FORBIDDEN", "관리자 권한이 필요합니다.");
    }

    try {
      const data = classBattleAwardSchema.parse(req.body);
      const award = await storage.awardClassBattleBonus(
        adminUser.schoolId,
        data.grade,
        data.month,
        admin.userId,
        data.bonusPoints,
      );
      return apiOk(res, { award });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      const msg = error instanceof Error ? error.message : "처리에 실패했습니다.";
      if (msg.includes("참여 기록")) return apiError(res, 400, "NO_DATA", msg);
      if (msg.includes("이미")) return apiError(res, 409, "ALREADY_AWARDED", msg);
      return apiError(res, 500, "INTERNAL_ERROR", msg);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 포인트 스토어 — 학생 라우트
  // ═══════════════════════════════════════════════════════

  // GET /api/store/items — 내 학교 활성 상품 목록
  app.get("/api/store/items", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "UNAUTHORIZED", "사용자를 찾을 수 없습니다.");
    const items = await storage.getStoreItems(user.schoolId);
    return apiOk(res, { items });
  });

  // POST /api/store/redeem — 포인트 교환 신청
  app.post("/api/store/redeem", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    if (!checkRedeemRateLimit(auth.userId)) {
      return apiError(res, 429, "RATE_LIMIT", "잠시 후 다시 시도해 주세요. (10초에 최대 3회)");
    }
    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "UNAUTHORIZED", "사용자를 찾을 수 없습니다.");
    try {
      const { itemId, quantity } = storeRedeemSchema.parse(req.body);
      const { redemption, newPoints } = await storage.redeemItem(auth.userId, user.schoolId, itemId, quantity);
      return apiOk(res, { redemptionId: redemption.id, newPoints, status: redemption.status });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      const msg = error instanceof Error ? error.message : "교환에 실패했습니다.";
      const code = msg.includes("부족") ? "INSUFFICIENT" : msg.includes("재고") ? "OUT_OF_STOCK" : msg.includes("한도") ? "LIMIT_EXCEEDED" : "INTERNAL_ERROR";
      return apiError(res, 400, code, msg);
    }
  });

  // GET /api/store/me/redemptions — 내 교환 내역
  app.get("/api/store/me/redemptions", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const redemptions = await storage.getUserRedemptions(auth.userId);
    return apiOk(res, { redemptions });
  });

  // ═══════════════════════════════════════════════════════
  // 포인트 스토어 — 관리자 라우트
  // ═══════════════════════════════════════════════════════

  // GET /api/admin/store/items — 내 학교 전체 상품(비활성 포함)
  app.get("/api/admin/store/items", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser) return apiError(res, 401, "UNAUTHORIZED", "관리자를 찾을 수 없습니다.");
    const items = await storage.getStoreItems(adminUser.schoolId, true);
    return apiOk(res, { items });
  });

  // POST /api/admin/store/items — 상품 등록
  app.post("/api/admin/store/items", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser) return apiError(res, 401, "UNAUTHORIZED", "관리자를 찾을 수 없습니다.");
    try {
      const data = storeItemCreateSchema.parse(req.body);
      const item = await storage.createStoreItem({
        ...data,
        schoolId: adminUser.schoolId,
        createdByUserId: admin.userId,
      });
      storage.createAuditLog({ schoolId: adminUser.schoolId, actorUserId: admin.userId, action: "STORE_ITEM_CREATE", targetType: "store_item", targetId: item.id, meta: { name: item.name } }).catch(() => {});
      return apiOk(res, { item });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "상품 등록에 실패했습니다.");
    }
  });

  // PATCH /api/admin/store/items/:id — 상품 수정
  app.patch("/api/admin/store/items/:id", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser) return apiError(res, 401, "UNAUTHORIZED", "관리자를 찾을 수 없습니다.");
    try {
      const itemId = String(req.params.id);
      const existing = await storage.getStoreItem(itemId);
      if (!existing || existing.schoolId !== adminUser.schoolId) return apiError(res, 404, "NOT_FOUND", "상품을 찾을 수 없습니다.");
      const data = storeItemUpdateSchema.parse(req.body);
      const item = await storage.updateStoreItem(itemId, data);
      storage.createAuditLog({ schoolId: adminUser.schoolId, actorUserId: admin.userId, action: "STORE_ITEM_UPDATE", targetType: "store_item", targetId: item.id, meta: data }).catch(() => {});
      return apiOk(res, { item });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "상품 수정에 실패했습니다.");
    }
  });

  // DELETE /api/admin/store/items/:id — 상품 비활성화
  app.delete("/api/admin/store/items/:id", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser) return apiError(res, 401, "UNAUTHORIZED", "관리자를 찾을 수 없습니다.");
    const itemId = String(req.params.id);
    const existing = await storage.getStoreItem(itemId);
    if (!existing || existing.schoolId !== adminUser.schoolId) return apiError(res, 404, "NOT_FOUND", "상품을 찾을 수 없습니다.");
    const item = await storage.updateStoreItem(itemId, { isActive: false });
    storage.createAuditLog({ schoolId: adminUser.schoolId, actorUserId: admin.userId, action: "STORE_ITEM_DEACTIVATE", targetType: "store_item", targetId: item.id, meta: { name: item.name } }).catch(() => {});
    return apiOk(res, { item });
  });

  // GET /api/admin/store/redemptions — 교환 요청 목록
  app.get("/api/admin/store/redemptions", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser) return apiError(res, 401, "UNAUTHORIZED", "관리자를 찾을 수 없습니다.");
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const redemptions = await storage.getSchoolRedemptions(adminUser.schoolId, status);
    return apiOk(res, { redemptions });
  });

  // POST /api/admin/store/redemptions/:id/process — 교환 요청 처리
  app.post("/api/admin/store/redemptions/:id/process", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const adminUser = await storage.getUser(admin.userId);
    if (!adminUser) return apiError(res, 401, "UNAUTHORIZED", "관리자를 찾을 수 없습니다.");
    try {
      const { status, adminNote } = redemptionProcessSchema.parse(req.body);
      const redemption = await storage.processRedemption(String(req.params.id), admin.userId, status, adminNote);
      if (!redemption) return apiError(res, 404, "NOT_FOUND", "교환 요청을 찾을 수 없습니다.");

      // 승인/수령 준비 시 학생에게 알림
      if (status === "APPROVED" || status === "READY") {
        const statusLabel = status === "APPROVED" ? "승인" : "수령 준비";
        await storage.createNotification(
          redemption.userId, "STORE_APPROVED",
          "포인트 교환 " + statusLabel,
          "교환 요청이 " + statusLabel + "되었습니다.",
          "/store",
        ).catch(() => {});
      }
      storage.createAuditLog({ schoolId: adminUser.schoolId, actorUserId: admin.userId, action: "REDEMPTION_PROCESS", targetType: "redemption", targetId: redemption.id, meta: { status, adminNote } }).catch(() => {});
      return apiOk(res, { redemption });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      const message = error instanceof Error ? error.message : "처리에 실패했습니다.";
      return apiError(res, 400, "PROCESS_ERROR", message);
    }
  });

  return httpServer;
}
