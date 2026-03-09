import type { IStorage } from "./storage";
import type { User } from "@shared/schema";

export const BUDDY_POINTS = 100;
export const QUEUE_COOLDOWN_MS = 5 * 60 * 1000; // 5분
export const RATE_LIMIT_WINDOW_MS = 10 * 1000;  // 10초
export const RATE_LIMIT_MAX = 3;                  // 10초 내 최대 3개

// ─── 콘텐츠 필터 ──────────────────────────────────────────────────
export const CONTENT_FILTERS = [
  /\d{3}[-\s]?\d{3,4}[-\s]?\d{4}/,           // 전화번호 패턴
  /오픈카톡|오카|open\s*kakao/i,               // 오픈카톡 유도
  /카카오\s*아이디|카톡\s*아이디|kakao\s*id/i, // 카카오 ID
  /텔레그램|telegram/i,                         // 텔레그램
  /인스타|instagram|instargram/i,              // 인스타그램
  /라인\s*아이디|line\s*id/i,                  // 라인
  /디스코드|discord/i,                          // 디스코드
];

export function filterContent(text: string): boolean {
  return CONTENT_FILTERS.some((pattern) => pattern.test(text));
}

// ─── 큐 참가 ──────────────────────────────────────────────────────
export async function joinQueue(
  userId: string,
  user: User,
  preference: "LESS" | "MORE",
  storage: IStorage,
): Promise<{ state: "WAITING" | "MATCHED"; matchId?: string }> {
  const now = new Date();

  // 계정 정지 체크
  if (user.accountSuspendedUntil && user.accountSuspendedUntil > now) {
    const until = user.accountSuspendedUntil.toLocaleDateString("ko-KR");
    throw new Error(`계정이 ${until}까지 정지되었습니다.`);
  }

  // 매칭 정지 체크
  if (user.matchingSuspendedUntil && user.matchingSuspendedUntil > now) {
    const until = user.matchingSuspendedUntil.toLocaleDateString("ko-KR");
    throw new Error(`Food Buddy 이용이 ${until}까지 제한되었습니다.`);
  }

  // 이미 활성 매칭이 있으면 에러
  const activeMatch = await storage.getActiveBuddyMatch(userId);
  if (activeMatch) {
    throw new Error("이미 진행 중인 매칭이 있습니다.");
  }

  // 이미 WAITING 큐가 있으면 반환
  const existingQueue = await storage.getBuddyQueue(userId);
  if (existingQueue) {
    return { state: "WAITING" };
  }

  // 큐 참가
  await storage.joinBuddyQueue(userId, user.schoolId, user.grade, user.classNum, preference);

  // 즉시 매칭 시도
  const match = await storage.tryMatch(user.schoolId, user.grade);
  if (match) {
    // 양쪽에 알림 발송
    await storage.createNotification(
      match.userLessId,
      "BUDDY_MATCHED",
      "🎉 Food Buddy 매칭 완료!",
      "익명 학생과 연결되었어요. 채팅을 시작해보세요.",
      `/buddy/match/${match.id}`,
    );
    await storage.createNotification(
      match.userMoreId,
      "BUDDY_MATCHED",
      "🎉 Food Buddy 매칭 완료!",
      "익명 학생과 연결되었어요. 채팅을 시작해보세요.",
      `/buddy/match/${match.id}`,
    );

    const myMatchId = match.id;
    return { state: "MATCHED", matchId: myMatchId };
  }

  return { state: "WAITING" };
}

// ─── 큐 이탈 ──────────────────────────────────────────────────────
export async function leaveQueue(userId: string, storage: IStorage): Promise<void> {
  await storage.leaveBuddyQueue(userId);
}

// ─── 익명 표시명 생성 ─────────────────────────────────────────────
export function getAnonymousName(role: "LESS" | "MORE"): string {
  return role === "LESS" ? "적게 먹는 학생" : "많이 먹는 학생";
}

// ─── 공개 여부 체크 (양방향 ACCEPTED) ────────────────────────────
export function isRevealComplete(
  consents: { requesterId: string; responderId: string; status: string }[],
  userA: string,
  userB: string,
): boolean {
  const aToB = consents.find((c) => c.requesterId === userA && c.responderId === userB && c.status === "ACCEPTED");
  const bToA = consents.find((c) => c.requesterId === userB && c.responderId === userA && c.status === "ACCEPTED");
  return !!(aToB && bToA);
}

// ─── 매칭에서 상대 ID 가져오기 ────────────────────────────────────
export function getOpponentId(match: { userLessId: string; userMoreId: string }, userId: string): string {
  return match.userLessId === userId ? match.userMoreId : match.userLessId;
}

// ─── 매칭 참가자인지 체크 ─────────────────────────────────────────
export function isParticipant(match: { userLessId: string; userMoreId: string }, userId: string): boolean {
  return match.userLessId === userId || match.userMoreId === userId;
}
