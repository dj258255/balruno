/**
 * GDD 장르 템플릿 — M4-3.
 *
 * living document 원칙: 최소한의 스켈레톤만 제공.
 * 유저가 내용 채우면서 @참조로 시트 연결.
 */

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  category: 'genre' | 'systems' | 'release';
  /** 초기 아이콘 이모지 (장르별 대표) */
  icon?: string;
  /** 초기 HTML content (tiptap 포맷) */
  content: string;
}

const RPG_GDD = `
<h1>RPG 게임 설계</h1>
<p>한 줄 컨셉: </p>

<h2>Core Loop</h2>
<ul>
  <li>1. 탐험 / 전투 → 경험치·장비 획득</li>
  <li>2. 레벨업 / 장비 강화 → 스탯 성장</li>
  <li>3. 더 어려운 컨텐츠 도전 → 반복</li>
</ul>

<h2>캐릭터 설계</h2>
<p>주요 직업과 역할 — 시트와 연결:</p>
<p>직업 목록: <em>@sheet:Characters</em> 참조</p>
<ul>
  <li>전사: 탱커, 근접 단일 타겟</li>
  <li>마법사: DPS, 원거리 광역</li>
  <li>도적: 어쌔신, 크리티컬 특화</li>
</ul>

<h2>스탯 체계</h2>
<p>핵심 스탯 6종: HP / ATK / DEF / SPD / Crit% / Crit×</p>
<p>수식 예:</p>
<pre><code>DPS = ATK × SPD × (1 + Crit% × (Crit× - 1))
EHP = HP × (1 + DEF/100)
TTK = 대상HP / DPS</code></pre>

<h2>성장 곡선</h2>
<ul>
  <li>레벨 1-10: 튜토리얼 / 선형 성장</li>
  <li>레벨 10-50: 지수 곡선 (rate ≈ 1.1)</li>
  <li>레벨 50+: 엔드게임 / sigmoid cap</li>
</ul>

<h2>전투 밸런스</h2>
<ul>
  <li>1:1 시뮬 — 동레벨 TTK 목표: 5-10초</li>
  <li>보스전 TTK 목표: 30-60초</li>
  <li>힐러 필요 여부 판단</li>
</ul>

<h2>진행 & 난이도</h2>
<p>참조: @doc:difficulty-curve</p>

<h2>관련 태스크</h2>
<p>Sprint @sheet:Sprint%20Board 진행 상황</p>
`;

const FPS_GDD = `
<h1>FPS 게임 설계</h1>
<p>컨셉 한 줄: </p>

<h2>Core Loop</h2>
<ul>
  <li>매치 시작 → 적 처치 / 목표 달성</li>
  <li>경험치 / 통화 획득 → 무기·특성 언락</li>
  <li>랭크 상승 → 더 강한 상대와 매칭</li>
</ul>

<h2>무기 설계</h2>
<p>무기 카테고리: SMG / AR / Sniper / Shotgun / LMG</p>
<p>핵심 스탯: 데미지 / 연사속도 / 정확도 / 장탄수 / 재장전 / 반동</p>
<pre><code>DPS = 데미지 × 연사속도
TTK(HP100) = ceil(100/데미지) × 60/연사속도</code></pre>

<h2>밸런싱 목표</h2>
<ul>
  <li>모든 무기 TTK 0.3s ~ 1.5s</li>
  <li>각 무기 카테고리 최소 1개 meta tier</li>
  <li>SMG vs Sniper 카운터 구조 유지</li>
</ul>

<h2>맵 · 난이도</h2>
<p>참조: @doc:map-design</p>

<h2>진행 시스템</h2>
<p>배틀패스 / 시즌 길이 / 무기 언락 페이스</p>
`;

const IDLE_GDD = `
<h1>Idle 게임 설계</h1>
<p>컨셉 한 줄: </p>

<h2>Core Loop</h2>
<ul>
  <li>자동 전투 → 통화/재화 획득 (offline progress)</li>
  <li>업그레이드 구매 → 생산량 증가</li>
  <li>프레스티지 (리셋) → 영구 부스터 획득</li>
</ul>

<h2>경제 체계</h2>
<p>Faucet (통화 유입):</p>
<ul>
  <li>기본 생산 (초당)</li>
  <li>보스 드롭</li>
  <li>이벤트 보상</li>
</ul>
<p>Sink (통화 유출):</p>
<ul>
  <li>업그레이드 구매 (1.15^level 성장)</li>
  <li>프레스티지 리셋 비용</li>
</ul>

<h2>핵심 수식</h2>
<pre><code>업그레이드 비용 = base × 1.15^level
생산량 증가 = 2× per level
오프라인 수익 = 초당생산 × 오프라인시간 × 0.5</code></pre>

<h2>프레스티지 곡선</h2>
<p>1차 프레스티지 진입: 약 2시간</p>
<p>10차 프레스티지: 약 3일</p>
<p>100차 프레스티지: 약 30일</p>

<h2>인플레이션 관리</h2>
<p>Sensitivity 테스트 필요: @sheet:Economy</p>

<h2>LiveOps</h2>
<ul>
  <li>주간 이벤트 (2배 수익 주말)</li>
  <li>월간 시즌 패스</li>
  <li>콜라보 이벤트 (분기)</li>
</ul>
`;

