/**
 * CellRange - 셀 범위 관리 클래스
 *
 * x-spreadsheet의 cell_range.js 패턴 참고:
 * https://github.com/myliang/x-spreadsheet/blob/master/src/core/cell_range.js
 *
 * 범위는 사각형 좌표 (sri, sci, eri, eci)로 표현
 * - sri: start row index
 * - sci: start column index
 * - eri: end row index
 * - eci: end column index
 */

export class CellRange {
  sri: number; // start row index
  sci: number; // start column index
  eri: number; // end row index
  eci: number; // end column index

  constructor(sri: number, sci: number, eri: number, eci: number) {
    this.sri = sri;
    this.sci = sci;
    this.eri = eri;
    this.eci = eci;
  }

  /**
   * 범위 설정
   */
  set(sri: number, sci: number, eri: number, eci: number): this {
    this.sri = sri;
    this.sci = sci;
    this.eri = eri;
    this.eci = eci;
    return this;
  }

  /**
   * 다중 셀 선택인지 확인
   */
  multiple(): boolean {
    return this.eri - this.sri > 0 || this.eci - this.sci > 0;
  }

  /**
   * 특정 좌표가 범위 내에 있는지 확인
   */
  includes(ri: number, ci: number): boolean {
    return ri >= this.sri && ri <= this.eri && ci >= this.sci && ci <= this.eci;
  }

  /**
   * 특정 행이 범위 내에 있는지 확인
   */
  includesRow(ri: number): boolean {
    return ri >= this.sri && ri <= this.eri;
  }

  /**
   * 특정 열이 범위 내에 있는지 확인
   */
  includesCol(ci: number): boolean {
    return ci >= this.sci && ci <= this.eci;
  }

  /**
   * 범위 내 모든 셀 순회
   */
  each(cb: (ri: number, ci: number) => void, rowFilter?: (ri: number) => boolean): void {
    for (let ri = this.sri; ri <= this.eri; ri++) {
      if (rowFilter && !rowFilter(ri)) continue;
      for (let ci = this.sci; ci <= this.eci; ci++) {
        cb(ri, ci);
      }
    }
  }

  /**
   * 다른 범위를 포함하는지 확인
   */
  contains(other: CellRange): boolean {
    return (
      this.sri <= other.sri &&
      this.sci <= other.sci &&
      this.eri >= other.eri &&
      this.eci >= other.eci
    );
  }

  /**
   * 다른 범위 내에 있는지 확인
   */
  within(other: CellRange): boolean {
    return other.contains(this);
  }

  /**
   * 다른 범위와 교차하는지 확인
   */
  intersects(other: CellRange): boolean {
    return (
      this.sri <= other.eri &&
      this.eri >= other.sri &&
      this.sci <= other.eci &&
      this.eci >= other.sci
    );
  }

  /**
   * 다른 범위와 겹치지 않는지 확인
   */
  disjoint(other: CellRange): boolean {
    return !this.intersects(other);
  }

  /**
   * 두 범위의 합집합 (최소 사각형)
   */
  union(other: CellRange): CellRange {
    return new CellRange(
      Math.min(this.sri, other.sri),
      Math.min(this.sci, other.sci),
      Math.max(this.eri, other.eri),
      Math.max(this.eci, other.eci)
    );
  }

  /**
   * 두 범위의 교집합
   */
  intersection(other: CellRange): CellRange | null {
    if (this.disjoint(other)) return null;
    return new CellRange(
      Math.max(this.sri, other.sri),
      Math.max(this.sci, other.sci),
      Math.min(this.eri, other.eri),
      Math.min(this.eci, other.eci)
    );
  }

  /**
   * 행 개수
   */
  get rows(): number {
    return this.eri - this.sri + 1;
  }

  /**
   * 열 개수
   */
  get cols(): number {
    return this.eci - this.sci + 1;
  }

