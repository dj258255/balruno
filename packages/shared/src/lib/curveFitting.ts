/**
 * Curve Fitting Library
 *
 * Provides various curve fitting algorithms for game balance design.
 * Allows users to draw points and fit mathematical formulas to them.
 */

export interface Point {
  x: number;
  y: number;
}

export interface FitResult {
  type: CurveType;
  equation: string;
  coefficients: number[];
  rSquared: number;
  predict: (x: number) => number;
}

export type CurveType =
  | 'linear'      // y = ax + b
  | 'quadratic'   // y = ax² + bx + c
  | 'cubic'       // y = ax³ + bx² + cx + d
  | 'power'       // y = ax^b
  | 'exponential' // y = a * e^(bx)
  | 'logarithmic' // y = a * ln(x) + b
  | 'sigmoid';    // y = L / (1 + e^(-k(x-x0)))

/**
 * Linear regression: y = ax + b
 */
function fitLinear(points: Point[]): FitResult {
  const n = points.length;
  if (n < 2) throw new Error('Need at least 2 points for linear fit');

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) {
    // Vertical line case - return best constant
    const a = 0;
    const b = sumY / n;
    return {
      type: 'linear',
      equation: `y = ${b.toFixed(4)}`,
      coefficients: [a, b],
      rSquared: 0,
      predict: () => b
    };
  }

  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  const predict = (x: number) => a * x + b;
  const rSquared = calculateRSquared(points, predict);

  return {
    type: 'linear',
    equation: `y = ${formatCoef(a)}x ${formatConstant(b)}`,
    coefficients: [a, b],
    rSquared,
    predict
  };
}

/**
 * Polynomial regression using normal equations
 */
function fitPolynomial(points: Point[], degree: number): FitResult {
  const n = points.length;
  if (n < degree + 1) throw new Error(`Need at least ${degree + 1} points for degree ${degree} polynomial`);

  // Build Vandermonde matrix
  const X: number[][] = [];
  const Y: number[] = [];

  for (const p of points) {
    const row: number[] = [];
    for (let j = 0; j <= degree; j++) {
      row.push(Math.pow(p.x, j));
    }
    X.push(row);
    Y.push(p.y);
  }

  // Solve using normal equations: (X^T * X) * β = X^T * Y
  const XtX = multiplyMatrixTranspose(X);
  const XtY = multiplyVectorTranspose(X, Y);
  const coefficients = solveLinearSystem(XtX, XtY);

  const predict = (x: number) => {
    let result = 0;
    for (let i = 0; i < coefficients.length; i++) {
      result += coefficients[i] * Math.pow(x, i);
    }
    return result;
  };

  const rSquared = calculateRSquared(points, predict);

  // Build equation string
  let equation = 'y = ';
  const terms: string[] = [];
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const c = coefficients[i];
    if (Math.abs(c) < 1e-10) continue;
    if (i === 0) {
      terms.push(formatCoef(c, terms.length === 0));
    } else if (i === 1) {
      terms.push(`${formatCoef(c, terms.length === 0)}x`);
    } else {
      terms.push(`${formatCoef(c, terms.length === 0)}x^${i}`);
    }
  }
  equation += terms.length > 0 ? terms.join(' ') : '0';

  const type = degree === 2 ? 'quadratic' : degree === 3 ? 'cubic' : 'linear';

  return {
    type,
    equation,
    coefficients,
    rSquared,
    predict
  };
}

/**
 * Power regression: y = a * x^b
 * Uses log transformation: ln(y) = ln(a) + b*ln(x)
 */
function fitPower(points: Point[]): FitResult {
  // Filter out non-positive values
  const validPoints = points.filter(p => p.x > 0 && p.y > 0);
  if (validPoints.length < 2) throw new Error('Need at least 2 positive points for power fit');

  // Transform to log space
  const logPoints = validPoints.map(p => ({
    x: Math.log(p.x),
    y: Math.log(p.y)
  }));

  const linearFit = fitLinear(logPoints);
  const b = linearFit.coefficients[0];
  const a = Math.exp(linearFit.coefficients[1]);

  const predict = (x: number) => a * Math.pow(x, b);
  const rSquared = calculateRSquared(validPoints, predict);

  return {
    type: 'power',
    equation: `y = ${a.toFixed(4)} * x^${b.toFixed(4)}`,
    coefficients: [a, b],
    rSquared,
    predict
  };
}

/**
 * Exponential regression: y = a * e^(bx)
 * Uses log transformation: ln(y) = ln(a) + bx
 */
