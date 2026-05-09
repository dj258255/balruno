/**
 * Tiny lexorank generator — base-26 lowercase strings whose
 * lexicographic order is the user-visible order. Used by the
 * project sidebar drag-drop reorder, paired with the V25
 * `projects.sort_key` column.
 *
 * Why hand-roll: real lexorank libs (Linear, AppFlowy) carry
 * rebalance machinery for trees that handle thousands of
 * inserts/sec. The sidebar list is per-workspace and tops out at
 * the per-plan project cap, so the simple "midpoint between two
 * keys" generator below is enough — collisions / runaway key
 * length only become a concern past a few thousand reorders, well
 * beyond what any single user produces.
 *
 * Alphabet: 'a'..'z'. Empty string is treated as "before 'a'" on
 * the left and "after 'z'" on the right when only one bound is
 * provided.
 *
 * Returned keys always match the regex /^[a-z]+$/ — same shape the
 * backend ProjectController.PositionRequest validates.
 */

const A = 'a'.charCodeAt(0); // 97
const Z = 'z'.charCodeAt(0); // 122

function code(ch: string | undefined, fallback: number): number {
  if (!ch) return fallback;
  const c = ch.charCodeAt(0);
  if (c < A || c > Z) return fallback;
  return c;
}

/**
 * Returns a key strictly between `a` and `b` in lexicographic order.
 * - midpoint(undefined, undefined) → 'm'  (middle of the alphabet)
 * - midpoint(undefined, 'd')       → 'b'  (between '' and 'd')
 * - midpoint('d', undefined)       → 'p'  (between 'd' and 'zz')
 * - midpoint('a', 'b')             → 'am' (extends one digit when
 *                                          neighbours are adjacent)
 *
 * `a` must compare strictly less than `b` when both are provided;
 * caller ensures that by passing the actual neighbouring keys from
 * the active sorted list.
 */
export function midpoint(a: string | undefined, b: string | undefined): string {
  let i = 0;
  let result = '';
  while (true) {
    const ca = code(a?.[i], A - 1); // '' → before 'a'
    const cb = code(b?.[i], Z + 1); // '' → after 'z'

    if (cb - ca > 1) {
      // Room for a midpoint character at this position.
      const mid = Math.floor((ca + cb) / 2);
      result += String.fromCharCode(mid);
      return result;
    }

    // ca + 1 === cb (or equal). Lock the current character to ca
    // (or the neutral 'a' baseline when ca is the synthetic floor)
    // and recurse one digit to the right.
    if (ca >= A) {
      result += String.fromCharCode(ca);
    } else {
      result += 'a';
    }
    i += 1;
    if (i > 64) {
      // Defence: should never hit this with sane neighbours, but
      // bail rather than spin forever if the caller passes
      // nonsense.
      throw new Error('lexorank midpoint exceeded 64 chars — neighbours might be equal');
    }
  }
}
