# 급식E - 스마트 학교급식 코치 서비스

## 개요
학교 급식 정보 조회, 포인트 적립, 반/학교 랭킹, 클린플레이트 인증(AI+관리자 검토), Food Buddy 매칭, 포인트 스토어 기능을 제공하는 풀스택 MVP.
학교명/학년/반/학번 기반 인증으로 비밀번호 없이 사용.
관리자(ADMIN 역할)는 상품 등록/관리, 교환 요청 처리, 클린플레이트 검토, 신고 모더레이션 등 운영 기능 접근 가능.

## 모노레포 구조
```
├── client/           ← 웹 React 앱 (Vite + wouter + Tailwind + Shadcn/UI)
├── server/           ← Express.js 백엔드 (변경 없음)
├── shared/           ← Drizzle 스키마 (변경 없음)
├── apps/
│   └── mobile/       ← Expo SDK 51 + Expo Router v3 (iOS/Android)
└── packages/
    └── shared/       ← 공유 타입·상수·API클라이언트 (@gipsige/shared)
```

## 아키텍처
- **웹 프론트엔드**: React 18 + TypeScript + Tailwind CSS + Shadcn/UI (wouter 라우팅)
- **모바일 앱**: Expo SDK 51 + Expo Router v3 + NativeWind v4 (Google Play/App Store)
- **백엔드**: Express.js + express-session (PostgreSQL 세션 스토어)
- **DB**: PostgreSQL + Drizzle ORM
- **이미지**: S3 호환 스토리지 (env 미설정 시 로컬 /uploads/ 디렉토리 fallback)
- **NEIS 연동**: NEIS_API_KEY 없으면 Mock 데이터 자동 반환
- **Qwen3-VL AI**: DashScope Singapore (qwen3-vl-flash-2026-01-22) — 클린플레이트 AI 판정

## 모바일 앱 핵심 구조 (apps/mobile)
- **라우팅**: `app/(auth)/` (로그인/회원가입), `app/(app)/` (인증된 화면들)
- **쿠키 세션**: AsyncStorage 기반 커스텀 쿠키 jar (EAS Dev Client 빌드 필요)
- **아이콘**: lucide-react-native (웹 lucide-react 1:1 교체)
- **사진 업로드**: expo-image-picker (웹 input[type=file] 대체)
- **공유 패키지**: `@gipsige/shared` — AuthUser 타입, ALLERGY_OPTIONS, apiRequest 함수
- **빌드**: EAS Build (development/preview/production 프로필) — `apps/mobile/README.md` 참고

## DB 스키마

### 기존 테이블
- **user_role** (enum): USER | ADMIN
- **clean_plate_status** (enum): PENDING | AUTO_APPROVED | APPROVED | REJECTED
- **schools**: id, name, office_code, school_code, address
- **users**: id, school_id(FK), grade, class_num, student_number, height_cm, weight_kg, allergies[], points, role, matching_suspended_until, account_suspended_until
- **meal_cache**: id, school_id, date, menu_text, raw
- **meal_feedback**: id, user_id, school_id, date, rating, comment
- **point_ledger**: id, user_id, delta, reason, ref_id
- **clean_plate_submissions**: id, user_id, school_id, date, image_url, image_key, image_hash, status, ai_score, ai_result, points_awarded, review_note, reviewed_by_user_id, reviewed_at
- **session**: express-session 자동 관리

