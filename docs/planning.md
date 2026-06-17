# PopDict - macOS Liquid Dictionary

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [경쟁 제품 분석](#2-경쟁-제품-분석)
3. [기술 스택 선택](#3-기술-스택-선택)
4. [핵심 기능 구현](#4-핵심-기능-구현)
5. [사전 API 옵션](#5-사전-api-옵션)
6. [비즈니스 모델](#6-비즈니스-모델)
7. [배포 및 패키징](#7-배포-및-패키징)
8. [개발 로드맵](#8-개발-로드맵)
9. [잠재적 문제 및 해결책](#9-잠재적-문제-및-해결책)
10. [마케팅 전략](#10-마케팅-전략)

---

## 1. 프로젝트 개요

### 비전
맥북에서 텍스트를 읽다가 모르는 단어를 만났을 때, **1초 안에** 사전 검색 결과를 볼 수 있는 아름다운 경험을 제공합니다.

### 핵심 가치 제안
- **속도**: 브라우저를 열거나 다른 앱으로 전환할 필요 없이 즉시 검색
- **아름다움**: Liquid Glass 디자인으로 macOS 네이티브 느낌
- **편의성**: 글로벌 단축키로 어디서든 즉시 접근
- **전문성**: 다양한 사전 소스와 다국어 지원

### 타겟 사용자
1. **언어 학습자**: 영어, 한국어 등을 공부하는 학생 및 직장인
2. **전문 번역가**: 빠른 사전 참조가 필요한 전문가
3. **작가 및 에디터**: 정확한 단어 선택을 위한 도구
4. **개발자**: 영문 문서를 자주 읽는 기술직

### 차별화 포인트
| 기능 | PopDict | Spotlight | Safari/Chrome |
|------|---------|-----------|---------------|
| **사전 전용** | ✅ 특화됨 | ⚠️ 검색 중 하나 | ❌ 브라우저 열어야 함 |
| **Liquid Glass UI** | ✅ 아름다운 디자인 | ❌ 기본 UI | ❌ 웹사이트 디자인 |
| **다국어 번역** | ✅ 한영/영한 등 | ❌ 제한적 | ✅ Google 번역 |
| **오프라인 모드** | ✅ Pro 기능 | ✅ 기본 제공 | ❌ 인터넷 필요 |
| **학습 기능** | ✅ 히스토리/즐겨찾기 | ❌ 없음 | ❌ 없음 |
| **속도** | ⚡ <100ms | ⚡ <100ms | 🐌 1-3초 |

---

## 2. 경쟁 제품 분석

### A. Spotlight (macOS 기본 제공)
**장점:**
- 시스템 통합, 무료
- 매우 빠름
- 추가 설치 불필요

**단점:**
- 사전 기능이 부차적
- UI 커스터마이징 불가
- 학습 기능 없음

**우리의 대응:** 사전에 특화되고, 아름다운 UI, 학습 기능 추가

### B. Alfred (https://www.alfredapp.com/)
**개요:**
- 기술: Native Objective-C
- 가격: 무료 + Powerpack £34 ($43) 일회성
- 사용자: 2M+

**장점:**
- 강력한 워크플로우 기능
- 높은 커스터마이징
- 성숙한 생태계

**단점:**
- 사전 기능이 메인이 아님
- 다소 복잡한 설정
- 구식 UI

**우리의 대응:** 사전만 집중, 더 단순한 UX, 현대적 디자인

### C. Raycast (https://raycast.com/)
**개요:**
- 기술: Native Swift + Web extensions
- 가격: 무료 + Pro $8/월
- 투자: $30M+ VC 지원

**장점:**
- 현대적인 UI/UX
- 확장 생태계
- 팀 협업 기능

**단점:**
- 너무 많은 기능 (복잡함)
- 구독 가격이 높음
- 사전 기능이 우선순위 아님

**우리의 대응:** 사전 단일 목적, 더 저렴한 가격, 개인 사용자 집중

### D. 내장 Dictionary.app
**장점:**
- 완전 무료
- 오프라인
- 3-finger tap 통합

**단점:**
- 별도 앱 실행 필요
- 구식 UI
- 확장 불가

**우리의 대응:** 글로벌 단축키, 현대적 UI, API 통합으로 더 풍부한 데이터

### 시장 기회
✅ Alfred/Raycast의 성공은 유료 macOS 유틸리티 시장이 존재함을 증명
✅ 기존 도구들은 사전이 핵심 기능이 아님 → **틈새 시장**
✅ 언어 학습 시장 성장 (Duolingo 700M+ 사용자)
✅ 한국어-영어 사전 특화 시 한국 시장 공략 가능

---

## 3. 기술 스택 선택

### 옵션 비교

| 항목 | Electron | Swift + SwiftUI | Tauri |
|------|----------|-----------------|-------|
| **개발 속도** | ⚡⚡⚡ 빠름 | ⚡ 느림 | ⚡⚡ 보통 |
| **성능** | ⚠️ 보통 | ✅ 최고 | ✅ 좋음 |
| **번들 크기** | ❌ 80-150MB | ✅ 5-15MB | ✅ 10-20MB |
| **메모리 사용** | ❌ 100-200MB | ✅ 20-50MB | ✅ 50-100MB |
| **배터리 효율** | ⚠️ 보통 | ✅ 최고 | ✅ 좋음 |
| **네이티브 느낌** | ⚠️ 어려움 | ✅ 완벽 | ✅ 좋음 |
| **크로스 플랫폼** | ✅ 쉬움 | ❌ macOS만 | ✅ 가능 |
| **UI 개발** | ✅ React/CSS | ⚠️ SwiftUI | ✅ Web |
| **학습 곡선** | ✅ 낮음 (웹 개발자) | ❌ 높음 (Swift) | ⚠️ 보통 (Rust) |
| **App Store** | ⚠️ 제약 있음 | ✅ 완벽 지원 | ⚠️ 보통 |

### 최종 권장사항

#### 🚀 Phase 1: Electron으로 MVP 출시 (1-2개월)
**이유:**
- 빠른 시장 검증 (4-6주 안에 출시 가능)
- 웹 개발 기술 활용
- 프로토타입으로 사용자 피드백 수집
- 초기 투자 최소화

**기술 스택:**
```
- Framework: Electron 28+
- Frontend: React 18 + Vite 5
- Styling: Tailwind CSS 3
- State: Zustand
- Packaging: electron-builder
- Language: TypeScript
```

#### 🏆 Phase 2: Swift로 네이티브 리빌드 (검증 후)
**조건:** $5,000+ MRR 달성 시 또는 1,000+ 활성 사용자

**이유:**
- 프리미엄 제품에 어울리는 품질
- 경쟁사(Alfred, Raycast)와 동등한 성능
- App Store 최적화
- 장기적인 유지보수 용이

**기술 스택:**
```
- Framework: SwiftUI + AppKit
- Backend: Swift Concurrency (async/await)
- Storage: Core Data + CloudKit
- Updates: Sparkle 2
- Language: Swift 5.9+
```

#### 💡 하이브리드 전략
1. **Month 1-3**: Electron MVP 출시, 무료 배포
2. **Month 4-6**: 사용자 피드백 수집, 수익 모델 테스트
3. **Month 7-12**: Swift 버전 개발 (Electron 병행 유지)
4. **Year 2**: Swift를 "Pro" 버전으로, Electron을 "Free" 버전으로 운영
   - 예: Hyper(Electron) vs iTerm2(Native) 처럼

---

## 4. 핵심 기능 구현

### 4.1 글로벌 단축키 (Global Hotkey)

#### Electron 구현
```javascript
// electron/main.js
const { app, globalShortcut, BrowserWindow } = require('electron');

let mainWindow;

app.on('ready', () => {
  // 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    vibrancy: 'hud',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 단축키 등록: Cmd+Shift+D
  const ret = globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
      // 검색창에 포커스
      mainWindow.webContents.send('focus-search');
    }
  });

  if (!ret) {
    console.log('단축키 등록 실패');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

#### Swift 구현
```swift
// HotkeyManager.swift
import Carbon
import SwiftUI

class HotkeyManager: ObservableObject {
    var eventHandler: EventHandlerRef?
    var eventHotKey: EventHotKeyRef?

    func register() {
        var hotKeyID = EventHotKeyID()
        hotKeyID.signature = OSType("PDICT".fourCharCode)
        hotKeyID.id = 1

        var eventType = EventTypeSpec()
        eventType.eventClass = OSType(kEventClassKeyboard)
        eventType.eventKind = OSType(kEventHotKeyPressed)

        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, event, userData -> OSStatus in
                NotificationCenter.default.post(
                    name: NSNotification.Name("TogglePopDict"),
                    object: nil
                )
                return noErr
            },
            1,
            &eventType,
            nil,
            &eventHandler
        )

        // Cmd+Shift+D = keyCode 2, cmdKey | shiftKey
        RegisterEventHotKey(
            2,
            UInt32(cmdKey | shiftKey),
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &eventHotKey
        )
    }
}
```

#### 접근성 권한 처리
**macOS 보안 요구사항:**
- 글로벌 단축키는 "접근성" 권한 필요
- 사용자가 명시적으로 허용해야 함

**UX 플로우:**
1. 앱 첫 실행 시 온보딩 화면 표시
2. 권한 필요 이유 설명 (스크린샷 포함)
3. "시스템 환경설정 열기" 버튼 제공
4. Deep link: `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`
5. 권한 없이도 작동하는 대안 제공 (메뉴바 아이콘 클릭)

**코드 예시 (권한 확인):**
```swift
import ApplicationServices

func checkAccessibilityPermission() -> Bool {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
    return AXIsProcessTrustedWithOptions(options as CFDictionary)
}
```

### 4.2 Liquid Glass UI

#### CSS 구현 (Electron)
```css
/* styles/glass.css */
.popdict-window {
  width: 600px;
  min-height: 400px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  padding: 24px;
}

.search-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 18px;
  color: #ffffff;
  width: 100%;
  transition: all 0.2s ease;
}

.search-input:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  outline: none;
}

/* 다크 모드 대응 */
@media (prefers-color-scheme: dark) {
  .popdict-window {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.1);
  }
}
```

#### Swift 구현 (Native)
```swift
// GlassWindow.swift
import SwiftUI

struct GlassWindow: View {
    @State private var searchText = ""

    var body: some View {
        ZStack {
            // 네이티브 vibrancy 효과
            VisualEffectBlur(
                material: .hudWindow,
                blendingMode: .behindWindow
            )

            VStack(spacing: 20) {
                // 검색 입력
                SearchField(text: $searchText)

                // 결과 리스트
                if !searchText.isEmpty {
                    ResultsList(query: searchText)
                }

                Spacer()
            }
            .padding(24)
        }
        .frame(width: 600, height: 400)
        .cornerRadius(16)
    }
}

struct VisualEffectBlur: NSViewRepresentable {
    var material: NSVisualEffectView.Material
    var blendingMode: NSVisualEffectView.BlendingMode

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {}
}
```

**Material 옵션:**
- `.hudWindow`: Spotlight 스타일
- `.popover`: 더 밝고 투명
- `.sidebar`: 미묘한 블러
- `.menu`: 메뉴 스타일

#### 애니메이션 (Framer Motion)
```jsx
// components/SearchWindow.jsx
import { motion, AnimatePresence } from 'framer-motion';

export function SearchWindow({ isVisible }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="popdict-window"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* 내용 */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 4.3 즉시 검색 (Instant Search)

```jsx
// hooks/useSearch.js
import { useState, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchDictionary = useDebouncedCallback(async (text) => {
    if (!text.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 캐시 확인
      const cached = await getCachedResult(text);
      if (cached) {
        setResults(cached);
        setLoading(false);
        return;
      }

      // API 호출
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${text}`
      );

      if (!response.ok) {
        throw new Error('단어를 찾을 수 없습니다');
      }

      const data = await response.json();

      // 캐시 저장
      await cacheResult(text, data);

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, 300); // 300ms 디바운스

  useEffect(() => {
    searchDictionary(query);
  }, [query]);

  return { query, setQuery, results, loading, error };
}
```

---

## 5. 사전 API 옵션

### 무료 API

#### A. Free Dictionary API ⭐ 추천 (MVP)
- **URL**: https://dictionaryapi.dev/
- **비용**: 완전 무료, API 키 불필요
- **Rate Limit**: 무제한
- **데이터**: 영어 사전 (definitions, phonetics, examples)
- **장점**: 설정 없이 바로 사용 가능
- **단점**: 영어만 지원, 상세도가 낮음

```javascript
// 예시 응답
{
  "word": "hello",
  "phonetic": "/həˈloʊ/",
  "meanings": [
    {
      "partOfSpeech": "noun",
      "definitions": [
        {
          "definition": "A greeting (salutation) said when meeting someone...",
          "example": "She greeted me with a warm hello.",
          "synonyms": ["greeting", "hi"]
        }
      ]
    }
  ]
}
```

#### B. Merriam-Webster Dictionary API
- **URL**: https://dictionaryapi.com/
- **비용**: 무료 (API 키 필요)
- **Rate Limit**: 1,000 requests/day
- **데이터**: 고품질 collegiate dictionary
- **장점**: 권위 있는 사전, 발음 오디오 제공
- **단점**: Rate limit 있음

#### C. WordsAPI
- **URL**: https://www.wordsapi.com/
- **비용**: 2,500 requests/day 무료
- **Rate Limit**: 유료 시 100k requests/월 ($10)
- **데이터**: 동의어, 반의어, 발음, 예문
- **장점**: 풍부한 데이터
- **단점**: Rate limit 제약

#### D. Linguee API (비공식)
- **URL**: https://github.com/imankulov/linguee-api
- **비용**: 무료 (비공식 API)
- **데이터**: 다국어 예문 (한영, 영한 등)
- **장점**: 실제 사용 예문 풍부
- **단점**: 비공식이라 안정성 문제 가능

#### E. 네이버 사전 API (한국 시장)
- **URL**: https://developers.naver.com/docs/papago/
- **비용**: Papago 번역 API - 10,000자/일 무료
- **데이터**: 한영/영한 번역 및 사전
- **장점**: 한국어 특화, 무료 할당량 충분
- **단점**: API 키 발급 필요

### 오프라인 데이터베이스

#### WordNet (Princeton University)
- **URL**: https://wordnet.princeton.edu/
- **비용**: 완전 무료, 오픈소스
- **크기**: ~100MB
- **데이터**: 155,000+ 단어, 동의어 관계망
- **사용법**: SQLite DB로 번들링
- **장점**: Pro 기능으로 오프라인 모드 제공 가능
- **단점**: 데이터가 다소 구식 (2012년 마지막 업데이트)

```javascript
// WordNet 통합 예시
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./wordnet.db');

function searchOffline(word) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM words WHERE word = ?',
      [word],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}
```

### 유료 API (Pro Tier)

#### A. Google Cloud Translation API
- **비용**: $20 / 1M characters
- **기능**: 100+ 언어 번역
- **사용 사례**: Pro 사용자의 다국어 번역
- **예상 비용**: 사용자당 월 $0.50 이하

#### B. DeepL API
- **비용**: €4.99/월 (50만 자) + 사용량 과금
- **기능**: 고품질 번역 (28개 언어)
- **장점**: Google보다 자연스러운 번역
- **단점**: 언어 제한적

#### C. OpenAI GPT API (고급 기능)
- **비용**: GPT-3.5-turbo $0.002/1K tokens
- **기능**:
  - 문맥 기반 정의
  - 예문 생성
  - 유의어 추천
- **사용 사례**: AI 기반 "스마트 검색" Pro 기능

### 권장 조합

**Free Tier:**
```
1순위: Free Dictionary API (기본)
2순위: Merriam-Webster (fallback, 1000/day까지)
3순위: 네이버 사전 (한국어 검색 시)
```

**Pro Tier:**
```
- 오프라인: WordNet 번들링
- 번역: Google Translate API 또는 DeepL
- AI 기능: OpenAI GPT-3.5 (옵션)
```

---

## 6. 비즈니스 모델

### 6.1 가격 전략 비교

#### 옵션 1: 일회성 + 구독 하이브리드 ⭐ 추천
```
무료: 기본 영어 사전 (10 searches/day)
Pro (일회성): $9.99 - 무제한 검색, 히스토리, 테마
Pro+ (구독): $1.99/월 or $14.99/년 - 번역, 오프라인, AI 기능
```

**장점:**
- 진입 장벽 낮음 (무료 체험)
- 일회성 결제로 초기 수익 확보
- 구독으로 장기 수익 창출
- 다양한 사용자 니즈 충족

**단점:**
- 복잡한 가격 구조
- 마케팅 메시지가 길어짐

#### 옵션 2: 순수 프리미엄 구독
```
무료: 10 searches/day
Pro: $2.99/월 or $19.99/년 - 모든 기능
```

**장점:**
- 단순한 메시지
- 예측 가능한 수익
- 지속적인 개발 동기

**단점:**
- 구독 피로도 (이미 Netflix, Spotify 등)
- 초기 전환율 낮을 수 있음

#### 옵션 3: Pay-What-You-Want + 팁
```
무료: 모든 핵심 기능
서포터: $5-50 자유 선택 (일회성)
팁: 앱 내에서 개발자에게 커피 사주기
```

**장점:**
- 사용자 친화적
- 바이럴 가능성 높음
- 커뮤니티 형성

**단점:**
- 수익 예측 불가
- 전환율 낮을 가능성

### 6.2 최종 권장 모델 (옵션 1 개선)

```
┌─────────────────────────────────────┐
│          FREE TIER                  │
├─────────────────────────────────────┤
│ ✅ 영어 사전 (Free Dictionary API)  │
│ ✅ 기본 Liquid Glass 테마           │
│ ✅ 히스토리 (최근 10개)              │
│ ✅ 글로벌 단축키                     │
│ ⚠️ 광고 없음 (깔끔한 경험)          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     PRO - $9.99 일회성 결제         │
├─────────────────────────────────────┤
│ ✅ 무제한 검색                       │
│ ✅ 히스토리 무제한 + 검색 기능       │
│ ✅ 즐겨찾기 / 컬렉션                │
│ ✅ 고급 테마 (커스텀 색상, 블러)     │
│ ✅ 단축키 커스터마이징               │
│ ✅ 오프라인 모드 (WordNet)          │
│ ✅ 우클릭 컨텍스트 메뉴 통합         │
│ ✅ 평생 업데이트                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  PRO+ - $1.99/월 또는 $14.99/년    │
├─────────────────────────────────────┤
│ ✅ Pro의 모든 기능                   │
│ ✅ 다국어 번역 (한영, 영한 등)       │
│ ✅ AI 기반 정의 (GPT 통합)          │
│ ✅ 클라우드 동기화 (Mac간)          │
│ ✅ 단어 학습 기능 (암기장)           │
│ ✅ 우선 지원                         │
└─────────────────────────────────────┘
```

**전환 전략:**
- 무료 사용자: 앱 하단에 "Upgrade to Pro" 작은 배너 (방해되지 않게)
- Pro 사용자: Pro+ 기능 사용 시 "이 기능은 Pro+입니다" 안내
- 14일 Pro+ 무료 체험 제공

### 6.3 수익 예측

**보수적 시나리오:**
```
Month 1: 500 다운로드, 10 Pro ($99) = $99 MRR
Month 3: 2,000 다운로드, 50 Pro ($499), 5 Pro+ ($10) = $509 MRR
Month 6: 5,000 다운로드, 150 Pro ($1,499), 20 Pro+ ($40) = $1,539 MRR
Month 12: 10,000 다운로드, 300 Pro ($2,997), 50 Pro+ ($100) = $3,097 MRR
```

**낙관적 시나리오:**
```
Month 6: 20,000 다운로드, 500 Pro ($4,995), 100 Pro+ ($200) = $5,195 MRR
Month 12: 50,000 다운로드, 1,500 Pro ($14,985), 300 Pro+ ($600) = $15,585 MRR
```

**손익분기점:**
- 개발 비용: ~$5,000 (시간 투자)
- Apple Developer: $99/년
- 서버 비용: $20-50/월 (API, 동기화)
- **필요 매출**: $1,000 (회수 후 수익)

### 6.4 배포 전략

#### App Store vs 직접 배포

| 요소 | App Store | 직접 배포 (DMG) |
|------|-----------|-----------------|
| **발견성** | ⭐⭐⭐⭐⭐ 높음 | ⭐⭐ 낮음 (마케팅 필요) |
| **신뢰도** | ⭐⭐⭐⭐⭐ Apple 검증 | ⭐⭐⭐ 코드 사이닝 필요 |
| **수수료** | ❌ 30% (15% after 1yr) | ✅ 3% (Stripe/Gumroad) |
| **업데이트** | ⭐⭐⭐⭐⭐ 자동 | ⭐⭐⭐ Sparkle 수동 |
| **체험판** | ❌ 제한적 | ✅ 완전 제어 |
| **가격 정책** | ⚠️ Apple 규정 따름 | ✅ 자유롭게 설정 |
| **심사 시간** | ⚠️ 1-3일/업데이트 | ✅ 즉시 |
| **샌드박싱** | ❌ 필수 (기능 제약) | ✅ 선택적 |
| **환불** | ⚠️ Apple이 결정 | ✅ 직접 관리 |

**글로벌 단축키 이슈:**
- App Store는 접근성 권한이 필요한 앱 승인이 까다로움
- 직접 배포가 더 유리할 수 있음

**권장 전략:**
1. **Phase 1**: 직접 배포 (Gumroad + 웹사이트)
   - 빠른 출시, 유연한 가격 정책
   - 사용자 피드백 빠르게 반영
2. **Phase 2**: App Store 제출 (검증 후)
   - 안정화 후 더 넓은 시장 공략
   - "Lite" 버전 무료, 앱 내 구매로 Pro 전환
3. **병행 운영**: 두 채널 모두 유지
   - 직접 배포: 파워 유저, 더 저렴한 가격 ($9.99)
   - App Store: 일반 사용자, 발견성 ($12.99 to cover commission)

### 6.5 결제 처리

#### Gumroad ⭐ 추천 (초기)
- **수수료**: 10%
- **장점**:
  - 설정 5분 완료
  - 라이선스 키 자동 생성
  - VAT/세금 자동 처리
  - 이메일 마케팅 통합
- **단점**: 수수료 높음
- **사용 사례**: MVP 검증 단계

#### Lemon Squeezy (성장 단계)
- **수수료**: 5% + $0.50
- **장점**:
  - Gumroad보다 전문적
  - Merchant of Record (세금 대행)
  - Webhook 통합
- **단점**: Gumroad보다 복잡
- **사용 사례**: $5k+ MRR 달성 후

#### Paddle (엔터프라이즈)
- **수수료**: 5% + $0.50
- **장점**:
  - 글로벌 세금 완전 자동화
  - 구독 관리 우수
  - 대규모 수익 처리
- **단점**: 승인 프로세스 있음
- **사용 사례**: $20k+ MRR 이상

#### 라이선스 검증
```javascript
// 예시: Gumroad License Verification
async function verifyLicense(licenseKey, email) {
  const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: 'YOUR_PRODUCT_ID',
      license_key: licenseKey,
      increment_uses_count: true
    })
  });

  const data = await response.json();
  return data.success && data.purchase.email === email;
}
```

---

## 7. 배포 및 패키징

### 7.1 DMG 생성 (Electron)

#### electron-builder 설정
```json
// package.json
{
  "name": "popdict",
  "version": "1.0.0",
  "main": "electron/main.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"electron .\"",
    "build": "vite build",
    "package": "electron-builder build --mac --publish never"
  },
  "build": {
    "appId": "com.yourname.popdict",
    "productName": "PopDict",
    "copyright": "Copyright © 2025 Your Name",
    "mac": {
      "category": "public.app-category.productivity",
      "icon": "build/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ]
    },
    "dmg": {
      "background": "build/dmg-background.png",
      "icon": "build/volume-icon.icns",
      "iconSize": 100,
      "contents": [
        {
          "x": 380,
          "y": 280,
          "type": "link",
          "path": "/Applications"
        },
        {
          "x": 110,
          "y": 280,
          "type": "file"
        }
      ],
      "window": {
        "width": 540,
        "height": 400
      }
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "package.json"
    ]
  }
}
```

#### Entitlements (접근성 권한)
```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

