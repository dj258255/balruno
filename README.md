<p align="center">
  <img src="frontend/public/icon.svg" alt="Balruno Logo" width="120" height="120">
</p>

<h1 align="center">Balruno</h1>

<p align="center">
  <strong>Game Balancing Spreadsheet for Indie Developers</strong>
</p>

<p align="center">
  <a href="https://balruno.com">
    <img src="https://img.shields.io/badge/Live%20Demo-Visit%20Site-blue?style=for-the-badge" alt="Live Demo">
  </a>
</p>

<p align="center">
  <a href="https://balruno.com">
    <img src="https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel" alt="Vercel">
  </a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Zustand-5.0-orange" alt="Zustand">
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT">
  </a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#한국어">한국어</a>
</p>

---

![Screenshot](docs/images/intro.png)

## English

### What is Balruno?

A spreadsheet-based tool designed specifically for game balancing. Calculate DPS, EHP, TTK automatically, run Monte Carlo simulations, and export directly to Unity/Godot/Unreal.

**No login required. No server needed. Everything runs locally in your browser.**

### Features

| Category | Features |
|----------|----------|
| **Formulas** | 70+ game-specific formulas (DPS, EHP, TTK, SCALE, DIMINISH, etc.) |
| **Simulation** | Monte Carlo simulation (1K~100K battles, 95% CI) |
| **Analysis** | Z-score outlier detection, power curve analysis |
| **Economy** | Faucet/Sink model, inflation calculator |
| **Visualization** | DPS variance distribution, build comparison charts |
| **Curve Fitting** | Draw graphs → auto-generate formulas |
| **Export** | Unity, Godot, Unreal code generation |
| **Integration** | REST API, WebSocket, Firebase support |
| **Storage** | Local-first (IndexedDB), no server required |

### Quick Start

```bash
# Clone the repository
git clone https://github.com/dj258255/balruno.git

# Navigate to frontend
cd balruno/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Formula Examples

```javascript
// Combat formulas
=DPS(atk, speed, crit, critDmg)    // Damage per second with crit
=EHP(hp, def)                       // Effective HP
=TTK(hp, dps)                       // Time to kill
=DAMAGE(atk, def)                   // Damage calculation

// Scaling formulas
=SCALE(base, level, rate, "exp")    // Exponential level scaling
=DIMINISH(value, soft, hard)        // Diminishing returns