function fitExponential(points: Point[]): FitResult {
  const validPoints = points.filter(p => p.y > 0);
  if (validPoints.length < 2) throw new Error('Need at least 2 points with positive y values for exponential fit');

  // Transform y to log space
  const logPoints = validPoints.map(p => ({
    x: p.x,
    y: Math.log(p.y)
  }));

  const linearFit = fitLinear(logPoints);
  const b = linearFit.coefficients[0];
  const a = Math.exp(linearFit.coefficients[1]);

  const predict = (x: number) => a * Math.exp(b * x);
  const rSquared = calculateRSquared(validPoints, predict);

  return {
    type: 'exponential',
    equation: `y = ${a.toFixed(4)} * e^(${b.toFixed(4)}x)`,
    coefficients: [a, b],
    rSquared,
    predict
  };
}

/**
 * Logarithmic regression: y = a * ln(x) + b
 */
function fitLogarithmic(points: Point[]): FitResult {
  const validPoints = points.filter(p => p.x > 0);
  if (validPoints.length < 2) throw new Error('Need at least 2 points with positive x values for logarithmic fit');

  // Transform x to log space
  const logPoints = validPoints.map(p => ({
    x: Math.log(p.x),
    y: p.y
  }));

  const linearFit = fitLinear(logPoints);
  const a = linearFit.coefficients[0];
  const b = linearFit.coefficients[1];

  const predict = (x: number) => a * Math.log(x) + b;
  const rSquared = calculateRSquared(validPoints, predict);

  return {
    type: 'logarithmic',
    equation: `y = ${a.toFixed(4)} * ln(x) ${formatConstant(b)}`,
    coefficients: [a, b],
    rSquared,
    predict
  };
}

/**
 * Sigmoid regression: y = L / (1 + e^(-k(x-x0)))
 * Uses iterative optimization
 */
function fitSigmoid(points: Point[]): FitResult {
  if (points.length < 3) throw new Error('Need at least 3 points for sigmoid fit');

  // Initial estimates
  const yValues = points.map(p => p.y);
  const L = Math.max(...yValues) * 1.1; // Upper asymptote
  const x0 = (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2;
  let k = 1; // Growth rate

  // Simple gradient descent optimization for k and x0
  let bestK = k;
  let bestX0 = x0;
  let bestError = Infinity;

  for (let i = 0; i < 100; i++) {
    for (const testK of [k * 0.9, k, k * 1.1]) {
      for (const testX0 of [x0 - 0.5, x0, x0 + 0.5]) {
        const error = points.reduce((sum, p) => {
          const predicted = L / (1 + Math.exp(-testK * (p.x - testX0)));
          return sum + Math.pow(p.y - predicted, 2);
        }, 0);

        if (error < bestError) {
          bestError = error;
          bestK = testK;
          bestX0 = testX0;
        }
      }
    }
    k = bestK;
  }

  const predict = (x: number) => L / (1 + Math.exp(-bestK * (x - bestX0)));
  const rSquared = calculateRSquared(points, predict);

  return {
    type: 'sigmoid',
    equation: `y = ${L.toFixed(2)} / (1 + e^(-${bestK.toFixed(4)}(x - ${bestX0.toFixed(2)})))`,
    coefficients: [L, bestK, bestX0],
    rSquared,
    predict
  };
}

/**
 * Fit all curve types and return sorted by R² (best fit first)
 */
export function fitAllCurves(points: Point[]): FitResult[] {
  const results: FitResult[] = [];

  try { results.push(fitLinear(points)); } catch { /* skip */ }
  try { results.push(fitPolynomial(points, 2)); } catch { /* skip */ }
  try { results.push(fitPolynomial(points, 3)); } catch { /* skip */ }
  try { results.push(fitPower(points)); } catch { /* skip */ }
  try { results.push(fitExponential(points)); } catch { /* skip */ }
  try { results.push(fitLogarithmic(points)); } catch { /* skip */ }
  try { results.push(fitSigmoid(points)); } catch { /* skip */ }

  // Sort by R² descending (best fit first)
  return results.sort((a, b) => b.rSquared - a.rSquared);
}

// Helper functions

function calculateRSquared(points: Point[], predict: (x: number) => number): number {
  const n = points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  let ssRes = 0; // Residual sum of squares
  let ssTot = 0; // Total sum of squares

  for (const p of points) {
    const predicted = predict(p.x);
    ssRes += Math.pow(p.y - predicted, 2);
    ssTot += Math.pow(p.y - meanY, 2);
  }

  if (ssTot === 0) return 1; // Perfect horizontal line
  return Math.max(0, 1 - ssRes / ssTot);
}

function formatCoef(c: number, isFirst: boolean = true): string {
  const absC = Math.abs(c);
  const sign = c >= 0 ? (isFirst ? '' : '+ ') : (isFirst ? '-' : '- ');

  if (Math.abs(absC - 1) < 1e-10) {
    return sign;
  }
  return `${sign}${absC.toFixed(4)}`;
}

function formatConstant(c: number): string {
  if (Math.abs(c) < 1e-10) return '';
  return c >= 0 ? `+ ${c.toFixed(4)}` : `- ${Math.abs(c).toFixed(4)}`;
}

function multiplyMatrixTranspose(A: number[][]): number[][] {
  const n = A[0].length;
  const result: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < A.length; k++) {
        result[i][j] += A[k][i] * A[k][j];
      }
    }
  }
  return result;
}

