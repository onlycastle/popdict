# PopDict

Electron 기반 데스크톱 애플리케이션

## 기술 스택

- **Electron** - 크로스 플랫폼 데스크톱 애플리케이션 프레임워크
- **React** - UI 라이브러리
- **TypeScript** - 타입 안전성을 위한 언어
- **Vite** - 빠른 빌드 도구
- **Tailwind CSS** - 유틸리티 우선 CSS 프레임워크
- **Framer Motion** - 애니메이션 라이브러리

## 필수 요구사항

- **Node.js** (v16 이상 권장)
- **npm** (Node.js와 함께 설치됨)

## 설치 방법

1. 저장소를 클론하거나 프로젝트 디렉토리로 이동합니다:
```bash
cd /Users/sungmancho/projects/PopDict
```

2. 의존성 패키지를 설치합니다:
```bash
npm install
```

## 실행 방법

### 개발 모드로 실행

개발 모드에서 애플리케이션을 실행하려면 다음 명령어를 사용합니다:

```bash
npm start
```

이 명령어는 Electron Forge를 사용하여 애플리케이션을 시작하며, 코드 변경 시 자동으로 새로고침됩니다.

### 프로덕션 빌드

애플리케이션을 패키징하려면:

```bash
npm run package
```

배포 가능한 설치 파일을 생성하려면:

```bash
npm run make
```

## 사용 가능한 스크립트

- `npm start` - 개발 모드로 애플리케이션 실행
- `npm run package` - 애플리케이션 패키징
- `npm run make` - 배포 가능한 설치 파일 생성
- `npm run publish` - 애플리케이션 배포
- `npm run lint` - TypeScript 코드 린팅

## 프로젝트 구조

```
PopDict/
├── electron/          # Electron 메인 프로세스 관련 파일
├── src/              # 소스 코드
│   ├── components/   # React 컴포넌트
│   ├── hooks/        # 커스텀 React 훅
│   ├── types/        # TypeScript 타입 정의
│   ├── App.tsx       # 메인 App 컴포넌트
│   ├── main.ts       # Electron 메인 프로세스
│   ├── preload.ts    # Preload 스크립트
│   └── renderer.ts   # 렌더러 프로세스
├── index.html        # HTML 엔트리 포인트
├── package.json      # 프로젝트 설정 및 의존성
└── vite.config.ts    # Vite 설정
```

## 문제 해결

### 애플리케이션이 시작되지 않는 경우

1. `node_modules` 디렉토리를 삭제하고 다시 설치합니다:
```bash
rm -rf node_modules package-lock.json
npm install
```

2. Node.js 버전을 확인합니다:
```bash
node --version
```

### 빌드 오류가 발생하는 경우

캐시를 정리하고 다시 시도합니다:
```bash
rm -rf .vite
npm start
```

## 라이선스

MIT

## 작성자

sungmanch (sungman.cho@latched.ai)
