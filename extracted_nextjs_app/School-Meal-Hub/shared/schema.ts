import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  real,
  timestamp,
  date,
  json,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enum 타입 ─────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const cleanPlateStatusEnum = pgEnum("clean_plate_status", [
  "PENDING",
  "AUTO_APPROVED",
  "APPROVED",
  "REJECTED",
]);

// ─── Food Buddy Enums ─────────────────────────────────────────
export const buddyPreferenceEnum = pgEnum("buddy_preference", ["LESS", "MORE"]);
export const buddyQueueStatusEnum = pgEnum("buddy_queue_status", ["WAITING", "MATCHED", "CANCELLED"]);
export const buddyMatchStatusEnum = pgEnum("buddy_match_status", ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]);
export const revealConsentStatusEnum = pgEnum("reveal_consent_status", ["PENDING", "ACCEPTED", "REJECTED"]);
export const reportReasonEnum = pgEnum("report_reason", ["HARASSMENT", "SPAM", "PRIVACY", "INAPPROPRIATE", "OTHER"]);
export const reportStatusEnum = pgEnum("report_status", ["OPEN", "REVIEWED", "ACTIONED", "DISMISSED"]);
export const moderationActionEnum = pgEnum("moderation_action", [
  "WARN",
  "SUSPEND_MATCHING_7D",
  "SUSPEND_ACCOUNT_7D",
  "BAN",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "BUDDY_MATCHED",
  "BUDDY_MESSAGE",
  "REVEAL_REQUEST",
  "REVEAL_ACCEPTED",
  "BUDDY_COMPLETE",
  "CLEANPLATE_RESULT",
  "REPORT_REVIEWED",
  "MEAL_PREFERENCE",
  "STORE_APPROVED",
  "SYSTEM",
]);

export const redemptionStatusEnum = pgEnum("redemption_status", [
  "REQUESTED",
  "APPROVED",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);

// ─── 학교 테이블 ──────────────────────────────────────────────────
export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  officeCode: text("office_code").notNull(),
  schoolCode: text("school_code").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("schools_office_school_unique").on(t.officeCode, t.schoolCode),
]);

// ─── 유저 테이블 ──────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  grade: integer("grade").notNull(),
  classNum: integer("class_num").notNull(),
  studentNumber: integer("student_number").notNull(),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  allergies: text("allergies").array(),
  points: integer("points").notNull().default(0),
  role: userRoleEnum("role").notNull().default("USER"),
  matchingSuspendedUntil: timestamp("matching_suspended_until"),
  accountSuspendedUntil: timestamp("account_suspended_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("users_school_grade_class_num_unique").on(
    t.schoolId, t.grade, t.classNum, t.studentNumber
  ),
]);

// ─── 급식 캐시 테이블 ─────────────────────────────────────────────
export const mealCache = pgTable("meal_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  date: date("date").notNull(),
  menuText: text("menu_text").notNull(),
  mealImageUrl: text("meal_image_url"),
  raw: json("raw"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("meal_cache_school_date_unique").on(t.schoolId, t.date),
]);

// ─── 급식 평가 테이블 ─────────────────────────────────────────────
export const mealFeedback = pgTable("meal_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  date: date("date").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("meal_feedback_school_date_idx").on(t.schoolId, t.date),
]);

// ─── 포인트 원장 테이블 ────────────────────────────────────────────
export const pointLedger = pgTable("point_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  refId: text("ref_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("point_ledger_user_created_idx").on(t.userId, t.createdAt),
]);

// ─── 클린플레이트 제출 테이블 ──────────────────────────────────────
export const cleanPlateSubmissions = pgTable("clean_plate_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  date: date("date").notNull(),
  imageUrl: text("image_url").notNull(),
  imageKey: text("image_key").notNull(),
  imageHash: varchar("image_hash", { length: 64 }),
  status: cleanPlateStatusEnum("status").notNull().default("PENDING"),
  aiScore: real("ai_score"),
  aiResult: json("ai_result"),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  reviewNote: text("review_note"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("clean_plate_user_date_idx").on(t.userId, t.date),
  index("clean_plate_school_date_idx").on(t.schoolId, t.date),
  index("clean_plate_status_created_idx").on(t.status, t.createdAt),
]);

// ─── Food Buddy 매칭 큐 ───────────────────────────────────────────
export const buddyQueues = pgTable("buddy_queues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  grade: integer("grade").notNull(),
  classNum: integer("class_num").notNull(),
  preference: buddyPreferenceEnum("preference").notNull(),
  status: buddyQueueStatusEnum("status").notNull().default("WAITING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("buddy_queues_school_grade_pref_idx").on(t.schoolId, t.grade, t.preference, t.createdAt),
  index("buddy_queues_user_idx").on(t.userId, t.status),
]);

