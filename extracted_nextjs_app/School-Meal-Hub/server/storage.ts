import {
  users,
  schools,
  mealCache,
  mealFeedback,
  pointLedger,
  cleanPlateSubmissions,
  buddyQueues,
  buddyMatches,
  buddyMessages,
  buddyRevealConsents,
  userBlocks,
  userReports,
  moderationActions,
  notifications,
  classBattleAwards,
  storeItems,
  redemptions,
  auditLogs,
  type User,
  type School,
  type MealCache,
  type CleanPlateSubmission,
  type BuddyQueue,
  type BuddyMatch,
  type BuddyMessage,
  type BuddyRevealConsent,
  type UserBlock,
  type UserReport,
  type ModerationAction,
  type Notification,
  type ClassBattleAward,
  type StoreItem,
  type Redemption,
  type InsertUser,
  type InsertSchool,
  CLEAN_PLATE_POINTS,
  BUDDY_MATCH_POINTS,
  CLASS_BATTLE_BONUS_POINTS,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, gte, lt, or, ne, count } from "drizzle-orm";

type MealFeedback = typeof mealFeedback.$inferSelect;

export interface IStorage {
  // ─── 학교/유저 ─────────────────────────────────────────────────
  getSchoolByCode(officeCode: string, schoolCode: string): Promise<School | undefined>;
  upsertSchool(school: InsertSchool): Promise<School>;
  getUser(id: string): Promise<User | undefined>;
  getUserByCredentials(schoolId: string, grade: number, classNum: number, studentNumber: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // ─── 급식/피드백 ───────────────────────────────────────────────
  getMealCache(schoolId: string, date: string): Promise<MealCache | undefined>;
  saveMealCache(schoolId: string, date: string, menuText: string, raw?: unknown): Promise<MealCache>;
  updateMealImageUrl(schoolId: string, date: string, imageUrl: string): Promise<void>;
  createFeedbackWithPoints(userId: string, schoolId: string, date: string, rating: number, comment: string | null): Promise<{ feedback: MealFeedback; newPoints: number }>;
  getUserFeedbackForDate(userId: string, date: string): Promise<MealFeedback | undefined>;
  getMealFeedbackWithMenu(userId: string, schoolId: string, days: number): Promise<{ rating: number; menuText: string; date: string }[]>;

  // ─── 랭킹 ─────────────────────────────────────────────────────
  getClassRanking(schoolId: string, grade: number, classNum: number): Promise<{ studentNumber: number; points: number }[]>;
  getSchoolRanking(schoolId: string): Promise<{ grade: number; classNum: number; studentNumber: number; points: number }[]>;

  // ─── 클린플레이트 ──────────────────────────────────────────────
  getCleanPlateByUserAndDate(userId: string, date: string): Promise<CleanPlateSubmission | undefined>;
  getCleanPlatesByUserAndDate(userId: string, date: string): Promise<CleanPlateSubmission[]>;
  createCleanPlate(data: { userId: string; schoolId: string; date: string; imageUrl: string; imageKey: string; imageHash?: string }): Promise<CleanPlateSubmission>;
  createFraudCleanPlate(data: { userId: string; schoolId: string; date: string; imageUrl: string; imageKey: string; imageHash: string }): Promise<CleanPlateSubmission>;
  autoApproveCleanPlate(id: string, aiScore: number, aiResult: unknown, points?: number): Promise<{ submission: CleanPlateSubmission; newPoints: number }>;
  rejectCleanPlate(id: string, aiScore: number, aiResult: unknown): Promise<CleanPlateSubmission>;
  updateCleanPlateAiResult(id: string, aiScore: number, aiResult: unknown): Promise<CleanPlateSubmission>;
  getCleanPlateHistory(userId: string, days: number): Promise<CleanPlateSubmission[]>;
  getPendingCleanPlates(schoolId: string): Promise<(CleanPlateSubmission & { studentNumber: number })[]>;
  adminApproveCleanPlate(id: string, reviewerId: string, note: string | null, customPoints?: number): Promise<{ submission: CleanPlateSubmission; newPoints: number }>;
  adminRejectCleanPlate(id: string, reviewerId: string, note: string | null): Promise<CleanPlateSubmission>;

  // ─── 반 대항전 ─────────────────────────────────────────────────
  getClassBattleStandings(schoolId: string, grade: number, month: string): Promise<{ classNum: number; totalPoints: number; submissionCount: number; participantCount: number }[]>;
  getClassBattleAwards(schoolId: string, grade: number): Promise<ClassBattleAward[]>;
  awardClassBattleBonus(schoolId: string, grade: number, month: string, adminId: string, bonusPoints?: number): Promise<ClassBattleAward>;

  // ─── Food Buddy 큐/매칭 ────────────────────────────────────────
  joinBuddyQueue(userId: string, schoolId: string, grade: number, classNum: number, preference: "LESS" | "MORE"): Promise<BuddyQueue>;
  leaveBuddyQueue(userId: string): Promise<void>;
  getBuddyQueue(userId: string): Promise<BuddyQueue | undefined>;
  tryMatch(schoolId: string, grade: number): Promise<BuddyMatch | null>;
  getBuddyMatch(id: string): Promise<BuddyMatch | undefined>;
  getActiveBuddyMatch(userId: string): Promise<BuddyMatch | undefined>;
  cancelBuddyMatch(matchId: string): Promise<void>;

  // ─── 채팅 메시지 ───────────────────────────────────────────────
  createBuddyMessage(matchId: string, senderId: string, body: string): Promise<BuddyMessage>;
  getBuddyMessages(matchId: string, cursor?: string, limit?: number): Promise<BuddyMessage[]>;
  getRecentMessageCount(matchId: string, senderId: string, sinceMs: number): Promise<number>;

  // ─── 학번 공개 동의 ────────────────────────────────────────────
  requestReveal(matchId: string, requesterId: string, responderId: string): Promise<BuddyRevealConsent>;
  respondReveal(consentId: string, responderId: string, action: "ACCEPT" | "REJECT"): Promise<BuddyRevealConsent>;
  getRevealConsents(matchId: string): Promise<BuddyRevealConsent[]>;

  // ─── 매칭 완료 ─────────────────────────────────────────────────
  completeBuddyMatch(matchId: string): Promise<{ match: BuddyMatch; pointsEach: number }>;

  // ─── 차단/신고 ─────────────────────────────────────────────────
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  isBlocked(userA: string, userB: string): Promise<boolean>;
  createReport(data: { reporterId: string; reportedUserId: string; matchId?: string; messageId?: string; reason: string; detail?: string }): Promise<UserReport>;
  getOpenReports(schoolId: string): Promise<(UserReport & { reporterStudentNum: number; reportedStudentNum: number; schoolId: string })[]>;
  adminActOnReport(reportId: string, adminId: string, action: string, note: string | undefined, targetUserId: string): Promise<ModerationAction>;

  // ─── 알림 ─────────────────────────────────────────────────────
  createNotification(userId: string, type: string, title: string, body: string, url?: string): Promise<Notification>;
  getUserNotifications(userId: string, cursor?: string): Promise<Notification[]>;
  markNotificationsRead(userId: string, ids?: string[]): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // ─── 포인트 스토어 ─────────────────────────────────────────────
  getStoreItems(schoolId: string, includeInactive?: boolean): Promise<StoreItem[]>;
  getStoreItem(id: string): Promise<StoreItem | undefined>;
  createStoreItem(data: {
    schoolId: string; name: string; description?: string | null; imageUrl?: string | null;
    category: string; pricePoints: number; stock?: number | null;
    perUserDailyLimit?: number | null; isActive: boolean; createdByUserId: string;
  }): Promise<StoreItem>;
  updateStoreItem(id: string, data: Partial<{
    name: string; description: string | null; imageUrl: string | null; category: string;
    pricePoints: number; stock: number | null; perUserDailyLimit: number | null; isActive: boolean;
  }>): Promise<StoreItem>;
  redeemItem(userId: string, schoolId: string, itemId: string, quantity: number): Promise<{ redemption: Redemption; newPoints: number }>;
  getUserRedemptions(userId: string): Promise<(Redemption & { itemName: string; itemCategory: string })[]>;
  getSchoolRedemptions(schoolId: string, status?: string): Promise<(Redemption & { itemName: string; studentNumber: number; grade: number; classNum: number })[]>;
  processRedemption(id: string, adminId: string, status: string, adminNote?: string | null): Promise<Redemption>;
}

export class DatabaseStorage implements IStorage {
  // ─── 학교/유저 ─────────────────────────────────────────────────

