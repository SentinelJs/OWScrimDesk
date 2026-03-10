# Development Guide

## 목적

이 문서는 이 프로젝트를 다음 개발자가 이어서 수정할 때 필요한 구조, 흐름, 주의사항, 우선순위를 빠르게 이해하기 위한 내부 개발 문서다.

이 프로젝트 `OWScrimDesk`는 Overwatch 내전 중계 관리용 웹 앱이며, 현재는 다음 구조를 가진다.

- 서버: Express + `ws`
- 저장소: JSON 파일
- 프런트: 정적 HTML + 브라우저 ES module
- 런타임 리소스: `img/`, `video/`

## 빠른 시작

설치:

```bash
npm install
```

실행:

```bash
npm start
```

타입체크:

```bash
npm run typecheck
```

기본 주소:

- 메인: `http://localhost:3000/`
- 관리자: `http://localhost:3000/admin.html`
- 오버레이 스냅샷 API: `http://localhost:3000/api/overlay/snapshot`

## 현재 디렉토리 구조

```text
app/
  backend/
    bootstrap/
    platform/
    modules/
    shared/
  frontend/
    public/
      js/
        admin/
          app/
          core/
          features/
data/
docs/
img/
video/
server.js
```

### 디렉토리 역할

`app/backend/bootstrap`
- 서버 시작점과 경로 상수를 둔다.
- 앱 조립만 담당해야 한다.

`app/backend/platform`
- HTTP, WebSocket, JSON persistence 같은 기술 어댑터를 둔다.
- 도메인 규칙은 여기에 두지 않는다.

`app/backend/modules`
- 도메인별 비즈니스 로직을 둔다.
- 현재는 `assets`, `match`, `overlay`, `teams` 기준으로 나뉜다.

`app/backend/shared`
- 타입 계약, 공용 스키마, 파일 유틸을 둔다.

`app/frontend/public/js/admin/app`
- 관리자 페이지 엔트리.

`app/frontend/public/js/admin/core`
- 관리자 공통 상태, WS, UI, 자동완성, unsaved 관리.

`app/frontend/public/js/admin/features`
- 관리자 기능 단위 모듈.

`data`
- 런타임 상태 저장 위치.

`img`, `video`
- 런타임 리소스 루트.
- 경로 의존성이 있으므로 함부로 이동하지 않는다.

## 절대 건드리면 안 되는 전제

### `img/`의 auto update 스크립트

다음 스크립트는 의도적으로 `img/` 경로에 위치한다.

- `img/hero_auto_update.js`
- `img/map_auto_update.js`

이 파일들은 현재 경로 의존적으로 배치되어 있으므로, 구조 미화 목적의 이동 대상이 아니다.

### 루트 `server.js`

루트의 `server.js`는 실제 서버 구현이 아니라 엔트리 shim이다. 외부 실행 환경, 향후 패키징, 기존 실행 습관을 고려하면 유지하는 편이 좋다.

## 서버 구조 설명

### 1. Bootstrap

`app/backend/bootstrap/server.js`
- Express 앱 생성
- repository / service 생성
- HTTP / WS 등록
- 서버 listen

`app/backend/bootstrap/paths.js`
- 프로젝트 전역 경로 상수 관리
- 새로운 경로 의존이 생기면 우선 여기서 관리할 것

### 2. Platform

`app/backend/platform/http/http-routes.js`
- REST 라우트 등록
- 입력 파싱, 서비스 호출, 응답 반환

`app/backend/platform/ws/websocket.js`
- WebSocket 연결 및 메시지 분배
- `overlay:hello`, `admin:publish` 처리

`app/backend/platform/persistence/json-repository.js`
- JSON 파일 로드/저장
- 현재 저장소 구현은 이 파일 하나로 캡슐화되어 있다

### 3. Modules

`app/backend/modules/match/domain`
- 상태 기본값
- normalize
- 메타 계산
- 맵/영웅밴 규칙

`app/backend/modules/match/application`
- 관리자 저장 흐름
- publish 흐름

`app/backend/modules/overlay/application`
- 오버레이 스냅샷 생성
- asset lookup 생성
- 점수 계산

`app/backend/modules/assets`
- `img/` 기준으로 맵/영웅 에셋 스캔

`app/backend/modules/teams/application`
- 로고 dominant color 추출

### 4. Shared

`app/backend/shared/contracts/types.d.ts`
- 서버 내부 JSDoc 타입 계약

`app/backend/shared/contracts/schemas.js`
- HTTP/WS 입력 최소 검증

`app/backend/shared/storage.js`
- JSON 파일 저장용 공용 파일 유틸

## 관리자 프런트 구조 설명

