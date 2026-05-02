/**
 * DPS Variance Simulator
 * Monte Carlo simulation for DPS distribution analysis
 *
 * Reference: Industry-standard approach from game analytics and theoretical game design
 * - Uses Monte Carlo method to simulate multiple attack iterations
 * - Analyzes variance, standard deviation, and percentile distributions
 */

export interface DPSSimulationConfig {
  baseDamage: number;
  attackSpeed: number; // attacks per second
  critRate: number; // 0-100
  critDamage: number; // multiplier (e.g., 2.0 for 200%)
  iterations: number; // number of simulation runs
  duration: number; // simulation duration in seconds
  damageVariance?: number; // optional damage variance (0-100%)
}

export interface SimulationResult {
  dps: number;
  totalDamage: number;
  attacks: number;
  crits: number;
  criticalRate: number;
}

export interface DPSDistribution {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  variance: number;
  coefficientOfVariation: number; // CV = stdDev / mean
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  histogram: HistogramBin[];
  rawResults: SimulationResult[];
}

export interface HistogramBin {
  min: number;
  max: number;
  count: number;
  percentage: number;
  label: string;
}

/**
 * Run a single DPS simulation iteration
 */
function runSingleSimulation(config: DPSSimulationConfig): SimulationResult {
  const { baseDamage, attackSpeed, critRate, critDamage, duration, damageVariance = 0 } = config;

  let totalDamage = 0;
  let crits = 0;
  const attacks = Math.floor(attackSpeed * duration);

  for (let i = 0; i < attacks; i++) {
    // Apply damage variance if specified
    let damage = baseDamage;
    if (damageVariance > 0) {
      const varianceFactor = 1 + (Math.random() * 2 - 1) * (damageVariance / 100);
      damage = baseDamage * varianceFactor;
    }

    // Check for critical hit
    const isCrit = Math.random() * 100 < critRate;
    if (isCrit) {
      damage *= critDamage;
      crits++;
    }

    totalDamage += damage;
  }

  return {
    dps: totalDamage / duration,
    totalDamage,
    attacks,
    crits,
    criticalRate: attacks > 0 ? (crits / attacks) * 100 : 0,
  };
}

/**
 * Calculate percentile value from sorted array
 */
function getPercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Generate histogram bins from DPS values
 */
function generateHistogram(values: number[], binCount: number = 20): HistogramBin[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const binWidth = range / binCount || 1;

  const bins: HistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const binMin = min + i * binWidth;
    const binMax = min + (i + 1) * binWidth;
    bins.push({
      min: binMin,
      max: binMax,
      count: 0,
      percentage: 0,
      label: `${binMin.toFixed(0)}-${binMax.toFixed(0)}`,
    });
  }

  // Count values in each bin
  values.forEach(value => {
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );
    if (binIndex >= 0 && binIndex < bins.length) {
      bins[binIndex].count++;
    }
  });

  // Calculate percentages
  const total = values.length;
  bins.forEach(bin => {
    bin.percentage = (bin.count / total) * 100;
  });

  return bins;
}

/**
 * Run Monte Carlo DPS simulation
 * @param config Simulation configuration
 * @returns DPS distribution analysis results
 */
export function simulateDPSVariance(config: DPSSimulationConfig): DPSDistribution {
  const { iterations } = config;

  // Run all simulations
  const results: SimulationResult[] = [];
  for (let i = 0; i < iterations; i++) {
    results.push(runSingleSimulation(config));
  }

  // Extract DPS values
  const dpsValues = results.map(r => r.dps);
  const sortedDPS = [...dpsValues].sort((a, b) => a - b);

  // Calculate statistics
  const sum = dpsValues.reduce((a, b) => a + b, 0);
  const mean = sum / dpsValues.length;

  const squaredDiffs = dpsValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / dpsValues.length;
  const stdDev = Math.sqrt(variance);

  const min = sortedDPS[0];
  const max = sortedDPS[sortedDPS.length - 1];
  const median = getPercentile(sortedDPS, 50);

  return {
    mean,
    median,
    min,
    max,
    stdDev,
    variance,
    coefficientOfVariation: mean > 0 ? (stdDev / mean) * 100 : 0,
    percentiles: {
      p5: getPercentile(sortedDPS, 5),
      p10: getPercentile(sortedDPS, 10),
      p25: getPercentile(sortedDPS, 25),
      p50: median,
      p75: getPercentile(sortedDPS, 75),
      p90: getPercentile(sortedDPS, 90),
      p95: getPercentile(sortedDPS, 95),
    },
    histogram: generateHistogram(dpsValues),
    rawResults: results,
  };
}

