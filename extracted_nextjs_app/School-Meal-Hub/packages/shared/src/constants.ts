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

export const ALLERGY_NEIS_MAP: Record<string, string[]> = {
  "1": ["난류", "계란"],
  "2": ["우유"],
  "3": ["메밀"],
  "4": ["땅콩"],
  "5": ["대두", "콩"],
  "6": ["밀"],
  "7": ["고등어"],
  "8": ["게"],
  "9": ["새우"],
  "10": ["돼지"],
  "11": ["복숭아"],
  "12": ["토마토"],
  "13": ["아황산"],
  "14": ["호두"],
  "15": ["닭고기"],
  "16": ["쇠고기"],
  "17": ["오징어"],
  "18": ["조개"],
};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "실물":  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "쿠폰":  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "특권":  { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF" },
  "식권":  { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "기타":  { bg: "#F9FAFB", text: "#374151", border: "#E5E7EB" },
};

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  REQUESTED: { label: "접수됨",   bg: "#FEFCE8", text: "#A16207" },
  APPROVED:  { label: "승인됨",   bg: "#EFF6FF", text: "#1D4ED8" },
  READY:     { label: "수령 가능", bg: "#F0FDF4", text: "#15803D" },
  COMPLETED: { label: "수령 완료", bg: "#F9FAFB", text: "#6B7280" },
  CANCELLED: { label: "취소됨",   bg: "#FFF1F2", text: "#BE123C" },
};

export const CLEAN_PLATE_POINTS = 100;
export const BUDDY_MATCH_POINTS = 100;
export const CLASS_BATTLE_BONUS_POINTS = 200;

export const REPORT_REASON_LABELS: Record<string, string> = {
  HARASSMENT:   "괴롭힘",
  SPAM:         "스팸",
  PRIVACY:      "개인정보 침해",
  INAPPROPRIATE:"부적절한 내용",
  OTHER:        "기타",
};

export const MODERATION_ACTION_LABELS: Record<string, string> = {
  WARN:                 "경고",
  SUSPEND_MATCHING_7D:  "매칭 7일 정지",
  SUSPEND_ACCOUNT_7D:   "계정 7일 정지",
  BAN:                  "영구 차단",
};
