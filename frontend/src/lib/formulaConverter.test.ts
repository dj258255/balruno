import { describe, it, expect } from 'vitest';
import { convertExcelToBalruno, looksLikeExcel } from './formulaConverter';

describe('looksLikeExcel', () => {
  it('= 접두사 감지', () => {
    expect(looksLikeExcel('=SUM(A1:A10)')).toBe(true);
  });
  it('A1 패턴 감지', () => {
    expect(looksLikeExcel('$A$1 + B2')).toBe(true);
  });
  it('일반 수식은 false', () => {
    expect(looksLikeExcel('HP * 0.5')).toBe(false);
  });
});

describe('convertExcelToBalruno', () => {
  it('= 접두사 제거', () => {
    const r = convertExcelToBalruno('=SUM(10, 20)');
    expect(r.converted).toBe('SUM(10, 20)');
  });

  it('소문자 함수명 대문자화', () => {
    const r = convertExcelToBalruno('=sum(10, 20) + avg(1,2)');
    expect(r.converted).toContain('SUM(');
    expect(r.converted).toContain('AVG(');
  });

  it('세미콜론 argument 구분자 → 쉼표', () => {
    const r = convertExcelToBalruno('=SUM(1; 2; 3)');
    expect(r.converted).toBe('SUM(1, 2, 3)');
  });

  it('문자열 리터럴 내부 세미콜론은 보존', () => {
    const r = convertExcelToBalruno('=CONCAT("a;b;c"; "d")');
    expect(r.converted).toContain('"a;b;c"');
    expect(r.converted).toContain(', "d"');
  });

  it('A1 참조 감지 시 경고', () => {
    const r = convertExcelToBalruno('=A1 + $B$2');
    expect(r.hasExcelA1).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toContain('Excel A1');
  });

  it('A1 없으면 경고 없음', () => {
    const r = convertExcelToBalruno('=SUM(10, 20)');
    expect(r.hasExcelA1).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('= 없어도 동작 (paste 중간에 = 없는 수식)', () => {
    const r = convertExcelToBalruno('sum(1, 2)');
    expect(r.converted).toBe('SUM(1, 2)');
  });
});
