'use client';

/**
 * GlobalRecordDetail — 어느 뷰에서든 열 수 있는 전역 레코드 상세 슬라이드 패널.
 *
 * 앱 루트 (page.tsx) 에 한 번만 mount. recordDetailStore 의 opened 가 설정되면
 * 해당 row 를 찾아 RecordEditor 로 렌더.
 *
 * 주: 기존 5 개 뷰 (Kanban/Calendar/Form/Gantt/Gallery) 의 로컬 RecordEditor 는
 * 유지되므로 두 기둥 공존. 한 화면에 동시에 두 패널이 뜨지 않게 하려면 각 뷰가
 * 자체 로컬 state 만 쓰면 되고, 이 전역 패널은 그리드 뷰 전용으로 트리거됨.
 */

import { useRecordDetail } from '@/stores/recordDetailStore';
import { useProjectStore } from '@/stores/projectStore';
import RecordEditor from '@/components/views/RecordEditor';

export function GlobalRecordDetail() {
  const opened = useRecordDetail((s) => s.opened);
  const closeRecord = useRecordDetail((s) => s.closeRecord);
  const projects = useProjectStore((s) => s.projects);

  if (!opened) return null;

  const project = projects.find((p) => p.id === opened.projectId);
  const sheet = project?.sheets.find((s) => s.id === opened.sheetId);
  const row = sheet?.rows.find((r) => r.id === opened.rowId);

  if (!project || !sheet || !row) {
    // 행이 삭제됐거나 시트 전환으로 유효하지 않음 — 조용히 닫음
    queueMicrotask(() => closeRecord());
    return null;
  }

  return (
    <RecordEditor
      projectId={project.id}
      sheet={sheet}
      row={row}
      onClose={closeRecord}
    />
  );
}