  /**
   * 전체 셀 개수
   */
  get size(): number {
    return this.rows * this.cols;
  }

  /**
   * 범위 복사
   */
  clone(): CellRange {
    return new CellRange(this.sri, this.sci, this.eri, this.eci);
  }

  /**
   * 다른 범위와 같은지 확인
   */
  equals(other: CellRange): boolean {
    return (
      this.sri === other.sri &&
      this.sci === other.sci &&
      this.eri === other.eri &&
      this.eci === other.eci
    );
  }

  /**
   * A1 표기법으로 변환 (예: "A1:B3")
   */
  toString(): string {
    const startCol = numberToColumnLetter(this.sci);
    const endCol = numberToColumnLetter(this.eci);
    if (this.sri === this.eri && this.sci === this.eci) {
      return `${startCol}${this.sri + 1}`;
    }
    return `${startCol}${this.sri + 1}:${endCol}${this.eri + 1}`;
  }

  /**
   * 범위를 정규화 (시작이 끝보다 작도록)
   */
  normalize(): CellRange {
    return new CellRange(
      Math.min(this.sri, this.eri),
      Math.min(this.sci, this.eci),
      Math.max(this.sri, this.eri),
      Math.max(this.sci, this.eci)
    );
  }

  /**
   * 범위 이동
   */
  translate(rowOffset: number, colOffset: number): CellRange {
    return new CellRange(
      this.sri + rowOffset,
      this.sci + colOffset,
      this.eri + rowOffset,
      this.eci + colOffset
    );
  }

  /**
   * 단일 셀 범위 생성
   */
  static single(ri: number, ci: number): CellRange {
    return new CellRange(ri, ci, ri, ci);
  }

  /**
   * 두 좌표로 범위 생성 (자동 정규화)
   */
  static fromPoints(
    ri1: number,
    ci1: number,
    ri2: number,
    ci2: number
  ): CellRange {
    return new CellRange(
      Math.min(ri1, ri2),
      Math.min(ci1, ci2),
      Math.max(ri1, ri2),
      Math.max(ci1, ci2)
    );
  }
}

/**
 * 숫자를 엑셀 열 문자로 변환 (0 -> A, 25 -> Z, 26 -> AA)
 */
function numberToColumnLetter(num: number): string {
  let result = '';
  let n = num;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Selector - 셀 선택 관리 클래스
 *
 * x-spreadsheet의 selector.js 패턴 참고:
 * https://github.com/myliang/x-spreadsheet/blob/master/src/core/selector.js
 */
export class Selector {
  range: CellRange;
  ri: number; // 현재 행 인덱스 (앵커)
  ci: number; // 현재 열 인덱스 (앵커)

  constructor(ri = 0, ci = 0) {
    this.ri = ri;
    this.ci = ci;
    this.range = CellRange.single(ri, ci);
  }

  /**
   * 다중 선택인지 확인
   */
  multiple(): boolean {
    return this.range.multiple();
  }

  /**
   * 단일 셀 선택
   */
  set(ri: number, ci: number): void {
    this.ri = ri;
    this.ci = ci;
    this.range.set(ri, ci, ri, ci);
  }

  /**
   * 범위로 확장 (Shift+클릭, 드래그)
   */
  setEnd(ri: number, ci: number): void {
    this.range = CellRange.fromPoints(this.ri, this.ci, ri, ci);
  }

  /**
   * 특정 좌표가 선택 범위 내에 있는지 확인
   */
  includes(ri: number, ci: number): boolean {
    return this.range.includes(ri, ci);
  }

  /**
   * 선택 범위 내 모든 셀 순회
   */
  each(cb: (ri: number, ci: number) => void): void {
    this.range.each(cb);
  }

  /**
   * 범위 복사
   */
  clone(): Selector {
    const s = new Selector(this.ri, this.ci);
    s.range = this.range.clone();
    return s;
  }
}

export default CellRange;