const ROGUELIKE_GDD = `
<h1>Roguelike 게임 설계</h1>
<p>컨셉 한 줄: </p>

<h2>Core Loop</h2>
<ul>
  <li>Run 시작 → 무기·특성·아이템 선택</li>
  <li>적 처치 → 메타 통화 / 영구 업그레이드</li>
  <li>사망 → 메타 강화 → Run 재시작</li>
</ul>

<h2>덱빌딩 / 시너지</h2>
<p>시너지 설계 — 3-5개 시너지 계열</p>
<p>각 시너지 2-3 단계 (2/4/6 카드 등)</p>

<h2>밸런싱 접근</h2>
<ul>
  <li>Perfect Imbalance — 카운터 관계 유지</li>
  <li>상위 tier 카드 희소성 ≈ 파워</li>
  <li>Run 평균 성공률: 튜토리얼 이후 20-30%</li>
</ul>

<h2>난이도 스케일링</h2>
<p>참조: @doc:difficulty-curve</p>
<ul>
  <li>Stage 1-10: 선형 (+5% 난이도 per stage)</li>
  <li>Stage 10+: 지수 (×1.1 per stage)</li>
  <li>보스: 매 5 스테이지</li>
</ul>

<h2>메타 진행</h2>
<p>영구 업그레이드 해금 — 10시간 플레이로 50% 도달 목표</p>
`;

const COMBAT_BALANCE = `
<h1>전투 밸런스 설계안</h1>
<p>목표: 모든 직업이 의미 있는 역할을 가지며, 1:1/팀 전투에서 counter 구조 유지.</p>

<h2>현재 상태</h2>
<p>주요 시트: @sheet:Characters</p>

<h2>밸런스 지표</h2>
<ul>
  <li>평균 DPS 분포 (직업 간 편차 ≤ 15%)</li>
  <li>TTK 범위: 5-15초</li>
  <li>EHP 범위: 800-2000</li>
  <li>Perfect Imbalance: 모든 직업이 적어도 1:2 카운터 구조</li>
</ul>

<h2>최근 변경 이력</h2>
<p>Rationale 블록을 추가해 자동 수집:</p>
<p><em>/rationale 슬래시 명령으로 블록 삽입</em></p>

<h2>시뮬 결과</h2>
<p>Monte Carlo 결과:</p>
<p><em>/sim 슬래시 명령으로 인라인 시뮬 추가</em></p>

<h2>액션 아이템</h2>
<p>Sprint 보드: @sheet:Sprint%20Board</p>
`;

const RELEASE_NOTES = `
<h1>릴리스 노트 v1.0</h1>
<p>발행일: YYYY-MM-DD</p>

<h2>🎯 주요 변경</h2>
<ul>
  <li>항목 1</li>
  <li>항목 2</li>
</ul>

<h2>⚖️ 밸런스 조정</h2>
<p>주요 수치 변경 (자동 채움 권장 — changelog 기반):</p>
<ul>
  <li>전사 HP 변경: 이전 → 현재 (근거: @task:GAME-xx)</li>
</ul>

<h2>🐛 버그 수정</h2>
<ul>
  <li>@task:BUG-xx 해결</li>
</ul>

<h2>📈 지표 목표</h2>
<p>이번 릴리스 KPI:</p>
<ul>
  <li>Day 1 Retention: ≥ 50%</li>
  <li>ARPDAU: ≥ $0.20</li>
  <li>평균 세션: ≥ 8분</li>
</ul>
`;

export const DOC_TEMPLATES: DocTemplate[] = [
  { id: 'rpg-gdd',        name: 'RPG GDD',         description: 'RPG 장르 기본 설계 스켈레톤',       category: 'genre',   icon: '⚔️', content: RPG_GDD.trim() },
  { id: 'fps-gdd',        name: 'FPS GDD',         description: 'FPS 장르 무기/맵/진행',             category: 'genre',   icon: '🎯', content: FPS_GDD.trim() },
  { id: 'idle-gdd',       name: 'Idle GDD',        description: 'Idle · Clicker 경제 중심',          category: 'genre',   icon: '💰', content: IDLE_GDD.trim() },
  { id: 'roguelike-gdd',  name: 'Roguelike GDD',   description: 'Roguelike · 덱빌딩',                category: 'genre',   icon: '🎴', content: ROGUELIKE_GDD.trim() },
  { id: 'combat-balance', name: '전투 밸런스 설계안', description: '수치 밸런싱 + 자동 Rationale',       category: 'systems', icon: '⚖️', content: COMBAT_BALANCE.trim() },
  { id: 'release-notes',  name: '릴리스 노트',      description: '패치 노트 포맷',                     category: 'release', icon: '🚀', content: RELEASE_NOTES.trim() },
];
