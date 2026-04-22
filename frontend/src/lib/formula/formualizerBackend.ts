/**
 * FormualizerBackend — Formualizer(Rust+WASM) 기반 백엔드.
 *
 * Formualizer: MIT OR Apache-2.0 — 상업 이용 가능.
 * 320+ Excel 함수 + VLOOKUP/XLOOKUP/FILTER/SUMIF/SORT/UNIQUE 등
 * dynamic arrays 지원. JS 콜백으로 커스텀 함수 등록 가능 (PowerBalance 게임 함수).
 *
 * 전략:
 *  1. 기존 `convertKoreanToScope` 로 우리 참조 문법을 평탄화 → `plainExpr` + `scope`
 *  2. scope 의 각 변수 값을 Workbook 의 'Config' 시트에 기록 (변수명 기반 셀)
 *  3. 평탄화된 수식의 변수 참조를 해당 셀 주소로 치환 (A1, A2, ...)
 *  4. Workbook.evaluateCell() 로 평가 후 결과 정규화
 *
 * 주의: WASM 초기화는 비동기지만 우리 `evaluate` 는 동기 인터페이스. 첫 호출 시
 * Promise 를 시작하고, WASM 준비 전에는 에러 반환 (mathjs 로 fallback 필요).
 * 실서비스에선 앱 부트에서 `initializeWasm()` 을 await 해서 문제 해결.
 */
import type { CellValue, FormulaResult } from '@/types';
import type { EvaluateContext, FormulaBackend } from './backend';
import { convertKoreanToScope } from '../formulaEngine';
import * as formualizer from 'formualizer';
import type { CellValue as FzCellValue } from 'formualizer';
import {
  SCALE, DAMAGE, DPS, TTK, EHP, DROP_RATE, GACHA_PITY, COST, WAVE_POWER,
  DIMINISHING, ELEMENT_MULT, STAMINA_REGEN, COMBO_MULT, STAR_RATING, TIER_INDEX,
  CLAMP, LERP, INVERSE_LERP, REMAP,
  CHANCE, EXPECTED_ATTEMPTS, COMPOUND,
  LTV, ARPU, ARPDAU, ARPPU, STICKINESS, RETENTION, CHURN_RATE, K_FACTOR,
  PAYBACK_PERIOD, CAC, ROAS, CONVERSION_RATE, WHALE_CURVE, FUNNEL_CONVERSION,
  ENGAGEMENT_SCORE, ELASTICITY, VIRALITY, MARGIN,
} from '@/lib/formulas';

type WorkbookInstance = InstanceType<typeof formualizer.Workbook>;

let _wb: WorkbookInstance | null = null;
let _ready = false;
let _initPromise: Promise<void> | null = null;

