import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

// Force static rendering — content depends on nothing per-request,
// so we want CDN-cached HTML instead of an SSR call on every hit.
// (Cuts Vercel Fast Origin Transfer for this route to zero.)
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Privacy Policy — Balruno',
  description: 'Balruno 개인정보처리방침 / Privacy Policy',
};

const UPDATED_AT = '2026-05-08';

export default function PrivacyPage() {
  return (
    <LegalShell updatedAt={UPDATED_AT} ko={<PrivacyKo />} en={<PrivacyEn />} />
  );
}

function PrivacyKo() {
  return (
    <>
      <h1>개인정보처리방침</h1>

      <div className="note">
        <strong>개인정보처리자</strong>: 본 서비스(Balruno)는 대한민국에 거주하는 1인 운영자가 베타 단계로 제공하는 게임 밸런싱 워크스페이스입니다. 사업자 등록 전 단계이며, 정식 출시 시점에 개인정보처리자 사업자 정보가 본 방침에 추가됩니다. 운영자 연락처는 <strong>제10조</strong>에 명시합니다.
      </div>

      <p>
        본 방침은 「개인정보 보호법」(이하 &quot;개인정보보호법&quot;) 및 관련 법령에 따라 사용자가 제공한 개인정보를 어떻게 수집·이용·보관·파기·제공하는지 안내합니다.
      </p>

      <h2>제1조 (수집하는 개인정보 항목)</h2>
      <p>Balruno 는 서비스 제공에 필요한 최소한의 개인정보만 수집합니다.</p>
      <table>
        <thead>
          <tr>
            <th>구분</th>
            <th>수집 항목</th>
            <th>수집 시점</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>필수 (회원가입)</td>
            <td>이메일, 표시 이름, OAuth 제공자 ID(GitHub 또는 Google), provider avatar URL</td>
            <td>OAuth 로그인 시 자동 수집</td>
          </tr>
          <tr>
            <td>자동 수집</td>
            <td>접속 IP, 브라우저/OS 정보, 접속 일시, 서비스 이용 기록(생성/편집한 프로젝트·시트 메타)</td>
            <td>서비스 이용 시</td>
          </tr>
          <tr>
            <td>선택</td>
            <td>피드백·문의 시 제공한 본문 및 첨부 파일</td>
            <td>사용자가 자발적으로 제공할 때</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>수집하지 않는 정보</strong>: 비밀번호(OAuth-only), 주민등록번호, 결제 정보(베타 기간 무료), 위치 정보, 마이크/카메라 데이터.
      </p>

      <h2>제2조 (개인정보의 수집·이용 목적)</h2>
      <ul>
        <li>회원 인증 및 본인 확인 (OAuth callback 흐름)</li>
        <li>서비스 제공·동기화·개인화(워크스페이스, 프로젝트 권한 식별)</li>
        <li>고객 지원 및 문의 응답</li>
        <li>부정 이용 방지·보안 모니터링 (접속 IP·이상 행위 패턴 분석)</li>
        <li>서비스 개선을 위한 집계 통계 (개인 식별 불가능한 형태)</li>
      </ul>

      <h2>제3조 (개인정보의 보유 및 이용 기간)</h2>
      <ul>
        <li>회원정보: 회원 자격 유지 기간 동안 보관, 탈퇴 후 30일 유예 → 영구 삭제.</li>
        <li>접속 로그·IP: 「통신비밀보호법」에 따라 3개월 보관 후 파기.</li>
        <li>피드백·문의 기록: 응답 종료 후 1년 보관 → 파기.</li>
        <li>법령에서 별도 보존을 요구하는 경우(예: 결제 도입 후 거래 기록 5년) 해당 기간만 보존하며, 본 방침 갱신 시 명시합니다.</li>
      </ul>

      <h2>제4조 (개인정보의 제3자 제공)</h2>
      <p>운영자는 사용자의 개인정보를 본 방침에 명시한 목적 외로 이용하거나 제3자에게 제공하지 않습니다. 다만 다음의 경우는 예외입니다:</p>
      <ul>
        <li>사용자가 사전에 동의한 경우</li>
        <li>법령에 따라 수사기관·법원 등이 적법한 절차로 요구하는 경우</li>
        <li>사용자의 명시적 행위(예: 워크스페이스에 다른 사용자 초대)에 따라 필요한 정보 공유</li>
      </ul>

      <h2>제5조 (개인정보 처리의 위탁)</h2>
      <p>운영자는 서비스 제공을 위해 다음 외부 업체에 개인정보 처리를 위탁합니다.</p>
      <table>
        <thead>
          <tr>
            <th>위탁 업체</th>
            <th>위탁 업무</th>
            <th>처리 위치</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Oracle Cloud Infrastructure (OCI)</td>
            <td>인프라 호스팅(서버·DB)</td>
            <td>Asia (서울/도쿄)</td>
          </tr>
          <tr>
            <td>Vercel Inc.</td>
            <td>프론트엔드 호스팅·CDN</td>
            <td>Global edge</td>
          </tr>
          <tr>
            <td>Cloudflare, Inc.</td>
            <td>DNS·DDoS 방어·proxy</td>
            <td>Global edge</td>
          </tr>
          <tr>
            <td>GitHub, Inc. / Google LLC</td>
            <td>OAuth 인증 처리</td>
            <td>Global</td>
          </tr>
          <tr>
            <td>Functional Software, Inc. (Sentry)</td>
            <td>오류·성능 모니터링</td>
            <td>USA (선택, 익명 stack trace)</td>
          </tr>
        </tbody>
      </table>
      <p>위탁 계약은 개인정보보호법령에 따라 안전한 처리·재위탁 제한·사고 시 통지 의무를 포함합니다.</p>

      <h2>제6조 (국외 이전)</h2>
      <p>위 제5조의 위탁업체 중 일부는 국외(미국, 글로벌 edge)에 위치합니다. 사용자의 개인정보는 OAuth 인증·CDN·에러 모니터링 목적으로 해당 지역에 일시적으로 전송될 수 있습니다. 이전되는 항목·시점·방법·목적은 위 제5조 표의 내용과 동일합니다.</p>

      <h2>제7조 (정보주체의 권리)</h2>
      <p>사용자는 언제든지 본인의 개인정보에 대해 다음 권리를 행사할 수 있습니다:</p>
      <ul>
        <li>열람 요청</li>
        <li>오류·변경 정정 요청</li>
        <li>삭제 요청 (회원 탈퇴 포함)</li>
        <li>처리 정지 요청</li>
        <li>개인정보 이전(export) 요청</li>
      </ul>
      <p>요청은 서비스 내 설정 페이지에서 처리하거나, 제10조의 운영자 이메일로 직접 연락해 주십시오. 운영자는 요청을 받은 날로부터 10일 이내에 회신합니다.</p>

      <h2>제8조 (만 14세 미만 아동의 개인정보)</h2>
      <p>본 서비스는 만 14세 미만 아동의 회원가입을 원칙적으로 받지 않습니다. 만 14세 미만 아동의 개인정보가 수집된 사실이 확인될 경우 즉시 해당 계정·데이터를 삭제합니다. 법정대리인의 동의가 필요한 경우 별도 절차를 안내합니다.</p>

      <h2>제9조 (안전성 확보 조치)</h2>
      <p>운영자는 개인정보보호법 제29조에 따라 다음과 같은 안전성 확보 조치를 취합니다:</p>
      <ul>
        <li><strong>관리적 조치</strong>: 1인 운영 단계 — 운영자 1명만 개인정보에 접근. 접근 기록(접속 IP, 일시) 보관.</li>
        <li><strong>기술적 조치</strong>: 비밀번호 미보관(OAuth-only), 통신구간 TLS 암호화, JWT 서명 키 분리 저장, refresh token 해시 저장 + rotation, 데이터베이스 자체호스팅(매니지드 third-party 격리).</li>
        <li><strong>물리적 조치</strong>: OCI 데이터센터 보안에 위임. 운영자 단말은 디스크 암호화 적용.</li>
      </ul>
      <p>다만 어떤 인터넷 서비스도 100% 안전을 보장할 수 없으며, 외부 침해 사고 발생 시 운영자는 인지 후 즉시 사용자에게 통지하고 관계기관에 신고합니다.</p>

      <h2>제10조 (쿠키 및 추적 기술)</h2>
      <ul>
        <li><strong>인증 쿠키</strong>: refresh token (httpOnly, Secure, SameSite=Lax/Strict)·session 쿠키 — 로그인 상태 유지에 필수.</li>
        <li><strong>분석</strong>: Vercel Analytics — 페이지뷰 집계만 수집(개인 식별 정보 비수집). 사용자가 브라우저 설정에서 차단해도 서비스 이용에 지장 없음.</li>
        <li>제3자 광고/리타게팅 쿠키는 사용하지 않습니다.</li>
      </ul>

      <h2>제11조 (개인정보 보호책임자)</h2>
      <p>본 방침에 관한 문의·권리 행사·신고는 다음 연락처로 받습니다.</p>
      <p>
        <strong>개인정보 보호책임자</strong>: 운영자 본인 (1인 운영 단계)
        <br />
        <strong>이메일</strong>: dj258255@naver.com
        <br />
        <strong>응답 기한</strong>: 영업일 기준 7일 이내
      </p>
      <p>
        개인정보 침해에 관한 도움이 필요하신 경우 다음 기관에 문의하실 수 있습니다:
      </p>
      <ul>
        <li>개인정보분쟁조정위원회: <a href="https://www.kopico.go.kr" target="_blank" rel="noopener">www.kopico.go.kr</a> (국번없이 1833-6972)</li>
        <li>한국인터넷진흥원 개인정보침해신고센터: <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener">privacy.kisa.or.kr</a> (국번없이 118)</li>
        <li>대검찰청 사이버범죄수사단: 1301</li>
        <li>경찰청 사이버안전국: 182</li>
      </ul>

      <h2>제12조 (방침의 변경)</h2>
      <p>본 방침은 법령·서비스 정책 변경에 따라 갱신될 수 있습니다. 중대한 변경은 시행 30일 전, 일반 변경은 7일 전 서비스 내 공지 또는 가입 이메일로 통지합니다.</p>

      <h2>제13조 (영문판과 한국어판의 우선순위)</h2>
      <p>본 방침은 한국어판과 영문판이 함께 제공됩니다. 두 언어판 사이에 해석상 차이가 있을 경우 <strong>한국어판이 우선</strong>합니다.</p>

      <p style={{ marginTop: '2rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
        본 방침은 베타 출시를 위해 작성된 초안이며, 정식 출시 전 법률 자문(개인정보보호법·정보통신망법)을 거쳐 최종본으로 갱신될 예정입니다.
      </p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <h1>Privacy Policy</h1>

      <div className="note">
        <strong>Data Controller</strong>: Balruno is a beta-stage game-balancing workspace operated by an individual residing in the Republic of Korea. The operator does not yet hold a registered business; corporate details will be added to this Policy at the time of general availability. Operator contact is provided in <strong>§11</strong>.
      </div>

      <p>
        This Policy explains how the operator collects, uses, retains, deletes, and shares the personal data you provide, in accordance with the Korean Personal Information Protection Act (PIPA) and applicable laws.
      </p>

      <h2>1. Personal Data Collected</h2>
      <p>Balruno collects only the minimum personal data needed to operate the Service.</p>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Items</th>
            <th>When collected</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Required (sign-up)</td>
            <td>Email, display name, OAuth provider ID (GitHub or Google), provider avatar URL</td>
            <td>Automatically on OAuth login</td>
          </tr>
          <tr>
            <td>Automatic</td>
            <td>IP address, browser/OS info, access timestamp, service usage logs (project/sheet metadata you create or edit)</td>
            <td>While you use the Service</td>
          </tr>
          <tr>
            <td>Optional</td>
            <td>Body and attachments of feedback or support inquiries</td>
            <td>When you voluntarily provide them</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Not collected</strong>: passwords (OAuth-only), national ID numbers, payment info (free during beta), location data, microphone/camera data.
      </p>

      <h2>2. Purposes of Use</h2>
      <ul>
        <li>Member authentication and identity verification (OAuth callback flow)</li>
        <li>Service delivery, sync, and personalization (workspace and project permission resolution)</li>
        <li>Customer support and inquiry response</li>
        <li>Abuse prevention and security monitoring (analysis of access IPs and anomalous patterns)</li>
        <li>Aggregate analytics for service improvement (in non-identifiable form)</li>
      </ul>

      <h2>3. Retention Period</h2>
      <ul>
        <li>Member data: retained while the membership is active; deleted permanently after a 30-day grace period following account cancellation.</li>
        <li>Access logs and IPs: retained for 3 months under the Korean Protection of Communications Secrets Act, then destroyed.</li>
        <li>Feedback and inquiry records: retained for 1 year after resolution, then destroyed.</li>
        <li>Records subject to mandatory retention by law (e.g., transaction records for 5 years after billing is introduced) are kept only for the legally required duration; this Policy will be updated accordingly.</li>
      </ul>

      <h2>4. Disclosure to Third Parties</h2>
      <p>The operator does not use your personal data for purposes other than those stated in this Policy, nor disclose it to third parties, except:</p>
      <ul>
        <li>With your prior consent;</li>
        <li>When lawfully requested by investigative or judicial authorities pursuant to applicable procedures;</li>
        <li>To the extent required to fulfill an explicit user action (e.g., inviting another user to your workspace).</li>
      </ul>

      <h2>5. Processing Entrustment (Sub-processors)</h2>
      <p>The operator entrusts certain processing tasks to the following sub-processors:</p>
      <table>
        <thead>
          <tr>
            <th>Sub-processor</th>
            <th>Task</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Oracle Cloud Infrastructure (OCI)</td>
            <td>Infrastructure hosting (server, database)</td>
            <td>Asia (Seoul / Tokyo)</td>
          </tr>
          <tr>
            <td>Vercel Inc.</td>
            <td>Frontend hosting and CDN</td>
            <td>Global edge</td>
          </tr>
          <tr>
            <td>Cloudflare, Inc.</td>
            <td>DNS, DDoS protection, proxy</td>
            <td>Global edge</td>
          </tr>
          <tr>
            <td>GitHub, Inc. / Google LLC</td>
            <td>OAuth authentication</td>
            <td>Global</td>
          </tr>
          <tr>
            <td>Functional Software, Inc. (Sentry)</td>
            <td>Error and performance monitoring</td>
            <td>USA (optional, anonymized stack traces)</td>
          </tr>
        </tbody>
      </table>
      <p>The entrustment contracts include obligations on secure handling, restrictions on sub-processor changes, and breach notification, in accordance with PIPA.</p>

      <h2>6. International Transfers</h2>
      <p>Some of the sub-processors listed in §5 are located outside the Republic of Korea (USA, global edge). Personal data may be transferred to these regions for OAuth authentication, CDN, and error-monitoring purposes. The transferred items, timing, method, and purpose are as listed in the §5 table.</p>

      <h2>7. Your Rights</h2>
      <p>You may exercise the following rights with respect to your personal data at any time:</p>
      <ul>
        <li>Request access</li>
        <li>Request correction of errors</li>
        <li>Request deletion (including account cancellation)</li>
        <li>Request suspension of processing</li>
        <li>Request data portability (export)</li>
      </ul>
      <p>Requests can be made via the in-app settings page or by emailing the operator (see §11). The operator will respond within 10 days of receipt.</p>

      <h2>8. Children Under 14</h2>
      <p>The Service does not, as a rule, accept members under 14 years of age. If personal data of a child under 14 is found to have been collected, the relevant account and data will be deleted immediately. A separate procedure will be provided where parental consent is required.</p>

      <h2>9. Security Measures</h2>
      <p>Pursuant to PIPA Article 29, the operator takes the following measures to ensure the security of personal data:</p>
      <ul>
        <li><strong>Administrative</strong>: in the current single-operator phase, only the operator has access to personal data. Access is logged (IP, timestamp).</li>
        <li><strong>Technical</strong>: no password storage (OAuth-only), TLS encryption in transit, JWT signing keys stored separately, refresh tokens stored as hashes with rotation, self-hosted database (isolated from third-party managed services).</li>
        <li><strong>Physical</strong>: delegated to OCI data-center security; operator workstations use disk encryption.</li>
      </ul>
      <p>That said, no internet service can guarantee 100% security. In the event of a breach, the operator will notify affected users immediately upon detection and report to the relevant authorities.</p>

      <h2>10. Cookies & Tracking</h2>
      <ul>
        <li><strong>Authentication cookies</strong>: refresh token (httpOnly, Secure, SameSite=Lax/Strict) and session cookies — required for maintaining login state.</li>
        <li><strong>Analytics</strong>: Vercel Analytics — pageview aggregates only, no personal identification. Blocking via browser settings does not impair the Service.</li>
        <li>No third-party advertising or retargeting cookies are used.</li>
      </ul>

      <h2>11. Privacy Officer</h2>
      <p>Inquiries, rights requests, and reports related to this Policy can be sent to:</p>
      <p>
        <strong>Privacy Officer</strong>: the operator (single-operator phase)
        <br />
        <strong>Email</strong>: dj258255@naver.com
        <br />
        <strong>Response time</strong>: within 7 business days
      </p>
      <p>If you need help with a personal-information dispute, you may contact the following Korean authorities:</p>
      <ul>
        <li>Personal Information Dispute Mediation Committee: <a href="https://www.kopico.go.kr" target="_blank" rel="noopener">www.kopico.go.kr</a> (1833-6972)</li>
        <li>Korea Internet &amp; Security Agency Privacy Center: <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener">privacy.kisa.or.kr</a> (118)</li>
        <li>Supreme Prosecutors&apos; Office Cybercrime Unit: 1301</li>
        <li>National Police Agency Cyber Bureau: 182</li>
      </ul>

      <h2>12. Changes to This Policy</h2>
      <p>This Policy may be updated to reflect changes in law or service policy. Material changes are notified at least 30 days in advance; minor changes at least 7 days in advance, via in-app notice or the email associated with your account.</p>

      <h2>13. Language Precedence</h2>
      <p>This Policy is provided in Korean and English. In the event of any inconsistency between the two, <strong>the Korean version controls</strong>.</p>

      <p style={{ marginTop: '2rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
        This Policy is a draft prepared for the beta launch and will be reviewed by counsel (PIPA / Korean Information &amp; Communications Network Act) before general availability.
      </p>
    </>
  );
}