// ─── Food Buddy 매칭 결과 ─────────────────────────────────────────
export const buddyMatches = pgTable("buddy_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  grade: integer("grade").notNull(),
  userLessId: varchar("user_less_id").notNull().references(() => users.id),
  userMoreId: varchar("user_more_id").notNull().references(() => users.id),
  status: buddyMatchStatusEnum("status").notNull().default("ACTIVE"),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("buddy_matches_less_status_idx").on(t.userLessId, t.status),
  index("buddy_matches_more_status_idx").on(t.userMoreId, t.status),
]);

// ─── Food Buddy 채팅 메시지 ───────────────────────────────────────
export const buddyMessages = pgTable("buddy_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => buddyMatches.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("buddy_messages_match_created_idx").on(t.matchId, t.createdAt),
  index("buddy_messages_sender_created_idx").on(t.senderId, t.createdAt),
]);

// ─── 학번 공개 동의 ───────────────────────────────────────────────
export const buddyRevealConsents = pgTable("buddy_reveal_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => buddyMatches.id),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  responderId: varchar("responder_id").notNull().references(() => users.id),
  status: revealConsentStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
}, (t) => [
  uniqueIndex("reveal_match_requester_responder_unique").on(t.matchId, t.requesterId, t.responderId),
]);

// ─── 유저 차단 ────────────────────────────────────────────────────
export const userBlocks = pgTable("user_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id),
  blockedId: varchar("blocked_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("user_blocks_pair_unique").on(t.blockerId, t.blockedId),
]);

// ─── 유저 신고 ────────────────────────────────────────────────────
export const userReports = pgTable("user_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  reportedUserId: varchar("reported_user_id").notNull().references(() => users.id),
  matchId: varchar("match_id").references(() => buddyMatches.id),
  messageId: varchar("message_id").references(() => buddyMessages.id),
  reason: reportReasonEnum("reason").notNull(),
  detail: text("detail"),
  status: reportStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("user_reports_status_created_idx").on(t.status, t.createdAt),
  index("user_reports_reported_idx").on(t.reportedUserId, t.createdAt),
]);

// ─── 관리자 모더레이션 조치 ─────────────────────────────────────────
export const moderationActions = pgTable("moderation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  reportId: varchar("report_id").references(() => userReports.id),
  action: moderationActionEnum("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── 인앱 알림 ────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("notifications_user_created_idx").on(t.userId, t.createdAt),
]);

// ─── 포인트 스토어 상품 ───────────────────────────────────────────
export const storeItems = pgTable("store_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  category: varchar("category", { length: 50 }).notNull().default("기타"), // 실물/쿠폰/특권/식권/기타
  pricePoints: integer("price_points").notNull(),
  stock: integer("stock"), // null = 무제한
  perUserDailyLimit: integer("per_user_daily_limit"), // null = 무제한
  isActive: boolean("is_active").notNull().default(true),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("store_items_school_active_idx").on(t.schoolId, t.isActive),
]);

// ─── 포인트 교환 요청 ─────────────────────────────────────────────
export const redemptions = pgTable("redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: varchar("item_id").notNull().references(() => storeItems.id),
  quantity: integer("quantity").notNull().default(1),
  pointsSpent: integer("points_spent").notNull(),
  status: redemptionStatusEnum("status").notNull().default("REQUESTED"),
  adminNote: text("admin_note"),
  processedByUserId: varchar("processed_by_user_id").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("redemptions_school_status_idx").on(t.schoolId, t.status, t.createdAt),
  index("redemptions_user_idx").on(t.userId, t.createdAt),
]);

// ─── 감사 로그 ────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id"),
  actorUserId: varchar("actor_user_id"),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: varchar("target_id"),
  meta: json("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("audit_logs_school_created_idx").on(t.schoolId, t.createdAt),
  index("audit_logs_actor_created_idx").on(t.actorUserId, t.createdAt),
]);

// ─── 반 대항전 수상 기록 ──────────────────────────────────────────
export const classBattleAwards = pgTable("class_battle_awards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  grade: integer("grade").notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  winnerClassNum: integer("winner_class_num").notNull(),
  totalCleanplatePoints: integer("total_cleanplate_points").notNull(),
  bonusPoints: integer("bonus_points").notNull().default(200),
  studentCount: integer("student_count").notNull().default(0),
  awardedByUserId: varchar("awarded_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("class_battle_school_grade_month_unique").on(t.schoolId, t.grade, t.month),
]);