/** 게임 함수 등록 — Formualizer 는 JS 콜백 직접 사용, HF 보다 훨씬 단순. */
function registerGameFunctions(wb: WorkbookInstance): void {
  const reg = (name: string, fn: (...args: unknown[]) => unknown, opts?: { minArgs?: number; maxArgs?: number | null }) => {
    try {
      // CellValue 강제 캐스팅 — Formualizer 는 번호/문자/배열을 래핑해서 넘김
      wb.registerFunction(name, fn as unknown as (...a: FzCellValue[]) => FzCellValue, {
        minArgs: opts?.minArgs,
        maxArgs: opts?.maxArgs ?? null,
        deterministic: true,
        threadSafe: true,
      });
    } catch (e) {
      // 재등록 시 충돌은 무시 (HMR)
      if (!String(e).toLowerCase().includes('already')) throw e;
    }
  };

  reg('SCALE', (base, level, rate, curve, max, mid) =>
    SCALE(Number(base), Number(level), Number(rate),
      curve ? String(curve) : 'linear',
      (max !== undefined || mid !== undefined)
        ? { max: max !== undefined ? Number(max) : undefined, mid: mid !== undefined ? Number(mid) : undefined }
        : undefined,
    ), { minArgs: 3, maxArgs: 6 });
  reg('DAMAGE', (atk, def, mult) =>
    DAMAGE(Number(atk), Number(def), mult !== undefined ? Number(mult) : 1),
    { minArgs: 2, maxArgs: 3 });
  reg('DPS', (dmg, atkSpd, crit, critDmg) =>
    DPS(Number(dmg), Number(atkSpd),
      crit !== undefined ? Number(crit) : 0,
      critDmg !== undefined ? Number(critDmg) : 2),
    { minArgs: 2, maxArgs: 4 });
  reg('TTK', (hp, dmg, atkSpd) => TTK(Number(hp), Number(dmg), Number(atkSpd)), { minArgs: 3, maxArgs: 3 });
  reg('EHP', (hp, def, dr) => EHP(Number(hp), Number(def), dr !== undefined ? Number(dr) : 0), { minArgs: 2, maxArgs: 3 });
  reg('WAVE_POWER', (bp, w, r) => WAVE_POWER(Number(bp), Number(w), r !== undefined ? Number(r) : 1.1), { minArgs: 2, maxArgs: 3 });
  reg('DROP_RATE', (br, luck, lvlDiff) =>
    DROP_RATE(Number(br),
      luck !== undefined ? Number(luck) : 0,
      lvlDiff !== undefined ? Number(lvlDiff) : 0),
    { minArgs: 1, maxArgs: 3 });
  reg('GACHA_PITY', (br, pull, soft, hard) =>
    GACHA_PITY(Number(br), Number(pull),
      soft !== undefined ? Number(soft) : 74,
      hard !== undefined ? Number(hard) : 90),
    { minArgs: 2, maxArgs: 4 });
  reg('COST', (bc, lvl, r, curve) =>
    COST(Number(bc), Number(lvl),
      r !== undefined ? Number(r) : 1.5,
      curve ? String(curve) : 'exponential'),
    { minArgs: 2, maxArgs: 4 });
  reg('DIMINISHING', (base, input, soft, hard) =>
    DIMINISHING(Number(base), Number(input), Number(soft),
      hard !== undefined ? Number(hard) : Number.POSITIVE_INFINITY),
    { minArgs: 3, maxArgs: 4 });
  reg('ELEMENT_MULT', (ae, de, s, w) =>
    ELEMENT_MULT(Number(ae), Number(de),
      s !== undefined ? Number(s) : 1.5,
      w !== undefined ? Number(w) : 0.5),
    { minArgs: 2, maxArgs: 4 });
  reg('STAMINA_REGEN', (maxS, rt, el) => STAMINA_REGEN(Number(maxS), Number(rt), Number(el)), { minArgs: 3, maxArgs: 3 });
  reg('COMBO_MULT', (c, bm, pb, mb) =>
    COMBO_MULT(Number(c),
      bm !== undefined ? Number(bm) : 1,
      pb !== undefined ? Number(pb) : 0.1,
      mb !== undefined ? Number(mb) : 2.0),
    { minArgs: 1, maxArgs: 4 });
  reg('STAR_RATING', (v, maxV, maxS) =>
    STAR_RATING(Number(v), Number(maxV), maxS !== undefined ? Number(maxS) : 5),
    { minArgs: 2, maxArgs: 3 });
  reg('TIER_INDEX', (value, ...thresholds) =>
    TIER_INDEX(Number(value), ...thresholds.map(Number)),
    { minArgs: 1 });
  reg('CLAMP', (v, mn, mx) => CLAMP(Number(v), Number(mn), Number(mx)), { minArgs: 3, maxArgs: 3 });
  reg('LERP', (a, b, t) => LERP(Number(a), Number(b), Number(t)), { minArgs: 3, maxArgs: 3 });
  reg('INVERSE_LERP', (a, b, v) => INVERSE_LERP(Number(a), Number(b), Number(v)), { minArgs: 3, maxArgs: 3 });
  reg('REMAP', (v, i1, i2, o1, o2) =>
    REMAP(Number(v), Number(i1), Number(i2), Number(o1), Number(o2)),
    { minArgs: 5, maxArgs: 5 });
  reg('CHANCE', (p, n) => CHANCE(Number(p), Number(n)), { minArgs: 2, maxArgs: 2 });
  reg('EXPECTED_ATTEMPTS', (p) => EXPECTED_ATTEMPTS(Number(p)), { minArgs: 1, maxArgs: 1 });
  reg('COMPOUND', (p, r, periods) => COMPOUND(Number(p), Number(r), Number(periods)), { minArgs: 3, maxArgs: 3 });
  // F2P economy — 각 함수의 실제 시그니처에 맞게 래핑
  reg('LTV', (arpdau, churn) => LTV(Number(arpdau), Number(churn)), { minArgs: 2, maxArgs: 2 });
  reg('ARPU', (rev, users) => ARPU(Number(rev), Number(users)), { minArgs: 2, maxArgs: 2 });
  reg('ARPDAU', (dailyRev, dau) => ARPDAU(Number(dailyRev), Number(dau)), { minArgs: 2, maxArgs: 2 });
  reg('ARPPU', (rev, payers) => ARPPU(Number(rev), Number(payers)), { minArgs: 2, maxArgs: 2 });
  reg('STICKINESS', (dau, mau) => STICKINESS(Number(dau), Number(mau)), { minArgs: 2, maxArgs: 2 });
  reg('RETENTION', (d1, n, lambda) =>
    RETENTION(Number(d1), Number(n), lambda !== undefined ? Number(lambda) : 0.05),
    { minArgs: 2, maxArgs: 3 });
  reg('CHURN_RATE', (ret) => CHURN_RATE(Number(ret)), { minArgs: 1, maxArgs: 1 });
  reg('K_FACTOR', (inv, conv) => K_FACTOR(Number(inv), Number(conv)), { minArgs: 2, maxArgs: 2 });
  reg('PAYBACK_PERIOD', (cac, arpdau) => PAYBACK_PERIOD(Number(cac), Number(arpdau)), { minArgs: 2, maxArgs: 2 });
  reg('CAC', (spend, users) => CAC(Number(spend), Number(users)), { minArgs: 2, maxArgs: 2 });
  reg('ROAS', (rev, spend) => ROAS(Number(rev), Number(spend)), { minArgs: 2, maxArgs: 2 });
  reg('CONVERSION_RATE', (conv, total) => CONVERSION_RATE(Number(conv), Number(total)), { minArgs: 2, maxArgs: 2 });
  reg('WHALE_CURVE', (pct, topPct, share) =>
    WHALE_CURVE(Number(pct),
      topPct !== undefined ? Number(topPct) : 0.1,
      share !== undefined ? Number(share) : 0.5),
    { minArgs: 1, maxArgs: 3 });
  reg('FUNNEL_CONVERSION', (...rates) => FUNNEL_CONVERSION(...rates.map(Number)), { minArgs: 1 });
  reg('ENGAGEMENT_SCORE', (sm, spd, depth, maxSm, maxSpd, maxD) =>
    ENGAGEMENT_SCORE(Number(sm), Number(spd), Number(depth),
      maxSm !== undefined ? Number(maxSm) : 60,
      maxSpd !== undefined ? Number(maxSpd) : 10,
      maxD !== undefined ? Number(maxD) : 10),
    { minArgs: 3, maxArgs: 6 });
  reg('ELASTICITY', (q1, q2, p1, p2) =>
    ELASTICITY(Number(q1), Number(q2), Number(p1), Number(p2)),
    { minArgs: 4, maxArgs: 4 });
  reg('VIRALITY', (seed, k, gen) => VIRALITY(Number(seed), Number(k), Number(gen)), { minArgs: 3, maxArgs: 3 });
  reg('MARGIN', (rev, cost) => MARGIN(Number(rev), Number(cost)), { minArgs: 2, maxArgs: 2 });
}

