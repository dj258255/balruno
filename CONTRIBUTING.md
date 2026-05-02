# Contributing to Balruno / 기여 가이드

Thank you for considering contributing to Balruno.

Balruno에 기여해주셔서 감사합니다.

## Table of Contents / 목차

- [Code of Conduct / 행동 강령](#code-of-conduct--행동-강령)
- [Licensing & CLA / 라이센스 및 기여자 동의](#licensing--cla--라이센스-및-기여자-동의)
- [How Can I Contribute? / 어떻게 기여할 수 있나요?](#how-can-i-contribute--어떻게-기여할-수-있나요)
- [Development Setup / 개발 환경 설정](#development-setup--개발-환경-설정)
- [Pull Request Process / PR 프로세스](#pull-request-process--pr-프로세스)
- [Style Guide / 스타일 가이드](#style-guide--스타일-가이드)

## Code of Conduct / 행동 강령

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

이 프로젝트는 [행동 강령](CODE_OF_CONDUCT.md)을 따릅니다. 참여하시면 이 규칙을 준수해주세요.

## Licensing & CLA / 라이센스 및 기여자 동의

**This repository uses different licenses depending on the directory** (see `LICENSING.md` for FAQ, root `LICENSE` for overview):

| Directory | License |
|---|---|
| `packages/web/` | MIT |
| `packages/shared/` | MIT |
| `packages/desktop/` | MIT |
| `packages/backend/` (planned) | AGPL v3 |
| `docs/` (public files) | MIT |

**By submitting a PR, you agree that your contribution will be licensed under the same license as the directory you're modifying.**

For external contributors, a Contributor License Agreement (CLA) check via [CLA Assistant](https://cla-assistant.io/) will run automatically on your PR. The CLA grants the project owner the right to relicense your contribution if needed (e.g. for a future commercial dual license). Without this, the project's license could become permanently locked.

**라이센스 안내**: 본 저장소는 디렉토리별로 다른 라이센스를 사용합니다 (`LICENSING.md` 참조). PR 제출 시 해당 디렉토리의 라이센스에 동의하는 것으로 간주되며, 외부 기여자는 PR 시 CLA 자동 검증이 진행됩니다.

자세한 정책: `docs/backend/decisions/0005-oss-monetization.md`

## How Can I Contribute? / 어떻게 기여할 수 있나요?

### Reporting Bugs / 버그 제보

- Check if the bug has already been reported in [Issues](https://github.com/dj258255/balruno/issues)
- If not, create a new issue using the bug report template
- Include as much detail as possible

기존 이슈에 같은 버그가 있는지 확인 후, 없다면 버그 리포트 템플릿을 사용해 새 이슈를 만들어주세요.

### Suggesting Features / 기능 제안

- Open a new issue using the feature request template
- Explain the use case and why it would be useful

기능 요청 템플릿을 사용해 새 이슈를 만들어주세요. 사용 사례와 유용한 이유를 설명해주세요.

### Code Contributions / 코드 기여

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit with a descriptive message (see commit convention below)
5. Push to your branch
6. Open a Pull Request

## Development Setup / 개발 환경 설정

### Prerequisites / 필수 조건

- Node.js 20+
- npm 10+
- (Desktop only) macOS / Windows / Linux for native builds

### Installation / 설치

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/balruno.git
cd balruno

# Install all workspace dependencies (monorepo)
npm install
```

### Running the Web App / 웹 앱 실행

```bash
cd packages/web
npm run dev
# → http://localhost:3000
```

### Running the Desktop App / 데스크톱 앱 실행

```bash
cd packages/desktop
npm run dev
# → Boots packages/web dev server + opens Electron window
```

### Building / 빌드

```bash
# All packages (Turborepo)
npm run build

# Web only
cd packages/web && npm run build

# Desktop main process only (TypeScript compile)
cd packages/desktop && npm run build

# Mac DMG (after web build)
cd packages/desktop && npm run package:mac
```

### Project Structure / 프로젝트 구조

```
balruno/
├── packages/
│   ├── web/                    # Next.js 16 web app (MIT)
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router
│   │   │   ├── components/     # React components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── lib/            # Web-specific libs
│   │   ├── messages/           # i18n (en, ko)
│   │   └── public/             # Static assets
│   ├── shared/                 # Platform-agnostic shared code (MIT)
│   │   └── src/
│   │       ├── types/          # TypeScript types
│   │       └── lib/            # Game-domain logic
│   │           ├── formulaEngine.ts
│   │           ├── simulation/
│   │           ├── balanceAnalysis.ts
│   │           ├── economySimulator.ts
│   │           ├── templates/
│   │           ├── formulas/
│   │           └── ...
│   ├── desktop/                # Electron desktop app (MIT)
│   │   ├── src/
│   │   │   ├── main/           # Electron main process
│   │   │   └── preload/        # Preload scripts
│   │   └── build/              # Icons & build assets
│   └── backend/                # Spring Boot (planned, AGPL v3)
├── docs/
├── LICENSE                     # Repository license overview
├── LICENSING.md                # User-friendly licensing FAQ
├── TRADEMARK.md                # Name & logo policy
├── CODE_OF_CONDUCT.md
└── CONTRIBUTING.md             # This file
```

## Pull Request Process / PR 프로세스

1. **Update your fork** — Sync with the main repository
2. **Create a branch** — Use descriptive branch names
3. **Make changes** — Keep PRs focused and small
4. **Test locally** — Run `npm run build` to ensure no errors
5. **Submit PR** — Fill out the PR template completely
6. **Address feedback** — Respond to review comments

### Commit Message Convention / 커밋 메시지 규칙

We follow [Conventional Commits](https://www.conventionalcommits.org/). **Write commit messages in English.**

```
feat: add new DPS formula
fix: resolve calculation error in TTK
docs: update README with new features
style: improve panel layout
refactor: simplify formula parser
chore: bump electron to 41.5.0
```

### Comment Convention / 주석 규칙

**Write code comments in English.** Korean comments in existing code stay as-is unless the surrounding code is rewritten.

## Style Guide / 스타일 가이드

### TypeScript

- Use strict TypeScript (`strict: true`)
- Prefer interfaces over types for objects
- Avoid `any`; use proper typing

### React

- Functional components with hooks
- Keep components small and focused
- Custom hooks for reusable logic

### Styling

- Tailwind CSS utility classes
- CSS variables for theming (`var(--primary-blue)`)
- Support both light and dark modes

### Code Quality

```bash
# Lint (per package)
cd packages/web && npm run lint

# Type check
cd packages/web && npx tsc --noEmit
cd packages/desktop && npx tsc -p tsconfig.main.json --noEmit
cd packages/shared && npx tsc --noEmit

# Build
npm run build  # from repo root, runs Turborepo
```

## Questions? / 질문이 있으신가요?

Open an issue or reach out via the email in `LICENSE`.

이슈를 열거나 LICENSE 파일의 이메일로 연락주세요.

---

Thank you for contributing.
기여해주셔서 감사합니다.