// Reference formulas
=REF("Monsters", "Goblin", "HP")    // Cross-sheet reference
```

### Tech Stack

```
Frontend Framework    Next.js 16 (App Router, Turbopack)
Language             TypeScript (Strict Mode)
State Management     Zustand 5
Local Storage        IndexedDB (via idb)
Styling              Tailwind CSS 3.4
Charts               Recharts
Math Engine          mathjs
i18n                 next-intl (EN/KO)
```

### Project Structure

```
balruno/
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   ├── components/
│   │   │   ├── modals/       # Modal components
│   │   │   ├── panels/       # Tool panels (Calculator, Simulation, etc.)
│   │   │   ├── sheet/        # Spreadsheet components
│   │   │   └── ui/           # Reusable UI primitives
│   │   ├── hooks/            # Custom React hooks
│   │   ├── stores/           # Zustand stores
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility functions & formula engine
│   ├── messages/             # i18n translations (en.json, ko.json)
│   └── public/               # Static assets
├── docs/                     # Documentation
├── .github/                  # GitHub templates & workflows
├── CONTRIBUTING.md           # Contribution guidelines
├── CODE_OF_CONDUCT.md        # Code of conduct
└── LICENSE                   # MIT License
```

### Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Roadmap

- [x] Spreadsheet-based UI
- [x] 70+ game-specific formulas
- [x] Monte Carlo battle simulation
- [x] Game engine export (Unity/Godot/Unreal)
- [x] Economy simulation (Faucet/Sink)
- [x] DPS variance visualization
- [x] Curve fitting (Graph → Formula)
- [x] SDK/API integration
- [ ] Cloud sync
- [ ] Team collaboration
- [ ] AI-powered balance suggestions

### License

MIT License - see [LICENSE](LICENSE) for details.

### Links

- [Live Demo](https://balruno.com)
- [Documentation (English)](docs/DESIGN_EN.md)
- [Documentation (한국어)](docs/DESIGN_KO.md)
- [Report Bug](https://github.com/dj258255/balruno/issues/new?template=bug_report.md)
- [Request Feature](https://github.com/dj258255/balruno/issues/new?template=feature_request.md)

---

## 한국어

### Balruno란?

게임 밸런싱에 특화된 스프레드시트 기반 도구입니다. DPS, EHP, TTK를 자동으로 계산하고, 몬테카를로 시뮬레이션을 돌리고, Unity/Godot/Unreal로 바로 내보낼 수 있습니다.

**로그인 필요 없음. 서버 필요 없음. 모든 것이 브라우저에서 로컬로 실행됩니다.**

### 주요 기능

| 카테고리 | 기능 |
|----------|------|
| **수식** | 70개+ 게임 특화 수식 (DPS, EHP, TTK, SCALE, DIMINISH 등) |
| **시뮬레이션** | 몬테카를로 시뮬레이션 (1천~10만회 전투, 95% 신뢰구간) |
| **분석** | Z-score 이상치 탐지, 파워 커브 분석 |
| **경제** | Faucet/Sink 모델, 인플레이션 계산기 |
| **시각화** | DPS 분산 분포, 빌드 비교 차트 |
| **커브 피팅** | 그래프 그리기 → 수식 자동 생성 |
| **내보내기** | Unity, Godot, Unreal 코드 생성 |
| **연동** | REST API, WebSocket, Firebase 지원 |
| **저장** | 로컬 우선 (IndexedDB), 서버 불필요 |

### 빠른 시작

```bash
# 저장소 클론
git clone https://github.com/dj258255/balruno.git

# frontend 폴더로 이동
cd balruno/frontend

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 수식 예시

```javascript
// 전투 수식
=DPS(atk, speed, crit, critDmg)    // 크리티컬 포함 초당 데미지
=EHP(hp, def)                       // 유효 체력
=TTK(hp, dps)                       // 처치 소요 시간
=DAMAGE(atk, def)                   // 데미지 계산

// 스케일링 수식
=SCALE(base, level, rate, "exp")    // 지수 레벨 스케일링
=DIMINISH(value, soft, hard)        // 수확체감

// 참조 수식
=REF("몬스터", "고블린", "HP")        // 시트 간 참조
```

### 기여하기

기여를 환영합니다! PR을 제출하기 전에 [기여 가이드](CONTRIBUTING.md)를 읽어주세요.

1. 저장소 Fork
2. Feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'feat: 멋진 기능 추가'`)
4. 브랜치에 Push (`git push origin feature/amazing-feature`)
5. Pull Request 생성

### 참고 자료

#### 게임 밸런스 이론
- [Game Balance Concepts](https://gamebalanceconcepts.wordpress.com/) - Ian Schreiber
- [Game Balance Dissected](https://gamebalancing.wordpress.com/) - DPS, TTK, Fire Rate

#### 경제 설계
- [Machinations.io - Game Inflation](https://machinations.io/articles/what-is-game-economy-inflation-how-to-foresee-it-and-how-to-overcome-it-in-your-game-design) - Faucet/Sink 모델
- [Lost Garden - Value Chains](https://lostgarden.com/2021/12/12/value-chains/) - 가치 사슬 설계

#### 성장 곡선 및 난이도
- [Davide Aversa - RPG Progression](https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/) - 레벨 성장 수식
- [Game Developer - Difficulty Curves](https://www.gamedeveloper.com/design/difficulty-curves) - 난이도 곡선

### 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

---

<p align="center">
  Made with ❤️ for indie game developers
</p>