/**
 * WASM 준비 + Workbook 싱글톤 생성. 첫 호출은 async.
 * 앱 부트 또는 시트 마운트 시 `await initFormualizer()` 로 미리 호출 권장.
 */
export async function initFormualizer(): Promise<void> {
  if (_ready) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    await formualizer.initializeWasm();
    const wb = new formualizer.Workbook();
    wb.addSheet('Main');
    wb.addSheet('Scope');
    registerGameFunctions(wb);
    _wb = wb;
    _ready = true;
  })();
  return _initPromise;
}

export function isFormualizerReady(): boolean {
  return _ready;
}

/**
 * 셀 A1 좌표 생성. col: 0=A, 1=B, ... 26=AA
 */
function colToLetters(col: number): string {
  let s = '';
  let n = col;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function toCellValue(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') {
    const obj = v as { error?: string; type?: string; message?: string };
    if (obj.error) return `#${obj.error}!`;
    if (obj.type && obj.message) return `#${obj.type}!`;
  }
  return String(v);
}

function isFormualizerError(v: unknown): string | null {
  if (typeof v === 'object' && v !== null) {
    const obj = v as { error?: string; type?: string; message?: string };
    if (obj.error) return obj.error;
    if (obj.type && obj.message) return `${obj.type}: ${obj.message}`;
  }
  return null;
}

