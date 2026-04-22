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

수식은 두 백엔드를 추상 인터페이스로 통일.

- **Formualizer** (Rust + WASM, MIT OR Apache-2.0) — 기본. Excel 호환 320+ 함수,
  VLOOKUP/SUMIF/FILTER/LEFT/TODAY 등 전부 동작. WASM 부팅이 끝난 뒤부터 활성.
- **mathjs** (Apache-2.0) — 초기 부팅 수백 ms 동안의 fallback + `localStorage['balruno:formula:backend'] = 'mathjs'` 강제 override 경로.

게임 도메인 함수 (SCALE / DAMAGE / DPS / TTK / EHP / GACHA_PITY / LTV 등 40+)는
`src/lib/formulas/` 에 순수 함수로 정의되어 **두 엔진 모두에 동일하게 주입** (mathjs 번들 + Formualizer
`registerFunction`). 결과 동등성은 `src/lib/formula/backendEquivalence.test.ts` 의 20개 케이스로
검증.

참조 문법 (한글 컬럼명·`PREV.Column`·`Sheet.RowID.Column`·`{Link}.Column`) 은 `convertKoreanToScope`
가 평탄화 → 변수 치환 후 선택된 엔진에 전달. 두 엔진이 동일 scope 를 공유.

## Icons

| Light Mode | Dark Mode |
|:---:|:---:|
| <img src="public/icon.svg" width="64" height="64" alt="Light mode icon"> | <img src="public/icon-dark.svg" width="64" height="64" alt="Dark mode icon"> |
