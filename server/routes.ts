import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { db } from "./db";
import { schools } from "./schema";
import { eq } from "drizzle-orm";
import {
  signupSchema, loginSchema, feedbackSchema, adminReviewSchema,
  buddyJoinSchema, buddyMessageSchema, revealRespondSchema,
  reportSchema, adminActionSchema, classBattleAwardSchema,
  storeItemCreateSchema, storeItemUpdateSchema, storeRedeemSchema, redemptionProcessSchema,
} from "./schema";
import { searchSchoolsByName, fetchMealByDate } from "./neis";
import { analyzeCleanPlate, generateMealImage } from "./dashscope";
import { refreshSingleSchool } from "./scheduler";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { z, ZodError } from "zod";
import multer from "multer";
import path from "path";
import express from "express";
import crypto from "crypto";

const DAILY_LIMIT = 2;
const COOLDOWN_MS = 30 * 60 * 1000;

const idempotencyCache = new Map<string, { status: number; body: unknown; expiresAt: number }>();

function checkIdempotency(req: Request, res: Response): boolean {
  const key = req.headers["x-idempotency-key"] as string | undefined;
  if (!key) return false;
  const cached = idempotencyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    res.status(cached.status).json(cached.body);
    return true;
  }
  return false;
}

function saveIdempotency(req: Request, status: number, body: unknown): void {
  const key = req.headers["x-idempotency-key"] as string | undefined;
  if (!key) return;
  idempotencyCache.set(key, { status, body, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  if (idempotencyCache.size > 10000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache) {
      if (v.expiresAt < now) idempotencyCache.delete(k);
    }
  }
}

function getTodayKST(): string {
  return new Date(Date.now() + 9 * 3600000).toISOString().split("T")[0];
}

function createIpHash(ip: string): string {
  const salt = process.env.SESSION_SECRET || "ip-hash-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

const deviceRegisterSchema = z.object({
  installId: z.string().min(1),
  platform: z.string().optional(),
  appVersion: z.string().optional(),
  deviceModel: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "USER" | "ADMIN";
  }
}

function apiError(res: Response, status: number, code: string, message: string, meta?: object) {
  return res.status(status).json({ ok: false, error: { code, message, ...meta } });
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("이미지 파일(JPEG, PNG, WEBP)만 업로드 가능합니다."));
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const PgStore = connectPgSimple(session);

  app.use(session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  }));

  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // ─── 학교 검색 (NEIS) ─────────────────────────────────────────────
  app.get("/api/schools/search", async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 1) return apiOk(res, { results: [] });
    try {
      const results = await searchSchoolsByName(q);
      return apiOk(res, { results: results.slice(0, 10) });
    } catch (err) {
      return apiError(res, 500, "SEARCH_FAILED", "학교 검색에 실패했습니다.");
    }
  });

  // ─── 회원가입 ──────────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const data = signupSchema.parse(req.body);
      const school = await storage.upsertSchool({ name: data.schoolName, officeCode: data.officeCode, schoolCode: data.schoolCode, address: "" });
      const existing = await storage.getUserByCredentials(school.id, data.grade, data.classNum, data.studentNumber);
      if (existing) return apiError(res, 409, "USER_EXISTS", "이미 등록된 학생 정보입니다.");
      const user = await storage.createUser({ schoolId: school.id, grade: data.grade, classNum: data.classNum, studentNumber: data.studentNumber, heightCm: data.heightCm ?? null, weightKg: data.weightKg ?? null, allergies: data.allergies ?? null, points: 0 });
      req.session.userId = user.id;
      req.session.role = user.role;
      const installId = req.headers["x-install-id"] as string | undefined;
      if (installId) {
        storage.bindDeviceToUser(installId, user.id).catch(() => {});
        const device = await storage.getDeviceByInstallId(installId);
        if (device) storage.createSessionEvent({ deviceId: device.id, userId: user.id, schoolId: school.id, eventType: "SIGNUP", ipHash: createIpHash(getClientIp(req)), userAgent: req.headers["user-agent"] ?? null, requestId: crypto.randomUUID() }).catch(() => {});
      }
      const today = getTodayKST();
      storage.getMealCache(school.id, today).then((cached) => {
        if (!cached || !cached.menuText) {
          console.log(`[Signup] 신규 학교 급식 즉시 로드 트리거: ${school.name}`);
          refreshSingleSchool(school, today).catch((e) => console.error(`[Signup] 급식 로드 오류 (${school.name}):`, e));
        }
      }).catch(() => {});
      return res.status(201).json({ ok: true, user: { id: user.id, schoolName: school.name, grade: user.grade, classNum: user.classNum, studentNumber: user.studentNumber, points: user.points, role: user.role } });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      console.error("회원가입 오류:", error);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 로그인 ────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const data = loginSchema.parse(req.body);
      const school = await storage.getSchoolByCode(data.officeCode, data.schoolCode);
      if (!school) return apiError(res, 401, "SCHOOL_NOT_FOUND", "등록된 학교를 찾을 수 없습니다. 회원가입을 먼저 해주세요.");
      const user = await storage.getUserByCredentials(school.id, data.grade, data.classNum, data.studentNumber);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "해당 학생 정보를 찾을 수 없습니다.");
      req.session.userId = user.id;
      req.session.role = user.role;
      const installId = req.headers["x-install-id"] as string | undefined;
      if (installId) {
        storage.bindDeviceToUser(installId, user.id).catch(() => {});
        const device = await storage.getDeviceByInstallId(installId);
        if (device) storage.createSessionEvent({ deviceId: device.id, userId: user.id, schoolId: school.id, eventType: "LOGIN", ipHash: createIpHash(getClientIp(req)), userAgent: req.headers["user-agent"] ?? null, requestId: crypto.randomUUID() }).catch(() => {});
      }
      return apiOk(res, { user: { id: user.id, schoolName: school.name, grade: user.grade, classNum: user.classNum, studentNumber: user.studentNumber, points: user.points, role: user.role } });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 로그아웃 ──────────────────────────────────────────────────────
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const installId = req.headers["x-install-id"] as string | undefined;
    const userId = req.session.userId;
    if (installId) {
      const device = await storage.getDeviceByInstallId(installId);
      if (device) {
        storage.createSessionEvent({ deviceId: device.id, userId: userId ?? undefined, eventType: "LOGOUT", ipHash: createIpHash(getClientIp(req)), userAgent: req.headers["user-agent"] ?? null, requestId: crypto.randomUUID() }).catch(() => {});
      }
      await storage.unbindDevice(installId);
    }
    req.session.destroy((err) => {
      if (err) return apiError(res, 500, "LOGOUT_FAILED", "로그아웃에 실패했습니다.");
      res.clearCookie("connect.sid");
      return apiOk(res, { message: "로그아웃 완료" });
    });
  });

  // ─── 내 정보 ───────────────────────────────────────────────────────
  app.get("/api/me", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));
    return apiOk(res, { user: { id: user.id, schoolId: user.schoolId, schoolName: school?.name ?? "", officeCode: school?.officeCode ?? "", schoolCode: school?.schoolCode ?? "", grade: user.grade, classNum: user.classNum, studentNumber: user.studentNumber, heightCm: user.heightCm, weightKg: user.weightKg, allergies: user.allergies ?? [], points: user.points, role: user.role } });
  });

  // ─── 디바이스 등록 ────────────────────────────────────────────────
  app.post("/api/device/register", async (req: Request, res: Response) => {
    try {
      const data = deviceRegisterSchema.parse(req.body);
      const device = await storage.upsertDevice(data.installId, {
        platform: data.platform,
        appVersion: data.appVersion,
        deviceModel: data.deviceModel,
        locale: data.locale,
        timezone: data.timezone,
      });

      const ipHash = createIpHash(getClientIp(req));
      storage.createSessionEvent({
        deviceId: device.id,
        userId: device.userId ?? undefined,
        eventType: "APP_OPEN",
        ipHash,
        userAgent: req.headers["user-agent"] ?? null,
        requestId: crypto.randomUUID(),
      }).catch(() => {});

      return apiOk(res, {
        deviceId: device.id,
        boundUserId: device.userId ?? null,
      });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      console.error("[device/register] 오류:", error);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 세션 재개 ──────────────────────────────────────────────────
  app.get("/api/session/resume", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    const installId = req.headers["x-install-id"] as string | undefined;

    try {
      const device = installId ? await storage.getDeviceByInstallId(installId) : null;

      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));
          if (device && installId && device.userId !== user.id) {
            await storage.bindDeviceToUser(installId, user.id);
          }

          if (device) {
            storage.createSessionEvent({
              deviceId: device.id,
              userId: user.id,
              schoolId: user.schoolId,
              eventType: "SESSION_RESUME",
              ipHash: createIpHash(getClientIp(req)),
              userAgent: req.headers["user-agent"] ?? null,
              requestId: crypto.randomUUID(),
            }).catch(() => {});
          }

          return apiOk(res, {
            status: "authenticated",
            user: { id: user.id, schoolId: user.schoolId, schoolName: school?.name ?? "", officeCode: school?.officeCode ?? "", schoolCode: school?.schoolCode ?? "", grade: user.grade, classNum: user.classNum, studentNumber: user.studentNumber, heightCm: user.heightCm, weightKg: user.weightKg, allergies: user.allergies ?? [], points: user.points, role: user.role },
          });
        }
      }

      if (!device) return apiOk(res, { status: "guest", user: null });

      if (device.userId) {
        const user = await storage.getUser(device.userId);
        if (user) {
          req.session.userId = user.id;
          req.session.role = user.role;
          const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));

          storage.createSessionEvent({
            deviceId: device.id,
            userId: user.id,
            schoolId: user.schoolId,
            eventType: "SESSION_RESUME",
            ipHash: createIpHash(getClientIp(req)),
            userAgent: req.headers["user-agent"] ?? null,
            requestId: crypto.randomUUID(),
          }).catch(() => {});

          return apiOk(res, {
            status: "authenticated",
            user: { id: user.id, schoolId: user.schoolId, schoolName: school?.name ?? "", officeCode: school?.officeCode ?? "", schoolCode: school?.schoolCode ?? "", grade: user.grade, classNum: user.classNum, studentNumber: user.studentNumber, heightCm: user.heightCm, weightKg: user.weightKg, allergies: user.allergies ?? [], points: user.points, role: user.role },
          });
        }
      }

      return apiOk(res, { status: "guest", user: null });
    } catch (error) {
      console.error("[session/resume] 오류:", error);
      return apiOk(res, { status: "guest", user: null });
    }
  });

  // 이미지 생성 중복 방지: schoolId+dateStr 조합으로 진행 중인 작업 추적
  const pendingImageGen = new Set<string>();

  // ─── 오늘 급식 (NEIS) ─────────────────────────────────────────────
  app.get("/api/meals/today", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));
    if (!school) return apiError(res, 404, "SCHOOL_NOT_FOUND", "학교 정보를 찾을 수 없습니다.");

    const today = getTodayKST();
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

    const genKey = `${user.schoolId}:${today}`;
    if (cached && !cached.mealImageUrl && menuText && !pendingImageGen.has(genKey)) {
      const freshCache = await storage.getMealCache(user.schoolId, today);
      if (freshCache && !freshCache.mealImageUrl) {
        const schoolId = user.schoolId;
        const dateStr = today;
        pendingImageGen.add(genKey);
        console.log(`[routes] 이미지 생성 트리거 (학교: ${school.name}, ${genKey})`);
        generateMealImage(menuText)
          .then(async (imageUrl) => {
            pendingImageGen.delete(genKey);
            if (imageUrl) {
              await storage.updateMealImageUrl(schoolId, dateStr, imageUrl);
              console.log(`[routes] 이미지 DB 저장 완료: ${imageUrl}`);
            }
          })
          .catch((e) => {
            pendingImageGen.delete(genKey);
            console.error("[routes] 이미지 생성 오류:", e);
          });
      }
    }

    const myFeedback = await storage.getUserFeedbackForDate(auth.userId, today);
    return apiOk(res, { date: today, menuText, source, mealImageUrl: cached?.mealImageUrl ?? null, myRating: myFeedback?.rating ?? null });
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
      if (existing) return apiError(res, 409, "ALREADY_SUBMITTED", "오늘 급식 평가는 이미 제출했습니다.");
      const { feedback, newPoints } = await storage.createFeedbackWithPoints(user.id, user.schoolId, data.date, data.rating, data.comment ?? null);
      return apiOk(res, { feedbackId: feedback.id, newPoints });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
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
      const ranking = rows.map((r, i) => ({ rank: i + 1, label: `${r.studentNumber}번`, points: r.points, isMe: r.studentNumber === user.studentNumber }));
      return apiOk(res, { scope, myPoints: user.points, ranking });
    } else {
      const rows = await storage.getSchoolRanking(user.schoolId);
      const ranking = rows.map((r, i) => ({ rank: i + 1, label: `${r.grade}학년 ${r.classNum}반 ${r.studentNumber}번`, points: r.points, isMe: r.grade === user.grade && r.classNum === user.classNum && r.studentNumber === user.studentNumber }));
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
        ? req.body.date : getTodayKST();

      const todaySubmissions = await storage.getCleanPlatesByUserAndDate(user.id, date);
      if (todaySubmissions.length >= DAILY_LIMIT) {
        return apiError(res, 429, "DAILY_LIMIT_REACHED", `오늘 인증 횟수(${DAILY_LIMIT}회)를 모두 사용했습니다.`);
      }

      const imageHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
      const duplicate = todaySubmissions.find((s) => s.imageHash === imageHash);
      if (duplicate) {
        await storage.createFraudCleanPlate({ userId: user.id, schoolId: user.schoolId, date, imageUrl: duplicate.imageUrl, imageKey: duplicate.imageKey ?? "", imageHash });
        return apiError(res, 409, "DUPLICATE_IMAGE", "동일한 사진이 감지됐습니다. 부정행위로 간주됩니다.");
      }

      const cooldownTriggers = todaySubmissions.filter((s) => s.status === "APPROVED" || s.status === "AUTO_APPROVED");
      if (cooldownTriggers.length > 0) {
        const lastAt = new Date(cooldownTriggers[0].createdAt).getTime();
        const elapsed = Date.now() - lastAt;
        if (elapsed < COOLDOWN_MS) {
          return apiError(res, 429, "COOLDOWN_REQUIRED", `다음 인증은 ${Math.ceil((COOLDOWN_MS - elapsed) / 60000)}분 후에 가능합니다.`);
        }
      }

      // 로컬 파일 저장 (임시)
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      const { mkdirSync, writeFileSync } = await import("fs");
      mkdirSync(uploadsDir, { recursive: true });
      const filename = `${crypto.randomUUID()}-${Date.now()}.jpg`;
      const filePath = path.join(uploadsDir, filename);
      writeFileSync(filePath, req.file.buffer);
      const imageUrl = `/uploads/${filename}`;
      const imageKey = `uploads/${filename}`;

      const submission = await storage.createCleanPlate({ userId: user.id, schoolId: user.schoolId, date, imageUrl, imageKey, imageHash });

      // 급식 메뉴 텍스트 조회 (Qwen-VL 프롬프트용)
      const mealCache = await storage.getMealCache(user.schoolId, date);
      const menuText = mealCache?.menuText ?? "정보 없음";

      // Qwen-VL로 식판 사진 AI 분석
      const analysis = await analyzeCleanPlate(req.file.buffer, menuText);
      const aiResultPayload = { verdict: analysis.verdict, detail: analysis.detail };
      const eatenPercent = Math.round(analysis.score * 100);

      let finalStatus: string;
      let newPoints: number;
      let pointsAwarded: number;

      if (analysis.verdict === "NOT_CLEAN") {
        const rejected = await storage.rejectCleanPlate(submission.id, analysis.score, aiResultPayload);
        finalStatus = rejected.status;
        pointsAwarded = 0;
        newPoints = (await storage.getUser(user.id))?.points ?? user.points;
      } else {
        const approved = await storage.autoApproveCleanPlate(
          submission.id,
          analysis.score,
          aiResultPayload,
          analysis.pointsAwarded
        );
        finalStatus = approved.submission.status;
        pointsAwarded = approved.submission.pointsAwarded ?? analysis.pointsAwarded;
        newPoints = approved.newPoints;
      }

      return apiOk(res, {
        submission: {
          id: submission.id, status: finalStatus, imageUrl: submission.imageUrl,
          date: submission.date, aiScore: analysis.score, pointsAwarded,
        },
        verdict: analysis.verdict === "NOT_CLEAN" ? "REJECT" : "APPROVE",
        eatenPercent,
        pointsDelta: pointsAwarded,
        newPoints,
        detail: analysis.detail,
      });
    } catch (error) {
      console.error("클린플레이트 업로드 오류:", error);
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return apiError(res, 400, "FILE_TOO_LARGE", "파일 크기는 5MB 이하여야 합니다.");
      }
      return apiError(res, 500, "INTERNAL_ERROR", "업로드에 실패했습니다.");
    }
  });

  // ─── 클린플레이트 오늘 현황 ──────────────────────────────────────
  app.get("/api/cleanplate/today", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const today = getTodayKST();
    const submissions = await storage.getCleanPlatesByUserAndDate(auth.userId, today);
    const count = submissions.length;
    const canSubmit = count < DAILY_LIMIT;
    const approvedSubs = submissions.filter((s) => s.status === "APPROVED" || s.status === "AUTO_APPROVED");
    let nextSubmitAt: string | null = null;
    if (!canSubmit && approvedSubs.length > 0) {
      const lastAt = new Date(approvedSubs[0].createdAt).getTime();
      const nextAt = lastAt + COOLDOWN_MS;
      if (nextAt > Date.now()) nextSubmitAt = new Date(nextAt).toISOString();
    }
    return apiOk(res, { submissions, count, limit: DAILY_LIMIT, canSubmit, nextSubmitAt });
  });

  // ─── 클린플레이트 이력 ────────────────────────────────────────────
  app.get("/api/cleanplate/history", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const days = parseInt(String(req.query.days ?? "30"), 10);
    const submissions = await storage.getCleanPlateHistory(auth.userId, days);
    return apiOk(res, { submissions });
  });

  // ─── Food Buddy ────────────────────────────────────────────────────
  app.get("/api/buddy/status", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const queue = await storage.getBuddyQueue(auth.userId);
    const activeMatch = await storage.getActiveMatchForUser(auth.userId);
    return apiOk(res, { inQueue: !!queue, queuePreference: queue?.preference ?? null, activeMatchId: activeMatch?.id ?? null });
  });

  app.post("/api/buddy/join", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    try {
      const { preference } = buddyJoinSchema.parse(req.body);
      const user = await storage.getUser(auth.userId);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
      const queue = await storage.joinBuddyQueue(auth.userId, user.schoolId, user.grade, user.classNum, preference);
      const match = await storage.tryMatch(user.schoolId, user.grade);
      if (match) {
        const opponentId = match.userLessId === auth.userId ? match.userMoreId : match.userLessId;
        const opponent = await storage.getUser(opponentId);
        await storage.createNotification(auth.userId, "BUDDY_MATCHED", "버디 매칭 완료!", `${opponent?.grade}학년 학생과 매칭되었습니다.`);
        await storage.createNotification(opponentId, "BUDDY_MATCHED", "버디 매칭 완료!", `${user.grade}학년 학생과 매칭되었습니다.`);
        return apiOk(res, { matched: true, matchId: match.id });
      }
      return apiOk(res, { matched: false, queueId: queue.id });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  app.post("/api/buddy/leave", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    await storage.leaveBuddyQueue(auth.userId);
    return apiOk(res, { left: true });
  });

  app.get("/api/buddy/match/:id", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const match = await storage.getBuddyMatch(req.params.id);
    if (!match) return apiError(res, 404, "NOT_FOUND", "매치를 찾을 수 없습니다.");
    if (match.userLessId !== auth.userId && match.userMoreId !== auth.userId) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
    const myRole = match.userLessId === auth.userId ? "LESS" : "MORE";
    const opponentId = myRole === "LESS" ? match.userMoreId : match.userLessId;
    const opponent = await storage.getUser(opponentId);
    const consents = await storage.getRevealConsents(match.id);
    const myConsent = consents.find(c => c.requesterId === auth.userId);
    const theirConsent = consents.find(c => c.requesterId === opponentId);
    const revealed = myConsent?.status === "ACCEPTED" && theirConsent?.status === "ACCEPTED";
    return apiOk(res, {
      match: { id: match.id, status: match.status, myRole, opponentId, opponentDisplay: `${opponent?.grade ?? "?"}학년 버디`, revealed, pointsAwarded: match.pointsAwarded, createdAt: match.createdAt, completedAt: match.completedAt },
      revealState: { myRequest: myConsent ?? null, theirRequest: theirConsent ?? null },
    });
  });

  app.get("/api/buddy/match/:id/messages", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const match = await storage.getBuddyMatch(req.params.id);
    if (!match || (match.userLessId !== auth.userId && match.userMoreId !== auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
    const msgs = await storage.getBuddyMessages(match.id);
    const messages = msgs.map(m => ({ id: m.id, body: m.body, isMine: m.senderId === auth.userId, createdAt: m.createdAt }));
    return apiOk(res, { messages, cursor: null });
  });

  app.post("/api/buddy/match/:id/messages", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    try {
      const { body } = buddyMessageSchema.parse(req.body);
      const match = await storage.getBuddyMatch(req.params.id);
      if (!match || (match.userLessId !== auth.userId && match.userMoreId !== auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      if (match.status !== "ACTIVE") return apiError(res, 400, "MATCH_INACTIVE", "종료된 매치입니다.");
      const msg = await storage.createBuddyMessage(match.id, auth.userId, body);
      const opponentId = match.userLessId === auth.userId ? match.userMoreId : match.userLessId;
      await storage.createNotification(opponentId, "BUDDY_MESSAGE", "버디 메시지", body.slice(0, 50));
      return apiOk(res, { message: { id: msg.id, body: msg.body, isMine: true, createdAt: msg.createdAt } });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  app.post("/api/buddy/match/:id/reveal/request", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const match = await storage.getBuddyMatch(req.params.id);
    if (!match || (match.userLessId !== auth.userId && match.userMoreId !== auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
    const opponentId = match.userLessId === auth.userId ? match.userMoreId : match.userLessId;
    const consent = await storage.requestReveal(match.id, auth.userId, opponentId);
    await storage.createNotification(opponentId, "REVEAL_REQUEST", "학번 공개 요청", "버디가 학번 공개를 요청했습니다.");
    return apiOk(res, { consent });
  });

  app.post("/api/buddy/match/:id/reveal/respond", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    try {
      const { accept } = revealRespondSchema.parse(req.body);
      const match = await storage.getBuddyMatch(req.params.id);
      if (!match) return apiError(res, 404, "NOT_FOUND", "매치를 찾을 수 없습니다.");
      const consents = await storage.getRevealConsents(match.id);
      const theirRequest = consents.find(c => c.targetId === auth.userId && c.status === "PENDING");
      if (!theirRequest) return apiError(res, 404, "NOT_FOUND", "공개 요청을 찾을 수 없습니다.");
      await storage.respondReveal(theirRequest.id, accept);
      return apiOk(res, { accepted: accept });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  app.post("/api/buddy/match/:id/complete", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const match = await storage.getBuddyMatch(req.params.id);
    if (!match || (match.userLessId !== auth.userId && match.userMoreId !== auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
    if (match.status !== "ACTIVE") return apiError(res, 400, "ALREADY_DONE", "이미 종료된 매치입니다.");
    const { match: completed, pointsEach } = await storage.completeMatch(match.id);
    for (const uid of [match.userLessId, match.userMoreId]) {
      await storage.createNotification(uid, "BUDDY_COMPLETE", "버디 매칭 완료!", `${pointsEach}P를 획득했습니다.`);
    }
    return apiOk(res, { match: completed, pointsEach });
  });

  app.post("/api/buddy/match/:id/report", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    try {
      const data = reportSchema.parse(req.body);
      const match = await storage.getBuddyMatch(req.params.id);
      if (!match || (match.userLessId !== auth.userId && match.userMoreId !== auth.userId)) return apiError(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      const opponentId = match.userLessId === auth.userId ? match.userMoreId : match.userLessId;
      await storage.createReport({ reporterId: auth.userId, reportedUserId: opponentId, matchId: match.id, reason: data.reason, detail: data.detail });
      return apiOk(res, { reported: true });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 반 대항전 ─────────────────────────────────────────────────────
  app.get("/api/class-battle", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const grade = parseInt(String(req.query.grade ?? user.grade), 10);
    const month = typeof req.query.month === "string" ? req.query.month : getTodayKST().slice(0, 7);
    const stats = await storage.getClassBattleStats(user.schoolId, grade);
    const awards = await storage.getRecentBattleAwards(user.schoolId, grade);
    const sortedStats = [...stats].sort((a, b) => b.totalPoints - a.totalPoints);
    const standings = sortedStats.map((s, i) => ({
      rank: i + 1,
      classNum: s.classNum,
      totalPoints: s.totalPoints,
      submissionCount: s.memberCount,
      participantCount: s.memberCount,
      isMyClass: s.classNum === user.classNum,
    }));
    const monthAward = awards.find((a) => a.month === month) ?? null;
    return apiOk(res, { month, grade, myClassNum: user.classNum, standings, monthAward, recentAwards: awards });
  });

  // ─── 반 대항전 수상 (관리자) ──────────────────────────────────────
  app.post("/api/admin/class-battle/award", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const data = classBattleAwardSchema.parse(req.body);
      const user = await storage.getUser(admin.userId);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
      const award = await storage.awardClassBattle(user.schoolId, data.grade, data.winnerClassNum, data.runnerClassNum, data.periodStart, data.periodEnd, data.bonusPoints);
      return apiOk(res, { award });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 스토어 ───────────────────────────────────────────────────────
  app.get("/api/store/items", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const user = await storage.getUser(auth.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const items = await storage.getStoreItems(user.schoolId);
    return apiOk(res, { items, myPoints: user.points });
  });

  app.get("/api/store/redemptions", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const redemptions = await storage.getUserRedemptions(auth.userId);
    return apiOk(res, { redemptions });
  });

  app.get("/api/store/me/redemptions", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const redemptions = await storage.getUserRedemptions(auth.userId);
    return apiOk(res, { redemptions });
  });

  app.post("/api/store/redeem", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    try {
      const { itemId, quantity } = storeRedeemSchema.parse(req.body);
      const user = await storage.getUser(auth.userId);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
      const { redemption, newPoints } = await storage.redeemItem(auth.userId, user.schoolId, itemId, quantity);
      return apiOk(res, { redemption, newPoints });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      if (error instanceof Error) return apiError(res, 400, "REDEEM_FAILED", error.message);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 알림 ─────────────────────────────────────────────────────────
  app.get("/api/notifications", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const notifs = await storage.getUserNotifications(auth.userId);
    return apiOk(res, { notifications: notifs });
  });

  app.post("/api/notifications/:id/read", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    await storage.markNotificationsRead(auth.userId, [req.params.id]);
    return apiOk(res, { read: true });
  });

  app.post("/api/notifications/read-all", async (req: Request, res: Response) => {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    await storage.markNotificationsRead(auth.userId);
    return apiOk(res, { read: true });
  });

  // ─── 관리자: 클린플레이트 검토 ────────────────────────────────────
  app.get("/api/admin/cleanplate", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const user = await storage.getUser(admin.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const submissions = await storage.getPendingCleanPlates(user.schoolId);
    return apiOk(res, { submissions });
  });

  app.post("/api/admin/cleanplate/:id/review", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const { action, note, points } = adminReviewSchema.parse(req.body);
      if (action === "APPROVE") {
        const { submission, newPoints } = await storage.adminApproveCleanPlate(req.params.id, admin.userId, note ?? null, points);
        return apiOk(res, { submission, newPoints });
      } else {
        const submission = await storage.adminRejectCleanPlate(req.params.id, admin.userId, note ?? null);
        return apiOk(res, { submission });
      }
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 관리자: 신고/제재 ────────────────────────────────────────────
  app.get("/api/admin/reports", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const user = await storage.getUser(admin.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const reports = await storage.getOpenReports(user.schoolId);
    return apiOk(res, { reports });
  });

  app.post("/api/admin/reports/:id/action", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const { action, note, targetUserId } = adminActionSchema.parse(req.body);
      const result = await storage.adminActOnReport(req.params.id, admin.userId, action, note, targetUserId);
      return apiOk(res, { action: result });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  // ─── 관리자: 스토어 관리 ──────────────────────────────────────────
  app.get("/api/admin/store/items", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const user = await storage.getUser(admin.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const items = await storage.getAdminStoreItems(user.schoolId);
    return apiOk(res, { items });
  });

  app.post("/api/admin/store/items", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const data = storeItemCreateSchema.parse(req.body);
      const user = await storage.getUser(admin.userId);
      if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
      const item = await storage.createStoreItem(user.schoolId, data);
      return res.status(201).json({ ok: true, item });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  app.put("/api/admin/store/items/:id", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const data = storeItemUpdateSchema.parse(req.body);
      const item = await storage.updateStoreItem(req.params.id, data);
      return apiOk(res, { item });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  app.get("/api/admin/store/redemptions", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const user = await storage.getUser(admin.userId);
    if (!user) return apiError(res, 401, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    const redemptions = await storage.getSchoolRedemptions(user.schoolId);
    return apiOk(res, { redemptions });
  });

  app.post("/api/admin/store/redemptions/:id/process", async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const { status, adminNote } = redemptionProcessSchema.parse(req.body);
      const redemption = await storage.processRedemption(req.params.id, admin.userId, status, adminNote);
      return apiOk(res, { redemption });
    } catch (error) {
      if (error instanceof ZodError) return apiError(res, 400, "VALIDATION_ERROR", parseZodError(error));
      if (error instanceof Error) return apiError(res, 400, "PROCESS_FAILED", error.message);
      return apiError(res, 500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
