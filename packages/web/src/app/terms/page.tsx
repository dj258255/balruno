import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

// Force static rendering — no per-request data, so the HTML can sit
// on the CDN. Removes this route from the Vercel Origin Transfer
// budget. Pair with the same flag on /privacy.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Terms of Service — Balruno',
  description: 'Balruno 이용약관 / Terms of Service',
};

const UPDATED_AT = '2026-05-08';

export default function TermsPage() {
  return (
    <LegalShell updatedAt={UPDATED_AT} ko={<TermsKo />} en={<TermsEn />} />
  );
}

function TermsKo() {
  return (
    <>
      <h1>이용약관</h1>

      <div className="note">
        <strong>중요</strong>: 본 서비스는 1인 운영자가 베타 단계로 제공하는 게임 밸런싱 워크스페이스입니다. 사업자 등록 전 단계이며, 정식 출시 시점에 본 약관은 사업자 정보 + 결제·환불 조항을 포함해 갱신될 예정입니다. 베타 기간 중에는 데이터 손실/오류 등에 대한 별도 보증이 없으니 중요 데이터는 export 받아 별도 백업해 주십시오.
      </div>

      <h2>제1조 (서비스 제공자)</h2>
      <p>
        본 서비스(이하 &quot;Balruno&quot;)는 대한민국에 거주하는 1인 운영자가 제공하는 게임 밸런싱·디자인 워크스페이스입니다. 본 약관 적용 시점에 운영자는 사업자 등록을 보유하지 않으며, 정식 출시 시점에 사업자 등록 정보가 본 약관에 추가 반영됩니다. 운영자 연락처는 <strong>제13조 (문의)</strong>에 명시합니다.
      </p>

      <h2>제2조 (서비스의 성격 — 베타)</h2>
      <p>Balruno 는 베타 단계의 서비스로 다음을 명시합니다:</p>
      <ul>
        <li>기능·UI·요금제는 사전 통지 없이 변경될 수 있습니다.</li>
        <li>가용성(uptime) SLA 를 별도로 보장하지 않습니다.</li>
        <li>예고된 점검 또는 예고 없는 장애로 일시적 접근 불가가 발생할 수 있습니다.</li>
        <li>베타 기간 중 발생한 데이터 손실/오류에 대해 운영자는 법령상 강행규정의 범위를 제외하고 책임을 지지 않습니다.</li>
      </ul>

      <h2>제3조 (가입 및 계정)</h2>
      <ul>
        <li>가입은 GitHub 또는 Google OAuth 를 통해 이루어지며, 별도 비밀번호를 보관하지 않습니다.</li>
        <li>계정 정보(이메일, 표시 이름, OAuth provider id 등)의 정확성과 비밀유지 책임은 사용자에게 있습니다.</li>
        <li>1 사용자당 1 계정을 권장합니다. 다중 계정으로 한도 회피·시스템 부정 이용을 시도할 경우 계정이 정지될 수 있습니다.</li>
      </ul>

      <h2>제4조 (사용자 콘텐츠)</h2>
      <ul>
        <li>사용자가 입력한 시트, 문서, 첨부 파일, 코멘트 등의 저작권/소유권은 사용자에게 귀속됩니다.</li>
        <li>운영자는 서비스 제공·동기화·백업·장애 대응에 필요한 범위에서 사용자 콘텐츠를 처리하며, 사용자 동의 없이 제3자에게 제공하지 않습니다.</li>
        <li>사용자는 자신의 콘텐츠가 타인의 권리를 침해하지 않도록 할 책임이 있습니다. 침해 신고가 접수되면 운영자는 임시 비공개 또는 삭제 등의 조치를 할 수 있습니다.</li>
      </ul>

      <h2>제5조 (금지 행위)</h2>
      <p>아래 행위는 금지되며, 적발 시 사전 통지 없이 계정 정지·삭제할 수 있습니다:</p>
      <ul>
        <li>법령·약관·미풍양속에 반하는 콘텐츠 업로드·공유</li>
        <li>타인의 계정 도용 또는 무단 이용</li>
        <li>자동화 도구로 시스템에 비정상 부하 유발 (rate limit 초과)</li>
        <li>보안 취약점을 의도적 악용 (책임 있는 공개 절차는 본 조 적용 제외 — 제13조 참조)</li>
        <li>운영자의 명시적 허가 없는 SaaS 형태의 재판매·재배포</li>
      </ul>

      <h2>제6조 (오픈소스 라이센스)</h2>
      <p>Balruno 의 소스 코드는 다음 라이센스로 공개됩니다:</p>
      <ul>
        <li>프론트엔드(웹·데스크톱 클라이언트): <strong>MIT 라이센스</strong></li>
        <li>백엔드(API·동기화 서버): <strong>AGPL v3 라이센스</strong></li>
      </ul>
      <p>본 약관은 호스팅 서비스(Balruno Cloud) 이용에 적용되며, 자체 호스팅 시에는 각 라이센스 본문이 우선합니다.</p>

      <h2>제7조 (서비스의 변경 및 종료)</h2>
      <ul>
        <li>운영자는 사전 공지 후 서비스의 일부 또는 전부를 변경하거나 종료할 수 있습니다.</li>
        <li>서비스 종료 시 사용자에게 데이터를 export 받을 수 있는 합리적인 기간(최소 30일)을 부여합니다.</li>
        <li>중대한 정책 변경(요금제 도입, 한도 하향 등)은 시행 30일 전 사용자에게 통지합니다.</li>
      </ul>

      <h2>제8조 (가입 해지·계정 삭제)</h2>
      <ul>
        <li>사용자는 언제든지 설정 페이지에서 회원 탈퇴를 요청할 수 있습니다.</li>
        <li>탈퇴 시 즉시 로그인 차단되고, 30일 유예 기간 후 모든 개인정보·콘텐츠가 영구 삭제됩니다.</li>
        <li>30일 내 재로그인 시 복구가 가능합니다.</li>
        <li>법령에서 정하는 보존 의무가 있는 경우 해당 기간 동안만 보존됩니다(개인정보처리방침 제3조 참조).</li>
      </ul>

      <h2>제9조 (책임의 제한)</h2>
      <p>관련 법령상 강행규정의 범위를 제외하고, 운영자는 다음에 대해 책임을 지지 않습니다:</p>
      <ul>
        <li>천재지변, 외부 인프라 장애(클라우드 사업자, ISP 등) 등 불가항력에 의한 손해</li>
        <li>사용자의 부주의(비밀번호 분실, 데이터 미백업 등)로 인한 손해</li>
        <li>간접·특별·결과적·징벌적 손해(영업이익 손실 포함)</li>
      </ul>
      <p>유료 결제가 발생한 시점부터는 결제 약관(별도 페이지)이 우선 적용됩니다. 베타 기간에는 결제가 발생하지 않습니다.</p>

      <h2>제10조 (약관의 변경)</h2>
      <ul>
        <li>본 약관은 관련 법령·서비스 정책의 변경에 따라 갱신될 수 있습니다.</li>
        <li>중대한 변경은 시행 30일 전, 일반 변경은 7일 전 서비스 내 공지 또는 가입 이메일로 통지합니다.</li>
        <li>통지 후 사용자가 명시적 거부 없이 서비스를 계속 이용하면 변경 약관에 동의한 것으로 간주합니다.</li>
      </ul>

      <h2>제11조 (준거법 및 분쟁 해결)</h2>
      <p>본 약관은 대한민국 법률을 준거법으로 합니다. 본 서비스 이용과 관련하여 분쟁이 발생할 경우 운영자와 사용자는 신의에 따라 우선 협의합니다. 협의가 이루어지지 않을 경우 민사소송법상 일반 관할 법원에 소를 제기할 수 있습니다.</p>

      <h2>제12조 (영문판과 한국어판의 우선순위)</h2>
      <p>본 약관은 한국어판과 영문판이 함께 제공됩니다. 두 언어판 사이에 해석상 차이가 있을 경우 <strong>한국어판이 우선</strong>합니다.</p>

      <h2>제13조 (문의 및 연락처)</h2>
      <p>
        본 서비스에 관한 문의·신고·권리 침해 통지는 아래 이메일로 접수받습니다:
        <br />
        <strong>이메일</strong>: dj258255@naver.com
      </p>
      <p>
        보안 취약점은 가능한 한 위 이메일로 비공개 신고해 주시기 바랍니다. 운영자는 신고일로부터 합리적인 기간 내에 회신하며, 책임 있는 공개 절차에 협조한 신고자에 대해서는 본 약관 제5조의 금지 행위 적용을 면제합니다.
      </p>

      <p style={{ marginTop: '2rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
        본 약관은 베타 출시를 위해 작성된 초안이며, 정식 출시 전 법률 자문을 거쳐 최종본으로 갱신될 예정입니다. 일부 조항은 한국 법률 환경에 맞춰 일반적인 SaaS 약관에서 단순화·생략되어 있습니다.
      </p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <h1>Terms of Service</h1>

      <div className="note">
        <strong>Notice</strong>: Balruno is a beta-stage service operated by an individual. The operator does not yet hold a registered business entity; these Terms will be updated with corporate details and billing/refund clauses at the time of general availability. During the beta period, no warranty is provided on data integrity — please export important data periodically as a backup.
      </div>

      <h2>1. Service Provider</h2>
      <p>
        Balruno (the &quot;Service&quot;) is a game-balancing and design workspace provided by an individual operator residing in the Republic of Korea. As of the effective date of these Terms, the operator does not hold a registered business; corporate registration details will be added to these Terms upon general availability. Operator contact is provided in <strong>§13 (Contact)</strong>.
      </p>

      <h2>2. Beta Status</h2>
      <p>The Service is provided in a beta phase. The operator explicitly states:</p>
      <ul>
        <li>Features, UI, and pricing may change without prior notice.</li>
        <li>No uptime SLA is guaranteed.</li>
        <li>Scheduled or unscheduled outages may cause temporary unavailability.</li>
        <li>The operator disclaims liability for data loss or errors arising during the beta phase, except where mandatory law applies.</li>
      </ul>

      <h2>3. Account & Authentication</h2>
      <ul>
        <li>Sign-up is performed via GitHub or Google OAuth. The Service does not store passwords.</li>
        <li>You are responsible for the accuracy and confidentiality of your account information (email, display name, OAuth provider id, etc.).</li>
        <li>One account per user is recommended. Creating multiple accounts to bypass usage limits or abuse the system may result in suspension.</li>
      </ul>

      <h2>4. User Content</h2>
      <ul>
        <li>You retain ownership and copyright over the sheets, documents, attachments, and comments you create on the Service.</li>
        <li>The operator processes user content only as necessary to provide, sync, back up, and troubleshoot the Service, and does not share content with third parties without your consent.</li>
        <li>You are responsible for ensuring your content does not infringe the rights of others. Upon receipt of an infringement notice, the operator may take temporary measures including unpublishing or removal.</li>
      </ul>

      <h2>5. Prohibited Conduct</h2>
      <p>The following conduct is prohibited and may result in account suspension or removal without notice:</p>
      <ul>
        <li>Uploading or sharing content that violates law, these Terms, or public order;</li>
        <li>Impersonating or accessing another user&apos;s account without authorization;</li>
        <li>Using automated tools to impose abnormal load on the Service (exceeding rate limits);</li>
        <li>Intentionally exploiting security vulnerabilities (responsible disclosure as described in §13 is exempt);</li>
        <li>Reselling or redistributing the Service in SaaS form without explicit written permission from the operator.</li>
      </ul>

      <h2>6. Open Source Licensing</h2>
      <p>The source code of Balruno is published under the following licenses:</p>
      <ul>
        <li>Frontend (web and desktop clients): <strong>MIT License</strong></li>
        <li>Backend (API and sync server): <strong>AGPL v3 License</strong></li>
      </ul>
      <p>These Terms govern use of the hosted offering (Balruno Cloud). For self-hosted deployments, the respective license texts take precedence.</p>

      <h2>7. Service Modifications & Termination</h2>
      <ul>
        <li>The operator may modify or discontinue any part of the Service after reasonable notice.</li>
        <li>Upon discontinuation, you will be given a reasonable export window of at least 30 days.</li>
        <li>Material policy changes (introduction of paid plans, lowering of free-tier limits, etc.) will be notified at least 30 days in advance.</li>
      </ul>

      <h2>8. Account Cancellation</h2>
      <ul>
        <li>You may request account deletion at any time from the settings page.</li>
        <li>Upon request, login is immediately disabled, and all personal data and content are permanently deleted after a 30-day grace period.</li>
        <li>Re-login during the grace period restores the account.</li>
        <li>Records subject to mandatory retention by law are kept only for the legally required duration (see Privacy Policy §3).</li>
      </ul>

      <h2>9. Limitation of Liability</h2>
      <p>To the maximum extent permitted by applicable law, the operator is not liable for:</p>
      <ul>
        <li>Damages arising from force majeure events, including outages of upstream infrastructure (cloud providers, ISPs, etc.);</li>
        <li>Damages arising from user negligence (lost credentials, lack of backups, etc.);</li>
        <li>Indirect, special, consequential, or punitive damages, including loss of business profit.</li>
      </ul>
      <p>Once paid plans are introduced, the separate Billing Terms will govern paid subscriptions. No charges occur during the beta period.</p>

      <h2>10. Changes to These Terms</h2>
      <ul>
        <li>These Terms may be updated to reflect changes in law or service policy.</li>
        <li>Material changes are notified at least 30 days in advance; minor changes at least 7 days in advance, via in-app notice or the email associated with your account.</li>
        <li>Continued use of the Service after the effective date constitutes acceptance of the revised Terms.</li>
      </ul>

      <h2>11. Governing Law & Dispute Resolution</h2>
      <p>These Terms are governed by the laws of the Republic of Korea. The parties shall first attempt to resolve any dispute in good faith. Failing such resolution, disputes may be brought to the competent court under Korean civil procedure.</p>

      <h2>12. Language Precedence</h2>
      <p>These Terms are provided in Korean and English. In the event of any inconsistency between the two, <strong>the Korean version controls</strong>.</p>

      <h2>13. Contact</h2>
      <p>
        For questions, reports, or notices of rights infringement, please contact:
        <br />
        <strong>Email</strong>: dj258255@naver.com
      </p>
      <p>
        Security vulnerabilities should be reported privately to the email above. The operator will respond within a reasonable time and exempts good-faith reporters from §5 prohibitions when responsible disclosure procedures are followed.
      </p>

      <p style={{ marginTop: '2rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
        These Terms are a draft prepared for the beta launch and will be reviewed by counsel before general availability. Some clauses have been simplified or omitted relative to typical SaaS terms to fit the Korean legal environment for an individual operator.
      </p>
    </>
  );
}