### 7.2 코드 사이닝 & 공증 (Notarization)

#### 필수 요구사항
1. **Apple Developer Account**: $99/년
2. **Developer ID Certificate**: Apple Developer 포털에서 발급
3. **App-Specific Password**: 공증 자동화용

#### 단계별 가이드

**Step 1: Certificate 다운로드**
```bash
# Xcode에서 자동으로 관리하거나 수동 다운로드
# Keychain Access에서 확인: "Developer ID Application: Your Name (TEAMID)"
security find-identity -v -p codesigning
```

**Step 2: 코드 사이닝**
```bash
# Electron-builder가 자동으로 처리하지만, 수동으로는:
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  --options runtime \
  --entitlements build/entitlements.mac.plist \
  dist/mac/PopDict.app
```

**Step 3: 자동 공증 (electron-builder)**
```javascript
// scripts/notarize.js
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  console.log(`Notarizing ${appName}...`);

  return await notarize({
    appBundleId: 'com.yourname.popdict',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

**Step 4: package.json에 추가**
```json
{
  "build": {
    "mac": {
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "afterSign": "scripts/notarize.js"
  }
}
```

**Step 5: 환경 변수 설정**
```bash
# .env (git에 커밋하지 말 것!)
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="abcd-efgh-ijkl-mnop"  # App-specific password
export APPLE_TEAM_ID="ABC123DEF4"
```

**Step 6: 빌드 실행**
```bash
npm run package
```

**공증 확인:**
```bash
# Stapling 확인 (자동으로 됨)
xcrun stapler validate dist/PopDict-1.0.0.dmg

# Gatekeeper 테스트
spctl -a -t open --context context:primary-signature -v dist/PopDict-1.0.0.dmg
```

### 7.3 아이콘 제작

#### 필요 크기
- 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024

#### 제작 도구
- **Figma/Sketch**: 디자인
- **Image2Icon**: PNG → ICNS 변환 (Mac 앱)
- **iconutil** (CLI):
```bash
# 1. icons.iconset 폴더 생성
mkdir icons.iconset

# 2. 각 크기별 PNG 복사
# icon_16x16.png, icon_32x32.png, ... icon_512x512@2x.png

# 3. ICNS 생성
iconutil -c icns icons.iconset -o build/icon.icns
```

#### 디자인 가이드라인
- **심플함**: 복잡한 디테일은 작은 크기에서 안 보임
- **대비**: 밝은/어두운 배경 모두에서 보이도록
- **의미**: 사전을 연상시키는 아이콘 (책, 돋보기, 글자 등)
- **독창성**: Alfred/Raycast와 차별화

### 7.4 자동 업데이트 (Sparkle)

#### Electron: electron-updater
```javascript
// electron/main.js
const { autoUpdater } = require('electron-updater');

app.on('ready', () => {
  // 앱 시작 시 업데이트 확인
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 가능',
    message: '새로운 버전이 있습니다. 다운로드할까요?',
    buttons: ['다운로드', '나중에']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall();
});
```

**배포 설정:**
```json
// package.json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "yourusername",
      "repo": "popdict"
    }
  }
}
```

---

## 8. 개발 로드맵

### Phase 1: MVP (Week 1-3)

#### Week 1: 기초 설정
- [ ] Electron + Vite + React 프로젝트 초기화
- [ ] TypeScript 설정
- [ ] Tailwind CSS 통합
- [ ] 투명 윈도우 설정 (vibrancy)
- [ ] 글로벌 단축키 등록 (Cmd+Shift+D)
- [ ] 기본 UI 레이아웃 (검색 바)

**완료 조건:**
- 단축키 눌렀을 때 투명한 윈도우가 나타남
- ESC로 숨기기 가능

#### Week 2: 핵심 기능
- [ ] Free Dictionary API 통합
- [ ] 검색 입력 디바운싱 (300ms)
- [ ] 결과 화면 디자인 (definition, phonetic, examples)
- [ ] 로딩 상태 표시
- [ ] 에러 처리 (단어 없음, 네트워크 오류)
- [ ] 히스토리 저장 (electron-store, 최근 10개)

**완료 조건:**
- 단어 입력 후 1초 이내에 결과 표시
- 오프라인 시 적절한 에러 메시지

#### Week 3: UI 폴리시 & 테스트
- [ ] Liquid Glass CSS 완성 (backdrop-filter, gradients)
- [ ] Framer Motion 애니메이션 (fade in/out)
- [ ] 다크/라이트 모드 대응
- [ ] 포커스 잃으면 자동 숨김
- [ ] 키보드 내비게이션 (Arrow keys, Enter)
- [ ] 아이콘 디자인 (1024x1024)
- [ ] 5-10명 베타 테스트

**완료 조건:**
- 60fps 부드러운 애니메이션
- 베타 테스터 피드백 수집 완료

### Phase 2: Pro 기능 (Week 4-6)

#### Week 4: Pro Tier 기반
- [ ] Gumroad 라이선스 키 통합
- [ ] 라이선스 활성화 UI
- [ ] 무료/Pro 기능 분리
- [ ] 설정 패널 (단축키 커스터마이징)
- [ ] 히스토리 무제한 확장
- [ ] 히스토리 검색 기능

**완료 조건:**
- 라이선스 키로 Pro 기능 활성화 가능
- 설정 저장/불러오기 작동

#### Week 5: 고급 기능
- [ ] WordNet 오프라인 DB 통합 (~100MB)
- [ ] 오프라인/온라인 모드 자동 전환
- [ ] 즐겨찾기/북마크 기능
- [ ] 컬렉션 (폴더별 단어 정리)
- [ ] CSV/JSON 내보내기
- [ ] 테마 커스터마이징 (색상, 블러 강도)

**완료 조건:**
- 인터넷 없이도 기본 검색 작동
- 데이터 백업 기능 작동

#### Week 6: 다국어 & 컨텍스트 메뉴
- [ ] 네이버 Papago API 통합 (한영/영한)
- [ ] 언어 자동 감지
- [ ] macOS 컨텍스트 메뉴 통합 (우클릭)
- [ ] 선택한 텍스트 자동 검색
- [ ] Pro 페이월 UI (비침투적)
- [ ] 업그레이드 플로우

**완료 조건:**
- Safari에서 단어 선택 → 우클릭 → PopDict 검색 작동
- 한국어 검색 시 Papago 번역 표시

### Phase 3: 배포 준비 (Week 7-8)

#### Week 7: 패키징
- [ ] Apple Developer 계정 구입 ($99)
- [ ] .icns 아이콘 파일 생성
- [ ] electron-builder 설정
- [ ] DMG 배경 이미지 디자인
- [ ] 코드 사이닝 설정
- [ ] 자동 공증(Notarization) 스크립트
- [ ] 테스트 빌드 생성

**완료 조건:**
- 공증된 DMG 파일이 타인의 Mac에서 경고 없이 실행됨

#### Week 8: 런칭 준비
- [ ] 랜딩 페이지 제작 (Carrd 또는 커스텀)
- [ ] 데모 비디오/GIF 제작 (30초)
- [ ] Product Hunt 게시물 작성
- [ ] Press Kit (스크린샷, 로고, 설명)
- [ ] Gumroad 제품 페이지 설정
- [ ] 이메일 드립 시퀀스 (launch list용)
- [ ] Plausible Analytics 설정
- [ ] Sentry 에러 트래킹 설정

**완료 조건:**
- 랜딩 페이지 라이브
- Product Hunt 예약 완료

### Phase 4: 런칭 & 반복 (Week 9+)

#### Week 9: 소프트 런칭
- [ ] 친구/가족 10명에게 공유
- [ ] 이메일 리스트에 공지 (있다면)
- [ ] Reddit r/macapps 포스팅
- [ ] Twitter/X 공지
- [ ] 초기 피드백 수집

**성공 지표:**
- 첫 주 50+ 다운로드
- 5+ Pro 구매

#### Week 10: 공식 런칭
- [ ] Product Hunt 런칭
- [ ] Hacker News Show HN 포스팅
- [ ] LinkedIn 공유
- [ ] 기술 블로그 글 작성
- [ ] 긴급 버그 모니터링

**성공 지표:**
- 런칭 당일 500+ 다운로드
- Product Hunt Daily Top 5 진입

#### Week 11-12: 반복 개선
- [ ] Sentry 에러 분석 및 수정
- [ ] 사용자 피드백 기반 개선
- [ ] 성능 최적화 (startup time, memory)
- [ ] 문서/FAQ 작성
- [ ] v1.1 계획 수립

**KPI 모니터링:**
- DAU (Daily Active Users)
- 평균 검색 횟수/사용자
- Pro 전환율
- 이탈률 (Churn)

### Long-term (Month 4-12)

#### Month 4-6: 기능 확장
- [ ] AI 기능 (GPT 통합) - Pro+ 전용
- [ ] 클라우드 동기화 (CloudKit 또는 Firebase)
- [ ] 단어 학습 기능 (암기장, 복습 알림)
- [ ] Alfred/Raycast 플러그인 제공 (상호운용성)
- [ ] App Store 제출

#### Month 7-12: Swift 네이티브 버전
- [ ] SwiftUI 리빌드 시작
- [ ] 성능 벤치마크 (vs Electron)
- [ ] 베타 테스팅
- [ ] 기존 사용자 마이그레이션
- [ ] "Pro Native" 버전 출시

---

## 9. 잠재적 문제 및 해결책

### 문제 1: 글로벌 단축키 충돌
**증상:** 사용자의 다른 앱이 동일한 단축키 사용

**해결책:**
- 기본값을 드물게 사용되는 조합으로 (Cmd+Shift+D)
- 설정에서 완전 커스터마이징 가능하게
- 충돌 감지 시 경고 표시
- 대안: 메뉴바 아이콘 클릭으로도 열기

**구현:**
```javascript
function detectConflict(shortcut) {
  const ret = globalShortcut.register(shortcut, handler);
  if (!ret) {
    dialog.showMessageBox({
      type: 'warning',
      message: `단축키 ${shortcut}이(가) 다른 앱과 충돌합니다. 설정에서 변경해주세요.`
    });
    // 기본값으로 메뉴바 아이콘 활성화
    showMenuBarIcon();
  }
}
```

### 문제 2: 접근성 권한 거부
**증상:** 사용자가 접근성 권한을 주지 않아 단축키 작동 안 함

**해결책:**
- 명확한 온보딩 (스크린샷, 단계별 가이드)
- System Preferences 직접 링크 제공
- 권한 없이도 작동하는 fallback 모드
  - 메뉴바 아이콘
  - Dock 아이콘
  - Alfred/Raycast 통합

**UX 플로우:**
```
앱 첫 실행
  ↓
