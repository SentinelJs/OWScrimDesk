# 오버워치 내전 중계 관리 시스템

내전 진행에 필요한 **팀/맵/영웅밴/오버레이** 화면을 한곳에서 관리하는 웹 기반 중계 관리 시스템입니다.

## 주요 화면

### 메인
![메인](example_image/main.png)

### 관리자 패널
- 팀 관리
  ![관리자-팀](example_image/admin_team.png)
- 인게임 설정
  ![관리자-인게임](example_image/admin_ingame.png)
- 히스토리 관리
  ![관리자-히스토리](example_image/admin_history.png)
- 매치 정보
  ![관리자-매치](example_image/admin_matchinfo.png)

### 맵 픽
![맵 픽](example_image/mappick.png)

### 영웅 밴
![영웅 밴](example_image/heroban.png)

### 인게임 오버레이
![인게임 오버레이](example_image/ingameoverlay.png)

## 실행

```bash
npm install
npm start
```

- 메인: http://localhost:3000/
- 관리자: http://localhost:3000/admin.html
- 맵 픽: http://localhost:3000/map-pick
- 영웅 밴: http://localhost:3000/hero-ban
- 인게임 오버레이: http://localhost:3000/in-game-overlay
