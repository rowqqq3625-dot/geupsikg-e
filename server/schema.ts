import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, text, varchar, integer, real, timestamp,
  date, json, boolean, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const cleanPlateStatusEnum = pgEnum("clean_plate_status", ["PENDING", "AUTO_APPROVED", "APPROVED", "REJECTED"]);
export const buddyPreferenceEnum = pgEnum("buddy_preference", ["LESS", "MORE"]);
export const buddyQueueStatusEnum = pgEnum("buddy_queue_status", ["WAITING", "MATCHED", "CANCELLED"]);
export const buddyMatchStatusEnum = pgEnum("buddy_match_status", ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]);
export const revealConsentStatusEnum = pgEnum("reveal_consent_status", ["PENDING", "ACCEPTED", "REJECTED"]);
export const reportReasonEnum = pgEnum("report_reason", ["HARASSMENT", "SPAM", "PRIVACY", "INAPPROPRIATE", "OTHER"]);
export const reportStatusEnum = pgEnum("report_status", ["OPEN", "REVIEWED", "ACTIONED", "DISMISSED"]);
export const moderationActionEnum = pgEnum("moderation_action", ["WARN", "SUSPEND_MATCHING_7D", "SUSPEND_ACCOUNT_7D", "BAN"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "BUDDY_MATCHED", "BUDDY_MESSAGE", "REVEAL_REQUEST", "REVEAL_ACCEPTED", "BUDDY_COMPLETE",
  "CLEANPLATE_RESULT", "REPORT_REVIEWED", "MEAL_PREFERENCE", "STORE_APPROVED", "SYSTEM",
]);
export const redemptionStatusEnum = pgEnum("redemption_status", ["REQUESTED", "APPROVED", "READY", "COMPLETED", "CANCELLED"]);

export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  officeCode: text("office_code").notNull(),
  schoolCode: text("school_code").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("schools_office_school_unique").on(t.officeCode, t.schoolCode)]);

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
}, (t) => [uniqueIndex("users_school_grade_class_num_unique").on(t.schoolId, t.grade, t.classNum, t.studentNumber)]);

export const mealCache = pgTable("meal_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  date: date("date").notNull(),
  menuText: text("menu_text").notNull(),
  mealImageUrl: text("meal_image_url"),
  raw: json("raw"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("meal_cache_school_date_unique").on(t.schoolId, t.date)]);

export const mealFeedback = pgTable("meal_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  date: date("date").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("meal_feedback_school_date_idx").on(t.schoolId, t.date)]);

export const pointLedger = pgTable("point_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  refId: text("ref_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("point_ledger_user_created_idx").on(t.userId, t.createdAt)]);

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

export const buddyMessages = pgTable("buddy_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => buddyMatches.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("buddy_messages_match_idx").on(t.matchId, t.createdAt)]);

export const buddyRevealConsents = pgTable("buddy_reveal_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => buddyMatches.id),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  targetId: varchar("target_id").notNull().references(() => users.id),
  status: revealConsentStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("buddy_reveal_match_idx").on(t.matchId)]);

export const userBlocks = pgTable("user_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id),
  blockedId: varchar("blocked_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("user_blocks_unique").on(t.blockerId, t.blockedId)]);

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
});

export const moderationActions = pgTable("moderation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  reportId: varchar("report_id").references(() => userReports.id),
  action: moderationActionEnum("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)]);

export const classBattleAwards = pgTable("class_battle_awards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  grade: integer("grade").notNull(),
  winnerClassNum: integer("winner_class_num").notNull(),
  runnerClassNum: integer("runner_class_num"),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  bonusPoints: integer("bonus_points").notNull().default(200),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
});

export const storeItems = pgTable("store_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").references(() => schools.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("기타"),
  pricePoints: integer("price_points").notNull(),
  stock: integer("stock"),
  perUserDailyLimit: integer("per_user_daily_limit"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  index("redemptions_user_idx").on(t.userId, t.createdAt),
  index("redemptions_school_status_idx").on(t.schoolId, t.status),
]);

export const sessionEventTypeEnum = pgEnum("session_event_type", [
  "APP_OPEN", "SESSION_RESUME", "LOGIN", "SIGNUP", "LOGOUT", "API_CALL",
]);

export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  installId: text("install_id").notNull(),
  userId: varchar("user_id").references(() => users.id),
  platform: text("platform"),
  appVersion: text("app_version"),
  deviceModel: text("device_model"),
  locale: text("locale"),
  timezone: text("timezone"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("devices_install_id_unique").on(t.installId)]);