### 5단계 추가 테이블 (Food Buddy)
- **buddy_preference** (enum): LESS | MORE
- **buddy_queue_status** (enum): WAITING | MATCHED | CANCELLED
- **buddy_match_status** (enum): ACTIVE | COMPLETED | CANCELLED | EXPIRED
- **reveal_consent_status** (enum): PENDING | ACCEPTED | REJECTED
- **report_reason** (enum): HARASSMENT | SPAM | PRIVACY | INAPPROPRIATE | OTHER
- **report_status** (enum): OPEN | REVIEWED | ACTIONED | DISMISSED
- **moderation_action** (enum): WARN | SUSPEND_MATCHING_7D | SUSPEND_ACCOUNT_7D | BAN
- **notification_type** (enum): BUDDY_MATCHED | BUDDY_MESSAGE | REVEAL_REQUEST | REVEAL_ACCEPTED | BUDDY_COMPLETE | CLEANPLATE_RESULT | REPORT_REVIEWED | SYSTEM
- **buddy_queues**: 매칭 대기열 (user_id unique per WAITING)
- **buddy_matches**: 매칭 결과/채팅방
- **buddy_messages**: 채팅 메시지 (최대 300자)
- **buddy_reveal_consents**: 학번 공개 양방향 동의
- **user_blocks**: 유저 차단
- **user_reports**: 유저 신고
- **moderation_actions**: 관리자 조치 기록
- **notifications**: 인앱 알림

## 주요 파일
- `shared/schema.ts` - Drizzle 스키마 + Zod 검증 스키마 (전체 enum + 테이블)
- `server/neis.ts` - NEIS API 유틸 (학교검색, 급식조회, Mock fallback)
- `server/image-storage.ts` - S3(MinIO) 또는 로컬 파일 저장 유틸
- `server/cleanplate-ai.ts` - Qwen3-VL AI 판정 (DashScope Singapore)
- `server/buddy-matching.ts` - Food Buddy 매칭 엔진 (큐 참가, 매칭 시도, 콘텐츠 필터)
- `server/routes.ts` - 모든 API 엔드포인트 (multer 파일 업로드 포함)
- `server/storage.ts` - DB 접근 레이어 (트랜잭션 포함)
- `client/src/hooks/use-auth.ts` - 인증 훅 (role, isAdmin 포함)
- `client/src/pages/dashboard.tsx` - 대시보드 (알림 뱃지, Food Buddy 카드)
- `client/src/pages/buddy.tsx` - Food Buddy 매칭 페이지 (3가지 상태)
- `client/src/pages/buddy-match.tsx` - Food Buddy 채팅 페이지 (폴링 기반)
- `client/src/pages/admin-moderation.tsx` - 관리자 신고 처리 페이지
- `client/src/pages/store.tsx` - 학생용 포인트 스토어 (상품 목록 + 교환 내역)
- `client/src/pages/admin-store.tsx` - 관리자 스토어 관리 (상품 등록/수정 + 교환 요청 처리)
- `client/src/pages/cleanplate.tsx` - 클린플레이트 인증 페이지
- `client/src/pages/admin-cleanplate.tsx` - 관리자 클린플레이트 검토 페이지
- `client/src/pages/ranking.tsx` - 포인트 랭킹 (반/전교 전환)
- `uploads/` - 로컬 이미지 저장 디렉토리 (개발 환경)

## API 엔드포인트

