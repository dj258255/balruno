# B2B 엔터프라이즈 플레이북 — Balruno 실전 가이드

> 작성일: 2026-04-18
> 목적: 이전 스트레스 테스트(`PRODUCT_STRATEGY_KO.md`)에서 확정된 "점진적 B2B 접근"을 실제 실행하기 위한 구체 문서
> 범위: 세일즈, POC, 라이선싱, 계약, 지표, 펀딩, 아웃리치 — 1인 창업자가 실전에 바로 쓸 수 있는 스크립트/템플릿 포함

---

## 목차

1. [세일즈 디스커버리 (BANT 기반)](#1-세일즈-디스커버리-bant-기반)
2. [POC 설계 — 2-4주 체크리스트](#2-poc-설계--2-4주-체크리스트)
3. [Open Core 라이선스 설계](#3-open-core-라이선스-설계)
4. [엔터프라이즈 계약서 구조 (MSA + SOW + LOI + NDA)](#4-엔터프라이즈-계약서-구조)
5. [SaaS 지표 대시보드 (5대 Metric)](#5-saas-지표-대시보드)
6. [한국 VC 접근 + 피치 덱](#6-한국-vc-접근--피치-덱)
7. [디자인 파트너 아웃리치 스크립트](#7-디자인-파트너-아웃리치-스크립트)
8. [통합 실행 체크리스트](#8-통합-실행-체크리스트)

---

## 1. 세일즈 디스커버리 (BANT 기반)

### 1.1 BANT란

잠재 고객의 "살 준비 됨"을 판단하는 4개 기준:

- **B**udget — 예산이 있는가
- **A**uthority — 결정권자인가
- **N**eed — 진짜 필요한가
- **T**imeline — 언제 구매 예정인가

4개 모두 충족 = **Qualified Lead**. 하나라도 부족 = **후속 조치 필요**.

### 1.2 BANT의 함정

단순히 "예산 있어요?"를 물으면 대부분 방어적으로 답합니다. BANT는 **대화 속에서 자연스럽게 추출**해야 합니다. 2026년 업계 관행: BANT를 "체크리스트"가 아닌 **내재된 가이드**로 사용.

### 1.3 디스커버리 콜 스크립트 (30분 구조)

```
[Opening - 3분]
"오늘 30분 시간 주셔서 감사합니다. 먼저 저희 제품 소개 드리기 전에,
○○님 현재 하시는 일과 가장 큰 문제부터 들어봐도 될까요?"

[Problem Discovery - 10분] — Need 추출
Q1. "게임 밸런스 데이터 관리는 현재 어떻게 하고 계세요?"
Q2. "그중에서 가장 시간이 많이 드는 작업이 뭔가요?"
Q3. "이 문제 때문에 프로젝트에 실제로 어떤 영향이 있었나요?"
    (예: 런칭 연기, 밸런스 버그, 재작업)
Q4. "만약 이 문제가 해결 안 되면 6개월 뒤 어떻게 될 것 같나요?"

[Current Solution - 5분] — Budget 간접 추출
Q5. "지금은 주로 어떤 도구를 쓰세요? 엑셀? 구글 시트? 사내 툴?"
Q6. "그 도구에 한 달에 얼마 정도 쓰고 계시죠?" (또는 인건비로 환산)
Q7. "더 나은 도구에 돈을 쓴다면 어느 정도 고려 가능할까요?"

[Decision Process - 5분] — Authority + Timeline 추출
Q8. "저희 같은 툴을 도입한다면, 의사결정 프로세스가 어떻게 되나요?"
Q9. "○○님 외에 누가 검토에 참여하게 되나요?"
Q10. "만약 좋은 솔루션이 있다면 언제쯤 도입 검토 가능하세요?"

[Next Steps - 5분]
"오늘 주신 이야기 정리하면 ___문제가 핵심이고, ___시점에 ___예산으로
검토 가능하시다는 거죠? 다음 단계로 저희 제품 15분 데모를 __일에 
하실 수 있을까요?"

[Silent Listening - 2분]
고객이 말할 시간. 가장 중요한 정보는 질문 끝난 뒤 침묵 속에서 나옴.
```

### 1.4 Balruno 맞춤 BANT 질문

| BANT | 질문 |
|---|---|
| **B** | "밸런싱 도구에 연 얼마까지 쓸 의향이 있으세요? 또는 기획자 1명당 월 얼마면 비용 대비 효과가 있을까요?" |
| **A** | "툴 도입 결정은 주로 PD가 하시나요, 아니면 스튜디오 차원 결정이세요?" |
| **N** | "지난 패치에서 밸런스 이슈로 재작업 하신 적 있으세요? 그때 얼마나 걸렸나요?" |
| **T** | "다음 프로젝트 프리프로덕션 언제 시작하시죠? 그때 맞춰 도입 가능하신가요?" |

### 1.5 디스커버리 콜 후 체크리스트

- [ ] Need: 구체적 고통 점수화 (시간 손실, 재작업 횟수, 팀 불만)
- [ ] Budget: 숫자 확보 (정확 금액 또는 범위)
- [ ] Authority: 결정권자 이름 확보
- [ ] Timeline: 구체 월/분기 확보
- [ ] 다음 미팅 캘린더 예약
- [ ] 24시간 내 요약 이메일 발송

**4개 중 3개 이상 확보 = Qualified, POC 단계로**
**2개 이하 = Nurture 리스트, 분기별 follow-up**

---

## 2. POC 설계 — 2-4주 체크리스트

### 2.1 POC vs Pilot 구분

| 구분 | POC (Proof of Concept) | Pilot |
|---|---|---|
| 목적 | **기술이 작동하는가** | **우리 팀에 맞는가** |
| 기간 | 2-4주 | 4-12주 |
| 범위 | 좁음 (1-2 유저, 1 유스케이스) | 넓음 (팀 전체, 실제 업무) |
| 비용 | 무료 또는 $ 소액 | 할인 계약 |
| 성공 기준 | 기술 검증 | 비즈니스 가치 검증 |

**2026년 업계 사실**: 엔터프라이즈 딜의 **70%가 POC 요구**, 평균 6주 소요.

### 2.2 POC 실패 원인 1위: 성공 기준 모호

연구 결과: POC 실패의 대부분은 **기술 문제가 아니라 "결정 기준이 없음"** 때문. 즉 POC가 성공인지 실패인지 판단이 안 됨.

**해결책**: POC 시작 전 **서면으로 성공 기준 확정**.

### 2.3 POC 설계 7단계

```
[-2주] 사전 준비
  1. 디스커버리 콜에서 POC 제안
  2. 성공 기준 3개 이상 서면 합의
  3. 참여 유저 2-3명 확보
  4. POC 계약서(또는 간단 MOU) 서명
  5. 킥오프 미팅 일정 확정

[Week 1] 실행
  6. 킥오프 미팅 (60분): 목표 재확인, 일정, 주간 리뷰 시간 고정
  7. 유저 온보딩 세션 (1시간)
  8. 초기 데이터 투입 도움
  9. 주 1회 30분 체크인 미팅

[Week 2] 평가
  10. 사용 메트릭 수집 (로그인 횟수, 기능 사용률)
  11. 유저 피드백 인터뷰 (각 유저 30분)
  12. 성공 기준별 달성도 측정
  13. 최종 보고서 작성

[Week 2+] 클로징
  14. 의사결정자에게 최종 보고서 + 데모
  15. 견적서 제시
  16. 결정 마감일 제시 (2주 내 응답 요청)
```

### 2.4 Balruno POC 성공 기준 템플릿 (실제 사용 가능)

```markdown
# POC 성공 기준서 — {고객사명}

## 기간
2026-__-__ ~ 2026-__-__ (4주)

## 참여
- 고객 측: {PD 이름}, {기획자 A}, {기획자 B}
- 벤더 측: {창업자 이름}

## 성공 기준 (합의)

### 필수 (3개 모두 달성 시 POC 성공)
1. [ ] 기존 엑셀 밸런스 시트(30개 행 이상) 마이그레이션 10분 내 완료
2. [ ] 기획자 A가 1회 온보딩 후 독립적으로 DPS 수식 3개 이상 작성
3. [ ] 기존 엑셀 대비 밸런스 변경 시간 50% 이상 단축 (동일 작업 비교)

### 선택 (2개 이상 달성 시 Pro 티어 업그레이드 트리거)
1. [ ] 실시간 댓글/멘션 기능으로 PD와 기획자 간 비동기 리뷰 1회 완료
2. [ ] Git 백업으로 변경 이력 10개 이상 추적 가능
3. [ ] Monte Carlo 시뮬레이션 1회 실행 → 인사이트 발견

## 의사결정 절차
- POC 종료 후 7일 내 최종 보고서 전달
- 추가 14일 내 고객사 구매 결정
- 구매 결정 시 Pro 티어 (월 $9/유저) 또는 Enterprise 계약 옵션 제시

## 서명
- 고객사 결정권자: ____________
- 벤더 CEO: ____________
- 일자: ____________
```

### 2.5 POC 기간 동안 피해야 할 실수

- ❌ **범위 확장** — "이것도 있으면 좋겠다"에 다 대응하면 POC 실패 보장
- ❌ **기능 데모만 하기** — 유저가 직접 써보지 않으면 POC 아님
- ❌ **피드백 일괄 수집** — 매주 피드백 받아야 방향 수정 가능
- ❌ **의사결정자 미참여** — POC 끝나고 결정권자 "난 처음 들어" 하면 끝
- ❌ **가격 논의 연기** — 중반에 가격 윤곽 공유 안 하면 끝에서 파산

---

## 3. Open Core 라이선스 설계

### 3.1 Open Core 원칙

```
[Free Open Source]               [Paid Proprietary]
  핵심 기능                         ↓
  개별 유저 사용                     고급/협업/엔터프라이즈
  MIT / Apache 2.0                  Business Source License (BSL)
                                    또는 Commercial License
```

### 3.2 "무엇을 무료로, 무엇을 유료로" 판단 기준

업계 표준 (HashiCorp, GitLab, Grafana, Sentry 연구 기반):

| 카테고리 | 무료 | 유료 (Pro/Team) | 유료 (Enterprise) |
|---|---|---|---|
| **핵심 엔진** | ✅ 전부 | - | - |
| **단일 유저 사용** | ✅ 무제한 | - | - |
| **로컬/개인 저장** | ✅ | - | - |
| **공유/협업** | 1-2명 | ✅ 5-20명 | ✅ 무제한 |
| **Cloud Backup** | - | ✅ | ✅ |
| **Git 연동 기본** | ✅ | - | - |
| **Git 고급 (Webhook)** | - | ✅ | ✅ |
| **SSO/SAML** | - | - | ✅ |
| **감사 로그** | - | 기본 | 상세 |
| **역할 권한 (RBAC)** | - | - | ✅ |
| **온프렘 배포** | ✅ 셀프호스팅 | - | ✅ + 공식 지원 |
| **SLA** | - | 이메일 48시간 | 24/7 우선 지원 |
| **커스터마이즈** | - | - | ✅ |
| **화이트라벨** | - | - | ✅ |
| **보안 감사** | 기본 | - | SOC 2 + 컴플라이언스 |

### 3.3 핵심 원칙 3가지

1. **개인/개발자는 무료** — 진입 장벽 0, 커뮤니티 성장
2. **조직/팀의 증거는 유료** — 공유, SSO, 권한, 감사 = "회사가 쓴다"는 신호
3. **규제/보안은 Enterprise** — SOC 2, GDPR, K-ISMS = 대기업만 필요

### 3.4 라이선스 선택

| 라이선스 | 정의 | 장점 | 단점 | 적합 단계 |
|---|---|---|---|---|
| **MIT** | 완전 무료, 상업 이용 OK | 커뮤니티 최대, 포크 자유 | 경쟁사 포크 위험 | 초기 커뮤니티 빌드 |
| **Apache 2.0** | MIT + 특허 조항 | MIT보다 기업 친화 | 거의 MIT와 동일 | 초기 |
| **BSL (Business Source)** | 4년 후 Apache 전환, 비상업만 상업 허용 | 경쟁사 봉쇄 + 종결 후 OSS | 일부 커뮤니티 거부감 | 성장기 (HashiCorp, Sentry) |
| **FSL (Functional Source)** | 상업 Sentry-like 서비스 금지 | 명확한 상업 보호 | 비교적 신규 | Sentry 모델 채택 시 |
| **AGPL** | SaaS로 돌려도 오픈소스 공개 강제 | 강력한 카피레프트 | 많은 기업 기피 | 피해야 |
| **Commercial** | 자체 유료 라이선스 | 완전 통제 | OSS 혜택 0 | Enterprise 기능에만 |

**Balruno 권고**:
- **코어**: MIT 유지 (이미 MIT)
- **Enterprise 모듈**: Commercial License (별도 저장소)
- **2-3년 후 재평가**: 경쟁사 포크 문제 발생하면 BSL 전환 검토

### 3.5 실제 적용 — Balruno Open Core 설계

```
[Free — MIT, 현재 GitHub 저장소]
✅ 전체 수식 엔진 (70+ 함수)
✅ 스프레드시트 UI
✅ 로컬 저장 (IndexedDB)
✅ Import/Export (JSON, CSV)
✅ 게임 엔진 코드 생성 (Unity/Godot/Unreal)
✅ Monte Carlo 시뮬레이션
✅ 모든 분석 패널 (16개)
✅ i18n (EN/KO)
✅ 개인 GitHub 백업 (사용자 토큰)
✅ 온프렘 셀프호스팅 Docker 이미지

[Pro — $9/유저/월, 별도 저장소 또는 클로즈드 모듈]
✅ 클라우드 저장 (우리 서버)
✅ 자동 백업 스케줄
✅ 3인 공유 워크스페이스
✅ 행 단위 댓글
✅ 버전 히스토리 UI (90일)
✅ 이메일 알림
✅ 우선 지원 (이메일, 48시간)

[Team — $29/유저/월]
✅ Pro의 모든 것
✅ 무제한 워크스페이스
✅ 팀 대시보드 (KPI 위젯)
✅ 상태 컬럼 + 칸반 뷰
✅ GitHub/GitLab Webhook 양방향
✅ 기본 감사 로그

[Enterprise — 연 $15-50K/조직]
✅ Team의 모든 것
✅ 온프렘 정식 지원 + 설치 컨설팅
✅ SSO (SAML, OIDC)
✅ 역할 기반 권한 (RBAC)
✅ 상세 감사 로그 + SIEM 연동
✅ 실시간 멀티플레이어 (Yjs CRDT)
✅ 24/7 지원 + SLA
✅ 커스텀 수식 개발 지원
✅ K-ISMS/SOC 2 컴플라이언스 문서
```

---

## 4. 엔터프라이즈 계약서 구조

### 4.1 계약 문서 계층

```
[NDA] — 대화 시작 전 체결
  ↓
[LOI] — 의향 확인 (비구속)
  ↓
[MSA] — 기본 계약 (반복 사용)
  │
  ├── [SOW #1] — 구체 프로젝트 1
  ├── [SOW #2] — 구체 프로젝트 2
  └── [Order Form] — 단순 구독 계약
  
[DPA] — 개인정보 처리 (MSA 첨부)
[SLA] — 서비스 수준 (MSA 첨부)
```

### 4.2 NDA (Non-Disclosure Agreement)

**언제 필요**: 디스커버리 콜에서 고객사 내부 정보를 듣기 전

**핵심 조항** (5-8 페이지, 비교적 표준화):
- 정의 (Confidential Information의 범위)
- 목적 (왜 정보를 공유하는가)
- 의무 (비공개, 관리, 사용 제한)
- 예외 (이미 공개된 정보, 독립 개발, 법적 요구)
- 기간 (보통 3-5년)
- 반환/파기 (계약 종료 시)
- 준거법 (한국법 또는 델라웨어주법)

**간단 한글 NDA 템플릿**: 법무부 무료 표준계약서 + 고객사 법무팀 검토 조합이 현실적.

### 4.3 LOI (Letter of Intent)

**목적**: 제품 만들기 전 "살 의향 있다"를 서면화. **비구속이지만 VC/투자자 보여줄 용도로 강력**.

**1페이지 템플릿**:

```markdown
# Letter of Intent
발신: {고객사명}
수신: {당신 회사명} (또는 당신 이름)
일자: 2026-__-__

## 개요
{고객사}는 {당신 제품}에 대해 다음 조건에서 구매/파일럿에 
관심이 있음을 확인합니다.

## 조건 (예상)
- 제품: Balruno Enterprise
- 사용 범위: 기획팀 {N}명
- 예상 계약 규모: 연 ${X} USD
- 예상 시작 시점: {분기}
- 파일럿 선행: {Y/N}

## 비구속 조항
본 문서는 법적 구속력이 없으며, 향후 정식 MSA/SOW 체결을 통해
법적 효력을 가집니다.

## 서명
{고객사 담당자 이름, 직책, 서명, 일자}
```

**실전 팁**: LOI는 종이에 "의향만" 밝히는 것이지만, 이메일 답장으로도 대체 가능. 중요한 건 **고객 회사 도메인 이메일로부터 명시적 "관심 있음"** 을 받는 것.

### 4.4 MSA (Master Service Agreement)

**목적**: 반복 계약의 **기본 틀**. 한번 체결하면 여러 프로젝트에 재사용.

**표준 MSA 목차** (20-40 페이지):

```
1. 정의 (Definitions)
2. 서비스 제공 (Scope of Services)
3. 대금 (Fees and Payment)
   - 청구 주기 (월/분기/연)
   - 지불 조건 (Net 30 등)
   - 연체 이자
   - 자동 갱신
4. 지적재산권 (Intellectual Property)
   - 벤더 IP (당신 소프트웨어)
   - 고객 데이터 소유권
   - 피드백/개선사항 처리
5. 기밀 유지 (Confidentiality)
6. 데이터 보호 (Data Protection / DPA 참조)
7. 보증 (Warranties)
   - 제품 정상 동작
   - IP 비침해
   - 규제 준수
8. 책임 제한 (Limitation of Liability) ⭐ 핵심
   - 직접 손해만 배상
   - 간접/결과/징벌적 손해 제외
   - 책임 상한 (보통 연 계약액의 1-2배)
9. 면책 (Indemnification)
   - IP 침해 시 벤더 면책
   - 데이터 오용 시 고객 면책
10. 계약 기간 (Term)
    - 초기 12개월, 자동 갱신
11. 해지 (Termination)
    - 편의 해지 (60일 공지)
    - 사유 해지 (즉시)
    - 해지 시 데이터 반환/파기
12. 일반 조항 (Miscellaneous)
    - 준거법 (한국 민법 또는 델라웨어)
    - 분쟁 해결 (중재 vs 소송)
    - 언어 (한영 이중 시 한국어 우선)
    - 수정 절차
```

**1인 창업자 리스크 관리 팁**:
- **책임 상한을 반드시 명시** — "연 계약액의 1배 한도" 없으면 파산 가능성
- **IP 면책 조항에 상한** — 법무 비용 폭탄 방지
- **법인 설립 후 계약** — 개인 자산 보호

### 4.5 SOW (Statement of Work)

**목적**: MSA 하위 "이번에 뭐 할지" 구체 명세.

**1-5 페이지 템플릿**:

```markdown
# SOW #001 — {프로젝트명}
MSA 일자: 2026-__-__
SOW 일자: 2026-__-__

## 1. 서비스 내역
- Balruno Enterprise {N}-user license
- 온프렘 설치 지원 (1회)
- 마이그레이션 컨설팅 (40시간)
- 월 정기 유지보수 (8시간/월)

## 2. 기간
- 시작: 2026-__-__
- 종료: 2027-__-__ (12개월)

## 3. 대가
- 라이선스: 연 $24,000 (선불)
- 컨설팅: $12,000 (킥오프 시 50%, 완료 시 50%)
- 유지보수: 월 $1,000 (월말 청구)
- 합계: 1년 차 $48,000

## 4. Deliverables
- [ ] 사내 서버 설치 완료 (Week 1)
- [ ] Keycloak SSO 연동 (Week 2)
- [ ] 기존 데이터 마이그레이션 (Week 3-4)
- [ ] 관리자 3명 교육 (Week 4)
- [ ] 기획자 20명 온보딩 세션 (Week 5-6)
- [ ] 라이브 런치 (Week 6)

## 5. 검수 기준
각 Deliverable 완료 시 고객 서명. 5 영업일 내 이의 없으면 수락 간주.

## 6. 가정
- 고객사 인프라 준비 완료 (서버, 네트워크)
- 고객사 IT팀 주 5시간 가용
```

### 4.6 SLA (Service Level Agreement)

**Enterprise 필수**. 낮으면 영업 탈락:

```
가용성 (Uptime):
  - Pro: 99.5% (월 3.6시간 허용 다운타임)
  - Enterprise: 99.9% (월 43분)

지원 응답:
  - 중대 장애: 2시간 이내
  - 일반 버그: 1 영업일
  - 기능 문의: 3 영업일

위반 시 크레딧:
  - 99%~99.5%: 월 요금 5%
  - 95%~99%: 월 요금 15%
  - 95% 미만: 월 요금 30%

계획된 점검:
  - 월 1회 최대 4시간
  - 7일 전 사전 공지
  - 가용성 계산에서 제외
```

**1인 창업자 주의**: 99.9% SLA는 실제로 달성 어려움. 초기엔 **99.5% 약속**으로 시작, 스케일업 후 상향.

### 4.7 DPA (Data Processing Agreement)

**한국 개인정보보호법 + GDPR**이 요구. 고객 데이터를 처리한다면 필수.

핵심 조항:
- 처리 목적 (왜 데이터 받는가)
- 처리 범위 (어떤 데이터를)
- 보관 기간
- 하위 처리자 (AWS, Stripe 등)
- 보안 조치 (암호화, 접근 제어)
- 데이터 이전 (국외 이전 여부)
- 사고 통지 (침해 시 72시간 내)

**한국 게임사 추가 요구**: K-ISMS 인증 취득 여부 + 국내 리전 보관.

---

## 5. SaaS 지표 대시보드

### 5.1 초기 스타트업 (Pre-seed ~ Seed)이 매일/매주 봐야 할 5개

```
1. MRR (Monthly Recurring Revenue)
   정의: 월간 반복 매출
   계산: 유료 유저 수 × 평균 월 요금
   목표: 매월 10-20% 성장 (초기)
   
2. Churn (월 이탈률)
   정의: 월초 유료 유저 중 월말에 해지한 비율
   계산: (월중 해지 / 월초 유료 유저) × 100
   목표: 5% 미만 (초기), 2% 미만 (건강)
   
3. CAC (Customer Acquisition Cost)
   정의: 유료 고객 1명 획득 비용
   계산: 마케팅+세일즈 지출 / 신규 유료 유저
   목표: 월 수익의 12개월 치 이하 (Payback < 12개월)
   
4. Activation Rate
   정의: 가입 후 핵심 기능 사용까지 전환율
   계산: 핵심 행동 완료 유저 / 가입 유저
   목표: 40%+ (SaaS 평균)
   
5. Traffic-to-Signup
   정의: 웹사이트 방문자 → 가입 전환
   목표: 2-5% (초기 SaaS)
```

### 5.2 성장기 (Series A~) 지표

```
6. ARR (Annual Recurring Revenue) = MRR × 12
   Series A 기준: $1-2M 이상

7. NRR (Net Revenue Retention) ⭐ North Star
   계산: (기존 고객 MRR + 업셀 - 다운셀 - 해지) / 기존 MRR
   목표: 100%+ (좋음), 110%+ (훌륭), 120%+ (최상)
   
8. LTV (Lifetime Value) = ARPU × 평균 유지 기간
   
9. LTV/CAC Ratio
   목표: 3:1 이상 (투자자 기준), 4:1 이상 (훌륭)

10. Gross Margin
    목표: 70%+ (SaaS 표준), 80%+ (훌륭)

11. Burn Multiple
    계산: 월 번레이트 / 월 순 신규 ARR
    목표: < 1.5 (좋음), < 1.0 (훌륭)
```

### 5.3 2026년 SaaS Series A 레디니스 벤치마크

| 지표 | 최소 기준 |
|---|---|
| ARR | $1-2M |
| NRR | 110%+ |
| LTV/CAC | 3:1+ |
| CAC Payback | < 12개월 |
| Gross Margin | > 70% |
| 월 순 성장 | 10%+ |

### 5.4 Balruno 초기 대시보드 (Google Sheet로도 충분)

```
[Weekly Review — 매주 월요일 30분]
- 신규 가입자 수
- 신규 유료 전환 수
- 해지 수
- MRR (전주 대비)
- 방문자 수 (Vercel Analytics)
- 가장 큰 장애 1개

[Monthly Review — 매월 첫 영업일]
- MRR 추이 (12개월 그래프)
- Churn 계산
- CAC 계산 (마케팅 지출 / 신규 유료)
- Activation Rate (신기능 적응)
- 분기 목표 대비 진척

[Quarterly Review — 분기 말]
- NRR 계산
- LTV 추정
- 코호트 분석 (가입월별 유지율)
- 다음 분기 계획 조정
```

---

## 6. 한국 VC 접근 + 피치 덱

### 6.1 한국 주요 게임/SaaS VC

| VC | 스테이지 | 특징 | 연락 |
|---|---|---|---|
| **KakaoVentures** | Seed-A | 게임/SaaS 투자 활발, 창업 친화 | kakaoventures.com |
| **Primer** | Pre-seed | 액셀러레이터, 3-6개월 프로그램 | primer.kr |
| **Strong Ventures** | Seed | 한국 창업자 + 글로벌 진출 | strong.vc |
| **네이버 D2SF** | Seed-A | 기술 창업 특화 | d2startup.com |
| **BonAngels** | Seed | 게임/AI/헬스케어 | bonangels.net |
| **Altos Ventures** | A-B | 한인 창업자 선호 | altos.vc |
| **Hashed** | Seed-B | 블록체인 → SaaS 확장 중 | hashed.com |
| **Nextrans** | Seed | 조기 단계 | nextrans.net |
| **Smilegate Investment** | Seed-A | 게임 특화 | smilegate.com |

### 6.2 한국 VC의 특이사항 (글로벌과 다름)

- **수익 증명 요구 강함** — 2026년 현재 "꿈만 있는 딜"은 거의 탈락. ARR 또는 유저 데이터 필수
- **빠른 회수 선호** — IPO까지 7-10년 vs 미국 10-15년
- **관계 기반** — "누가 소개했나"가 비중 큼
- **한국어 덱 선호** — 영어 덱은 세련돼 보이지만 의사결정자 읽기 불편
- **대기업/그룹사 자본 영향** — 카카오, 네이버, 한화, 미래에셋 등 CVC 비중 큼

### 6.3 피치 덱 10장 구조 (한국 표준)

```
Slide 1: 타이틀
  - 회사명, 한 줄 설명, 본인 사진, 연락처

Slide 2: 문제
  - "게임 스튜디오의 밸런싱 데이터 관리 고통"
  - 통계 1-2개, 실제 기획자 인용 1개

Slide 3: 솔루션
  - 제품 한 눈에 (스크린샷 1-2장)
  - "어떻게 해결하는가" 3줄

Slide 4: 제품 데모
  - 실제 화면 GIF 또는 짧은 영상
  - 핵심 기능 3개

Slide 5: 시장 크기 (TAM/SAM/SOM)
  - TAM: 글로벌 게임 개발 도구 시장
  - SAM: 한국+일본 중견 게임사
  - SOM: 1-5년 내 현실 포획 가능

Slide 6: 비즈니스 모델
  - Free / Pro / Team / Enterprise 가격
  - 예상 ACV
  - 유닛 이코노믹스 (CAC, LTV 예측)

Slide 7: Traction
  - 현재 유저 수, MRR, 성장률
  - 디자인 파트너 LOI (이름 공개 가능한 경우)
  - 주요 사용 사례 1-2개

Slide 8: 경쟁
  - 경쟁 매트릭스 (Airtable, Machinations, 내 제품 X축Y축)
  - 우리가 이기는 지점 3개

Slide 9: 팀
  - 창업자 배경 (도메인 + 기술)
  - 어드바이저 (있다면)
  - 채용 계획

Slide 10: Ask
  - 투자 요청 금액 (예: 시드 $500K)
  - 사용처 breakdown (팀 확장 50%, 마케팅 30%, 운영 20%)
  - 예상 마일스톤 (18개월 후 ARR $500K 등)
```

### 6.4 1인 창업자의 피치 덱 특수 전략

**약점 (1인)을 강점으로 전환**:
- "Speed of execution — 의사결정 지연 없음"
- "Domain expertise — 5년 게임 개발 경험"
- "Customer obsession — 창업자가 직접 고객 대응"

**다음 마일스톤에 공동창업자 계획 포함**:
- "Seed 투자 후 3개월 내 CTO/BD 파트너 영입 예정"

### 6.5 한국 VC 미팅 에티켓

- 첫 미팅 30분 제한 (길면 싫어함)
- 이메일은 한국어 우선 + 영문 덱 첨부 가능
- 미팅 후 24시간 내 감사 이메일
- Follow-up은 2주 간격으로 (너무 자주도 안 됨)
- 거절 당해도 관계 유지 — 3개월 후 업데이트 이메일

---

## 7. 디자인 파트너 아웃리치 스크립트

### 7.1 디자인 파트너란

**첫 2-10명의 유료 고객**. 다음 조건에서 일반 고객과 다름:
- 정가 대비 **할인** (50-70% off)
- **깊은 피드백** 제공 의무
- 제품 기능 설계에 **영향력**
- 공개 사례 참여 가능 (로고 사용 등)

### 7.2 누구를 타겟으로

1순위: **이미 당신 제품을 쓰고 있는 활성 유저** (GitHub 스타, Vercel Analytics 상위 방문자)
2순위: 한국 게임 커뮤니티 활성 인물 (Inven 기획 게시판, 디스코드 게임 개발 서버)
3순위: 개인 네트워크 (대학 동기, 이전 직장 동료)

**피해야 할 타겟**:
- 콜드 리스트 구매한 이메일
- 거대 AAA 스튜디오 (1인 벤더 안 받음)
- 퍼블리셔 (의사결정 너무 느림)

### 7.3 아웃리치 이메일 템플릿 (80 단어 이하)

```
Subject: {고객사} 밸런싱 프로세스 관련 5분 대화 요청

안녕하세요 {이름}님,

저는 Balruno({URL}) 만든 범수입니다.
{고객사}의 최근 {프로젝트명} 밸런스 패치 블로그를 읽고 
연락드렸습니다.

게임 밸런스 데이터를 엑셀보다 빠르게 관리할 수 있는 
오픈소스 툴을 만들고 있고, 디자인 파트너 2-3곳을 
찾고 있습니다. 할인 또는 무료 + 깊은 피드백 교환 
형식입니다.

15분만 대화 가능하실까요?

{본인 이름, LinkedIn/GitHub}
```

**80 단어 규칙**: 2026년 업계 데이터, 80 단어 이하 응답률 2-3배.

### 7.4 Follow-up 템플릿 (5일 후)

```
Subject: Re: {원 제목}

안녕하세요 {이름}님,

지난 주에 보내드린 메일 확인 부탁드립니다. 바쁘실 
것 같아 요약만 드립니다:

- Balruno 디자인 파트너 2-3곳 모집 중
- 할인/무료 + 15분 격주 피드백 대화
- {고객사}에 특히 도움될 것 같은 이유: {구체}

메일 보고 관심 없으시면 무시하셔도 됩니다 :)

{본인}
```

**3회 follow-up 이상은 금지** — 역효과.

### 7.5 미팅 후 디자인 파트너 계약 제안

대화가 잘 풀리면 미팅 직후 **48시간 내 다음 이메일**:

```
Subject: Balruno 디자인 파트너 제안서

안녕하세요 {이름}님,

오늘 대화 정말 유익했습니다. 약속드린 대로 디자인 
파트너 제안 정리드립니다.

## 드릴 것
- Balruno Pro 기능 1년 무료 (정가 $108)
- 기획팀 온보딩 지원 1회 무료
- 기능 로드맵에 우선 반영
- 새 기능 우선 접근

## 받고 싶은 것
- 격주 30분 피드백 대화 (3개월)
- 버그/개선 리포트
- 로고 사용 동의 (원할 때만, 거부 가능)

## 다음 단계
계약서 초안 첨부했습니다 (1장). 검토 후 질문 주세요.
시작은 {날짜} 가능하시면 좋겠습니다.

{본인}
```

### 7.6 디자인 파트너 계약서 (1페이지)

```markdown
# Design Partner Agreement
Between: {고객사} and Balruno
Date: 2026-__-__

## Duration
3 months (2026-__-__ to 2026-__-__)

## Provider Provides
- Balruno Pro tier free access for up to {N} users
- One free onboarding session
- Priority feature requests consideration
- Early access to new features

## Partner Agrees to
- Participate in bi-weekly 30-min feedback calls
- Provide written bug/feature reports
- Grant permission to use company logo in marketing
  (can be revoked anytime)
- Confidential feedback (no public disclosure of bugs)

## Termination
Either party can terminate with 7-day written notice.

## No Warranty
Service provided "as-is" during design partnership.

Signatures:
Partner: ____________  Date: ____________
Provider: ____________  Date: ____________
```

---

## 8. 통합 실행 체크리스트

`PRODUCT_STRATEGY_KO.md` §13 로드맵의 각 단계에서 이 플레이북이 어떻게 쓰이는지:

### Phase 1 (Month 0-6): 검증

- [ ] **Month 1**: 30초 지연 수정 (기술 문제)
- [ ] **Month 1-2**: 디자인 파트너 아웃리치 (§7)
  - 타겟 20명 리스트업
  - 이메일 템플릿 사용
  - 3-5명 응답 목표
- [ ] **Month 2**: BANT 디스커버리 콜 실행 (§1)
  - Qualified 2-3명 확보
- [ ] **Month 2-3**: LOI 2건 이상 확보 (§4.3)
- [ ] **Month 3**: Open Core 라이선스 설계 완료 (§3)
  - MIT 코어 유지
  - Pro 기능 별도 저장소 준비
- [ ] **Month 3-4**: Pro 티어 구현 + Stripe 결제
- [ ] **Month 4-5**: 첫 디자인 파트너 POC 시작 (§2)
- [ ] **Month 5-6**: SaaS 지표 대시보드 구축 (§5.4)
  - MRR, Churn, CAC, Activation, Traffic
- [ ] **Month 6**: **검증 게이트** — MRR $500 이상?

### Phase 2 (Month 6-18): 확장

- [ ] Team 티어 출시 ($29/유저/월)
- [ ] 첫 Enterprise 리드 대응 (MSA 템플릿 준비, §4.4)
- [ ] SLA 문서화 (99.5%, §4.6)
- [ ] 한국 VC 컨택 시작 (§6) — 필요 시에만
- [ ] 디자인 파트너 → 정식 고객 전환

### Phase 3 (Month 18+): 도전

- [ ] 첫 Enterprise 계약 ($15-50K 연)
- [ ] MSA + SOW 실전 체결
- [ ] K-ISMS 인증 검토 (필요 시)
- [ ] Series A 검토 (ARR $1M+)

---

## 부록 A. 법무 서비스 추천 (한국)

- **로톡(Lawtalk)**: 스타트업 법무 매칭
- **스타트업 얼라이언스**: 무료 법무 상담
- **강남구 중소기업 지원센터**: 표준계약서 무료 제공
- **Clio / DocuSign**: 계약서 전자 서명

첫 엔터프라이즈 계약은 반드시 변호사 검토 ($500-2000 수수료). 이후 템플릿화 가능.

## 부록 B. 결제 처리 (한국)

- **Toss Payments**: 국내 결제 + 세금계산서 자동
- **Stripe**: 글로벌 결제 (수수료 2.9%)
- **PortOne (구 아임포트)**: 국내외 통합
- **KB페이먼츠 / KG이니시스**: 대기업 PG

**B2B 권고**: Toss Payments 국내 + Stripe 국외 이중 사용.

---

*이 문서는 살아있는 문서입니다. 실전 경험이 쌓일 때마다 업데이트합니다.*

## 출처

- [BANT Framework (SellingSignals)](https://sellingsignals.com/bant/)
- [SaaS BANT Questions (SiftHub)](https://www.sifthub.io/glossary/bant-questions)
- [POC Success Criteria (Diceus)](https://diceus.com/poc-success-criteria/)
- [Sales POC Playbook (Dock)](https://www.dock.us/library/sales-proof-of-concepts)
- [Open Core Model (Wikipedia)](https://en.wikipedia.org/wiki/Open-core_model)
- [HashiCorp BSL Adoption](https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license)
- [Sentry Open Source Strategy](https://open.sentry.io/licensing/)
- [MSA Template Structure (Juro)](https://juro.com/contract-templates/msa-master-services-agreement)
- [SaaS Agreements Guide (Promise Legal)](https://www.promise.legal/startup-legal-guide/contracts/saas-agreements)
- [SaaS Metrics 2026 (Averi)](https://www.averi.ai/blog/15-essential-saas-metrics-every-founder-must-track-in-2026-(with-benchmarks))
- [Series A Readiness (SaaS CFO)](https://www.thesaascfo.com/essential-saas-metrics-for-a-series-a-fundraise/)
- [Korea VC Firms 2026 (Failory)](https://www.failory.com/blog/venture-capital-firms-south-korea)
- [KakaoVentures Portfolio (PitchBook)](https://pitchbook.com/profiles/investor/91464-76)
- [Cold Email Templates (HubSpot)](https://blog.hubspot.com/sales/the-cold-email-template-that-won-16-new-b2b-customers)
- [B2B SaaS Cold Email (Denis Shatalin)](https://denisshatalin.com/cold-email-guide)