권한 확인
  ↓
없음 → 온보딩 화면
        "PopDict는 글로벌 단축키를 위해 접근성 권한이 필요합니다"
        [시스템 환경설정 열기] [나중에]
  ↓
[나중에] 선택 → 메뉴바 모드로 계속 사용
```

### 문제 3: API Rate Limit 초과
**증상:** 무료 API의 일일 한도 초과 (Merriam-Webster 1000/day)

**해결책:**
- 클라이언트 사이드 캐싱 (24시간)
- IndexedDB/electron-store에 응답 저장
- 캐시 히트율 모니터링
- Rate limit 90% 도달 시 경고
- Pro 사용자는 오프라인 DB 사용 권장

**캐싱 전략:**
```javascript
const cache = new Map(); // 또는 IndexedDB

async function searchWithCache(word) {
  const cached = cache.get(word.toLowerCase());
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.data;
  }

  const data = await fetchAPI(word);
  cache.set(word.toLowerCase(), { data, timestamp: Date.now() });
  return data;
}
```

### 문제 4: App Store 심사 거부
**증상:** 접근성 권한, Electron 크기, 샌드박싱 문제로 거부

**해결책:**
- 사전에 App Store Review Guidelines 숙지
- 접근성 권한 정당성 명확히 설명 (Info.plist)
- 샌드박싱 적용 (제약 감수)
- 초기엔 직접 배포 우선, App Store는 차후
- 거부 시 재심 요청 또는 수정 후 재제출

**Info.plist 예시:**
```xml
<key>NSAppleEventsUsageDescription</key>
<string>PopDict는 글로벌 단축키로 어디서든 사전을 검색할 수 있도록 접근성 권한이 필요합니다.</string>
```

### 문제 5: 라이선스 키 불법 공유
**증상:** 사용자들이 라이선스 키를 공유 커뮤니티에 유출

**해결책:**
- 기기 활성화 제한 (3-5대)
- 온라인 검증 (최초 활성화 시)
- 과도한 DRM 지양 (신뢰 기반)
- 합리적 가격으로 불법 복제 동기 감소
- Gumroad가 자동으로 사용 횟수 추적

**검증 로직:**
```javascript
async function activateLicense(key, email) {
  const result = await verifyWithGumroad(key, email);

  if (!result.success) {
    throw new Error('유효하지 않은 라이선스');
  }

  if (result.uses > 5) {
    throw new Error('활성화 한도 초과. 지원팀에 문의하세요.');
  }

  // 로컬 저장
  saveLicenseLocally(key, email);
}
```

### 문제 6: 성능 문제 (Electron)
**증상:** 느린 시작 시간 (2-3초), 높은 메모리 사용

**해결책:**
- V8 스냅샷 활용
- 레이지 로딩 (처음엔 검색창만)
- 네이티브 모듈 최소화
- 프로덕션 빌드 최적화
- 심각하면 Swift 마이그레이션 고려

**최적화 체크리스트:**
- [ ] React DevTools 제거 (프로덕션)
- [ ] 코드 스플리팅
- [ ] 이미지 압축
- [ ] 불필요한 의존성 제거
- [ ] electron-builder 압축 활성화

### 문제 7: macOS 버전 호환성
**증상:** 구버전 macOS에서 작동 안 함 (특히 M1/M2 Mac)

**해결책:**
- 최소 지원 버전 명확히: macOS 11 (Big Sur) 이상
- Universal Binary 빌드 (x64 + arm64)
- electron-builder가 자동 처리
- 구버전 사용자에게 명확한 안내

**빌드 설정:**
```json
{
  "build": {
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]  // Universal
        }
      ]
    }
  }
}
```

### 문제 8: 마케팅 & 발견성
**증상:** 좋은 제품이지만 사용자가 발견하지 못함

**해결책:**
- SEO 최적화 ("macOS dictionary app", "Spotlight alternative")
- Product Hunt, Hacker News 런칭
- Reddit 커뮤니티 참여 (r/macapps, r/productivity)
- Twitter/X 개발 과정 공유 (build in public)
- 블로그 글 작성 ("How I built...", "Why I switched from...")
- 인플루언서/유튜버 리뷰 의뢰 (무료 Pro 라이선스 제공)
- App Store "Featured" 신청
- 언어 학습 커뮤니티 타겟 (듀오링고 서브레딧 등)

---

## 10. 마케팅 전략

### 10.1 런칭 전 (Pre-launch)

#### 랜딩 페이지
**필수 요소:**
- 🎯 명확한 가치 제안: "1초 안에 사전 검색"
- 🎬 데모 비디오/GIF (30초)
- ✨ 스크린샷 (Liquid Glass UI 강조)
- 📧 이메일 가입 폼 (런칭 알림)
- 💰 가격 정보 (무료/Pro)
- 🔗 다운로드 버튼 (런칭 후)

**추천 도구:**
- Carrd (무료, 빠름)
- Webflow (전문적)
- Next.js + Tailwind (커스텀)

**SEO 키워드:**
- "macOS dictionary app"
- "Spotlight alternative for dictionary"
- "English dictionary macOS"
- "Korean English dictionary Mac"
- "offline dictionary app Mac"

#### Build in Public
**플랫폼:**
- Twitter/X: 개발 과정 트윗 스레드
- Reddit r/SideProject: 진행 상황 공유
- Indie Hackers: 개발 일지

**콘텐츠 아이디어:**
- "Day 1: Starting PopDict, a macOS dictionary app"
- "Week 2: Implementing liquid glass UI - Here's how"
- "Challenges I faced with macOS global hotkeys"
- "Preparing for Product Hunt launch"

### 10.2 런칭 (Launch)

#### Product Hunt
**체크리스트:**
- [ ] 목요일 아침 12:01 AM PST 게시 (최적 시간)
- [ ] Catchy tagline: "Your dictionary, one shortcut away"
- [ ] 6개 스크린샷 + 1개 데모 영상
- [ ] Maker intro 코멘트 (personal story)
- [ ] 지인들에게 upvote/댓글 부탁 (subtle)
- [ ] 당일 댓글 실시간 응답

**예시 설명:**
```
PopDict - Beautiful, instant dictionary for macOS

