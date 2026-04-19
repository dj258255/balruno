# Balruno — Game Studio Workspace

> ⚠️ **2026-04-19 포지셔닝 업데이트**: 이 문서는 초기 "인디 게임 밸런스 툴" 비전 기반.
> 현재 포지셔닝은 **"Game Studio Workspace — 밸런싱 + 애자일 PM + 로드맵"** 로 확장됨.
> 최신 방향은 루트 [README.md](../README.md) 참조. 이 문서는 밸런싱 엔진 설계 레퍼런스로 유지.

---

## 아카이브 원본 제목: 발루노 - 인디게임 밸런스 툴

![발루노 스크린샷](images/intro.png)

**배포 URL**: https://balruno.com

## 개요

**발루노**은 인디게임 개발자를 위한 웹 기반 게임 밸런스 데이터 관리 툴입니다.

엑셀보다 게임 개발에 특화된 시트 시스템과 수식을 제공합니다.

> 로컬 저장 기반. 서버 없이 브라우저에서 바로 사용.

---

## 문제 인식

### 정상 상태 (기대하는 상황)

인디게임 개발 시 밸런스 데이터(캐릭터 스탯, 무기 수치, 레벨 테이블 등)를 관리할 때:
- 게임 특화 수식(데미지 공식, 성장 곡선)을 쉽게 적용할 수 있어야 함
- 시트 간 데이터가 자동으로 연동되어야 함 (무기 스탯 변경 시 DPS가 자동 재계산)
- 밸런스 상태를 차트로 시각화할 수 있어야 함
- 게임 엔진에서 사용할 JSON으로 바로 내보낼 수 있어야 함

### 게임 밸런싱 작업에서 자주 필요한 것

| 필요한 것 | 설명 |
|----------|------|
| 게임 수식 | DAMAGE, SCALE, TTK 같은 공식을 쉽게 적용하고 싶음 |
| 시트 간 연동 | 캐릭터 스탯 변경 시 관련 데이터가 자동으로 재계산되어야 함 |
| 시각화 | 성장 곡선, 능력치 비교 등을 차트로 빠르게 확인하고 싶음 |
| JSON 내보내기 | 게임 엔진에서 바로 쓸 수 있는 형태로 데이터 추출 |
| 깔끔한 UI | 자주 쓰는 툴은 보기 좋아야 생산성이 올라감 |

### 해결 방법 탐색

**어디서 공부했는가:**
- GDC Vault: 실무 밸런싱 방법론 (Zynga의 공식 기반 접근법, Slay the Spire 데이터 기반 밸런싱)
- NDC 2018: 넥슨의 밸런스 기획 프로세스
- 학술 자료: Csikszentmihalyi의 Flow 이론, 게임 경제학의 Faucet/Sink 모델
- 게임 개발 블로그: TTK/DPS 계산 공식, RPG 성장 곡선 설계

**무엇을 배웠는가:**
- 밸런스 데이터는 "기준 설정 → 수식화 → 시각화 → 검증" 사이클로 관리해야 함
- 게임마다 공통으로 쓰이는 수식(데미지 감소율, 성장 곡선, TTK)이 존재함
- 기획자가 자주 쓰는 툴은 보기 좋아야 생산성이 올라감

### 해결 방법

**어떻게 해결했는가:**

1. **게임 특화 수식 함수 70개+ 구현**
   - `DAMAGE(atk, def)`: 감소율 공식 `atk * (100 / (100 + def))`
   - `SCALE(base, level, rate, type)`: 4가지 성장 곡선 지원
   - `TTK(hp, damage, attackSpeed)`: 정확한 킬타임 계산
   - `REF("시트명", "행이름", "컬럼명")`: 시트 간 자동 참조

2. **시트 간 자동 연동**
   - 한 시트 수정 시 참조하는 모든 시트가 자동 재계산
   - 순환 참조 감지 및 경고

3. **게임 특화 시각화**
   - 성장 곡선 차트: Linear, Exponential, Logarithmic, Quadratic, S-Curve 비교
   - 레이더 차트: 캐릭터/아이템 능력치 비교
   - TTK/DPS 계산기: 무기 효율 분석

4. **원클릭 JSON 내보내기**
   - 버튼 하나로 전체 프로젝트를 JSON으로 내보내기
   - 게임 엔진에서 바로 파싱 가능한 구조

5. **세팅 없이 바로 쓸 수 있는 UI**
   - 깔끔한 디자인으로 별도 꾸미기 불필요
   - 다크 모드 지원
   - 온보딩 가이드로 빠른 학습

### 이 툴의 한계 (명시적으로)

- **게임 엔진 플러그인 아님**: JSON/코드 데이터 제공. 엔진 내 import는 개발자가 직접
- **협업 툴 아님**: 현재는 개인 사용 목적. 클라우드/팀 기능은 추후 고려
- **자동 밸런싱 AI 아님**: 수치를 자동으로 조정해주지 않음. 판단은 개발자의 몫

---

## 게임 밸런싱 이론 기반

> 이 툴은 검증된 게임 밸런싱 이론과 실무 방법론을 기반으로 설계되었습니다.

### 밸런스란?

**"플레이어가 경험하는 보상과 노력이 자연스럽게 이루어지도록 기획하고 조정하는 것"**

