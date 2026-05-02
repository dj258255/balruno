<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/icon-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="public/icon.svg">
  <img alt="Balruno Logo" src="public/icon.svg" width="80" height="80">
</picture>

# Balruno — Frontend

게임 스튜디오 워크스페이스 (밸런싱 + 애자일 PM + 로드맵) 의 Next.js 16 프론트엔드.

메인 프로젝트 문서는 [루트 README](../README.md) 참조.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Formula Engine

단일 엔진 · 순수 JS · 3개 레이어를 한 mathjs 인스턴스에 주입.

1. **mathjs** (Apache-2.0) — 사칙·삼각·상수·파서·스코프·함수 등록 기반.
2. **@formulajs/formulajs** (MIT, 주간 DL 240K+) — Excel 호환 300+ 함수.
   VLOOKUP / SUMIF / FILTER / LEFT / RIGHT / MID / CONCATENATE / DATE / WEEKDAY /
   XLOOKUP / IFERROR 등. 순수 JS 라 WASM 번들·비동기 초기화 불필요.
3. **게임 도메인 함수** (`src/lib/formulas/`) — SCALE / DAMAGE / DPS / TTK / EHP /
   GACHA_PITY / DIMINISHING / LTV / ARPU / K_FACTOR 등 40+. 동일 이름 충돌 시 우리 정의 우선.

참조 문법 (한글 컬럼명·`PREV.Column`·`Sheet.RowID.Column`·`{Link}.Column`) 은
`convertKoreanToScope` 가 평탄화 → 변수 치환 → mathjs scope 로 전달.

통합 테스트: `src/lib/formula/excelCompat.test.ts` 에서 3개 레이어 + 참조 해석 결합 검증.

## Icons

| Light Mode | Dark Mode |
|:---:|:---:|
| <img src="public/icon.svg" width="64" height="64" alt="Light mode icon"> | <img src="public/icon-dark.svg" width="64" height="64" alt="Dark mode icon"> |