export const formualizerBackend: FormulaBackend = {
  name: 'formualizer',

  evaluate(formula: string, context: EvaluateContext): FormulaResult {
    if (!_ready || !_wb) {
      return { value: null, error: 'Formualizer 엔진이 아직 초기화되지 않음 (initFormualizer 호출 필요)' };
    }
    try {
      const wb = _wb;
      const expression = formula.startsWith('=') ? formula.slice(1) : formula;

      // 우리 참조 문법 평탄화
      const { expression: flat, scope, errors, warnings } = convertKoreanToScope(
        expression,
        context.currentSheet.columns,
        context.currentRow,
        context,
        context._recursionDepth ?? 0,
      );
      if (errors.length > 0) {
        return { value: null, error: errors[0], warnings: warnings.length ? warnings : undefined };
      }

      // scope 의 변수를 Scope 시트 셀에 기록. 변수명 → 셀주소 매핑 생성.
      // Formualizer 는 row/col 이 1-based — 행 1 (A1, B1, C1, ...) 에 각 변수 저장.
      const varToCell = new Map<string, string>();
      let col = 0;
      for (const [name, value] of Object.entries(scope)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
        const addr = `${colToLetters(col)}1`;
        const normalized = value === null || value === undefined ? 0 : value;
        wb.setValue('Scope', 1, col + 1, normalized);
        varToCell.set(name, `Scope!${addr}`);
        col++;
      }

      // 평탄화된 수식에서 변수명을 셀 주소로 치환.
      const names = Array.from(varToCell.keys()).sort((a, b) => b.length - a.length);
      let resolvedFormula = flat;
      for (const n of names) {
        const addr = varToCell.get(n)!;
        resolvedFormula = resolvedFormula.replace(new RegExp(`\\b${n}\\b`, 'g'), addr);
      }

      // 결과 셀은 Main!A1 (1-based 1,1) 로 고정
      wb.setFormula('Main', 1, 1, `=${resolvedFormula}`);
      const result = wb.evaluateCell('Main', 1, 1);

      const errMsg = isFormualizerError(result);
      if (errMsg) {
        return { value: null, error: errMsg, warnings: warnings.length ? warnings : undefined };
      }

      return {
        value: toCellValue(result),
        warnings: warnings.length ? warnings : undefined,
      };
    } catch (e) {
      return { value: null, error: e instanceof Error ? e.message : String(e) };
    }
  },

  validate(formula: string) {
    try {
      const expression = formula.startsWith('=') ? formula.slice(1) : formula;
      // WASM 준비 전에도 파서는 동기로 쓸 수 있음
      new formualizer.Parser(expression).parse();
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