// ─── Zod 스키마 ───────────────────────────────────────────────────
export const signupSchema = z.object({
  officeCode: z.string().min(1, "교육청 코드가 필요합니다"),
  schoolCode: z.string().min(1, "학교 코드가 필요합니다"),
  schoolName: z.string().min(1, "학교명이 필요합니다"),
  grade: z.number().int().min(1).max(6),
  classNum: z.number().int().min(1).max(20),
  studentNumber: z.number().int().min(1),
  heightCm: z.number().int().min(50).max(250).optional().nullable(),
  weightKg: z.number().int().min(10).max(200).optional().nullable(),
  allergies: z.array(z.string()).optional().nullable(),
});

export const loginSchema = z.object({
  officeCode: z.string().min(1),
  schoolCode: z.string().min(1),
  grade: z.number().int().min(1).max(6),
  classNum: z.number().int().min(1).max(20),
  studentNumber: z.number().int().min(1),
});

export const feedbackSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

export const adminReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional().nullable(),
  points: z.number().int().min(10).max(100).refine((v) => v % 10 === 0, { message: "포인트는 10 단위여야 합니다" }).optional(),
});

export const classBattleAwardSchema = z.object({
  grade: z.number().int().min(1).max(6),
  month: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 형식이어야 합니다"),
  bonusPoints: z.number().int().min(50).max(1000).optional(),
});

export const buddyJoinSchema = z.object({
  preference: z.enum(["LESS", "MORE"]),
});

export const buddyMessageSchema = z.object({
  body: z.string().min(1).max(300),
});

export const revealRespondSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"]),
});

export const reportSchema = z.object({
  reportedUserId: z.string().min(1),
  matchId: z.string().optional(),
  messageId: z.string().optional(),
  reason: z.enum(["HARASSMENT", "SPAM", "PRIVACY", "INAPPROPRIATE", "OTHER"]),
  detail: z.string().max(300).optional(),
});

export const blockSchema = z.object({
  blockedUserId: z.string().min(1),
});

export const adminActionSchema = z.object({
  action: z.enum(["WARN", "SUSPEND_MATCHING_7D", "SUSPEND_ACCOUNT_7D", "BAN"]),
  note: z.string().max(500).optional(),
  targetUserId: z.string().min(1),
});

export const storeItemCreateSchema = z.object({
  name: z.string().min(1, "상품명은 필수입니다").max(100),
  description: z.string().max(300).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  category: z.enum(["실물", "쿠폰", "특권", "식권", "기타"]).default("기타"),
  pricePoints: z.number().int().min(1, "포인트는 1 이상이어야 합니다"),
  stock: z.number().int().min(0).optional().nullable(),
  perUserDailyLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const storeItemUpdateSchema = storeItemCreateSchema.partial();

export const storeRedeemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const redemptionProcessSchema = z.object({
  status: z.enum(["APPROVED", "READY", "COMPLETED", "CANCELLED"]),
  adminNote: z.string().max(500).optional().nullable(),
});

// ─── TypeScript 타입 ──────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type School = typeof schools.$inferSelect;
export type MealCache = typeof mealCache.$inferSelect;
export type MealFeedback = typeof mealFeedback.$inferSelect;
export type PointLedger = typeof pointLedger.$inferSelect;
export type CleanPlateSubmission = typeof cleanPlateSubmissions.$inferSelect;
export type BuddyQueue = typeof buddyQueues.$inferSelect;
export type BuddyMatch = typeof buddyMatches.$inferSelect;
export type BuddyMessage = typeof buddyMessages.$inferSelect;
export type BuddyRevealConsent = typeof buddyRevealConsents.$inferSelect;
export type UserBlock = typeof userBlocks.$inferSelect;
export type UserReport = typeof userReports.$inferSelect;
export type ModerationAction = typeof moderationActions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ClassBattleAward = typeof classBattleAwards.$inferSelect;
export type StoreItem = typeof storeItems.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type InsertSchool = typeof schools.$inferInsert;
export type InsertCleanPlate = typeof cleanPlateSubmissions.$inferInsert;

// ─── 상수 ────────────────────────────────────────────────────────
export const ALLERGY_OPTIONS = [
  { id: "1", label: "난류(계란)" },
  { id: "2", label: "우유" },
  { id: "3", label: "메밀" },
  { id: "4", label: "땅콩" },
  { id: "5", label: "대두(콩)" },
  { id: "6", label: "밀" },
  { id: "7", label: "고등어" },
  { id: "8", label: "게" },
  { id: "9", label: "새우" },
  { id: "10", label: "돼지고기" },
  { id: "11", label: "복숭아" },
  { id: "12", label: "토마토" },
  { id: "13", label: "아황산류" },
  { id: "14", label: "호두" },
  { id: "15", label: "닭고기" },
  { id: "16", label: "쇠고기" },
  { id: "17", label: "오징어" },
  { id: "18", label: "조개류" },
] as const;

export const CLEAN_PLATE_POINTS = 100;
export const BUDDY_MATCH_POINTS = 100;
export const CLASS_BATTLE_BONUS_POINTS = 200;