Tired of switching to your browser every time you need to look up a word?

PopDict brings a Spotlight-like dictionary search to your Mac with:
• ⌘⇧D global hotkey for instant access
• Beautiful liquid glass UI that feels native
• English, Korean, and more languages
• Offline mode (Pro)
• Sync across Macs (Pro+)

Free to try. Pro from $9.99.
```

#### Hacker News
**전략:**
- Product Hunt 다음 날 "Show HN" 포스팅
- 기술적 도전 강조 (macOS APIs, performance)
- 오픈소스 부분 있으면 언급
- 커뮤니티 피드백 요청

**제목 예시:**
```
Show HN: PopDict – A Spotlight-style dictionary app for macOS
```

#### Reddit
**타겟 서브레딧:**
- r/macapps (100k+ members) - 직접 홍보 허용
- r/productivity (1.5M+) - 생산성 도구 추천
- r/languagelearning (1.2M+) - 언어 학습자
- r/Korean (200k+) - 한영/영한 기능 강조

**주의사항:**
- 각 서브레딧 규칙 확인
- 스팸처럼 보이지 않게
- 진정성 있는 스토리 공유

### 10.3 성장 (Growth)

#### 콘텐츠 마케팅
**블로그 주제:**
1. "Why I Built PopDict: The Story Behind a Mac Dictionary App"
2. "10 Productivity Apps Every Mac User Should Try" (PopDict 포함)
3. "How to Learn English Faster with PopDict"
4. "Behind the Scenes: Building Liquid Glass UI on macOS"

**게스트 포스팅:**
- Medium publications (Better Programming, Mac O'Clock)
- Dev.to
- Hashnode

#### 인플루언서/유튜버
**타겟:**
- Mac productivity YouTubers (Ali Abdaal, Matt D'Avella 같은 채널)
- 기술 리뷰어 (iJustine, MKBHD - 어렵지만 꿈은 크게)
- 언어 학습 인플루언서

**협업 방식:**
- 무료 Pro 라이선스 제공
- 할인 코드 제공 (커미션 5-10%)
- 리뷰 비용 지불 (채널 크기에 따라 $50-500)

#### 입소문 (Word of Mouth)
**전략:**
- Referral 프로그램: 친구 추천 시 양쪽 모두 할인
- Twitter 공유 시 Pro 1개월 무료
- "Made with PopDict" 배지 (블로그/웹사이트용)

### 10.4 유지 (Retention)

#### 이메일 마케팅
**시퀀스:**
1. Day 0: Welcome email + 튜토리얼
2. Day 3: "Pro 기능 써보셨나요?" + 14일 체험
3. Day 7: 사용자 스토리 공유
4. Day 14: Pro 할인 (20% off)
5. Day 30: 피드백 요청

#### 업데이트 공지
- 주요 기능 출시 시 블로그 + 이메일
- Product Hunt "Ship" 페이지 활용
- Twitter 업데이트 로그

#### 커뮤니티
- Discord 서버 (사용자 100명 이상 시)
- GitHub Discussions (오픈소스 부분)
- r/PopDict 서브레딧 (규모 확대 시)

---

## 11. 성공 지표 (KPIs)

### 단기 (Month 1-3)
- **다운로드**: 500 → 2,000 → 5,000
- **DAU**: 50 → 200 → 500
- **Pro 전환율**: 2% → 3% → 5%
- **MRR**: $50 → $250 → $750
- **리텐션 (D7)**: 20% → 30% → 40%

### 중기 (Month 6-12)
- **다운로드**: 10,000 → 50,000
- **DAU**: 1,000 → 5,000
- **MRR**: $1,500 → $5,000
- **Pro 전환율**: 5% → 7%
- **NPS Score**: 40+ → 50+

### 장기 (Year 2+)
- **전체 사용자**: 100,000+
- **유료 사용자**: 5,000+
- **MRR**: $15,000+ (풀타임 가능)
- **App Store Rating**: 4.5+ ⭐

---

## 12. 예산 & 비용

### 초기 투자
```
Apple Developer Account: $99/년
도메인 (popdict.com): $12/년
호스팅 (Vercel/Netlify): $0 (무료)
Gumroad 수수료: 10% (매출에서 차감)
디자인 도구 (Figma): $0 (무료 플랜)
----------------------------------
총 초기 비용: ~$111
```

### 월간 운영비 (성장 시)
```
API 비용 (Google Translate): $10-50
서버 (CloudKit/Firebase): $0-20
Analytics (Plausible): $9
Error tracking (Sentry): $0 (무료 플랜)
이메일 마케팅 (Loops.so): $0-30
----------------------------------
총 월간 비용: $19-109
```

### 손익분기점
```
월 운영비 $100 가정
Pro $9.99 → Gumroad 수수료 10% = $8.99 순수익
필요 판매: $100 / $8.99 = 12 Pro/월

