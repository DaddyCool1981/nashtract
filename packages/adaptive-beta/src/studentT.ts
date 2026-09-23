/**
 * Self-contained numerical primitives for the Student's t CDF, needed
 * to turn the Normal-Inverse-Gamma posterior over mu (SPEC.md §8) into
 * the tail probabilities p- = P(mu < -epsilon) and p+ = P(mu > epsilon).
 *
 * This is standard numerical analysis (Lanczos log-gamma + a continued
 * fraction for the regularized incomplete beta function, the classic
 * "Numerical Recipes" approach), not a novel algorithm, and has no
 * runtime dependency — SPEC.md §21 asks Claude Code not to add
 * infrastructure beyond what's requested; a ~100-line, independently
 * verifiable numerical routine is the more honest choice here than
 * pulling in a general statistics library for two closed-form-checkable
 * functions. See studentT.test.ts for validation against the exact
 * closed forms available at df=1 (Cauchy) and df=2.
 */

const LANCZOS_G = 7;
const LANCZOS_COEFFICIENTS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** log(Gamma(x)) via the Lanczos approximation. */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula, for numerical stability near zero.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const xShifted = x - 1;
  let acc = LANCZOS_COEFFICIENTS[0]!;
  const t = xShifted + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    acc += LANCZOS_COEFFICIENTS[i]! / (xShifted + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (xShifted + 0.5) * Math.log(t) - t + Math.log(acc);
}

const MAX_ITERATIONS = 200;
const EPSILON = 3e-16;
const MIN_POSITIVE = 1e-300;

/** Continued-fraction evaluation used by `regularizedIncompleteBeta`. */
function incompleteBetaContinuedFraction(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < MIN_POSITIVE) d = MIN_POSITIVE;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITERATIONS; m++) {
    const m2 = 2 * m;

    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < MIN_POSITIVE) d = MIN_POSITIVE;
    c = 1 + aa / c;
    if (Math.abs(c) < MIN_POSITIVE) c = MIN_POSITIVE;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < MIN_POSITIVE) d = MIN_POSITIVE;
    c = 1 + aa / c;
    if (Math.abs(c) < MIN_POSITIVE) c = MIN_POSITIVE;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return h;
}

/** The regularized incomplete beta function I_x(a, b), for x in [0, 1] and a, b > 0. */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) {
    throw new RangeError(`regularizedIncompleteBeta: x must be within [0, 1], got ${x}`);
  }
  if (x === 0 || x === 1) return x;

  const logBeta = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(logBeta);

  if (x < (a + 1) / (a + b + 2)) {
    return (front * incompleteBetaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (front * incompleteBetaContinuedFraction(1 - x, b, a)) / b;
}

/**
 * CDF of the (Student's) t-distribution with `degreesOfFreedom > 0`,
 * evaluated at `t`. Validated in studentT.test.ts against the exact
 * closed forms for df=1 (Cauchy: 0.5 + atan(t)/pi) and df=2
 * (0.5 + t / (2*sqrt(2+t^2))).
 */
export function studentTCdf(t: number, degreesOfFreedom: number): number {
  if (!(degreesOfFreedom > 0)) {
    throw new RangeError(`studentTCdf: degreesOfFreedom must be > 0, got ${degreesOfFreedom}`);
  }
  if (t === 0) return 0.5;

  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  const ib = regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5);
  return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
}
