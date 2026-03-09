import {
  users, schools, mealCache, mealFeedback, pointLedger, cleanPlateSubmissions,
  buddyQueues, buddyMatches, buddyMessages, buddyRevealConsents, userBlocks,
  userReports, moderationActions, notifications, classBattleAwards, storeItems,
  redemptions, auditLogs, devices, sessionEvents,
  type User, type School, type MealCache, type CleanPlateSubmission,
  type BuddyQueue, type BuddyMatch, type BuddyMessage, type BuddyRevealConsent,
  type UserBlock, type UserReport, type ModerationAction, type Notification,
  type ClassBattleAward, type StoreItem, type Redemption, type Device, type SessionEvent,
  type InsertUser, type InsertSchool,
  CLEAN_PLATE_POINTS, BUDDY_MATCH_POINTS, CLASS_BATTLE_BONUS_POINTS,
} from "./schema";
import { db } from "./db";
import { eq, and, desc, sum, gte, lt, or, ne, count } from "drizzle-orm";

type MealFeedback = typeof mealFeedback.$inferSelect;

class DatabaseStorage {
  async getActiveSchools(): Promise<School[]> {
    const rows = await db
      .selectDistinctOn([schools.id], {
        id: schools.id,
        name: schools.name,
        officeCode: schools.officeCode,
        schoolCode: schools.schoolCode,
        address: schools.address,
        createdAt: schools.createdAt,
        updatedAt: schools.updatedAt,
      })
      .from(schools)
      .innerJoin(users, eq(users.schoolId, schools.id))
      .orderBy(schools.id);
    return rows;
  }

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
        const [updated] = await db.update(schools).set({ name: s.name, updatedAt: new Date() }).where(eq(schools.id, existing.id)).returning();
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
      and(eq(users.schoolId, schoolId), eq(users.grade, grade), eq(users.classNum, classNum), eq(users.studentNumber, studentNumber))
    );
    return user;
  }

  async createUser(u: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(u).returning();
    return user;
  }

  async getMealCache(schoolId: string, date: string): Promise<MealCache | undefined> {
    const [row] = await db.select().from(mealCache).where(and(eq(mealCache.schoolId, schoolId), eq(mealCache.date, date)));
    return row;
  }

  async saveMealCache(schoolId: string, date: string, menuText: string, raw?: unknown): Promise<MealCache> {
    const [row] = await db.insert(mealCache)
      .values({ schoolId, date, menuText, raw: raw ?? null })
      .onConflictDoUpdate({ target: [mealCache.schoolId, mealCache.date], set: { menuText, raw: raw ?? null } })
      .returning();
    return row;
  }

  async updateMealImageUrl(schoolId: string, date: string, imageUrl: string): Promise<void> {
    await db.update(mealCache).set({ mealImageUrl: imageUrl }).where(and(eq(mealCache.schoolId, schoolId), eq(mealCache.date, date)));
  }

  async createFeedbackWithPoints(userId: string, schoolId: string, date: string, rating: number, comment: string | null): Promise<{ feedback: MealFeedback; newPoints: number }> {
    return await db.transaction(async (tx) => {
      const [feedback] = await tx.insert(mealFeedback).values({ userId, schoolId, date, rating, comment }).returning();
      await tx.insert(pointLedger).values({ userId, delta: 30, reason: "MEAL_FEEDBACK", refId: feedback.id });
      const result = await tx.select({ total: sum(pointLedger.delta) }).from(pointLedger).where(eq(pointLedger.userId, userId));
      const newPoints = Number(result[0]?.total ?? 0);
      await tx.update(users).set({ points: newPoints }).where(eq(users.id, userId));
      return { feedback, newPoints };
    });
  }

  async getUserFeedbackForDate(userId: string, date: string): Promise<MealFeedback | undefined> {
    const [row] = await db.select().from(mealFeedback).where(and(eq(mealFeedback.userId, userId), eq(mealFeedback.date, date)));
    return row;
  }

  async getMealFeedbackWithMenu(userId: string, schoolId: string, days: number): Promise<{ rating: number; menuText: string; date: string }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];
    return await db.select({ rating: mealFeedback.rating, menuText: mealCache.menuText, date: mealFeedback.date })
      .from(mealFeedback)
      .innerJoin(mealCache, and(eq(mealCache.schoolId, schoolId), eq(mealCache.date, mealFeedback.date)))
      .where(and(eq(mealFeedback.userId, userId), gte(mealFeedback.date, sinceStr)))
      .orderBy(desc(mealFeedback.createdAt)).limit(30);
  }

  async getClassRanking(schoolId: string, grade: number, classNum: number): Promise<{ studentNumber: number; points: number }[]> {
    return await db.select({ studentNumber: users.studentNumber, points: users.points })
      .from(users).where(and(eq(users.schoolId, schoolId), eq(users.grade, grade), eq(users.classNum, classNum)))
      .orderBy(desc(users.points)).limit(20);
  }

  async getSchoolRanking(schoolId: string): Promise<{ grade: number; classNum: number; studentNumber: number; points: number }[]> {
    return await db.select({ grade: users.grade, classNum: users.classNum, studentNumber: users.studentNumber, points: users.points })
      .from(users).where(eq(users.schoolId, schoolId)).orderBy(desc(users.points)).limit(20);
  }

  async getCleanPlatesByUserAndDate(userId: string, date: string): Promise<CleanPlateSubmission[]> {
    return await db.select().from(cleanPlateSubmissions)
      .where(and(eq(cleanPlateSubmissions.userId, userId), eq(cleanPlateSubmissions.date, date)))
      .orderBy(desc(cleanPlateSubmissions.createdAt));
  }

  async createCleanPlate(data: { userId: string; schoolId: string; date: string; imageUrl: string; imageKey: string; imageHash?: string }): Promise<CleanPlateSubmission> {
    const [submission] = await db.insert(cleanPlateSubmissions).values(data).returning();
    return submission;
  }

  async createFraudCleanPlate(data: { userId: string; schoolId: string; date: string; imageUrl: string; imageKey: string; imageHash: string }): Promise<CleanPlateSubmission> {
    const [submission] = await db.insert(cleanPlateSubmissions).values({ ...data, status: "REJECTED", reviewNote: "FRAUD:DUPLICATE_IMAGE" }).returning();
    return submission;
  }

  async autoApproveCleanPlate(id: string, aiScore: number, aiResult: unknown, points = CLEAN_PLATE_POINTS): Promise<{ submission: CleanPlateSubmission; newPoints: number }> {
    return await db.transaction(async (tx) => {
      const [submission] = await tx.update(cleanPlateSubmissions)
        .set({ status: "AUTO_APPROVED", aiScore, aiResult: aiResult as any, pointsAwarded: points })
        .where(eq(cleanPlateSubmissions.id, id)).returning();
      await tx.insert(pointLedger).values({ userId: submission.userId, delta: points, reason: "CLEANPLATE_AUTO_APPROVED", refId: id });
      const result = await tx.select({ total: sum(pointLedger.delta) }).from(pointLedger).where(eq(pointLedger.userId, submission.userId));
      const newPoints = Number(result[0]?.total ?? 0);
      await tx.update(users).set({ points: newPoints }).where(eq(users.id, submission.userId));
      return { submission, newPoints };
    });
  }

  async rejectCleanPlate(id: string, aiScore: number, aiResult: unknown): Promise<CleanPlateSubmission> {
    const [submission] = await db.update(cleanPlateSubmissions)
      .set({ status: "REJECTED", aiScore, aiResult: aiResult as any })
      .where(eq(cleanPlateSubmissions.id, id)).returning();
    return submission;
  }

  async updateCleanPlateAiResult(id: string, aiScore: number, aiResult: unknown): Promise<CleanPlateSubmission> {
    const [submission] = await db.update(cleanPlateSubmissions).set({ aiScore, aiResult: aiResult as any }).where(eq(cleanPlateSubmissions.id, id)).returning();
    return submission;
  }

  async getCleanPlateHistory(userId: string, days: number): Promise<CleanPlateSubmission[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return await db.select().from(cleanPlateSubmissions)
      .where(and(eq(cleanPlateSubmissions.userId, userId), gte(cleanPlateSubmissions.date, since.toISOString().split("T")[0])))
      .orderBy(desc(cleanPlateSubmissions.date)).limit(days);
  }

  async getPendingCleanPlates(schoolId: string): Promise<(CleanPlateSubmission & { studentNumber: number })[]> {
    return await db.select({
      id: cleanPlateSubmissions.id, userId: cleanPlateSubmissions.userId, schoolId: cleanPlateSubmissions.schoolId,
      date: cleanPlateSubmissions.date, imageUrl: cleanPlateSubmissions.imageUrl, imageKey: cleanPlateSubmissions.imageKey,
      imageHash: cleanPlateSubmissions.imageHash, status: cleanPlateSubmissions.status, aiScore: cleanPlateSubmissions.aiScore,
      aiResult: cleanPlateSubmissions.aiResult, pointsAwarded: cleanPlateSubmissions.pointsAwarded,
      reviewNote: cleanPlateSubmissions.reviewNote, reviewedByUserId: cleanPlateSubmissions.reviewedByUserId,
      reviewedAt: cleanPlateSubmissions.reviewedAt, createdAt: cleanPlateSubmissions.createdAt,
      studentNumber: users.studentNumber,
    }).from(cleanPlateSubmissions)
      .innerJoin(users, eq(users.id, cleanPlateSubmissions.userId))
      .where(and(eq(cleanPlateSubmissions.schoolId, schoolId), eq(cleanPlateSubmissions.status, "PENDING")))
      .orderBy(desc(cleanPlateSubmissions.createdAt)).limit(50);
  }

  async adminApproveCleanPlate(id: string, reviewerId: string, note: string | null, customPoints?: number): Promise<{ submission: CleanPlateSubmission; newPoints: number }> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(cleanPlateSubmissions).where(eq(cleanPlateSubmissions.id, id));
      if (!existing) throw new Error("제출 내역을 찾을 수 없습니다.");
      const awardPoints = customPoints ?? (existing.pointsAwarded === 0 ? CLEAN_PLATE_POINTS : existing.pointsAwarded);
      const [submission] = await tx.update(cleanPlateSubmissions)
        .set({ status: "APPROVED", reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewNote: note, pointsAwarded: awardPoints })
        .where(eq(cleanPlateSubmissions.id, id)).returning();
      if (existing.pointsAwarded === 0) {
        await tx.insert(pointLedger).values({ userId: existing.userId, delta: awardPoints, reason: "CLEANPLATE_APPROVED", refId: id });
        const result = await tx.select({ total: sum(pointLedger.delta) }).from(pointLedger).where(eq(pointLedger.userId, existing.userId));
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
      .set({ status: "REJECTED", reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewNote: note })
      .where(eq(cleanPlateSubmissions.id, id)).returning();
    return submission;
  }

  async joinBuddyQueue(userId: string, schoolId: string, grade: number, classNum: number, preference: "LESS" | "MORE"): Promise<BuddyQueue> {
    const [existing] = await db.select().from(buddyQueues).where(and(eq(buddyQueues.userId, userId), eq(buddyQueues.status, "WAITING"))).limit(1);
    if (existing) return existing;
    const [queue] = await db.insert(buddyQueues).values({ userId, schoolId, grade, classNum, preference, status: "WAITING" }).returning();
    return queue;
  }

  async leaveBuddyQueue(userId: string): Promise<void> {
    await db.update(buddyQueues).set({ status: "CANCELLED", updatedAt: new Date() })
      .where(and(eq(buddyQueues.userId, userId), eq(buddyQueues.status, "WAITING")));
  }

  async getBuddyQueue(userId: string): Promise<BuddyQueue | undefined> {
    const [queue] = await db.select().from(buddyQueues).where(and(eq(buddyQueues.userId, userId), eq(buddyQueues.status, "WAITING"))).limit(1);
    return queue;
  }

  async tryMatch(schoolId: string, grade: number): Promise<BuddyMatch | null> {
    return await db.transaction(async (tx) => {
      const [lessEntry] = await tx.select().from(buddyQueues)
        .where(and(eq(buddyQueues.schoolId, schoolId), eq(buddyQueues.grade, grade), eq(buddyQueues.preference, "LESS"), eq(buddyQueues.status, "WAITING")))
        .orderBy(buddyQueues.createdAt).limit(1);
      const [moreEntry] = await tx.select().from(buddyQueues)
        .where(and(eq(buddyQueues.schoolId, schoolId), eq(buddyQueues.grade, grade), eq(buddyQueues.preference, "MORE"), eq(buddyQueues.status, "WAITING")))
        .orderBy(buddyQueues.createdAt).limit(1);
      if (!lessEntry || !moreEntry || lessEntry.userId === moreEntry.userId) return null;
      await tx.update(buddyQueues).set({ status: "MATCHED", updatedAt: new Date() })
        .where(or(eq(buddyQueues.id, lessEntry.id), eq(buddyQueues.id, moreEntry.id)));
      const [match] = await tx.insert(buddyMatches).values({ schoolId, grade, userLessId: lessEntry.userId, userMoreId: moreEntry.userId }).returning();
      return match;
    });
  }

  async getActiveMatchForUser(userId: string): Promise<BuddyMatch | undefined> {
    const [match] = await db.select().from(buddyMatches)
      .where(and(or(eq(buddyMatches.userLessId, userId), eq(buddyMatches.userMoreId, userId)), eq(buddyMatches.status, "ACTIVE")))
      .orderBy(desc(buddyMatches.createdAt)).limit(1);
    return match;
  }

  async getBuddyMatch(id: string): Promise<BuddyMatch | undefined> {
    const [match] = await db.select().from(buddyMatches).where(eq(buddyMatches.id, id));
    return match;
  }

  async getBuddyMessages(matchId: string): Promise<BuddyMessage[]> {
    return await db.select().from(buddyMessages).where(eq(buddyMessages.matchId, matchId)).orderBy(buddyMessages.createdAt).limit(100);
  }

  async createBuddyMessage(matchId: string, senderId: string, body: string): Promise<BuddyMessage> {
    const [msg] = await db.insert(buddyMessages).values({ matchId, senderId, body }).returning();
    return msg;
  }

  async requestReveal(matchId: string, requesterId: string, targetId: string): Promise<BuddyRevealConsent> {
    const [existing] = await db.select().from(buddyRevealConsents)
      .where(and(eq(buddyRevealConsents.matchId, matchId), eq(buddyRevealConsents.requesterId, requesterId))).limit(1);
    if (existing) return existing;
    const [consent] = await db.insert(buddyRevealConsents).values({ matchId, requesterId, targetId, status: "PENDING" }).returning();
    return consent;
  }

  async respondReveal(consentId: string, accept: boolean): Promise<BuddyRevealConsent> {
    const [consent] = await db.update(buddyRevealConsents)
      .set({ status: accept ? "ACCEPTED" : "REJECTED", updatedAt: new Date() })
      .where(eq(buddyRevealConsents.id, consentId)).returning();
    return consent;
  }

  async getRevealConsents(matchId: string): Promise<BuddyRevealConsent[]> {
    return await db.select().from(buddyRevealConsents).where(eq(buddyRevealConsents.matchId, matchId));
  }

  async completeMatch(matchId: string): Promise<{ match: BuddyMatch; pointsEach: number }> {
    return await db.transaction(async (tx) => {
      const [match] = await tx.update(buddyMatches)
        .set({ status: "COMPLETED", completedAt: new Date(), pointsAwarded: BUDDY_MATCH_POINTS })
        .where(eq(buddyMatches.id, matchId)).returning();
      for (const uid of [match.userLessId, match.userMoreId]) {
        await tx.insert(pointLedger).values({ userId: uid, delta: BUDDY_MATCH_POINTS, reason: "BUDDY_COMPLETE", refId: matchId });
        const result = await tx.select({ total: sum(pointLedger.delta) }).from(pointLedger).where(eq(pointLedger.userId, uid));
        await tx.update(users).set({ points: Number(result[0]?.total ?? 0) }).where(eq(users.id, uid));
      }
      return { match, pointsEach: BUDDY_MATCH_POINTS };
    });
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
  }

  async createReport(data: { reporterId: string; reportedUserId: string; matchId?: string; reason: string; detail?: string }): Promise<UserReport> {
    const [report] = await db.insert(userReports).values({
      reporterId: data.reporterId, reportedUserId: data.reportedUserId,
      matchId: data.matchId ?? null, reason: data.reason as any, detail: data.detail ?? null, status: "OPEN",
    }).returning();
    return report;
  }

  async getOpenReports(schoolId: string): Promise<any[]> {
    return await db.select({
      id: userReports.id, reporterId: userReports.reporterId, reportedUserId: userReports.reportedUserId,
      matchId: userReports.matchId, reason: userReports.reason, detail: userReports.detail,
      status: userReports.status, createdAt: userReports.createdAt, reporterStudentNum: users.studentNumber,
    }).from(userReports).innerJoin(users, eq(users.id, userReports.reporterId))
      .where(and(eq(users.schoolId, schoolId), eq(userReports.status, "OPEN")))
      .orderBy(desc(userReports.createdAt)).limit(50);
  }

  async adminActOnReport(reportId: string, adminId: string, action: string, note: string | undefined, targetUserId: string): Promise<ModerationAction> {
    return await db.transaction(async (tx) => {
      await tx.update(userReports).set({ status: "ACTIONED", updatedAt: new Date() }).where(eq(userReports.id, reportId));
      const [modAction] = await tx.insert(moderationActions).values({ adminId, targetUserId, reportId, action: action as any, note: note ?? null }).returning();
      const now = new Date();
      if (action === "SUSPEND_MATCHING_7D") {
        await tx.update(users).set({ matchingSuspendedUntil: new Date(now.getTime() + 7 * 86400000) }).where(eq(users.id, targetUserId));
      } else if (action === "SUSPEND_ACCOUNT_7D") {
        await tx.update(users).set({ accountSuspendedUntil: new Date(now.getTime() + 7 * 86400000) }).where(eq(users.id, targetUserId));
      } else if (action === "BAN") {
        const forever = new Date("2099-01-01");
        await tx.update(users).set({ accountSuspendedUntil: forever, matchingSuspendedUntil: forever }).where(eq(users.id, targetUserId));
      }
      return modAction;
    });
  }

  async createNotification(userId: string, type: string, title: string, body: string, url?: string): Promise<Notification> {
    const [notif] = await db.insert(notifications).values({ userId, type: type as any, title, body, url: url ?? null }).returning();
    return notif;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    if (ids?.length) {
      for (const id of ids) {
        await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
      }
    } else {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
    }
  }

  async getClassBattleStats(schoolId: string, grade: number): Promise<{ classNum: number; totalPoints: number; memberCount: number }[]> {
    const rows = await db.select({ classNum: users.classNum, totalPoints: sum(users.points), memberCount: count() })
      .from(users).where(and(eq(users.schoolId, schoolId), eq(users.grade, grade)))
      .groupBy(users.classNum).orderBy(desc(sum(users.points)));
    return rows.map(r => ({ classNum: r.classNum, totalPoints: Number(r.totalPoints ?? 0), memberCount: Number(r.memberCount ?? 0) }));
  }

  async getRecentBattleAwards(schoolId: string, grade: number, limit = 5): Promise<ClassBattleAward[]> {
    return await db.select().from(classBattleAwards)
      .where(and(eq(classBattleAwards.schoolId, schoolId), eq(classBattleAwards.grade, grade)))
      .orderBy(desc(classBattleAwards.awardedAt)).limit(limit);
  }

  async awardClassBattle(schoolId: string, grade: number, winnerClassNum: number, runnerClassNum: number | undefined, periodStart: string, periodEnd: string, bonusPoints = CLASS_BATTLE_BONUS_POINTS): Promise<ClassBattleAward> {
    return await db.transaction(async (tx) => {
      const [award] = await tx.insert(classBattleAwards).values({ schoolId, grade, winnerClassNum, runnerClassNum: runnerClassNum ?? null, periodStart, periodEnd, bonusPoints }).returning();
      const winnerUsers = await tx.select({ id: users.id }).from(users).where(and(eq(users.schoolId, schoolId), eq(users.grade, grade), eq(users.classNum, winnerClassNum)));
      for (const u of winnerUsers) {
        await tx.insert(pointLedger).values({ userId: u.id, delta: bonusPoints, reason: "CLASS_BATTLE_WIN", refId: award.id });
        const result = await tx.select({ total: sum(pointLedger.delta) }).from(pointLedger).where(eq(pointLedger.userId, u.id));
        await tx.update(users).set({ points: Number(result[0]?.total ?? 0) }).where(eq(users.id, u.id));
      }
      return award;
    });
  }

  async getStoreItems(schoolId: string): Promise<StoreItem[]> {
    return await db.select().from(storeItems)
      .where(and(eq(storeItems.isActive, true), eq(storeItems.schoolId, schoolId)))
      .orderBy(storeItems.createdAt);
  }

  async getAdminStoreItems(schoolId: string): Promise<StoreItem[]> {
    return await db.select().from(storeItems).where(eq(storeItems.schoolId, schoolId)).orderBy(desc(storeItems.createdAt));
  }

  async createStoreItem(schoolId: string, data: any): Promise<StoreItem> {
    const [item] = await db.insert(storeItems).values({ schoolId, ...data }).returning();
    return item;
  }

  async updateStoreItem(id: string, data: any): Promise<StoreItem> {
    const [item] = await db.update(storeItems).set({ ...data, updatedAt: new Date() }).where(eq(storeItems.id, id)).returning();
    return item;
  }

  async redeemItem(userId: string, schoolId: string, itemId: string, quantity = 1): Promise<{ redemption: Redemption; newPoints: number }> {
    return await db.transaction(async (tx) => {
      const [item] = await tx.select().from(storeItems).where(eq(storeItems.id, itemId));
      if (!item || !item.isActive) throw new Error("상품을 찾을 수 없습니다");
      if (item.stock !== null && item.stock < quantity) throw new Error("재고가 부족합니다");
      if (item.perUserDailyLimit !== null) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [{ cnt }] = await tx.select({ cnt: count() }).from(redemptions)
          .where(and(eq(redemptions.userId, userId), eq(redemptions.itemId, itemId), gte(redemptions.createdAt, today)));
        if (Number(cnt) + quantity > item.perUserDailyLimit) throw new Error("일일 교환 한도를 초과했습니다");
      }
      const [user] = await tx.select({ points: users.points }).from(users).where(eq(users.id, userId));
      const totalCost = item.pricePoints * quantity;
      if ((user?.points ?? 0) < totalCost) throw new Error("포인트가 부족합니다");
      const [redemption] = await tx.insert(redemptions).values({ schoolId, userId, itemId, quantity, pointsSpent: totalCost, status: "REQUESTED" }).returning();
      await tx.insert(pointLedger).values({ userId, delta: -totalCost, reason: "STORE_REDEEM", refId: redemption.id });
      await tx.update(users).set({ points: (user?.points ?? 0) - totalCost }).where(eq(users.id, userId));
      if (item.stock !== null) {
        await tx.update(storeItems).set({ stock: item.stock - quantity, updatedAt: new Date() }).where(eq(storeItems.id, itemId));
      }
      return { redemption, newPoints: (user?.points ?? 0) - totalCost };
    });
  }

  async getUserRedemptions(userId: string): Promise<any[]> {
    return await db.select({
      id: redemptions.id, schoolId: redemptions.schoolId, userId: redemptions.userId, itemId: redemptions.itemId,
      quantity: redemptions.quantity, pointsSpent: redemptions.pointsSpent, status: redemptions.status,
      adminNote: redemptions.adminNote, processedByUserId: redemptions.processedByUserId, processedAt: redemptions.processedAt,
      createdAt: redemptions.createdAt, updatedAt: redemptions.updatedAt, itemName: storeItems.name, itemCategory: storeItems.category,
    }).from(redemptions).innerJoin(storeItems, eq(redemptions.itemId, storeItems.id))
      .where(eq(redemptions.userId, userId)).orderBy(desc(redemptions.createdAt));
  }

  async getSchoolRedemptions(schoolId: string): Promise<any[]> {
    return await db.select({
      id: redemptions.id, schoolId: redemptions.schoolId, userId: redemptions.userId, itemId: redemptions.itemId,
      quantity: redemptions.quantity, pointsSpent: redemptions.pointsSpent, status: redemptions.status,
      adminNote: redemptions.adminNote, processedByUserId: redemptions.processedByUserId, processedAt: redemptions.processedAt,
      createdAt: redemptions.createdAt, updatedAt: redemptions.updatedAt,
      itemName: storeItems.name, studentNumber: users.studentNumber, grade: users.grade, classNum: users.classNum,
    }).from(redemptions).innerJoin(storeItems, eq(redemptions.itemId, storeItems.id))
      .innerJoin(users, eq(redemptions.userId, users.id))
      .where(eq(redemptions.schoolId, schoolId)).orderBy(desc(redemptions.createdAt));
  }

  async processRedemption(id: string, adminId: string, status: string, adminNote?: string | null): Promise<Redemption> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(redemptions).where(eq(redemptions.id, id));
      if (!existing) throw new Error("교환 요청을 찾을 수 없습니다");
      if (existing.status === "CANCELLED") throw new Error("이미 취소된 교환 요청입니다");
      if (existing.status === "COMPLETED" && status === "CANCELLED") throw new Error("이미 수령 완료된 교환은 취소할 수 없습니다");
      if (status === "CANCELLED") {
        await tx.insert(pointLedger).values({ userId: existing.userId, delta: existing.pointsSpent, reason: "STORE_REFUND", refId: existing.id });
        const [user] = await tx.select({ points: users.points }).from(users).where(eq(users.id, existing.userId));
        await tx.update(users).set({ points: (user?.points ?? 0) + existing.pointsSpent }).where(eq(users.id, existing.userId));
        const [item] = await tx.select({ stock: storeItems.stock }).from(storeItems).where(eq(storeItems.id, existing.itemId));
        if (item?.stock !== null && item?.stock !== undefined) {
          await tx.update(storeItems).set({ stock: item.stock + existing.quantity, updatedAt: new Date() }).where(eq(storeItems.id, existing.itemId));
        }
      }
      const [updated] = await tx.update(redemptions)
        .set({ status: status as any, adminNote: adminNote ?? null, processedByUserId: adminId, processedAt: new Date(), updatedAt: new Date() })
        .where(eq(redemptions.id, id)).returning();
      return updated;
    });
  }
  async getDeviceByInstallId(installId: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.installId, installId));
    return device;
  }

  async upsertDevice(installId: string, meta: {
    platform?: string; appVersion?: string; deviceModel?: string; locale?: string; timezone?: string;
  }): Promise<Device> {
    const existing = await this.getDeviceByInstallId(installId);
    if (existing) {
      const [updated] = await db.update(devices)
        .set({ ...meta, lastSeenAt: new Date() })
        .where(eq(devices.id, existing.id))
        .returning();
      return updated;
    }
    const [device] = await db.insert(devices)
      .values({ installId, ...meta })
      .returning();
    return device;
  }

  async bindDeviceToUser(installId: string, userId: string): Promise<void> {
    await db.update(devices)
      .set({ userId, lastSeenAt: new Date() })
      .where(eq(devices.installId, installId));
  }

  async unbindDevice(installId: string): Promise<void> {
    await db.update(devices)
      .set({ userId: null })
      .where(eq(devices.installId, installId));
  }

  async createSessionEvent(data: {
    deviceId: string; userId?: string | null; schoolId?: string | null;
    eventType: "APP_OPEN" | "SESSION_RESUME" | "LOGIN" | "SIGNUP" | "LOGOUT" | "API_CALL";
    ipHash?: string | null; userAgent?: string | null; requestId?: string | null;
  }): Promise<SessionEvent> {
    const [event] = await db.insert(sessionEvents).values({
      deviceId: data.deviceId,
      userId: data.userId ?? null,
      schoolId: data.schoolId ?? null,
      eventType: data.eventType,
      ipHash: data.ipHash ?? null,
      userAgent: data.userAgent ?? null,
      requestId: data.requestId ?? null,
    }).returning();
    return event;
  }
}

export const storage = new DatabaseStorage();