또는 Pro+ $1.99/월 6명 + Pro 일회성 $9.99 5명
```

**결론:** 매우 낮은 손익분기점 → 위험 부담 적음

---

## 13. 다음 단계

### 즉시 실행
1. ✅ **기술 스택 결정**: Electron (MVP) vs Swift (장기)
2. ✅ **프로젝트 초기화**: `npm create vite@latest popdict -- --template react-ts`
3. ✅ **기본 윈도우 설정**: 투명, vibrancy, 글로벌 단축키
4. ✅ **첫 API 호출**: Free Dictionary API 테스트

### 이번 주
- [ ] 검색 UI 완성
- [ ] 결과 화면 디자인
- [ ] 5명에게 첫 프로토타입 보여주기

### 이번 달
- [ ] MVP 완성 (Phase 1)
- [ ] 베타 테스터 모집 (20-50명)
- [ ] 랜딩 페이지 제작

### 3개월 내
- [ ] Pro 기능 개발
- [ ] 공식 출시 (Product Hunt)
- [ ] 첫 $100 수익 달성

---

## 14. 참고 자료

### 공식 문서
- Electron: https://www.electronjs.org/docs
- SwiftUI: https://developer.apple.com/tutorials/swiftui
- electron-builder: https://www.electron.build/

### 튜토리얼
- "Building macOS apps with Electron" (Traversy Media)
- "SwiftUI for Mac" (Paul Hudson, Hacking with Swift)
- "App Notarization Guide" (Apple Developer)

### 커뮤니티
- r/electronjs
- r/SwiftUI
- Indie Hackers
- Mac Developers Slack

### 경쟁 제품 연구
- Alfred: https://www.alfredapp.com/
- Raycast: https://raycast.com/
- Spotlight 대안 비교: https://alternativeto.net/software/spotlight/

---

## 결론

PopDict는 검증된 시장(Alfred/Raycast의 성공)에서 **특화된 니치(사전 전용)**를 공략하는 전략입니다.

**핵심 성공 요인:**
1. ⚡ **속도**: 1초 안에 결과 (브라우저보다 3배 빠름)
2. 💎 **디자인**: Liquid Glass로 차별화
3. 🎯 **집중**: 사전만 완벽하게 (feature bloat 피하기)
4. 💰 **가격**: 합리적 ($9.99), 무료 체험 가능
5. 🚀 **실행**: 빠른 MVP (4-6주), 빠른 피드백

**첫 목표:** $1,000 MRR (월 100명 Pro 사용자)
**궁극 목표:** $15,000 MRR (풀타임 인디 개발자)

지금 시작하세요! 🚀
