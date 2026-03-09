export type AuthUser = {
  id: string;
  schoolId: string;
  schoolName: string;
  officeCode: string;
  schoolCode: string;
  grade: number;
  classNum: number;
  studentNumber: number;
  heightCm: number | null;
  weightKg: number | null;
  allergies: string[];
  points: number;
  role: "USER" | "ADMIN";
};

export type SchoolCandidate = {
  name: string;
  officeCode: string;
  schoolCode: string;
  address: string;
};

export type MealData = {
  ok: boolean;
  date: string;
  menuText: string;
  source: "cache" | "neis" | "mock";
  mealImageUrl?: string | null;
};

export type StoreItem = {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  pricePoints: number;
  stock: number | null;
  perUserDailyLimit: number | null;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Redemption = {
  id: string;
  schoolId: string;
  userId: string;
  itemId: string;
  quantity: number;
  pointsSpent: number;
  status: "REQUESTED" | "APPROVED" | "READY" | "COMPLETED" | "CANCELLED";
  adminNote: string | null;
  processedByUserId: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RedemptionWithItem = Redemption & {
  itemName: string;
  itemCategory: string;
};

export type CleanPlateSubmission = {
  id: string;
  userId: string;
  schoolId: string;
  date: string;
  imageUrl: string;
  imageKey: string;
  imageHash: string | null;
  status: "PENDING" | "AUTO_APPROVED" | "APPROVED" | "REJECTED";
  aiScore: number | null;
  aiResult: unknown;
  pointsAwarded: number;
  reviewNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type BuddyMatch = {
  id: string;
  schoolId: string;
  grade: number;
  userLessId: string;
  userMoreId: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  pointsAwarded: number;
  completedAt: string | null;
  createdAt: string;
};

export type BuddyMessage = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type BuddyRevealConsent = {
  id: string;
  matchId: string;
  requesterId: string;
  responderId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  respondedAt: string | null;
};

export type UserReport = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  matchId: string | null;
  messageId: string | null;
  reason: "HARASSMENT" | "SPAM" | "PRIVACY" | "INAPPROPRIATE" | "OTHER";
  detail: string | null;
  status: "OPEN" | "REVIEWED" | "ACTIONED" | "DISMISSED";
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  isRead: boolean;
  createdAt: string;
};
