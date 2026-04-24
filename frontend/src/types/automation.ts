/**
 * Automations (n8n-style 노드 에디터) 타입 정의.
 *
 * Scaffold only — 런타임 엔진 / 노드 그래프 에디터 / 실행 로그 UI 는 다음 세션.
 */

export type TriggerType =
  | 'field-updated'
  | 'record-created'
  | 'record-matches'
  | 'scheduled'
  | 'button'
  | 'webhook';

export type ActionType =
  | 'update-field'
  | 'create-record'
  | 'delete-record'
  | 'send-notification'
  | 'run-formula'
  | 'trigger-automation'
  | 'external-api';

export interface Trigger {
  id: string;
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface Condition {
  /** AND / OR 트리 — MVP 에서는 단일 expression */
  expression: string;
}

export interface Action {
  id: string;
  type: ActionType;
  config: Record<string, unknown>;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunStatus?: 'success' | 'failed';
}
