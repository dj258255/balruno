/**
 * Track 14 — Webhook 프리셋.
 *
 * Discord embed / Slack block / 일반 JSON / GitHub / Notion 템플릿.
 * Automation 의 webhook action 에서 1-클릭 선택.
 */

export interface WebhookPreset {
  id: string;
  name: string;
  service: 'discord' | 'slack' | 'github' | 'notion' | 'generic';
  description: string;
  /** URL placeholder (유저가 실제 URL 붙임) */
  urlHint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  /** JSON payload 템플릿 (변수: {{변수명}} — 런타임에서 치환) */
  bodyTemplate: string;
  variables: Array<{ key: string; description: string; example: string }>;
}

export const WEBHOOK_PRESETS: WebhookPreset[] = [
  {
    id: 'discord-balance-change',
    name: 'Discord — 밸런스 변경 알림',
    service: 'discord',
    description: '스탯 변경 시 Discord 채널에 embed 로 알림',
    urlHint: 'https://discord.com/api/webhooks/...',
    method: 'POST',
    bodyTemplate: JSON.stringify(
      {
        username: 'Balruno',
        embeds: [
          {
            title: '{{entityName}} 스탯 변경',
            description: '{{stat}}: **{{before}} → {{after}}** ({{percent}})\n\n{{reason}}',
            color: 3447003,
            author: { name: '{{userName}}' },
            footer: { text: 'Balruno · Change History' },
            timestamp: '{{timestamp}}',
          },
        ],
      },
      null,
      2
    ),
    variables: [
      { key: 'entityName', description: '변경된 entity 이름', example: 'Sword of Dawn' },
      { key: 'stat', description: '변경된 stat 이름', example: 'damage' },
      { key: 'before', description: '이전 값', example: '100' },
      { key: 'after', description: '변경 후 값', example: '120' },
      { key: 'percent', description: '변화율', example: '+20%' },
      { key: 'reason', description: '변경 사유', example: '후반 긴장감 부족' },
      { key: 'userName', description: '작성자', example: 'beomsu' },
      { key: 'timestamp', description: 'ISO 8601 시각', example: '2026-04-20T14:23:00Z' },
    ],
  },
  {
    id: 'discord-playtest-scheduled',
    name: 'Discord — 플레이테스트 예정 알림',
    service: 'discord',
    description: '플레이테스트 세션 생성 시 채널 알림',
    urlHint: 'https://discord.com/api/webhooks/...',
    method: 'POST',
    bodyTemplate: JSON.stringify(
      {
        username: 'Balruno',
        content: '**{{sessionName}}** 플레이테스트 예정: {{date}}\n테스터: {{testers}}\n목표: {{goals}}',
      },
      null,
      2
    ),
    variables: [
      { key: 'sessionName', description: 'Playtest 세션 이름', example: 'Sword 밸런스 검증' },
      { key: 'date', description: '예정 날짜', example: '2026-04-25' },
      { key: 'testers', description: '테스터 목록', example: 'QA1, Daisy' },
      { key: 'goals', description: '검증 목표', example: 'Combat balance' },
    ],
  },
  {
    id: 'slack-balance-change',
    name: 'Slack — 밸런스 변경 알림',
    service: 'slack',
    description: '스탯 변경 시 Slack 채널에 block 메시지',
    urlHint: 'https://hooks.slack.com/services/...',
    method: 'POST',
    bodyTemplate: JSON.stringify(
      {
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '밸런스 변경: {{entityName}}' },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*Stat*\n{{stat}}' },
              { type: 'mrkdwn', text: '*변화*\n{{before}} → {{after}} ({{percent}})' },
              { type: 'mrkdwn', text: '*작성자*\n{{userName}}' },
              { type: 'mrkdwn', text: '*사유*\n{{reason}}' },
            ],
          },
        ],
      },
      null,
      2
    ),
    variables: [
      { key: 'entityName', description: '변경된 entity 이름', example: 'Sword of Dawn' },
      { key: 'stat', description: '변경된 stat 이름', example: 'damage' },
      { key: 'before', description: '이전 값', example: '100' },
      { key: 'after', description: '변경 후 값', example: '120' },
      { key: 'percent', description: '변화율', example: '+20%' },
      { key: 'reason', description: '변경 사유', example: '후반 긴장감 부족' },
      { key: 'userName', description: '작성자', example: 'beomsu' },
    ],
  },
  {
    id: 'github-create-issue',
    name: 'GitHub — 자동 이슈 생성',
    service: 'github',
    description: '큰 스탯 변경 시 GitHub 이슈 자동 생성 (프로그래머 대기열)',
    urlHint: 'https://api.github.com/repos/{owner}/{repo}/issues  (+ Authorization 헤더)',
    method: 'POST',
    bodyTemplate: JSON.stringify(
      {
        title: '[Balance] {{entityName}} {{stat}} 업데이트',
        body: '변경: {{before}} → {{after}} ({{percent}})\n\n**사유**: {{reason}}\n\n작성자: @{{userName}}\n\n[Balruno 에서 보기]({{balrunoUrl}})',
        labels: ['balance', 'auto-generated'],
      },
      null,
      2
    ),
    variables: [
      { key: 'entityName', description: 'Entity 이름', example: 'Sword of Dawn' },
      { key: 'stat', description: 'Stat 이름', example: 'damage' },
      { key: 'before', description: '이전 값', example: '100' },
      { key: 'after', description: '변경 후 값', example: '120' },
      { key: 'percent', description: '변화율', example: '+20%' },
      { key: 'reason', description: '변경 사유', example: '후반 긴장감 부족' },
      { key: 'userName', description: '작성자', example: 'beomsu' },
      { key: 'balrunoUrl', description: 'Balruno 링크', example: 'https://balruno.com/...' },
    ],
  },
  {
    id: 'notion-add-to-db',
    name: 'Notion — DB 에 밸런스 변경 추가',
    service: 'notion',
    description: 'Notion 데이터베이스에 row 추가 (Notion Integration Token 필요)',
    urlHint: 'https://api.notion.com/v1/pages',
    method: 'POST',
    bodyTemplate: JSON.stringify(
      {
        parent: { database_id: '{{notionDbId}}' },
        properties: {
          Name: { title: [{ text: { content: '{{entityName}} - {{stat}}' } }] },
          Before: { rich_text: [{ text: { content: '{{before}}' } }] },
          After: { rich_text: [{ text: { content: '{{after}}' } }] },
          Reason: { rich_text: [{ text: { content: '{{reason}}' } }] },
          Author: { rich_text: [{ text: { content: '{{userName}}' } }] },
        },
      },
      null,
      2
    ),
    variables: [
      { key: 'notionDbId', description: 'Notion DB ID', example: 'abc123...' },
      { key: 'entityName', description: 'Entity 이름', example: 'Sword of Dawn' },
      { key: 'stat', description: 'Stat 이름', example: 'damage' },
      { key: 'before', description: '이전 값', example: '100' },
      { key: 'after', description: '변경 후 값', example: '120' },
      { key: 'reason', description: '변경 사유', example: '후반 긴장감 부족' },
      { key: 'userName', description: '작성자', example: 'beomsu' },
    ],
  },
  {
    id: 'generic-json',
    name: '일반 JSON',
    service: 'generic',
    description: '자유 JSON payload. 임의의 외부 API 에 POST.',
    urlHint: 'https://your-api.example.com/webhook',
    method: 'POST',
    bodyTemplate: JSON.stringify(
      {
        event: 'balance_change',
        entity: '{{entityName}}',
        stat: '{{stat}}',
        before: '{{before}}',
        after: '{{after}}',
        reason: '{{reason}}',
        author: '{{userName}}',
        timestamp: '{{timestamp}}',
      },
      null,
      2
    ),
    variables: [
      { key: 'entityName', description: 'Entity 이름', example: 'Sword of Dawn' },
      { key: 'stat', description: 'Stat 이름', example: 'damage' },
      { key: 'before', description: '이전 값', example: '100' },
      { key: 'after', description: '변경 후 값', example: '120' },
      { key: 'reason', description: '변경 사유', example: '후반 긴장감 부족' },
      { key: 'userName', description: '작성자', example: 'beomsu' },
      { key: 'timestamp', description: 'ISO 8601', example: '2026-04-20T14:23:00Z' },
    ],
  },
];

/** 변수 치환 — {{key}} → values[key] */
export function renderWebhookBody(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = values[key];
    return v !== undefined ? String(v) : `{{${key}}}`;
  });
}

export function getPresetsByService(service: WebhookPreset['service']): WebhookPreset[] {
  return WEBHOOK_PRESETS.filter((p) => p.service === service);
}
