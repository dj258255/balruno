import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Balruno',
  description: 'Balruno 이용약관',
};

export default function TermsPage() {
  return (
    <main
      className="mx-auto max-w-2xl px-6 py-12"
      style={{ color: 'var(--text-primary)' }}
    >
      <Link href="/" className="text-sm" style={{ color: 'var(--accent)' }}>
        ← 홈으로
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-2">이용약관</h1>
      <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
        최종 수정일: 2026-05-04
      </p>

      <Section title="1. 서비스 제공자">
        <p>본 서비스(이하 "Balruno")는 1인 운영자가 제공하는 게임 밸런싱 워크스페이스입니다.</p>
      </Section>

      <Section title="2. 계정">
        <p>회원가입 시 정확한 정보를 입력해야 하며, 계정 정보의 비밀유지 책임은 사용자에게 있습니다.</p>
      </Section>

      <Section title="3. 사용자 콘텐츠">
        <p>사용자가 입력한 시트/문서 데이터의 소유권은 사용자에게 귀속됩니다. Balruno는 서비스 제공을 위해 필요한 범위에서 데이터를 처리합니다.</p>
      </Section>

      <Section title="4. 서비스 변경 및 종료">
        <p>Balruno는 사전 공지 후 서비스의 일부 또는 전부를 변경하거나 종료할 수 있습니다. 종료 시 사용자는 데이터를 export 받을 수 있는 합리적인 기간(최소 30일)을 부여받습니다.</p>
      </Section>

      <Section title="5. 책임의 제한">
        <p>Balruno는 베타 단계로 제공되며, 데이터 손실/오류 등에 대한 별도 보증은 제공되지 않습니다. 중요 데이터는 정기적으로 export 받아 별도 백업해 주시기 바랍니다.</p>
      </Section>

      <Section title="6. 분쟁 해결">
        <p>본 약관은 대한민국 법률을 준거법으로 하며, 서울중앙지방법원을 1심 전속 관할법원으로 합니다.</p>
      </Section>

      <p className="mt-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        본 약관은 베타 출시를 위해 작성된 초안이며, 정식 출시 전 법률 자문을 거쳐 최종본으로 갱신될 수 있습니다.
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
