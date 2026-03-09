# 급식E 모바일 앱 빌드 및 배포 가이드

본 문서는 웹 앱(Express.js + React)을 React Native + Expo 네이티브 앱으로 전환한 `apps/mobile` 프로젝트의 실행, 빌드 및 배포 방법을 설명합니다.

## 1. 로컬 개발 환경 설정

### 사전 요구 사항
- Node.js (v18 이상 권장)
- npm 또는 yarn
- Expo Go 앱 (테스트용, 단 쿠키 세션 제한으로 인해 EAS Dev Client 권장)
- [EAS CLI](https://docs.expo.dev/build/setup/) (`npm install -g eas-cli`)

### 환경 변수 설정
`apps/mobile/.env.example` 파일을 복사하여 `.env` 파일을 생성합니다.
```bash
cd apps/mobile
cp .env.example .env
```
`.env` 파일의 `EXPO_PUBLIC_API_URL`을 로컬 서버의 IP 주소로 수정합니다. (예: `http://192.168.x.x:5000`)
*주의: `localhost`는 에뮬레이터/실기기에서 접근이 불가능할 수 있으므로 반드시 로컬 IP를 사용하세요.*

### 의존성 설치
```bash
npm install
```

## 2. 앱 실행

### 개발 서버 시작
```bash
npx expo start
```
- `i`: iOS 시뮬레이터 실행
- `a`: 안드로이드 에뮬레이터 실행
- `w`: 웹 버전 실행

### EAS Dev Client 빌드 (추천)
쿠키 기반 세션 관리를 정확하게 테스트하려면 Dev Client 빌드가 필요합니다.
```bash
# iOS (Mac 전용)
npx expo run:ios

# Android
npx expo run:android
```

## 3. EAS 빌드 및 배포

### EAS 빌드 (실기기 테스트 및 프로덕션)
EAS(Expo Application Services)를 사용하여 클라우드에서 빌드합니다.

#### 개발용 빌드 (Internal Distribution)
```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

#### 프로덕션 빌드 (스토어 제출용)
```bash
eas build --profile production --platform all
```

### 스토어 제출
빌드가 완료된 후 스토어에 제출합니다.
```bash
# Android (Google Play Console)
eas submit --platform android

# iOS (App Store Connect)
eas submit --platform ios
```

## 4. 웹 앱과의 동일성 검증 가이드

본 프로젝트는 웹 앱과 "달라진 점 0개"를 목표로 합니다. 다음 항목을 중점적으로 확인하세요.

### 핵심 화면 체크리스트
- **로그인/회원가입**: 학교 검색 및 알레르기 선택 UI가 웹과 동일한지 확인
- **대시보드**: 오늘의 급식 카드, 포인트 현황, 급식실 혼잡도 레이아웃 확인
- **포인트 스토어**: 상품 카드 스타일 및 교환 신청 모달 동작 확인
- **잔반제로 (CleanPlate)**: 카메라/갤러리 연동 및 AI 결과 표시 확인
- **급식메이트 (Buddy)**: 채팅 버블 스타일 및 실시간 폴링 동작 확인

### 기술적 차이점 및 한계
- **Hover interaction**: 모바일 환경 특성상 CSS `:hover` 효과는 `Pressable`의 `onPressIn/Out`을 통한 투명도 변화(opacity 0.85)로 대체되었습니다.
- **쿠키 세션**: React Native의 `fetch`는 `Set-Cookie`를 자동으로 처리하지 않으므로, `@gipsige/shared` 패키지의 커스텀 쿠키 jar(AsyncStorage 기반)를 사용합니다.
- **애니메이션**: CSS Keyframes 대신 React Native `Animated` API를 사용하여 동일한 타이밍의 Shimmer 효과를 구현했습니다.

## 5. 주요 기술 스택
- **Framework**: Expo SDK 51 (Expo Router v3)
- **Styling**: NativeWind v4 (Tailwind CSS)
- **Icons**: lucide-react-native
- **Data Fetching**: TanStack Query v5
- **Storage**: @react-native-async-storage/async-storage