  async getSchoolByCode(officeCode: string, schoolCode: string): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(
      and(eq(schools.officeCode, officeCode), eq(schools.schoolCode, schoolCode))
    );
    return school;
  }

  async upsertSchool(s: InsertSchool): Promise<School> {
    const existing = await this.getSchoolByCode(s.officeCode, s.schoolCode);
    if (existing) {
      if (existing.name !== s.name) {
        const [updated] = await db.update(schools)
          .set({ name: s.name, updatedAt: new Date() })
          .where(eq(schools.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }
    const [school] = await db.insert(schools).values(s).returning();
    return school;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByCredentials(schoolId: string, grade: number, classNum: number, studentNumber: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.schoolId, schoolId),
        eq(users.grade, grade),
        eq(users.classNum, classNum),
        eq(users.studentNumber, studentNumber),
      )
    );
    return user;
  }

  async createUser(u: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(u).returning();
    return user;
  }

  // ─── 급식/피드백 ───────────────────────────────────────────────

  async getMealCache(schoolId: string, date: string): Promise<MealCache | undefined> {
    const [row] = await db.select().from(mealCache).where(
      and(eq(mealCache.schoolId, schoolId), eq(mealCache.date, date))
    );
    return row;
  }

  async saveMealCache(schoolId: string, date: string, menuText: string, raw?: unknown): Promise<MealCache> {
    const [row] = await db.insert(mealCache)
      .values({ schoolId, date, menuText, raw: raw ?? null })
      .onConflictDoUpdate({
        target: [mealCache.schoolId, mealCache.date],
        set: { menuText, raw: raw ?? null },
      })
      .returning();
    return row;
  }

  async createFeedbackWithPoints(
    userId: string,
    schoolId: string,
    date: string,
    rating: number,
    comment: string | null,
  ): Promise<{ feedback: MealFeedback; newPoints: number }> {
    return await db.transaction(async (tx) => {
      const [feedback] = await tx.insert(mealFeedback)
        .values({ userId, schoolId, date, rating, comment })
        .returning();

      await tx.insert(pointLedger).values({
        userId,
        delta: 30,
        reason: "MEAL_FEEDBACK",
        refId: feedback.id,
      });

      const result = await tx.select({ total: sum(pointLedger.delta) })
        .from(pointLedger)
        .where(eq(pointLedger.userId, userId));

      const newPoints = Number(result[0]?.total ?? 0);
      await tx.update(users).set({ points: newPoints }).where(eq(users.id, userId));

      return { feedback, newPoints };
    });
  }

  async updateMealImageUrl(schoolId: string, date: string, imageUrl: string): Promise<void> {
    await db.update(mealCache)
      .set({ mealImageUrl: imageUrl })
      .where(and(eq(mealCache.schoolId, schoolId), eq(mealCache.date, date)));
  }

  async getUserFeedbackForDate(userId: string, date: string): Promise<MealFeedback | undefined> {
    const [row] = await db.select().from(mealFeedback).where(
      and(eq(mealFeedback.userId, userId), eq(mealFeedback.date, date))
    );
    return row;
  }

  async getMealFeedbackWithMenu(userId: string, schoolId: string, days: number): Promise<{ rating: number; menuText: string; date: string }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const rows = await db.select({
      rating: mealFeedback.rating,
      menuText: mealCache.menuText,
      date: mealFeedback.date,
    })
      .from(mealFeedback)
      .innerJoin(mealCache, and(
        eq(mealCache.schoolId, schoolId),
        eq(mealCache.date, mealFeedback.date),
      ))
      .where(and(
        eq(mealFeedback.userId, userId),
        gte(mealFeedback.date, sinceStr),
      ))
      .orderBy(desc(mealFeedback.createdAt))
      .limit(30);

    return rows;
  }

