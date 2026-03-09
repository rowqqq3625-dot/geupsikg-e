# 급식E (School Meal Hub)

Korean school cafeteria gamification mobile app built with React Native + Expo SDK 54.

## Architecture

- **Frontend**: Expo SDK 54 (React Native) with expo-router for file-based navigation
- **Backend**: Express.js + TypeScript on port 5000
- **Database**: PostgreSQL via Drizzle ORM
- **Styling**: React Native StyleSheet (no Tailwind/NativeWind)
- **State**: React Query (@tanstack/react-query)
- **Auth**: Cookie-based sessions (express-session + connect-pg-simple)
- **Session Engine**: Device tracking + session resume (installId via AsyncStorage, X-Install-Id header)

## Key Features

- Meal viewing with real NEIS API data (나이스 교육정보 개방 포털)
- Star ratings and comments for meals (+30 points)
- Clean plate photo upload with AI verification (+100 points)
- Buddy matching system (anonymous chat between students who eat differently)
- Class battle rankings
- Point store with item redemption
- Admin moderation panel
- Authentication required (login/signup) — no guest access
- Session resume on app restart (last route + auth state persistence)
- Offline support with action queue (auto-retry on reconnect)

## Session Engine

- `lib/session-manager.ts` — installId 관리 (AsyncStorage), lastRoute 저장/복원
- `lib/sync-engine.ts` — 네트워크 모니터링, 오프라인 액션 큐, 온라인 복귀 시 자동 재시도
- `hooks/use-auth.ts` — 세션 재개 쿼리 (/api/session/resume), 인증 필수 모델
- `hooks/use-network.ts` — 네트워크 상태 훅 (expo-network + web fallback)
- `components/offline-banner.tsx` — 오프라인 상태 배너

## NEIS API Integration

The NEIS (나이스) API key is stored as `NEIS_API_KEY` environment secret.
- School search: `GET /api/schools/search?q=<query>` — calls `open.neis.go.kr/hub/schoolInfo`
- Meal data: `GET /api/meals/today` — calls `open.neis.go.kr/hub/mealServiceDietInfo`
- Falls back to mock data if the API key is missing or unavailable

## Active School Meal Engine (온디맨드 급식 관리)

급식 데이터는 "활성 학교"(이용자 1명 이상 소속)만 관리:
- **스케줄러**: `storage.getActiveSchools()` — users INNER JOIN schools로 활성 학교만 자정 갱신 대상
- **회원가입 트리거**: 신규 가입 시 해당 학교 급식 캐시 없으면 즉시 비동기 로드 (`refreshSingleSchool`)
- **접속 트리거**: `/api/meals/today` 캐시 miss 시 온디맨드 NEIS 조회 (기존 유지)
- **비활성 학교**: 이용자 0명이 된 학교는 자동으로 자정 갱신 제외 (DB 데이터 유지)

## Server Files

- `server/scheduler.ts` — 자정 KST 급식 자동 갱신 스케줄러 (활성 학교만 NEIS 데이터 갱신 + 이미지 생성)
- `server/neis.ts` — NEIS API integration (school search + meal fetch)
- `server/cleanplate-ai.ts` — Qwen3-VL AI 판정 (DashScope Singapore, qwen3-vl-flash-2026-01-22)
- `server/meal-image.ts` — 급식 이미지 편집/생성 (qwen-image-2.0, native multimodal API, 식판 편집 우선 → 텍스트 단독 생성 폴백)
- `server/assets/meal-tray.jpg` — 빈 식판 기준 이미지 (이미지 편집 베이스)
- `server/dashscope.ts` — re-export 게이트웨이 (cleanplate-ai + meal-image)
- `server/schema.ts` — Drizzle ORM schema (users, schools, meals, devices, session_events 등)
- `server/db.ts` — PostgreSQL connection pool
- `server/storage.ts` — Database access layer (CRUD operations + device/session methods)
- `server/routes.ts` — All Express API routes (idempotency key 지원 포함)

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/schools/search | NEIS school search |
| POST | /api/auth/signup | Register new student |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/me | Current user info |
| POST | /api/device/register | Device registration (installId) |
| GET | /api/session/resume | Session resume check |
| GET | /api/meals/today | Today's meal (NEIS cached) |
| POST | /api/feedback | Submit meal rating |
| GET | /api/ranking | Class/school ranking |
| POST | /api/cleanplate/upload | Upload clean plate photo |
| GET | /api/buddy/status | Buddy matching status |
| POST | /api/buddy/join | Join buddy queue |
| GET | /api/class-battle | Class battle stats |
| GET | /api/store/items | Store items |
| POST | /api/store/redeem | Redeem item |
| GET | /api/notifications | User notifications |
| GET | /api/admin/* | Admin-only routes |

## Mobile App Screens

- `app/(auth)/login.tsx` — 로그인 화면: 학교검색 + 학년/반/번호, 따뜻한 학생 언어
- `app/(auth)/signup.tsx` — 2단계 마법사: Step1(학교정보), Step2(이모지 알레르기 칩), 신체정보 없음
- `app/(app)/dashboard.tsx` — 홈 화면: 개인화 인사말, 오늘 급식, 포인트, 퀵 액션
- `app/(app)/store.tsx` — Point store
- `app/(app)/cleanplate.tsx` — Clean plate photo upload
- `app/(app)/ranking.tsx` — Leaderboard
- `app/(app)/buddy.tsx` — Buddy matching lobby
- `app/(app)/buddy/match/[id].tsx` — Buddy chat screen
- `app/(app)/class-battle.tsx` — Class vs class ranking
- `app/(app)/notifications.tsx` — Notification center
- `app/(app)/admin/cleanplate.tsx` — Admin: review clean plates
- `app/(app)/admin/store.tsx` — Admin: manage store items
- `app/(app)/admin/moderation.tsx` — Admin: moderation/reports

## Workflows

- **Start Backend**: `npm run server:dev` — Express on port 5000
- **Start Frontend**: `npm run expo:dev` — Expo Metro on port 8081

## DashScope AI Integration

API 키는 `DASHSCOPE_API_KEY` 환경 시크릿으로 관리.

- **Qwen3-VL (`qwen3-vl-flash-2026-01-22`)**: 클린플레이트 업로드 시 식판 사진을 AI로 분석. 잔반 여부 판정 후 score(0~1)에 따라 포인트 지급(0.8↑→100P, 0.5↑→50P, 미만→0P). OpenAI-compatible `/compatible-mode/v1/chat/completions` 사용
- **qwen-image-2.0**: 급식 캐시 생성 시 백그라운드에서 오늘의 급식 이미지 자동 생성. DashScope native multimodal API(`/api/v1/services/aigc/multimodal-generation/generation`) 사용. 식판 base 이미지 편집(1차) → 텍스트 단독 생성(2차) 폴백 구조. 로컬 uploads/에 PNG 저장 후 mealImageUrl 업데이트

## Environment Secrets

- `NEIS_API_KEY` — 나이스 교육정보 개방 포털 인증 키
- `DASHSCOPE_API_KEY` — DashScope(阿里云) API 키 (Qwen-VL + Wanx 이미지 생성)
- `SESSION_SECRET` — Express session signing secret
- `DATABASE_URL` — PostgreSQL connection string (managed by Replit)