function multiplyVectorTranspose(A: number[][], y: number[]): number[] {
  const n = A[0].length;
  const result: number[] = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let k = 0; k < A.length; k++) {
      result[i] += A[k][i] * y[k];
    }
  }
  return result;
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const x: number[] = Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    x[row] = augmented[row][n];
    for (let col = row + 1; col < n; col++) {
      x[row] -= augmented[row][col] * x[col];
    }
    x[row] /= augmented[row][row];
  }

  return x;
}

/**
 * Generate formula code for game implementation
 */
export function generateFormulaCode(fit: FitResult, language: 'typescript' | 'csharp' | 'python' = 'typescript'): string {
  switch (language) {
    case 'typescript':
      return generateTypeScriptFormula(fit);
    case 'csharp':
      return generateCSharpFormula(fit);
    case 'python':
      return generatePythonFormula(fit);
  }
}

function generateTypeScriptFormula(fit: FitResult): string {
  const [a, b, c, d] = fit.coefficients;

  switch (fit.type) {
    case 'linear':
      return `function calculate(x: number): number {\n  return ${a} * x + ${b};\n}`;
    case 'quadratic':
      return `function calculate(x: number): number {\n  return ${fit.coefficients[2]} * x * x + ${fit.coefficients[1]} * x + ${fit.coefficients[0]};\n}`;
    case 'cubic':
      return `function calculate(x: number): number {\n  return ${fit.coefficients[3]} * x * x * x + ${fit.coefficients[2]} * x * x + ${fit.coefficients[1]} * x + ${fit.coefficients[0]};\n}`;
    case 'power':
      return `function calculate(x: number): number {\n  return ${a} * Math.pow(x, ${b});\n}`;
    case 'exponential':
      return `function calculate(x: number): number {\n  return ${a} * Math.exp(${b} * x);\n}`;
    case 'logarithmic':
      return `function calculate(x: number): number {\n  return ${a} * Math.log(x) + ${b};\n}`;
    case 'sigmoid':
      return `function calculate(x: number): number {\n  return ${a} / (1 + Math.exp(-${b} * (x - ${c})));\n}`;
    default:
      return '// Unknown formula type';
  }
}

function generateCSharpFormula(fit: FitResult): string {
  const [a, b, c, d] = fit.coefficients;

  switch (fit.type) {
    case 'linear':
      return `float Calculate(float x) {\n  return ${a}f * x + ${b}f;\n}`;
    case 'quadratic':
      return `float Calculate(float x) {\n  return ${fit.coefficients[2]}f * x * x + ${fit.coefficients[1]}f * x + ${fit.coefficients[0]}f;\n}`;
    case 'cubic':
      return `float Calculate(float x) {\n  return ${fit.coefficients[3]}f * x * x * x + ${fit.coefficients[2]}f * x * x + ${fit.coefficients[1]}f * x + ${fit.coefficients[0]}f;\n}`;
    case 'power':
      return `float Calculate(float x) {\n  return ${a}f * Mathf.Pow(x, ${b}f);\n}`;
    case 'exponential':
      return `float Calculate(float x) {\n  return ${a}f * Mathf.Exp(${b}f * x);\n}`;
    case 'logarithmic':
      return `float Calculate(float x) {\n  return ${a}f * Mathf.Log(x) + ${b}f;\n}`;
    case 'sigmoid':
      return `float Calculate(float x) {\n  return ${a}f / (1f + Mathf.Exp(-${b}f * (x - ${c}f)));\n}`;
    default:
      return '// Unknown formula type';
  }
}

function generatePythonFormula(fit: FitResult): string {
  const [a, b, c, d] = fit.coefficients;

  switch (fit.type) {
    case 'linear':
      return `def calculate(x):\n    return ${a} * x + ${b}`;
    case 'quadratic':
      return `def calculate(x):\n    return ${fit.coefficients[2]} * x ** 2 + ${fit.coefficients[1]} * x + ${fit.coefficients[0]}`;
    case 'cubic':
      return `def calculate(x):\n    return ${fit.coefficients[3]} * x ** 3 + ${fit.coefficients[2]} * x ** 2 + ${fit.coefficients[1]} * x + ${fit.coefficients[0]}`;
    case 'power':
      return `def calculate(x):\n    return ${a} * (x ** ${b})`;
    case 'exponential':
      return `import math\ndef calculate(x):\n    return ${a} * math.exp(${b} * x)`;
    case 'logarithmic':
      return `import math\ndef calculate(x):\n    return ${a} * math.log(x) + ${b}`;
    case 'sigmoid':
      return `import math\ndef calculate(x):\n    return ${a} / (1 + math.exp(-${b} * (x - ${c})))`;
    default:
      return '# Unknown formula type';
  }
}
