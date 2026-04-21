/**
 * 중복 프로젝트 감지 유틸 — 이름 + 구조 시그니처가 일치하는 프로젝트를 그룹화.
 *
 * 시그니처 기준:
 *   - 프로젝트 이름 (완전 일치)
 *   - 시트 개수
 *   - 첫 시트의 컬럼 이름 목록 (순서 포함)
 *
 * 과거 ID 충돌 마이그레이션 부산물이나 샘플 반복 생성 케이스를 감지.
 * 유지 규칙: 각 그룹에서 **updatedAt 이 가장 최근**인 것만 남기고 나머지 삭제 후보.
 */

import type { Project } from '@/types';

export interface DuplicateGroup {
  signature: string;
  name: string;
  /** 그룹 내 전체 프로젝트 (canonical + duplicates) */
  projects: Project[];
  /** 유지할 프로젝트 (updatedAt 최대) */
  canonical: Project;
  /** 삭제 후보 (canonical 외) */
  duplicates: Project[];
}

function computeSignature(project: Project): string {
  const firstSheet = project.sheets[0];
  const colNames = firstSheet?.columns.map((c) => c.name).join('|') ?? '';
  return `${project.name}::${project.sheets.length}::${colNames}`;
}

export function detectDuplicates(projects: Project[]): DuplicateGroup[] {
  const groups = new Map<string, Project[]>();
  for (const p of projects) {
    const sig = computeSignature(p);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(p);
  }

  const result: DuplicateGroup[] = [];
  groups.forEach((members, signature) => {
    if (members.length < 2) return;
    // 최신이 canonical
    const sorted = [...members].sort((a, b) => b.updatedAt - a.updatedAt);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);
    result.push({
      signature,
      name: canonical.name,
      projects: members,
      canonical,
      duplicates,
    });
  });

  // 중복 개수 많은 순으로 정렬
  return result.sort((a, b) => b.duplicates.length - a.duplicates.length);
}

export function totalDuplicateCount(groups: DuplicateGroup[]): number {
  return groups.reduce((sum, g) => sum + g.duplicates.length, 0);
}