### 인증
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/me` - 내 정보 (role 포함)

### 급식/피드백/랭킹
- `GET /api/schools/search?q=` - NEIS 학교 검색
- `GET /api/meals/today` - 오늘 급식 (캐시 → NEIS → Mock)
- `POST /api/feedback` - 급식 평가 (+30P)
- `GET /api/ranking?scope=class|school` - 포인트 랭킹

### 클린플레이트
- `POST /api/cleanplate/upload` - 사진 업로드 + AI 판정 (multipart/form-data)
- `GET /api/cleanplate/today` - 오늘 인증 상태 + 쿨타임
- `GET /api/cleanplate/history?days=7` - 최근 제출 이력

### Food Buddy
- `POST /api/buddy/join` - 큐 참가 + 즉시 매칭 시도
- `POST /api/buddy/leave` - 큐 이탈
- `GET /api/buddy/status` - 현재 상태 (IDLE/WAITING/MATCHED)
- `GET /api/buddy/match/:id` - 매칭 상세 (익명 표시명, reveal 상태, opponentId)
- `GET /api/buddy/match/:id/messages?cursor=` - 커서 페이징 메시지
- `POST /api/buddy/match/:id/messages` - 메시지 전송 (레이트리밋 + 콘텐츠 필터)
- `POST /api/buddy/match/:id/reveal/request` - 학번 공개 요청
- `POST /api/buddy/match/:id/reveal/respond` - 공개 요청 응답 (ACCEPT/REJECT)
- `POST /api/buddy/match/:id/complete` - 매칭 완료 (+100P 양측 지급)

### 차단/신고
- `POST /api/block` - 유저 차단 (관련 매칭 자동 취소)
- `POST /api/report` - 신고 접수

### 알림
- `GET /api/notifications` - 인앱 알림 목록 (unreadCount 포함)
- `POST /api/notifications/read` - 읽음 처리

### 포인트 스토어 (학생)
- `GET /api/store/items` - 내 학교 활성 상품 목록
- `POST /api/store/redeem` - 포인트 교환 신청 (트랜잭션: 포인트 차감 + Redemption 생성 + 재고 감소)
- `GET /api/store/me/redemptions` - 내 교환 내역

### 관리자
- `GET /api/admin/cleanplate` - (ADMIN) PENDING 클린플레이트 목록
- `POST /api/admin/cleanplate/:id/review` - (ADMIN) 승인/거절
- `GET /api/admin/reports?status=OPEN` - (ADMIN) 신고 목록
- `POST /api/admin/reports/:id/action` - (ADMIN) 조치 처리 (정지/경고/차단)
- `GET /api/admin/store/items` - (ADMIN) 전체 상품 목록 (비활성 포함)
- `POST /api/admin/store/items` - (ADMIN) 상품 등록
- `PATCH /api/admin/store/items/:id` - (ADMIN) 상품 수정
- `DELETE /api/admin/store/items/:id` - (ADMIN) 상품 비활성화
- `GET /api/admin/store/redemptions?status=` - (ADMIN) 교환 요청 목록
- `POST /api/admin/store/redemptions/:id/process` - (ADMIN) 교환 처리 (APPROVED/READY/COMPLETED/CANCELLED)

## 포인트 정책
- 급식 평가: +30P
- 클린플레이트 자동 승인(AI >= 0.85): +100P
- 클린플레이트 관리자 승인: +100P (중복 지급 방지)
- Food Buddy 매칭 완료: +100P (양측 모두)
- 거절/취소: 0P

## Food Buddy 설계 원칙
- **매칭**: 동일 학교+학년 내 LESS↔MORE 페어링, DB 트랜잭션으로 경쟁 조건 방지
- **채팅**: 폴링 방식(3초 간격), WebSocket 불필요
- **익명 보장**: 학번은 양방향 ACCEPT 후에만 노출
- **레이트리밋**: 10초 내 메시지 3개 초과 차단 (DB 기반)
- **콘텐츠 필터**: 전화번호/SNS 아이디 패턴 정규식 차단
- **안전**: 차단, 신고, 관리자 조치 (정지 7일/영구 차단) 지원

## AI 판정 상태머신 (클린플레이트)
- score >= 0.85 → AUTO_APPROVED (+100P 즉시 지급)
- score 0.5~0.85 → PENDING (관리자 검토 대기)
- score < 0.5 → REJECTED (포인트 없음)

## 권한
- 일반 유저(USER): 모든 일반 기능
- 관리자(ADMIN): /api/admin/* 접근 + 대시보드에 관리자 버튼 표시
- 관리자 설정: DB에서 `UPDATE users SET role = 'ADMIN' WHERE ...`

## 환경변수
- `DATABASE_URL` - PostgreSQL 연결 문자열 (자동 설정)
- `SESSION_SECRET` - 세션 서명 키
- `NEIS_API_KEY` - (선택) NEIS Open API 키. 없으면 Mock 데이터 반환
- `DASHSCOPE_API_KEY` - DashScope Singapore API 키 (Qwen3-VL AI 판정용)
- `S3_ENDPOINT` - (선택) S3 호환 엔드포인트
- `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL` - S3 설정
- S3 미설정 시 → uploads/ 디렉토리에 로컬 저장