  // ─── 랭킹 ─────────────────────────────────────────────────────

  async getClassRanking(schoolId: string, grade: number, classNum: number): Promise<{ studentNumber: number; points: number }[]> {
    return await db.select({ studentNumber: users.studentNumber, points: users.points })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), eq(users.grade, grade), eq(users.classNum, classNum)))
      .orderBy(desc(users.points))
      .limit(20);
  }

  async getSchoolRanking(schoolId: string): Promise<{ grade: number; classNum: number; studentNumber: number; points: number }[]> {
    return await db.select({ grade: users.grade, classNum: users.classNum, studentNumber: users.studentNumber, points: users.points })
      .from(users)
      .where(eq(users.schoolId, schoolId))
      .orderBy(desc(users.points))
      .limit(20);
  }

  // ─── 클린플레이트 ──────────────────────────────────────────────

  async getCleanPlateByUserAndDate(userId: string, date: string): Promise<CleanPlateSubmission | undefined> {
    const rows = await db.select().from(cleanPlateSubmissions)
      .where(and(eq(cleanPlateSubmissions.userId, userId), eq(cleanPlateSubmissions.date, date)))
      .orderBy(desc(cleanPlateSubmissions.createdAt))
      .limit(1);
    return rows[0];
  }

  async getCleanPlatesByUserAndDate(userId: string, date: string): Promise<CleanPlateSubmission[]> {
    return await db.select().from(cleanPlateSubmissions)
      .where(and(eq(cleanPlateSubmissions.userId, userId), eq(cleanPlateSubmissions.date, date)))
      .orderBy(desc(cleanPlateSubmissions.createdAt));
  }

  async createCleanPlate(data: { userId: string; schoolId: string; date: string; imageUrl: string; imageKey: string; imageHash?: string }): Promise<CleanPlateSubmission> {
    const [row] = await db.insert(cleanPlateSubmissions)
      .values({ ...data, status: "PENDING" })
      .returning();
    return row;
  }

  async createFraudCleanPlate(data: { userId: string; schoolId: string; date: string; imageUrl: string; imageKey: string; imageHash: string }): Promise<CleanPlateSubmission> {
    const [row] = await db.insert(cleanPlateSubmissions)
      .values({ ...data, status: "REJECTED", reviewNote: "FRAUD:DUPLICATE_IMAGE" })
      .returning();
    return row;
  }

  async autoApproveCleanPlate(id: string, aiScore: number, aiResult: unknown, points: number = CLEAN_PLATE_POINTS): Promise<{ submission: CleanPlateSubmission; newPoints: number }> {
    return await db.transaction(async (tx) => {
      const [submission] = await tx.update(cleanPlateSubmissions)
        .set({ status: "AUTO_APPROVED", aiScore, aiResult: aiResult as any, pointsAwarded: points })
        .where(eq(cleanPlateSubmissions.id, id))
        .returning();

      await tx.insert(pointLedger).values({
        userId: submission.userId,
        delta: points,
        reason: points === CLEAN_PLATE_POINTS ? "CLEANPLATE_AUTO_APPROVED" : "CLEANPLATE_PARTIAL_AUTO_APPROVED",
        refId: id,
      });

      const result = await tx.select({ total: sum(pointLedger.delta) })
        .from(pointLedger)
        .where(eq(pointLedger.userId, submission.userId));

      const newPoints = Number(result[0]?.total ?? 0);
      await tx.update(users).set({ points: newPoints }).where(eq(users.id, submission.userId));

      return { submission, newPoints };
    });
  }

  async rejectCleanPlate(id: string, aiScore: number, aiResult: unknown): Promise<CleanPlateSubmission> {
    const [submission] = await db.update(cleanPlateSubmissions)
      .set({ status: "REJECTED", aiScore, aiResult: aiResult as any })
      .where(eq(cleanPlateSubmissions.id, id))
      .returning();
    return submission;
  }

  async updateCleanPlateAiResult(id: string, aiScore: number, aiResult: unknown): Promise<CleanPlateSubmission> {
    const [submission] = await db.update(cleanPlateSubmissions)
      .set({ aiScore, aiResult: aiResult as any })
      .where(eq(cleanPlateSubmissions.id, id))
      .returning();
    return submission;
  }

  async getCleanPlateHistory(userId: string, days: number): Promise<CleanPlateSubmission[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    return await db.select().from(cleanPlateSubmissions)
      .where(and(
        eq(cleanPlateSubmissions.userId, userId),
        gte(cleanPlateSubmissions.date, sinceStr),
      ))
      .orderBy(desc(cleanPlateSubmissions.date))
      .limit(days);
  }

  async getPendingCleanPlates(schoolId: string): Promise<(CleanPlateSubmission & { studentNumber: number })[]> {
    const rows = await db.select({
      id: cleanPlateSubmissions.id,
      userId: cleanPlateSubmissions.userId,
      schoolId: cleanPlateSubmissions.schoolId,
      date: cleanPlateSubmissions.date,
      imageUrl: cleanPlateSubmissions.imageUrl,
      imageKey: cleanPlateSubmissions.imageKey,
      imageHash: cleanPlateSubmissions.imageHash,
      status: cleanPlateSubmissions.status,
      aiScore: cleanPlateSubmissions.aiScore,
      aiResult: cleanPlateSubmissions.aiResult,
      pointsAwarded: cleanPlateSubmissions.pointsAwarded,
      reviewNote: cleanPlateSubmissions.reviewNote,
      reviewedByUserId: cleanPlateSubmissions.reviewedByUserId,
      reviewedAt: cleanPlateSubmissions.reviewedAt,
      createdAt: cleanPlateSubmissions.createdAt,
      studentNumber: users.studentNumber,
    })
      .from(cleanPlateSubmissions)
      .innerJoin(users, eq(users.id, cleanPlateSubmissions.userId))
      .where(and(
        eq(cleanPlateSubmissions.schoolId, schoolId),
        eq(cleanPlateSubmissions.status, "PENDING"),
      ))
      .orderBy(desc(cleanPlateSubmissions.createdAt))
      .limit(50);

    return rows;
  }

  async adminApproveCleanPlate(id: string, reviewerId: string, note: string | null, customPoints?: number): Promise<{ submission: CleanPlateSubmission; newPoints: number }> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(cleanPlateSubmissions).where(eq(cleanPlateSubmissions.id, id));
      if (!existing) throw new Error("제출 내역을 찾을 수 없습니다.");

      const awardPoints = customPoints ?? (existing.pointsAwarded === 0 ? CLEAN_PLATE_POINTS : existing.pointsAwarded);

      const [submission] = await tx.update(cleanPlateSubmissions)
        .set({
          status: "APPROVED",
          reviewedByUserId: reviewerId,
          reviewedAt: new Date(),
          reviewNote: note,
          pointsAwarded: awardPoints,
        })
        .where(eq(cleanPlateSubmissions.id, id))
        .returning();

      if (existing.pointsAwarded === 0) {
        await tx.insert(pointLedger).values({
          userId: existing.userId,
          delta: awardPoints,
          reason: "CLEANPLATE_APPROVED",
          refId: id,
        });

        const result = await tx.select({ total: sum(pointLedger.delta) })
          .from(pointLedger)
          .where(eq(pointLedger.userId, existing.userId));

        const pts = Number(result[0]?.total ?? 0);
        await tx.update(users).set({ points: pts }).where(eq(users.id, existing.userId));
        return { submission, newPoints: pts };
      }

      const result = await tx.select({ total: sum(pointLedger.delta) }).from(pointLedger).where(eq(pointLedger.userId, existing.userId));
      return { submission, newPoints: Number(result[0]?.total ?? 0) };
    });
  }

  async adminRejectCleanPlate(id: string, reviewerId: string, note: string | null): Promise<CleanPlateSubmission> {
    const [submission] = await db.update(cleanPlateSubmissions)
      .set({
        status: "REJECTED",
        reviewedByUserId: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note,
      })
      .where(eq(cleanPlateSubmissions.id, id))
      .returning();
    return submission;
  }

  // ─── Food Buddy 큐/매칭 ────────────────────────────────────────

  async joinBuddyQueue(userId: string, schoolId: string, grade: number, classNum: number, preference: "LESS" | "MORE"): Promise<BuddyQueue> {
    const existing = await this.getBuddyQueue(userId);
    if (existing && existing.status === "WAITING") {
      return existing;
    }
    const [queue] = await db.insert(buddyQueues)
      .values({ userId, schoolId, grade, classNum, preference, status: "WAITING" })
      .returning();
    return queue;
  }

  async leaveBuddyQueue(userId: string): Promise<void> {
    await db.update(buddyQueues)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(and(eq(buddyQueues.userId, userId), eq(buddyQueues.status, "WAITING")));
  }

  async getBuddyQueue(userId: string): Promise<BuddyQueue | undefined> {
    const [queue] = await db.select().from(buddyQueues)
      .where(and(eq(buddyQueues.userId, userId), eq(buddyQueues.status, "WAITING")))
      .orderBy(desc(buddyQueues.createdAt))
      .limit(1);
    return queue;
  }

  async tryMatch(schoolId: string, grade: number): Promise<BuddyMatch | null> {
    return await db.transaction(async (tx) => {
      const [lessEntry] = await tx.select().from(buddyQueues)
        .where(and(
          eq(buddyQueues.schoolId, schoolId),
          eq(buddyQueues.grade, grade),
          eq(buddyQueues.preference, "LESS"),
          eq(buddyQueues.status, "WAITING"),
        ))
        .orderBy(buddyQueues.createdAt)
        .limit(1);

      const [moreEntry] = await tx.select().from(buddyQueues)
        .where(and(
          eq(buddyQueues.schoolId, schoolId),
          eq(buddyQueues.grade, grade),
          eq(buddyQueues.preference, "MORE"),
          eq(buddyQueues.status, "WAITING"),
        ))
        .orderBy(buddyQueues.createdAt)
        .limit(1);

      if (!lessEntry || !moreEntry || lessEntry.userId === moreEntry.userId) {
        return null;
      }

      // Create match
      const [match] = await tx.insert(buddyMatches)
        .values({
          schoolId,
          grade,
          userLessId: lessEntry.userId,
          userMoreId: moreEntry.userId,
          status: "ACTIVE",
        })
        .returning();

      // Update both queues to MATCHED
      await tx.update(buddyQueues)
        .set({ status: "MATCHED", updatedAt: new Date() })
        .where(eq(buddyQueues.id, lessEntry.id));

      await tx.update(buddyQueues)
        .set({ status: "MATCHED", updatedAt: new Date() })
        .where(eq(buddyQueues.id, moreEntry.id));

      return match;
    });
  }

  async getBuddyMatch(id: string): Promise<BuddyMatch | undefined> {
    const [match] = await db.select().from(buddyMatches).where(eq(buddyMatches.id, id));
    return match;
  }

  async getActiveBuddyMatch(userId: string): Promise<BuddyMatch | undefined> {
    const [match] = await db.select().from(buddyMatches)
      .where(and(
        or(eq(buddyMatches.userLessId, userId), eq(buddyMatches.userMoreId, userId)),
        eq(buddyMatches.status, "ACTIVE"),
      ))
      .orderBy(desc(buddyMatches.createdAt))
      .limit(1);
    return match;
  }

  async cancelBuddyMatch(matchId: string): Promise<void> {
    await db.update(buddyMatches)
      .set({ status: "CANCELLED" })
      .where(eq(buddyMatches.id, matchId));
  }

  // ─── 채팅 메시지 ───────────────────────────────────────────────

  async createBuddyMessage(matchId: string, senderId: string, body: string): Promise<BuddyMessage> {
    const [msg] = await db.insert(buddyMessages)
      .values({ matchId, senderId, body })
      .returning();
    return msg;
  }

  async getBuddyMessages(matchId: string, cursor?: string, limit = 30): Promise<BuddyMessage[]> {
    if (cursor) {
      const [cursorMsg] = await db.select().from(buddyMessages).where(eq(buddyMessages.id, cursor));
      if (cursorMsg) {
        return await db.select().from(buddyMessages)
          .where(and(eq(buddyMessages.matchId, matchId), lt(buddyMessages.createdAt, cursorMsg.createdAt)))
          .orderBy(desc(buddyMessages.createdAt))
          .limit(limit);
      }
    }
    return await db.select().from(buddyMessages)
      .where(eq(buddyMessages.matchId, matchId))
      .orderBy(desc(buddyMessages.createdAt))
      .limit(limit);
  }

  async getRecentMessageCount(matchId: string, senderId: string, sinceMs: number): Promise<number> {
    const since = new Date(Date.now() - sinceMs);
    const [result] = await db.select({ cnt: count() }).from(buddyMessages)
      .where(and(
        eq(buddyMessages.matchId, matchId),
        eq(buddyMessages.senderId, senderId),
        gte(buddyMessages.createdAt, since),
      ));
    return Number(result?.cnt ?? 0);
  }

  // ─── 학번 공개 동의 ────────────────────────────────────────────

  async requestReveal(matchId: string, requesterId: string, responderId: string): Promise<BuddyRevealConsent> {
    const [consent] = await db.insert(buddyRevealConsents)
      .values({ matchId, requesterId, responderId, status: "PENDING" })
      .onConflictDoNothing()
      .returning();
    if (!consent) {
      const [existing] = await db.select().from(buddyRevealConsents)
        .where(and(
          eq(buddyRevealConsents.matchId, matchId),
          eq(buddyRevealConsents.requesterId, requesterId),
          eq(buddyRevealConsents.responderId, responderId),
        ));
      return existing;
    }
    return consent;
  }

  async respondReveal(consentId: string, responderId: string, action: "ACCEPT" | "REJECT"): Promise<BuddyRevealConsent> {
    const [consent] = await db.update(buddyRevealConsents)
      .set({
        status: action === "ACCEPT" ? "ACCEPTED" : "REJECTED",
        respondedAt: new Date(),
      })
      .where(and(eq(buddyRevealConsents.id, consentId), eq(buddyRevealConsents.responderId, responderId)))
      .returning();
    return consent;
  }

  async getRevealConsents(matchId: string): Promise<BuddyRevealConsent[]> {
    return await db.select().from(buddyRevealConsents)
      .where(eq(buddyRevealConsents.matchId, matchId));
  }

  // ─── 매칭 완료 ─────────────────────────────────────────────────

  async completeBuddyMatch(matchId: string): Promise<{ match: BuddyMatch; pointsEach: number }> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(buddyMatches).where(eq(buddyMatches.id, matchId));
      if (!existing) throw new Error("매칭을 찾을 수 없습니다.");
      if (existing.pointsAwarded > 0) {
        return { match: existing, pointsEach: existing.pointsAwarded };
      }

      const [match] = await tx.update(buddyMatches)
        .set({ status: "COMPLETED", completedAt: new Date(), pointsAwarded: BUDDY_MATCH_POINTS })
        .where(eq(buddyMatches.id, matchId))
        .returning();

      // Award points to both users
      for (const userId of [existing.userLessId, existing.userMoreId]) {
        await tx.insert(pointLedger).values({
          userId,
          delta: BUDDY_MATCH_POINTS,
          reason: "BUDDY_MATCH_COMPLETED",
          refId: matchId,
        });

        const result = await tx.select({ total: sum(pointLedger.delta) })
          .from(pointLedger)
          .where(eq(pointLedger.userId, userId));

        const newPoints = Number(result[0]?.total ?? 0);
        await tx.update(users).set({ points: newPoints }).where(eq(users.id, userId));
      }

      return { match, pointsEach: BUDDY_MATCH_POINTS };
    });
  }

  // ─── 차단/신고 ─────────────────────────────────────────────────

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.insert(userBlocks)
      .values({ blockerId, blockedId })
      .onConflictDoNothing();
  }

  async isBlocked(userA: string, userB: string): Promise<boolean> {
    const [row] = await db.select().from(userBlocks)
      .where(or(
        and(eq(userBlocks.blockerId, userA), eq(userBlocks.blockedId, userB)),
        and(eq(userBlocks.blockerId, userB), eq(userBlocks.blockedId, userA)),
      ))
      .limit(1);
    return !!row;
  }

  async createReport(data: { reporterId: string; reportedUserId: string; matchId?: string; messageId?: string; reason: string; detail?: string }): Promise<UserReport> {
    const [report] = await db.insert(userReports)
      .values({
        reporterId: data.reporterId,
        reportedUserId: data.reportedUserId,
        matchId: data.matchId ?? null,
        messageId: data.messageId ?? null,
        reason: data.reason as any,
        detail: data.detail ?? null,
        status: "OPEN",
      })
      .returning();
    return report;
  }

  async getOpenReports(schoolId: string): Promise<(UserReport & { reporterStudentNum: number; reportedStudentNum: number; schoolId: string })[]> {
    const reporter = db.$with("reporter").as(
      db.select({ id: users.id, studentNumber: users.studentNumber, schoolId: users.schoolId }).from(users)
    );
    const reported = db.$with("reported_u").as(
      db.select({ id: users.id, studentNumber: users.studentNumber }).from(users)
    );

    const rows = await db
      .with(reporter, reported)
      .select({
        id: userReports.id,
        reporterId: userReports.reporterId,
        reportedUserId: userReports.reportedUserId,
        matchId: userReports.matchId,
        messageId: userReports.messageId,
        reason: userReports.reason,
        detail: userReports.detail,
        status: userReports.status,
        createdAt: userReports.createdAt,
        updatedAt: userReports.updatedAt,
        reporterStudentNum: reporter.studentNumber,
        reportedStudentNum: reported.studentNumber,
        schoolId: reporter.schoolId,
      })
      .from(userReports)
      .innerJoin(reporter, eq(reporter.id, userReports.reporterId))
      .innerJoin(reported, eq(reported.id, userReports.reportedUserId))
      .where(and(
        eq(reporter.schoolId, schoolId),
        eq(userReports.status, "OPEN"),
      ))
      .orderBy(desc(userReports.createdAt))
      .limit(50);

    return rows;
  }

  async adminActOnReport(reportId: string, adminId: string, action: string, note: string | undefined, targetUserId: string): Promise<ModerationAction> {
    return await db.transaction(async (tx) => {
      await tx.update(userReports)
        .set({ status: "ACTIONED", updatedAt: new Date() })
        .where(eq(userReports.id, reportId));

      const [modAction] = await tx.insert(moderationActions)
        .values({
          adminId,
          targetUserId,
          reportId,
          action: action as any,
          note: note ?? null,
        })
        .returning();

      // Apply suspension
      const now = new Date();
      if (action === "SUSPEND_MATCHING_7D") {
        const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await tx.update(users).set({ matchingSuspendedUntil: until }).where(eq(users.id, targetUserId));
      } else if (action === "SUSPEND_ACCOUNT_7D") {
        const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await tx.update(users).set({ accountSuspendedUntil: until }).where(eq(users.id, targetUserId));
      } else if (action === "BAN") {
        const forever = new Date("2099-01-01");
        await tx.update(users).set({ accountSuspendedUntil: forever, matchingSuspendedUntil: forever }).where(eq(users.id, targetUserId));
      }

      return modAction;
    });
  }

  // ─── 알림 ─────────────────────────────────────────────────────

  async createNotification(userId: string, type: string, title: string, body: string, url?: string): Promise<Notification> {
    const [notif] = await db.insert(notifications)
      .values({ userId, type: type as any, title, body, url: url ?? null })
      .returning();
    return notif;
  }

  async getUserNotifications(userId: string, cursor?: string): Promise<Notification[]> {
    if (cursor) {
      const [cursorNotif] = await db.select().from(notifications).where(eq(notifications.id, cursor));
      if (cursorNotif) {
        return await db.select().from(notifications)
          .where(and(eq(notifications.userId, userId), lt(notifications.createdAt, cursorNotif.createdAt)))
          .orderBy(desc(notifications.createdAt))
          .limit(20);
      }
    }
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    if (ids && ids.length > 0) {
      for (const id of ids) {
        await db.update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
      }
    } else {
      await db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result?.cnt ?? 0);
  }

  // ─── 반 대항전 ─────────────────────────────────────────────────

  async getClassBattleStandings(schoolId: string, grade: number, month: string): Promise<{ classNum: number; totalPoints: number; submissionCount: number; participantCount: number }[]> {
    const [year, mon] = month.split("-");
    const monthStart = `${year}-${mon}-01`;
    const nextMonth = new Date(Number(year), Number(mon), 1).toISOString().split("T")[0];

    const rows = await db.select({
      classNum: users.classNum,
      totalPoints: sum(cleanPlateSubmissions.pointsAwarded),
      submissionCount: count(cleanPlateSubmissions.id),
      participantCount: count(cleanPlateSubmissions.userId),
    })
      .from(cleanPlateSubmissions)
      .innerJoin(users, eq(users.id, cleanPlateSubmissions.userId))
      .where(and(
        eq(cleanPlateSubmissions.schoolId, schoolId),
        eq(users.grade, grade),
        gte(cleanPlateSubmissions.date, monthStart),
        lt(cleanPlateSubmissions.date, nextMonth),
        or(
          eq(cleanPlateSubmissions.status, "APPROVED"),
          eq(cleanPlateSubmissions.status, "AUTO_APPROVED"),
        ),
      ))
      .groupBy(users.classNum)
      .orderBy(desc(sum(cleanPlateSubmissions.pointsAwarded)));

    return rows.map((r) => ({
      classNum: r.classNum,
      totalPoints: Number(r.totalPoints ?? 0),
      submissionCount: Number(r.submissionCount ?? 0),
      participantCount: Number(r.participantCount ?? 0),
    }));
  }

  async getClassBattleAwards(schoolId: string, grade: number): Promise<ClassBattleAward[]> {
    return await db.select().from(classBattleAwards)
      .where(and(eq(classBattleAwards.schoolId, schoolId), eq(classBattleAwards.grade, grade)))
      .orderBy(desc(classBattleAwards.month))
      .limit(12);
  }

  async awardClassBattleBonus(schoolId: string, grade: number, month: string, adminId: string, bonusPoints: number = CLASS_BATTLE_BONUS_POINTS): Promise<ClassBattleAward> {
    const standings = await this.getClassBattleStandings(schoolId, grade, month);
    if (standings.length === 0) throw new Error("해당 월에 참여 기록이 없습니다.");

    const winner = standings[0];

    return await db.transaction(async (tx) => {
      const winners = await tx.select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.schoolId, schoolId),
          eq(users.grade, grade),
          eq(users.classNum, winner.classNum),
        ));

      for (const u of winners) {
        await tx.insert(pointLedger).values({
          userId: u.id,
          delta: bonusPoints,
          reason: `CLASS_BATTLE_WIN_${month}`,
          refId: `battle_${schoolId}_${grade}_${month}`,
        });
        const result = await tx.select({ total: sum(pointLedger.delta) }).from(pointLedger).where(eq(pointLedger.userId, u.id));
        await tx.update(users).set({ points: Number(result[0]?.total ?? 0) }).where(eq(users.id, u.id));
      }

      const [award] = await tx.insert(classBattleAwards).values({
        schoolId,
        grade,
        month,
        winnerClassNum: winner.classNum,
        totalCleanplatePoints: winner.totalPoints,
        bonusPoints,
        studentCount: winners.length,
        awardedByUserId: adminId,
      }).returning();

      return award;
    });
  }

  // ─── 포인트 스토어 ─────────────────────────────────────────────

  async getStoreItems(schoolId: string, includeInactive = false): Promise<StoreItem[]> {
    const conditions = includeInactive
      ? eq(storeItems.schoolId, schoolId)
      : and(eq(storeItems.schoolId, schoolId), eq(storeItems.isActive, true));
    return await db.select().from(storeItems).where(conditions).orderBy(desc(storeItems.createdAt));
  }

  async getStoreItem(id: string): Promise<StoreItem | undefined> {
    const [item] = await db.select().from(storeItems).where(eq(storeItems.id, id));
    return item;
  }

  async createStoreItem(data: {
    schoolId: string; name: string; description?: string | null; imageUrl?: string | null;
    category: string; pricePoints: number; stock?: number | null;
    perUserDailyLimit?: number | null; isActive: boolean; createdByUserId: string;
  }): Promise<StoreItem> {
    const [item] = await db.insert(storeItems).values({
      schoolId: data.schoolId,
      name: data.name,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      category: data.category,
      pricePoints: data.pricePoints,
      stock: data.stock ?? null,
      perUserDailyLimit: data.perUserDailyLimit ?? null,
      isActive: data.isActive,
      createdByUserId: data.createdByUserId,
    }).returning();
    return item;
  }

  async updateStoreItem(id: string, data: Partial<{
    name: string; description: string | null; imageUrl: string | null; category: string;
    pricePoints: number; stock: number | null; perUserDailyLimit: number | null; isActive: boolean;
  }>): Promise<StoreItem> {
    const [item] = await db.update(storeItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(storeItems.id, id))
      .returning();
    return item;
  }

  async redeemItem(userId: string, schoolId: string, itemId: string, quantity: number): Promise<{ redemption: Redemption; newPoints: number }> {
    return await db.transaction(async (tx) => {
      // 상품 조회 및 잠금
      const [item] = await tx.select().from(storeItems)
        .where(and(eq(storeItems.id, itemId), eq(storeItems.schoolId, schoolId), eq(storeItems.isActive, true)));
      if (!item) throw new Error("상품을 찾을 수 없습니다");

      // 재고 체크
      if (item.stock !== null && item.stock < quantity) throw new Error("재고가 부족합니다");

      // 일일 한도 체크
      if (item.perUserDailyLimit !== null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [{ cnt }] = await tx.select({ cnt: count() }).from(redemptions)
          .where(and(
            eq(redemptions.userId, userId),
            eq(redemptions.itemId, itemId),
            gte(redemptions.createdAt, today),
          ));
        if (Number(cnt) + quantity > item.perUserDailyLimit) throw new Error("일일 교환 한도를 초과했습니다");
      }

      // 포인트 체크
      const [user] = await tx.select({ points: users.points }).from(users).where(eq(users.id, userId));
      const totalCost = item.pricePoints * quantity;
      if ((user?.points ?? 0) < totalCost) throw new Error("포인트가 부족합니다");

      // Redemption 생성
      const [redemption] = await tx.insert(redemptions).values({
        schoolId,
        userId,
        itemId,
        quantity,
        pointsSpent: totalCost,
        status: "REQUESTED",
      }).returning();

      // 포인트 차감 원장
      await tx.insert(pointLedger).values({
        userId,
        delta: -totalCost,
        reason: "STORE_REDEEM",
        refId: redemption.id,
      });

      // 포인트 업데이트
      const newPoints = (user?.points ?? 0) - totalCost;
      await tx.update(users).set({ points: newPoints }).where(eq(users.id, userId));

      // 재고 감소
      if (item.stock !== null) {
        await tx.update(storeItems)
          .set({ stock: item.stock - quantity, updatedAt: new Date() })
          .where(eq(storeItems.id, itemId));
      }

      return { redemption, newPoints };
    });
  }

  async getUserRedemptions(userId: string): Promise<(Redemption & { itemName: string; itemCategory: string })[]> {
    const rows = await db
      .select({
        id: redemptions.id,
        schoolId: redemptions.schoolId,
        userId: redemptions.userId,
        itemId: redemptions.itemId,
        quantity: redemptions.quantity,
        pointsSpent: redemptions.pointsSpent,
        status: redemptions.status,
        adminNote: redemptions.adminNote,
        processedByUserId: redemptions.processedByUserId,
        processedAt: redemptions.processedAt,
        createdAt: redemptions.createdAt,
        updatedAt: redemptions.updatedAt,
        itemName: storeItems.name,
        itemCategory: storeItems.category,
      })
      .from(redemptions)
      .innerJoin(storeItems, eq(redemptions.itemId, storeItems.id))
      .where(eq(redemptions.userId, userId))
      .orderBy(desc(redemptions.createdAt));
    return rows;
  }

  async getSchoolRedemptions(schoolId: string, status?: string): Promise<(Redemption & { itemName: string; studentNumber: number; grade: number; classNum: number })[]> {
    const conditions = status
      ? and(eq(redemptions.schoolId, schoolId), eq(redemptions.status, status as any))
      : eq(redemptions.schoolId, schoolId);
    const rows = await db
      .select({
        id: redemptions.id,
        schoolId: redemptions.schoolId,
        userId: redemptions.userId,
        itemId: redemptions.itemId,
        quantity: redemptions.quantity,
        pointsSpent: redemptions.pointsSpent,
        status: redemptions.status,
        adminNote: redemptions.adminNote,
        processedByUserId: redemptions.processedByUserId,
        processedAt: redemptions.processedAt,
        createdAt: redemptions.createdAt,
        updatedAt: redemptions.updatedAt,
        itemName: storeItems.name,
        studentNumber: users.studentNumber,
        grade: users.grade,
        classNum: users.classNum,
      })
      .from(redemptions)
      .innerJoin(storeItems, eq(redemptions.itemId, storeItems.id))
      .innerJoin(users, eq(redemptions.userId, users.id))
      .where(conditions)
      .orderBy(desc(redemptions.createdAt));
    return rows;
  }

  async processRedemption(id: string, adminId: string, status: string, adminNote?: string | null): Promise<Redemption> {
    return await db.transaction(async (tx) => {
      // 현재 교환 건 조회
      const [existing] = await tx.select().from(redemptions).where(eq(redemptions.id, id));
      if (!existing) throw new Error("교환 요청을 찾을 수 없습니다");

      // 중복 취소 방지
      if (existing.status === "CANCELLED") throw new Error("이미 취소된 교환 요청입니다");

      // 수령 완료 건은 취소 불가
      if (existing.status === "COMPLETED" && status === "CANCELLED") {
        throw new Error("이미 수령 완료된 교환은 취소할 수 없습니다");
      }

      // 취소 시 환불 처리
      if (status === "CANCELLED") {
        // 포인트 환불 원장
        await tx.insert(pointLedger).values({
          userId: existing.userId,
          delta: existing.pointsSpent,
          reason: "STORE_REFUND",
          refId: existing.id,
        });

        // 유저 포인트 복구
        const [user] = await tx.select({ points: users.points }).from(users).where(eq(users.id, existing.userId));
        const refundedPoints = (user?.points ?? 0) + existing.pointsSpent;
        await tx.update(users).set({ points: refundedPoints }).where(eq(users.id, existing.userId));

        // 재고 복구 (유한 재고 상품만)
        const [item] = await tx.select({ stock: storeItems.stock }).from(storeItems).where(eq(storeItems.id, existing.itemId));
        if (item?.stock !== null && item?.stock !== undefined) {
          await tx.update(storeItems)
            .set({ stock: item.stock + existing.quantity, updatedAt: new Date() })
            .where(eq(storeItems.id, existing.itemId));
        }
      }

      // 상태 업데이트
      const [updated] = await tx.update(redemptions)
        .set({
          status: status as any,
          adminNote: adminNote ?? null,
          processedByUserId: adminId,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(redemptions.id, id))
        .returning();
      return updated;
    });
  }

  // ─── 감사 로그 ─────────────────────────────────────────────────

  async createAuditLog(data: {
    schoolId?: string | null;
    actorUserId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    meta?: unknown;
  }): Promise<void> {
    await db.insert(auditLogs).values({
      schoolId: data.schoolId ?? null,
      actorUserId: data.actorUserId ?? null,
      action: data.action,
      targetType: data.targetType ?? null,
      targetId: data.targetId ?? null,
      meta: data.meta ?? null,
    });
  }
}

export const storage = new DatabaseStorage();
