import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Balruno',
  description: 'Balruno 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <main
      className="mx-auto max-w-2xl px-6 py-12"
      style={{ color: 'var(--text-primary)' }}
    >
      <Link href="/" className="text-sm" style={{ color: 'var(--accent)' }}>
        ← 홈으로
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-2">개인정보처리방침</h1>
      <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
        최종 수정일: 2026-05-04
      </p>

      <Section title="1. 수집 항목">
        <ul className="list-disc pl-5 space-y-1">
          <li>이메일, 비밀번호 해시, 표시 이름 — 회원가입 시 필수</li>
          <li>서비스 이용 기록 (프로젝트/시트/문서 활동) — 자동 수집</li>
          <li>접속 IP, 브라우저 정보 — 보안 및 부정 이용 방지 목적</li>
        </ul>
      </Section>

      <Section title="2. 수집 목적">
        <ul className="list-disc pl-5 space-y-1">
          <li>회원 인증 및 서비스 제공</li>
          <li>고객 지원 및 문의 응답</li>
          <li>서비스 개선 (집계 통계)</li>
        </ul>
      </Section>

      <Section title="3. 보유 기간">
        <p>회원 탈퇴 후 30일 유예 기간이 지나면 모든 개인정보는 영구 삭제됩니다. 단, 법령에서 정하는 보존 의무가 있는 경우 해당 기간 동안 보존합니다.</p>
      </Section>

      <Section title="4. 제3자 제공">
        <p>법령에 의한 경우를 제외하고 제3자에게 개인정보를 제공하지 않습니다.</p>
      </Section>

      <Section title="5. 위탁">
        <ul className="list-disc pl-5 space-y-1">
          <li>인프라(호스팅): Oracle Cloud Infrastructure</li>
          <li>이메일 발송: 백엔드 도입 시 별도 명시</li>
          <li>에러 모니터링: Sentry</li>
        </ul>
      </Section>

      <Section title="6. 사용자의 권리">
        <p>언제든지 개인정보 열람/정정/삭제/처리정지를 요청할 수 있습니다. 요청은 서비스 내 설정에서 처리하거나 운영자에게 직접 연락해 주세요.</p>
      </Section>

      <Section title="7. 쿠키">
        <p>로그인 상태 유지를 위해 인증 쿠키(httpOnly, Secure, SameSite=Lax/Strict)를 사용합니다. 분석 쿠키(Vercel Analytics)는 익명 집계 용도로만 사용됩니다.</p>
      </Section>

      <p className="mt-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        본 방침은 베타 출시를 위해 작성된 초안이며, 정식 출시 전 법률 자문을 거쳐 최종본으로 갱신될 수 있습니다.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-semibold mb-2">{title}</h2>
      <div className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </section>
  );
}