밸런스 기획은 단순히 캐릭터 강약 조절이 아니라, 게임 전반의 숫자와 획득 기간을 설계하는 작업입니다.

**좋은 밸런스의 조건:**
1. **선택의 가치 창출**: 던전 A(10분/30만 골드) vs 던전 B(20분/10만 골드+희귀템) → 두 선택 모두 의미 있어야 함
2. **성장 피드백 제공**: 플레이어가 자신의 진전을 명확히 인식

> 출처: [인벤 - 좋은 밸런스 기획, '기준'을 잡는 것부터 시작합니다](https://www.inven.co.kr/webzine/news/?news=198155)

---

### Flow 이론 (몰입 이론)

1970년대 심리학자 **Mihaly Csikszentmihalyi**가 제안한 이론.

![Flow 이론 다이어그램](images/flow-theory.png)

**핵심 원리:**
- 도전(Challenge)과 기술(Skill)의 균형이 맞을 때 몰입(Flow) 발생
- 도전 > 기술 → 불안/좌절
- 기술 > 도전 → 지루함

**게임 적용:**
- 난이도가 플레이어 실력에 맞게 조절되어야 함
- **계단식 난이도 곡선**: 각 구간 내에서 점진적 상승, 새 구간 시작 시 살짝 낮춤 → 회복 시간 제공

> 출처: [Think Game Design - The flow theory applied to game design](https://thinkgamedesign.com/flow-theory-game-design/)
>
> 출처: [Medium - Mihaly Csikszentmihalyi's Flow theory — Game Design ideas](https://medium.com/@icodewithben/mihaly-csikszentmihalyis-flow-theory-game-design-ideas-9a06306b0fb8)

---

### 밸런스 기획 실무 프로세스 (3단계)

넥슨 개발자 컨퍼런스(NDC 2018)에서 발표된 실무 방법론:

#### 1단계: 기준 선정
- **이상적인 상태 정의**: "최종 장비 획득까지 100일"
- 각 기준에 대한 **명확한 이유** 제시 필수
- 시뮬레이션과 그래프로 검증

#### 2단계: 데이터 입력
- 수치화 가능한 부분은 **자동화**로 오류 감소
- 자동화 불가능한 데이터는 **이중 입력**으로 검증
- 사소한 실수(1만 골드 → 1만 다이아)가 긴급 점검으로 이어질 수 있음

#### 3단계: 피드백 반영
- 결과를 기준과 비교
- 편차 원인 파악 후 데이터 수정
- **반복적으로 진행**

**실무 팁:**
> "유저 패턴 예측이 어려우면 **보수적 밸런스**가 낫다. 드랍률 낮추거나 몬스터 강하게 → 나중에 완화."

> 출처: [Velog - 넥슨 개발자 컨퍼런스: 밸런스 기획이란 무엇인가 (2018)](https://velog.io/@oneman98/넥슨-개발자-컨퍼런스-3-밸런스-기획이란-무엇인가-2018)

---

### 성장 곡선 유형

RPG 레벨/스탯 설계의 기본:

| 곡선 | 공식 | 특징 | 사용처 |
|------|------|------|--------|
| **Linear** | `base + level × rate` | 일정한 성장, 예측 가능 | 캐주얼 게임, 단순 스탯 |
| **Exponential** | `base × (rate ^ level)` | 후반 급성장, 하드코어 느낌 | MMO 경험치, 강화 비용 |
| **Logarithmic** | `base + rate × log(level)` | 초반 급성장 후 둔화 | 레벨 간 격차 줄이기 |
| **Quadratic** | `a×level² + b×level + c` | 초반 약하다가 점점 가속 | 스킬 데미지 스케일링 |
| **S-Curve** | `max / (1 + e^(-k×(level-mid)))` | 초반/후반 완만, 중반 급성장 | 자연스러운 성장감 |

**설계 원칙:**
- 경험치 곡선: Exponential (레벨업 속도 점점 느려짐)
- 캐릭터 파워: Linear 또는 Sub-linear (머드플레이션 방지)

> 출처: [Davide Aversa - GameDesign Math: RPG Level-based Progression](https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/)
>
> 출처: [Pav Creations - Level systems and character growth in RPG games](https://pavcreations.com/level-systems-and-character-growth-in-rpg-games/)

---

### TTK / DPS 계산

슈터/액션 게임 밸런싱의 핵심 지표:

#### DPS (Damage Per Second)
```
DPS = 데미지 × 초당 발사 횟수
    = 데미지 × (발사속도 / 60)
```

예시:
- 기관총: 10 데미지 × 10발/초 = **100 DPS**
- 캐논: 300 데미지 × 0.33발/초 = **100 DPS**

#### TTK (Time To Kill)
```
TTK = (적 HP / 데미지 - 1) × 쿨다운
```

**중요:** 마지막 공격은 쿨다운을 계산하지 않음 (대상이 이미 사망)

예시:
- 체력 100, 데미지 10, 600 RPM (0.1초 쿨다운)
- 필요 타수: 10발
- **TTK = 9 × 0.1초 = 0.9초** (1초 아님!)

**TTK가 게임플레이에 미치는 영향:**
- **낮은 TTK**: 선빵 유리, 택티컬 슈터 (CS, Valorant)
- **높은 TTK**: 반응/회피 중요, 아레나 슈터 (Overwatch, Apex)

> 출처: [Game Balance Dissected - Fire Rate, DPS, and TTK](https://gamebalancing.wordpress.com/2015/03/14/fire-rate-dps-and-ttk/)
>
> 출처: [The Game Balance Project Wiki - Time to kill](https://tgbp.fandom.com/wiki/Time_to_kill)

---

### 경제 시스템: Faucet & Sink

게임 경제 설계의 기본 프레임워크:

![Faucet & Sink 다이어그램](images/Faucet-Sink.png)

**핵심 원칙:**
- **Faucet < Sink**: 인플레이션 방지, 재화 가치 유지
- **Pinch Point**: 수요가 최대화되는 적정 희소성 지점

**일반적인 Sink 설계:**
| Sink 유형 | 예시 |
|-----------|------|
| 소모성 구매 | 포션, 부활석, 버프 |
| 강화/업그레이드 | 장비 강화, 스킬 레벨업 |
| 유지 비용 | 수리비, 길드 유지비 |
| 도박/확률 | 인챈트, 가챠 (기대값 음수) |
| 거래 수수료 | 경매장 세금 |

> 출처: [1kxnetwork - Sinks & Faucets: Lessons on Designing Effective Virtual Game Economies](https://medium.com/1kxnetwork/sinks-faucets-lessons-on-designing-effective-virtual-game-economies-c8daf6b88d05)
>
> 출처: [Lost Garden - Value chains](https://lostgarden.com/2021/12/12/value-chains/)

---

### 가챠/뽑기 시스템 설계

#### 천장 (Pity) 시스템

2016년 **그랑블루 판타지**에서 시작, 현재 업계 표준:

| 유형 | 설명 | 예시 |
|------|------|------|
| **Soft Pity** | 일정 횟수 후 확률 점진적 증가 | 원신 75회 이후 5성 확률 상승 |
| **Hard Pity** | 특정 횟수에서 100% 보장 | 원신 90회째 5성 확정 |

**원신 예시:**
- 기본 5성 확률: 0.6%
- 74회까지: 기본 확률 유지
- 75~89회: 확률 급상승 (Soft Pity)
- 90회: 100% 보장 (Hard Pity)

**설계 시 고려사항:**
- 천장이 너무 낮으면 → 매출 감소
- 천장이 너무 높거나 없으면 → 유저 이탈, 규제 리스크
- 중국: 확률 공개 의무화로 천장 시스템 보편화

> 출처: [LinkedIn - Designing Gacha System with Pity Mechanism by Reservoir Method](https://www.linkedin.com/pulse/sample-numerical-design-designing-gacha-system-pity-mechanism-chen)
>
> 출처: [ScienceDirect - Monetization mechanisms in gacha games](https://www.sciencedirect.com/science/article/abs/pii/S1875952125001247)

---

### 로그라이크 아이템 시너지

**Slay the Spire** 개발사의 밸런싱 철학:

> "싱글플레이어 로그라이크라서 밸런싱이 쉽다. 덱이 동등할 필요 없고, 순수한 밸런스보다 **재미**를 위해 조정할 수 있다."

**핵심 원칙:**
1. **시너지는 발견의 재미**: 너무 명시적이면 퍼즐, 너무 숨기면 운빨
2. **바닥 곡선 관리**: 아무것도 안 풀리는 런도 플레이 가능해야 함
3. **데이터 기반 조정**: 플레이어 피드백 + 통계로 빠르게 수정

**시너지 예시 (Slay the Spire):**
- Blade Dance → Shiv 카드 → Accuracy(Shiv 데미지+) → Envenom(공격 시 독)
- 하나의 카드가 여러 빌드 경로와 연결

> 출처: [Game Developer - How Slay the Spire's devs use data to balance their roguelike deck-builder](https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)
>
> 출처: [Wayline - Roguelike Itemization: Balancing Randomness and Player Agency](https://www.wayline.io/blog/roguelike-itemization-balancing-randomness-player-agency)

---

### GDC 참고 자료

| 발표 | 내용 | 링크 |
|------|------|------|
| **Balancing Your Game: A Formula-Driven Approach** | FarmVille, CityVille 밸런서의 공식 기반 접근법 | [GDC Vault](https://www.gdcvault.com/play/1023865/Balancing-Your-Game-A-Formula) |
| **A Course About Game Balance** | Ian Schreiber의 게임 밸런스 대학 강의 요약 | [GDC Vault](https://gdcvault.com/play/1023349/A-Course-About-Game) |
| **King's Match-3 Difficulty Balancing** | Candy Crush 난이도 분석 방법론 | [Game Developer](https://www.gamedeveloper.com/design/come-to-gdc-summer-and-learn-king-s-new-method-of-balancing-match-3-game-difficulty) |
| **Dave the Diver GDC 2024** | 유머로 복잡한 메카닉 가르치기 | [Inven Global](https://www.invenglobal.com/articles/18786/gdc24-blending-humor-and-gameplay-insights-from-dave-the-divers-session) |

---

## 핵심 기능

### 1. 데이터 시트

![데이터 시트](images/data-sheet.png)

- 커스텀 컬럼 (숫자, 텍스트, 수식, 참조)
- 시트 간 참조 (다른 시트 데이터 가져오기)
- 순환 참조 감지 및 에러 표시
- 필터, 정렬, 검색

---

### 2. 게임 수식 함수

엑셀 함수 대신 게임 개발에 맞는 함수 제공:

```javascript
// 레벨 스케일링 (선형, 지수, 로그, S커브 지원)
SCALE(base, level, rate, "exponential")

// 데미지 계산 (감소율 공식)
DAMAGE(atk, def)  // = atk * (100 / (100 + def))

// DPS (크리티컬 포함)
DPS(damage, attackSpeed, critRate, critDamage)
// = damage * attackSpeed * (1 + critRate * (critDamage - 1))

// TTK (Time To Kill)
TTK(targetHP, damage, attackSpeed)
// = (ceil(targetHP / damage) - 1) / attackSpeed

// 유효 체력
EHP(hp, def)
// = hp * (1 + def / 100)

// 드랍 확률 보정
DROP_RATE(base, luck, levelDiff)

// 다른 시트 참조
REF("몬스터", "고블린", "HP")
```

**지원 곡선:**
- Linear (선형): `base + level * rate`
- Exponential (지수): `base * (rate ^ level)`
- Logarithmic (로그): `base + rate * log(level)`
- S-Curve: `base + max / (1 + e^(-rate*(level-mid)))`

---

### 3. 시트 간 연동

![시트 간 연동](images/sheet-associate.png)

- 한 시트 수정 → 참조하는 모든 시트 자동 업데이트
- 의존성 그래프로 관계 시각화
- **순환 참조 시 경고 + 계산 중단** (무한루프 방지)

---

### 4. 몬테카를로 시뮬레이션

전투 결과를 확률적으로 분석:

- **1,000 ~ 100,000회** 시뮬레이션 지원
- **95% 신뢰구간** (Wilson Score)
- **1:1, 1:N, N:N** 팀 전투 시뮬레이션
- **다양한 데미지 공식**: 단순, MMORPG, 퍼센트, 랜덤

### 5. 수식 기반 계산기

- **수식 테스트**: 입력값 넣고 결과 확인
- **구간 계산**: 레벨 1~100 스탯 변화 한눈에 보기
- **비교 계산**: 캐릭터 A vs B 수치 비교
- **TTK/DPS 계산기**: 무기별 효율 비교

```
[TTK 계산기]
━━━━━━━━━━━━━━━━━━━
무기: 기관총
데미지: 10
발사속도: 600 RPM
적 HP: 100
━━━━━━━━━━━━━━━━━━━
DPS: 100
TTK: 0.9초
필요 탄수: 10발
```

---

### 6. 시각화

- **성장 곡선 차트**: 레벨별 스탯 변화 라인 차트 (곡선 유형 비교)
- **TTK/DPS 밴드 차트**: 무기별 효율 범위 시각화
- **비교 레이더**: 여러 캐릭터 능력치 비교
- **분포 히스토그램**: 데미지 분포, 드랍률 분포
- **Faucet/Sink 플로우**: 경제 흐름 다이어그램 (참고용)

---

### 7. 게임 엔진 내보내기

| 엔진 | Import | Export |
|------|--------|--------|
| **Unity** | `.json`, `.cs` | ScriptableObject + JSON |
| **Godot** | `.json`, `.gd` | Resource + JSON |
| **Unreal** | `.csv`, `.h` | USTRUCT + CSV |

- 각 엔진에 맞는 **코드 템플릿** 자동 생성
- JSON/CSV 데이터와 함께 바로 사용 가능

---

## 기능 모듈 (장르 아님)

> "장르 선택"은 잘못된 접근입니다. 요즘 게임은 장르가 섞여 있습니다.

대신 **기능 모듈**을 조합해서 사용:

### 사용 가능한 모듈

| 모듈 | 설명 | 포함 시트 템플릿 |
|------|------|------------------|
| **스탯 시스템** | 캐릭터/유닛 능력치 | 캐릭터, 클래스, 레벨테이블 |
| **장비 시스템** | 무기/방어구/악세서리 | 장비, 강화, 세트효과 |
| **스킬 시스템** | 액티브/패시브 스킬 | 스킬, 스킬트리, 버프 |
| **적/몬스터** | 적 스탯, AI 파라미터 | 몬스터, 스폰테이블, 보스 |
| **드랍/보상** | 아이템 드랍, 보상 | 드랍테이블, 보상, 상자 |
| **경제** | 재화, 상점, 가격 | 재화, 상점, Faucet/Sink |
| **가챠/뽑기** | 확률, 천장 | 가챠풀, 확률, Pity |
| **웨이브/스테이지** | 적 구성, 난이도 | 웨이브, 스테이지, 난이도곡선 |
| **크래프팅** | 제작 레시피 | 레시피, 재료, 제작시간 |
| **상성** | 속성/타입 상성 | 상성표, 속성 |

**조합 예시:**
- 로그라이크 덱빌더: 스탯 + 스킬(카드) + 적 + 드랍
- 타워디펜스 RPG: 스탯 + 장비 + 웨이브 + 상성
- 방치형 수집: 스탯 + 가챠 + 경제 + 장비

---

## 저장 방식

### 주 저장소: IndexedDB
- 브라우저 캐시 삭제해도 **데이터 유지됨**
- LocalStorage보다 용량 큼 (수백 MB 가능)

### 백업 방식
- **수동 저장**: JSON 파일로 다운로드
- **자동 백업**: 5분마다 IndexedDB에 버전 저장 (최근 10개 유지)
- **불러오기**: JSON 파일 드래그앤드롭으로 복원

### 주의사항
> **주의**: 브라우저 데이터 전체 삭제 시 IndexedDB도 날아갈 수 있음.
> **중요한 작업은 반드시 파일로 백업하세요.**
> 상단에 "마지막 백업: N분 전" 표시 + 백업 안 했으면 경고

---

## 특징

- 게임 특화 수식 70개+ 기본 제공 (DAMAGE, SCALE, TTK 등)
- 성장 곡선, 레이더 차트 등 시각화 기본 제공
- 버튼 하나로 JSON 내보내기
- 40개+ 템플릿으로 빠른 시작
- 세팅 없이 바로 쓸 수 있는 UI

---

## 구현된 기능

### 1. 시트 시스템

- 시트 생성/삭제/이름변경/복제
- 행/열 추가/삭제
- 셀 편집 (숫자, 텍스트, 수식)
- 컬럼 재정렬

### 2. 수식 함수 70개+

- **기본**: SCALE, DAMAGE, DPS, TTK, EHP, DROP_RATE, GACHA_PITY, COST, WAVE_POWER, REF
- **확률/경제**: CHANCE, EXPECTED_ATTEMPTS, COMPOUND, DIMINISH
- **스테이지**: ELEMENT_MULT, COMBO_MULT
- **유틸리티**: CLAMP, LERP, INVERSE_LERP, REMAP, STAMINA_REGEN, STAR_RATING, TIER_INDEX
- **밸런스 분석**: Z-score 기반 이상치 탐지, 파워 커브 분석
- **시뮬레이션**: 몬테카를로 전투 시뮬레이션 (Wilson Score 신뢰구간)

### 3. 저장/불러오기

- IndexedDB 자동 저장 (30초 간격)
- 자동 백업 (5분 간격, 최근 10개 유지)
- JSON/CSV 내보내기/불러오기

### 4. 시각화

- 성장 곡선 차트: 5가지 곡선 비교
- 레이더 차트: 캐릭터/아이템 능력치 비교
- 막대 차트: 수치 비교
- 히스토그램: 데이터 분포 분석

### 5. 장르별 템플릿 시스템 (40개+)

   게임 장르에 따라 적합한 템플릿 필터링 지원:

   | 장르 | 설명 | 템플릿 예시 |
   |------|------|-------------|
   | RPG | MMORPG, ARPG, JRPG, 턴제 | 캐릭터 스탯, 레벨/경험치, 스킬, 장비, 몬스터 |
   | 액션 | 핵앤슬래시, 격투 | 스킬, 장비, 몬스터 |
   | FPS/TPS | 슈팅 게임 | 무기 스탯 (데미지, RPM, 탄창), TTK 분석 |
   | 전략 | RTS, 타워디펜스 | 타워 데이터, 웨이브 구성, 유닛 |
   | 방치형 | 방치형, 클리커 | 업그레이드, 환생/프레스티지, 레벨 테이블 |
   | 로그라이크 | 로그라이크, 로그라이트 | 유물/아티팩트, 런 보상, 카드 |
   | MOBA/AOS | 멀티플레이어 배틀 | 챔피언/영웅, 스킬 |
   | 카드/덱빌딩 | CCG, 덱빌더 | 카드 데이터, 유물 |

   **카테고리별 분류:**
   - 설정: 글로벌 설정 (앵커값, 기준값)
   - 캐릭터: RPG 캐릭터, MOBA 챔피언
   - 장비: RPG 장비, FPS 무기
   - 스킬: 스킬 데이터
   - 적/몬스터: 몬스터, 보스
   - 유닛: 타워디펜스 타워
   - 아이템: 로그라이크 유물
   - 카드: 덱빌딩 카드
   - 스테이지: 웨이브 구성
   - 성장: 레벨/경험치, 업그레이드, 프레스티지
   - 경제: 재화, Faucet/Sink
   - 가챠: 가챠 풀, 천장 시스템
   - 보상: 드랍 테이블, 런 보상
   - 분석: 밸런스 비교표, TTK 분석

### 6. TTK/DPS 계산기

- DPS, TTK, EHP, DAMAGE, SCALE 탭별 계산
- 실시간 계산 결과 및 공식 설명

### 7. 기획자 친화적 UI

- 장르 필터: 원하는 게임 장르 선택 시 관련 템플릿만 표시
- 카테고리 필터: 장르 필터와 조합 가능
- 검색: 템플릿 이름/설명으로 검색
- 수식 자동완성: 함수/컬럼명 자동완성
- 온보딩 가이드: 8단계 튜토리얼
- 다크 모드 지원

---

## 기술적 한계

| 항목 | 한계 | 대응 |
|------|------|------|
| 대용량 데이터 | 만 행 이상 시 느려질 수 있음 | 가상 스크롤, 페이지네이션 |
| 복잡한 수식 | 중첩 참조 많으면 계산 느림 | 캐싱, 의존성 최적화 |
| 브라우저 호환 | 구형 브라우저 미지원 | Chrome/Firefox/Safari 최신 버전만 |
| 오프라인 | PWA로 오프라인 가능하나 완벽하지 않음 | 핵심 기능만 오프라인 지원 |
| 협업 | 현재 없음 | 파일 공유로 대체, 추후 클라우드 |

---

## 하지 않는 것

- 게임 만들어주는 툴 아님
- 밸런스 자동으로 잡아주는 AI 아님
- 게임 엔진 플러그인 아님
- 팀 협업 툴 아님 (현재)
- 모바일 앱 아님

---

## 향후 확장 가능성

1. **커뮤니티 템플릿**: 사용자가 만든 모듈 조합 공유
2. **AI 밸런스 제안**: 데이터 기반 이상치 탐지 (자동 밸런싱 아님, 경고만)
3. **게임 엔진 연동**: Unity/Godot 에디터 익스텐션으로 JSON 자동 import
4. **버전 히스토리**: Git 스타일 변경 이력, 롤백
5. **A/B 테스트**: 밸런스 버전 비교
6. **클라우드 동기화**: 계정 기반 저장 (백엔드 추가 시)
7. **실시간 협업**: 팀 프로젝트 지원

---

## 수익 모델

**오픈소스 + 클라우드 유료화 (Open Core 모델)**

**무료 (오픈소스):**
- 모든 로컬 기능
- 70개+ 게임 특화 수식
- 몬테카를로 시뮬레이션
- 게임 엔진 내보내기

**유료 (클라우드 Pro):**
- 클라우드 동기화
- 버전 히스토리 및 롤백
- 팀 협업 기능

> 로컬 기능은 모두 무료로 제공. 서버가 필요한 기능만 유료화.

---

## 요약

**발루노**은:

- 엑셀보다 게임 개발에 맞는 스프레드시트
- 검증된 밸런싱 이론 기반 (Flow, Faucet/Sink, TTK/DPS)
- 게임 수식 함수 기본 제공
- 시트 간 자동 연동
- JSON으로 깔끔하게 내보내기
- 서버 없이 브라우저에서 바로 사용
- **만능 툴 아님. 한계 있음. 대신 그 범위 안에서 확실히 해결.**

---

## 참고 문헌

### 핵심 이론

#### Flow 이론 (Csikszentmihalyi)
> 1970년대 심리학자 Mihaly Csikszentmihalyi가 제안한 몰입 이론. 도전(Challenge)과 기술(Skill)의 균형이 맞을 때 Flow 상태 발생.

- [Jenova Chen - Flow in Games (MFA Thesis, USC)](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf) - flOw 게임 개발자의 학술 논문
- [Think Game Design - The flow theory applied to game design](https://thinkgamedesign.com/flow-theory-game-design/)
- [Medium - Mihaly Csikszentmihalyi's Flow theory — Game Design ideas](https://medium.com/@icodewithben/mihaly-csikszentmihalyis-flow-theory-game-design-ideas-9a06306b0fb8)
- [Game Developer - Cognitive Flow: The Psychology of Great Game Design](https://www.gamedeveloper.com/design/cognitive-flow-the-psychology-of-great-game-design)

#### Ian Schreiber의 Game Balance
> RIT 교수, Global Game Jam 공동 창립자. 대학 수준의 게임 밸런스 강의를 무료 공개.

- [Game Balance Concepts - Ian Schreiber (무료 온라인 강좌)](https://gamebalanceconcepts.wordpress.com/)
- [GDC Vault - A Course About Game Balance](https://gdcvault.com/play/1023349/A-Course-About-Game)
- [Game Balance (책) - Ian Schreiber & Brenda Romero](https://www.routledge.com/Game-Balance/Schreiber-Romero/p/book/9781498799577)

### 수식/계산

#### 데미지 공식
> `ATK * (100 / (100 + DEF))` 감소율 공식이 `ATK - DEF` 뺄셈 공식보다 안정적.

- [UserWise - The Mathematics of Game Balance](https://blog.userwise.io/blog/the-mathematics-of-game-balance)
- [Department of Play - The Mathematics of Balance](https://departmentofplay.net/the-mathematics-of-balance/)
- [RPG Fandom Wiki - Damage Formula](https://rpg.fandom.com/wiki/Damage_Formula)
- [GameDev.net - Formulas for RPG combat/leveling systems](https://www.gamedev.net/forums/topic/660352-formulas-math-and-theories-for-rpg-combatleveling-systems/)

#### TTK/DPS
> TTK = (ceil(HP / Damage) - 1) / AttackSpeed. 마지막 타격에 쿨다운이 없으므로 -1.

- [Game Balance Dissected - Fire Rate, DPS, and TTK](https://gamebalancing.wordpress.com/2015/03/14/fire-rate-dps-and-ttk/)

#### 성장 곡선
> Linear, Exponential, Logarithmic, Quadratic, S-Curve 각각의 용도와 특성.

- [Davide Aversa - GameDesign Math: RPG Level-based Progression](https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/)
- [Pav Creations - Level systems and character growth in RPG games](https://pavcreations.com/level-systems-and-character-growth-in-rpg-games/)

### 경제 시스템

#### Faucet & Sink 모델
> 재화 유입(Faucet)과 유출(Sink)의 균형. 인플레이션 방지의 핵심.

- [1kxnetwork - Sinks & Faucets: Lessons on Designing Effective Virtual Game Economies](https://medium.com/1kxnetwork/sinks-faucets-lessons-on-designing-effective-virtual-game-economies-c8daf6b88d05)
- [Lost Garden - Value chains](https://lostgarden.com/2021/12/12/value-chains/)
- [Department of Play - The Principles of Building A Game Economy](https://departmentofplay.net/the-principles-of-building-a-game-economy/)
- [Game Dev Essentials - Designing a Game Economy 101](https://gamedevessentials.com/designing-a-game-economy-101-the-ultimate-guide-for-game-devs/)

#### 가챠/천장 시스템
> Soft Pity(74회 이후 확률 증가) + Hard Pity(90회 확정). 원신 기준.

- [Game8 - Pity System in Banners Explained (Genshin Impact)](https://game8.co/games/Genshin-Impact/archives/305937)
- [Ultimate Gacha - How Soft Pity and Hard Pity Work](https://ultimategacha.com/soft-vs-hard-pity-genshin-impact/)
- [Gacha Calculator](https://gachacalc.com/)

### 실무/GDC

#### 스프레드시트 기반 밸런싱
> FarmVille, CityVille 등 Zynga 게임의 공식 기반 밸런싱 방법론.

- [GDC Vault - Balancing Your Game: A Formula-Driven Approach (Brian Davis)](https://www.gdcvault.com/play/1023865/Balancing-Your-Game-A-Formula)
- [Game Developer - My Approach To Economy Balancing Using Spreadsheets](https://www.gamedeveloper.com/design/my-approach-to-economy-balancing-using-spreadsheets)
- [Game Developer - Stop Being The Useless Designer: Excel and Formulas](https://www.gamedeveloper.com/design/opinion-stop-being-the-useless-designer---excel-and-formulas)

#### 스프레드시트 컬럼 색상 코딩 (실무 방법론)
> 기획자들이 실제로 사용하는 색상 코딩 시스템

- **초록색(Green)**: 자주 변경하는 수동 입력 값 (레벨, 배율 등)
- **노란색(Yellow)**: 정규화 및 분포 조정 수식 (min-max 정규화 등)
- **흰색/회색**: 최종 계산 결과 (변경 최소)

> 출처: [Game Developer - My Approach To Economy Balancing Using Spreadsheets](https://www.gamedeveloper.com/design/my-approach-to-economy-balancing-using-spreadsheets)

#### 스프레드시트 베스트 프랙티스
> LinkedIn, War Robots 등 실무 사례

- 각 행 = 하나의 아이템/캐릭터/카드
- 각 열 = 하나의 속성 타입
- 첫 행 = 열 이름 (색상 코딩)
- 첫 열 = 고유 식별자 (ID)
- Named Range 활용: 셀 주소 대신 이름으로 참조
- MATCH + INDEX: VLOOKUP 대신 사용 (열 순서 변경에 강함)

> 출처: [Medium - Avoid the cell and table swamp: maintaining game balance with ease](https://medium.com/my-games-company/avoid-the-cell-and-table-swamp-maintaining-game-balance-with-ease-9f3e90bf45ac)

#### 데이터 기반 밸런싱 (Slay the Spire)
> 메트릭 서버로 카드 선택률, 승률, 평균 피해량 등 수집. 스트리머 피드백 병행.

- [Game Developer - How Slay the Spire's devs use data to balance](https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)
- [GDC Vault - 'Slay the Spire': Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics)

#### 한국 개발자 자료
- [인벤 - 좋은 밸런스 기획, '기준'을 잡는 것부터 시작합니다](https://www.inven.co.kr/webzine/news/?news=198155)
- [Velog - 넥슨 개발자 컨퍼런스: 밸런스 기획이란 무엇인가 (2018)](https://velog.io/@oneman98/넥슨-개발자-컨퍼런스-3-밸런스-기획이란-무엇인가-2018)

### 추가 GDC 자료
- [GDC Vault - Math for Game Programmers: Balancing TCGs With Algebra](https://gdcvault.com/play/1023564/Math-for-Game-Programmers-Balancing)
- [Archive.org - Idle Game Models and worksheets (Anthony Pecorella, GDC Europe 2016)](https://archive.org/details/idlegameworksheets)

---

## FAQ (자주 묻는 질문)

### 기본 질문

**Q: 구글 시트에 Apps Script를 쓰면 되지 않나요?**

A: 가능합니다. 다만 스크립트 작성과 유지보수 시간을 고려하면 게임 개발에 집중하는 편이 나을 수 있습니다.

**Q: 장르가 섞인 게임은 어떻게 하나요?**

A: 장르 선택 기능은 없습니다. 필요한 기능 모듈만 골라서 조합하면 됩니다.

**Q: 전투 시뮬레이터가 있나요?**

A: 몬테카를로 시뮬레이션을 제공합니다. 1,000~100,000회 전투를 시뮬레이션하고 95% 신뢰구간(Wilson Score)으로 결과를 분석합니다. 1:1, 1:N, N:N 팀 전투와 다양한 데미지 공식(단순, MMORPG, 퍼센트, 랜덤)을 지원합니다.

**Q: 브라우저 캐시를 지우면 데이터가 날아가나요?**

A: IndexedDB를 사용하므로 일반 캐시 삭제로는 날아가지 않습니다. 다만 브라우저 데이터 전체 삭제 시에는 날아갈 수 있으니 백업이 필수입니다.

**Q: C# 코드로 내보내기가 되나요?**

A: Unity, Godot, Unreal 세 엔진 모두 코드 내보내기를 지원합니다. Unity는 ScriptableObject + JSON, Godot은 Resource + JSON, Unreal은 USTRUCT + CSV 형태로 내보낼 수 있습니다.

**Q: 유료화 계획이 있나요?**

A: 기본 기능은 무료입니다. 추후 클라우드/협업 같은 고급 기능은 유료화할 수 있습니다.

**Q: machinations.io와 뭐가 다른가요?**

A: machinations은 경제 플로우 시각화에 특화되어 있고, 이 툴은 데이터 테이블 관리와 수식에 특화되어 있습니다.

**Q: 혼자서 다 만들 수 있나요?**

A: MVP는 시트 + 수식 + 저장 + 내보내기 수준입니다. TanStack Table, Math.js, Recharts 등 기존 라이브러리를 조합하므로 가능합니다.

**Q: 이론적 근거가 있나요?**

A: Flow 이론, Faucet/Sink 모델, NDC/GDC 발표 자료 등을 기반으로 했습니다. 참고 문헌 섹션을 확인해주세요.

**Q: TTK 계산에서 왜 DPS로 나누면 안 되나요?**

A: 마지막 타격에는 쿨다운이 없기 때문입니다. 체력 100, DPS 100이면 TTK는 1초가 아니라 0.9초입니다.

---

### 추가 질문

**Q: 이 기획서가 AI로 작성된 것 같은데요?**

A: 요약본을 참고했더라도 이해하고 쓰는 것이 감으로 만드는 것보다 낫다고 생각합니다. GDC Vault 등 원본 링크를 모두 첨부했으니 직접 확인해보실 수 있습니다.

**Q: 인디 개발자한테 이런 이론이 필요한가요?**

A: 이론은 만능 해결책이 아니라 체크리스트입니다. "왜 내 게임이 재미없지?" 할 때 뭘 봐야 하는지 알려주는 역할입니다. 다 적용할 필요 없이 참고만 하면 됩니다.

**Q: TTK/DPS는 슈터 게임에서만 쓰는 거 아닌가요?**

A: RPG에서도 "몬스터 잡는 데 몇 초가 적당한가"를 설계할 때 TTK 개념이 쓰입니다. 필요 없으면 해당 모듈은 안 쓰면 됩니다.

**Q: Faucet/Sink가 인디 게임에도 필요한가요?**

A: 골드가 있으면 경제 시스템입니다. 스타듀밸리(농작물→도구), 뱀파이어 서바이버(골드→영구 업그레이드) 모두 Faucet/Sink 구조입니다. 규모는 다르지만 개념은 같습니다.

**Q: 가챠 시스템은 모바일 게임용 아닌가요?**

A: 가챠는 뽑기/확률 시스템 전체를 포함합니다. 로그라이크의 아이템 드랍도 확률 시스템입니다. 과금형 가챠만 가챠가 아닙니다.

**Q: 서버가 없으면 다른 기기에서 사용할 수 없지 않나요?**

A: 서버를 붙이면 비용이 발생하고 유료화가 필요해집니다. JSON 파일로 백업해서 클라우드 드라이브에 올리면 됩니다. 추후 클라우드 동기화 기능 추가 예정입니다.

**Q: 노션이나 에어테이블을 쓰면 되지 않나요?**

A: 노션에는 `DAMAGE(atk, def)` 같은 게임 특화 함수가 없습니다. 시트 간 자동 연동이나 성장 곡선 차트도 마찬가지입니다. 노션은 범용 툴이고, 이 툴은 게임 밸런스에 특화되어 있습니다.

**Q: Slay the Spire 개발자가 "밸런싱이 쉽다"고 했다던데요?**

A: "쉽다"는 것은 싱글플레이어라 PvP 밸런스를 맞추지 않아도 된다는 의미입니다. 실제로는 데이터 기반으로 밸런싱했다고 합니다.

**Q: 참고 문헌 링크 몇 개가 근거가 되나요?**

A: 전부 볼 필요 없이 필요한 것만 찾아보라고 모아놓은 것입니다. 필요에 따라 원문을 확인하시면 됩니다.

**Q: MVP가 시트+수식+저장이면 그냥 엑셀 아닌가요?**

A: 엑셀에는 `SCALE(base, level, rate, "exponential")` 같은 게임 특화 함수가 없습니다. 순환 참조 감지 경고, 몬테카를로 시뮬레이션, 게임 엔진 코드 내보내기도 마찬가지입니다.

**Q: 만들어봤자 사용자가 있을까요?**

A: 솔직히 모릅니다. 다만 "불편하지만 익숙해서 쓴다"와 "더 나은 대안이 없다"는 다른 문제라고 생각합니다.

**Q: 수익 모델이 없으면 지속 가능한가요?**

A: 오픈소스 + 클라우드 유료화 모델입니다. 로컬 기능은 모두 무료이고, 클라우드 동기화/협업 같은 서버가 필요한 기능만 유료화합니다.

**Q: 웹 기반이면 오프라인에서 못 쓰지 않나요?**

A: PWA로 오프라인을 지원합니다. IndexedDB는 로컬 저장이라 인터넷 없이도 작동합니다. 다만 완벽하지는 않습니다.

**Q: 기획서만 있고 실제로 만들지 않을 것 같은데요?**

A: 이미 만들었습니다. 이 README는 구현된 기능을 문서화한 것입니다.

---

## 라이선스

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MIT License