export const sessionEvents = pgTable("session_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => devices.id),
  userId: varchar("user_id").references(() => users.id),
  schoolId: varchar("school_id").references(() => schools.id),
  eventType: sessionEventTypeEnum("event_type").notNull(),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("session_events_user_created_idx").on(t.userId, t.createdAt),
  index("session_events_device_created_idx").on(t.deviceId, t.createdAt),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id"),
  actorUserId: varchar("actor_user_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  meta: json("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type SessionEvent = typeof sessionEvents.$inferSelect;
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

export const CLEAN_PLATE_POINTS = 100;
export const BUDDY_MATCH_POINTS = 100;
export const CLASS_BATTLE_BONUS_POINTS = 200;

export const signupSchema = z.object({
  officeCode: z.string().min(1),
  schoolCode: z.string().min(1),
  schoolName: z.string().min(1),
  grade: z.number().int().min(1).max(6),
  classNum: z.number().int().min(1).max(20),
  studentNumber: z.number().int().min(1).max(60),
  heightCm: z.number().int().min(100).max(250).optional().nullable(),
  weightKg: z.number().int().min(20).max(200).optional().nullable(),
  allergies: z.array(z.string()).optional().nullable(),
});

export const loginSchema = z.object({
  officeCode: z.string().min(1),
  schoolCode: z.string().min(1),
  grade: z.number().int().min(1).max(6),
  classNum: z.number().int().min(1).max(20),
  studentNumber: z.number().int().min(1).max(60),
});

export const feedbackSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(200).optional().nullable(),
});

export const adminReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(200).optional().nullable(),
  points: z.number().int().min(1).max(100).optional(),
});

export const buddyJoinSchema = z.object({
  preference: z.enum(["LESS", "MORE"]),
});

export const buddyMessageSchema = z.object({
  body: z.string().min(1).max(300),
});

export const revealRespondSchema = z.object({
  accept: z.boolean(),
});

export const reportSchema = z.object({
  reason: z.enum(["HARASSMENT", "SPAM", "PRIVACY", "INAPPROPRIATE", "OTHER"]),
  detail: z.string().max(500).optional(),
});

export const blockSchema = z.object({
  targetUserId: z.string().min(1),
});

export const adminActionSchema = z.object({
  action: z.enum(["WARN", "SUSPEND_MATCHING_7D", "SUSPEND_ACCOUNT_7D", "BAN"]),
  note: z.string().max(500).optional(),
  targetUserId: z.string().min(1),
});

export const classBattleAwardSchema = z.object({
  grade: z.number().int().min(1),
  winnerClassNum: z.number().int().min(1),
  runnerClassNum: z.number().int().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bonusPoints: z.number().int().min(1).max(1000).optional(),
});

export const storeItemCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  category: z.string().min(1),
  pricePoints: z.number().int().min(1),
  stock: z.number().int().min(0).optional().nullable(),
  perUserDailyLimit: z.number().int().min(1).optional().nullable(),
});

export const storeItemUpdateSchema = storeItemCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const storeRedeemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const redemptionProcessSchema = z.object({
  status: z.enum(["APPROVED", "READY", "COMPLETED", "CANCELLED"]),
  adminNote: z.string().max(200).optional().nullable(),
});