/**
 * Analyze TTK (Time To Kill) variance
 */
export interface TTKConfig {
  targetHP: number;
  baseDamage: number;
  attackSpeed: number;
  critRate: number;
  critDamage: number;
  damageVariance?: number;
  iterations: number;
}

export interface TTKResult {
  ttk: number;
  attacks: number;
  crits: number;
}

export interface TTKDistribution {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  histogram: HistogramBin[];
  rawResults: TTKResult[];
}

function runSingleTTKSimulation(config: TTKConfig): TTKResult {
  const { targetHP, baseDamage, attackSpeed, critRate, critDamage, damageVariance = 0 } = config;

  let remainingHP = targetHP;
  let attacks = 0;
  let crits = 0;

  while (remainingHP > 0) {
    attacks++;

    let damage = baseDamage;
    if (damageVariance > 0) {
      const varianceFactor = 1 + (Math.random() * 2 - 1) * (damageVariance / 100);
      damage = baseDamage * varianceFactor;
    }

    const isCrit = Math.random() * 100 < critRate;
    if (isCrit) {
      damage *= critDamage;
      crits++;
    }

    remainingHP -= damage;
  }

  const ttk = attacks / attackSpeed;

  return { ttk, attacks, crits };
}

export function simulateTTKVariance(config: TTKConfig): TTKDistribution {
  const results: TTKResult[] = [];

  for (let i = 0; i < config.iterations; i++) {
    results.push(runSingleTTKSimulation(config));
  }

  const ttkValues = results.map(r => r.ttk);
  const sortedTTK = [...ttkValues].sort((a, b) => a - b);

  const sum = ttkValues.reduce((a, b) => a + b, 0);
  const mean = sum / ttkValues.length;

  const squaredDiffs = ttkValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / ttkValues.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median: getPercentile(sortedTTK, 50),
    min: sortedTTK[0],
    max: sortedTTK[sortedTTK.length - 1],
    stdDev,
    percentiles: {
      p5: getPercentile(sortedTTK, 5),
      p25: getPercentile(sortedTTK, 25),
      p50: getPercentile(sortedTTK, 50),
      p75: getPercentile(sortedTTK, 75),
      p95: getPercentile(sortedTTK, 95),
    },
    histogram: generateHistogram(ttkValues),
    rawResults: results,
  };
}

/**
 * Compare two builds and calculate win rates
 */
export interface BuildComparisonConfig {
  buildA: DPSSimulationConfig;
  buildB: DPSSimulationConfig;
  iterations: number;
}

export interface BuildComparisonResult {
  buildAWinRate: number;
  buildBWinRate: number;
  tieRate: number;
  buildAAvgDPS: number;
  buildBAvgDPS: number;
  dpsDifference: number;
  dpsDifferencePercent: number;
}

export function compareBuildsDPS(config: BuildComparisonConfig): BuildComparisonResult {
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  let aTotalDPS = 0;
  let bTotalDPS = 0;

  for (let i = 0; i < config.iterations; i++) {
    const resultA = runSingleSimulation({ ...config.buildA, iterations: 1 });
    const resultB = runSingleSimulation({ ...config.buildB, iterations: 1 });

    aTotalDPS += resultA.dps;
    bTotalDPS += resultB.dps;

    if (Math.abs(resultA.dps - resultB.dps) < 0.01) {
      ties++;
    } else if (resultA.dps > resultB.dps) {
      aWins++;
    } else {
      bWins++;
    }
  }

  const total = config.iterations;
  const buildAAvgDPS = aTotalDPS / total;
  const buildBAvgDPS = bTotalDPS / total;

  return {
    buildAWinRate: (aWins / total) * 100,
    buildBWinRate: (bWins / total) * 100,
    tieRate: (ties / total) * 100,
    buildAAvgDPS,
    buildBAvgDPS,
    dpsDifference: buildAAvgDPS - buildBAvgDPS,
    dpsDifferencePercent: buildBAvgDPS > 0 ? ((buildAAvgDPS - buildBAvgDPS) / buildBAvgDPS) * 100 : 0,
  };
}
