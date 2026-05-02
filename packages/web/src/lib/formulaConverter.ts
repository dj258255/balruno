/**
 * Excel 수식 → Balruno 수식 변환기 (경량).
 *
 * 사용: CellEditor / FormulaBar 가 paste 이벤트 가로채서 호출.
 * 제약: A1 / $A$1 참조는 시트 헤더 매핑 필요 — dialog 에서 별도 처리.
 *       여기선 단순한 변환만 (= 접두사 제거, 함수 대소문자 정규화 등).
 */

export interface FormulaConversionResult {
  converted: string;
  warnings: string[];
  hasExcelA1: boolean;
}

/**
 * Excel 수식처럼 보이는지 감지 — `=` 로 시작하거나 A1 형식 참조 포함.
 */
export function looksLikeExcel(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('=')) return true;
  // $A$1 또는 A1:A10 패턴
  if (/\$?[A-Z]{1,3}\$?\d+/.test(t)) return true;
  return false;
}

/**
 * Excel → Balruno 기본 변환.
 *  - 선행 `=` 제거
 *  - 함수명 대문자 정규화 (소문자로 쓴 sum → SUM)
 *  - 세미콜론 argument 구분자 → 쉼표 (유럽 locale 대응)
 *  - A1 / $A$1 / A1:A10 참조는 경고만 남기고 원문 보존 (수동 매핑 필요)
 */
export function convertExcelToBalruno(formula: string): FormulaConversionResult {
  const warnings: string[] = [];
  let text = formula.trim();

  // 1. = 접두사 제거
  if (text.startsWith('=')) text = text.slice(1).trim();

  // 2. 세미콜론 구분자 → 쉼표 (문자열 리터럴 내부는 제외)
  // 간단 구현: 문자열 밖에서만 치환
  let out = '';
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '"' || ch === "'") && (i === 0 || text[i - 1] !== '\\')) {
      if (!inString) { inString = true; stringChar = ch; }
      else if (ch === stringChar) { inString = false; }
    }
    out += inString ? ch : (ch === ';' ? ',' : ch);
  }
  text = out;

  // 3. 함수명 대문자 정규화 — 소문자/혼합 sum() → SUM()
  text = text.replace(/\b([a-z][a-zA-Z_0-9]{1,19})\s*\(/g, (m, fname) => {
    return fname.toUpperCase() + '(';
  });

  // 4. A1 / $A$1 참조 감지 (변환은 안 함 — 경고만)
  const a1Matches = text.match(/\$?[A-Z]{1,3}\$?\d+(\s*:\s*\$?[A-Z]{1,3}\$?\d+)?/g);
  const hasExcelA1 = (a1Matches?.length ?? 0) > 0;
  if (hasExcelA1) {
    warnings.push(
      `Excel A1 형식 참조 ${a1Matches!.length}개 감지 — 수동으로 컬럼명으로 바꿔주세요 (예: $B$2 → BASE_HP)`,
    );
  }

  return { converted: text, warnings, hasExcelA1 };
}