`app/frontend/public/js/admin/app/main.js`
- 관리자 전체 초기화 엔트리
- 데이터 fetch
- feature module 생성 및 연결

`app/frontend/public/js/admin/core/*`
- `state.js`: 전역 상태
- `net.js`: fetch, ws publish
- `ui.js`: toast/error
- `autocomplete.js`: 자동완성
- `unsaved.js`: 미저장 변경 관리

`app/frontend/public/js/admin/features/*/index.js`
- 기능별 UI/상태/네트워크 로직

현재 한계:

- `ingame/index.js`와 `etc/index.js`는 파일 크기가 크고 책임이 많다.
- DOM 접근, 로컬 상태 계산, 서버 publish 로직이 한 파일에 같이 있다.
- 다음 리팩토링 우선순위의 핵심 대상이다.

## 데이터 흐름

### 관리자 저장

1. 관리자 페이지에서 입력
2. feature module이 현재 `state`를 조합
3. REST 또는 WS publish 요청
4. 서버에서 스키마 검증
5. 서비스에서 비즈니스 검증
6. repository가 JSON 저장
7. snapshot 생성 후 overlay broadcast

### 오버레이 화면 진입

1. 페이지가 `/api/overlay/snapshot` 호출
2. 이후 WebSocket `overlay:hello`
3. 서버가 `overlay:update` 전송
4. 이후 관리자 변경 시 브로드캐스트로 동기화

## 수정할 때의 원칙

### 원칙 1. 경로 상수는 `paths.js`로 모은다

새로운 파일 시스템 경로를 하드코딩하지 않는다.

### 원칙 2. 규칙은 platform이 아니라 module domain에 둔다

HTTP 라우트나 WS 파일에 규칙을 넣지 않는다.

### 원칙 3. 저장 구현은 repository 뒤에 숨긴다

현재는 JSON이지만, 나중에 SQLite로 바꿀 수 있어야 한다.

### 원칙 4. 프런트 feature는 더 잘게 쪼갤 수 있게 유지한다

특히 다음과 같이 나누는 방향이 좋다.

- `state.js`
- `actions.js`
- `view.js`
- `dom.js`

지금은 아직 `index.js` 하나로 유지되지만, 다음 분해 목표는 이 구조다.

## 현재 알려진 구조적 한계

### 1. `match/domain/rules.js` 응집도 부족

맵 선택, 밴 검증, 사이드 선택 로직이 한 파일에 있다.

권장 분리:

- `map-rules.js`
- `ban-rules.js`
- `side-pick.js`

### 2. `admin-state-service.js` 역할 혼합

settings / teams / state / history 수정이 한 서비스에 같이 있다.

권장 분리:

- `manage-settings`
- `manage-teams`
- `manage-match-state`
- `manage-history`

### 3. 관리자 feature 대형 파일

특히 다음 파일은 응집도가 낮다.

- `app/frontend/public/js/admin/features/ingame/index.js`
- `app/frontend/public/js/admin/features/etc/index.js`

### 4. display 페이지의 인라인 스크립트

`admin.html` 이외 화면은 아직 HTML 내부 스크립트 비중이 크다.
장기적으로는 각 화면별 JS 모듈로 추출해야 한다.

## 권장 다음 작업 순서

1. `match/domain/rules.js` 분해
2. `admin/features/ingame/index.js` 분해
3. `admin/features/etc/index.js` 분해
4. display 페이지 인라인 스크립트 추출
5. repository 인터페이스 유지한 채 SQLite 전환 검토
6. Electron 기반 클릭 실행 패키징 준비

## 패키징 관점 주의사항

향후 Windows/macOS 클릭 실행 앱으로 패키징할 계획이 있으므로 아래 전제를 유지하는 것이 좋다.

- 루트 `server.js` 엔트리는 유지
- 런타임 리소스 `img/`, `video/`, `data/` 경계는 명확히 유지
- 프로젝트 루트 기준 상대경로 남발 금지
- 경로는 `bootstrap/paths.js` 기준으로 접근

## 문서 갱신 규칙

다음 변경이 생기면 이 문서를 같이 갱신하는 것이 좋다.

- 폴더 구조 변경
- 서버 진입점 변경
- 데이터 저장 방식 변경
- 관리자 feature 분해 완료
- 패키징 방식 결정

## 참고 파일

- 서버 시작점: `server.js`
- 실제 서버 조립: `app/backend/bootstrap/server.js`
- 경로 상수: `app/backend/bootstrap/paths.js`
- 관리자 엔트리: `app/frontend/public/js/admin/app/main.js`
- 구조 설명 문서: `README.md`
